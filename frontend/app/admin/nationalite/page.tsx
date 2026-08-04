'use client'

import { useTranslation, T } from '@/lib/translation';
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import {
    Globe2, CheckCircle2, Clock, Download,
    Mail, Search, ChevronDown, ChevronUp, MapPin,
    CreditCard, ExternalLink, Check, Loader2,
    Eye, Pencil, Trash2, X, FileText, Image as ImageIcon, RotateCcw, Copy,
    FilePlus, Send, Plus, UploadCloud, ClipboardList, Wand2, PenLine, ArrowLeft, Landmark, Replace
} from 'lucide-react'
import Link from 'next/link'

interface Application {
    id: string; application_ref: string; status: string
    nom: string; prenom: string; email: string; telephone: string
    genre: string; date_naissance: string; pays_naissance: string; ville_naissance: string
    pays_residence: string; nationalite: string; adresse_residence: string; profession: string
    demande_depuis_benin: boolean
    type_document_identite: string; numero_document: string; date_expiration_document: string
    pays_delivrance: string; lieu_delivrance: string; autorite_delivrance: string
    pere_nom: string; pere_prenom: string; pere_date_naissance: string
    mere_nom: string; mere_prenom: string; mere_date_naissance: string
    afro_descendant_description: string
    ancestor1_nom: string; ancestor1_prenom: string; ancestor1_lien_parente: string
    ancestor1_nationalite: string; ancestor1_pays_residence: string; ancestor1_vivant: boolean
    ancestor2_nom: string; ancestor2_prenom: string; ancestor2_lien_parente: string; ancestor2_nationalite: string
    documents_uploaded: string[]
    created_at: string; submitted_at: string; assigned_agent: string; agent_notes: string
    amount: number; currency: string; payment_status: string; payment_method: string; payment_ref: string
    recherche_ancestrale_payee?: boolean
    recherche_ancestrale_montant?: number
    recherche_ancestrale_devise?: string
}

