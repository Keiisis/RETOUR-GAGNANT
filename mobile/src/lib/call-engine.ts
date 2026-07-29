/* ══════════════════════════════════════════════════════════════
   APPEL VOCAL — moteur mobile

   Miroir de frontend/lib/webrtc-call.ts, adapté à React Native.
   La voix circule en pair-à-pair : Supabase ne transporte que la
   négociation (SDP et candidats ICE).

   ⚠️ react-native-webrtc est un module NATIF. Il n'existe pas dans un
   build compilé avant son ajout. `isCallSupported()` permet donc à
   l'interface de retomber proprement sur l'appel téléphonique
   classique au lieu de planter.
══════════════════════════════════════════════════════════════ */

import { NativeModules } from 'react-native'
import type { SupabaseClient } from '@supabase/supabase-js'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.retourgagnantbenin.bj'

/* Chargement paresseux : un `import` direct ferait planter au démarrage
   toute application dont le build ne contient pas le module. */
type WebRTCModule = {
    RTCPeerConnection: new (config: unknown) => any
    RTCSessionDescription: new (init: unknown) => any
    RTCIceCandidate: new (init: unknown) => any
    mediaDevices: { getUserMedia: (c: unknown) => Promise<any> }
}

let webrtc: WebRTCModule | null = null
let tenteDeCharger = false

/* react-native-webrtc LÈVE une exception des son chargement quand la
   partie native est absente (voir son index.ts : `if (WebRTCModule === null)
   throw`). Un try/catch autour du require ne suffit pas : sur un build
   compile avant l'ajout du module, l'erreur remontait jusqu'a l'ecran et
   affichait un ecran rouge au lieu de basculer sur l'appel telephonique.

   On interroge donc d'abord le registre des modules natifs — une simple
   lecture de propriete, qui ne peut pas echouer — et on ne charge le
   module JS que s'il a de quoi fonctionner. */
function loadWebRTC(): WebRTCModule | null {
    if (tenteDeCharger) return webrtc
    tenteDeCharger = true
    try {
        const natif = (NativeModules as Record<string, unknown>).WebRTCModule
        if (!natif) return (webrtc = null)
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        webrtc = require('react-native-webrtc') as WebRTCModule
    } catch {
        webrtc = null
    }
    return webrtc
}

/** L'appel in-app est-il disponible dans CE build ? */
export function isCallSupported(): boolean {
    return loadWebRTC() !== null
}

export type CallRole = 'client' | 'agent'

interface IceServer { urls: string | string[]; username?: string; credential?: string }

/* Repli utilisé si la route serveur est injoignable. Il contient déjà
   le relais public : ainsi l'appel garde toutes ses chances d'aboutir
   même quand notre propre API ne répond pas. */
const DEFAULT_ICE: IceServer[] = [
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

/* La table `settings` est en RLS « admin only » : la lire depuis l'app
   renverrait toujours une liste vide et TURN serait ignoré en silence.
   On interroge donc la route serveur, qui lit avec le rôle de service. */
async function getIceServers(supabase: SupabaseClient): Promise<IceServer[]> {
    try {
        const { data: session } = await supabase.auth.getSession()
        const token = session.session?.access_token
        const res = await fetch(`${API_BASE}/api/calls/ice-servers`, {
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

export interface MobileCallOptions {
    supabase: SupabaseClient
    callId: string
    onStateChange?: (state: string) => void
    onEnded?: (raison: string) => void
}

export class MobileCallEngine {
    private pc: any = null
    private local: any = null
    private channel: any = null
    private closed = false

    constructor(private readonly opts: MobileCallOptions) {}

    private async prepare() {
        const rtc = loadWebRTC()
        if (!rtc) throw new Error('module-absent')

        const { supabase, callId } = this.opts

        this.local = await rtc.mediaDevices.getUserMedia({ audio: true, video: false })

        const pc = new rtc.RTCPeerConnection({ iceServers: await getIceServers(supabase) })
        this.pc = pc

        for (const track of this.local.getTracks()) pc.addTrack(track, this.local)

        pc.onicecandidate = (e: any) => {
            if (e?.candidate) void this.send('ice', e.candidate.toJSON())
        }
        pc.onconnectionstatechange = () => {
            this.opts.onStateChange?.(pc.connectionState)
            if (pc.connectionState === 'failed') {
                this.opts.onEnded?.("La connexion audio n'a pas pu s'établir.")
            }
        }

        this.channel = supabase
            .channel(`call-${callId}-client`)
            .on('postgres_changes', {
                event: 'INSERT', schema: 'public', table: 'call_signals',
                filter: `call_id=eq.${callId}`,
            }, (payload: any) => {
                const row = payload.new as { emetteur: CallRole; type: string; payload: unknown }
                if (row.emetteur !== 'agent') return
                void this.receive(row.type, row.payload)
            })
            .subscribe()

        return pc
    }

    private async send(type: 'offer' | 'answer' | 'ice', payload: unknown) {
        if (this.closed) return
        await this.opts.supabase.from('call_signals').insert({
            call_id: this.opts.callId,
            emetteur: 'client',
            type,
            payload: payload as Record<string, unknown>,
        })
    }

    private async receive(type: string, payload: unknown) {
        const rtc = loadWebRTC()
        if (!rtc || !this.pc || this.closed) return
        try {
            if (type === 'answer') {
                await this.pc.setRemoteDescription(new rtc.RTCSessionDescription(payload))
            } else if (type === 'ice') {
                await this.pc.addIceCandidate(new rtc.RTCIceCandidate(payload))
            }
        } catch { /* candidat tardif : sans conséquence */ }
    }

    /** Ouvre le micro et publie l'offre. */
    async start(): Promise<void> {
        const pc = await this.prepare()
        const offer = await pc.createOffer({ offerToReceiveAudio: true })
        await pc.setLocalDescription(offer)
        await this.send('offer', { type: offer.type, sdp: offer.sdp })
    }

    setMuted(muted: boolean): void {
        this.local?.getAudioTracks?.().forEach((t: any) => { t.enabled = !muted })
    }

    hangup(): void {
        if (this.closed) return
        this.closed = true
        try { this.local?.getTracks?.().forEach((t: any) => t.stop()) } catch { /* déjà arrêté */ }
        try { this.pc?.close?.() } catch { /* déjà fermée */ }
        if (this.channel) { void this.opts.supabase.removeChannel(this.channel) }
        this.pc = null; this.local = null; this.channel = null
    }
}

export function formatDuree(secondes: number): string {
    const m = Math.floor(secondes / 60)
    const s = secondes % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
