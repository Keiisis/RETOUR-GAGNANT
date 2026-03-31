'use client'

import { useTranslation, T } from '@/lib/translation'
import { useState, useEffect } from 'react'
import {
    CurrencyCode,
    formatPrice, convertCurrency, refreshRates,
    getCurrencyForLang, getAllowedCurrencies,
} from '@/lib/currency'

interface PriceProps {
    amount: number
    currency?: CurrencyCode
    className?: string
    showOriginal?: boolean
    showSelector?: boolean
    /** Si true, affiche toujours dans la devise passée sans auto-conversion (utile pour le checkout) */
    noConvert?: boolean
    /** Force une devise d'affichage spécifique au lieu de détecter celle de l'utilisateur */
    forceDisplayCurrency?: CurrencyCode
}

export function Price({
    amount,
    currency = 'XOF',
    className = '',
    showOriginal = false,
    showSelector = false,
    noConvert = false,
    forceDisplayCurrency,
}: PriceProps) {
    const { lang, t } = useTranslation()
    const langCurrency = forceDisplayCurrency || getCurrencyForLang(lang)
    // Sélection manuelle par l'utilisateur (seulement si showSelector)
    const [manualCurrency, setManualCurrency] = useState<CurrencyCode | null>(null)
    const displayCurrency = manualCurrency ?? langCurrency
    const [ready, setReady] = useState(noConvert && !forceDisplayCurrency)

    // Reset la sélection manuelle quand la langue change
    const [prevLang, setPrevLang] = useState(lang)
    if (lang !== prevLang) {
        setPrevLang(lang)
        setManualCurrency(null)
    }

    useEffect(() => {
        if (noConvert && !forceDisplayCurrency) return
        refreshRates().then(() => setReady(true))
    }, [noConvert, forceDisplayCurrency])

    if (!ready) return <span className={className}>{formatPrice(amount, currency)}</span>

    const converted = convertCurrency(amount, currency, displayCurrency)
    const display = formatPrice(converted, displayCurrency)
    const original = currency !== displayCurrency ? formatPrice(amount, currency) : null

    // Devises autorisées selon la langue active
    const allowedCurrencies = getAllowedCurrencies(lang)

    return (
        <span className={`inline-flex items-center gap-1.5 ${className}`}>
            <span>{display}</span>
            {showOriginal && original && (
                <span className="text-gray-500 text-[0.75em]">({original})</span>
            )}
            {showSelector && allowedCurrencies.length > 1 && (
                <select
                    value={displayCurrency}
                    onChange={e => setManualCurrency(e.target.value as CurrencyCode)}
                    className="bg-[#0a0f14] border border-white/10 rounded-lg px-2 py-1 text-[0.7em] text-gray-300 cursor-pointer ml-1 hover:border-[#FCD116]/30 focus:border-[#FCD116]/50 focus:outline-none transition-colors"
                    aria-label={t("Devise")}
                >
                    {allowedCurrencies.includes('XOF') && <option value="XOF"><T>🇧🇯 FCFA</T></option>}
                    {allowedCurrencies.includes('EUR') && <option value="EUR"><T>🇪🇺 EUR €</T></option>}
                    {allowedCurrencies.includes('USD') && <option value="USD"><T>🇺🇸 USD $</T></option>}
                    {allowedCurrencies.includes('GBP') && <option value="GBP"><T>🇬🇧 GBP £</T></option>}
                </select>
            )}
        </span>
    )
}

/**
 * Hook pour utiliser la devise liée à la langue active.
 * Quand la langue change, la devise change automatiquement.
 */
export function useCurrency() {
    const { lang } = useTranslation()
    const currency = getCurrencyForLang(lang)
    const [ready, setReady] = useState(false)

    useEffect(() => {
        refreshRates().then(() => setReady(true))
    }, [])

    return {
        currency,
        ready,
        format: (amount: number, from: CurrencyCode = 'XOF') =>
            formatPrice(convertCurrency(amount, from, currency), currency),
        convert: (amount: number, from: CurrencyCode = 'XOF') =>
            convertCurrency(amount, from, currency),
    }
}
