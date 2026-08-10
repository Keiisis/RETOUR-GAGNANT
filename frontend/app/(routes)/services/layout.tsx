import { Suspense } from 'react'
import { ClientReturnBanner } from '@/components/shared/ClientReturnBanner'
import { pageMeta } from '@/lib/seo'

// Métadonnées de la page catalogue /services (les sous-pages les remplacent
// via leur propre layout).
export const metadata = pageMeta(
    'Nos services — accompagnement diaspora au Bénin | Retour Gagnant',
    "Passeport, nationalité, logement, entreprise, investissement, culture : tous les services pour réussir votre retour au Bénin.",
    '/services',
)

export default function ServicesLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            <Suspense fallback={null}>
                <ClientReturnBanner />
            </Suspense>
            {children}
        </>
    )
}
