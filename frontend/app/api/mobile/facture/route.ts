// ══════════════════════════════════════════════════════════════
//  « Où en est ma facture ? » — l'écran de paiement réussi le demande.
//
//  Répond trois choses, et rien de plus :
//    · la facture existe-t-elle pour cette transaction (et son numéro) ;
//    · le client a-t-il déjà un paraphe enregistré — c'est ce qui décide si
//      l'application lui propose de signer avant de télécharger ;
//    · le montant réellement facturé, pour que l'écran ne réaffiche pas un
//      chiffre venu du téléphone.
// ══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resoudreFactureDuClient } from '@/lib/mobile-facture'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET(req: NextRequest) {
    const r = await resoudreFactureDuClient(req)
    if (r.erreur) return NextResponse.json({ error: r.erreur.message }, { status: r.erreur.status })

    const { data: sig } = await supabase
        .from('client_signatures')
        .select('auto_sign, updated_at')
        .eq('client_id', r.clientId!)
        .maybeSingle()

    return NextResponse.json({
        facture: r.facture
            ? {
                id: r.facture.id,
                numero: r.facture.numero,
                total: r.facture.total,
                currency: r.facture.currency,
                paid_at: r.facture.paid_at,
                status: r.facture.status,
            }
            : null,
        signature: {
            enregistree: !!sig,
            /* `never` : le client a demandé qu'on n'appose pas son paraphe
               automatiquement. L'application n'a alors rien à lui réclamer. */
            auto_sign: sig?.auto_sign || null,
        },
    }, { headers: { 'Cache-Control': 'no-store' } })
}
