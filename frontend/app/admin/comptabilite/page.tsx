'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import * as ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import {
    Wallet, TrendingDown, ArrowUpRight, ArrowDownRight, Download,
    BarChart3, FileText, RefreshCw, Users, ShoppingBag,
    AlertTriangle, Award, Search, Target, Activity, Star,
    Calculator, Landmark, Receipt, ChevronLeft, ChevronRight,
    Zap, PieChart, CheckCircle2, Clock, TrendingUp
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area, BarChart, Bar, Cell,
} from 'recharts'

// ─── Types ──────────────────────────────────────────────────────────
type Period = 'ce_mois' | '3_mois' | '6_mois' | 'annee' | 'tous'

interface AgentRow {
    id: string
    full_name: string
    email: string
    role: string
    is_active: boolean
}

interface DocRow {
    id: string
    type: 'devis' | 'facture'
    numero: string
    client_nom: string
    client_prenom?: string
    client_email?: string
    client_phone?: string
    total: number
    status: string
    created_at: string
    agent_id: string
    currency?: string
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
}

// ─── Helpers période ────────────────────────────────────────────────
function getPeriodRange(p: Period): { start: Date; end: Date } {
    const now = new Date()
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
    switch (p) {
        case 'ce_mois': return { start: new Date(now.getFullYear(), now.getMonth(), 1), end }
        case '3_mois':  return { start: new Date(now.getTime() - 90  * 864e5), end }
        case '6_mois':  return { start: new Date(now.getTime() - 180 * 864e5), end }
        case 'annee':   return { start: new Date(now.getFullYear(), 0, 1), end }
        default:        return { start: new Date(0), end }
    }
}

function getPrevPeriodRange(p: Period): { start: Date; end: Date } {
    const now = new Date()
    if (p === 'ce_mois') return { start: new Date(now.getFullYear(), now.getMonth() - 1, 1), end: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59) }
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

const fmt = (val: number, currency = 'XOF') =>
    new Intl.NumberFormat('fr-BJ', { style: 'currency', currency, maximumFractionDigits: 0 }).format(val)

const fmtDate = (str: string) =>
    new Date(str).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' })

// ─── Status maps ────────────────────────────────────────────────────
const DOC_STATUS: Record<string, { label: string; cls: string }> = {
    brouillon: { label: 'Brouillon', cls: 'bg-gray-500/20 text-gray-400' },
    envoye:    { label: 'Envoyé',    cls: 'bg-blue-500/20 text-blue-300' },
    accepte:   { label: 'Accepté',   cls: 'bg-yellow-500/20 text-yellow-300' },
    paye:      { label: 'Payé',      cls: 'bg-[#008751]/20 text-[#00c870]' },
    refuse:    { label: 'Refusé',    cls: 'bg-red-500/20 text-red-400' },
    annule:    { label: 'Annulé',    cls: 'bg-red-900/20 text-red-600' },
}

const ORDER_STATUS: Record<string, { label: string; cls: string }> = {
    pending:   { label: 'En attente', cls: 'bg-yellow-500/20 text-yellow-300' },
    completed: { label: 'Payé',       cls: 'bg-[#008751]/20 text-[#00c870]' },
    failed:    { label: 'Échoué',     cls: 'bg-red-500/20 text-red-400' },
    cancelled: { label: 'Annulé',     cls: 'bg-gray-500/20 text-gray-400' },
    shipped:   { label: 'Expédié',    cls: 'bg-blue-500/20 text-blue-300' },
    delivered: { label: 'Livré',      cls: 'bg-purple-500/20 text-purple-300' },
}

const DEP_COLORS = ['#008751', '#FCD116', '#3b82f6', '#8b5cf6', '#f97316', '#E8112D', '#0891b2', '#d97706']

// ─── KPI Card ───────────────────────────────────────────────────────
type LucideIcon = React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>

