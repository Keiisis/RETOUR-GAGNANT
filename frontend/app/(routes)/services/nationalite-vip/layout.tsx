import type { ReactNode } from 'react'
import { pageMeta, serviceLd, breadcrumbLd, ldJson } from '@/lib/seo'

export const metadata = pageMeta("Nationalité béninoise VIP (afro-descendants) | Retour Gagnant", "Accompagnement VIP pour l'obtention de la nationalité béninoise : dossier complet, suivi prioritaire et pièces généalogiques, de A à Z.", "/services/nationalite-vip")

export default function Layout({ children }: { children: ReactNode }) {
    return (
        <>
            {children}
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson([serviceLd("Nationalité VIP", "Accompagnement VIP pour l'obtention de la nationalité béninoise : dossier complet, suivi prioritaire et pièces généalogiques, de A à Z.", "/services/nationalite-vip"), breadcrumbLd([["Accueil","/"],["Services","/services"],["Nationalité VIP","/services/nationalite-vip"]])]) }} />
        </>
    )
}
