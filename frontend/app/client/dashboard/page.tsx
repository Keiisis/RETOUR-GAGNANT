'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import {
    FileText, FolderOpen, MessageSquare, CalendarDays,
    ArrowRight, CheckCircle2, Clock, AlertCircle,
    CreditCard, Receipt, TrendingUp, Sparkles
, ShoppingBag } from 'lucide-react'

interface Stats {
    devisEnAttente: number
    facturesToPay: number
    dossierActif: boolean
    messagesNonLus: number
    totalDépenses: number
}

interface RecentDoc {
    id: string
    type: string
    numero: string
    total: number
    status: string
    currency: string
    created_at: string
}

const statusLabel: Record<string, { label: string; color: string }> = {
    brouillon: { label: 'Brouillon', color: 'text-gray-400 bg-gray-500/10' },
    envoye: { label: 'En attente', color: 'text-[var(--panel-accent)] bg-[var(--panel-accent-soft)]' },
    accepte: { label: 'Accepté', color: 'text-emerald-400 bg-emerald-500/10' },
    refuse: { label: 'Refusé', color: 'text-red-400 bg-red-500/10' },
    paye: { label: 'Payé', color: 'text-green-400 bg-green-500/10' },
    en_retard: { label: 'En retard', color: 'text-orange-400 bg-orange-500/10' },
    annule: { label: 'Annulé', color: 'text-gray-500 bg-gray-500/10' },
}

const fmtN = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')

// Safe date formatter to avoid RangeError: Invalid time value
const formatDateSafe = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—'
    const d = new Date(dateStr)
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR')
}

