"use client"

import { GoldenIcon } from "@/components/ui/GoldenIcon"
import { Button } from "@/components/ui/button"
import { ArrowRight, Loader2 } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { useEffect, useState } from "react"
import { LucideIcon } from "lucide-react"
import { useTranslation, T } from "@/lib/translation"

type GoldenIconType = "passport" | "tata" | "drum" | "cowrie" | "assin" | "tree" | "recade" | "standard"

interface ServiceItem {
    id: string | number
    title: string
    description: string
    icon?: LucideIcon
    iconType?: GoldenIconType
    slug: string
    imageUrl: string
}

// Fallback images par slug (si la DB n'a pas d'image)
const IMG_BY_SLUG: Record<string, string> = {
    passeport: '/assets/icones/icone_Passeport_Documents.png',
    logement: '/assets/icones/icone_Acheter_ou_louer.png',
    business: '/assets/icones/icone_Creation_d_Entreprise.png',
    culture: '/assets/icones/icone_Guide_culturel.png',
    construction: '/assets/icones/icone_Construction.png',
    investissement: '/assets/icones/icone_Investissement.png',
    'nationalite-vip': '/assets/icones/Nationalité Béninoise VIP.png',
    'recherche-ancestrale': '/assets/icones/Recherche Ancestrale.png',
    'consultation-fa-racines': '/assets/icones/icone_Consultation_Fa_Racines.png',
    'langues-racines': '/assets/icones/icone_Langues_Racines.png',
    autres: '/assets/icones/Autres Services.png',
}

// Contenu de référence affiché si la DB est inaccessible ou vide
const FALLBACK_SERVICES: ServiceItem[] = [
    {
        id: 'f-1', slug: 'passeport', iconType: 'passport',
        title: 'Passeport & Documents',
        description: 'Obtention et renouvellement de passeport, acte de naissance, légalisation et apostille — accompagnement complet pour vos démarches officielles.',
        imageUrl: '/assets/icones/icone_Passeport_Documents.png',
    },
    {
        id: 'f-2', slug: 'logement', iconType: 'tata',
        title: 'Acheter ou Louer',
        description: 'Acquisition immobilière, location longue durée, sécurisation foncière et vérification juridique de vos biens au Bénin.',
        imageUrl: '/assets/icones/icone_Acheter_ou_louer.png',
    },
    {
        id: 'f-3', slug: 'business', iconType: 'cowrie',
        title: "Création d'Entreprise",
        description: "Immatriculation RCCM, ouverture de compte professionnel, conseils fiscaux et accompagnement des formalités de création.",
        imageUrl: '/assets/icones/icone_Creation_d_Entreprise.png',
    },
    {
        id: 'f-4', slug: 'culture', iconType: 'drum',
        title: 'Tourisme & Culture',
        description: 'Circuits touristiques, visites patrimoniales, organisation de séjours et découverte du Bénin authentique.',
        imageUrl: '/assets/icones/icone_Guide_culturel.png',
    },
    {
        id: 'f-5', slug: 'construction', iconType: 'assin',
        title: 'Suivi de Chantier',
        description: "Maîtrise d'ouvrage déléguée, contrôle des travaux et coordination des entreprises locales pour votre construction.",
        imageUrl: '/assets/icones/icone_Construction.png',
    },
    {
        id: 'f-6', slug: 'investissement', iconType: 'tree',
        title: 'Investissement',
        description: "Identification d'opportunités d'affaires, partenariats locaux et accompagnement stratégique pour vos projets d'investissement au Bénin.",
        imageUrl: '/assets/icones/icone_Investissement.png',
    },
    {
        id: 'f-7', slug: 'nationalite-vip', iconType: 'recade',
        title: 'Nationalité VIP',
        description: "Accompagnement personnalisé pour l'obtention de la nationalité béninoise — dossier complet, suivi administratif et prise en charge prioritaire.",
        imageUrl: '/assets/icones/Nationalité Béninoise VIP.png',
    },
    {
        id: 'f-7b', slug: 'recherche-ancestrale', iconType: 'cowrie',
        title: 'Recherche Ancestrale',
        description: "Retrouvez la trace de vos ancêtres réduits en esclavage — archives, bases de données spécialisées et accompagnement généalogique pour reconstituer votre lignée africaine.",
        imageUrl: '/assets/icones/Recherche Ancestrale.png',
    },
    {
        id: 'f-7c', slug: 'consultation-fa-racines', iconType: 'cowrie',
        title: 'Consultation Fa & Racines',
        description: "Mise en relation avec un Bokonon (prêtre Fa) pour une consultation traditionnelle — en présentiel au Bénin ou à distance en visioconférence, dans un cadre organisé et respectueux.",
        imageUrl: '/assets/icones/icone_Consultation_Fa_Racines.png',
    },
    {
        id: 'f-7d', slug: 'langues-racines', iconType: 'drum',
        title: 'Langues & Racines',
        description: "Apprenez les langues de vos ancêtres — fon, yoruba, goun, mina — avec des locuteurs natifs, en présentiel ou en visio. La langue est la première porte du retour aux racines.",
        imageUrl: '/assets/icones/icone_Langues_Racines.png',
    },
    {
        id: 'f-8', slug: 'autres', iconType: 'standard',
        title: 'Autres Services',
        description: 'Transport, santé, scolarité et démarches administratives — des solutions complémentaires pour faciliter votre installation au Bénin.',
        imageUrl: '/assets/icones/Autres Services.png',
    },
]

