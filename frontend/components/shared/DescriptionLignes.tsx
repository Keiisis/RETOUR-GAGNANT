'use client'

// Affichage d'une description de ligne de devis / facture : un élément seul
// en texte simple, plusieurs éléments en liste à tirets (cf. lib/description-lignes).
import { elementsDescription } from '@/lib/description-lignes'

export default function DescriptionLignes({ texte, className = '' }: { texte: string | null | undefined; className?: string }) {
    const elements = elementsDescription(texte)
    if (elements.length <= 1) return <span className={className}>{elements[0] ?? '...'}</span>
    return (
        <ul className={`space-y-0.5 ${className}`}>
            {elements.map((e, i) => (
                <li key={i} className="flex gap-1.5">
                    <span aria-hidden="true" className="shrink-0">–</span>
                    <span>{e}</span>
                </li>
            ))}
        </ul>
    )
}
