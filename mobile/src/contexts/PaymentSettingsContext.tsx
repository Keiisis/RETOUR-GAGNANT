import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../config/supabase'

/* ══════════════════════════════════════════════════════════════════════════
   PaymentSettingsContext : preloads Kkiapay public key + sandbox flag at app
   start so the payment modal opens instantly (no Supabase round-trip when
   the user taps "Pay").
   ══════════════════════════════════════════════════════════════════════════ */

interface PaymentSettings {
    kkiapayPublicKey: string | null
    kkiapaySandbox: boolean
    loaded: boolean
    refresh: () => Promise<void>
}

const PaymentSettingsContext = createContext<PaymentSettings>({
    kkiapayPublicKey: null,
    kkiapaySandbox: false,
    loaded: false,
    refresh: async () => {},
})

export const usePaymentSettings = () => useContext(PaymentSettingsContext)

export function PaymentSettingsProvider({ children }: { children: React.ReactNode }) {
    const [kkiapayPublicKey, setKey] = useState<string | null>(null)
    const [kkiapaySandbox, setSandbox] = useState(false)
    const [loaded, setLoaded] = useState(false)

    const fetchSettings = async () => {
        try {
            const { data } = await supabase
                .from('settings')
                .select('key, value')
                .in('key', ['kkiapay_public_key', 'kkiapay_sandbox'])
            if (Array.isArray(data)) {
                for (const row of data) {
                    if (row.key === 'kkiapay_public_key' && row.value) setKey(String(row.value))
                    if (row.key === 'kkiapay_sandbox') {
                        setSandbox(row.value === 'true' || row.value === true)
                    }
                }
            }
        } catch { /* ignore : fallback prod */ } finally {
            setLoaded(true)
        }
    }

    useEffect(() => { fetchSettings() }, [])

    return (
        <PaymentSettingsContext.Provider value={{ kkiapayPublicKey, kkiapaySandbox, loaded, refresh: fetchSettings }}>
            {children}
        </PaymentSettingsContext.Provider>
    )
}
