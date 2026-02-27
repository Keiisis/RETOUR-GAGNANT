'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import {
    User, Mail, Lock, Save, CheckCircle2,
    AlertCircle, Eye, EyeOff, Shield, Loader2
} from 'lucide-react'

export default function AgentProfilePage() {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [success, setSuccess] = useState('')
    const [error, setError] = useState('')

    // Profile info
    const [email, setEmail] = useState('')
    const [fullName, setFullName] = useState('')
    const [role, setRole] = useState('')
    const [createdAt, setCreatedAt] = useState('')

    // Password change
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showCurrentPass, setShowCurrentPass] = useState(false)
    const [showNewPass, setShowNewPass] = useState(false)
    const [showConfirmPass, setShowConfirmPass] = useState(false)
    const [changingPassword, setChangingPassword] = useState(false)

    // New email
    const [newEmail, setNewEmail] = useState('')
    const [changingEmail, setChangingEmail] = useState(false)

    useEffect(() => {
        const fetchProfile = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            setEmail(user.email || '')
            setCreatedAt(user.created_at || '')

            const { data: profile } = await supabase
                .from('user_profiles')
                .select('full_name, role')
                .eq('id', user.id)
                .single()

            if (profile) {
                setFullName(profile.full_name || '')
                setRole(profile.role || '')
            }

            setLoading(false)
        }
        fetchProfile()
    }, [])

    const handleUpdateProfile = async () => {
        setSaving(true)
        setError('')
        setSuccess('')

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Non authentifié')

            const { error: updateError } = await supabase
                .from('user_profiles')
                .update({ full_name: fullName })
                .eq('id', user.id)

            if (updateError) throw updateError

            setSuccess('Profil mis à jour avec succès !')
            setTimeout(() => setSuccess(''), 3000)
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Erreur inconnue'
            setError(message)
        } finally {
            setSaving(false)
        }
    }

    const handleChangeEmail = async () => {
        if (!newEmail.trim()) return
        setChangingEmail(true)
        setError('')
        setSuccess('')

        try {
            const { error: emailError } = await supabase.auth.updateUser({
                email: newEmail
            })

            if (emailError) throw emailError

            setSuccess('Un email de confirmation a été envoyé à votre nouvelle adresse. Vérifiez votre boîte de réception.')
            setNewEmail('')
            setTimeout(() => setSuccess(''), 5000)
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Erreur inconnue'
            setError(message)
        } finally {
            setChangingEmail(false)
        }
    }

    const handleChangePassword = async () => {
        if (newPassword !== confirmPassword) {
            setError('Les mots de passe ne correspondent pas.')
            return
        }
        if (newPassword.length < 8) {
            setError('Le mot de passe doit contenir au moins 8 caractères.')
            return
        }

        setChangingPassword(true)
        setError('')
        setSuccess('')

        try {
            // Re-authenticate with current password first
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password: currentPassword,
            })

            if (signInError) {
                setError('Mot de passe actuel incorrect.')
                setChangingPassword(false)
                return
            }

            // Update password
            const { error: updateError } = await supabase.auth.updateUser({
                password: newPassword
            })

            if (updateError) throw updateError

            setSuccess('Mot de passe modifié avec succès !')
            setCurrentPassword('')
            setNewPassword('')
            setConfirmPassword('')
            setTimeout(() => setSuccess(''), 3000)
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Erreur inconnue'
            setError(message)
        } finally {
            setChangingPassword(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="space-y-6 max-w-3xl">
            {/* Header */}
            <div>
                <div className="flex items-center gap-2 mb-1">
                    <User size={16} className="text-emerald-400" />
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.3em]">Compte</span>
                </div>
                <h1 className="text-2xl font-black text-white">Mon Profil</h1>
                <p className="text-gray-500 text-sm mt-1">Gérez vos informations personnelles et votre sécurité</p>
            </div>

            {/* Alerts */}
            {success && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3"
                >
                    <CheckCircle2 size={18} className="text-emerald-400 flex-shrink-0" />
                    <p className="text-sm text-emerald-300">{success}</p>
                </motion.div>
            )}
            {error && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3"
                >
                    <AlertCircle size={18} className="text-red-400 flex-shrink-0" />
                    <p className="text-sm text-red-300">{error}</p>
                </motion.div>
            )}

            {/* Profile Info Card */}
            <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6">
                <h2 className="text-sm font-bold text-white mb-5 flex items-center gap-2">
                    <User size={14} className="text-emerald-400" /> Informations Personnelles
                </h2>

                <div className="space-y-4">
                    <div>
                        <label className="text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-1.5 block">
                            Nom Complet
                        </label>
                        <input
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="Votre nom complet"
                            title="Nom complet"
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 text-sm"
                        />
                    </div>

                    <div>
                        <label className="text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-1.5 block">
                            Email Actuel
                        </label>
                        <div className="bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-gray-400 text-sm flex items-center gap-2">
                            <Mail size={14} className="text-emerald-400" />
                            {email}
                        </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1.5">
                            <Shield size={12} className="text-emerald-400" />
                            Rôle : <strong className="text-white uppercase">{role}</strong>
                        </span>
                        <span>
                            Membre depuis : {new Date(createdAt).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </span>
                    </div>

                    <button
                        onClick={handleUpdateProfile}
                        disabled={saving}
                        className="flex items-center gap-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-500/30 transition-all disabled:opacity-50"
                    >
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        Sauvegarder le Profil
                    </button>
                </div>
            </div>

            {/* Change Email Card */}
            <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6">
                <h2 className="text-sm font-bold text-white mb-5 flex items-center gap-2">
                    <Mail size={14} className="text-blue-400" /> Changer mon Email
                </h2>

                <div className="space-y-4">
                    <div>
                        <label className="text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-1.5 block">
                            Nouvel Email
                        </label>
                        <input
                            type="email"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            placeholder="nouveau@email.com"
                            title="Nouvel email"
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50 text-sm"
                        />
                    </div>

                    <p className="text-[11px] text-gray-500">
                        Un email de confirmation sera envoyé à la nouvelle adresse. Vous devrez cliquer sur le lien pour finaliser le changement.
                    </p>

                    <button
                        onClick={handleChangeEmail}
                        disabled={changingEmail || !newEmail.trim()}
                        className="flex items-center gap-2 bg-blue-500/20 text-blue-400 border border-blue-500/30 px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-500/30 transition-all disabled:opacity-50"
                    >
                        {changingEmail ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                        Changer mon Email
                    </button>
                </div>
            </div>

            {/* Change Password Card */}
            <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6">
                <h2 className="text-sm font-bold text-white mb-5 flex items-center gap-2">
                    <Lock size={14} className="text-amber-400" /> Changer mon Mot de Passe
                </h2>

                <div className="space-y-4">
                    <div>
                        <label className="text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-1.5 block">
                            Mot de passe actuel
                        </label>
                        <div className="relative">
                            <input
                                type={showCurrentPass ? 'text' : 'password'}
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                placeholder="Votre mot de passe actuel"
                                title="Mot de passe actuel"
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 pr-12 text-white placeholder:text-gray-600 focus:outline-none focus:border-amber-500/50 text-sm"
                            />
                            <button
                                type="button"
                                onClick={() => setShowCurrentPass(!showCurrentPass)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                                title="Afficher/masquer le mot de passe"
                            >
                                {showCurrentPass ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-1.5 block">
                            Nouveau mot de passe
                        </label>
                        <div className="relative">
                            <input
                                type={showNewPass ? 'text' : 'password'}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Minimum 8 caractères"
                                title="Nouveau mot de passe"
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 pr-12 text-white placeholder:text-gray-600 focus:outline-none focus:border-amber-500/50 text-sm"
                            />
                            <button
                                type="button"
                                onClick={() => setShowNewPass(!showNewPass)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                                title="Afficher/masquer le mot de passe"
                            >
                                {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-1.5 block">
                            Confirmer le nouveau mot de passe
                        </label>
                        <div className="relative">
                            <input
                                type={showConfirmPass ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Retapez le nouveau mot de passe"
                                title="Confirmer le mot de passe"
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 pr-12 text-white placeholder:text-gray-600 focus:outline-none focus:border-amber-500/50 text-sm"
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPass(!showConfirmPass)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                                title="Afficher/masquer le mot de passe"
                            >
                                {showConfirmPass ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    {newPassword && confirmPassword && newPassword !== confirmPassword && (
                        <p className="text-[11px] text-red-400 flex items-center gap-1">
                            <AlertCircle size={12} /> Les mots de passe ne correspondent pas
                        </p>
                    )}

                    <button
                        onClick={handleChangePassword}
                        disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword}
                        className="flex items-center gap-2 bg-amber-500/20 text-amber-400 border border-amber-500/30 px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-amber-500/30 transition-all disabled:opacity-50"
                    >
                        {changingPassword ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
                        Modifier le Mot de Passe
                    </button>
                </div>
            </div>
        </div>
    )
}
