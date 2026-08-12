'use client'

import Link from 'next/link'

/**
 * Case de consentement RGPD réutilisable.
 *
 * Conforme : opt-in ACTIF (case décochée par défaut, `required`), finalité
 * explicite, lien vers la politique de confidentialité. À placer juste avant
 * le bouton d'envoi de tout formulaire collectant des données personnelles.
 *
 * - `purpose` : la finalité précise du traitement (ex. « pour traiter votre
 *   demande de rendez-vous »). Obligatoire pour informer l'utilisateur.
 * - `checked`/`onChange` : optionnels : pour les formulaires qui pilotent
 *   l'état (désactiver le bouton tant que non coché). Sans eux, l'attribut
 *   natif `required` suffit déjà à bloquer l'envoi d'un `<form>`.
 */
interface ConsentCheckboxProps {
    purpose: string
    checked?: boolean
    onChange?: (value: boolean) => void
    id?: string
    required?: boolean
    className?: string
}

export default function ConsentCheckbox({
    purpose,
    checked,
    onChange,
    id = 'rg-consent',
    required = true,
    className = '',
}: ConsentCheckboxProps) {
    const controlled = typeof checked === 'boolean' && typeof onChange === 'function'

    return (
        <label
            htmlFor={id}
            className={`flex items-start gap-2.5 text-[12px] leading-relaxed text-gray-600 cursor-pointer select-none ${className}`}
        >
            <input
                id={id}
                type="checkbox"
                required={required}
                {...(controlled
                    ? { checked, onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange!(e.target.checked) }
                    : {})}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 accent-[#008751]"
            />
            <span>
                J&apos;accepte que mes données personnelles soient collectées et traitées par
                {' '}Retour Gagnant Bénin {purpose}, conformément à la{' '}
                <Link
                    href="/confidentialite"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#008751] underline font-medium hover:text-[#006b40]"
                >
                    politique de confidentialité
                </Link>
                . Vous pouvez exercer vos droits (accès, rectification, suppression) à tout moment.
                {' '}<span className="text-[#E8112D]" aria-hidden="true">*</span>
            </span>
        </label>
    )
}
