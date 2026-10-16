import type { SupabaseClient } from '@supabase/supabase-js'
import type { DossierStatut } from '@/lib/constants/statuts'

/* ══════════════════════════════════════════════════════════════════
   SUIVI D'UN DOSSIER DE NATIONALITÉ : dérivé du statut, jamais figé.

   Incident (2026-10-16, dossier RG-NAT-2026-8250) : le dossier était
   « En traitement » dans le panneau, mais la page de suivi du client
   affichait toujours « Réception du dossier », 14 %. Cause : les étapes
   de `dossier_tracking` étaient écrites UNE fois, à la création, et
   aucun changement de statut (admin, agent, transmission MyAfroOrigins)
   ne les mettait à jour. Le suivi restait gelé au jour du dépôt.

   Règle : le statut de `nationality_applications` est la seule vérité.
   Les étapes, le statut de suivi et la progression s'en déduisent ici,
   et tout chemin qui change ce statut appelle `synchroniserSuiviNationalite`.
   ══════════════════════════════════════════════════════════════════ */

export interface EtapeSuivi {
    id: number
    label: string
    status: 'completed' | 'in_progress' | 'pending'
    date: string | null
    note: string
}

/** Les sept étapes créées par le formulaire public et la saisie admin. */
const ETAPES: { label: string; fait: string }[] = [
    { label: 'Réception du dossier', fait: 'Dossier reçu et enregistré.' },
    { label: 'Vérification des pièces justificatives', fait: 'Pièces justificatives vérifiées.' },
    { label: 'Contrôle de conformité juridique', fait: 'Dossier conforme.' },
    { label: 'Instruction du dossier (Ministère)', fait: 'Instruction terminée.' },
    { label: 'Commission de validation', fait: 'Dossier examiné par la commission.' },
    { label: 'Décision et notification', fait: 'Décision rendue.' },
    { label: 'Délivrance du certificat', fait: 'Certificat délivré.' },
]

/**
 * Statut de la demande → étapes franchies, étape en cours, statut du suivi.
 * `faites` = nombre d'étapes terminées ; `enCours` = index de l'étape active.
 */
const PARCOURS: Record<string, { faites: number; enCours: number | null; statut: DossierStatut }> = {
    brouillon:     { faites: 1, enCours: null, statut: 'reception' },
    revue_myafro:  { faites: 1, enCours: null, statut: 'reception' },
    soumis:        { faites: 1, enCours: null, statut: 'reception' },
    en_traitement: { faites: 2, enCours: 2, statut: 'traitement' },
    verification:  { faites: 3, enCours: 3, statut: 'validation' },
    approuve:      { faites: 6, enCours: 6, statut: 'finalisation' },
    rejete:        { faites: 6, enCours: null, statut: 'termine' },
}

const jour = (d: Date) => d.toISOString().split('T')[0]

/**
 * Étapes du suivi pour un statut donné. Les dates et notes déjà présentes
 * sont conservées (une étape terminée garde le jour où elle l'a été).
 */
export function suiviNationalite(
    statutDemande: string | null | undefined,
    existantes: unknown = [],
    maintenant = new Date(),
): { statut: DossierStatut; progression: number; etapes: EtapeSuivi[] } {
    const p = PARCOURS[String(statutDemande || '')] || PARCOURS.soumis
    const avant = new Map<number, Partial<EtapeSuivi>>()
    for (const e of Array.isArray(existantes) ? existantes as Partial<EtapeSuivi>[] : []) {
        if (typeof e?.id === 'number') avant.set(e.id, e)
    }
    const rejet = statutDemande === 'rejete'
    // Un refus n'ouvre pas la délivrance du certificat : l'étape disparaît.
    const liste = rejet ? ETAPES.slice(0, 6) : ETAPES

    const etapes = liste.map((def, i): EtapeSuivi => {
        const id = i + 1
        const ex = avant.get(id)
        const status: EtapeSuivi['status'] = i < p.faites ? 'completed' : i === p.enCours ? 'in_progress' : 'pending'
        const memeEtat = ex?.status === status
        let note = memeEtat && ex?.note ? String(ex.note) : ''
        if (status === 'completed' && !note) note = def.fait
        if (id === 6 && status === 'completed') {
            note = rejet ? 'Demande non retenue. Contactez-nous pour en connaître les motifs.' : 'Demande approuvée.'
        }
        return {
            id,
            label: def.label,
            status,
            date: status === 'pending' ? null : (memeEtat && ex?.date ? String(ex.date) : jour(maintenant)),
            note,
        }
    })
    const faites = etapes.filter(e => e.status === 'completed').length
    return { statut: p.statut, progression: Math.round((faites / etapes.length) * 100), etapes }
}

/**
 * Vrai si des étapes ont été cochées à la main AU-DELÀ de ce que le statut
 * implique (onglet Dossiers). La réparation de masse et l'affichage public
 * ne doivent pas effacer ce travail ; un changement de statut explicite, si.
 */
export function suiviEnAvance(statutDemande: string | null | undefined, existantes: unknown): boolean {
    const p = PARCOURS[String(statutDemande || '')] || PARCOURS.soumis
    if (!Array.isArray(existantes)) return false
    return (existantes as Partial<EtapeSuivi>[]).some(e =>
        typeof e?.id === 'number' && e.id > p.faites && e.status === 'completed')
}

/** Met `dossier_tracking` en accord avec le statut de la demande `ref`. */
export async function synchroniserSuiviNationalite(
    sb: SupabaseClient,
    ref: string | null | undefined,
    statutDemande: string,
): Promise<void> {
    if (!ref) return
    const { data: suivi, error } = await sb
        .from('dossier_tracking').select('id, etapes').eq('num_dossier', ref).maybeSingle()
    if (error || !suivi) {
        if (error) console.error('[suivi-nationalite] lecture', ref, error.message)
        return
    }
    const s = suiviNationalite(statutDemande, suivi.etapes)
    const { error: errMaj } = await sb.from('dossier_tracking')
        .update({ statut: s.statut, progression: s.progression, etapes: s.etapes, updated_at: new Date().toISOString() })
        .eq('id', suivi.id)
    if (errMaj) console.error('[suivi-nationalite] mise à jour', ref, errMaj.message)
}
