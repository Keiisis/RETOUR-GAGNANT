'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, Home } from 'lucide-react'

const ROUTE_LABELS: Record<string, string> = {
    'services': 'Services',
    'a-propos': 'À Propos',
    'contact': 'Contact',
    'blog': 'Blog',
    'rendez-vous': 'Rendez-vous',
    'faq': 'FAQ',
    'mentions-legales': 'Mentions Légales',
    'confidentialite': 'Confidentialité',
    'conditions-generales': 'CGV',
    'evenements': 'Événements',
    'simulateur': 'Simulateur',
    'boutique': 'Boutique',
    'nationalite': 'Nationalité',
    'suivi-dossier': 'Suivi Dossier',
    'partenaires': 'Partenaires',
    'patrimoine': 'Patrimoine',
    'mon-compte': 'Mon Compte',
    'devenir-partenaire': 'Devenir Partenaire',
    'merci': 'Merci',
    'notre-histoire': 'Notre Histoire',
}

export default function Breadcrumbs() {
    const pathname = usePathname()

    // Don't show on homepage or admin routes
    if (pathname === '/' || pathname.startsWith('/admin') || pathname.startsWith('/agent') || pathname.startsWith('/client') || pathname.startsWith('/ceo')) {
        return null
    }

    const segments = pathname.split('/').filter(Boolean)
    if (segments.length === 0) return null

    return (
        <nav
            aria-label="Fil d'Ariane"
            className="container mx-auto px-4 py-3"
        >
            <ol className="flex items-center gap-1.5 text-xs text-gray-500 flex-wrap" itemScope itemType="https://schema.org/BreadcrumbList">
                <li className="flex items-center gap-1.5" itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
                    <Link href="/" className="hover:text-[#008751] transition-colors flex items-center gap-1" itemProp="item">
                        <Home size={12} />
                        <span itemProp="name">Accueil</span>
                    </Link>
                    <meta itemProp="position" content="1" />
                </li>

                {segments.map((segment, index) => {
                    const path = '/' + segments.slice(0, index + 1).join('/')
                    const isLast = index === segments.length - 1
                    const label = ROUTE_LABELS[segment] || decodeURIComponent(segment).replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())

                    return (
                        <li
                            key={path}
                            className="flex items-center gap-1.5"
                            itemProp="itemListElement"
                            itemScope
                            itemType="https://schema.org/ListItem"
                        >
                            <ChevronRight size={10} className="text-gray-300" />
                            {isLast ? (
                                <span className="font-semibold text-gray-800 truncate max-w-[200px]" itemProp="name">
                                    {label}
                                </span>
                            ) : (
                                <Link href={path} className="hover:text-[#008751] transition-colors truncate max-w-[200px]" itemProp="item">
                                    <span itemProp="name">{label}</span>
                                </Link>
                            )}
                            <meta itemProp="position" content={String(index + 2)} />
                        </li>
                    )
                })}
            </ol>
        </nav>
    )
}
