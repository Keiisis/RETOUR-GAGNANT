'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { User, Envelope as Mail, Phone, MapPin, Lock, CircleNotch as Loader2, CheckCircle as CheckCircle2, WarningCircle as AlertCircle, FloppyDisk as Save, SignOut as LogOut, Shield, Eye, EyeSlash as EyeOff } from '@phosphor-icons/react';
import { useRouter } from 'next/navigation'

interface Profile {
    id: string
    email: string
    nom: string
    prenom: string
    phone: string
    adresse: string
    ville: string
    pays: string
    created_at: string
}

export default function ClientProfilPage() {
    const router = useRouter()
    const [profile, setProfile] = useState<Profile | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [savingPwd, setSavingPwd] = useState(false)
    const [saveSuccess, setSaveSuccess] = useState(false)
    const [pwdSuccess, setPwdSuccess] = useState(false)
    const [error, setError] = useState('')
    const [pwdError, setPwdError] = useState('')
    const [loggingOut, setLoggingOut] = useState(false)

    const [form, setForm] = useState({
        nom: '', prenom: '', phone: '', adresse: '', ville: '', pays: 'France',
    })
    const [pwdForm, setPwdForm] = useState({ current: '', new: '', confirm: '' })
    const [showPwd, setShowPwd] = useState({ current: false, new: false, confirm: false })

    useEffect(() => {
        const load = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session?.user) return

            const { data } = await supabase
                .from('client_profiles')
                .select('*')
                .eq('id', session.user.id)
                .single()

            if (data) {
                setProfile({ ...data, email: session.user.email || '' })
                setForm({
                    nom: data.nom || '',
                    prenom: data.prenom || '',
                    phone: data.phone || '',
                    adresse: data.adresse || '',
                    ville: data.ville || '',
                    pays: data.pays || 'France',
                })
            }
            setLoading(false)
        }
        load()
    }, [])

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        setError('')
        try {
            const res = await fetch('/api/client/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Erreur de mise à jour.')
            setProfile(p => p ? { ...p, ...form } : p)
            setSaveSuccess(true)
            setTimeout(() => setSaveSuccess(false), 3000)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erreur.')
        }
        setSaving(false)
    }

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault()
        setPwdError('')
        if (!pwdForm.current) { setPwdError('Veuillez saisir votre mot de passe actuel.'); return }
        if (pwdForm.new !== pwdForm.confirm) { setPwdError('Les nouveaux mots de passe ne correspondent pas.'); return }
        if (pwdForm.new.length < 8) { setPwdError('Le nouveau mot de passe doit faire au moins 8 caractères.'); return }
        if (pwdForm.current === pwdForm.new) { setPwdError('Le nouveau mot de passe doit être différent de l\'actuel.'); return }

        setSavingPwd(true)
        try {
            // Vérifie le mot de passe actuel via signInWithPassword
            const { error: verifyError } = await supabase.auth.signInWithPassword({
                email: profile?.email || '',
                password: pwdForm.current,
            })
            if (verifyError) throw new Error('Mot de passe actuel incorrect.')

            // Change le mot de passe
            const { error: authError } = await supabase.auth.updateUser({ password: pwdForm.new })
            if (authError) throw new Error(authError.message)

            setPwdForm({ current: '', new: '', confirm: '' })
            setPwdSuccess(true)
            setTimeout(() => setPwdSuccess(false), 3000)
        } catch (err) {
            setPwdError(err instanceof Error ? err.message : 'Erreur.')
        }
        setSavingPwd(false)
    }

    const handleLogout = async () => {
        setLoggingOut(true)
        await supabase.auth.signOut()
        router.push('/client/login')
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="w-8 h-8 border-2 border-[var(--panel-accent)]/30 border-t-blue-500 rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="space-y-6 max-w-2xl">
            <div>
                <div className="flex items-center gap-2 mb-1">
                    <User size={14} className="text-[var(--panel-accent)]" />
                    <span className="text-[10px] font-bold text-[var(--panel-accent)] uppercase tracking-[0.3em]">Mon compte</span>
                </div>
                <h1 className="text-2xl font-black text-white">Mon Profil</h1>
                <p className="text-gray-500 text-sm mt-1">Gérez vos informations personnelles et votre sécurité.</p>
            </div>

            {/* Avatar & info résumée */}
            <div className="bg-[#0a1221] border border-white/[0.06] rounded-2xl p-5 flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-[var(--panel-accent)] flex items-center justify-center text-white font-black text-2xl flex-shrink-0">
                    {(form.prenom?.[0] || profile?.email?.[0] || 'C').toUpperCase()}
                </div>
                <div className="min-w-0">
                    <p className="font-black text-white text-lg">
                        {form.prenom || form.nom ? `${form.prenom} ${form.nom}`.trim() : 'Client'}
                    </p>
                    <p className="text-gray-500 text-sm flex items-center gap-1.5">
                        <Mail size={12} /> {profile?.email}
                    </p>
                    <p className="text-[10px] text-gray-700 mt-0.5">
                        Membre depuis {(() => {
                            if (!profile?.created_at) return '-';
                            const d = new Date(profile.created_at);
                            return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
                        })()}
                    </p>
                </div>
            </div>

            {/* Formulaire profil */}
            <div className="bg-[#0a1221] border border-white/[0.06] rounded-2xl p-5">
                <h2 className="font-black text-white text-sm mb-4 flex items-center gap-2">
                    <User size={14} className="text-[var(--panel-accent)]" /> Informations personnelles
                </h2>

                <AnimatePresence>
                    {error && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-4 overflow-hidden">
                            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/8 border border-red-500/15">
                                <AlertCircle size={13} className="text-red-400 flex-shrink-0 mt-0.5" />
                                <p className="text-red-400 text-[12px]">{error}</p>
                            </div>
                        </motion.div>
                    )}
                    {saveSuccess && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-4 overflow-hidden">
                            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/8 border border-emerald-500/20">
                                <CheckCircle2 size={13} className="text-emerald-400" />
                                <p className="text-emerald-400 text-[12px] font-bold">Profil mis à jour avec succès !</p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <form onSubmit={handleSave} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label htmlFor="clientPrenom" className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em] block mb-1.5">Prénom</label>
                            <input id="clientPrenom" type="text" value={form.prenom} onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))}
                                placeholder="Votre prénom"
                                className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-[var(--panel-accent)]/40 rounded-xl py-2.5 px-3 text-white placeholder:text-gray-600 focus:outline-none text-sm transition-colors" />
                        </div>
                        <div>
                            <label htmlFor="clientNom" className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em] block mb-1.5">Nom</label>
                            <input id="clientNom" type="text" value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                                placeholder="Votre nom"
                                className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-[var(--panel-accent)]/40 rounded-xl py-2.5 px-3 text-white placeholder:text-gray-600 focus:outline-none text-sm transition-colors" />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="clientEmail" className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em] block mb-1.5">Email</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={14} />
                            <input id="clientEmail" type="email" value={profile?.email || ''} disabled
                                className="w-full bg-white/[0.02] border border-white/[0.04] rounded-xl py-2.5 pl-9 pr-3 text-gray-500 text-sm cursor-not-allowed" />
                        </div>
                        <p className="text-[10px] text-gray-700 mt-1">L'email ne peut pas être modifié.</p>
                    </div>

                    <div>
                        <label htmlFor="clientPhone" className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em] block mb-1.5">Téléphone</label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={14} />
                            <input id="clientPhone" type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                                placeholder="+33 6 00 00 00 00"
                                className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-[var(--panel-accent)]/40 rounded-xl py-2.5 pl-9 pr-3 text-white placeholder:text-gray-600 focus:outline-none text-sm transition-colors" />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="clientAdresse" className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em] block mb-1.5">Adresse</label>
                        <div className="relative">
                            <MapPin className="absolute left-3 top-3 text-gray-600" size={14} />
                            <input id="clientAdresse" type="text" value={form.adresse} onChange={e => setForm(f => ({ ...f, adresse: e.target.value }))}
                                placeholder="Votre adresse"
                                className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-[var(--panel-accent)]/40 rounded-xl py-2.5 pl-9 pr-3 text-white placeholder:text-gray-600 focus:outline-none text-sm transition-colors" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label htmlFor="clientVille" className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em] block mb-1.5">Ville</label>
                            <input id="clientVille" type="text" value={form.ville} onChange={e => setForm(f => ({ ...f, ville: e.target.value }))}
                                placeholder="Paris"
                                className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-[var(--panel-accent)]/40 rounded-xl py-2.5 px-3 text-white placeholder:text-gray-600 focus:outline-none text-sm transition-colors" />
                        </div>
                        <div>
                            <label htmlFor="clientPays" className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em] block mb-1.5">Pays</label>
                            <input id="clientPays" type="text" value={form.pays} onChange={e => setForm(f => ({ ...f, pays: e.target.value }))}
                                placeholder="France"
                                className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-[var(--panel-accent)]/40 rounded-xl py-2.5 px-3 text-white placeholder:text-gray-600 focus:outline-none text-sm transition-colors" />
                        </div>
                    </div>

                    <motion.button type="submit" disabled={saving} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                        className="w-full bg-[var(--panel-accent)] text-white font-bold h-11 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 transition-all">
                        {saving ? <Loader2 className="animate-spin" size={16} /> : <><Save size={14} /> Enregistrer les modifications</>}
                    </motion.button>
                </form>
            </div>

            {/* Sécurité */}
            <div className="bg-[#0a1221] border border-white/[0.06] rounded-2xl p-5">
                <h2 className="font-black text-white text-sm mb-4 flex items-center gap-2">
                    <Shield size={14} className="text-[var(--panel-accent)]" /> Sécurité
                </h2>

                <AnimatePresence>
                    {pwdError && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-4 overflow-hidden">
                            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/8 border border-red-500/15">
                                <AlertCircle size={13} className="text-red-400 flex-shrink-0 mt-0.5" />
                                <p className="text-red-400 text-[12px]">{pwdError}</p>
                            </div>
                        </motion.div>
                    )}
                    {pwdSuccess && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-4 overflow-hidden">
                            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/8 border border-emerald-500/20">
                                <CheckCircle2 size={13} className="text-emerald-400" />
                                <p className="text-emerald-400 text-[12px] font-bold">Mot de passe modifié avec succès !</p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <form onSubmit={handlePasswordChange} className="space-y-3">
                    {(['current', 'new', 'confirm'] as const).map(field => (
                        <div key={field}>
                            <label htmlFor={`pwd-${field}`} className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em] block mb-1.5">
                                {field === 'current' ? 'Mot de passe actuel' : field === 'new' ? 'Nouveau mot de passe' : 'Confirmer le nouveau'}
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={14} />
                                <input
                                    id={`pwd-${field}`}
                                    type={showPwd[field] ? 'text' : 'password'}
                                    required
                                    value={pwdForm[field]}
                                    onChange={e => setPwdForm(f => ({ ...f, [field]: e.target.value }))}
                                    placeholder="••••••••"
                                    minLength={field === 'new' ? 8 : undefined}
                                    className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-[var(--panel-accent)]/40 rounded-xl py-2.5 pl-9 pr-10 text-white placeholder:text-gray-600 focus:outline-none text-sm transition-colors"
                                />
                                <button type="button" onClick={() => setShowPwd(s => ({ ...s, [field]: !s[field] }))}
                                    title={showPwd[field] ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                                    aria-label={showPwd[field] ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-[var(--panel-accent)] transition-colors" tabIndex={-1}>
                                    {showPwd[field] ? <EyeOff size={13} /> : <Eye size={13} />}
                                </button>
                            </div>
                        </div>
                    ))}

                    <motion.button type="submit" disabled={savingPwd} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                        className="w-full bg-white/[0.05] border border-white/[0.08] hover:border-[var(--panel-accent)]/30 text-white font-bold h-10 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 transition-all text-sm">
                        {savingPwd ? <Loader2 className="animate-spin" size={15} /> : <><Lock size={13} /> Modifier le mot de passe</>}
                    </motion.button>
                </form>
            </div>

            {/* Déconnexion */}
            <div className="bg-[#0a1221] border border-red-500/10 rounded-2xl p-5">
                <h2 className="font-black text-white text-sm mb-3 flex items-center gap-2">
                    <LogOut size={14} className="text-red-400" /> Déconnexion
                </h2>
                <p className="text-gray-500 text-sm mb-4">Vous serez redirigé vers la page de connexion.</p>
                <motion.button
                    whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                    onClick={handleLogout} disabled={loggingOut}
                    className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 hover:bg-red-500/15 text-red-400 font-bold px-5 h-10 rounded-xl text-sm transition-all disabled:opacity-50"
                >
                    {loggingOut ? <Loader2 className="animate-spin" size={14} /> : <><LogOut size={14} /> Se déconnecter</>}
                </motion.button>
            </div>
        </div>
    )
}
