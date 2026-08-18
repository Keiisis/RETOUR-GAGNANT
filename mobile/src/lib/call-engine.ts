/* ══════════════════════════════════════════════════════════════
   APPEL VOCAL : moteur mobile

   Miroir de frontend/lib/webrtc-call.ts, adapté à React Native.
   La voix circule en pair-à-pair : Supabase ne transporte que la
   négociation (SDP et candidats ICE).

   ⚠️ react-native-webrtc est un module NATIF. Il n'existe pas dans un
   build compilé avant son ajout. `isCallSupported()` permet donc à
   l'interface de retomber proprement sur l'appel téléphonique
   classique au lieu de planter.
══════════════════════════════════════════════════════════════ */

import { NativeModules, PermissionsAndroid, Platform } from 'react-native'
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

   On interroge donc d'abord le registre des modules natifs : une simple
   lecture de propriete, qui ne peut pas echouer : et on ne charge le
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

/* ── Permission micro ──────────────────────────────────────────
   react-native-webrtc demande lui-même RECORD_AUDIO au moment du
   getUserMedia, mais son rejet est opaque : il ne distingue pas un refus
   ponctuel : que l'on peut redemander : d'un refus définitif, où Android
   n'affiche PLUS AUCUNE boîte de dialogue. Dans ce second cas, laisser
   l'utilisateur réessayer est une impasse : seul un passage par les
   réglages système débloque la situation.
   On demande donc la permission nous-mêmes, en amont, pour pouvoir
   proposer la bonne issue. */
export type EtatMicro = 'accorde' | 'refuse' | 'bloque'

export async function demanderMicro(textes: {
    titre: string
    message: string
    bouton: string
    refus: string
}): Promise<EtatMicro> {
    // iOS n'a pas d'API équivalente : getUserMedia déclenche la demande
    // système à partir de la description déclarée dans app.json.
    if (Platform.OS !== 'android') return 'accorde'

    try {
        const perm = PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
        if (await PermissionsAndroid.check(perm)) return 'accorde'

        const res = await PermissionsAndroid.request(perm, {
            title: textes.titre,
            message: textes.message,
            buttonPositive: textes.bouton,
            buttonNegative: textes.refus,
        })

        if (res === PermissionsAndroid.RESULTS.GRANTED) return 'accorde'
        if (res === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) return 'bloque'
        return 'refuse'
    } catch {
        // Demande impossible : on laisse getUserMedia tenter sa chance
        // plutôt que de bloquer un appel qui aurait pu aboutir.
        return 'accorde'
    }
}

/* ── Session audio du téléphone ────────────────────────────────
   Sans elle, Android traite l'appel comme une lecture multimédia :
   le son sort sur le haut-parleur, l'annulation d'écho matérielle
   reste inactive, et l'écran ne s'éteint pas quand on porte le
   téléphone à l'oreille. InCallManager bascule le système en mode
   « communication vocale », ce qui règle les trois d'un coup.

   Chargement paresseux et tolérant : ce module est natif lui aussi,
   son absence ne doit jamais empêcher un appel d'aboutir. */
type InCall = {
    start: (o: { media: string; auto: boolean; ringback: string }) => void
    stop: () => void
    setForceSpeakerphoneOn: (on: boolean | null) => void
    setKeepScreenOn: (on: boolean) => void
}

let inCall: InCall | null = null
let inCallCharge = false

function loadInCall(): InCall | null {
    if (inCallCharge) return inCall
    inCallCharge = true
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod = require('react-native-incall-manager')
        inCall = (mod?.default || mod) as InCall
    } catch {
        inCall = null
    }
    return inCall
}

/** Bascule le téléphone en mode conversation. Sans effet si indisponible. */
export function ouvrirSessionAudio(hautParleur = false): void {
    try {
        const m = loadInCall()
        if (!m) return
        m.start({ media: 'audio', auto: false, ringback: '' })
        m.setForceSpeakerphoneOn(hautParleur)
        m.setKeepScreenOn(true)
    } catch { /* le mode par défaut reste utilisable */ }
}

/** Rend la main au système. Idempotent. */
export function fermerSessionAudio(): void {
    try {
        const m = loadInCall()
        if (!m) return
        m.setKeepScreenOn(false)
        m.stop()
    } catch { /* déjà fermée */ }
}

