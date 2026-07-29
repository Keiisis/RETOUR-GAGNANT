/* ══════════════════════════════════════════════════════════════
   APPEL VOCAL — moteur partagé (navigateur)

   Utilisé par l'espace client et par le panel agent. La voix circule
   en pair-à-pair : elle ne passe ni par Supabase ni par nos serveurs.
   Supabase ne transporte que la négociation (SDP + candidats ICE).

   Déroulé d'un appel :
     1. le client crée une ligne dans `calls` (statut = ringing) ;
     2. il publie son offre SDP dans `call_signals` ;
     3. l'agent voit l'appel sonner (temps réel), décroche, publie sa
        réponse SDP et passe le statut à `active` ;
     4. les deux côtés échangent leurs candidats ICE ;
     5. le premier qui raccroche passe le statut à `ended`.

   Robustesse réseau : la connexion directe couvre la majorité des
   appels. Quand les deux interlocuteurs sont derrière un réseau
   opérateur qui masque leur adresse — fréquent sur mobile — un relais
   TURN prend le relais. Un relais public gratuit est fourni par
   défaut ; l'agence peut lui substituer le sien via `settings`
   (turn_url / turn_username / turn_credential). Le système ne dépend
   d'aucun de ces niveaux : il se dégrade sans jamais casser.
══════════════════════════════════════════════════════════════ */

import type { SupabaseClient } from '@supabase/supabase-js'

export type CallRole = 'client' | 'agent'

export interface IceServerConfig {
    urls: string | string[]
    username?: string
    credential?: string
}

/* Repli utilisé si la route serveur est injoignable. Il contient déjà
   le relais public : ainsi l'appel garde toutes ses chances d'aboutir
   même quand notre propre API ne répond pas. */
const DEFAULT_ICE: IceServerConfig[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    {
        urls: [
            'turn:openrelay.metered.ca:80',
            'turn:openrelay.metered.ca:443',
            'turn:openrelay.metered.ca:443?transport=tcp',
        ],
        username: 'openrelayproject',
        credential: 'openrelayproject',
    },
]

/**
 * Récupère la configuration ICE auprès du serveur.
 *
 * La table `settings` est en RLS « admin only » : la lire depuis le
 * navigateur renverrait toujours une liste vide, et TURN serait ignoré
 * sans le moindre message d'erreur. On passe donc par une route serveur
 * qui lit avec le rôle de service.
 */
export async function getIceServers(supabase: SupabaseClient): Promise<IceServerConfig[]> {
    try {
        const { data: session } = await supabase.auth.getSession()
        const token = session.session?.access_token
        const res = await fetch('/api/calls/ice-servers', {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        })
        if (!res.ok) return DEFAULT_ICE
        const json = await res.json()
        const list = Array.isArray(json?.iceServers) ? json.iceServers : null
        return list && list.length > 0 ? list : DEFAULT_ICE
    } catch {
        return DEFAULT_ICE
    }
}

export interface CallEngineOptions {
    supabase: SupabaseClient
    callId: string
    role: CallRole
    /** État de la connexion, pour l'affichage. */
    onStateChange?: (state: RTCPeerConnectionState) => void
    /** Flux distant prêt : à brancher sur un <audio>. */
    onRemoteStream?: (stream: MediaStream) => void
    /** L'autre partie a raccroché ou la connexion est morte. */
    onEnded?: (raison: string) => void
}

/**
 * Pilote une connexion audio. L'appelant fournit le `callId` : la ligne
 * `calls` doit déjà exister.
 */
export class CallEngine {
    private pc: RTCPeerConnection | null = null
    private localStream: MediaStream | null = null
    private channel: ReturnType<SupabaseClient['channel']> | null = null
    private closed = false
    private readonly opts: CallEngineOptions
    private readonly other: CallRole

    constructor(opts: CallEngineOptions) {
        this.opts = opts
        this.other = opts.role === 'client' ? 'agent' : 'client'
    }