export default function ServicesGrid() {
    const { t } = useTranslation()
    const [servicesList, setServicesList] = useState<ServiceItem[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchServices = async () => {
            try {
                // Appel via l'API serveur (service role key) — contourne le RLS Supabase
                const res = await fetch('/api/services')
                const json = await res.json()

                if (json.services && json.services.length > 0) {
                    const mappedServices: ServiceItem[] = json.services.map((item: Record<string, unknown>) => {
                        const slug = (item.slug as string) || String(item.title).toLowerCase().replace(/\s+/g, '-')
                        return {
                            id: item.id,
                            title: item.title as string,
                            description: (item.description as string) || 'Découvrez ce service',
                            iconType: ((item.icon_type as string) || 'standard') as GoldenIconType,
                            slug,
                            imageUrl: (item.image_url as string) || IMG_BY_SLUG[slug] || '',
                        }
                    })
                    setServicesList(mappedServices)
                } else {
                    // API retourne vide : afficher le contenu de référence
                    setServicesList(FALLBACK_SERVICES)
                }
            } catch (err) {
                console.warn('ServicesGrid: Erreur API, affichage du contenu par défaut.', err)
                setServicesList(FALLBACK_SERVICES)
            } finally {
                setLoading(false)
            }
        }

        fetchServices()
    }, [])

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <Loader2 className="animate-spin text-[#008751]" size={36} />
            </div>
        )
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {servicesList.map((service: ServiceItem) => (
                <div
                    key={service.id}
                    className="group relative glass-card-premium hover:border-[#FCD116] rounded-2xl p-8 transition-all duration-500 hover:-translate-y-2 hover:shadow-flag bg-white"
                >
                    <div className="absolute top-0 right-0 p-4 opacity-50 group-hover:opacity-100 transition-opacity">
                        <ArrowRight className="text-[#008751] w-6 h-6 -rotate-45 group-hover:rotate-0 transition-transform duration-500" />
                    </div>

                    <div className="mb-6 flex justify-center md:justify-start">
                        {service.imageUrl ? (
                            <div className="w-24 h-24 flex items-center justify-center relative">
                                <Image
                                    src={service.imageUrl}
                                    alt={t(service.title)}
                                    fill
                                    className="object-contain bg-transparent group-hover:scale-110 group-hover:-translate-y-2 group-hover:drop-shadow-[0_12px_25px_rgba(252,209,22,0.4)] drop-shadow-[0_8px_20px_rgba(0,0,0,0.15)] transition-all duration-500"
                                    sizes="96px"
                                />
                            </div>
                        ) : (
                            <GoldenIcon
                                icon={service.icon}
                                type={service.iconType}
                                className="group-hover:scale-110 group-hover:-translate-y-2 transition-all duration-500"
                            />
                        )}
                    </div>

                    <h3 className="text-xl font-bold font-heading text-[#1a2332] mb-3 group-hover:text-[#008751] transition-colors">
                        {t(service.title)}
                    </h3>

                    <p className="text-gray-600 font-medium mb-6 line-clamp-3">
                        {t(service.description)}
                    </p>

                    <Link href={`/services/${service.slug}`} className="block w-full">
                        <Button variant="outline" className="w-full border-[#008751]/20 text-[#008751] hover:bg-[#008751] hover:text-white transition-colors rounded-xl font-semibold">
                            <T>En savoir plus</T>
                        </Button>
                    </Link>
                </div>
            ))}
        </div>
    )
}
