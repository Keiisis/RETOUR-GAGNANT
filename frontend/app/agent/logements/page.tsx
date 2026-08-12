'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { isLogementAgent } from '@/lib/logement-access'
import LogementsManager from '@/app/admin/logements/page'

/**
 * Gestion Logement dans l'espace AGENT : réservée à l'agent nommément autorisé
 * (voir lib/logement-access). Réutilise exactement l'interface admin ; les API
 * (/api/admin/logements, /api/logements/content, /api/upload/logement) acceptent
 * cet agent en plus des admins. Tout autre agent est redirigé.
 */
export default function AgentLogementsPage() {
    const router = useRouter()
    const [allowed, setAllowed] = useState<boolean | null>(null)

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            const ok = isLogementAgent(data.user?.id)
            setAllowed(ok)
            if (!ok) router.replace('/agent')
        }).catch(() => { setAllowed(false); router.replace('/agent') })
    }, [router])

    if (allowed === null) {
        return <div className="flex justify-center py-24"><div className="w-8 h-8 border-2 border-[#008751]/25 border-t-[#008751] rounded-full animate-spin" /></div>
    }
    if (!allowed) return null
    return <LogementsManager />
}
