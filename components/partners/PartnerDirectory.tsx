'use client'

import { useState, useEffect } from 'react'
import PartnerCard, { Partner } from './PartnerCard'
import { Button } from '@/components/ui/button'
import { Search, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'

const FALLBACK_PARTNERS: Partner[] = [
    { id: 1, name: 'Immo Bénin Prestige', description: 'Agence immobilière de luxe spécialisée dans les villas et appartements meublés à Cotonou et Ouidah.', logo: '', coverImage: '', category: 'Immobilier', location: 'Cotonou, Haie Vive', isPremium: true, products: [] },
    { id: 2, name: 'Saveurs du Terroir', description: 'Exportation de produits agroalimentaires béninois bio.', logo: '', coverImage: '', category: 'Agro-Business', location: 'Abomey-Calavi', products: [] },
    { id: 3, name: 'Art & Racines', description: 'Galerie d\'art proposant des sculptures et toiles d\'artistes béninois.', logo: '', coverImage: '', category: 'Art & Culture', location: 'Ouidah', isPremium: true, products: [] },
    { id: 4, name: 'Tech Hub Cotonou', description: 'Espace de coworking et incubateur pour startups numériques.', logo: '', coverImage: '', category: 'Services & Tech', location: 'Cotonou, Ganhi', products: [] },
]

const CATEGORIES = ['Tous', 'Immobilier', 'Agro-Business', 'Art & Culture', 'Services & Tech', 'Mode & Beauté']

export default function PartnerDirectory() {
    const [partners, setPartners] = useState<Partner[]>(FALLBACK_PARTNERS)
    const [selectedCategory, setSelectedCategory] = useState('Tous')
    const [searchQuery, setSearchQuery] = useState('')
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchPartners = async () => {
            try {
                const { data, error } = await supabase
                    .from('partners')
                    .select('*')
                    .eq('is_active', true)
                    .order('sort_order', { ascending: true })

                if (!error && data && data.length > 0) {
                    setPartners(data.map((p: Record<string, unknown>) => ({
                        id: Number(p.id) || 0,
                        name: String(p.name || ''),
                        description: String(p.description || ''),
                        logo: p.logo ? String(p.logo) : '',
                        coverImage: p.cover_image ? String(p.cover_image) : '',
                        category: String(p.category || ''),
                        location: String(p.location || ''),
                        isPremium: Boolean(p.is_premium),
                        products: Array.isArray(p.products) ? p.products : [],
                    })))
                }
            } catch {
                console.warn('Using fallback partners data.')
            } finally {
                setLoading(false)
            }
        }
        fetchPartners()
    }, [])

    const filteredPartners = partners.filter(partner => {
        const matchesCategory = selectedCategory === 'Tous' || partner.category === selectedCategory
        const matchesSearch = partner.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            partner.description.toLowerCase().includes(searchQuery.toLowerCase())
        return matchesCategory && matchesSearch
    })

    return (
        <section className="py-12 bg-gray-50 min-h-screen">
            <div className="container mx-auto px-4">
                <div className="flex flex-col md:flex-row gap-6 justify-between items-center mb-12">
                    <div className="flex gap-2 overflow-x-auto pb-2 w-full md:w-auto no-scrollbar mask-gradient-right">
                        {CATEGORIES.map(cat => (
                            <Button
                                key={cat}
                                variant={selectedCategory === cat ? 'default' : 'outline'}
                                onClick={() => setSelectedCategory(cat)}
                                className={`rounded-full whitespace-nowrap ${selectedCategory === cat ? 'bg-[#008751] hover:bg-[#006e42]' : 'border-gray-200 text-gray-600'}`}
                            >
                                {cat}
                            </Button>
                        ))}
                    </div>
                    <div className="relative w-full md:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <Input
                            placeholder="Rechercher un partenaire..."
                            className="pl-10 bg-white border-gray-200 rounded-full"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="w-8 h-8 animate-spin text-[#008751]" />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredPartners.map(partner => (
                            <PartnerCard key={partner.id} partner={partner} />
                        ))}
                    </div>
                )}

                {!loading && filteredPartners.length === 0 && (
                    <div className="text-center py-20 opacity-50">
                        <p className="text-xl font-medium">Aucun partenaire trouvé pour cette recherche.</p>
                        <Button variant="link" onClick={() => { setSelectedCategory('Tous'); setSearchQuery('') }}>
                            Réinitialiser les filtres
                        </Button>
                    </div>
                )}
            </div>
        </section>
    )
}
