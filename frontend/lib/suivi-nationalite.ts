import type { SupabaseClient } from '@supabase/supabase-js'
import type { DossierStatut, NationaliteStatut } from '@/lib/constants/statuts'

/* ══════════════════════════════════════════════════════════════════
   SUIVI D'UN DOSSIER DE NATIONALITÉ (page client /suivi-dossier)

   Incident (2026-10-16, dossier RG-NAT-2026-8250) : le dossier était
   « En traitement » dans le panneau, mais la page de suivi du client
   affichait toujours « Réception du dossier », 14 %. Les étapes de
   `dossier_tracking` étaient écrites une fois, à la création, et aucun
   changement de statut ne les mettait à jour.

   Deux réglages, une seule cohérence :
   - le panneau « Suivi client » choisit l'étape exacte (7 étapes, notes
     visibles du client, pièces manquantes) ; le statut de la demande en
     découle (`statutPourAvancement`) ;
   - le sélecteur de statut déplace le suivi vers la première étape de ce
     statut, sauf si le suivi s'y trouve déjà (une étape fine n'est pas
     écrasée par un statut qui la contient).
   ══════════════════════════════════════════════════════════════════ */

export interface EtapeSuivi {
    id: number
    label: string
    status: 'completed' | 'in_progress' | 'pending'
    date: string | null
    note: string
}

/** Les sept étapes créées par le formulaire public et la saisie admin. */
export const ETAPES_NATIONALITE: { label: string; fait: string }[] = [
    { label: 'Réception du dossier', fait: 'Dossier reçu et enregistré.' },
    { label: 'Vérification des pièces justificatives', fait: 'Pièces justificatives vérifiées.' },
    { label: 'Contrôle de conformité juridique', fait: 'Dossier conforme.' },
    { label: 'Instruction du dossier (Ministère)', fait: 'Instruction terminée.' },
    { label: 'Commission de validation', fait: 'Dossier examiné par la commission.' },
    { label: 'Décision et notification', fait: 'Demande approuvée.' },
    { label: 'Délivrance du certificat', fait: 'Certificat délivré.' },
]
const NOTE_REJET = 'Demande non retenue. Contactez-nous pour en connaître les motifs.'
/** Notes écrites par le système : recalculées, jamais tenues pour une note de l'équipe. */
const NOTES_AUTO = new Set([...ETAPES_NATIONALITE.map(e => e.fait), NOTE_REJET, 'Décision rendue.'])

/** Avancement = étapes terminées (1 à 7) + une étape en cours ou non. */
export interface Avancement { faites: number; enCours: boolean }

/** Statut de la demande pour un avancement donné. */
export function statutPourAvancement(faites: number): NationaliteStatut {
    if (faites <= 1) return 'soumis'
    if (faites === 2) return 'en_traitement'
    if (faites <= 5) return 'verification'
    return 'approuve'
}

/** Avancement par défaut d'un statut choisi dans le sélecteur. */
const DEFAUT: Record<string, Avancement> = {
    brouillon: { faites: 1, enCours: false },
    revue_myafro: { faites: 1, enCours: false },
    soumis: { faites: 1, enCours: false },
    en_traitement: { faites: 2, enCours: true },
    verification: { faites: 3, enCours: true },
    approuve: { faites: 6, enCours: true },
}
/** Dernière étape terminée que chaque statut autorise. */
const MAX_FAITES: Record<string, number> = { brouillon: 1, revue_myafro: 1, soumis: 1, en_traitement: 2, verification: 5, approuve: 7, rejete: 6 }

const SUIVI_STATUT = (faites: number, rejet: boolean): DossierStatut =>
    rejet || faites >= 7 ? 'termine' : faites <= 1 ? 'reception' : faites === 2 ? 'traitement' : faites <= 5 ? 'validation' : 'finalisation'

const jour = (d: Date) => d.toISOString().split('T')[0]

