import type { ReactNode } from 'react'
import { pageMeta, serviceLd, breadcrumbLd, ldJson } from '@/lib/seo'

export const metadata = pageMeta("Consultation du Fa avec un Bokonon | Retour Gagnant", "Rencontrez un prêtre du Fa reconnu, en présentiel au Bénin ou en visio : organisation complète et cadre respectueux.", "/services/consultation-fa-racines")

export default function Layout({ children }: { children: ReactNode }) {
    return (
        <>
            {children}
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson([serviceLd("Consultation Fa & Racines", "Rencontrez un prêtre du Fa reconnu, en présentiel au Bénin ou en visio : organisation complète et cadre respectueux.", "/services/consultation-fa-racines"), breadcrumbLd([["Accueil","/"],["Services","/services"],["Consultation Fa & Racines","/services/consultation-fa-racines"]])]) }} />
        </>
    )
}
