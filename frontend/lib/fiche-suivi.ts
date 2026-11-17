// ══════════════════════════════════════════════════════════════
//  Fiche de Suivi Client RGB : modèle, libellés, contrôle des saisies
//  et règles de suivi. Partagé par l'API, l'écran agent/admin et
//  l'impression : un libellé changé ici change partout.
//  Table : fiches_suivi_client (supabase_fiches_suivi_client.sql).
// ══════════════════════════════════════════════════════════════

export type StatutPiece = 'attente' | 'recue' | 'conforme'

export interface PieceReclamee {
    date: string | null
    piece: string
    statut: StatutPiece
}

export interface FicheSuivi {
    id: string
    numero: string
    client_id: string | null
    source: 'inscription' | 'manuel'
    date_fiche: string
    statut_dossier: 'nouveau' | 'myafro'
    date_depot: string | null
    nom_complet: string | null
    telephone: string | null
    email: string | null
    pays: string | null
    ville: string | null
    canaux: string[]
    reclamation_statut: string | null
    date_etat_lieux: string | null
    observation: string | null
    accueil_statut: string | null
    accueil_date_reclamation: string | null
    accueil_date_reception: string | null
    frais_statut: string | null
    frais_date: string | null
    frais_justificatif: boolean
    pieces: PieceReclamee[]
    analyse_suivi: string | null
    guichet_statut: string | null
    guichet_date: string | null
    ceremonie_statut: string | null
    ceremonie_date: string | null
    created_at: string
    updated_at: string
}

// Cases à cocher du modèle, dans l'ordre du modèle.
export const OPTIONS = {
    statut_dossier: [['nouveau', 'Nouveau'], ['myafro', 'Déjà inséré sur MyAfroOrigins']],
    canaux: [['whatsapp', 'WhatsApp'], ['email', 'E-mail'], ['tel', 'Tél'], ['sur_place', 'Sur place']],
    reclamation_statut: [
        ['aucune', 'Aucune évolution'],
        ['aucune_3m', 'Aucune évolution (+ de 3 mois)'],
        ['aucune_6m', 'Aucune évolution (+ de 6 mois)'],
        ['attestation', "Déjà reçu l'attestation d'éligibilité"],
    ],
    accueil_statut: [['complet', 'Dossier complet'], ['partiel', 'Partiellement'], ['attente', 'En attente des pièces']],
    frais_statut: [['recu', 'Reçu'], ['verifie', 'Vérifié'], ['attente', 'En attente']],
    piece_statut: [['recue', 'Reçue'], ['conforme', 'Conforme'], ['attente', 'En attente']],
    guichet_statut: [['programme', 'Programmé'], ['effectue', 'Effectué'], ['attente', 'En attente']],
    ceremonie_statut: [['inscrit', 'Inscrit'], ['remise', 'Remise effectuée'], ['attente', 'En attente']],
} as const satisfies Record<string, readonly (readonly [string, string])[]>

const valeurs = (k: keyof typeof OPTIONS) => OPTIONS[k].map(([v]) => v as string)

// « Vérifié » suppose « Reçu », « Conforme » suppose « Reçue » : sur la
// fiche imprimée, les deux cases sont cochées.
export function casesCochees(champ: keyof typeof OPTIONS, valeur: string | null | undefined): string[] {
    if (!valeur) return []
    if (champ === 'frais_statut' && valeur === 'verifie') return ['recu', 'verifie']
    if (champ === 'piece_statut' && valeur === 'conforme') return ['recue', 'conforme']
    return [valeur]
}

export const LIMITES = { court: 160, observation: 800, piece: 300, analyse: 20000, pieces: 200 } as const

const TEXTES: Record<string, number> = {
    nom_complet: LIMITES.court, telephone: 60, email: LIMITES.court, pays: 80, ville: 80,
    observation: LIMITES.observation, analyse_suivi: LIMITES.analyse,
}
const DATES = ['date_fiche', 'date_depot', 'date_etat_lieux', 'accueil_date_reclamation', 'accueil_date_reception',
    'frais_date', 'guichet_date', 'ceremonie_date']
const CHOIX = ['statut_dossier', 'reclamation_statut', 'accueil_statut', 'frais_statut', 'guichet_statut', 'ceremonie_statut'] as const

