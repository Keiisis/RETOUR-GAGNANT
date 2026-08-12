import type { ReactNode } from 'react'
import { pageMeta, serviceLd, breadcrumbLd, ldJson } from '@/lib/seo'

export const metadata = pageMeta("Logement au Bénin : dossier bien monté | Retour Gagnant", "Accédez aux logements du Programme national : nous montons votre dossier pour qu'il soit viable et rapidement accepté.", "/services/logement")

export default function Layout({ children }: { children: ReactNode }) {
    return (
        <>
            {children}
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson([serviceLd("Logement", "Accédez aux logements du Programme national : nous montons votre dossier pour qu'il soit viable et rapidement accepté.", "/services/logement"), breadcrumbLd([["Accueil","/"],["Services","/services"],["Logement","/services/logement"]])]) }} />
        </>
    )
}
