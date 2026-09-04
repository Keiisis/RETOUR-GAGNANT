import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { guardPublic, PUBLIC_FORM_LIMIT, flowKey } from '@/lib/api-guard'
import { verifierCodeInvitation } from '@/lib/nationality-invitation'

/* ═══════════════════════════════════════════════════════════════
   VÉRIFICATION PUBLIQUE D'UN CODE D'INVITATION

   Cette route ne donne RIEN. Elle dit seulement à l'écran si le code saisi
   sera accepté, pour que le client le sache avant de remplir quarante-cinq
   champs. La gratuité est accordée ailleurs — dans /api/nationality, au
   moment où le dossier est enregistré — et sur la seule décision du serveur.

   Elle est donc traitée comme ce qu'elle est : une porte publique qui teste
   des secrets. Deux protections.

   · DÉBIT PLAFONNÉ. Un code fait 12 caractères sur un alphabet de 32,
     soit 32^12 possibilités : le tirage au hasard est hors de portée. Mais
     une route de vérification sans limite reste un outil d'essais en série,
     et rien ne justifie d'en laisser un ouvert.

   · RÉPONSES INDISTINCTES. Un code inconnu et un code révoqué reçoivent le
     même message. L'écart entre deux réponses est une fuite : il révélerait
     quels codes existent.
   ═══════════════════════════════════════════════════════════════ */

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
)

/** Plus strict que le formulaire : on teste un secret, pas un champ. */
const LIMITE_CODE = { ...PUBLIC_FORM_LIMIT, limit: 12, window: 10 * 60_000 }

export async function POST(request: Request) {
    const trop = guardPublic(request, 'nationality-invitation', LIMITE_CODE, flowKey(request))
    if (trop) return trop

    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const verdict = await verifierCodeInvitation(supabase, body.code, String(body.email || '') || null)

    if (!verdict.valide || !verdict.code) {
        return NextResponse.json({ valide: false, motif: verdict.motif })
    }

    /* On ne renvoie que ce dont l'écran a besoin pour se composer : la portée
       et les montants couverts. Ni l'identifiant, ni le destinataire, ni la
       note interne ne sortent d'ici. */
    return NextResponse.json({
        valide: true,
        couvre_dossier: verdict.code.couvre_dossier,
        couvre_ancestrale: verdict.code.couvre_ancestrale,
        montant_dossier: verdict.code.montant_dossier,
        montant_ancestrale: verdict.code.montant_ancestrale,
        devise: verdict.code.devise,
        expire_le: verdict.code.expire_le,
    })
}
