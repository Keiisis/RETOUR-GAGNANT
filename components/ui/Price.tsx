'use client'

import { useState, useEffect } from 'react'
import {
    CurrencyCode, CURRENCIES, detectUserCurrency,
    formatPrice, convertCurrency, refreshRates
} from '@/lib/currency'

interface PriceProps {
    amount: number
    currency?: CurrencyCode
    className?: string
    showOriginal?: boolean
    showSelector?: boolean
}

export function Price({
    amount,
    currency = 'XOF',
    className = '',
    showOriginal = false,
    showSelector = false,
}: PriceProps) {
    const [displayCurrency, setDisplayCurrency] = useState<CurrencyCode>(currency)
    const [ready, setReady] = useState(false)

    useEffect(() => {
        const init = async () => {
            await refreshRates()
            const detected = detectUserCurrency()
            setDisplayCurrency(detected)
            setReady(true)
        }
        init()
    }, [])

    if (!ready) return <span className={className}>{formatPrice(amount, currency)}</span>

    const converted = convertCurrency(amount, currency, displayCurrency)
    const display = formatPrice(converted, displayCurrency)
    const original = currency !== displayCurrency ? formatPrice(amount, currency) : null

    return (
        <span className={`inline-flex items-center gap-1.5 ${className}`}>
            <span>{display}</span>
            {showOriginal && original && (
                <span className="text-gray-500 text-[0.75em]">({original})</span>
            )}
            {showSelector && (
                <select
                    value={displayCurrency}
                    onChange={e => setDisplayCurrency(e.target.value as CurrencyCode)}
                    className="bg-transparent border border-white/10 rounded px-1 py-0.5 text-[0.7em] text-gray-400 cursor-pointer ml-1"
                    aria-label="Devise"
                >
                    {Object.values(CURRENCIES).map(c => (
                        <option key={c.code} value={c.code}>{c.symbol}</option>
                    ))}
                </select>
            )}
        </span>
    )
}

/**
 * Hook pour utiliser la devise détectée dans n'importe quel composant
 */
export function useCurrency() {
    const [currency, setCurrency] = useState<CurrencyCode>('XOF')
    const [ready, setReady] = useState(false)

    useEffect(() => {
        const init = async () => {
            await refreshRates()
            setCurrency(detectUserCurrency())
            setReady(true)
        }
        init()
    }, [])

    return {
        currency,
        setCurrency,
        ready,
        format: (amount: number, from: CurrencyCode = 'XOF') =>
            formatPrice(convertCurrency(amount, from, currency), currency),
        convert: (amount: number, from: CurrencyCode = 'XOF') =>
            convertCurrency(amount, from, currency),
    }
}
