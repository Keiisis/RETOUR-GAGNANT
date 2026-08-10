import type { ReactNode } from 'react'
import { pageMeta, webPageLd, breadcrumbLd, ldJson } from '@/lib/seo'

export const metadata = pageMeta("Suivi de dossier en temps réel | Retour Gagnant", "Consultez l'avancement de votre dossier en temps réel grâce à notre système de suivi intelligent.", "/suivi-dossier")

export default function Layout({ children }: { children: ReactNode }) {
    return (
        <>
            {children}
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson([webPageLd("Suivi de dossier", "Consultez l'avancement de votre dossier en temps réel grâce à notre système de suivi intelligent.", "/suivi-dossier"), breadcrumbLd([["Accueil","/"],["Suivi de dossier","/suivi-dossier"]])]) }} />
        </>
    )
}
