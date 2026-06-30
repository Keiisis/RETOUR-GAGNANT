'use client'

import { useTranslation, T } from '@/lib/translation'
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    FileText, Save, Loader2, Plus, Trash2, ArrowUp, ArrowDown,
    Download, Printer, AlertCircle, CheckCircle2, Landmark, RefreshCw
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface TariffRowOption {
    label: string
    price_fcfa: string
    price_eur: string
}

interface TariffRow {
    no: string
    service: string
    details: string
    price_fcfa: string
    price_eur: string
    options?: TariffRowOption[]
}

interface TariffGrid {
    id: string
    title: string
    rows: TariffRow[]
}

interface Toast {
    id: number
    type: 'success' | 'error'
    msg: string
}

export default function AdminGrilleTarifaire() {
    const { t } = useTranslation()
    const [grids, setGrids] = useState<TariffGrid[]>([])
    const [activeGridId, setActiveGridId] = useState<string>('')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [toasts, setToasts] = useState<Toast[]>([])
    const [toastCounter, setToastCounter] = useState(0)

    const addToast = useCallback((type: Toast['type'], msg: string) => {
        const id = toastCounter + 1
        setToastCounter(id)
        setToasts(t => [...t, { id, type, msg }])
        setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000)
    }, [toastCounter])

    const fetchGrids = useCallback(async () => {
        setLoading(true)
        setError('')
        try {
            const res = await fetch('/api/admin/settings?t=' + Date.now(), { cache: 'no-store' })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Erreur lors du chargement des paramètres')

            const rawValue = data.settings?.find((s: any) => s.key === 'grilles_tarifaires')?.value
            if (rawValue) {
                try {
                    const parsed = JSON.parse(rawValue)
                    // Normalize older schema structure (price, unit, delay) to the new structure (price_fcfa, price_eur)
                    const normalized = parsed.map((grid: any) => ({
                        ...grid,
                        rows: grid.rows.map((row: any) => {
                            let price_fcfa = row.price_fcfa || ''
                            let price_eur = row.price_eur || ''
                            if (!price_fcfa && row.price) {
                                const parts = row.price.split('/')
                                price_fcfa = parts[0]?.trim() || ''
                                price_eur = parts[1]?.trim() || ''
                            }
                            return {
                                no: row.no || '',
                                service: row.service || '',
                                details: row.details || '',
                                price_fcfa,
                                price_eur,
                                options: row.options || undefined
                            }
                        })
                    }))
                    setGrids(normalized)
                    if (normalized.length > 0) {
                        setActiveGridId(normalized[0].id)
                    }
                } catch (e) {
                    throw new Error('Format de données corrompu pour la grille tarifaire')
                }
            } else {
                // Prepopulate with a default grid
                const defaultGrids: TariffGrid[] = [
                    {
                        id: 'documents-identite',
                        title: 'DOCUMENTS & IDENTITÉ',
                        rows: [
                            { no: '1', service: 'Acte de naissance béninois (sécurisé)', details: 'Copie intégrale certifiée conforme', price_fcfa: '15 000 FCFA', price_eur: '23 €' },
                            { no: '2', service: 'Passeport Biométrique Béninois', details: 'Demande complète, photos, suivi', price_fcfa: '75 000 FCFA', price_eur: '115 €' },
                            { no: '3', service: 'Carte Nationale d\'Identité (CNIB)', details: 'Inscription, prise d\'empreintes, retrait', price_fcfa: '30 000 FCFA', price_eur: '46 €' },
                            { no: '4', service: 'Certificat d\'Identification Personnelle (CIP)', details: 'Vérification d\'identité officielle', price_fcfa: '10 000 FCFA', price_eur: '15 €' },
                            { no: '5', service: 'Casier Judiciaire Béninois', details: 'Extrait de casier judiciaire B3', price_fcfa: '12 000 FCFA', price_eur: '18 €' }
                        ]
                    }
                ]
                setGrids(defaultGrids)
                setActiveGridId(defaultGrids[0].id)
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Erreur inconnue')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchGrids()
    }, [fetchGrids])

    const saveAllGrids = async (currentGrids = grids) => {
        setSaving(true)
        try {
            const res = await fetch('/api/admin/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    key: 'grilles_tarifaires',
                    value: JSON.stringify(currentGrids),
                    category: 'frontend'
                })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Erreur lors de la sauvegarde')

            addToast('success', t('Grilles tarifaires sauvegardées avec succès'))
            fetchGrids()
        } catch (e) {
            addToast('error', e instanceof Error ? e.message : 'Erreur inconnue')
        } finally {
            setSaving(false)
        }
    }

    const activeGrid = grids.find(g => g.id === activeGridId)

    // Add a new grid
    const handleAddGrid = () => {
        const title = prompt(t('Entrez le titre de la nouvelle grille :'))
        if (!title || !title.trim()) return

        const id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now().toString().slice(-4)
        const newGrid: TariffGrid = {
            id,
            title: title.trim().toUpperCase(),
            rows: [
                { no: '1', service: t('Exemple de service'), details: '', price_fcfa: '50 000 FCFA', price_eur: '76 €' }
            ]
        }

        const updated = [...grids, newGrid]
        setGrids(updated)
        setActiveGridId(id)
        saveAllGrids(updated)
    }

    // Rename active grid
    const handleRenameGrid = () => {
        if (!activeGrid) return
        const newTitle = prompt(t('Renommer la grille :'), activeGrid.title)
        if (!newTitle || !newTitle.trim()) return

        const updated = grids.map(g => g.id === activeGrid.id ? { ...g, title: newTitle.trim().toUpperCase() } : g)
        setGrids(updated)
        saveAllGrids(updated)
    }

    // Delete active grid
    const handleDeleteGrid = () => {
        if (!activeGrid) return
        if (grids.length <= 1) {
            alert(t('Vous devez conserver au moins une grille tarifaire.'))
            return
        }
        if (!confirm(t(`Êtes-vous sûr de vouloir supprimer la grille "${activeGrid.title}" ?`))) return

        const updated = grids.filter(g => g.id !== activeGrid.id)
        setGrids(updated)
        setActiveGridId(updated[0].id)
        saveAllGrids(updated)
    }

    // Row updates
    const handleRowChange = (rowIndex: number, field: keyof TariffRow, value: string) => {
        if (!activeGrid) return
        const updatedRows = activeGrid.rows.map((row, idx) => {
            if (idx === rowIndex) {
                return { ...row, [field]: value }
            }
            return row
        })

        const updatedGrids = grids.map(g => g.id === activeGrid.id ? { ...g, rows: updatedRows } : g)
        setGrids(updatedGrids)
    }

    const handleOptionChange = (rowIndex: number, optionIndex: number, field: keyof TariffRowOption, value: string) => {
        if (!activeGrid) return
        const updatedRows = activeGrid.rows.map((row, idx) => {
            if (idx === rowIndex) {
                const options = [...(row.options || [])]
                options[optionIndex] = { ...options[optionIndex], [field]: value }
                return { ...row, options }
            }
            return row
        })

        const updatedGrids = grids.map(g => g.id === activeGrid.id ? { ...g, rows: updatedRows } : g)
        setGrids(updatedGrids)
    }

    const handleAddOption = (rowIndex: number) => {
        if (!activeGrid) return
        const updatedRows = activeGrid.rows.map((row, idx) => {
            if (idx === rowIndex) {
                const options = [...(row.options || [])]
                if (options.length === 0) {
                    options.push({
                        label: row.details || '',
                        price_fcfa: row.price_fcfa || '',
                        price_eur: row.price_eur || ''
                    })
                }
                options.push({ label: '', price_fcfa: '', price_eur: '' })
                return { ...row, options }
            }
            return row
        })

        const updatedGrids = grids.map(g => g.id === activeGrid.id ? { ...g, rows: updatedRows } : g)
        setGrids(updatedGrids)
    }

    const handleDeleteOption = (rowIndex: number, optionIndex: number) => {
        if (!activeGrid) return
        const updatedRows = activeGrid.rows.map((row, idx) => {
            if (idx === rowIndex) {
                const options = (row.options || []).filter((_, oIdx) => oIdx !== optionIndex)
                if (options.length <= 1) {
                    const firstOpt = options[0]
                    return {
                        ...row,
                        details: firstOpt?.label || '',
                        price_fcfa: firstOpt?.price_fcfa || '',
                        price_eur: firstOpt?.price_eur || '',
                        options: undefined
                    }
                }
                return { ...row, options }
            }
            return row
        })

        const updatedGrids = grids.map(g => g.id === activeGrid.id ? { ...g, rows: updatedRows } : g)
        setGrids(updatedGrids)
    }

    const handleAddRow = () => {
        if (!activeGrid) return
        const nextNo = (activeGrid.rows.length + 1).toString()
        const newRow: TariffRow = { no: nextNo, service: '', details: '', price_fcfa: '', price_eur: '' }
        const updatedRows = [...activeGrid.rows, newRow]

        const updatedGrids = grids.map(g => g.id === activeGrid.id ? { ...g, rows: updatedRows } : g)
        setGrids(updatedGrids)
    }

    const handleDeleteRow = (rowIndex: number) => {
        if (!activeGrid) return
        // Keep at least one row
        const filteredRows = activeGrid.rows.filter((_, idx) => idx !== rowIndex)
        // Re-index No. column
        const updatedRows = filteredRows.map((row, idx) => ({ ...row, no: (idx + 1).toString() }))

        const updatedGrids = grids.map(g => g.id === activeGrid.id ? { ...g, rows: updatedRows } : g)
        setGrids(updatedGrids)
    }

    const handleMoveRow = (rowIndex: number, direction: 'up' | 'down') => {
        if (!activeGrid) return
        const rows = [...activeGrid.rows]
        if (direction === 'up' && rowIndex === 0) return
        if (direction === 'down' && rowIndex === rows.length - 1) return

        const targetIndex = direction === 'up' ? rowIndex - 1 : rowIndex + 1
        const temp = rows[rowIndex]
        rows[rowIndex] = rows[targetIndex]
        rows[targetIndex] = temp

        // Re-index No. column
        const updatedRows = rows.map((row, idx) => ({ ...row, no: (idx + 1).toString() }))

        const updatedGrids = grids.map(g => g.id === activeGrid.id ? { ...g, rows: updatedRows } : g)
        setGrids(updatedGrids)
    }

    // Opens printed tab
    const handlePrintGrid = (single = true) => {
        if (!activeGrid) return
        const url = single ? `/api/grille-tarifaire/print?gridId=${activeGrid.id}` : '/api/grille-tarifaire/print'
        window.open(url, '_blank')
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Toast Notifications */}
            <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
                <AnimatePresence>
                    {toasts.map(t => (
                        <motion.div
                            key={t.id}
                            initial={{ opacity: 0, y: 16, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className={cn(
                                'flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl text-sm font-bold pointer-events-auto border',
                                t.type === 'success' ? 'bg-[#0a1a0f] border-[#008751]/30 text-[#00c870]' : 'bg-[#1a0a0a] border-[#E8112D]/30 text-[#ff4d4d]'
                            )}
                        >
                            {t.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                            {t.msg}
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-[#008751]">
                        <Landmark size={18} />
                        <span className="text-[10px] font-black uppercase tracking-[0.4em]"><T>Gestion de Contenu</T></span>
                    </div>
                    <h1 className="text-3xl font-black text-white font-heading tracking-tighter">
                        GRILLES <span className="text-[#FCD116]"><T>TARIFAIRES</T></span>
                    </h1>
                    <p className="text-gray-500 text-xs">
                        Configurez les grilles de tarifs et téléchargez des versions PDF officielles très bien structurées.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2.5">
                    <button
                        onClick={fetchGrids}
                        disabled={loading}
                        className="p-3 bg-white/5 border border-white/10 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl transition-all"
                        title={t("Rafraîchir")}
                    >
                        <RefreshCw size={16} className={cn(loading && "animate-spin")} />
                    </button>
                    <button
                        onClick={() => handlePrintGrid(false)}
                        className="flex items-center gap-2 bg-[#FCD116]/10 border border-[#FCD116]/20 hover:bg-[#FCD116]/20 text-[#FCD116] font-bold text-xs px-4 py-3 rounded-xl transition-all"
                    >
                        <Download size={14} />
                        <T>Télécharger toutes les grilles</T>
                    </button>
                    <button
                        onClick={() => saveAllGrids()}
                        disabled={saving || loading}
                        className="flex items-center gap-2 bg-[#008751] hover:bg-[#006b40] text-white font-bold text-xs px-5 py-3 rounded-xl transition-all shadow-md shadow-[#008751]/10 disabled:opacity-40"
                    >
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        <T>Sauvegarder les modifications</T>
                    </button>
                </div>
            </div>

            {error && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="flex justify-center items-center py-20 bg-white/[0.02] border border-white/5 rounded-2xl">
                    <Loader2 className="animate-spin text-[#008751]" size={36} />
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Sidebar Tabs */}
                    <div className="lg:col-span-3 space-y-3">
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-2"><T>Vos grilles tarifaires</T></p>
                        <div className="space-y-1">
                            {grids.map(g => (
                                <button
                                    key={g.id}
                                    onClick={() => setActiveGridId(g.id)}
                                    className={cn(
                                        "w-full text-left flex items-center justify-between p-3.5 rounded-xl text-xs font-bold transition-all border",
                                        g.id === activeGridId
                                            ? "bg-[#008751]/15 text-[#008751] border-[#008751]/30"
                                            : "bg-white/[0.02] text-gray-400 hover:text-white hover:bg-white/[0.04] border-white/5"
                                    )}
                                >
                                    <span className="truncate pr-2">{g.title}</span>
                                    <span className="text-[9px] bg-white/5 text-gray-500 px-2 py-0.5 rounded-full shrink-0">
                                        {g.rows.length} {t('lignes')}
                                    </span>
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={handleAddGrid}
                            className="w-full flex items-center justify-center gap-2 p-3 border border-dashed border-white/10 hover:border-white/20 hover:bg-white/[0.01] rounded-xl text-xs font-bold text-gray-400 hover:text-white transition-all"
                        >
                            <Plus size={14} />
                            <T>Ajouter une grille</T>
                        </button>
                    </div>

                    {/* Active Grid Editor */}
                    <div className="lg:col-span-9">
                        {activeGrid ? (
                            <div className="bg-[#0a0f18] border border-white/5 rounded-2xl overflow-hidden">
                                {/* Tab Header Controls */}
                                <div className="p-5 bg-white/[0.01] border-b border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                    <div>
                                        <h3 className="font-bold text-white text-base flex items-center gap-2">
                                            <FileText size={18} className="text-[#008751]" />
                                            {activeGrid.title}
                                        </h3>
                                        <p className="text-[10px] text-gray-500 mt-1">ID : {activeGrid.id}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleRenameGrid}
                                            className="text-xs font-bold px-3.5 py-2 bg-white/5 border border-white/5 hover:border-white/15 hover:bg-white/10 text-gray-300 hover:text-white rounded-lg transition-all"
                                        >
                                            <T>Renommer</T>
                                        </button>
                                        <button
                                            onClick={() => handlePrintGrid(true)}
                                            className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 bg-[#008751]/10 border border-[#008751]/20 hover:bg-[#008751]/20 text-[#008751] rounded-lg transition-all"
                                        >
                                            <Printer size={13} />
                                            <T>Imprimer Grille</T>
                                        </button>
                                        <button
                                            onClick={handleDeleteGrid}
                                            className="text-xs font-bold px-3.5 py-2 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-400 rounded-lg transition-all"
                                        >
                                            <T>Supprimer la grille</T>
                                        </button>
                                    </div>
                                </div>

                                {/* Table Body */}
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[900px] border-collapse">
                                        <thead>
                                            <tr className="border-b border-white/5 text-[9px] font-black text-gray-500 uppercase tracking-widest bg-white/[0.005]">
                                                <th className="p-4 text-center w-14">N°</th>
                                                <th className="p-4 text-left">Service / Prestation</th>
                                                <th className="p-4 text-left">Détails inclus</th>
                                                <th className="p-4 text-left w-48">Tarif (FCFA)</th>
                                                <th className="p-4 text-left w-48">Tarif (EUR)</th>
                                                <th className="p-4 text-center w-28">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {activeGrid.rows.map((row, idx) => (
                                                <tr key={idx} className="hover:bg-white/[0.01] transition-colors group">
                                                    {/* Row No */}
                                                    <td className="p-3 text-center">
                                                        <input
                                                            type="text"
                                                            value={row.no}
                                                            onChange={e => handleRowChange(idx, 'no', e.target.value)}
                                                            className="w-10 bg-transparent border-0 text-center text-xs font-bold text-gray-400 focus:outline-none focus:ring-0 focus:text-white"
                                                            title={t("N°")}
                                                        />
                                                    </td>

                                                    {/* Service */}
                                                    <td className="p-3">
                                                        <input
                                                            type="text"
                                                            value={row.service}
                                                            onChange={e => handleRowChange(idx, 'service', e.target.value)}
                                                            placeholder={t("ex: Acte de naissance béninois sécurisé")}
                                                            className="w-full bg-white/5 border border-white/5 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#008751]/50 focus:bg-white/[0.08] transition-all"
                                                            title={t("Service")}
                                                        />
                                                        <button
                                                            onClick={() => handleAddOption(idx)}
                                                            className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-[#008751] hover:text-[#006b40] transition-colors"
                                                        >
                                                            <Plus size={10} />
                                                            {row.options && row.options.length > 0 ? t("Ajouter une option") : t("Créer des options multiples")}
                                                        </button>
                                                    </td>

                                                    {/* Détails inclus */}
                                                    <td className="p-3">
                                                        {row.options && row.options.length > 0 ? (
                                                            <div className="flex flex-col gap-2">
                                                                {row.options.map((opt, oIdx) => (
                                                                    <input
                                                                        key={oIdx}
                                                                        type="text"
                                                                        value={opt.label}
                                                                        onChange={e => handleOptionChange(idx, oIdx, 'label', e.target.value)}
                                                                        placeholder={t("ex: Entrée Unique 30 jours")}
                                                                        className="w-full bg-white/5 border border-white/5 rounded-lg px-3 py-2 text-xs text-gray-300 italic focus:outline-none focus:border-[#008751]/50 focus:bg-white/[0.08] transition-all"
                                                                        title={t("Détail de l'option")}
                                                                    />
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <input
                                                                type="text"
                                                                value={row.details || ''}
                                                                onChange={e => handleRowChange(idx, 'details', e.target.value)}
                                                                placeholder={t("ex: Copie intégrale certifiée")}
                                                                className="w-full bg-white/5 border border-white/5 rounded-lg px-3 py-2 text-xs text-gray-300 italic focus:outline-none focus:border-[#008751]/50 focus:bg-white/[0.08] transition-all"
                                                                title={t("Détails inclus")}
                                                            />
                                                        )}
                                                    </td>

                                                    {/* Price FCFA */}
                                                    <td className="p-3">
                                                        {row.options && row.options.length > 0 ? (
                                                            <div className="flex flex-col gap-2">
                                                                {row.options.map((opt, oIdx) => (
                                                                    <input
                                                                        key={oIdx}
                                                                        type="text"
                                                                        value={opt.price_fcfa}
                                                                        onChange={e => handleOptionChange(idx, oIdx, 'price_fcfa', e.target.value)}
                                                                        placeholder={t("ex: 15 000 FCFA")}
                                                                        className="w-full bg-white/5 border border-white/5 rounded-lg px-3 py-2 text-xs text-[#00c870] font-bold focus:outline-none focus:border-[#008751]/50 focus:bg-white/[0.08] transition-all"
                                                                        title={t("Tarif (FCFA)")}
                                                                    />
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <input
                                                                type="text"
                                                                value={row.price_fcfa}
                                                                onChange={e => handleRowChange(idx, 'price_fcfa', e.target.value)}
                                                                placeholder={t("ex: 15 000 FCFA")}
                                                                className="w-full bg-white/5 border border-white/5 rounded-lg px-3 py-2 text-xs text-[#00c870] font-bold focus:outline-none focus:border-[#008751]/50 focus:bg-white/[0.08] transition-all"
                                                                title={t("Tarif (FCFA)")}
                                                            />
                                                        )}
                                                    </td>

                                                    {/* Price EUR */}
                                                    <td className="p-3">
                                                        {row.options && row.options.length > 0 ? (
                                                            <div className="flex flex-col gap-2">
                                                                {row.options.map((opt, oIdx) => (
                                                                    <div key={oIdx} className="flex items-center gap-1.5">
                                                                        <input
                                                                            type="text"
                                                                            value={opt.price_eur}
                                                                            onChange={e => handleOptionChange(idx, oIdx, 'price_eur', e.target.value)}
                                                                            placeholder={t("ex: 23 €")}
                                                                            className="w-full bg-white/5 border border-white/5 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#008751]/50 focus:bg-white/[0.08] transition-all"
                                                                            title={t("Tarif (EUR)")}
                                                                        />
                                                                        <button
                                                                            onClick={() => handleDeleteOption(idx, oIdx)}
                                                                            className="p-1.5 hover:bg-red-500/10 text-gray-500 hover:text-red-400 rounded-md transition-all shrink-0"
                                                                            title={t("Supprimer l'option")}
                                                                        >
                                                                            <Trash2 size={12} />
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <input
                                                                type="text"
                                                                value={row.price_eur}
                                                                onChange={e => handleRowChange(idx, 'price_eur', e.target.value)}
                                                                placeholder={t("ex: 23 €")}
                                                                className="w-full bg-white/5 border border-white/5 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#008751]/50 focus:bg-white/[0.08] transition-all"
                                                                title={t("Tarif (EUR)")}
                                                            />
                                                        )}
                                                    </td>

                                                    {/* Row manipulation */}
                                                    <td className="p-3 text-center">
                                                        <div className="flex items-center justify-center gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => handleMoveRow(idx, 'up')}
                                                                disabled={idx === 0}
                                                                title={t("Monter")}
                                                                className="p-1.5 hover:bg-white/5 hover:text-white text-gray-500 rounded-md transition-all disabled:opacity-20"
                                                            >
                                                                <ArrowUp size={12} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleMoveRow(idx, 'down')}
                                                                disabled={idx === activeGrid.rows.length - 1}
                                                                title={t("Descendre")}
                                                                className="p-1.5 hover:bg-white/5 hover:text-white text-gray-500 rounded-md transition-all disabled:opacity-20"
                                                            >
                                                                <ArrowDown size={12} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteRow(idx)}
                                                                title={t("Supprimer")}
                                                                className="p-1.5 hover:bg-red-500/10 hover:text-red-400 text-gray-500 rounded-md transition-all"
                                                            >
                                                                <Trash2 size={12} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Table footer control */}
                                <div className="p-4 bg-white/[0.005] border-t border-white/5">
                                    <button
                                        onClick={handleAddRow}
                                        className="flex items-center justify-center gap-1.5 text-xs font-bold text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 px-4 py-2.5 rounded-xl border border-white/5 transition-all"
                                    >
                                        <Plus size={14} />
                                        <T>Ajouter une ligne de tarif</T>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="p-12 text-center bg-white/[0.02] border border-white/5 rounded-2xl text-gray-500">
                                <Landmark size={32} className="mx-auto mb-3 text-gray-700" />
                                <T>Veuillez sélectionner ou créer une grille tarifaire.</T>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
