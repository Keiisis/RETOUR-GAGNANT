'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import {
    Wallet, TrendingUp, ArrowUpRight, ArrowDownRight, Download, Activity, CheckCircle2,
    BarChart3, Landmark, ArrowRight, FileText, X, TrendingDown, Zap, MessageCircle,
    RefreshCw, Plus, AlertTriangle, Banknote, CreditCard, Bell, ChevronLeft, ChevronRight,
    Receipt, ShoppingBag, Users, Pencil, Trash2
} from 'lucide-react'
import { EXPENSE_CATEGORIES, agentHasComptaAccess, expenseCategoryLabel } from '@/lib/constants/compta'
import { useTranslation } from '@/lib/translation'
import { exportRegistreComptable, RegistreRecette, RegistreDepense } from '@/lib/exportRegistreComptable'
import { toXOF, loadExchangeRates } from '@/lib/currency-convert'
import { 
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    AreaChart, Area
} from 'recharts'

interface DocumentItem {
    description?: string
    quantity?: number
    unit_price?: number
    tva?: number
    unit_cost?: number
}

interface DocumentFinancier {
    id: string
    type: 'devis' | 'facture'
    numero: string
    client_nom: string
    client_prenom: string
    client_phone?: string
    client_email?: string
    client_adresse?: string
    total: number
    sous_total?: number
    total_tva?: number
    remise?: number
    items?: DocumentItem[]
    currency?: string
    status: string
    created_at: string
}

interface Depense {
    id: string
    titre: string
    categorie: string
    montant: number
    date_depense: string
}

// Taux de commission par défaut supprimé (sera récupéré en BDD)

// ── Helpers de Périodes ──────────────────────────────────────────
// Period = 'tous' | '3_mois' | 'YYYY-MM' (mois civil précis)
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
    if (isMonth(period)) return period
    return period
}

function getPeriodRange(period: Period): { start: Date; end: Date } {
    const now = new Date()
    const fullEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

    if (period === 'tous') return { start: new Date(0), end: fullEnd }
    if (period === '3_mois') return { start: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000), end: fullEnd }
    if (isMonth(period)) {
        const [y, m] = period.split('-').map(Number)
        const start = new Date(y, m - 1, 1, 0, 0, 0, 0)
        const end = new Date(y, m, 0, 23, 59, 59, 999)
        return { start, end }
    }
    return { start: new Date(0), end: fullEnd }
}

function getPreviousPeriodRange(period: Period): { start: Date; end: Date } {
    if (isMonth(period)) {
        const prev = shiftMonth(period, -1)
        return getPeriodRange(prev)
    }
    const now = new Date()
    if (period === '3_mois') {
        const start = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000)
        const end = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        return { start, end }
    }
    return { start: new Date(0), end: new Date(0) }
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

function calcTrend(current: number, previous: number): string | null {
    if (previous === 0) return current > 0 ? '+100' : '0'
    const pct = ((current - previous) / previous) * 100
    return (pct >= 0 ? '+' : '') + pct.toFixed(1)
}

