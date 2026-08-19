// ══════════════════════════════════════════════════════════════
//  Ouvrir un dossier de suivi pour un service.
//
//  `dossier_tracking` est la table UNIQUE d'où l'admin, l'agent et
//  l'application lisent les dossiers. Chaque service qui encaisse doit y
//  déposer sa ligne, sinon la prestation existe en comptabilité mais dans
//  aucun suivi — le client paie et personne ne voit passer son dossier.
//
//  Ce module factorise ce que l'application faisait déjà dans
//  /api/mobile/dossiers, pour que le web ouvre EXACTEMENT le même type de
//  dossier : mêmes colonnes, même statut de départ, même progression.
// ══════════════════════════════════════════════════════════════
import { createClient, SupabaseClient } from '@supabase/supabase-js'

/** Statuts considérés comme « dossier encore ouvert ». */
export const STATUTS_ACTIFS = ['reception', 'en_cours', 'en_attente', 'traitement', 'validation']

function client(): SupabaseClient {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
}

export interface OuvertureDossier {
    service_type: string
    nom: string
    prenom: string
    email: string
    telephone?: string | null
    notes?: string | null
    source?: 'web' | 'mobile'
    transaction_id?: string | null
    payment_method?: string | null
}

/**
 * Ouvre un dossier de suivi et renvoie son identifiant.
 *
 * Rattache au compte client quand l'email en désigne un : c'est ce qui fait
 * apparaître le dossier dans l'onglet « Dossier » de l'application. Un client
 * sans compte reste suivi côté équipe — l'absence de compte ne doit pas
 * empêcher l'ouverture.
 *
 * Renvoie `null` en cas d'échec : l'appelant ne doit PAS faire échouer une
 * prestation déjà payée pour autant.
 */
export async function ouvrirDossier(o: OuvertureDossier): Promise<string | null> {
    const db = client()

    let clientId: string | null = null
    try {
        const { data } = await db
            .from('client_profiles').select('id').ilike('email', o.email.trim()).maybeSingle()
        clientId = data?.id || null
    } catch { /* pas de compte : le dossier existe quand même */ }

    const maintenant = new Date().toISOString()
    const numero = `DOS-${Date.now().toString(36).toUpperCase()}`

    const { data, error } = await db
        .from('dossier_tracking')
        .insert({
            client_id: clientId,
            num_dossier: numero,
            client_nom: o.nom,
            client_prenom: o.prenom,
            client_email: o.email,
            client_phone: o.telephone || '',
            service_type: o.service_type,
            statut: 'reception',
            progression: 10,
            etapes: [],
            notes: o.notes || null,
            source: o.source || 'web',
            transaction_id: o.transaction_id || null,
            payment_method: o.payment_method || null,
            created_at: maintenant,
            updated_at: maintenant,
        })
        .select('id')
        .single()

    if (error || !data) {
        console.error('[ouvrirDossier] échec :', error?.message)
        return null
    }

    // Cloche in-app : le client voit son dossier apparaître, comme pour les
    // autres services souscrits depuis l'application.
    if (clientId) {
        await db.from('notifications').insert({
            user_id: clientId,
            title: 'Dossier ouvert',
            body: `Votre dossier « ${o.service_type} » est ouvert. Notre équipe revient vers vous sous 48 h ouvrées.`,
            type: 'dossier',
            is_read: false,
            created_at: maintenant,
        }).then(() => undefined, () => undefined)
    }

    return data.id
}

/**
 * Le dossier ouvert le plus récent d'un client, par email.
 *
 * Sert à rattacher une pièce déposée hors parcours (espace client) : un
 * document sans dossier n'apparaît nulle part côté équipe — c'est exactement
 * ainsi que des pièces se perdent.
 */
export async function dossierCourantDe(email: string): Promise<string | null> {
    if (!email?.trim()) return null
    const db = client()
    const { data } = await db
        .from('dossier_tracking')
        .select('id, statut, created_at')
        .ilike('client_email', email.trim())
        .order('created_at', { ascending: false })
        .limit(10)

    const lignes = data || []
    // Un dossier encore ouvert d'abord ; à défaut, le plus récent.
    return lignes.find(l => STATUTS_ACTIFS.includes(String(l.statut)))?.id || lignes[0]?.id || null
}
