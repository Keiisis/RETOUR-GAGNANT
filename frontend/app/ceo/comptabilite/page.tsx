'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Calculator, RefreshCw, Loader2, TrendingUp, TrendingDown, DollarSign, FileText, Download, Users, Banknote, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react'
import { exportToExcelMultiSheet } from '@/lib/exportExcel'
import ComptaLockPanel, { type ClotureRow } from '@/components/comptabilite/ComptaLockPanel'
import { toXOF, loadExchangeRates } from '@/lib/currency-convert'

// ── Périodes ──────────────────────────────────────────────────
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
    if (period === 'tous') return 'Global'
    if (period === '3_mois') return '3 derniers mois'
    if (isMonth(period)) return monthLabel(period)
    return period
}
function periodSlug(period: Period): string {
    if (period === 'tous') return 'Global'
    if (period === '3_mois') return '3_mois'
    return period
}
function getPeriodRange(period: Period): { start: Date; end: Date } {
    const now = new Date()
    const fullEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
    if (period === 'tous') return { start: new Date(0), end: fullEnd }
    if (period === '3_mois') return { start: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000), end: fullEnd }
    if (isMonth(period)) {
        const [y, m] = period.split('-').map(Number)
        return { start: new Date(y, m - 1, 1), end: new Date(y, m, 0, 23, 59, 59, 999) }
    }
    return { start: new Date(0), end: fullEnd }
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

const GOLD = '#C9A84C'; const YELLOW = '#FCD116'; const GREEN_L = '#008751'
const RED = '#E8112D'; const BG = '#FAF8F4'; const TEXT = '#1B2A4A'
const PANEL = '#FFFFFF'