    /** Micro + connexion + écoute de la signalisation. */
    private async prepare(): Promise<RTCPeerConnection> {
        const { supabase, callId } = this.opts

        this.localStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
            },
            video: false,
        })

        const pc = new RTCPeerConnection({ iceServers: await getIceServers(supabase) })
        this.pc = pc

        for (const track of this.localStream.getTracks()) {
            pc.addTrack(track, this.localStream)
        }

        pc.ontrack = (event) => {
            const [stream] = event.streams
            if (stream) this.opts.onRemoteStream?.(stream)
        }

        pc.onicecandidate = (event) => {
            if (!event.candidate) return
            void this.send('ice', event.candidate.toJSON())
        }

        pc.onconnectionstatechange = () => {
            this.opts.onStateChange?.(pc.connectionState)
            if (pc.connectionState === 'failed') {
                this.opts.onEnded?.('La connexion audio n’a pas pu s’établir.')
            }
            if (pc.connectionState === 'disconnected') {
                this.opts.onEnded?.('Connexion interrompue.')
            }
        }

        // Signalisation entrante — uniquement celle émise par l'autre partie.
        this.channel = supabase
            .channel(`call-${callId}-${this.opts.role}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'call_signals',
                    filter: `call_id=eq.${callId}`,
                },
                (payload) => {
                    const row = payload.new as { emetteur: CallRole; type: string; payload: unknown }
                    if (row.emetteur !== this.other) return
                    void this.receive(row.type, row.payload)
                },
            )
            .subscribe()

        return pc
    }

    private async send(type: 'offer' | 'answer' | 'ice', payload: unknown) {
        if (this.closed) return
        await this.opts.supabase.from('call_signals').insert({
            call_id: this.opts.callId,
            emetteur: this.opts.role,
            type,
            payload: payload as Record<string, unknown>,
        })
    }

    private async receive(type: string, payload: unknown) {
        const pc = this.pc
        if (!pc || this.closed) return
        try {
            if (type === 'offer') {
                await pc.setRemoteDescription(new RTCSessionDescription(payload as RTCSessionDescriptionInit))
                const answer = await pc.createAnswer()
                await pc.setLocalDescription(answer)
                await this.send('answer', { type: answer.type, sdp: answer.sdp })
            } else if (type === 'answer') {
                if (pc.signalingState === 'have-local-offer') {
                    await pc.setRemoteDescription(new RTCSessionDescription(payload as RTCSessionDescriptionInit))
                }
            } else if (type === 'ice') {
                await pc.addIceCandidate(new RTCIceCandidate(payload as RTCIceCandidateInit))
            }
        } catch {
            // Un candidat ICE tardif peut être rejeté : sans conséquence.
        }
    }

    /** Côté appelant : ouvre le micro et publie l'offre. */
    async start(): Promise<void> {
        const pc = await this.prepare()
        const offer = await pc.createOffer({ offerToReceiveAudio: true })
        await pc.setLocalDescription(offer)
        await this.send('offer', { type: offer.type, sdp: offer.sdp })
    }

    /** Côté appelé : ouvre le micro et attend l'offre déjà publiée. */
    async answer(): Promise<void> {
        await this.prepare()
        // L'offre est peut-être arrivée avant l'abonnement : on la relit.
        const { data } = await this.opts.supabase
            .from('call_signals')
            .select('type, payload, emetteur')
            .eq('call_id', this.opts.callId)
            .eq('emetteur', this.other)
            .order('id', { ascending: true })

        for (const row of data || []) {
            await this.receive(row.type as string, row.payload)
        }
    }

    /** Coupe le micro et ferme tout. Idempotent. */
    hangup(): void {
        if (this.closed) return
        this.closed = true
        try { this.localStream?.getTracks().forEach(t => t.stop()) } catch { /* déjà arrêté */ }
        try { this.pc?.close() } catch { /* déjà fermée */ }
        if (this.channel) { void this.opts.supabase.removeChannel(this.channel) }
        this.pc = null
        this.localStream = null
        this.channel = null
    }

    /** Coupe ou rétablit le micro sans quitter l'appel. */
    setMuted(muted: boolean): void {
        this.localStream?.getAudioTracks().forEach(t => { t.enabled = !muted })
    }
}

/** Durée lisible : 03:07. */
export function formatDuree(secondes: number): string {
    const m = Math.floor(secondes / 60)
    const s = secondes % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
