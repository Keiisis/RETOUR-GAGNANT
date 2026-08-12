import type { ReactNode } from 'react'
import { pageMeta, webPageLd, breadcrumbLd, ldJson } from '@/lib/seo'

export const metadata = pageMeta("Événements : galas, conférences, networking | Retour Gagnant", "Galas, conférences, salons et rencontres B2B : les événements de la diaspora béninoise organisés par Retour Gagnant.", "/evenements")

export default function Layout({ children }: { children: ReactNode }) {
    return (
        <>
            {children}
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson([webPageLd("Événements", "Galas, conférences, salons et rencontres B2B : les événements de la diaspora béninoise organisés par Retour Gagnant.", "/evenements"), breadcrumbLd([["Accueil","/"],["Événements","/evenements"]])]) }} />
        </>
    )
}
