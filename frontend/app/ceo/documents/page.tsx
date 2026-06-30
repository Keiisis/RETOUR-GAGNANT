'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { FolderOpen, Search, RefreshCw, Loader2, Eye, Download, FileText, File, Image, Film, Archive, X } from 'lucide-react'

const GOLD = '#D4AF37'; const YELLOW = '#FCD116'; const GREEN = '#008751'
const GREEN_L = '#00A86B'; const RED = '#E8112D'; const BG = '#0B1F0D'; const TEXT = '#F0EBD8'

function fmtDate(d: string) {
    if (!d) return '—'
    const dateObj = new Date(d)
    return isNaN(dateObj.getTime()) ? '—' : dateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtSize(bytes: number) {
    if (!bytes) return '—'
    if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} Mo`
    if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(0)} Ko`
    return `${bytes} o`
}

interface Doc {
    id: string; created_at: string; file_name?: string; file_url?: string
    file_type?: string; file_size?: number; client_email?: string; client_name?: string
    category?: string; description?: string; uploaded_by?: string
}

function getFileIcon(type?: string) {
    if (!type) return File
    if (type.includes('pdf')) return FileText
    if (type.includes('image') || ['jpg','jpeg','png','webp','gif'].includes(type)) return Image
    if (type.includes('video') || ['mp4','mov','avi'].includes(type)) return Film
    if (type.includes('zip') || type.includes('rar') || type.includes('archive')) return Archive
    return File
}

function getFileColor(type?: string) {
    if (!type) return '#94a3b8'
    if (type.includes('pdf')) return RED
    if (type.includes('image') || ['jpg','jpeg','png','webp'].includes(type)) return '#a78bfa'
    if (type.includes('video')) return '#f97316'
    if (type.includes('zip') || type.includes('rar')) return YELLOW
    return GOLD
}

