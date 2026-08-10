import { Suspense } from 'react'
import { ClientReturnBanner } from '@/components/shared/ClientReturnBanner'
import { pageMeta } from '@/lib/seo'

export const metadata = pageMeta(
    'Nationalité béninoise pour la diaspora afro-descendante | Retour Gagnant',
    "Loi N° 2024-31 : obtenez la nationalité béninoise par afro-descendance. Vérifiez votre éligibilité et composez votre dossier avec nos experts.",
    '/nationalite',
)

export default function NationaliteLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            <Suspense fallback={null}>
                <ClientReturnBanner />
            </Suspense>
            {children}
        </>
    )
}
