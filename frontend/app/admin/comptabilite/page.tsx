'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Wallet, TrendingDown, ArrowUpRight, ArrowDownRight, Download,
    BarChart3, FileText, RefreshCw, Users, ShoppingBag,
    AlertTriangle, Award, Search, Target, Activity, Star,
    Calculator, Landmark, Receipt, ChevronLeft, ChevronRight,
    Zap, PieChart, CheckCircle2, Clock, TrendingUp, X,
    Shield, Mail, Phone, MapPin, Hash, Package,
    EyeOff, Eye, ExternalLink, Banknote, CreditCard, Bell
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { exportToExcelMultiSheet } from '@/lib/exportExcel'
import { toXOF, loadExchangeRates } from '@/lib/currency-convert'
import ComptaLockPanel, { type ClotureRow } from '@/components/comptabilite/ComptaLockPanel'
import {
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area, BarChart, Bar, Cell,
} from 'recharts'

// ─── Types ──────────────────────────────────────────────────────────
type Period = string
const MONTH_REGEX = /^\d{4}-\d{2}$/
const isMonth = (p: Period) => MONTH_REGEX.test(p)
function currentMonthKey(): string {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function shiftMonth(key: string, delta: number): string {
    const [y, m] = key.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function monthLabel(key: string): string {
    const [y, m] = key.split('-').map(Number)
    const s = new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    return s.charAt(0).toUpperCase() + s.slice(1)
}
function periodLabel(period: Period): string {
    if (period === 'tous') return 'Global (toutes périodes)'
    if (period === '3_mois') return '3 derniers mois'
    if (period === '6_mois') return '6 derniers mois'
    if (period === 'annee')  return 'Année en cours'
    if (isMonth(period)) return monthLabel(period)
    return period
}
function periodSlug(period: Period): string {
    if (period === 'tous') return 'Global'
    if (isMonth(period)) return period
    return period
}
function last12Months(): string[] {
    const out: string[] = []
    const d = new Date()
    for (let i = 0; i < 12; i++) {
        const ref = new Date(d.getFullYear(), d.getMonth() - i, 1)
        out.push(`${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}`)
    }
    return out
}

interface AgentRow {
    id: string
    full_name: string
    email: string
    role: string
    is_active: boolean
}

interface DevisItem {
    description: string
    quantity: number
    unit_price: number
    tva: number
}

interface DocRow {
    id: string
    type: 'devis' | 'facture'
    numero: string
    client_nom: string
    client_prenom?: string
    client_email?: string
    client_phone?: string
    client_adresse?: string
    items?: DevisItem[]
    sous_total?: number
    total_tva?: number
    remise?: number
    notes?: string
    conditions?: string
    total: number
    status: string
    created_at: string
    agent_id: string
    currency?: string
    signature_url?: string
    signed_at?: string
}

interface OrderRow {
    id: string
    customer_name: string
    customer_email?: string
    product_title: string
    amount: number
    currency: string
    payment_status: string
    payment_method?: string
    created_at: string
}

interface DepRow {
    id: string
    titre: string
    categorie: string
    montant: number
    date_depense: string
    agent_id: string
    notes?: string
}

// ─── Helpers période ────────────────────────────────────────────────
function getPeriodRange(p: Period): { start: Date; end: Date } {
    const now = new Date()
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
    if (isMonth(p)) {
        const [y, m] = p.split('-').map(Number)
        return { start: new Date(y, m - 1, 1), end: new Date(y, m, 0, 23, 59, 59, 999) }
    }
    switch (p) {
        case '3_mois':  return { start: new Date(now.getTime() - 90  * 864e5), end }
        case '6_mois':  return { start: new Date(now.getTime() - 180 * 864e5), end }
        case 'annee':   return { start: new Date(now.getFullYear(), 0, 1), end }
        default:        return { start: new Date(0), end }
    }
}

function getPrevPeriodRange(p: Period): { start: Date; end: Date } {
    const now = new Date()
    if (isMonth(p)) {
        const [y, m] = p.split('-').map(Number)
        return { start: new Date(y, m - 2, 1), end: new Date(y, m - 1, 0, 23, 59, 59, 999) }
    }
    if (p === '3_mois')  return { start: new Date(now.getTime() - 180 * 864e5), end: new Date(now.getTime() - 90  * 864e5) }
    if (p === '6_mois')  return { start: new Date(now.getTime() - 360 * 864e5), end: new Date(now.getTime() - 180 * 864e5) }
    if (p === 'annee')   return { start: new Date(now.getFullYear() - 1, 0, 1), end: new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59) }
    return { start: new Date(0), end: new Date(0) }
}

const inRange = (dateStr: string, s: Date, e: Date) => { const d = new Date(dateStr); return d >= s && d <= e }

function calcTrend(curr: number, prev: number) {
    if (prev === 0) return curr > 0 ? '+100' : '0'
    return ((curr - prev) / prev * 100 >= 0 ? '+' : '') + ((curr - prev) / prev * 100).toFixed(1)
}

const VALID_CURRENCIES = ['XOF', 'XAF', 'EUR', 'USD', 'GBP', 'HTG']
const fmt = (val: number, currency = 'XOF') => {
    const cur = VALID_CURRENCIES.includes(currency) ? currency : 'XOF'
    return new Intl.NumberFormat('fr-BJ', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(val)
}

const fmtDate = (str: string | null | undefined) => {
    if (!str) return '—'
    const d = new Date(str)
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' })
}

const formatShortDate = (str: string | null | undefined) => {
    if (!str) return '—'
    const d = new Date(str)
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

// ─── Status maps ────────────────────────────────────────────────────
const DOC_STATUS: Record<string, { label: string; cls: string }> = {
    brouillon:  { label: 'Brouillon',  cls: 'bg-gray-500/20 text-gray-400' },
    envoye:     { label: 'Envoyé',     cls: 'bg-blue-500/20 text-blue-300' },
    accepte:    { label: 'Accepté',    cls: 'bg-yellow-500/20 text-yellow-300' },
    paye:       { label: 'Payé',       cls: 'bg-[#008751]/20 text-[#00c870]' },
    refuse:     { label: 'Refusé',     cls: 'bg-red-500/20 text-red-400' },
    annule:     { label: 'Annulé',     cls: 'bg-red-900/20 text-red-600' },
    en_retard:  { label: 'En retard',  cls: 'bg-orange-500/20 text-orange-400' },
}

const ORDER_STATUS: Record<string, { label: string; cls: string }> = {
    pending:   { label: 'En attente', cls: 'bg-yellow-500/20 text-yellow-300' },
    completed: { label: 'Payé',       cls: 'bg-[#008751]/20 text-[#00c870]' },
    failed:    { label: 'Échoué',     cls: 'bg-red-500/20 text-red-400' },
    cancelled: { label: 'Annulé',     cls: 'bg-gray-500/20 text-gray-400' },
    refunded:  { label: 'Remboursé',  cls: 'bg-purple-500/20 text-purple-300' },
    shipped:   { label: 'Expédié',    cls: 'bg-blue-500/20 text-blue-300' },
    delivered: { label: 'Livré',      cls: 'bg-teal-500/20 text-teal-300' },
}

const DEP_COLORS = ['#008751', '#FCD116', '#3b82f6', '#8b5cf6', '#f97316', '#E8112D', '#0891b2', '#d97706']

// ─── KPI Card ───────────────────────────────────────────────────────
type LucideIcon = React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>

function KpiCard({ icon: Icon, label, value, trend, color, sub, highlight }: {
    icon: LucideIcon; label: string; value: string; trend?: string | null; color: string; sub?: string; highlight?: boolean
}) {
    const trendNum = trend ? parseFloat(trend) : null
    return (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className={cn('border rounded-2xl p-5 flex flex-col gap-3 transition-colors',
                highlight ? 'bg-[#008751]/10 border-[#008751]/20 hover:border-[#008751]/40' : 'bg-[#0a0f18] border-white/5 hover:border-white/10')}>
            <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${color}22` }}>
                    <Icon size={16} style={{ color }} />
                </div>
                {trendNum !== null && (
                    <span className={cn('text-[10px] font-black flex items-center gap-0.5 px-2 py-0.5 rounded-full',
                        trendNum >= 0 ? 'text-[#00c870] bg-[#008751]/10' : 'text-red-400 bg-red-500/10')}>
                        {trendNum >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                        {Math.abs(trendNum).toFixed(1)}%
                    </span>
                )}
            </div>
            <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">{label}</p>
                <p className="text-xl font-black text-white font-mono leading-tight">{value}</p>
                {sub && <p className="text-[10px] text-gray-600 mt-0.5">{sub}</p>}
            </div>
        </motion.div>
    )
}

// ─── Modal Détail Facture ────────────────────────────────────────────
function DocDetailModal({ doc, agent, onClose }: { doc: DocRow; agent?: AgentRow; onClose: () => void }) {
    const items = Array.isArray(doc.items) ? doc.items : []
    const remise = Number(doc.remise) || 0
    const sous_total = Number(doc.sous_total) || (doc.total - (Number(doc.total_tva) || 0))
    const total_tva = Number(doc.total_tva) || 0
    const signed = !!doc.signed_at

    return (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="bg-[#0d1421] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-start justify-between p-5 border-b border-white/5">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className={cn('text-[9px] font-black px-2 py-0.5 rounded-full uppercase', doc.type === 'facture' ? 'bg-[#008751]/20 text-[#00c870]' : 'bg-blue-500/20 text-blue-300')}>{doc.type}</span>
                            {signed && <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 flex items-center gap-1"><Shield size={9} /> Signé</span>}
                        </div>
                        <h3 className="text-lg font-black text-white font-mono">{doc.numero}</h3>
                        <p className="text-[10px] text-gray-500 mt-0.5">{fmtDate(doc.created_at)}{doc.signed_at && ` · Signé le ${fmtDate(doc.signed_at)}`}</p>
                    </div>
                    <button type="button" onClick={onClose} title="Fermer" className="w-8 h-8 rounded-lg bg-white/5 text-gray-400 hover:text-white flex items-center justify-center transition-colors">
                        <X size={14} />
                    </button>
                </div>

                <div className="p-5 space-y-5">
                    {/* Client + Agent */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white/[0.03] rounded-xl p-4 space-y-2">
                            <p className="text-[9px] font-black text-gray-500 uppercase tracking-wider mb-2">Client</p>
                            <p className="text-sm font-bold text-white">{doc.client_nom} {doc.client_prenom || ''}</p>
                            {doc.client_email  && <p className="flex items-center gap-1.5 text-[10px] text-gray-400"><Mail size={10} />{doc.client_email}</p>}
                            {doc.client_phone  && <p className="flex items-center gap-1.5 text-[10px] text-gray-400"><Phone size={10} />{doc.client_phone}</p>}
                            {doc.client_adresse && <p className="flex items-center gap-1.5 text-[10px] text-gray-400"><MapPin size={10} />{doc.client_adresse}</p>}
                        </div>
                        <div className="bg-white/[0.03] rounded-xl p-4 space-y-2">
                            <p className="text-[9px] font-black text-gray-500 uppercase tracking-wider mb-2">Agent responsable</p>
                            {agent ? (
                                <>
                                    <p className="text-sm font-bold text-white">{agent.full_name || '—'}</p>
                                    <p className="text-[10px] text-gray-400">{agent.email}</p>
                                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#008751]/20 text-[#00c870]">{agent.role}</span>
                                </>
                            ) : <p className="text-[10px] text-gray-500">Agent non trouvé</p>}
                        </div>
                    </div>

                    {/* Articles */}
                    {items.length > 0 && (
                        <div>
                            <p className="text-[9px] font-black text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Package size={10} /> Articles ({items.length})</p>
                            <div className="bg-white/[0.03] rounded-xl overflow-hidden">
                                <table className="w-full text-[10px]">
                                    <thead><tr className="border-b border-white/5 text-gray-500 font-black uppercase">
                                        <th className="p-3 text-left">Description</th>
                                        <th className="p-3 text-right w-12">Qté</th>
                                        <th className="p-3 text-right w-24">P.U.</th>
                                        <th className="p-3 text-right w-12">TVA%</th>
                                        <th className="p-3 text-right w-24">Total</th>
                                    </tr></thead>
                                    <tbody>{items.map((it, i) => (
                                        <tr key={i} className="border-b border-white/[0.03]">
                                            <td className="p-3 text-white">{it.description}</td>
                                            <td className="p-3 text-right text-gray-400 font-mono">{it.quantity}</td>
                                            <td className="p-3 text-right text-gray-400 font-mono">{fmt(it.unit_price)}</td>
                                            <td className="p-3 text-right text-gray-500">{it.tva}%</td>
                                            <td className="p-3 text-right text-white font-mono font-bold">{fmt(it.quantity * it.unit_price)}</td>
                                        </tr>
                                    ))}</tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Totaux HT / TVA / Remise / TTC */}
                    <div className="bg-white/[0.03] rounded-xl p-4 space-y-2">
                        <p className="text-[9px] font-black text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5"><Hash size={10} /> Récapitulatif financier</p>
                        <div className="space-y-1.5 text-[11px]">
                            <div className="flex justify-between"><span className="text-gray-400">Sous-total HT</span><span className="font-mono text-white">{fmt(sous_total, doc.currency)}</span></div>
                            {total_tva > 0 && <div className="flex justify-between"><span className="text-gray-400">TVA</span><span className="font-mono text-yellow-300">{fmt(total_tva, doc.currency)}</span></div>}
                            {remise > 0 && <div className="flex justify-between"><span className="text-gray-400">Remise</span><span className="font-mono text-orange-400">− {fmt(remise, doc.currency)}</span></div>}
                            <div className="border-t border-white/10 pt-2 flex justify-between">
                                <span className="font-black text-white">Total TTC</span>
                                <span className="font-black font-mono text-lg" style={{ color: doc.status === 'paye' ? '#00c870' : '#FCD116' }}>{fmt(doc.total, doc.currency)}</span>
                            </div>
                        </div>
                        {total_tva > 0 && (
                            <p className="text-[9px] text-gray-600 mt-2">
                                TVA collectée : {fmt(total_tva, doc.currency)} — Taux effectif : {sous_total > 0 ? ((total_tva / sous_total) * 100).toFixed(1) : 0}%
                            </p>
                        )}
                    </div>

                    {/* Statut + Signature */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className={cn('text-[10px] font-black px-3 py-1.5 rounded-lg', DOC_STATUS[doc.status]?.cls || 'bg-gray-500/20 text-gray-400')}>
                                {DOC_STATUS[doc.status]?.label || doc.status}
                            </span>
                            {signed && (
                                <span className="text-[10px] text-purple-300 flex items-center gap-1"><Shield size={11} /> Signé le {fmtDate(doc.signed_at!)}</span>
                            )}
                        </div>
                        {doc.signature_url && (
                            <a href={doc.signature_url} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 transition-colors">
                                <ExternalLink size={11} /> Voir signature
                            </a>
                        )}
                    </div>

                    {doc.notes && (
                        <div className="bg-white/[0.03] rounded-xl p-4">
                            <p className="text-[9px] font-black text-gray-500 uppercase tracking-wider mb-2">Notes</p>
                            <p className="text-[11px] text-gray-400">{doc.notes}</p>
                        </div>
                    )}
                    {doc.conditions && (
                        <div className="bg-white/[0.03] rounded-xl p-4">
                            <p className="text-[9px] font-black text-gray-500 uppercase tracking-wider mb-2">Conditions de paiement</p>
                            <p className="text-[11px] text-gray-400">{doc.conditions}</p>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    )
}

// ─── Main ────────────────────────────────────────────────────────────
export default function AdminComptabilitePage() {
    const [period, setPeriod]       = useState<Period>(() => currentMonthKey())
    const [loading, setLoading]     = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [exporting, setExporting] = useState(false)
    const [fecExporting, setFecExporting] = useState(false)

    const [agents, setAgents]       = useState<AgentRow[]>([])
    const [docs, setDocs]           = useState<DocRow[]>([])
    const [orders, setOrders]       = useState<OrderRow[]>([])
    const [depenses, setDepenses]   = useState<DepRow[]>([])
    const [commissionRate, setCommissionRate] = useState(0.10)
    const [clotures, setClotures]   = useState<ClotureRow[]>([])

    const [journalTab, setJournalTab]   = useState<'docs' | 'boutique' | 'depenses'>('docs')
    const [searchQ, setSearchQ]         = useState('')
    const [sortAgent, setSortAgent]     = useState<'encaisse' | 'commission' | 'docs'>('encaisse')
    const [journalPage, setJournalPage] = useState(1)
    const [agentFilter, setAgentFilter] = useState('tous')
    const [showAllAgents, setShowAllAgents] = useState(false)
    const [detailDoc, setDetailDoc]     = useState<DocRow | null>(null)
    const [alertFilter, setAlertFilter] = useState<string | null>(null)
    // Paiements manuels (virement/espèces) — map pour UI + tableau complet pour exports
    const [paiements, setPaiements] = useState<Record<string, number>>({})
    const [paiementsList, setPaiementsList] = useState<Array<{ id: string; document_id: string; type: string; montant: number; date_paiement: string; reference?: string | null; notes?: string | null; agent_id?: string }>>([])
    const [showPaymentModal, setShowPaymentModal] = useState(false)
    const [paymentDoc, setPaymentDoc] = useState<DocRow | null>(null)
    const [newPayment, setNewPayment] = useState({ type: 'virement', montant: '', reference: '', notes: '', date: new Date().toISOString().split('T')[0] })
    const [savingPayment, setSavingPayment] = useState(false)
    const ITEMS = 15

    // ── Fetch ─────────────────────────────────────────────────────
    const fetchAll = useCallback(async () => {
        setRefreshing(true)
        // Taux de change réels (table currencies) AVANT calcul des KPI normalisés XOF
        const [, usersRes, erpRes] = await Promise.all([
            loadExchangeRates(),
            fetch('/api/admin/users').then(r => r.ok ? r.json() : { users: [] }),
            fetch('/api/admin/comptabilite').then(r => r.ok ? r.json() : { docs: [], orders: [], depenses: [], commissionRate: 0.10 }),
        ])
        const allUsers: AgentRow[] = (usersRes.users || []).filter((u: AgentRow) =>
            ['agent', 'admin', 'superadmin', 'super_admin'].includes((u.role || '').toLowerCase())
        )
        setAgents(allUsers)
        setDocs(erpRes.docs || [])
        setOrders(erpRes.orders || [])
        setDepenses(erpRes.depenses || [])
        if (typeof erpRes.commissionRate === 'number' && !isNaN(erpRes.commissionRate)) {
            setCommissionRate(erpRes.commissionRate)
        }
        if (erpRes.paiements) {
            const list = erpRes.paiements as Array<{ id: string; document_id: string; type: string; montant: number; date_paiement: string; reference?: string | null; notes?: string | null; agent_id?: string }>
            setPaiementsList(list)
            const map: Record<string, number> = {}
            list.forEach(p => {
                map[p.document_id] = (map[p.document_id] || 0) + Number(p.montant)
            })
            setPaiements(map)
        }
        setClotures(erpRes.clotures || [])
        setLoading(false)
        setRefreshing(false)
    }, [])

    useEffect(() => { fetchAll() }, [fetchAll])

    // ── Period ────────────────────────────────────────────────────
    const { start, end } = useMemo(() => getPeriodRange(period), [period])
    const { start: pS, end: pE } = useMemo(() => getPrevPeriodRange(period), [period])

    const pDocs    = useMemo(() => docs.filter(d => inRange(d.created_at, start, end)), [docs, start, end])
    const pOrders  = useMemo(() => orders.filter(o => inRange(o.created_at, start, end)), [orders, start, end])
    const pDeps    = useMemo(() => depenses.filter(d => inRange(d.date_depense, start, end)), [depenses, start, end])
    const pPaiements = useMemo(() => paiementsList.filter(p => inRange(p.date_paiement, start, end)), [paiementsList, start, end])
    const pvDocs   = useMemo(() => docs.filter(d => inRange(d.created_at, pS, pE)), [docs, pS, pE])
    const pvOrders = useMemo(() => orders.filter(o => inRange(o.created_at, pS, pE)), [orders, pS, pE])
    const pvDeps   = useMemo(() => depenses.filter(d => inRange(d.date_depense, pS, pE)), [depenses, pS, pE])

    // ── KPIs globaux ──────────────────────────────────────────────
    const kpis = useMemo(() => {
        const calc = (dList: DocRow[], oList: OrderRow[], deps: DepRow[]) => {
            const invoices = dList.filter(d => d.type === 'facture')
            // Tous les agrégats sont normalisés en XOF (devise de référence).
            // Sans ça, une facture en EUR (ex. recherche-ancestrale 250 €) était
            // additionnée brute au XOF → KPI faux. cf. lib/currency-convert.ts
            // Commission calculée sur le montant NET (total - remise)
            const payees = invoices.filter(d => d.status === 'paye')
            const encaisseFactu = payees.reduce((a, d) => a + toXOF(d.total - (Number(d.remise) || 0), d.currency), 0)
            const enAttente     = invoices.filter(d => ['envoye', 'accepte'].includes(d.status)).reduce((a, d) => a + toXOF(d.total, d.currency), 0)
            const boutique      = oList.filter(o => o.payment_status === 'completed').reduce((a, o) => a + toXOF(o.amount, o.currency), 0)
            const totalEncaisse = encaisseFactu + boutique
            const commission    = Math.round(encaisseFactu * commissionRate)
            const totalDeps     = deps.reduce((a, d) => a + Number(d.montant), 0)  // dépenses déjà en XOF
            const caEmis        = invoices.reduce((a, d) => a + toXOF(d.total, d.currency), 0)
            const totalTVA      = invoices.reduce((a, d) => a + toXOF(Number(d.total_tva) || 0, d.currency), 0)
            const jours         = Math.max(1, (end.getTime() - start.getTime()) / 864e5)
            const nbFactPaye    = payees.length
            const nbFactTotal   = invoices.length
            return { encaisseFactu, boutique, totalEncaisse, enAttente, commission, totalDeps, caEmis, totalTVA,
                     benefice: totalEncaisse - commission - totalDeps,
                     proj30: (totalEncaisse / jours) * 30, nbFactPaye, nbFactTotal }
        }
        const curr = calc(pDocs, pOrders, pDeps)
        const prev = calc(pvDocs, pvOrders, pvDeps)
        return {
            ...curr,
            trends: period === 'tous' ? null : {
                encaisse:  calcTrend(curr.totalEncaisse, prev.totalEncaisse),
                boutique:  calcTrend(curr.boutique,      prev.boutique),
                benefice:  calcTrend(curr.benefice,      prev.benefice),
                enAttente: calcTrend(curr.enAttente,     prev.enAttente),
                tva:       calcTrend(curr.totalTVA,      prev.totalTVA),
            }
        }
    }, [pDocs, pOrders, pDeps, pvDocs, pvOrders, pvDeps, commissionRate, period, start, end])

    // ── Balance âgée des créances (aged receivables) — toutes périodes ─
    // Feature ERP type-Odoo : qui doit combien, et depuis combien de temps.
    // Montants normalisés XOF. Buckets : 0-30 / 31-60 / 61-90 / 90+ jours.
    const agedBalance = useMemo(() => {
        const CLOSED = ['paye', 'paid', 'completed', 'annule', 'refuse', 'brouillon']
        const now = Date.now()
        type Bk = 'b0' | 'b30' | 'b60' | 'b90'
        const buckets = { b0: 0, b30: 0, b60: 0, b90: 0, total: 0 }
        const byClient = new Map<string, { client: string; b0: number; b30: number; b60: number; b90: number; total: number; oldest: number }>()
        docs.filter(d => d.type === 'facture' && !CLOSED.includes((d.status || '').toLowerCase())).forEach(d => {
            const gross = toXOF(d.total - (Number(d.remise) || 0), d.currency)
            const due = Math.max(0, gross - (paiements[d.id] || 0))
            if (due <= 0) return
            const ageDays = Math.floor((now - new Date(d.created_at).getTime()) / 864e5)
            const bk: Bk = ageDays <= 30 ? 'b0' : ageDays <= 60 ? 'b30' : ageDays <= 90 ? 'b60' : 'b90'
            buckets[bk] += due; buckets.total += due
            const key = `${d.client_nom || ''} ${d.client_prenom || ''}`.trim() || '—'
            const row = byClient.get(key) || { client: key, b0: 0, b30: 0, b60: 0, b90: 0, total: 0, oldest: 0 }
            row[bk] += due; row.total += due; row.oldest = Math.max(row.oldest, ageDays)
            byClient.set(key, row)
        })
        return { buckets, rows: Array.from(byClient.values()).sort((a, b) => b.total - a.total) }
    }, [docs, paiements])

    // ── Score santé financière ────────────────────────────────────
    const scoreSante = useMemo(() => {
        const tauxEncaissement = kpis.caEmis > 0 ? (kpis.encaisseFactu / kpis.caEmis) * 100 : 0
        const tauxRentabilite  = kpis.totalEncaisse > 0 ? Math.max(0, (kpis.benefice / kpis.totalEncaisse)) * 100 : 0
        const nbOrders = pOrders.length
        const tauxConvOrders   = nbOrders > 0 ? (pOrders.filter(o => o.payment_status === 'completed').length / nbOrders) * 100 : 50
        const score = Math.round(tauxEncaissement * 0.40 + tauxRentabilite * 0.35 + tauxConvOrders * 0.25)
        const capped = Math.min(100, Math.max(0, score))
        const label = capped >= 80 ? 'Excellente' : capped >= 60 ? 'Bonne' : capped >= 40 ? 'Correcte' : 'Critique'
        const color = capped >= 80 ? '#00c870' : capped >= 60 ? '#008751' : capped >= 40 ? '#FCD116' : '#E8112D'
        const recommandation = capped >= 80
            ? 'Performance excellente — maintenir le rythme actuel'
            : capped >= 60
            ? 'Bonne santé — optimiser les relances factures impayées'
            : capped >= 40
            ? 'Attention — augmenter le taux d\'encaissement, réduire les dépenses'
            : 'Critique — relancer en urgence, revoir les dépenses et commissions'
        return { score: capped, label, color, recommandation,
                 tauxEncaissement: tauxEncaissement.toFixed(0),
                 tauxRentabilite:  tauxRentabilite.toFixed(0),
                 tauxConvOrders:   tauxConvOrders.toFixed(0) }
    }, [kpis, pOrders])

    // ── Alertes intelligentes ─────────────────────────────────────
    const alertes = useMemo(() => {
        const list: { type: 'warning' | 'danger' | 'info'; msg: string; action?: string }[] = []
        const now = new Date()
        const retard = pDocs.filter(d => d.type === 'facture' && ['envoye', 'accepte'].includes(d.status) && (now.getTime() - new Date(d.created_at).getTime()) > 7 * 864e5)
        if (retard.length > 0)
            list.push({ type: 'warning', msg: `${retard.length} facture${retard.length > 1 ? 's' : ''} en attente +7j — ${fmt(retard.reduce((a, d) => a + d.total, 0))} à relancer`, action: 'retard' })
        if (kpis.benefice < 0)
            list.push({ type: 'danger', msg: `Bénéfice net négatif (${fmt(kpis.benefice)}) — dépenses supérieures aux encaissements` })
        const agentsInactifs = agents.filter(a => a.role === 'agent' && !pDocs.some(d => d.agent_id === a.id && d.type === 'facture' && d.status === 'paye'))
        if (agentsInactifs.length > 0 && agents.filter(a => a.role === 'agent').length > 0)
            list.push({ type: 'info', msg: `${agentsInactifs.length} agent${agentsInactifs.length > 1 ? 's' : ''} sans encaissement sur cette période`, action: 'agents' })
        const commandesRetard = pOrders.filter(o => o.payment_status === 'pending' && (now.getTime() - new Date(o.created_at).getTime()) > 864e5)
        if (commandesRetard.length > 0)
            list.push({ type: 'warning', msg: `${commandesRetard.length} commande${commandesRetard.length > 1 ? 's' : ''} boutique en attente +24h`, action: 'boutique' })
        if (kpis.caEmis > 0 && (kpis.encaisseFactu / kpis.caEmis) < 0.3)
            list.push({ type: 'danger', msg: `Taux d'encaissement bas (${((kpis.encaisseFactu / kpis.caEmis) * 100).toFixed(0)}%) — plus de 70% du CA émis non encaissé`, action: 'retard' })
        const nonSignes = pDocs.filter(d => d.type === 'facture' && d.status === 'paye' && !d.signed_at)
        if (nonSignes.length > 0)
            list.push({ type: 'info', msg: `${nonSignes.length} facture${nonSignes.length > 1 ? 's' : ''} payée${nonSignes.length > 1 ? 's' : ''} sans signature numérique` })
        return list
    }, [pDocs, pOrders, kpis, agents])

    // ── Dépenses par catégorie ────────────────────────────────────
    const depParCat = useMemo(() => {
        const map: Record<string, number> = {}
        for (const d of pDeps) {
            const cat = d.categorie || 'autre'
            map[cat] = (map[cat] || 0) + Number(d.montant)
        }
        return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }))
    }, [pDeps])

    // ── Per-agent stats ───────────────────────────────────────────
    const agentStats = useMemo(() => {
        const map = new Map<string, { agent: AgentRow; caEmis: number; encaisse: number; enAttente: number; commission: number; depenses: number; benefice: number; nbDevis: number; nbFactures: number; nbPayees: number; tvaCollectee: number }>()
        for (const a of agents) {
            map.set(a.id, { agent: a, caEmis: 0, encaisse: 0, enAttente: 0, commission: 0, depenses: 0, benefice: 0, nbDevis: 0, nbFactures: 0, nbPayees: 0, tvaCollectee: 0 })
        }
        for (const d of pDocs) {
            if (!d.agent_id) continue
            if (!map.has(d.agent_id)) {
                const shortId = (d.agent_id || '').slice(0, 8)
                map.set(d.agent_id, { agent: { id: d.agent_id, full_name: '', email: shortId + '…', role: 'agent', is_active: true }, caEmis: 0, encaisse: 0, enAttente: 0, commission: 0, depenses: 0, benefice: 0, nbDevis: 0, nbFactures: 0, nbPayees: 0, tvaCollectee: 0 })
            }
            const s = map.get(d.agent_id)!
            if (d.type === 'devis') { s.nbDevis++ } else {
                s.nbFactures++; s.caEmis += d.total
                if (d.status === 'paye') { s.encaisse += (d.total - (Number(d.remise) || 0)); s.nbPayees++; s.tvaCollectee += Number(d.total_tva) || 0 }
                if (['envoye', 'accepte'].includes(d.status)) s.enAttente += d.total
            }
        }
        for (const dep of pDeps) {
            if (dep.agent_id && map.has(dep.agent_id)) map.get(dep.agent_id)!.depenses += Number(dep.montant)
        }
        for (const [, s] of map) {
            s.commission = Math.round(s.encaisse * commissionRate)
            s.benefice = s.encaisse - s.commission - s.depenses
        }
        const all = [...map.values()]
        return showAllAgents ? all : all.filter(s => s.caEmis > 0 || s.nbDevis > 0 || s.depenses > 0)
    }, [agents, pDocs, pDeps, commissionRate, showAllAgents])

    // ── Charts ────────────────────────────────────────────────────
    const areaData = useMemo(() => {
        const days: Record<string, { factu: number; boutique: number; depenses: number }> = {}
        for (const d of pDocs.filter(d => d.status === 'paye' && d.type === 'facture')) {
            const k = formatShortDate(d.created_at)
            if (!days[k]) days[k] = { factu: 0, boutique: 0, depenses: 0 }
            days[k].factu += d.total
        }
        for (const o of pOrders.filter(o => o.payment_status === 'completed')) {
            const k = formatShortDate(o.created_at)
            if (!days[k]) days[k] = { factu: 0, boutique: 0, depenses: 0 }
            days[k].boutique += o.amount
        }
        for (const d of pDeps) {
            const k = formatShortDate(d.date_depense)
            if (!days[k]) days[k] = { factu: 0, boutique: 0, depenses: 0 }
            days[k].depenses += Number(d.montant)
        }
        return Object.entries(days).slice(-60).map(([name, v]) => ({ name, ...v }))
    }, [pDocs, pOrders, pDeps])

    const agentBarData = useMemo(() =>
        [...agentStats].sort((a, b) => b.encaisse - a.encaisse).slice(0, 8).map(s => ({
            name: (s.agent.full_name || (s.agent.email || '').split('@')[0] || s.agent.id.slice(0, 8)).slice(0, 14),
            encaisse: s.encaisse, commission: s.commission,
        })), [agentStats])

    const sortedAgents = useMemo(() => {
        const list = [...agentStats]
        if (sortAgent === 'encaisse')   return list.sort((a, b) => b.encaisse - a.encaisse)
        if (sortAgent === 'commission') return list.sort((a, b) => b.commission - a.commission)
        return list.sort((a, b) => (b.nbDevis + b.nbFactures) - (a.nbDevis + a.nbFactures))
    }, [agentStats, sortAgent])

    // ── Journal avec filtre alerte ────────────────────────────────
    const now = new Date()
    const jDocs = useMemo(() => {
        let list = pDocs.filter(d => d.type === 'facture')
        if (alertFilter === 'retard') list = list.filter(d => ['envoye', 'accepte'].includes(d.status) && (now.getTime() - new Date(d.created_at).getTime()) > 7 * 864e5)
        if (agentFilter !== 'tous') list = list.filter(d => d.agent_id === agentFilter)
        if (searchQ) { const q = searchQ.toLowerCase(); list = list.filter(d => (`${d.client_nom} ${d.client_prenom || ''} ${d.numero}`).toLowerCase().includes(q)) }
        return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pDocs, agentFilter, searchQ, alertFilter])

    const jOrders = useMemo(() => {
        let list = pOrders
        if (alertFilter === 'boutique') list = list.filter(o => o.payment_status === 'pending' && (now.getTime() - new Date(o.created_at).getTime()) > 864e5)
        if (searchQ) { const q = searchQ.toLowerCase(); list = list.filter(o => (`${o.customer_name} ${o.product_title}`).toLowerCase().includes(q)) }
        return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pOrders, searchQ, alertFilter])

    const jDeps = useMemo(() => {
        let list = pDeps
        if (agentFilter !== 'tous') list = list.filter(d => d.agent_id === agentFilter)
        if (searchQ) { const q = searchQ.toLowerCase(); list = list.filter(d => d.titre.toLowerCase().includes(q)) }
        return list
    }, [pDeps, agentFilter, searchQ])

    const jCount     = journalTab === 'docs' ? jDocs.length : journalTab === 'boutique' ? jOrders.length : jDeps.length
    const totalPages = Math.max(1, Math.ceil(jCount / ITEMS))
    const pgDocs     = jDocs.slice((journalPage - 1) * ITEMS, journalPage * ITEMS)
    const pgOrders   = jOrders.slice((journalPage - 1) * ITEMS, journalPage * ITEMS)
    const pgDeps     = jDeps.slice((journalPage - 1) * ITEMS, journalPage * ITEMS)

    const handleAddPayment = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!paymentDoc) return
        setSavingPayment(true)
        try {
            const res = await fetch('/api/admin/paiements-manuels', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    document_id: paymentDoc.id,
                    agent_id: paymentDoc.agent_id,
                    type: newPayment.type,
                    montant: Number(newPayment.montant),
                    date_paiement: newPayment.date,
                    reference: newPayment.reference || null,
                    notes: newPayment.notes || null,
                })
            })
            if (res.ok) {
                setShowPaymentModal(false)
                setPaymentDoc(null)
                setNewPayment({ type: 'virement', montant: '', reference: '', notes: '', date: new Date().toISOString().split('T')[0] })
                await fetchAll()
            }
        } finally {
            setSavingPayment(false)
        }
    }

    const handleAlertAction = (action?: string) => {
        if (!action) return
        if (action === 'retard' || action === 'agents') { setJournalTab('docs'); setAlertFilter(action === 'retard' ? 'retard' : null); setJournalPage(1) }
        if (action === 'boutique') { setJournalTab('boutique'); setAlertFilter('boutique'); setJournalPage(1) }
        document.getElementById('journal-section')?.scrollIntoView({ behavior: 'smooth' })
    }

    // ── Export FEC / SYSCOHADA (écritures partie double pour expert-comptable) ──
    const handleFecExport = async () => {
        setFecExporting(true)
        try {
            const qs = isMonth(period) ? `periode=${period}` : `annee=${new Date().getFullYear()}`
            const res = await fetch(`/api/admin/comptabilite/fec?${qs}`, { credentials: 'same-origin' })
            if (!res.ok) {
                const j = await res.json().catch(() => ({}))
                throw new Error(j.error || `Erreur ${res.status}`)
            }
            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `RGB_FEC_${isMonth(period) ? period : new Date().getFullYear()}.txt`
            document.body.appendChild(a); a.click(); a.remove()
            setTimeout(() => URL.revokeObjectURL(url), 1000)
        } catch (e) {
            alert('Échec export FEC : ' + (e instanceof Error ? e.message : 'erreur'))
        } finally {
            setFecExporting(false)
        }
    }

    // ── Export Excel multi-feuilles (LOT 1 : HT/TVA/TTC, Journal, entête légal, totaux formule) ──
    const handleMasterExport = async () => {
        setExporting(true)
        try {
            const pLabel = periodLabel(period)
            const subtitle = `Vue Admin (tous agents consolidés)   —   Période : ${pLabel}   —   Commission agents : ${(commissionRate * 100).toFixed(0)}%   —   Document officiel confidentiel`
            const agentMap = new Map<string, string>()
            agents.forEach(a => agentMap.set(a.id, a.full_name || a.email || a.id.slice(0, 8)))

            const PAYMENT_LABELS: Record<string, string> = {
                virement: 'Virement bancaire', especes: 'Espèces', cheque: 'Chèque',
                mobile_money: 'Mobile Money', carte: 'Carte bancaire', autre: 'Autre'
            }

            // Enrichissement des docs (HT/TVA reconstitués depuis items si colonnes vides)
            const enrichDoc = (d: DocRow) => {
                let st = Number(d.sous_total) || 0
                let tv = Number(d.total_tva) || 0
                if ((!st || !tv) && Array.isArray(d.items)) {
                    st = d.items.reduce((a, it) => a + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0)
                    tv = d.items.reduce((a, it) => a + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0) * ((Number(it.tva) || 0) / 100), 0)
                }
                return { ...d, _ht: st, _tva: tv, _remise: Number(d.remise) || 0, _ttc: Number(d.total) || 0 }
            }
            const docsEnriched = pDocs.map(enrichDoc)

            // ── 1. Synthèse ───────────────────────────────────────
            const resumeSheet = {
                sheetName: 'Synthèse',
                title: 'SYNTHÈSE COMPTABLE MENSUELLE',
                subtitle,
                legalHeader: true,
                columns: [
                    { header: 'Indicateur', key: 'label', width: 44 },
                    { header: 'Montant (FCFA)', key: 'value', width: 22, type: 'currency' as const },
                    { header: 'Détail', key: 'detail', width: 42 },
                ],
                data: [
                    { label: "CA émis (factures)", value: kpis.caEmis, detail: `${pDocs.filter(d => d.type === 'facture').length} factures émises` },
                    { label: "Encaissé - Facturation (net remises)", value: kpis.encaisseFactu, detail: `${kpis.nbFactPaye} factures payées` },
                    { label: "Paiements manuels (virement/espèces)", value: pPaiements.reduce((a, p) => a + Number(p.montant || 0), 0), detail: `${pPaiements.length} paiements` },
                    { label: "Revenus boutique", value: kpis.boutique, detail: `${pOrders.filter(o => o.payment_status === 'completed').length} commandes` },
                    { label: "TOTAL ENCAISSÉ", value: kpis.totalEncaisse, detail: 'Facturation + Boutique' },
                    { label: "TVA collectée", value: kpis.totalTVA, detail: 'Sur factures émises' },
                    { label: "Factures en attente", value: kpis.enAttente, detail: `${pDocs.filter(d => ['envoye', 'accepte'].includes(d.status)).length} en cours` },
                    { label: `Commission agents (${(commissionRate * 100).toFixed(0)}%)`, value: kpis.commission, detail: 'Sur encaissements nets' },
                    { label: "Dépenses totales", value: kpis.totalDeps, detail: `${pDeps.length} dépenses` },
                    { label: "BÉNÉFICE NET", value: kpis.benefice, detail: 'Encaissé - Commissions - Dépenses' },
                    { label: "Projection 30 jours", value: Math.round(kpis.proj30), detail: 'Basée sur rythme actuel' },
                    { label: "Score santé financière", value: scoreSante.score, detail: `${scoreSante.label} — ${scoreSante.recommandation}` },
                ],
            }

            // ── 2. Journal comptable consolidé ────────────────────
            type JRow = { date: Date; piece: string; agent: string; libelle: string; mode: string; debit: number; credit: number }
            const journalRows: JRow[] = []

            pDocs.filter(d => d.type === 'facture').forEach(d => {
                journalRows.push({
                    date: new Date(d.created_at),
                    piece: d.numero || '—',
                    agent: d.agent_id ? (agentMap.get(d.agent_id) || '—') : '—',
                    libelle: `Facturation — ${d.client_nom || ''} ${d.client_prenom || ''}`.trim(),
                    mode: DOC_STATUS[d.status]?.label || d.status,
                    debit: 0,
                    credit: Number(d.total || 0),
                })
            })
            pPaiements.forEach(p => {
                const d = docs.find(x => x.id === p.document_id)
                const isExterne = !d && /^\[EXTERNE\]/i.test(p.notes || '')
                const libelleExterne = isExterne ? (p.notes || '').replace(/^\[EXTERNE\]\s*/i, '').split('|')[0].trim() : ''
                journalRows.push({
                    date: new Date(p.date_paiement),
                    piece: d?.numero || (isExterne ? 'EXT' : '—'),
                    agent: p.agent_id ? (agentMap.get(p.agent_id) || '—') : '—',
                    libelle: d
                        ? `Encaissement — ${d.client_nom || ''} ${d.client_prenom || ''}`.trim()
                        : isExterne ? `Encaissement externe — ${libelleExterne}` : 'Encaissement',
                    mode: PAYMENT_LABELS[p.type] || p.type,
                    debit: Number(p.montant || 0),
                    credit: 0,
                })
            })
            pOrders.filter(o => o.payment_status === 'completed').forEach(o => {
                journalRows.push({
                    date: new Date(o.created_at),
                    piece: o.id.slice(0, 8).toUpperCase(),
                    agent: '—',
                    libelle: `Commande boutique — ${o.product_title || ''}`.trim(),
                    mode: PAYMENT_LABELS[(o.payment_method || '').toLowerCase()] || (o.payment_method || '—'),
                    debit: Number(o.amount || 0),
                    credit: 0,
                })
            })
            pDeps.forEach(e => {
                journalRows.push({
                    date: new Date(e.date_depense),
                    piece: '—',
                    agent: e.agent_id ? (agentMap.get(e.agent_id) || '—') : '—',
                    libelle: `Dépense — ${e.titre || ''} (${e.categorie || ''})`,
                    mode: '—',
                    debit: Number(e.montant || 0),
                    credit: 0,
                })
            })
            journalRows.sort((a, b) => a.date.getTime() - b.date.getTime())

            const journalSheet = {
                sheetName: 'Journal',
                title: 'JOURNAL COMPTABLE CONSOLIDÉ',
                subtitle,
                legalHeader: true,
                totalRow: true,
                columns: [
                    { header: 'Date', key: 'date', width: 13, type: 'date' as const },
                    { header: 'N° Pièce', key: 'piece', width: 18 },
                    { header: 'Agent', key: 'agent', width: 22 },
                    { header: 'Libellé', key: 'libelle', width: 44 },
                    { header: 'Mode / Statut', key: 'mode', width: 20, type: 'status' as const },
                    { header: 'Débit (FCFA)', key: 'debit', width: 18, type: 'currency' as const, totalFormula: 'sum' as const },
                    { header: 'Crédit (FCFA)', key: 'credit', width: 18, type: 'currency' as const, totalFormula: 'sum' as const },
                ],
                data: journalRows,
            }

            // ── 3. Performance par agent ──────────────────────────
            const perAgentSheet = {
                sheetName: 'Par Agent',
                title: 'PERFORMANCE PAR AGENT',
                subtitle,
                legalHeader: true,
                totalRow: true,
                columns: [
                    { header: 'Agent', key: 'name', width: 26 },
                    { header: 'Email', key: 'email', width: 30 },
                    { header: 'CA émis', key: 'caEmis', width: 18, type: 'currency' as const, totalFormula: 'sum' as const },
                    { header: 'Encaissé net', key: 'encaisse', width: 18, type: 'currency' as const, totalFormula: 'sum' as const },
                    { header: `Commission ${(commissionRate * 100).toFixed(0)}%`, key: 'commission', width: 18, type: 'currency' as const, totalFormula: 'sum' as const },
                    { header: 'TVA collectée', key: 'tva', width: 16, type: 'currency' as const, totalFormula: 'sum' as const },
                    { header: 'Dépenses', key: 'depenses', width: 16, type: 'currency' as const, totalFormula: 'sum' as const },
                    { header: 'Bénéfice net', key: 'benefice', width: 18, type: 'currency' as const, totalFormula: 'sum' as const },
                    { header: 'Devis', key: 'nbDevis', width: 10, type: 'number' as const, totalFormula: 'sum' as const },
                    { header: 'Factures', key: 'nbFactures', width: 10, type: 'number' as const, totalFormula: 'sum' as const },
                    { header: 'Conv. %', key: 'conv', width: 12 },
                ],
                data: sortedAgents.map(s => ({
                    name: s.agent.full_name || '—',
                    email: s.agent.email || '—',
                    caEmis: s.caEmis,
                    encaisse: s.encaisse,
                    commission: s.commission,
                    tva: s.tvaCollectee,
                    depenses: s.depenses,
                    benefice: s.benefice,
                    nbDevis: s.nbDevis,
                    nbFactures: s.nbFactures,
                    conv: s.nbFactures > 0 ? ((s.nbPayees / s.nbFactures) * 100).toFixed(1) + '%' : '0%',
                })),
            }

            // ── 4. Documents HT/TVA/TTC (super-headers) ───────────
            const docsSheet = {
                sheetName: 'Documents',
                title: 'JOURNAL DES FACTURES & DEVIS (HT / TVA / TTC)',
                subtitle,
                legalHeader: true,
                totalRow: true,
                columns: [
                    { header: 'N° Document', key: 'numero', width: 18, group: 'Document' },
                    { header: 'Type', key: 'type', width: 10, group: 'Document' },
                    { header: 'Date', key: 'date', width: 13, type: 'date' as const, group: 'Document' },
                    { header: 'Agent', key: 'agent', width: 22, group: 'Document' },
                    { header: 'Client', key: 'client', width: 28, group: 'Client' },
                    { header: 'Email', key: 'email', width: 26, group: 'Client' },
                    { header: 'Téléphone', key: 'phone', width: 16, group: 'Client' },
                    { header: 'Sous-total HT', key: 'ht', width: 16, type: 'currency' as const, totalFormula: 'sum' as const, group: 'Montants HT / TVA / TTC' },
                    { header: 'TVA', key: 'tva', width: 14, type: 'currency' as const, totalFormula: 'sum' as const, group: 'Montants HT / TVA / TTC' },
                    { header: 'Remise', key: 'remise', width: 14, type: 'currency' as const, totalFormula: 'sum' as const, group: 'Montants HT / TVA / TTC' },
                    { header: 'Total TTC', key: 'ttc', width: 16, type: 'currency' as const, totalFormula: 'sum' as const, group: 'Montants HT / TVA / TTC' },
                    { header: 'Statut', key: 'status', width: 14, type: 'status' as const, group: 'État' },
                    { header: 'Signé', key: 'signe', width: 10, group: 'État' },
                ],
                data: docsEnriched.map(d => ({
                    numero: d.numero,
                    type: d.type === 'facture' ? 'Facture' : 'Devis',
                    date: new Date(d.created_at),
                    agent: d.agent_id ? (agentMap.get(d.agent_id) || '—') : '—',
                    client: `${d.client_nom || ''} ${d.client_prenom || ''}`.trim(),
                    email: d.client_email || '—',
                    phone: d.client_phone || '—',
                    ht: d._ht,
                    tva: d._tva,
                    remise: d._remise,
                    ttc: d._ttc,
                    status: DOC_STATUS[d.status]?.label || d.status,
                    signe: d.signed_at ? 'Oui' : 'Non',
                })),
            }

            // ── 5. Lignes d'articles ──────────────────────────────
            type LineRow = { numero: string; client: string; date: Date; description: string; qty: number; pu: number; tva: number; total_ht: number }
            const lignesRows: LineRow[] = []
            docsEnriched.forEach(d => {
                if (!Array.isArray(d.items)) return
                d.items.forEach(it => {
                    const q = Number(it.quantity) || 0
                    const pu = Number(it.unit_price) || 0
                    lignesRows.push({
                        numero: d.numero || '—',
                        client: `${d.client_nom || ''} ${d.client_prenom || ''}`.trim(),
                        date: new Date(d.created_at),
                        description: it.description || '—',
                        qty: q,
                        pu,
                        tva: Number(it.tva) || 0,
                        total_ht: q * pu,
                    })
                })
            })
            const lignesSheet = {
                sheetName: "Lignes d'articles",
                title: "LIGNES D'ARTICLES (DÉTAIL DES FACTURES)",
                subtitle,
                legalHeader: true,
                totalRow: true,
                columns: [
                    { header: 'N° Facture', key: 'numero', width: 18 },
                    { header: 'Date', key: 'date', width: 13, type: 'date' as const },
                    { header: 'Client', key: 'client', width: 28 },
                    { header: 'Description', key: 'description', width: 48 },
                    { header: 'Qté', key: 'qty', width: 10, type: 'number' as const, totalFormula: 'sum' as const },
                    { header: 'P.U. (FCFA)', key: 'pu', width: 16, type: 'currency' as const },
                    { header: 'TVA %', key: 'tva', width: 10, type: 'number' as const },
                    { header: 'Total HT', key: 'total_ht', width: 18, type: 'currency' as const, totalFormula: 'sum' as const },
                ],
                data: lignesRows,
            }

            // ── 6. Paiements reçus ────────────────────────────────
            const paiementsSheet = {
                sheetName: 'Paiements',
                title: 'PAIEMENTS MANUELS RECUS',
                subtitle,
                legalHeader: true,
                totalRow: true,
                columns: [
                    { header: 'Date', key: 'date', width: 13, type: 'date' as const },
                    { header: 'N° Facture', key: 'numero', width: 18 },
                    { header: 'Client / Libellé', key: 'client', width: 36 },
                    { header: 'Agent', key: 'agent', width: 22 },
                    { header: 'Mode', key: 'mode', width: 18, type: 'status' as const },
                    { header: 'Référence', key: 'reference', width: 20 },
                    { header: 'Montant (FCFA)', key: 'montant', width: 18, type: 'currency' as const, totalFormula: 'sum' as const },
                ],
                data: pPaiements.map(p => {
                    const d = docs.find(x => x.id === p.document_id)
                    const isExterne = !d && /^\[EXTERNE\]/i.test(p.notes || '')
                    const libelleExterne = isExterne ? (p.notes || '').replace(/^\[EXTERNE\]\s*/i, '').split('|')[0].trim() : ''
                    return {
                        date: new Date(p.date_paiement),
                        numero: d?.numero || (isExterne ? 'EXT' : '—'),
                        client: d ? `${d.client_nom || ''} ${d.client_prenom || ''}`.trim() : (libelleExterne || '—'),
                        agent: p.agent_id ? (agentMap.get(p.agent_id) || '—') : '—',
                        mode: PAYMENT_LABELS[p.type] || p.type,
                        reference: p.reference || '—',
                        montant: Number(p.montant || 0),
                    }
                }),
            }

            // ── 7. Dépenses ──────────────────────────────────────
            const depensesSheet = {
                sheetName: 'Dépenses',
                title: 'JOURNAL DES DÉPENSES',
                subtitle,
                legalHeader: true,
                totalRow: true,
                columns: [
                    { header: 'Date', key: 'date', width: 13, type: 'date' as const },
                    { header: 'Titre', key: 'titre', width: 36 },
                    { header: 'Catégorie', key: 'categorie', width: 22 },
                    { header: 'Agent', key: 'agent', width: 22 },
                    { header: 'Montant (FCFA)', key: 'montant', width: 18, type: 'currency' as const, totalFormula: 'sum' as const },
                    { header: 'Notes', key: 'notes', width: 38 },
                ],
                data: pDeps.map(e => ({
                    date: new Date(e.date_depense),
                    titre: e.titre || '—',
                    categorie: e.categorie || '—',
                    agent: e.agent_id ? (agentMap.get(e.agent_id) || '—') : '—',
                    montant: Number(e.montant || 0),
                    notes: e.notes || '—',
                })),
            }

            // ── 8. Boutique ──────────────────────────────────────
            const boutiqueSheet = {
                sheetName: 'Boutique',
                title: 'COMMANDES BOUTIQUE',
                subtitle,
                legalHeader: true,
                totalRow: true,
                columns: [
                    { header: 'Date', key: 'date', width: 13, type: 'date' as const },
                    { header: 'Client', key: 'client', width: 26 },
                    { header: 'Email', key: 'email', width: 26 },
                    { header: 'Produit', key: 'produit', width: 34 },
                    { header: 'Devise', key: 'devise', width: 10 },
                    { header: 'Méthode', key: 'methode', width: 16, type: 'status' as const },
                    { header: 'Statut', key: 'statut', width: 14, type: 'status' as const },
                    { header: 'Montant (FCFA)', key: 'montant', width: 16, type: 'currency' as const, totalFormula: 'sum' as const },
                ],
                data: pOrders.map(o => ({
                    date: new Date(o.created_at),
                    client: o.customer_name || '—',
                    email: o.customer_email || '—',
                    produit: o.product_title || '—',
                    devise: o.currency || 'XOF',
                    methode: PAYMENT_LABELS[(o.payment_method || '').toLowerCase()] || (o.payment_method || '—'),
                    statut: ORDER_STATUS[o.payment_status]?.label || o.payment_status,
                    montant: Number(o.amount || 0),
                })),
            }

            // ── 9. Rapprochement bancaire ────────────────────────
            type RecRow = { date: Date; source: string; reference: string; mode: string; montant: number }
            const rapprochementRows: RecRow[] = []
            pPaiements.forEach(p => {
                const d = docs.find(x => x.id === p.document_id)
                rapprochementRows.push({
                    date: new Date(p.date_paiement),
                    source: d ? `Facture ${d.numero}` : 'Encaissement externe',
                    reference: p.reference || '—',
                    mode: PAYMENT_LABELS[p.type] || p.type,
                    montant: Number(p.montant || 0),
                })
            })
            pOrders.filter(o => o.payment_status === 'completed').forEach(o => {
                rapprochementRows.push({
                    date: new Date(o.created_at),
                    source: `Boutique — ${o.product_title || ''}`,
                    reference: o.id.slice(0, 8).toUpperCase(),
                    mode: PAYMENT_LABELS[(o.payment_method || '').toLowerCase()] || (o.payment_method || '—'),
                    montant: Number(o.amount || 0),
                })
            })
            rapprochementRows.sort((a, b) => a.date.getTime() - b.date.getTime())
            const rapprochementSheet = {
                sheetName: 'Rapprochement',
                title: 'RAPPROCHEMENT BANCAIRE',
                subtitle,
                legalHeader: true,
                totalRow: true,
                columns: [
                    { header: 'Date', key: 'date', width: 13, type: 'date' as const },
                    { header: 'Source', key: 'source', width: 32 },
                    { header: 'Référence', key: 'reference', width: 20 },
                    { header: 'Mode', key: 'mode', width: 18, type: 'status' as const },
                    { header: 'Montant (FCFA)', key: 'montant', width: 18, type: 'currency' as const, totalFormula: 'sum' as const },
                ],
                data: rapprochementRows,
            }

            const paiementsManuelsTotal = pPaiements.reduce((a, p) => a + Number(p.montant || 0), 0)

            await exportToExcelMultiSheet({
                filename: `RGB_Admin_Compta_${periodSlug(period)}_${new Date().toISOString().split('T')[0]}`,
                coverTitle: 'Rapport comptable Admin',
                coverSubtitle: 'À l\'attention du comptable — Synthèse officielle de la période',
                coverPeriod: pLabel,
                dashboard: {
                    title: 'DASHBOARD COMPTABLE MENSUEL',
                    subtitle,
                    kpis: [
                        { label: 'CA émis (factures)', value: kpis.caEmis, type: 'currency', tone: 'accent', detail: `${pDocs.filter(d => d.type === 'facture').length} factures émises` },
                        { label: 'Total encaissé', value: kpis.totalEncaisse, type: 'currency', tone: 'good', detail: 'Facturation + Boutique + Paiements manuels' },
                        { label: 'Paiements manuels', value: paiementsManuelsTotal, type: 'currency', tone: 'good', detail: `${pPaiements.length} paiements (virement / espèces / chèque)` },
                        { label: 'Revenus boutique', value: kpis.boutique, type: 'currency', tone: 'accent', detail: `${pOrders.filter(o => o.payment_status === 'completed').length} commandes payées` },
                        { label: 'TVA collectée', value: kpis.totalTVA, type: 'currency', tone: 'neutral', detail: 'À déclarer à la DGI' },
                        { label: 'Factures en attente', value: kpis.enAttente, type: 'currency', tone: 'warn', detail: `${pDocs.filter(d => ['envoye', 'accepte'].includes(d.status)).length} factures en cours` },
                        { label: `Commission agents ${(commissionRate * 100).toFixed(0)}%`, value: kpis.commission, type: 'currency', tone: 'warn', detail: 'Sur encaissements nets' },
                        { label: 'Dépenses totales', value: kpis.totalDeps, type: 'currency', tone: 'bad', detail: `${pDeps.length} dépenses enregistrées` },
                        { label: 'Bénéfice net', value: kpis.benefice, type: 'currency', tone: kpis.benefice >= 0 ? 'good' : 'bad', detail: 'Encaissé − Commissions − Dépenses' },
                        { label: 'Score santé financière', value: scoreSante.score, type: 'number', tone: scoreSante.score >= 60 ? 'good' : scoreSante.score >= 40 ? 'warn' : 'bad', detail: `${scoreSante.label} / 100 — ${scoreSante.recommandation}` },
                    ],
                },
                sheets: [
                    resumeSheet,
                    journalSheet,
                    perAgentSheet,
                    docsSheet,
                    lignesSheet,
                    paiementsSheet,
                    depensesSheet,
                    boutiqueSheet,
                    rapprochementSheet,
                ],
            })
        } catch (err) {
            console.error('[Export Excel]', err)
        } finally {
            setExporting(false)
        }
    }

    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-2 border-[#FCD116] border-t-transparent rounded-full animate-spin" />
                <p className="text-gray-500 text-sm">Chargement des données ERP…</p>
            </div>
        </div>
    )

    const nAgents  = agents.filter(a => a.role === 'agent').length
    const nSigned  = pDocs.filter(d => d.signed_at).length
    const nPending = pOrders.filter(o => o.payment_status === 'pending').length
    const periodLocked = clotures.some(c => c.periode === period)

    return (
        <div className="space-y-8 max-w-7xl mx-auto pb-12">

            {/* ── MODAL DÉTAIL DOCUMENT ── */}
            <AnimatePresence>
                {detailDoc && (
                    <DocDetailModal
                        doc={detailDoc}
                        agent={agents.find(a => a.id === detailDoc.agent_id)}
                        onClose={() => setDetailDoc(null)}
                    />
                )}
            </AnimatePresence>

            {/* ── HEADER ── */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
                <div>
                    <div className="flex items-center gap-2 text-[#FCD116] mb-2">
                        <Landmark size={16} />
                        <span className="text-[10px] font-black uppercase tracking-[0.4em]">ERP Admin · Comptabilité</span>
                    </div>
                    <h1 className="text-3xl font-black text-white font-heading tracking-tighter">
                        COMPTABILITÉ <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FCD116] to-[#008751]">GLOBALE</span>
                    </h1>
                    <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                        <span className="text-gray-500 text-sm">{nAgents} agents actifs · {docs.length} documents · {orders.length} commandes</span>
                        {nSigned > 0 && <span className="text-[10px] text-purple-400 flex items-center gap-1"><Shield size={10} />{nSigned} signés</span>}
                        {nPending > 0 && <span className="text-[10px] text-yellow-400 flex items-center gap-1"><Clock size={10} />{nPending} en attente</span>}
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#008751]/15 text-[#00c870]">Commission {(commissionRate * 100).toFixed(0)}%</span>
                    </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                        <button
                            type="button"
                            title="Mois précédent"
                            onClick={() => {
                                const base = isMonth(period) ? period : currentMonthKey()
                                setPeriod(shiftMonth(base, -1))
                                setJournalPage(1); setAlertFilter(null)
                            }}
                            className="p-2.5 text-gray-400 hover:text-white transition-colors"
                        >
                            <ChevronLeft size={14} />
                        </button>
                        <select
                            title="Sélectionner la période"
                            value={period}
                            onChange={e => { setPeriod(e.target.value); setJournalPage(1); setAlertFilter(null) }}
                            className="bg-transparent text-white text-[11px] font-bold px-3 py-2 outline-none min-w-[170px] cursor-pointer appearance-none"
                        >
                            <optgroup label="Mois précis (comptable)">
                                {last12Months().map(m => (
                                    <option key={m} value={m} className="bg-[#0a0f18]">{monthLabel(m)}</option>
                                ))}
                            </optgroup>
                            <optgroup label="Périodes étendues">
                                <option value="3_mois" className="bg-[#0a0f18]">3 derniers mois</option>
                                <option value="6_mois" className="bg-[#0a0f18]">6 derniers mois</option>
                                <option value="annee"  className="bg-[#0a0f18]">Année en cours</option>
                                <option value="tous"   className="bg-[#0a0f18]">Global</option>
                            </optgroup>
                        </select>
                        <button
                            type="button"
                            title="Mois suivant"
                            disabled={isMonth(period) && period >= currentMonthKey()}
                            onClick={() => {
                                const base = isMonth(period) ? period : currentMonthKey()
                                const next = shiftMonth(base, 1)
                                if (next <= currentMonthKey()) {
                                    setPeriod(next); setJournalPage(1); setAlertFilter(null)
                                }
                            }}
                            className="p-2.5 text-gray-400 hover:text-white transition-colors disabled:opacity-30"
                        >
                            <ChevronRight size={14} />
                        </button>
                    </div>
                    <button type="button" onClick={fetchAll} disabled={refreshing} title="Rafraîchir"
                        className="p-3 rounded-xl bg-white/5 border border-white/5 text-gray-400 hover:text-white transition-colors disabled:opacity-40">
                        <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
                    </button>
                    <button type="button" onClick={handleMasterExport} disabled={exporting}
                        className="flex items-center gap-2 bg-[#FCD116] text-[#0a0f18] hover:bg-[#e6bc00] font-black text-xs px-5 py-3 rounded-xl transition-all disabled:opacity-60 shadow-[0_0_24px_rgba(252,209,22,0.2)]">
                        {exporting ? <div className="w-4 h-4 border-2 border-[#0a0f18] border-t-transparent rounded-full animate-spin" /> : <Download size={14} />}
                        Export comptable mensuel
                    </button>
                    <button type="button" onClick={handleFecExport} disabled={fecExporting}
                        title="Export FEC / SYSCOHADA — écritures en partie double, pour votre expert-comptable"
                        className="flex items-center gap-2 bg-white/5 border border-[#008751]/40 text-[#00c870] hover:bg-[#008751]/15 font-black text-xs px-5 py-3 rounded-xl transition-all disabled:opacity-60">
                        {fecExporting ? <div className="w-4 h-4 border-2 border-[#00c870] border-t-transparent rounded-full animate-spin" /> : <Download size={14} />}
                        Export FEC (comptable)
                    </button>
                </div>
            </div>

            {/* ── LOT 3 : VERROU PÉRIODE ── */}
            <ComptaLockPanel
                currentPeriod={period}
                isMonthPeriod={isMonth(period)}
                periodLabel={periodLabel(period)}
                clotures={clotures}
                snapshot={{
                    totalEncaisse: kpis.totalEncaisse,
                    totalDepenses: kpis.totalDeps,
                    beneficeNet: kpis.benefice,
                    nbDocuments: pDocs.length,
                    nbPaiements: pPaiements.length,
                    nbDepenses: pDeps.length,
                }}
                onChange={fetchAll}
                fmt={fmt}
            />

            {/* ── SCORE SANTÉ + ALERTES ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Score */}
                <div className="bg-[#0a0f18] border border-white/5 rounded-2xl p-5 flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                        <Zap size={14} style={{ color: scoreSante.color }} />
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Score Santé Financière</p>
                    </div>
                    <div className="flex items-end gap-3">
                        <span className="text-5xl font-black font-mono" style={{ color: scoreSante.color }}>{scoreSante.score}</span>
                        <span className="text-sm text-gray-400 mb-1">/ 100</span>
                        <span className="ml-auto text-xs font-bold px-3 py-1 rounded-full" style={{ background: `${scoreSante.color}22`, color: scoreSante.color }}>{scoreSante.label}</span>
                    </div>
                    <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${scoreSante.score}%`, background: scoreSante.color }} />
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[10px] text-gray-500">
                        <div className="text-center"><p>Encaissement</p><p className="font-bold text-white text-[11px]">{scoreSante.tauxEncaissement}%</p></div>
                        <div className="text-center border-x border-white/5"><p>Rentabilité</p><p className="font-bold text-white text-[11px]">{scoreSante.tauxRentabilite}%</p></div>
                        <div className="text-center"><p>Conv. Boutique</p><p className="font-bold text-white text-[11px]">{scoreSante.tauxConvOrders}%</p></div>
                    </div>
                    <p className="text-[10px] text-gray-600 border-t border-white/5 pt-3 leading-relaxed">{scoreSante.recommandation}</p>
                </div>

                {/* Alertes cliquables */}
                <div className="lg:col-span-2 bg-[#0a0f18] border border-white/5 rounded-2xl p-5 flex flex-col gap-3">
                    <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle size={14} className="text-[#FCD116]" />
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Alertes Intelligentes</p>
                        <span className="text-[9px] font-mono bg-white/5 text-gray-500 px-1.5 py-0.5 rounded ml-auto">{alertes.length}</span>
                    </div>
                    {alertes.length === 0 ? (
                        <div className="flex items-center gap-2 text-[#00c870] bg-[#008751]/10 rounded-xl px-4 py-3">
                            <CheckCircle2 size={14} />
                            <span className="text-xs font-semibold">Tout est en ordre — aucune alerte sur cette période</span>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {alertes.map((a, i) => (
                                <button key={i} type="button"
                                    onClick={() => a.action && handleAlertAction(a.action)}
                                    className={cn('w-full flex items-start gap-2.5 px-4 py-2.5 rounded-xl text-xs text-left transition-all',
                                        a.action ? 'cursor-pointer hover:opacity-80' : 'cursor-default',
                                        a.type === 'danger' ? 'bg-red-500/10 text-red-300 border border-red-500/10 hover:border-red-500/30' :
                                        a.type === 'warning' ? 'bg-yellow-500/10 text-yellow-300 border border-yellow-500/10 hover:border-yellow-500/30' :
                                        'bg-blue-500/10 text-blue-300 border border-blue-500/10 hover:border-blue-500/30')}>
                                    {a.type === 'danger' ? <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" /> :
                                     a.type === 'warning' ? <Clock size={13} className="flex-shrink-0 mt-0.5" /> :
                                     <Activity size={13} className="flex-shrink-0 mt-0.5" />}
                                    <span className="flex-1">{a.msg}</span>
                                    {a.action && <ExternalLink size={11} className="flex-shrink-0 mt-0.5 opacity-50" />}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ── KPI GRID ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard icon={BarChart3}     label="CA Émis (Factures)"    value={fmt(kpis.caEmis)}        color="#FCD116" sub={`${pDocs.filter(d => d.type === 'facture').length} factures`} />
                <KpiCard icon={Wallet}        label="Total Encaissé"         value={fmt(kpis.totalEncaisse)} trend={kpis.trends?.encaisse}  color="#008751" sub="Facturation net + Boutique" highlight />
                <KpiCard icon={ShoppingBag}   label="Revenus Boutique"       value={fmt(kpis.boutique)}      trend={kpis.trends?.boutique}  color="#3b82f6" sub={`${pOrders.filter(o => o.payment_status === 'completed').length} commandes payées`} />
                <KpiCard icon={AlertTriangle} label="En Attente Paiement"    value={fmt(kpis.enAttente)}     trend={kpis.trends?.enAttente} color="#f97316" sub={`${pDocs.filter(d => ['envoye', 'accepte'].includes(d.status)).length} factures`} />
                <KpiCard icon={Users}         label={`Commissions (${(commissionRate * 100).toFixed(0)}%)`} value={fmt(kpis.commission)} color="#8b5cf6" sub="Sur encaissements nets" />
                <KpiCard icon={TrendingDown}  label="Dépenses Totales"       value={fmt(kpis.totalDeps)}     color="#E8112D" sub={`${pDeps.length} dépenses`} />
                <KpiCard icon={Award}         label="Bénéfice Net"           value={fmt(kpis.benefice)}      trend={kpis.trends?.benefice}  color={kpis.benefice >= 0 ? '#00c870' : '#E8112D'} sub="Après comm. et dépenses" />
                <KpiCard icon={Target}        label="Projection 30 jours"    value={fmt(Math.round(kpis.proj30))} color="#FCD116" sub="Basée sur rythme actuel" />
            </div>
            {/* TVA + Signatures row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard icon={Calculator}    label="TVA Collectée"          value={fmt(kpis.totalTVA)}      trend={kpis.trends?.tva}       color="#0891b2" sub="Sur factures payées" />
                <KpiCard icon={Shield}        label="Factures Signées"        value={`${nSigned}`}            color="#9333ea" sub={`sur ${pDocs.filter(d => d.type === 'facture').length} factures`} />
                <KpiCard icon={Clock}         label="Commandes En Attente"    value={`${nPending}`}           color="#f97316" sub="Boutique — non payées" />
                <KpiCard icon={Star}          label="Taux Encaissement"       value={`${scoreSante.tauxEncaissement}%`} color={parseInt(scoreSante.tauxEncaissement) >= 70 ? '#00c870' : parseInt(scoreSante.tauxEncaissement) >= 40 ? '#FCD116' : '#E8112D'} sub={`${kpis.nbFactPaye}/${kpis.nbFactTotal} factures payées`} />
            </div>

            {/* ── CHARTS ROW ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Area flux trésorerie */}
                <div className="lg:col-span-2 bg-[#0a0f18] border border-white/5 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Flux de Trésorerie</p>
                            <p className="text-sm font-bold text-white mt-0.5">Encaissements vs Dépenses</p>
                        </div>
                        <Activity size={16} className="text-[#008751]" />
                    </div>
                    {areaData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <AreaChart data={areaData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="gF" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#008751" stopOpacity={0.35} /><stop offset="95%" stopColor="#008751" stopOpacity={0} /></linearGradient>
                                    <linearGradient id="gB" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} /><stop offset="95%" stopColor="#3b82f6" stopOpacity={0} /></linearGradient>
                                    <linearGradient id="gD" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#E8112D" stopOpacity={0.25} /><stop offset="95%" stopColor="#E8112D" stopOpacity={0} /></linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                                <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                                <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                                <Tooltip contentStyle={{ background: '#0d1421', border: '1px solid #ffffff12', borderRadius: 12 }} labelStyle={{ color: '#fff', fontWeight: 700 }}
                                    formatter={(v, name) => [fmt(Number(v)), name === 'factu' ? 'Facturation' : name === 'boutique' ? 'Boutique' : 'Dépenses']} />
                                <Area type="monotone" dataKey="factu"    stroke="#008751" strokeWidth={2} fill="url(#gF)" />
                                <Area type="monotone" dataKey="boutique" stroke="#3b82f6" strokeWidth={2} fill="url(#gB)" />
                                <Area type="monotone" dataKey="depenses" stroke="#E8112D" strokeWidth={1.5} fill="url(#gD)" strokeDasharray="4 2" />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-[220px] flex flex-col items-center justify-center text-gray-600 gap-2">
                            <TrendingUp size={28} strokeWidth={1} />
                            <p className="text-sm">Aucun encaissement sur cette période</p>
                        </div>
                    )}
                    <div className="flex gap-5 mt-3">
                        {[{ color: '#008751', label: 'Facturation' }, { color: '#3b82f6', label: 'Boutique' }, { color: '#E8112D', label: 'Dépenses', dashed: true }].map(l => (
                            <div key={l.label} className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ background: l.color }} />
                                <span className="text-[10px] text-gray-500">{l.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Dépenses par catégorie */}
                <div className="bg-[#0a0f18] border border-white/5 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Dépenses</p>
                            <p className="text-sm font-bold text-white mt-0.5">Par catégorie</p>
                        </div>
                        <PieChart size={16} className="text-[#E8112D]" />
                    </div>
                    {depParCat.length > 0 ? (
                        <div className="space-y-2.5">
                            {depParCat.slice(0, 6).map((cat, i) => {
                                const pct = kpis.totalDeps > 0 ? (cat.value / kpis.totalDeps) * 100 : 0
                                return (
                                    <div key={cat.name}>
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-[10px] text-gray-400 capitalize truncate max-w-[110px]">{cat.name}</span>
                                            <span className="text-[10px] font-bold font-mono text-white">{fmt(cat.value)}</span>
                                        </div>
                                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: DEP_COLORS[i % DEP_COLORS.length] }} />
                                        </div>
                                        <p className="text-[9px] text-gray-600 mt-0.5 text-right">{pct.toFixed(0)}%</p>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="h-[180px] flex flex-col items-center justify-center text-gray-600 gap-2">
                            <Receipt size={28} strokeWidth={1} />
                            <p className="text-sm">Aucune dépense enregistrée</p>
                        </div>
                    )}
                </div>
            </div>

            {/* ── TOP AGENTS BAR CHART ── */}
            {agentBarData.length > 0 && (
                <div className="bg-[#0a0f18] border border-white/5 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Top Agents</p>
                            <p className="text-sm font-bold text-white mt-0.5">Encaissé vs Commission due</p>
                        </div>
                        <Star size={16} className="text-[#FCD116]" />
                    </div>
                    <ResponsiveContainer width="100%" height={Math.max(160, agentBarData.length * 36)}>
                        <BarChart data={agentBarData} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" horizontal={false} />
                            <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 9 }} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} axisLine={false} tickLine={false} />
                            <YAxis type="category" dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} width={80} />
                            <Tooltip contentStyle={{ background: '#0d1421', border: '1px solid #ffffff12', borderRadius: 12 }}
                                formatter={(v, name) => [fmt(Number(v)), name === 'encaisse' ? 'Encaissé' : 'Commission']} />
                            <Bar dataKey="encaisse"   fill="#008751" radius={[0, 4, 4, 0]} name="encaisse">
                                {agentBarData.map((_, i) => <Cell key={i} fill={i === 0 ? '#00c870' : i === 1 ? '#008751' : '#00674040'} />)}
                            </Bar>
                            <Bar dataKey="commission" fill="#FCD116" radius={[0, 4, 4, 0]} name="commission" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* ── CLASSEMENT AGENTS ── */}
            <div className="bg-[#0a0f18] border border-white/5 rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between p-5 border-b border-white/5">
                    <div className="flex items-center gap-2">
                        <Users size={16} className="text-[#FCD116]" />
                        <h2 className="text-sm font-black text-white">Classement Agents</h2>
                        <span className="text-[9px] font-mono text-gray-600 ml-1 bg-white/5 px-1.5 py-0.5 rounded">{sortedAgents.length}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <button type="button" onClick={() => setShowAllAgents(v => !v)}
                            className="flex items-center gap-1.5 text-[9px] font-bold text-gray-500 hover:text-white transition-colors">
                            {showAllAgents ? <EyeOff size={11} /> : <Eye size={11} />}
                            {showAllAgents ? 'Masquer inactifs' : 'Voir tous'}
                        </button>
                        <div className="flex gap-1 bg-white/5 rounded-lg p-1">
                            {([['encaisse', 'Encaissé'], ['commission', 'Commission'], ['docs', 'Documents']] as const).map(([k, l]) => (
                                <button key={k} type="button" onClick={() => setSortAgent(k)}
                                    className={cn('text-[9px] font-bold px-2.5 py-1.5 rounded-md transition-all',
                                        sortAgent === k ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white')}>
                                    {l}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[780px]">
                        <thead>
                            <tr className="text-[9px] font-black text-gray-500 uppercase tracking-widest border-b border-white/5">
                                {['#', 'Agent', 'CA Émis', 'Encaissé Net', 'Commission', 'TVA', 'Dépenses', 'Bénéfice', 'Docs', 'Conv.'].map((h, i) => (
                                    <th key={h} className={cn('p-4 font-black', i === 0 ? 'pl-5 text-left w-10' : i === 1 ? 'text-left' : i === 9 ? 'text-right pr-5' : 'text-right')}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.03]">
                            {sortedAgents.length === 0 && (
                                <tr><td colSpan={10} className="text-center py-12 text-gray-600 text-sm">Aucune donnée agent sur cette période</td></tr>
                            )}
                            {sortedAgents.map((s, i) => {
                                const conv = s.nbFactures > 0 ? (s.nbPayees / s.nbFactures) * 100 : 0
                                const initials = (s.agent.full_name || s.agent.email || s.agent.id || '??').slice(0, 2).toUpperCase()
                                const isTop3 = i < 3
                                return (
                                    <tr key={s.agent.id} className={cn('hover:bg-white/[0.02] transition-colors', !s.agent.is_active && 'opacity-50')}>
                                        <td className="p-4 pl-5">
                                            <span className={cn('text-[11px] font-black font-mono',
                                                i === 0 ? 'text-[#FCD116]' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-orange-400' : 'text-gray-600')}>
                                                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2.5">
                                                <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black flex-shrink-0',
                                                    isTop3 ? 'bg-[#FCD116]/20 border border-[#FCD116]/20 text-[#FCD116]' : 'bg-[#008751]/20 border border-[#008751]/20 text-[#008751]')}>
                                                    {initials}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-white">{s.agent.full_name || '—'}</p>
                                                    <p className="text-[9px] text-gray-600 truncate max-w-[130px]">{s.agent.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-right font-mono text-[11px] text-gray-400">{fmt(s.caEmis)}</td>
                                        <td className="p-4 text-right font-mono text-[11px] text-[#00c870] font-bold">{fmt(s.encaisse)}</td>
                                        <td className="p-4 text-right font-mono text-[11px] text-purple-300">{fmt(s.commission)}</td>
                                        <td className="p-4 text-right font-mono text-[11px] text-cyan-400">{fmt(s.tvaCollectee)}</td>
                                        <td className="p-4 text-right font-mono text-[11px] text-red-400">{fmt(s.depenses)}</td>
                                        <td className={cn('p-4 text-right font-mono text-[11px] font-bold', s.benefice >= 0 ? 'text-[#00c870]' : 'text-red-400')}>{fmt(s.benefice)}</td>
                                        <td className="p-4 text-right font-mono text-[11px] text-gray-500">{s.nbDevis}d&nbsp;/&nbsp;{s.nbFactures}f</td>
                                        <td className="p-4 pr-5 text-right">
                                            <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full',
                                                conv >= 70 ? 'bg-[#008751]/15 text-[#00c870]' : conv >= 40 ? 'bg-yellow-500/15 text-yellow-300' : 'bg-red-500/15 text-red-400')}>
                                                {conv.toFixed(0)}%
                                            </span>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── JOURNAL COMPLET ── */}
            {(() => {
                const nonSoldees = docs.filter(d => d.type === 'facture' && d.status !== 'annule' && (paiements[d.id] || 0) < d.total)
                const totalRestant = nonSoldees.reduce((a, d) => a + Math.max(0, d.total - (paiements[d.id] || 0)), 0)
                if (nonSoldees.length === 0) return null
                return (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                        className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                                <Bell size={14} className="text-amber-400" />
                            </div>
                            <div>
                                <p className="text-sm font-black text-amber-300">
                                    {nonSoldees.length} facture{nonSoldees.length > 1 ? 's' : ''} non soldée{nonSoldees.length > 1 ? 's' : ''}
                                </p>
                                <p className="text-xs text-amber-500/70">{fmt(totalRestant)} restants à encaisser (tous agents)</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => { setJournalTab('docs'); setAlertFilter('retard'); setJournalPage(1); document.getElementById('journal-section')?.scrollIntoView({ behavior: 'smooth' }) }}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold text-amber-400 border border-amber-500/30 hover:bg-amber-500/15 transition-all flex-shrink-0"
                        >
                            Voir tout
                        </button>
                    </motion.div>
                )
            })()}

            {/* ── Balance âgée des créances (aged receivables) ── */}
            {agedBalance.buckets.total > 0 && (
                <div className="bg-[#0a0f18] border border-white/5 rounded-2xl overflow-hidden">
                    <div className="p-5 border-b border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <AlertTriangle size={16} className="text-[#FCD116]" />
                            <h2 className="text-sm font-black text-white">Balance âgée des créances</h2>
                        </div>
                        <span className="text-[10px] text-gray-500 font-mono bg-white/5 px-2 py-0.5 rounded">
                            {agedBalance.rows.length} client(s) · {fmt(agedBalance.buckets.total)} dû
                        </span>
                    </div>
                    {/* Récap par tranche d'ancienneté */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/5">
                        {([
                            ['0–30 j', agedBalance.buckets.b0, '#00c870'],
                            ['31–60 j', agedBalance.buckets.b30, '#FCD116'],
                            ['61–90 j', agedBalance.buckets.b60, '#E07B54'],
                            ['+90 j', agedBalance.buckets.b90, '#EF4444'],
                        ] as const).map(([label, val, color]) => (
                            <div key={label} className="bg-[#0a0f18] p-4">
                                <p className="text-[9px] font-black uppercase tracking-wider text-gray-500">{label}</p>
                                <p className="text-base font-black font-mono mt-1" style={{ color }}>{fmt(val)}</p>
                            </div>
                        ))}
                    </div>
                    {/* Détail par client (top 8) */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-[11px]">
                            <thead>
                                <tr className="text-gray-500 border-b border-white/5">
                                    <th className="text-left font-bold px-5 py-2.5">Client</th>
                                    <th className="text-right font-bold px-3 py-2.5">0–30</th>
                                    <th className="text-right font-bold px-3 py-2.5">31–60</th>
                                    <th className="text-right font-bold px-3 py-2.5">61–90</th>
                                    <th className="text-right font-bold px-3 py-2.5 text-[#EF4444]">+90</th>
                                    <th className="text-right font-bold px-5 py-2.5">Total dû</th>
                                </tr>
                            </thead>
                            <tbody>
                                {agedBalance.rows.slice(0, 8).map(r => (
                                    <tr key={r.client} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                                        <td className="px-5 py-2.5 text-white font-semibold truncate max-w-[200px]">{r.client}</td>
                                        <td className="px-3 py-2.5 text-right font-mono text-gray-400">{r.b0 ? fmt(r.b0) : '—'}</td>
                                        <td className="px-3 py-2.5 text-right font-mono text-gray-400">{r.b30 ? fmt(r.b30) : '—'}</td>
                                        <td className="px-3 py-2.5 text-right font-mono text-gray-400">{r.b60 ? fmt(r.b60) : '—'}</td>
                                        <td className="px-3 py-2.5 text-right font-mono" style={{ color: r.b90 ? '#EF4444' : '#6b7280' }}>{r.b90 ? fmt(r.b90) : '—'}</td>
                                        <td className="px-5 py-2.5 text-right font-mono font-black text-[#FCD116]">{fmt(r.total)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="text-[9px] text-gray-600 px-5 py-2.5 border-t border-white/5">
                        Créances clients non soldées, par ancienneté de la facture. Au-delà de 90 jours = risque d&apos;impayé — prioriser la relance.
                    </p>
                </div>
            )}

            <div id="journal-section" className="bg-[#0a0f18] border border-white/5 rounded-2xl overflow-hidden">
                <div className="p-5 border-b border-white/5 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <FileText size={16} className="text-[#008751]" />
                            <h2 className="text-sm font-black text-white">Journal des Transactions</h2>
                            {alertFilter && (
                                <button type="button" onClick={() => { setAlertFilter(null); setJournalPage(1) }}
                                    className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30 transition-colors">
                                    Filtre alerte actif <X size={9} />
                                </button>
                            )}
                        </div>
                        <span className="text-[10px] text-gray-600 font-mono bg-white/5 px-2 py-0.5 rounded">
                            {Math.min((journalPage - 1) * ITEMS + 1, jCount)}–{Math.min(journalPage * ITEMS, jCount)} / {jCount}
                        </span>
                    </div>
                    <div className="flex gap-1 bg-white/5 rounded-xl p-1 w-fit">
                        {([
                            ['docs',     'Factures',  pDocs.filter(d => d.type === 'facture').length, Calculator],
                            ['boutique', 'Boutique',  pOrders.length, ShoppingBag],
                            ['depenses', 'Dépenses',  pDeps.length,   Receipt],
                        ] as const).map(([k, l, c, Icon]) => (
                            <button key={k} type="button" onClick={() => { setJournalTab(k); setJournalPage(1); setAlertFilter(null) }}
                                className={cn('text-[10px] font-bold px-4 py-2 rounded-lg transition-all flex items-center gap-1.5',
                                    journalTab === k ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white')}>
                                <Icon size={11} /> {l} <span className="text-[9px] font-mono opacity-60">{c}</span>
                            </button>
                        ))}
                    </div>
                    <div className="flex gap-3 flex-wrap">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                            <input type="text" placeholder="Rechercher…" value={searchQ}
                                onChange={e => { setSearchQ(e.target.value); setJournalPage(1) }}
                                className="w-full bg-white/5 border border-white/10 rounded-xl text-sm text-white pl-9 pr-4 py-2.5 focus:outline-none placeholder-gray-600 focus:border-[#008751]/30" />
                        </div>
                        {journalTab !== 'boutique' && (
                            <select value={agentFilter} onChange={e => { setAgentFilter(e.target.value); setJournalPage(1) }} title="Filtrer par agent"
                                className="bg-white/5 border border-white/10 rounded-xl text-sm text-white px-3 py-2.5 focus:outline-none min-w-[180px]">
                                <option value="tous" className="bg-[#0a0f18]">Tous les agents</option>
                                {agents.map(a => (
                                    <option key={a.id} value={a.id} className="bg-[#0a0f18]">{a.full_name || a.email}</option>
                                ))}
                            </select>
                        )}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    {journalTab === 'docs' && (
                        <table className="w-full min-w-[700px]">
                            <thead><tr className="text-[9px] font-black text-gray-500 uppercase tracking-widest border-b border-white/5">
                                {['N° Document', 'Client', 'Agent', 'Total TTC', 'Solde', 'Statut', 'Sig.', 'Date', ''].map((h, i) => (
                                    <th key={i} className={cn('p-4 font-black', i === 0 ? 'pl-5 text-left' : i === 3 || i === 4 ? 'text-right' : i === 5 || i === 6 ? 'text-center' : i === 7 ? 'text-right' : i === 8 ? 'text-center pr-5' : 'text-left')}>{h}</th>
                                ))}
                            </tr></thead>
                            <tbody className="divide-y divide-white/[0.03]">
                                {pgDocs.length === 0 && <tr><td colSpan={9} className="text-center py-12 text-gray-600 text-sm">Aucune facture</td></tr>}
                                {pgDocs.map(d => {
                                    const ag = agents.find(a => a.id === d.agent_id)
                                    const st = DOC_STATUS[d.status] || { label: d.status, cls: 'bg-gray-500/20 text-gray-400' }
                                    const montantPaye = paiements[d.id] || 0
                                    const solde = d.type === 'facture' ? Math.max(0, d.total - montantPaye) : null
                                    return (
                                        <tr key={d.id} className={cn('hover:bg-white/[0.02] transition-colors cursor-pointer', solde !== null && solde > 0 ? 'border-l-2 border-amber-500/30' : '')} onClick={() => setDetailDoc(d)}>
                                            <td className="p-4 pl-5">
                                                <p className="text-xs font-bold text-white font-mono">{d.numero}</p>
                                                <p className="text-[9px] text-gray-600 capitalize">{d.type}</p>
                                            </td>
                                            <td className="p-4">
                                                <p className="text-xs text-white">{d.client_nom} {d.client_prenom || ''}</p>
                                                <p className="text-[9px] text-gray-600 truncate max-w-[140px]">{d.client_email || d.client_phone || '—'}</p>
                                            </td>
                                            <td className="p-4 text-[10px] text-gray-400 truncate max-w-[110px]">{ag?.full_name || ag?.email || '—'}</td>
                                            <td className="p-4 text-right font-mono text-sm text-white font-bold">{fmt(d.total, d.currency)}</td>
                                            <td className="p-4 text-right font-mono text-xs">
                                                {solde !== null ? (
                                                    solde > 0
                                                        ? <span className="text-amber-400 font-bold">{fmt(solde)}</span>
                                                        : <span className="text-[#00c870]">✓ Soldé</span>
                                                ) : <span className="text-gray-600">—</span>}
                                            </td>
                                            <td className="p-4 text-center"><span className={cn('text-[9px] font-bold px-2 py-0.5 rounded-full', st.cls)}>{st.label}</span></td>
                                            <td className="p-4 text-center">
                                                {d.signed_at ? <Shield size={11} className="text-purple-400 mx-auto" /> : <span className="text-gray-700">—</span>}
                                            </td>
                                            <td className="p-4 text-right text-[10px] text-gray-500 font-mono">{fmtDate(d.created_at)}</td>
                                            <td className="p-4 pr-5 text-center" onClick={e => e.stopPropagation()}>
                                                {d.type === 'facture' && solde !== null && solde > 0 && !periodLocked && (
                                                    <button
                                                        type="button"
                                                        title="Enregistrer un paiement"
                                                        onClick={() => { setPaymentDoc(d); setNewPayment(p => ({ ...p, montant: String(solde) })); setShowPaymentModal(true) }}
                                                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-all text-[9px] font-bold border border-emerald-500/20 whitespace-nowrap"
                                                    >
                                                        <Banknote size={11} /> Encaisser
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    )}
                    {journalTab === 'boutique' && (
                        <table className="w-full min-w-[640px]">
                            <thead><tr className="text-[9px] font-black text-gray-500 uppercase tracking-widest border-b border-white/5">
                                {['Client', 'Produit', 'Montant', 'Méthode', 'Statut', 'Date'].map((h, i) => (
                                    <th key={h} className={cn('p-4 font-black', i === 0 ? 'pl-5 text-left' : i === 5 ? 'text-right pr-5' : i === 2 ? 'text-right' : i === 4 ? 'text-center' : 'text-left')}>{h}</th>
                                ))}
                            </tr></thead>
                            <tbody className="divide-y divide-white/[0.03]">
                                {pgOrders.length === 0 && <tr><td colSpan={6} className="text-center py-12 text-gray-600 text-sm">Aucune commande</td></tr>}
                                {pgOrders.map(o => {
                                    const st = ORDER_STATUS[o.payment_status] || { label: o.payment_status, cls: 'bg-gray-500/20 text-gray-400' }
                                    return (
                                        <tr key={o.id} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="p-4 pl-5"><p className="text-xs text-white">{o.customer_name || '—'}</p><p className="text-[9px] text-gray-600 truncate max-w-[140px]">{o.customer_email || '—'}</p></td>
                                            <td className="p-4 text-[10px] text-gray-400 truncate max-w-[180px]">{o.product_title || '—'}</td>
                                            <td className="p-4 text-right font-mono text-sm text-white font-bold">{fmt(o.amount, o.currency)}</td>
                                            <td className="p-4 text-[10px] text-gray-500 uppercase">{o.payment_method || '—'}</td>
                                            <td className="p-4 text-center"><span className={cn('text-[9px] font-bold px-2 py-0.5 rounded-full', st.cls)}>{st.label}</span></td>
                                            <td className="p-4 pr-5 text-right text-[10px] text-gray-500 font-mono">{fmtDate(o.created_at)}</td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    )}
                    {journalTab === 'depenses' && (
                        <table className="w-full min-w-[560px]">
                            <thead><tr className="text-[9px] font-black text-gray-500 uppercase tracking-widest border-b border-white/5">
                                {['Titre', 'Catégorie', 'Agent', 'Montant', 'Date', 'Notes'].map((h, i) => (
                                    <th key={h} className={cn('p-4 font-black', i === 0 ? 'pl-5 text-left' : i === 4 ? 'text-right' : i === 3 ? 'text-right' : i === 5 ? 'text-left pr-5' : 'text-left')}>{h}</th>
                                ))}
                            </tr></thead>
                            <tbody className="divide-y divide-white/[0.03]">
                                {pgDeps.length === 0 && <tr><td colSpan={6} className="text-center py-12 text-gray-600 text-sm">Aucune dépense</td></tr>}
                                {pgDeps.map(d => {
                                    const ag = agents.find(a => a.id === d.agent_id)
                                    return (
                                        <tr key={d.id} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="p-4 pl-5 text-xs text-white font-medium">{d.titre}</td>
                                            <td className="p-4"><span className="text-[9px] font-bold bg-white/5 text-gray-400 px-2 py-0.5 rounded-full capitalize">{d.categorie}</span></td>
                                            <td className="p-4 text-[10px] text-gray-500 truncate max-w-[120px]">{ag?.full_name || ag?.email || '—'}</td>
                                            <td className="p-4 text-right font-mono text-sm text-red-400 font-bold">−{fmt(Number(d.montant))}</td>
                                            <td className="p-4 text-right text-[10px] text-gray-500 font-mono">{fmtDate(d.date_depense)}</td>
                                            <td className="p-4 pr-5 text-[10px] text-gray-600 truncate max-w-[160px]">{d.notes || '—'}</td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Pagination */}
                {jCount > ITEMS && (
                    <div className="flex items-center justify-between p-4 border-t border-white/5">
                        <span className="text-[10px] text-gray-600">
                            Affichage {Math.min((journalPage - 1) * ITEMS + 1, jCount)}–{Math.min(journalPage * ITEMS, jCount)} sur {jCount} entrées · Page {journalPage}/{totalPages}
                        </span>
                        <div className="flex gap-1 items-center">
                            <button type="button" title="Première page" onClick={() => setJournalPage(1)} disabled={journalPage === 1}
                                className="w-8 h-8 rounded-lg bg-white/5 text-gray-400 hover:text-white disabled:opacity-30 flex items-center justify-center transition-colors text-[9px] font-black">
                                «
                            </button>
                            <button type="button" title="Page précédente" onClick={() => setJournalPage(p => Math.max(1, p - 1))} disabled={journalPage === 1}
                                className="w-8 h-8 rounded-lg bg-white/5 text-gray-400 hover:text-white disabled:opacity-30 flex items-center justify-center transition-colors">
                                <ChevronLeft size={14} />
                            </button>
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                const p = Math.max(1, Math.min(totalPages - 4, journalPage - 2)) + i
                                return p <= totalPages ? (
                                    <button key={p} type="button" onClick={() => setJournalPage(p)}
                                        className={cn('w-8 h-8 rounded-lg text-[10px] font-bold transition-all',
                                            p === journalPage ? 'bg-[#008751] text-white' : 'bg-white/5 text-gray-400 hover:text-white')}>
                                        {p}
                                    </button>
                                ) : null
                            })}
                            <button type="button" title="Page suivante" onClick={() => setJournalPage(p => Math.min(totalPages, p + 1))} disabled={journalPage === totalPages}
                                className="w-8 h-8 rounded-lg bg-white/5 text-gray-400 hover:text-white disabled:opacity-30 flex items-center justify-center transition-colors">
                                <ChevronRight size={14} />
                            </button>
                            <button type="button" title="Dernière page" onClick={() => setJournalPage(totalPages)} disabled={journalPage === totalPages}
                                className="w-8 h-8 rounded-lg bg-white/5 text-gray-400 hover:text-white disabled:opacity-30 flex items-center justify-center transition-colors text-[9px] font-black">
                                »
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* PAYMENT MODAL — Admin */}
        <AnimatePresence>
            {showPaymentModal && paymentDoc && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                    onClick={() => setShowPaymentModal(false)}>
                    <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
                        onClick={e => e.stopPropagation()}
                        className="bg-[#0d1421] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden">
                        <div className="p-6 border-b border-white/5 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-black text-white">Enregistrer un Paiement</h3>
                                <p className="text-xs text-gray-500 mt-0.5">{paymentDoc.numero} — {paymentDoc.client_nom} {paymentDoc.client_prenom || ''}</p>
                            </div>
                            <button type="button" title="Fermer" onClick={() => setShowPaymentModal(false)} className="text-gray-500 hover:text-white"><X size={20} /></button>
                        </div>
                        <div className="px-6 pt-4 pb-0">
                            <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/10">
                                <span className="text-xs text-gray-500">Solde restant</span>
                                <span className="text-base font-black text-amber-400">{fmt(Math.max(0, paymentDoc.total - (paiements[paymentDoc.id] || 0)), paymentDoc.currency)}</span>
                            </div>
                        </div>
                        <form onSubmit={handleAddPayment} className="p-6 space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Mode de paiement</label>
                                <div className="grid grid-cols-4 gap-2">
                                    {[
                                        { val: 'virement', icon: CreditCard, label: 'Virement' },
                                        { val: 'especes', icon: Banknote, label: 'Espèces' },
                                        { val: 'cheque', icon: FileText, label: 'Chèque' },
                                        { val: 'autre', icon: Wallet, label: 'Autre' },
                                    ].map(opt => (
                                        <button key={opt.val} type="button" onClick={() => setNewPayment(p => ({ ...p, type: opt.val }))}
                                            className={cn('flex flex-col items-center gap-1.5 py-3 rounded-xl border text-[10px] font-bold transition-all',
                                                newPayment.type === opt.val ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'bg-white/5 border-white/10 text-gray-500 hover:border-white/20 hover:text-white')}>
                                            <opt.icon size={16} />
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Montant</label>
                                    <input required type="number" min="1" value={newPayment.montant} onChange={e => setNewPayment(p => ({ ...p, montant: e.target.value }))}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-emerald-500/50 outline-none text-sm font-mono" placeholder="0" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Date</label>
                                    <input type="date" title="Date du paiement" value={newPayment.date} onChange={e => setNewPayment(p => ({ ...p, date: e.target.value }))}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-emerald-500/50 outline-none text-sm" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Référence <span className="normal-case text-gray-600">(optionnel)</span></label>
                                <input type="text" value={newPayment.reference} onChange={e => setNewPayment(p => ({ ...p, reference: e.target.value }))}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-emerald-500/50 outline-none text-sm" placeholder="N° de virement, chèque..." />
                            </div>
                            <button disabled={savingPayment || !newPayment.montant} type="submit"
                                className="w-full py-4 bg-emerald-500 text-white font-black rounded-xl hover:bg-emerald-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-2">
                                {savingPayment ? <RefreshCw size={18} className="animate-spin" /> : <Banknote size={18} />} Confirmer l&apos;encaissement
                            </button>
                        </form>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
        </div>
    )
}
