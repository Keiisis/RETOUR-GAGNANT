'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { ShieldCheck, ShieldAlert, Loader2, CheckCircle2, AlertCircle, KeyRound, Smartphone } from 'lucide-react'

type Step = 'idle' | 'enrolling' | 'disabling'

export default function ClientSecuritePage() {
    const [loading, setLoading] = useState(true)
    const [enabled, setEnabled] = useState(false)
    const [step, setStep] = useState<Step>('idle')
    const [qr, setQr] = useState('')
    const [secret, setSecret] = useState('')
    const [code, setCode] = useState('')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const [flash, setFlash] = useState('')

    const loadStatus = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/client/2fa/status', { cache: 'no-store' })
            const json = await res.json()
            setEnabled(!!json.enabled)
        } catch { /* ignore */ } finally { setLoading(false) }
    }
    useEffect(() => { loadStatus() }, [])

    const startEnroll = async () => {
        setBusy(true); setError('')
        try {
            const res = await fetch('/api/client/2fa/setup', { method: 'POST' })
            const json = await res.json()
            if (!res.ok) { setError(json.error || 'Erreur'); return }
            setQr(json.qrCode); setSecret(json.secret); setStep('enrolling'); setCode('')
        } catch { setError('Erreur de connexion') } finally { setBusy(false) }
    }

    const confirmEnroll = async () => {
        if (!/^\d{6}$/.test(code)) { setError('Entrez le code à 6 chiffres.'); return }
        setBusy(true); setError('')
        try {
            const res = await fetch('/api/client/2fa/verify', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, action: 'setup' }),
            })
            const json = await res.json()
            if (!res.ok) { setError(json.error || 'Code incorrect'); return }
            setEnabled(true); setStep('idle'); setQr(''); setSecret(''); setCode(''); setFlash('Double authentification activée.')
        } catch { setError('Erreur de connexion') } finally { setBusy(false) }
    }

    const disable = async () => {
        if (!/^\d{6}$/.test(code)) { setError('Entrez le code à 6 chiffres pour confirmer.'); return }
        setBusy(true); setError('')
        try {
            const res = await fetch('/api/client/2fa/disable', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code }),
            })
            const json = await res.json()
            if (!res.ok) { setError(json.error || 'Code incorrect'); return }
            setEnabled(false); setStep('idle'); setCode(''); setFlash('Double authentification désactivée.')
        } catch { setError('Erreur de connexion') } finally { setBusy(false) }
    }

    return (
        <div className="p-5 md:p-8 max-w-2xl mx-auto text-white">
            <header className="flex items-center gap-3 mb-6">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                    <ShieldCheck className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold">Sécurité du compte</h1>
                    <p className="text-sm text-gray-400">Protégez votre compte avec la double authentification (2FA)</p>
                </div>
            </header>

            {flash && <p className="mb-4 text-sm text-emerald-400 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> {flash}</p>}

            {loading ? (
                <div className="h-40 rounded-2xl bg-white/5 border border-white/10 animate-pulse" />
            ) : (
                <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-6">
                    {/* État */}
                    <div className="flex items-center gap-3 pb-5 mb-5 border-b border-white/10">
                        {enabled
                            ? <span className="inline-flex items-center gap-2 text-emerald-400 font-semibold"><ShieldCheck className="w-5 h-5" /> 2FA activée</span>
                            : <span className="inline-flex items-center gap-2 text-amber-400 font-semibold"><ShieldAlert className="w-5 h-5" /> 2FA désactivée</span>}
                    </div>

                    <p className="text-sm text-gray-300 leading-relaxed mb-5">
                        La double authentification ajoute un code à usage unique (généré par une application comme
                        <strong> Google Authenticator</strong> ou <strong>Authy</strong>) en plus de votre mot de passe.
                        Même si votre mot de passe est compromis, votre compte reste protégé.
                    </p>

                    {/* Activation */}
                    {!enabled && step === 'idle' && (
                        <button type="button" onClick={startEnroll} disabled={busy}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-60">
                            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />} Activer la 2FA
                        </button>
                    )}

                    {!enabled && step === 'enrolling' && (
                        <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row gap-5 items-center">
                                {qr && (
                                    <div className="bg-white p-2 rounded-xl shrink-0">
                                        <Image src={qr} alt="QR code 2FA" width={160} height={160} unoptimized />
                                    </div>
                                )}
                                <div className="text-sm text-gray-300 space-y-2">
                                    <p className="flex items-center gap-2"><Smartphone className="w-4 h-4 text-blue-400" /> 1. Scannez ce QR code avec votre application d&apos;authentification.</p>
                                    <p>2. Ou saisissez la clé manuellement :</p>
                                    <code className="block bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs break-all text-blue-300">{secret}</code>
                                    <p>3. Entrez le code à 6 chiffres généré :</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    inputMode="numeric" placeholder="123456"
                                    className="w-40 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-center tracking-[0.3em] outline-none focus:border-blue-500" />
                                <button type="button" onClick={confirmEnroll} disabled={busy}
                                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-60">
                                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Confirmer
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Désactivation */}
                    {enabled && (
                        step === 'disabling' ? (
                            <div className="flex gap-2 items-center flex-wrap">
                                <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    inputMode="numeric" placeholder="Code 2FA"
                                    className="w-40 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-center tracking-[0.2em] outline-none focus:border-red-500" />
                                <button type="button" onClick={disable} disabled={busy}
                                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-60">
                                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Désactiver
                                </button>
                                <button type="button" onClick={() => { setStep('idle'); setCode(''); setError('') }}
                                    className="px-4 py-2.5 rounded-xl border border-white/10 text-gray-300 text-sm">Annuler</button>
                            </div>
                        ) : (
                            <button type="button" onClick={() => { setStep('disabling'); setError('') }}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-red-500/40 text-red-400 hover:bg-red-500/10 text-sm font-semibold">
                                <ShieldAlert className="w-4 h-4" /> Désactiver la 2FA
                            </button>
                        )
                    )}

                    {error && <p className="mt-4 text-sm text-red-400 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error}</p>}
                </div>
            )}
        </div>
    )
}
