'use client'

import { useState } from 'react'
import { ArrowLeft, UserPlus, Loader2, Shield, User, Eye, EyeOff, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

export default function CreateUserPage() {
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [fullName, setFullName] = useState('')
    const [role, setRole] = useState<'agent' | 'admin' | 'superadmin'>('agent')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)
    const [wasUpdated, setWasUpdated] = useState(false)
    const [showPassword, setShowPassword] = useState(false)

    const handleCreate = async () => {
        if (!email || !password || !fullName) {
            setError('Tous les champs sont obligatoires')
            return
        }
        if (password.length < 6) {
            setError('Le mot de passe doit contenir au moins 6 caractères')
            return
        }

        setIsLoading(true)
        setError('')

        try {
            const res = await fetch('/api/admin/users/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, fullName, role }),
            })
            const data = await res.json()

            if (!res.ok) {
                setError(data.error || 'Erreur lors de la création du compte')
                return
            }

            setWasUpdated(!!data.updated)
            setSuccess(true)
            setTimeout(() => router.push('/admin/users'), 2500)
        } catch {
            setError('Erreur réseau — veuillez réessayer')
        } finally {
            setIsLoading(false)
        }
    }

    if (success) {
        return (
            <div className="flex flex-col items-center justify-center py-32 space-y-6 animate-in fade-in duration-500">
                <div className="w-24 h-24 rounded-2xl bg-[#008751]/20 border-2 border-[#008751]/40 flex items-center justify-center">
                    <CheckCircle2 size={40} className="text-[#008751]" />
                </div>
                <h2 className="text-3xl font-black text-white font-heading tracking-tighter">
                    {wasUpdated ? 'Compte Mis à Jour !' : 'Compte Créé !'}
                </h2>
                <p className="text-gray-400 text-sm text-center max-w-xs">
                    {wasUpdated
                        ? <>Le compte existant de <span className="text-white font-bold">{fullName}</span> a été mis à jour avec le nouveau mot de passe.</>
                        : <><span className="text-white font-bold">{fullName}</span> peut maintenant se connecter avec ses identifiants.</>
                    }
                </p>
                <p className="text-[10px] text-gray-600 font-mono bg-white/5 px-4 py-2 rounded-lg">{email}</p>
                <p className="text-[10px] text-gray-600">Redirection en cours...</p>
            </div>
        )
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-700 max-w-2xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link
                    href="/admin/users"
                    className="p-3 rounded-xl bg-white/5 border border-white/5 text-gray-400 hover:text-white transition-colors"
                    title="Retour"
                >
                    <ArrowLeft size={18} />
                </Link>
                <div>
                    <div className="flex items-center gap-2 text-[#FCD116]">
                        <UserPlus size={16} />
                        <span className="text-[10px] font-black uppercase tracking-[0.4em]">Nouveau Compte</span>
                    </div>
                    <h1 className="text-3xl font-black text-white font-heading tracking-tighter">
                        Créer un Utilisateur
                    </h1>
                </div>
            </div>

            <div className="bg-[#0a0f18] border border-white/5 rounded-2xl overflow-hidden">
                <div className="p-8 border-b border-white/5">
                    <p className="text-sm font-black text-white">Informations du Compte</p>
                    <p className="text-[10px] text-gray-500 mt-1">Le compte est créé immédiatement, sans email de confirmation.</p>
                </div>
                <div className="p-8 space-y-6">
                    {/* Full Name */}
                    <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                            Nom complet *
                        </label>
                        <input
                            type="text"
                            value={fullName}
                            onChange={e => setFullName(e.target.value)}
                            placeholder="Prénom et Nom"
                            className="w-full bg-white/5 border border-white/5 rounded-xl py-3.5 px-4 text-white text-sm focus:outline-none focus:border-[#FCD116]/30 transition-colors"
                        />
                    </div>

                    {/* Email */}
                    <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                            Email *
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="agent@retourgagnant.com"
                            className="w-full bg-white/5 border border-white/5 rounded-xl py-3.5 px-4 text-white text-sm focus:outline-none focus:border-[#FCD116]/30 transition-colors"
                        />
                    </div>

                    {/* Password */}
                    <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                            Mot de passe *
                        </label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="Minimum 6 caractères"
                                className="w-full bg-white/5 border border-white/5 rounded-xl py-3.5 px-4 pr-12 text-white text-sm focus:outline-none focus:border-[#FCD116]/30 transition-colors"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                                title={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                            >
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    {/* Role */}
                    <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 block">
                            Rôle *
                        </label>
                        <div className="grid grid-cols-3 gap-3">
                            {([
                                { value: 'agent' as const, label: 'Agent', icon: User, desc: 'Leads, dossiers, messages, agenda', color: '#008751' },
                                { value: 'admin' as const, label: 'Admin', icon: Shield, desc: 'Paramètres, boutique, services, contenu', color: '#FCD116' },
                                { value: 'superadmin' as const, label: 'Super Admin', icon: Shield, desc: 'Tous droits, gestion des admins incluse', color: '#E8112D' },
                            ]).map(r => (
                                <button
                                    key={r.value}
                                    type="button"
                                    onClick={() => setRole(r.value)}
                                    className={cn(
                                        'p-4 rounded-xl border text-left transition-all',
                                        role === r.value
                                            ? 'border-white/20 bg-white/5'
                                            : 'border-white/5 bg-white/[0.02] hover:border-white/10'
                                    )}
                                    style={role === r.value ? { borderColor: r.color + '40', backgroundColor: r.color + '10' } : {}}
                                >
                                    <r.icon size={18} className="mb-2" style={{ color: role === r.value ? r.color : '#6b7280' }} />
                                    <p className="text-xs font-bold text-white">{r.label}</p>
                                    <p className="text-[9px] text-gray-500 mt-0.5 leading-relaxed">{r.desc}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {error && (
                        <div className="p-4 rounded-xl bg-[#E8112D]/10 border border-[#E8112D]/20 text-[#E8112D] text-xs font-bold">
                            {error}
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={handleCreate}
                        disabled={isLoading || !email || !password || !fullName}
                        className="w-full h-14 rounded-xl bg-[#008751] hover:bg-[#00a36b] text-white font-black text-sm tracking-widest flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                        {isLoading ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
                        CRÉER LE COMPTE
                    </button>
                </div>
            </div>
        </div>
    )
}
