'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import {
    Wallet, TrendingDown, ArrowUpRight, ArrowDownRight, Download,
    BarChart3, FileText, RefreshCw, Users, ShoppingBag,
    AlertTriangle, Award, Search, Target, Activity, Star,
    Calculator, Landmark, Receipt, ChevronLeft, ChevronRight
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area, BarChart, Bar,
} from 'recharts'

// ─── Types ──────────────────────────────────────────────────────────
type Period = 'ce_mois' | '3_mois' | '6_mois' | 'annee' | 'tous'

interface AgentRow {
    id: string
    full_name: string | null
    email: string
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
    if (p === '3_mois')  return { start: new Date(now.getTime() - 180 * 864e5), end: new Date(now.getTime() - 90 * 864e5) }
    if (p === '6_mois')  return { start: new Date(now.getTime() - 360 * 864e5), end: new Date(now.getTime() - 180 * 864e5) }
    if (p === 'annee')   return { start: new Date(now.getFullYear() - 1, 0, 1), end: new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59) }
    return { start: new Date(0), end: new Date(0) }
}

function inRange(dateStr: string, s: Date, e: Date) {
    const d = new Date(dateStr); return d >= s && d <= e
}

function calcTrend(curr: number, prev: number) {
    if (prev === 0) return curr > 0 ? '+100' : '0'
    const pct = ((curr - prev) / prev) * 100
    return (pct >= 0 ? '+' : '') + pct.toFixed(1)
}

function fmt(val: number, currency = 'XOF') {
    return new Intl.NumberFormat('fr-BJ', { style: 'currency', currency, maximumFractionDigits: 0 }).format(val)
}

function fmtDate(str: string) {
    return new Date(str).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' })
}

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

// ─── KPI Card ───────────────────────────────────────────────────────
type LucideIcon = React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>

