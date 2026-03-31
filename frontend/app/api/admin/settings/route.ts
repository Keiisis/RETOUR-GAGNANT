import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

function getSupabase() {
    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Variables Supabase manquantes (SUPABASE_SERVICE_ROLE_KEY requis)')
    }
    return createClient(supabaseUrl, supabaseServiceKey)
}

// Paramètres par défaut pour la catégorie "general" (seed si absents)
const GENERAL_DEFAULTS: Array<{ key: string; value: string; label: string; type: string; category?: string }> = [
    { key: 'site_title', value: 'Retour Gagnant Bénin', label: 'Titre du site', type: 'text' },
    { key: 'site_slogan', value: "L'alliance parfaite entre l'expertise et l'accompagnement", label: 'Slogan', type: 'text' },
    { key: 'logo_url', value: '/logo.png', label: 'URL du logo', type: 'text' },
    { key: 'primary_color', value: '#FCD116', label: 'Couleur primaire', type: 'color' },
    { key: 'contact_email', value: 'contact@retourgagnantbenin.bj', label: 'Email de contact', type: 'email' },
    { key: 'contact_phone', value: '+229 01 60 32 21 21 / +229 01 94 35 50 50', label: 'Téléphone', type: 'text' },
    { key: 'address', value: 'Haie Vive, Cotonou, Bénin', label: 'Adresse', type: 'text' },
    { key: 'facebook_url', value: '', label: 'Facebook', type: 'url' },
    { key: 'instagram_url', value: '', label: 'Instagram', type: 'url' },
    { key: 'linkedin_url', value: '', label: 'LinkedIn', type: 'url' },
    { key: 'whatsapp_number', value: '', label: 'WhatsApp', type: 'text' },
    { key: 'serper_api_key_1', value: '', label: 'Clé Serper.dev 1', type: 'text', category: 'radar' },
    { key: 'serper_api_key_2', value: '', label: 'Clé Serper.dev 2', type: 'text', category: 'radar' },
    { key: 'serper_api_key_3', value: '', label: 'Clé Serper.dev 3', type: 'text', category: 'radar' }
]

// GET /api/admin/settings — retourne tous les paramètres groupés par catégorie
export async function GET(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    try {
        const supabase = getSupabase()

        // Récupérer tous les settings
        const { data, error } = await supabase
            .from('settings')
            .select('key, value, category')
            .order('key', { ascending: true })

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        const existing = data || []

        // Seed les paramètres manquants
        const existingKeys = new Set(existing.map(s => s.key))
        
        const toInsert = GENERAL_DEFAULTS.filter(d => !existingKeys.has(d.key)).map(d => ({
            key: d.key,
            value: d.value,
            category: d.category || 'general',
        }))

        if (toInsert.length > 0) {
            const { error: insertErr } = await supabase.from('settings').insert(toInsert)
            if (!insertErr) {
                // Re-fetch après insertion
                const { data: refreshed } = await supabase
                    .from('settings')
                    .select('key, value, category')
                    .order('key', { ascending: true })
                return NextResponse.json({ settings: refreshed || [] })
            }
        }

        return NextResponse.json({ settings: existing })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur' }, { status: 500 })
    }
}

// PATCH /api/admin/settings — mise à jour d'un paramètre par clé
export async function PATCH(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    try {
        const supabase = getSupabase()
        const body = await request.json()
        const { key, value, category } = body

        if (!key) {
            return NextResponse.json({ error: 'key est obligatoire' }, { status: 400 })
        }

        // Upsert: mettre à jour si existe, sinon créer
        const { data, error } = await supabase
            .from('settings')
            .upsert(
                { key, value: value ?? '', category: category || 'general' },
                { onConflict: 'key' }
            )
            .select()
            .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ setting: data })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur' }, { status: 500 })
    }
}
