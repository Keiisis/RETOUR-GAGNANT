'use client'

// ══════════════════════════════════════════════════════════════
//  Saisie de la description d'une ligne de devis / facture.
//
//  Entrée → nouvel élément « - » dans la MÊME ligne (même prix) : le premier
//  élément reçoit son tiret automatiquement. Maj+Entrée → retour à la ligne
//  simple. Entrée sur un tiret vide → termine la liste (tiret retiré).
//  La zone s'agrandit avec le contenu. Suggestions du catalogue conservées
//  (datalist) : choisir un service remplit le prix via `onChange`.
// ══════════════════════════════════════════════════════════════
import { useLayoutEffect, useRef } from 'react'

type Props = {
    value: string
    onChange: (valeur: string) => void
    placeholder?: string
    className?: string
    /** id d'un <datalist> de suggestions (catalogue des services). */
    suggestions?: string
    title?: string
}

const TIRET = '- '

export default function DescriptionEditeur({ value, onChange, placeholder, className = '', suggestions, title }: Props) {
    const zone = useRef<HTMLTextAreaElement>(null)
    const curseur = useRef<number | null>(null)

    // Hauteur ajustée au contenu + position du curseur après insertion.
    useLayoutEffect(() => {
        const el = zone.current
        if (!el) return
        el.style.height = 'auto'
        el.style.height = `${el.scrollHeight}px`
        if (curseur.current !== null) {
            el.setSelectionRange(curseur.current, curseur.current)
            curseur.current = null
        }
    }, [value])

    const surTouche = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return
        e.preventDefault()
        const el = e.currentTarget
        const debut = el.selectionStart ?? value.length
        const fin = el.selectionEnd ?? value.length
        const avant = value.slice(0, debut)
        const apres = value.slice(fin)
        const ligneCourante = avant.slice(avant.lastIndexOf('\n') + 1)

        // Tiret vide + Entrée : on sort de la liste.
        if (ligneCourante.trim() === '-' ) {
            const sans = avant.slice(0, avant.length - ligneCourante.length)
            curseur.current = sans.length
            onChange((sans.replace(/\n$/, '') + apres))
            return
        }

        // Premier élément sans tiret : on le lui ajoute.
        let prefixe = avant
        if (!avant.includes('\n') && avant.trim() && !/^\s*[-–—•*]/.test(avant)) {
            prefixe = TIRET + avant.trimStart()
        }
        const nouveau = `${prefixe}\n${TIRET}`
        curseur.current = nouveau.length
        onChange(nouveau + apres)
    }

    return (
        <>
            <textarea
                ref={zone}
                rows={1}
                title={title}
                value={value}
                placeholder={placeholder}
                onChange={e => onChange(e.target.value)}
                onKeyDown={surTouche}
                className={`resize-none overflow-hidden leading-relaxed ${className}`}
            />
            {suggestions && (
                <SuggestionsCatalogue liste={suggestions} valeur={value} onChoisir={onChange} />
            )}
            <p className="mt-1 text-[10px] text-gray-500">
                Entrée = nouvel élément « - » sur cette même ligne (un seul prix) · Maj+Entrée = simple retour à la ligne
            </p>
        </>
    )
}

/**
 * Un <textarea> ne sait pas afficher un <datalist> : un champ de recherche
 * discret permet de reprendre un service du catalogue (et son prix) comme avant.
 */
function SuggestionsCatalogue({ liste, valeur, onChoisir }: { liste: string; valeur: string; onChoisir: (v: string) => void }) {
    if (valeur.includes('\n')) return null
    return (
        <input
            type="text"
            list={liste}
            aria-label="Choisir un service du catalogue"
            placeholder="↳ ou choisir un service du catalogue…"
            onChange={e => {
                // Appliqué seulement quand la saisie correspond EXACTEMENT à un
                // service du catalogue (sinon chaque frappe écraserait la description).
                const v = e.target.value
                const options = document.getElementById(liste)?.querySelectorAll('option') ?? []
                if (Array.from(options).some(o => o.value === v)) { onChoisir(v); e.target.value = '' }
            }}
            className="mt-1 w-full bg-transparent border-0 border-b border-dashed border-white/10 px-1 py-1 text-[11px] text-gray-400 placeholder:text-gray-600 focus:outline-none focus:border-blue-500"
        />
    )
}