export default function AgentComptabilitePage() {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { t } = useTranslation()
    const [loading, setLoading] = useState(true)
    // ── Accès restreint : la Comptabilité agent est réservée à Ornel
    //    (décision boss 2026-07-16). Les autres agents sont renvoyés au dashboard.
    const [accessChecked, setAccessChecked] = useState(false)
    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (!agentHasComptaAccess(user?.email)) {
                window.location.replace('/agent')
            } else {
                setAccessChecked(true)
            }
        })
    }, [])
    const [allDocs, setAllDocs] = useState<DocumentFinancier[]>([])
    const [expenses, setExpenses] = useState<Depense[]>([])
    const [selectedPeriod, setSelectedPeriod] = useState<Period>(() => currentMonthKey())
    const [showRelancesOnly, setShowRelancesOnly] = useState(false)
    const [showExpenseModal, setShowExpenseModal] = useState(false)
    const [newExpense, setNewExpense] = useState({ titre: '', categorie: 'autre', montant: '', date: '', ifu: '' })
    const [savingExpense, setSavingExpense] = useState(false)
    // Salaires du personnel (espace salaire — impact comptable via depenses/categorie 'salaires')
    const [showSalaireModal, setShowSalaireModal] = useState(false)
    const [newSalaire, setNewSalaire] = useState({ nom: '', prenom: '', poste: '', montant: '', mois: currentMonthKey() })
    const [savingSalaire, setSavingSalaire] = useState(false)
    // Paiements manuels
    const [paiements, setPaiements] = useState<Record<string, number>>({}) // document_id → montant total payé
    const [paiementsList, setPaiementsList] = useState<Array<{ id: string; document_id: string; type: string; montant: number; date_paiement: string; reference: string | null; notes: string | null }>>([])
    const [showPaymentModal, setShowPaymentModal] = useState(false)
    const [paymentDoc, setPaymentDoc] = useState<DocumentFinancier | null>(null)
    const [paymentDocId, setPaymentDocId] = useState<string>('')
    const [newPayment, setNewPayment] = useState({ type: 'virement', montant: '', reference: '', notes: '', date: new Date().toISOString().split('T')[0] })
    const [savingPayment, setSavingPayment] = useState(false)
    const [paymentMode, setPaymentMode] = useState<'site' | 'externe'>('site')
    const [externePayment, setExternePayment] = useState({ libelle: '', client: '' })
    const [currentPage, setCurrentPage] = useState(1)
    const [activeTab, setActiveTab] = useState<'docs' | 'depenses' | 'paiements'>('docs')
    const ITEMS_PER_PAGE = 8

    const [commissionRate, setCommissionRate] = useState(0.10)

    const fetchAllData = async () => {
        setLoading(true)
        await loadExchangeRates()  // taux réels avant normalisation XOF des KPI
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setLoading(false); return }

        // Fetch Documents
        const { data: docs } = await supabase
            .from('documents_financiers')
            .select('*')
            .eq('agent_id', user.id)
            .order('created_at', { ascending: false })

        // Fetch Expenses
        const { data: exp } = await supabase
            .from('depenses')
            .select('*')
            .eq('agent_id', user.id)
            .order('date_depense', { ascending: false })

        // Fetch Settings — commission_rate dans la table settings
        const { data: settings } = await supabase
            .from('settings')
            .select('key,value')
            .eq('key', 'commission_rate')
            .maybeSingle()

        if (settings?.value) {
            setCommissionRate(parseFloat(settings.value))
        }

        // Fetch paiements manuels pour cet agent
        const { data: paiem } = await supabase
            .from('paiements_manuels')
            .select('id, document_id, type, montant, date_paiement, reference, notes')
            .eq('agent_id', user.id)
            .order('date_paiement', { ascending: false })

        if (paiem) {
            const map: Record<string, number> = {}
            paiem.forEach(p => {
                map[p.document_id] = (map[p.document_id] || 0) + Number(p.montant)
            })
            setPaiements(map)
            setPaiementsList(paiem.map(p => ({
                id: String(p.id),
                document_id: String(p.document_id),
                type: String(p.type),
                montant: Number(p.montant),
                date_paiement: String(p.date_paiement),
                reference: p.reference ?? null,
                notes: p.notes ?? null,
            })))
        }

        if (docs) setAllDocs(docs)
        if (exp) setExpenses(exp)
        setLoading(false)
    }

    useEffect(() => {
        const init = async () => {
            await fetchAllData()
        }
        init()
    }, [])

    // ── Données Calculées ───────────────────────────────────────────
    const { start: pStart, end: pEnd } = useMemo(() => getPeriodRange(selectedPeriod), [selectedPeriod])
    const { start: prevStart, end: prevEnd } = useMemo(() => getPreviousPeriodRange(selectedPeriod), [selectedPeriod])

    const periodDocs = useMemo(() => 
        allDocs.filter(d => {
            if (!d.created_at) return false
            const date = new Date(d.created_at)
            if (isNaN(date.getTime())) return false
            return date >= pStart && date <= pEnd
        }), [allDocs, pStart, pEnd])

    const prevDocs = useMemo(() => 
        allDocs.filter(d => {
            if (!d.created_at) return false
            const date = new Date(d.created_at)
            if (isNaN(date.getTime())) return false
            return date >= prevStart && date <= prevEnd
        }), [allDocs, prevStart, prevEnd])

    const periodPaiements = useMemo(() => 
        paiementsList.filter(p => {
            if (!p.date_paiement) return false
            const date = new Date(p.date_paiement)
            if (isNaN(date.getTime())) return false
            return date >= pStart && date <= pEnd
        }), [paiementsList, pStart, pEnd])

    const prevPaiements = useMemo(() => 
        paiementsList.filter(p => {
            if (!p.date_paiement) return false
            const date = new Date(p.date_paiement)
            if (isNaN(date.getTime())) return false
            return date >= prevStart && date <= prevEnd
        }), [paiementsList, prevStart, prevEnd])

    const stats = useMemo(() => {
        const getStats = (list: DocumentFinancier[], expList: Depense[], pList: typeof paiementsList) => {
            const invoices = list.filter(d => d.type === 'facture')
            // Somme des paiements réels reçus
            const encaissePaiements = pList.reduce((acc, p) => acc + Number(p.montant), 0)
            // Plus factures passées payées sans paiement manuel lié (ventes web)
            const docsWithP = new Set(pList.map(p => p.document_id).filter(Boolean))
            const invoicesPayeesSansP = invoices
                .filter(d => d.status === 'paye' && !docsWithP.has(d.id))
                .reduce((acc, d) => acc + toXOF(d.total, d.currency), 0)

            const encaisse = encaissePaiements + invoicesPayeesSansP
            const facture = invoices.reduce((acc, d) => acc + toXOF(d.total, d.currency), 0)
            const attente = invoices.filter(d => d.status === 'envoye' || d.status === 'accepte').reduce((acc, d) => acc + toXOF(d.total, d.currency), 0)
            const totalDepenses = expList.reduce((acc, e) => acc + Number(e.montant), 0)  // dépenses en XOF
            const beneficeNet = encaisse - totalDepenses
            return { 
                encaisse, facture, attente, 
                commission: Math.round(encaisse * commissionRate),
                depenses: totalDepenses,
                beneficeNet
            }
        }

        const curr = getStats(periodDocs, expenses.filter(e => {
            if (!e.date_depense) return false
            const date = new Date(e.date_depense)
            if (isNaN(date.getTime())) return false
            return date >= pStart && date <= pEnd
        }), periodPaiements)
        const prev = getStats(prevDocs, expenses.filter(e => {
            if (!e.date_depense) return false
            const date = new Date(e.date_depense)
            if (isNaN(date.getTime())) return false
            return date >= prevStart && date <= prevEnd
        }), prevPaiements)

        // Predictive Logic
        const daysInPeriod = Math.max(1, (pEnd.getTime() - pStart.getTime()) / (1000 * 60 * 60 * 24))
        const dailyAvg = curr.encaisse / daysInPeriod
        const projection30j = dailyAvg * 30

        return {
            ...curr,
            projection30j,
            trends: {
                encaisse: (selectedPeriod === 'tous') ? null : calcTrend(curr.encaisse, prev.encaisse),
                facture: (selectedPeriod === 'tous') ? null : calcTrend(curr.facture, prev.facture),
                attente: (selectedPeriod === 'tous') ? null : calcTrend(curr.attente, prev.attente),
                commission: (selectedPeriod === 'tous') ? null : calcTrend(curr.commission, prev.commission),
                benefice: (selectedPeriod === 'tous') ? null : calcTrend(curr.beneficeNet, prev.beneficeNet)
            }
        }
    }, [periodDocs, prevDocs, expenses, selectedPeriod, pStart, pEnd, prevStart, prevEnd, commissionRate, periodPaiements, prevPaiements])

    // Data for Recharts (flux de trésorerie réel basé sur les paiements reçus par jour)
    const chartData = useMemo(() => {
        const days: Record<string, number> = {}
        periodPaiements.forEach(p => {
            if (p.date_paiement) {
                const day = new Date(p.date_paiement).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
                days[day] = (days[day] || 0) + Number(p.montant)
            }
        })
        return Object.entries(days).map(([name, total]) => ({ name, total })).reverse()
    }, [periodPaiements])

    const displayedDocs = useMemo(() => {
        let docs = periodDocs
        if (showRelancesOnly) {
            docs = docs.filter(d => d.status === 'envoye' || d.status === 'accepte')
        }
        return docs
    }, [periodDocs, showRelancesOnly])

    const displayedExpenses = useMemo(() => {
        return expenses.filter(e => {
            if (!e.date_depense) return false
            const date = new Date(e.date_depense)
            if (isNaN(date.getTime())) return false
            return date >= pStart && date <= pEnd
        })
    }, [expenses, pStart, pEnd])

    const displayedPaiements = useMemo(() => {
        return periodPaiements
    }, [periodPaiements])

    const jCount = activeTab === 'docs' ? displayedDocs.length : activeTab === 'depenses' ? displayedExpenses.length : displayedPaiements.length
    const totalPages = Math.max(1, Math.ceil(jCount / ITEMS_PER_PAGE))

    const paginatedDocs = useMemo(() => 
        displayedDocs.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE),
        [displayedDocs, currentPage])

    const paginatedExpenses = useMemo(() => 
        displayedExpenses.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE),
        [displayedExpenses, currentPage])

    const paginatedPaiements = useMemo(() => 
        displayedPaiements.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE),
        [displayedPaiements, currentPage])

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('fr-BJ', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(val)
    }

    const handleWhatsAppReminder = (doc: DocumentFinancier) => {
        const message = `Bonjour ${doc.client_nom},\n\nC'est l'agence Retour Gagnant Bénin. Nous vous relançons concernant le document ${doc.numero} d'un montant de ${formatCurrency(doc.total)}.\n\nVous pouvez le consulter et le régler ici : ${window.location.origin}/portail/${doc.id}\n\nCordialement.`
        const encoded = encodeURIComponent(message)
        const phone = doc.client_phone?.replace(/\s+/g, '')
        window.open(`https://wa.me/${phone}?text=${encoded}`, '_blank')
    }

    const handleAddExpense = async (e: React.FormEvent) => {
        e.preventDefault()
        setSavingExpense(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setSavingExpense(false); return }

        // Date optionnelle (peut ne pas être connue pour le moment → date du jour)
        // IFU optionnel : tracé dans le titre (pas de colonne dédiée en base)
        const titre = newExpense.ifu.trim()
            ? `${newExpense.titre.trim()} · IFU: ${newExpense.ifu.trim()}`
            : newExpense.titre.trim()

        const { error } = await supabase.from('depenses').insert({
            agent_id: user.id,
            titre,
            categorie: newExpense.categorie,
            montant: Number(newExpense.montant),
            date_depense: newExpense.date ? new Date(newExpense.date).toISOString() : new Date().toISOString(),
        })

        if (!error) {
            setShowExpenseModal(false)
            setNewExpense({ titre: '', categorie: 'autre', montant: '', date: '', ifu: '' })
            fetchAllData()
        }
        setSavingExpense(false)
    }

    // ── Salaires : enregistrés dans `depenses` (categorie 'salaires') pour que
    //    l'impact comptable (totaux, exports, FEC) soit AUTOMATIQUE. Le titre
    //    encode Nom / Prénom / Poste de façon parseable.
    const handleAddSalaire = async (e: React.FormEvent) => {
        e.preventDefault()
        setSavingSalaire(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setSavingSalaire(false); return }

        const { nom, prenom, poste, montant, mois } = newSalaire
        const { error } = await supabase.from('depenses').insert({
            agent_id: user.id,
            titre: `Salaire ${mois} — ${nom.trim().toUpperCase()} ${prenom.trim()} — ${poste.trim()}`,
            categorie: 'salaires',
            montant: Number(montant),
            date_depense: new Date(`${mois}-28T12:00:00Z`).toISOString(),
        })

        if (!error) {
            setShowSalaireModal(false)
            setNewSalaire({ nom: '', prenom: '', poste: '', montant: '', mois: currentMonthKey() })
            fetchAllData()
        }
        setSavingSalaire(false)
    }

    // Suppression d'un paiement (notamment les doublons de paiements externes
    // qui faussent la comptabilité)
    const deletePaiement = async (id: string, libelle: string) => {
        if (!confirm(`Supprimer ce paiement ?\n${libelle}\n\nCette action est définitive.`)) return
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch(`/api/admin/paiements-manuels?id=${id}`, {
            method: 'DELETE',
            headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        })
        const data = await res.json().catch(() => ({}))
        if (res.ok) fetchAllData()
        else alert(data.error || 'Suppression impossible')
    }

    // Édition rapide du montant d'un paiement
    const editPaiementMontant = async (id: string, current: number) => {
        const val = window.prompt('Nouveau montant (FCFA) :', String(Math.round(current)))
        if (val === null) return
        const montant = Number(val)
        if (!isFinite(montant) || montant <= 0) { alert('Montant invalide'); return }
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch('/api/admin/paiements-manuels', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
            body: JSON.stringify({ id, montant }),
        })
        const data = await res.json().catch(() => ({}))
        if (res.ok) fetchAllData()
        else alert(data.error || 'Modification impossible')
    }

    const handleAddPayment = async (e: React.FormEvent) => {
        e.preventDefault()
        setSavingPayment(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setSavingPayment(false); return }

        const isExterne = paymentMode === 'externe' && !paymentDoc
        const targetDocId = paymentDoc?.id || paymentDocId
        if (!isExterne && !targetDocId) { setSavingPayment(false); return }
        if (isExterne && !externePayment.libelle.trim()) { setSavingPayment(false); return }

        const composedNotes = isExterne
            ? `[EXTERNE] ${externePayment.libelle}${externePayment.client ? ' — ' + externePayment.client : ''}${newPayment.notes ? ' | ' + newPayment.notes : ''}`
            : (newPayment.notes || null)

        const { error } = await supabase.from('paiements_manuels').insert({
            agent_id: user.id,
            document_id: isExterne ? null : targetDocId,
            type: newPayment.type,
            montant: Number(newPayment.montant),
            date_paiement: newPayment.date,
            reference: newPayment.reference || null,
            notes: composedNotes,
        })

        if (!error) {
            setShowPaymentModal(false)
            setPaymentDoc(null)
            setPaymentDocId('')
            setPaymentMode('site')
            setExternePayment({ libelle: '', client: '' })
            setNewPayment({ type: 'virement', montant: '', reference: '', notes: '', date: new Date().toISOString().split('T')[0] })
            fetchAllData()
        } else {
            alert('Erreur: ' + error.message + (isExterne ? '\n\nAstuce: la colonne document_id de paiements_manuels doit être nullable pour accepter les paiements externes.' : ''))
        }
        setSavingPayment(false)
    }

    const handleExport = async () => {
        const pLabel = periodLabel(selectedPeriod)
        const docsById = new Map(allDocs.map(d => [d.id, d]))

        // ── LOGIQUE INTELLIGENTE : Recettes = argent réellement encaissé ──
        // On ne compte PAS les factures non payées (ex: M. Albin envoyé mais pas encaissé)
        // Seuls les paiements effectivement reçus sont des recettes
        const recettes: RegistreRecette[] = []
        const paiementsPeriod = paiementsList.filter(p => {
            if (!p.date_paiement) return false
            const date = new Date(p.date_paiement)
            if (isNaN(date.getTime())) return false
            return date >= pStart && date <= pEnd
        })

        // 1. Paiements liés à une facture → recette avec montant réellement encaissé
        const docsWithPayments = new Set<string>()
        paiementsPeriod.forEach(p => {
            const d = docsById.get(p.document_id)
            const isExterne = !d && /^\[EXTERNE\]/i.test(p.notes || '')
            const libelleExterne = isExterne ? (p.notes || '').replace(/^\[EXTERNE\]\s*/i, '').split('|')[0].trim() : ''

            if (d) {
                docsWithPayments.add(d.id)
                recettes.push({
                    date: new Date(p.date_paiement),
                    numero: d.numero,
                    client: `${d.client_nom} ${d.client_prenom}`.trim(),
                    categorie: 'Accompagnement diaspora',
                    refDossier: p.reference || '',
                    montantHT: Number(p.montant || 0),
                    statut: 'Encaissé',
                })
            } else {
                // Paiement externe (sans facture liée)
                recettes.push({
                    date: new Date(p.date_paiement),
                    numero: isExterne ? 'EXT' : '—',
                    client: isExterne ? libelleExterne : 'Paiement externe',
                    categorie: 'Autre recette',
                    refDossier: p.reference || '',
                    montantHT: Number(p.montant || 0),
                    statut: 'Encaissé',
                })
            }
        })

        // 2. Factures avec statut 'paye' mais sans paiement manuel enregistré
        //    (paiements passés via le site web / webhook automatique)
        displayedDocs
            .filter(d => d.type === 'facture' && d.status === 'paye' && !docsWithPayments.has(d.id))
            .forEach(d => {
                recettes.push({
                    date: new Date(d.created_at),
                    numero: d.numero,
                    client: `${d.client_nom} ${d.client_prenom}`.trim(),
                    categorie: 'Accompagnement diaspora',
                    refDossier: '',
                    montantHT: Number(d.total || 0),
                    statut: 'Encaissé',
                })
            })

        // NOTE: Les factures non payées (envoye, accepte, brouillon) sont EXCLUES
        // car elles ne représentent pas de l'argent réellement reçu

        // ── Mapper les dépenses → RegistreDepense ──
        // Libellés officiels des 12 catégories (salaires inclus) + héritage
        const expensesPeriod = expenses.filter(e => {
            if (!e.date_depense) return false
            const date = new Date(e.date_depense)
            if (isNaN(date.getTime())) return false
            return date >= pStart && date <= pEnd
        })
        const depensesRegistre: RegistreDepense[] = expensesPeriod.map(e => ({
            date: new Date(e.date_depense),
            numero: '',
            fournisseur: e.titre,
            categorie: expenseCategoryLabel(e.categorie),
            ref: '',
            montantHT: Number(e.montant),
            statut: 'Payé',
        }))

        await exportRegistreComptable({
            filename: `RGB_Registre_Agent_${periodSlug(selectedPeriod)}_${new Date().toISOString().split('T')[0]}`,
            moisLabel: pLabel,
            periodeISO: isMonth(selectedPeriod) ? selectedPeriod : currentMonthKey(),
            tauxTVA: 0.18,
            recettes,
            depenses: depensesRegistre,
        })
    }

    // Rien n'est rendu tant que l'accès (Ornel uniquement) n'est pas confirmé
    if (!accessChecked) return null

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-[#060a10]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Chargement trésorerie...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-8 pb-12">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-1.5 text-emerald-400">
                        <Landmark size={16} />
                        <span className="text-[10px] font-bold uppercase tracking-[0.3em]">Trésorerie Réelle</span>
                    </div>
                    <h1 className="text-3xl font-black text-white tracking-tight">Espace <span className="text-emerald-400">Financier</span></h1>
                    <p className="text-nexus-text-muted text-sm mt-1">Plateforme de gestion analytique.</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Sélecteur mois précis + navigation */}
                    <div className="flex items-center bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                        <button
                            type="button"
                            title="Mois précédent"
                            onClick={() => {
                                const base = isMonth(selectedPeriod) ? selectedPeriod : currentMonthKey()
                                setSelectedPeriod(shiftMonth(base, -1))
                                setCurrentPage(1)
                            }}
                            className="p-2.5 text-gray-400 hover:text-emerald-400 hover:bg-white/5 transition-all"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <select
                            value={selectedPeriod}
                            onChange={e => { setSelectedPeriod(e.target.value as Period); setCurrentPage(1) }}
                            title="Choisir une période"
                            className="bg-transparent px-3 py-2 text-xs font-bold text-white outline-none cursor-pointer min-w-[160px]"
                        >
                            {last12Months().map(m => (
                                <option key={m} value={m} className="bg-[#0c1420]">{monthLabel(m)}</option>
                            ))}
                            <option value="3_mois" className="bg-[#0c1420]">3 derniers mois</option>
                            <option value="tous" className="bg-[#0c1420]">Global (tout l&apos;historique)</option>
                        </select>
                        <button
                            type="button"
                            title="Mois suivant"
                            disabled={isMonth(selectedPeriod) && selectedPeriod >= currentMonthKey()}
                            onClick={() => {
                                const base = isMonth(selectedPeriod) ? selectedPeriod : currentMonthKey()
                                const next = shiftMonth(base, 1)
                                if (next <= currentMonthKey()) {
                                    setSelectedPeriod(next)
                                    setCurrentPage(1)
                                }
                            }}
                            className="p-2.5 text-gray-400 hover:text-emerald-400 hover:bg-white/5 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>

                    <button 
                        onClick={() => fetchAllData()}
                        className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-emerald-400 transition-all"
                        title="Actualiser les données"
                    >
                        <RefreshCw size={18} />
                    </button>
                    
                    <button 
                        title={showRelancesOnly ? "Afficher tout" : "Afficher relances"}
                        onClick={() => { setShowRelancesOnly(!showRelancesOnly); setCurrentPage(1); }}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all ${
                            showRelancesOnly 
                                ? 'bg-amber-500/20 border-amber-500/30 text-amber-400' 
                                : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                        }`}
                    >
                        <AlertTriangle size={18} />
                        <span className="text-xs font-bold font-primary">Relances</span>
                    </button>

                    <button title="Exporter en CSV" onClick={handleExport} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-all hover:bg-emerald-500/10">
                        <Download size={18} />
                        <span className="text-xs font-bold">Export</span>
                    </button>

                    <button
                        onClick={() => setShowExpenseModal(true)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-400 hover:bg-rose-500/30 transition-all font-bold"
                    >
                        <Plus size={18} />
                        <span className="text-xs">Dépense</span>
                    </button>

                    <button
                        onClick={() => {
                            setPaymentDoc(null)
                            setPaymentDocId('')
                            setNewPayment({ type: 'virement', montant: '', reference: '', notes: '', date: new Date().toISOString().split('T')[0] })
                            setShowPaymentModal(true)
                        }}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30 transition-all font-bold"
                        title="Enregistrer un paiement manuel"
                    >
                        <Banknote size={18} />
                        <span className="text-xs">Paiement</span>
                    </button>

                    <button
                        onClick={() => setShowSalaireModal(true)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-500/20 border border-sky-500/30 text-sky-400 hover:bg-sky-500/30 transition-all font-bold"
                        title="Enregistrer un salaire du personnel — impact comptable automatique sur les dépenses"
                    >
                        <Users size={18} />
                        <span className="text-xs">Salaire</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Encaissé Réel', value: stats.encaisse, icon: Wallet, color: 'emerald', trend: stats.trends.encaisse },
                    { label: 'Bénéfice Net', value: stats.beneficeNet, icon: TrendingUp, color: 'sky', trend: stats.trends.benefice },
                    { label: 'Mes Dépenses', value: stats.depenses, icon: TrendingDown, color: 'rose', trend: null },
                    { label: 'Mes Commissions', value: stats.commission, icon: Zap, color: 'purple', trend: stats.trends.commission, isCommission: true },
                ].map((s, i) => (
                    <motion.div
                        key={s.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="glass-nexus-card p-6 group hover:shadow-[0_0_30px_rgba(16,185,129,0.05)] transition-all"
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className={`w-10 h-10 rounded-xl bg-${s.color}-500/10 flex items-center justify-center`}>
                                <s.icon size={20} className={`text-${s.color}-400`} />
                            </div>
                            {s.trend && (
                                <div className={`flex items-center gap-1 text-[10px] font-bold ${s.trend.startsWith('+') ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {s.trend.startsWith('+') ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                                    {s.trend}%
                                </div>
                            )}
                        </div>
                        <p className="text-2xl font-black text-white mb-1 font-mono tracking-tighter">{formatCurrency(s.value)}</p>
                        <p className="text-[10px] text-nexus-text-muted font-bold uppercase tracking-widest">{s.label}</p>
                    </motion.div>
                ))}
            </div>

            {/* Performance Graphs (RECHARTS) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 glass-nexus-card p-6 min-h-[350px]">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                                <Activity size={16} className="text-emerald-400" /> Flux de Revenus
                            </h3>
                            <p className="text-[10px] text-gray-500 mt-1 font-bold">Ventes encaissées sur la période sélectionnée</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-gray-400 font-bold">Projection 30j</p>
                            <p className="text-lg font-black text-emerald-400 font-mono tracking-tighter">~ {formatCurrency(stats.projection30j)}</p>
                        </div>
                    </div>
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                <XAxis dataKey="name" stroke="#666" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis stroke="#666" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${v/1000}k`} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#0c1420', border: '1px solid #ffffff10', borderRadius: '12px' }}
                                    itemStyle={{ color: '#10b981', fontWeight: 'bold' }}
                                />
                                <Area type="monotone" dataKey="total" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="glass-nexus-card p-6 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-20 h-20 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 flex items-center justify-center relative">
                        <TrendingUp size={32} className="text-emerald-400" />
                        <div className="absolute inset-0 animate-pulse bg-emerald-500/10 rounded-full" />
                    </div>
                    <div>
                        <h4 className="text-white font-black text-xl">Score Prédictif</h4>
                        <p className="text-gray-500 text-xs mt-2 px-4 leading-relaxed">
                            Basé sur vos {periodDocs.length} derniers documents, votre croissance estimée est de <span className="text-emerald-400 font-bold">{stats.trends.encaisse || '0'}%</span>.
                        </p>
                    </div>
                    <div className="w-full pt-4 space-y-2">
                        <div className="flex justify-between text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                            <span>Santé Financière</span>
                            <span className="text-emerald-400">Stable</span>
                        </div>
                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: '85%' }} className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 glass-nexus-card overflow-hidden">
                    <div className="p-5 border-b border-white/5 space-y-4 bg-white/[0.01]">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm font-bold text-white uppercase tracking-wider">
                                <BarChart3 size={16} className="text-emerald-400" /> Journal des Transactions
                            </div>
                            <span className="text-[10px] text-gray-500 font-mono bg-white/5 px-2 py-0.5 rounded">
                                Affichage {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, jCount)}–{Math.min(currentPage * ITEMS_PER_PAGE, jCount)} / {jCount}
                            </span>
                        </div>
                        <div className="flex gap-1 bg-white/5 rounded-xl p-1 w-fit">
                            {[
                                { key: 'docs', label: 'Factures & Devis', count: displayedDocs.length, Icon: FileText },
                                { key: 'depenses', label: 'Mes Dépenses', count: displayedExpenses.length, Icon: Receipt },
                                { key: 'paiements', label: 'Paiements Reçus', count: displayedPaiements.length, Icon: Banknote }
                            ].map(({ key: k, label: l, count, Icon }) => {
                                const active = activeTab === k
                                return (
                                    <button
                                        key={k}
                                        type="button"
                                        onClick={() => { setActiveTab(k as any); setCurrentPage(1) }}
                                        className={`text-[10px] font-bold px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 ${
                                            active ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'
                                        }`}
                                    >
                                        <Icon size={11} /> {l} <span className="text-[9px] font-mono opacity-60">{count}</span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        {activeTab === 'docs' && (
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-white/[0.02] border-b border-white/5 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                                        <th className="py-4 px-6">Document</th>
                                        <th className="py-4 px-6">Client</th>
                                        <th className="py-4 px-6 text-right">Total</th>
                                        <th className="py-4 px-6 text-right">Payé</th>
                                        <th className="py-4 px-6 text-right">Solde</th>
                                        <th className="py-4 px-6 text-center">État</th>
                                        <th className="py-4 px-4 text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {paginatedDocs.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="py-16 text-center text-gray-500 italic text-sm">
                                                Aucun document trouvé pour cette sélection.
                                            </td>
                                        </tr>
                                    ) : paginatedDocs.map((tx) => {
                                        const montantPaye = paiements[tx.id] || 0
                                        const solde = Math.max(0, tx.total - montantPaye)
                                        const isSolde = solde === 0 && tx.type === 'facture'
                                        return (
                                        <tr key={tx.id} className={`hover:bg-white/[0.02] transition-colors group ${solde > 0 && tx.type === 'facture' ? 'border-l-2 border-amber-500/40' : ''}`}>
                                            <td className="py-4 px-6">
                                                <div className="flex items-center gap-3">
                                                    <FileText size={15} className="text-emerald-400" />
                                                    <div>
                                                        <p className="text-sm font-bold text-white">{tx.numero}</p>
                                                        <p className="text-[9px] text-gray-500">
                                                            {tx.created_at && !isNaN(new Date(tx.created_at).getTime()) ? new Date(tx.created_at).toLocaleDateString('fr-FR') : '—'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-4 px-6 text-sm text-gray-300">{tx.client_nom} {tx.client_prenom}</td>
                                            <td className="py-4 px-6 text-right font-mono text-sm font-bold text-white">{formatCurrency(tx.total)}</td>
                                            <td className="py-4 px-6 text-right font-mono text-sm text-emerald-400">
                                                {montantPaye > 0 ? formatCurrency(montantPaye) : <span className="text-gray-600">—</span>}
                                            </td>
                                            <td className="py-4 px-6 text-right font-mono text-sm">
                                                {tx.type === 'facture' ? (
                                                    <span className={solde > 0 ? 'text-amber-400 font-bold' : 'text-gray-600'}>
                                                        {solde > 0 ? formatCurrency(solde) : ' Soldé'}
                                                    </span>
                                                ) : <span className="text-gray-600">—</span>}
                                            </td>
                                            <td className="py-4 px-6 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <span className={`text-[9px] font-black px-2.5 py-1 rounded-lg uppercase border ${
                                                        isSolde || tx.status === 'paye' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                        tx.status === 'envoye' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                                        tx.status === 'accepte' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                                                        'bg-gray-500/10 text-gray-400 border-white/10'
                                                    }`}>
                                                        {isSolde ? 'payé' : tx.status}
                                                    </span>
                                                    {(tx.status === 'envoye' || tx.status === 'accepte') && (
                                                        <button
                                                            onClick={() => handleWhatsAppReminder(tx)}
                                                            className="p-1.5 text-amber-500 hover:bg-amber-500/10 rounded-lg transition-all"
                                                            title="Envoyer une relance WhatsApp"
                                                        >
                                                            <MessageCircle size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-4 px-4 text-center">
                                                {tx.type === 'facture' && solde > 0 && (
                                                    <button
                                                        type="button"
                                                        title="Enregistrer un paiement"
                                                        onClick={() => { setPaymentDoc(tx); setNewPayment(p => ({ ...p, montant: String(solde) })); setShowPaymentModal(true) }}
                                                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-all text-[10px] font-bold border border-emerald-500/20"
                                                    >
                                                        <Banknote size={12} />
                                                        Encaisser
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        )}

                        {activeTab === 'depenses' && (
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-white/[0.02] border-b border-white/5 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                                        <th className="py-4 px-6">Titre</th>
                                        <th className="py-4 px-6">Catégorie</th>
                                        <th className="py-4 px-6 text-right">Montant</th>
                                        <th className="py-4 px-6 text-right">Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {paginatedExpenses.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="py-16 text-center text-gray-500 italic text-sm">
                                                Aucune dépense trouvée pour cette période.
                                            </td>
                                        </tr>
                                    ) : paginatedExpenses.map((exp) => (
                                        <tr key={exp.id} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="py-4 px-6 text-sm font-bold text-white">{exp.titre}</td>
                                            <td className="py-4 px-6">
                                                <span className="text-[9px] font-bold bg-white/5 text-gray-400 px-2.5 py-1 rounded-lg uppercase border border-white/10 capitalize">
                                                    {exp.categorie}
                                                </span>
                                            </td>
                                            <td className="py-4 px-6 text-right font-mono text-sm text-rose-400 font-bold">
                                                -{formatCurrency(exp.montant)}
                                            </td>
                                            <td className="py-4 px-6 text-right font-mono text-xs text-gray-500">
                                                {new Date(exp.date_depense).toLocaleDateString('fr-FR')}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}

                        {activeTab === 'paiements' && (
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-white/[0.02] border-b border-white/5 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                                        <th className="py-4 px-6">Type</th>
                                        <th className="py-4 px-6">Facture / Libellé</th>
                                        <th className="py-4 px-6 text-right">Montant</th>
                                        <th className="py-4 px-6 text-right">Date</th>
                                        <th className="py-4 px-6">Référence</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {paginatedPaiements.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="py-16 text-center text-gray-500 italic text-sm">
                                                Aucun paiement trouvé pour cette période.
                                            </td>
                                        </tr>
                                    ) : paginatedPaiements.map((p) => {
                                        const linkedDoc = allDocs.find(d => d.id === p.document_id)
                                        const isExterne = !linkedDoc && /^\[EXTERNE\]/i.test(p.notes || '')
                                        const cleanNotes = isExterne ? p.notes?.replace(/^\[EXTERNE\]\s*/i, '') : p.notes
                                        return (
                                            <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                                                <td className="py-4 px-6">
                                                    <span className="text-[9px] font-black px-2.5 py-1 rounded-lg uppercase border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                                                        {p.type}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-6 text-sm text-gray-300">
                                                    {linkedDoc ? (
                                                        <div>
                                                            <p className="font-bold text-white">Facture {linkedDoc.numero}</p>
                                                            <p className="text-[9px] text-gray-500">{linkedDoc.client_nom} {linkedDoc.client_prenom}</p>
                                                        </div>
                                                    ) : (
                                                        <div>
                                                            <p className="font-bold text-amber-400">Paiement Externe</p>
                                                            <p className="text-xs text-gray-400">{cleanNotes || '—'}</p>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="py-4 px-6 text-right font-mono text-sm text-emerald-400 font-bold">
                                                    {formatCurrency(p.montant)}
                                                </td>
                                                <td className="py-4 px-6 text-right font-mono text-xs text-gray-500">
                                                    {new Date(p.date_paiement).toLocaleDateString('fr-FR')}
                                                </td>
                                                <td className="py-4 px-6 font-mono text-xs text-gray-400">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="truncate">{p.reference || '—'}</span>
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            <button type="button" title="Modifier le montant" onClick={() => editPaiementMontant(p.id, p.montant)}
                                                                className="p-1.5 rounded-lg text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 transition-all"><Pencil size={13} /></button>
                                                            <button type="button" title="Supprimer ce paiement" onClick={() => deletePaiement(p.id, linkedDoc ? `Facture ${linkedDoc.numero}` : (cleanNotes || 'Paiement externe'))}
                                                                className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all"><Trash2 size={13} /></button>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                    <div className="p-4 border-t border-white/5 flex justify-center gap-2">
                        {Array.from({ length: totalPages }).map((_, i) => (
                            <button
                                key={i}
                                onClick={() => setCurrentPage(i + 1)}
                                className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${currentPage === i + 1 ? 'bg-emerald-500/20 text-emerald-400' : 'text-gray-500 hover:text-white'}`}
                            >
                                {i + 1}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="glass-nexus-card p-6">
                        <h3 className="text-xs font-bold text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                             Répartition de l&apos;activité
                        </h3>
                        <div className="space-y-5">
                            {[
                                { label: 'Collecté', val: stats.encaisse, color: 'bg-emerald-500' },
                                { label: 'Signature en cours', val: stats.attente, color: 'bg-amber-500' },
                                { label: 'Autres', val: Math.max(0, stats.facture - stats.encaisse - stats.attente), color: 'bg-gray-500' },
                            ].map((item) => {
                                const pct = stats.facture > 0 ? (item.val / stats.facture) * 100 : 0
                                return (
                                    <div key={item.label}>
                                        <div className="flex justify-between text-[10px] font-bold uppercase mb-1.5">
                                            <span className="text-gray-500">{item.label}</span>
                                            <span className="text-white">{Math.round(pct)}%</span>
                                        </div>
                                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                            <div className={`h-full ${item.color}`} style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-emerald-600 to-teal-800 rounded-2xl p-6 shadow-xl text-white relative overflow-hidden">
                         <div className="absolute top-0 right-0 p-8 opacity-10 blur-xl bg-white w-20 h-20 rounded-full" />
                        <CheckCircle2 size={24} className="mb-4 relative z-10" />
                        <h4 className="text-lg font-black mb-2 relative z-10">Conseil de Trésorerie</h4>
                        <p className="text-white/80 text-xs leading-relaxed relative z-10">
                            {stats.attente > 0 
                                ? `Vous avez ${formatCurrency(stats.attente)} qui dorment. Relancez vos clients pour débloquer vos commissions !`
                                : "Excellent travail ! Votre trésorerie est parfaitement convertie."}
                        </p>
                        <button 
                            onClick={() => window.location.href='/agent/devis'}
                            className="mt-6 w-full py-2.5 bg-white text-emerald-800 font-bold rounded-xl text-xs hover:bg-emerald-100 transition-all flex items-center justify-center gap-2 relative z-10"
                        >
                            Ouvrir les Devis <ArrowRight size={14} />
                        </button>
                    </div>
                </div>
            </div>

            {/* ALARM BANNER — Factures non soldées */}
            {(() => {
                const nonSoldees = allDocs.filter(d => d.type === 'facture' && (paiements[d.id] || 0) < d.total && d.status !== 'annule')
                const totalRestant = nonSoldees.reduce((a, d) => a + Math.max(0, d.total - (paiements[d.id] || 0)), 0)
                if (nonSoldees.length === 0) return null
                return (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                        className="mb-6 flex items-center justify-between gap-4 p-4 rounded-2xl border"
                        style={{ background: 'rgba(245, 158, 11, 0.08)', borderColor: 'rgba(245, 158, 11, 0.25)' }}>
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                                <Bell size={16} className="text-amber-400" />
                            </div>
                            <div>
                                <p className="text-sm font-black text-amber-300">
                                    {nonSoldees.length} facture{nonSoldees.length > 1 ? 's' : ''} non soldée{nonSoldees.length > 1 ? 's' : ''}
                                </p>
                                <p className="text-xs text-amber-500/70">{formatCurrency(totalRestant)} restants à encaisser</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowRelancesOnly(true)}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold text-amber-400 border border-amber-500/30 hover:bg-amber-500/15 transition-all flex-shrink-0"
                        >
                            Voir tout
                        </button>
                    </motion.div>
                )
            })()}

            {/* EXPENSE MODAL */}
            <AnimatePresence>
                {showExpenseModal && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowExpenseModal(false)}>
                        <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }} onClick={e => e.stopPropagation()} className="glass-nexus-card w-full max-w-md overflow-hidden bg-[#0c1420]">
                            <div className="p-6 border-b border-white/5 flex items-center justify-between">
                                <h3 className="text-lg font-black text-white">Ajouter une Dépense</h3>
                                <button title="Fermer" onClick={() => setShowExpenseModal(false)} className="text-gray-500 hover:text-white"><X size={20} /></button>
                            </div>
                            <form onSubmit={handleAddExpense} className="p-6 space-y-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Libellé</label>
                                    <input required value={newExpense.titre} onChange={e => setNewExpense({...newExpense, titre: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-emerald-500/50 outline-none text-sm" placeholder="ex: Publicité Facebook" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Montant (XOF)</label>
                                        <input required type="number" value={newExpense.montant} onChange={e => setNewExpense({...newExpense, montant: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-emerald-500/50 outline-none text-sm font-mono" placeholder="0" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Catégorie</label>
                                        <select title="Catégorie de dépense" value={newExpense.categorie} onChange={e => setNewExpense({...newExpense, categorie: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-emerald-500/50 outline-none text-sm appearance-none">
                                            {EXPENSE_CATEGORIES.map(c => (
                                                <option key={c.value} value={c.value}>{c.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Date <span className="normal-case font-medium text-gray-600">(Optionnel — date du jour si vide)</span></label>
                                        <input type="date" value={newExpense.date} onChange={e => setNewExpense({...newExpense, date: e.target.value})} title="Date de la dépense (optionnel)" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-emerald-500/50 outline-none text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">IFU <span className="normal-case font-medium text-gray-600">(Optionnel)</span></label>
                                        <input value={newExpense.ifu} onChange={e => setNewExpense({...newExpense, ifu: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-emerald-500/50 outline-none text-sm font-mono" placeholder="N° IFU du fournisseur" />
                                    </div>
                                </div>
                                <button disabled={savingExpense} type="submit" className="w-full py-4 bg-emerald-500 text-white font-black rounded-xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-center gap-2 mt-4">
                                    {savingExpense ? <RefreshCw size={18} className="animate-spin" /> : <Plus size={18} />} Enregistrer la dépense
                                </button>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* SALAIRE MODAL — espace salaires du personnel */}
            <AnimatePresence>
                {showSalaireModal && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
                        onClick={() => setShowSalaireModal(false)}>
                        <motion.div initial={{ scale: 0.95, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 16 }}
                            onClick={e => e.stopPropagation()}
                            className="w-full max-w-md bg-[#0d1424] border border-white/10 rounded-2xl p-6 shadow-2xl">
                            <div className="flex items-center justify-between mb-1">
                                <h3 className="text-lg font-black text-white flex items-center gap-2">
                                    <Users size={18} className="text-sky-400" /> Enregistrer un salaire
                                </h3>
                                <button type="button" onClick={() => setShowSalaireModal(false)} title="Fermer" className="p-2 rounded-full hover:bg-white/5 text-gray-500"><X size={18} /></button>
                            </div>
                            <p className="text-[11px] text-gray-500 mb-5">Suivi du volet salarial — l&apos;impact comptable est calculé automatiquement dans les dépenses (catégorie « Salaires du personnel »), les exports et le FEC.</p>
                            <form onSubmit={handleAddSalaire} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Nom</label>
                                        <input required value={newSalaire.nom} onChange={e => setNewSalaire({ ...newSalaire, nom: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-sky-500/50 outline-none text-sm" placeholder="AHOSSI" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Prénom</label>
                                        <input required value={newSalaire.prenom} onChange={e => setNewSalaire({ ...newSalaire, prenom: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-sky-500/50 outline-none text-sm" placeholder="Jean" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Intitulé de poste</label>
                                    <input required value={newSalaire.poste} onChange={e => setNewSalaire({ ...newSalaire, poste: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-sky-500/50 outline-none text-sm" placeholder="Agent terrain, Comptable, Chauffeur…" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Salaire (XOF)</label>
                                        <input required type="number" min="1" value={newSalaire.montant} onChange={e => setNewSalaire({ ...newSalaire, montant: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-sky-500/50 outline-none text-sm font-mono" placeholder="0" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Mois concerné</label>
                                        <input required type="month" value={newSalaire.mois} onChange={e => setNewSalaire({ ...newSalaire, mois: e.target.value })} title="Mois du salaire" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-sky-500/50 outline-none text-sm" />
                                    </div>
                                </div>
                                <button disabled={savingSalaire} type="submit" className="w-full py-4 bg-sky-500 text-white font-black rounded-xl hover:bg-sky-600 transition-all shadow-lg shadow-sky-500/20 disabled:opacity-50 flex items-center justify-center gap-2 mt-2">
                                    {savingSalaire ? <RefreshCw size={18} className="animate-spin" /> : <Plus size={18} />} Enregistrer le salaire
                                </button>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* PAYMENT MODAL */}
            <AnimatePresence>
                {showPaymentModal && (() => {
                    const selectedDoc = paymentDoc || (paymentDocId ? allDocs.find(d => d.id === paymentDocId) || null : null)
                    const solde = selectedDoc ? Math.max(0, selectedDoc.total - (paiements[selectedDoc.id] || 0)) : 0
                    const selectableDocs = allDocs
                        .filter(d => d.type === 'facture')
                        .filter(d => (d.total - (paiements[d.id] || 0)) > 0 || d.status !== 'paye')
                    return (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowPaymentModal(false)}>
                        <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }} onClick={e => e.stopPropagation()} className="glass-nexus-card w-full max-w-md overflow-hidden bg-[#0c1420]">
                            <div className="p-6 border-b border-white/5 flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-black text-white">Enregistrer un Paiement</h3>
                                    <p className="text-xs text-gray-500 mt-0.5">{selectedDoc ? `${selectedDoc.numero} — ${selectedDoc.client_nom} ${selectedDoc.client_prenom}` : paymentMode === 'externe' ? 'Paiement externe (facture hors site)' : 'Choisir une facture à encaisser'}</p>
                                </div>
                                <button title="Fermer" onClick={() => setShowPaymentModal(false)} className="text-gray-500 hover:text-white"><X size={20} /></button>
                            </div>
                            {!paymentDoc && (
                                <div className="px-6 pt-4 pb-0 space-y-3">
                                    {/* Toggle site / externe */}
                                    <div className="flex items-center gap-1 p-1 bg-white/5 border border-white/10 rounded-xl">
                                        <button
                                            type="button"
                                            onClick={() => setPaymentMode('site')}
                                            className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${paymentMode === 'site' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-gray-500 hover:text-white'}`}
                                        >
                                            Facture du site
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setPaymentMode('externe')
                                                setPaymentDocId('')
                                            }}
                                            className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${paymentMode === 'externe' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-gray-500 hover:text-white'}`}
                                        >
                                            Facture Externe
                                        </button>
                                    </div>

                                    {paymentMode === 'site' ? (
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Facture concernée</label>
                                            <select
                                                title="Facture à encaisser"
                                                required
                                                value={paymentDocId}
                                                onChange={e => {
                                                    const id = e.target.value
                                                    setPaymentDocId(id)
                                                    const d = allDocs.find(x => x.id === id)
                                                    if (d) {
                                                        const s = Math.max(0, d.total - (paiements[d.id] || 0))
                                                        setNewPayment(p => ({ ...p, montant: s > 0 ? String(s) : String(d.total) }))
                                                    }
                                                }}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-emerald-500/50 outline-none text-sm"
                                            >
                                                <option value="" disabled>— Sélectionnez une facture —</option>
                                                {selectableDocs.length === 0 && <option value="" disabled>Aucune facture disponible</option>}
                                                {selectableDocs.map(d => (
                                                    <option key={d.id} value={d.id} className="bg-[#0c1420]">
                                                        {d.numero} — {d.client_nom} {d.client_prenom} — {formatCurrency(Math.max(0, d.total - (paiements[d.id] || 0)))} restant
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Libellé <span className="text-[#E8112D]">*</span></label>
                                                <input
                                                    required
                                                    type="text"
                                                    value={externePayment.libelle}
                                                    onChange={e => setExternePayment(p => ({ ...p, libelle: e.target.value }))}
                                                    className="w-full bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3 text-white focus:border-amber-500/50 outline-none text-sm"
                                                    placeholder="Ex: Prestation conseil, Vente accessoires..."
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Client / Bénéficiaire <span className="normal-case text-gray-600">(optionnel)</span></label>
                                                <input
                                                    type="text"
                                                    value={externePayment.client}
                                                    onChange={e => setExternePayment(p => ({ ...p, client: e.target.value }))}
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-amber-500/50 outline-none text-sm"
                                                    placeholder="Nom du client / société"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                            {selectedDoc && (
                                <div className="px-6 pt-4 pb-0">
                                    <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/10">
                                        <span className="text-xs text-gray-500">Solde restant</span>
                                        <span className="text-base font-black text-amber-400">{formatCurrency(solde)}</span>
                                    </div>
                                </div>
                            )}
                            <form onSubmit={handleAddPayment} className="p-6 space-y-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Mode de paiement</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            { val: 'virement', icon: CreditCard, label: 'Virement' },
                                            { val: 'especes', icon: Banknote, label: 'Espèces' },
                                            { val: 'cheque', icon: FileText, label: 'Chèque' },
                                            { val: 'mobile_money', icon: Zap, label: 'Mobile M.' },
                                            { val: 'carte', icon: CreditCard, label: 'Carte' },
                                            { val: 'autre', icon: Wallet, label: 'Autre' },
                                        ].map(opt => (
                                            <button key={opt.val} type="button" onClick={() => setNewPayment(p => ({ ...p, type: opt.val }))}
                                                className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-[10px] font-bold transition-all ${newPayment.type === opt.val ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'bg-white/5 border-white/10 text-gray-500 hover:border-white/20 hover:text-white'}`}>
                                                <opt.icon size={16} />
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Montant (XOF)</label>
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
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Notes <span className="normal-case text-gray-600">(optionnel)</span></label>
                                    <textarea rows={2} value={newPayment.notes} onChange={e => setNewPayment(p => ({ ...p, notes: e.target.value }))}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-emerald-500/50 outline-none text-sm resize-none" placeholder="Commentaire..." />
                                </div>
                                <button disabled={savingPayment || !newPayment.montant || (paymentMode === 'site' ? !selectedDoc : !externePayment.libelle.trim())} type="submit"
                                    className="w-full py-4 bg-emerald-500 text-white font-black rounded-xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-center gap-2 mt-4">
                                    {savingPayment ? <RefreshCw size={18} className="animate-spin" /> : <Banknote size={18} />} Confirmer l&apos;encaissement
                                </button>
                            </form>
                        </motion.div>
                    </motion.div>
                )
                })()}
            </AnimatePresence>
        </div>
    )
}
