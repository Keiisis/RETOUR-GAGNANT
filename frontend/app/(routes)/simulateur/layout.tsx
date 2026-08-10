import type { ReactNode } from 'react'
import { pageMeta, webPageLd, breadcrumbLd, ldJson } from '@/lib/seo'

export const metadata = pageMeta("Simulateur — trouvez votre service | Retour Gagnant", "En 5 questions, découvrez le service Retour Gagnant fait pour votre projet de retour au Bénin.", "/simulateur")

export default function Layout({ children }: { children: ReactNode }) {
    return (
        <>
            {children}
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson([webPageLd("Simulateur", "En 5 questions, découvrez le service Retour Gagnant fait pour votre projet de retour au Bénin.", "/simulateur"), breadcrumbLd([["Accueil","/"],["Simulateur","/simulateur"]])]) }} />
        </>
    )
}
