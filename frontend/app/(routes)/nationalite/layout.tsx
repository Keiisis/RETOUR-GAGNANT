import { Suspense } from 'react'
import { ClientReturnBanner } from '@/components/shared/ClientReturnBanner'

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
