// ══════════════════════════════════════════════════════════════
//  Stockage des enregistrements MyAfroOrigins (SERVEUR SEULEMENT).
//
//  Un fichier JSON par dossier dans le bucket PRIVÉ `myafro-enregistrements`
//  (`<nature>/<id>.json`). Privé = aucune politique d'accès : seule la clé
//  service (routes /api/agent/*, réservées aux agents et admins) le lit. Le
//  mot de passe du portail n'en sort que par la route de détail et la fiche.
//  Le dossier source (nationalité ou récap) est relu en base à chaque
//  écriture : nom, prénom et e-mail ne viennent jamais du navigateur.
// ══════════════════════════════════════════════════════════════
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { civiliteDepuisGenre, type EnregistrementMyafro, type NatureDossier, type ResumeEnregistrement, type SaisieEnregistrement } from './myafro-enregistrement'

export const BUCKET_MYAFRO = 'myafro-enregistrements'

export const db = (): SupabaseClient => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

let bucketPret = false
async function assurerBucket(sb: SupabaseClient) {
    if (bucketPret) return
    const { data } = await sb.storage.getBucket(BUCKET_MYAFRO)
    if (data) {
        if (data.public) await sb.storage.updateBucket(BUCKET_MYAFRO, { public: false })
    } else {
        const { error } = await sb.storage.createBucket(BUCKET_MYAFRO, { public: false })
        if (error && !/already exists/i.test(error.message)) throw error
    }
    bucketPret = true
}

const chemin = (nature: NatureDossier, id: string) => `${nature}/${id}.json`

/** Dossier source : identité et contact tels qu'en base. */
export interface DossierSource { id: string; reference: string; nom: string; prenom: string; email: string; genre?: string | null; telephone?: string | null; myafroReference?: string | null; statut?: string | null }

export async function lireDossierSource(sb: SupabaseClient, nature: NatureDossier, id: string): Promise<DossierSource | null> {
    if (nature === 'libre') return null
    if (nature === 'nationalite') {
        const { data } = await sb.from('nationality_applications').select('id, application_ref, nom, prenom, email, genre, telephone, status').eq('id', id).maybeSingle()
        return data ? { id: data.id, reference: data.application_ref, nom: data.nom || '', prenom: data.prenom || '', email: data.email || '', genre: data.genre, telephone: data.telephone, statut: data.status } : null
    }
    const { data } = await sb.from('myafro_recap_requests').select('id, reference, nom, prenom, email, telephone, myafro_reference, statut').eq('id', id).maybeSingle()
    return data ? { id: data.id, reference: data.reference, nom: data.nom || '', prenom: data.prenom || '', email: data.email || '', telephone: data.telephone, myafroReference: data.myafro_reference, statut: data.statut } : null
}

export async function lireEnregistrement(nature: NatureDossier, id: string, sb = db()): Promise<EnregistrementMyafro | null> {
    await assurerBucket(sb)
    const { data, error } = await sb.storage.from(BUCKET_MYAFRO).download(chemin(nature, id))
    if (error || !data) return null
    try { return JSON.parse(await data.text()) as EnregistrementMyafro } catch { return null }
}

async function ecrire(sb: SupabaseClient, e: EnregistrementMyafro) {
    const { error } = await sb.storage.from(BUCKET_MYAFRO).upload(chemin(e.nature, e.dossierId), new Blob([JSON.stringify(e, null, 1)], { type: 'application/json' }), { upsert: true, contentType: 'application/json', cacheControl: '0' })
    if (error) throw error
}

export const sansSecret = ({ motDePasse: _m, ...r }: EnregistrementMyafro): ResumeEnregistrement => { void _m; return r }

/** Tous les enregistrements d'une nature, SANS mot de passe (marqueurs et filtres des listes). */
export async function listerEnregistrements(nature: NatureDossier, sb = db()): Promise<ResumeEnregistrement[]> {
    await assurerBucket(sb)
    const { data, error } = await sb.storage.from(BUCKET_MYAFRO).list(nature, { limit: 1000 })
    if (error) throw error
    const ids = (data || []).map(f => f.name).filter(n => n.endsWith('.json')).map(n => n.slice(0, -5))
    const tous = await Promise.all(ids.map(id => lireEnregistrement(nature, id, sb)))
    return tous.filter((e): e is EnregistrementMyafro => !!e).map(sansSecret)
}

/** Crée ou met à jour l'enregistrement ; chaque changement de statut entre dans l'historique.
 *  Identité, numéro, e-mail et mot de passe sont ceux SAISIS par l'équipe (fournis par le client
 *  et utilisés sur MyAfroOrigins) ; le dossier source ne donne que la référence interne. */
export async function enregistrer(nature: NatureDossier, dossierId: string, source: DossierSource | null, saisie: SaisieEnregistrement, par: string, sb = db()): Promise<EnregistrementMyafro> {
    const avant = await lireEnregistrement(nature, dossierId, sb)
    const maintenant = new Date().toISOString()
    const historique = [...(avant?.historique || [])]
    if (!avant || avant.statut !== saisie.statut || saisie.note) historique.push({ le: maintenant, statut: saisie.statut, par, ...(saisie.note ? { note: saisie.note } : {}) })
    const e: EnregistrementMyafro = {
        nature,
        dossierId,
        referenceRgb: source?.reference || avant?.referenceRgb || `FS-${maintenant.slice(0, 10).replace(/-/g, '')}-${dossierId.slice(0, 4).toUpperCase()}`,
        numeroDossier: saisie.numeroDossier,
        dateDepot: saisie.dateDepot,
        emailSuivi: saisie.emailSuivi,
        motDePasse: saisie.motDePasse,
        statut: saisie.statut,
        demandeur: { civilite: saisie.civilite || civiliteDepuisGenre(source?.genre), nom: saisie.nom, prenom: saisie.prenom },
        creeLe: avant?.creeLe || maintenant,
        creePar: avant?.creePar || par,
        majLe: maintenant,
        majPar: par,
        ficheEnvoyeeLe: avant?.ficheEnvoyeeLe,
        ficheEnvoyeeA: avant?.ficheEnvoyeeA,
        historique,
    }
    await assurerBucket(sb)
    await ecrire(sb, e)
    return e
}

/** Retrait d'une fiche : jamais d'effacement définitif, le fichier part en corbeille (horodaté). */
export async function mettreEnCorbeille(nature: NatureDossier, id: string, sb = db()) {
    await assurerBucket(sb)
    const { error } = await sb.storage.from(BUCKET_MYAFRO).move(chemin(nature, id), `_corbeille/${nature}/${id}_${Date.now()}.json`)
    if (error) throw error
}

export async function noterFicheEnvoyee(e: EnregistrementMyafro, a: string, sb = db()) {
    await ecrire(sb, { ...e, ficheEnvoyeeLe: new Date().toISOString(), ficheEnvoyeeA: a })
}

/** Identité lisible de la personne connectée (trace « par »). */
export async function auteur(sb: SupabaseClient, userId?: string): Promise<string> {
    if (!userId) return 'inconnu'
    const { data } = await sb.auth.admin.getUserById(userId)
    return data?.user?.email || userId
}
