import type { ReactNode } from 'react'
import { pageMeta, serviceLd, breadcrumbLd, ldJson } from '@/lib/seo'

export const metadata = pageMeta("Investir au Bénin : opportunités vérifiées | Retour Gagnant", "Opportunités sérieuses, évaluation des risques et structuration légale : investissez au Bénin (immobilier, agriculture, commerce).", "/services/investissement")

export default function Layout({ children }: { children: ReactNode }) {
    return (
        <>
            {children}
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson([serviceLd("Investissement", "Opportunités sérieuses, évaluation des risques et structuration légale : investissez au Bénin (immobilier, agriculture, commerce).", "/services/investissement"), breadcrumbLd([["Accueil","/"],["Services","/services"],["Investissement","/services/investissement"]])]) }} />
        </>
    )
}
