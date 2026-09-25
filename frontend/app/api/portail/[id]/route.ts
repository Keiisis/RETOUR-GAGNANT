// GET /api/portail/[id] — document du portail client (lien à capacité : l'UUID
// du document EST l'autorisation, comme avant) + cumul des acomptes.
// Remplace les lectures en clé publique de /portail/[id] (audit 25/09/2026),
// préalable au verrouillage RLS de documents_financiers et paiements_manuels.
import { NextRequest, NextResponse } from 'next/server'
import { supabaseServeur } from '@/lib/supabase-serveur'
import { guardPublic, PUBLIC_FORM_LIMIT } from '@/lib/api-guard'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// Champs réservés à l'équipe : jamais renvoyés au client.
const INTERNES = ['admin_notes', 'notes_internes', 'internal_notes']

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    // Plafond par IP : un UUID ne se devine pas, mais on borne l'énumération.
    const trop = guardPublic(req, 'portail', { ...PUBLIC_FORM_LIMIT, limit: 60 })
    if (trop) return trop

    const { id } = await params
    if (!UUID.test(id)) return NextResponse.json({ error: 'Document introuvable ou lien invalide.' }, { status: 404 })

    const { data: doc, error } = await supabaseServeur.from('documents_financiers').select('*').eq('id', id).maybeSingle()
    if (error || !doc) return NextResponse.json({ error: 'Document introuvable ou lien invalide.' }, { status: 404 })

    // Héritage de la signature du devis parent (facture issue d'un devis signé).
    if (!doc.signature_url && doc.type === 'facture' && doc.parent_devis_id) {
        const { data: parent } = await supabaseServeur.from('documents_financiers')
            .select('signature_url, signed_at').eq('id', doc.parent_devis_id).maybeSingle()
        if (parent?.signature_url) {
            doc.signature_url = parent.signature_url
            doc.signed_at = parent.signed_at
        }
    }
    for (const k of INTERNES) delete (doc as Record<string, unknown>)[k]

    const { data: pms } = await supabaseServeur.from('paiements_manuels').select('montant').eq('document_id', id)
    const deja_paye = (pms || []).reduce((a, p) => a + (Number(p.montant) || 0), 0)

    return NextResponse.json({ doc, deja_paye })
}
