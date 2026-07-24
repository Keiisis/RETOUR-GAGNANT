'use client'

import { usePathname } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import AudioPlayer from '@/components/layout/AudioPlayer'
import ChatAssistant from '@/components/chat/ChatAssistant'
import CookieConsent from '@/components/layout/CookieConsent'
import WhatsAppButton from '@/components/layout/WhatsAppButton'
import Breadcrumbs from '@/components/layout/Breadcrumbs'
import { CartDrawer } from '@/components/boutique/CartDrawer'
import { VisitorTracker } from '@/components/analytics/VisitorTracker'

export function LayoutShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()

    // Les routes /admin, /agent, /client ont leurs propres layouts dédiés
    const isAdminRoute = pathname.startsWith('/admin')
    const isAgentRoute = pathname.startsWith('/agent')
    const isClientRoute = pathname.startsWith('/client')
    const isPortfolioRoute = pathname.startsWith('/portfolio')
    const isStandaloneRoute = isAdminRoute || isAgentRoute || isClientRoute || isPortfolioRoute

    if (isStandaloneRoute) {
        return <>{children}</>
    }

    // Routes publiques : Header + Footer + AudioPlayer + Chat + WhatsApp + Cookies
    return (
        <>
            <VisitorTracker />
            <Header />
            <AudioPlayer />
            <CartDrawer />
            <main className="min-h-screen pt-20">
                <Breadcrumbs />
                {children}
            </main>
            <ChatAssistant />
            <WhatsAppButton />
            <CookieConsent />
            <Footer />
        </>
    )
}

