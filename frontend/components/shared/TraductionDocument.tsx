'use client'
// ══════════════════════════════════════════════════════════════
//  Traduire un devis / une facture avant de l'envoyer (panels agent / admin).
//
//  1. « Traduire » : chaque texte saisi (lignes, notes, conditions…) est
//     présenté avec sa traduction proposée — base validée, dictionnaire,
//     sinon IA contrôlée (nombres, e-mails, codes et marques intacts).
//  2. L'équipe relit et corrige ; « Valider » enregistre les corrections,
//     qui priment ensuite partout. Une correction qui touche un nombre ou
//     un code est refusée.
//  3. Télécharger ou envoyer au client dans cette langue (PDF joint, email
//     rédigé dans la langue, sans IA).
//  Les montants, quantités et dates ne passent jamais par la traduction.
// ══════════════════════════════════════════════════════════════
import { useCallback, useEffect, useRef, useState } from 'react'
import { Translate, CircleNotch, Download, PaperPlaneTilt, CheckCircle, WarningCircle } from '@phosphor-icons/react'
import { supabase } from '@/lib/supabase'
import { LANGUES_DOC, langueDoc, libellesDoc, messageEnvoi, type LangueDoc } from '@/lib/document-langues'
import { montant } from '@/lib/document-pdf'
import { segmentsDocument } from '@/lib/document-traduction'
import { donneesDepuisDocument, traductionsDocument, telechargerDocumentPdf, documentPdfBase64, type DocumentSource } from '@/lib/document-pdf-navigateur'

type Doc = DocumentSource & { id: string; total?: number | null }

