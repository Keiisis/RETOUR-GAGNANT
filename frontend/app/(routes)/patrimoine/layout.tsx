import type { ReactNode } from 'react'
import { pageMeta, webPageLd, breadcrumbLd, ldJson } from '@/lib/seo'

export const metadata = pageMeta("Patrimoine & culture du Bénin | Retour Gagnant", "Porte du Non-Retour, palais d'Abomey, Ganvié : plongez dans l'histoire et les traditions qui font la fierté du Bénin.", "/patrimoine")

export default function Layout({ children }: { children: ReactNode }) {
    return (
        <>
            {children}
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson([webPageLd("Patrimoine", "Porte du Non-Retour, palais d'Abomey, Ganvié : plongez dans l'histoire et les traditions qui font la fierté du Bénin.", "/patrimoine"), breadcrumbLd([["Accueil","/"],["Patrimoine","/patrimoine"]])]) }} />
        </>
    )
}
