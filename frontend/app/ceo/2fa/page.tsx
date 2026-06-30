'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Lock, ShieldCheck, ShieldOff, QrCode, Copy, CheckCircle2, AlertTriangle,
    RefreshCw, Loader2, KeyRound, Smartphone, Eye, EyeOff, Trash2,
    Clock, Globe, LogIn, X, ChevronDown, ChevronUp,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

const GOLD = '#D4AF37'; const YELLOW = '#FCD116'; const GREEN = '#008751'
const GREEN_L = '#00A86B'; const RED = '#E8112D'; const BG = '#0B1F0D'; const TEXT = '#F0EBD8'
const PANEL = '#0D2615'

function fmtDate(d: string) {
    if (!d) return '—'
    const dateObj = new Date(d)
    return isNaN(dateObj.getTime()) ? '—' : dateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function copyToClipboard(text: string, setCopied: (v: string) => void, key: string) {
    navigator.clipboard.writeText(text).then(() => {
        setCopied(key)
        setTimeout(() => setCopied(''), 2000)
    })
}

interface MfaFactor {
    id: string
    factor_type: string
    status: string
    friendly_name?: string
    created_at: string
    updated_at: string
    last_challenged_at?: string
}

interface AuthLog {
    id: string
    created_at: string
    event: string
    ip?: string
    user_agent?: string
    location?: string
    success?: boolean
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, color, icon: Icon, sub }: {
    label: string; value: string; color: string
    icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>
    sub?: string
}) {
    return (
        <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: PANEL, border: `1px solid ${color}20` }}>
            <div className="flex items-center justify-between">
                <span className="text-xs opacity-40 uppercase tracking-wider">{label}</span>
                <Icon size={14} style={{ color }} />
            </div>
            <div className="text-xl font-black" style={{ color }}>{value}</div>
            {sub && <div className="text-[11px] opacity-40">{sub}</div>}
        </div>
    )
}

