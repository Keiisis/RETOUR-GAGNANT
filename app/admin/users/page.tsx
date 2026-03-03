'use client'

import { useList, useDelete, useUpdate } from '@refinedev/core'
import { motion, AnimatePresence } from 'framer-motion'
import {
    UserCog, Search, Loader2, Plus, Trash2,
    Shield, User, Eye, EyeOff, Mail
} from 'lucide-react'
import { useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { BaseRecord } from '@refinedev/core'

export interface UserProfile extends BaseRecord {
    id: string;
    full_name?: string | null;
    email?: string | null;
    role?: 'superadmin' | 'agent' | string;
    is_active?: boolean;
    created_at?: string;
}

export default function AdminUsersPage() {
    const queryResult = useList<UserProfile>({
        resource: 'user_profiles',
        pagination: { pageSize: 50 },
        sorters: [{ field: 'created_at', order: 'desc' }],
    })
    const { mutate: deleteUser } = useDelete()
    const { mutate: updateUser } = useUpdate()
    const [searchTerm, setSearchTerm] = useState('')

    const returnedData = (queryResult as unknown as { data?: { data: UserProfile[] }, query?: { data?: { data: UserProfile[] }, isLoading: boolean } }).data ||
        (queryResult as unknown as { query?: { data?: { data: UserProfile[] } } }).query?.data;
    const isLoading = (queryResult as unknown as { isLoading?: boolean }).isLoading ||
        (queryResult as unknown as { query?: { isLoading?: boolean } }).query?.isLoading;
    const items = returnedData?.data || []

    const filtered = items.filter((item) =>
        (item.full_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (item.email?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    )

    return (
        <div className="space-y-10 animate-in fade-in duration-700">
            {/* HEADER */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[#FCD116]">
                        <UserCog size={18} />
                        <span className="text-[10px] font-bold uppercase tracking-[0.4em]">Gestion des Acces</span>
                    </div>
                    <h1 className="text-5xl font-black text-white font-heading tracking-tighter">
                        UTILISATEURS <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FCD116] to-[#E8112D]">ADMIN</span>
                    </h1>
                    <p className="text-sm text-gray-500 max-w-lg">
                        Uniquement accessible au SuperAdmin. Creez et gerez les comptes agents de l'agence.
                    </p>
                </div>

                <div className="flex items-center gap-4 w-full lg:w-auto">
                    <div className="relative flex-1 min-w-[250px]">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                        <input
                            type="text"
                            placeholder="Rechercher..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-[#0a0f18] border border-white/5 rounded-2xl py-3.5 pl-12 pr-4 text-white focus:outline-none focus:border-[#FCD116]/30 text-sm"
                        />
                    </div>
                    <Link href="/admin/users/create">
                        <Button className="bg-[#008751] h-14 px-8 rounded-2xl text-white font-black tracking-widest gap-2 shadow-xl">
                            <Plus size={20} /> CREER UN AGENT
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Roles info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-6 rounded-2xl bg-[#0a0f18] border border-[#FCD116]/10 flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[#FCD116]/10 border border-[#FCD116]/20 flex items-center justify-center flex-shrink-0">
                        <Shield size={22} className="text-[#FCD116]" />
                    </div>
                    <div>
                        <p className="text-sm font-black text-white">SuperAdmin</p>
                        <p className="text-xs text-gray-500 leading-relaxed mt-1">
                            Acces total : parametres, cles API, gestion utilisateurs, modification de l'interface frontend, boutique, commandes.
                        </p>
                    </div>
                </div>
                <div className="p-6 rounded-2xl bg-[#0a0f18] border border-[#008751]/10 flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[#008751]/10 border border-[#008751]/20 flex items-center justify-center flex-shrink-0">
                        <User size={22} className="text-[#008751]" />
                    </div>
                    <div>
                        <p className="text-sm font-black text-white">Agent</p>
                        <p className="text-xs text-gray-500 leading-relaxed mt-1">
                            Acces limite : boutique (CRUD produits), galerie, patrimoine, temoignages, messages. Pas d'acces aux reglages ni a la gestion des utilisateurs.
                        </p>
                    </div>
                </div>
            </div>

            {/* Users list */}
            <Card className="bg-[#0a0f18] border-white/5 rounded-[2rem] overflow-hidden shadow-2xl">
                {isLoading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="animate-spin text-[#FCD116]" size={48} />
                    </div>
                ) : filtered.length > 0 ? (
                    <div className="divide-y divide-white/5">
                        {/* Header */}
                        <div className="hidden md:grid grid-cols-12 gap-4 px-8 py-4 bg-white/[0.02] text-[9px] font-black text-gray-500 uppercase tracking-widest">
                            <div className="col-span-4">Utilisateur</div>
                            <div className="col-span-2">Role</div>
                            <div className="col-span-2">Statut</div>
                            <div className="col-span-2">Cree le</div>
                            <div className="col-span-2 text-right">Actions</div>
                        </div>

                        <AnimatePresence mode="popLayout">
                            {filtered.map((user) => (
                                <motion.div
                                    key={user.id}
                                    layout
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="grid grid-cols-1 md:grid-cols-12 gap-4 px-8 py-6 hover:bg-white/[0.02] transition-colors items-center"
                                >
                                    {/* User info */}
                                    <div className="col-span-4 flex items-center gap-4">
                                        <div className={cn(
                                            'w-11 h-11 rounded-xl flex items-center justify-center font-black text-lg',
                                            user.role === 'superadmin'
                                                ? 'bg-[#FCD116]/10 border border-[#FCD116]/20 text-[#FCD116]'
                                                : 'bg-[#008751]/10 border border-[#008751]/20 text-[#008751]'
                                        )}>
                                            {(user.full_name || 'U').charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-white">{user.full_name || 'Sans nom'}</p>
                                            <p className="text-[10px] text-gray-500 flex items-center gap-1">
                                                <Mail size={10} /> {user.id}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Role */}
                                    <div className="col-span-2">
                                        <span className={cn(
                                            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border',
                                            user.role === 'superadmin'
                                                ? 'bg-[#FCD116]/10 text-[#FCD116] border-[#FCD116]/20'
                                                : 'bg-[#008751]/10 text-[#008751] border-[#008751]/20'
                                        )}>
                                            {user.role === 'superadmin' ? <Shield size={10} /> : <User size={10} />}
                                            {user.role === 'superadmin' ? 'SuperAdmin' : 'Agent'}
                                        </span>
                                    </div>

                                    {/* Status */}
                                    <div className="col-span-2">
                                        <button
                                            title={user.is_active ? "Désactiver" : "Activer"}
                                            onClick={() => updateUser({
                                                resource: 'user_profiles',
                                                id: user.id,
                                                values: { is_active: !user.is_active },
                                            })}
                                            className={cn(
                                                'flex items-center gap-1.5 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border transition-all cursor-pointer',
                                                user.is_active
                                                    ? 'bg-[#008751]/10 text-[#008751] border-[#008751]/20'
                                                    : 'bg-white/5 text-gray-500 border-white/5'
                                            )}
                                        >
                                            {user.is_active ? <Eye size={10} /> : <EyeOff size={10} />}
                                            {user.is_active ? 'Actif' : 'Desactive'}
                                        </button>
                                    </div>

                                    {/* Created */}
                                    <div className="col-span-2">
                                        <p className="text-xs text-gray-500">
                                            {user.created_at ? new Date(user.created_at as string).toLocaleDateString('fr-FR') : '--'}
                                        </p>
                                    </div>

                                    {/* Actions */}
                                    <div className="col-span-2 flex items-center justify-end gap-2">
                                        {user.role !== 'superadmin' && (
                                            <button
                                                title="Supprimer l'utilisateur"
                                                onClick={() => {
                                                    if (confirm('Supprimer cet utilisateur ?')) {
                                                        deleteUser({ resource: 'user_profiles', id: user.id })
                                                    }
                                                }}
                                                className="p-2.5 rounded-xl bg-red-500/10 text-red-500 border border-red-500/10 hover:bg-red-500 hover:text-white transition-all"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-32 space-y-4">
                        <UserCog size={48} className="text-gray-700" />
                        <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">
                            Aucun utilisateur.
                        </p>
                    </div>
                )}
            </Card>
        </div>
    )
}