function fmt(n: number) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M FCFA`
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K FCFA`
    return `${n.toLocaleString('fr-FR')} FCFA`
}
function fmtDate(d: string) {
    if (!d) return '—'
    const dateObj = new Date(d)
    return isNaN(dateObj.getTime()) ? '—' : dateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

interface DocumentItem {
    description?: string; quantity?: number; unit_price?: number; tva?: number; unit_cost?: number
}
interface FinancialDoc {
    id: string; type: string; numero?: string; client_nom?: string; client_prenom?: string
    client_email?: string; client_phone?: string; client_adresse?: string
    total: number; sous_total?: number; total_tva?: number; remise?: number
    items?: DocumentItem[]
    status: string; created_at: string; agent_id?: string; currency?: string
}
interface Order {
    id: string; customer_name?: string; customer_email?: string; product_title?: string
    amount: number; currency?: string; payment_status?: string; payment_method?: string; created_at: string
}
interface Depense {
    id: string; titre?: string; categorie?: string; montant: number; date_depense: string; agent_id?: string; notes?: string
}
interface Paiement {
    id: string; document_id: string; type: string; montant: number; date_paiement: string
    reference?: string | null; notes?: string | null; agent_id?: string
}
interface Agent {
    id: string; full_name?: string | null; role?: string | null
}

interface ApiResponse {
    docs: FinancialDoc[]
    orders: Order[]
    depenses: Depense[]
    paiements: Paiement[]
    agents: Agent[]
    clotures: ClotureRow[]
    commissionRate: number
}

const DOC_TYPES: Record<string, string> = {
    devis: 'Devis', facture: 'Facture', bon_commande: 'Bon de commande', avoir: 'Avoir'
}
const PAYMENT_LABELS: Record<string, string> = {
    virement: 'Virement', especes: 'Espèces', cheque: 'Chèque',
    mobile_money: 'Mobile Money', carte: 'Carte', autre: 'Autre'
}
const STATUS_LABELS: Record<string, string> = {
    brouillon: 'Brouillon', envoye: 'Envoyé', accepte: 'Accepté',
    refuse: 'Refusé', paye: 'Payé', en_retard: 'En retard', annule: 'Annulé'
}
const PAID_STATUSES = ['paye', 'paid', 'completed']

export default function CeoComptabilite() {
    const [data, setData] = useState<ApiResponse | null>(null)
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'overview' | 'agents' | 'factures' | 'commandes' | 'depenses' | 'paiements'>('overview')
    const [agentFilter, setAgentFilter] = useState<string>('all')
    const [selectedPeriod, setSelectedPeriod] = useState<Period>(() => currentMonthKey())
    const [refresh, setRefresh] = useState(0)

    const load = useCallback(async () => {
        setLoading(true)
        await loadExchangeRates()  // taux réels avant normalisation XOF des KPI
        const res = await fetch('/api/admin/comptabilite', { cache: 'no-store' })
        if (res.ok) {
            const json = await res.json()
            setData(json)
        }
        setLoading(false)
    }, [refresh])

    useEffect(() => { load() }, [load])

    const agents = data?.agents || []
    const agentMap = useMemo(() => {
        const m = new Map<string, string>()
        agents.forEach(a => m.set(a.id, a.full_name || '—'))
        return m
    }, [agents])

    const allDocs = data?.docs || []
    const allOrders = data?.orders || []
    const allDepenses = data?.depenses || []
    const allPaiements = data?.paiements || []

    const { start: pStart, end: pEnd } = useMemo(() => getPeriodRange(selectedPeriod), [selectedPeriod])
    const inPeriod = useCallback((iso: string | undefined) => {
        if (!iso) return false
        const d = new Date(iso)
        return d >= pStart && d <= pEnd
    }, [pStart, pEnd])

    const docsByAgent = agentFilter === 'all' ? allDocs : allDocs.filter(d => d.agent_id === agentFilter)
    const depensesByAgent = agentFilter === 'all' ? allDepenses : allDepenses.filter(d => d.agent_id === agentFilter)
    const paiementsByAgent = agentFilter === 'all' ? allPaiements : allPaiements.filter(p => p.agent_id === agentFilter)

    const docs = docsByAgent.filter(d => inPeriod(d.created_at))
    const depenses = depensesByAgent.filter(e => inPeriod(e.date_depense))
    const paiements = paiementsByAgent.filter(p => inPeriod(p.date_paiement))
    const orders = allOrders.filter(o => inPeriod(o.created_at))

    // Agrégats normalisés en XOF (parité EUR fixe) — cf. lib/currency-convert.ts
    const totalFacture = docs.filter(d => d.type === 'facture').reduce((a, d) => a + toXOF(d.total, d.currency), 0)
    const totalManuellement = paiements.reduce((a, p) => a + Number(p.montant || 0), 0)  // paiements en XOF
    const totalOrders = orders.filter(o => PAID_STATUSES.includes((o.payment_status || '').toLowerCase())).reduce((a, o) => a + toXOF(o.amount, o.currency), 0)
    const totalEncaisseDocs = docs.filter(d => d.type === 'facture' && PAID_STATUSES.includes(d.status?.toLowerCase())).reduce((a, d) => a + toXOF(d.total, d.currency), 0)
    const totalRevenue = totalEncaisseDocs + totalOrders + totalManuellement
    const totalDepenses = depenses.reduce((a, d) => a + (d.montant || 0), 0)  // dépenses en XOF
    const profit = totalRevenue - totalDepenses

    const pendingDocs = docs.filter(d => d.type === 'facture' && !PAID_STATUSES.includes(d.status?.toLowerCase()) && d.status !== 'annule' && d.status !== 'refuse' && d.status !== 'brouillon')
    const pendingTotal = pendingDocs.reduce((a, d) => a + toXOF(d.total, d.currency), 0)

    // Agrégation par agent (filtrée par période, tous agents confondus)
    const perAgent = useMemo(() => {
        const rows = new Map<string, { agent_id: string; name: string; facture: number; encaisse: number; paiementsManuels: number; depenses: number; nbDocs: number; nbPaiements: number }>()
        const ensure = (id: string | undefined) => {
            const key = id || 'unknown'
            if (!rows.has(key)) {
                rows.set(key, {
                    agent_id: key,
                    name: id ? (agentMap.get(id) || `Agent ${id.slice(0, 6)}`) : 'Non assigné',
                    facture: 0, encaisse: 0, paiementsManuels: 0, depenses: 0, nbDocs: 0, nbPaiements: 0,
                })
            }
            return rows.get(key)!
        }
        allDocs.filter(d => inPeriod(d.created_at)).forEach(d => {
            const r = ensure(d.agent_id)
            if (d.type === 'facture') {
                r.facture += toXOF(d.total, d.currency)
                r.nbDocs += 1
                if (PAID_STATUSES.includes(d.status?.toLowerCase())) r.encaisse += toXOF(d.total, d.currency)
            }
        })
        allPaiements.filter(p => inPeriod(p.date_paiement)).forEach(p => {
            const r = ensure(p.agent_id)
            r.paiementsManuels += Number(p.montant || 0)
            r.nbPaiements += 1
        })
        allDepenses.filter(d => inPeriod(d.date_depense)).forEach(d => {
            const r = ensure(d.agent_id)
            r.depenses += Number(d.montant || 0)
        })
        return Array.from(rows.values()).sort((a, b) => (b.encaisse + b.paiementsManuels) - (a.encaisse + a.paiementsManuels))
    }, [allDocs, allPaiements, allDepenses, agentMap, inPeriod])

    const docsById = useMemo(() => new Map(allDocs.map(d => [d.id, d])), [allDocs])

    const handleExport = async () => {
        const scopeLabel = agentFilter === 'all' ? 'Tous_agents' : (agentMap.get(agentFilter) || 'Agent').replace(/\s+/g, '_')
        const pLabel = periodLabel(selectedPeriod)
        const subtitle = `Vue ${agentFilter === 'all' ? 'consolidée CEO — tous agents' : agentMap.get(agentFilter) || agentFilter}   —   Période : ${pLabel}   —   Document strictement confidentiel`

        const enrichDoc = (d: FinancialDoc) => {
            const ht = typeof d.sous_total === 'number' ? d.sous_total : (d.items || []).reduce((a, it) => a + Number(it.quantity || 0) * Number(it.unit_price || 0), 0)
            const tva = typeof d.total_tva === 'number' ? d.total_tva : (d.items || []).reduce((a, it) => a + Number(it.quantity || 0) * Number(it.unit_price || 0) * Number(it.tva || 0) / 100, 0)
            const remise = Number(d.remise || 0)
            const ttc = Number(d.total || 0)
            return { ht, tva, remise, ttc }
        }

        // Synthèse
        const totalHT = docs.filter(d => d.type === 'facture').reduce((a, d) => a + enrichDoc(d).ht, 0)
        const totalTVA = docs.filter(d => d.type === 'facture').reduce((a, d) => a + enrichDoc(d).tva, 0)
        const totalRemise = docs.filter(d => d.type === 'facture').reduce((a, d) => a + enrichDoc(d).remise, 0)

        const resume = {
            sheetName: 'Synthèse',
            title: 'SYNTHÈSE FINANCIÈRE CONSOLIDÉE',
            subtitle,
            legalHeader: true,
            columns: [
                { header: 'Indicateur', key: 'label', width: 46 },
                { header: 'Valeur (FCFA)', key: 'value', width: 24, type: 'currency' as const },
            ],
            data: [
                { label: 'Chiffre d\'affaires HT facturé', value: totalHT },
                { label: 'TVA collectée', value: totalTVA },
                { label: 'Remises accordées', value: totalRemise },
                { label: 'Chiffre d\'affaires TTC facturé', value: totalFacture },
                { label: 'Encaissé sur factures (statut payé)', value: totalEncaisseDocs },
                { label: 'Encaissé par paiements manuels enregistrés', value: totalManuellement },
                { label: 'Revenus commandes boutique', value: totalOrders },
                { label: 'Revenu total consolidé', value: totalRevenue },
                { label: 'Total dépenses période', value: totalDepenses },
                { label: 'Bénéfice net', value: profit },
                { label: 'Factures en attente d\'encaissement', value: pendingTotal },
                { label: 'Nombre de factures émises', value: docs.filter(d => d.type === 'facture').length },
                { label: 'Nombre de paiements enregistrés', value: paiements.length },
                { label: 'Nombre de dépenses enregistrées', value: depenses.length },
            ],
        }

        // Journal consolidé
        type JournalRow = { date: Date; piece: string; agent: string; libelle: string; mode: string; debit: number; credit: number }
        const journalRows: JournalRow[] = []
        docs.filter(d => d.type === 'facture').forEach(d => {
            journalRows.push({
                date: new Date(d.created_at),
                piece: d.numero || '—',
                agent: d.agent_id ? (agentMap.get(d.agent_id) || '—') : '—',
                libelle: `Facture émise — ${d.client_nom || ''} ${d.client_prenom || ''}`.trim(),
                mode: '—',
                debit: 0,
                credit: Number(d.total || 0),
            })
        })
        paiements.forEach(p => {
            const d = docsById.get(p.document_id)
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
        orders.filter(o => PAID_STATUSES.includes((o.payment_status || '').toLowerCase())).forEach(o => {
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
        depenses.forEach(e => {
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
                { header: 'Mode', key: 'mode', width: 18, type: 'status' as const },
                { header: 'Débit (FCFA)', key: 'debit', width: 18, type: 'currency' as const, totalFormula: 'sum' as const },
                { header: 'Crédit (FCFA)', key: 'credit', width: 18, type: 'currency' as const, totalFormula: 'sum' as const },
            ],
            data: journalRows,
        }

        const perAgentSheet = {
            sheetName: 'Par Agent',
            title: 'PERFORMANCES PAR AGENT',
            subtitle,
            legalHeader: true,
            totalRow: true,
            columns: [
                { header: 'Agent', key: 'name', width: 28 },
                { header: 'Nb factures', key: 'nbDocs', width: 14, type: 'number' as const, totalFormula: 'sum' as const },
                { header: 'Facturé', key: 'facture', width: 18, type: 'currency' as const, totalFormula: 'sum' as const },
                { header: 'Encaissé docs', key: 'encaisse', width: 18, type: 'currency' as const, totalFormula: 'sum' as const },
                { header: 'Paiements manuels', key: 'paiementsManuels', width: 20, type: 'currency' as const, totalFormula: 'sum' as const },
                { header: 'Dépenses', key: 'depenses', width: 18, type: 'currency' as const, totalFormula: 'sum' as const },
                { header: 'Net', key: 'net', width: 18, type: 'currency' as const, totalFormula: 'sum' as const },
            ],
            data: perAgent.map(a => ({
                name: a.name,
                nbDocs: a.nbDocs,
                facture: a.facture,
                encaisse: a.encaisse,
                paiementsManuels: a.paiementsManuels,
                depenses: a.depenses,
                net: a.encaisse + a.paiementsManuels - a.depenses,
            })),
        }

        // Documents enrichis HT/TVA/TTC
        const docsSheet = {
            sheetName: 'Documents',
            title: 'DOCUMENTS FINANCIERS (DEVIS & FACTURES)',
            subtitle,
            legalHeader: true,
            totalRow: true,
            columns: [
                { header: 'N° Document', key: 'numero', width: 22, group: 'Identification' },
                { header: 'Type', key: 'type', width: 11, type: 'status' as const, group: 'Identification' },
                { header: 'Date', key: 'date', width: 13, type: 'date' as const, group: 'Identification' },
                { header: 'Agent', key: 'agent', width: 22, group: 'Identification' },
                { header: 'Client', key: 'client', width: 26, group: 'Client' },
                { header: 'Email', key: 'email', width: 24, group: 'Client' },
                { header: 'Sous-total HT', key: 'ht', width: 16, type: 'currency' as const, totalFormula: 'sum' as const, group: 'Montants HT / TVA / TTC' },
                { header: 'TVA', key: 'tva', width: 14, type: 'currency' as const, totalFormula: 'sum' as const, group: 'Montants HT / TVA / TTC' },
                { header: 'Remise', key: 'remise', width: 13, type: 'currency' as const, totalFormula: 'sum' as const, group: 'Montants HT / TVA / TTC' },
                { header: 'TOTAL TTC', key: 'ttc', width: 17, type: 'currency' as const, totalFormula: 'sum' as const, group: 'Montants HT / TVA / TTC' },
                { header: 'Statut', key: 'status', width: 14, type: 'status' as const, group: 'État' },
            ],
            data: docs.map(d => {
                const { ht, tva, remise, ttc } = enrichDoc(d)
                return {
                    numero: d.numero || '—',
                    type: DOC_TYPES[d.type] || d.type,
                    date: new Date(d.created_at),
                    agent: d.agent_id ? (agentMap.get(d.agent_id) || '—') : '—',
                    client: `${d.client_nom || ''} ${d.client_prenom || ''}`.trim() || '—',
                    email: d.client_email || '',
                    ht, tva, remise, ttc,
                    status: STATUS_LABELS[d.status] || d.status,
                }
            }),
        }

        // Lignes d'articles
        const lignesRows: Array<Record<string, unknown>> = []
        docs.forEach(d => {
            const items = Array.isArray(d.items) ? d.items : []
            items.forEach((it, idx) => {
                const qty = Number(it.quantity || 0)
                const pu = Number(it.unit_price || 0)
                const tvaRate = Number(it.tva || 0)
                const ht = qty * pu
                const tvaVal = ht * tvaRate / 100
                lignesRows.push({
                    date: new Date(d.created_at),
                    numero: d.numero || '—',
                    type: DOC_TYPES[d.type] || d.type,
                    agent: d.agent_id ? (agentMap.get(d.agent_id) || '—') : '—',
                    client: `${d.client_nom || ''} ${d.client_prenom || ''}`.trim(),
                    ligne: idx + 1,
                    description: it.description || '',
                    qty, pu, ht,
                    tva_taux: tvaRate / 100,
                    tva_montant: tvaVal,
                    ttc: ht + tvaVal,
                })
            })
        })
        const lignesSheet = {
            sheetName: 'Lignes d\'articles',
            title: 'DÉTAIL DES LIGNES D\'ARTICLES',
            subtitle,
            legalHeader: true,
            totalRow: true,
            columns: [
                { header: 'Date', key: 'date', width: 13, type: 'date' as const, group: 'Pièce' },
                { header: 'N° Document', key: 'numero', width: 20, group: 'Pièce' },
                { header: 'Type', key: 'type', width: 11, type: 'status' as const, group: 'Pièce' },
                { header: 'Agent', key: 'agent', width: 20, group: 'Pièce' },
                { header: 'Client', key: 'client', width: 24, group: 'Pièce' },
                { header: 'N°', key: 'ligne', width: 6, type: 'number' as const, group: 'Article' },
                { header: 'Description', key: 'description', width: 40, group: 'Article' },
                { header: 'Qté', key: 'qty', width: 8, type: 'number' as const, totalFormula: 'sum' as const, group: 'Article' },
                { header: 'PU', key: 'pu', width: 14, type: 'currency' as const, group: 'Article' },
                { header: 'HT', key: 'ht', width: 15, type: 'currency' as const, totalFormula: 'sum' as const, group: 'Calcul TVA' },
                { header: 'Taux TVA', key: 'tva_taux', width: 11, type: 'percent' as const, group: 'Calcul TVA' },
                { header: 'TVA', key: 'tva_montant', width: 14, type: 'currency' as const, totalFormula: 'sum' as const, group: 'Calcul TVA' },
                { header: 'TTC', key: 'ttc', width: 15, type: 'currency' as const, totalFormula: 'sum' as const, group: 'Calcul TVA' },
            ],
            data: lignesRows,
        }

        const paiementsSheet = {
            sheetName: 'Paiements',
            title: 'REGISTRE DES PAIEMENTS ENCAISSÉS',
            subtitle,
            legalHeader: true,
            totalRow: true,
            columns: [
                { header: 'Date', key: 'date', width: 13, type: 'date' as const },
                { header: 'Agent', key: 'agent', width: 22 },
                { header: 'N° Facture', key: 'numero', width: 20 },
                { header: 'Client / Libellé', key: 'client', width: 30 },
                { header: 'Mode', key: 'type', width: 16, type: 'status' as const },
                { header: 'Référence', key: 'reference', width: 20 },
                { header: 'Montant (FCFA)', key: 'montant', width: 18, type: 'currency' as const, totalFormula: 'sum' as const },
                { header: 'Notes', key: 'notes', width: 30 },
            ],
            data: paiements.map(p => {
                const d = docsById.get(p.document_id)
                const isExterne = !d && /^\[EXTERNE\]/i.test(p.notes || '')
                const libelleExterne = isExterne ? (p.notes || '').replace(/^\[EXTERNE\]\s*/i, '').split('|')[0].trim() : ''
                return {
                    date: new Date(p.date_paiement),
                    agent: p.agent_id ? (agentMap.get(p.agent_id) || '—') : '—',
                    numero: d?.numero || (isExterne ? 'EXTERNE' : '—'),
                    client: d ? `${d.client_nom || ''} ${d.client_prenom || ''}`.trim() : (isExterne ? libelleExterne : '—'),
                    type: PAYMENT_LABELS[p.type] || p.type,
                    reference: p.reference || '',
                    montant: Number(p.montant),
                    notes: p.notes || '',
                }
            }),
        }

        const depensesSheet = {
            sheetName: 'Dépenses',
            title: 'REGISTRE DES DÉPENSES',
            subtitle,
            legalHeader: true,
            totalRow: true,
            columns: [
                { header: 'Date', key: 'date', width: 13, type: 'date' as const },
                { header: 'Agent', key: 'agent', width: 22 },
                { header: 'Titre', key: 'titre', width: 40 },
                { header: 'Catégorie', key: 'categorie', width: 16, type: 'status' as const },
                { header: 'Montant (FCFA)', key: 'montant', width: 18, type: 'currency' as const, totalFormula: 'sum' as const },
            ],
            data: depenses.map(e => ({
                date: new Date(e.date_depense),
                agent: e.agent_id ? (agentMap.get(e.agent_id) || '—') : '—',
                titre: e.titre || '—',
                categorie: e.categorie || '—',
                montant: Number(e.montant),
            })),
        }

        // Rapprochement bancaire consolidé
        const modeBuckets = new Map<string, { nb: number; total: number }>()
        paiements.forEach(p => {
            const key = PAYMENT_LABELS[p.type] || p.type
            const b = modeBuckets.get(key) || { nb: 0, total: 0 }
            b.nb += 1
            b.total += Number(p.montant || 0)
            modeBuckets.set(key, b)
        })
        orders.filter(o => PAID_STATUSES.includes((o.payment_status || '').toLowerCase())).forEach(o => {
            const key = PAYMENT_LABELS[(o.payment_method || '').toLowerCase()] || (o.payment_method || 'Autre')
            const b = modeBuckets.get(key) || { nb: 0, total: 0 }
            b.nb += 1
            b.total += Number(o.amount || 0)
            modeBuckets.set(key, b)
        })
        const rapprochementSheet = {
            sheetName: 'Rapprochement',
            title: 'RAPPROCHEMENT BANCAIRE PAR MODE DE PAIEMENT',
            subtitle,
            legalHeader: true,
            totalRow: true,
            columns: [
                { header: 'Mode de paiement', key: 'mode', width: 30 },
                { header: 'Nb transactions', key: 'nb', width: 18, type: 'number' as const, totalFormula: 'sum' as const },
                { header: 'Total encaissé (FCFA)', key: 'total', width: 22, type: 'currency' as const, totalFormula: 'sum' as const },
            ],
            data: Array.from(modeBuckets.entries()).map(([mode, v]) => ({ mode, nb: v.nb, total: v.total })),
        }

        const nbFacturesPayees = docs.filter(d => d.type === 'facture' && PAID_STATUSES.includes(d.status?.toLowerCase())).length

        await exportToExcelMultiSheet({
            filename: `RGB_CEO_Compta_${periodSlug(selectedPeriod)}_${scopeLabel}_${new Date().toISOString().split('T')[0]}`,
            coverTitle: 'Rapport comptable consolidé CEO',
            coverSubtitle: 'À l\'attention du comptable — Synthèse officielle de la période',
            coverPeriod: pLabel,
            dashboard: {
                title: 'DASHBOARD COMPTABLE CONSOLIDÉ',
                subtitle,
                kpis: [
                    { label: 'Revenu total consolidé', value: totalRevenue, type: 'currency', tone: 'good', detail: 'Factures payées + Boutique + Paiements manuels' },
                    { label: 'Encaissé sur factures', value: totalEncaisseDocs, type: 'currency', tone: 'good', detail: `${nbFacturesPayees} factures payées` },
                    { label: 'Paiements manuels', value: totalManuellement, type: 'currency', tone: 'good', detail: `${paiements.length} paiements (virement / espèces / chèque)` },
                    { label: 'Revenus boutique', value: totalOrders, type: 'currency', tone: 'accent', detail: `${orders.filter(o => PAID_STATUSES.includes((o.payment_status || '').toLowerCase())).length} commandes payées` },
                    { label: 'TVA collectée', value: totalTVA, type: 'currency', tone: 'neutral', detail: 'À déclarer à la DGI' },
                    { label: 'Factures en attente', value: pendingTotal, type: 'currency', tone: 'warn', detail: `${pendingDocs.length} factures non soldées` },
                    { label: 'Dépenses totales', value: totalDepenses, type: 'currency', tone: 'bad', detail: `${depenses.length} dépenses enregistrées` },
                    { label: 'Bénéfice net', value: profit, type: 'currency', tone: profit >= 0 ? 'good' : 'bad', detail: 'Revenu total − Dépenses' },
                ],
            },
            sheets: [resume, journalSheet, perAgentSheet, docsSheet, lignesSheet, paiementsSheet, depensesSheet, rapprochementSheet],
        })
    }

    return (
        <div className="min-h-screen p-6 lg:p-8" style={{ background: BG, color: TEXT }}>
            {/* Header */}
            <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-8 gap-4 flex-wrap">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${GOLD}20` }}>
                            <Calculator size={18} style={{ color: GOLD }} />
                        </div>
                        <h1 className="text-2xl font-black tracking-tight">Comptabilité ERP — Vue CEO</h1>
                    </div>
                    <p className="text-sm opacity-50">Consolidation complète RGB — tous agents, factures, paiements et dépenses</p>
                </div>
                <div className="flex gap-2 flex-wrap items-center">
                    <div className="flex items-center rounded-xl border bg-white overflow-hidden"
                        style={{ borderColor: `${GOLD}30` }}>
                        <button
                            title="Mois précédent"
                            onClick={() => {
                                const base = isMonth(selectedPeriod) ? selectedPeriod : currentMonthKey()
                                setSelectedPeriod(shiftMonth(base, -1))
                            }}
                            className="p-2.5 hover:opacity-70"
                            style={{ color: TEXT }}
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <select
                            title="Sélectionner la période"
                            value={selectedPeriod}
                            onChange={e => setSelectedPeriod(e.target.value)}
                            className="bg-transparent px-3 py-2 text-sm font-semibold outline-none min-w-[170px]"
                            style={{ color: TEXT }}
                        >
                            {last12Months().map(m => (
                                <option key={m} value={m}>{monthLabel(m)}</option>
                            ))}
                            <option value="3_mois">3 derniers mois</option>
                            <option value="tous">Global</option>
                        </select>
                        <button
                            title="Mois suivant"
                            disabled={isMonth(selectedPeriod) && selectedPeriod >= currentMonthKey()}
                            onClick={() => {
                                const base = isMonth(selectedPeriod) ? selectedPeriod : currentMonthKey()
                                const next = shiftMonth(base, 1)
                                if (next <= currentMonthKey()) setSelectedPeriod(next)
                            }}
                            className="p-2.5 hover:opacity-70 disabled:opacity-30"
                            style={{ color: TEXT }}
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                    <select
                        title="Filtrer par agent"
                        value={agentFilter}
                        onChange={e => setAgentFilter(e.target.value)}
                        className="px-4 py-2 rounded-xl text-sm font-semibold bg-white border"
                        style={{ borderColor: `${GOLD}30`, color: TEXT }}
                    >
                        <option value="all"> Tous les agents</option>
                        {agents.filter(a => a.role === 'agent').map(a => (
                            <option key={a.id} value={a.id}>{a.full_name || a.id.slice(0, 8)}</option>
                        ))}
                    </select>
                    <button onClick={handleExport}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-80"
                        style={{ background: `${GOLD}25`, color: GOLD }}>
                        <Download size={14} /> Exporter
                    </button>
                    <button onClick={() => setRefresh(r => r + 1)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-80"
                        style={{ background: `${GREEN_L}25`, color: GREEN_L }}>
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualiser
                    </button>
                </div>
            </motion.div>

            {/* ── LOT 3 : VERROU PÉRIODE ── */}
            {!loading && data && (
                <div className="mb-6">
                    <ComptaLockPanel
                        currentPeriod={selectedPeriod}
                        isMonthPeriod={isMonth(selectedPeriod)}
                        periodLabel={periodLabel(selectedPeriod)}
                        clotures={data.clotures || []}
                        snapshot={{
                            totalEncaisse: totalRevenue,
                            totalDepenses,
                            beneficeNet: profit,
                            nbDocuments: docs.length,
                            nbPaiements: paiements.length,
                            nbDepenses: depenses.length,
                        }}
                        onChange={load}
                        fmt={fmt}
                    />
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center py-32"><Loader2 size={32} className="animate-spin opacity-40" /></div>
            ) : (
                <>
                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                        {[
                            { label: 'Revenus totaux', value: fmt(totalRevenue), color: GREEN_L, icon: TrendingUp },
                            { label: 'Encaissé manuel', value: fmt(totalManuellement), color: GOLD, icon: Banknote },
                            { label: 'Commandes', value: fmt(totalOrders), color: GOLD, icon: DollarSign },
                            { label: 'Dépenses', value: fmt(totalDepenses), color: RED, icon: TrendingDown },
                            { label: 'Bénéfice net', value: fmt(profit), color: profit >= 0 ? GREEN_L : RED, icon: Calculator },
                        ].map((s, i) => (
                            <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                                className="rounded-2xl p-5" style={{ background: PANEL, border: `1px solid ${s.color}25` }}>
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-xs opacity-40 uppercase tracking-wider">{s.label}</span>
                                    <s.icon size={16} style={{ color: s.color, opacity: 0.7 }} />
                                </div>
                                <div className="text-lg font-black" style={{ color: s.color }}>{s.value}</div>
                            </motion.div>
                        ))}
                    </div>

                    {/* Alerte impayés */}
                    {pendingDocs.length > 0 && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            className="mb-6 p-4 rounded-2xl flex items-center gap-3"
                            style={{ background: `${YELLOW}12`, border: `1px solid ${YELLOW}30` }}>
                            <AlertTriangle size={18} style={{ color: YELLOW }} />
                            <div>
                                <p className="text-sm font-bold" style={{ color: YELLOW }}>
                                    {pendingDocs.length} facture{pendingDocs.length > 1 ? 's' : ''} en attente d&apos;encaissement
                                </p>
                                <p className="text-xs opacity-60">Montant total en attente : {fmt(pendingTotal)}</p>
                            </div>
                        </motion.div>
                    )}

                    {/* Tabs */}
                    <div className="flex gap-2 mb-6 flex-wrap">
                        {[
                            { key: 'overview', label: 'Vue d\'ensemble' },
                            { key: 'agents', label: `Agents (${perAgent.length})` },
                            { key: 'factures', label: `Documents (${docs.length})` },
                            { key: 'paiements', label: `Paiements (${paiements.length})` },
                            { key: 'commandes', label: `Commandes (${orders.length})` },
                            { key: 'depenses', label: `Dépenses (${depenses.length})` },
                        ].map(tab => (
                            <button key={tab.key} onClick={() => setActiveTab(tab.key as typeof activeTab)}
                                type="button"
                                className="px-4 py-2 rounded-xl text-sm font-bold transition-all"
                                style={{ background: activeTab === tab.key ? GOLD : `${GOLD}18`, color: activeTab === tab.key ? '#FFFFFF' : GOLD }}>
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Overview */}
                    {activeTab === 'overview' && (
                        <div className="grid lg:grid-cols-2 gap-6">
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                className="rounded-2xl p-5" style={{ background: PANEL, border: `1px solid ${GOLD}15` }}>
                                <h3 className="font-bold text-sm mb-4" style={{ color: GOLD }}>Dernières factures</h3>
                                {docs.filter(d => d.type === 'facture').slice(0, 8).map(d => (
                                    <div key={d.id} className="flex items-center justify-between py-2 border-b text-sm"
                                        style={{ borderColor: `${GOLD}10` }}>
                                        <div>
                                            <div className="font-semibold text-xs">{d.client_nom} {d.client_prenom}</div>
                                            <div className="text-xs opacity-40">{fmtDate(d.created_at)} · {d.agent_id ? agentMap.get(d.agent_id) || '—' : '—'}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-black text-xs" style={{ color: GREEN_L }}>{fmt(d.total)}</div>
                                            <div className="text-[10px] opacity-50">{STATUS_LABELS[d.status] || d.status}</div>
                                        </div>
                                    </div>
                                ))}
                                {docs.filter(d => d.type === 'facture').length === 0 && (
                                    <p className="text-xs opacity-40 py-4 text-center">Aucune facture</p>
                                )}
                            </motion.div>
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
                                className="rounded-2xl p-5" style={{ background: PANEL, border: `1px solid ${GOLD}15` }}>
                                <h3 className="font-bold text-sm mb-4" style={{ color: GOLD }}>Derniers paiements manuels</h3>
                                {paiements.slice(0, 8).map(p => {
                                    const d = docsById.get(p.document_id)
                                    return (
                                        <div key={p.id} className="flex items-center justify-between py-2 border-b text-sm"
                                            style={{ borderColor: `${GOLD}10` }}>
                                            <div>
                                                <div className="font-semibold text-xs">{d?.numero || '—'} · {PAYMENT_LABELS[p.type] || p.type}</div>
                                                <div className="text-xs opacity-40">{fmtDate(p.date_paiement)} · {p.agent_id ? agentMap.get(p.agent_id) || '—' : '—'}</div>
                                            </div>
                                            <div className="font-black text-xs" style={{ color: GREEN_L }}>{fmt(Number(p.montant))}</div>
                                        </div>
                                    )
                                })}
                                {paiements.length === 0 && (
                                    <p className="text-xs opacity-40 py-4 text-center">Aucun paiement manuel</p>
                                )}
                            </motion.div>
                        </div>
                    )}

                    {/* Par Agent */}
                    {activeTab === 'agents' && (
                        <div className="rounded-2xl overflow-hidden" style={{ background: PANEL, border: `1px solid ${GOLD}15` }}>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-xs opacity-40 uppercase tracking-wider border-b" style={{ borderColor: `${GOLD}10` }}>
                                            <th className="text-left px-5 py-3"><Users size={12} className="inline mr-1" /> Agent</th>
                                            <th className="text-right px-5 py-3">Nb fact.</th>
                                            <th className="text-right px-5 py-3">Facturé</th>
                                            <th className="text-right px-5 py-3">Encaissé docs</th>
                                            <th className="text-right px-5 py-3">Paiements manuels</th>
                                            <th className="text-right px-5 py-3">Dépenses</th>
                                            <th className="text-right px-5 py-3">Net</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {perAgent.map(a => {
                                            const net = a.encaisse + a.paiementsManuels - a.depenses
                                            return (
                                                <tr key={a.agent_id} className="border-b hover:bg-black/[0.02]" style={{ borderColor: `${GOLD}08` }}>
                                                    <td className="px-5 py-3 text-xs font-semibold">{a.name}</td>
                                                    <td className="px-5 py-3 text-right text-xs opacity-60">{a.nbDocs}</td>
                                                    <td className="px-5 py-3 text-right text-xs">{fmt(a.facture)}</td>
                                                    <td className="px-5 py-3 text-right font-black text-xs" style={{ color: GREEN_L }}>{fmt(a.encaisse)}</td>
                                                    <td className="px-5 py-3 text-right font-black text-xs" style={{ color: GOLD }}>{fmt(a.paiementsManuels)}</td>
                                                    <td className="px-5 py-3 text-right text-xs" style={{ color: RED }}>{fmt(a.depenses)}</td>
                                                    <td className="px-5 py-3 text-right font-black text-xs" style={{ color: net >= 0 ? GREEN_L : RED }}>{fmt(net)}</td>
                                                </tr>
                                            )
                                        })}
                                        {perAgent.length === 0 && (
                                            <tr><td colSpan={7} className="text-center py-8 text-xs opacity-40">Aucune donnée</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Documents */}
                    {activeTab === 'factures' && (
                        <div className="rounded-2xl overflow-hidden" style={{ background: PANEL, border: `1px solid ${GOLD}15` }}>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-xs opacity-40 uppercase tracking-wider border-b" style={{ borderColor: `${GOLD}10` }}>
                                            <th className="text-left px-5 py-3">Type</th>
                                            <th className="text-left px-5 py-3">Agent</th>
                                            <th className="text-left px-5 py-3">Client</th>
                                            <th className="text-left px-5 py-3">Date</th>
                                            <th className="text-left px-5 py-3">Statut</th>
                                            <th className="text-right px-5 py-3">Montant</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {docs.map(d => (
                                            <tr key={d.id} className="border-b hover:bg-black/[0.02]" style={{ borderColor: `${GOLD}08` }}>
                                                <td className="px-5 py-3">
                                                    <span className="text-[10px] font-black px-2 py-1 rounded-full"
                                                        style={{ background: `${GOLD}15`, color: GOLD }}>
                                                        {DOC_TYPES[d.type] || d.type}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3 text-xs opacity-60">{d.agent_id ? agentMap.get(d.agent_id) || '—' : '—'}</td>
                                                <td className="px-5 py-3 text-xs">{d.client_nom} {d.client_prenom}</td>
                                                <td className="px-5 py-3 text-xs opacity-50">{fmtDate(d.created_at)}</td>
                                                <td className="px-5 py-3 text-xs opacity-60">{STATUS_LABELS[d.status] || d.status}</td>
                                                <td className="px-5 py-3 text-right font-black text-xs" style={{ color: GREEN_L }}>{fmt(d.total)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Paiements */}
                    {activeTab === 'paiements' && (
                        <div className="rounded-2xl overflow-hidden" style={{ background: PANEL, border: `1px solid ${GOLD}15` }}>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-xs opacity-40 uppercase tracking-wider border-b" style={{ borderColor: `${GOLD}10` }}>
                                            <th className="text-left px-5 py-3">Date</th>
                                            <th className="text-left px-5 py-3">Agent</th>
                                            <th className="text-left px-5 py-3">Document</th>
                                            <th className="text-left px-5 py-3">Mode</th>
                                            <th className="text-left px-5 py-3">Référence</th>
                                            <th className="text-right px-5 py-3">Montant</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paiements.map(p => {
                                            const d = docsById.get(p.document_id)
                                            return (
                                                <tr key={p.id} className="border-b hover:bg-black/[0.02]" style={{ borderColor: `${GOLD}08` }}>
                                                    <td className="px-5 py-3 text-xs opacity-50">{fmtDate(p.date_paiement)}</td>
                                                    <td className="px-5 py-3 text-xs opacity-60">{p.agent_id ? agentMap.get(p.agent_id) || '—' : '—'}</td>
                                                    <td className="px-5 py-3 text-xs">{d?.numero || '—'} <span className="opacity-50">· {d?.client_nom || ''}</span></td>
                                                    <td className="px-5 py-3">
                                                        <span className="text-[10px] font-black px-2 py-1 rounded-full"
                                                            style={{ background: `${GREEN_L}15`, color: GREEN_L }}>
                                                            {PAYMENT_LABELS[p.type] || p.type}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-3 text-xs opacity-50">{p.reference || '—'}</td>
                                                    <td className="px-5 py-3 text-right font-black text-xs" style={{ color: GREEN_L }}>{fmt(Number(p.montant))}</td>
                                                </tr>
                                            )
                                        })}
                                        {paiements.length === 0 && (
                                            <tr><td colSpan={6} className="text-center py-8 text-xs opacity-40">Aucun paiement</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Orders */}
                    {activeTab === 'commandes' && (
                        <div className="rounded-2xl overflow-hidden" style={{ background: PANEL, border: `1px solid ${GOLD}15` }}>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-xs opacity-40 uppercase tracking-wider border-b" style={{ borderColor: `${GOLD}10` }}>
                                            <th className="text-left px-5 py-3">Client</th>
                                            <th className="text-left px-5 py-3">Produit</th>
                                            <th className="text-left px-5 py-3">Méthode</th>
                                            <th className="text-left px-5 py-3">Statut</th>
                                            <th className="text-right px-5 py-3">Montant</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {orders.map(o => (
                                            <tr key={o.id} className="border-b hover:bg-black/[0.02]" style={{ borderColor: `${GOLD}08` }}>
                                                <td className="px-5 py-3">
                                                    <div className="text-xs font-semibold">{o.customer_name || '—'}</div>
                                                    <div className="text-xs opacity-40">{o.customer_email}</div>
                                                </td>
                                                <td className="px-5 py-3 text-xs opacity-60">{o.product_title || '—'}</td>
                                                <td className="px-5 py-3 text-xs opacity-50">{o.payment_method || '—'}</td>
                                                <td className="px-5 py-3">
                                                    <span className="text-[10px] font-bold"
                                                        style={{ color: PAID_STATUSES.includes((o.payment_status || '').toLowerCase()) ? GREEN_L : YELLOW }}>
                                                        {o.payment_status || '—'}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3 text-right font-black text-xs" style={{ color: GREEN_L }}>{fmt(o.amount)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Depenses */}
                    {activeTab === 'depenses' && (
                        <div className="rounded-2xl overflow-hidden" style={{ background: PANEL, border: `1px solid ${GOLD}15` }}>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-xs opacity-40 uppercase tracking-wider border-b" style={{ borderColor: `${GOLD}10` }}>
                                            <th className="text-left px-5 py-3">Titre</th>
                                            <th className="text-left px-5 py-3">Agent</th>
                                            <th className="text-left px-5 py-3">Catégorie</th>
                                            <th className="text-left px-5 py-3">Date</th>
                                            <th className="text-right px-5 py-3">Montant</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {depenses.map(d => (
                                            <tr key={d.id} className="border-b hover:bg-black/[0.02]" style={{ borderColor: `${GOLD}08` }}>
                                                <td className="px-5 py-3 text-xs font-semibold">{d.titre || '—'}</td>
                                                <td className="px-5 py-3 text-xs opacity-60">{d.agent_id ? agentMap.get(d.agent_id) || '—' : '—'}</td>
                                                <td className="px-5 py-3 text-xs opacity-60">{d.categorie || '—'}</td>
                                                <td className="px-5 py-3 text-xs opacity-50">{fmtDate(d.date_depense)}</td>
                                                <td className="px-5 py-3 text-right font-black text-xs" style={{ color: RED }}>{fmt(d.montant)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
