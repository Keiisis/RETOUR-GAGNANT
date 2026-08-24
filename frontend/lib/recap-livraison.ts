import { SupabaseClient } from '@supabase/supabase-js'
import { generateFicheAnalysePdf, type FicheAnalyseData } from '@/lib/fiche-analyse-pdf'
import { deposerLivrable } from '@/lib/livrables'
import { sendEmail } from '@/lib/email'

/* ═══════════════════════════════════════════════════════════
   LIVRAISON D'UN RÉCAP MyAfroOrigins

   Le récap était livré sous forme de TEXTE, rangé dans `recap_ia`. Le
   client de l'application pouvait le lire, à condition de descendre au
   troisième niveau de navigation ; il n'avait aucun document à garder, à
   imprimer ou à montrer à une administration. Le dossier de nationalité,
   lui, produisait une vraie fiche PDF depuis le début.

   Ce module met les deux parcours au même niveau, SANS écrire un second
   générateur de PDF : il réutilise `generateFicheAnalysePdf`, celui de la
   nationalité. Une seule mise en page à maintenir, une seule identité
   visuelle, et une correction de style profite aux deux services.

   Le mapping mérite d'être explicite :
     · `diagnostic`  ← l'analyse rédigée (`recap_ia`), qui se pagine seule ;
     · `pieces`      ← les pièces que le client a déposées, pour qu'il voie
                       ce sur quoi l'analyse s'appuie ;
     · `statutBadge` ← « ANALYSE DE VOTRE DOSSIER », et non un avertissement :
                       ici rien n'est à régulariser, on rend un travail.
   ═══════════════════════════════════════════════════════════ */

export interface RecapALivrer {
    id: string
    reference: string | null
    nom: string | null
    prenom: string | null
    email: string
    situation: string | null
    recap_ia: string | null
}

interface PieceDeposee {
    file_name?: string | null
    created_at?: string | null
}

function dateLisible(): string {
    return new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function corpsEmail(prenom: string, reference: string): string {
    return `
<div style="max-width:560px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;color:#3C3C3C">
  <div style="height:6px;background:linear-gradient(90deg,#008751 0 33%,#FCD116 33% 66%,#E8112D 66% 100%)"></div>
  <div style="padding:28px 24px">
    <p style="font-size:15px;line-height:22px;margin:0 0 16px">Bonjour${prenom ? ' ' + prenom : ''},</p>
    <p style="font-size:15px;line-height:22px;margin:0 0 16px">
      L'analyse de votre dossier <strong>${reference}</strong> est terminée. Vous la trouverez
      en pièce jointe, au format PDF.
    </p>
    <p style="font-size:15px;line-height:22px;margin:0 0 16px">
      Elle reste également disponible à tout moment dans l'application mobile,
      rubrique <strong>Mes documents</strong>.
    </p>
    <p style="font-size:14px;line-height:21px;color:#505050;margin:0">
      Une question sur cette analyse ? Répondez simplement à ce message.
    </p>
  </div>
</div>`
}

/**
 * Produit la fiche PDF du récap, l'envoie au client et la dépose dans son
 * espace documents. Retourne `true` si le client a bien reçu quelque chose.
 *
 * Ne lève jamais : la livraison ne doit pas faire échouer la mise à jour du
 * statut côté panel. Les échecs sont journalisés.
 */
export async function livrerRecap(
    supabase: SupabaseClient,
    recap: RecapALivrer,
): Promise<{ envoye: boolean; motif?: string }> {
    try {
        if (!recap.recap_ia || !recap.recap_ia.trim()) {
            return { envoye: false, motif: 'Analyse vide : rien à livrer.' }
        }
        if (!recap.email) {
            return { envoye: false, motif: 'Demande sans adresse e-mail.' }
        }

        const reference = recap.reference || 'MyAfroOrigins'
        const clientName = `${recap.prenom || ''} ${recap.nom || ''}`.trim().toUpperCase() || 'CLIENT'

        /* Les pièces déposées apparaissent dans la fiche : le client voit sur
           quoi l'analyse s'appuie, et repère du même coup ce qu'il n'a pas
           envoyé. */
        const { data: pieces } = await supabase
            .from('client_documents')
            .select('nom_fichier, created_at')
            .eq('recap_id', recap.id)
            .order('created_at', { ascending: true })
            .limit(30)

        const lignes = (pieces || []) as PieceDeposee[]

        const fiche: FicheAnalyseData = {
            clientName,
            date: dateLisible(),
            objet: `Récap de dossier MyAfroOrigins — ${reference}`,
            statutBadge: 'ANALYSE DE VOTRE DOSSIER',
            diagnostic: recap.recap_ia.trim(),
            piecesTitle: lignes.length ? 'Pièces que vous nous avez transmises' : undefined,
            pieces: lignes.map(p => ({
                document: String(p.file_name || 'Pièce'),
                statut: 'Reçue',
                motif: 'Prise en compte dans l’analyse',
            })),
            finalNote: 'Cette analyse reste disponible dans votre application mobile, rubrique « Mes documents ».',
        }

        const pdfBase64 = generateFicheAnalysePdf(fiche)
        const nomFichier = `Recap-${String(reference).replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`

        const envoi = await sendEmail({
            to: recap.email,
            subject: `Votre analyse de dossier — ${reference}`,
            html: corpsEmail(String(recap.prenom || ''), reference),
            context: 'recap_myafroorigins',
            relatedId: recap.id,
            attachments: [{
                filename: nomFichier,
                content: pdfBase64,
                contentType: 'application/pdf',
            }],
        })

        /* Le dépôt suit l'envoi, jamais l'inverse : si le stockage tombe, le
           client a quand même sa fiche dans sa boîte. */
        await deposerLivrable({
            email: recap.email,
            categorie: 'recap',
            titre: `Analyse de dossier — ${reference}`,
            nomFichier,
            pdfBase64,
            recapId: recap.id,
        })

        if (!envoi.success) {
            return { envoye: false, motif: envoi.error || 'Envoi du courriel impossible.' }
        }
        return { envoye: true }
    } catch (e) {
        const motif = e instanceof Error ? e.message : 'Erreur inconnue'
        console.error('[recap-livraison]', motif)
        return { envoye: false, motif }
    }
}