export default function TraductionDocument({ doc, onEnvoye, langueInitiale }: { doc: Doc; onEnvoye?: () => void; langueInitiale?: LangueDoc }) {
    const [langue, setLangue] = useState<LangueDoc>(langueInitiale && langueInitiale !== 'fr' ? langueInitiale : 'en')
    const [segments, setSegments] = useState<string[] | null>(null)
    const [proposees, setProposees] = useState<Record<string, string>>({})
    const [saisies, setSaisies] = useState<Record<string, string>>({})
    const [etat, setEtat] = useState<'' | 'traduction' | 'validation' | 'pdf' | 'envoi'>('')
    const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null)

    const entetes = async (): Promise<Record<string, string>> => {
        const { data: { session } } = await supabase.auth.getSession()
        return { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) }
    }

    const traduire = useCallback(async (l: LangueDoc) => {
        setEtat('traduction'); setMessage(null)
        try {
            const [donnees, tr] = await Promise.all([donneesDepuisDocument(doc, supabase), traductionsDocument(doc.id, l)])
            const segs = segmentsDocument(donnees)
            setSegments(segs); setProposees(tr)
            setSaisies(Object.fromEntries(segs.map(s => [s, tr[s] || ''])))
            const manquants = segs.filter(s => !tr[s]).length
            setMessage(manquants
                ? { ok: false, texte: `${manquants} texte(s) sans traduction fiable : ils resteront en français si vous ne les complétez pas.` }
                : { ok: true, texte: 'Tous les textes sont traduits. Relisez puis validez.' })
        } catch (e) {
            setMessage({ ok: false, texte: `Traduction impossible : ${e instanceof Error ? e.message : 'erreur inconnue'}` })
        }
        setEtat('')
    }, [doc])

    /** Enregistre ce qui a été corrigé ou complété. Renvoie false si une correction est refusée. */
    const valider = async (): Promise<boolean> => {
        const corrections = Object.fromEntries(Object.entries(saisies).filter(([s, t]) => t.trim() && t.trim() !== (proposees[s] || '').trim()))
        if (!Object.keys(corrections).length) return true
        setEtat('validation')
        try {
            const r = await fetch('/api/agent/documents-traduction', { method: 'PUT', headers: await entetes(), body: JSON.stringify({ lang: langue, corrections }) })
            const j = await r.json()
            if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
            const refusees: string[] = j.refusees || []
            setProposees(p => ({ ...p, ...Object.fromEntries(Object.entries(corrections).filter(([s]) => !refusees.includes(s))) }))
            setMessage(refusees.length
                ? { ok: false, texte: `${refusees.length} correction(s) refusée(s) : un nombre, un e-mail, une référence ou un nom de marque y a été modifié. Recopiez-les à l'identique.` }
                : { ok: true, texte: `${j.ok} correction(s) enregistrée(s).` })
            return !refusees.length
        } catch (e) {
            setMessage({ ok: false, texte: `Enregistrement impossible : ${e instanceof Error ? e.message : 'erreur inconnue'}` })
            return false
        } finally { setEtat('') }
    }

    const telecharger = async () => {
        if (!(await valider())) return
        setEtat('pdf')
        try { await telechargerDocumentPdf(doc, supabase, langue) }
        catch (e) { setMessage({ ok: false, texte: `PDF impossible : ${e instanceof Error ? e.message : 'erreur inconnue'}` }) }
        setEtat('')
    }

    const envoyer = async () => {
        if (!doc.client_email) { setMessage({ ok: false, texte: 'Email client manquant.' }); return }
        if (!(await valider())) return
        setEtat('envoi')
        try {
            const { nom, base64 } = await documentPdfBase64(doc, supabase, langue)
            const type = doc.type === 'devis' ? 'devis' : doc.type === 'avoir' ? 'avoir' : 'facture'
            const client = [doc.client_prenom, doc.client_nom].filter(Boolean).join(' ')
            const { sujet, corps } = messageEnvoi(langue, { type, numero: doc.numero, client, total: montant(Number(doc.total) || 0, doc.currency || 'XOF', libellesDoc(langue).locale) })
            const r = await fetch('/api/email/send', {
                method: 'POST', headers: await entetes(),
                body: JSON.stringify({ to: doc.client_email, subject: sujet, message: corps, clientName: client, context: 'document_financier', relatedId: doc.id, language: langue, attachments: [{ filename: nom, content: base64, contentType: 'application/pdf' }] }),
            })
            if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`)
            setMessage({ ok: true, texte: `Envoyé à ${doc.client_email} en ${LANGUES_DOC.find(l => l.code === langue)?.libelle}, PDF joint.` })
            onEnvoye?.()
        } catch (e) {
            setMessage({ ok: false, texte: `Envoi impossible : ${e instanceof Error ? e.message : 'erreur inconnue'}` })
        }
        setEtat('')
    }

    // Ouvert depuis l'émission avec la langue du client : la traduction est prête à relire, sans clic.
    const lance = useRef(false)
    useEffect(() => {
        if (lance.current || !langueInitiale || langueInitiale === 'fr') return
        lance.current = true
        void traduire(langueInitiale)
    }, [langueInitiale, traduire])

    const occupe = etat !== ''
    return (
        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
                <Translate size={16} className="text-emerald-400" />
                <p className="text-sm font-bold text-white mr-auto">Traduire ce document</p>
                <select value={langue} disabled={occupe}
                    onChange={e => { const l = langueDoc(e.target.value); setLangue(l); setSegments(null); setMessage(null); if (l !== 'fr') void traduire(l) }}
                    className="bg-[#0c1420] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white">
                    {LANGUES_DOC.filter(l => l.code !== 'fr').map(l => <option key={l.code} value={l.code}>{l.drapeau} {l.libelle}</option>)}
                </select>
                <button onClick={() => traduire(langue)} disabled={occupe}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50">
                    {etat === 'traduction' ? <CircleNotch size={13} className="animate-spin" /> : <Translate size={13} />}
                    {segments ? 'Retraduire' : 'Traduire'}
                </button>
            </div>

            {segments && (
                <>
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                        {segments.map(s => (
                            <div key={s} className="grid md:grid-cols-2 gap-2 items-start">
                                <p className="text-xs text-gray-400 whitespace-pre-wrap pt-1.5">{s}</p>
                                <textarea value={saisies[s] || ''} rows={Math.min(4, Math.max(1, Math.ceil(s.length / 48)))}
                                    onChange={e => setSaisies(v => ({ ...v, [s]: e.target.value }))}
                                    placeholder="Pas de traduction fiable : saisissez-la, sinon le texte reste en français"
                                    className={`w-full bg-[#0c1420] border rounded-lg px-2 py-1.5 text-xs text-white resize-y ${saisies[s]?.trim() ? 'border-white/10' : 'border-amber-500/40'}`} />
                            </div>
                        ))}
                    </div>
                    <p className="text-[11px] text-gray-500">Montants, quantités, dates, numéros et coordonnées ne sont jamais traduits. Les libellés du document (titre, colonnes, totaux, mentions) sont fixes dans chaque langue, et la version traduite indique que l’original français fait foi.</p>
                    <div className="flex items-center gap-2 flex-wrap">
                        <button onClick={() => valider()} disabled={occupe}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white/5 border border-white/10 text-white hover:bg-white/10 disabled:opacity-50">
                            {etat === 'validation' ? <CircleNotch size={13} className="animate-spin" /> : <CheckCircle size={13} />} Valider les corrections
                        </button>
                        <button onClick={telecharger} disabled={occupe}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white/5 border border-white/10 text-white hover:bg-white/10 disabled:opacity-50">
                            {etat === 'pdf' ? <CircleNotch size={13} className="animate-spin" /> : <Download size={13} />} Télécharger le PDF
                        </button>
                        <button onClick={envoyer} disabled={occupe || !doc.client_email}
                            title={doc.client_email ? `Envoyer à ${doc.client_email}` : 'Email client manquant'}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-black disabled:opacity-40">
                            {etat === 'envoi' ? <CircleNotch size={13} className="animate-spin" /> : <PaperPlaneTilt size={13} />} Envoyer au client
                        </button>
                    </div>
                </>
            )}

            {message && (
                <p className={`text-xs flex items-start gap-1.5 ${message.ok ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {message.ok ? <CheckCircle size={14} className="shrink-0 mt-px" /> : <WarningCircle size={14} className="shrink-0 mt-px" />}{message.texte}
                </p>
            )}
        </div>
    )
}
