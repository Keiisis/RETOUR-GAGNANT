'use client'

import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

/* ═══════════════════════════════════════════════════════════
   États partagés des panels (vide / chargement).

   Deux défauts corrigés ici, une fois pour toutes :

   1) Le chargement affichait un rond qui tourne. Un cercle ne dit rien de
      ce qui arrive. Un squelette reprend la FORME du contenu attendu :
      l'utilisateur comprend la mise en page avant même la fin du chargement,
      et il n'y a pas de saut de layout à l'arrivée des données.

   2) L'état vide se limitait à une icône grise et deux lignes ternes, sans
      issue. Un écran vide est une invitation à agir : on nomme ce qui
      manque, on explique quand ça se remplira, et on propose l'action
      quand il y en a une.

   Tout passe par les variables --panel-* : un seul jeu de composants sert
   les thèmes clair et sombre des trois panels.
═══════════════════════════════════════════════════════════ */

export function EmptyState({
    icon: Icon,
    title,
    body,
    action,
    compact = false,
}: {
    icon: LucideIcon
    title: string
    body?: string
    action?: { label: string; href: string }
    compact?: boolean
}) {
    return (
        <div className={`text-center ${compact ? 'py-10 px-6' : 'py-16 px-6'}`}>
            <div
                className="mx-auto mb-4 flex items-center justify-center rounded-2xl"
                style={{
                    width: compact ? 44 : 56,
                    height: compact ? 44 : 56,
                    background: 'var(--panel-accent-soft)',
                }}
            >
                <Icon size={compact ? 20 : 24} strokeWidth={1.6} style={{ color: 'var(--panel-accent)' }} />
            </div>
            <p className="font-semibold text-[15px]" style={{ color: 'var(--panel-text-heading)' }}>{title}</p>
            {body ? (
                <p className="text-[13px] mt-1.5 mx-auto leading-relaxed" style={{ color: 'var(--panel-text-muted)', maxWidth: '38ch' }}>
                    {body}
                </p>
            ) : null}
            {action ? (
                <Link
                    href={action.href}
                    className="inline-flex items-center justify-center mt-5 px-5 py-2.5 rounded-xl text-[13px] font-bold transition-all hover:-translate-y-px active:translate-y-0"
                    style={{ background: 'var(--panel-accent)', color: '#FFFFFF' }}
                >
                    {action.label}
                </Link>
            ) : null}
        </div>
    )
}

/** Une ligne de liste en attente. Reprend la forme d'une vraie ligne. */
export function RowSkeleton({ rows = 4 }: { rows?: number }) {
    return (
        <div role="status" aria-label="Chargement en cours" style={{ borderColor: 'var(--panel-divider)' }}>
            {Array.from({ length: rows }).map((_, i) => (
                <div
                    key={i}
                    className="flex items-center gap-4 px-5 py-4 border-b last:border-b-0"
                    style={{ borderColor: 'var(--panel-divider)' }}
                >
                    <Shimmer className="w-10 h-10 rounded-xl shrink-0" />
                    <div className="flex-1 min-w-0 space-y-2">
                        <Shimmer className="h-3 rounded" style={{ width: `${58 - i * 6}%` }} />
                        <Shimmer className="h-2.5 rounded" style={{ width: `${34 - i * 3}%` }} />
                    </div>
                    <Shimmer className="w-16 h-6 rounded-lg shrink-0" />
                </div>
            ))}
        </div>
    )
}

/** Cartes en attente (grilles de statistiques, tuiles de service). */
export function CardSkeleton({ count = 4, height = 116 }: { count?: number; height?: number }) {
    return (
        <>
            {Array.from({ length: count }).map((_, i) => (
                <Shimmer key={i} className="rounded-xl" style={{ height }} />
            ))}
        </>
    )
}

/** Bloc gris animé. L'animation est coupée si l'utilisateur réduit les animations. */
export function Shimmer({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
    return (
        <div
            className={`panel-shimmer ${className}`}
            style={{ background: 'var(--panel-badge-bg)', ...style }}
        />
    )
}
