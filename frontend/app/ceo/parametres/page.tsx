'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Settings, Save, RefreshCw, Loader2, CheckCircle2, AlertTriangle,
    Building2, Bell, Globe, CreditCard, Shield, Mail,
    Eye, EyeOff, Copy, Palette, Smartphone, ChevronDown, ChevronUp,
    Link, Database, Cpu, X,
} from 'lucide-react'

const GOLD = '#D4AF37'; const YELLOW = '#FCD116'; const GREEN = '#008751'
const GREEN_L = '#00A86B'; const RED = '#E8112D'; const BG = '#0B1F0D'; const TEXT = '#F0EBD8'
const PANEL = '#0D2615'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Setting { key: string; value: string; category?: string }
interface Toast { id: number; type: 'success' | 'error'; msg: string }

// ─── Section config ───────────────────────────────────────────────────────────
const SECTIONS = [
    {
        id: 'identity',
        label: 'Identité de la plateforme',
        icon: Building2,
        color: GOLD,
        fields: [
            { key: 'site_name',        label: 'Nom du site',         type: 'text',  placeholder: 'Retour Gagnant' },
            { key: 'site_tagline',     label: 'Accroche',            type: 'text',  placeholder: 'Votre passerelle vers le Bénin' },
            { key: 'site_url',         label: 'URL du site',         type: 'url',   placeholder: 'https://retour-gagnant.com' },
            { key: 'contact_email',    label: 'Email de contact',    type: 'email', placeholder: 'contact@retour-gagnant.com' },
            { key: 'contact_phone',    label: 'Téléphone',           type: 'text',  placeholder: '+229 ...' },
            { key: 'contact_whatsapp', label: 'WhatsApp',            type: 'text',  placeholder: '+229 ...' },
            { key: 'address',          label: 'Adresse',             type: 'text',  placeholder: 'Cotonou, Bénin' },
        ],
    },
    {
        id: 'appearance',
        label: 'Apparence & Marque',
        icon: Palette,
        color: '#a78bfa',
        fields: [
            { key: 'logo_url',         label: 'URL du Logo',         type: 'url',   placeholder: 'https://...' },
            { key: 'favicon_url',      label: 'Favicon URL',         type: 'url',   placeholder: 'https://...' },
            { key: 'og_image_url',     label: 'Image OG (partage)',  type: 'url',   placeholder: 'https://...' },
            { key: 'primary_color',    label: 'Couleur principale',  type: 'color', placeholder: '#008751' },
            { key: 'secondary_color',  label: 'Couleur secondaire',  type: 'color', placeholder: '#FCD116' },
        ],
    },
    {
        id: 'email',
        label: 'Emails & Notifications',
        icon: Mail,
        color: '#38bdf8',
        fields: [
            { key: 'smtp_host',        label: 'Serveur SMTP',        type: 'text',  placeholder: 'smtp.sendgrid.net' },
            { key: 'smtp_port',        label: 'Port SMTP',           type: 'text',  placeholder: '587' },
            { key: 'smtp_user',        label: 'Utilisateur SMTP',    type: 'text',  placeholder: 'apikey' },
            { key: 'smtp_password',    label: 'Mot de passe SMTP',   type: 'password', placeholder: '••••••••' },
            { key: 'email_from_name',  label: 'Nom expéditeur',      type: 'text',  placeholder: 'Retour Gagnant' },
            { key: 'email_from',       label: 'Email expéditeur',    type: 'email', placeholder: 'no-reply@retour-gagnant.com' },
            { key: 'notify_on_order',  label: 'Notif. nouvelles commandes', type: 'text', placeholder: 'admin@...' },
            { key: 'notify_on_lead',   label: 'Notif. nouveaux leads',      type: 'text', placeholder: 'admin@...' },
        ],
    },
    {
        id: 'notifications',
        label: 'Alertes & Push',
        icon: Bell,
        color: YELLOW,
        fields: [
            { key: 'whatsapp_notify_number', label: 'Numéro WhatsApp alertes', type: 'text', placeholder: '+229 ...' },
            { key: 'telegram_bot_token',     label: 'Token Bot Telegram',      type: 'password', placeholder: '••••••••' },
            { key: 'telegram_chat_id',       label: 'Chat ID Telegram',        type: 'text', placeholder: '-100...' },
            { key: 'slack_webhook_url',      label: 'Webhook Slack',           type: 'url',  placeholder: 'https://hooks.slack.com/...' },
        ],
    },
    {
        id: 'localisation',
        label: 'Localisation & Devise',
        icon: Globe,
        color: GREEN_L,
        fields: [
            { key: 'default_currency', label: 'Devise par défaut',  type: 'text', placeholder: 'XOF' },
            { key: 'default_language', label: 'Langue par défaut',  type: 'text', placeholder: 'fr' },
            { key: 'timezone',         label: 'Fuseau horaire',     type: 'text', placeholder: 'Africa/Porto-Novo' },
            { key: 'country_code',     label: 'Code pays',          type: 'text', placeholder: 'BJ' },
        ],
    },
    {
        id: 'billing',
        label: 'Facturation & TVA',
        icon: CreditCard,
        color: GOLD,
        fields: [
            { key: 'company_name',     label: 'Nom légal',          type: 'text', placeholder: 'Retour Gagnant SARL' },
            { key: 'tax_id',           label: 'NIF / IFU',          type: 'text', placeholder: '0000000000' },
            { key: 'rccm',             label: 'RCCM',               type: 'text', placeholder: 'RB/COT/...' },
            { key: 'invoice_footer',   label: 'Pied de facture',    type: 'text', placeholder: 'Merci pour votre confiance.' },
            { key: 'vat_rate',         label: 'Taux TVA (%)',       type: 'text', placeholder: '18' },
        ],
    },
    {
        id: 'security',
        label: 'Sécurité & Accès',
        icon: Shield,
        color: RED,
        fields: [
            { key: 'session_timeout',       label: 'Timeout session (min)', type: 'text', placeholder: '30' },
            { key: 'max_login_attempts',    label: 'Tentatives max login',  type: 'text', placeholder: '5' },
            { key: 'ip_whitelist',          label: 'IP whitelist (virgule)',type: 'text', placeholder: '196.168.0.1, ...' },
            { key: 'maintenance_mode',      label: 'Mode maintenance',      type: 'text', placeholder: 'false' },
            { key: 'maintenance_message',   label: 'Message maintenance',   type: 'text', placeholder: 'Site en maintenance...' },
        ],
    },
    {
        id: 'integrations',
        label: 'Intégrations & APIs',
        icon: Link,
        color: '#f97316',
        fields: [
            { key: 'google_analytics_id',  label: 'Google Analytics ID',   type: 'text', placeholder: 'G-XXXXXXXXXX' },
            { key: 'facebook_pixel_id',    label: 'Facebook Pixel ID',      type: 'text', placeholder: '00000000000' },
            { key: 'google_maps_api_key',  label: 'Google Maps API Key',    type: 'password', placeholder: '••••••••' },
            { key: 'recaptcha_site_key',   label: 'reCAPTCHA Site Key',     type: 'text', placeholder: '6Le...' },
            { key: 'recaptcha_secret_key', label: 'reCAPTCHA Secret Key',   type: 'password', placeholder: '••••••••' },
        ],
    },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function FieldInput({
    value, type, placeholder, onChange, id
}: {
    value: string; type: string; placeholder: string
    onChange: (v: string) => void; id: string
}) {
    const [show, setShow] = useState(false)
    const isPassword = type === 'password'
    const isColor    = type === 'color'

    if (isColor) {
        return (
            <div className="flex items-center gap-3">
                <input
                    type="color"
                    value={value || placeholder}
                    onChange={e => onChange(e.target.value)}
                    className="w-10 h-10 rounded-lg cursor-pointer border-0 bg-transparent"
                />
                <input
                    type="text"
                    id={id}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none font-mono"
                    style={{ background: '#0B1F0D', border: `1px solid ${GOLD}20`, color: TEXT }}
                />
            </div>
        )
    }

    return (
        <div className="relative">
            <input
                id={id}
                type={isPassword ? (show ? 'text' : 'password') : type === 'color' ? 'text' : type}
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none pr-8"
                style={{ background: '#0B1F0D', border: `1px solid ${GOLD}20`, color: TEXT }}
            />
            {isPassword && (
                <button
                    type="button"
                    title={show ? 'Masquer' : 'Afficher'}
                    onClick={() => setShow(s => !s)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-70 transition-opacity"
                >
                    {show ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
            )}
        </div>
    )
}

// ─── Accordion Section ────────────────────────────────────────────────────────
function Section({
    section, settings, onChange, onSave, saving
}: {
    section: typeof SECTIONS[0]
    settings: Record<string, string>
    onChange: (key: string, value: string) => void
    onSave: (sectionId: string) => void
    saving: boolean
}) {
    const [open, setOpen] = useState(section.id === 'identity')
    const Icon = section.icon

    // Count modified fields in this section
    const isDirty = section.fields.some(f =>
        settings[f.key] !== undefined && settings[`__orig_${f.key}`] !== settings[f.key]
    )

    return (
        <div className="rounded-2xl overflow-hidden" style={{ background: PANEL, border: `1px solid ${section.color}18` }}>
            <button
                type="button"
                className="w-full px-5 py-4 flex items-center gap-3 hover:bg-white/[0.02] transition-colors"
                onClick={() => setOpen(v => !v)}
            >
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `${section.color}18` }}>
                    <Icon size={14} style={{ color: section.color }} />
                </div>
                <span className="font-bold text-sm flex-1 text-left">{section.label}</span>
                {isDirty && (
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: YELLOW }} />
                )}
                {open ? <ChevronUp size={14} className="opacity-40 flex-shrink-0" /> : <ChevronDown size={14} className="opacity-40 flex-shrink-0" />}
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden"
                    >
                        <div className="px-5 pb-5 border-t" style={{ borderColor: `${section.color}12` }}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                {section.fields.map(f => (
                                    <div key={f.key} className="space-y-1.5">
                                        <label htmlFor={`field-${f.key}`} className="text-xs opacity-40 uppercase tracking-wider font-bold block">
                                            {f.label}
                                        </label>
                                        <FieldInput
                                            id={`field-${f.key}`}
                                            value={settings[f.key] || ''}
                                            type={f.type}
                                            placeholder={f.placeholder}
                                            onChange={v => onChange(f.key, v)}
                                        />
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-end mt-5">
                                <button
                                    type="button"
                                    onClick={() => onSave(section.id)}
                                    disabled={saving}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all disabled:opacity-50 hover:opacity-90"
                                    style={{ background: `linear-gradient(135deg, ${section.color}, ${section.color}cc)`, color: '#0B1F0D' }}
                                >
                                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                    Enregistrer
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function CeoParametres() {
    const [settings, setSettings] = useState<Record<string, string>>({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [toasts, setToasts] = useState<Toast[]>([])
    const [refresh, setRefresh] = useState(0)
    const [sysInfo, setSysInfo] = useState<Record<string, string>>({})

    const addToast = useCallback((type: 'success' | 'error', msg: string) => {
        const id = Date.now()
        setToasts(t => [...t, { id, type, msg }])
        setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000)
    }, [])

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/ceo/settings')
            if (res.ok) {
                const data = await res.json()
                const map: Record<string, string> = {}
                ;(data.settings || []).forEach((s: Setting) => {
                    map[s.key] = s.value || ''
                    map[`__orig_${s.key}`] = s.value || ''
                })
                setSettings(map)
            }
        } catch {
            // silent
        }

        // Infos système
        setSysInfo({
            'Node Env':    process.env.NODE_ENV || 'production',
            'Next.js':     '15.x',
            'Date serveur': new Date().toLocaleString('fr-FR'),
            'Timezone':    Intl.DateTimeFormat().resolvedOptions().timeZone,
        })

        setLoading(false)
    }, [refresh])

    useEffect(() => { load() }, [load])

    const handleChange = (key: string, value: string) => {
        setSettings(prev => ({ ...prev, [key]: value }))
    }

    const handleSave = async (sectionId: string) => {
        const section = SECTIONS.find(s => s.id === sectionId)
        if (!section) return

        setSaving(true)
        const category = sectionId

        try {
            const keys = section.fields.map(f => f.key)
            const promises = keys.map(key => {
                const value = settings[key] || ''
                return fetch('/api/ceo/settings', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key, value, category }),
                })
            })

            const results = await Promise.all(promises)
            const allOk = results.every(r => r.ok)

            if (allOk) {
                // Mettre à jour les origines
                setSettings(prev => {
                    const next = { ...prev }
                    keys.forEach(k => { next[`__orig_${k}`] = next[k] || '' })
                    return next
                })
                addToast('success', `Section "${section.label}" sauvegardée`)
            } else {
                addToast('error', 'Erreur lors de la sauvegarde de certains paramètres')
            }
        } catch {
            addToast('error', 'Erreur réseau')
        }

        setSaving(false)
    }

    const allKeys = SECTIONS.flatMap(s => s.fields.map(f => f.key))
    const dirtyCount = allKeys.filter(k => settings[k] !== settings[`__orig_${k}`] && settings[k] !== undefined).length

    return (
        <div className="min-h-screen p-6 lg:p-8" style={{ background: BG, color: TEXT }}>
            {/* ── Toasts ── */}
            <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
                <AnimatePresence>
                    {toasts.map(t => (
                        <motion.div
                            key={t.id}
                            initial={{ opacity: 0, x: 60 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 60 }}
                            className="pointer-events-auto flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold shadow-xl"
                            style={{
                                background: t.type === 'success' ? `${GREEN_L}22` : `${RED}22`,
                                border: `1px solid ${t.type === 'success' ? GREEN_L : RED}40`,
                                color: t.type === 'success' ? GREEN_L : RED,
                            }}
                        >
                            {t.type === 'success' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                            {t.msg}
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* ── Header ── */}
            <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between mb-8">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${GOLD}20` }}>
                            <Settings size={18} style={{ color: GOLD }} />
                        </div>
                        <h1 className="text-2xl font-black tracking-tight">Paramètres Généraux</h1>
                    </div>
                    <p className="text-sm opacity-50">Configuration globale de la plateforme</p>
                </div>
                <div className="flex items-center gap-3">
                    {dirtyCount > 0 && (
                        <span className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: `${YELLOW}15`, color: YELLOW }}>
                            {dirtyCount} champ{dirtyCount > 1 ? 's' : ''} modifié{dirtyCount > 1 ? 's' : ''}
                        </span>
                    )}
                    <button
                        type="button"
                        onClick={() => setRefresh(r => r + 1)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-80 transition-all"
                        style={{ background: `${GREEN}25`, color: GREEN_L }}
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualiser
                    </button>
                </div>
            </motion.div>

            {loading ? (
                <div className="flex items-center justify-center py-24">
                    <Loader2 size={32} className="animate-spin opacity-40" />
                </div>
            ) : (
                <div className="space-y-3">
                    {SECTIONS.map(section => (
                        <motion.div
                            key={section.id}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: SECTIONS.indexOf(section) * 0.04 }}
                        >
                            <Section
                                section={section}
                                settings={settings}
                                onChange={handleChange}
                                onSave={handleSave}
                                saving={saving}
                            />
                        </motion.div>
                    ))}

                    {/* ── System info ── */}
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: SECTIONS.length * 0.04 }}
                        className="rounded-2xl overflow-hidden"
                        style={{ background: PANEL, border: `1px solid ${GOLD}10` }}
                    >
                        <div className="px-5 py-4 flex items-center gap-3 border-b" style={{ borderColor: `${GOLD}10` }}>
                            <Cpu size={14} style={{ color: GOLD }} />
                            <h2 className="font-bold text-sm" style={{ color: GOLD }}>Informations système</h2>
                        </div>
                        <div className="px-5 py-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                            {Object.entries(sysInfo).map(([k, v]) => (
                                <div key={k}>
                                    <div className="text-[10px] opacity-40 uppercase tracking-wider mb-1">{k}</div>
                                    <div className="text-sm font-bold font-mono" style={{ color: GREEN_L }}>{v}</div>
                                </div>
                            ))}
                        </div>
                    </motion.div>

                    {/* ── Danger zone ── */}
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: (SECTIONS.length + 1) * 0.04 }}
                        className="rounded-2xl p-5"
                        style={{ background: `${RED}08`, border: `1px dashed ${RED}25` }}
                    >
                        <div className="flex items-start gap-3">
                            <AlertTriangle size={16} style={{ color: RED }} className="flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <p className="font-black text-sm mb-1" style={{ color: RED }}>Zone dangereuse</p>
                                <p className="text-xs opacity-50 mb-3">
                                    Ces actions sont irréversibles. Assurez-vous d&apos;avoir une sauvegarde avant de procéder.
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        className="px-4 py-2 rounded-xl text-xs font-bold border transition-all hover:opacity-80"
                                        style={{ borderColor: `${RED}30`, color: RED, background: `${RED}10` }}
                                        onClick={() => {
                                            if (confirm('Vider le cache serveur ?')) addToast('success', 'Cache vidé')
                                        }}
                                    >
                                        Vider le cache
                                    </button>
                                    <button
                                        type="button"
                                        className="px-4 py-2 rounded-xl text-xs font-bold border transition-all hover:opacity-80"
                                        style={{ borderColor: `${RED}30`, color: RED, background: `${RED}10` }}
                                        onClick={() => {
                                            if (confirm('Activer le mode maintenance ? Le site sera inaccessible aux clients.')) {
                                                handleChange('maintenance_mode', 'true')
                                                handleSave('security')
                                            }
                                        }}
                                    >
                                        Activer maintenance
                                    </button>
                                    <button
                                        type="button"
                                        className="px-4 py-2 rounded-xl text-xs font-bold border transition-all hover:opacity-80"
                                        style={{ borderColor: `${RED}30`, color: RED, background: `${RED}10` }}
                                        onClick={() => {
                                            if (confirm('Exporter toutes les configurations ?')) addToast('success', 'Export en cours...')
                                        }}
                                    >
                                        Exporter la config
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    )
}
