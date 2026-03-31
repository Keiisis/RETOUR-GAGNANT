'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { type CurrencyCode, convertCurrency, formatPrice, getAllowedCurrencies } from '@/lib/currency'
import { useTranslation } from '@/lib/translation'

const CURRENCY_OPTIONS: { code: CurrencyCode; flag: string; label: string }[] = [
    { code: 'XOF', flag: '🇧🇯', label: 'FCFA' },
    { code: 'EUR', flag: '🇪🇺', label: 'EUR €' },
    { code: 'USD', flag: '🇺🇸', label: 'USD $' },
    { code: 'GBP', flag: '🇬🇧', label: 'GBP £' },
]

interface CurrencySelectorProps {
    value: CurrencyCode
    onChange: (currency: CurrencyCode) => void
    baseAmountXOF?: number
    className?: string
    theme?: 'dark' | 'light'
}

export default function CurrencySelector({ value, onChange, baseAmountXOF, className = '', theme = 'dark' }: CurrencySelectorProps) {
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)
    const { lang } = useTranslation()
    const allowedCodes = getAllowedCurrencies(lang)
    const filteredOptions = CURRENCY_OPTIONS.filter(o => allowedCodes.includes(o.code))
    const current = filteredOptions.find(o => o.code === value) || filteredOptions[0]
    const dark = theme === 'dark'

    // Si une seule devise autorisée, ne rien afficher
    if (filteredOptions.length <= 1) return null

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    return (
        <div ref={ref} className={`relative ${className}`}>
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all ${
                    dark
                        ? 'bg-white/5 border border-white/10 hover:border-white/20 text-gray-300'
                        : 'bg-gray-50 border border-gray-200 hover:border-gray-300 text-gray-700'
                }`}
            >
                <span>{current.flag}</span>
                <span>{current.label}</span>
                <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div className={`absolute top-full right-0 mt-1 rounded-xl shadow-2xl z-50 min-w-[160px] overflow-hidden ${
                    dark
                        ? 'bg-[#0d1520] border border-white/10'
                        : 'bg-white border border-gray-200'
                }`}>
                    {filteredOptions.map(opt => {
                        const converted = baseAmountXOF ? convertCurrency(baseAmountXOF, 'XOF', opt.code) : null
                        const isSelected = opt.code === value
                        return (
                            <button
                                key={opt.code}
                                type="button"
                                onClick={() => { onChange(opt.code); setOpen(false) }}
                                className={`w-full flex items-center justify-between px-3 py-2.5 text-xs transition-all ${
                                    isSelected
                                        ? dark ? 'text-emerald-400 bg-emerald-500/5' : 'text-[#008751] bg-[#008751]/5'
                                        : dark ? 'text-gray-300 hover:bg-white/5' : 'text-gray-700 hover:bg-gray-50'
                                }`}
                            >
                                <span className="flex items-center gap-2">
                                    <span>{opt.flag}</span>
                                    <span className="font-bold">{opt.label}</span>
                                </span>
                                {converted !== null && (
                                    <span className={`text-[10px] ${
                                        isSelected
                                            ? dark ? 'text-emerald-400' : 'text-[#008751]'
                                            : dark ? 'text-gray-500' : 'text-gray-400'
                                    }`}>
                                        {formatPrice(converted, opt.code)}
                                    </span>
                                )}
                            </button>
                        )
                    })}
                    <div className={`px-3 py-2 border-t ${dark ? 'border-white/5' : 'border-gray-100'}`}>
                        <p className={`text-[9px] text-center ${dark ? 'text-gray-600' : 'text-gray-400'}`}>Taux de change en temps réel</p>
                    </div>
                </div>
            )}
        </div>
    )
}
