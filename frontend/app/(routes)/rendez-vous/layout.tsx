import type { ReactNode } from 'react'
import { pageMeta, webPageLd, breadcrumbLd, ldJson } from '@/lib/seo'

export const metadata = pageMeta("Prendre rendez-vous — consultation gratuite | Retour Gagnant", "Planifiez une consultation gratuite avec nos experts : premier appel de 15 min offert, réponse sous 24 h. Présentiel ou à distance.", "/rendez-vous")

export default function Layout({ children }: { children: ReactNode }) {
    return (
        <>
            {children}
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson([webPageLd("Rendez-vous", "Planifiez une consultation gratuite avec nos experts : premier appel de 15 min offert, réponse sous 24 h. Présentiel ou à distance.", "/rendez-vous"), breadcrumbLd([["Accueil","/"],["Rendez-vous","/rendez-vous"]])]) }} />
        </>
    )
}
