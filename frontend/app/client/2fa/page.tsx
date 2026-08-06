'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ShieldCheck, CircleNotch as Loader2, WarningCircle as AlertCircle } from '@phosphor-icons/react';

function Challenge() {
    const params = useSearchParams()
    const next = params.get('next') || '/client/dashboard'
    const [code, setCode] = useState('')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')

    const submit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!/^\d{6}$/.test(code)) { setError('Entrez le code à 6 chiffres.'); return }
        setBusy(true); setError('')
        try {
            const res = await fetch('/api/client/2fa/verify', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, action: 'login' }),
            })
            const json = await res.json()
            if (!res.ok) { setError(json.error || 'Code incorrect'); setBusy(false); return }
            window.location.href = next
        } catch { setError('Erreur de connexion'); setBusy(false) }
    }

    return (
        <div className="min-h-screen bg-nexus-deep flex items-center justify-center p-4 text-white">
            <form onSubmit={submit} className="w-full max-w-sm bg-white/[0.04] border border-white/10 rounded-2xl p-8 text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-[var(--panel-accent)] flex items-center justify-center mb-4">
                    <ShieldCheck className="w-7 h-7 text-white" />
                </div>
                <h1 className="text-xl font-bold mb-1">Vérification en deux étapes</h1>
                <p className="text-sm text-gray-400 mb-6">Entrez le code à 6 chiffres de votre application d&apos;authentification.</p>
                <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputMode="numeric" autoFocus placeholder="123456"
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-center text-lg tracking-[0.4em] outline-none focus:border-[var(--panel-accent)] mb-4" />
                {error && <p className="mb-4 text-sm text-red-400 flex items-center justify-center gap-2"><AlertCircle className="w-4 h-4" /> {error}</p>}
                <button type="submit" disabled={busy}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[var(--panel-accent)] hover:bg-[var(--panel-accent)] text-white font-semibold disabled:opacity-60">
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Vérifier
                </button>
            </form>
        </div>
    )
}

export default function Client2FAPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-nexus-deep" />}>
            <Challenge />
        </Suspense>
    )
}
