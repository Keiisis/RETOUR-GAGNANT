/* ═══════════════════════════════════════════════════════════════
   PIÈCES DU DOSSIER DE NATIONALITÉ — LISTE DE RÉFÉRENCE

   Cette liste vivait uniquement dans le composant du formulaire public. Le
   panneau d'administration, lui, ne proposait qu'un champ libre « libellé +
   fichier » : rien ne garantissait qu'une pièce déposée par l'équipe porte
   le même intitulé que la même pièce déposée par le client. Deux dossiers
   pouvaient nommer différemment l'extrait de naissance du père.

   Elle est donc extraite ici et partagée par les deux surfaces. L'admin peut
   toujours la surcharger depuis `page_sections` (page « nationalite »,
   section « form_settings », clé `doc_slots`) : la fonction de chargement
   ci-dessous applique la configuration quand elle existe, et retombe sur
   cette liste sinon.

   ⚠️ Modifier la liste des pièces se fait EN BASE, depuis l'admin. Ce fichier
   n'est que le repli — le changer n'affecte que les installations sans
   configuration.
   ═══════════════════════════════════════════════════════════════ */

export interface DocSlot {
    /** Clé stable — sert de préfixe de nom de fichier, ne jamais la renommer. */
    key: string
    label: string
    /** Plusieurs fichiers acceptés dans cet emplacement. */
    multi?: boolean
    required?: boolean
    /** Pièce d'ascendance : son absence déclenche la proposition de recherche. */
    ancestral?: boolean
    /** Demandée seulement dans un cas précis (ex. `has_children`). */
    conditional?: string
    hint?: string
}

/** Liste officielle, valable à défaut de configuration en base. */
export const DOC_SLOTS_DEFAUT: DocSlot[] = [
    { key: 'identite', label: "Pièce d'identité en cours de validité", multi: false, required: true },
    { key: 'naissance_demandeur', label: 'Votre extrait de naissance', multi: false, required: true },
    { key: 'afro_descendance', label: "Preuve d'afro-descendance", multi: true, required: true, hint: 'ADN, acte notarié, archives historiques, arbre généalogique…' },
    { key: 'profession', label: 'Preuve de profession', multi: false, required: true },
    { key: 'domicile', label: 'Justificatif de domicile', multi: false, required: true },
    { key: 'casier', label: 'Casier judiciaire (extrait récent)', multi: false, required: true },
    { key: 'naissance_pere', label: 'Extrait de naissance du père', multi: false, required: true },
    { key: 'naissance_mere', label: 'Extrait de naissance de la mère', multi: false, required: true },
    { key: 'livret_parents', label: 'Copie du livret de famille de vos parents', multi: false, required: true },
    { key: 'agp_paternel', label: 'Extrait de naissance : arrière-grand-père (côté paternel)', multi: false, required: false, ancestral: true },
    { key: 'agm_paternelle', label: 'Extrait de naissance : arrière-grand-mère (côté paternel)', multi: false, required: false, ancestral: true },
    { key: 'agp_maternel', label: 'Extrait de naissance : arrière-grand-père (côté maternel)', multi: false, required: false, ancestral: true },
    { key: 'agm_maternelle', label: 'Extrait de naissance : arrière-grand-mère (côté maternel)', multi: false, required: false, ancestral: true },
    { key: 'livret_mineur', label: 'Copie de votre livret de famille (si enfant mineur)', multi: false, required: false, conditional: 'has_children' },
    { key: 'actes_ascendants', label: 'Autres actes des grands-parents et arrière-grands-parents', multi: true, required: false, hint: 'Acte de mariage, notarial, militaire ou de décès : tout document disponible' },
    { key: 'photo', label: "Photo d'identité récente (moins de 6 mois)", multi: false, required: false },
]

/**
 * Emplacements réellement en vigueur : ceux configurés en base s'ils
 * existent, la liste de référence sinon.
 *
 * `charger` reçoit le client Supabase de l'appelant — ce module ne doit pas
 * en instancier un, il est importé côté navigateur comme côté serveur.
 */
export async function chargerDocSlots(
    supabase: { from: (t: string) => any }, // eslint-disable-line @typescript-eslint/no-explicit-any
): Promise<DocSlot[]> {
    try {
        const { data } = await supabase
            .from('page_sections').select('content')
            .eq('page', 'nationalite').eq('section_key', 'form_settings').maybeSingle()
        const contenu = (data?.content || {}) as Record<string, unknown>
        const slots = contenu.doc_slots
        if (Array.isArray(slots) && slots.length) return slots as DocSlot[]
    } catch {
        // Base injoignable : la liste de référence reste exacte.
    }
    return DOC_SLOTS_DEFAUT
}
