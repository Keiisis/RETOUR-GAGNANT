import type { ReactNode } from 'react'
import { pageMeta, serviceLd, breadcrumbLd, ldJson } from '@/lib/seo'

export const metadata = pageMeta("Apprendre le fon, yoruba, goun, mina | Retour Gagnant", "Cours avec des locuteurs natifs, en présentiel au Bénin ou en visio : renouez avec la langue de vos ancêtres.", "/services/langues-racines")

export default function Layout({ children }: { children: ReactNode }) {
    return (
        <>
            {children}
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson([serviceLd("Langues & Racines", "Cours avec des locuteurs natifs, en présentiel au Bénin ou en visio : renouez avec la langue de vos ancêtres.", "/services/langues-racines"), breadcrumbLd([["Accueil","/"],["Services","/services"],["Langues & Racines","/services/langues-racines"]])]) }} />
        </>
    )
}