const indexer = (existantes: unknown) => {
    const m = new Map<number, Partial<EtapeSuivi>>()
    for (const e of Array.isArray(existantes) ? existantes as Partial<EtapeSuivi>[] : []) {
        if (typeof e?.id === 'number') m.set(e.id, e)
    }
    return m
}

/** Avancement lu dans les étapes enregistrées (préfixe d'étapes terminées). */
export function lireAvancement(existantes: unknown): Avancement {
    const m = indexer(existantes)
    let faites = 0
    while (faites < 7 && m.get(faites + 1)?.status === 'completed') faites++
    return { faites: Math.max(1, faites), enCours: m.get(faites + 1)?.status === 'in_progress' }
}

/**
 * Étapes du suivi pour un avancement donné. Dates et notes déjà présentes
 * sont conservées ; `notes` (panneau) remplace la note des étapes citées.
 */
export function construireSuivi(
    av: Avancement,
    existantes: unknown = [],
    { rejet = false, notes = {}, maintenant = new Date() }: { rejet?: boolean; notes?: Record<number, string>; maintenant?: Date } = {},
): { statut: DossierStatut; progression: number; etapes: EtapeSuivi[] } {
    const faites = Math.min(rejet ? 6 : 7, Math.max(1, Math.round(av.faites)))
    const avant = indexer(existantes)
    // Un refus n'ouvre pas la délivrance du certificat : l'étape disparaît.
    const liste = rejet ? ETAPES_NATIONALITE.slice(0, 6) : ETAPES_NATIONALITE
    const etapes = liste.map((def, i): EtapeSuivi => {
        const id = i + 1
        const ex = avant.get(id)
        const status: EtapeSuivi['status'] = id <= faites ? 'completed' : (id === faites + 1 && av.enCours && !rejet) ? 'in_progress' : 'pending'
        const memeEtat = ex?.status === status
        let note = id in notes ? String(notes[id] ?? '').slice(0, 500) : (ex?.note && !NOTES_AUTO.has(String(ex.note)) ? String(ex.note) : '')
        if (status === 'completed' && !note) note = def.fait
        if (id === 6 && status === 'completed' && (!note || NOTES_AUTO.has(note))) note = rejet ? NOTE_REJET : def.fait
        return {
            id,
            label: def.label,
            status,
            date: status === 'pending' ? null : (memeEtat && ex?.date ? String(ex.date) : jour(maintenant)),
            note,
        }
    })
    const n = etapes.filter(e => e.status === 'completed').length
    return { statut: SUIVI_STATUT(faites, rejet), progression: Math.round((n / etapes.length) * 100), etapes }
}

/**
 * Suivi pour un statut choisi dans le sélecteur. Si le suivi est déjà à une
 * étape couverte par ce statut (ex. « Commission de validation » pour
 * « Vérification »), il reste où il est.
 */
export function suiviNationalite(
    statutDemande: string | null | undefined,
    existantes: unknown = [],
    maintenant = new Date(),
): { statut: DossierStatut; progression: number; etapes: EtapeSuivi[] } {
    const s = String(statutDemande || '')
    if (s === 'rejete') return construireSuivi({ faites: 6, enCours: false }, existantes, { rejet: true, maintenant })
    const ex = lireAvancement(existantes)
    const garde = statutPourAvancement(ex.faites) === s && Array.isArray(existantes) && existantes.length === 7
    return construireSuivi(garde ? ex : (DEFAUT[s] || DEFAUT.soumis), existantes, { maintenant })
}

/**
 * Vrai si des étapes ont été cochées à la main AU-DELÀ de ce que le statut
 * autorise (onglet Dossiers). La réparation de masse et l'affichage public
 * ne doivent pas effacer ce travail ; un changement de statut explicite, si.
 */
export function suiviEnAvance(statutDemande: string | null | undefined, existantes: unknown): boolean {
    return lireAvancement(existantes).faites > (MAX_FAITES[String(statutDemande || '')] ?? 1)
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
