'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Globe, RefreshCw, Loader2, Settings, Image, FileText, Palette, Star, Users, ChevronRight, ExternalLink } from 'lucide-react'
import Link from 'next/link'

const GOLD = '#D4AF37'; const YELLOW = '#FCD116'; const GREEN = '#008751'
const GREEN_L = '#00A86B'; const RED = '#E8112D'; const BG = '#0B1F0D'; const TEXT = '#F0EBD8'

interface SiteStat { label: string; value: string | number; color: string; icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }> }

export default function CeoSite() {
    const [stats, setStats] = useState<SiteStat[]>([])
    const [settings, setSettings] = useState<Array<{ key: string; value: string; category: string }>>([])
    const [loading, setLoading] = useState(true)
    const [refresh, setRefresh] = useState(0)

    useEffect(() => {
        const load = async () => {
            setLoading(true)
            try {
                const res = await fetch('/api/ceo/site', { cache: 'no-store' })
                if (res.ok) {
                    const d = await res.json()
                    setStats([
                        { label: 'Articles de blog', value: d.blog_posts   || 0, color: '#60a5fa', icon: FileText },
                        { label: 'Témoignages',      value: d.testimonials  || 0, color: YELLOW,   icon: Star    },
                        { label: 'Galerie',           value: d.gallery       || 0, color: '#a78bfa', icon: Image   },
                        { label: 'Services actifs',   value: d.services      || 0, color: GREEN_L,  icon: Settings },
                    ])
                    setSettings(d.settings || [])
                }
            } catch { /* silent */ }
            setLoading(false)
        }
        load()
    }, [refresh])

    const QUICK_LINKS = [
        { label: 'Paramètres CEO', href: '/ceo/parametres', icon: Settings },
        { label: 'Rapports', href: '/ceo/rapports', icon: FileText },
        { label: 'Facturation', href: '/ceo/facturation', icon: Palette },
        { label: 'Documents', href: '/ceo/documents', icon: FileText },
        { label: 'Partenaires & Activité', href: '/ceo/activite', icon: Users },
        { label: 'Témoignages (admin)', href: '/admin/testimonials', icon: Star },
        { label: 'Galerie (admin)', href: '/admin/gallery', icon: Image },
        { label: 'Voir le site', href: 'https://www.retourgagnantbenin.bj', icon: ExternalLink },
    ]

    return (
        <div className="min-h-screen p-6 lg:p-8" style={{ background: BG, color: TEXT }}>
            <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-8">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${GREEN}25` }}>
                            <Globe size={18} style={{ color: GREEN_L }} />
                        </div>
                        <h1 className="text-2xl font-black tracking-tight">Site Web</h1>
                    </div>
                    <p className="text-sm opacity-50">Vue d&apos;ensemble du contenu public</p>
                </div>
                <button onClick={() => setRefresh(r => r + 1)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-80 transition-all" style={{ background: `${GREEN}25`, color: GREEN_L }}>
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualiser
                </button>
            </motion.div>

            {loading ? (
                <div className="flex items-center justify-center py-16"><Loader2 size={28} className="animate-spin opacity-40" /></div>
            ) : (
                <>
                    {/* Content stats */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        {stats.map((s, i) => (
                            <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                                className="rounded-2xl p-5" style={{ background: '#0D2615', border: `1px solid ${s.color}20` }}>
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-xs opacity-40 uppercase tracking-wider">{s.label}</span>
                                    <s.icon size={16} style={{ color: s.color }} />
                                </div>
                                <div className="text-3xl font-black" style={{ color: s.color }}>{s.value}</div>
                            </motion.div>
                        ))}
                    </div>

                    {/* Quick links */}
                    <h2 className="text-sm font-black opacity-40 uppercase tracking-widest mb-4">Gestion rapide</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
                        {QUICK_LINKS.map((l, i) => (
                            <motion.div key={l.label} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.05 }}>
                                <Link href={l.href} target={l.href.startsWith('http') ? '_blank' : undefined}
                                    className="flex items-center justify-between p-4 rounded-xl transition-all hover:opacity-80 group"
                                    style={{ background: '#0D2615', border: `1px solid ${GOLD}15` }}>
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${GOLD}20` }}>
                                            <l.icon size={15} style={{ color: GOLD }} />
                                        </div>
                                        <span className="font-semibold text-sm">{l.label}</span>
                                    </div>
                                    <ChevronRight size={14} className="opacity-30 group-hover:opacity-70 transition-opacity" />
                                </Link>
                            </motion.div>
                        ))}
                    </div>

                    {/* Settings preview */}
                    {settings.length > 0 && (
                        <>
                            <h2 className="text-sm font-black opacity-40 uppercase tracking-widest mb-4">Paramètres du site</h2>
                            <div className="rounded-2xl overflow-hidden" style={{ background: '#0D2615', border: `1px solid ${GOLD}15` }}>
                                <table className="w-full text-sm">
                                    <thead><tr className="text-xs opacity-30 uppercase tracking-wider border-b" style={{ borderColor: `${GOLD}10` }}>
                                        <th className="text-left px-5 py-3">Clé</th>
                                        <th className="text-left px-5 py-3">Valeur</th>
                                        <th className="text-left px-5 py-3">Catégorie</th>
                                    </tr></thead>
                                    <tbody>
                                        {settings.map(s => (
                                            <tr key={s.key} className="border-b hover:bg-white/[0.02]" style={{ borderColor: `${GOLD}08` }}>
                                                <td className="px-5 py-2.5 font-mono text-xs opacity-70">{s.key}</td>
                                                <td className="px-5 py-2.5 text-xs opacity-80 max-w-[200px] truncate">{s.value}</td>
                                                <td className="px-5 py-2.5">
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: `${GOLD}15`, color: GOLD }}>{s.category}</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    )
}
