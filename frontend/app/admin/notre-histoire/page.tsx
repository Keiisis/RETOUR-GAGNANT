'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { FloppyDisk as Save, ArrowSquareOut as ExternalLink, CaretRight as ChevronRight, Image as ImageIcon, Plus, Trash as Trash2, FilmStrip as Film, Users, Quotes as Quote, StackSimple as Layers, Star, Shield, ArrowRight, CheckCircle, WarningCircle as AlertCircle, CircleNotch as Loader2, type Icon as LucideIcon } from '@phosphor-icons/react';

/* ═══════════════════════════════════════════════════════════════
   TYPES & DEFAULTS
   ═══════════════════════════════════════════════════════════════ */

interface Portrait { image: string; name: string; role: string; phrase: string }
interface Symbol { title: string; text: string }

const DEFAULTS = {
    hero: {
        title_line1: "Là où l'histoire s'est interrompue,",
        title_line2: "nous réécrivons l'avenir.",
        subtitle: "RETOUR GAGNANT BENIN n'est pas qu'une agence. C'est le pont d'or jeté entre un passé retrouvé et un avenir à construire.",
        image: '/images/histoire/trio.jpeg',
    },
    rencontre: {
        image: '/images/histoire/rencontre-martinique.jpeg',
        image_caption_label: 'Martinique • Décembre 2023',
        image_caption_sub: 'Là où tout a commencé',
        block1_heading: "Une rencontre, une vision, une loi historique.",
        block1_text: "Tout commence par une détermination inébranlable. Mme NATHALIE RIFFERT GERMANY, femme engagée et passionnée, a porté en elle le rêve d'un retour au pays après 400 ans d'absence. Ce rêve est devenu réalité grâce à une rencontre décisive.",
        block2_quote: "Le 13 décembre 2023, en Martinique : un dialogue historique s'est noué entre trois acteurs majeurs : Mr GEORGES GERMANY, Mme NATHALIE RIFFERT GERMANY et le Chef de l'État béninois, S.E.M. PATRICE TALON.",
        block3_text1: "C'est lors de cet échange que l'idée de rendre à tous les afro-descendants leur identité originelle a pris corps. À la demande de Nathalie, cette vision s'est élargie à l'ensemble des Caraïbes.",
        block3_text2: "Aujourd'hui, le Président Patrice Talon entre dans l'histoire de l'humanité en ouvrant les bras à des milliers de frères et sœurs. Une nouvelle page s'écrit : avec lui, avec nous, et avec vous.",
    },
    fondatrice: {
        photo: '/images/histoire/nathalie-new.jpg',
        name: 'Mme NATHALIE RIFFERT GERMANY',
        title_label: 'Fondatrice',
        section_heading: 'Les Mots de la Fondatrice',
        quote: "Mon souhait le plus cher est que ce retour soit une empreinte indélébile de réussite. Je me suis pleinement investie pour que chaque afro-descendant retrouve non seulement sa terre, mais aussi sa place et sa dignité, dans le respect du vivre ensemble.",
        closing: 'Bonne arrivée à tous !',
    },
    architectes: {
        heading: 'Les architectes du changement',
        portraits: [
            { image: '/images/histoire/talon.jpeg', name: 'S.E.M. PATRICE TALON', role: 'Président de la République du Bénin', phrase: "Le visionnaire de l'accueil" },
            { image: '/images/histoire/georges-1.jpeg', name: 'Mr GEORGES GERMANY', role: 'Cofondateur', phrase: 'Le bâtisseur de ponts' },
            { image: '/images/histoire/nathalie-new.jpg', name: 'Mme NATHALIE RIFFERT GERMANY', role: 'Fondatrice', phrase: 'La flamme qui a tout allumé' },
        ] as Portrait[],
    },
    logo: {
        heading: "L'Énigme du Symbole",
        logo_image: '/images/logo-transparent.png',
        symbols: [
            { title: 'La Porte Sculptée', text: "L'accès sécurisé et facilité au Bénin d'aujourd'hui. Elle symbolise l'Accueil, la Protection et l'Authenticité : des lignes rappelant l'artisanat local, signe de respect pour nos traditions séculaires." },
            { title: "L'Arbre de Vie", text: "La transformation de «l'Arbre de l'Oubli» en un Arbre de Vie. Il incarne la Solidité, la Prospérité et la Renaissance : la reconnexion spirituelle et physique avec la terre nourricière." },
            { title: 'Notre Signature', text: "L'harmonie de ces symboles forme une image puissante : celle de la maison retrouvée. Choisir Retour GAGNANT, c'est choisir la stabilité, la réussite et la fierté de bâtir le Bénin moderne." },
        ] as Symbol[],
    },
    confiance: {
        heading: "L'appui des institutions",
        subtitle: 'Une mission reconnue et soutenue. Chaque document est une pierre posée dans l\'édifice de la confiance.',
        main_image: '/images/histoire/attestation-1.jpeg',
        main_title: "Ce document, c'est bien plus que du papier.",
        main_text1: "Il porte en lui des années de démarches, de doutes, de nuits blanches et de conversations qui n'en finissaient pas. Il porte surtout la preuve que quand on croit profondément en quelque chose, les murs finissent par céder.",
        main_text2: "Chaque tampon, chaque signature raconte une porte qui s'est ouverte. Chaque page est le témoignage silencieux d'un combat mené avec patience, avec cœur, sans jamais baisser les bras.",
        main_text3: "Voir ce rêve inscrit dans le marbre officiel, c'est la plus belle des récompenses. Pas pour nous : pour toutes les familles qui, demain, pourront dire : je suis rentré chez moi.",
        engagement_image: '/images/histoire/integre-causes.jpeg',
        carousel: [
            '/images/histoire/attestation-debut.jpeg',
            '/images/histoire/attestation-2.jpeg',
            '/images/histoire/attestation-3.jpeg',
            '/images/histoire/attestation-4.jpeg',
            '/images/histoire/attestation-5.jpeg',
            '/images/histoire/logo.jpeg',
        ] as string[],
    },
    cta: {
        heading_line1: "Une page s'écrit",
        heading_line2: 'avec vous.',
        subtitle: 'Choisir Retour Gagnant, c\'est choisir la maison retrouvée. Rejoignez les centaines de familles qui ont fait le voyage du retour en toute sécurité.',
        btn_primary_text: 'Je demande un Rendez-vous',
        btn_primary_href: '/rendez-vous',
        btn_secondary_text: 'Nous contacter',
        btn_secondary_href: '/contact',
    },
}

