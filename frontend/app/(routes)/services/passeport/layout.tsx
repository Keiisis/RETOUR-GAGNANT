import type { ReactNode } from 'react'
import { pageMeta, serviceLd, breadcrumbLd, ldJson } from '@/lib/seo'

export const metadata = pageMeta("Passeport béninois : inclus et gratuit | Retour Gagnant", "Le passeport béninois est inclus et gratuit : l'État le remet lors de la cérémonie officielle, au terme de la demande de nationalité.", "/services/passeport")

export default function Layout({ children }: { children: ReactNode }) {
    return (
        <>
            {children}
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson([serviceLd("Passeport", "Le passeport béninois est inclus et gratuit : l'État le remet lors de la cérémonie officielle, au terme de la demande de nationalité.", "/services/passeport"), breadcrumbLd([["Accueil","/"],["Services","/services"],["Passeport","/services/passeport"]])]) }} />
        </>
    )
}
