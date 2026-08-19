// ══════════════════════════════════════════════════════════════
//  Retrouver LA facture d'un paiement, pour son propriétaire.
//
//  L'application connaît une seule chose après un règlement : la référence de
//  transaction. C'est donc par elle qu'on retrouve le document — et jamais par
//  un identifiant de facture fourni par le téléphone, qui rendrait la route
//  énumérable.
//
//  Deux verrous d'appartenance, dans cet ordre :
//    · le compte (`client_id`) — le lien le plus fort, posé à la facturation ;
//    · à défaut l'EMAIL DU PROFIL rattaché au jeton — jamais un email de
//      requête. Ce repli existe parce que les factures nées d'un formulaire
//      web (nationalité, récap) ne portent pas toujours le compte.
// ══════════════════════════════════════════════════════════════
import type { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getMobileUserId } from './mobile-auth'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export interface FactureMobile {
    id: string
    numero: string | null
    type: string
    total: number
    currency: string
    status: string
    paid_at: string | null
    created_at: string | null
    client_id: string | null
    client_nom: string | null
    client_prenom: string | null
    client_email: string | null
    client_phone: string | null
    client_adresse: string | null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items: any[] | null
    sous_total: number | null
    total_tva: number | null
    remise: number | null
    notes: string | null
    payment_method: string | null
}

export interface ResolutionFacture {
    /** 401 si le jeton manque, 400 si la transaction manque. */
    erreur?: { message: string; status: number }
    clientId?: string
    facture?: FactureMobile | null
}

const CHAMPS = 'id, numero, type, total, currency, status, paid_at, created_at, client_id, '
    + 'client_nom, client_prenom, client_email, client_phone, client_adresse, '
    + 'items, sous_total, total_tva, remise, notes, payment_method'

/** Résout la facture d'une transaction pour le client authentifié. */
export async function resoudreFactureDuClient(req: NextRequest): Promise<ResolutionFacture> {
    const clientId = await getMobileUserId(req)
    if (!clientId) return { erreur: { message: 'Non authentifié', status: 401 } }

    const tx = new URL(req.url).searchParams.get('tx')?.trim()
    if (!tx) return { erreur: { message: 'Référence de transaction manquante', status: 400 }, clientId }

    const { data: doc } = await supabase
        .from('documents_financiers')
        .select(CHAMPS)
        .eq('payment_transaction_id', tx)
        .maybeSingle<FactureMobile>()

    if (!doc) return { clientId, facture: null }

    if (doc.client_id && doc.client_id === clientId) return { clientId, facture: doc }

    // Repli par l'email DU PROFIL (jamais un email transmis par l'appelant).
    const { data: profil } = await supabase
        .from('client_profiles').select('email').eq('id', clientId).maybeSingle()
    const emailProfil = String(profil?.email || '').trim().toLowerCase()
    const emailDoc = String(doc.client_email || '').trim().toLowerCase()
    if (emailProfil && emailDoc && emailProfil === emailDoc) return { clientId, facture: doc }

    /* La facture existe mais appartient à quelqu'un d'autre : on répond comme
       si elle n'existait pas. Distinguer les deux cas renseignerait un tiers
       sur la validité d'une référence de transaction. */
    return { clientId, facture: null }
}

/** Paraphe enregistré du client, si sa préférence l'autorise. */
export async function parapheDuClient(clientId: string): Promise<string | undefined> {
    const { data } = await supabase
        .from('client_signatures')
        .select('signature_data, auto_sign')
        .eq('client_id', clientId)
        .maybeSingle()
    if (!data?.signature_data || data.auto_sign === 'never') return undefined
    return data.signature_data
}
