import type { ReactNode } from 'react'
import { pageMeta, serviceLd, breadcrumbLd, ldJson } from '@/lib/seo'

export const metadata = pageMeta("Services du quotidien au Bénin | Retour Gagnant", "Transport, santé, scolarité et démarches administratives : des solutions pour faciliter votre installation au Bénin.", "/services/autres")

export default function Layout({ children }: { children: ReactNode }) {
    return (
        <>
            {children}
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson([serviceLd("Autres Services", "Transport, santé, scolarité et démarches administratives : des solutions pour faciliter votre installation au Bénin.", "/services/autres"), breadcrumbLd([["Accueil","/"],["Services","/services"],["Autres Services","/services/autres"]])]) }} />
        </>
    )
}
