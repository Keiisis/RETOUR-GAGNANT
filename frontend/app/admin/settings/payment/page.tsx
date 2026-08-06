'use client'

import { useTranslation, T } from '@/lib/translation';
import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { CreditCard, Shield, FloppyDisk as Save, CircleNotch as Loader2, ArrowLeft, CheckCircle as CheckCircle2, WarningCircle as AlertCircle, Eye, EyeSlash as EyeOff, ToggleLeft, ToggleRight, ArrowSquareOut as ExternalLink, Lightning as Zap, Key, Globe, TestTube as TestTube2, Rocket } from '@phosphor-icons/react';
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { RoleGuard } from '@/components/admin/RoleGuard'

interface GatewayConfig {
    id: string
    name: string
    description: string
    classes: string
    icon: string
    fields: GatewayField[]
    docsUrl: string
}

interface GatewayField {
    key: string
    label: string
    placeholder: string
    type: 'text' | 'password' | 'url'
    required: boolean
    isSecret: boolean
    helpText?: string
}

const GATEWAYS: GatewayConfig[] = [
    {
        id: 'kkiapay',
        name: 'Kkiapay',
        description: 'Mobile Money (MTN, Moov) + Cartes bancaires. Leader au Benin.',
        classes: 'bg-[#4A90D9]/15 border-[#4A90D9]/30 text-[#4A90D9]',
        icon: 'K',
        docsUrl: 'https://docs.kkiapay.me',
        fields: [
            { key: 'kkiapay_public_key', label: ' Clé Publique (LIVE)', placeholder: 'pk_xxx...', type: 'text', required: true, isSecret: false, helpText: 'Clé publique PRODUCTION — depuis le dashboard Kkiapay (mode Live)' },
            { key: 'kkiapay_private_key', label: ' Clé Privée (LIVE)', placeholder: 'prk_xxx...', type: 'password', required: true, isSecret: true, helpText: 'Clé privée PRODUCTION — pour vérifier les transactions' },
            { key: 'kkiapay_secret_key', label: ' Clé Secrète (LIVE)', placeholder: 'sk_xxx...', type: 'password', required: false, isSecret: true, helpText: 'Optionnel — utilisée pour les webhooks en production' },
            { key: 'kkiapay_sandbox_public_key', label: ' Clé Publique (SANDBOX)', placeholder: 'pk_test_xxx...', type: 'text', required: false, isSecret: false, helpText: 'Clé publique TEST — depuis le dashboard Kkiapay (mode Sandbox)' },
            { key: 'kkiapay_sandbox_private_key', label: ' Clé Privée (SANDBOX)', placeholder: 'prk_test_xxx...', type: 'password', required: false, isSecret: true, helpText: 'Clé privée TEST — pour vérifier les transactions en sandbox' },
        ],
    },
    {
        id: 'fedapay',
        name: 'FedaPay',
        description: 'Solution de paiement africaine. Mobile Money + Cartes.',
        classes: 'bg-[#2ECC71]/15 border-[#2ECC71]/30 text-[#2ECC71]',
        icon: 'F',
        docsUrl: 'https://docs.fedapay.com',
        fields: [
            { key: 'fedapay_public_key', label: 'Clé Publique', placeholder: 'pk_live_xxx...', type: 'text', required: true, isSecret: false, helpText: 'Utilisée pour Checkout.js côté client' },
            { key: 'fedapay_secret_key', label: 'Clé Secrète', placeholder: 'sk_live_xxx...', type: 'password', required: true, isSecret: true, helpText: 'Pour les appels API serveur et vérification' },
        ],
    },
    {
        id: 'zeyow',
        name: 'Zeyow',
        description: 'Cartes virtuelles et paiements par redirection.',
        classes: 'bg-[#FF6B35]/15 border-[#FF6B35]/30 text-[#FF6B35]',
        icon: 'Z',
        docsUrl: 'https://zeyow.com',
        fields: [
            { key: 'zeyow_redirect_url', label: 'URL de Redirection', placeholder: 'https://pay.zeyow.com/checkout', type: 'url', required: true, isSecret: false, helpText: 'URL vers laquelle le client est redirigé pour payer. Le webhook Zeyow doit pointer vers /api/webhooks/zeyow' },
        ],
    },
    {
        id: 'stripe',
        name: 'Stripe',
        description: 'Cartes bancaires internationales (Visa, Mastercard, AMEX). Supporte XOF.',
        classes: 'bg-[#635BFF]/15 border-[#635BFF]/30 text-[#635BFF]',
        icon: 'S',
        docsUrl: 'https://dashboard.stripe.com/apikeys',
        fields: [
            { key: 'stripe_public_key', label: 'Clé Publique (Publishable Key)', placeholder: 'pk_live_xxx... ou pk_test_xxx...', type: 'text', required: true, isSecret: false, helpText: 'Clé publique Stripe — commence par pk_live_ (production) ou pk_test_ (sandbox)' },
            { key: 'stripe_secret_key', label: 'Clé Secrète (Secret Key)', placeholder: 'sk_live_xxx... ou sk_test_xxx...', type: 'password', required: true, isSecret: true, helpText: 'Clé secrète Stripe — commence par sk_live_ ou sk_test_. Ne jamais exposer.' },
            { key: 'stripe_webhook_secret', label: 'Webhook Signing Secret', placeholder: 'whsec_xxx...', type: 'password', required: false, isSecret: true, helpText: 'Secret de signature des webhooks Stripe. Configurer le webhook vers /api/webhooks/stripe dans le Dashboard Stripe.' },
        ],
    },
    {
        id: 'paypal',
        name: 'PayPal Business',
        description: 'Compte PayPal Business. Paiements internationaux via compte PayPal ou carte.',
        classes: 'bg-[#009CDE]/15 border-[#009CDE]/30 text-[#009CDE]',
        icon: 'P',
        docsUrl: 'https://developer.paypal.com/dashboard/',
        fields: [
            { key: 'paypal_client_id', label: 'Client ID', placeholder: 'AXxx...', type: 'text', required: true, isSecret: false, helpText: 'Client ID de votre application PayPal (sandbox ou live)' },
            { key: 'paypal_client_secret', label: 'Client Secret', placeholder: 'EXxx...', type: 'password', required: true, isSecret: true, helpText: 'Client Secret de votre application PayPal. Ne jamais exposer.' },
            { key: 'paypal_currency', label: 'Devise PayPal', placeholder: 'EUR', type: 'text', required: false, isSecret: false, helpText: 'EUR ou USD recommandé — PayPal ne supporte pas XOF. Les prix XOF sont convertis automatiquement (taux fixe BCEAO: 1 EUR = 655,957 XOF).' },
            { key: 'paypal_webhook_id', label: 'Webhook ID (optionnel)', placeholder: 'WH-xxx...', type: 'password', required: false, isSecret: true, helpText: 'ID du webhook PayPal pour vérification de signature. Configurer /api/webhooks/paypal dans le Developer Dashboard.' },
        ],
    },
]

