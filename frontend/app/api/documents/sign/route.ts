import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Service role key → bypass RLS (le client portail n'est pas authentifié)
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST /api/documents/sign — signature du devis par le client.
// RÈGLE MÉTIER : la signature acte l'ACCORD du client (statut 'accepte') mais
// NE crée PAS de facture. Une facture n'est émise QUE lorsque le paiement est
// encaissé (le paiement justifie l'émission de la facture). La conversion
// devis → facture est faite par confirmDocumentPayment() côté paiement.
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { document_id, signature_url } = body

        if (!document_id || !signature_url) {
            return NextResponse.json({ error: 'document_id et signature_url requis' }, { status: 400 })
        }

        // 1. Récupérer le devis
        const { data: devis, error: fetchError } = await supabase
            .from('documents_financiers')
            .select('id, status, signed_at')
            .eq('id', document_id)
            .eq('type', 'devis')
            .single()

        if (fetchError || !devis) {
            return NextResponse.json({ error: 'Devis introuvable ou déjà traité' }, { status: 404 })
        }

        // Idempotence : devis déjà signé → renvoyer succès (aucune facture émise
        // tant que le paiement n'est pas encaissé)
        if (devis.status === 'accepte' || devis.status === 'paye') {
            return NextResponse.json({
                success: true,
                signed_at: devis.signed_at || new Date().toISOString(),
                alreadyExists: true,
            })
        }

        const signed_at = new Date().toISOString()

        // 2. Marquer le devis comme accepté + enregistrer la signature.
        //    AUCUNE facture créée ici : elle le sera au paiement.
        const { error: updateError } = await supabase
            .from('documents_financiers')
            .update({
                status: 'accepte',
                signature_url,
                signed_at,
            })
            .eq('id', document_id)

        if (updateError) throw new Error(updateError.message)

        return NextResponse.json({ success: true, signed_at })

    } catch (err) {
        console.error('Erreur API sign document:', err)
        const message = err instanceof Error ? err.message : 'Erreur interne'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
