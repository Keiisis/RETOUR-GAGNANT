// ══════════════════════════════════════════════════════════════
//  Corbeille des pièces nationalité : on ne détruit plus un fichier client.
//
//  Incident du 30/09/2026 : « Réinitialiser les pièces » a effacé les 9
//  pièces réelles de RG-NAT-2026-9353 (Lerisme Orisme). Elles n'ont pu être
//  rétablies que grâce à la sauvegarde complète du 24/09.
//  Désormais, toute suppression (réinitialisation, remplacement, retrait
//  d'une pièce, suppression d'un dossier) DÉPLACE le fichier sous
//  `corbeille/<date>/<chemin d'origine>` dans le même bucket : il reste
//  récupérable. Si le déplacement échoue, le fichier est laissé en place
//  (jamais de suppression définitive par défaut).
// ══════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js'

const BUCKET = 'nationality_documents'

/** Déplace les fichiers vers la corbeille ; renvoie le nombre déplacés. */
export async function mettreALaCorbeille(supabase: SupabaseClient, chemins: string[]): Promise<number> {
    const jour = new Date().toISOString().slice(0, 10)
    let deplaces = 0
    for (const chemin of chemins) {
        if (!chemin || chemin.startsWith('corbeille/')) continue
        const { error } = await supabase.storage.from(BUCKET).move(chemin, `corbeille/${jour}/${chemin}`)
        if (error) console.error('[corbeille nationalité] fichier laissé en place :', chemin, error.message)
        else deplaces++
    }
    return deplaces
}

/** Ligne de trace ajoutée aux notes agent (qui, quand, quoi). */
export function traceCorbeille(action: string, userId: string | undefined, nb: number): string {
    return `[${new Date().toISOString().slice(0, 16).replace('T', ' ')}] ${action} par ${userId || 'inconnu'} : ${nb} fichier(s) déplacé(s) en corbeille (récupérables).`
}
