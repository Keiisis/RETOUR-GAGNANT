'use client'

/**
 * Éditeur du DESIGN DU BILLET.
 *
 * L'équipe fournit le HTML du billet ; le QR est injecté automatiquement à
 * l'emplacement du marqueur {{QR_CODE}}. Deux niveaux :
 *   · modèle GLOBAL      → sert à tous les événements
 *   · modèle PAR ÉVÉNEMENT → remplace le global pour cet événement seulement
 *
 * L'aperçu est rendu en direct dans une iframe isolée (sandbox), avec un vrai
 * QR d'exemple : on voit exactement ce que l'invité recevra, sans avoir à
 * émettre un billet. L'iframe évite que le CSS du design ne déteigne sur le
 * panel — un design tiers peut contenir n'importe quel sélecteur.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
    FloppyDisk as Save, CircleNotch as Loader2, Eye, Code, X,
    CheckCircle as CheckCircle2, Warning as AlertTriangle, ArrowCounterClockwise as Undo2,
    Copy,
} from '@phosphor-icons/react'

interface Props {
    /** Absent = modèle global. Présent = modèle propre à cet événement. */
    eventId?: string
    eventTitle?: string
    onClose: () => void
}

/** Données d'exemple pour l'aperçu : jamais un vrai invité. */
const EXEMPLE = {
    '{{TICKET_CODE}}': 'RGB-DEMO-4F2A9C10',
    '{{FULL_NAME}}': 'Amínatou HOUNKPATIN',
    '{{EMAIL}}': 'aminatou.h@exemple.bj',
    '{{PHONE}}': '+229 01 97 95 50 90',
    '{{TICKET_TYPE}}': 'VIP',
    '{{EVENT_TITLE}}': 'Soirée Retour aux Sources',
    '{{EVENT_DATE}}': 'samedi 6 septembre 2026 à 19:00',
    '{{EVENT_LOCATION}}': 'Haie-Vive Cocotiers, Cotonou',
}

