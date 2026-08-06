'use client'

import { useSearchParams } from 'next/navigation'
import { ArrowLeft } from '@phosphor-icons/react';
import Link from 'next/link'

/**
 * Bannière sticky "Retour à l'espace client".
 * S'affiche uniquement si le paramètre ?back=/client/* est présent dans l'URL.
 * À inclure dans un <Suspense fallback={null}> au niveau du layout parent.
 */
export function ClientReturnBanner() {
    const searchParams = useSearchParams()
    const back = searchParams?.get('back')

    // Sécurité : uniquement les chemins /client/*
    if (!back || !/^\/client\//.test(back)) return null

    return (
        <div className="sticky top-0 z-[200] bg-[#060d1a]/95 backdrop-blur-sm border-b border-blue-500/20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center gap-3">
                <Link
                    href={back}
                    className="flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm font-bold transition-colors group"
                >
                    <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
                    Retour à mon espace client
                </Link>
                <span className="text-gray-600 text-xs hidden sm:inline">
                    · Vous naviguez depuis votre espace client
                </span>
            </div>
        </div>
    )
}
