'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Warning as AlertTriangle, House as Home, ArrowCounterClockwise as RotateCcw } from '@phosphor-icons/react';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error('Erreur globale:', error)
    }, [error])

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#0f141e] via-[#1a2a3a] to-[#0f141e] text-white flex items-center justify-center px-4 relative overflow-hidden">
            <div className="absolute top-20 left-20 w-72 h-72 rounded-full bg-[#E8112D]/15 blur-[120px]" />
            <div className="absolute bottom-20 right-20 w-72 h-72 rounded-full bg-[#FCD116]/15 blur-[120px]" />

            <div className="text-center max-w-lg relative z-10">
                <div className="w-20 h-20 rounded-2xl bg-[#E8112D]/20 flex items-center justify-center mx-auto mb-8 border border-[#E8112D]/30">
                    <AlertTriangle className="text-[#E8112D]" size={40} />
                </div>

                <div className="flex justify-center gap-0 mb-6">
                    <div className="w-12 h-1 bg-[#008751] rounded-l-full" />
                    <div className="w-12 h-1 bg-[#FCD116]" />
                    <div className="w-12 h-1 bg-[#E8112D] rounded-r-full" />
                </div>

                <h1 className="text-2xl md:text-3xl font-bold mb-3">
                    Une erreur est survenue
                </h1>
                <p className="text-white/60 mb-8 text-base">
                    Nous nous excusons pour ce désagrément. Notre équipe technique a été notifiée. Vous pouvez réessayer ou retourner à l&apos;accueil.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <Button
                        onClick={reset}
                        size="lg"
                        className="bg-[#008751] hover:bg-[#006B40] text-white rounded-full px-8 h-12 gap-2 shadow-lg"
                    >
                        <RotateCcw size={18} />
                        Réessayer
                    </Button>
                    <Link href="/">
                        <Button size="lg" variant="outline" className="border-white/20 text-white hover:bg-white/10 rounded-full px-8 h-12 gap-2">
                            <Home size={18} />
                            Retour à l&apos;accueil
                        </Button>
                    </Link>
                </div>

                {error.digest && (
                    <p className="mt-8 text-xs text-white/20 font-mono">
                        Réf: {error.digest}
                    </p>
                )}
            </div>
        </div>
    )
}
