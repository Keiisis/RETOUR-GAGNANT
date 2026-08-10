import type { ReactNode } from 'react'
import { pageMeta, webPageLd, breadcrumbLd, ldJson } from '@/lib/seo'

export const metadata = pageMeta("Nos partenaires au Bénin | Retour Gagnant", "Une sélection d'entreprises et d'artisans de confiance recommandés par Retour Gagnant pour la diaspora.", "/partenaires")

export default function Layout({ children }: { children: ReactNode }) {
    return (
        <>
            {children}
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson([webPageLd("Partenaires", "Une sélection d'entreprises et d'artisans de confiance recommandés par Retour Gagnant pour la diaspora.", "/partenaires"), breadcrumbLd([["Accueil","/"],["Partenaires","/partenaires"]])]) }} />
        </>
    )
}