function PaymentSettingsContent() {
    const { t } = useTranslation();
    const [settings, setSettings] = useState<Record<string, string>>({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [error, setError] = useState('')
    const [visibleSecrets, setVisibleSecrets] = useState<Record<string, boolean>>({})
    const [testResults, setTestResults] = useState<Record<string, {
        status: 'idle' | 'testing' | 'success' | 'error'
        message?: string
    }>>({})

    // Load all payment settings from Supabase
    const loadSettings = useCallback(async () => {
        try {
            const { data, error: fetchError } = await supabase
                .from('settings')
                .select('key, value')
                .eq('category', 'payment')

            if (fetchError) throw fetchError

            const map: Record<string, string> = {}
            for (const item of data || []) {
                map[item.key] = item.value || ''
            }
            setSettings(map)
        } catch {
            setError('Impossible de charger les reglages')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { loadSettings() }, [loadSettings])

    const updateSetting = (key: string, value: string) => {
        setSettings(prev => ({ ...prev, [key]: value }))
        setSaved(false)
    }

    const toggleGateway = (gatewayId: string) => {
        const key = `${gatewayId}_enabled`
        const current = settings[key]
        updateSetting(key, current === 'true' ? 'false' : 'true')
    }

    const toggleSandbox = (gatewayId: string) => {
        const key = `${gatewayId}_sandbox`
        const current = settings[key]
        updateSetting(key, current === 'true' ? 'false' : 'true')
    }

    const isGatewayEnabled = (gatewayId: string) => settings[`${gatewayId}_enabled`] === 'true'
    const isSandbox = (gatewayId: string) => settings[`${gatewayId}_sandbox`] === 'true'

    const isGatewayConfigured = (gateway: GatewayConfig) => {
        return gateway.fields
            .filter(f => f.required)
            .every(f => settings[f.key] && settings[f.key].trim() !== '')
    }

    const toggleSecretVisibility = (key: string) => {
        setVisibleSecrets(prev => ({ ...prev, [key]: !prev[key] }))
    }

    // Test connectivity for a gateway
    const testGateway = async (gatewayId: string) => {
        setTestResults(prev => ({ ...prev, [gatewayId]: { status: 'testing' } }))

        try {
            const res = await fetch('/api/settings/payment/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ gateway: gatewayId, settings }),
            })
            const data = await res.json()
            setTestResults(prev => ({
                ...prev,
                [gatewayId]: {
                    status: data.success ? 'success' : 'error',
                    message: data.success ? data.message : data.error,
                },
            }))
        } catch (err) {
            setTestResults(prev => ({
                ...prev,
                [gatewayId]: { status: 'error', message: err instanceof Error ? err.message : 'Erreur réseau' },
            }))
        }

        // Reset after 8s
        setTimeout(() => {
            setTestResults(prev => ({ ...prev, [gatewayId]: { status: 'idle' } }))
        }, 8000)
    }

    // Save all settings to Supabase
    const saveAll = async () => {
        setSaving(true)
        setError('')
        setSaved(false)

        try {
            const entries = Object.entries(settings)
            for (const [key, value] of entries) {
                const { error: upsertError } = await supabase
                    .from('settings')
                    .upsert(
                        { key, value, category: 'payment' },
                        { onConflict: 'key' }
                    )
                if (upsertError) throw upsertError
            }

            setSaved(true)
            setTimeout(() => setSaved(false), 3000)
        } catch {
            setError('Erreçur lors de la sauvegarde')
        } finally {
            setSaving(false)
        }
    }

    // Count active gateways
    const activeCount = GATEWAYS.filter(g => isGatewayEnabled(g.id) && isGatewayConfigured(g)).length

    if (loading) {
        return (
            <div className="flex justify-center py-32">
                <Loader2 size={48} className="animate-spin text-[#FCD116]" />
            </div>
        )
    }

    return (
        <div className="space-y-10 animate-in fade-in duration-700">
            {/* HEADER */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
                <div className="flex items-center gap-4">
                    <Link href="/admin/settings">
                        <button type="button" className="p-3 rounded-xl bg-white/5 border border-white/5 text-gray-400 hover:text-white transition-colors" title={t("Retour aux reglages")}>
                            <ArrowLeft size={18} />
                        </button>
                    </Link>
                    <div>
                        <div className="flex items-center gap-2 text-[#FCD116]">
                            <CreditCard size={18} />
                            <span className="text-[10px] font-bold uppercase tracking-[0.4em]"><T>Passerelles de Paiement</T></span>
                        </div>
                        <h1 className="text-4xl font-black text-white font-heading tracking-tighter">
                            CONFIGURATION <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FCD116] to-[#008751]"><T>PAIEMENT</T></span>
                        </h1>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {/* Status indicator */}
                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/5 border border-white/5">
                        <div className={cn('w-2.5 h-2.5 rounded-full', activeCount > 0 ? 'bg-[#008751] animate-pulse' : 'bg-gray-600')} />
                        <span className="text-xs font-bold text-gray-400">
                            {activeCount} passerelle{activeCount > 1 ? 's' : ''} active{activeCount > 1 ? 's' : ''}
                        </span>
                    </div>

                    <Button
                        onClick={saveAll}
                        disabled={saving}
                        className={cn(
                            'h-14 px-8 rounded-2xl font-black tracking-widest gap-2 shadow-xl transition-all',
                            saved
                                ? 'bg-[#008751] text-white'
                                : 'bg-[#FCD116] text-[#0f141e] hover:bg-[#008751] hover:text-white'
                        )}
                    >
                        {saving ? <Loader2 size={18} className="animate-spin" /> :
                            saved ? <CheckCircle2 size={18} /> : <Save size={18} />}
                        {saved ? 'SAUVEGARDE' : 'TOUT SAUVEGARDER'}
                    </Button>
                </div>
            </div>

            {error && (
                <div className="p-4 rounded-2xl bg-[#E8112D]/10 border border-[#E8112D]/20 text-[#E8112D] text-sm font-bold flex items-center gap-2">
                    <AlertCircle size={18} /> {error}
                </div>
            )}

            {/* Gateways */}
            <div className="space-y-8">
                {GATEWAYS.map((gateway, gi) => {
                    const enabled = isGatewayEnabled(gateway.id)
                    const sandbox = isSandbox(gateway.id)
                    const configuréed = isGatewayConfigured(gateway)
                    const testResult = testResults[gateway.id] || { status: 'idle' }
                    const testStatus = testResult.status

                    return (
                        <motion.div
                            key={gateway.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: gi * 0.1 }}
                        >
                            <Card className={cn(
                                'bg-[#0a0f18] border rounded-[2rem] overflow-hidden shadow-2xl transition-all duration-500',
                                enabled
                                    ? 'border-white/10'
                                    : 'border-white/5 opacity-60'
                            )}>
                                {/* Gateway header */}
                                <CardHeader className="p-8 border-b border-white/5">
                                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                        <div className="flex items-center gap-5">
                                            {/* Icon */}
                                            <div
                                                className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl font-black border ${gateway.classes}`}
                                            >
                                                {gateway.icon}
                                            </div>

                                            <div>
                                                <div className="flex items-center gap-3">
                                                    <h3 className="text-xl font-black text-white font-heading">{gateway.name}</h3>

                                                    {/* Status badges */}
                                                    {enabled && configuréed && (
                                                        <span className={cn(
                                                            'px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border',
                                                            sandbox
                                                                ? 'bg-[#FCD116]/10 text-[#FCD116] border-[#FCD116]/20'
                                                                : 'bg-[#008751]/10 text-[#008751] border-[#008751]/20'
                                                        )}>
                                                            {sandbox ? 'SANDBOX' : 'PRODUCTION'}
                                                        </span>
                                                    )}
                                                    {enabled && !configuréed && (
                                                        <span className="px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-widest bg-[#E8112D]/10 text-[#E8112D] border border-[#E8112D]/20">
                                                            NON CONFIGURE
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-gray-500 mt-0.5">{gateway.description}</p>
                                            </div>
                                        </div>

                                        <div className="flex flex-col items-end gap-2">
                                            <div className="flex items-center gap-4">
                                            {/* Test button */}
                                            {enabled && configuréed && (
                                                <Button
                                                    onClick={() => testGateway(gateway.id)}
                                                    disabled={testStatus === 'testing'}
                                                    variant="outline"
                                                    className={cn(
                                                        'h-11 px-5 rounded-xl text-[10px] font-black uppercase tracking-widest border gap-2 transition-all',
                                                        testStatus === 'success' ? 'border-[#008751]/30 text-[#008751]' :
                                                            testStatus === 'error' ? 'border-[#E8112D]/30 text-[#E8112D]' :
                                                                'border-white/10 text-gray-400'
                                                    )}
                                                >
                                                    {testStatus === 'testing' ? <Loader2 size={14} className="animate-spin" /> :
                                                        testStatus === 'success' ? <CheckCircle2 size={14} /> :
                                                            testStatus === 'error' ? <AlertCircle size={14} /> :
                                                                <Zap size={14} />}
                                                    {testStatus === 'testing' ? 'Test...' :
                                                        testStatus === 'success' ? 'Connecte' :
                                                            testStatus === 'error' ? 'Echec' :
                                                                'Tester'}
                                                </Button>
                                            )}

                                            {/* Enable/Disable toggle */}
                                            <button
                                                type="button"
                                                onClick={() => toggleGateway(gateway.id)}
                                                className="flex items-center gap-2 group"
                                                title={enabled ? 'Désactiver cette passerelle' : 'Activer cette passerelle'}
                                            >
                                                {enabled ? (
                                                    <ToggleRight size={40} className="text-[#008751] group-hover:text-[#008751]/80 transition-colors" />
                                                ) : (
                                                    <ToggleLeft size={40} className="text-gray-600 group-hover:text-gray-400 transition-colors" />
                                                )}
                                                <span className={cn(
                                                    'text-[10px] font-black uppercase tracking-widest',
                                                    enabled ? 'text-[#008751]' : 'text-gray-600'
                                                )}>
                                                    {enabled ? 'Active' : 'Inactive'}
                                                </span>
                                            </button>
                                            </div>{/* end flex items-center gap-4 */}

                                            {/* Message résultat du test */}
                                            {testResult.message && testStatus !== 'idle' && testStatus !== 'testing' && (
                                                <p className={cn(
                                                    'text-[10px] font-medium max-w-[280px] text-right leading-snug',
                                                    testStatus === 'success' ? 'text-[#008751]' : 'text-[#E8112D]'
                                                )}>
                                                    {testResult.message}
                                                </p>
                                            )}
                                        </div>{/* end flex flex-col items-end gap-2 */}
                                    </div>
                                </CardHeader>

                                {/* Gateway body — only visible when enabled */}
                                {enabled && (
                                    <CardContent className="p-8 space-y-6">
                                        {/* Mode toggle: Sandbox / Production */}
                                        <div className="flex items-center justify-between p-5 rounded-2xl bg-white/[0.02] border border-white/5">
                                            <div className="flex items-center gap-3">
                                                {sandbox ? (
                                                    <TestTube2 size={20} className="text-[#FCD116]" />
                                                ) : (
                                                    <Rocket size={20} className="text-[#008751]" />
                                                )}
                                                <div>
                                                    <p className="text-sm font-bold text-white">
                                                        Mode {sandbox ? 'Sandbox (Test)' : 'Production (Live)'}
                                                    </p>
                                                    <p className="text-[10px] text-gray-500">
                                                        {sandbox
                                                            ? 'Les paiements ne sont pas reels. Utilisez les numeros de test du fournisseur.'
                                                            : 'Les paiements sont reels. Les clients seront debites.'}
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => toggleSandbox(gateway.id)}
                                                className={cn(
                                                    'px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all',
                                                    sandbox
                                                        ? 'bg-[#008751]/10 text-[#008751] border-[#008751]/20 hover:bg-[#008751] hover:text-white'
                                                        : 'bg-[#FCD116]/10 text-[#FCD116] border-[#FCD116]/20 hover:bg-[#FCD116] hover:text-black'
                                                )}
                                            >
                                                {sandbox ? 'Passer en Production' : 'Passer en Sandbox'}
                                            </button>
                                        </div>

                                        {/* API fields */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {gateway.fields.map(field => (
                                                <div key={field.key} className={field.type === 'url' ? 'md:col-span-2' : ''}>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <label htmlFor={field.key} className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                                            {field.isSecret ? <Key size={10} /> : <Globe size={10} />}
                                                            {field.label}
                                                            {field.required && <span className="text-[#E8112D]">*</span>}
                                                        </label>
                                                        {field.isSecret && (
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleSecretVisibility(field.key)}
                                                                className="text-gray-600 hover:text-white transition-colors"
                                                                title={visibleSecrets[field.key] ? 'Masquer' : 'Afficher'}
                                                            >
                                                                {visibleSecrets[field.key] ? <EyeOff size={14} /> : <Eye size={14} />}
                                                            </button>
                                                        )}
                                                    </div>
                                                    <input
                                                        id={field.key}
                                                        type={field.isSecret && !visibleSecrets[field.key] ? 'password' : 'text'}
                                                        value={settings[field.key] || ''}
                                                        onChange={e => updateSetting(field.key, e.target.value)}
                                                        placeholder={field.placeholder}
                                                        className={cn(
                                                            'w-full bg-white/5 border rounded-xl py-3.5 px-4 text-white text-sm font-mono focus:outline-none transition-all',
                                                            settings[field.key] && settings[field.key].trim()
                                                                ? 'border-[#008751]/20 focus:border-[#008751]/40'
                                                                : field.required
                                                                    ? 'border-[#E8112D]/10 focus:border-[#E8112D]/30'
                                                                    : 'border-white/5 focus:border-[#FCD116]/30'
                                                        )}
                                                    />
                                                    {field.helpText && (
                                                        <p className="text-[9px] text-gray-600 mt-1.5">{field.helpText}</p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>

                                        {/* Configuration status */}
                                        <div className="flex items-center justify-between pt-4 border-t border-white/5">
                                            <div className="flex items-center gap-2">
                                                {configuréed ? (
                                                    <>
                                                        <CheckCircle2 size={16} className="text-[#008751]" />
                                                        <span className="text-xs font-bold text-[#008751]"><T>Configuration complete</T></span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <AlertCircle size={16} className="text-[#E8112D]" />
                                                        <span className="text-xs font-bold text-[#E8112D]"><T>Champs obligatoires manquants</T></span>
                                                    </>
                                                )}
                                            </div>
                                            <a
                                                href={gateway.docsUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-1.5 text-[10px] text-gray-500 hover:text-[#FCD116] transition-colors font-bold uppercase tracking-widest"
                                            >
                                                Documentation <ExternalLink size={10} />
                                            </a>
                                        </div>
                                    </CardContent>
                                )}
                            </Card>
                        </motion.div>
                    )
                })}
            </div>

            {/* Security notice */}
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 flex items-start gap-4">
                <Shield size={24} className="text-[#008751] flex-shrink-0 mt-0.5" />
                <div>
                    <p className="text-sm font-bold text-white mb-1"><T>Sécurité des Clés API</T></p>
                    <ul className="text-xs text-gray-500 space-y-1 leading-relaxed">
                        <li><T>Les cles privees et secretes ne sont jamais exposees au navigateur du client.</T></li>
                        <li><T>Toutes les vérifications de paiement sont effectuées côté serveur.</T></li>
                        <li><T>Utilisez le mode Sandbox pour tester avant de passer en Production.</T></li>
                        <li><T>Changez vos cles immediatement si vous suspectez une fuite.</T></li>
                    </ul>
                </div>
            </div>
        </div>
    )
}

export default function PaymentSettingsPage() {
    return (
        <RoleGuard allowedRoles={['superadmin']}>
            <PaymentSettingsContent />
        </RoleGuard>
    )
}
