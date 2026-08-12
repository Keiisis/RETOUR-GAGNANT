import type { ReactNode } from 'react'
import { pageMeta, serviceLd, breadcrumbLd, ldJson } from '@/lib/seo'

export const metadata = pageMeta(
    "Permis de conduire béninois pour la diaspora | Retour Gagnant",
    "Obtenez un permis de conduire béninois officiel. Vous choisissez la catégorie, nous coordonnons l'inscription, la formation en auto-école agréée et l'examen.",
    "/services/permis-conduire",
)

export default function Layout({ children }: { children: ReactNode }) {
    return (
        <>
            {children}
            <script type="application/ld+json" dangerouslySetInnerHTML={{
                __html: ldJson([
                    serviceLd("Permis de conduire béninois", "Obtenez un permis de conduire béninois officiel. Vous choisissez la catégorie, nous coordonnons l'inscription, la formation en auto-école agréée et l'examen.", "/services/permis-conduire"),
                    breadcrumbLd([["Accueil", "/"], ["Services", "/services"], ["Permis de conduire", "/services/permis-conduire"]]),
                ])
            }} />
        </>
    )
}
