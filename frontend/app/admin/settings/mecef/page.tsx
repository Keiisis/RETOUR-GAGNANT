'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, ShieldCheck, FloppyDisk as Save, CircleNotch as Loader2, CheckCircle as CheckCircle2, WarningCircle as AlertCircle, Plug } from '@phosphor-icons/react';

type MecefForm = {
    mecef_enabled: string
    mecef_sandbox: string
    mecef_token: string
    mecef_operator_id: string
    mecef_operator_name: string
    mecef_aib: string
    mecef_price_ttc: string
}

const DEFAULTS: MecefForm = {
    mecef_enabled: 'false',
    mecef_sandbox: 'true',
    mecef_token: '',
    mecef_operator_id: 'CAISSE',
    mecef_operator_name: 'RETOUR GAGNANT',
    mecef_aib: '',
    mecef_price_ttc: 'true',
}

const isTrue = (v: string) => v === 'true' || v === '1' || v === 'on'

// Composants définis HORS du composant page → identité stable, pas de perte de
// focus des inputs à chaque frappe.
function Toggle({ value, onChange, label, hint }: { value: string; onChange: (v: string) => void; label: string; hint?: string }) {
    const on = isTrue(value)
    return (
        <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
            <div className="pr-4">
                <p className="text-sm font-bold text-white">{label}</p>
                {hint && <p className="text-[11px] text-gray-500 mt-0.5">{hint}</p>}
            </div>
            <button type="button" onClick={() => onChange(on ? 'false' : 'true')} aria-pressed={on}
                className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${on ? 'bg-[#008751]' : 'bg-white/10'}`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${on ? 'translate-x-6' : ''}`} />
            </button>
        </div>
    )
}