export default function ClientDashboardPage() {
    const [stats, setStats] = useState<Stats>({ devisEnAttente: 0, facturesToPay: 0, dossierActif: false, messagesNonLus: 0, totalDépenses: 0 })
    const [commandes, setCommandes] = useState<Array<{ id: string; product_title: string; amount: number; currency: string; created_at: string }>>([])
    const [recentDocs, setRecentDocs] = useState<RecentDoc[]>([])
    const [clientEmail, setClientEmail] = useState('')
    const [clientId, setClientId] = useState('')
    const [clientNom, setClientNom] = useState('')
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const load = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session?.user) return

            const email = session.user.email || ''
            setClientEmail(email)

            // Profil
            const { data: profile } = await supabase
                .from('client_profiles')
                .select('nom, prenom')
                .eq('id', session.user.id)
                .single()
            if (profile) setClientNom([profile.prenom, profile.nom].filter(Boolean).join(' '))

            const uid = session.user.id
            setClientId(uid)

            // Documents récents (affichage uniquement)
            const { data: docs } = await supabase
                .from('documents_financiers')
                .select('id, type, numero, total, status, currency, created_at')
                .or(`client_id.eq.${uid},client_email.eq.${email}`)
                .order('created_at', { ascending: false })
                .limit(5)
            setRecentDocs(docs || [])

            // Stats via requêtes COUNT dédiées (sur la totalité des docs, pas juste les 5 derniers)
            const [
                { count: devisCount },
                { count: facturesCount },
                { data: dossier },
                { data: msgIds },
                { data: paidDocs },
                { data: commandes },
            ] = await Promise.all([
                supabase
                    .from('documents_financiers')
                    .select('id', { count: 'exact', head: true })
                    .or(`client_id.eq.${uid},client_email.eq.${email}`)
                    .eq('type', 'devis')
                    .in('status', ['envoye', 'brouillon']),
                supabase
                    .from('documents_financiers')
                    .select('id', { count: 'exact', head: true })
                    .or(`client_id.eq.${uid},client_email.eq.${email}`)
                    .eq('type', 'facture')
                    .eq('status', 'envoye'),
                supabase
                    .from('dossier_tracking')
                    .select('id, statut')
                    .or(`client_id.eq.${uid},client_email.eq.${email}`)
                    .neq('statut', 'termine')
                    .neq('statut', 'annule')
                    .limit(1),
                // IDs des messages du client pour chercher les réponses agent
                supabase
                    .from('messages')
                    .select('id')
                    .or(`client_id.eq.${uid},email.eq.${email}`),
                // Total dépensé : tous les docs payés
                supabase
                    .from('documents_financiers')
                    .select('total')
                    .or(`client_id.eq.${uid},client_email.eq.${email}`)
                    .eq('status', 'paye'),
                // ── ESPACE CLIENT UNIFIÉ ──────────────────────────────
                // Les achats boutique n'apparaissaient nulle part : un client
                // ayant commandé ne voyait aucune trace de son achat.
                supabase
                    .from('orders')
                    .select('id, product_title, amount, currency, payment_status, created_at')
                    .eq('customer_email', email)
                    .eq('payment_status', 'completed')
                    .order('created_at', { ascending: false }),
            ])

            // Réponses agent non lues = messages dans chat_messages (role=agent) pour ce client
            let agentRepliesCount = 0
            const conversationIds = (msgIds || []).map(m => m.id)
            if (conversationIds.length > 0) {
                const { count } = await supabase
                    .from('chat_messages')
                    .select('id', { count: 'exact', head: true })
                    .in('conversation_id', conversationIds)
                    .eq('role', 'agent')
                agentRepliesCount = count || 0
            }

            const totalDocs = (paidDocs || []).reduce((s: number, d: { total: number }) => s + (d.total || 0), 0)
            // Les commandes boutique comptent dans le total dépensé
            const totalBoutique = (commandes || []).reduce((s: number, o: { amount: number }) => s + (Number(o.amount) || 0), 0)
            const totalPayé = totalDocs + totalBoutique
            setCommandes(commandes || [])

            setStats({
                devisEnAttente: devisCount || 0,
                facturesToPay: facturesCount || 0,
                dossierActif: (dossier?.length || 0) > 0,
                messagesNonLus: agentRepliesCount,
                totalDépenses: totalPayé,
            })
            setLoading(false)
        }
        load()
    }, [])

    // Realtime : mise à jour auto des stats dès qu'un document financier change
    useEffect(() => {
        if (!clientId || !clientEmail) return
        const uid = clientId
        const email = clientEmail

        const refresh = async () => {
            const [
                { count: devisCount },
                { count: facturesCount },
                { data: dossier },
                { data: paidDocs },
                { data: docs },
            ] = await Promise.all([
                supabase.from('documents_financiers').select('id', { count: 'exact', head: true })
                    .or(`client_id.eq.${uid},client_email.eq.${email}`).eq('type', 'devis').in('status', ['envoye', 'brouillon']),
                supabase.from('documents_financiers').select('id', { count: 'exact', head: true })
                    .or(`client_id.eq.${uid},client_email.eq.${email}`).eq('type', 'facture').eq('status', 'envoye'),
                supabase.from('dossier_tracking').select('id, statut')
                    .or(`client_id.eq.${uid},client_email.eq.${email}`).neq('statut', 'termine').neq('statut', 'annule').limit(1),
                supabase.from('documents_financiers').select('total')
                    .or(`client_id.eq.${uid},client_email.eq.${email}`).eq('status', 'paye'),
                supabase.from('documents_financiers').select('id, type, numero, total, status, currency, created_at')
                    .or(`client_id.eq.${uid},client_email.eq.${email}`).order('created_at', { ascending: false }).limit(5),
            ])
            const totalPayé = (paidDocs || []).reduce((s: number, d: { total: number }) => s + (d.total || 0), 0)
            setStats(prev => ({
                ...prev,
                devisEnAttente: devisCount || 0,
                facturesToPay: facturesCount || 0,
                dossierActif: (dossier?.length || 0) > 0,
                totalDépenses: totalPayé,
            }))
            setRecentDocs(docs || [])
        }

        const channel = supabase
            .channel(`client-dashboard-${clientId}`)
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'documents_financiers', filter: `client_id=eq.${uid}` },
                () => refresh()
            )
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clientId, clientEmail])

    // La couleur ENCODE un état, elle ne décore pas : une carte n'est colorée
    // que si elle attend une action du client. Sinon elle reste neutre. Avant,
    // chaque carte avait un dégradé différent (emerald / or / teal / indigo) —
    // quatre accents sans signification, d'où l'impression de désordre.
    const cards = [
        { title: 'Devis en attente', value: stats.devisEnAttente, icon: FileText, tone: 'action' as const, href: '/client/documents', desc: 'À signer' },
        { title: 'Factures à payer', value: stats.facturesToPay, icon: Receipt, tone: 'money' as const, href: '/client/documents', desc: 'En attente de paiement' },
        { title: 'Dossier actif', value: stats.dossierActif ? 'Actif' : '—', icon: FolderOpen, tone: 'neutral' as const, href: '/client/dossier', desc: 'Suivi en cours' },
        { title: 'Réponses reçues', value: stats.messagesNonLus, icon: MessageSquare, tone: 'action' as const, href: '/client/messages', desc: 'De votre agent' },
    ]

    // Actions rapides : même poids, donc même accent. Quatre couleurs pour
    // quatre liens équivalents, c'est du bruit visuel.
    const quickActions = [
        { label: 'Mes documents', icon: FileText, href: '/client/documents' },
        { label: 'Mon dossier', icon: FolderOpen, href: '/client/dossier' },
        { label: 'Envoyer message', icon: MessageSquare, href: '/client/messages' },
        { label: 'Prendre RDV', icon: CalendarDays, href: '/client/rendez-vous' },
    ]

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Welcome */}
            <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Sparkles size={14} className="text-[#C9A84C]" />
                        <span className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-[0.3em]">Mon Espace Client</span>
                    </div>
                    <h1 className="text-2xl font-black text-white">
                        Bonjour, <span className="text-emerald-400">{clientNom || clientEmail.split('@')[0]}</span>
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">Voici un résumé de votre compte.</p>
                </div>
                {stats.totalDépenses > 0 && (
                    <div className="hidden md:flex items-center gap-2 bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3">
                        <TrendingUp size={16} className="text-green-400" />
                        <div>
                            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Total réglé</p>
                            <p className="text-white font-black text-sm font-mono">{fmtN(stats.totalDépenses)} XOF</p>
                        </div>
                    </div>
                )}
            </motion.div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {cards.map((card, i) => {
                    const Icon = card.icon
                    const numVal = typeof card.value === 'number' ? card.value : null
                    const hasAlert = numVal !== null && numVal > 0
                    // Accent porté par l'état : vert = à traiter, ambre = à régler.
                    const accent = !hasAlert
                        ? { fg: 'var(--panel-icon-muted)', bg: 'var(--panel-badge-bg)', ring: 'var(--panel-border)' }
                        : card.tone === 'money'
                            ? { fg: '#B08A18', bg: 'rgba(176,138,24,0.12)', ring: 'rgba(176,138,24,0.45)' }
                            : { fg: 'var(--panel-accent)', bg: 'var(--panel-accent-soft)', ring: 'var(--panel-accent)' }
                    return (
                        <motion.div key={card.title} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, duration: 0.35 }}>
                            <Link
                                href={card.href}
                                className="block rounded-xl p-5 border transition-all duration-200 hover:-translate-y-0.5 group"
                                style={{
                                    background: 'var(--panel-surface)',
                                    borderColor: hasAlert ? accent.ring : 'var(--panel-border)',
                                }}
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                                        style={{ background: accent.bg }}>
                                        <Icon size={18} strokeWidth={1.75} style={{ color: accent.fg }} />
                                    </div>
                                    {hasAlert && <span className="w-2 h-2 rounded-full" style={{ background: accent.fg }} />}
                                </div>
                                <p className="text-2xl font-black tabular-nums" style={{ color: 'var(--panel-text-heading)' }}>{card.value}</p>
                                <p className="text-[11px] font-semibold mt-1" style={{ color: 'var(--panel-text)' }}>{card.title}</p>
                                <p className="text-[10px] mt-0.5" style={{ color: 'var(--panel-text-muted)' }}>{card.desc}</p>
                            </Link>
                        </motion.div>
                    )
                })}
            </div>

            {/* ── Mes achats boutique (espace client unifié) ── */}
            {commandes.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="mb-6">
                    <div className="bg-[#0a1221] border border-white/[0.06] rounded-xl overflow-hidden">
                        <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
                            <h2 className="font-black text-white text-sm flex items-center gap-2">
                                <ShoppingBag size={16} className="text-amber-400" /> Mes achats boutique
                            </h2>
                            <span className="text-[11px] text-gray-500">{commandes.length} commande{commandes.length > 1 ? 's' : ''}</span>
                        </div>
                        <div className="divide-y divide-white/[0.04]">
                            {commandes.slice(0, 5).map(c => (
                                <div key={c.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                                    <div className="min-w-0">
                                        <p className="text-[13px] text-white font-medium truncate">{c.product_title || 'Commande'}</p>
                                        <p className="text-[11px] text-gray-500 font-mono">
                                            {new Date(c.created_at).toLocaleDateString('fr-FR')} · {c.id.slice(0, 8).toUpperCase()}
                                        </p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-[13px] font-mono font-bold text-white">
                                            {Number(c.amount || 0).toLocaleString('fr-FR')} {c.currency === 'XOF' ? 'FCFA' : c.currency}
                                        </p>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">Payée</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </motion.div>
            )}

            <div className="grid lg:grid-cols-3 gap-6">
                {/* Recent Documents */}
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="lg:col-span-2">
                    <div className="bg-[#0a1221] border border-white/[0.06] rounded-xl overflow-hidden">
                        <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
                            <h2 className="font-black text-white text-sm flex items-center gap-2">
                                <FileText size={16} className="text-emerald-400" /> Documents récents
                            </h2>
                            <Link href="/client/documents" className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors">
                                Tout voir <ArrowRight size={12} />
                            </Link>
                        </div>
                        {recentDocs.length === 0 ? (
                            <div className="p-10 text-center">
                                <FileText size={28} className="text-gray-700 mx-auto mb-2" />
                                <p className="text-gray-500 text-sm">Aucun document pour le moment.</p>
                                <p className="text-gray-600 text-xs mt-1">Vos devis et factures apparaîtront ici.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-white/[0.04]">
                                {recentDocs.map(doc => {
                                    const s = statusLabel[doc.status] || { label: doc.status, color: 'text-gray-400 bg-gray-500/10' }
                                    return (
                                        <Link key={doc.id} href={`/client/documents/${doc.id}`}
                                            className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.02] transition-colors group">
                                            <div className={`p-2 rounded-lg ${doc.type === 'devis' ? 'bg-[var(--panel-accent-soft)] text-[var(--panel-accent)]' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                                {doc.type === 'devis' ? <FileText size={14} /> : <Receipt size={14} />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-white">{doc.numero}</p>
                                                <p className="text-[11px] text-gray-500">{formatDateSafe(doc.created_at)}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-mono font-bold text-white">{fmtN(doc.total)} {doc.currency || 'XOF'}</p>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.color}`}>{s.label}</span>
                                            </div>
                                            <ArrowRight size={14} className="text-gray-600 group-hover:text-emerald-400 transition-colors" />
                                        </Link>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* Quick Actions + Alerts */}
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="space-y-4">
                    {/* Alerts */}
                    {(stats.devisEnAttente > 0 || stats.facturesToPay > 0) && (
                        <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-4 space-y-2">
                            <p className="text-xs font-black text-amber-400 flex items-center gap-1.5 mb-3">
                                <AlertCircle size={13} /> Actions requises
                            </p>
                            {stats.devisEnAttente > 0 && (
                                <Link href="/client/documents" className="flex items-center justify-between p-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors">
                                    <div className="flex items-center gap-2">
                                        <Clock size={12} className="text-amber-400" />
                                        <span className="text-[12px] text-white">{stats.devisEnAttente} devis à signer</span>
                                    </div>
                                    <ArrowRight size={12} className="text-amber-400" />
                                </Link>
                            )}
                            {stats.facturesToPay > 0 && (
                                <Link href="/client/documents" className="flex items-center justify-between p-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors">
                                    <div className="flex items-center gap-2">
                                        <CreditCard size={12} className="text-amber-400" />
                                        <span className="text-[12px] text-white">{stats.facturesToPay} facture(s) à payer</span>
                                    </div>
                                    <ArrowRight size={12} className="text-amber-400" />
                                </Link>
                            )}
                        </div>
                    )}

                    {/* Quick Actions */}
                    <div className="bg-[#0a1221] border border-white/[0.06] rounded-xl p-4">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mb-3">Actions rapides</p>
                        <div className="space-y-1.5">
                            {quickActions.map(action => {
                                const Icon = action.icon
                                return (
                                    <Link key={action.href} href={action.href}
                                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all duration-200 hover:translate-x-0.5 group/qa"
                                        style={{ background: 'var(--panel-surface-alt)', borderColor: 'var(--panel-border)' }}>
                                        <Icon size={15} strokeWidth={1.75} style={{ color: 'var(--panel-accent)' }} />
                                        <span className="text-[13px] font-medium" style={{ color: 'var(--panel-text)' }}>{action.label}</span>
                                        <ArrowRight size={12} className="ml-auto transition-transform group-hover/qa:translate-x-0.5" style={{ color: 'var(--panel-text-muted)' }} />
                                    </Link>
                                )
                            })}
                        </div>
                    </div>

                    {/* Dossier status */}
                    <div className="bg-[#0a1221] border border-white/[0.06] rounded-xl p-4">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mb-3">Mon dossier</p>
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stats.dossierActif ? 'bg-[var(--panel-accent-soft)]' : 'bg-gray-500/10'}`}>
                                {stats.dossierActif ? <CheckCircle2 size={20} className="text-[var(--panel-accent)]" /> : <FolderOpen size={20} className="text-gray-500" />}
                            </div>
                            <div>
                                <p className="text-sm font-bold text-white">{stats.dossierActif ? 'Dossier en cours' : 'Aucun dossier actif'}</p>
                                <Link href="/client/dossier" className="text-[11px] text-[var(--panel-accent)] hover:text-[var(--panel-accent)] flex items-center gap-1 transition-colors mt-0.5">
                                    Voir le suivi <ArrowRight size={10} />
                                </Link>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    )
}
