'use client'

import { usePathname } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import AudioPlayer from '@/components/layout/AudioPlayer'
import ChatAssistant from '@/components/chat/ChatAssistant'
import { CartDrawer } from '@/components/boutique/CartDrawer'

export function LayoutShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()

    // Les routes /admin et /agent ont leurs propres layouts dédiés
    const isAdminRoute = pathname.startsWith('/admin')
    const isAgentRoute = pathname.startsWith('/agent')
    const isStandaloneRoute = isAdminRoute || isAgentRoute

    if (isStandaloneRoute) {
        return <>{children}</>
    }

    // Routes publiques : Header + Footer + AudioPlayer + Chat
    return (
        <>
            <Header />
            <AudioPlayer />
            <CartDrawer />
            <main className="min-h-screen pt-20">
                {children}
            </main>
            <ChatAssistant />
            <Footer />
        </>
    )
}
