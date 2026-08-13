// ══════════════════════════════════════════════════════════════
//  PUBLIC : contenu éditorial d'une landing de service (parité mobile).
//  Renvoie le MÊME contenu que la page web (DEFAULT_<service> fusionné avec
//  l'override admin dans page_sections). L'app mobile consomme cette route pour
//  afficher exactement la même structure (piliers, étapes, contraste, FAQ...).
// ══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { mergeServiceLanding, type ServiceLandingContent } from '@/lib/content/serviceLanding'
import { DEFAULT_PASSEPORT } from '@/lib/content/passeport'
import { DEFAULT_BUSINESS } from '@/lib/content/business'
import { DEFAULT_CONSTRUCTION } from '@/lib/content/construction'
import { DEFAULT_CULTURE } from '@/lib/content/culture'
import { DEFAULT_FA } from '@/lib/content/fa'
import { DEFAULT_INVESTISSEMENT } from '@/lib/content/investissement'
import { DEFAULT_LANGUES } from '@/lib/content/langues'
import { DEFAULT_PERMIS } from '@/lib/content/permis'
import { DEFAULT_RECHERCHE_ANCESTRALE } from '@/lib/content/rechercheAncestrale'
import { DEFAULT_AUTRES } from '@/lib/content/autres'

export const dynamic = 'force-dynamic'

const DEFAULTS: Record<string, ServiceLandingContent> = {
    'passeport': DEFAULT_PASSEPORT,
    'business': DEFAULT_BUSINESS,
    'construction': DEFAULT_CONSTRUCTION,
    'culture': DEFAULT_CULTURE,
    'consultation-fa-racines': DEFAULT_FA,
    'investissement': DEFAULT_INVESTISSEMENT,
    'langues-racines': DEFAULT_LANGUES,
    // 'nationalite-vip' a un schéma dédié (NationaliteVipContent), non compatible
    // ServiceLandingContent : le mobile garde son repli SERVICES_DATA pour ce service.
    'permis-conduire': DEFAULT_PERMIS,
    'recherche-ancestrale': DEFAULT_RECHERCHE_ANCESTRALE,
    'autres': DEFAULT_AUTRES,
}

const db = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const def = DEFAULTS[slug]
    if (!def) return NextResponse.json({ content: null }, { status: 404 })

    let content = def
    try {
        const { data } = await db()
            .from('page_sections').select('content')
            .eq('page', slug).eq('section_key', 'page_content').eq('is_active', true).maybeSingle()
        if (data?.content) content = mergeServiceLanding(def, data.content as Partial<ServiceLandingContent>)
    } catch { /* défauts */ }

    return NextResponse.json({ content })
}
