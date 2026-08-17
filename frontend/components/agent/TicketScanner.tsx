'use client'

/**
 * Scanner de billets — pensé pour un agent debout à l'entrée, téléphone en main.
 *
 * Deux entrées, jamais bloquantes l'une par l'autre :
 *   1. CAMÉRA : lecture continue du QR (html5-qrcode). La caméra arrière est
 *      choisie d'office ; on repasse sur n'importe quelle caméra disponible si
 *      la contrainte échoue.
 *   2. SAISIE MANUELLE : le code imprimé sur le billet, si l'objectif est sale,
 *      l'écran cassé, la lumière mauvaise ou la permission refusée.
 *
 * Points de robustesse :
 *   - la caméra exige HTTPS (ou localhost) : on le détecte et on l'explique au
 *     lieu de laisser un écran noir ;
 *   - anti-double-scan : un même code n'est pas renvoyé deux fois de suite, et
 *     un verrou empêche deux validations simultanées (le lecteur émet plusieurs
 *     fois par seconde) ;
 *   - le QR contient un JSON signé : on en extrait `ticket_code` avant appel,
 *     tout en acceptant un code brut ;
 *   - la caméra est libérée à la fermeture (sinon la LED reste allumée et la
 *     ressource est verrouillée pour les autres onglets) ;
 *   - le verdict est SONORE et VIBRANT : à l'entrée, on n'a pas le temps de lire.
 *
 * La décision reste SERVEUR : /api/events/[id]/validate marque la présence par
 * un UPDATE conditionnel (is_used = false). Le premier scan gagne ; ce composant
 * ne fait qu'afficher le verdict.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    X, Camera, Keyboard, CheckCircle as CheckCircle2, XCircle,
    CircleNotch as Loader2, Warning as AlertTriangle, User, Envelope as Mail,
    Phone, ArrowClockwise as RefreshCw,
} from '@phosphor-icons/react'

interface Invite {
    full_name?: string
    email?: string
    phone?: string
    ticket_type?: string
}

interface Verdict {
    kind: 'ok' | 'used' | 'invalid' | 'error'
    titre: string
    detail?: string
    invite?: Invite
    code?: string
}

/** Un bip court : vert = accepté, grave = refusé. Aucun fichier à charger. */
function bip(ok: boolean) {
    try {
        const Ctx = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)
        if (!Ctx) return
        const ctx = new Ctx()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain); gain.connect(ctx.destination)
        osc.frequency.value = ok ? 880 : 220
        gain.gain.setValueAtTime(0.06, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (ok ? 0.18 : 0.42))
        osc.start()
        osc.stop(ctx.currentTime + (ok ? 0.2 : 0.45))
        setTimeout(() => ctx.close().catch(() => { }), 700)
    } catch { /* le son est un bonus, jamais un prérequis */ }
}

function vibre(ok: boolean) {
    try { navigator.vibrate?.(ok ? 60 : [80, 60, 80]) } catch { /* ignoré */ }
}

/** Extrait le code depuis un QR signé (JSON) ou accepte un code brut. */
export function extraireCode(brut: string): string {
    const v = (brut || '').trim()
    if (!v) return ''
    if (v.startsWith('{')) {
        try {
            const o = JSON.parse(v) as { ticket_code?: string }
            if (o.ticket_code) return String(o.ticket_code).trim()
        } catch { /* pas du JSON : on prend tel quel */ }
    }
    return v.toUpperCase()
}

