import type { ReactNode } from 'react'
import { pageMeta, webPageLd, breadcrumbLd, ldJson } from '@/lib/seo'

export const metadata = pageMeta("Devenir partenaire | Retour Gagnant Bénin", "Rejoignez le réseau Retour Gagnant et touchez la diaspora béninoise : mettez en avant vos produits et services.", "/devenir-partenaire")

export default function Layout({ children }: { children: ReactNode }) {
    return (
        <>
            {children}
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson([webPageLd("Devenir partenaire", "Rejoignez le réseau Retour Gagnant et touchez la diaspora béninoise : mettez en avant vos produits et services.", "/devenir-partenaire"), breadcrumbLd([["Accueil","/"],["Devenir partenaire","/devenir-partenaire"]])]) }} />
        </>
    )
}
