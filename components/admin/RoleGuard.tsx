'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Shield } from 'lucide-react'

interface RoleGuardProps {
    allowedRoles: ('superadmin' | 'agent')[]
    children: React.ReactNode
    fallback?: React.ReactNode
}

export function RoleGuard({ allowedRoles, children, fallback }: RoleGuardProps) {
    const [userRole, setUserRole] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchRole = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) {
                    setLoading(false)
                    return
                }

                const { data: profile } = await supabase
                    .from('user_profiles')
                    .select('role')
                    .eq('id', user.id)
                    .single()

                setUserRole(profile?.role || 'agent')
            } catch {
                setUserRole('agent')
            } finally {
                setLoading(false)
            }
        }

        fetchRole()
    }, [])

    if (loading) return null

    if (!userRole || !allowedRoles.includes(userRole as 'superadmin' | 'agent')) {
        return fallback || (
            <div className="flex flex-col items-center justify-center py-32 space-y-6">
                <div className="w-20 h-20 rounded-full bg-[#E8112D]/10 border-2 border-[#E8112D]/20 flex items-center justify-center">
                    <Shield size={36} className="text-[#E8112D]" />
                </div>
                <div className="text-center">
                    <h3 className="text-2xl font-black text-white font-heading mb-2">Acces Restreint</h3>
                    <p className="text-sm text-gray-500">Vous n'avez pas les permissions necessaires pour acceder a cette section.</p>
                </div>
            </div>
        )
    }

    return <>{children}</>
}