type TabKey = keyof typeof DEFAULTS

const TABS: { key: TabKey; label: string; icon: LucideIcon }[] = [
    { key: 'hero', label: 'Héros', icon: Film },
    { key: 'rencontre', label: 'La Rencontre', icon: Quote },
    { key: 'fondatrice', label: 'Fondatrice', icon: Users },
    { key: 'architectes', label: 'Architectes', icon: Users },
    { key: 'logo', label: 'Le Logo', icon: Star },
    { key: 'confiance', label: 'Confiance', icon: Shield },
    { key: 'cta', label: 'CTA Final', icon: ArrowRight },
]

/* ═══════════════════════════════════════════════════════════════
   COMPOSANTS RÉUTILISABLES
   ═══════════════════════════════════════════════════════════════ */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</label>
            {children}
        </div>
    )
}

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
    return (
        <input
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#008751]/50 transition-colors"
        />
    )
}

function TextArea({ value, onChange, rows = 3, placeholder }: { value: string; onChange: (v: string) => void; rows?: number; placeholder?: string }) {
    return (
        <textarea
            value={value}
            onChange={e => onChange(e.target.value)}
            rows={rows}
            placeholder={placeholder}
            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#008751]/50 transition-colors resize-none"
        />
    )
}

function ImageField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
    return (
        <Field label={label}>
            <div className="space-y-2">
                <TextInput value={value} onChange={onChange} placeholder="/images/histoire/..." />
                {value && (
                    <div className="relative h-32 rounded-lg overflow-hidden border border-white/10 bg-black/20">
                        <img src={value} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 bg-black/40 transition-opacity">
                            <ImageIcon size={20} className="text-white/60" />
                        </div>
                    </div>
                )}
            </div>
        </Field>
    )
}

