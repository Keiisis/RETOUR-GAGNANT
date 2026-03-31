'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { 
    Calculator, FileText, Save, Loader2, RefreshCw, 
    Percent, ShieldCheck, Mail
} from 'lucide-react'

export default function ERPSettingsPage() {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    const [commissionRate, setCommissionRate] = useState(10)
    const [devisHeader, setDevisHeader] = useState('')
    const [devisFooter, setDevisFooter] = useState('')
    const [devisPresidentName, setDevisPresidentName] = useState('')
    const [devisPresidentTitle, setDevisPresidentTitle] = useState('')

    const [emailHeader, setEmailHeader] = useState('')
    const [emailFooter, setEmailFooter] = useState('')

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true)
            
            // 1. Paramètres ERP (Commission, etc)
            const { data: settings } = await supabase
                .from('system_settings')
                .select('*')
                .eq('id', 'comptabilite_erp')
                .single()
            
            if (settings?.value) {
                setCommissionRate(settings.value.commission_rate * 100)
            }

            // 2. Templates Devis/Facture
            const { data: devisTemplate } = await supabase
                .from('document_templates')
                .select('*')
                .eq('id', 'official_devis_facture')
                .single()

            if (devisTemplate?.content) {
                setDevisHeader(devisTemplate.content.header || '')
                setDevisFooter(devisTemplate.content.footer || '')
                setDevisPresidentName(devisTemplate.content.signature_name || '')
                setDevisPresidentTitle(devisTemplate.content.signature_title || '')
            }

            // 3. Templates Email
            const { data: emailTemplate } = await supabase
                .from('document_templates')
                .select('*')
                .eq('id', 'official_email')
                .single()

            if (emailTemplate?.content) {
                setEmailHeader(emailTemplate.content.header || '')
                setEmailFooter(emailTemplate.content.footer || '')
            }

            setLoading(false)
        }

        fetchData()
    }, [])

    const handleSave = async () => {
        setSaving(true)
        try {
            // Update Commission Rate
            await supabase
                .from('system_settings')
                .update({ value: { commission_rate: commissionRate / 100, default_currency: 'XOF' } })
                .eq('id', 'comptabilite_erp')

            // Update Devis/Facture Template
            await supabase
                .from('document_templates')
                .update({ 
                    content: { 
                        header: devisHeader, 
                        footer: devisFooter,
                        signature_name: devisPresidentName,
                        signature_title: devisPresidentTitle
                    } 
                })
                .eq('id', 'official_devis_facture')
            
            // Update Email Template
            await supabase
                .from('document_templates')
                .update({ 
                    content: { 
                        header: emailHeader, 
                        footer: emailFooter 
                    } 
                })
                .eq('id', 'official_email')

            alert('Paramètres enregistrés avec succès.')
        } catch (error) {
            console.error('Erreur lors de la sauvegarde', error)
            alert('Erreur lors de la sauvegarde.')
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
        )
    }

    return (
        <div className="space-y-8 p-6 lg:p-12">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-white flex items-center gap-3">
                        <ShieldCheck size={32} className="text-emerald-500" /> Configurations ERP
                    </h1>
                    <p className="text-gray-400 mt-2">Gérez les paramètres globaux de comptabilité, facturation et emails.</p>
                </div>
                <button 
                    onClick={handleSave} 
                    disabled={saving}
                    className="flex items-center gap-2 bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                >
                    {saving ? <RefreshCw className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}
                    Enregistrer
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* SETTINGS: TAUX GLOBAL */}
                <div className="glass-nexus-card p-6 space-y-6">
                    <h2 className="text-xl font-black text-white flex items-center gap-2 border-b border-white/10 pb-4">
                        <Calculator size={20} className="text-emerald-400" /> Taux & Paramètres
                    </h2>
                    
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                            Taux de Commission Agent (%)
                        </label>
                        <div className="relative">
                            <Percent size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                            <input 
                                title="Taux de commission"
                                type="number" 
                                value={commissionRate} 
                                onChange={(e) => setCommissionRate(Number(e.target.value))}
                                className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white focus:border-emerald-500/50 outline-none text-sm"
                            />
                        </div>
                        <p className="text-xs text-gray-500 mt-2">Définit le pourcentage pris par les agents (ex: 10 pour 10%). S&apos;appliquera sur leurs bilans comptables.</p>
                    </div>
                </div>

                {/* SETTINGS: EMAIL OFFICIEL */}
                <div className="glass-nexus-card p-6 space-y-6">
                    <h2 className="text-xl font-black text-white flex items-center gap-2 border-b border-white/10 pb-4">
                        <Mail size={20} className="text-blue-400" /> Canevas Email Officiel
                    </h2>
                    
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">En-tête de l&apos;Email</label>
                        <textarea 
                            title="En-tête de l'email"
                            value={emailHeader} 
                            onChange={(e) => setEmailHeader(e.target.value)}
                            rows={3}
                            className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white focus:border-blue-500/50 outline-none text-sm resize-none"
                            placeholder="RETOUR GAGNANT BÉNIN..."
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Pied de page de l&apos;Email</label>
                        <textarea 
                            title="Pied de page de l'email"
                            value={emailFooter} 
                            onChange={(e) => setEmailFooter(e.target.value)}
                            rows={3}
                            className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white focus:border-blue-500/50 outline-none text-sm resize-none"
                        />
                    </div>
                </div>

                {/* SETTINGS: DEVIS & FACTURE */}
                <div className="lg:col-span-2 glass-nexus-card p-6 space-y-6">
                    <h2 className="text-xl font-black text-white flex items-center gap-2 border-b border-white/10 pb-4">
                        <FileText size={20} className="text-amber-400" /> Canevas Documents PDF (Devis / Facture)
                    </h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">En-tête (Header PDF)</label>
                            <textarea 
                                title="En-tête de facture"
                                value={devisHeader} 
                                onChange={(e) => setDevisHeader(e.target.value)}
                                rows={4}
                                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white focus:border-amber-500/50 outline-none text-sm resize-none whitespace-pre-line"
                            />
                            <p className="text-[10px] text-gray-500 mt-2">Sera affiché en haut à droite des PDFs.</p>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Pied de page (Footer PDF)</label>
                            <textarea 
                                title="Pied de page de facture"
                                value={devisFooter} 
                                onChange={(e) => setDevisFooter(e.target.value)}
                                rows={4}
                                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white focus:border-amber-500/50 outline-none text-sm resize-none whitespace-pre-line"
                            />
                            <p className="text-[10px] text-gray-500 mt-2">Sera affiché tout en bas du document.</p>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Nom de Signature (Présidence)</label>
                            <input 
                                title="Nom de signature"
                                type="text" 
                                value={devisPresidentName} 
                                onChange={(e) => setDevisPresidentName(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-amber-500/50 outline-none text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Titre de Signature</label>
                            <input 
                                title="Titre de signature"
                                type="text" 
                                value={devisPresidentTitle} 
                                onChange={(e) => setDevisPresidentTitle(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-amber-500/50 outline-none text-sm"
                            />
                        </div>
                    </div>
                </div>

            </div>
        </div>
    )
}