export default function TicketScanner({
    eventId, eventTitle, validatedBy, onClose, onValidated,
}: {
    eventId: string
    eventTitle: string
    validatedBy: string
    onClose: () => void
    onValidated?: () => void
}) {
    const [mode, setMode] = useState<'camera' | 'manuel'>('camera')
    const [camEtat, setCamEtat] = useState<'init' | 'ok' | 'refus' | 'absente' | 'insecure'>('init')
    const [verdict, setVerdict] = useState<Verdict | null>(null)
    const [enCours, setEnCours] = useState(false)
    const [codeManuel, setCodeManuel] = useState('')
    const [compteur, setCompteur] = useState(0)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lecteurRef = useRef<any>(null)
    const verrouRef = useRef(false)          // une validation à la fois
    const dernierRef = useRef<string>('')    // anti-répétition du même code
    const monteRef = useRef(true)

    const valider = useCallback(async (brut: string) => {
        const code = extraireCode(brut)
        if (!code) return
        if (verrouRef.current) return
        if (code === dernierRef.current) return // le lecteur répète en continu

        verrouRef.current = true
        dernierRef.current = code
        setEnCours(true)

        try {
            const res = await fetch(`/api/events/${eventId}/validate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ticket_code: code, validated_by: validatedBy || 'Agent' }),
            })
            const d = await res.json().catch(() => ({}))

            if (res.ok && d.valid) {
                const reg = d.ticket?.event_registrations
                const inv: Invite | undefined = Array.isArray(reg) ? reg[0] : reg
                setVerdict({
                    kind: 'ok',
                    titre: 'Entrée autorisée',
                    detail: 'Présence enregistrée.',
                    invite: inv,
                    code,
                })
                setCompteur(c => c + 1)
                bip(true); vibre(true)
                onValidated?.()
            } else if (d.already_used) {
                setVerdict({ kind: 'used', titre: 'Billet déjà utilisé', detail: d.error, code })
                bip(false); vibre(false)
            } else {
                setVerdict({
                    kind: d.error?.includes('introuvable') ? 'invalid' : 'error',
                    titre: d.error?.includes('introuvable') ? 'Billet inconnu' : 'Billet refusé',
                    detail: d.error || 'Ce billet n’est pas valable pour cet événement.',
                    code,
                })
                bip(false); vibre(false)
            }
        } catch {
            setVerdict({ kind: 'error', titre: 'Réseau indisponible', detail: 'Vérifiez la connexion, puis réessayez.', code })
            bip(false); vibre(false)
        } finally {
            setEnCours(false)
            verrouRef.current = false
            // On réautorise le même code après un délai : utile si un invité
            // repasse volontairement pour relire le verdict.
            setTimeout(() => { if (monteRef.current) dernierRef.current = '' }, 2500)
        }
    }, [eventId, validatedBy, onValidated])

    /* ── Caméra ── */
    useEffect(() => {
        monteRef.current = true
        if (mode !== 'camera') return

        // getUserMedia n'existe qu'en contexte sécurisé : sans ça, écran noir
        // inexpliqué. On le dit franchement.
        if (typeof window !== 'undefined' && !window.isSecureContext) {
            setCamEtat('insecure')
            return
        }

        let annule = false
        ;(async () => {
            try {
                const { Html5Qrcode } = await import('html5-qrcode')
                const cameras = await Html5Qrcode.getCameras().catch(() => [])
                if (annule) return
                if (!cameras || cameras.length === 0) { setCamEtat('absente'); return }

                const lecteur = new Html5Qrcode('rgb-scanner-zone', { verbose: false })
                lecteurRef.current = lecteur

                const config = { fps: 12, qrbox: { width: 250, height: 250 }, aspectRatio: 1 }
                try {
                    // Caméra arrière de préférence : c'est celle qu'on pointe.
                    await lecteur.start({ facingMode: 'environment' }, config, txt => valider(txt), () => { })
                } catch {
                    // Contrainte refusée (webcam frontale unique, etc.) : on prend
                    // la dernière caméra listée, souvent l'arrière sur mobile.
                    await lecteur.start(cameras[cameras.length - 1].id, config, txt => valider(txt), () => { })
                }
                if (!annule) setCamEtat('ok')
            } catch (e) {
                if (annule) return
                const msg = e instanceof Error ? e.message : ''
                setCamEtat(/permission|denied|NotAllowed/i.test(msg) ? 'refus' : 'absente')
            }
        })()

        return () => {
            annule = true
            const l = lecteurRef.current
            lecteurRef.current = null
            // Libération explicite : sinon la caméra reste occupée (LED allumée)
            // et les autres onglets ne peuvent plus l'ouvrir.
            if (l) {
                l.stop().then(() => l.clear()).catch(() => { try { l.clear() } catch { /* déjà libérée */ } })
            }
        }
    }, [mode, valider])

    useEffect(() => () => { monteRef.current = false }, [])

    const couleur = verdict?.kind === 'ok'
        ? { bord: 'border-emerald-400', fond: 'bg-emerald-500/15', texte: 'text-emerald-300' }
        : verdict?.kind === 'used'
            ? { bord: 'border-amber-400', fond: 'bg-amber-500/15', texte: 'text-amber-300' }
            : { bord: 'border-red-400', fond: 'bg-red-500/15', texte: 'text-red-300' }

    return (
        <div className="fixed inset-0 z-[80] flex flex-col bg-[#070B10]">
            {/* Barre haute */}
            <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
                <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-400">Contrôle d&apos;entrée</p>
                    <p className="truncate text-sm font-bold text-white">{eventTitle}</p>
                </div>
                {compteur > 0 && (
                    <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-black text-emerald-300">
                        {compteur} validé{compteur > 1 ? 's' : ''}
                    </span>
                )}
                <button onClick={onClose} className="rounded-xl p-2 text-gray-400 hover:bg-white/5 hover:text-white" aria-label="Fermer">
                    <X size={20} />
                </button>
            </div>

            {/* Bascule caméra / saisie */}
            <div className="flex gap-2 px-4 py-3">
                {([['camera', 'Caméra', Camera], ['manuel', 'Saisir le code', Keyboard]] as const).map(([m, label, Icone]) => (
                    <button
                        key={m}
                        onClick={() => { setMode(m); setVerdict(null) }}
                        className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-colors ${mode === m ? 'bg-emerald-500 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'
                            }`}
                    >
                        <Icone size={16} /> {label}
                    </button>
                ))}
            </div>

            {/* Zone active */}
            <div className="flex-1 overflow-y-auto px-4 pb-4">
                {mode === 'camera' ? (
                    <div className="mx-auto w-full max-w-md">
                        <div className="relative overflow-hidden rounded-2xl bg-black" style={{ aspectRatio: '1' }}>
                            <div id="rgb-scanner-zone" className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />

                            {camEtat === 'init' && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-gray-400">
                                    <Loader2 size={26} className="animate-spin" />
                                    <p className="text-sm">Ouverture de la caméra…</p>
                                </div>
                            )}

                            {camEtat !== 'init' && camEtat !== 'ok' && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
                                    <AlertTriangle size={28} className="text-amber-400" />
                                    <p className="text-sm font-bold text-white">
                                        {camEtat === 'refus' ? 'Accès caméra refusé'
                                            : camEtat === 'insecure' ? 'Caméra indisponible en HTTP'
                                                : 'Aucune caméra détectée'}
                                    </p>
                                    <p className="text-xs leading-relaxed text-gray-400">
                                        {camEtat === 'refus'
                                            ? 'Autorisez la caméra dans les réglages du navigateur, puis réessayez.'
                                            : camEtat === 'insecure'
                                                ? 'Ouvrez le panel en HTTPS (https://www.retourgagnantbenin.bj) : les navigateurs interdisent la caméra sinon.'
                                                : 'Aucun objectif accessible sur cet appareil.'}
                                    </p>
                                    <button
                                        onClick={() => setMode('manuel')}
                                        className="mt-1 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-white"
                                    >
                                        Saisir le code à la main
                                    </button>
                                </div>
                            )}

                            {/* Mire : cadre de visée discret */}
                            {camEtat === 'ok' && (
                                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                                    <div className="h-[62%] w-[62%] rounded-2xl border-2 border-emerald-400/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
                                </div>
                            )}
                        </div>
                        <p className="mt-3 text-center text-xs text-gray-500">
                            Présentez le QR du billet dans le cadre. La validation est automatique.
                        </p>
                    </div>
                ) : (
                    <form
                        onSubmit={e => { e.preventDefault(); valider(codeManuel); setCodeManuel('') }}
                        className="mx-auto w-full max-w-md pt-2"
                    >
                        <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500">Code du billet</label>
                        <input
                            value={codeManuel}
                            onChange={e => setCodeManuel(e.target.value.toUpperCase())}
                            placeholder="RGB-XXXX-XXXXXXXX"
                            autoFocus
                            autoCapitalize="characters"
                            autoComplete="off"
                            spellCheck={false}
                            className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 font-mono text-lg tracking-wider text-white outline-none placeholder:text-gray-600 focus:border-emerald-500"
                        />
                        <button
                            type="submit"
                            disabled={!codeManuel.trim() || enCours}
                            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 font-black text-white disabled:opacity-50"
                        >
                            {enCours ? <Loader2 size={17} className="animate-spin" /> : <CheckCircle2 size={17} />}
                            Valider l&apos;entrée
                        </button>
                        <p className="mt-2 text-center text-xs text-gray-500">
                            Le code figure sous le QR, sur le billet de l&apos;invité.
                        </p>
                    </form>
                )}

                {/* Verdict */}
                <AnimatePresence mode="wait">
                    {verdict && (
                        <motion.div
                            key={`${verdict.kind}-${verdict.code}-${compteur}`}
                            initial={{ opacity: 0, y: 14 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className={`mx-auto mt-4 w-full max-w-md rounded-2xl border-2 p-4 ${couleur.bord} ${couleur.fond}`}
                        >
                            <div className="flex items-start gap-3">
                                {verdict.kind === 'ok'
                                    ? <CheckCircle2 size={26} className="shrink-0 text-emerald-400" />
                                    : verdict.kind === 'used'
                                        ? <AlertTriangle size={26} className="shrink-0 text-amber-400" />
                                        : <XCircle size={26} className="shrink-0 text-red-400" />}
                                <div className="min-w-0 flex-1">
                                    <p className={`font-black ${couleur.texte}`}>{verdict.titre}</p>
                                    {verdict.detail && <p className="mt-0.5 text-sm text-gray-300">{verdict.detail}</p>}
                                    {verdict.code && (
                                        <p className="mt-1 font-mono text-[11px] text-gray-500">{verdict.code}</p>
                                    )}

                                    {verdict.invite && (
                                        <div className="mt-3 space-y-1.5 border-t border-white/10 pt-3">
                                            <p className="flex items-center gap-2 text-sm font-bold text-white">
                                                <User size={14} className="text-gray-400" />
                                                {verdict.invite.full_name || 'Invité'}
                                                {verdict.invite.ticket_type === 'vip' && (
                                                    <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-black text-amber-300">VIP</span>
                                                )}
                                            </p>
                                            {verdict.invite.email && (
                                                <p className="flex items-center gap-2 text-sm text-gray-300">
                                                    <Mail size={14} className="text-gray-500" /> {verdict.invite.email}
                                                </p>
                                            )}
                                            {verdict.invite.phone && (
                                                <a href={`tel:${verdict.invite.phone}`} className="flex items-center gap-2 text-sm text-gray-300 hover:text-emerald-300">
                                                    <Phone size={14} className="text-gray-500" /> {verdict.invite.phone}
                                                </a>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <button
                                onClick={() => { setVerdict(null); dernierRef.current = '' }}
                                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 py-2.5 text-sm font-bold text-white hover:bg-white/15"
                            >
                                <RefreshCw size={15} /> Scanner le suivant
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}
