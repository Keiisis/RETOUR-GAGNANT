'use client'

import { useState } from 'react'
import { PaperPlaneTilt as Send, CheckCircle, EnvelopeSimple } from '@phosphor-icons/react'
import { T, useTranslation } from '@/lib/translation'
import { trackEvent } from '@/lib/analytics'

/**
 * Capture email → /api/newsletter (table newsletter_subscribers, upsert).
 * Compact, réutilisable (footer, sections). A11y : label associé, aria-live.
 */
export default function NewsletterCapture({ compact = false }: { compact?: boolean }) {
    const { t } = useTranslation()
    const [email, setEmail] = useState('')
    const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
    const [msg, setMsg] = useState('')

    const submit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!email.includes('@')) { setStatus('error'); setMsg('Adresse email invalide.'); return }
        setStatus('loading'); setMsg('')
        try {
            const res = await fetch('/api/newsletter', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            })
            if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || 'Inscription impossible.') }
            setStatus('done'); setEmail('')
            trackEvent('newsletter_subscribe')
        } catch (err) {
            setStatus('error'); setMsg(err instanceof Error ? err.message : 'Une erreur est survenue.')
        }
    }

    if (status === 'done') {
        return (
            <div className="flex items-center gap-2.5 text-sm font-semibold text-[#00c07a]" role="status" aria-live="polite">
                <CheckCircle size={18} weight="fill" /> <T>Merci ! Vous êtes inscrit(e).</T>
            </div>
        )
    }

    return (
        <form onSubmit={submit} className={compact ? '' : 'w-full'} noValidate>
            {!compact && (
                <p className="font-display text-lg font-bold text-white mb-1.5"><T>Restez informé(e)</T></p>
            )}
            {!compact && (
                <p className="text-white/50 text-[13px] mb-3"><T>Conseils et actualités pour réussir votre retour au Bénin. Pas de spam.</T></p>
            )}
            <label htmlFor="nl-email" className="sr-only"><T>Votre adresse email</T></label>
            <div className="flex items-stretch gap-2">
                <div className="relative flex-1">
                    <EnvelopeSimple size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" aria-hidden="true" />
                    <input
                        id="nl-email"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={e => { setEmail(e.target.value); if (status === 'error') setStatus('idle') }}
                        placeholder={t('votre@email.com')}
                        aria-invalid={status === 'error'}
                        className="w-full bg-white/10 border border-white/15 rounded-xl py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-[#FCD116]/60 focus:ring-1 focus:ring-[#FCD116]/40 transition-colors"
                    />
                </div>
                <button
                    type="submit"
                    disabled={status === 'loading'}
                    className="shrink-0 inline-flex items-center gap-1.5 px-4 rounded-xl bg-[#008751] hover:bg-[#00a36b] text-white text-sm font-bold transition-colors disabled:opacity-60"
                >
                    {status === 'loading'
                        ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" />
                        : <Send size={15} />}
                    <span className="hidden sm:inline"><T>S&apos;inscrire</T></span>
                </button>
            </div>
            {status === 'error' && <p className="text-[#ff8a8a] text-xs mt-2" role="alert">{msg}</p>}
        </form>
    )
}
