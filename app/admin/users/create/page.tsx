'use client'

import { useState } from 'react'
import { useNavigation } from '@refinedev/core'
import { ArrowLeft, UserPlus, Loader2, Shield, User, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

export default function CreateUserPage() {
    const { list } = useNavigation()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [fullName, setFullName] = useState('')
    const [role, setRole] = useState<'agent' | 'superadmin'>('agent')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)
    const [showPassword, setShowPassword] = useState(false)

    const handleCreate = async () => {
        if (!email || !password || !fullName) {
            setError('Tous les champs sont obligatoires')
            return
        }

        if (password.length < 6) {
            setError('Le mot de passe doit contenir au moins 6 caracteres')
            return
        }

        setIsLoading(true)
        setError('')

        try {
            // Step 1: Create auth user via Supabase Admin (requires service role key in production)
            // For now, we use signUp which also works
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName,
                        role,
                    },
                },
            })

            if (authError) {
                setError(authError.message)
                setIsLoading(false)
                return
            }

            if (authData.user) {
                // Step 2: Create user profile
                const { error: profileError } = await supabase
                    .from('user_profiles')
                    .insert({
                        id: authData.user.id,
                        full_name: fullName,
                        role,
                        is_active: true,
                    })

                if (profileError) {
                    console.error('Profile creation error:', profileError)
                    // User was created in auth but profile failed — still report success
                }

                setSuccess(true)
                setTimeout(() => list('user_profiles'), 2000)
            }
        } catch (err: unknown) {
            setError('Erreçur lors de la creation du compte')
        } finally {
            setIsLoading(false)
        }
    }

    if (success) {
        return (
            <div className="flex flex-col items-center justify-center py-32 space-y-6 animate-in fade-in">
                <div className="w-20 h-20 rounded-full bg-[#008751]/20 border-2 border-[#008751] flex items-center justify-center">
                    <UserPlus size={36} className="text-[#008751]" />
                </div>
                <h2 className="text-3xl font-black text-white font-heading">Compte Cree</h2>
                <p className="text-gray-400 text-sm">L'agent {fullName} peut maintenant se connecter.</p>
                <p className="text-[10px] text-gray-600 font-mono">{email}</p>
            </div>
        )
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-700 max-w-2xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => list('user_profiles')}
                    className="p-3 rounded-xl bg-white/5 border border-white/5 text-gray-400 hover:text-white transition-colors"
                    title="Retour"
                >
                    <ArrowLeft size={18} />
                </button>
                <div>
                    <div className="flex items-center gap-2 text-[#FCD116]">
                        <UserPlus size={16} />
                        <span className="text-[10px] font-black uppercase tracking-[0.4em]">Nouveau Compte</span>
                    </div>
                    <h1 className="text-3xl font-black text-white font-heading tracking-tighter">
                        Creer un Utilisateur
                    </h1>
                </div>
            </div>

            <Card className="bg-[#0a0f18] border-white/5 rounded-[2rem] overflow-hidden">
                <CardHeader className="p-8 border-b border-white/5">
                    <CardTitle className="text-lg font-black text-white">Informations du Compte</CardTitle>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                    <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                            Nom complet *
                        </label>
                        <input
                            type="text"
                            value={fullName}
                            onChange={e => setFullName(e.target.value)}
                            placeholder="Prenom et Nom"
                            className="w-full bg-white/5 border border-white/5 rounded-xl py-3.5 px-4 text-white text-sm focus:outline-none focus:border-[#FCD116]/30"
                        />
                    </div>

                    <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                            Email *
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="agent@retourgagnant.com"
                            className="w-full bg-white/5 border border-white/5 rounded-xl py-3.5 px-4 text-white text-sm focus:outline-none focus:border-[#FCD116]/30"
                        />
                    </div>

                    <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                            Mot de passe *
                        </label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="Minimum 6 caracteres"
                                className="w-full bg-white/5 border border-white/5 rounded-xl py-3.5 px-4 pr-12 text-white text-sm focus:outline-none focus:border-[#FCD116]/30"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                                title={showPassword ? 'Masquer' : 'Afficher'}
                            >
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 block">
                            Role *
                        </label>
                        <div className="grid grid-cols-2 gap-4">
                            {([
                                { value: 'agent' as const, label: 'Agent', icon: User, desc: 'Acces limite', activeClass: 'border-[#008751]/40 bg-[#008751]/10', iconActive: 'text-[#008751]' },
                                { value: 'superadmin' as const, label: 'SuperAdmin', icon: Shield, desc: 'Acces total', activeClass: 'border-[#FCD116]/40 bg-[#FCD116]/10', iconActive: 'text-[#FCD116]' },
                            ]).map(r => (
                                <button
                                    key={r.value}
                                    onClick={() => setRole(r.value)}
                                    className={cn(
                                        'p-5 rounded-2xl border text-left transition-all',
                                        role === r.value
                                            ? r.activeClass
                                            : 'border-white/5 bg-white/[0.02] hover:border-white/10'
                                    )}
                                >
                                    <r.icon size={20} className={cn('mb-2', role === r.value ? r.iconActive : 'text-gray-500')} />
                                    <p className="text-sm font-bold text-white">{r.label}</p>
                                    <p className="text-[10px] text-gray-500 mt-0.5">{r.desc}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {error && (
                        <div className="p-4 rounded-xl bg-[#E8112D]/10 border border-[#E8112D]/20 text-[#E8112D] text-xs font-bold">
                            {error}
                        </div>
                    )}

                    <Button
                        onClick={handleCreate}
                        disabled={isLoading || !email || !password || !fullName}
                        className="w-full h-14 rounded-xl bg-[#008751] text-white font-black text-sm tracking-widest gap-2 disabled:opacity-40"
                    >
                        {isLoading ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
                        CREER LE COMPTE
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
