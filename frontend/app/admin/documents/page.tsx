'use client'

import { T } from '@/lib/translation';
import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { FolderOpen, CheckCircle as CheckCircle2, XCircle, Clock, FileText, User, Envelope as Mail, Calendar, Icon as LucideIcon, Trash as Trash2, FolderSimplePlus as FolderInput, Link as Link2, Copy, Check, CircleNotch as Loader2, Download, Eye, ArrowRight, X, Image as ImageIcon, ShieldCheck, Users } from '@phosphor-icons/react';

interface ClientDocument {
    id: string
    client_email: string
    client_nom: string
    file_name: string
    file_url: string
    file_type: string
    file_size: number
    status: string
    agent_note: string
    created_at: string
}

interface MyafroApp {
    id: string; application_ref: string; nom: string; prenom: string; email: string
    telephone: string; pays_residence: string; amount: number; currency: string
    payment_status: string; documents_uploaded: string[]; created_at: string
    myafro_date?: string; needs_recherche_ancestrale?: boolean; recherche_ancestrale_paid?: boolean
}

const getUrgencyLevel = (myafroDateStr: string | null | undefined): { label: string, color: string, border: string, bg: string } => {
    if (!myafroDateStr) return { label: 'Urgence indéterminée', color: 'text-gray-400', border: 'border-gray-500/20', bg: 'bg-gray-500/10' }

    const clean = myafroDateStr.toLowerCase().trim()
    let months = 1 // default

    const monthMatch = clean.match(/(\d+)\s*mois/)
    const yearMatch = clean.match(/(\d+)\s*an/)
    const weekMatch = clean.match(/(\d+)\s*semaine/)
    const dayMatch = clean.match(/(\d+)\s*jour/)

    if (yearMatch) {
        months = parseInt(yearMatch[1], 10) * 12
    } else if (monthMatch) {
        months = parseInt(monthMatch[1], 10)
    } else if (weekMatch) {
        months = parseInt(weekMatch[1], 10) / 4
    } else if (dayMatch) {
        months = parseInt(dayMatch[1], 10) / 30
    } else {
        const parts = clean.match(/(\d{2})[\/\-\.](\d{2})[\/\-\.](\d{4})/)
        let date: Date | null = null
        if (parts) {
            date = new Date(parseInt(parts[3], 10), parseInt(parts[2], 10) - 1, parseInt(parts[1], 10))
        } else {
            const parsedTs = Date.parse(clean)
            if (!isNaN(parsedTs)) date = new Date(parsedTs)
        }

        if (date) {
            const diffMs = Date.now() - date.getTime()
            const diffDays = diffMs / (1000 * 60 * 60 * 24)
            months = diffDays / 30
        }
    }

    if (months > 6) {
        return { label: `Urgence Haute (${myafroDateStr})`, color: 'text-red-400 font-black animate-pulse', border: 'border-red-500/30', bg: 'bg-red-500/10' }
    } else if (months >= 3) {
        return { label: `Urgence Moyenne (${myafroDateStr})`, color: 'text-amber-400 font-bold', border: 'border-amber-500/30', bg: 'bg-amber-500/10' }
    } else {
        return { label: `Urgence Faible (${myafroDateStr})`, color: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10' }
    }
}

const generateVirtualAssistantRecap = (apps: MyafroApp[]) => {
    const total = apps.length
    const unpaid = apps.filter(a => a.payment_status !== 'payé').length
    const paid = total - unpaid

    let high = 0
    let medium = 0
    let low = 0

    const suggestions: string[] = []

    apps.forEach(a => {
        const level = getUrgencyLevel(a.myafro_date)
        if (level.label.includes('Haute')) {
            high++
            suggestions.push(`Le dossier de **${a.prenom} ${a.nom}** (${a.myafro_date || 'date inconnue'}) est en attente depuis longtemps. Relancez-le pour la recherche ancestrale de 250 €.`)
        } else if (level.label.includes('Moyenne')) {
            medium++
        } else {
            low++
        }
    })

    if (unpaid > 0) {
        suggestions.push(`Paiement manquant : **${unpaid}** client(s) n'ont pas encore finalisé les frais de reprise de 50 €.`);
    }

    if (paid > 0) {
        suggestions.push(`Instruction : **${paid}** client(s) ont payé les 50 € de reprise et attendent la validation de leurs documents.`);
    }

    return {
        total,
        paid,
        unpaid,
        high,
        medium,
        low,
        suggestions
    }
}

const formatDate = (val: string | null | undefined) => {
    if (!val) return '-'
    const d = new Date(val)
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('fr-FR')
}

export default function AdminDocumentsPage() {
    // ── Documents clients (existant) ──
    const [documents, setDocuments] = useState<ClientDocument[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<'all' | 'en_attente' | 'valide' | 'rejete'>('all')

    // ── MyAfroOrigins ──
    const [myafroApps, setMyafroApps] = useState<MyafroApp[]>([])
    const [myafroLoading, setMyafroLoading] = useState(true)
    const [inviteEmail, setInviteEmail] = useState('')
    const [inviteName, setInviteName] = useState('')
    const [inviteState, setInviteState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
    const [genLink, setGenLink] = useState('')
    const [copied, setCopied] = useState(false)
    const [previewApp, setPreviewApp] = useState<MyafroApp | null>(null)
    const [previewDocs, setPreviewDocs] = useState<Array<{ label: string; url: string | null; type: string }>>([])
    const [previewLoading, setPreviewLoading] = useState(false)
    const [approvingId, setApprovingId] = useState<string | null>(null)
    
    // Nouveaux états pour le paiement manuel et la relance
    const [invoices, setInvoices] = useState<any[]>([])
    const [linkPaid, setLinkPaid] = useState(false)
    const [selectedInvoiceId, setSelectedInvoiceId] = useState('')
    const [sendingRelanceId, setSendingRelanceId] = useState<string | null>(null)

    // Récap génératif de l'assistant IA (Groq)
    const [aiRecap, setAiRecap] = useState('')
    const [aiRecapLoading, setAiRecapLoading] = useState(false)

    const generateAiRecap = async () => {
        setAiRecapLoading(true)
        try {
            const res = await fetch('/api/admin/documents/recap', { method: 'POST' })
            const data = await res.json()
            if (data.recap) setAiRecap(data.recap)
            else setAiRecap('Récap indisponible pour le moment. Réessayez.')
        } catch {
            setAiRecap('Récap indisponible pour le moment. Réessayez.')
        }
        setAiRecapLoading(false)
    }

    // Effacer le lien généré si les paramètres de paiement changent
    useEffect(() => {
        setGenLink('')
    }, [linkPaid, selectedInvoiceId])

    const fetchInvoices = async () => {
        try {
            // NB : les colonnes réelles sont client_nom / client_prenom
            // (un ancien `client_name` inexistant faisait échouer la requête
            // → liste toujours vide dans le sélecteur)
            const { data, error } = await supabase
                .from('documents_financiers')
                .select('id, numero, client_nom, client_prenom, total, currency, type, created_at')
                .eq('type', 'facture')
                .order('created_at', { ascending: false })
                .limit(200)
            if (error) throw error
            setInvoices(data || [])
        } catch (e) {
            console.error('Failed to fetch invoices:', e)
        }
    }

    // Charger les factures dès l'arrivée sur l'onglet (données en temps réel,
    // pas seulement au clic sur la case)
    useEffect(() => { fetchInvoices() }, [])

    const fetchDocs = useCallback(async () => {
        let query = supabase.from('client_documents').select('*').order('created_at', { ascending: false })
        if (filter !== 'all') query = query.eq('status', filter)
        const { data } = await query
        setDocuments((data || []) as ClientDocument[])
        setLoading(false)
    }, [filter])
    useEffect(() => { fetchDocs() }, [fetchDocs])

    const fetchMyafro = useCallback(async () => {
        setMyafroLoading(true)
        try {
            const res = await fetch('/api/admin/documents')
            const data = await res.json()
            setMyafroApps(data.applications || [])
        } catch { setMyafroApps([]) } finally { setMyafroLoading(false) }
    }, [])
    useEffect(() => { fetchMyafro() }, [fetchMyafro])

    const updateStatus = async (id: string, status: string, note?: string) => {
        await supabase.from('client_documents').update({ status, agent_note: note || '' }).eq('id', id)
        fetchDocs()
    }

    const handleDeleteDoc = async (doc: ClientDocument) => {
        if (!confirm('Supprimer définitivement ce document et son fichier physique ?')) return
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let storagePath = (doc as any).storage_path
            if (!storagePath && doc.file_url) {
                const bucketToken = 'client-documents/'
                if (doc.file_url.includes(bucketToken)) storagePath = decodeURIComponent(doc.file_url.split(bucketToken)[1].split('?')[0])
                else if (doc.file_url.startsWith('/uploads/')) storagePath = doc.file_url.replace('/uploads/', '')
                else storagePath = doc.file_name
            }
            if (storagePath) await supabase.storage.from('client-documents').remove([storagePath])
        } catch (e) { console.error('Storage deletion failed:', e) }
        const { error } = await supabase.from('client_documents').delete().eq('id', doc.id)
        if (error) alert('Erreur lors de la suppression : ' + error.message)
        else setDocuments(prev => prev.filter(d => d.id !== doc.id))
    }

    // ── MyAfroOrigins actions ──
    // ── MyAfroOrigins actions ──
    const sendInvite = async () => {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail)) { alert('Email invalide.'); return }
        setInviteState('sending')
        try {
            const res = await fetch('/api/admin/documents', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ 
                    action: 'invite', 
                    email: inviteEmail.trim(), 
                    name: inviteName.trim(),
                    paid: linkPaid,
                    invoice_id: linkPaid && selectedInvoiceId ? selectedInvoiceId : undefined
                }) 
            })
            const data = await res.json()
            if (res.ok && data.success) { 
                setInviteState('sent')
                setInviteEmail('')
                setInviteName('')
                setLinkPaid(false)
                setSelectedInvoiceId('')
                setTimeout(() => setInviteState('idle'), 4000) 
            } else { 
                setInviteState('error')
                alert(data.error || 'Envoi impossible.') 
            }
        } catch { setInviteState('error') }
    }
    const generateLink = async () => {
        try {
            const res = await fetch('/api/admin/documents', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ 
                    action: 'link',
                    paid: linkPaid,
                    invoice_id: linkPaid && selectedInvoiceId ? selectedInvoiceId : undefined
                }) 
            })
            const data = await res.json()
            if (data.link) setGenLink(data.link)
        } catch { /* ignore */ }
    }
    const copyLink = () => { navigator.clipboard.writeText(genLink); setCopied(true); setTimeout(() => setCopied(false), 2000) }
    
    // Action de relance Recherche Ancestrale (250 €)
    const sendAncestralRelance = async (a: MyafroApp) => {
        if (!confirm(`Envoyer la relance Recherche Ancestrale (250 €) à ${a.prenom} ${a.nom} ?`)) return
        setSendingRelanceId(a.id)
        try {
            const res = await fetch('/api/admin/documents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'relance_ancestrale', id: a.id })
            })
            const data = await res.json()
            if (res.ok && data.success) {
                alert('Email de relance pour la Recherche Ancestrale envoyé avec succès !')
                // Mettre à jour l'état local pour refléter le changement
                setMyafroApps(prev => prev.map(x => x.id === a.id ? { ...x, needs_recherche_ancestrale: true } : x))
            } else {
                alert(data.error || 'Erreur lors de l\'envoi de la relance.')
            }
        } catch (err) {
            console.error(err)
            alert('Erreur réseau ou serveur.')
        } finally {
            setSendingRelanceId(null)
        }
    }

    const openPreview = async (a: MyafroApp) => {
        setPreviewApp(a); setPreviewDocs([]); setPreviewLoading(true)
        try {
            const res = await fetch('/api/admin/nationalite/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: a.id }) })
            const data = await res.json()
            setPreviewDocs(data.documents || [])
        } catch { setPreviewDocs([]) } finally { setPreviewLoading(false) }
    }
    const approve = async (a: MyafroApp) => {
        if (!confirm(`Approuver le dossier de ${a.prenom} ${a.nom} et l'envoyer vers l'onglet Nationalité ?`)) return
        setApprovingId(a.id)
        try {
            const res = await fetch('/api/admin/documents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'approve', id: a.id }) })
            if (res.ok) setMyafroApps(prev => prev.filter(x => x.id !== a.id))
            else { const j = await res.json().catch(() => ({})); alert(j.error || 'Approbation impossible.') }
        } finally { setApprovingId(null) }
    }
    /* Mêmes trois défauts que sur /admin/nationalite, corrigés à l'identique :
       révocation de l'URL avant que le navigateur ait lu le blob, ancre jamais
       insérée dans le document, et erreur avalée en silence. */
    const downloadZip = async (id: string, ref: string) => {
        try {
            const res = await fetch(`/api/nationality/download?id=${id}`, { credentials: 'same-origin' })
            if (!res.ok) {
                let detail = `HTTP ${res.status}`
                try {
                    const j = await res.json()
                    if (j?.error) detail = j.detail ? `${j.error} : ${j.detail}` : j.error
                } catch { /* réponse non JSON : le code HTTP suffit */ }
                alert(`Téléchargement impossible : ${detail}`)
                return
            }
            const blob = await res.blob()
            if (blob.size === 0) { alert('Le dossier généré est vide. Signalez-le à la technique.'); return }

            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `Dossier_${ref}.zip`
            a.style.display = 'none'
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            setTimeout(() => URL.revokeObjectURL(url), 60_000)
        } catch (e) {
            alert(`Téléchargement impossible : ${e instanceof Error ? e.message : 'erreur réseau'}`)
        }
    }

    const statusConfig: Record<string, { label: string, color: string, Icon: LucideIcon }> = {
        en_attente: { label: 'En attente', color: 'bg-amber-500/20 text-amber-400', Icon: Clock },
        valide: { label: 'Validé', color: 'bg-emerald-500/20 text-emerald-400', Icon: CheckCircle2 },
        rejete: { label: 'Rejeté', color: 'bg-red-500/20 text-red-400', Icon: XCircle },
    }

    return (
        <div className="min-h-screen bg-[#0a0f14] py-8 px-4">
            <div className="max-w-5xl mx-auto space-y-10">

                {/* ═══════════════ MYAFROORIGINS ═══════════════ */}
                <section>
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
                            <FolderInput className="text-emerald-400" size={22} />
                        </div>
                        <div>
                            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.3em]">Reprise de dossier</span>
                            <h1 className="text-2xl font-black text-white tracking-tight">Dossiers MyAfroOrigins</h1>
                        </div>
                    </div>

                    {/* Option de paiement manuel lié à une facture */}
                    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 mb-6">
                        <p className="text-sm font-black text-white flex items-center gap-2 mb-2">
                            <ShieldCheck size={18} className="text-emerald-400" />
                            Paiement manuel préalable des 50 € de reprise
                        </p>
                        <p className="text-[11px] text-gray-500 mb-4">
                            Si le client a déjà réglé ces frais de façon manuelle, cochez cette case et sélectionnez la facture associée. L&apos;étape de paiement en ligne sera contournée pour ce client.
                        </p>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-300">
                                <input
                                    type="checkbox"
                                    checked={linkPaid}
                                    onChange={(e) => {
                                        setLinkPaid(e.target.checked)
                                        if (e.target.checked && invoices.length === 0) {
                                            fetchInvoices()
                                        }
                                    }}
                                    className="rounded border-white/10 bg-[#0d1424] text-emerald-500 focus:ring-emerald-500/50"
                                />
                                Le client a déjà payé manuellement
                            </label>

                            {linkPaid && (
                                <select
                                    value={selectedInvoiceId}
                                    onChange={(e) => setSelectedInvoiceId(e.target.value)}
                                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500/50"
                                >
                                    <option value="" className="bg-[#0d1424] text-gray-400">-- Choisir une facture --</option>
                                    {invoices.map(inv => (
                                        <option key={inv.id} value={inv.id} className="bg-[#0d1424] text-white">
                                            {inv.numero} : {`${inv.client_nom || ''} ${inv.client_prenom || ''}`.trim() || 'Sans nom'} ({Number(inv.total || 0).toLocaleString('fr-FR')} {inv.currency === 'EUR' ? '€' : inv.currency === 'USD' ? '$' : 'FCFA'})
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>
                    </div>

                    {/* Invitation + lien */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
                            <p className="text-sm font-black text-white flex items-center gap-2 mb-1"><Mail size={16} className="text-emerald-400" /> Inviter un client par email</p>
                            <p className="text-[11px] text-gray-500 mb-4">Le client reçoit un lien personnel vers notre formulaire (tarif de reprise 50 €).</p>
                            <div className="space-y-3">
                                <input value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Nom du client (optionnel)" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50" />
                                <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="Email du client" type="email" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50" />
                                <button onClick={sendInvite} disabled={inviteState === 'sending'} className={`w-full py-2.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all ${inviteState === 'sent' ? 'bg-emerald-600 text-white' : 'bg-emerald-500 hover:bg-emerald-600 text-white'} disabled:opacity-60`}>
                                    {inviteState === 'sending' ? <><Loader2 size={15} className="animate-spin" /> Envoi…</> : inviteState === 'sent' ? <><Check size={15} /> Invitation envoyée</> : <><Mail size={15} /> Envoyer l&apos;invitation</>}
                                </button>
                            </div>
                        </div>
                        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
                            <p className="text-sm font-black text-white flex items-center gap-2 mb-1"><Link2 size={16} className="text-sky-400" /> Ou copier un lien à partager</p>
                            <p className="text-[11px] text-gray-500 mb-4">À transmettre par WhatsApp ou tout autre canal. Valable 60 jours.</p>
                            {genLink ? (
                                <div className="flex items-center gap-2">
                                    <input readOnly value={genLink} title="Lien MyAfroOrigins" className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-gray-300 text-[11px] font-mono truncate focus:outline-none" />
                                    <button onClick={copyLink} title="Copier" className="p-2.5 rounded-xl bg-sky-500/20 text-sky-400 hover:bg-sky-500/30">{copied ? <Check size={16} /> : <Copy size={16} />}</button>
                                </div>
                            ) : (
                                <button onClick={generateLink} className="w-full py-2.5 rounded-xl bg-sky-500/15 border border-sky-500/25 text-sky-400 hover:bg-sky-500/25 font-black text-sm flex items-center justify-center gap-2"><Link2 size={15} /> Générer un lien</button>
                            )}
                        </div>
                    </div>

                    {/* Assistant Virtuel de Suivi */}
                    {!myafroLoading && myafroApps.length > 0 && (
                        <div className="bg-gradient-to-r from-emerald-950/30 to-emerald-900/20 border border-emerald-500/20 rounded-2xl p-6 mb-6 shadow-xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 -mt-6 -mr-6 w-32 h-32 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />
                            
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                                    <ShieldCheck className="text-emerald-400" size={24} />
                                </div>
                                <div className="flex-1 min-w-0 space-y-3">
                                    <div>
                                        <h3 className="text-sm font-black text-emerald-400 uppercase tracking-widest">Assistant Virtuel · Suivi & Relances</h3>
                                        <p className="text-xs text-gray-400 mt-1">Résumé intelligent automatique de l&apos;état des dossiers de reprise MyAfroOrigins en attente.</p>
                                    </div>
                                    
                                    {(() => {
                                        const recap = generateVirtualAssistantRecap(myafroApps)
                                        return (
                                            <div className="space-y-4">
                                                {/* Urgency indicators */}
                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                    <div className="bg-white/5 border border-white/5 rounded-xl px-3 py-2">
                                                        <span className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold">Total dossiers</span>
                                                        <span className="text-lg font-black text-white">{recap.total}</span>
                                                    </div>
                                                    <div className="bg-red-500/5 border border-red-500/10 rounded-xl px-3 py-2">
                                                        <span className="block text-[10px] text-red-400 uppercase tracking-wider font-bold">Urgence Haute</span>
                                                        <span className="text-lg font-black text-red-400">{recap.high}</span>
                                                    </div>
                                                    <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl px-3 py-2">
                                                        <span className="block text-[10px] text-amber-400 uppercase tracking-wider font-bold">Urgence Moyenne</span>
                                                        <span className="text-lg font-black text-amber-400">{recap.medium}</span>
                                                    </div>
                                                    <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl px-3 py-2">
                                                        <span className="block text-[10px] text-emerald-400 uppercase tracking-wider font-bold">Payé (Reprise)</span>
                                                        <span className="text-lg font-black text-emerald-400">{recap.paid} / {recap.total}</span>
                                                    </div>
                                                </div>

                                                {/* Suggestions list */}
                                                <div className="space-y-2">
                                                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Recommandations d&apos;actions</p>
                                                    <ul className="text-xs text-gray-300 space-y-1.5 list-disc list-inside">
                                                        {recap.suggestions.map((s, idx) => (
                                                            <li key={idx} dangerouslySetInnerHTML={{ __html: s.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                                                        ))}
                                                    </ul>
                                                </div>

                                                {/* Récap génératif IA (Groq) */}
                                                <div className="pt-3 border-t border-emerald-500/10">
                                                    <div className="flex items-center justify-between gap-3 mb-2">
                                                        <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Récap détaillé de l&apos;assistant IA</p>
                                                        <button
                                                            onClick={generateAiRecap}
                                                            disabled={aiRecapLoading}
                                                            className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 transition-all flex items-center gap-1.5 disabled:opacity-50"
                                                        >
                                                            {aiRecapLoading ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
                                                            {aiRecapLoading ? 'Analyse en cours…' : (aiRecap ? 'Actualiser le récap IA' : 'Générer le récap IA')}
                                                        </button>
                                                    </div>
                                                    {aiRecap && (
                                                        <div className="bg-[#0d1424]/80 border border-emerald-500/15 rounded-xl p-4">
                                                            <pre className="text-xs text-gray-200 whitespace-pre-wrap font-sans leading-relaxed m-0">{aiRecap}</pre>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })()}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Liste dossiers reçus */}
                    <div className="bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden">
                        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                            <p className="text-sm font-black text-white flex items-center gap-2"><Users size={16} className="text-emerald-400" /> Dossiers reçus en attente de revue <span className="text-gray-500 font-medium">({myafroApps.length})</span></p>
                            <button onClick={fetchMyafro} className="text-[11px] text-gray-500 hover:text-white font-bold">Actualiser</button>
                        </div>
                        {myafroLoading ? (
                            <div className="flex flex-col items-center py-14 text-gray-500"><Loader2 size={24} className="animate-spin mb-3" />Chargement…</div>
                        ) : myafroApps.length === 0 ? (
                            <div className="text-center py-14 px-6">
                                <ShieldCheck size={32} className="text-gray-600 mx-auto mb-3" />
                                <p className="text-sm text-gray-400 font-bold">Aucun dossier en attente.</p>
                                <p className="text-[11px] text-gray-600 mt-1">Les dossiers déposés par les clients invités apparaîtront ici.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-white/5">
                                {myafroApps.map(a => {
                                    const urgency = getUrgencyLevel(a.myafro_date)
                                    return (
                                        <div key={a.id} className="p-5 flex flex-col md:flex-row md:items-center gap-4">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-black text-white flex items-center gap-2 flex-wrap">
                                                    {a.prenom} {a.nom} 
                                                    <span className="text-[10px] font-mono text-gray-500">{a.application_ref}</span>
                                                    {a.myafro_date && (
                                                        <span className={`px-2 py-0.5 rounded-full text-[9px] border ${urgency.border} ${urgency.bg} ${urgency.color}`}>
                                                            {urgency.label}
                                                        </span>
                                                    )}
                                                </p>
                                                <p className="text-[11px] text-gray-500 mt-0.5">{a.email}{a.telephone ? ` · ${a.telephone}` : ''}{a.pays_residence ? ` · ${a.pays_residence}` : ''}</p>
                                                <div className="flex items-center gap-2 mt-2 text-[10px]">
                                                    <span className={`px-2 py-0.5 rounded-full font-black ${a.payment_status === 'payé' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                                        {a.payment_status === 'payé' ? `Payé ${a.amount} ${a.currency}` : 'Paiement en attente'}
                                                    </span>
                                                    <span className="px-2 py-0.5 rounded-full bg-white/5 text-gray-400 font-bold">{(a.documents_uploaded || []).length} pièce(s)</span>
                                                    {a.recherche_ancestrale_paid ? (
                                                        <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 font-black">Recherche Ancestrale Payée</span>
                                                    ) : a.needs_recherche_ancestrale ? (
                                                        <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 font-bold">Relancé (Recherche)</span>
                                                    ) : null}
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {!a.recherche_ancestrale_paid && (
                                                    <button onClick={() => sendAncestralRelance(a)} disabled={sendingRelanceId === a.id} className="bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 font-bold text-[11px] px-3 py-2 rounded-lg flex items-center gap-1 disabled:opacity-60">
                                                        {sendingRelanceId === a.id ? <Loader2 size={13} className="animate-spin" /> : null}
                                                        Relancer Recherche (250 €)
                                                    </button>
                                                )}
                                                {(a.documents_uploaded || []).length > 0 && (
                                                    <button onClick={() => openPreview(a)} className="bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 font-bold text-[11px] px-3 py-2 rounded-lg flex items-center gap-1"><Eye size={13} /> Prévisualiser</button>
                                                )}
                                                <button onClick={() => downloadZip(a.id, a.application_ref)} className="bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 font-bold text-[11px] px-3 py-2 rounded-lg flex items-center gap-1"><Download size={13} /> ZIP</button>
                                                <button onClick={() => approve(a)} disabled={approvingId === a.id} className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 font-bold text-[11px] px-3 py-2 rounded-lg flex items-center gap-1 disabled:opacity-60">
                                                    {approvingId === a.id ? <Loader2 size={13} className="animate-spin" /> : <ArrowRight size={13} />} Approuver → Nationalité
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </section>

                {/* ═══════════════ DOCUMENTS CLIENTS (existant) ═══════════════ */}
                <section>
                    <div className="mb-6">
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.3em]"><T>Gestion</T></span>
                        <h2 className="text-2xl font-black text-white flex items-center gap-2">
                            <FolderOpen size={22} className="text-emerald-400" /> Documents Clients
                        </h2>
                    </div>

                    <div className="flex gap-2 mb-6">
                        {(['all', 'en_attente', 'valide', 'rejete'] as const).map(f => (
                            <button key={f} onClick={() => setFilter(f)} className={`text-xs font-bold px-4 py-2 rounded-xl transition-all ${filter === f ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-white/5 text-gray-500 border border-white/5 hover:text-white'}`}>
                                {f === 'all' ? 'Tous' : statusConfig[f]?.label || f}
                            </button>
                        ))}
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" /></div>
                    ) : documents.length === 0 ? (
                        <div className="text-center py-16 text-gray-500"><FolderOpen className="mx-auto mb-3 text-gray-700" size={40} /><p className="text-sm"><T>Aucun document</T></p></div>
                    ) : (
                        <div className="space-y-3">
                            {documents.map((doc, i) => {
                                const cfg = statusConfig[doc.status] || statusConfig.en_attente
                                return (
                                    <motion.div key={doc.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} className="bg-white/[0.03] border border-white/5 rounded-xl p-5 hover:border-white/10 transition-all">
                                        <div className="flex items-center justify-between flex-wrap gap-3">
                                            <div className="flex items-center gap-4 min-w-0">
                                                <FileText size={20} className="text-blue-400 shrink-0" />
                                                <div className="min-w-0">
                                                    {doc.file_url ? (
                                                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-white hover:text-emerald-400 transition-colors hover:underline truncate block">{doc.file_name}</a>
                                                    ) : (<p className="text-sm font-bold text-white truncate">{doc.file_name}</p>)}
                                                    <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-500 flex-wrap">
                                                        <span className="flex items-center gap-1"><User size={10} /> {doc.client_nom || 'N/A'}</span>
                                                        <span className="flex items-center gap-1"><Mail size={10} /> {doc.client_email}</span>
                                                        <span className="flex items-center gap-1"><Calendar size={10} /> {formatDate(doc.created_at)}</span>
                                                        {doc.file_size > 0 && <span>{(doc.file_size / 1024).toFixed(0)} KB</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1 ${cfg.color}`}><cfg.Icon size={10} /> {cfg.label}</span>
                                                {doc.status === 'en_attente' && (
                                                    <>
                                                        <button onClick={() => updateStatus(doc.id, 'valide')} className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 font-bold text-xs px-3 py-1.5 rounded-lg transition-all flex items-center gap-1"><Check size={12} /> Valider</button>
                                                        <button onClick={() => { const note = window.prompt('Raison du rejet :'); if (note !== null) updateStatus(doc.id, 'rejete', note) }} className="bg-red-500/20 text-red-400 hover:bg-red-500/30 font-bold text-xs px-3 py-1.5 rounded-lg transition-all flex items-center gap-1"><X size={12} /> Rejeter</button>
                                                    </>
                                                )}
                                                <button onClick={() => handleDeleteDoc(doc)} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 p-2 rounded-xl transition-all" title="Supprimer"><Trash2 size={14} /></button>
                                            </div>
                                        </div>
                                        {doc.agent_note && (<p className="text-xs text-gray-500 italic mt-2 pl-9">Note : {doc.agent_note}</p>)}
                                    </motion.div>
                                )
                            })}
                        </div>
                    )}
                </section>
            </div>

            {/* Modal preview MyAfroOrigins */}
            {previewApp && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm" onClick={() => setPreviewApp(null)}>
                    <div className="w-full max-w-4xl max-h-[88vh] overflow-hidden flex flex-col bg-[#0d1424] border border-white/10 rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                            <div>
                                <h3 className="text-lg font-black text-white">Pièces : {previewApp.prenom} {previewApp.nom}</h3>
                                <p className="text-[11px] text-gray-500">{previewApp.application_ref}</p>
                            </div>
                            <button onClick={() => setPreviewApp(null)} title="Fermer" className="p-2 rounded-full hover:bg-white/5 text-gray-400"><X size={18} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6">
                            {previewLoading ? (
                                <div className="flex flex-col items-center py-16 text-gray-500"><Loader2 size={28} className="animate-spin mb-3" />Chargement des documents…</div>
                            ) : previewDocs.length === 0 ? (
                                <div className="text-center py-16 text-gray-500 text-sm">Aucun document exploitable.</div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {previewDocs.map((d, i) => (
                                        <div key={i} className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden flex flex-col">
                                            <div className="h-40 bg-black/40 flex items-center justify-center overflow-hidden">
                                                {d.url && d.type === 'image' ? <img src={d.url} alt={d.label} className="w-full h-full object-cover" /> : <div className="flex flex-col items-center text-gray-500">{d.type === 'pdf' ? <FileText size={34} /> : <ImageIcon size={34} />}<span className="text-[10px] mt-2 uppercase">{d.type}</span></div>}
                                            </div>
                                            <div className="p-3 flex-1 flex flex-col gap-2">
                                                <p className="text-xs font-bold text-white leading-snug line-clamp-2">{d.label}</p>
                                                {d.url ? <a href={d.url} target="_blank" rel="noopener noreferrer" className="mt-auto inline-flex items-center gap-1 text-[11px] font-bold text-cyan-400 hover:text-cyan-300"><Eye size={12} /> Ouvrir en plein écran</a> : <span className="mt-auto text-[10px] text-red-400">Fichier indisponible</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