// ── TOTP Setup Flow ────────────────────────────────────────────────────────────
function TotpSetup({ onCancel, onSuccess }: { onCancel: () => void; onSuccess: () => void }) {
    const [step, setStep] = useState<'enroll' | 'verify'>('enroll')
    const [qrUri, setQrUri] = useState('')
    const [secret, setSecret] = useState('')
    const [factorId, setFactorId] = useState('')
    const [code, setCode] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [showSecret, setShowSecret] = useState(false)
    const [copied, setCopied] = useState('')

    useEffect(() => {
        const enroll = async () => {
            setLoading(true)
            const { data, error: err } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'CEO Authenticator' })
            if (err || !data) { setError(err?.message || 'Erreur lors de l\'enrollment'); setLoading(false); return }
            setFactorId(data.id)
            if (data.totp) {
                setQrUri(data.totp.qr_code)
                setSecret(data.totp.secret)
            }
            setStep('verify')
            setLoading(false)
        }
        enroll()
    }, [])

    const verify = async () => {
        if (code.length !== 6) { setError('Code à 6 chiffres requis'); return }
        setLoading(true)
        setError('')
        const { data: challenge } = await supabase.auth.mfa.challenge({ factorId })
        if (!challenge) { setError('Challenge impossible'); setLoading(false); return }
        const { error: verifyErr } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code })
        if (verifyErr) { setError(verifyErr.message); setLoading(false); return }
        setLoading(false)
        onSuccess()
    }

    return (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl p-6" style={{ background: PANEL, border: `1px solid ${YELLOW}30` }}>
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                    <QrCode size={18} style={{ color: YELLOW }} />
                    <h3 className="font-black" style={{ color: YELLOW }}>Configuration TOTP</h3>
                </div>
                <button type="button" title="Annuler" onClick={onCancel} className="opacity-40 hover:opacity-70 p-1 transition-opacity"><X size={16} /></button>
            </div>

            {loading && step === 'enroll' && (
                <div className="flex items-center justify-center py-12">
                    <Loader2 size={28} className="animate-spin opacity-40" />
                </div>
            )}

            {step === 'verify' && (
                <div className="space-y-5">
                    {/* QR code (URI display) */}
                    <div>
                        <p className="text-sm opacity-60 mb-3">
                            Scannez ce QR code dans votre application d&apos;authentification (Google Authenticator, Authy, etc.)
                        </p>
                        {qrUri && (
                            <div className="flex justify-center mb-3">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={qrUri}
                                    alt="QR Code TOTP"
                                    className="w-44 h-44 rounded-xl bg-white p-2"
                                />
                            </div>
                        )}
                    </div>

                    {/* Secret manuel */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs opacity-40 uppercase tracking-wider">Clé secrète (saisie manuelle)</span>
                            <button
                                type="button"
                                title={showSecret ? 'Masquer' : 'Afficher'}
                                onClick={() => setShowSecret(s => !s)}
                                className="opacity-40 hover:opacity-70 transition-opacity"
                            >
                                {showSecret ? <EyeOff size={13} /> : <Eye size={13} />}
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 px-3 py-2 rounded-xl text-sm font-mono tracking-widest"
                                style={{ background: '#0B1F0D', border: `1px solid ${YELLOW}20`, color: YELLOW }}>
                                {showSecret ? secret : '•'.repeat(secret.length)}
                            </code>
                            <button
                                type="button"
                                title="Copier la clé"
                                onClick={() => copyToClipboard(secret, setCopied, 'secret')}
                                className="p-2 rounded-lg transition-all"
                                style={{ background: `${YELLOW}15` }}
                            >
                                {copied === 'secret'
                                    ? <CheckCircle2 size={14} style={{ color: GREEN_L }} />
                                    : <Copy size={14} style={{ color: YELLOW }} />
                                }
                            </button>
                        </div>
                    </div>

                    {/* Verification code */}
                    <div>
                        <label className="text-xs opacity-40 uppercase tracking-wider block mb-1.5">
                            Code de vérification (6 chiffres)
                        </label>
                        <div className="flex gap-2">
                            <input
                                value={code}
                                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                placeholder="000000"
                                maxLength={6}
                                className="flex-1 px-4 py-2.5 rounded-xl text-center text-lg font-black font-mono tracking-[0.5em] outline-none"
                                style={{ background: '#0B1F0D', border: `1px solid ${code.length === 6 ? GREEN_L : YELLOW}30`, color: TEXT }}
                                onKeyDown={e => e.key === 'Enter' && verify()}
                            />
                            <button
                                type="button"
                                onClick={verify}
                                disabled={loading || code.length !== 6}
                                className="px-4 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-40"
                                style={{ background: GREEN_L, color: '#fff' }}
                            >
                                {loading ? <Loader2 size={16} className="animate-spin" /> : 'Activer'}
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 text-sm rounded-xl px-3 py-2" style={{ background: `${RED}15`, color: RED }}>
                            <AlertTriangle size={14} />
                            {error}
                        </div>
                    )}
                </div>
            )}
        </motion.div>
    )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function Ceo2fa() {
    const [factors, setFactors] = useState<MfaFactor[]>([])
    const [logs, setLogs] = useState<AuthLog[]>([])
    const [loading, setLoading] = useState(true)
    const [showSetup, setShowSetup] = useState(false)
    const [deleting, setDeleting] = useState<string | null>(null)
    const [copied, setCopied] = useState('')
    const [refresh, setRefresh] = useState(0)
    const [expandLogs, setExpandLogs] = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            // Facteurs MFA actifs
            const { data: mfaData } = await supabase.auth.mfa.listFactors()
            const allFactors = [
                ...(mfaData?.totp || []),
                ...(mfaData?.phone || []),
            ] as MfaFactor[]
            setFactors(allFactors)

            // Logs d'authentification (depuis la table auth_logs si elle existe)
            const { data: logData } = await supabase
                .from('auth_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50)
            if (logData) setLogs(logData)
        } catch {
            // silent — tables can be absent
        }
        setLoading(false)
    }, [refresh])

    useEffect(() => { load() }, [load])

    const unenroll = async (factorId: string) => {
        setDeleting(factorId)
        const { error } = await supabase.auth.mfa.unenroll({ factorId })
        if (!error) setFactors(f => f.filter(x => x.id !== factorId))
        setDeleting(null)
    }

    const verifiedFactors = factors.filter(f => f.status === 'verified')
    const pendingFactors  = factors.filter(f => f.status === 'unverified')
    const isProtected     = verifiedFactors.length > 0
    const scoreColor      = isProtected ? GREEN_L : RED

    return (
        <div className="min-h-screen p-6 lg:p-8" style={{ background: BG, color: TEXT }}>
            {/* ── Header ── */}
            <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between mb-8">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${YELLOW}20` }}>
                            <Lock size={18} style={{ color: YELLOW }} />
                        </div>
                        <h1 className="text-2xl font-black tracking-tight">Authentification à 2 Facteurs</h1>
                    </div>
                    <p className="text-sm opacity-50">Protection avancée de votre accès CEO</p>
                </div>
                <button
                    type="button"
                    onClick={() => setRefresh(r => r + 1)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-80 transition-all"
                    style={{ background: `${GREEN}25`, color: GREEN_L }}
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualiser
                </button>
            </motion.div>

            {/* ── Status banner ── */}
            <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-3xl p-6 mb-6 flex items-center gap-5"
                style={{ background: PANEL, border: `2px solid ${scoreColor}35` }}
            >
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${scoreColor}18`, border: `2px solid ${scoreColor}` }}>
                    {isProtected
                        ? <ShieldCheck size={28} style={{ color: scoreColor }} />
                        : <ShieldOff size={28} style={{ color: scoreColor }} />
                    }
                </div>
                <div className="flex-1">
                    <div className="text-lg font-black mb-1" style={{ color: scoreColor }}>
                        {isProtected ? '2FA Activé — Compte sécurisé' : '2FA Désactivé — Compte vulnérable'}
                    </div>
                    <p className="text-sm opacity-50">
                        {isProtected
                            ? `${verifiedFactors.length} facteur${verifiedFactors.length > 1 ? 's' : ''} enregistré${verifiedFactors.length > 1 ? 's' : ''}. Votre compte est protégé contre les accès non autorisés.`
                            : 'Activez l\'authentification à deux facteurs pour protéger votre espace CEO.'}
                    </p>
                </div>
                {!isProtected && (
                    <button
                        type="button"
                        onClick={() => setShowSetup(true)}
                        className="px-5 py-2.5 rounded-xl font-bold text-sm transition-all hover:opacity-90 flex-shrink-0"
                        style={{ background: `linear-gradient(135deg, ${YELLOW}, ${GOLD})`, color: '#1a2332' }}
                    >
                        Activer le 2FA
                    </button>
                )}
            </motion.div>

            {/* ── Stats ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <StatCard label="Facteurs actifs" value={String(verifiedFactors.length)} color={isProtected ? GREEN_L : RED} icon={ShieldCheck} />
                <StatCard label="En attente" value={String(pendingFactors.length)} color={YELLOW} icon={Clock} />
                <StatCard label="Logins récents" value={String(logs.length)} color={GOLD} icon={LogIn} sub="Derniers enregistrés" />
                <StatCard label="Niveau sécurité" value={isProtected ? 'FORT' : 'FAIBLE'} color={scoreColor} icon={KeyRound} />
            </div>

            {/* ── Setup flow ── */}
            <AnimatePresence>
                {showSetup && (
                    <div className="mb-6">
                        <TotpSetup
                            onCancel={() => setShowSetup(false)}
                            onSuccess={() => { setShowSetup(false); setRefresh(r => r + 1) }}
                        />
                    </div>
                )}
            </AnimatePresence>

            {/* ── Facteurs enregistrés ── */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
                className="rounded-2xl overflow-hidden mb-5" style={{ background: PANEL, border: `1px solid ${GOLD}15` }}>
                <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: `${GOLD}15` }}>
                    <h2 className="font-bold text-sm" style={{ color: GOLD }}>Facteurs enregistrés</h2>
                    {isProtected && (
                        <button
                            type="button"
                            onClick={() => setShowSetup(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                            style={{ background: `${YELLOW}15`, color: YELLOW }}
                        >
                            + Ajouter un facteur
                        </button>
                    )}
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 size={24} className="animate-spin opacity-40" />
                    </div>
                ) : factors.length === 0 ? (
                    <div className="py-12 text-center">
                        <ShieldOff size={32} className="mx-auto mb-3 opacity-20" />
                        <p className="opacity-30 text-sm">Aucun facteur enregistré</p>
                        <button
                            type="button"
                            onClick={() => setShowSetup(true)}
                            className="mt-4 px-5 py-2 rounded-xl font-bold text-sm transition-all hover:opacity-90"
                            style={{ background: `${YELLOW}15`, color: YELLOW }}
                        >
                            Configurer le 2FA maintenant
                        </button>
                    </div>
                ) : (
                    <div className="divide-y" style={{ borderColor: `${GOLD}08` }}>
                        {factors.map(f => (
                            <div key={f.id} className="px-5 py-4 flex items-center gap-4 hover:bg-white/[0.02] transition-colors">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                    style={{ background: f.status === 'verified' ? `${GREEN_L}18` : `${YELLOW}18` }}>
                                    {f.factor_type === 'totp'
                                        ? <Smartphone size={18} style={{ color: f.status === 'verified' ? GREEN_L : YELLOW }} />
                                        : <KeyRound size={18} style={{ color: f.status === 'verified' ? GREEN_L : YELLOW }} />
                                    }
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold text-sm truncate">
                                        {f.friendly_name || (f.factor_type === 'totp' ? 'Application Authenticator' : 'SMS / Téléphone')}
                                    </div>
                                    <div className="text-xs opacity-40 mt-0.5">
                                        {f.factor_type.toUpperCase()} · Enregistré le {fmtDate(f.created_at)}
                                    </div>
                                </div>
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex-shrink-0"
                                    style={{
                                        background: f.status === 'verified' ? `${GREEN_L}18` : `${YELLOW}18`,
                                        color: f.status === 'verified' ? GREEN_L : YELLOW
                                    }}>
                                    {f.status === 'verified' ? 'Actif' : 'En attente'}
                                </span>
                                <button
                                    type="button"
                                    title="Supprimer ce facteur"
                                    onClick={() => unenroll(f.id)}
                                    disabled={deleting === f.id}
                                    className="p-2 rounded-lg transition-all hover:opacity-80 disabled:opacity-40 flex-shrink-0"
                                    style={{ background: `${RED}15` }}
                                >
                                    {deleting === f.id
                                        ? <Loader2 size={14} className="animate-spin" style={{ color: RED }} />
                                        : <Trash2 size={14} style={{ color: RED }} />
                                    }
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </motion.div>

            {/* ── Auth log ── */}
            {logs.length > 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}
                    className="rounded-2xl overflow-hidden" style={{ background: PANEL, border: `1px solid ${GOLD}15` }}>
                    <button
                        type="button"
                        className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                        onClick={() => setExpandLogs(v => !v)}
                    >
                        <div className="flex items-center gap-2">
                            <Globe size={14} style={{ color: GOLD }} />
                            <h2 className="font-bold text-sm" style={{ color: GOLD }}>Historique des connexions</h2>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: `${GOLD}15`, color: GOLD }}>
                                {logs.length}
                            </span>
                        </div>
                        {expandLogs ? <ChevronUp size={14} className="opacity-40" /> : <ChevronDown size={14} className="opacity-40" />}
                    </button>

                    <AnimatePresence>
                        {expandLogs && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.25 }}
                                className="overflow-hidden"
                            >
                                <div className="border-t" style={{ borderColor: `${GOLD}10` }}>
                                    {logs.slice(0, 20).map(log => (
                                        <div key={log.id}
                                            className="px-5 py-3 flex items-center gap-3 text-sm border-b hover:bg-white/[0.02] transition-colors"
                                            style={{ borderColor: `${GOLD}06` }}>
                                            <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                                                style={{ background: log.success !== false ? `${GREEN_L}18` : `${RED}18` }}>
                                                <LogIn size={12} style={{ color: log.success !== false ? GREEN_L : RED }} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <span className="font-medium">{log.event || 'Connexion'}</span>
                                                {log.ip && <span className="ml-2 opacity-40 text-xs font-mono">{log.ip}</span>}
                                            </div>
                                            <span className="text-xs opacity-40 flex-shrink-0">{fmtDate(log.created_at)}</span>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            )}

            {/* ── Tips ── */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                className="mt-5 rounded-2xl p-5" style={{ background: `${YELLOW}0A`, border: `1px dashed ${YELLOW}25` }}>
                <div className="flex items-start gap-3">
                    <AlertTriangle size={16} style={{ color: YELLOW }} className="flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="font-bold text-sm mb-1" style={{ color: YELLOW }}>Recommandations de sécurité</p>
                        <ul className="text-xs opacity-50 space-y-1 list-disc list-inside">
                            <li>Utilisez Google Authenticator, Authy ou Bitwarden pour le 2FA TOTP</li>
                            <li>Ne partagez jamais votre clé secrète avec qui que ce soit</li>
                            <li>Conservez vos codes de secours dans un endroit sûr et hors ligne</li>
                            <li>Activez le 2FA sur tous vos comptes administrateurs</li>
                        </ul>
                    </div>
                </div>
            </motion.div>
        </div>
    )
}
