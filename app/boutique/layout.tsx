'use client'

import Script from 'next/script'
import { CartDrawer } from '@/components/boutique/CartDrawer'
import { CartFloatingButton } from '@/components/boutique/CartFloatingButton'
import { MaintenanceGuard } from '@/components/boutique/MaintenanceGuard'

export default function BoutiqueLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <>
            {/* Kkiapay Widget SDK */}
            <Script
                src="https://cdn.kkiapay.me/k.js"
                strategy="lazyOnload"
            />

            {/* FedaPay Checkout.js SDK */}
            <Script
                src="https://cdn.fedapay.com/checkout.js?v=1.1.7"
                strategy="lazyOnload"
            />

            {/* Stripe.js SDK — chargé globalement pour PaymentModal et CartCheckoutModal */}
            <Script
                src="https://js.stripe.com/v3/"
                strategy="lazyOnload"
            />

            <MaintenanceGuard>
                {children}
            </MaintenanceGuard>

            {/* Cart UI */}
            <CartDrawer />
            <CartFloatingButton />
        </>
    )
}
