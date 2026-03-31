import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { doc_id, provider, transaction_id, user_id, email } = body

        if (!doc_id || !user_id || !provider) {
            return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
        }

        // Vérifier que le document existe et appartient à l'utilisateur
        const { data: doc } = await supabase
            .from('documents_financiers')
            .select('id, status, client_id, client_email, total, type')
            .eq('id', doc_id)
            .single()

        if (!doc) {
            return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })
        }

        // Vérification propriétaire
        if (doc.client_id !== user_id && doc.client_email !== email) {
            return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
        }

        // Seules les factures peuvent être payées
        if (doc.type !== 'facture') {
            return NextResponse.json({ error: 'Ce document n\'est pas une facture' }, { status: 400 })
        }

        // Idempotent : si déjà payé, retourner succès
        if (doc.status === 'paye') {
            return NextResponse.json({ success: true, already_paid: true })
        }

        // Marquer comme payé
        const { error: updateError } = await supabase
            .from('documents_financiers')
            .update({
                status: 'paye',
                payment_provider: provider,
                payment_transaction_id: transaction_id || null,
                paid_at: new Date().toISOString(),
            })
            .eq('id', doc_id)

        if (updateError) throw new Error(updateError.message)

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('Erreur API client/payment/confirm:', err)
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Erreur interne' },
            { status: 500 }
        )
    }
}
