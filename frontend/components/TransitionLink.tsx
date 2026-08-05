'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { startTransition, type ComponentProps, type MouseEvent } from 'react'

type ViewDoc = Document & { startViewTransition?: (cb: () => void | Promise<void>) => unknown }

/**
 * Comme <Link>, mais enveloppe la navigation dans l'API native
 * `document.startViewTransition` : les éléments portant un même
 * `view-transition-name` sur les deux pages sont « transportés » (morph) par le
 * navigateur pendant la transition de route.
 *
 * Aucune dépendance ni flag Next expérimental. Dégrade proprement : navigateur
 * sans View Transitions ou clic modifié (Ctrl/Cmd/nouvel onglet) → <Link> normal.
 * Respecte `prefers-reduced-motion` (transition désactivée).
 */
export default function TransitionLink({ href, onClick, ...rest }: ComponentProps<typeof Link>) {
    const router = useRouter()

    const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e)
        if (e.defaultPrevented) return
        // Laisser le comportement natif pour cible externe, clic modifié, etc.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
        const url = typeof href === 'string' ? href : href.toString()
        if (!url.startsWith('/')) return

        const doc = document as ViewDoc
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        if (typeof doc.startViewTransition !== 'function' || reduce) return // <Link> par défaut

        e.preventDefault()
        doc.startViewTransition(() =>
            new Promise<void>((resolve) => {
                startTransition(() => router.push(url))
                // Laisser React committer la nouvelle route avant de figer le snapshot.
                requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
            }),
        )
    }

    return <Link href={href} onClick={handleClick} {...rest} />
}