/** Écouteur ou haut-parleur, pendant l'appel. */
export function basculerHautParleur(actif: boolean): void {
    try { loadInCall()?.setForceSpeakerphoneOn(actif) } catch { /* sans effet */ }
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

/**
 * Ajuste la description SDP pour la conversation : même réglage que le web.
 *
 * Opus est négocié par défaut pour la qualité musicale : trames longues,
 * débit élevé, stéréo. En conversation cela se paie en latence sans rien
 * apporter. On demande donc l'arrêt d'émission pendant les silences, la
 * correction d'erreur (précieuse sur réseau mobile), la monophonie, un
 * débit de 24 kbit/s et des trames de 20 ms au lieu de 60.
 */
function reglerOpusPourLaVoix(sdp: string): string {
    if (!sdp) return sdp

    const rtpmap = sdp.match(/a=rtpmap:(\d+)\s+opus\/\d+/i)
    if (!rtpmap) return sdp
    const pt = rtpmap[1]

    const OPTIONS = 'usedtx=1;useinbandfec=1;stereo=0;maxaveragebitrate=24000'
    const fmtp = new RegExp(`a=fmtp:${pt} ([^\\r\\n]*)`)

    let sortie = fmtp.test(sdp)
        ? sdp.replace(fmtp, (_m: string, params: string) => {
            const presentes = new Set(
                params.split(';').map(p => p.split('=')[0].trim()).filter(Boolean),
            )
            const ajouts = OPTIONS.split(';').filter(o => !presentes.has(o.split('=')[0]))
            return `a=fmtp:${pt} ${[params, ...ajouts].filter(Boolean).join(';')}`
        })
        : sdp.replace(rtpmap[0], `${rtpmap[0]}\r\na=fmtp:${pt} ${OPTIONS}`)

    if (!/a=ptime:/.test(sortie)) {
        sortie = sortie.replace(/(a=rtpmap:\d+\s+opus\/\d+[^\r\n]*)/i, '$1\r\na=ptime:20')
    }

    return sortie
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

    /* Meme correctif que cote web : les signaux arrivent sans garantie
       d'ordre et leur traitement est asynchrone. Sans serialisation, un
       candidat ICE traite pendant setRemoteDescription levait une exception
       et etait perdu : la connexion n'aboutissait jamais. */
    private queue: Promise<void> = Promise.resolve()
    private pendingIce: any[] = []
    private remoteReady = false

    constructor(private readonly opts: MobileCallOptions) {}

    private async prepare() {
        const rtc = loadWebRTC()
        if (!rtc) throw new Error('module-absent')

        const { supabase, callId } = this.opts

        ouvrirSessionAudio(false)

        /* Chaque etape porte son nom dans l'erreur qu'elle leve. Sans cela,
           « micro refuse » et « connexion impossible » remontaient a l'ecran
           sous la meme forme, et il fallait deviner laquelle traiter. Les
           rejets de react-native-webrtc ne sont pas des instances d'Error :
           on lit `message` puis `name` avant d'abandonner. */
        const cause = (e: unknown): string => {
            const o = (e || {}) as { message?: unknown; name?: unknown }
            if (typeof o.message === 'string' && o.message) return o.message
            if (typeof o.name === 'string' && o.name) return o.name
            return 'cause inconnue'
        }

        try {
            this.local = await rtc.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    channelCount: 1,
                },
                video: false,
            })
        } catch (e) {
            throw new Error(`micro : ${cause(e)}`)
        }

        let pc: any
        try {
            pc = new rtc.RTCPeerConnection({ iceServers: await getIceServers(supabase) })
        } catch (e) {
            throw new Error(`connexion : ${cause(e)}`)
        }
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

        // Nom UNIQUE par abonnement : supabase.channel(nom) réutilise l'instance
        // déjà souscrite pour un nom identique, et .on() y est alors refusé.
        // Sans risque ici : la signalisation transite par la TABLE call_signals,
        // le nom du canal n'est pas un point de rendez-vous entre les pairs.
        this.channel = supabase
            .channel(`call-${callId}-client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
            .on('postgres_changes', {
                event: 'INSERT', schema: 'public', table: 'call_signals',
                filter: `call_id=eq.${callId}`,
            }, (payload: any) => {
                const row = payload.new as { emetteur: CallRole; type: string; payload: unknown }
                if (row.emetteur !== 'agent') return
                this.enqueue(row.type, row.payload)
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

    /** Traite les signaux un par un, dans leur ordre d'arrivée. */
    private enqueue(type: string, payload: unknown) {
        this.queue = this.queue
            .then(() => this.receive(type, payload))
            .catch(() => { /* un signal invalide ne bloque pas les suivants */ })
    }

    /** Vide le tampon une fois la description distante posée. */
    private async flushIce() {
        const rtc = loadWebRTC()
        if (!rtc || !this.pc || !this.remoteReady) return
        const attente = this.pendingIce
        this.pendingIce = []
        for (const c of attente) {
            try { await this.pc.addIceCandidate(new rtc.RTCIceCandidate(c)) } catch { /* obsolète */ }
        }
    }

    private async receive(type: string, payload: unknown) {
        const rtc = loadWebRTC()
        if (!rtc || !this.pc || this.closed) return
        try {
            if (type === 'answer') {
                if (this.remoteReady) return
                await this.pc.setRemoteDescription(new rtc.RTCSessionDescription(payload))
                this.remoteReady = true
                await this.flushIce()
            } else if (type === 'ice') {
                // Un candidat reçu avant la description distante ne peut pas
                // être ajouté : on le garde au lieu de le perdre.
                if (!this.remoteReady) { this.pendingIce.push(payload); return }
                await this.pc.addIceCandidate(new rtc.RTCIceCandidate(payload))
            }
        } catch { /* candidat obsolète : sans conséquence */ }
    }

    /** Ouvre le micro et publie l'offre. */
    async start(): Promise<void> {
        const pc = await this.prepare()
        const offer = await pc.createOffer({ offerToReceiveAudio: true })
        const sdp = reglerOpusPourLaVoix(offer.sdp || '')
        await pc.setLocalDescription({ type: offer.type, sdp })
        await this.send('offer', { type: offer.type, sdp })
    }

    setMuted(muted: boolean): void {
        this.local?.getAudioTracks?.().forEach((t: any) => { t.enabled = !muted })
    }

    hangup(): void {
        if (this.closed) return
        this.closed = true
        fermerSessionAudio()
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