const estDate = (v: unknown): v is string =>
    typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + 'T00:00:00Z'))

/**
 * Garde seulement les champs modifiables, au bon format. Un champ invalide
 * renvoie une erreur plutôt que d'être ignoré en silence.
 */
export function nettoyerSaisie(corps: unknown): { ok: true; valeurs: Record<string, unknown> } | { ok: false; erreur: string } {
    if (!corps || typeof corps !== 'object') return { ok: false, erreur: 'Corps de requête invalide' }
    const entree = corps as Record<string, unknown>
    const out: Record<string, unknown> = {}

    for (const [champ, max] of Object.entries(TEXTES)) {
        if (!(champ in entree)) continue
        const v = entree[champ]
        if (v === null || v === '') { out[champ] = null; continue }
        if (typeof v !== 'string') return { ok: false, erreur: `${champ} : texte attendu` }
        const t = v.trim()
        if (t.length > max) return { ok: false, erreur: `${champ} : ${max} caractères au plus` }
        out[champ] = champ === 'email' ? t.toLowerCase() : (t || null)
    }

    for (const champ of DATES) {
        if (!(champ in entree)) continue
        const v = entree[champ]
        if (v === null || v === '') {
            if (champ === 'date_fiche') return { ok: false, erreur: 'date_fiche obligatoire' }
            out[champ] = null
            continue
        }
        if (!estDate(v)) return { ok: false, erreur: `${champ} : date AAAA-MM-JJ attendue` }
        out[champ] = v
    }

    for (const champ of CHOIX) {
        if (!(champ in entree)) continue
        const v = entree[champ]
        if (v === null || v === '') {
            if (champ === 'statut_dossier') return { ok: false, erreur: 'statut_dossier obligatoire' }
            out[champ] = null
            continue
        }
        if (typeof v !== 'string' || !valeurs(champ).includes(v)) return { ok: false, erreur: `${champ} : valeur inconnue` }
        out[champ] = v
    }

    if ('canaux' in entree) {
        const v = entree.canaux
        if (!Array.isArray(v) || v.some(c => typeof c !== 'string' || !valeurs('canaux').includes(c)))
            return { ok: false, erreur: 'canaux : valeur inconnue' }
        out.canaux = [...new Set(v as string[])]
    }

    if ('frais_justificatif' in entree) {
        if (typeof entree.frais_justificatif !== 'boolean') return { ok: false, erreur: 'frais_justificatif : vrai/faux attendu' }
        out.frais_justificatif = entree.frais_justificatif
    }

    if ('pieces' in entree) {
        const v = entree.pieces
        if (!Array.isArray(v)) return { ok: false, erreur: 'pieces : liste attendue' }
        if (v.length > LIMITES.pieces) return { ok: false, erreur: `pieces : ${LIMITES.pieces} au plus` }
        const pieces: PieceReclamee[] = []
        for (const [i, p] of v.entries()) {
            if (!p || typeof p !== 'object') return { ok: false, erreur: `pièce ${i + 1} invalide` }
            const { date, piece, statut } = p as Record<string, unknown>
            if (typeof piece !== 'string' || piece.trim().length > LIMITES.piece)
                return { ok: false, erreur: `pièce ${i + 1} : libellé de ${LIMITES.piece} caractères au plus` }
            if (date !== null && date !== '' && date !== undefined && !estDate(date))
                return { ok: false, erreur: `pièce ${i + 1} : date AAAA-MM-JJ attendue` }
            if (typeof statut !== 'string' || !valeurs('piece_statut').includes(statut))
                return { ok: false, erreur: `pièce ${i + 1} : statut inconnu` }
            pieces.push({ date: estDate(date) ? date : null, piece: piece.trim(), statut: statut as StatutPiece })
        }
        out.pieces = pieces
    }

    return { ok: true, valeurs: out }
}

// ─── Règles de suivi ─────────────────────────────────────────

const ETAPES = ['Accueil', 'Pièces', 'Frais', 'Guichet unique', 'Cérémonie', 'Terminé'] as const

