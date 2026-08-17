'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { isLogementAgent } from '@/lib/logement-access'
import LogementProspects from '@/app/admin/logements/prospects/page'

/**
 * Prospects logement dans l'espace AGENT : réservés à l'agent nommément
 * autorisé (voir lib/logement-access), exactement comme le catalogue. Tout
 * autre agent est redirigé — la restriction est volontaire, ce service n'est pas
 * ouvert à l'ensemble des agents.
 *
 * Réutilise l'interface admin ; /api/logements/leads accepte cet agent en plus
 * des admins via requireLogementManager.
 */
export default function AgentLogementProspectsPage() {
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

    return <LogementProspects />
}
