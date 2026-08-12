import type { ReactNode } from 'react'
import { pageMeta, webPageLd, breadcrumbLd, ldJson } from '@/lib/seo'

export const metadata = pageMeta("Blog : guides pour réussir son retour au Bénin | Retour Gagnant", "Guides, conseils et actualités : passeport, immobilier, entreprise, investissement et culture pour la diaspora béninoise.", "/blog")

export default function Layout({ children }: { children: ReactNode }) {
    return (
        <>
            {children}
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson([webPageLd("Blog", "Guides, conseils et actualités : passeport, immobilier, entreprise, investissement et culture pour la diaspora béninoise.", "/blog"), breadcrumbLd([["Accueil","/"],["Blog","/blog"]])]) }} />
        </>
    )
}