/** Étape en cours et part du parcours accomplie (0 à 100). */
export function avancement(f: Pick<FicheSuivi, 'accueil_statut' | 'pieces' | 'frais_statut' | 'guichet_statut' | 'ceremonie_statut'>) {
    const pieces = f.pieces || []
    const faits = [
        f.accueil_statut === 'complet' || f.accueil_statut === 'partiel',
        pieces.length > 0 && pieces.every(p => p.statut === 'conforme'),
        f.frais_statut === 'verifie',
        f.guichet_statut === 'effectue',
        f.ceremonie_statut === 'remise',
    ]
    const index = faits.findIndex(x => !x)
    const nb = faits.filter(Boolean).length
    return { etape: ETAPES[index === -1 ? 5 : index], pourcentage: Math.round((nb / faits.length) * 100) }
}

/** Mois entiers écoulés entre deux dates AAAA-MM-JJ. */
export function moisEcoules(depuis: string, jusqua: string): number {
    const [a1, m1, j1] = depuis.split('-').map(Number)
    const [a2, m2, j2] = jusqua.split('-').map(Number)
    return (a2 - a1) * 12 + (m2 - m1) - (j2 < j1 ? 1 : 0)
}

export interface Suggestion { id: string; texte: string; changement: Partial<FicheSuivi> }

/**
 * Ce que la fiche dit d'elle-même : chaque suggestion est une
 * modification prête à appliquer en un clic, jamais appliquée seule.
 */
export function suggestions(f: FicheSuivi, aujourdhui: string): Suggestion[] {
    const out: Suggestion[] = []
    const pieces = f.pieces || []

    if (f.statut_dossier === 'myafro' && f.date_depot && f.reclamation_statut !== 'attestation') {
        const mois = moisEcoules(f.date_depot, aujourdhui)
        const attendu = mois >= 6 ? 'aucune_6m' : mois >= 3 ? 'aucune_3m' : 'aucune'
        if (mois >= 0 && f.reclamation_statut !== attendu) {
            out.push({
                id: 'reclamation',
                texte: `Dépôt MyAfroOrigins il y a ${mois} mois : statut de réclamation « ${libelle('reclamation_statut', attendu)} »`,
                changement: { reclamation_statut: attendu },
            })
        }
    }

    if (pieces.length > 0) {
        const conformes = pieces.every(p => p.statut === 'conforme')
        const recues = pieces.filter(p => p.statut !== 'attente').length
        if (conformes && f.accueil_statut !== 'complet') {
            out.push({
                id: 'complet',
                texte: 'Toutes les pièces sont conformes : marquer le dossier complet',
                changement: { accueil_statut: 'complet', accueil_date_reception: f.accueil_date_reception || aujourdhui },
            })
        } else if (!conformes && recues > 0 && (!f.accueil_statut || f.accueil_statut === 'attente')) {
            out.push({
                id: 'partiel',
                texte: `${recues} pièce(s) sur ${pieces.length} reçue(s) : dossier partiellement constitué`,
                changement: { accueil_statut: 'partiel' },
            })
        } else if (recues === 0 && !f.accueil_statut) {
            out.push({ id: 'attente', texte: 'Aucune pièce reçue : dossier en attente des pièces', changement: { accueil_statut: 'attente' } })
        }
    }

    if (f.frais_justificatif && (!f.frais_statut || f.frais_statut === 'attente')) {
        out.push({
            id: 'frais',
            texte: 'Justificatif de paiement présent : frais MyAfroOrigins reçus',
            changement: { frais_statut: 'recu', frais_date: f.frais_date || aujourdhui },
        })
    }

    if (f.guichet_statut === 'effectue' && !f.ceremonie_statut) {
        out.push({
            id: 'ceremonie',
            texte: 'Enrôlement effectué : préparer l\'inscription à la cérémonie',
            changement: { ceremonie_statut: 'attente' },
        })
    }

    return out
}

export function libelle(champ: keyof typeof OPTIONS, valeur: string | null | undefined): string {
    return (OPTIONS[champ] as readonly (readonly [string, string])[]).find(([v]) => v === valeur)?.[1] ?? ''
}

/** Date du jour à Cotonou, AAAA-MM-JJ. */
export function aujourdhuiCotonou(d = new Date()): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Porto-Novo' }).format(d)
}