export default function TicketTemplateEditor({ eventId, eventTitle, onClose }: Props) {
    const [html, setHtml] = useState('')
    const [defautHtml, setDefautHtml] = useState('')
    const [globalHtml, setGlobalHtml] = useState<string | null>(null)
    const [marqueurs, setMarqueurs] = useState<string[]>([])
    const [chargement, setChargement] = useState(true)
    const [enregistrement, setEnregistrement] = useState(false)
    const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null)
    const [vue, setVue] = useState<'code' | 'apercu'>('code')
    const [qrDemo, setQrDemo] = useState('')
    const zoneRef = useRef<HTMLTextAreaElement>(null)

    /* QR d'exemple, généré dans le navigateur : l'aperçu doit montrer un vrai
       code, pas un carré gris qui masquerait un problème de mise en page. */
    useEffect(() => {
        import('qrcode')
            .then(m => m.toDataURL('APERCU-DESIGN-BILLET', { width: 420, margin: 1 }))
            .then(setQrDemo)
            .catch(() => setQrDemo(''))
    }, [])

    const charger = useCallback(async () => {
        setChargement(true)
        try {
            const url = eventId
                ? `/api/events/ticket-template?event_id=${encodeURIComponent(eventId)}`
                : '/api/events/ticket-template'
            const res = await fetch(url)
            const j = await res.json()
            setDefautHtml(j.default_html || '')
            setGlobalHtml(j.global_html || null)
            setMarqueurs(Array.isArray(j.markers) ? j.markers : [])
            // Ce qui s'applique réellement aujourd'hui : propre > global > défaut.
            setHtml(j.html || (eventId ? '' : (j.global_html || j.default_html || '')))
        } catch {
            setMessage({ ok: false, texte: 'Chargement impossible.' })
        } finally {
            setChargement(false)
        }
    }, [eventId])

    useEffect(() => { charger() }, [charger])

    const sansQr = html.trim().length > 0 && !html.includes('{{QR_CODE}}')

    const enregistrer = async () => {
        if (sansQr) return
        setEnregistrement(true); setMessage(null)
        try {
            const res = await fetch('/api/events/ticket-template', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ html, event_id: eventId || null }),
            })
            const j = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(j.error || 'Enregistrement refusé.')
            setMessage({
                ok: true,
                texte: j.reset
                    ? 'Design réinitialisé : le modèle hérité s’applique de nouveau.'
                    : 'Design enregistré. Les prochains billets l’utiliseront.',
            })
        } catch (e) {
            setMessage({ ok: false, texte: e instanceof Error ? e.message : 'Erreur.' })
        } finally {
            setEnregistrement(false)
        }
    }

    /** Insère un marqueur à la position du curseur. */
    const insererMarqueur = (m: string) => {
        const ta = zoneRef.current
        if (!ta) { setHtml(h => h + m); return }
        const debut = ta.selectionStart ?? html.length
        const fin = ta.selectionEnd ?? html.length
        const suivant = html.slice(0, debut) + m + html.slice(fin)
        setHtml(suivant)
        requestAnimationFrame(() => {
            ta.focus()
            ta.setSelectionRange(debut + m.length, debut + m.length)
        })
    }

    /* Aperçu : marqueurs remplacés par l'exemple, QR par une vraie image. */
    const apercu = useMemo(() => {
        let out = html || defautHtml
        for (const [m, v] of Object.entries(EXEMPLE)) out = out.split(m).join(v)
        out = out.split('{{QR_CODE}}').join(qrDemo)
        return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;padding:22px 14px;background:#F3F6F4}</style>
</head><body>${out}</body></html>`
    }, [html, defautHtml, qrDemo])

    return (
        <div className="fixed inset-0 z-[70] flex flex-col bg-[#070B10]">
            {/* Barre haute */}
            <div className="flex items-center gap-3 border-b border-white/10 px-5 py-3">
                <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-400">
                        Design du billet
                    </p>
                    <p className="truncate text-sm font-bold text-white">
                        {eventId ? `Propre à : ${eventTitle || 'cet événement'}` : 'Modèle global (tous les événements)'}
                    </p>
                </div>

                <div className="hidden gap-1 rounded-xl bg-white/5 p-1 sm:flex">
                    {([['code', 'Code', Code], ['apercu', 'Aperçu', Eye]] as const).map(([v, label, Icone]) => (
                        <button
                            key={v}
                            onClick={() => setVue(v)}
                            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${vue === v ? 'bg-emerald-500 text-white' : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            <Icone size={14} /> {label}
                        </button>
                    ))}
                </div>

                <button onClick={onClose} className="rounded-xl p-2 text-gray-400 hover:bg-white/5 hover:text-white" aria-label="Fermer">
                    <X size={20} />
                </button>
            </div>

            {chargement ? (
                <div className="flex flex-1 items-center justify-center">
                    <Loader2 size={26} className="animate-spin text-emerald-400" />
                </div>
            ) : (
                <>
                    {/* Marqueurs : cliquer les insère au curseur */}
                    <div className="flex flex-wrap items-center gap-1.5 border-b border-white/10 px-5 py-2.5">
                        <span className="mr-1 text-[10px] font-black uppercase tracking-wider text-gray-500">
                            Insérer :
                        </span>
                        {marqueurs.map(m => (
                            <button
                                key={m}
                                onClick={() => insererMarqueur(m)}
                                title={m === '{{QR_CODE}}' ? 'Obligatoire : emplacement du QR' : 'Insérer au curseur'}
                                className={`rounded-lg px-2 py-1 font-mono text-[11px] font-bold transition-colors ${m === '{{QR_CODE}}'
                                    ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                                    : 'bg-white/5 text-gray-300 hover:bg-white/10'
                                    }`}
                            >
                                {m}
                            </button>
                        ))}
                    </div>

                    {/* Zone de travail : code + aperçu côte à côte sur grand écran */}
                    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
                        <div className={`min-h-0 flex-1 ${vue === 'apercu' ? 'hidden lg:block' : ''}`}>
                            <textarea
                                ref={zoneRef}
                                value={html}
                                onChange={e => setHtml(e.target.value)}
                                spellCheck={false}
                                placeholder={eventId
                                    ? 'Vide = ce type d’événement utilise le modèle global.'
                                    : 'Collez ici le HTML du billet. Placez {{QR_CODE}} dans le src d’une image.'}
                                className="h-full w-full resize-none border-0 bg-[#0B1017] p-5 font-mono text-[12.5px] leading-relaxed text-gray-200 outline-none"
                            />
                        </div>

                        <div className={`min-h-0 flex-1 border-t border-white/10 lg:border-l lg:border-t-0 ${vue === 'code' ? 'hidden lg:block' : ''}`}>
                            <iframe
                                title="Aperçu du billet"
                                srcDoc={apercu}
                                sandbox=""
                                className="h-full w-full bg-[#F3F6F4]"
                            />
                        </div>
                    </div>

                    {/* Pied : garde-fou + actions */}
                    <div className="border-t border-white/10 px-5 py-3">
                        {sansQr && (
                            <p className="mb-2 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs font-semibold text-amber-300">
                                <AlertTriangle size={15} className="mt-px shrink-0" />
                                Le marqueur <span className="font-mono">{'{{QR_CODE}}'}</span> est absent : sans lui,
                                le billet ne pourrait pas être scanné à l’entrée. Ajoutez-le pour enregistrer.
                            </p>
                        )}

                        {message && (
                            <p className={`mb-2 flex items-center gap-2 rounded-xl p-2.5 text-xs font-semibold ${message.ok ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'
                                }`}>
                                {message.ok ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                                {message.texte}
                            </p>
                        )}

                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                onClick={enregistrer}
                                disabled={enregistrement || sansQr}
                                className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-black text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
                            >
                                {enregistrement ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                Enregistrer
                            </button>

                            <button
                                onClick={() => setHtml(defautHtml)}
                                className="flex items-center gap-2 rounded-xl bg-white/5 px-4 py-2.5 text-sm font-bold text-gray-300 hover:bg-white/10"
                            >
                                <Copy size={15} /> Partir du design fourni
                            </button>

                            {eventId && (
                                <button
                                    onClick={() => setHtml('')}
                                    title="Vider = revenir au modèle global"
                                    className="flex items-center gap-2 rounded-xl bg-white/5 px-4 py-2.5 text-sm font-bold text-gray-300 hover:bg-white/10"
                                >
                                    <Undo2 size={15} /> Utiliser le modèle global
                                </button>
                            )}

                            <p className="ml-auto text-[11px] text-gray-500">
                                {eventId
                                    ? (globalHtml ? 'Un modèle global existe : il s’applique si vous laissez vide.' : 'Aucun modèle global : le design fourni s’applique si vous laissez vide.')
                                    : 'S’applique à tous les événements sans design propre.'}
                            </p>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
