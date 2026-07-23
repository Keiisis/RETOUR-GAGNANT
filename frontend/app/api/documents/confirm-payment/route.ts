import { NextRequest, NextResponse } from 'next/server'
import { confirmDocumentPayment } from '@/lib/document-payment'

// POST /api/documents/confirm-payment — confirmation serveur du paiement d'un
// devis/facture depuis le portail public /portail/[id].
// L'autorisation EST la vérification : la transaction doit être SUCCESS chez le
// provider ET couvrir le montant du document. Idempotent (garde atomique).
export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}))
        const docId = String(body.doc_id || '')
        const provider = body.provider === 'fedapay' ? 'fedapay' as const : 'kkiapay' as const
        const transactionId = String(body.transaction_id || '')
        // Acompte : montant XOF annoncé au client (absent = solde total)
        const expectedXOF = Number(body.expected_xof) > 0 ? Number(body.expected_xof) : undefined

        const result = await confirmDocumentPayment({ docId, provider, transactionId, expectedXOF })
        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: result.status || 500 })
        }
        return NextResponse.json({
            success: true,
            already_paid: result.alreadyPaid || false,
            partial: result.partial || false,
            encaisse_xof: result.encaisseXOF ?? null,
            solde_xof: result.soldeXOF ?? null,
        })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur' }, { status: 500 })
    }
}
