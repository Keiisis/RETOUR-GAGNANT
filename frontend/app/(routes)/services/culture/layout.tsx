import type { ReactNode } from 'react'
import { pageMeta, serviceLd, breadcrumbLd, ldJson } from '@/lib/seo'

export const metadata = pageMeta("Tourisme & immersion culturelle au Bénin | Retour Gagnant", "Séjours sur mesure, guide historien et rencontres authentiques : vivez le Bénin de l'intérieur (Ganvié, Ouidah, Abomey).", "/services/culture")

export default function Layout({ children }: { children: ReactNode }) {
    return (
        <>
            {children}
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson([serviceLd("Tourisme & Culture", "Séjours sur mesure, guide historien et rencontres authentiques : vivez le Bénin de l'intérieur (Ganvié, Ouidah, Abomey).", "/services/culture"), breadcrumbLd([["Accueil","/"],["Services","/services"],["Tourisme & Culture","/services/culture"]])]) }} />
        </>
    )
}
