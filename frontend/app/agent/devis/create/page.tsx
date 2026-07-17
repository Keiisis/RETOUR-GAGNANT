'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import {
    FileText, Plus, Trash2, Loader2, Send, Save, ArrowLeft,
    Calculator, Receipt, User, Eye
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence } from 'framer-motion'
import { convertFromBaseSync, getCurrentRates, type CurrencyCode } from '@/lib/currency'

interface DevisItem {
    description: string
    quantity: number
    unit_price: number
    unit_cost: number
    tva: number
}

const defaultConditions = `• Validité : 30 jours à compter de la date d'émission
• Paiement : 50% à la commande, solde à la livraison
• Les tarifs sont exprimés en FCFA (XOF)
• TVA applicable selon la législation béninoise en vigueur`

export default function AgentCreateDocumentPage() {
    const router = useRouter()
    const [saving, setSaving] = useState(false)
    const [showPreview, setShowPreview] = useState(false)
    const [formType, setFormType] = useState<'devis' | 'facture'>('devis')
    const [currency, setCurrency] = useState<'XOF' | 'EUR' | 'USD'>('XOF')

    const [clientNom, setClientNom] = useState('')
    const [clientPrenom, setClientPrenom] = useState('')
    const [clientEmail, setClientEmail] = useState('')
    const [clientPhone, setClientPhone] = useState('')
    const [clientAdresse, setClientAdresse] = useState('')

    const [items, setItems] = useState<DevisItem[]>([{ description: '', quantity: 1, unit_price: 0, unit_cost: 0, tva: 18 }])
    const [remise, setRemise] = useState(0)
    const [notes, setNotes] = useState('')
    const [conditions, setConditions] = useState(defaultConditions)
    const [validite, setValidite] = useState('30 jours')
    const [rates, setRates] = useState<Record<string, number>>(getCurrentRates())

    const [services, setServices] = useState<{ id: string, title: string, base_price: number, cost_price: number }[]>([])

    useEffect(() => {
        const fetchServices = async () => {
            const { data } = await supabase.from('inventory_items').select('id, title, base_price, cost_price').eq('is_published', true)
            if (data) setServices(data as { id: string, title: string, base_price: number, cost_price: number }[])
            setRates(getCurrentRates())
        }
        fetchServices()
    }, [])

    const generateNumero = (type: 'devis' | 'facture') => {
        const prefix = type === 'devis' ? 'DEV' : 'FAC'
        const date = new Date()
        const yr = date.getFullYear()
        const mn = String(date.getMonth() + 1).padStart(2, '0')
        const rand = String(Math.floor(Math.random() * 9999)).padStart(4, '0')
        return `${prefix}-${yr}${mn}-${rand}`
    }

    const sousTotal = items.reduce((sum, it) => sum + (it.quantity * it.unit_price), 0)
    const totalTVA = items.reduce((sum, it) => sum + (it.quantity * it.unit_price * it.tva / 100), 0)
    const totalFinal = sousTotal + totalTVA - remise
    const totalCost = items.reduce((sum, it) => sum + (it.quantity * (it.unit_cost || 0)), 0)
    const margeNette = totalFinal - totalCost

    const addItem = () => setItems(prev => [...prev, { description: '', quantity: 1, unit_price: 0, unit_cost: 0, tva: 18 }])
    const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i))
    const updateItem = (i: number, field: keyof DevisItem, value: string | number) => {
        setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: value } : it))
    }

    const handleProductSelect = (i: number, title: string) => {
        const service = services.find(s => s.title === title)
        if (service) {
            const convertedPrice = convertFromBaseSync(service.base_price, currency as CurrencyCode)
            const convertedCost = convertFromBaseSync(service.cost_price, currency as CurrencyCode)
            setItems(prev => prev.map((it, idx) => idx === i ? {
                ...it,
                description: service.title,
                unit_price: convertedPrice,
                unit_cost: convertedCost
            } : it))
        } else {
            updateItem(i, 'description', title)
        }
    }

    const handleSave = async (status: string = 'brouillon') => {
        if (!clientNom.trim() || items.length === 0 || !items[0].description) {
            alert('Veuillez remplir le nom du client et au moins un service.')
            return
        }
        setSaving(true)

        // Récupérer l'ID de l'agent via le client browser (auth uniquement, pas de table users)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            alert('Session expirée. Veuillez vous reconnecter.')
            setSaving(false)
            return
        }

        const currentRate = rates[currency] || 1

        // Passer par l'API server-side (service_role) pour éviter l'erreur RLS "permission denied for table users"
        const res = await fetch('/api/agent/devis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agent_id: user.id,
                type: formType,
                numero: generateNumero(formType),
                client_nom: clientNom,
                client_prenom: clientPrenom,
                client_email: clientEmail,
                client_phone: clientPhone,
                client_adresse: clientAdresse,
                currency,
                exchange_rate_applied: currentRate,
                items: items.map(it => ({
                    description: it.description,
                    quantity: it.quantity,
                    unit_price: it.unit_price,
                    tva: it.tva,
                    unit_cost: it.unit_cost,
                })),
                sous_total: (currency === 'XOF') ? Math.round(sousTotal) : Math.round(sousTotal * 100) / 100,
                total_tva: (currency === 'XOF') ? Math.round(totalTVA) : Math.round(totalTVA * 100) / 100,
                remise: (currency === 'XOF') ? Math.round(remise) : Math.round(remise * 100) / 100,
                total: ((currency === 'XOF') ? Math.round(sousTotal) : Math.round(sousTotal * 100) / 100) + 
                       ((currency === 'XOF') ? Math.round(totalTVA) : Math.round(totalTVA * 100) / 100) - 
                       ((currency === 'XOF') ? Math.round(remise) : Math.round(remise * 100) / 100),
                status,
                notes,
                conditions,
                validite,
            }),
        })

        const result = await res.json()

        if (!res.ok) {
            console.error('Erreur création devis:', result)
            alert(`Erreur (${result.code || res.status}) : ${result.error}\n\nDetails: ${result.details ?? null}`)
            setSaving(false)
        } else {
            router.push('/agent/devis')
        }
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-20">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href="/agent/devis" className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-gray-500 hover:text-white transition-colors">
                    <ArrowLeft size={18} />
                </Link>
                <div>
                    <h1 className="text-2xl font-black text-white">Nouveau Document</h1>
                    <p className="text-gray-500 text-sm mt-1">Générez un devis pro-forma ou une facture officielle pour Return Gagnant.</p>
                </div>
            </div>

            <div className="bg-[#0c1420] border border-white/5 rounded-2xl p-6 shadow-xl">
                {/* Type & Config */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 border-b border-white/5 pb-8">
                    <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Type de document</label>
                        <div className="flex gap-2 p-1 bg-white/[0.02] border border-white/5 rounded-xl">
                            {(['devis', 'facture'] as const).map(t => (
                                <button key={t} type="button" onClick={() => setFormType(t)} className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${formType === t ? (t === 'devis' ? 'bg-blue-500/20 text-blue-400 shadow-md' : 'bg-emerald-500/20 text-emerald-400 shadow-md') : 'text-gray-500 hover:text-white hover:bg-white/5'}`}>
                                    {t === 'devis' ? <FileText size={16} /> : <Receipt size={16} />} 
                                    {t === 'devis' ? 'Devis Pro-forma' : 'Facture Officielle'}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Devise de l'Offre</label>
                        <select title="Devise" value={currency} onChange={e => setCurrency(e.target.value as any)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white text-sm focus:outline-none focus:border-emerald-500/50 appearance-none font-mono">
                            <option value="XOF">XOF — Francs CFA (Afrique de l'Ouest)</option>
                            <option value="EUR">EUR — Euro (€)</option>
                            <option value="USD">USD — Dollar Américain ($)</option>
                        </select>
                    </div>
                </div>

                {/* Client Infos */}
                <div className="mb-8 border-b border-white/5 pb-8">
                    <div className="flex items-center gap-2 mb-4">
                        <User size={16} className="text-emerald-400" />
                        <h2 className="text-sm font-bold text-white uppercase tracking-widest">Client</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input title="Nom" placeholder="Nom du client *" value={clientNom} onChange={e => setClientNom(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 text-sm font-bold" />
                        <input title="Prénom" placeholder="Prénom" value={clientPrenom} onChange={e => setClientPrenom(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 text-sm" />
                        <input title="Email" type="email" placeholder="Adresse Email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 text-sm" />
                        <input title="Téléphone" type="tel" placeholder="Numéro Whatsapp (+229...)" value={clientPhone} onChange={e => setClientPhone(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 text-sm" />
                        <div className="md:col-span-2">
                            <input title="Adresse" type="text" placeholder="Adresse, Ville, Pays" value={clientAdresse} onChange={e => setClientAdresse(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 text-sm" />
                        </div>
                    </div>
                </div>

                {/* Services/Lignes */}
                <div className="mb-8 border-b border-white/5 pb-8">
                     <div className="flex flex-col sm:flex-row items-baseline justify-between mb-4 gap-2">
                        <div className="flex items-center gap-2">
                            <Calculator size={16} className="text-emerald-400" />
                            <h2 className="text-sm font-bold text-white uppercase tracking-widest">Détail des prestations</h2>
                        </div>
                        <p className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-md">DEV. BASE : AUTO-COMPÉTION BÉNIN</p>
                    </div>

                    <div className="space-y-3">
                        {items.map((item, i) => (
                            <div key={i} className="flex flex-col sm:flex-row gap-3 items-start bg-white/[0.02] p-3 rounded-xl border border-white/5 group">
                                <div className="flex-1 w-full relative">
                                    <input 
                                        type="text" 
                                        title="Description"
                                        placeholder="Création de Société, Visa..." 
                                        value={item.description} 
                                        onChange={e => handleProductSelect(i, e.target.value)} 
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500 text-sm" 
                                        list="services-list"
                                    />
                                    <datalist id="services-list">
                                        {services.map(s => <option key={s.id} value={s.title}>{s.base_price} XOF</option>)}
                                    </datalist>
                                </div>
                                <div className="flex gap-3 w-full sm:w-auto">
                                    <div className="w-20">
                                        <label className="text-[9px] text-gray-500 uppercase font-bold block mb-1">Qté</label>
                                        <input title="Quantité" type="number" min="1" value={item.quantity} onChange={e => updateItem(i, 'quantity', Number(e.target.value))} className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-white outline-none font-mono text-sm text-center" />
                                    </div>
                                    <div className="w-32">
                                        <label className="text-[9px] text-gray-500 uppercase font-bold block mb-1">PU (HT)</label>
                                        <input title="Prix Unitaire" type="number" min="0" value={item.unit_price} onChange={e => updateItem(i, 'unit_price', Number(e.target.value))} className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-white outline-none font-mono text-sm text-right" />
                                    </div>
                                    <div className="w-20">
                                        <label className="text-[9px] text-gray-500 uppercase font-bold block mb-1">TVA %</label>
                                        <select title="TVA" value={item.tva} onChange={e => updateItem(i, 'tva', Number(e.target.value))} className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-white outline-none font-mono text-sm appearance-none text-center">
                                            <option value={18}>18%</option>
                                            <option value={0}>0%</option>
                                        </select>
                                    </div>
                                    <div className="w-10 flex items-end">
                                        <button title="Supprimer" type="button" onClick={() => removeItem(i)} disabled={items.length === 1} className="w-10 h-[38px] flex items-center justify-center text-gray-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent"><Trash2 size={16} /></button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <button type="button" onClick={addItem} className="mt-3 flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-emerald-400 transition-colors bg-white/5 px-4 py-2 rounded-lg">
                        <Plus size={14} /> Ajouter une ligne
                    </button>
                </div>

                {/* Recap & Totals */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-4">
                         <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Notes internes <span className="text-gray-600 lowercase">(ex: RIB, recommandations...)</span></label>
                            <textarea title="Notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-amber-500/50 text-sm resize-none" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Validité / Délai</label>
                                <input title="Validité" type="text" value={validite} onChange={e => setValidite(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white outline-none text-sm" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Remise globale</label>
                                <input title="Remise" type="number" min="0" value={remise || ''} onChange={e => setRemise(Number(e.target.value))} className="w-full bg-white/5 border border-emerald-500/30 rounded-xl px-4 py-2 text-white outline-none text-sm font-mono text-right focus:border-emerald-500 focus:bg-emerald-500/5 transition-all" placeholder="0" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Conditions générales</label>
                            <textarea title="Conditions" value={conditions} onChange={e => setConditions(e.target.value)} rows={4} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 text-sm resize-none" />
                        </div>
                    </div>
                    
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 self-start">
                        <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-4">Récapitulatif TTC</p>
                        <div className="space-y-3 font-mono text-sm text-gray-300">
                            <div className="flex justify-between pb-3 border-b border-white/5">
                                <span>Total HT</span>
                                <span>{sousTotal.toLocaleString('fr-FR')} {currency}</span>
                            </div>
                            <div className="flex justify-between pb-3 border-b border-white/5">
                                <span>TVA Totale</span>
                                <span>+ {totalTVA.toLocaleString('fr-FR')} {currency}</span>
                            </div>
                            {remise > 0 && (
                                <div className="flex justify-between pb-3 border-b border-white/5 text-amber-400">
                                    <span>Remise Exceptionnelle</span>
                                    <span>- {remise.toLocaleString('fr-FR')} {currency}</span>
                                </div>
                            )}
                            <div className="flex justify-between items-center pt-2">
                                <span className="text-gray-400 font-sans font-bold uppercase tracking-wider text-xs">Total</span>
                                <span className="text-2xl font-black text-emerald-400">{totalFinal.toLocaleString('fr-FR')} {currency}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Submits */}
                <div className="mt-8 pt-8 border-t border-white/5 flex flex-wrap items-center justify-end gap-3">
                    <Link href="/agent/devis" className="px-6 py-3.5 text-sm font-bold text-gray-400 hover:text-white mr-auto">Annuler</Link>
                    
                    <button type="button" onClick={() => setShowPreview(true)} className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/20 font-bold text-sm transition-colors">
                        <Eye size={16} /> Aperçu avant sauvegarde
                    </button>

                    <button type="button" onClick={() => handleSave('brouillon')} disabled={saving} className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white/5 text-gray-300 hover:bg-white/10 font-bold text-sm transition-colors border border-white/5">
                        <Save size={16} /> Enregistrer Brouillon
                    </button>

                    <button type="button" onClick={() => handleSave('envoye')} disabled={saving} className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/20 font-bold text-sm transition-colors shadow-lg">
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                        Générer et Obtenir le Lien
                    </button>
                    
                </div>

            </div>

            {/* PREVIEW MODAL */}
            <AnimatePresence>
                {showPreview && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShowPreview(false)}>
                        <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }} onClick={e => e.stopPropagation()} className="bg-[#080e15] border border-white/10 rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col">
                            {/* Flag stripe */}
                            <div className="h-1 flex flex-shrink-0">
                                <div className="flex-1 bg-emerald-600" />
                                <div className="flex-1 bg-amber-400" />
                                <div className="flex-1 bg-red-600" />
                            </div>

                            {/* Header */}
                            <div className="bg-[#0c1420] border-b border-white/5 p-5 flex items-start justify-between flex-shrink-0">
                                <div className="flex items-center gap-3">
                                    <img src="/logo.jpg" alt="Logo" className="w-12 h-12 rounded-lg object-cover" />
                                    <div>
                                        <p className="text-emerald-400 text-xl font-black tracking-wider">RETOUR GAGNANT BÉNIN</p>
                                        <p className="text-gray-600 text-xs mt-0.5">Agence de Services Internationaux</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className={`text-3xl font-black ${formType === 'devis' ? 'text-amber-400' : 'text-emerald-400'}`}>
                                        {formType === 'devis' ? 'DEVIS' : 'FACTURE'}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1 font-mono">N° {generateNumero(formType)}</p>
                                </div>
                            </div>

                            <div className="overflow-y-auto flex-1 p-5 space-y-5">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-white/5 p-4 rounded-xl">
                                        <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Client</p>
                                        <p className="text-white font-bold">{clientNom || 'Nom du Client'} {clientPrenom}</p>
                                        <p className="text-gray-400 text-xs mt-1">{clientEmail}</p>
                                        <p className="text-gray-400 text-xs">{clientPhone}</p>
                                        <p className="text-gray-400 text-xs">{clientAdresse}</p>
                                    </div>
                                    <div className="bg-white/5 p-4 rounded-xl">
                                        <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Récapitulatif Total</p>
                                        <p className="text-2xl text-emerald-400 font-black font-mono mt-1">{totalFinal.toLocaleString('fr-Fr')} {currency}</p>
                                    </div>
                                </div>

                                <div className="border border-white/5 rounded-xl overflow-hidden">
                                    <table className="w-full text-xs">
                                        <thead className="bg-white/5 text-gray-400 text-left">
                                            <tr>
                                                <th className="p-3">Description</th>
                                                <th className="p-3 text-center">Qté</th>
                                                <th className="p-3 text-right">PU</th>
                                                <th className="p-3 text-right">TVA</th>
                                                <th className="p-3 text-right">Total HT</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {items.map((it, i) => (
                                                <tr key={i} className="border-t border-white/5">
                                                    <td className="p-3 text-gray-300">{it.description || '...'}</td>
                                                    <td className="p-3 text-gray-400 text-center">{it.quantity}</td>
                                                    <td className="p-3 text-gray-400 text-right font-mono">{it.unit_price.toLocaleString('fr-FR')}</td>
                                                    <td className="p-3 text-gray-400 text-right">{it.tva}%</td>
                                                    <td className="p-3 text-white font-medium text-right font-mono">{(it.quantity * it.unit_price).toLocaleString('fr-FR')}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
