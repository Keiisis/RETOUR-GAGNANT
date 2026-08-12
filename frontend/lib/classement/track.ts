// ══════════════════════════════════════════════════════════════
// Classement Client : enregistrement automatique d'un client.
// Appelé en fire-and-forget depuis les flux (RDV, lead nationalité, contact).
// Idempotent par email : ne réécrase jamais la catégorie/les notes/le statut
// d'un client déjà suivi ; complète seulement les champs manquants.
// ══════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js'
import { categorize } from './categories'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export interface TrackInput {
    email?: string | null
    full_name?: string | null
    phone?: string | null
    serviceLabel?: string | null
    source?: string
}

/**
 * Marque un client comme « converti » (paiement réussi).
 * Crée la fiche si elle n'existe pas encore. Fire-and-forget, tolérant.
 */
export async function markClientConverted(input: TrackInput): Promise<void> {
    const email = (input.email || '').toLowerCase().trim()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return
    if (!supabaseUrl || !serviceKey) return
    try {
        const supabase = createClient(supabaseUrl, serviceKey)
        const { data: existing } = await supabase
            .from('client_classement').select('id').eq('email', email).maybeSingle()
        if (existing) {
            await supabase.from('client_classement')
                .update({ status: 'converti', last_review_at: new Date().toISOString() })
                .eq('id', existing.id)
        } else {
            await supabase.from('client_classement').insert({
                email,
                full_name: input.full_name || null,
                phone: input.phone || null,
                service_category: categorize(input.serviceLabel),
                service_label: input.serviceLabel || null,
                source: input.source || 'paiement',
                status: 'converti',
                first_contact_at: new Date().toISOString(),
            })
        }
    } catch (e) {
        console.log('[CLASSEMENT] markConverted non-blocking:', e instanceof Error ? e.message : e)
    }
}

export async function trackClient(input: TrackInput): Promise<void> {
    const email = (input.email || '').toLowerCase().trim()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return
    if (!supabaseUrl || !serviceKey) return

    try {
        const supabase = createClient(supabaseUrl, serviceKey)
        const { data: existing } = await supabase
            .from('client_classement')
            .select('id, full_name, phone')
            .eq('email', email)
            .maybeSingle()

        if (existing) {
            // Complète uniquement les champs vides (ne touche pas catégorie/notes/statut)
            const patch: Record<string, string> = {}
            if (!existing.full_name && input.full_name) patch.full_name = input.full_name
            if (!existing.phone && input.phone) patch.phone = input.phone
            if (Object.keys(patch).length > 0) {
                await supabase.from('client_classement').update(patch).eq('id', existing.id)
            }
            return
        }

        await supabase.from('client_classement').insert({
            email,
            full_name: input.full_name || null,
            phone: input.phone || null,
            service_category: categorize(input.serviceLabel),
            service_label: input.serviceLabel || null,
            source: input.source || 'auto',
            status: 'nouveau',
            first_contact_at: new Date().toISOString(),
        })
    } catch (e) {
        console.log('[CLASSEMENT] trackClient non-blocking:', e instanceof Error ? e.message : e)
    }
}
