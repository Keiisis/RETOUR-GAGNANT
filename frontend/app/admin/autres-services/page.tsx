'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { FloppyDisk as Save, CircleNotch as Loader2, CheckCircle as CheckCircle2, ArrowLeft, Plus, Trash as Trash2, Layout, FileText, Info, CaretDown as ChevronDown, CaretUp as ChevronUp } from '@phosphor-icons/react';
import Link from 'next/link'

const AVAILABLE_ICONS = [
    'Car', 'HeartPulse', 'GraduationCap', 'FileCheck',
    'Plane', 'Home', 'Building2', 'Stethoscope',
    'BookOpen', 'Briefcase', 'Globe', 'Map',
    'Truck', 'Heart', 'School', 'Clipboard',
]

interface ServiceItem {
    icon: string
    title: string
    description: string
}

interface PageContent {
    hero_title: string
    hero_subtitle: string
    services: ServiceItem[]
    cta_title: string
    cta_description: string
    cta_button_text: string
}

const DEFAULT_CONTENT: PageContent = {
    hero_title: "Autres Services",
    hero_subtitle: "Transport, santé, éducation, démarches administratives : Découvrez tous nos services complémentaires pour faciliter votre installation au Bénin.",
    services: [
        { icon: "Car", title: "Transport & Logistique", description: "Transfert aéroport, location de véhicule avec chauffeur, organisation de déplacements interurbains." },
        { icon: "HeartPulse", title: "Santé", description: "Mise en relation avec des cliniques et médecins partenaires, accompagnement pour les soins et hospitalisations." },
        { icon: "GraduationCap", title: "Scolarité & Éducation", description: "Orientation et inscription dans des établissements scolaires francophones et internationaux au Bénin." },
        { icon: "FileCheck", title: "Démarches Administratives", description: "Assistance pour les demandes de visa, titres de séjour, regroupement familial et autres démarches officielles." },
    ],
    cta_title: "Un besoin spécifique ?",
    cta_description: "Contactez-nous pour discuter de votre situation. Nous évaluons chaque demande individuellement et vous orientons vers la meilleure solution.",
    cta_button_text: "Prendre rendez-vous",
}

const IC = 'w-full bg-white/[0.04] border border-white/10 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 placeholder:text-gray-600 transition-all'
const TA = 'w-full bg-white/[0.04] border border-white/10 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 placeholder:text-gray-600 transition-all resize-none'
const LC = 'text-xs font-bold text-gray-400 mb-1.5 block'

