'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { nextDocumentNumber } from '@/lib/document-numbering'
import { FileText, Plus, Trash as Trash2, CircleNotch as Loader2, ArrowLeft, User, FloppyDisk as Save, CheckCircle as CheckCircle2, Calculator, Receipt } from '@phosphor-icons/react';
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { convertFromBaseSync, getCurrentRates, formatCurrencySync, refreshRates } from '@/lib/currency'

interface DevisItem {
    description: string
    quantity: number
    unit_price: number // in the selected currency
    unit_cost: number  // in the selected currency
    tva: number
}

const defaultConditions = `• Validité : 30 jours à compter de la date d'émission
• Paiement : 50% à la commande, solde à la livraison
• Les tarifs sont exprimés en FCFA (XOF)
• TVA applicable selon la législation béninoise en vigueur`


export default function CreateDocumentPage() {
    const router = useRouter()
    const [saving, setSaving] = useState(false)
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

    // Suggestions de catalogue
    const [services, setServices] = useState<{ id: string, title: string, base_price: number, cost_price: number }[]>([])

    // Taux de change : rechargés depuis la DB au montage. Le changement de
    // `ratesReady` force un re-rendu → les conversions d'affichage
    // (convertFromBaseSync / formatCurrencySync) relisent les taux frais.
    const [ratesReady, setRatesReady] = useState(false)
    void ratesReady

    useEffect(() => {
        const fetchServices = async () => {
            // Load base products from our new unified inventory
            const { data } = await supabase.from('inventory_items').select('id, title, base_price, cost_price')
            if (data) setServices(data)
        }
        fetchServices()
        // CRITIQUE : charger les VRAIS taux depuis la DB avant toute conversion
        // ou stockage. Sans ça, EUR/USD utilisaient les taux de secours codés
        // (USD=600 au lieu du taux réel ~574) → montants et exchange_rate_applied
        // faux. On force le rafraîchissement puis on re-rend.
        refreshRates().then(() => setRatesReady(true)).catch(() => setRatesReady(true))
    }, [])

    const sousTotal = items.reduce((sum, it) => sum + (it.quantity * it.unit_price), 0)
    const totalTVA = items.reduce((sum, it) => sum + (it.quantity * it.unit_price * it.tva / 100), 0)
    const totalFinal = sousTotal + totalTVA - remise

    // Total Cost (for margin calculation)
    const totalCost = items.reduce((sum, it) => sum + (it.quantity * it.unit_cost), 0)
    const margeNette = sousTotal - totalCost

    const addItem = () => setItems(prev => [...prev, { description: '', quantity: 1, unit_price: 0, unit_cost: 0, tva: 18 }])
    const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i))
    const updateItem = (i: number, field: keyof DevisItem, value: string | number) => {
        setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: value } : it))
    }

    const handleProductSelect = (i: number, title: string) => {
        const service = services.find(s => s.title === title)
        if (service) {
            // Converts from DB Base (XOF) to selected currency
            const convertedPrice = convertFromBaseSync(service.base_price, currency)
            const convertedCost = convertFromBaseSync(service.cost_price, currency)
            
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
            alert('Veuillez remplir le nom du client et au moins un service/produit.')
            return
        }
        setSaving(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            alert('Vous devez être connecté.')
            setSaving(false)
            return
        }

        // Snapshot the current exchange rate for immutability
        // Taux lu à l'instant de l'enregistrement (après refresh DB) : snapshot
        // immuable pour ce document (EUR = parité fixe 655,957 ; USD = taux DB réel)
        await refreshRates().catch(() => {})
        const currentRate = getCurrentRates()[currency] || 1

        // Numéro séquentiel officiel (compteur atomique en base)
        const numero = await nextDocumentNumber(supabase, formType)

        const { error } = await supabase.from('documents_financiers').insert({
            agent_id: user.id,
            type: formType,
            numero,
            client_nom: clientNom, 
            client_prenom: clientPrenom, 
            client_email: clientEmail,
            client_phone: clientPhone, 
            client_adresse: clientAdresse,
            currency: currency,
            exchange_rate_applied: currentRate,
            items: items.map(it => ({ description: it.description, quantity: it.quantity, unit_price: it.unit_price, tva: it.tva, unit_cost: it.unit_cost })), 
            sous_total: sousTotal,
            total_tva: totalTVA,
            remise,
            total: totalFinal,
            // Une facture émise manuellement atteste d'un paiement déjà reçu :
            // statut « payé » automatique (jamais « envoyé »), méthode manuelle tracée
            status: formType === 'facture' ? 'paye' : status,
            ...(formType === 'facture' ? { payment_method: 'manuel', paid_at: new Date().toISOString() } : {}),
            notes,
            conditions,
            validite,
        })

        if (error) {
            console.error('Erreur SQL:', error)
            alert('Erreur lors de la sauvegarde du document.')
            setSaving(false)
        } else {
            router.push('/admin/facturation')
        }
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-20">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href="/admin/facturation" className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-gray-500 hover:text-white transition-colors">
                    <ArrowLeft size={18} />
                </Link>
                <div>
                    <h1 className="text-2xl font-black text-white">Nouveau Document</h1>
                    <p className="text-gray-500 text-sm mt-1">Générez un devis ou une facture officielle Béninoise.</p>
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
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Devise du client</label>
                        <select title="Devise du client" value={currency} onChange={e => setCurrency(e.target.value as 'XOF' | 'EUR' | 'USD')} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white text-sm focus:outline-none focus:border-emerald-500/50 appearance-none font-mono">
                            <option value="XOF">XOF : Francs CFA (Afrique de l'Ouest)</option>
                            <option value="EUR">EUR : Euro (€)</option>
                            <option value="USD">USD : Dollar Am&eacute;ricain ($)</option>
                        </select>
                    </div>
                </div>

                {/* Client Ingos */}
                <div className="mb-8 border-b border-white/5 pb-8">
                    <div className="flex items-center gap-2 mb-4">
                        <User size={16} className="text-emerald-400" />
                        <h2 className="text-sm font-bold text-white uppercase tracking-widest">Informations Client</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input type="text" placeholder="Nom du client *" value={clientNom} onChange={e => setClientNom(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 text-sm font-bold" />
                        <input type="text" placeholder="Prénom" value={clientPrenom} onChange={e => setClientPrenom(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 text-sm" />
                        <input type="email" placeholder="Adresse Email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 text-sm" />
                        <input type="tel" placeholder="Numéro de téléphone (avec code pays)" value={clientPhone} onChange={e => setClientPhone(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 text-sm" />
                        <div className="md:col-span-2">
                            <input type="text" placeholder="Adresse complète, Ville, Pays" value={clientAdresse} onChange={e => setClientAdresse(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 text-sm" />
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
                        <p className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-md">DEV. BASE : TAPEZ POUR AUTO-COMPÉTION</p>
                    </div>

                    <div className="space-y-3">
                        {items.map((item, i) => (
                            <div key={i} className="flex flex-col sm:flex-row gap-3 items-start bg-white/[0.02] p-3 rounded-xl border border-white/5 group">
                                <div className="flex-1 w-full relative">
                                    <input 
                                        type="text" 
                                        placeholder="Description du service (ou tapez un nom de forfait...)" 
                                        value={item.description} 
                                        onChange={e => handleProductSelect(i, e.target.value)} 
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500 text-sm" 
                                        list="services-list"
                                    />
                                    <datalist id="services-list">
                                        {services.map(s => <option key={s.id} value={s.title}>{formatCurrencySync(convertFromBaseSync(s.base_price, currency), currency)}</option>)}
                                    </datalist>
                                </div>
                                <div className="flex gap-3 w-full sm:w-auto">
                                    <div className="w-20">
                                        <label className="text-[9px] text-gray-500 uppercase font-bold block mb-1">Qté</label>
                                        <input title="Quantité" placeholder="1" type="number" min="1" value={item.quantity} onChange={e => updateItem(i, 'quantity', Number(e.target.value))} className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-white outline-none font-mono text-sm text-center" />
                                    </div>
                                    <div className="w-32">
                                        <label className="text-[9px] text-gray-500 uppercase font-bold block mb-1">PU (HT)</label>
                                        <input title="Prix Unitaire HT" placeholder="0" type="number" min="0" value={item.unit_price} onChange={e => updateItem(i, 'unit_price', Number(e.target.value))} className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-white outline-none font-mono text-sm text-right" />
                                    </div>
                                    <div className="w-20">
                                        <label className="text-[9px] text-gray-500 uppercase font-bold block mb-1">TVA %</label>
                                        <select title="Taux TVA" value={item.tva} onChange={e => updateItem(i, 'tva', Number(e.target.value))} className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-white outline-none font-mono text-sm appearance-none text-center">
                                            <option value={18}>18%</option>
                                            <option value={0}>0%</option>
                                        </select>
                                    </div>
                                    <div className="w-10 flex items-end">
                                        <button title="Supprimer la ligne" type="button" onClick={() => removeItem(i)} disabled={items.length === 1} className="w-10 h-[38px] flex items-center justify-center text-gray-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent"><Trash2 size={16} /></button>
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
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Notes client <span className="text-gray-600 lowercase">(ex: RIB, recommandations...)</span></label>
                            <textarea title="Notes client" placeholder="Notes (Optionnel)" value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-amber-500/50 text-sm resize-none" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Validité / Délai</label>
                                <input title="Validité" placeholder="ex: 15 jours" type="text" value={validite} onChange={e => setValidite(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white outline-none text-sm" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Remise globale</label>
                                <input title="Remise" type="number" min="0" value={remise || ''} onChange={e => setRemise(Number(e.target.value))} className="w-full bg-white/5 border border-emerald-500/30 rounded-xl px-4 py-2 text-white outline-none text-sm font-mono text-right focus:border-emerald-500 focus:bg-emerald-500/5 transition-all" placeholder="0" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Conditions générales</label>
                            <textarea value={conditions} onChange={e => setConditions(e.target.value)} rows={4} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 text-sm resize-none" />
                        </div>
                    </div>
                    
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 self-start">
                        <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-4">Récapitulatif TTC</p>
                        <div className="space-y-3 font-mono text-sm text-gray-300">
                            <div className="flex justify-between pb-3 border-b border-white/5">
                                <span>Total HT</span>
                                <span>{formatCurrencySync(sousTotal, currency)}</span>
                            </div>
                            <div className="flex justify-between pb-3 border-b border-white/5">
                                <span>TVA Totale</span>
                                <span>+ {formatCurrencySync(totalTVA, currency)}</span>
                            </div>
                            {remise > 0 && (
                                <div className="flex justify-between pb-3 border-b border-white/5 text-amber-400">
                                    <span>Remise Exceptionnelle</span>
                                    <span>- {formatCurrencySync(remise, currency)}</span>
                                </div>
                            )}
                            <div className="flex justify-between items-center pt-2">
                                <span className="text-gray-400 font-sans font-bold uppercase tracking-wider text-xs">Total général</span>
                                <span className="text-2xl font-black text-emerald-400">{formatCurrencySync(totalFinal, currency)}</span>
                            </div>
                            
                            {/* Marge Commerciale UI */}
                            {margeNette > 0 && (
                                <div className="flex justify-between items-center pt-4 mt-4 border-t border-dashed border-white/10">
                                    <span className="text-purple-400/70 font-sans font-bold uppercase tracking-wider text-[10px]">Marge Commerciale (Est.)</span>
                                    <span className="text-sm font-bold text-purple-400">{formatCurrencySync(margeNette, currency)} ({Math.round((margeNette/sousTotal)*100)}%)</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Submits */}
                <div className="mt-8 pt-8 border-t border-white/5 flex flex-wrap items-center justify-end gap-3">
                    <Link href="/admin/facturation" className="px-6 py-3.5 text-sm font-bold text-gray-400 hover:text-white mr-auto">Annuler</Link>
                    
                    <button type="button" onClick={() => handleSave('brouillon')} disabled={saving} className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white/5 text-gray-300 hover:bg-white/10 font-bold text-sm transition-colors border border-white/5">
                        <Save size={16} /> Enregistrer Brouillon
                    </button>

                    <button type="button" onClick={() => handleSave('accepte')} disabled={saving} className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/20 font-bold text-sm transition-colors shadow-lg">
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                        Enregistrer en {formType === 'devis' ? 'Devis Actif' : 'Facture À Payer'}
                    </button>
                    
                </div>

            </div>
        </div>
    )
}