function SaveButton({ saving, saved, error, onClick }: { saving: boolean; saved: boolean; error: string; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={saving}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${saved ? 'bg-green-600/20 border border-green-500/30 text-green-400' :
                    error ? 'bg-red-600/20 border border-red-500/30 text-red-400' :
                        'bg-[#008751]/20 border border-[#008751]/30 text-[#008751] hover:bg-[#008751]/30'
                }`}
        >
            {saving ? <Loader2 size={16} className="animate-spin" /> :
                saved ? <CheckCircle size={16} /> :
                    error ? <AlertCircle size={16} /> :
                        <Save size={16} />}
            {saving ? 'Sauvegarde...' : saved ? 'Sauvegardé !' : error ? 'Erreur' : 'Sauvegarder'}
        </button>
    )
}

/* ═══════════════════════════════════════════════════════════════
   FORMULAIRES PAR SECTION
   ═══════════════════════════════════════════════════════════════ */

function HeroForm({ data, onChange }: { data: typeof DEFAULTS.hero; onChange: (d: typeof DEFAULTS.hero) => void }) {
    const set = (k: keyof typeof DEFAULTS.hero) => (v: string) => onChange({ ...data, [k]: v })
    return (
        <div className="space-y-5">
            <Field label="Titre : Ligne 1"><TextInput value={data.title_line1} onChange={set('title_line1')} /></Field>
            <Field label="Titre : Ligne 2 (vert)"><TextInput value={data.title_line2} onChange={set('title_line2')} /></Field>
            <Field label="Sous-titre"><TextArea value={data.subtitle} onChange={set('subtitle')} rows={3} /></Field>
            <ImageField label="Image de fond (Hero)" value={data.image} onChange={set('image')} />
        </div>
    )
}

function RencontreForm({ data, onChange }: { data: typeof DEFAULTS.rencontre; onChange: (d: typeof DEFAULTS.rencontre) => void }) {
    const set = (k: keyof typeof DEFAULTS.rencontre) => (v: string) => onChange({ ...data, [k]: v })
    return (
        <div className="space-y-5">
            <ImageField label="Image principale (Martinique)" value={data.image} onChange={set('image')} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Légende image"><TextInput value={data.image_caption_label} onChange={set('image_caption_label')} /></Field>
                <Field label="Sous-légende"><TextInput value={data.image_caption_sub} onChange={set('image_caption_sub')} /></Field>
            </div>
            <div className="border-t border-white/5 pt-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Bloc 1 : Carte principale</p>
                <Field label="Titre"><TextInput value={data.block1_heading} onChange={set('block1_heading')} /></Field>
                <div className="mt-3"><Field label="Texte"><TextArea value={data.block1_text} onChange={set('block1_text')} rows={4} /></Field></div>
            </div>
            <div className="border-t border-white/5 pt-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Bloc 2 : Citation en italique</p>
                <Field label="Citation"><TextArea value={data.block2_quote} onChange={set('block2_quote')} rows={3} /></Field>
            </div>
            <div className="border-t border-white/5 pt-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Bloc 3 : Conclusion</p>
                <Field label="Paragraphe 1"><TextArea value={data.block3_text1} onChange={set('block3_text1')} rows={3} /></Field>
                <div className="mt-3"><Field label="Paragraphe 2"><TextArea value={data.block3_text2} onChange={set('block3_text2')} rows={3} /></Field></div>
            </div>
        </div>
    )
}

function FondatriceForm({ data, onChange }: { data: typeof DEFAULTS.fondatrice; onChange: (d: typeof DEFAULTS.fondatrice) => void }) {
    const set = (k: keyof typeof DEFAULTS.fondatrice) => (v: string) => onChange({ ...data, [k]: v })
    return (
        <div className="space-y-5">
            <ImageField label="Photo de la fondatrice" value={data.photo} onChange={set('photo')} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Nom complet"><TextInput value={data.name} onChange={set('name')} /></Field>
                <Field label="Titre (ex: Fondatrice)"><TextInput value={data.title_label} onChange={set('title_label')} /></Field>
            </div>
            <Field label="Titre de la section"><TextInput value={data.section_heading} onChange={set('section_heading')} /></Field>
            <Field label="Citation (texte italique)"><TextArea value={data.quote} onChange={set('quote')} rows={5} /></Field>
            <Field label="Mot de clôture (vert)"><TextInput value={data.closing} onChange={set('closing')} /></Field>
        </div>
    )
}

function ArchitectesForm({ data, onChange }: { data: typeof DEFAULTS.architectes; onChange: (d: typeof DEFAULTS.architectes) => void }) {
    const setHeading = (v: string) => onChange({ ...data, heading: v })
    const setPortrait = (i: number, field: keyof Portrait, v: string) => {
        const portraits = [...data.portraits]
        portraits[i] = { ...portraits[i], [field]: v }
        onChange({ ...data, portraits })
    }
    const addPortrait = () => onChange({ ...data, portraits: [...data.portraits, { image: '', name: '', role: '', phrase: '' }] })
    const removePortrait = (i: number) => onChange({ ...data, portraits: data.portraits.filter((_, idx) => idx !== i) })

    return (
        <div className="space-y-5">
            <Field label="Titre de la section"><TextInput value={data.heading} onChange={setHeading} /></Field>
            <div className="border-t border-white/5 pt-4 space-y-6">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Portraits ({data.portraits.length})</p>
                {data.portraits.map((p, i) => (
                    <div key={i} className="bg-black/20 border border-white/5 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-gray-400">Portrait #{i + 1}</span>
                            <button type="button" aria-label="Supprimer ce portrait" onClick={() => removePortrait(i)} className="text-red-400/60 hover:text-red-400 transition-colors p-1">
                                <Trash2 size={14} />
                            </button>
                        </div>
                        <ImageField label="Photo" value={p.image} onChange={v => setPortrait(i, 'image', v)} />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Field label="Nom"><TextInput value={p.name} onChange={v => setPortrait(i, 'name', v)} /></Field>
                            <Field label="Rôle / Titre"><TextInput value={p.role} onChange={v => setPortrait(i, 'role', v)} /></Field>
                        </div>
                        <Field label="Phrase (doré, au survol)"><TextInput value={p.phrase} onChange={v => setPortrait(i, 'phrase', v)} /></Field>
                    </div>
                ))}
                <button type="button" onClick={addPortrait} className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-white/10 rounded-xl text-sm text-gray-500 hover:border-[#008751]/40 hover:text-[#008751] transition-all">
                    <Plus size={16} /> Ajouter un portrait
                </button>
            </div>
        </div>
    )
}

function LogoForm({ data, onChange }: { data: typeof DEFAULTS.logo; onChange: (d: typeof DEFAULTS.logo) => void }) {
    const setSymbol = (i: number, field: keyof Symbol, v: string) => {
        const symbols = [...data.symbols]
        symbols[i] = { ...symbols[i], [field]: v }
        onChange({ ...data, symbols })
    }
    const addSymbol = () => onChange({ ...data, symbols: [...data.symbols, { title: '', text: '' }] })
    const removeSymbol = (i: number) => onChange({ ...data, symbols: data.symbols.filter((_, idx) => idx !== i) })

    return (
        <div className="space-y-5">
            <Field label="Titre de la section"><TextInput value={data.heading} onChange={v => onChange({ ...data, heading: v })} /></Field>
            <ImageField label="Image du logo transparent" value={data.logo_image} onChange={v => onChange({ ...data, logo_image: v })} />
            <div className="border-t border-white/5 pt-4 space-y-5">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Significations symboliques ({data.symbols.length})</p>
                {data.symbols.map((s, i) => (
                    <div key={i} className="bg-black/20 border border-white/5 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-400">Symbole #{i + 1}</span>
                            <button type="button" aria-label="Supprimer ce symbole" onClick={() => removeSymbol(i)} className="text-red-400/60 hover:text-red-400 transition-colors p-1">
                                <Trash2 size={14} />
                            </button>
                        </div>
                        <Field label="Titre"><TextInput value={s.title} onChange={v => setSymbol(i, 'title', v)} /></Field>
                        <Field label="Description"><TextArea value={s.text} onChange={v => setSymbol(i, 'text', v)} rows={3} /></Field>
                    </div>
                ))}
                <button type="button" onClick={addSymbol} className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-white/10 rounded-xl text-sm text-gray-500 hover:border-[#008751]/40 hover:text-[#008751] transition-all">
                    <Plus size={16} /> Ajouter un symbole
                </button>
            </div>
        </div>
    )
}

function ConfianceForm({ data, onChange }: { data: typeof DEFAULTS.confiance; onChange: (d: typeof DEFAULTS.confiance) => void }) {
    const set = (k: keyof Omit<typeof DEFAULTS.confiance, 'carousel'>) => (v: string) => onChange({ ...data, [k]: v })
    const setCarousel = (i: number, v: string) => {
        const carousel = [...data.carousel]
        carousel[i] = v
        onChange({ ...data, carousel })
    }
    const addCarousel = () => onChange({ ...data, carousel: [...data.carousel, ''] })
    const removeCarousel = (i: number) => onChange({ ...data, carousel: data.carousel.filter((_, idx) => idx !== i) })

    return (
        <div className="space-y-5">
            <Field label="Titre de la section"><TextInput value={data.heading} onChange={set('heading')} /></Field>
            <Field label="Sous-titre"><TextArea value={data.subtitle} onChange={set('subtitle')} rows={2} /></Field>
            <div className="border-t border-white/5 pt-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Bloc principal (texte + image)</p>
                <ImageField label="Image principale (attestation)" value={data.main_image} onChange={set('main_image')} />
                <div className="mt-3 space-y-3">
                    <Field label="Titre accrocheur"><TextInput value={data.main_title} onChange={set('main_title')} /></Field>
                    <Field label="Paragraphe 1"><TextArea value={data.main_text1} onChange={set('main_text1')} rows={3} /></Field>
                    <Field label="Paragraphe 2"><TextArea value={data.main_text2} onChange={set('main_text2')} rows={3} /></Field>
                    <Field label="Paragraphe 3 (final, gras)"><TextArea value={data.main_text3} onChange={set('main_text3')} rows={3} /></Field>
                </div>
            </div>
            <div className="border-t border-white/5 pt-4">
                <ImageField label="Grande photo d'engagement" value={data.engagement_image} onChange={set('engagement_image')} />
            </div>
            <div className="border-t border-white/5 pt-4 space-y-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Carrousel d'images ({data.carousel.length} images)</p>
                {data.carousel.map((src, i) => (
                    <div key={i} className="flex gap-2 items-start">
                        <div className="flex-1 space-y-1.5">
                            <TextInput value={src} onChange={v => setCarousel(i, v)} placeholder={`/images/histoire/attestation-${i + 1}.jpeg`} />
                            {src && (
                                <div className="relative h-16 rounded overflow-hidden border border-white/10">
                                    <img src={src} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                                </div>
                            )}
                        </div>
                        <button type="button" aria-label="Supprimer cette image" onClick={() => removeCarousel(i)} className="mt-2 text-red-400/60 hover:text-red-400 transition-colors p-1 flex-shrink-0">
                            <Trash2 size={14} />
                        </button>
                    </div>
                ))}
                <button type="button" onClick={addCarousel} className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-white/10 rounded-xl text-sm text-gray-500 hover:border-[#008751]/40 hover:text-[#008751] transition-all">
                    <Plus size={16} /> Ajouter une image
                </button>
            </div>
        </div>
    )
}

function CTAForm({ data, onChange }: { data: typeof DEFAULTS.cta; onChange: (d: typeof DEFAULTS.cta) => void }) {
    const set = (k: keyof typeof DEFAULTS.cta) => (v: string) => onChange({ ...data, [k]: v })
    return (
        <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Titre : Ligne 1"><TextInput value={data.heading_line1} onChange={set('heading_line1')} /></Field>
                <Field label="Titre : Ligne 2 (vert)"><TextInput value={data.heading_line2} onChange={set('heading_line2')} /></Field>
            </div>
            <Field label="Sous-titre"><TextArea value={data.subtitle} onChange={set('subtitle')} rows={3} /></Field>
            <div className="border-t border-white/5 pt-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Bouton Principal (vert)</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Texte du bouton"><TextInput value={data.btn_primary_text} onChange={set('btn_primary_text')} /></Field>
                    <Field label="Lien (href)"><TextInput value={data.btn_primary_href} onChange={set('btn_primary_href')} placeholder="/rendez-vous" /></Field>
                </div>
            </div>
            <div className="border-t border-white/5 pt-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Bouton Secondaire (outline)</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Texte du bouton"><TextInput value={data.btn_secondary_text} onChange={set('btn_secondary_text')} /></Field>
                    <Field label="Lien (href)"><TextInput value={data.btn_secondary_href} onChange={set('btn_secondary_href')} placeholder="/contact" /></Field>
                </div>
            </div>
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════════
   PAGE PRINCIPALE
   ═══════════════════════════════════════════════════════════════ */

export default function AdminNotreHistoirePage() {
    const [activeTab, setActiveTab] = useState<TabKey>('hero')
    const [formData, setFormData] = useState<typeof DEFAULTS>({ ...DEFAULTS })
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(true)

    // Charger toutes les sections depuis Supabase
    const loadSections = useCallback(async () => {
        setLoading(true)
        try {
            const { data, error: dbError } = await supabase
                .from('page_sections')
                .select('section_key, content')
                .eq('page', 'notre-histoire')

            if (dbError) throw dbError

            if (data && data.length > 0) {
                const merged = { ...DEFAULTS }
                for (const row of data) {
                    const key = row.section_key as TabKey
                    if (key in merged && row.content) {
                        // Merge DB data with defaults to keep all fields
                        merged[key] = { ...merged[key], ...row.content } as never
                    }
                }
                setFormData(merged)
            }
        } catch {
            // Si la table n'existe pas encore, on garde les defaults
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { loadSections() }, [loadSections])

    // Sauvegarder la section active
    const save = async () => {
        setSaving(true)
        setError('')
        setSaved(false)
        try {
            const sectionLabels: Record<TabKey, string> = {
                hero: 'Héros : Notre Histoire',
                rencontre: 'La Rencontre : Notre Histoire',
                fondatrice: 'Fondatrice : Notre Histoire',
                architectes: 'Architectes : Notre Histoire',
                logo: 'Le Logo : Notre Histoire',
                confiance: 'Confiance : Notre Histoire',
                cta: 'CTA Final : Notre Histoire',
            }
            const sortOrders: Record<TabKey, number> = {
                hero: 1, rencontre: 2, fondatrice: 3, architectes: 4, logo: 5, confiance: 6, cta: 7
            }

            const { error: dbError } = await supabase
                .from('page_sections')
                .upsert({
                    page: 'notre-histoire',
                    section_key: activeTab,
                    title: sectionLabels[activeTab],
                    content: formData[activeTab],
                    is_active: true,
                    sort_order: sortOrders[activeTab],
                }, { onConflict: 'page,section_key' })

            if (dbError) throw dbError

            setSaved(true)
            setTimeout(() => setSaved(false), 3000)
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Erreur inconnue')
            setTimeout(() => setError(''), 5000)
        } finally {
            setSaving(false)
        }
    }

    const updateSection = <K extends TabKey>(key: K, data: typeof DEFAULTS[K]) => {
        setFormData(prev => ({ ...prev, [key]: data }))
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#FCD116]/10 via-[#0f141e] to-[#008751]/10 border border-white/10 p-6">
                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-xl font-bold text-white mb-1">Éditeur : Notre Histoire</h1>
                        <p className="text-gray-400 text-sm">7 sections éditables : modifications en temps réel sur le site</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link
                            href="/notre-histoire"
                            target="_blank"
                            className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-400 hover:text-white hover:border-white/20 transition-all"
                        >
                            <ExternalLink size={14} /> Voir la page
                        </Link>
                        <SaveButton saving={saving} saved={saved} error={error} onClick={save} />
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20 text-gray-500">
                    <Loader2 size={24} className="animate-spin mr-3" /> Chargement des données…
                </div>
            ) : (
                <div className="flex flex-col lg:flex-row gap-4">
                    {/* Sidebar tabs */}
                    <div className="lg:w-48 flex-shrink-0">
                        <div className="space-y-1">
                            {TABS.map(tab => {
                                const TabIcon = tab.icon
                                return (
                                <button
                                    type="button"
                                    key={tab.key}
                                    onClick={() => setActiveTab(tab.key)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all text-left ${activeTab === tab.key
                                            ? 'bg-[#008751]/15 border border-[#008751]/30 text-[#008751]'
                                            : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]'
                                        }`}
                                >
                                    <TabIcon size={15} className="flex-shrink-0" />
                                    <span className="truncate">{tab.label}</span>
                                    {activeTab === tab.key && <ChevronRight size={14} className="ml-auto flex-shrink-0" />}
                                </button>
                            )})}

                        </div>
                    </div>

                    {/* Formulaire actif */}
                    <div className="flex-1 min-w-0">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeTab}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2 }}
                                className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6"
                            >
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        {(() => {
                                            const tab = TABS.find(t => t.key === activeTab)!
                                            const Icon = tab.icon
                                            return <Icon size={20} className="text-[#FCD116]" />
                                        })()}
                                        <h2 className="text-base font-bold text-white">
                                            {TABS.find(t => t.key === activeTab)?.label}
                                        </h2>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <SaveButton saving={saving} saved={saved} error={error} onClick={save} />
                                    </div>
                                </div>

                                {activeTab === 'hero' && (
                                    <HeroForm data={formData.hero} onChange={d => updateSection('hero', d)} />
                                )}
                                {activeTab === 'rencontre' && (
                                    <RencontreForm data={formData.rencontre} onChange={d => updateSection('rencontre', d)} />
                                )}
                                {activeTab === 'fondatrice' && (
                                    <FondatriceForm data={formData.fondatrice} onChange={d => updateSection('fondatrice', d)} />
                                )}
                                {activeTab === 'architectes' && (
                                    <ArchitectesForm data={formData.architectes} onChange={d => updateSection('architectes', d)} />
                                )}
                                {activeTab === 'logo' && (
                                    <LogoForm data={formData.logo} onChange={d => updateSection('logo', d)} />
                                )}
                                {activeTab === 'confiance' && (
                                    <ConfianceForm data={formData.confiance} onChange={d => updateSection('confiance', d)} />
                                )}
                                {activeTab === 'cta' && (
                                    <CTAForm data={formData.cta} onChange={d => updateSection('cta', d)} />
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>
            )}
        </div>
    )
}