function Field({ value, onChange, label, hint, type = 'text', placeholder }: { value: string; onChange: (v: string) => void; label: string; hint?: string; type?: string; placeholder?: string }) {
    return (
        <div className="mb-4">
            <label className="text-[11px] font-bold text-gray-400 mb-1 block uppercase tracking-wider">{label}</label>
            <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3 text-sm text-white focus:outline-none focus:border-[#008751]/60" />
            {hint && <p className="text-[11px] text-gray-500 mt-1">{hint}</p>}
        </div>
    )
}

export default function MecefSettingsPage() {
    const [form, setForm] = useState<MecefForm>(DEFAULTS)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [testing, setTesting] = useState(false)
    const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch('/api/admin/settings')
                const data = await res.json()
                const rows: Array<{ key: string; value: string; category: string }> = data.settings || []
                const next = { ...DEFAULTS }
                for (const r of rows) {
                    if (r.category === 'mecef' && r.key in next) {
                        (next as Record<string, string>)[r.key] = r.value ?? ''
                    }
                }
                setForm(next)
            } catch { /* garde les défauts */ }
            setLoading(false)
        })()
    }, [])

    const set = (k: keyof MecefForm) => (v: string) => setForm(f => ({ ...f, [k]: v }))

    const save = async () => {
        setSaving(true)
        setSaved(false)
        try {
            for (const [key, value] of Object.entries(form)) {
                await fetch('/api/admin/settings', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key, value, category: 'mecef' }),
                })
            }
            setSaved(true)
            setTimeout(() => setSaved(false), 2500)
        } catch { /* silencieux */ }
        setSaving(false)
    }

    const testConnection = async () => {
        setTesting(true)
        setTestResult(null)
        await save() // teste avec les valeurs à l'écran
        try {
            const res = await fetch('/api/admin/facturation/mecef/test', { method: 'POST' })
            const data = await res.json()
            if (res.ok && data.success) setTestResult({ ok: true, msg: `Connexion réussie (${data.sandbox ? 'sandbox' : 'production'}).` })
            else setTestResult({ ok: false, msg: data.error || 'Échec du test.' })
        } catch {
            setTestResult({ ok: false, msg: 'Erreur réseau lors du test.' })
        }
        setTesting(false)
    }

    return (
        <div className="max-w-2xl mx-auto p-6 space-y-6">
            <Link href="/admin/settings" className="inline-flex items-center gap-2 text-xs text-gray-500 hover:text-white transition-colors">
                <ArrowLeft size={14} /> Réglages
            </Link>

            <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#00875115', border: '1px solid #00875130' }}>
                    <ShieldCheck size={22} style={{ color: '#008751' }} />
                </div>
                <div>
                    <h1 className="text-lg font-black text-white">Normalisation e-MCF / MECeF (DGI Bénin)</h1>
                    <p className="text-xs text-gray-500">Factures normalisées automatiquement via l&apos;API SYGMEF de la DGI.</p>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin text-gray-600" size={28} /></div>
            ) : (
                <>
                    <div className="bg-[#0a0f18] border border-white/5 rounded-2xl p-6">
                        <Toggle value={form.mecef_enabled} onChange={set('mecef_enabled')} label="Activer la normalisation e-MCF" hint="Affiche le bouton « Normaliser » sur les factures." />
                        <Toggle value={form.mecef_sandbox} onChange={set('mecef_sandbox')} label="Mode test (sandbox DGI)" hint="developper.sygmef.impots.bj : sans effet fiscal. Décocher pour la production." />
                        <Toggle value={form.mecef_price_ttc} onChange={set('mecef_price_ttc')} label="Prix envoyés TTC" hint="Défaut recommandé. Décocher seulement si la DGI attend des prix HT." />
                    </div>

                    <div className="bg-[#0a0f18] border border-white/5 rounded-2xl p-6">
                        <Field value={form.mecef_token} onChange={set('mecef_token')} label="Jeton API e-MCF" type="password" placeholder="Collez le jeton du portail DGI" hint="Portail DGI → section API / Intégration. Jamais partagé publiquement." />
                        <Field value={form.mecef_operator_id} onChange={set('mecef_operator_id')} label="Identifiant opérateur / caisse" placeholder="CAISSE" />
                        <Field value={form.mecef_operator_name} onChange={set('mecef_operator_name')} label="Nom opérateur" placeholder="RETOUR GAGNANT" />
                        <Field value={form.mecef_aib} onChange={set('mecef_aib')} label="AIB (acompte impôt bénéfices)" placeholder="vide, A=1% ou B=5%" hint="Laisser vide si non applicable." />
                    </div>

                    {testResult && (
                        <div className={`rounded-xl p-3 flex items-start gap-2 text-sm ${testResult.ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                            {testResult.ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertCircle size={16} className="mt-0.5 shrink-0" />}
                            <span>{testResult.msg}</span>
                        </div>
                    )}

                    <div className="flex items-center gap-3">
                        <button onClick={save} disabled={saving}
                            className="flex-1 bg-[#008751] hover:bg-[#007445] disabled:opacity-50 text-white font-bold text-sm py-3 rounded-xl transition-all flex items-center justify-center gap-2">
                            {saving ? <Loader2 className="animate-spin" size={16} /> : saved ? <CheckCircle2 size={16} /> : <Save size={16} />}
                            {saved ? 'Enregistré' : 'Enregistrer'}
                        </button>
                        <button onClick={testConnection} disabled={testing || saving}
                            className="flex-1 border border-white/10 hover:border-white/20 disabled:opacity-50 text-white font-bold text-sm py-3 rounded-xl transition-all flex items-center justify-center gap-2">
                            {testing ? <Loader2 className="animate-spin" size={16} /> : <Plug size={16} />}
                            Tester la connexion
                        </button>
                    </div>
                    <p className="text-[11px] text-gray-600 text-center">
                        « Tester la connexion » enregistre puis appelle <span className="font-mono">GET /info</span> de la DGI pour valider le jeton.
                    </p>
                </>
            )}
        </div>
    )
}