// `color` = pastille de statut (badge). `solid` = bouton d'action plein, à fort
// contraste, lisible en thème clair ET sombre (l'ancien bg-X/20 + text-X-400
// était illisible sur fond clair).
const statusMap: Record<string, { label: string; color: string; solid: string }> = {
    brouillon: { label: 'Brouillon', color: 'bg-gray-500/20 text-gray-400', solid: 'bg-slate-500 hover:bg-slate-600 text-white' },
    soumis: { label: 'Soumis', color: 'bg-blue-500/20 text-blue-400', solid: 'bg-blue-600 hover:bg-blue-700 text-white' },
    en_traitement: { label: 'En traitement', color: 'bg-amber-500/20 text-amber-400', solid: 'bg-amber-500 hover:bg-amber-600 text-white' },
    verification: { label: 'Vérification', color: 'bg-purple-500/20 text-purple-400', solid: 'bg-purple-600 hover:bg-purple-700 text-white' },
    approuve: { label: 'Approuvé', color: 'bg-emerald-500/20 text-emerald-400', solid: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
    rejete: { label: 'Rejeté', color: 'bg-red-500/20 text-red-400', solid: 'bg-red-600 hover:bg-red-700 text-white' },
}

// Statut de paiement « payé » (tolère les variantes accents/webhooks).
const isPaidStatus = (s?: string | null) => {
    const v = String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    return ['paye', 'paid', 'success', 'reussi', 'completed', 'ok'].includes(v)
}

export default function AdminNationalitePage() {
    const { t } = useTranslation();
    const [apps, setApps] = useState<Application[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('all')
    const [expanded, setExpanded] = useState<string | null>(null)
    const [search, setSearch] = useState('')

    const fetchApps = async () => {
        let q = supabase.from('nationality_applications').select('*').order('created_at', { ascending: false })
        // Les dossiers MyAfroOrigins en attente de revue vivent dans /admin/documents
        // jusqu'à leur approbation (qui les bascule en statut 'soumis').
        if (filter !== 'all') q = q.eq('status', filter)
        else q = q.neq('status', 'revue_myafro')
        if (search) q = q.or(`nom.ilike.%${search}%,prenom.ilike.%${search}%,email.ilike.%${search}%,application_ref.ilike.%${search}%`)
        const { data } = await q
        setApps((data || []) as Application[])
        setLoading(false)
    }

    useEffect(() => { fetchApps() }, [filter, search])

    const updateStatus = async (id: string, status: string) => {
        await supabase.from('nationality_applications').update({ status, decision_date: status === 'approuve' || status === 'rejete' ? new Date().toISOString() : null }).eq('id', id)
        fetchApps()
    }

    const updateNotes = async (id: string, notes: string) => {
        await supabase.from('nationality_applications').update({ agent_notes: notes }).eq('id', id)
    }

    const [relanceState, setRelanceState] = useState<Record<string, 'sending' | 'sent' | 'error'>>({})

    // Envoie au client un lien sécurisé (dossier déjà payé). mode='docs' → écran
    // léger pièces seules ; mode='full' → formulaire complet pré-rempli.
    const sendRelance = async (id: string, mode: 'docs' | 'full' = 'docs') => {
        const stateKey = `${id}:${mode}`
        if (relanceState[stateKey] === 'sending') return
        setRelanceState(prev => ({ ...prev, [stateKey]: 'sending' }))
        try {
            const res = await fetch('/api/agent/nationalite/relance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, mode }),
            })
            const data = await res.json()
            if (res.ok && data.success) {
                setRelanceState(prev => ({ ...prev, [stateKey]: 'sent' }))
            } else {
                setRelanceState(prev => ({ ...prev, [stateKey]: 'error' }))
                alert(data.error || 'Échec de l\'envoi de la relance.')
            }
        } catch {
            setRelanceState(prev => ({ ...prev, [stateKey]: 'error' }))
            alert('Erreur réseau lors de l\'envoi de la relance.')
        }
    }

    // Copie le lien de reprise (docs) dans le presse-papier → à envoyer par
    // WhatsApp si l'email ne passe pas.
    const [copiedId, setCopiedId] = useState<string | null>(null)
    const copyResumeLink = async (id: string) => {
        try {
            const res = await fetch('/api/agent/nationalite/resume-link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, mode: 'docs' }),
            })
            const data = await res.json()
            if (res.ok && data.link) {
                try {
                    await navigator.clipboard.writeText(data.link)
                    setCopiedId(id)
                    setTimeout(() => setCopiedId(null), 2500)
                } catch {
                    // clipboard bloqué → on montre le lien à copier manuellement
                    prompt('Copiez le lien de reprise :', data.link)
                }
            } else {
                alert(data.error || 'Impossible de générer le lien.')
            }
        } catch {
            alert('Erreur réseau.')
        }
    }

    /*
     * Téléchargement du dossier complet en ZIP.
     *
     * Trois défauts corrigés ici, qui faisaient que « rien ne se passe » :
     *
     * 1. `URL.revokeObjectURL` était appelé JUSTE APRÈS `a.click()`. Le clic
     *    ne fait que déclencher le téléchargement, il ne l'attend pas : on
     *    invalidait donc l'URL avant que le navigateur ait fini de lire le
     *    blob. Sur un ZIP contenant les pièces d'identité — plusieurs Mo —
     *    le téléchargement était annulé. On libère maintenant après un
     *    délai, une fois la lecture engagée.
     *
     * 2. L'ancre n'était jamais insérée dans le document. Firefox ignore le
     *    clic programmatique sur un élément détaché.
     *
     * 3. `if (res.ok)` sans `else` : toute erreur — 401, 403, 500 — était
     *    avalée en silence. L'utilisateur ne pouvait pas distinguer un
     *    échec d'un bouton mort.
     */
    const [zipEnCours, setZipEnCours] = useState<string | null>(null)

    const downloadZip = async (id: string, ref: string) => {
        setZipEnCours(id)
        try {
            const res = await fetch(`/api/nationality/download?id=${id}`, {
                // La route vérifie la session : les cookies doivent suivre.
                credentials: 'same-origin',
            })

            if (!res.ok) {
                let detail = `HTTP ${res.status}`
                try {
                    const j = await res.json()
                    if (j?.error) detail = j.detail ? `${j.error} — ${j.detail}` : j.error
                } catch { /* réponse non JSON : le code HTTP suffit */ }
                alert(`Téléchargement impossible : ${detail}`)
                return
            }

            const blob = await res.blob()
            if (blob.size === 0) {
                alert('Le dossier généré est vide. Signalez-le à la technique.')
                return
            }

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
        } finally {
            setZipEnCours(null)
        }
    }

    // ── Suppression d'une demande (+ fichiers storage) ──
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const deleteApp = async (a: Application) => {
        if (!confirm(`Supprimer définitivement la demande de ${a.prenom} ${a.nom} (${a.application_ref}) ?\nLes documents déposés seront aussi supprimés. Action irréversible.`)) return
        setDeletingId(a.id)
        try {
            const res = await fetch(`/api/admin/nationalite/${a.id}`, { method: 'DELETE' })
            if (res.ok) setApps(prev => prev.filter(x => x.id !== a.id))
            else { const j = await res.json().catch(() => ({})); alert(j.error || 'Suppression impossible.') }
        } finally { setDeletingId(null) }
    }

    // ── Réinitialisation des pièces (efface les fichiers, garde le dossier) ──
    const [resettingId, setResettingId] = useState<string | null>(null)
    const resetDocs = async (a: Application) => {
        if (!confirm(`Effacer TOUTES les pièces jointes de ${a.prenom} ${a.nom} (${a.application_ref}) ?\nLe dossier et le paiement sont conservés. Le client pourra re-déposer via une nouvelle relance. Action irréversible.`)) return
        setResettingId(a.id)
        try {
            const res = await fetch(`/api/admin/nationalite/${a.id}/reset-documents`, { method: 'POST' })
            const j = await res.json().catch(() => ({}))
            if (res.ok && j.success) {
                setApps(prev => prev.map(x => x.id === a.id ? { ...x, documents_uploaded: [] } : x))
                alert(`Pièces effacées (${j.filesRemoved} fichier(s) supprimé(s)). Vous pouvez maintenant relancer le client.`)
            } else {
                alert(j.error || 'Réinitialisation impossible.')
            }
        } catch {
            alert('Erreur réseau.')
        } finally { setResettingId(null) }
    }

    // ── Prévisualisation des documents (URLs signées) ──
    const [previewApp, setPreviewApp] = useState<Application | null>(null)
    const [previewDocs, setPreviewDocs] = useState<Array<{ label: string; url: string | null; type: string }>>([])
    const [previewLoading, setPreviewLoading] = useState(false)
    const openPreview = async (a: Application) => {
        setPreviewApp(a); setPreviewDocs([]); setPreviewLoading(true)
        try {
            const res = await fetch('/api/admin/nationalite/preview', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: a.id }),
            })
            const data = await res.json()
            setPreviewDocs(data.documents || [])
        } catch { setPreviewDocs([]) } finally { setPreviewLoading(false) }
    }

    // ── Ajout de documents par l'admin (nommage libre) ──
    const [addDocsApp, setAddDocsApp] = useState<Application | null>(null)
    const [docRows, setDocRows] = useState<{ id: string; label: string; file: File | null }[]>([])
    const [addingDocs, setAddingDocs] = useState(false)
    const newRow = () => ({ id: Math.random().toString(36).slice(2), label: '', file: null as File | null })
    const openAddDocs = (a: Application) => { setAddDocsApp(a); setDocRows([newRow()]) }
    const submitAddDocs = async () => {
        if (!addDocsApp) return
        const ready = docRows.filter(r => r.file && r.label.trim())
        if (ready.length === 0) { alert('Ajoutez au moins un fichier avec un nom.'); return }
        setAddingDocs(true)
        try {
            const docs: { label: string; path: string }[] = []
            for (const r of ready) {
                const ext = (r.file!.name.split('.').pop() || 'bin').toLowerCase()
                const fd = new FormData()
                fd.append('file', r.file!)
                fd.append('key', r.label.trim())
                fd.append('ext', ext)
                const up = await fetch('/api/nationality/upload-file', { method: 'POST', body: fd })
                const uj = await up.json().catch(() => ({}))
                if (!up.ok || !uj.path) throw new Error(uj.error || `Échec de l'envoi de « ${r.label} »`)
                docs.push({ label: r.label.trim(), path: uj.path })
            }
            const res = await fetch(`/api/admin/nationalite/${addDocsApp.id}/add-documents`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ docs }),
            })
            const j = await res.json().catch(() => ({}))
            if (!res.ok || !j.success) throw new Error(j.error || 'Enregistrement impossible.')
            setAddDocsApp(null)
            await fetchApps()
            alert(`${docs.length} document(s) ajouté(s) au dossier.`)
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Erreur.')
        } finally { setAddingDocs(false) }
    }

    // ── Lien de dépôt client (nommage libre) — dossiers payés uniquement ──
    const [depotCopiedId, setDepotCopiedId] = useState<string | null>(null)
    const copyDepotLink = async (id: string) => {
        try {
            const res = await fetch('/api/admin/nationalite/depot-link', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            })
            const data = await res.json().catch(() => ({}))
            if (res.ok && data.link) {
                try { await navigator.clipboard.writeText(data.link); setDepotCopiedId(id); setTimeout(() => setDepotCopiedId(null), 2500) }
                catch { prompt('Lien de dépôt client :', data.link) }
            } else alert(data.error || 'Impossible de générer le lien.')
        } catch { alert('Erreur réseau.') }
    }

    // Recherche ancestrale payée ? (pilote l'option 250 € de la fiche d'analyse)
    const [ancestralBusy, setAncestralBusy] = useState<string | null>(null)
    const toggleAncestral = async (a: Application) => {
        const next = !a.recherche_ancestrale_payee
        let montant = a.recherche_ancestrale_montant ?? 250
        const devise = a.recherche_ancestrale_devise || 'EUR'
        if (next) {
            const input = prompt(`Montant du forfait recherche ancestrale payé (${devise}) :`, String(montant))
            if (input === null) return // annulé
            const parsed = parseFloat(input.replace(',', '.'))
            if (!isNaN(parsed) && parsed >= 0) montant = parsed
        }
        setAncestralBusy(a.id)
        try {
            const { error } = await supabase.from('nationality_applications')
                .update({ recherche_ancestrale_payee: next, recherche_ancestrale_montant: montant, recherche_ancestrale_devise: devise })
                .eq('id', a.id)
            if (error) { alert('Champs indisponibles — exécutez les migrations 20260804_recherche_ancestrale_payee.sql et 20260804b_recherche_ancestrale_montant.sql'); return }
            setApps(prev => prev.map(x => x.id === a.id ? { ...x, recherche_ancestrale_payee: next, recherche_ancestrale_montant: montant, recherche_ancestrale_devise: devise } : x))
        } finally { setAncestralBusy(null) }
    }

    // ══ FICHE D'ANALYSE (auto / manuel → prévisualisation → envoi email) ══
    type FPiece = { document: string; statut: string; motif: string; filiation?: string }
    type FBox = { title: string; body: string; tone?: 'blue' | 'yellow' }
    interface FData {
        clientName: string; civilite?: string; date: string; objet: string; gestionnaire?: string
        statutBadge: string; formatWarning?: string | null; diagnostic: string
        piecesTitle?: string; piecesColMode?: 'motif' | 'filiation'; pieces: FPiece[]
        nextStepsTitle?: string; nextStepsIntro?: string; nextStepsBoxes?: FBox[]; finalNote?: string | null
    }
    const [ficheApp, setFicheApp] = useState<Application | null>(null)
    const [ficheStep, setFicheStep] = useState<'choose' | 'form' | 'preview'>('choose')
    const [ficheData, setFicheData] = useState<FData | null>(null)
    const [fichePdf, setFichePdf] = useState<string | null>(null)
    const [ficheEmail, setFicheEmail] = useState<{ subject: string; body: string }>({ subject: '', body: '' })
    const [ficheBusy, setFicheBusy] = useState(false)
    // Le PDF (base64) est exposé à l'iframe via un blob same-origin — la CSP
    // interdit les data: en frame-src, mais autorise blob:.
    const [fichePdfUrl, setFichePdfUrl] = useState<string | null>(null)
    useEffect(() => {
        if (!fichePdf) { setFichePdfUrl(null); return }
        const bytes = Uint8Array.from(atob(fichePdf), c => c.charCodeAt(0))
        const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
        setFichePdfUrl(url)
        return () => URL.revokeObjectURL(url)
    }, [fichePdf])

    const defaultFiche = (a: Application): FData => ({
        clientName: `${a.prenom || ''} ${a.nom || ''}`.trim().toUpperCase() || 'Client',
        civilite: (a.genre || '').toLowerCase().startsWith('f') ? 'Mme' : 'M.',
        date: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
        objet: "Preuve d'Afro-descendance & Conformité",
        gestionnaire: 'Pôle Instruction RGB',
        statutBadge: 'NON CONFORME - ACTION REQUISE',
        formatWarning: '',
        diagnostic: '',
        piecesTitle: 'DÉTAIL DES PIÈCES À RÉGULARISER',
        pieces: [{ document: '', statut: 'Manquant', motif: '' }],
        nextStepsTitle: 'PROCHAINES ÉTAPES & RENDEZ-VOUS',
        nextStepsIntro: 'Afin de vous accompagner dans la mise en conformité de votre dossier :',
        nextStepsBoxes: [{ title: "Proposition d'échange téléphonique", body: 'Nous vous suggérons d\'organiser un rendez-vous téléphonique selon vos disponibilités.', tone: 'blue' }],
        finalNote: "Merci de bien vouloir informer l'équipe RGB de l'option retenue afin de poursuivre l'instruction de votre dossier.",
    })
    const openFiche = (a: Application) => { setFicheApp(a); setFicheStep('choose'); setFicheData(null); setFichePdf(null) }
    // Pré-remplit le modèle « Modalités de régularisation » (généalogie, 2 options).
    const fillGenealogie = () => setFicheData(d => d ? ({
        ...d,
        objet: "Preuve d'Afro-descendance",
        statutBadge: 'DOSSIER INCOMPLET',
        formatWarning: '',
        diagnostic: "Constat de vérification : après étude attentive des pièces fournies, le dossier présente une absence des actes d'état civil requis pour constituer la filiation ascendante nécessaire à l'établissement de la preuve d'afro-descendance.",
        piecesTitle: 'INVENTAIRE DES PIÈCES MANQUANTES',
        piecesColMode: 'filiation',
        pieces: [
            { document: "Extrait d'acte de naissance", filiation: 'Titulaire du dossier (Client)', statut: 'Manquant', motif: '' },
            { document: "Extrait d'acte de naissance", filiation: "Père de l'intéressé", statut: 'Manquant', motif: '' },
            { document: "Extrait d'acte de naissance", filiation: "Mère de l'intéressé", statut: 'Manquant', motif: '' },
            { document: "Extraits d'acte de naissance", filiation: 'Grands-parents paternels (grand-père & grand-mère)', statut: 'Manquants', motif: '' },
            { document: "Extraits d'acte de naissance", filiation: 'Grands-parents maternels (grand-père & grand-mère)', statut: 'Manquants', motif: '' },
        ],
        nextStepsTitle: 'MODALITÉS DE RÉGULARISATION',
        nextStepsIntro: "Pour permettre le traitement et la validation finale de votre dossier, deux options s'offrent à vous :",
        nextStepsBoxes: [
            { title: 'Option 1 — Transmission directe', body: "Vous rassemblez par vos propres moyens l'ensemble des extraits d'acte de naissance listés ci-dessus et nous les transmettez directement dans les meilleurs délais.", tone: 'blue' },
            { title: 'Option 2 — Accompagnement RGB', body: "Si vous rencontrez des difficultés à obtenir ces documents, RGB propose de réaliser la recherche généalogique complète pour vous. Forfait Recherche Généalogique : 250 €.", tone: 'yellow' },
        ],
        finalNote: "Merci de bien vouloir informer l'équipe RGB de l'option retenue (fourniture directe des pièces ou souscription au service de recherche généalogique à 250 €) afin de poursuivre l'instruction de votre dossier.",
    }) : d)

    const callFiche = async (payload: Record<string, unknown>) => {
        const res = await fetch(`/api/admin/nationalite/${ficheApp!.id}/fiche-analyse`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        })
        const j = await res.json().catch(() => ({}))
        if (!res.ok || !j.success) throw new Error(j.error || 'Erreur.')
        return j
    }
    const runAuto = async () => {
        setFicheBusy(true)
        try {
            const j = await callFiche({ action: 'preview', mode: 'auto' })
            setFicheData(j.fiche); setFichePdf(j.pdfBase64); setFicheEmail(j.email); setFicheStep('preview')
        } catch (e) { alert(e instanceof Error ? e.message : 'Erreur.') } finally { setFicheBusy(false) }
    }
    const startManual = () => { setFicheData(defaultFiche(ficheApp!)); setFicheStep('form') }
    const previewManual = async () => {
        if (!ficheData) return
        setFicheBusy(true)
        try {
            const j = await callFiche({ action: 'preview', mode: 'manual', data: ficheData })
            setFichePdf(j.pdfBase64); setFicheEmail(j.email); setFicheStep('preview')
        } catch (e) { alert(e instanceof Error ? e.message : 'Erreur.') } finally { setFicheBusy(false) }
    }
    const sendFiche = async () => {
        if (!ficheData) return
        if (!ficheApp?.email) { alert('Ce dossier n\'a pas d\'e-mail client.'); return }
        if (!confirm(`Envoyer la fiche d'analyse à ${ficheApp.email} ?`)) return
        setFicheBusy(true)
        try {
            await callFiche({ action: 'send', mode: 'manual', data: ficheData, email: ficheEmail })
            setFicheApp(null)
            alert('Fiche d\'analyse envoyée au client.')
        } catch (e) { alert(e instanceof Error ? e.message : 'Envoi impossible.') } finally { setFicheBusy(false) }
    }
    const setF = (patch: Partial<FData>) => setFicheData(d => d ? { ...d, ...patch } : d)

    // ── Édition d'une demande ──
    const [editApp, setEditApp] = useState<Application | null>(null)
    const [editForm, setEditForm] = useState<Partial<Application>>({})
    const [savingEdit, setSavingEdit] = useState(false)
    // Gestionnaire de fichiers de l'édition (liste + suppression + ajout).
    type EditDoc = { index: number; label: string; path: string; ext: string; type: string; url: string | null }
    const [editDocs, setEditDocs] = useState<EditDoc[]>([])
    const [editDocsLoading, setEditDocsLoading] = useState(false)
    const [editDocBusy, setEditDocBusy] = useState(false)
    const loadEditDocs = async (id: string) => {
        setEditDocsLoading(true)
        try {
            const res = await fetch(`/api/admin/nationalite/${id}/documents`)
            const j = await res.json().catch(() => ({}))
            setEditDocs(res.ok ? (j.documents || []) : [])
        } catch { setEditDocs([]) } finally { setEditDocsLoading(false) }
    }
    const deleteEditDoc = async (path: string) => {
        if (!editApp || !confirm('Supprimer ce fichier définitivement ?')) return
        setEditDocBusy(true)
        try {
            const res = await fetch(`/api/admin/nationalite/${editApp.id}/documents?path=${encodeURIComponent(path)}`, { method: 'DELETE' })
            if (res.ok) await loadEditDocs(editApp.id)
            else { const j = await res.json().catch(() => ({})); alert(j.error || 'Suppression impossible.') }
        } finally { setEditDocBusy(false) }
    }
    const addEditDoc = async (file: File) => {
        if (!editApp) return
        setEditDocBusy(true)
        try {
            const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
            const label = file.name.replace(/\.[^.]+$/, '') || 'Document'
            const fd = new FormData(); fd.append('file', file); fd.append('key', label); fd.append('ext', ext)
            const up = await fetch('/api/nationality/upload-file', { method: 'POST', body: fd })
            const uj = await up.json().catch(() => ({}))
            if (!up.ok || !uj.path) throw new Error(uj.error || 'Envoi impossible.')
            const add = await fetch(`/api/admin/nationalite/${editApp.id}/add-documents`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ docs: [{ label, path: uj.path }] }),
            })
            if (!add.ok) throw new Error('Enregistrement impossible.')
            await loadEditDocs(editApp.id)
        } catch (e) { alert(e instanceof Error ? e.message : 'Erreur.') } finally { setEditDocBusy(false) }
    }
    // Remplace le fichier d'une pièce existante (même libellé, même place).
    const replaceEditDoc = async (oldPath: string, file: File) => {
        if (!editApp) return
        setEditDocBusy(true)
        try {
            const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
            const fd = new FormData(); fd.append('file', file); fd.append('key', file.name.replace(/\.[^.]+$/, '') || 'doc'); fd.append('ext', ext)
            const up = await fetch('/api/nationality/upload-file', { method: 'POST', body: fd })
            const uj = await up.json().catch(() => ({}))
            if (!up.ok || !uj.path) throw new Error(uj.error || 'Envoi impossible.')
            const res = await fetch(`/api/admin/nationalite/${editApp.id}/documents`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ oldPath, newPath: uj.path }),
            })
            if (!res.ok) throw new Error('Remplacement impossible.')
            await loadEditDocs(editApp.id)
        } catch (e) { alert(e instanceof Error ? e.message : 'Erreur.') } finally { setEditDocBusy(false) }
    }
    const openEdit = (a: Application) => {
        setEditApp(a)
        setEditDocs([]); loadEditDocs(a.id)
        setEditForm({
            nom: a.nom, prenom: a.prenom, email: a.email, telephone: a.telephone,
            genre: a.genre, date_naissance: a.date_naissance, pays_naissance: a.pays_naissance,
            ville_naissance: a.ville_naissance, nationalite: a.nationalite, pays_residence: a.pays_residence,
            adresse_residence: a.adresse_residence, profession: a.profession,
            numero_document: a.numero_document, type_document_identite: a.type_document_identite,
            pere_nom: a.pere_nom, pere_prenom: a.pere_prenom, mere_nom: a.mere_nom, mere_prenom: a.mere_prenom,
            afro_descendant_description: a.afro_descendant_description,
            amount: a.amount, currency: a.currency, payment_status: a.payment_status,
        })
    }
    const saveEdit = async () => {
        if (!editApp) return
        setSavingEdit(true)
        try {
            const res = await fetch(`/api/admin/nationalite/${editApp.id}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editForm),
            })
            const data = await res.json()
            if (res.ok && data.success) {
                setApps(prev => prev.map(x => x.id === editApp.id ? { ...x, ...data.application } : x))
                setEditApp(null)
            } else alert(data.error || 'Enregistrement impossible.')
        } finally { setSavingEdit(false) }
    }

    return (
        <div className="min-h-screen bg-[#0a0f14] py-8 px-4">
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                    <div>
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.3em]"><T>Gestion</T></span>
                        <h1 className="text-2xl font-black text-white flex items-center gap-2"><Globe2 size={22} className="text-emerald-400" /> <T>Demandes de Nationalité</T></h1>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        <Link href="/admin/nationalite/settings" className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-4 py-2 rounded-xl border border-emerald-500/20 flex items-center gap-2 hover:bg-emerald-500/20 transition-all">
                            <Globe2 size={14} /> <T>Paramètres formulaire</T> <ExternalLink size={12} />
                        </Link>
                        <Link href="/admin/settings/payment" className="text-xs font-bold text-amber-400 bg-amber-500/10 px-4 py-2 rounded-xl border border-amber-500/20 flex items-center gap-2 hover:bg-amber-500/20 transition-all">
                            <CreditCard size={14} /> <T>Passerelles paiement</T> <ExternalLink size={12} />
                        </Link>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-2 mb-6">
                    {['all', 'soumis', 'en_traitement', 'verification', 'approuve', 'rejete'].map(f => (
                        <button key={f} onClick={() => setFilter(f)} className={`text-xs font-bold px-4 py-2 rounded-xl transition-all ${filter === f ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-white/5 text-gray-500 border border-white/5 hover:text-white'}`}>
                            {f === 'all' ? 'Toutes' : statusMap[f]?.label}
                        </button>
                    ))}
                    <div className="relative ml-auto"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder={t("Rechercher...")} className="bg-white/5 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-white text-xs focus:outline-none w-48" /></div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                    {[{ l: 'Total', v: apps.length, c: 'text-white' }, { l: 'Soumises', v: apps.filter(a => a.status === 'soumis').length, c: 'text-blue-400' }, { l: 'Approuvées', v: apps.filter(a => a.status === 'approuve').length, c: 'text-emerald-400' }, { l: 'Rejetées', v: apps.filter(a => a.status === 'rejete').length, c: 'text-red-400' }].map((s, i) => (
                        <div key={i} className="bg-white/[0.03] border border-white/5 rounded-xl p-4 text-center"><p className={`text-2xl font-black ${s.c}`}>{s.v}</p><p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{s.l}</p></div>
                    ))}
                </div>

                {loading ? <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" /></div> : apps.length === 0 ? <div className="text-center py-20 text-gray-500"><Globe2 className="mx-auto mb-3 text-gray-700" size={40} /><p className="text-sm"><T>Aucune demande</T></p></div> : (
                    <div className="space-y-3">{apps.map((a, i) => {
                        const st = statusMap[a.status] || statusMap.soumis
                        const isOpen = expanded === a.id
                        return (
                            <motion.div key={a.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} className="bg-white/[0.03] border border-white/5 rounded-xl overflow-hidden hover:border-white/10 transition-all">
                                <div className="p-5 cursor-pointer" onClick={() => setExpanded(isOpen ? null : a.id)}>
                                    <div className="flex items-center justify-between flex-wrap gap-3">
                                        <div>
                                            <div className="flex items-center gap-3 mb-1"><span className="text-xs font-mono font-bold text-[#FCD116]">{a.application_ref}</span><span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${st.color}`}>{st.label}</span></div>
                                            <p className="text-sm font-bold text-white">{a.prenom} {a.nom}</p>
                                            <div className="flex items-center gap-4 mt-1 text-[10px] text-gray-500 flex-wrap">
                                                <span className="flex items-center gap-1"><Mail size={10} /> {a.email}</span>
                                                <span className="flex items-center gap-1"><MapPin size={10} /> {a.pays_residence}</span>
                                                <span>{!a.created_at || isNaN(new Date(a.created_at).getTime()) ? '—' : new Date(a.created_at).toLocaleDateString('fr-FR')}</span>
                                            </div>
                                        </div>
                                        {isOpen ? <ChevronUp size={18} className="text-gray-500" /> : <ChevronDown size={18} className="text-gray-500" />}
                                    </div>
                                </div>
                                {isOpen && (
                                    <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} className="border-t border-white/5 p-5 space-y-5">
                                        {/* Identité */}
                                        <div>
                                            <h4 className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-2"><T>Identité</T></h4>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                                {[['Genre', a.genre], ['Date de naissance', a.date_naissance], ['Pays naissance', a.pays_naissance], ['Ville naissance', a.ville_naissance], ['Nationalité', a.nationalite], ['Pays résidence', a.pays_residence], ['Adresse', a.adresse_residence], ['Téléphone', a.telephone], ['Profession', a.profession], ['Depuis le Bénin', a.demande_depuis_benin ? 'Oui' : 'Non']].map(([k, v], j) => v && (
                                                    <div key={j}><span className="text-gray-600 block text-[10px]">{k}</span><span className="text-white font-bold">{v}</span></div>
                                                ))}
                                            </div>
                                        </div>
                                        {/* Document d'identité */}
                                        <div>
                                            <h4 className="text-[9px] font-black text-blue-400 uppercase tracking-[0.2em] mb-2"><T>Document d&apos;identité</T></h4>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                                {[['Type', a.type_document_identite], ['Numéro', a.numero_document], ['Expiration', a.date_expiration_document], ['Pays délivrance', a.pays_delivrance], ['Lieu délivrance', a.lieu_delivrance], ['Autorité', a.autorite_delivrance]].map(([k, v], j) => v && (
                                                    <div key={j}><span className="text-gray-600 block text-[10px]">{k}</span><span className="text-white font-bold">{v}</span></div>
                                                ))}
                                            </div>
                                        </div>
                                        {/* Parents */}
                                        <div>
                                            <h4 className="text-[9px] font-black text-purple-400 uppercase tracking-[0.2em] mb-2"><T>Parents</T></h4>
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                                                {[['Père — Nom', a.pere_nom], ['Père — Prénom', a.pere_prenom], ['Père — Naissance', a.pere_date_naissance], ['Mère — Nom', a.mere_nom], ['Mère — Prénom', a.mere_prenom], ['Mère — Naissance', a.mere_date_naissance]].map(([k, v], j) => v && (
                                                    <div key={j}><span className="text-gray-600 block text-[10px]">{k}</span><span className="text-white font-bold">{v}</span></div>
                                                ))}
                                            </div>
                                        </div>
                                        {/* Ancêtres */}
                                        <div>
                                            <h4 className="text-[9px] font-black text-amber-400 uppercase tracking-[0.2em] mb-2"><T>Ancêtres</T></h4>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                                {[['Ancêtre 1 — Nom', a.ancestor1_nom], ['Ancêtre 1 — Prénom', a.ancestor1_prenom], ['Ancêtre 1 — Lien', a.ancestor1_lien_parente], ['Ancêtre 1 — Nationalité', a.ancestor1_nationalite], ['Ancêtre 1 — Pays résidence', a.ancestor1_pays_residence], ['Ancêtre 1 — Vivant', a.ancestor1_vivant === true ? 'Oui' : a.ancestor1_vivant === false ? 'Non' : null], ['Ancêtre 2 — Nom', a.ancestor2_nom], ['Ancêtre 2 — Prénom', a.ancestor2_prenom], ['Ancêtre 2 — Lien', a.ancestor2_lien_parente], ['Ancêtre 2 — Nationalité', a.ancestor2_nationalite]].map(([k, v], j) => v && (
                                                    <div key={j}><span className="text-gray-600 block text-[10px]">{k}</span><span className="text-white font-bold">{v}</span></div>
                                                ))}
                                            </div>
                                        </div>
                                        {/* Afro-descendance */}
                                        {a.afro_descendant_description && <div><span className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.2em] block mb-1"><T>Description afro-descendance</T></span><p className="text-xs text-gray-400 bg-white/[0.02] rounded-lg p-3">{a.afro_descendant_description}</p></div>}
                                        {/* Paiement — scindé : nationalité / recherche ancestrale + total */}
                                        <div>
                                            <h4 className="text-[9px] font-black text-[#FCD116] uppercase tracking-[0.2em] mb-2"><T>Paiement</T></h4>
                                            {(() => {
                                                const natPaid = isPaidStatus(a.payment_status)
                                                const natCur = a.currency || 'EUR'
                                                const natAmt = Number(a.amount) || 0
                                                const ancPaid = !!a.recherche_ancestrale_payee
                                                const ancCur = a.recherche_ancestrale_devise || 'EUR'
                                                const ancAmt = ancPaid ? (Number(a.recherche_ancestrale_montant ?? 250)) : 0
                                                const total = (natPaid ? natAmt : 0) + (natCur === ancCur ? ancAmt : 0)
                                                const totalStr = natCur === ancCur
                                                    ? `${total} ${natCur}`
                                                    : `${natPaid ? natAmt : 0} ${natCur}${ancPaid ? ` + ${ancAmt} ${ancCur}` : ''}`
                                                return (
                                                    <div className="space-y-2">
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                            {/* Nationalité */}
                                                            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3">
                                                                <div className="flex items-center justify-between mb-1.5">
                                                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider"><T>Demande de nationalité</T></span>
                                                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${natPaid ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>{natPaid ? 'PAYÉ' : (a.payment_status || 'EN ATTENTE')}</span>
                                                                </div>
                                                                <p className="text-lg font-black text-white">{natAmt} {natCur}</p>
                                                                <p className="text-[10px] text-gray-500">{[a.payment_method, a.payment_ref].filter(Boolean).join(' · ') || '—'}</p>
                                                            </div>
                                                            {/* Recherche ancestrale */}
                                                            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3">
                                                                <div className="flex items-center justify-between mb-1.5">
                                                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider"><T>Recherche ancestrale</T></span>
                                                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${ancPaid ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400'}`}>{ancPaid ? 'PAYÉE' : 'NON PAYÉE'}</span>
                                                                </div>
                                                                <p className={`text-lg font-black ${ancPaid ? 'text-white' : 'text-gray-600'}`}>{ancPaid ? `${ancAmt} ${ancCur}` : '—'}</p>
                                                                <p className="text-[10px] text-gray-500"><T>Forfait recherche généalogique</T></p>
                                                            </div>
                                                        </div>
                                                        {/* Total */}
                                                        <div className="flex items-center justify-between bg-[#008751]/10 border border-[#008751]/25 rounded-xl px-3 py-2">
                                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider"><T>Total encaissé</T></span>
                                                            <span className="text-base font-black text-[#008751]">{totalStr}</span>
                                                        </div>
                                                    </div>
                                                )
                                            })()}
                                        </div>
                                        {/* Pièces jointes */}
                                        {a.documents_uploaded && (a.documents_uploaded as string[]).length > 0 && (
                                            <div>
                                                <h4 className="text-[9px] font-black text-cyan-400 uppercase tracking-[0.2em] mb-2">Pièces jointes ({(a.documents_uploaded as string[]).length})</h4>
                                                <div className="flex flex-wrap gap-2">
                                                    {(a.documents_uploaded as string[]).map((doc, j) => (
                                                        <span key={j} className="text-[10px] bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg text-gray-400">{typeof doc === 'string' ? doc : JSON.stringify(doc)}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {/* Notes agent */}
                                        <div><span className="text-[10px] text-gray-600 block mb-1"><T>Notes agent</T></span><textarea defaultValue={a.agent_notes || ''} onBlur={e => updateNotes(a.id, e.target.value)} className="w-full bg-white/[0.03] border border-white/5 rounded-lg p-3 text-xs text-white focus:outline-none resize-none" rows={2} placeholder={t("Notes...")} /></div>
                                        {/* Actions — boutons PLEINS, fort contraste (lisibles en clair ET sombre) */}
                                        <div className="flex gap-2 flex-wrap">
                                            {a.documents_uploaded && (a.documents_uploaded as string[]).length > 0 && (
                                                <button onClick={() => openPreview(a)} className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-1.5"><Eye size={13} /> <T>Prévisualiser</T></button>
                                            )}
                                            <button onClick={() => openEdit(a)} className="bg-violet-600 hover:bg-violet-700 text-white font-bold text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-1.5"><Pencil size={13} /> <T>Éditer</T></button>
                                            <button onClick={() => openAddDocs(a)} className="bg-[#008751] hover:bg-[#00643C] text-white font-bold text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-1.5"><FilePlus size={13} /> <T>Ajouter des documents</T></button>
                                            <button onClick={() => openFiche(a)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-1.5"><ClipboardList size={13} /> <T>Fiche d&apos;analyse</T></button>
                                            <button onClick={() => toggleAncestral(a)} disabled={ancestralBusy === a.id}
                                                title={t('Recherche ancestrale (généalogie) payée par le client ? Pilote l\'option 250 € de la fiche.')}
                                                className={`font-bold text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50 ${a.recherche_ancestrale_payee ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-slate-300 text-slate-700 hover:bg-slate-400'}`}>
                                                {ancestralBusy === a.id ? <Loader2 size={13} className="animate-spin" /> : a.recherche_ancestrale_payee ? <Check size={13} /> : <Landmark size={13} />}
                                                {a.recherche_ancestrale_payee ? <T>Recherche ancestrale : payée</T> : <T>Recherche ancestrale : non payée</T>}
                                            </button>
                                            <button onClick={() => downloadZip(a.id, a.application_ref)} disabled={zipEnCours === a.id}
                                                className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 font-bold text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                                                {zipEnCours === a.id ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} <T>Télécharger ZIP</T></button>
                                            <button onClick={() => resetDocs(a)} disabled={resettingId === a.id}
                                                title={t('Efface toutes les pièces jointes (garde le dossier + paiement) pour permettre un nouveau dépôt propre via relance')}
                                                className="bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-50 font-bold text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                                                {resettingId === a.id ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />} <T>Réinitialiser les pièces</T>
                                            </button>
                                            <button
                                                onClick={() => sendRelance(a.id, 'docs')}
                                                disabled={relanceState[`${a.id}:docs`] === 'sending'}
                                                title={t('Écran léger : le client re-dépose uniquement les pièces manquantes (sans nouveau paiement)')}
                                                className={`font-bold text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-white transition-colors ${relanceState[`${a.id}:docs`] === 'sent' ? 'bg-emerald-600' : 'bg-amber-500 hover:bg-amber-600'}`}
                                            >
                                                {relanceState[`${a.id}:docs`] === 'sending'
                                                    ? <><Loader2 size={13} className="animate-spin" /> <T>Envoi…</T></>
                                                    : relanceState[`${a.id}:docs`] === 'sent'
                                                        ? <><Check size={13} /> <T>Relance envoyée</T></>
                                                        : <><Mail size={13} /> <T>Relancer (documents)</T></>}
                                            </button>
                                            <button
                                                onClick={() => copyResumeLink(a.id)}
                                                title={t('Copie le lien de reprise (pièces) pour l\'envoyer par WhatsApp si l\'email ne passe pas')}
                                                className={`font-bold text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-white transition-colors ${copiedId === a.id ? 'bg-emerald-600' : 'bg-teal-600 hover:bg-teal-700'}`}
                                            >
                                                {copiedId === a.id ? <><Check size={13} /> <T>Lien copié</T></> : <><Copy size={13} /> <T>Copier le lien</T></>}
                                            </button>
                                            {/* Dépôt client à nommage libre — RÉSERVÉ aux dossiers payés */}
                                            {isPaidStatus(a.payment_status) && (
                                                <button
                                                    onClick={() => copyDepotLink(a.id)}
                                                    title={t('Envoie au client un lien pour déposer LUI-MÊME des pièces qu\'il nomme (dossier payé)')}
                                                    className={`font-bold text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-white transition-colors ${depotCopiedId === a.id ? 'bg-emerald-600' : 'bg-[#008751] hover:bg-[#00643C]'}`}
                                                >
                                                    {depotCopiedId === a.id ? <><Check size={13} /> <T>Lien dépôt copié</T></> : <><Send size={13} /> <T>Demander des pièces au client</T></>}
                                                </button>
                                            )}
                                            <button
                                                onClick={() => sendRelance(a.id, 'full')}
                                                disabled={relanceState[`${a.id}:full`] === 'sending'}
                                                title={t('Formulaire complet pré-rempli : à utiliser si des informations aussi doivent être corrigées (sans nouveau paiement)')}
                                                className={`font-bold text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-white transition-colors ${relanceState[`${a.id}:full`] === 'sent' ? 'bg-emerald-600' : 'bg-slate-600 hover:bg-slate-700'}`}
                                            >
                                                {relanceState[`${a.id}:full`] === 'sending'
                                                    ? <><Loader2 size={13} className="animate-spin" /> <T>Envoi…</T></>
                                                    : relanceState[`${a.id}:full`] === 'sent'
                                                        ? <><Check size={13} /> <T>Relance envoyée</T></>
                                                        : <><Mail size={13} /> <T>Relancer (dossier complet)</T></>}
                                            </button>
                                            {['soumis', 'en_traitement', 'verification', 'approuve', 'rejete'].filter(s => s !== a.status).map(s => (
                                                <button key={s} onClick={() => updateStatus(a.id, s)} className={`text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors ${statusMap[s]?.solid}`}>{statusMap[s]?.label}</button>
                                            ))}
                                            <button onClick={() => deleteApp(a)} disabled={deletingId === a.id} className="ml-auto bg-red-600 hover:bg-red-700 text-white font-bold text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-1.5 disabled:opacity-50">
                                                {deletingId === a.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} <T>Supprimer</T>
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </motion.div>
                        )
                    })}</div>
                )}
            </div>

            {/* ═══ MODAL PRÉVISUALISATION DOCUMENTS ═══ */}
            {previewApp && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm" onClick={() => setPreviewApp(null)}>
                    <div className="w-full max-w-4xl max-h-[88vh] overflow-hidden flex flex-col bg-[#0d1424] border border-white/10 rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                            <div>
                                <h3 className="text-lg font-black text-white">Pièces jointes — {previewApp.prenom} {previewApp.nom}</h3>
                                <p className="text-[11px] text-gray-500">{previewApp.application_ref}</p>
                            </div>
                            <button onClick={() => setPreviewApp(null)} title="Fermer" className="p-2 rounded-full hover:bg-white/5 text-gray-400"><X size={18} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6">
                            {previewLoading ? (
                                <div className="flex flex-col items-center py-16 text-gray-500"><Loader2 size={28} className="animate-spin mb-3" />Chargement des documents…</div>
                            ) : previewDocs.length === 0 ? (
                                <div className="text-center py-16 text-gray-500 text-sm">Aucun document exploitable pour ce dossier.</div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {previewDocs.map((d, i) => (
                                        <div key={i} className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden flex flex-col">
                                            <div className="h-40 bg-black/40 flex items-center justify-center overflow-hidden">
                                                {d.url && d.type === 'image'
                                                    ? <img src={d.url} alt={d.label} className="w-full h-full object-cover" />
                                                    : <div className="flex flex-col items-center text-gray-500">{d.type === 'pdf' ? <FileText size={34} /> : <ImageIcon size={34} />}<span className="text-[10px] mt-2 uppercase">{d.type}</span></div>}
                                            </div>
                                            <div className="p-3 flex-1 flex flex-col gap-2">
                                                <p className="text-xs font-bold text-white leading-snug line-clamp-2">{d.label}</p>
                                                {d.url
                                                    ? <a href={d.url} target="_blank" rel="noopener noreferrer" className="mt-auto inline-flex items-center gap-1 text-[11px] font-bold text-cyan-400 hover:text-cyan-300"><ExternalLink size={12} /> Ouvrir en plein écran</a>
                                                    : <span className="mt-auto text-[10px] text-red-400">Fichier indisponible</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ MODAL ÉDITION DEMANDE ═══ */}
            {editApp && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm" onClick={() => setEditApp(null)}>
                    <div className="w-full max-w-2xl max-h-[88vh] overflow-hidden flex flex-col bg-[#0d1424] border border-white/10 rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                            <h3 className="text-lg font-black text-white flex items-center gap-2"><Pencil size={16} className="text-violet-400" /> Éditer la demande — {editApp.application_ref}</h3>
                            <button onClick={() => setEditApp(null)} title="Fermer" className="p-2 rounded-full hover:bg-white/5 text-gray-400"><X size={18} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {([
                                ['nom', 'Nom'], ['prenom', 'Prénom'], ['email', 'Email'], ['telephone', 'Téléphone'],
                                ['genre', 'Genre'], ['date_naissance', 'Date de naissance'], ['pays_naissance', 'Pays de naissance'],
                                ['ville_naissance', 'Ville de naissance'], ['nationalite', 'Nationalité'], ['pays_residence', 'Pays de résidence'],
                                ['adresse_residence', 'Adresse'], ['profession', 'Profession'],
                                ['numero_document', "N° pièce d'identité"], ['type_document_identite', "Type de pièce"],
                                ['pere_nom', 'Nom du père'], ['pere_prenom', 'Prénom du père'],
                                ['mere_nom', 'Nom de la mère'], ['mere_prenom', 'Prénom de la mère'],
                                ['amount', 'Montant'], ['currency', 'Devise'],
                            ] as Array<[keyof Application, string]>).map(([key, label]) => (
                                <div key={key as string}>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">{label}</label>
                                    <input
                                        value={String(editForm[key] ?? '')}
                                        onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500/50"
                                    />
                                </div>
                            ))}
                            <div className="sm:col-span-2">
                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Statut du paiement</label>
                                <select value={String(editForm.payment_status ?? '')} onChange={e => setEditForm(f => ({ ...f, payment_status: e.target.value }))} title="Statut paiement" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500/50">
                                    <option value="payé">payé</option>
                                    <option value="en_attente">en_attente</option>
                                    <option value="a_verifier">a_verifier</option>
                                </select>
                            </div>
                            <div className="sm:col-span-2">
                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Description afro-descendance</label>
                                <textarea rows={3} value={String(editForm.afro_descendant_description ?? '')} onChange={e => setEditForm(f => ({ ...f, afro_descendant_description: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500/50 resize-none" />
                            </div>
                            {/* Gestionnaire de fichiers — voir / supprimer / ajouter (couleurs slate immunisées) */}
                            <div className="sm:col-span-2">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Documents du client ({editDocs.length})</label>
                                <div className="rounded-xl border border-white/10 bg-slate-900/50 p-3 space-y-2">
                                    {editDocsLoading ? (
                                        <div className="flex items-center gap-2 text-slate-400 text-xs py-2"><Loader2 size={14} className="animate-spin" /> Chargement des fichiers…</div>
                                    ) : editDocs.length === 0 ? (
                                        <p className="text-xs text-slate-500 py-2">Aucun fichier pour ce dossier.</p>
                                    ) : editDocs.map(d => (
                                        <div key={d.path} className="flex items-center gap-3 bg-slate-800/60 border border-white/5 rounded-lg px-3 py-2">
                                            <div className="w-8 h-8 rounded-lg bg-slate-700/60 flex items-center justify-center text-slate-300 shrink-0">{d.type === 'image' ? <ImageIcon size={15} /> : <FileText size={15} />}</div>
                                            <div className="flex-1 min-w-0"><p className="text-[13px] font-semibold text-slate-100 truncate">{d.label}</p><p className="text-[10px] text-slate-400 uppercase tracking-wide">{d.ext || 'fichier'}</p></div>
                                            {d.url && <a href={d.url} target="_blank" rel="noreferrer" title="Voir" className="p-1.5 rounded-lg text-slate-300 hover:bg-white/10 transition-colors"><Eye size={15} /></a>}
                                            <label title="Modifier / remplacer ce fichier" className={`p-1.5 rounded-lg text-[#008751] hover:bg-[#008751]/10 transition-colors ${editDocBusy ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}>
                                                <Replace size={15} />
                                                <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.ods,.odt,.rtf,.txt" className="hidden" disabled={editDocBusy}
                                                    onChange={e => { const f = e.target.files?.[0]; if (f) replaceEditDoc(d.path, f); e.currentTarget.value = '' }} />
                                            </label>
                                            <button onClick={() => deleteEditDoc(d.path)} disabled={editDocBusy} title="Supprimer" className="p-1.5 rounded-lg text-[#E8112D] hover:bg-[#E8112D]/10 disabled:opacity-50 transition-colors"><Trash2 size={15} /></button>
                                        </div>
                                    ))}
                                    <label className="mt-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-white/20 text-slate-300 text-xs font-bold cursor-pointer hover:border-[#008751] hover:text-[#008751] transition-colors">
                                        {editDocBusy ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={15} />} Ajouter un fichier depuis l&apos;ordinateur
                                        <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.ods,.odt,.rtf,.txt" className="hidden" disabled={editDocBusy}
                                            onChange={e => { const f = e.target.files?.[0]; if (f) addEditDoc(f); e.currentTarget.value = '' }} />
                                    </label>
                                </div>
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-white/10 flex justify-end gap-3">
                            <button onClick={() => setEditApp(null)} className="px-4 py-2 rounded-xl border border-white/10 text-gray-400 text-sm font-bold hover:bg-white/5">Annuler</button>
                            <button onClick={saveEdit} disabled={savingEdit} className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-black flex items-center gap-2 disabled:opacity-60">
                                {savingEdit ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Enregistrer
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ MODAL AJOUT DE DOCUMENTS (admin, nommage libre) ═══ */}
            {addDocsApp && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm" onClick={() => !addingDocs && setAddDocsApp(null)}>
                    <div className="w-full max-w-2xl max-h-[88vh] overflow-hidden flex flex-col bg-[#0d1424] border border-white/10 rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                            <div>
                                <h3 className="text-lg font-black text-white flex items-center gap-2"><FilePlus size={18} className="text-[#008751]" /> Ajouter des documents</h3>
                                <p className="text-[11px] text-gray-500">{addDocsApp.prenom} {addDocsApp.nom} — {addDocsApp.application_ref}</p>
                            </div>
                            <button onClick={() => !addingDocs && setAddDocsApp(null)} title="Fermer" className="p-2 rounded-full hover:bg-white/5 text-gray-400"><X size={18} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-3">
                            <p className="text-xs text-gray-400">Nommez chaque pièce vous-même, puis choisissez le fichier. Formats : PDF, image, Word.</p>
                            {docRows.map((r, i) => (
                                <div key={r.id} className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center bg-white/[0.03] border border-white/10 rounded-xl p-3">
                                    <input
                                        type="text" value={r.label}
                                        onChange={e => setDocRows(prev => prev.map(x => x.id === r.id ? { ...x, label: e.target.value } : x))}
                                        placeholder="Nom de la pièce (ex : Acte de naissance)"
                                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#008751]/60"
                                    />
                                    <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-300 cursor-pointer hover:bg-white/10 whitespace-nowrap">
                                        <UploadCloud size={14} className="text-[#008751]" />
                                        <span className="truncate max-w-[150px]">{r.file ? r.file.name : 'Choisir un fichier'}</span>
                                        <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.doc,.docx" className="hidden"
                                            onChange={e => { const f = e.target.files?.[0] || null; setDocRows(prev => prev.map(x => x.id === r.id ? { ...x, file: f } : x)) }} />
                                    </label>
                                    {docRows.length > 1 && (
                                        <button onClick={() => setDocRows(prev => prev.filter(x => x.id !== r.id))} title="Retirer" className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 self-center"><Trash2 size={15} /></button>
                                    )}
                                </div>
                            ))}
                            <button onClick={() => setDocRows(prev => [...prev, newRow()])} className="flex items-center gap-1.5 text-xs font-bold text-[#008751] hover:text-[#00643C]"><Plus size={14} /> Ajouter une autre pièce</button>
                        </div>
                        <div className="px-6 py-4 border-t border-white/10 flex justify-end gap-3">
                            <button onClick={() => setAddDocsApp(null)} disabled={addingDocs} className="px-4 py-2 rounded-xl border border-white/10 text-gray-400 text-sm font-bold hover:bg-white/5 disabled:opacity-50">Annuler</button>
                            <button onClick={submitAddDocs} disabled={addingDocs} className="px-5 py-2 rounded-xl bg-[#008751] hover:bg-[#00643C] text-white text-sm font-black flex items-center gap-2 disabled:opacity-60">
                                {addingDocs ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Enregistrer les pièces
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ MODAL FICHE D'ANALYSE (light premium) ═══ */}
            {ficheApp && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md" onClick={() => !ficheBusy && setFicheApp(null)}>
                    <div className="w-full max-w-5xl max-h-[93vh] overflow-hidden flex flex-col bg-white rounded-3xl border border-slate-200 shadow-[0_30px_80px_-20px_rgba(15,23,42,0.45)]" onClick={e => e.stopPropagation()}>
                        {/* Liseré tricolore + header */}
                        <div className="h-1 flex"><span className="flex-[46] bg-[#008751]" /><span className="flex-[27] bg-[#FCD116]" /><span className="flex-[27] bg-[#E8112D]" /></div>
                        <div className="flex items-center justify-between px-7 py-5 border-b border-slate-100">
                            <div className="flex items-center gap-3">
                                {ficheStep !== 'choose' && (
                                    <button onClick={() => setFicheStep(ficheData ? 'form' : 'choose')} title="Retour" className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors"><ArrowLeft size={17} /></button>
                                )}
                                <div className="w-10 h-10 rounded-2xl bg-[#E6F3ED] flex items-center justify-center text-[#008751]"><ClipboardList size={19} /></div>
                                <div>
                                    <h3 className="text-[17px] font-extrabold text-slate-900 tracking-tight">Fiche d&apos;analyse</h3>
                                    <p className="text-[12px] text-slate-500 font-medium">{ficheApp.prenom} {ficheApp.nom} · <span className="font-mono text-slate-400">{ficheApp.application_ref}</span></p>
                                </div>
                            </div>
                            <button onClick={() => !ficheBusy && setFicheApp(null)} title="Fermer" className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors"><X size={18} /></button>
                        </div>

                        {/* STEP CHOOSE */}
                        {ficheStep === 'choose' && (
                            <div className="p-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <button onClick={runAuto} disabled={ficheBusy} className="text-left p-6 rounded-2xl border border-slate-200 hover:border-[#008751] hover:shadow-[0_12px_30px_-12px_rgba(0,135,81,0.4)] transition-all disabled:opacity-60 group">
                                    <div className="w-12 h-12 rounded-2xl bg-[#E6F3ED] flex items-center justify-center mb-4 text-[#008751] group-hover:scale-105 transition-transform">{ficheBusy ? <Loader2 size={22} className="animate-spin" /> : <Wand2 size={22} />}</div>
                                    <h4 className="text-slate-900 font-extrabold text-[15px] mb-1.5">Automatique</h4>
                                    <p className="text-[13px] text-slate-500 leading-relaxed">Le système détecte les pièces manquantes et les formats non conformes, génère la fiche et rédige l&apos;e-mail par IA.</p>
                                </button>
                                <button onClick={startManual} disabled={ficheBusy} className="text-left p-6 rounded-2xl border border-slate-200 hover:border-indigo-500 hover:shadow-[0_12px_30px_-12px_rgba(79,70,229,0.4)] transition-all disabled:opacity-60 group">
                                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4 text-indigo-600 group-hover:scale-105 transition-transform"><PenLine size={22} /></div>
                                    <h4 className="text-slate-900 font-extrabold text-[15px] mb-1.5">Manuelle</h4>
                                    <p className="text-[13px] text-slate-500 leading-relaxed">Vous composez la fiche champ par champ (diagnostic, pièces, statuts, prochaines étapes), puis prévisualisez avant l&apos;envoi.</p>
                                </button>
                            </div>
                        )}

                        {/* STEP FORM */}
                        {ficheStep === 'form' && ficheData && (
                            <>
                                <div className="flex-1 overflow-y-auto px-7 py-6 space-y-5">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div><label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Statut (badge)</label>
                                            <select value={ficheData.statutBadge} onChange={e => setF({ statutBadge: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-[#008751] focus:ring-2 focus:ring-[#008751]/15">
                                                <option>NON CONFORME - ACTION REQUISE</option><option>DOSSIER INCOMPLET</option><option>DOSSIER A VERIFIER</option><option>DOSSIER COMPLET</option>
                                            </select></div>
                                        <div><label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Type de tableau</label>
                                            <select value={ficheData.piecesColMode || 'motif'} onChange={e => setF({ piecesColMode: e.target.value as 'motif' | 'filiation' })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-[#008751] focus:ring-2 focus:ring-[#008751]/15">
                                                <option value="motif">Conformité (Document · Statut · Motif)</option><option value="filiation">Généalogie (Pièce · Filiation · Statut)</option>
                                            </select></div>
                                    </div>
                                    <button type="button" onClick={fillGenealogie} className="inline-flex items-center gap-1.5 text-[12px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"><Wand2 size={13} /> Pré-remplir « Modalités de régularisation » (généalogie, 2 options)</button>
                                    <div><label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Objet</label>
                                        <input value={ficheData.objet} onChange={e => setF({ objet: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-[#008751] focus:ring-2 focus:ring-[#008751]/15" /></div>
                                    <div><label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Encadré exigence de format <span className="text-slate-400 normal-case font-medium">(vide = masqué)</span></label>
                                        <textarea rows={2} value={ficheData.formatWarning || ''} onChange={e => setF({ formatWarning: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-[#008751] focus:ring-2 focus:ring-[#008751]/15 resize-none" placeholder="Ex : Tout document en mode photo n'est pas utilisable — format PDF obligatoire." /></div>
                                    <div><label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Diagnostic général</label>
                                        <textarea rows={3} value={ficheData.diagnostic} onChange={e => setF({ diagnostic: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-[#008751] focus:ring-2 focus:ring-[#008751]/15 resize-none" /></div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">{(ficheData.piecesColMode === 'filiation') ? 'Pièces manquantes' : 'Pièces à régulariser'}</label>
                                        <div className="space-y-2">
                                            {ficheData.pieces.map((p, i) => (
                                                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                                                    <input value={p.document} onChange={e => setF({ pieces: ficheData.pieces.map((x, k) => k === i ? { ...x, document: e.target.value } : x) })} placeholder={ficheData.piecesColMode === 'filiation' ? 'Pièce requise' : 'Document'} className="col-span-4 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-[13px] text-slate-900 focus:outline-none focus:border-[#008751]" />
                                                    {ficheData.piecesColMode === 'filiation'
                                                        ? <input value={p.filiation || ''} onChange={e => setF({ pieces: ficheData.pieces.map((x, k) => k === i ? { ...x, filiation: e.target.value } : x) })} placeholder="Lien de filiation" className="col-span-4 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-[13px] text-slate-900 focus:outline-none focus:border-[#008751]" />
                                                        : <input value={p.motif} onChange={e => setF({ pieces: ficheData.pieces.map((x, k) => k === i ? { ...x, motif: e.target.value } : x) })} placeholder="Motif / exigence" className="col-span-4 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-[13px] text-slate-900 focus:outline-none focus:border-[#008751]" />}
                                                    <select value={p.statut} onChange={e => setF({ pieces: ficheData.pieces.map((x, k) => k === i ? { ...x, statut: e.target.value } : x) })} className="col-span-3 bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-[13px] text-slate-900 focus:outline-none focus:border-[#008751]">
                                                        <option>Manquant</option><option>Manquants</option><option>Absent</option><option>Absents</option><option>Format Photo</option><option>Non conforme</option><option>Illisible</option><option>À vérifier</option>
                                                    </select>
                                                    <button onClick={() => setF({ pieces: ficheData.pieces.filter((_, k) => k !== i) })} title="Retirer" className="col-span-1 p-2 rounded-lg text-[#E8112D] hover:bg-[#FDECEA] justify-self-center transition-colors"><Trash2 size={15} /></button>
                                                </div>
                                            ))}
                                        </div>
                                        <button onClick={() => setF({ pieces: [...ficheData.pieces, { document: '', statut: 'Manquant', motif: '', filiation: '' }] })} className="mt-2.5 inline-flex items-center gap-1.5 text-[13px] font-bold text-[#008751] hover:text-[#00643C] transition-colors"><Plus size={15} /> Ajouter une pièce</button>
                                    </div>
                                    <div><label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Intro « prochaines étapes »</label>
                                        <input value={ficheData.nextStepsIntro || ''} onChange={e => setF({ nextStepsIntro: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-[#008751] focus:ring-2 focus:ring-[#008751]/15" /></div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Encadrés (options / RDV)</label>
                                        <div className="space-y-2.5">
                                            {(ficheData.nextStepsBoxes || []).map((b, i) => (
                                                <div key={i} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-2">
                                                    <div className="flex gap-2">
                                                        <input value={b.title} onChange={e => setF({ nextStepsBoxes: (ficheData.nextStepsBoxes || []).map((x, k) => k === i ? { ...x, title: e.target.value } : x) })} placeholder="Titre de l'encadré" className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-[13px] text-slate-900 focus:outline-none focus:border-[#008751]" />
                                                        <select value={b.tone || 'blue'} onChange={e => setF({ nextStepsBoxes: (ficheData.nextStepsBoxes || []).map((x, k) => k === i ? { ...x, tone: e.target.value as 'blue' | 'yellow' } : x) })} className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[13px] text-slate-900 focus:outline-none focus:border-[#008751]"><option value="blue">Bleu</option><option value="yellow">Jaune</option></select>
                                                        <button onClick={() => setF({ nextStepsBoxes: (ficheData.nextStepsBoxes || []).filter((_, k) => k !== i) })} title="Retirer" className="p-1.5 rounded-lg text-[#E8112D] hover:bg-[#FDECEA] transition-colors"><Trash2 size={15} /></button>
                                                    </div>
                                                    <textarea rows={2} value={b.body} onChange={e => setF({ nextStepsBoxes: (ficheData.nextStepsBoxes || []).map((x, k) => k === i ? { ...x, body: e.target.value } : x) })} placeholder="Contenu (ex : Forfait recherche généalogique 250 €)" className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-[13px] text-slate-900 focus:outline-none focus:border-[#008751] resize-none" />
                                                </div>
                                            ))}
                                        </div>
                                        {(ficheData.nextStepsBoxes || []).length < 2 && (
                                            <button onClick={() => setF({ nextStepsBoxes: [...(ficheData.nextStepsBoxes || []), { title: '', body: '', tone: 'yellow' }] })} className="mt-2.5 inline-flex items-center gap-1.5 text-[13px] font-bold text-[#008751] hover:text-[#00643C] transition-colors"><Plus size={15} /> Ajouter un encadré</button>
                                        )}
                                    </div>
                                    <div><label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Note finale épinglée <span className="text-slate-400 normal-case font-medium">(vide = masquée)</span></label>
                                        <textarea rows={2} value={ficheData.finalNote || ''} onChange={e => setF({ finalNote: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-[#008751] focus:ring-2 focus:ring-[#008751]/15 resize-none" placeholder="Ex : Merci d'informer l'équipe RGB de l'option retenue…" /></div>
                                </div>
                                <div className="px-7 py-4 border-t border-slate-100 flex justify-end gap-3">
                                    <button onClick={() => setFicheStep('choose')} className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 transition-colors">Retour</button>
                                    <button onClick={previewManual} disabled={ficheBusy} className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold flex items-center gap-2 disabled:opacity-60 transition-colors shadow-[0_10px_24px_-10px_rgba(79,70,229,0.6)]">
                                        {ficheBusy ? <Loader2 size={15} className="animate-spin" /> : <Eye size={15} />} Prévisualiser
                                    </button>
                                </div>
                            </>
                        )}

                        {/* STEP PREVIEW */}
                        {ficheStep === 'preview' && (
                            <>
                                <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-2 min-h-[320px]">
                                    <div className="p-5 border-b lg:border-b-0 lg:border-r border-slate-100 bg-slate-50/50">
                                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2.5">Aperçu de la fiche</p>
                                        {fichePdfUrl
                                            ? <iframe title="Aperçu fiche" src={fichePdfUrl} className="w-full h-[460px] rounded-xl bg-white border border-slate-200 shadow-sm" />
                                            : <div className="h-[460px] flex items-center justify-center text-slate-400"><Loader2 className="animate-spin" /></div>}
                                    </div>
                                    <div className="p-5 space-y-3">
                                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">E-mail au client {ficheApp.email ? <span className="text-slate-400 normal-case font-medium">→ {ficheApp.email}</span> : <span className="text-[#E8112D] normal-case font-semibold">(aucun e-mail !)</span>}</p>
                                        <input value={ficheEmail.subject} onChange={e => setFicheEmail(v => ({ ...v, subject: e.target.value }))} placeholder="Objet de l'e-mail" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-[#008751] focus:ring-2 focus:ring-[#008751]/15" />
                                        <textarea rows={15} value={ficheEmail.body} onChange={e => setFicheEmail(v => ({ ...v, body: e.target.value }))} placeholder="Message (rédigé par l'IA, modifiable)" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-[#008751] focus:ring-2 focus:ring-[#008751]/15 resize-none leading-relaxed" />
                                        <p className="inline-flex items-center gap-1.5 text-[12px] text-slate-500"><Wand2 size={13} className="text-indigo-500" /> Message rédigé par l&apos;assistant IA — ajustable avant l&apos;envoi.</p>
                                    </div>
                                </div>
                                <div className="px-7 py-4 border-t border-slate-100 flex justify-between gap-3">
                                    <a href={fichePdfUrl || '#'} download={`Fiche-Analyse-${ficheApp.nom || 'client'}.pdf`} className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 flex items-center gap-2 transition-colors"><Download size={15} /> Télécharger</a>
                                    <button onClick={sendFiche} disabled={ficheBusy || !ficheApp.email} className="px-5 py-2.5 rounded-xl bg-[#008751] hover:bg-[#00643C] text-white text-sm font-bold flex items-center gap-2 disabled:opacity-50 transition-colors shadow-[0_10px_24px_-10px_rgba(0,135,81,0.65)]">
                                        {ficheBusy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Envoyer au client
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

        </div>
    )
}