function KpiCard({ icon: Icon, label, value, trend, color, sub }: {
    icon: LucideIcon; label: string; value: string
    trend?: string | null; color: string; sub?: string
}) {
    const trendNum = trend ? parseFloat(trend) : null
    return (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="bg-[#0a0f18] border border-white/5 rounded-2xl p-5 flex flex-col gap-3 hover:border-white/10 transition-colors">
            <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${color}1a` }}>
                    <Icon size={16} style={{ color }} />
                </div>
                {trendNum !== null && (
                    <span className={cn('text-[10px] font-black flex items-center gap-0.5 px-2 py-0.5 rounded-full',
                        trendNum >= 0 ? 'text-[#00c870] bg-[#008751]/10' : 'text-red-400 bg-red-500/10')}>
                        {trendNum >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                        {trend}%
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

// ─── Main Page ──────────────────────────────────────────────────────
export default function AdminComptabilitePage() {
    const [period, setPeriod] = useState<Period>('ce_mois')
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [exporting, setExporting] = useState(false)

    const [agents, setAgents]     = useState<AgentRow[]>([])
    const [docs, setDocs]         = useState<DocRow[]>([])
    const [orders, setOrders]     = useState<OrderRow[]>([])
    const [depenses, setDepenses] = useState<DepRow[]>([])
    const [commissionRate, setCommissionRate] = useState(0.10)

    const [journalTab, setJournalTab]   = useState<'docs' | 'boutique' | 'depenses'>('docs')
    const [searchQ, setSearchQ]         = useState('')
    const [sortAgent, setSortAgent]     = useState<'encaisse' | 'commission' | 'docs'>('encaisse')
    const [journalPage, setJournalPage] = useState(1)
    const [agentFilter, setAgentFilter] = useState('tous')
    const ITEMS = 10

    // ── Fetch ──────────────────────────────────────────────────────
    const fetchAll = useCallback(async () => {
        setRefreshing(true)
        const [
            { data: agentData },
            { data: docData },
            { data: orderData },
            { data: depData },
            { data: settingsData },
        ] = await Promise.all([
            supabase.from('user_profiles').select('id, full_name, email, is_active').in('role', ['agent', 'admin']),
            supabase.from('documents_financiers').select('id,type,numero,client_nom,client_prenom,client_email,client_phone,total,status,created_at,agent_id,currency').order('created_at', { ascending: false }),
            supabase.from('orders').select('id,customer_name,customer_email,product_title,amount,currency,payment_status,payment_method,created_at').order('created_at', { ascending: false }),
            supabase.from('depenses').select('id,titre,categorie,montant,date_depense,agent_id').order('date_depense', { ascending: false }),
            supabase.from('system_settings').select('*').eq('id', 'comptabilite_erp').single(),
        ])
        if (agentData)  setAgents(agentData)
        if (docData)    setDocs(docData)
        if (orderData)  setOrders(orderData)
        if (depData)    setDepenses(depData)
        if (settingsData?.value?.commission_rate) setCommissionRate(settingsData.value.commission_rate)
        setLoading(false)
        setRefreshing(false)
    }, [])

    useEffect(() => { fetchAll() }, [fetchAll])

    // ── Period filtering ───────────────────────────────────────────
    const { start, end } = useMemo(() => getPeriodRange(period), [period])
    const { start: pS, end: pE } = useMemo(() => getPrevPeriodRange(period), [period])

    const pDocs    = useMemo(() => docs.filter(d => inRange(d.created_at, start, end)), [docs, start, end])
    const pOrders  = useMemo(() => orders.filter(o => inRange(o.created_at, start, end)), [orders, start, end])
    const pDeps    = useMemo(() => depenses.filter(d => inRange(d.date_depense, start, end)), [depenses, start, end])
    const pvDocs   = useMemo(() => docs.filter(d => inRange(d.created_at, pS, pE)), [docs, pS, pE])
    const pvOrders = useMemo(() => orders.filter(o => inRange(o.created_at, pS, pE)), [orders, pS, pE])
    const pvDeps   = useMemo(() => depenses.filter(d => inRange(d.date_depense, pS, pE)), [depenses, pS, pE])

    // ── KPIs ───────────────────────────────────────────────────────
    const kpis = useMemo(() => {
        const calc = (dList: DocRow[], oList: OrderRow[], deps: DepRow[]) => {
            const invoices = dList.filter(d => d.type === 'facture')
            const encaisseFactu = invoices.filter(d => d.status === 'paye').reduce((a, d) => a + d.total, 0)
            const enAttente     = invoices.filter(d => ['envoye', 'accepte'].includes(d.status)).reduce((a, d) => a + d.total, 0)
            const boutique      = oList.filter(o => o.payment_status === 'completed').reduce((a, o) => a + o.amount, 0)
            const totalEncaisse = encaisseFactu + boutique
            const commission    = Math.round(encaisseFactu * commissionRate)
            const totalDeps     = deps.reduce((a, d) => a + Number(d.montant), 0)
            const caEmis        = invoices.reduce((a, d) => a + d.total, 0)
            const jours         = Math.max(1, (end.getTime() - start.getTime()) / 864e5)
            return { encaisseFactu, boutique, totalEncaisse, enAttente, commission, totalDeps, benefice: totalEncaisse - commission - totalDeps, caEmis, proj30: (totalEncaisse / jours) * 30 }
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

    // ── Agent stats ────────────────────────────────────────────────
    const agentStats = useMemo(() => {
        const map = new Map<string, { agent: AgentRow; caEmis: number; encaisse: number; enAttente: number; commission: number; depenses: number; benefice: number; nbDevis: number; nbFactures: number; nbPayees: number }>()
        for (const a of agents) map.set(a.id, { agent: a, caEmis: 0, encaisse: 0, enAttente: 0, commission: 0, depenses: 0, benefice: 0, nbDevis: 0, nbFactures: 0, nbPayees: 0 })
        for (const d of pDocs) {
            if (!map.has(d.agent_id)) map.set(d.agent_id, { agent: { id: d.agent_id, full_name: null, email: '—', is_active: true }, caEmis: 0, encaisse: 0, enAttente: 0, commission: 0, depenses: 0, benefice: 0, nbDevis: 0, nbFactures: 0, nbPayees: 0 })
            const s = map.get(d.agent_id)!
            if (d.type === 'devis') { s.nbDevis++ } else {
                s.nbFactures++; s.caEmis += d.total
                if (d.status === 'paye') { s.encaisse += d.total; s.nbPayees++ }
                if (['envoye', 'accepte'].includes(d.status)) s.enAttente += d.total
            }
        }
        for (const dep of pDeps) { if (map.has(dep.agent_id)) map.get(dep.agent_id)!.depenses += Number(dep.montant) }
        for (const [, s] of map) { s.commission = Math.round(s.encaisse * commissionRate); s.benefice = s.encaisse - s.commission - s.depenses }
        return [...map.values()].filter(s => s.caEmis > 0 || s.nbDevis > 0 || s.depenses > 0)
    }, [agents, pDocs, pDeps, commissionRate])

    // ── Charts ─────────────────────────────────────────────────────
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

    // ── Journal ────────────────────────────────────────────────────
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

    const jCount = journalTab === 'docs' ? jDocs.length : journalTab === 'boutique' ? jOrders.length : jDeps.length
    const totalPages = Math.max(1, Math.ceil(jCount / ITEMS))
    const pgDocs   = jDocs.slice((journalPage - 1) * ITEMS, journalPage * ITEMS)
    const pgOrders = jOrders.slice((journalPage - 1) * ITEMS, journalPage * ITEMS)
    const pgDeps   = jDeps.slice((journalPage - 1) * ITEMS, journalPage * ITEMS)

    // ── Export multi-feuilles Excel ────────────────────────────────
    const handleMasterExport = async () => {
        setExporting(true)
        try {
            const ExcelJS = (await import('exceljs')).default
            const { saveAs } = await import('file-saver')
            const wb = new ExcelJS.Workbook()
            wb.creator = 'Retour Gagnant ERP Admin'
            wb.created = new Date()

            const HDR = { font: { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Arial', size: 11 }, fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF008751' } }, alignment: { horizontal: 'center' as const, vertical: 'middle' as const } }

            const addSheet = (name: string, cols: { header: string; key: string; width: number }[], title: string) => {
                const ws = wb.addWorksheet(name)
                ws.columns = cols
                ws.mergeCells(`A1:${String.fromCharCode(64 + cols.length)}1`)
                const t = ws.getCell('A1'); t.value = `RETOUR GAGNANT — ${title.toUpperCase()}`
                t.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' }, name: 'Arial' }
                t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0a1628' } }
                t.alignment = { horizontal: 'center', vertical: 'middle' }
                ws.getRow(1).height = 30
                ws.mergeCells(`A2:${String.fromCharCode(64 + cols.length)}2`)
                const s = ws.getCell('A2'); s.value = `Période : ${start.toLocaleDateString('fr-FR')} → ${end.toLocaleDateString('fr-FR')} | Généré le ${new Date().toLocaleDateString('fr-FR')}`
                s.font = { italic: true, size: 9, color: { argb: 'FF888888' } }; s.alignment = { horizontal: 'center' }
                const hr = ws.getRow(3); hr.values = cols.map(c => c.header); hr.height = 22
                hr.eachCell(cell => Object.assign(cell, HDR))
                return ws
            }

            // ── Feuille 1 : Résumé KPI ──
            const ws1 = wb.addWorksheet('📊 Résumé Global')
            ws1.columns = [{ width: 36 }, { width: 24 }, { width: 28 }]
            ws1.mergeCells('A1:C1'); const t1 = ws1.getCell('A1')
            t1.value = 'RETOUR GAGNANT — RAPPORT COMPTABLE GLOBAL'; t1.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' }, name: 'Arial' }
            t1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0a1628' } }; t1.alignment = { horizontal: 'center', vertical: 'middle' }; ws1.getRow(1).height = 30
            ws1.mergeCells('A2:C2'); const s1 = ws1.getCell('A2')
            s1.value = `Période : ${start.toLocaleDateString('fr-FR')} → ${end.toLocaleDateString('fr-FR')} | Taux commission : ${(commissionRate * 100).toFixed(0)}% | Généré le ${new Date().toLocaleDateString('fr-FR')}`
            s1.font = { italic: true, size: 9, color: { argb: 'FF888888' } }; s1.alignment = { horizontal: 'center' }
            const hr1 = ws1.getRow(3); hr1.values = ['INDICATEUR', 'MONTANT (FCFA)', 'DÉTAIL']; hr1.height = 22
            hr1.eachCell(cell => Object.assign(cell, HDR))
            const kpiRows: [string, number | string, string][] = [
                ['Chiffre d\'Affaires Émis (Factures)', kpis.caEmis, `${pDocs.filter(d => d.type === 'facture').length} factures émises`],
                ['Encaissé — Facturation', kpis.encaisseFactu, `${pDocs.filter(d => d.type === 'facture' && d.status === 'paye').length} factures payées`],
                ['Revenus Boutique (Commandes)', kpis.boutique, `${pOrders.filter(o => o.payment_status === 'completed').length} commandes complétées`],
                ['TOTAL ENCAISSÉ', kpis.totalEncaisse, 'Facturation + Boutique cumulés'],
                ['Factures En Attente de Paiement', kpis.enAttente, `${pDocs.filter(d => ['envoye', 'accepte'].includes(d.status)).length} factures en cours`],
                [`Commission Agents (${(commissionRate * 100).toFixed(0)}%)`, kpis.commission, 'Calculée sur encaissements facturation'],
                ['Dépenses Totales', kpis.totalDeps, `${pDeps.length} dépenses enregistrées`],
                ['BÉNÉFICE NET', kpis.benefice, 'Encaissé − Commissions − Dépenses'],
                ['Projection 30 jours', Math.round(kpis.proj30), 'Basée sur le rythme actuel'],
            ]
            kpiRows.forEach((row, i) => {
                const r = ws1.addRow(row)
                if (typeof row[1] === 'number') r.getCell(2).numFmt = '#,##0'
                if (row[0].startsWith('TOTAL') || row[0].startsWith('BÉNÉFICE')) {
                    r.getCell(1).font = { bold: true, size: 11 }
                    r.getCell(2).font = { bold: true, size: 11, color: { argb: (typeof row[1] === 'number' && row[1] < 0) ? 'FFE8112D' : 'FF008751' } }
                }
                if (i % 2 === 0) { r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } } }
            })

            // ── Feuille 2 : Performance Agents ──
            const ws2 = addSheet('👥 Performance Agents', [
                { header: 'Agent', key: 'agent', width: 24 }, { header: 'Email', key: 'email', width: 30 },
                { header: 'CA Émis (FCFA)', key: 'caEmis', width: 18 }, { header: 'Encaissé (FCFA)', key: 'encaisse', width: 18 },
                { header: `Commission (${(commissionRate * 100).toFixed(0)}%)`, key: 'comm', width: 18 },
                { header: 'Dépenses (FCFA)', key: 'dep', width: 18 }, { header: 'Bénéfice Net', key: 'benef', width: 18 },
                { header: 'Devis', key: 'devis', width: 10 }, { header: 'Factures', key: 'fact', width: 12 }, { header: 'Conv.%', key: 'conv', width: 12 },
            ], 'Performance par Agent')
            sortedAgents.forEach((s, i) => {
                const conv = s.nbFactures > 0 ? ((s.nbPayees / s.nbFactures) * 100).toFixed(1) + '%' : '0%'
                const r = ws2.addRow({ agent: s.agent.full_name || '—', email: s.agent.email, caEmis: s.caEmis, encaisse: s.encaisse, comm: s.commission, dep: s.depenses, benef: s.benefice, devis: s.nbDevis, fact: s.nbFactures, conv })
                ;['caEmis', 'encaisse', 'comm', 'dep', 'benef'].forEach(k => { r.getCell(k).numFmt = '#,##0' })
                if (s.benefice < 0) r.getCell('benef').font = { color: { argb: 'FFE8112D' }, bold: true }
                if (i === 0) r.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF9E6' } } })
                else if (i % 2 === 0) r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5FFF8' } }
            })

            // ── Feuille 3 : Journal Documents ──
            const ws3 = addSheet('📄 Factures & Devis', [
                { header: 'N° Document', key: 'num', width: 20 }, { header: 'Type', key: 'type', width: 10 },
                { header: 'Client', key: 'client', width: 28 }, { header: 'Email', key: 'email', width: 26 },
                { header: 'Téléphone', key: 'phone', width: 18 }, { header: 'Montant (FCFA)', key: 'montant', width: 18 },
                { header: 'Statut', key: 'status', width: 14 }, { header: 'Agent', key: 'agent', width: 22 }, { header: 'Date', key: 'date', width: 14 },
            ], 'Journal Factures & Devis — Tous Agents')
            pDocs.forEach((d, i) => {
                const ag = agents.find(a => a.id === d.agent_id)
                const r = ws3.addRow({ num: d.numero, type: d.type === 'facture' ? 'Facture' : 'Devis', client: `${d.client_nom} ${d.client_prenom || ''}`.trim(), email: d.client_email || '—', phone: d.client_phone || '—', montant: d.total, status: DOC_STATUS[d.status]?.label || d.status, agent: ag?.full_name || ag?.email || '—', date: new Date(d.created_at) })
                r.getCell('montant').numFmt = '#,##0'; r.getCell('date').numFmt = 'dd/mm/yyyy'
                if (d.status === 'paye') r.getCell('status').font = { color: { argb: 'FF008751' }, bold: true }
                if (i % 2 === 0) r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F8F8' } }
            })

            // ── Feuille 4 : Boutique ──
            const ws4 = addSheet('🛍️ Boutique', [
                { header: 'Commande ID', key: 'id', width: 20 }, { header: 'Client', key: 'client', width: 26 },
                { header: 'Email', key: 'email', width: 28 }, { header: 'Produit', key: 'produit', width: 32 },
                { header: 'Montant', key: 'montant', width: 16 }, { header: 'Devise', key: 'devise', width: 10 },
                { header: 'Méthode', key: 'methode', width: 14 }, { header: 'Statut', key: 'status', width: 14 }, { header: 'Date', key: 'date', width: 14 },
            ], 'Commandes Boutique en Ligne')
            pOrders.forEach((o, i) => {
                const r = ws4.addRow({ id: o.id.slice(0, 14) + '…', client: o.customer_name || '—', email: o.customer_email || '—', produit: o.product_title || '—', montant: o.amount, devise: o.currency, methode: o.payment_method || '—', status: ORDER_STATUS[o.payment_status]?.label || o.payment_status, date: new Date(o.created_at) })
                r.getCell('montant').numFmt = '#,##0'; r.getCell('date').numFmt = 'dd/mm/yyyy'
                if (o.payment_status === 'completed') r.getCell('status').font = { color: { argb: 'FF008751' }, bold: true }
                if (i % 2 === 0) r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F8F8' } }
            })

            // ── Feuille 5 : Dépenses ──
            const ws5 = addSheet('💸 Dépenses', [
                { header: 'Titre', key: 'titre', width: 32 }, { header: 'Catégorie', key: 'cat', width: 20 },
                { header: 'Montant (FCFA)', key: 'montant', width: 18 }, { header: 'Date', key: 'date', width: 14 }, { header: 'Agent', key: 'agent', width: 24 },
            ], 'Journal des Dépenses — Tous Agents')
            pDeps.forEach((d, i) => {
                const ag = agents.find(a => a.id === d.agent_id)
                const r = ws5.addRow({ titre: d.titre, cat: d.categorie, montant: Number(d.montant), date: new Date(d.date_depense), agent: ag?.full_name || ag?.email || '—' })
                r.getCell('montant').numFmt = '#,##0'; r.getCell('date').numFmt = 'dd/mm/yyyy'
                if (i % 2 === 0) r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F8F8' } }
            })

            const buf = await wb.xlsx.writeBuffer()
            saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `RG_Comptabilite_${new Date().toISOString().slice(0, 10)}.xlsx`)
        } finally { setExporting(false) }
    }

    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-2 border-[#FCD116] border-t-transparent rounded-full animate-spin" />
                <p className="text-gray-500 text-sm">Chargement des données ERP...</p>
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
                        {agents.length} agents · {docs.length} documents · {orders.length} commandes · taux commission {(commissionRate * 100).toFixed(0)}%
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
                        className="flex items-center gap-2 bg-[#FCD116] text-[#0a0f18] hover:bg-[#e6bc00] font-black text-xs px-5 py-3 rounded-xl transition-all disabled:opacity-60 shadow-[0_0_24px_rgba(252,209,22,0.25)]">
                        {exporting
                            ? <div className="w-4 h-4 border-2 border-[#0a0f18] border-t-transparent rounded-full animate-spin" />
                            : <Download size={14} />}
                        Export Rapport (5 feuilles)
                    </button>
                </div>
            </div>

            {/* ── KPI GRID ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard icon={BarChart3}     label="CA Émis (Factures)"                   value={fmt(kpis.caEmis)}         color="#FCD116" sub={`${pDocs.filter(d => d.type === 'facture').length} factures`} />
                <KpiCard icon={Wallet}        label="Total Encaissé"                        value={fmt(kpis.totalEncaisse)}  trend={kpis.trends?.encaisse}  color="#008751" sub="Facturation + Boutique" />
                <KpiCard icon={ShoppingBag}   label="Revenus Boutique"                      value={fmt(kpis.boutique)}       trend={kpis.trends?.boutique}  color="#3b82f6" sub={`${pOrders.filter(o => o.payment_status === 'completed').length} commandes`} />
                <KpiCard icon={AlertTriangle} label="En Attente Paiement"                   value={fmt(kpis.enAttente)}      trend={kpis.trends?.enAttente} color="#f97316" sub={`${pDocs.filter(d => ['envoye', 'accepte'].includes(d.status)).length} factures`} />
                <KpiCard icon={Users}         label={`Commissions Agents (${(commissionRate * 100).toFixed(0)}%)`} value={fmt(kpis.commission)} color="#8b5cf6" sub="Sur encaissements facturation" />
                <KpiCard icon={TrendingDown}  label="Dépenses Totales"                      value={fmt(kpis.totalDeps)}      color="#E8112D" sub={`${pDeps.length} dépenses`} />
                <KpiCard icon={Award}         label="Bénéfice Net"                          value={fmt(kpis.benefice)}       trend={kpis.trends?.benefice}  color={kpis.benefice >= 0 ? '#00c870' : '#E8112D'} sub="Après commissions et dépenses" />
                <KpiCard icon={Target}        label="Projection 30 jours"                   value={fmt(Math.round(kpis.proj30))} color="#FCD116" sub="Basée sur rythme actuel" />
            </div>

            {/* ── CHARTS ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Area — flux trésorerie */}
                <div className="lg:col-span-2 bg-[#0a0f18] border border-white/5 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Flux de Trésorerie</p>
                            <p className="text-sm font-bold text-white mt-0.5">Encaissements quotidiens (facturation + boutique)</p>
                        </div>
                        <Activity size={16} className="text-[#008751]" />
                    </div>
                    {areaData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <AreaChart data={areaData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="gF" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#008751" stopOpacity={0.3} /><stop offset="95%" stopColor="#008751" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="gB" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} /><stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                                <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                                <Tooltip contentStyle={{ background: '#0d1421', border: '1px solid #ffffff12', borderRadius: 12 }} labelStyle={{ color: '#fff', fontWeight: 700 }}
                                    formatter={(v: number, name: string) => [fmt(v), name === 'factu' ? 'Facturation' : 'Boutique']} />
                                <Area type="monotone" dataKey="factu"    stroke="#008751" strokeWidth={2} fill="url(#gF)" name="factu" />
                                <Area type="monotone" dataKey="boutique" stroke="#3b82f6" strokeWidth={2} fill="url(#gB)" name="boutique" />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-[220px] flex flex-col items-center justify-center text-gray-600 gap-2">
                            <Activity size={28} strokeWidth={1} />
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

                {/* Bar — top agents */}
                <div className="bg-[#0a0f18] border border-white/5 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Top Agents</p>
                            <p className="text-sm font-bold text-white mt-0.5">Encaissé vs Commission</p>
                        </div>
                        <Star size={16} className="text-[#FCD116]" />
                    </div>
                    {agentBarData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={agentBarData} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" horizontal={false} />
                                <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 9 }} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} axisLine={false} tickLine={false} />
                                <YAxis type="category" dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} width={64} />
                                <Tooltip contentStyle={{ background: '#0d1421', border: '1px solid #ffffff12', borderRadius: 12 }}
                                    formatter={(v: number, name: string) => [fmt(v), name === 'encaisse' ? 'Encaissé' : 'Commission']} />
                                <Bar dataKey="encaisse"  fill="#008751" radius={[0, 4, 4, 0]} />
                                <Bar dataKey="commission" fill="#FCD116" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-[220px] flex flex-col items-center justify-center text-gray-600 gap-2">
                            <Users size={28} strokeWidth={1} />
                            <p className="text-sm">Aucun agent actif sur cette période</p>
                        </div>
                    )}
                </div>
            </div>

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
                                    <th key={h} className={cn('p-4 font-black', i === 0 ? 'pl-5 text-left' : i === 1 ? 'text-left' : i === 8 ? 'text-right pr-5' : 'text-right')}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.03]">
                            {sortedAgents.length === 0 && (
                                <tr><td colSpan={9} className="text-center py-12 text-gray-600 text-sm">Aucun agent avec données sur cette période</td></tr>
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

                    {/* Tabs */}
                    <div className="flex gap-1 bg-white/5 rounded-xl p-1 w-fit">
                        {([
                            ['docs',     'Factures',  pDocs.filter(d => d.type === 'facture').length, Calculator],
                            ['boutique', 'Boutique',  pOrders.length, ShoppingBag],
                            ['depenses', 'Dépenses',  pDeps.length, Receipt],
                        ] as const).map(([k, l, c, Icon]) => (
                            <button key={k} type="button" onClick={() => { setJournalTab(k); setJournalPage(1) }}
                                className={cn('text-[10px] font-bold px-4 py-2 rounded-lg transition-all flex items-center gap-1.5',
                                    journalTab === k ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white')}>
                                <Icon size={11} /> {l}
                                <span className="text-[9px] font-mono opacity-60">{c}</span>
                            </button>
                        ))}
                    </div>

                    {/* Filtres */}
                    <div className="flex gap-3 flex-wrap">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                            <input type="text" placeholder="Rechercher…" value={searchQ}
                                onChange={e => { setSearchQ(e.target.value); setJournalPage(1) }}
                                className="w-full bg-white/5 border border-white/10 rounded-xl text-sm text-white pl-9 pr-4 py-2.5 focus:outline-none placeholder-gray-600 focus:border-[#008751]/30" />
                        </div>
                        {journalTab !== 'boutique' && (
                            <select value={agentFilter} onChange={e => { setAgentFilter(e.target.value); setJournalPage(1) }} title="Filtrer par agent"
                                className="bg-white/5 border border-white/10 rounded-xl text-sm text-white px-3 py-2.5 focus:outline-none min-w-[160px]">
                                <option value="tous" className="bg-[#0a0f18]">Tous les agents</option>
                                {agents.map(a => <option key={a.id} value={a.id} className="bg-[#0a0f18]">{a.full_name || a.email}</option>)}
                            </select>
                        )}
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    {/* Factures */}
                    {journalTab === 'docs' && (
                        <table className="w-full min-w-[640px]">
                            <thead><tr className="text-[9px] font-black text-gray-500 uppercase tracking-widest border-b border-white/5">
                                {['N° Document', 'Client', 'Agent', 'Montant', 'Statut', 'Date'].map((h, i) => (
                                    <th key={h} className={cn('p-4 font-black', i === 0 ? 'pl-5 text-left' : i === 5 ? 'text-right pr-5' : i === 3 ? 'text-right' : i === 4 ? 'text-center' : 'text-left')}>{h}</th>
                                ))}
                            </tr></thead>
                            <tbody className="divide-y divide-white/[0.03]">
                                {pgDocs.length === 0 && <tr><td colSpan={6} className="text-center py-12 text-gray-600 text-sm">Aucune facture sur cette période</td></tr>}
                                {pgDocs.map(d => {
                                    const ag = agents.find(a => a.id === d.agent_id)
                                    const st = DOC_STATUS[d.status] || { label: d.status, cls: 'bg-gray-500/20 text-gray-400' }
                                    return (
                                        <tr key={d.id} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="p-4 pl-5">
                                                <p className="text-xs font-bold text-white font-mono">{d.numero}</p>
                                                <p className="text-[9px] text-gray-600 capitalize">{d.type}</p>
                                            </td>
                                            <td className="p-4">
                                                <p className="text-xs text-white">{d.client_nom} {d.client_prenom || ''}</p>
                                                <p className="text-[9px] text-gray-600 truncate max-w-[150px]">{d.client_email || d.client_phone || '—'}</p>
                                            </td>
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

                    {/* Boutique */}
                    {journalTab === 'boutique' && (
                        <table className="w-full min-w-[640px]">
                            <thead><tr className="text-[9px] font-black text-gray-500 uppercase tracking-widest border-b border-white/5">
                                {['Client', 'Produit', 'Montant', 'Méthode', 'Statut', 'Date'].map((h, i) => (
                                    <th key={h} className={cn('p-4 font-black', i === 0 ? 'pl-5 text-left' : i === 5 ? 'text-right pr-5' : i === 2 ? 'text-right' : i === 4 ? 'text-center' : 'text-left')}>{h}</th>
                                ))}
                            </tr></thead>
                            <tbody className="divide-y divide-white/[0.03]">
                                {pgOrders.length === 0 && <tr><td colSpan={6} className="text-center py-12 text-gray-600 text-sm">Aucune commande sur cette période</td></tr>}
                                {pgOrders.map(o => {
                                    const st = ORDER_STATUS[o.payment_status] || { label: o.payment_status, cls: 'bg-gray-500/20 text-gray-400' }
                                    return (
                                        <tr key={o.id} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="p-4 pl-5">
                                                <p className="text-xs text-white">{o.customer_name || '—'}</p>
                                                <p className="text-[9px] text-gray-600 truncate max-w-[150px]">{o.customer_email || '—'}</p>
                                            </td>
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

                    {/* Dépenses */}
                    {journalTab === 'depenses' && (
                        <table className="w-full min-w-[540px]">
                            <thead><tr className="text-[9px] font-black text-gray-500 uppercase tracking-widest border-b border-white/5">
                                {['Titre', 'Catégorie', 'Agent', 'Montant', 'Date'].map((h, i) => (
                                    <th key={h} className={cn('p-4 font-black', i === 0 ? 'pl-5 text-left' : i === 4 ? 'text-right pr-5' : i === 3 ? 'text-right' : 'text-left')}>{h}</th>
                                ))}
                            </tr></thead>
                            <tbody className="divide-y divide-white/[0.03]">
                                {pgDeps.length === 0 && <tr><td colSpan={5} className="text-center py-12 text-gray-600 text-sm">Aucune dépense sur cette période</td></tr>}
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
                            <button type="button" onClick={() => setJournalPage(p => Math.max(1, p - 1))} disabled={journalPage === 1}
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
                            <button type="button" onClick={() => setJournalPage(p => Math.min(totalPages, p + 1))} disabled={journalPage === totalPages}
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
