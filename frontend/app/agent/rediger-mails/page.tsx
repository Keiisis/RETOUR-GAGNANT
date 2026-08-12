'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { Envelope as Mail, PaperPlaneTilt as Send, X, MagnifyingGlass as Search, User, Trash as Trash2, Eye, PencilLine as Edit3, Clock, CheckCircle as CheckCircle2, WarningCircle as AlertCircle, TextB as Bold, TextItalic as Italic, TextUnderline as Underline, Link as Link2, List, ListNumbers as ListOrdered, TextAlignLeft as AlignLeft, TextAlignCenter as AlignCenter, Image, Sparkle as Sparkles, FileText, ArrowClockwise as RefreshCw, Tray as Inbox, Star, Paperclip, MagicWand as Wand2 } from '@phosphor-icons/react';

// ═══════════════════════════════════════════
// Types
// ═══════════════════════════════════════════
interface Contact {
    id: string
    email: string
    nom: string
    prenom: string
    phone?: string
    type: 'client' | 'lead' | 'partenaire'
}

interface EmailLog {
    id: string
    to_email: string
    subject: string
    body_html: string
    context: string
    status: 'sent' | 'failed'
    created_at: string
}

interface EmailAttachment {
    id: string
    filename: string
    size: number
    contentType: string
    content: string // base64 (data URL prefix strippe au moment du POST)
}

type Tab = 'compose' | 'sent' | 'templates'

// Limite dure cote client : meme que l'API (20MB decodes)
const MAX_ATTACHMENT_TOTAL_BYTES = 20 * 1024 * 1024

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} o`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
    return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`
}

function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result || ''))
        reader.onerror = () => reject(new Error('Impossible de lire ' + file.name))
        reader.readAsDataURL(file)
    })
}

// ═══════════════════════════════════════════
// Modèles de mails prédéfinis
// ═══════════════════════════════════════════
const EMAIL_TEMPLATES = [
    {
        id: 'bienvenue',
        name: 'Bienvenue Client',
        subject: 'Bienvenue chez Retour Gagnant Bénin',
        color: '#008751',
        body: `<p>Cher(e) <strong>[NOM DU CLIENT]</strong>,</p>
<p>Nous sommes ravis de vous accueillir au sein de la famille <strong>Retour Gagnant Bénin</strong>.</p>
<p>Notre équipe est à votre entière disposition pour vous accompagner dans toutes vos démarches :</p>
<ul>
<li>Passeport et documents officiels</li>
<li>Nationalité béninoise</li>
<li>Investissement immobilier</li>
<li>Création d'entreprise</li>
</ul>
<p>N'hésitez pas à nous contacter à tout moment. Votre satisfaction est notre priorité absolue.</p>
<p>Cordialement,<br/><strong>L'équipe Retour Gagnant Bénin</strong></p>`,
    },
    {
        id: 'suivi-dossier',
        name: 'Suivi de Dossier',
        subject: 'Mise à jour de votre dossier : Retour Gagnant',
        color: '#1B2A4A',
        body: `<p>Bonjour <strong>[NOM DU CLIENT]</strong>,</p>
<p>Nous souhaitons vous informer de l'avancement de votre dossier :</p>
<p><strong>Dossier :</strong> [REFERENCE]<br/>
<strong>Service :</strong> [SERVICE]<br/>
<strong>Statut :</strong> En cours de traitement</p>
<p>Notre équipe travaille activement sur votre dossier. Nous vous tiendrons informé(e) de chaque étape importante.</p>
<p>Si vous avez des documents supplémentaires à nous transmettre, n'hésitez pas à répondre à cet email.</p>
<p>Cordialement,<br/><strong>L'équipe Retour Gagnant Bénin</strong></p>`,
    },
    {
        id: 'relance',
        name: 'Relance Paiement',
        subject: 'Rappel : Facture en attente de règlement',
        color: '#C9A84C',
        body: `<p>Bonjour <strong>[NOM DU CLIENT]</strong>,</p>
<p>Nous nous permettons de vous rappeler que la facture <strong>[N° FACTURE]</strong> d'un montant de <strong>[MONTANT] FCFA</strong> est en attente de règlement.</p>
<p>Vous pouvez effectuer votre paiement par :</p>
<ul>
<li>Virement bancaire</li>
<li>Mobile Money (MTN / Moov)</li>
<li>Paiement en ligne sur notre plateforme</li>
</ul>
<p>Si le paiement a déjà été effectué, veuillez ignorer ce message.</p>
<p>Cordialement,<br/><strong>L'équipe Retour Gagnant Bénin</strong></p>`,
    },
    {
        id: 'rdv',
        name: 'Confirmation RDV',
        subject: 'Confirmation de votre rendez-vous : Retour Gagnant',
        color: '#008751',
        body: `<p>Bonjour <strong>[NOM DU CLIENT]</strong>,</p>
<p>Votre rendez-vous a bien été confirmé :</p>
<p><strong>Date :</strong> [DATE]<br/>
<strong>Heure :</strong> [HEURE]<br/>
<strong>Lieu :</strong> Haie-Vive Cocotiers, Cotonou, Bénin<br/>
<strong>Objet :</strong> [SERVICE]</p>
<p>Merci de vous munir des documents suivants :</p>
<ul>
<li>Pièce d'identité en cours de validité</li>
<li>Tout document relatif à votre dossier</li>
</ul>
<p>En cas d'empêchement, veuillez nous prévenir au moins 24h à l'avance.</p>
<p>À très bientôt !<br/><strong>L'équipe Retour Gagnant Bénin</strong></p>`,
    },
    {
        id: 'remerciement',
        name: 'Remerciement',
        subject: 'Merci pour votre confiance : Retour Gagnant',
        color: '#E8112D',
        body: `<p>Cher(e) <strong>[NOM DU CLIENT]</strong>,</p>
<p>Nous tenions à vous remercier sincèrement pour la confiance que vous nous accordez.</p>
<p>Votre satisfaction est le moteur de notre engagement quotidien. Nous restons à votre disposition pour tout besoin futur.</p>
<p>N'hésitez pas à nous recommander auprès de votre entourage. Chaque membre de la diaspora mérite un accompagnement d'excellence.</p>
<p>Avec nos meilleures salutations,<br/><strong>L'équipe Retour Gagnant Bénin</strong></p>`,
    },
]

