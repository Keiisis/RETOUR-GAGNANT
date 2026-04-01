'use client'

import { useState, useEffect } from 'react'
import { Shield, QrCode, CheckCircle2, XCircle, Loader2, Eye, EyeOff, Trash2 } from 'lucide-react'
import Image from 'next/image'

type Status = 'idle' | 'loading' | 'setup' | 'enabled' | 'error'

export default function Admin2FASettingsPage() {
    const [status, setStatus]     = useState<Status>('loading')
    const [qrCode, setQrCode]     = useState('')
    const [secret, setSecret]     = useState('')
    const [showSecret, setShowSecret] = useState(false)
    const [code, setCode]         = useState('')
    const [disableCode, setDisableCode] = useState('')
    const [msg, setMsg]           = useState('')
    const [msgType, setMsgType]   = useState<'success' | 'error'>('success')
    const [busy, setBusy]         = useState(false)

    useEffect(() => {
        checkStatus()
    }, [])

    async function checkStatus() {
        setStatus('loading')
        try {
            const res = await fetch('/api/admin/2fa/status')
            const d = await res.json()
            setStatus(d.enabled ? 'enabled' : 'idle')
        } catch {
            setStatus('idle')
        }
    }

    async function startSetup() {
        setBusy(true)
        setMsg('')
        try {
            const res = await fetch('/api/admin/2fa/setup', { method: 'POST' })
            const d = await res.json()
            if (!res.ok) throw new Error(d.error)
            setQrCode(d.qrCode)
            setSecret(d.secret)
            setStatus('setup')
        } catch (e: unknown) {
            setMsg(e instanceof Error ? e.message : 'Erreur')
            setMsgType('error')
            setStatus('idle')
        } finally {
            setBusy(false)
        }
    }

    async function verifySetup() {
        if (code.length !== 6) return
        setBusy(true)
        setMsg('')
        try {
            const res = await fetch('/api/admin/2fa/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, action: 'setup' }),
            })
            const d = await res.json()
            if (!res.ok) throw new Error(d.error || 'Code incorrect')
            setMsg('2FA activée avec succès !')
            setMsgType('success')
            setStatus('enabled')
            setCode('')
            setQrCode('')
            setSecret('')
        } catch (e: unknown) {
            setMsg(e instanceof Error ? e.message : 'Erreur')
            setMsgType('error')
            setCode('')
        } finally {
            setBusy(false)
        }
    }

    async function disable2FA() {
        if (disableCode.length !== 6) return
        setBusy(true)
        setMsg('')
        try {
            const res = await fetch('/api/admin/2fa/disable', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: disableCode }),
            })
            const d = await res.json()
            if (!res.ok) throw new Error(d.error || 'Code incorrect')
            setMsg('2FA désactivée')
            setMsgType('success')
            setStatus('idle')
            setDisableCode('')
        } catch (e: unknown) {
            setMsg(e instanceof Error ? e.message : 'Erreur')
            setMsgType('error')
            setDisableCode('')
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="max-w-xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-white">Authentification à deux facteurs</h1>
                    <p className="text-gray-400 text-sm">Protégez votre compte avec une couche de sécurité supplémentaire</p>
                </div>
            </div>

            {/* Status Badge */}
            <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border ${status === 'enabled' ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-gray-800 border-gray-700 text-gray-400'}`}>
                {status === 'loading' ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                ) : status === 'enabled' ? (
                    <CheckCircle2 className="w-5 h-5" />
                ) : (
                    <XCircle className="w-5 h-5" />
                )}
                <span className="font-medium">
                    {status === 'loading' ? 'Vérification...' :
                     status === 'enabled' ? '2FA activée — votre compte est protégé' :
                     '2FA désactivée'}
                </span>
            </div>

            {/* Message */}
            {msg && (
                <div className={`px-4 py-3 rounded-xl border text-sm font-medium ${msgType === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                    {msg}
                </div>
            )}

            {/* État: non configuré */}
            {status === 'idle' && (
                <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6 space-y-4">
                    <h2 className="text-white font-semibold">Activer la 2FA</h2>
                    <p className="text-gray-400 text-sm leading-relaxed">
                        Scannez un QR code avec Google Authenticator, Authy ou toute application TOTP.
                        À chaque connexion, un code à 6 chiffres sera requis en plus de votre mot de passe.
                    </p>
                    <button
                        onClick={startSetup}
                        disabled={busy}
                        className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-semibold px-5 py-2.5 rounded-xl transition-colors"
                    >
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                        Générer le QR code
                    </button>
                </div>
            )}

            {/* État: configuration en cours */}
            {status === 'setup' && (
                <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6 space-y-5">
                    <h2 className="text-white font-semibold">Étape 1 — Scannez ce QR code</h2>
                    {qrCode && (
                        <div className="flex justify-center">
                            <div className="bg-white p-3 rounded-xl">
                                <Image src={qrCode} alt="QR Code 2FA" width={192} height={192} />
                            </div>
                        </div>
                    )}

                    {/* Clé manuelle */}
                    <div>
                        <p className="text-gray-400 text-sm mb-1">Ou saisissez la clé manuellement :</p>
                        <div className="flex items-center gap-2 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2">
                            <code className="flex-1 text-amber-400 font-mono text-sm tracking-wider">
                                {showSecret ? secret : '•'.repeat(secret.length)}
                            </code>
                            <button onClick={() => setShowSecret(v => !v)} className="text-gray-500 hover:text-gray-300">
                                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    <div className="border-t border-gray-700 pt-4">
                        <h2 className="text-white font-semibold mb-3">Étape 2 — Confirmez avec un code</h2>
                        <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={code}
                            onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                            placeholder="123456"
                            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white text-center text-xl tracking-[0.4em] font-mono focus:outline-none focus:border-amber-500 transition-colors mb-3"
                        />
                        <button
                            onClick={verifySetup}
                            disabled={busy || code.length !== 6}
                            className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors"
                        >
                            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            Activer la 2FA
                        </button>
                    </div>
                </div>
            )}

            {/* État: activée */}
            {status === 'enabled' && (
                <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6 space-y-4">
                    <h2 className="text-white font-semibold flex items-center gap-2">
                        <Trash2 className="w-4 h-4 text-red-400" />
                        Désactiver la 2FA
                    </h2>
                    <p className="text-gray-400 text-sm">
                        Entrez un code valide de votre application pour désactiver la 2FA.
                    </p>
                    <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={disableCode}
                        onChange={e => setDisableCode(e.target.value.replace(/\D/g, ''))}
                        placeholder="123456"
                        className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white text-center text-xl tracking-[0.4em] font-mono focus:outline-none focus:border-red-500 transition-colors"
                    />
                    <button
                        onClick={disable2FA}
                        disabled={busy || disableCode.length !== 6}
                        className="flex items-center gap-2 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors"
                    >
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                        Désactiver
                    </button>
                </div>
            )}
        </div>
    )
}
