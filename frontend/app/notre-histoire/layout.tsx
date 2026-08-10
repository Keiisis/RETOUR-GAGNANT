import type { ReactNode } from 'react'
import { pageMeta, webPageLd, breadcrumbLd, ldJson } from '@/lib/seo'

export const metadata = pageMeta("Notre histoire | Retour Gagnant Bénin", "L'histoire de Retour Gagnant : née de la diaspora béninoise pour transformer le rêve du retour en réalité concrète.", "/notre-histoire")

export default function Layout({ children }: { children: ReactNode }) {
    return (
        <>
            {children}
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson([webPageLd("Notre histoire", "L'histoire de Retour Gagnant : née de la diaspora béninoise pour transformer le rêve du retour en réalité concrète.", "/notre-histoire"), breadcrumbLd([["Accueil","/"],["Notre histoire","/notre-histoire"]])]) }} />
        </>
    )
}