function KpiCard({ icon: Icon, label, value, trend, color, sub }: {
    icon: LucideIcon; label: string; value: string; trend?: string | null; color: string; sub?: string
}) {
    const trendNum = trend ? parseFloat(trend) : null
    return (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="bg-[#0a0f18] border border-white/5 rounded-2xl p-5 flex flex-col gap-3 hover:border-white/10 transition-colors">
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

// ─── Main ────────────────────────────────────────────────────────────
export default function AdminComptabilitePage() {
    const [period, setPeriod]       = useState<Period>('tous')
    const [loading, setLoading]     = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [exporting, setExporting] = useState(false)

    const [agents, setAgents]       = useState<AgentRow[]>([])
    const [docs, setDocs]           = useState<DocRow[]>([])
    const [orders, setOrders]       = useState<OrderRow[]>([])
    const [depenses, setDepenses]   = useState<DepRow[]>([])
    const [commissionRate, setCommissionRate] = useState(0.10)

    const [journalTab, setJournalTab]   = useState<'docs' | 'boutique' | 'depenses'>('docs')
    const [searchQ, setSearchQ]         = useState('')
    const [sortAgent, setSortAgent]     = useState<'encaisse' | 'commission' | 'docs'>('encaisse')
    const [journalPage, setJournalPage] = useState(1)
    const [agentFilter, setAgentFilter] = useState('tous')
    const ITEMS = 10

    // ── Fetch ─────────────────────────────────────────────────────
    // Toutes les requêtes passent par des API routes server-side (service role key)
    // pour bypasser les RLS Supabase côté client
    const fetchAll = useCallback(async () => {
        setRefreshing(true)
        const [usersRes, erpRes] = await Promise.all([
            fetch('/api/admin/users').then(r => r.ok ? r.json() : { users: [] }),
            fetch('/api/admin/comptabilite').then(r => r.ok ? r.json() : { docs: [], orders: [], depenses: [], settings: null }),
        ])

        // Agents: filtre role agent/admin/superadmin
        const allUsers: AgentRow[] = (usersRes.users || []).filter((u: AgentRow) =>
            ['agent', 'admin', 'superadmin', 'super_admin'].includes(u.role)
        )
        setAgents(allUsers)

        setDocs(erpRes.docs || [])
        setOrders(erpRes.orders || [])
        setDepenses(erpRes.depenses || [])
        if (erpRes.commissionRate) setCommissionRate(erpRes.commissionRate)
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
    const pvDocs   = useMemo(() => docs.filter(d => inRange(d.created_at, pS, pE)), [docs, pS, pE])
    const pvOrders = useMemo(() => orders.filter(o => inRange(o.created_at, pS, pE)), [orders, pS, pE])
    const pvDeps   = useMemo(() => depenses.filter(d => inRange(d.date_depense, pS, pE)), [depenses, pS, pE])

    // ── KPIs globaux ──────────────────────────────────────────────
    const kpis = useMemo(() => {
        const calc = (dList: DocRow[], oList: OrderRow[], deps: DepRow[]) => {
            const invoices      = dList.filter(d => d.type === 'facture')
            const encaisseFactu = invoices.filter(d => d.status === 'paye').reduce((a, d) => a + d.total, 0)
            const enAttente     = invoices.filter(d => ['envoye', 'accepte'].includes(d.status)).reduce((a, d) => a + d.total, 0)
            const boutique      = oList.filter(o => o.payment_status === 'completed').reduce((a, o) => a + o.amount, 0)
            const totalEncaisse = encaisseFactu + boutique
            const commission    = Math.round(encaisseFactu * commissionRate)
            const totalDeps     = deps.reduce((a, d) => a + Number(d.montant), 0)
            const caEmis        = invoices.reduce((a, d) => a + d.total, 0)
            const jours         = Math.max(1, (end.getTime() - start.getTime()) / 864e5)
            const nbFactPaye    = invoices.filter(d => d.status === 'paye').length
            const nbFactTotal   = invoices.length
            return { encaisseFactu, boutique, totalEncaisse, enAttente, commission, totalDeps, caEmis, benefice: totalEncaisse - commission - totalDeps, proj30: (totalEncaisse / jours) * 30, nbFactPaye, nbFactTotal }
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
            }
        }
    }, [pDocs, pOrders, pDeps, pvDocs, pvOrders, pvDeps, commissionRate, period, start, end])

    // ── Score santé financière ────────────────────────────────────
    const scoreSante = useMemo(() => {
        const tauxEncaissement = kpis.caEmis > 0 ? (kpis.encaisseFactu / kpis.caEmis) * 100 : 0
        const tauxRentabilite  = kpis.totalEncaisse > 0 ? Math.max(0, (kpis.benefice / kpis.totalEncaisse)) * 100 : 0
        const tauxConvOrders   = orders.length > 0 ? (pOrders.filter(o => o.payment_status === 'completed').length / Math.max(1, pOrders.length)) * 100 : 50
        const score = Math.round(tauxEncaissement * 0.40 + tauxRentabilite * 0.35 + tauxConvOrders * 0.25)
        const capped = Math.min(100, Math.max(0, score))
        return {
            score: capped,
            label: capped >= 80 ? 'Excellente' : capped >= 60 ? 'Bonne' : capped >= 40 ? 'Correcte' : 'Critique',
            color: capped >= 80 ? '#00c870' : capped >= 60 ? '#008751' : capped >= 40 ? '#FCD116' : '#E8112D',
            tauxEncaissement: tauxEncaissement.toFixed(0),
            tauxRentabilite:  tauxRentabilite.toFixed(0),
        }
    }, [kpis, orders, pOrders])

    // ── Alertes intelligentes ─────────────────────────────────────
    const alertes = useMemo(() => {
        const list: { type: 'warning' | 'danger' | 'info'; msg: string }[] = []
        const now = new Date()
        // Factures en retard > 7j sans paiement
        const retard = pDocs.filter(d => d.type === 'facture' && ['envoye', 'accepte'].includes(d.status) && (now.getTime() - new Date(d.created_at).getTime()) > 7 * 864e5)
        if (retard.length > 0) list.push({ type: 'warning', msg: `${retard.length} facture${retard.length > 1 ? 's' : ''} en attente depuis plus de 7 jours — ${fmt(retard.reduce((a, d) => a + d.total, 0))} à relancer` })
        // Bénéfice négatif
        if (kpis.benefice < 0) list.push({ type: 'danger', msg: `Bénéfice net négatif (${fmt(kpis.benefice)}) — dépenses supérieures aux encaissements` })
        // Agents avec 0 encaissement sur la période
        const agentStats_raw = agents.filter(a => a.role === 'agent' && !pDocs.some(d => d.agent_id === a.id && d.type === 'facture' && d.status === 'paye'))
        if (agentStats_raw.length > 0 && agents.filter(a => a.role === 'agent').length > 0) {
            list.push({ type: 'info', msg: `${agentStats_raw.length} agent${agentStats_raw.length > 1 ? 's' : ''} sans encaissement sur cette période` })
        }
        // Commandes boutique en attente > 24h
        const commandesRetard = pOrders.filter(o => o.payment_status === 'pending' && (now.getTime() - new Date(o.created_at).getTime()) > 864e5)
        if (commandesRetard.length > 0) list.push({ type: 'warning', msg: `${commandesRetard.length} commande${commandesRetard.length > 1 ? 's' : ''} boutique en attente depuis + de 24h` })
        // Taux encaissement faible
        if (kpis.caEmis > 0 && (kpis.encaisseFactu / kpis.caEmis) < 0.3) list.push({ type: 'danger', msg: `Taux d'encaissement bas (${((kpis.encaisseFactu / kpis.caEmis) * 100).toFixed(0)}%) — plus de 70% du CA émis n'est pas encore encaissé` })
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
        // Construire la map avec agents connus + agents trouvés dans les docs (fallback)
        const map = new Map<string, { agent: AgentRow; caEmis: number; encaisse: number; enAttente: number; commission: number; depenses: number; benefice: number; nbDevis: number; nbFactures: number; nbPayees: number }>()

        for (const a of agents) {
            map.set(a.id, { agent: a, caEmis: 0, encaisse: 0, enAttente: 0, commission: 0, depenses: 0, benefice: 0, nbDevis: 0, nbFactures: 0, nbPayees: 0 })
        }
        for (const d of pDocs) {
            if (!map.has(d.agent_id)) {
                // Agent inconnu dans user_profiles → crée une entrée fallback
                map.set(d.agent_id, { agent: { id: d.agent_id, full_name: '', email: d.agent_id.slice(0, 8) + '…', role: 'agent', is_active: true }, caEmis: 0, encaisse: 0, enAttente: 0, commission: 0, depenses: 0, benefice: 0, nbDevis: 0, nbFactures: 0, nbPayees: 0 })
            }
            const s = map.get(d.agent_id)!
            if (d.type === 'devis') { s.nbDevis++ } else {
                s.nbFactures++; s.caEmis += d.total
                if (d.status === 'paye') { s.encaisse += d.total; s.nbPayees++ }
                if (['envoye', 'accepte'].includes(d.status)) s.enAttente += d.total
            }
        }
        for (const dep of pDeps) {
            if (map.has(dep.agent_id)) map.get(dep.agent_id)!.depenses += Number(dep.montant)
        }
        for (const [, s] of map) {
            s.commission = Math.round(s.encaisse * commissionRate)
            s.benefice = s.encaisse - s.commission - s.depenses
        }
        return [...map.values()].filter(s => s.caEmis > 0 || s.nbDevis > 0 || s.depenses > 0)
    }, [agents, pDocs, pDeps, commissionRate])

    // ── Charts ────────────────────────────────────────────────────
    const areaData = useMemo(() => {
        const days: Record<string, { factu: number; boutique: number }> = {}
        for (const d of pDocs.filter(d => d.status === 'paye' && d.type === 'facture')) {
            const k = new Date(d.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
            if (!days[k]) days[k] = { factu: 0, boutique: 0 }
            days[k].factu += d.total
        }
        for (const o of pOrders.filter(o => o.payment_status === 'completed')) {
            const k = new Date(o.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
            if (!days[k]) days[k] = { factu: 0, boutique: 0 }
            days[k].boutique += o.amount
        }
        return Object.entries(days).slice(-30).map(([name, v]) => ({ name, ...v }))
    }, [pDocs, pOrders])

    const agentBarData = useMemo(() =>
        [...agentStats].sort((a, b) => b.encaisse - a.encaisse).slice(0, 8).map(s => ({
            name: (s.agent.full_name || s.agent.email.split('@')[0]).slice(0, 13),
            encaisse: s.encaisse, commission: s.commission,
        })), [agentStats])

    const sortedAgents = useMemo(() => {
        const list = [...agentStats]
        if (sortAgent === 'encaisse')   return list.sort((a, b) => b.encaisse - a.encaisse)
        if (sortAgent === 'commission') return list.sort((a, b) => b.commission - a.commission)
        return list.sort((a, b) => (b.nbDevis + b.nbFactures) - (a.nbDevis + a.nbFactures))
    }, [agentStats, sortAgent])

    // ── Journal ───────────────────────────────────────────────────
    const jDocs = useMemo(() => {
        let list = pDocs.filter(d => d.type === 'facture')
        if (agentFilter !== 'tous') list = list.filter(d => d.agent_id === agentFilter)
        if (searchQ) { const q = searchQ.toLowerCase(); list = list.filter(d => (`${d.client_nom} ${d.client_prenom || ''} ${d.numero}`).toLowerCase().includes(q)) }
        return list
    }, [pDocs, agentFilter, searchQ])

    const jOrders = useMemo(() => {
        let list = pOrders
        if (searchQ) { const q = searchQ.toLowerCase(); list = list.filter(o => (`${o.customer_name} ${o.product_title}`).toLowerCase().includes(q)) }
        return list
    }, [pOrders, searchQ])

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

    // ── Export Excel multi-feuilles ───────────────────────────────
    const handleMasterExport = async () => {
        setExporting(true)
        try {
            const wb = new ExcelJS.Workbook()
            wb.creator = 'Retour Gagnant ERP Admin'
            wb.created = new Date()

            const GREEN  = 'FF008751'
            const YELLOW = 'FFFCD116'
            const DARK   = 'FF0a1628'
            const WHITE  = 'FFFFFFFF'

            const HDR_STYLE = {
                font: { bold: true, color: { argb: WHITE }, name: 'Arial', size: 10 },
                fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: GREEN } },
                alignment: { horizontal: 'center' as const, vertical: 'middle' as const },
                border: { bottom: { style: 'thin' as const, color: { argb: GREEN } } }
            }

            const addHeader = (ws: ExcelJS.Worksheet, title: string, cols: number) => {
                ws.mergeCells(`A1:${String.fromCharCode(64 + cols)}1`)
                const t = ws.getCell('A1')
                t.value = `RETOUR GAGNANT BENIN — ${title}`
                t.font = { bold: true, size: 14, color: { argb: WHITE }, name: 'Arial' }
                t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK } }
                t.alignment = { horizontal: 'center', vertical: 'middle' }
                ws.getRow(1).height = 32
                ws.mergeCells(`A2:${String.fromCharCode(64 + cols)}2`)
                const s = ws.getCell('A2')
                s.value = `Periode : ${start.toLocaleDateString('fr-FR')} -> ${end.toLocaleDateString('fr-FR')} | Taux commission : ${(commissionRate * 100).toFixed(0)}% | Genere le ${new Date().toLocaleDateString('fr-FR')}`
                s.font = { italic: true, size: 9, color: { argb: 'FF888888' } }
                s.alignment = { horizontal: 'center' }
                ws.getRow(2).height = 16
            }

            const setHeaderRow = (ws: ExcelJS.Worksheet, rowNum: number, values: string[]) => {
                const row = ws.getRow(rowNum)
                row.values = ['', ...values]
                row.height = 22
                row.eachCell((cell, col) => { if (col > 1) Object.assign(cell, HDR_STYLE) })
            }

            const stripe = (row: ExcelJS.Row, i: number) => {
                if (i % 2 === 0) row.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAF8' } } })
            }

            // ── Feuille 1 : Résumé KPI ──
            const ws1 = wb.addWorksheet('Resume Global')
            ws1.columns = [{ width: 2 }, { width: 38 }, { width: 24 }, { width: 30 }]
            addHeader(ws1, 'RAPPORT COMPTABLE GLOBAL', 3)
            setHeaderRow(ws1, 3, ['INDICATEUR', 'MONTANT (FCFA)', 'DETAIL'])

            const kpiRows: [string, number, string][] = [
                ["Chiffre d'Affaires Emis (Factures)", kpis.caEmis, `${pDocs.filter(d => d.type === 'facture').length} factures emises`],
                ['Encaisse - Facturation', kpis.encaisseFactu, `${kpis.nbFactPaye} factures payees`],
                ['Revenus Boutique (Commandes)', kpis.boutique, `${pOrders.filter(o => o.payment_status === 'completed').length} commandes completees`],
                ['TOTAL ENCAISSE (Factu + Boutique)', kpis.totalEncaisse, 'Cumul toutes sources'],
                ['Factures En Attente de Paiement', kpis.enAttente, `${pDocs.filter(d => ['envoye', 'accepte'].includes(d.status)).length} factures en cours`],
                [`Commission Agents (${(commissionRate * 100).toFixed(0)}%)`, kpis.commission, 'Sur encaissements facturation uniquement'],
                ['Depenses Totales', kpis.totalDeps, `${pDeps.length} depenses enregistrees`],
                ['BENEFICE NET', kpis.benefice, 'Encaisse - Commissions - Depenses'],
                ['Projection 30 jours', Math.round(kpis.proj30), 'Basee sur le rythme actuel'],
                ['Score Sante Financiere', scoreSante.score, `${scoreSante.label} (Encaissement ${scoreSante.tauxEncaissement}% / Rentabilite ${scoreSante.tauxRentabilite}%)`],
            ]
            kpiRows.forEach(([label, montant, detail], i) => {
                const r = ws1.addRow(['', label, montant, detail])
                r.getCell(3).numFmt = '#,##0'
                if (label.startsWith('TOTAL') || label.startsWith('BENEFICE')) {
                    r.getCell(2).font = { bold: true, size: 11 }
                    r.getCell(3).font = { bold: true, size: 11, color: { argb: montant < 0 ? 'FFE8112D' : GREEN } }
                }
                stripe(r, i)
            })

            // ── Feuille 2 : Performance Agents ──
            const ws2 = wb.addWorksheet('Performance Agents')
            ws2.columns = [{ width: 2 }, { width: 26 }, { width: 30 }, { width: 20 }, { width: 20 }, { width: 20 }, { width: 20 }, { width: 20 }, { width: 10 }, { width: 12 }, { width: 12 }]
            addHeader(ws2, 'PERFORMANCE PAR AGENT', 10)
            setHeaderRow(ws2, 3, ['Agent', 'Email', 'CA Emis (FCFA)', 'Encaisse (FCFA)', `Commission (${(commissionRate * 100).toFixed(0)}%)`, 'Depenses (FCFA)', 'Benefice Net', 'Devis', 'Factures', 'Conv.%'])
            sortedAgents.forEach((s, i) => {
                const conv = s.nbFactures > 0 ? ((s.nbPayees / s.nbFactures) * 100).toFixed(1) + '%' : '0%'
                const r = ws2.addRow(['', s.agent.full_name || '—', s.agent.email, s.caEmis, s.encaisse, s.commission, s.depenses, s.benefice, s.nbDevis, s.nbFactures, conv])
                ;[4, 5, 6, 7, 8].forEach(col => { r.getCell(col).numFmt = '#,##0' })
                if (s.benefice < 0) r.getCell(8).font = { color: { argb: 'FFE8112D' }, bold: true }
                if (i === 0) r.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF9E6' } } })
                else stripe(r, i)
            })

            // ── Feuille 3 : Journal Documents ──
            const ws3 = wb.addWorksheet('Factures et Devis')
            ws3.columns = [{ width: 2 }, { width: 20 }, { width: 10 }, { width: 28 }, { width: 26 }, { width: 18 }, { width: 20 }, { width: 14 }, { width: 24 }, { width: 14 }]
            addHeader(ws3, 'JOURNAL FACTURES & DEVIS - TOUS AGENTS', 9)
            setHeaderRow(ws3, 3, ['N Document', 'Type', 'Client', 'Email Client', 'Telephone', 'Montant (FCFA)', 'Statut', 'Agent', 'Date'])
            pDocs.forEach((d, i) => {
                const ag = agents.find(a => a.id === d.agent_id)
                const r = ws3.addRow(['', d.numero, d.type === 'facture' ? 'Facture' : 'Devis', `${d.client_nom} ${d.client_prenom || ''}`.trim(), d.client_email || '—', d.client_phone || '—', d.total, DOC_STATUS[d.status]?.label || d.status, ag?.full_name || ag?.email || '—', new Date(d.created_at)])
                r.getCell(7).numFmt = '#,##0'; r.getCell(10).numFmt = 'dd/mm/yyyy'
                if (d.status === 'paye') r.getCell(8).font = { color: { argb: GREEN }, bold: true }
                stripe(r, i)
            })

            // ── Feuille 4 : Commandes Boutique ──
            const ws4 = wb.addWorksheet('Boutique Commandes')
            ws4.columns = [{ width: 2 }, { width: 20 }, { width: 26 }, { width: 28 }, { width: 32 }, { width: 16 }, { width: 10 }, { width: 14 }, { width: 14 }, { width: 14 }]
            addHeader(ws4, 'COMMANDES BOUTIQUE EN LIGNE', 9)
            setHeaderRow(ws4, 3, ['Commande ID', 'Client', 'Email', 'Produit', 'Montant', 'Devise', 'Methode', 'Statut', 'Date'])
            pOrders.forEach((o, i) => {
                const r = ws4.addRow(['', o.id.slice(0, 16) + '…', o.customer_name || '—', o.customer_email || '—', o.product_title || '—', o.amount, o.currency, o.payment_method || '—', ORDER_STATUS[o.payment_status]?.label || o.payment_status, new Date(o.created_at)])
                r.getCell(6).numFmt = '#,##0'; r.getCell(10).numFmt = 'dd/mm/yyyy'
                if (o.payment_status === 'completed') r.getCell(9).font = { color: { argb: GREEN }, bold: true }
                stripe(r, i)
            })

            // ── Feuille 5 : Dépenses ──
            const ws5 = wb.addWorksheet('Depenses')
            ws5.columns = [{ width: 2 }, { width: 34 }, { width: 22 }, { width: 20 }, { width: 14 }, { width: 26 }]
            addHeader(ws5, 'JOURNAL DES DEPENSES - TOUS AGENTS', 5)
            setHeaderRow(ws5, 3, ['Titre', 'Categorie', 'Montant (FCFA)', 'Date', 'Agent'])
            pDeps.forEach((d, i) => {
                const ag = agents.find(a => a.id === d.agent_id)
                const r = ws5.addRow(['', d.titre, d.categorie, Number(d.montant), new Date(d.date_depense), ag?.full_name || ag?.email || '—'])
                r.getCell(4).numFmt = '#,##0'; r.getCell(5).numFmt = 'dd/mm/yyyy'
                stripe(r, i)
            })

            // Exporter
            const buf = await wb.xlsx.writeBuffer()
            saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
                `RG_Comptabilite_${new Date().toISOString().slice(0, 10)}.xlsx`)
        } catch (err) {
            console.error('[Export Excel]', err)
        } finally {
            setExporting(false)
        }
    }

    // ────────────────────────────────────────────────────────────────
    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-2 border-[#FCD116] border-t-transparent rounded-full animate-spin" />
                <p className="text-gray-500 text-sm">Chargement des données ERP…</p>
            </div>
        </div>
    )

    return (
        <div className="space-y-8 max-w-7xl mx-auto pb-12">

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
                    <p className="text-gray-500 text-sm mt-1">
                        {agents.filter(a => a.role === 'agent').length} agents · {docs.length} documents · {orders.length} commandes · commission {(commissionRate * 100).toFixed(0)}%
                    </p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex gap-1 bg-white/5 rounded-xl p-1">
                        {(['ce_mois', '3_mois', '6_mois', 'annee', 'tous'] as Period[]).map(p => (
                            <button key={p} type="button" onClick={() => { setPeriod(p); setJournalPage(1) }}
                                className={cn('text-[10px] font-bold px-3 py-2 rounded-lg transition-all',
                                    period === p ? 'bg-[#FCD116] text-[#0a0f18]' : 'text-gray-400 hover:text-white')}>
                                {p === 'ce_mois' ? 'Ce mois' : p === '3_mois' ? '3 mois' : p === '6_mois' ? '6 mois' : p === 'annee' ? 'Année' : 'Tout'}
                            </button>
                        ))}
                    </div>
                    <button type="button" onClick={fetchAll} disabled={refreshing} title="Rafraîchir"
                        className="p-3 rounded-xl bg-white/5 border border-white/5 text-gray-400 hover:text-white transition-colors disabled:opacity-40">
                        <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
                    </button>
                    <button type="button" onClick={handleMasterExport} disabled={exporting}
                        className="flex items-center gap-2 bg-[#FCD116] text-[#0a0f18] hover:bg-[#e6bc00] font-black text-xs px-5 py-3 rounded-xl transition-all disabled:opacity-60 shadow-[0_0_24px_rgba(252,209,22,0.2)]">
                        {exporting
                            ? <div className="w-4 h-4 border-2 border-[#0a0f18] border-t-transparent rounded-full animate-spin" />
                            : <Download size={14} />}
                        Export Excel (5 feuilles)
                    </button>
                </div>
            </div>

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
                    <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-500">
                        <div>Taux encaissement <span className="font-bold text-white">{scoreSante.tauxEncaissement}%</span></div>
                        <div>Taux rentabilité <span className="font-bold text-white">{scoreSante.tauxRentabilite}%</span></div>
                    </div>
                </div>

                {/* Alertes */}
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
                                <div key={i} className={cn('flex items-start gap-2.5 px-4 py-2.5 rounded-xl text-xs',
                                    a.type === 'danger' ? 'bg-red-500/10 text-red-300 border border-red-500/10' :
                                    a.type === 'warning' ? 'bg-yellow-500/10 text-yellow-300 border border-yellow-500/10' :
                                    'bg-blue-500/10 text-blue-300 border border-blue-500/10')}>
                                    {a.type === 'danger' ? <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" /> :
                                     a.type === 'warning' ? <Clock size={13} className="flex-shrink-0 mt-0.5" /> :
                                     <Activity size={13} className="flex-shrink-0 mt-0.5" />}
                                    {a.msg}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ── KPI GRID ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard icon={BarChart3}     label="CA Émis (Factures)"    value={fmt(kpis.caEmis)}        color="#FCD116" sub={`${pDocs.filter(d => d.type === 'facture').length} factures`} />
                <KpiCard icon={Wallet}        label="Total Encaissé"         value={fmt(kpis.totalEncaisse)} trend={kpis.trends?.encaisse}  color="#008751" sub="Facturation + Boutique" />
                <KpiCard icon={ShoppingBag}   label="Revenus Boutique"       value={fmt(kpis.boutique)}      trend={kpis.trends?.boutique}  color="#3b82f6" sub={`${pOrders.filter(o => o.payment_status === 'completed').length} commandes`} />
                <KpiCard icon={AlertTriangle} label="En Attente Paiement"    value={fmt(kpis.enAttente)}     trend={kpis.trends?.enAttente} color="#f97316" sub={`${pDocs.filter(d => ['envoye', 'accepte'].includes(d.status)).length} factures`} />
                <KpiCard icon={Users}         label={`Commissions (${(commissionRate * 100).toFixed(0)}%)`} value={fmt(kpis.commission)} color="#8b5cf6" sub="Sur encaissements facturation" />
                <KpiCard icon={TrendingDown}  label="Dépenses Totales"       value={fmt(kpis.totalDeps)}     color="#E8112D" sub={`${pDeps.length} dépenses`} />
                <KpiCard icon={Award}         label="Bénéfice Net"           value={fmt(kpis.benefice)}      trend={kpis.trends?.benefice}  color={kpis.benefice >= 0 ? '#00c870' : '#E8112D'} sub="Après comm. et dépenses" />
                <KpiCard icon={Target}        label="Projection 30 jours"    value={fmt(Math.round(kpis.proj30))} color="#FCD116" sub="Basée sur rythme actuel" />
            </div>

            {/* ── CHARTS ROW ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Area flux trésorerie */}
                <div className="lg:col-span-2 bg-[#0a0f18] border border-white/5 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Flux de Trésorerie</p>
                            <p className="text-sm font-bold text-white mt-0.5">Encaissements quotidiens</p>
                        </div>
                        <Activity size={16} className="text-[#008751]" />
                    </div>
                    {areaData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={200}>
                            <AreaChart data={areaData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="gF" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#008751" stopOpacity={0.35} /><stop offset="95%" stopColor="#008751" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="gB" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} /><stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                                <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                                <Tooltip contentStyle={{ background: '#0d1421', border: '1px solid #ffffff12', borderRadius: 12 }} labelStyle={{ color: '#fff', fontWeight: 700 }}
                                    formatter={(v, name) => [fmt(Number(v)), name === 'factu' ? 'Facturation' : 'Boutique']} />
                                <Area type="monotone" dataKey="factu"    stroke="#008751" strokeWidth={2} fill="url(#gF)" name="factu" />
                                <Area type="monotone" dataKey="boutique" stroke="#3b82f6" strokeWidth={2} fill="url(#gB)" name="boutique" />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-[200px] flex flex-col items-center justify-center text-gray-600 gap-2">
                            <TrendingUp size={28} strokeWidth={1} />
                            <p className="text-sm">Aucun encaissement sur cette période</p>
                        </div>
                    )}
                    <div className="flex gap-4 mt-3">
                        {[{ color: '#008751', label: 'Facturation' }, { color: '#3b82f6', label: 'Boutique' }].map(l => (
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
                        <div className="space-y-2">
                            {depParCat.slice(0, 6).map((cat, i) => {
                                const pct = kpis.totalDeps > 0 ? (cat.value / kpis.totalDeps) * 100 : 0
                                return (
                                    <div key={cat.name}>
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-[10px] text-gray-400 capitalize truncate max-w-[100px]">{cat.name}</span>
                                            <span className="text-[10px] font-bold font-mono text-white">{fmt(cat.value)}</span>
                                        </div>
                                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: DEP_COLORS[i % DEP_COLORS.length] }} />
                                        </div>
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

            {/* ── TOP AGENTS BAR ── */}
            {agentBarData.length > 0 && (
                <div className="bg-[#0a0f18] border border-white/5 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Top Agents</p>
                            <p className="text-sm font-bold text-white mt-0.5">Encaissé vs Commission due</p>
                        </div>
                        <Star size={16} className="text-[#FCD116]" />
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={agentBarData} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" horizontal={false} />
                            <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 9 }} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} axisLine={false} tickLine={false} />
                            <YAxis type="category" dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} width={72} />
                            <Tooltip contentStyle={{ background: '#0d1421', border: '1px solid #ffffff12', borderRadius: 12 }}
                                formatter={(v, name) => [fmt(Number(v)), name === 'encaisse' ? 'Encaissé' : 'Commission']} />
                            <Bar dataKey="encaisse"   fill="#008751" radius={[0, 4, 4, 0]} name="encaisse">
                                {agentBarData.map((_, i) => <Cell key={i} fill={i === 0 ? '#00c870' : '#008751'} />)}
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
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px]">
                        <thead>
                            <tr className="text-[9px] font-black text-gray-500 uppercase tracking-widest border-b border-white/5">
                                {['#', 'Agent', 'CA Émis', 'Encaissé', 'Commission', 'Dépenses', 'Bénéfice', 'Docs', 'Conv.'].map((h, i) => (
                                    <th key={h} className={cn('p-4 font-black', i === 0 ? 'pl-5 text-left w-10' : i === 1 ? 'text-left' : i === 8 ? 'text-right pr-5' : 'text-right')}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.03]">
                            {sortedAgents.length === 0 && (
                                <tr><td colSpan={9} className="text-center py-12 text-gray-600 text-sm">Aucune donnée agent sur cette période</td></tr>
                            )}
                            {sortedAgents.map((s, i) => {
                                const conv = s.nbFactures > 0 ? (s.nbPayees / s.nbFactures) * 100 : 0
                                const initials = (s.agent.full_name || s.agent.email).slice(0, 2).toUpperCase()
                                return (
                                    <tr key={s.agent.id} className="hover:bg-white/[0.02] transition-colors">
                                        <td className="p-4 pl-5">
                                            <span className={cn('text-[11px] font-black font-mono', i === 0 ? 'text-[#FCD116]' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-orange-400' : 'text-gray-600')}>
                                                #{i + 1}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-7 h-7 rounded-lg bg-[#008751]/20 border border-[#008751]/20 flex items-center justify-center text-[10px] font-black text-[#008751] flex-shrink-0">
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
                                        <td className="p-4 text-right font-mono text-[11px] text-red-400">{fmt(s.depenses)}</td>
                                        <td className={cn('p-4 text-right font-mono text-[11px] font-bold', s.benefice >= 0 ? 'text-[#00c870]' : 'text-red-400')}>{fmt(s.benefice)}</td>
                                        <td className="p-4 text-right font-mono text-[11px] text-gray-500">{s.nbDevis}d&nbsp;/&nbsp;{s.nbFactures}f</td>
                                        <td className="p-4 pr-5 text-right">
                                            <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', conv >= 70 ? 'bg-[#008751]/15 text-[#00c870]' : conv >= 40 ? 'bg-yellow-500/15 text-yellow-300' : 'bg-red-500/15 text-red-400')}>
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
            <div className="bg-[#0a0f18] border border-white/5 rounded-2xl overflow-hidden">
                <div className="p-5 border-b border-white/5 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <FileText size={16} className="text-[#008751]" />
                            <h2 className="text-sm font-black text-white">Journal des Transactions</h2>
                        </div>
                        <span className="text-[10px] text-gray-600 font-mono bg-white/5 px-2 py-0.5 rounded">{jCount} entrées</span>
                    </div>
                    <div className="flex gap-1 bg-white/5 rounded-xl p-1 w-fit">
                        {([
                            ['docs',     'Factures',  pDocs.filter(d => d.type === 'facture').length, Calculator],
                            ['boutique', 'Boutique',  pOrders.length, ShoppingBag],
                            ['depenses', 'Dépenses',  pDeps.length,   Receipt],
                        ] as const).map(([k, l, c, Icon]) => (
                            <button key={k} type="button" onClick={() => { setJournalTab(k); setJournalPage(1) }}
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
                                {agents.filter(a => a.role === 'agent').map(a => (
                                    <option key={a.id} value={a.id} className="bg-[#0a0f18]">{a.full_name || a.email}</option>
                                ))}
                            </select>
                        )}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    {journalTab === 'docs' && (
                        <table className="w-full min-w-[640px]">
                            <thead><tr className="text-[9px] font-black text-gray-500 uppercase tracking-widest border-b border-white/5">
                                {['N° Document', 'Client', 'Agent', 'Montant', 'Statut', 'Date'].map((h, i) => (
                                    <th key={h} className={cn('p-4 font-black', i === 0 ? 'pl-5 text-left' : i === 5 ? 'text-right pr-5' : i === 3 ? 'text-right' : i === 4 ? 'text-center' : 'text-left')}>{h}</th>
                                ))}
                            </tr></thead>
                            <tbody className="divide-y divide-white/[0.03]">
                                {pgDocs.length === 0 && <tr><td colSpan={6} className="text-center py-12 text-gray-600 text-sm">Aucune facture</td></tr>}
                                {pgDocs.map(d => {
                                    const ag = agents.find(a => a.id === d.agent_id)
                                    const st = DOC_STATUS[d.status] || { label: d.status, cls: 'bg-gray-500/20 text-gray-400' }
                                    return (
                                        <tr key={d.id} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="p-4 pl-5"><p className="text-xs font-bold text-white font-mono">{d.numero}</p><p className="text-[9px] text-gray-600 capitalize">{d.type}</p></td>
                                            <td className="p-4"><p className="text-xs text-white">{d.client_nom} {d.client_prenom || ''}</p><p className="text-[9px] text-gray-600 truncate max-w-[150px]">{d.client_email || d.client_phone || '—'}</p></td>
                                            <td className="p-4 text-[10px] text-gray-400 truncate max-w-[120px]">{ag?.full_name || ag?.email || '—'}</td>
                                            <td className="p-4 text-right font-mono text-sm text-white font-bold">{fmt(d.total)}</td>
                                            <td className="p-4 text-center"><span className={cn('text-[9px] font-bold px-2 py-0.5 rounded-full', st.cls)}>{st.label}</span></td>
                                            <td className="p-4 pr-5 text-right text-[10px] text-gray-500 font-mono">{fmtDate(d.created_at)}</td>
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
                                            <td className="p-4 pl-5"><p className="text-xs text-white">{o.customer_name || '—'}</p><p className="text-[9px] text-gray-600 truncate max-w-[150px]">{o.customer_email || '—'}</p></td>
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
                        <table className="w-full min-w-[540px]">
                            <thead><tr className="text-[9px] font-black text-gray-500 uppercase tracking-widest border-b border-white/5">
                                {['Titre', 'Catégorie', 'Agent', 'Montant', 'Date'].map((h, i) => (
                                    <th key={h} className={cn('p-4 font-black', i === 0 ? 'pl-5 text-left' : i === 4 ? 'text-right pr-5' : i === 3 ? 'text-right' : 'text-left')}>{h}</th>
                                ))}
                            </tr></thead>
                            <tbody className="divide-y divide-white/[0.03]">
                                {pgDeps.length === 0 && <tr><td colSpan={5} className="text-center py-12 text-gray-600 text-sm">Aucune dépense</td></tr>}
                                {pgDeps.map(d => {
                                    const ag = agents.find(a => a.id === d.agent_id)
                                    return (
                                        <tr key={d.id} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="p-4 pl-5 text-xs text-white font-medium">{d.titre}</td>
                                            <td className="p-4"><span className="text-[9px] font-bold bg-white/5 text-gray-400 px-2 py-0.5 rounded-full capitalize">{d.categorie}</span></td>
                                            <td className="p-4 text-[10px] text-gray-500 truncate max-w-[130px]">{ag?.full_name || ag?.email || '—'}</td>
                                            <td className="p-4 text-right font-mono text-sm text-red-400 font-bold">−{fmt(Number(d.montant))}</td>
                                            <td className="p-4 pr-5 text-right text-[10px] text-gray-500 font-mono">{fmtDate(d.date_depense)}</td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between p-4 border-t border-white/5">
                        <span className="text-[10px] text-gray-600">Page {journalPage} / {totalPages} · {jCount} entrées</span>
                        <div className="flex gap-1 items-center">
                            <button type="button" title="Page précédente" onClick={() => setJournalPage(p => Math.max(1, p - 1))} disabled={journalPage === 1}
                                className="w-8 h-8 rounded-lg bg-white/5 text-gray-400 hover:text-white disabled:opacity-30 flex items-center justify-center transition-colors">
                                <ChevronLeft size={14} />
                            </button>
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                const p = Math.max(1, Math.min(totalPages - 4, journalPage - 2)) + i
                                return p <= totalPages ? (
                                    <button key={p} type="button" onClick={() => setJournalPage(p)}
                                        className={cn('w-8 h-8 rounded-lg text-[10px] font-bold transition-all', p === journalPage ? 'bg-[#008751] text-white' : 'bg-white/5 text-gray-400 hover:text-white')}>
                                        {p}
                                    </button>
                                ) : null
                            })}
                            <button type="button" title="Page suivante" onClick={() => setJournalPage(p => Math.min(totalPages, p + 1))} disabled={journalPage === totalPages}
                                className="w-8 h-8 rounded-lg bg-white/5 text-gray-400 hover:text-white disabled:opacity-30 flex items-center justify-center transition-colors">
                                <ChevronRight size={14} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