export default function CeoDocuments() {
    const [docs, setDocs] = useState<Doc[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [selected, setSelected] = useState<Doc | null>(null)
    const [refresh, setRefresh] = useState(0)

    const load = useCallback(async () => {
        if (!loading) setLoading(true)
        try {
            const res = await fetch('/api/ceo/documents', { cache: 'no-store' })
            if (res.ok) {
                const d = await res.json()
                setDocs(d.docs || [])
            }
        } catch { /* silent */ }
        setLoading(false)
    }, [loading])

    useEffect(() => { load() }, [load, refresh])

    const filtered = docs.filter(d => {
        if (!search) return true
        const q = search.toLowerCase()
        return (d.file_name || '').toLowerCase().includes(q) ||
            (d.client_email || '').toLowerCase().includes(q) ||
            (d.client_name || '').toLowerCase().includes(q) ||
            (d.category || '').toLowerCase().includes(q)
    })

    const totalSize = docs.reduce((a, d) => a + (d.file_size || 0), 0)

    const byType = docs.reduce((acc, d) => {
        const t = d.file_type || 'autre'
        acc[t] = (acc[t] || 0) + 1
        return acc
    }, {} as Record<string, number>)

    return (
        <div className="min-h-screen p-6 lg:p-8" style={{ background: BG, color: TEXT }}>
            <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-8">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${GOLD}25` }}>
                            <FolderOpen size={18} style={{ color: GOLD }} />
                        </div>
                        <h1 className="text-2xl font-black tracking-tight">Documents</h1>
                    </div>
                    <p className="text-sm opacity-50">Bibliothèque de documents clients</p>
                </div>
                <button onClick={() => setRefresh(r => r + 1)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-80 transition-all" style={{ background: `${GREEN}25`, color: GREEN_L }}>
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualiser
                </button>
            </motion.div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {[
                    { label: 'Total documents', value: String(docs.length), color: GOLD, icon: FolderOpen },
                    { label: 'Taille totale', value: fmtSize(totalSize), color: GREEN_L, icon: Archive },
                    { label: 'PDFs', value: String(byType['pdf'] || byType['application/pdf'] || 0), color: RED, icon: FileText },
                    { label: 'Images', value: String((byType['image'] || 0) + (byType['jpg'] || 0) + (byType['png'] || 0) + (byType['jpeg'] || 0)), color: '#a78bfa', icon: Image },
                ].map((s, i) => (
                    <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                        className="rounded-2xl p-4" style={{ background: '#0D2615', border: `1px solid ${s.color}20` }}>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs opacity-40 uppercase tracking-wider">{s.label}</span>
                            <s.icon size={14} style={{ color: s.color }} />
                        </div>
                        <div className="text-xl font-black" style={{ color: s.color }}>{s.value}</div>
                    </motion.div>
                ))}
            </div>

            {/* Search */}
            <div className="relative mb-5">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nom de fichier, client, catégorie..."
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none" style={{ background: '#0D2615', border: `1px solid ${GOLD}20`, color: TEXT }} />
            </div>

            {/* Table */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
                className="rounded-2xl overflow-hidden" style={{ background: '#0D2615', border: `1px solid ${GOLD}15` }}>
                <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: `${GOLD}15` }}>
                    <h2 className="font-bold text-sm" style={{ color: GOLD }}>Bibliothèque documents</h2>
                    <span className="text-xs opacity-40">{filtered.length} fichier{filtered.length > 1 ? 's' : ''}</span>
                </div>
                {loading ? (
                    <div className="flex items-center justify-center py-16"><Loader2 size={28} className="animate-spin opacity-40" /></div>
                ) : filtered.length === 0 ? (
                    <div className="py-16 text-center opacity-30 text-sm">Aucun document trouvé</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead><tr className="text-xs opacity-40 uppercase tracking-wider border-b" style={{ borderColor: `${GOLD}10` }}>
                                <th className="text-left px-5 py-3">Fichier</th>
                                <th className="text-left px-5 py-3">Client</th>
                                <th className="text-left px-5 py-3">Catégorie</th>
                                <th className="text-left px-5 py-3">Taille</th>
                                <th className="text-left px-5 py-3">Date</th>
                                <th className="px-5 py-3"></th>
                            </tr></thead>
                            <tbody>
                                {filtered.map(d => {
                                    const Icon = getFileIcon(d.file_type)
                                    const color = getFileColor(d.file_type)
                                    return (
                                        <tr key={d.id} className="border-b hover:bg-white/[0.02] transition-colors" style={{ borderColor: `${GOLD}08` }}>
                                            <td className="px-5 py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${color}20` }}>
                                                        <Icon size={13} style={{ color }} />
                                                    </div>
                                                    <span className="text-xs font-medium truncate max-w-[180px]">{d.file_name || '—'}</span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3 text-xs opacity-70">{d.client_name || d.client_email || '—'}</td>
                                            <td className="px-5 py-3">
                                                {d.category && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: `${GOLD}15`, color: GOLD }}>{d.category}</span>}
                                            </td>
                                            <td className="px-5 py-3 text-xs opacity-50">{fmtSize(d.file_size || 0)}</td>
                                            <td className="px-5 py-3 text-xs opacity-50">{fmtDate(d.created_at)}</td>
                                            <td className="px-5 py-3">
                                                <div className="flex items-center gap-1.5">
                                                    <button onClick={() => setSelected(d)} title="Détails" aria-label="Détails du document" className="p-1.5 rounded-lg hover:opacity-80 transition-opacity" style={{ background: `${GOLD}15` }}>
                                                        <Eye size={12} style={{ color: GOLD }} />
                                                    </button>
                                                    {d.file_url && (
                                                        <a href={d.file_url} target="_blank" rel="noopener noreferrer" title="Télécharger" aria-label="Télécharger le document"
                                                            className="p-1.5 rounded-lg hover:opacity-80 transition-opacity" style={{ background: `${GREEN_L}15` }}>
                                                            <Download size={12} style={{ color: GREEN_L }} />
                                                        </a>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </motion.div>

            {selected && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }} onClick={() => setSelected(null)}>
                    <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} onClick={e => e.stopPropagation()}
                        className="w-full max-w-md rounded-3xl p-6" style={{ background: '#0D2615', border: `1px solid ${GOLD}30` }}>
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="font-black" style={{ color: GOLD }}>Détail document</h3>
                            <button onClick={() => setSelected(null)} title="Fermer" aria-label="Fermer" className="opacity-40 hover:opacity-70 p-1"><X size={18} /></button>
                        </div>
                        {[
                            ['Nom', selected.file_name || '—'],
                            ['Type', selected.file_type || '—'],
                            ['Taille', fmtSize(selected.file_size || 0)],
                            ['Client', selected.client_name || selected.client_email || '—'],
                            ['Catégorie', selected.category || '—'],
                            ['Description', selected.description || '—'],
                            ['Uploadé par', selected.uploaded_by || '—'],
                            ['Date', fmtDate(selected.created_at)],
                        ].map(([k, v]) => (
                            <div key={k} className="flex justify-between py-2 border-b text-sm" style={{ borderColor: `${GOLD}10` }}>
                                <span className="opacity-50">{k}</span>
                                <span className="font-semibold text-right max-w-[60%] truncate">{v}</span>
                            </div>
                        ))}
                        {selected.file_url && (
                            <a href={selected.file_url} target="_blank" rel="noopener noreferrer"
                                className="mt-4 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl font-bold text-sm hover:opacity-80 transition-opacity"
                                style={{ background: `${GREEN_L}20`, color: GREEN_L }}>
                                <Download size={14} /> Télécharger le fichier
                            </a>
                        )}
                    </motion.div>
                </div>
            )}
        </div>
    )
}
