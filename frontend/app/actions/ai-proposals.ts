'use server'

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabaseAdmin = createClient(supabaseUrl, supabaseKey)

const PROPOSAL_FIELDS = 'id, secret_key, client_name, destination, status, total_amount, created_at, currency, notes'

export async function getProposalsList() {
    try {
        // Source de vérité : la vue `slide_proposals`, qui exclut par
        // construction les liens de paiement (ils partagent la table mais
        // relèvent d'un autre domaine). Repli sur un filtre applicatif tant
        // que la migration de séparation n'est pas appliquée.
        const view = await supabaseAdmin
            .from('slide_proposals')
            .select(PROPOSAL_FIELDS)
            .order('created_at', { ascending: false })

        if (!view.error) return { success: true, data: view.data || [] }

        const { data, error } = await supabaseAdmin
            .from('ai_client_proposals')
            .select(PROPOSAL_FIELDS)
            .order('created_at', { ascending: false })
        if (error) throw error

        const filtered = (data || []).filter(
            p => !String((p as { notes?: string | null }).notes || '').startsWith('LIEN-PAIEMENT'),
        )
        return { success: true, data: filtered }
    } catch (err: unknown) {
        return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
}

export async function getProposalById(id: string) {
    try {
        const { data: proposal, error: pError } = await supabaseAdmin
            .from('ai_client_proposals')
            .select('*')
            .eq('id', id)
            .single()

        if (pError || !proposal) throw new Error('Proposition introuvable')

        const { data: items, error: iError } = await supabaseAdmin
            .from('ai_proposal_items')
            .select('*')
            .eq('proposal_id', id)
            .order('order_index', { ascending: true })

        if (iError) throw iError

        // Galerie multi-images : stockée dans metadata.images (jsonb)-// remontée en champ `images` pour le rendu et l'édition des slides.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapped = (items || []).map((it: any) => ({
            ...it,
            images: (it.metadata?.images as Array<{ url: string; caption?: string }>) || [],
        }))

        return { success: true, proposal, items: mapped }
    } catch (err: unknown) {
        return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
}

export async function getProposalBySecret(secret: string) {
    try {
        const { data: proposal, error: pError } = await supabaseAdmin
            .from('ai_client_proposals')
            .select('*')
            .eq('secret_key', secret)
            .single()

        if (pError || !proposal) throw new Error('Proposition introuvable')

        const { data: items, error: iError } = await supabaseAdmin
            .from('ai_proposal_items')
            .select('*')
            .eq('proposal_id', proposal.id)
            .order('order_index', { ascending: true })

        if (iError) throw iError

        // Galerie multi-images : stockée dans metadata.images (jsonb)-// remontée en champ `images` pour le rendu et l'édition des slides.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapped = (items || []).map((it: any) => ({
            ...it,
            images: (it.metadata?.images as Array<{ url: string; caption?: string }>) || [],
        }))

        return { success: true, proposal, items: mapped }
    } catch (err: unknown) {
        return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
}

export async function updateProposalAndItems(proposalId: string, newTotal: number, items: Record<string, unknown>[], currency?: string) {
    try {
        // 1. Update proposal global
        await supabaseAdmin.from('ai_client_proposals').update({
            total_amount: newTotal,
            status: 'ready',
            ...(currency ? { currency } : {})
        }).eq('id', proposalId)

        // 2. Handle items (Delete old, insert new)
        await supabaseAdmin.from('ai_proposal_items').delete().eq('proposal_id', proposalId)
        
        const itemsToInsert = items.map((item, idx) => {
            const { id, ...rest } = item
            void id; // ignore id
            return {
                ...rest,
                order_index: idx
            }
        })
        
        await supabaseAdmin.from('ai_proposal_items').insert(itemsToInsert)
        
        return { success: true }
    } catch (err: unknown) {
        return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
}

export async function deleteProposal(proposalId: string) {
    try {
        // Delete items first (foreign key)
        await supabaseAdmin.from('ai_proposal_items').delete().eq('proposal_id', proposalId)
        // Delete proposal
        const { error } = await supabaseAdmin.from('ai_client_proposals').delete().eq('id', proposalId)
        if (error) throw error
        return { success: true }
    } catch (err: unknown) {
        return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
}
