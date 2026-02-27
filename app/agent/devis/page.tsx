'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
    Send, Plus, FileText, DollarSign, Trash2,
    Copy, ExternalLink, CheckCircle2
} from 'lucide-react'

interface DevisItem {
    service: string
    price: number
}

export default function AgentDevisPage() {
    const [clientName, setClientName] = useState('')
    const [clientEmail, setClientEmail] = useState('')
    const [items, setItems] = useState<DevisItem[]>([
        { service: '', price: 0 }
    ])
    const [generated, setGenerated] = useState(false)

    const addItem = () => setItems([...items, { service: '', price: 0 }])
    const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i))
    const updateItem = (i: number, field: keyof DevisItem, value: string | number) => {
        setItems(items.map((item, idx) => idx === i ? { ...item, [field]: value } : item))
    }

    const total = items.reduce((sum, item) => sum + (item.price || 0), 0)

    const handleGenerate = () => {
        if (!clientName || items.some(i => !i.service)) return
        setGenerated(true)
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-black text-white">Devis & Paiements</h1>
                <p className="text-gray-500 text-sm mt-1">Créez des devis express et envoyez des liens de paiement sécurisés</p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Form */}
                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6">
                    <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                        <FileText size={14} className="text-emerald-400" /> Nouveau Devis
                    </h2>

                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label htmlFor="devis-client-name" className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1 block">Nom du Client</label>
                                <input
                                    id="devis-client-name"
                                    type="text"
                                    value={clientName}
                                    onChange={(e) => setClientName(e.target.value)}
                                    placeholder="M. Dossou"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/30 text-sm"
                                />
                            </div>
                            <div>
                                <label htmlFor="devis-client-email" className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1 block">Email</label>
                                <input
                                    id="devis-client-email"
                                    type="email"
                                    value={clientEmail}
                                    onChange={(e) => setClientEmail(e.target.value)}
                                    placeholder="client@email.com"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/30 text-sm"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">Prestations</label>
                            <div className="space-y-2">
                                {items.map((item, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={item.service}
                                            onChange={(e) => updateItem(i, 'service', e.target.value)}
                                            placeholder="Ex: Recherche Appartement"
                                            title={`Service ${i + 1}`}
                                            className="flex-1 bg-white/5 border border-white/10 rounded-lg py-2.5 px-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/30 text-sm"
                                        />
                                        <input
                                            type="number"
                                            value={item.price || ''}
                                            onChange={(e) => updateItem(i, 'price', parseInt(e.target.value) || 0)}
                                            placeholder="Prix"
                                            title={`Prix ${i + 1}`}
                                            className="w-28 bg-white/5 border border-white/10 rounded-lg py-2.5 px-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/30 text-sm text-right"
                                        />
                                        <span className="text-xs text-gray-500 w-10">XOF</span>
                                        {items.length > 1 && (
                                            <button onClick={() => removeItem(i)} title="Supprimer" className="p-1 text-red-400/60 hover:text-red-400">
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <button onClick={addItem} className="mt-2 text-xs text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1">
                                <Plus size={12} /> Ajouter une ligne
                            </button>
                        </div>

                        {/* Total */}
                        <div className="flex items-center justify-between p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                            <span className="text-sm font-bold text-white">Total</span>
                            <span className="text-xl font-black text-emerald-400">{total.toLocaleString('fr-FR')} XOF</span>
                        </div>

                        <button
                            onClick={handleGenerate}
                            className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:from-emerald-400 hover:to-teal-500 transition-all text-sm"
                        >
                            <Send size={16} /> Générer le Devis
                        </button>
                    </div>
                </div>

                {/* Preview / Generated */}
                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6">
                    {generated ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="space-y-4"
                        >
                            <div className="text-center mb-6">
                                <CheckCircle2 size={48} className="text-emerald-400 mx-auto mb-3" />
                                <h3 className="text-lg font-bold text-white">Devis Généré !</h3>
                                <p className="text-xs text-gray-500 mt-1">Partagez ce devis avec votre client</p>
                            </div>

                            {/* Devis Preview Card */}
                            <div className="bg-[#040a08] rounded-xl p-5 border border-emerald-500/10">
                                <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/5">
                                    <div>
                                        <p className="text-lg font-black text-white">RETOUR GAGNANT BÉNIN</p>
                                        <p className="text-[10px] text-gray-500">Devis #{Math.random().toString(36).substr(2, 8).toUpperCase()}</p>
                                    </div>
                                    <p className="text-xs text-gray-500">{new Date().toLocaleDateString('fr-FR')}</p>
                                </div>

                                <p className="text-sm text-gray-400 mb-4">Client : <span className="text-white font-bold">{clientName}</span></p>

                                <div className="space-y-2 mb-4">
                                    {items.filter(i => i.service).map((item, i) => (
                                        <div key={i} className="flex items-center justify-between text-sm">
                                            <span className="text-gray-300">{item.service}</span>
                                            <span className="text-white font-bold">{item.price.toLocaleString('fr-FR')} XOF</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex items-center justify-between pt-3 border-t border-white/10">
                                    <span className="font-bold text-white">TOTAL</span>
                                    <span className="text-xl font-black text-emerald-400">{total.toLocaleString('fr-FR')} XOF</span>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <button className="flex-1 flex items-center justify-center gap-2 bg-white/5 border border-white/10 text-white py-3 rounded-xl text-sm font-bold hover:bg-white/10 transition-all">
                                    <Copy size={14} /> Copier le lien
                                </button>
                                <button className="flex-1 flex items-center justify-center gap-2 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 py-3 rounded-xl text-sm font-bold hover:bg-emerald-500/30 transition-all">
                                    <ExternalLink size={14} /> Envoyer au client
                                </button>
                            </div>
                        </motion.div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-600 gap-3 py-16">
                            <DollarSign size={48} className="text-gray-700" />
                            <p className="text-sm font-semibold text-center">Remplissez le formulaire pour<br />générer un devis premium</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
