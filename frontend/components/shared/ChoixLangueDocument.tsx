'use client'
// Choix de la langue d'un devis / d'une facture (PDF). Valeur initiale :
// la langue dans laquelle la personne lit le site.
import { useState } from 'react'
import { Translate } from '@phosphor-icons/react'
import { useTranslation } from '@/lib/translation'
import { LANGUES_DOC, langueDoc, type LangueDoc } from '@/lib/document-langues'

/** Langue des documents, initialisée sur celle du site. */
export function useLangueDocument() {
    const { lang } = useTranslation()
    return useState<LangueDoc>(() => langueDoc(lang))
}

export default function ChoixLangueDocument({ value, onChange, className = '', titre = 'Langue du document' }: {
    value: LangueDoc
    onChange: (l: LangueDoc) => void
    className?: string
    titre?: string
}) {
    return (
        <label className={`inline-flex items-center gap-1.5 text-xs ${className}`} title={titre}>
            <Translate size={14} aria-hidden />
            <span className="sr-only">{titre}</span>
            <select value={value} onChange={e => onChange(langueDoc(e.target.value))}
                className="bg-transparent border border-current/20 rounded-lg px-2 py-1.5 text-xs font-semibold cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/40">
                {LANGUES_DOC.map(l => <option key={l.code} value={l.code} className="text-black">{l.drapeau} {l.libelle}</option>)}
            </select>
        </label>
    )
}
