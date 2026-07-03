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

        const result = await confirmDocumentPayment({ docId, provider, transactionId })
        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: result.status || 500 })
        }
        return NextResponse.json({ success: true, already_paid: result.alreadyPaid || false })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur' }, { status: 500 })
    }
}
