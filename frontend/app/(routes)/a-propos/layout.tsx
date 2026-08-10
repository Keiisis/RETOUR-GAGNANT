import type { ReactNode } from 'react'
import { pageMeta, webPageLd, breadcrumbLd, ldJson } from '@/lib/seo'

export const metadata = pageMeta("À propos — Retour Gagnant Bénin", "Née de la diaspora, pour la diaspora : notre mission d'accompagnement au retour et à l'investissement au Bénin.", "/a-propos")

export default function Layout({ children }: { children: ReactNode }) {
    return (
        <>
            {children}
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson([webPageLd("À propos", "Née de la diaspora, pour la diaspora : notre mission d'accompagnement au retour et à l'investissement au Bénin.", "/a-propos"), breadcrumbLd([["Accueil","/"],["À propos","/a-propos"]])]) }} />
        </>
    )
}
