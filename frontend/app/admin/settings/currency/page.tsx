'use client'

import { useState, useEffect } from 'react'
import { forceRefreshRates } from '@/lib/currency'
import { ArrowLeft, RefreshCw, Save, DollarSign, Euro, Coins, Info, CheckCircle, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

interface Currency {
    code: string
    name: string
    symbol: string
    exchange_rate_to_base: number
    is_base: boolean
    updated_at: string
}

export default function CurrencySettingsPage() {
    const [currencies, setCurrencies] = useState<Currency[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    useEffect(() => {
        fetchCurrencies()
    }, [])

    const fetchCurrencies = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/settings/currency')
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            const data: Currency[] = await res.json()
            setCurrencies(data)
        } catch (err) {
            console.error('fetchCurrencies error:', err)
            setMessage({ type: 'error', text: 'Impossible de charger les devises depuis la base de données.' })
        }
        setLoading(false)
    }

    const handleRateChange = (code: string, newRate: string) => {
        setCurrencies(prev => prev.map(c =>
            c.code === code ? { ...c, exchange_rate_to_base: Number(newRate) } : c
        ))
    }

    const saveChanges = async () => {
        setSaving(true)
        setMessage(null)

        try {
            const updatable = currencies.filter(c => !c.is_base)
            const res = await fetch('/api/settings/currency', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatable),
            })

            const json = await res.json()

            if (!res.ok || json.error) {
                setMessage({ type: 'error', text: json.error || 'Erreur lors de la sauvegarde.' })
                return
            }

            // Mettre à jour l'affichage avec les données confirmées par le serveur
            if (json.currencies) {
                setCurrencies(json.currencies)
            }

            // Invalider le cache client pour que les nouvelles conversions utilisent les nouveaux taux
            await forceRefreshRates()

            setMessage({ type: 'success', text: 'Taux de change mis à jour avec succès. Le cache a été rechargé.' })
            setTimeout(() => setMessage(null), 5000)
        } catch (err) {
            console.error('saveChanges error:', err)
            setMessage({ type: 'error', text: 'Erreur réseau lors de la sauvegarde.' })
        } finally {
            setSaving(false)
        }
    }

    const getIcon = (code: string) => {
        if (code === 'EUR') return <Euro size={20} className="text-blue-400" />
        if (code === 'USD') return <DollarSign size={20} className="text-green-400" />
        if (code === 'GBP') return <DollarSign size={20} className="text-purple-400" />
        return <Coins size={20} className="text-yellow-400" /> // XOF
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-20">
            {/* Action Bar */}
            <div className="flex items-center justify-between bg-[var(--panel-surface)] p-4 rounded-2xl border border-[var(--panel-border)] sticky top-4 z-40 backdrop-blur-xl shadow-xl">
                <div className="flex items-center gap-4">
                    <Link href="/admin/settings" className="w-10 h-10 bg-[var(--panel-surface-alt)] border border-[var(--panel-border)] rounded-xl flex items-center justify-center text-[var(--panel-text-muted)] hover:text-[var(--panel-text-heading)] hover:bg-[var(--panel-surface-alt)] transition-all">
                        <ArrowLeft size={18} />
                    </Link>
                    <div>
                        <h1 className="text-xl font-black text-[var(--panel-text-heading)]">Devises & Taux de Change</h1>
                        <p className="text-emerald-400 text-xs font-medium tracking-wide">MOTEUR MONÉTAIRE ERP</p>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={fetchCurrencies}
                        disabled={loading}
                        title="Actualiser"
                        className="w-10 h-10 bg-[var(--panel-surface-alt)] rounded-xl flex items-center justify-center text-[var(--panel-text-muted)] hover:text-[var(--panel-text-heading)] transition-colors"
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button
                        type="button"
                        onClick={saveChanges}
                        disabled={saving || loading}
                        className="bg-emerald-500 hover:bg-emerald-400 text-black px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all disabled:opacity-50"
                    >
                        {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                        {saving ? 'Sauvegarde...' : 'Enregistrer les taux'}
                    </button>
                </div>
            </div>

            {/* Message de retour */}
            {message && (
                <div className={`p-4 rounded-xl text-sm font-bold flex items-center gap-3 ${
                    message.type === 'success'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-red-500/10 text-red-400 border border-red-500/20'
                }`}>
                    {message.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                    {message.text}
                </div>
            )}

            <div className="bg-[var(--panel-surface)] border border-[var(--panel-border)] rounded-2xl p-6 md:p-8 shadow-xl">
                <div className="mb-8 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-start gap-3">
                    <Info size={20} className="text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-200">
                        <p className="font-bold mb-1">Comment fonctionnent les devises ?</p>
                        <p className="opacity-80 leading-relaxed">
                            Le <strong>Franc CFA (XOF)</strong> est la devise de référence (base = 1.0).
                            Modifiez un taux ici pour l&apos;appliquer instantanément à tous les paiements.
                            La sauvegarde recharge le cache de conversion automatiquement.
                        </p>
                    </div>
                </div>

                {loading ? (
                    <div className="h-40 flex items-center justify-center">
                        <RefreshCw size={24} className="animate-spin text-emerald-500" />
                    </div>
                ) : currencies.length === 0 ? (
                    <div className="h-40 flex flex-col items-center justify-center gap-3 text-[var(--panel-text-muted)]">
                        <AlertTriangle size={28} />
                        <p className="text-sm">Aucune devise trouvée en base de données.</p>
                        <p className="text-xs opacity-70">Vérifiez que la table <code className="font-mono bg-[var(--panel-surface-alt)] px-1 rounded">currencies</code> existe dans Supabase.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {currencies.map((currency) => (
                            <div
                                key={currency.code}
                                className={`flex flex-col md:flex-row md:items-center justify-between p-5 rounded-xl border gap-4 ${
                                    currency.is_base
                                        ? 'bg-emerald-500/5 border-emerald-500/20'
                                        : 'bg-[var(--panel-surface-alt)] border-[var(--panel-border)]'
                                }`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-[var(--panel-surface-alt)] flex items-center justify-center border border-[var(--panel-border)]">
                                        {getIcon(currency.code)}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="text-lg font-bold text-[var(--panel-text-heading)]">{currency.code}</h3>
                                            <span className="text-xs bg-[var(--panel-surface-alt)] text-gray-300 px-2 py-0.5 rounded-full font-mono">{currency.symbol}</span>
                                            {currency.is_base && (
                                                <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full uppercase tracking-widest border border-emerald-500/20">Devise de Base</span>
                                            )}
                                        </div>
                                        <p className="text-[var(--panel-text-muted)] text-sm mt-0.5">{currency.name}</p>
                                        <p className="text-[10px] text-[var(--panel-text-muted)] mt-1">
                                            Dernière maj: {new Date(currency.updated_at).toLocaleString('fr-FR')}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="text-sm text-[var(--panel-text-muted)] font-mono whitespace-nowrap">1 {currency.code} =</div>
                                    <div className="relative w-36">
                                        <input
                                            type="number"
                                            step="0.001"
                                            min="0.001"
                                            title={`Taux de change pour ${currency.code}`}
                                            aria-label={`Taux de change pour ${currency.code}`}
                                            value={currency.exchange_rate_to_base}
                                            onChange={(e) => handleRateChange(currency.code, e.target.value)}
                                            disabled={currency.is_base}
                                            className={`w-full bg-black/40 border border-[var(--panel-border)] rounded-lg px-3 py-2 text-[var(--panel-text-heading)] font-mono text-right focus:outline-none focus:border-emerald-500 transition-colors pr-12 ${
                                                currency.is_base ? 'opacity-50 cursor-not-allowed' : 'hover:border-white/20'
                                            }`}
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--panel-text-muted)] text-xs font-bold">
                                            XOF
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