export default function AutresServicesAdminPage() {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [sectionId, setSectionId] = useState<string | null>(null)
    const [content, setContent] = useState<PageContent>(DEFAULT_CONTENT)
    const [expandedService, setExpandedService] = useState<number | null>(null)
    const [newService, setNewService] = useState<ServiceItem>({ icon: 'FileCheck', title: '', description: '' })
    const [showAddService, setShowAddService] = useState(false)

    useEffect(() => {
        const load = async () => {
            const { data } = await supabase
                .from('page_sections')
                .select('*')
                .eq('page', 'autres-services')
                .eq('section_key', 'page_content')
                .single()

            if (data) {
                setSectionId(data.id)
                setContent({ ...DEFAULT_CONTENT, ...(data.content as PageContent) })
            }
            setLoading(false)
        }
        load()
    }, [])

    const update = (field: keyof PageContent, value: unknown) => {
        setContent(prev => ({ ...prev, [field]: value }))
    }

    const handleSave = async () => {
        setSaving(true)
        setSaved(false)
        if (sectionId) {
            await supabase
                .from('page_sections')
                .update({ content, updated_at: new Date().toISOString() })
                .eq('id', sectionId)
        } else {
            const { data } = await supabase
                .from('page_sections')
                .insert({
                    page: 'autres-services',
                    section_key: 'page_content',
                    title: 'Contenu page Autres Services',
                    content,
                    sort_order: 1,
                    is_active: true,
                })
                .select()
                .single()
            if (data) setSectionId(data.id)
        }
        setSaving(false)
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
    }

    const updateService = (i: number, field: keyof ServiceItem, val: string) => {
        update('services', content.services.map((s, idx) => idx === i ? { ...s, [field]: val } : s))
    }

    const removeService = (i: number) => {
        update('services', content.services.filter((_, idx) => idx !== i))
        if (expandedService === i) setExpandedService(null)
    }

    const addService = () => {
        if (!newService.title.trim()) return
        update('services', [...content.services, { ...newService }])
        setNewService({ icon: 'FileCheck', title: '', description: '' })
        setShowAddService(false)
    }

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#0a0f14] py-8 px-4">
            <div className="max-w-3xl mx-auto space-y-8">

                {/* Header */}
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <Link
                            href="/admin"
                            className="text-xs text-gray-500 hover:text-white flex items-center gap-1.5 mb-2 transition-colors"
                        >
                            <ArrowLeft size={12} /> Retour au dashboard
                        </Link>
                        <h1 className="text-2xl font-black text-white flex items-center gap-3">
                            <FileText size={22} className="text-emerald-400" />
                            Contenu : Autres Services
                        </h1>
                        <p className="text-xs text-gray-500 mt-1">
                            Tous les textes visibles sur la page <span className="font-mono text-gray-400">/services/autres</span>
                        </p>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-black text-sm px-6 py-3 rounded-xl flex items-center gap-2 shadow-[0_0_30px_rgba(16,185,129,0.2)] disabled:opacity-50 transition-all"
                    >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <CheckCircle2 size={16} /> : <Save size={16} />}
                        {saving ? 'Enregistrement...' : saved ? 'Enregistré !' : 'Enregistrer'}
                    </button>
                </div>

                {saved && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-center gap-3">
                        <CheckCircle2 size={18} className="text-emerald-400" />
                        <p className="text-sm text-emerald-400 font-bold">Modifications enregistrées. Les changements sont immédiatement visibles.</p>
                    </div>
                )}

                {/* ═══ HERO ═══ */}
                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 space-y-4">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-9 h-9 rounded-xl bg-[#FCD116]/10 border border-[#FCD116]/20 flex items-center justify-center">
                            <Layout size={18} className="text-[#FCD116]" />
                        </div>
                        <div>
                            <h2 className="text-base font-black text-white">Bannière Hero</h2>
                            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Titre et sous-titre en haut de page</p>
                        </div>
                    </div>
                    <div>
                        <label className={LC}>Titre principal <span className="text-red-400">*</span></label>
                        <input
                            type="text"
                            value={content.hero_title}
                            onChange={e => update('hero_title', e.target.value)}
                            className={IC}
                        />
                    </div>
                    <div>
                        <label className={LC}>Sous-titre</label>
                        <textarea
                            rows={3}
                            value={content.hero_subtitle}
                            onChange={e => update('hero_subtitle', e.target.value)}
                            className={TA}
                        />
                    </div>
                </div>

                {/* ═══ SERVICES ═══ */}
                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 space-y-4">
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                                <FileText size={18} className="text-emerald-400" />
                            </div>
                            <div>
                                <h2 className="text-base font-black text-white">Cartes de services</h2>
                                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">{content.services.length} service(s) affiché(s)</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowAddService(v => !v)}
                            className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 font-bold text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all"
                        >
                            <Plus size={14} /> Ajouter
                        </button>
                    </div>

                    {/* Services list */}
                    <div className="space-y-2">
                        {content.services.map((svc, i) => (
                            <div key={i} className="border border-white/5 rounded-xl overflow-hidden hover:border-emerald-500/20 transition-all">
                                <div
                                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
                                    onClick={() => setExpandedService(expandedService === i ? null : i)}
                                >
                                    <span className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 text-[10px] font-black shrink-0">{i + 1}</span>
                                    <span className="text-[10px] font-mono bg-white/5 px-2 py-0.5 rounded text-gray-400 shrink-0">{svc.icon}</span>
                                    <span className="text-sm font-bold text-white flex-1 truncate">{svc.title || '-'}</span>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={e => { e.stopPropagation(); removeService(i) }}
                                            className="p-1.5 text-red-500/50 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                        {expandedService === i
                                            ? <ChevronUp size={16} className="text-gray-500" />
                                            : <ChevronDown size={16} className="text-gray-500" />
                                        }
                                    </div>
                                </div>
                                {expandedService === i && (
                                    <div className="px-4 pb-4 pt-2 space-y-3 bg-white/[0.01] border-t border-white/5">
                                        <div>
                                            <label className={LC}>Icône</label>
                                            <select
                                                title="Icône"
                                                value={svc.icon}
                                                onChange={e => updateService(i, 'icon', e.target.value)}
                                                className={IC}
                                            >
                                                {AVAILABLE_ICONS.map(icon => (
                                                    <option key={icon} value={icon}>{icon}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className={LC}>Titre</label>
                                            <input
                                                type="text"
                                                value={svc.title}
                                                onChange={e => updateService(i, 'title', e.target.value)}
                                                className={IC}
                                            />
                                        </div>
                                        <div>
                                            <label className={LC}>Description</label>
                                            <textarea
                                                rows={3}
                                                value={svc.description}
                                                onChange={e => updateService(i, 'description', e.target.value)}
                                                className={TA}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Add new service */}
                    {showAddService && (
                        <div className="border border-dashed border-emerald-500/20 rounded-xl p-4 space-y-3 bg-emerald-500/[0.02]">
                            <p className="text-xs font-bold text-emerald-400 flex items-center gap-2">
                                <Plus size={12} /> Nouveau service
                            </p>
                            <div>
                                <label className={LC}>Icône</label>
                                <select
                                    title="Icône"
                                    value={newService.icon}
                                    onChange={e => setNewService(s => ({ ...s, icon: e.target.value }))}
                                    className={IC}
                                >
                                    {AVAILABLE_ICONS.map(icon => (
                                        <option key={icon} value={icon}>{icon}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className={LC}>Titre <span className="text-red-400">*</span></label>
                                <input
                                    type="text"
                                    value={newService.title}
                                    onChange={e => setNewService(s => ({ ...s, title: e.target.value }))}
                                    className={IC}
                                    placeholder="Ex: Hébergement"
                                />
                            </div>
                            <div>
                                <label className={LC}>Description</label>
                                <textarea
                                    rows={2}
                                    value={newService.description}
                                    onChange={e => setNewService(s => ({ ...s, description: e.target.value }))}
                                    className={TA}
                                    placeholder="Description du service..."
                                />
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={addService}
                                    disabled={!newService.title.trim()}
                                    className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 disabled:opacity-30 transition-all"
                                >
                                    <Plus size={14} /> Ajouter ce service
                                </button>
                                <button
                                    onClick={() => setShowAddService(false)}
                                    className="bg-white/5 text-gray-400 hover:bg-white/10 font-bold text-xs px-4 py-2 rounded-xl transition-all"
                                >
                                    Annuler
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* ═══ CTA ═══ */}
                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 space-y-4">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                            <Layout size={18} className="text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-base font-black text-white">Bloc CTA : Besoin spécifique</h2>
                            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Section en bas de page</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={LC}>Titre</label>
                            <input
                                type="text"
                                value={content.cta_title}
                                onChange={e => update('cta_title', e.target.value)}
                                className={IC}
                            />
                        </div>
                        <div>
                            <label className={LC}>Texte du bouton</label>
                            <input
                                type="text"
                                value={content.cta_button_text}
                                onChange={e => update('cta_button_text', e.target.value)}
                                className={IC}
                            />
                        </div>
                    </div>
                    <div>
                        <label className={LC}>Description</label>
                        <textarea
                            rows={3}
                            value={content.cta_description}
                            onChange={e => update('cta_description', e.target.value)}
                            className={TA}
                        />
                    </div>
                </div>

                {/* Info */}
                <div className="bg-blue-500/5 border border-blue-500/10 rounded-2xl p-5 flex items-start gap-4">
                    <Info size={18} className="text-blue-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-gray-400 space-y-1">
                        <p className="font-bold text-blue-400">URL de la page frontend</p>
                        <p>Les modifications s&apos;appliquent immédiatement sur : <span className="font-mono text-white">/services/autres</span></p>
                        <p className="mt-1">Icônes disponibles : Car, HeartPulse, GraduationCap, FileCheck, Plane, Home, Building2, Stethoscope, BookOpen, Briefcase, Globe, Map, Truck, Heart, School, Clipboard</p>
                    </div>
                </div>

                {/* Bottom save */}
                <div className="flex justify-end pb-8">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-black text-sm px-8 py-3 rounded-xl flex items-center gap-2 shadow-[0_0_30px_rgba(16,185,129,0.2)] disabled:opacity-50 transition-all"
                    >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        {saving ? 'Enregistrement...' : 'Enregistrer le contenu'}
                    </button>
                </div>

            </div>
        </div>
    )
}
