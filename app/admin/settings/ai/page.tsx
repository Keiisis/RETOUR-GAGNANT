'use client'

import { useList, useUpdate } from '@refinedev/core'
import { useState, useEffect } from 'react'
import {
    Brain, Key, MessageSquare, Sliders, Save,
    Loader2, Eye, EyeOff, RefreshCw, Sparkles,
    CheckCircle2, AlertTriangle, Cpu, Zap
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const PROVIDERS = [
    {
        id: 'groq',
        name: 'Groq',
        logo: '⚡',
        color: '#f97316',
        description: 'Ultra-rapide, Llama 3.3',
        models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
    },
    {
        id: 'openai',
        name: 'OpenAI (GPT)',
        logo: '🤖',
        color: '#10a37f',
        description: 'GPT-4o, GPT-4o-mini',
        models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    },
    {
        id: 'anthropic',
        name: 'Claude AI',
        logo: '🧠',
        color: '#d97706',
        description: 'Claude 3.5 Sonnet',
        models: ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307', 'claude-3-opus-20240229'],
    },
    {
        id: 'google',
        name: 'Google Gemini',
        logo: '💎',
        color: '#4285f4',
        description: 'Gemini 2.0 Flash',
        models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    },
]

export default function AIConfigPage() {
    const queryResult = useList({
        resource: 'ai_config',
        pagination: { pageSize: 1 },
        sorters: [{ field: 'id', order: 'desc' }],
    })

    const data = (queryResult as any).data || (queryResult as any).query?.data
    const isLoading = (queryResult as any).isLoading || (queryResult as any).query?.isLoading

    const { mutate: updateConfig } = useUpdate()

    const currentConfig = data?.data?.[0]

    const [form, setForm] = useState({
        provider: 'groq',
        api_key: '',
        model: 'llama-3.3-70b-versatile',
        system_prompt: '',
        personality: '',
        tone: '',
        max_tokens: 400,
        temperature: 0.7,
    })

    const [showKey, setShowKey] = useState(false)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [testing, setTesting] = useState(false)
    const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

    useEffect(() => {
        if (currentConfig) {
            setForm({
                provider: currentConfig.provider || 'groq',
                api_key: currentConfig.api_key || '',
                model: currentConfig.model || 'llama-3.3-70b-versatile',
                system_prompt: currentConfig.system_prompt || '',
                personality: currentConfig.personality || '',
                tone: currentConfig.tone || '',
                max_tokens: currentConfig.max_tokens || 400,
                temperature: parseFloat(currentConfig.temperature) || 0.7,
            })
        }
    }, [currentConfig])

    const selectedProvider = PROVIDERS.find((p) => p.id === form.provider)

    const handleSave = async () => {
        if (!currentConfig?.id) return
        setSaving(true)
        try {
            updateConfig({
                resource: 'ai_config',
                id: currentConfig.id,
                values: {
                    ...form,
                    updated_at: new Date().toISOString(),
                },
            })
            setSaved(true)
            setTimeout(() => setSaved(false), 3000)
        } finally {
            setSaving(false)
        }
    }

    const handleTest = async () => {
        setTesting(true)
        setTestResult(null)
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [{ role: 'user', content: 'Bonjour, peux-tu me dire qui tu es en une phrase ?' }],
                    context: 'admin',
                }),
            })
            const data = await response.json()
            if (response.ok && data.reply) {
                setTestResult({ ok: true, message: data.reply })
            } else {
                setTestResult({ ok: false, message: data.reply || 'Erreur de connexion' })
            }
        } catch {
            setTestResult({ ok: false, message: 'Impossible de contacter l\'API' })
        } finally {
            setTesting(false)
        }
    }

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-32 space-y-4">
                <Loader2 className="animate-spin text-[#FCD116]" size={40} />
                <p className="text-gray-500 font-mono text-sm">Chargement de la configuration IA...</p>
            </div>
        )
    }

    return (
        <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in duration-700 pb-20">
            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[#FCD116]">
                        <Brain size={18} />
                        <span className="text-[10px] font-black uppercase tracking-[0.5em]">Intelligence Artificielle</span>
                    </div>
                    <h1 className="text-5xl font-black text-white font-heading tracking-tighter">
                        ASSISTANT <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FCD116] to-[#f97316]">IA</span>
                    </h1>
                    <p className="text-gray-500 max-w-xl font-medium text-sm">
                        Configurez le cerveau IA, changez de provider, ajustez la personnalité et testez en temps réel.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        onClick={handleTest}
                        disabled={testing}
                        variant="outline"
                        className="h-14 px-6 rounded-2xl border-white/5 bg-white/5 text-gray-400 font-bold text-xs uppercase tracking-widest hover:bg-white/10"
                    >
                        {testing ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Zap size={16} className="mr-2" />}
                        TESTER L'IA
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={saving}
                        className={cn(
                            'h-14 px-8 rounded-2xl font-black tracking-widest gap-2 shadow-xl transition-all',
                            saved
                                ? 'bg-[#008751] text-white shadow-green-500/20'
                                : 'bg-benin-gradient text-white shadow-yellow-500/20'
                        )}
                    >
                        {saving ? <Loader2 size={20} className="animate-spin" /> : saved ? <CheckCircle2 size={20} /> : <Save size={20} />}
                        {saved ? 'SAUVEGARDÉ !' : 'DÉPLOYER'}
                    </Button>
                </div>
            </div>

            {/* Test Result */}
            {testResult && (
                <Card className={cn(
                    'border rounded-2xl p-6',
                    testResult.ok
                        ? 'bg-[#008751]/10 border-[#008751]/30'
                        : 'bg-red-500/10 border-red-500/30'
                )}>
                    <div className="flex items-start gap-4">
                        {testResult.ok ? (
                            <CheckCircle2 size={24} className="text-[#008751] shrink-0 mt-1" />
                        ) : (
                            <AlertTriangle size={24} className="text-red-500 shrink-0 mt-1" />
                        )}
                        <div>
                            <h4 className={cn('font-bold text-sm mb-1', testResult.ok ? 'text-[#008751]' : 'text-red-400')}>
                                {testResult.ok ? 'IA Opérationnelle ✓' : 'Erreur de connexion'}
                            </h4>
                            <p className="text-gray-400 text-sm leading-relaxed">{testResult.message}</p>
                        </div>
                    </div>
                </Card>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
                {/* Left: Provider + Config */}
                <div className="xl:col-span-8 space-y-8">
                    {/* Provider Selection */}
                    <Card className="bg-[#0a0f18] border-white/5 p-8 rounded-[2.5rem] shadow-3xl">
                        <h3 className="text-xl font-black text-white font-heading mb-6 flex items-center gap-3">
                            <Cpu size={20} className="text-[#FCD116]" /> Fournisseur IA
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {PROVIDERS.map((provider) => (
                                <button
                                    key={provider.id}
                                    onClick={() => setForm((prev) => ({ ...prev, provider: provider.id, model: provider.models[0] }))}
                                    className={cn(
                                        'relative p-6 rounded-2xl border-2 transition-all duration-300 text-left group',
                                        form.provider === provider.id
                                            ? 'border-[#FCD116] bg-[#FCD116]/5 shadow-[0_0_30px_rgba(252,209,22,0.15)]'
                                            : 'border-white/5 bg-white/[0.02] hover:border-white/20'
                                    )}
                                >
                                    <div className="text-3xl mb-3">{provider.logo}</div>
                                    <h4 className={cn(
                                        'font-black text-sm mb-1 transition-colors',
                                        form.provider === provider.id ? 'text-[#FCD116]' : 'text-white'
                                    )}>
                                        {provider.name}
                                    </h4>
                                    <p className="text-[10px] text-gray-500">{provider.description}</p>
                                    {form.provider === provider.id && (
                                        <div className="absolute top-3 right-3 w-3 h-3 rounded-full bg-[#FCD116] animate-pulse shadow-[0_0_10px_#FCD116]" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </Card>

                    {/* API Key + Model */}
                    <Card className="bg-[#0a0f18] border-white/5 p-8 rounded-[2.5rem] shadow-3xl">
                        <h3 className="text-xl font-black text-white font-heading mb-6 flex items-center gap-3">
                            <Key size={20} className="text-[#3b82f6]" /> Clé API & Modèle
                        </h3>
                        <div className="space-y-6">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em]">
                                    Clé API {selectedProvider?.name}
                                </label>
                                <div className="relative">
                                    <input
                                        type={showKey ? 'text' : 'password'}
                                        value={form.api_key}
                                        onChange={(e) => setForm((prev) => ({ ...prev, api_key: e.target.value }))}
                                        placeholder="sk-... ou gsk_..."
                                        className="w-full bg-white/5 border-2 border-white/5 rounded-2xl py-4 px-6 pr-14 text-white text-sm font-mono focus:outline-none focus:border-[#3b82f6]/40 transition-all"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowKey((p) => !p)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                                    >
                                        {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em]">
                                    Modèle IA
                                </label>
                                <select
                                    value={form.model}
                                    onChange={(e) => setForm((prev) => ({ ...prev, model: e.target.value }))}
                                    className="w-full bg-white/5 border-2 border-white/5 rounded-2xl py-4 px-6 text-white text-sm font-bold focus:outline-none appearance-none"
                                >
                                    {selectedProvider?.models.map((model) => (
                                        <option key={model} value={model}>{model}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em]">
                                        Température : {form.temperature}
                                    </label>
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.1"
                                        value={form.temperature}
                                        onChange={(e) => setForm((prev) => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                                        className="w-full accent-[#FCD116]"
                                    />
                                    <div className="flex justify-between text-[9px] text-gray-600">
                                        <span>Précis</span>
                                        <span>Créatif</span>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em]">
                                        Max Tokens
                                    </label>
                                    <input
                                        type="number"
                                        value={form.max_tokens}
                                        onChange={(e) => setForm((prev) => ({ ...prev, max_tokens: parseInt(e.target.value) || 400 }))}
                                        className="w-full bg-white/5 border-2 border-white/5 rounded-2xl py-4 px-6 text-white text-sm font-mono focus:outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* System Prompt */}
                    <Card className="bg-[#0a0f18] border-white/5 p-8 rounded-[2.5rem] shadow-3xl">
                        <h3 className="text-xl font-black text-white font-heading mb-6 flex items-center gap-3">
                            <MessageSquare size={20} className="text-[#008751]" /> Prompt Système
                        </h3>
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em]">
                                Instructions pour l'IA (comportement, connaissances, limites)
                            </label>
                            <textarea
                                value={form.system_prompt}
                                onChange={(e) => setForm((prev) => ({ ...prev, system_prompt: e.target.value }))}
                                rows={16}
                                className="w-full bg-white/5 border-2 border-white/5 rounded-2xl py-5 px-6 text-white text-sm font-mono focus:outline-none focus:border-[#008751]/40 transition-all resize-none leading-relaxed"
                                placeholder="Décrivez le comportement de l'assistant..."
                            />
                        </div>
                    </Card>
                </div>

                {/* Right: Personality + Preview */}
                <div className="xl:col-span-4 space-y-8">
                    <div className="sticky top-10 space-y-8">
                        {/* Status */}
                        <Card className="bg-[#0a0f18] border-white/5 p-8 rounded-[2.5rem] shadow-3xl">
                            <h4 className="text-lg font-black text-white font-heading mb-4 flex items-center gap-2">
                                <Sparkles size={16} className="text-[#FCD116]" /> Statut Actuel
                            </h4>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl">
                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Provider</span>
                                    <span className="text-sm font-black text-[#FCD116]">{selectedProvider?.name}</span>
                                </div>
                                <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl">
                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Modèle</span>
                                    <span className="text-[10px] font-mono text-white">{form.model}</span>
                                </div>
                                <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl">
                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Clé API</span>
                                    <span className={cn(
                                        'text-[10px] font-black uppercase px-2 py-0.5 rounded-full',
                                        form.api_key ? 'text-[#008751] bg-[#008751]/10' : 'text-red-400 bg-red-500/10'
                                    )}>
                                        {form.api_key ? '✓ Configurée' : '✗ Manquante'}
                                    </span>
                                </div>
                            </div>
                        </Card>

                        {/* Personality */}
                        <Card className="bg-[#0a0f18] border-white/5 p-8 rounded-[2.5rem] shadow-3xl">
                            <h4 className="text-lg font-black text-white font-heading mb-6 flex items-center gap-2">
                                <Sliders size={16} className="text-purple-400" /> Personnalité
                            </h4>
                            <div className="space-y-5">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em]">
                                        Traits de Personnalité
                                    </label>
                                    <input
                                        value={form.personality}
                                        onChange={(e) => setForm((prev) => ({ ...prev, personality: e.target.value }))}
                                        placeholder="Ex: Chaleureux, professionnel..."
                                        className="w-full bg-white/5 border-2 border-white/5 rounded-2xl py-4 px-6 text-white text-sm focus:outline-none"
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em]">
                                        Ton de Communication
                                    </label>
                                    <input
                                        value={form.tone}
                                        onChange={(e) => setForm((prev) => ({ ...prev, tone: e.target.value }))}
                                        placeholder="Ex: Amical et informatif"
                                        className="w-full bg-white/5 border-2 border-white/5 rounded-2xl py-4 px-6 text-white text-sm focus:outline-none"
                                    />
                                </div>
                            </div>
                        </Card>

                        {/* Context Info */}
                        <Card className="bg-[#0a0f18] border-[#FCD116]/20 p-8 rounded-[2.5rem]">
                            <h4 className="text-sm font-black text-white uppercase tracking-widest mb-4">Modes Contextuels</h4>
                            <div className="space-y-3 text-xs text-gray-500">
                                <div className="flex gap-2 items-start">
                                    <span className="w-2 h-2 rounded-full bg-[#008751] mt-1.5 shrink-0" />
                                    <span><strong className="text-white">Frontend</strong> — Ton chaleureux, pas d&apos;infos confidentielles</span>
                                </div>
                                <div className="flex gap-2 items-start">
                                    <span className="w-2 h-2 rounded-full bg-[#3b82f6] mt-1.5 shrink-0" />
                                    <span><strong className="text-white">Agent</strong> — Opérationnel, accès données, professionnel</span>
                                </div>
                                <div className="flex gap-2 items-start">
                                    <span className="w-2 h-2 rounded-full bg-[#FCD116] mt-1.5 shrink-0" />
                                    <span><strong className="text-white">Admin</strong> — Accès complet, analytique, exhaustif</span>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    )
}
