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
            {/* A11y : lien d'évitement (visible au focus clavier) */}
            <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[10000] focus:px-4 focus:py-2 focus:rounded-xl focus:bg-[#008751] focus:text-white focus:font-bold focus:shadow-lg">
                Aller au contenu
            </a>
            <VisitorTracker />
            <Header />
            <AudioPlayer />
            <CartDrawer />
            <main id="contenu" tabIndex={-1} className="min-h-screen pt-20 outline-none">
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

