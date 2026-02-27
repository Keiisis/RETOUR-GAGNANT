'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
    Tag, Plus, Trash2, Loader2, Search,
    CheckCircle2, AlertCircle, Save, Copy,
    ArrowLeft, Calendar, Percent, Hash
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

interface Coupon {
    id: string
    code: string
    discount_type: 'percentage' | 'fixed'
    discount_value: number
    min_order_amount: number
    max_uses: number
    current_uses: number
    is_active: boolean
    expires_at: string | null
    created_at: string
}

export default function CouponsPage() {
    const [coupons, setCoupons] = useState<Coupon[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [showForm, setShowForm] = useState(false)
    const [saving, setSaving] = useState(false)

    // New coupon form
    const [newCode, setNewCode] = useState('')
    const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage')
    const [discountValue, setDiscountValue] = useState(10)
    const [minOrder, setMinOrder] = useState(0)
    const [maxUses, setMaxUses] = useState(100)
    const [expiresAt, setExpiresAt] = useState('')

    const loadCoupons = useCallback(async () => {
        const { data } = await supabase
            .from('coupons')
            .select('*')
            .order('created_at', { ascending: false })
        setCoupons(data || [])
        setLoading(false)
    }, [])

    useEffect(() => { loadCoupons() }, [loadCoupons])

    const generateCode = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
        let code = 'RG-'
        for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
        setNewCode(code)
    }

    const createCoupon = async () => {
        if (!newCode.trim()) return
        setSaving(true)
        await supabase.from('coupons').insert({
            code: newCode.toUpperCase(),
            discount_type: discountType,
            discount_value: discountValue,
            min_order_amount: minOrder,
            max_uses: maxUses,
            current_uses: 0,
            is_active: true,
            expires_at: expiresAt || null,
        })
        setSaving(false)
        setShowForm(false)
        setNewCode('')
        loadCoupons()
    }

    const toggleCoupon = async (id: string, active: boolean) => {
        await supabase.from('coupons').update({ is_active: !active }).eq('id', id)
        loadCoupons()
    }

    const deleteCoupon = async (id: string) => {
        await supabase.from('coupons').delete().eq('id', id)
        loadCoupons()
    }

    const filtered = coupons.filter(c =>
        c.code.toLowerCase().includes(search.toLowerCase())
    )

    const formatPrice = (n: number) => new Intl.NumberFormat('fr-FR').format(n)

    if (loading) {
        return (
            <div className="flex justify-center py-32">
                <Loader2 size={48} className="animate-spin text-[#FCD116]" />
            </div>
        )
    }

    return (
        <div className="space-y-10 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
                <div className="flex items-center gap-4">
                    <Link href="/admin/boutique">
                        <button className="p-3 rounded-xl bg-white/5 border border-white/5 text-gray-400 hover:text-white transition-colors" title="Retour">
                            <ArrowLeft size={18} />
                        </button>
                    </Link>
                    <div>
                        <div className="flex items-center gap-2 text-[#FCD116]">
                            <Tag size={18} />
                            <span className="text-[10px] font-bold uppercase tracking-[0.4em]">Codes Promo</span>
                        </div>
                        <h1 className="text-4xl font-black text-white font-heading tracking-tighter">
                            GESTION DES <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FCD116] to-[#E8112D]">COUPONS</span>
                        </h1>
                    </div>
                </div>

                <Button
                    onClick={() => { setShowForm(true); generateCode() }}
                    className="h-14 px-8 rounded-2xl bg-[#FCD116] text-[#0f141e] font-black tracking-widest gap-2 shadow-xl hover:bg-[#008751] hover:text-white"
                >
                    <Plus size={18} /> NOUVEAU COUPON
                </Button>
            </div>

            {/* Search */}
            <div className="relative max-w-md">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" />
                <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Rechercher un code..."
                    className="w-full bg-white/5 border border-white/5 rounded-xl py-3 pl-11 pr-4 text-white text-sm focus:outline-none focus:border-[#FCD116]/30 transition-colors"
                />
            </div>

            {/* New Coupon Form */}
            {showForm && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                    <Card className="bg-[#0a0f18] border-white/10 rounded-[2rem] overflow-hidden">
                        <CardHeader className="p-8 border-b border-white/5">
                            <CardTitle className="text-lg font-black text-white font-heading">Creer un Coupon</CardTitle>
                        </CardHeader>
                        <CardContent className="p-8 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label htmlFor="coupon-code" className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Code *</label>
                                    <div className="flex gap-2">
                                        <input id="coupon-code" type="text" value={newCode} onChange={e => setNewCode(e.target.value.toUpperCase())} placeholder="BENIN10" className="flex-1 bg-white/5 border border-white/5 rounded-xl py-3 px-4 text-white text-sm font-mono focus:outline-none focus:border-[#FCD116]/30" />
                                        <button onClick={generateCode} className="px-4 rounded-xl bg-white/5 border border-white/5 text-gray-400 hover:text-[#FCD116] transition-colors" title="Generer un code">
                                            <Hash size={16} />
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Type de reduction</label>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setDiscountType('percentage')}
                                            className={cn('flex-1 py-3 rounded-xl text-sm font-bold border transition-all', discountType === 'percentage' ? 'bg-[#FCD116]/10 border-[#FCD116]/30 text-[#FCD116]' : 'bg-white/5 border-white/5 text-gray-400')}
                                        >
                                            <Percent size={14} className="inline mr-1" /> Pourcentage
                                        </button>
                                        <button
                                            onClick={() => setDiscountType('fixed')}
                                            className={cn('flex-1 py-3 rounded-xl text-sm font-bold border transition-all', discountType === 'fixed' ? 'bg-[#FCD116]/10 border-[#FCD116]/30 text-[#FCD116]' : 'bg-white/5 border-white/5 text-gray-400')}
                                        >
                                            XOF Fixe
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="coupon-value" className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Valeur {discountType === 'percentage' ? '(%)' : '(XOF)'}</label>
                                    <input id="coupon-value" type="number" value={discountValue} onChange={e => setDiscountValue(Number(e.target.value))} className="w-full bg-white/5 border border-white/5 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-[#FCD116]/30" />
                                </div>

                                <div>
                                    <label htmlFor="coupon-min" className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Commande minimum (XOF)</label>
                                    <input id="coupon-min" type="number" value={minOrder} onChange={e => setMinOrder(Number(e.target.value))} className="w-full bg-white/5 border border-white/5 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-[#FCD116]/30" />
                                </div>

                                <div>
                                    <label htmlFor="coupon-max" className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Utilisations max</label>
                                    <input id="coupon-max" type="number" value={maxUses} onChange={e => setMaxUses(Number(e.target.value))} className="w-full bg-white/5 border border-white/5 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-[#FCD116]/30" />
                                </div>

                                <div>
                                    <label htmlFor="coupon-expires" className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Expire le (optionnel)</label>
                                    <input id="coupon-expires" type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} className="w-full bg-white/5 border border-white/5 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-[#FCD116]/30" />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3">
                                <Button onClick={() => setShowForm(false)} variant="outline" className="h-12 px-6 rounded-xl border-white/10 text-gray-400">Annuler</Button>
                                <Button onClick={createCoupon} disabled={saving || !newCode.trim()} className="h-12 px-8 rounded-xl bg-[#008751] text-white font-bold gap-2">
                                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                    Creer
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            )}

            {/* Coupons List */}
            <div className="space-y-4">
                {filtered.length === 0 ? (
                    <div className="text-center py-20">
                        <Tag size={48} className="text-gray-700 mx-auto mb-4" />
                        <p className="text-gray-500 font-bold">Aucun coupon</p>
                    </div>
                ) : (
                    filtered.map((coupon, i) => {
                        const expired = coupon.expires_at && new Date(coupon.expires_at) < new Date()
                        const exhausted = coupon.current_uses >= coupon.max_uses
                        const isValid = coupon.is_active && !expired && !exhausted

                        return (
                            <motion.div
                                key={coupon.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                            >
                                <div className={cn(
                                    'flex flex-col md:flex-row items-start md:items-center justify-between p-6 rounded-2xl border transition-all',
                                    isValid ? 'bg-white/[0.02] border-white/5' : 'bg-white/[0.01] border-white/[0.03] opacity-50'
                                )}>
                                    <div className="flex items-center gap-5">
                                        <div className={cn(
                                            'w-14 h-14 rounded-2xl flex items-center justify-center font-black text-lg border',
                                            isValid ? 'bg-[#FCD116]/10 border-[#FCD116]/20 text-[#FCD116]' : 'bg-white/5 border-white/5 text-gray-600'
                                        )}>
                                            <Tag size={20} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-lg font-black text-white font-mono tracking-widest">{coupon.code}</span>
                                                <button
                                                    onClick={() => navigator.clipboard.writeText(coupon.code)}
                                                    className="text-gray-600 hover:text-[#FCD116] transition-colors"
                                                    title="Copier le code"
                                                >
                                                    <Copy size={14} />
                                                </button>
                                                {isValid ? (
                                                    <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-[#008751]/10 text-[#008751] border border-[#008751]/20">Actif</span>
                                                ) : expired ? (
                                                    <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-[#E8112D]/10 text-[#E8112D] border border-[#E8112D]/20">Expire</span>
                                                ) : exhausted ? (
                                                    <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-gray-500/10 text-gray-500 border border-gray-500/20">Epuise</span>
                                                ) : (
                                                    <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-gray-500/10 text-gray-500 border border-gray-500/20">Inactif</span>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1">
                                                -{coupon.discount_type === 'percentage' ? `${coupon.discount_value}%` : `${formatPrice(coupon.discount_value)} XOF`}
                                                {coupon.min_order_amount > 0 && ` • Min. ${formatPrice(coupon.min_order_amount)} XOF`}
                                                {coupon.expires_at && ` • Expire: ${new Date(coupon.expires_at).toLocaleDateString('fr-FR')}`}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 mt-4 md:mt-0">
                                        <span className="text-xs text-gray-500 font-mono">{coupon.current_uses}/{coupon.max_uses} utilisations</span>
                                        <button onClick={() => toggleCoupon(coupon.id, coupon.is_active)} className={cn('px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all', coupon.is_active ? 'border-[#E8112D]/20 text-[#E8112D] hover:bg-[#E8112D]/10' : 'border-[#008751]/20 text-[#008751] hover:bg-[#008751]/10')}>
                                            {coupon.is_active ? 'Desactiver' : 'Activer'}
                                        </button>
                                        <button onClick={() => deleteCoupon(coupon.id)} className="p-2 rounded-xl text-gray-600 hover:text-[#E8112D] hover:bg-[#E8112D]/10 transition-colors" title="Supprimer le coupon">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )
                    })
                )}
            </div>
        </div>
    )
}
