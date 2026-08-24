import { createClient, SupabaseClient } from '@supabase/supabase-js'

/* ═══════════════════════════════════════════════════════════
   LIVRABLES — la porte unique par laquelle l'agence rend un document.

   Avant, chaque parcours envoyait son PDF par e-mail et s'arrêtait là.
   Le document n'existait donc que dans une boîte mail : perdu le courriel,
   perdu le travail. Et l'application mobile n'avait rien à lister.

   Toute production destinée au client passe désormais par `deposerLivrable` :
   le fichier va dans le bucket `client-documents`, une ligne le décrit dans
   `client_documents` avec `origine = 'agence'`, et l'écran « Mes documents »
   le voit sans qu'aucun code d'affichage soit à écrire.

   RÈGLE : cette fonction ne remplace PAS l'e-mail, elle s'y ajoute. Le
   client reçoit toujours son document ; il peut simplement le retrouver.
   Et elle n'échoue jamais bruyamment — un dépôt raté ne doit pas annuler
   un envoi réussi.
   ═══════════════════════════════════════════════════════════ */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const BUCKET = 'client-documents'

export type CategorieLivrable = 'fiche_analyse' | 'recap' | 'contrat' | 'autre'

export interface Livrable {
    /** E-mail du destinataire : seul rattachement toujours disponible. */
    email: string
    /** Renseigné quand le client a un compte ; facultatif. */
    clientId?: string | null
    categorie: CategorieLivrable
    /** Titre lisible, affiché tel quel dans l'application. */
    titre: string
    /** Nom de fichier proposé au téléchargement. */
    nomFichier: string
    /** Contenu du PDF déjà encodé (c'est la forme que produisent nos générateurs). */
    pdfBase64: string
    /** Dossier de nationalité rattaché, s'il y en a un. */
    nationalityId?: string | null
    /** Récap MyAfroOrigins rattaché, s'il y en a un. */
    recapId?: string | null
}

/**
 * Dépose un livrable et retourne son identifiant, ou `null` si le dépôt a
 * échoué. L'appelant n'a rien à gérer : l'échec est journalisé, jamais
 * propagé — envoyer le document au client reste l'objectif prioritaire.
 */
export async function deposerLivrable(l: Livrable): Promise<string | null> {
    if (!supabaseUrl || !serviceKey) return null

    try {
        const supabase: SupabaseClient = createClient(supabaseUrl, serviceKey)
        const contenu = Buffer.from(l.pdfBase64, 'base64')

        /* Chemin lisible et sans collision : la catégorie, puis l'horodatage.
           Deux fiches produites le même jour pour le même dossier ne
           s'écrasent donc pas — l'historique des versions est conservé. */
        const horodatage = new Date().toISOString().replace(/[:.]/g, '-')
        const chemin = `livrables/${l.categorie}/${horodatage}-${l.nomFichier}`

        const { error: erreurDepot } = await supabase.storage
            .from(BUCKET)
            .upload(chemin, contenu, { contentType: 'application/pdf', upsert: false })

        if (erreurDepot) {
            console.error('[livrables] dépôt du fichier impossible :', erreurDepot.message)
            return null
        }

        const { data, error } = await supabase
            .from('client_documents')
            .insert({
                origine: 'agence',
                categorie: l.categorie,
                titre: l.titre,
                nom_fichier: l.nomFichier,
                type_fichier: 'application/pdf',
                taille: contenu.length,
                storage_path: chemin,
                url: '',              // jamais d'URL publique : voir la note ci-dessous
                client_email: l.email.toLowerCase().trim(),
                client_id: l.clientId || null,
                nationality_id: l.nationalityId || null,
                recap_id: l.recapId || null,
            })
            .select('id')
            .single()

        if (error) {
            console.error('[livrables] enregistrement impossible :', error.message)
            return null
        }
        return data?.id ? String(data.id) : null
    } catch (e) {
        console.error('[livrables] échec inattendu :', e)
        return null
    }
}

/* Pas d'URL publique, volontairement : une fiche d'analyse contient des
   données personnelles (état civil, filiation, pièces d'identité). Le
   fichier n'est servi que par une URL signée, à durée limitée, délivrée
   par l'API mobile après vérification du jeton de session. */
export const DUREE_LIEN_SECONDES = 60 * 10

export async function lienSigne(cheminStockage: string): Promise<string | null> {
    if (!supabaseUrl || !serviceKey || !cheminStockage) return null
    try {
        const supabase = createClient(supabaseUrl, serviceKey)
        const { data, error } = await supabase.storage
            .from(BUCKET)
            .createSignedUrl(cheminStockage, DUREE_LIEN_SECONDES)
        if (error) return null
        return data?.signedUrl || null
    } catch {
        return null
    }
}
