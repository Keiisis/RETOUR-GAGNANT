import type { ReactNode } from 'react'
import { pageMeta, webPageLd, breadcrumbLd, ldJson } from '@/lib/seo'

export const metadata = pageMeta("Contact : Retour Gagnant Bénin", "Une question, un projet ? Contactez notre équipe : formulaire, WhatsApp et bureaux à Cotonou. Réponse sous 24 h.", "/contact")

export default function Layout({ children }: { children: ReactNode }) {
    return (
        <>
            {children}
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson([webPageLd("Contact", "Une question, un projet ? Contactez notre équipe : formulaire, WhatsApp et bureaux à Cotonou. Réponse sous 24 h.", "/contact"), breadcrumbLd([["Accueil","/"],["Contact","/contact"]])]) }} />
        </>
    )
}
