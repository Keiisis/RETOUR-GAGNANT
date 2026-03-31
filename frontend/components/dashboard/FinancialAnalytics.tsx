'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

interface MonthlyMetric {
    month: string
    label: string
    ca: number
    impaye: number
    devis: number
    factures: number
}

interface OverdueInvoice {
    id: string
    numero: string
    client_nom: string
    total: number
    currency: string
    daysOverdue: number
    status: string
}

const formatPrice = (n: number) =>
    Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')

export const FinancialAnalytics = () => {
    const [loading, setLoading] = useState(true)
    const [currentMonth, setCurrentMonth] = useState<MonthlyMetric | null>(null)
    const [trend, setTrend] = useState<MonthlyMetric[]>([])
    const [overdueAlerts, setOverdueAlerts] = useState<OverdueInvoice[]>([])
    const [totalDocs, setTotalDocs] = useState(0)
    const [conversionRate, setConversionRate] = useState(0)
    const [downloadingReport, setDownloadingReport] = useState(false)
    const [selectedReportMonth, setSelectedReportMonth] = useState('')

    const fetchMetrics = useCallback(async () => {
        setLoading(true)
        try {
            const now = new Date()

            // ── Charger les 6 derniers mois ──
            const monthsData: MonthlyMetric[] = []

            for (let i = 5; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
                const startDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
                const endMonth = d.getMonth() + 2 > 12 ? 1 : d.getMonth() + 2
                const endYear = d.getMonth() + 2 > 12 ? d.getFullYear() + 1 : d.getFullYear()
                const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`

                const { data: docs } = await supabase
                    .from('documents_financiers')
                    .select('type, status, total')
                    .gte('created_at', startDate)
                    .lt('created_at', endDate)

                const monthDocs = docs || []
                const factures = monthDocs.filter(d => d.type === 'facture')
                const devisList = monthDocs.filter(d => d.type === 'devis')
                const ca = factures.filter(d => d.status === 'paye').reduce((s, d) => s + (d.total || 0), 0)
                const impaye = factures.filter(d => ['accepte', 'envoye'].includes(d.status)).reduce((s, d) => s + (d.total || 0), 0)

                monthsData.push({
                    month: startDate.slice(0, 7),
                    label: d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', ''),
                    ca,
                    impaye,
                    devis: devisList.length,
                    factures: factures.length,
                })
            }

            setTrend(monthsData)
            setCurrentMonth(monthsData[monthsData.length - 1])

            // Taux de conversion global du mois courant
            const thisMonth = monthsData[monthsData.length - 1]
            if (thisMonth.devis > 0) {
                // Devis acceptés ce mois
                const cmStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
                const cmEndM = now.getMonth() + 2 > 12 ? 1 : now.getMonth() + 2
                const cmEndY = now.getMonth() + 2 > 12 ? now.getFullYear() + 1 : now.getFullYear()
                const cmEnd = `${cmEndY}-${String(cmEndM).padStart(2, '0')}-01`

                const { data: devisData } = await supabase
                    .from('documents_financiers')
                    .select('status')
                    .eq('type', 'devis')
                    .gte('created_at', cmStart)
                    .lt('created_at', cmEnd)

                const totalDevis = (devisData || []).length
                const accepted = (devisData || []).filter(d => d.status === 'accepte').length
                setConversionRate(totalDevis > 0 ? Math.round((accepted / totalDevis) * 100) : 0)
            }

            // Total docs du mois
            setTotalDocs((thisMonth?.factures || 0) + (thisMonth?.devis || 0))

            // ── Alertes impayés critiques (>30 jours) ──
            const { data: overdueData } = await supabase
                .from('documents_financiers')
                .select('id, numero, client_nom, total, currency, created_at, status')
                .eq('type', 'facture')
                .in('status', ['accepte', 'envoye'])
                .order('created_at', { ascending: true })
                .limit(10)

            const alerts: OverdueInvoice[] = (overdueData || [])
                .map(d => ({
                    ...d,
                    daysOverdue: Math.floor((now.getTime() - new Date(d.created_at).getTime()) / (1000 * 60 * 60 * 24)),
                }))
                .filter(d => d.daysOverdue > 14)
                .sort((a, b) => b.daysOverdue - a.daysOverdue)

            setOverdueAlerts(alerts)
        } catch (err) {
            console.error('FinancialAnalytics fetch error:', err)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchMetrics()
    }, [fetchMetrics])

    // Initialiser le sélecteur de mois
    useEffect(() => {
        const now = new Date()
        setSelectedReportMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
    }, [])

    const handleDownloadReport = async () => {
        if (downloadingReport) return
        setDownloadingReport(true)
        try {
            const res = await fetch(`/api/reports/monthly?month=${selectedReportMonth}`)
            if (!res.ok) throw new Error('Erreur de téléchargement')
            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `rapport-financier-${selectedReportMonth}.pdf`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
        } catch (err) {
            console.error('Download error:', err)
            alert('Erreur lors du téléchargement du rapport.')
        } finally {
            setDownloadingReport(false)
        }
    }

    // Calculer le max pour le graphique
    const maxValue = Math.max(...trend.map(m => m.ca + m.impaye), 1)

    if (loading) {
        return (
            <div style={{
                background: 'linear-gradient(135deg, rgba(0,135,81,0.05) 0%, rgba(252,209,22,0.03) 100%)',
                borderRadius: '16px',
                padding: '32px',
                marginBottom: '24px',
                border: '1px solid rgba(0,135,81,0.1)',
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    color: '#6b7280',
                    justifyContent: 'center',
                    padding: '40px 0',
                }}>
                    <div style={{
                        width: '20px',
                        height: '20px',
                        border: '2px solid #008751',
                        borderTopColor: 'transparent',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                    }} />
                    Chargement des analytics...
                </div>
            </div>
        )
    }

    return (
        <div style={{
            background: 'linear-gradient(135deg, rgba(17,24,39,0.98) 0%, rgba(17,24,39,0.95) 100%)',
            borderRadius: '20px',
            padding: '28px',
            marginBottom: '24px',
            border: '1px solid rgba(255,255,255,0.06)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        }}>
            {/* ── En-tête ── */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '24px',
                flexWrap: 'wrap',
                gap: '12px',
            }}>
                <div>
                    <h2 style={{
                        margin: 0,
                        fontSize: '18px',
                        fontWeight: 800,
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                    }}>
                        📊 Tableau de Bord Financier
                    </h2>
                    <p style={{
                        margin: '4px 0 0',
                        fontSize: '12px',
                        color: 'rgba(255,255,255,0.4)',
                    }}>
                        Vue temps réel · {currentMonth?.label} {new Date().getFullYear()}
                    </p>
                </div>

                {/* Export PDF */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <select
                        value={selectedReportMonth}
                        onChange={e => setSelectedReportMonth(e.target.value)}
                        style={{
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px',
                            color: '#fff',
                            padding: '8px 12px',
                            fontSize: '12px',
                            cursor: 'pointer',
                        }}
                    >
                        {Array.from({ length: 12 }, (_, i) => {
                            const d = new Date()
                            d.setMonth(d.getMonth() - i)
                            const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
                            const label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
                            return <option key={val} value={val} style={{ background: '#1f2937' }}>{label}</option>
                        })}
                    </select>
                    <button
                        onClick={handleDownloadReport}
                        disabled={downloadingReport}
                        style={{
                            background: downloadingReport
                                ? 'rgba(255,255,255,0.1)'
                                : 'linear-gradient(135deg, #008751, #00a664)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '10px',
                            padding: '8px 16px',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: downloadingReport ? 'wait' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.2s',
                            boxShadow: downloadingReport ? 'none' : '0 4px 12px rgba(0,135,81,0.3)',
                        }}
                    >
                        {downloadingReport ? (
                            <>
                                <span style={{
                                    width: '14px',
                                    height: '14px',
                                    border: '2px solid rgba(255,255,255,0.3)',
                                    borderTopColor: '#fff',
                                    borderRadius: '50%',
                                    display: 'inline-block',
                                    animation: 'spin 1s linear infinite',
                                }} />
                                Génération...
                            </>
                        ) : (
                            <>📄 Rapport PDF</>
                        )}
                    </button>
                </div>
            </div>

            {/* ── KPI Cards ── */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: '12px',
                marginBottom: '24px',
            }}>
                {/* CA Encaissé */}
                <div style={{
                    background: 'rgba(0,135,81,0.08)',
                    border: '1px solid rgba(0,135,81,0.15)',
                    borderRadius: '14px',
                    padding: '16px',
                    position: 'relative',
                    overflow: 'hidden',
                }}>
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '2px',
                        background: 'linear-gradient(90deg, #008751, #00c073)',
                    }} />
                    <p style={{ margin: 0, fontSize: '10px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>
                        CA Encaissé
                    </p>
                    <p style={{ margin: '8px 0 0', fontSize: '22px', fontWeight: 900, color: '#4ade80' }}>
                        {formatPrice(currentMonth?.ca || 0)}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>FCFA</p>
                </div>

                {/* Impayés */}
                <div style={{
                    background: 'rgba(239,68,68,0.06)',
                    border: '1px solid rgba(239,68,68,0.12)',
                    borderRadius: '14px',
                    padding: '16px',
                    position: 'relative',
                    overflow: 'hidden',
                }}>
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '2px',
                        background: 'linear-gradient(90deg, #ef4444, #f87171)',
                    }} />
                    <p style={{ margin: 0, fontSize: '10px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>
                        Impayés
                    </p>
                    <p style={{ margin: '8px 0 0', fontSize: '22px', fontWeight: 900, color: '#f87171' }}>
                        {formatPrice(currentMonth?.impaye || 0)}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>FCFA</p>
                </div>

                {/* Documents */}
                <div style={{
                    background: 'rgba(59,130,246,0.06)',
                    border: '1px solid rgba(59,130,246,0.12)',
                    borderRadius: '14px',
                    padding: '16px',
                    position: 'relative',
                    overflow: 'hidden',
                }}>
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '2px',
                        background: 'linear-gradient(90deg, #3b82f6, #60a5fa)',
                    }} />
                    <p style={{ margin: 0, fontSize: '10px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>
                        Documents
                    </p>
                    <p style={{ margin: '8px 0 0', fontSize: '22px', fontWeight: 900, color: '#60a5fa' }}>
                        {totalDocs}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>{currentMonth?.factures || 0} fac · {currentMonth?.devis || 0} dev</p>
                </div>

                {/* Conversion */}
                <div style={{
                    background: 'rgba(252,209,22,0.06)',
                    border: '1px solid rgba(252,209,22,0.12)',
                    borderRadius: '14px',
                    padding: '16px',
                    position: 'relative',
                    overflow: 'hidden',
                }}>
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '2px',
                        background: 'linear-gradient(90deg, #FCD116, #fde047)',
                    }} />
                    <p style={{ margin: 0, fontSize: '10px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>
                        Conv. Devis
                    </p>
                    <p style={{ margin: '8px 0 0', fontSize: '22px', fontWeight: 900, color: '#fde047' }}>
                        {conversionRate}%
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>devis → facture</p>
                </div>
            </div>

            {/* ── Mini Graphique Tendance ── */}
            <div style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: '14px',
                padding: '16px 20px',
                marginBottom: overdueAlerts.length > 0 ? '16px' : '0',
            }}>
                <p style={{
                    margin: '0 0 12px',
                    fontSize: '11px',
                    color: 'rgba(255,255,255,0.4)',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                }}>
                    📈 Tendance CA · 6 derniers mois
                </p>

                <div style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: '8px',
                    height: '80px',
                }}>
                    {trend.map((m, i) => {
                        const caH = maxValue > 0 ? (m.ca / maxValue) * 70 : 0
                        const impH = maxValue > 0 ? (m.impaye / maxValue) * 70 : 0
                        const isCurrentMonth = i === trend.length - 1

                        return (
                            <div
                                key={m.month}
                                style={{
                                    flex: 1,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '4px',
                                }}
                                title={`${m.label}: CA ${formatPrice(m.ca)} · Impayés ${formatPrice(m.impaye)}`}
                            >
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '1px',
                                    width: '100%',
                                    alignItems: 'center',
                                }}>
                                    {/* Impayés (rouge, empilé au dessus) */}
                                    {impH > 0 && (
                                        <div style={{
                                            width: '60%',
                                            height: `${Math.max(impH, 2)}px`,
                                            background: 'linear-gradient(180deg, #ef4444, #dc2626)',
                                            borderRadius: '3px 3px 0 0',
                                            transition: 'height 0.6s ease',
                                        }} />
                                    )}
                                    {/* CA (vert) */}
                                    <div style={{
                                        width: '60%',
                                        height: `${Math.max(caH, 2)}px`,
                                        background: isCurrentMonth
                                            ? 'linear-gradient(180deg, #4ade80, #008751)'
                                            : 'linear-gradient(180deg, rgba(0,135,81,0.6), rgba(0,135,81,0.3))',
                                        borderRadius: impH > 0 ? '0 0 3px 3px' : '3px',
                                        transition: 'height 0.6s ease',
                                        boxShadow: isCurrentMonth ? '0 0 8px rgba(0,135,81,0.4)' : 'none',
                                    }} />
                                </div>
                                <span style={{
                                    fontSize: '9px',
                                    color: isCurrentMonth ? '#4ade80' : 'rgba(255,255,255,0.3)',
                                    fontWeight: isCurrentMonth ? 700 : 400,
                                    textTransform: 'capitalize',
                                }}>
                                    {m.label}
                                </span>
                            </div>
                        )
                    })}
                </div>

                {/* Légende */}
                <div style={{
                    display: 'flex',
                    gap: '16px',
                    marginTop: '8px',
                    justifyContent: 'center',
                }}>
                    <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#008751', display: 'inline-block' }} />
                        CA encaissé
                    </span>
                    <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#ef4444', display: 'inline-block' }} />
                        Impayés
                    </span>
                </div>
            </div>

            {/* ── Alertes Impayés Critiques ── */}
            {overdueAlerts.length > 0 && (
                <div style={{
                    background: 'rgba(239,68,68,0.04)',
                    border: '1px solid rgba(239,68,68,0.1)',
                    borderRadius: '14px',
                    padding: '16px 20px',
                }}>
                    <p style={{
                        margin: '0 0 10px',
                        fontSize: '11px',
                        color: '#f87171',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '1px',
                    }}>
                        🔴 Alertes — Factures en retard
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {overdueAlerts.slice(0, 5).map(inv => (
                            <div
                                key={inv.id}
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '8px 12px',
                                    background: 'rgba(255,255,255,0.02)',
                                    borderRadius: '8px',
                                    border: '1px solid rgba(255,255,255,0.04)',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <span style={{
                                        fontSize: '10px',
                                        fontWeight: 700,
                                        fontFamily: 'monospace',
                                        color: 'rgba(255,255,255,0.5)',
                                    }}>
                                        {inv.numero}
                                    </span>
                                    <span style={{ fontSize: '12px', color: '#fff', fontWeight: 500 }}>
                                        {inv.client_nom}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <span style={{
                                        fontSize: '12px',
                                        fontWeight: 800,
                                        color: inv.daysOverdue > 30 ? '#ef4444' : '#f59e0b',
                                    }}>
                                        {formatPrice(inv.total)} {inv.currency || 'XOF'}
                                    </span>
                                    <span style={{
                                        fontSize: '10px',
                                        padding: '2px 8px',
                                        borderRadius: '6px',
                                        fontWeight: 700,
                                        background: inv.daysOverdue > 30
                                            ? 'rgba(239,68,68,0.15)'
                                            : 'rgba(245,158,11,0.15)',
                                        color: inv.daysOverdue > 30 ? '#f87171' : '#fbbf24',
                                    }}>
                                        J+{inv.daysOverdue}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {overdueAlerts.length > 5 && (
                        <p style={{
                            margin: '8px 0 0',
                            fontSize: '10px',
                            color: 'rgba(255,255,255,0.3)',
                            textAlign: 'center',
                        }}>
                            +{overdueAlerts.length - 5} autre(s) facture(s) en retard
                        </p>
                    )}
                </div>
            )}

            {/* CSS Animation */}
            <style>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    )
}
