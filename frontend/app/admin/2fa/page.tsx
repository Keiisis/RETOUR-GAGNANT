'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Shield, Loader2, KeyRound } from 'lucide-react'

export default function Admin2FAPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const next = searchParams.get('next') || '/admin/dashboard'

    const [code, setCode] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        inputRef.current?.focus()
    }, [])

    async function handleVerify(e: React.FormEvent) {
        e.preventDefault()
        if (code.length !== 6) return

        setLoading(true)
        setError('')

        try {
            const res = await fetch('/api/admin/2fa/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, action: 'login' }),
            })
            const data = await res.json()

            if (!res.ok) {
                setError(data.error || 'Code incorrect')
                setCode('')
                inputRef.current?.focus()
            } else {
                router.push(next)
            }
        } catch {
            setError('Erreur réseau')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8 w-full max-w-sm shadow-2xl">
                <div className="flex flex-col items-center mb-6">
                    <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-4">
                        <Shield className="w-8 h-8 text-amber-400" />
                    </div>
                    <h1 className="text-xl font-bold text-white">Vérification 2FA</h1>
                    <p className="text-gray-400 text-sm text-center mt-1">
                        Entrez le code à 6 chiffres de votre application d&apos;authentification
                    </p>
                </div>

                <form onSubmit={handleVerify} className="space-y-4">
                    <div>
                        <label className="text-gray-300 text-sm font-medium block mb-2">
                            <KeyRound className="w-4 h-4 inline mr-1" />
                            Code TOTP
                        </label>
                        <input
                            ref={inputRef}
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]{6}"
                            maxLength={6}
                            value={code}
                            onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                            placeholder="123456"
                            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white text-center text-2xl tracking-[0.5em] font-mono focus:outline-none focus:border-amber-500 transition-colors"
                            autoComplete="one-time-code"
                        />
                    </div>

                    {error && (
                        <p className="text-red-400 text-sm text-center bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                            {error}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={loading || code.length !== 6}
                        className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <><Loader2 className="w-5 h-5 animate-spin" /> Vérification...</>
                        ) : (
                            <><Shield className="w-5 h-5" /> Vérifier</>
                        )}
                    </button>
                </form>

                <p className="text-gray-500 text-xs text-center mt-4">
                    Utilisez Google Authenticator, Authy ou toute app compatible TOTP
                </p>
            </div>
        </div>
    )
}
