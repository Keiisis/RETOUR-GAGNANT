'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    BookOpen, Search, ChevronRight, FileText, Globe,
    Building2, Landmark, Users, Scale, Banknote
} from 'lucide-react'

interface WikiArticle {
    id: string
    category: string
    title: string
    content: string
    tags: string[]
}

const categories = [
    { name: 'Nationalité', icon: Globe, color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    { name: 'Immobilier', icon: Building2, color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    { name: 'Business', icon: Banknote, color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    { name: 'Juridique', icon: Scale, color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
    { name: 'Démarches Admin', icon: Landmark, color: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
    { name: 'Contacts Utiles', icon: Users, color: 'bg-teal-500/10 text-teal-400 border-teal-500/20' },
]

const wikiArticles: WikiArticle[] = [
    {
        id: '1',
        category: 'Nationalité',
        title: 'Procédure de Demande de Nationalité Béninoise',
        content: `## Conditions requises\n\n1. **Être majeur(e)** au moment de la demande\n2. **Prouver un lien avec le Bénin** (ascendance, résidence, mariage)\n3. **Casier judiciaire vierge** (du pays de résidence actuel)\n4. **Résider au Bénin** depuis au moins 5 ans (ou 3 ans si marié(e) à un(e) Béninois(e))\n\n## Documents nécessaires\n\n- Acte de naissance original + copie certifiée\n- Passeport valide\n- Certificat de résidence\n- Casier judiciaire de moins de 3 mois\n- 4 photos d'identité\n- Acte de mariage (si applicable)\n- Preuve d'emploi ou de moyens de subsistance\n\n## Délais\n\nLe traitement prend entre **6 et 18 mois** selon le dossier.\n\n## Coût\n\nTimbre fiscal : **50 000 XOF**\nFrais de dossier : Variable`,
        tags: ['nationalité', 'documents', 'procédure'],
    },
    {
        id: '2',
        category: 'Immobilier',
        title: 'Guide d\'Achat Immobilier au Bénin',
        content: `## Étapes clés\n\n1. **Identification du bien** — Visite terrain avec un agent agréé\n2. **Vérification foncière** — Vérifier le titre foncier auprès du cadastre\n3. **Négociation** — Via un intermédiaire de confiance\n4. **Compromis de vente** — Devant notaire\n5. **Paiement** — Via compte séquestre notarial\n6. **Acte de vente définitif** — Enregistrement au cadastre\n\n## Points d'attention\n\n⚠️ Toujours exiger un **Titre Foncier** (TF) et non un simple \"Permis d'Habiter\"\n⚠️ Ne jamais payer en espèces sans reçu notarié\n⚠️ Vérifier l'absence de litiges en cours\n\n## Zones d'investissement recommandées\n\n- **Cotonou** : Fidjrossè, Akpakpa\n- **Abomey-Calavi** : Zone universitaire\n- **Ouidah** : Zone touristique en développement`,
        tags: ['immobilier', 'achat', 'terrain'],
    },
    {
        id: '3',
        category: 'Business',
        title: 'Créer une Entreprise au Bénin (SARL)',
        content: `## Procédure simplifiée\n\n1. **Choix du nom** — Vérification de disponibilité au RCCM\n2. **Rédaction des statuts** — Par un notaire\n3. **Dépôt du capital social** — Minimum 100 000 XOF\n4. **Immatriculation au RCCM** — Centre de formalités\n5. **Obtention du NIF** — Numéro d'Identification Fiscale\n\n## Délai\n\n**72 heures** via le guichet unique de l'APIEX (Agence de Promotion des Investissements)\n\n## Coût approximatif\n\n- Frais notaire : 150 000 - 300 000 XOF\n- Immatriculation : 30 000 XOF\n- Capital minimum : 100 000 XOF`,
        tags: ['business', 'sarl', 'création'],
    },
    {
        id: '4',
        category: 'Contacts Utiles',
        title: 'Répertoire des Partenaires',
        content: `## Notaires partenaires\n\n- **Me. Adjakou** — Cotonou Centre — +229 XX XX XX XX\n- **Me. Hounnou** — Abomey-Calavi — +229 XX XX XX XX\n\n## Transport VTC\n\n- **Service Premium RGB** — Transfert aéroport + visites\n\n## Hôtels Partenaires\n\n- **Bénin Royal Hôtel** — Cotonou (4★)\n- **Casa del Papa** — Ouidah (3★)\n\n## Administrations\n\n- **APIEX** — Agence de Promotion des Investissements\n- **Cadastre** — Direction du Domaine et du Cadastre\n- **Mairie de Cotonou** — Services d'état civil`,
        tags: ['contacts', 'partenaires', 'notaire'],
    },
]

export default function AgentWikiPage() {
    const [search, setSearch] = useState('')
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
    const [selectedArticle, setSelectedArticle] = useState<WikiArticle | null>(null)

    const filtered = wikiArticles.filter(a => {
        const matchSearch = a.title.toLowerCase().includes(search.toLowerCase()) ||
            a.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
        const matchCat = selectedCategory ? a.category === selectedCategory : true
        return matchSearch && matchCat
    })

    return (
        <div className="space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <BookOpen size={16} className="text-emerald-400" />
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.3em]">Knowledge Base</span>
                    </div>
                    <h1 className="text-2xl font-black text-white">Base de Connaissance</h1>
                    <p className="text-gray-500 text-sm mt-1">Procédures, législation et contacts utiles</p>
                </div>
                <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Rechercher un article..."
                        title="Rechercher dans la base de connaissance"
                        className="bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 text-sm w-64"
                    />
                </div>
            </div>

            {/* Categories */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
                {categories.map((cat) => (
                    <button
                        key={cat.name}
                        onClick={() => setSelectedCategory(selectedCategory === cat.name ? null : cat.name)}
                        className={`p-3 rounded-xl border text-left transition-all hover:scale-[1.02] ${selectedCategory === cat.name
                                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                                : cat.color
                            }`}
                    >
                        <cat.icon size={18} className="mb-2" />
                        <p className="text-xs font-bold">{cat.name}</p>
                    </button>
                ))}
            </div>

            {/* Articles List or Detail */}
            <AnimatePresence mode="wait">
                {selectedArticle ? (
                    <motion.div
                        key="article-detail"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="bg-white/[0.03] border border-white/5 rounded-2xl p-6"
                    >
                        <button
                            onClick={() => setSelectedArticle(null)}
                            className="text-xs text-emerald-400 hover:text-emerald-300 font-bold mb-4 flex items-center gap-1"
                        >
                            ← Retour aux articles
                        </button>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">{selectedArticle.category}</span>
                        </div>
                        <h2 className="text-xl font-black text-white mb-4">{selectedArticle.title}</h2>
                        <div className="prose prose-invert prose-sm max-w-none">
                            {selectedArticle.content.split('\n').map((line, i) => {
                                if (line.startsWith('## ')) return <h3 key={i} className="text-emerald-400 font-bold text-sm mt-4 mb-2">{line.replace('## ', '')}</h3>
                                if (line.startsWith('- ')) return <li key={i} className="text-gray-300 text-sm ml-4">{line.replace('- ', '')}</li>
                                if (line.startsWith('⚠️')) return <p key={i} className="text-amber-400 text-sm bg-amber-500/10 p-2 rounded-lg my-1">{line}</p>
                                if (line.trim() === '') return <br key={i} />
                                return <p key={i} className="text-gray-300 text-sm">{line}</p>
                            })}
                        </div>
                        <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t border-white/5">
                            {selectedArticle.tags.map(t => (
                                <span key={t} className="text-[9px] font-bold bg-white/5 text-gray-400 px-2 py-1 rounded-full">#{t}</span>
                            ))}
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="articles-list"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="bg-white/[0.03] border border-white/5 rounded-2xl overflow-hidden"
                    >
                        <div className="divide-y divide-white/5">
                            {filtered.length === 0 ? (
                                <div className="p-12 text-center text-gray-500 text-sm">Aucun article trouvé</div>
                            ) : (
                                filtered.map((article) => (
                                    <div
                                        key={article.id}
                                        onClick={() => setSelectedArticle(article)}
                                        className="p-4 hover:bg-white/[0.02] transition-all cursor-pointer flex items-center justify-between group"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                                                <FileText size={18} className="text-emerald-400" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-white">{article.title}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[9px] font-bold bg-white/5 text-gray-500 px-2 py-0.5 rounded-full">{article.category}</span>
                                                    {article.tags.slice(0, 2).map(t => (
                                                        <span key={t} className="text-[9px] text-gray-600">#{t}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                        <ChevronRight size={16} className="text-gray-600 group-hover:text-emerald-400 transition-colors" />
                                    </div>
                                ))
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
