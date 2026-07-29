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

/**
 * Ajuste la description SDP pour la conversation.
 *
 * Opus est négocié par défaut avec des réglages orientés qualité musicale :
 * trames longues, débit élevé, stéréo. En conversation, cela se paie en
 * latence sans rien apporter à l'intelligibilité. On demande donc :
 *   • usedtx        — on cesse d'émettre pendant les silences ;
 *   • useinbandfec  — correction d'erreur, précieuse sur réseau mobile ;
 *   • stereo=0      — la voix est monophonique ;
 *   • maxaveragebitrate — 24 kbit/s suffisent et allègent le réseau ;
 *   • ptime=20      — trames de 20 ms au lieu de 60, soit 40 ms gagnées.
 */
function reglerOpusPourLaVoix(sdp: string): string {
    if (!sdp) return sdp

    // Numéro de charge utile d'Opus, lu dans la table des codecs.
    const rtpmap = sdp.match(/a=rtpmap:(\d+)\s+opus\/\d+/i)
    if (!rtpmap) return sdp
    const pt = rtpmap[1]

    const OPTIONS = 'usedtx=1;useinbandfec=1;stereo=0;maxaveragebitrate=24000'
    const fmtp = new RegExp(`a=fmtp:${pt} ([^\\r\\n]*)`)

    let sortie = fmtp.test(sdp)
        // Ligne existante : on ajoute ce qui manque, sans écraser le reste.
        ? sdp.replace(fmtp, (_m, params: string) => {
            const presentes = new Set(
                params.split(';').map(p => p.split('=')[0].trim()).filter(Boolean),
            )
            const ajouts = OPTIONS.split(';').filter(o => !presentes.has(o.split('=')[0]))
            return `a=fmtp:${pt} ${[params, ...ajouts].filter(Boolean).join(';')}`
        })
        // Aucune ligne fmtp : on la crée juste après la déclaration du codec.
        : sdp.replace(rtpmap[0], `${rtpmap[0]}\r\na=fmtp:${pt} ${OPTIONS}`)

    // Durée de trame : 20 ms, la valeur usuelle en téléphonie.
    if (!/a=ptime:/.test(sortie)) {
        sortie = sortie.replace(/(a=rtpmap:\d+\s+opus\/\d+[^\r\n]*)/i, '$1\r\na=ptime:20')
    }

    return sortie
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

    /* Les signaux arrivent par le temps réel, sans garantie d'ordre, et
       chaque traitement est asynchrone. Sans sérialisation, un candidat ICE
       pouvait etre traité pendant que setRemoteDescription était encore en
       cours : addIceCandidate levait alors une exception et le candidat
       était perdu. La connexion n'aboutissait jamais. */
    private queue: Promise<void> = Promise.resolve()

    /* Un candidat reçu avant la description distante ne peut pas être
       ajouté. On le garde de côté au lieu de le jeter. */
    private pendingIce: RTCIceCandidateInit[] = []
    private remoteReady = false
    private readonly opts: CallEngineOptions
    private readonly other: CallRole

    constructor(opts: CallEngineOptions) {
        this.opts = opts
        this.other = opts.role === 'client' ? 'agent' : 'client'
    }

    /** Micro + connexion + écoute de la signalisation. */
    private async prepare(): Promise<RTCPeerConnection> {
        const { supabase, callId } = this.opts

        /* Traitement du signal : l'annulation d'echo est indispensable des
           qu'un interlocuteur ecoute au haut-parleur. `channelCount: 1` et
           un echantillonnage a 16 kHz suffisent a la voix et reduisent le
           travail de codage, donc la latence. */
        this.localStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                channelCount: 1,
                sampleRate: 16000,
                // Variantes historiques, encore lues par certains navigateurs.
                // @ts-expect-error contraintes non standard mais supportees
                googEchoCancellation: true,
                googAutoGainControl: true,
                googNoiseSuppression: true,
                googHighpassFilter: true,
            },
            video: false,
        })

        const pc = new RTCPeerConnection({ iceServers: await getIceServers(supabase) })
        this.pc = pc

        for (const track of this.localStream.getTracks()) {
            pc.addTrack(track, this.localStream)
        }

        pc.ontrack = (event) => {
            /* Par defaut le navigateur constitue un tampon genereux pour
               lisser la gigue, au prix d'un retard audible. En conversation,
               mieux vaut un tampon court : on demande le minimum, le
               navigateur l'ajuste si le reseau l'exige. */
            try {
                const r = event.receiver as RTCRtpReceiver & { playoutDelayHint?: number }
                r.playoutDelayHint = 0
            } catch { /* propriete non supportee : sans consequence */ }

            const [stream] = event.streams
            if (stream) this.opts.onRemoteStream?.(stream)
        }

        pc.onicecandidate = (event) => {
            if (!event.candidate) {
                console.log(`[appel:${this.opts.role}] collecte terminée`)
                return
            }
            // Le TYPE du candidat dit tout : « host » = réseau local,
            // « srflx » = adresse publique vue par STUN, « relay » = passe
            // par TURN. Sans relay dans la liste, deux pairs masqués par
            // leur opérateur ne peuvent jamais se joindre.
            console.log(
                `[appel:${this.opts.role}] candidat local ${event.candidate.type}`
                + ` (${event.candidate.protocol})`,
            )
            void this.send('ice', event.candidate.toJSON())
        }

        // Se déclenche quand un serveur STUN ou TURN refuse ou ne répond pas.
        // Un code 401 ici signifie que les identifiants TURN sont rejetés.
        pc.onicecandidateerror = (event: Event) => {
            const e = event as RTCPeerConnectionIceErrorEvent
            console.warn(
                `[appel:${this.opts.role}] serveur ICE en échec — ${e.url}`
                + ` (code ${e.errorCode} : ${e.errorText})`,
            )
        }

        pc.oniceconnectionstatechange = () => {
            console.log(`[appel:${this.opts.role}] ICE → ${pc.iceConnectionState}`)
        }
        pc.onicegatheringstatechange = () => {
            console.log(`[appel:${this.opts.role}] collecte ICE → ${pc.iceGatheringState}`)
        }

        pc.onconnectionstatechange = () => {
            console.log(`[appel:${this.opts.role}] connexion → ${pc.connectionState}`)
            if (pc.connectionState === 'connected') {
                void pc.getStats().then((stats) => {
                    stats.forEach((r) => {
                        if (r.type === 'candidate-pair' && r.state === 'succeeded') {
                            console.log(`[appel:${this.opts.role}] chemin retenu`, r)
                        }
                    })
                })
            }
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
                    this.enqueue(row.type, row.payload)
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

    /** Traite les signaux un par un, dans leur ordre d'arrivée. */
    private enqueue(type: string, payload: unknown) {
        this.queue = this.queue
            .then(() => this.receive(type, payload))
            .catch(() => { /* un signal invalide ne doit pas bloquer les suivants */ })
    }

    /** Vide le tampon une fois la description distante posée. */
    private async flushIce() {
        const pc = this.pc
        if (!pc || !this.remoteReady) return
        const attente = this.pendingIce
        this.pendingIce = []
        if (attente.length > 0) {
            console.log(`[appel:${this.opts.role}] ${attente.length} candidat(s) ICE en attente appliqué(s)`)
        }
        for (const c of attente) {
            try { await pc.addIceCandidate(new RTCIceCandidate(c)) } catch { /* candidat obsolète */ }
        }
    }

    private async receive(type: string, payload: unknown) {
        const pc = this.pc
        if (!pc || this.closed) return
        console.log(`[appel:${this.opts.role}] reçu « ${type} »`)
        try {
            if (type === 'offer') {
                if (this.remoteReady) return // offre déjà traitée
                await pc.setRemoteDescription(new RTCSessionDescription(payload as RTCSessionDescriptionInit))
                this.remoteReady = true
                const answer = await pc.createAnswer()
                const sdpReponse = reglerOpusPourLaVoix(answer.sdp || '')
                await pc.setLocalDescription({ type: answer.type, sdp: sdpReponse })
                await this.send('answer', { type: answer.type, sdp: sdpReponse })
                await this.flushIce()
            } else if (type === 'answer') {
                if (pc.signalingState !== 'have-local-offer') return
                await pc.setRemoteDescription(new RTCSessionDescription(payload as RTCSessionDescriptionInit))
                this.remoteReady = true
                await this.flushIce()
            } else if (type === 'ice') {
                const candidat = payload as RTCIceCandidateInit
                if (!this.remoteReady) { this.pendingIce.push(candidat); return }
                await pc.addIceCandidate(new RTCIceCandidate(candidat))
            }
        } catch {
            // Un candidat obsolète peut être rejeté : sans conséquence.
        }
    }

    /** Côté appelant : ouvre le micro et publie l'offre. */
    async start(): Promise<void> {
        const pc = await this.prepare()
        const offer = await pc.createOffer({ offerToReceiveAudio: true })
        const sdp = reglerOpusPourLaVoix(offer.sdp || '')
        await pc.setLocalDescription({ type: offer.type, sdp })
        await this.send('offer', { type: offer.type, sdp })
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
            this.enqueue(row.type as string, row.payload)
        }
        // On attend que la file ait tout absorbé avant de rendre la main.
        await this.queue
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