// ═══════════════════════════════════════════
// Composant principal : Design clair institutionnel
// ═══════════════════════════════════════════
export default function AgentRedigerMailsPage() {
    const [tab, setTab] = useState<Tab>('compose')
    const [contacts, setContacts] = useState<Contact[]>([])
    const [sentEmails, setSentEmails] = useState<EmailLog[]>([])
    const [loading, setLoading] = useState(true)
    const [sending, setSending] = useState(false)
    const [sendResult, setSendResult] = useState<{ ok: boolean; msg: string } | null>(null)

    // Compose state
    const [toEmail, setToEmail] = useState('')
    const [toName, setToName] = useState('')
    const [subject, setSubject] = useState('')
    const [bodyHtml, setBodyHtml] = useState('')
    const [showContactPicker, setShowContactPicker] = useState(false)
    const [contactSearch, setContactSearch] = useState('')
    const [showPreview, setShowPreview] = useState(false)
    const [showTemplates, setShowTemplates] = useState(false)

    // Pieces jointes + amelioration IA
    const [attachments, setAttachments] = useState<EmailAttachment[]>([])
    const [enhancing, setEnhancing] = useState(false)

    const editorRef = useRef<HTMLDivElement>(null)
    const contactPickerRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Charger les contacts et emails envoyés
    useEffect(() => {
        const init = async () => {
            setLoading(true)
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { setLoading(false); return }

            const [messagesRes, clientsRes, leadsRes] = await Promise.all([
                supabase.from('messages').select('nom, prenom, email').not('email', 'is', null),
                supabase.from('client_profiles').select('id, first_name, last_name, email, phone'),
                supabase.from('leads').select('id, full_name, email, phone'),
            ])

            const contactMap = new Map<string, Contact>()

            ;(clientsRes.data || []).forEach(c => {
                if (c.email) {
                    contactMap.set(c.email.toLowerCase(), {
                        id: c.id, email: c.email, nom: c.last_name || '', prenom: c.first_name || '',
                        phone: c.phone || undefined, type: 'client',
                    })
                }
            })

            ;(leadsRes.data || []).forEach(l => {
                if (l.email && !contactMap.has(l.email.toLowerCase())) {
                    const parts = (l.full_name || '').split(' ')
                    contactMap.set(l.email.toLowerCase(), {
                        id: l.id, email: l.email, nom: parts.slice(1).join(' ') || '', prenom: parts[0] || '',
                        phone: l.phone || undefined, type: 'lead',
                    })
                }
            })

            ;(messagesRes.data || []).forEach(m => {
                if (m.email && !contactMap.has(m.email.toLowerCase())) {
                    contactMap.set(m.email.toLowerCase(), {
                        id: m.email, email: m.email, nom: m.nom || '', prenom: m.prenom || '', type: 'client',
                    })
                }
            })

            setContacts(Array.from(contactMap.values()).sort((a, b) => a.nom.localeCompare(b.nom)))

            const { data: logs } = await supabase
                .from('email_logs')
                .select('*')
                .eq('context', 'agent_compose')
                .order('created_at', { ascending: false })
                .limit(50)

            if (logs) setSentEmails(logs)
            setLoading(false)
        }
        init()
    }, [])

    // Fermer le contact picker si clic extérieur
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (contactPickerRef.current && !contactPickerRef.current.contains(e.target as Node)) {
                setShowContactPicker(false)
            }
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [])

    const filteredContacts = useMemo(() => {
        if (!contactSearch) return contacts.slice(0, 10)
        const q = contactSearch.toLowerCase()
        return contacts.filter(c =>
            c.email.toLowerCase().includes(q) ||
            c.nom.toLowerCase().includes(q) ||
            c.prenom.toLowerCase().includes(q)
        ).slice(0, 10)
    }, [contacts, contactSearch])

    const syncEditorContent = () => {
        if (editorRef.current) setBodyHtml(editorRef.current.innerHTML)
    }

    const execCmd = (cmd: string, value?: string) => {
        document.execCommand(cmd, false, value)
        editorRef.current?.focus()
        syncEditorContent()
    }

    const insertLink = () => {
        const url = prompt('URL du lien :')
        if (url) execCmd('createLink', url)
    }

    const applyTemplate = (tpl: typeof EMAIL_TEMPLATES[0]) => {
        setSubject(tpl.subject)
        if (editorRef.current) {
            editorRef.current.innerHTML = tpl.body
            setBodyHtml(tpl.body)
        }
        setShowTemplates(false)
    }

    const selectContact = (c: Contact) => {
        setToEmail(c.email)
        setToName(`${c.prenom} ${c.nom}`.trim())
        setContactSearch('')
        setShowContactPicker(false)
    }

    // ─── Upload de pieces jointes (tous types de fichiers) ───
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || [])
        if (files.length === 0) return

        const currentTotal = attachments.reduce((acc, a) => acc + a.size, 0)
        const newItems: EmailAttachment[] = []
        let runningTotal = currentTotal

        for (const file of files) {
            if (runningTotal + file.size > MAX_ATTACHMENT_TOTAL_BYTES) {
                setSendResult({
                    ok: false,
                    msg: `Taille totale > ${formatFileSize(MAX_ATTACHMENT_TOTAL_BYTES)}. Fichier "${file.name}" ignoré.`,
                })
                break
            }
            try {
                const dataUrl = await readFileAsDataUrl(file)
                newItems.push({
                    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    filename: file.name,
                    size: file.size,
                    contentType: file.type || 'application/octet-stream',
                    content: dataUrl,
                })
                runningTotal += file.size
            } catch (err) {
                setSendResult({
                    ok: false,
                    msg: err instanceof Error ? err.message : 'Erreur de lecture du fichier.',
                })
            }
        }

        if (newItems.length > 0) {
            setAttachments(prev => [...prev, ...newItems])
        }
        // Reset input pour permettre de re-uploader le meme fichier si supprime
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    const removeAttachment = (id: string) => {
        setAttachments(prev => prev.filter(a => a.id !== id))
    }

    // ─── Ameliorer le mail avec l'IA (Groq via /api/ai/enhance-email) ───
    const handleEnhanceWithAI = async () => {
        syncEditorContent()
        const currentHtml = editorRef.current?.innerHTML || bodyHtml
        // On envoie le texte brut à l'IA (plus fiable que HTML)
        const plainText = editorRef.current?.innerText || currentHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        if (!plainText || plainText.length < 10) {
            setSendResult({ ok: false, msg: 'Écrivez un brouillon (au moins 10 caractères) avant d\'améliorer.' })
            setTimeout(() => setSendResult(null), 4000)
            return
        }

        setEnhancing(true)
        setSendResult(null)
        try {
            const res = await fetch('/api/ai/enhance-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: plainText }),
            })
            const data = await res.json()
            if (!res.ok || !data.enhanced) {
                throw new Error(data.error || 'Pas de réponse de l\'IA.')
            }
            // Converti le texte brut ameliore en HTML (paragraphes + sauts de ligne preserves)
            const enhancedHtml = data.enhanced
                .split(/\n{2,}/)
                .map((para: string) => `<p>${para.replace(/\n/g, '<br/>')}</p>`)
                .join('')

            if (editorRef.current) {
                editorRef.current.innerHTML = enhancedHtml
            }
            setBodyHtml(enhancedHtml)
            setSendResult({ ok: true, msg: ' Mail amélioré par l\'IA. Relisez avant d\'envoyer.' })
            setTimeout(() => setSendResult(null), 4000)
        } catch (err) {
            setSendResult({
                ok: false,
                msg: err instanceof Error ? err.message : 'Échec de l\'amélioration IA.',
            })
            setTimeout(() => setSendResult(null), 5000)
        }
        setEnhancing(false)
    }

    const handleSend = async () => {
        if (!toEmail || !subject) return
        syncEditorContent()
        const html = editorRef.current?.innerHTML || bodyHtml
        if (!html.trim()) return

        setSending(true)
        setSendResult(null)

        try {
            const res = await fetch('/api/email/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: toEmail,
                    subject,
                    message: html,
                    clientName: toName || toEmail.split('@')[0],
                    context: 'agent_compose',
                    language: 'fr',
                    attachments: attachments.map(a => ({
                        filename: a.filename,
                        content: a.content,
                        contentType: a.contentType,
                    })),
                }),
            })

            const data = await res.json()
            if (res.ok && data.success) {
                const attachCount = attachments.length
                setSendResult({
                    ok: true,
                    msg: attachCount > 0
                        ? `Email envoyé avec ${attachCount} pièce(s) jointe(s) !`
                        : 'Email envoyé avec succès !',
                })
                setSentEmails(prev => [{
                    id: Date.now().toString(),
                    to_email: toEmail,
                    subject,
                    body_html: html,
                    context: 'agent_compose',
                    status: 'sent',
                    created_at: new Date().toISOString(),
                }, ...prev])
                setToEmail(''); setToName(''); setSubject('')
                if (editorRef.current) editorRef.current.innerHTML = ''
                setBodyHtml('')
                setAttachments([])
            } else {
                setSendResult({ ok: false, msg: data.error || 'Erreur lors de l\'envoi.' })
            }
        } catch {
            setSendResult({ ok: false, msg: 'Erreur réseau. Vérifiez votre connexion.' })
        }
        setSending(false)
        setTimeout(() => setSendResult(null), 5000)
    }

    const handleClear = () => {
        setToEmail(''); setToName(''); setSubject('')
        if (editorRef.current) editorRef.current.innerHTML = ''
        setBodyHtml(''); setSendResult(null)
        setAttachments([])
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[70vh]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-2 border-[#008751]/30 border-t-[#008751] rounded-full animate-spin" />
                    <p className="text-xs text-[#1B2A4A]/50 font-semibold uppercase tracking-widest">Chargement messagerie...</p>
                </div>
            </div>
        )
    }

    return (
        /* ══════════ CONTENEUR PRINCIPAL : fond clair ivoire ══════════ */
        <div className="min-h-screen -m-6 lg:-m-8" style={{ background: 'linear-gradient(180deg, #F7F4EE 0%, #FEFCF9 50%, #F5F0E8 100%)' }}>
            {/* ── Bandeau tricolore supérieur ── */}
            <div className="h-1 bg-gradient-to-r from-[#008751] via-[#FCD116] to-[#E8112D]" />

            {/* ── Header institutionnel ── */}
            <div className="border-b border-[#1B2A4A]/10 bg-white/70 backdrop-blur-sm">
                <div className="max-w-6xl mx-auto px-6 py-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-xl bg-[#1B2A4A] flex items-center justify-center shadow-md">
                            <Mail size={20} className="text-[#C9A84C]" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-[#1B2A4A] tracking-tight">Messagerie Email</h1>
                            <p className="text-xs text-[#6B7280] mt-0.5">
                                <span className="text-[#008751] font-semibold">Retour Gagnant Bénin</span> : Espace Agent
                            </p>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex items-center gap-1 p-1 bg-[#1B2A4A]/5 rounded-xl">
                        {([
                            { key: 'compose' as Tab, label: 'Nouveau', icon: Edit3 },
                            { key: 'sent' as Tab, label: `Envoyés (${sentEmails.length})`, icon: Send },
                            { key: 'templates' as Tab, label: 'Modèles', icon: FileText },
                        ]).map(t => (
                            <button
                                key={t.key}
                                onClick={() => setTab(t.key)}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                                    tab === t.key
                                        ? 'bg-white text-[#1B2A4A] shadow-sm border border-[#1B2A4A]/10'
                                        : 'text-[#6B7280] hover:text-[#1B2A4A] hover:bg-white/50'
                                }`}
                            >
                                <t.icon size={14} />
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-6 py-6 space-y-5">

                {/* ── Success / Error banner ── */}
                <AnimatePresence>
                    {sendResult && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className={`flex items-center gap-3 px-5 py-4 rounded-xl border ${
                                sendResult.ok
                                    ? 'bg-[#008751]/5 border-[#008751]/20 text-[#008751]'
                                    : 'bg-[#E8112D]/5 border-[#E8112D]/20 text-[#E8112D]'
                            }`}
                        >
                            {sendResult.ok ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                            <span className="text-sm font-semibold">{sendResult.msg}</span>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ═══════════════════════════════════ */}
                {/* TAB: COMPOSE                       */}
                {/* ═══════════════════════════════════ */}
                {tab === 'compose' && (
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white rounded-2xl border border-[#1B2A4A]/10 shadow-sm overflow-hidden"
                    >
                        {/* ── Toolbar ── */}
                        <div className="px-6 py-4 border-b border-[#1B2A4A]/8 flex items-center justify-between bg-[#FAFAF7]">
                            <div className="flex items-center gap-2.5">
                                <div className="w-2 h-2 rounded-full bg-[#008751]" />
                                <span className="text-sm font-semibold text-[#1B2A4A]">Nouveau message</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setShowTemplates(!showTemplates)}
                                    className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all border ${
                                        showTemplates
                                            ? 'bg-[#C9A84C]/10 border-[#C9A84C]/30 text-[#C9A84C]'
                                            : 'bg-white border-[#1B2A4A]/10 text-[#6B7280] hover:text-[#1B2A4A] hover:border-[#1B2A4A]/20'
                                    }`}
                                >
                                    <Sparkles size={13} />
                                    Modèles
                                </button>
                                <button
                                    onClick={() => setShowPreview(!showPreview)}
                                    className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all border ${
                                        showPreview
                                            ? 'bg-[#1B2A4A]/5 border-[#1B2A4A]/20 text-[#1B2A4A]'
                                            : 'bg-white border-[#1B2A4A]/10 text-[#6B7280] hover:text-[#1B2A4A] hover:border-[#1B2A4A]/20'
                                    }`}
                                >
                                    <Eye size={13} />
                                    Aperçu
                                </button>
                                <button
                                    onClick={handleClear}
                                    className="p-2 rounded-lg bg-white border border-[#1B2A4A]/10 text-[#6B7280] hover:text-[#E8112D] hover:border-[#E8112D]/20 transition-all"
                                    title="Tout effacer"
                                >
                                    <Trash2 size={13} />
                                </button>
                            </div>
                        </div>

                        {/* ── Quick Templates dropdown ── */}
                        <AnimatePresence>
                            {showTemplates && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden border-b border-[#1B2A4A]/8"
                                >
                                    <div className="p-5 bg-[#FEFCF9] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {EMAIL_TEMPLATES.map(tpl => (
                                            <button
                                                key={tpl.id}
                                                onClick={() => applyTemplate(tpl)}
                                                className="text-left p-4 rounded-xl bg-white border border-[#1B2A4A]/8 hover:border-[#008751]/30 hover:shadow-md transition-all group"
                                            >
                                                <div className="flex items-center gap-2.5 mb-2">
                                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tpl.color }} />
                                                    <span className="text-xs font-semibold text-[#1B2A4A]">{tpl.name}</span>
                                                </div>
                                                <p className="text-[10px] text-[#6B7280] line-clamp-2 leading-relaxed">{tpl.subject}</p>
                                            </button>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="divide-y divide-[#1B2A4A]/6">
                            {/* ── Destinataire ── */}
                            <div className="relative px-6 py-3 flex items-center gap-3" ref={contactPickerRef}>
                                <label className="text-xs font-semibold text-[#6B7280] w-10 flex-shrink-0">À :</label>
                                <div className="flex-1 relative">
                                    <div className="flex items-center gap-2">
                                        {toName && (
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#008751]/8 text-[#008751] text-xs font-semibold border border-[#008751]/15">
                                                <User size={11} />
                                                {toName}
                                                <button onClick={() => { setToEmail(''); setToName('') }} className="ml-1 hover:text-[#E8112D] transition-colors" aria-label="Retirer le destinataire">
                                                    <X size={11} />
                                                </button>
                                            </span>
                                        )}
                                        <input
                                            type="text"
                                            value={toName ? '' : toEmail}
                                            onChange={e => {
                                                setToEmail(e.target.value)
                                                setContactSearch(e.target.value)
                                                setShowContactPicker(true)
                                                if (toName) setToName('')
                                            }}
                                            onFocus={() => { if (!toName) setShowContactPicker(true) }}
                                            placeholder={toName ? '' : 'Saisir un email ou rechercher un contact...'}
                                            className="flex-1 bg-transparent text-[#1B2A4A] text-sm focus:outline-none placeholder:text-[#1B2A4A]/25"
                                        />
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowContactPicker(!showContactPicker)}
                                    className="p-2 rounded-lg text-[#6B7280] hover:text-[#008751] hover:bg-[#008751]/5 transition-all"
                                    title="Carnet de contacts"
                                >
                                    <Search size={15} />
                                </button>

                                {/* Contact picker dropdown */}
                                <AnimatePresence>
                                    {showContactPicker && filteredContacts.length > 0 && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -4, scale: 0.98 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: -4, scale: 0.98 }}
                                            className="absolute z-50 top-full left-12 right-12 mt-1 bg-white border border-[#1B2A4A]/12 rounded-xl shadow-xl overflow-hidden max-h-[260px] overflow-y-auto"
                                        >
                                            <div className="px-4 py-2.5 bg-[#FAFAF7] border-b border-[#1B2A4A]/6">
                                                <p className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider">Contacts</p>
                                            </div>
                                            {filteredContacts.map(c => (
                                                <button
                                                    key={c.id}
                                                    onClick={() => selectContact(c)}
                                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#008751]/3 transition-colors text-left border-b border-[#1B2A4A]/4 last:border-b-0"
                                                >
                                                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: c.type === 'client' ? '#008751' + '12' : c.type === 'lead' ? '#C9A84C' + '15' : '#1B2A4A' + '10' }}>
                                                        <span className="text-xs font-bold" style={{ color: c.type === 'client' ? '#008751' : c.type === 'lead' ? '#C9A84C' : '#1B2A4A' }}>
                                                            {(c.prenom[0] || c.nom[0] || '?').toUpperCase()}
                                                        </span>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-semibold text-[#1B2A4A] truncate">{c.prenom} {c.nom}</p>
                                                        <p className="text-[10px] text-[#6B7280] truncate">{c.email}</p>
                                                    </div>
                                                    <span className={`text-[8px] font-bold uppercase px-2 py-0.5 rounded-md ${
                                                        c.type === 'client' ? 'bg-[#008751]/8 text-[#008751]' :
                                                        c.type === 'lead' ? 'bg-[#C9A84C]/10 text-[#C9A84C]' :
                                                        'bg-[#1B2A4A]/8 text-[#1B2A4A]'
                                                    }`}>
                                                        {c.type}
                                                    </span>
                                                </button>
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* ── Objet ── */}
                            <div className="px-6 py-3 flex items-center gap-3">
                                <label className="text-xs font-semibold text-[#6B7280] w-10 flex-shrink-0">Objet :</label>
                                <input
                                    type="text"
                                    value={subject}
                                    onChange={e => setSubject(e.target.value)}
                                    placeholder="Objet de votre email..."
                                    className="flex-1 bg-transparent text-[#1B2A4A] text-sm font-medium focus:outline-none placeholder:text-[#1B2A4A]/25"
                                />
                            </div>

                            {/* ── Barre d'outils éditeur ── */}
                            <div className="px-4 py-2 flex flex-wrap items-center gap-0.5 bg-[#FAFAF7]">
                                {[
                                    { icon: Bold, cmd: 'bold', tip: 'Gras' },
                                    { icon: Italic, cmd: 'italic', tip: 'Italique' },
                                    { icon: Underline, cmd: 'underline', tip: 'Souligné' },
                                ].map(btn => (
                                    <button
                                        key={btn.cmd}
                                        onClick={() => execCmd(btn.cmd)}
                                        title={btn.tip}
                                        className="p-2 rounded-md text-[#6B7280] hover:text-[#1B2A4A] hover:bg-[#1B2A4A]/5 transition-all"
                                    >
                                        <btn.icon size={15} />
                                    </button>
                                ))}
                                <div className="w-px h-5 bg-[#1B2A4A]/8 mx-1" />
                                {[
                                    { icon: List, cmd: 'insertUnorderedList', tip: 'Liste à puces' },
                                    { icon: ListOrdered, cmd: 'insertOrderedList', tip: 'Liste numérotée' },
                                ].map(btn => (
                                    <button
                                        key={btn.cmd}
                                        onClick={() => execCmd(btn.cmd)}
                                        title={btn.tip}
                                        className="p-2 rounded-md text-[#6B7280] hover:text-[#1B2A4A] hover:bg-[#1B2A4A]/5 transition-all"
                                    >
                                        <btn.icon size={15} />
                                    </button>
                                ))}
                                <div className="w-px h-5 bg-[#1B2A4A]/8 mx-1" />
                                <button onClick={() => execCmd('justifyLeft')} title="Aligner à gauche" className="p-2 rounded-md text-[#6B7280] hover:text-[#1B2A4A] hover:bg-[#1B2A4A]/5 transition-all">
                                    <AlignLeft size={15} />
                                </button>
                                <button onClick={() => execCmd('justifyCenter')} title="Centrer" className="p-2 rounded-md text-[#6B7280] hover:text-[#1B2A4A] hover:bg-[#1B2A4A]/5 transition-all">
                                    <AlignCenter size={15} />
                                </button>
                                <div className="w-px h-5 bg-[#1B2A4A]/8 mx-1" />
                                <button onClick={insertLink} title="Insérer un lien" className="p-2 rounded-md text-[#6B7280] hover:text-[#1B2A4A] hover:bg-[#1B2A4A]/5 transition-all">
                                    <Link2 size={15} />
                                </button>
                                <button
                                    onClick={() => { const url = prompt('URL de l\'image :'); if (url) execCmd('insertImage', url) }}
                                    title="Insérer une image par URL"
                                    className="p-2 rounded-md text-[#6B7280] hover:text-[#1B2A4A] hover:bg-[#1B2A4A]/5 transition-all"
                                >
                                    <Image size={15} />
                                </button>
                                <div className="w-px h-5 bg-[#1B2A4A]/8 mx-1" />
                                {/* Joindre fichiers (tous types) */}
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    title="Joindre des fichiers (PDF, Word, Excel, ZIP, images, etc.)"
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold text-[#1B2A4A] bg-[#1B2A4A]/5 hover:bg-[#008751]/10 hover:text-[#008751] transition-all"
                                >
                                    <Paperclip size={13} />
                                    Joindre fichiers
                                </button>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    multiple
                                    onChange={handleFileUpload}
                                    className="hidden"
                                    aria-hidden="true"
                                />
                                {/* Ameliorer avec l'IA */}
                                <button
                                    onClick={handleEnhanceWithAI}
                                    disabled={enhancing}
                                    title="Améliorer le brouillon avec l'IA (Groq)"
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold text-white transition-all disabled:opacity-50"
                                    style={{
                                        background: enhancing
                                            ? '#6B7280'
                                            : 'linear-gradient(135deg, #C9A84C, #B08D3A)',
                                        boxShadow: enhancing ? 'none' : '0 2px 8px rgba(201,168,76,0.30)',
                                    }}
                                >
                                    {enhancing
                                        ? <RefreshCw size={13} className="animate-spin" />
                                        : <Wand2 size={13} />
                                    }
                                    {enhancing ? 'Amélioration...' : 'Améliorer avec IA'}
                                </button>
                                <div className="flex-1" />
                                <span className="text-[10px] text-[#6B7280]/60 font-mono pr-1">
                                    {(editorRef.current?.innerText || '').length} car.
                                </span>
                            </div>
                        </div>

                        {/* ── Zone de rédaction ── */}
                        <div
                            ref={editorRef}
                            contentEditable
                            onInput={syncEditorContent}
                            onBlur={syncEditorContent}
                            data-placeholder="Rédigez votre message ici..."
                            className="min-h-[320px] max-h-[520px] overflow-y-auto px-6 py-5 text-[#1B2A4A] text-sm leading-[1.8] focus:outline-none
                                [&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-[#1B2A4A]/20 [&:empty]:before:pointer-events-none
                                [&_a]:text-[#008751] [&_a]:underline [&_a]:font-medium
                                [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-2
                                [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-2
                                [&_li]:my-1
                                [&_p]:my-2
                                [&_strong]:font-bold
                                [&_em]:italic
                                [&_u]:underline
                                [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-[#1B2A4A] [&_h2]:my-3
                                [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-[#1B2A4A] [&_h3]:my-2
                                [&_img]:max-w-full [&_img]:rounded-lg [&_img]:my-3"
                            style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}
                            suppressContentEditableWarning
                        />

                        {/* ── Signature automatique ── */}
                        <div className="px-6 py-3 border-t border-[#1B2A4A]/5 bg-[#FEFCF9]">
                            <div className="flex items-start gap-3">
                                <div className="w-px h-10 bg-[#008751]/30 mt-1" />
                                <div className="text-[11px] text-[#6B7280] leading-relaxed">
                                    <p className="font-semibold text-[#1B2A4A]">Retour Gagnant Bénin</p>
                                    <p>Haie-Vive Cocotiers, Cotonou, Bénin</p>
                                    <p>+229 01 60 32 21 21 · contact@retourgagnantbenin.bj</p>
                                </div>
                            </div>
                        </div>

                        {/* ── Aperçu live ── */}
                        <AnimatePresence>
                            {showPreview && bodyHtml && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden border-t border-[#1B2A4A]/8"
                                >
                                    <div className="px-6 py-3 bg-[#1B2A4A]/[0.03] border-b border-[#1B2A4A]/6 flex items-center gap-2">
                                        <Eye size={13} className="text-[#1B2A4A]" />
                                        <span className="text-[10px] font-semibold text-[#1B2A4A] uppercase tracking-wider">Aperçu : Tel que reçu par le destinataire</span>
                                    </div>
                                    <div className="p-10 flex justify-center bg-white">
                                        <div className="w-full max-w-[620px] bg-white rounded-[20px] overflow-hidden border border-[#1B2A4A]/6" style={{ boxShadow: '0 20px 60px rgba(27,42,74,0.10), 0 4px 16px rgba(27,42,74,0.05)' }}>
                                            {/* Bande tricolore top */}
                                            <div className="h-[5px]" style={{ background: 'linear-gradient(90deg, #008751 0%, #008751 33%, #FCD116 33%, #FCD116 66%, #E8112D 66%, #E8112D 100%)' }} />
                                            {/* Header blanc : Logo à gauche + RETOUR GAGNANT / BÉNIN à droite */}
                                            <div className="bg-white" style={{ padding: '44px 44px 36px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0 }}>
                                                    {/* Colonne gauche : Logo libre, grand */}
                                                    <div style={{ paddingRight: 26, display: 'flex', alignItems: 'center' }}>
                                                        <img
                                                            src="/assets/logo.png"
                                                            alt="Retour Gagnant Bénin"
                                                            width={120}
                                                            height={120}
                                                            style={{ display: 'block', maxWidth: 120, height: 'auto', border: 0 }}
                                                        />
                                                    </div>
                                                    {/* Séparateur or vertical */}
                                                    {/* Colonne droite : RETOUR GAGNANT + BÉNIN + tagline */}
                                                    <div style={{ borderLeft: '1px solid rgba(201,168,76,0.25)', paddingLeft: 26, textAlign: 'left' }}>
                                                        {/* RETOUR GAGNANT : ligne 1 */}
                                                        <h1
                                                            className="m-0"
                                                            style={{
                                                                margin: 0,
                                                                fontSize: 30, fontWeight: 900, letterSpacing: '2px', lineHeight: 1,
                                                                fontFamily: "'Playfair Display', Georgia, serif",
                                                                whiteSpace: 'nowrap',
                                                            }}
                                                        >
                                                            <span style={{ color: '#008751', textShadow: '0 2px 18px rgba(0,135,81,0.22)' }}>RETOUR</span>
                                                            <span style={{ color: '#E6B800', textShadow: '0 2px 18px rgba(252,209,22,0.32)', marginLeft: 8 }}>GAGNANT</span>
                                                        </h1>
                                                        {/* BÉNIN : ligne 2, aligné sous RETOUR */}
                                                        <div style={{ marginTop: 9 }}>
                                                            <span
                                                                style={{
                                                                    display: 'inline-block',
                                                                    fontSize: 22, fontWeight: 900, letterSpacing: '12px',
                                                                    color: '#E8112D', textShadow: '0 2px 16px rgba(232,17,45,0.28)',
                                                                    fontFamily: "'Playfair Display', Georgia, serif",
                                                                    paddingLeft: 12,
                                                                }}
                                                            >
                                                                BÉNIN
                                                            </span>
                                                        </div>
                                                        {/* Tagline */}
                                                        <p style={{ margin: '10px 0 0', fontSize: 9, color: '#C9A84C', letterSpacing: '3.5px', textTransform: 'uppercase', fontWeight: 700 }}>
                                                            Tradition · Modernité · Excellence
                                                        </p>
                                                    </div>
                                                </div>
                                                {/* Accent or centré sous le bloc */}
                                                <div style={{ margin: '28px auto 0', height: 2, width: 140, background: 'linear-gradient(90deg, transparent, #C9A84C, transparent)' }} />
                                            </div>
                                            {/* Corps */}
                                            <div
                                                className="px-11 pt-6 pb-10 bg-white text-[#1B2A4A] text-[14.5px] leading-[1.8]
                                                    [&_a]:text-[#008751] [&_a]:font-semibold [&_a]:underline
                                                    [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-2
                                                    [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-2
                                                    [&_strong]:font-bold [&_strong]:text-[#1B2A4A]
                                                    [&_p]:my-2"
                                                style={{ fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}
                                                dangerouslySetInnerHTML={{ __html: bodyHtml }}
                                            />
                                            {/* Séparateur ornement */}
                                            <div className="px-11 flex items-center gap-3 bg-white">
                                                <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.3), transparent)' }} />
                                                <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#C9A84C', boxShadow: '0 0 10px rgba(201,168,76,0.5)' }} />
                                                <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.3), transparent)' }} />
                                            </div>
                                            {/* Footer blanc */}
                                            <div className="px-11 pt-7 pb-7 text-center bg-white">
                                                <p className="text-[11.5px] text-[#5A6680] font-semibold">Cet email vous a été envoyé par un conseiller de Retour Gagnant Bénin.</p>
                                                <p className="text-[11.5px] text-[#5A6680] mt-1.5">
                                                    Pour répondre : <a href="mailto:contact@retourgagnantbenin.bj" className="text-[#008751] font-bold" style={{ borderBottom: '1px solid rgba(0,135,81,0.3)' }}>contact@retourgagnantbenin.bj</a>
                                                </p>
                                                <div className="flex justify-center items-center mt-4 mb-3.5">
                                                    <div style={{ width: 28, height: 3, background: '#008751', borderRadius: '2px 0 0 2px' }} />
                                                    <div style={{ width: 28, height: 3, background: '#FCD116' }} />
                                                    <div style={{ width: 28, height: 3, background: '#E8112D', borderRadius: '0 2px 2px 0' }} />
                                                </div>
                                                <p className="text-[10.5px] text-[#6B7589] font-semibold tracking-wide">&copy; {new Date().getFullYear()} Retour Gagnant Bénin : Tradition, Modernité, Excellence</p>
                                            </div>
                                            {/* Bande basse */}
                                            <div className="h-[5px]" style={{ background: 'linear-gradient(90deg, #008751 0%, #008751 33%, #FCD116 33%, #FCD116 66%, #E8112D 66%, #E8112D 100%)' }} />
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* ── Liste des pièces jointes ── */}
                        {attachments.length > 0 && (
                            <div className="px-6 py-3 border-t border-[#1B2A4A]/6 bg-[#FEFCF9]">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider flex items-center gap-1.5">
                                        <Paperclip size={11} />
                                        {attachments.length} pièce{attachments.length > 1 ? 's' : ''} jointe{attachments.length > 1 ? 's' : ''}
                                    </p>
                                    <p className="text-[10px] text-[#6B7280]/60 font-mono">
                                        {formatFileSize(attachments.reduce((acc, a) => acc + a.size, 0))} / {formatFileSize(MAX_ATTACHMENT_TOTAL_BYTES)}
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {attachments.map(a => (
                                        <div
                                            key={a.id}
                                            className="group flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-[#1B2A4A]/10 hover:border-[#008751]/25 transition-all max-w-xs"
                                        >
                                            <div className="w-7 h-7 rounded-md bg-[#008751]/8 flex items-center justify-center flex-shrink-0">
                                                <FileText size={13} className="text-[#008751]" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[11px] font-semibold text-[#1B2A4A] truncate" title={a.filename}>
                                                    {a.filename}
                                                </p>
                                                <p className="text-[9px] text-[#6B7280]">{formatFileSize(a.size)}</p>
                                            </div>
                                            <button
                                                onClick={() => removeAttachment(a.id)}
                                                title="Retirer"
                                                className="p-1 rounded hover:bg-[#E8112D]/8 text-[#6B7280] hover:text-[#E8112D] transition-all"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ── Boutons d'action ── */}
                        <div className="px-6 py-4 border-t border-[#1B2A4A]/6 bg-[#FAFAF7] flex items-center justify-between">
                            <p className="text-[10px] text-[#6B7280]/50">L&apos;email sera envoyé avec le template officiel Retour Gagnant Bénin</p>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={handleClear}
                                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white border border-[#1B2A4A]/10 text-[#6B7280] hover:text-[#E8112D] hover:border-[#E8112D]/20 transition-all text-xs font-semibold"
                                >
                                    <Trash2 size={13} />
                                    Annuler
                                </button>
                                <button
                                    onClick={handleSend}
                                    disabled={sending || !toEmail || !subject}
                                    className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-white font-bold text-sm transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-lg"
                                    style={{
                                        background: sending ? '#6B7280' : 'linear-gradient(135deg, #008751, #006B3F)',
                                        boxShadow: sending ? 'none' : '0 4px 14px rgba(0,135,81,0.25)',
                                    }}
                                >
                                    {sending ? <RefreshCw size={15} className="animate-spin" /> : <Send size={15} />}
                                    {sending ? 'Envoi...' : 'Envoyer'}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* ═══════════════════════════════════ */}
                {/* TAB: SENT EMAILS                   */}
                {/* ═══════════════════════════════════ */}
                {tab === 'sent' && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl border border-[#1B2A4A]/10 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-[#1B2A4A]/8 bg-[#FAFAF7] flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <Inbox size={15} className="text-[#1B2A4A]" />
                                <span className="text-sm font-semibold text-[#1B2A4A]">Emails envoyés</span>
                            </div>
                            <span className="text-[10px] text-[#6B7280] font-semibold bg-[#1B2A4A]/5 px-2.5 py-1 rounded-md">{sentEmails.length}</span>
                        </div>
                        {sentEmails.length === 0 ? (
                            <div className="p-16 text-center">
                                <div className="w-16 h-16 rounded-2xl bg-[#1B2A4A]/5 flex items-center justify-center mx-auto mb-4">
                                    <Send size={24} className="text-[#1B2A4A]/20" />
                                </div>
                                <p className="text-sm text-[#1B2A4A]/60 font-semibold">Aucun email envoyé</p>
                                <p className="text-xs text-[#6B7280]/60 mt-1">Vos emails envoyés apparaîtront ici.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-[#1B2A4A]/5">
                                {sentEmails.map(email => (
                                    <div key={email.id} className="px-6 py-4 hover:bg-[#008751]/[0.015] transition-colors cursor-default">
                                        <div className="flex items-start gap-4">
                                            <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                                email.status === 'sent' ? 'bg-[#008751]/8' : 'bg-[#E8112D]/8'
                                            }`}>
                                                {email.status === 'sent'
                                                    ? <CheckCircle2 size={15} className="text-[#008751]" />
                                                    : <AlertCircle size={15} className="text-[#E8112D]" />
                                                }
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-3">
                                                    <p className="text-sm font-semibold text-[#1B2A4A] truncate">{email.to_email}</p>
                                                    <div className="flex items-center gap-2 flex-shrink-0">
                                                        <span className={`text-[8px] font-bold uppercase px-2 py-0.5 rounded ${
                                                            email.status === 'sent'
                                                                ? 'bg-[#008751]/8 text-[#008751]'
                                                                : 'bg-[#E8112D]/8 text-[#E8112D]'
                                                        }`}>
                                                            {email.status === 'sent' ? 'Envoyé' : 'Erreur'}
                                                        </span>
                                                        <span className="text-[10px] text-[#6B7280]/60 flex items-center gap-1">
                                                            <Clock size={10} />
                                                            {email.created_at && !isNaN(new Date(email.created_at).getTime()) ? new Date(email.created_at).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <p className="text-xs text-[#6B7280] mt-1">{email.subject}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </motion.div>
                )}

                {/* ═══════════════════════════════════ */}
                {/* TAB: TEMPLATES                     */}
                {/* ═══════════════════════════════════ */}
                {tab === 'templates' && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {EMAIL_TEMPLATES.map(tpl => (
                                <div key={tpl.id} className="bg-white rounded-2xl border border-[#1B2A4A]/10 shadow-sm overflow-hidden hover:shadow-md transition-all">
                                    <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${tpl.color}, ${tpl.color}60)` }} />
                                    <div className="p-5 border-b border-[#1B2A4A]/6">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: tpl.color + '10' }}>
                                                    <Star size={16} style={{ color: tpl.color }} />
                                                </div>
                                                <div>
                                                    <h3 className="text-sm font-semibold text-[#1B2A4A]">{tpl.name}</h3>
                                                    <p className="text-[10px] text-[#6B7280] mt-0.5">{tpl.subject}</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => { applyTemplate(tpl); setTab('compose') }}
                                                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-semibold transition-all border"
                                                style={{ color: tpl.color, borderColor: tpl.color + '25', backgroundColor: tpl.color + '08' }}
                                            >
                                                <Edit3 size={12} />
                                                Utiliser
                                            </button>
                                        </div>
                                    </div>
                                    <div className="p-5 relative">
                                        <div className="rounded-lg border border-[#1B2A4A]/5 overflow-hidden">
                                            <div className="h-[3px]" style={{ background: `linear-gradient(90deg, #008751 33%, #FCD116 33%, #FCD116 66%, #E8112D 66%)` }} />
                                            <div
                                                className="p-4 bg-[#FEFCF9] text-[#1B2A4A] text-[10px] leading-relaxed max-h-[130px] overflow-hidden
                                                    [&_ul]:list-disc [&_ul]:pl-4
                                                    [&_ol]:list-decimal [&_ol]:pl-4
                                                    [&_strong]:font-bold
                                                    [&_p]:my-1"
                                                dangerouslySetInnerHTML={{ __html: tpl.body }}
                                            />
                                        </div>
                                        {/* Fade overlay */}
                                        <div className="absolute bottom-5 left-5 right-5 h-10 bg-gradient-to-t from-white to-transparent pointer-events-none rounded-b-lg" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </div>

            {/* ── Footer ── */}
            <div className="text-center py-6 border-t border-[#1B2A4A]/5 bg-white/50 mt-8">
                <p className="text-[9px] text-[#6B7280]/50 uppercase tracking-[0.2em] font-semibold">
                    Retour Gagnant Bénin &middot; Messagerie Agent &middot; {new Date().getFullYear()}
                </p>
            </div>
        </div>
    )
}
