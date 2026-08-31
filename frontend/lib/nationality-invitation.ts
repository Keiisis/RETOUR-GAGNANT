import { randomInt } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

/* ═══════════════════════════════════════════════════════════════
   CODES D'INVITATION — GÉNÉRATION, VÉRIFICATION, CONSOMMATION

   Un code tient lieu de règlement. Il vaut donc de l'argent, et tout ce qui
   suit part de là.

   TROIS RÈGLES QUI NE SE NÉGOCIENT PAS

   1. LA DÉCISION EST SERVEUR. Le navigateur peut vérifier un code pour
      afficher « code valide » — c'est du confort. Ce qui accorde réellement
      la gratuité, c'est `consommerCodeInvitation`, appelée depuis la route
      de soumission. Un client qui forge « paiement effectué » dans sa
      requête n'obtient rien.

   2. LA CONSOMMATION EST ATOMIQUE. Le passage `actif` → `utilise` se fait
      par une mise à jour CONDITIONNELLE dont on vérifie qu'elle a touché
      une ligne. Deux soumissions simultanées avec le même code : une seule
      gagne, l'autre reçoit un refus. Lire puis écrire aurait laissé les deux
      passer.

   3. LA PORTÉE EST RESPECTÉE À LA LETTRE. Un code qui ne couvre que les
      frais de dossier ne rend pas la recherche ancestrale gratuite. Ce sont
      deux prestations, deux montants, deux décisions commerciales.

   Le code n'est pas un secret cryptographique — il est lu au téléphone,
   recopié dans un email. Il est donc court et lisible, mais tiré au sort
   par `randomInt` (source système) et non par `Math.random`, et l'alphabet
   exclut les caractères qu'on confond à l'oral et à l'œil.
   ═══════════════════════════════════════════════════════════════ */

/** Sans I, O, 0, 1 : personne ne doit échouer parce qu'il a lu « I » pour « 1 ». */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const GROUPES = 3
const TAILLE_GROUPE = 4

export interface CodeInvitation {
    id: string
    code: string
    couvre_dossier: boolean
    couvre_ancestrale: boolean
    montant_dossier: number | null
    montant_ancestrale: number | null
    devise: string
    statut: 'actif' | 'utilise' | 'revoque'
    email_cible: string | null
    note: string | null
    expire_le: string | null
    cree_le: string
    cree_par_email: string | null
    utilise_le: string | null
    utilise_par_ref: string | null
    utilise_par_email: string | null
}

/** « RGB-A7K2-9MNP-4TQX » — lisible au téléphone, sans caractère ambigu. */
export function genererCode(): string {
    const groupes: string[] = []
    for (let g = 0; g < GROUPES; g++) {
        let bloc = ''
        for (let i = 0; i < TAILLE_GROUPE; i++) bloc += ALPHABET[randomInt(ALPHABET.length)]
        groupes.push(bloc)
    }
    return `RGB-${groupes.join('-')}`
}

/** Tolère la casse, les espaces et les tirets oubliés à la saisie. */
export function normaliserCode(saisie: unknown): string {
    const brut = String(saisie ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (!brut.startsWith('RGB')) return ''
    const corps = brut.slice(3)
    if (corps.length !== GROUPES * TAILLE_GROUPE) return ''
    const groupes: string[] = []
    for (let i = 0; i < GROUPES; i++) groupes.push(corps.slice(i * TAILLE_GROUPE, (i + 1) * TAILLE_GROUPE))
    return `RGB-${groupes.join('-')}`
}

export interface VerdictCode {
    valide: boolean
    /** Message destiné au client — jamais de détail exploitable. */
    motif?: string
    code?: CodeInvitation
}

/**
 * Lit un code SANS le consommer. Sert à l'affichage : « ce code couvre les
 * frais de dossier ». Ne débloque rien par elle-même.
 *
 * `emailSaisi` permet de faire respecter un code nominatif dès la
 * vérification, pour que le client le sache avant de remplir tout le dossier.
 */
export async function verifierCodeInvitation(
    supabase: SupabaseClient,
    saisie: unknown,
    emailSaisi?: string | null,
): Promise<VerdictCode> {
    const code = normaliserCode(saisie)
    if (!code) return { valide: false, motif: 'Ce code n’a pas le bon format.' }

    const { data, error } = await supabase
        .from('nationality_invitation_codes')
        .select('*')
        .eq('code', code)
        .maybeSingle()

    /* Un code inconnu et un code révoqué reçoivent la MÊME réponse : sinon
       l'écart entre les deux messages permettrait de deviner quels codes
       existent. */
    if (error || !data) return { valide: false, motif: 'Code inconnu ou déjà utilisé.' }

    const c = data as CodeInvitation
    if (c.statut === 'utilise') return { valide: false, motif: 'Ce code a déjà servi.' }
    if (c.statut === 'revoque') return { valide: false, motif: 'Code inconnu ou déjà utilisé.' }
    if (c.expire_le && new Date(c.expire_le).getTime() < Date.now()) {
        return { valide: false, motif: 'Ce code a expiré.' }
    }
    if (c.email_cible && emailSaisi && c.email_cible.toLowerCase() !== emailSaisi.toLowerCase()) {
        return { valide: false, motif: 'Ce code est réservé à une autre adresse email.' }
    }

    return { valide: true, code: c }
}

export interface ResultatConsommation {
    ok: boolean
    motif?: string
    couvreDossier: boolean
    couvreAncestrale: boolean
    code?: string
}

/**
 * Valide ET consomme le code, en une seule opération indivisible.
 *
 * À appeler au moment où le dossier est réellement enregistré : un code
 * consommé pour un dossier qui échoue ensuite serait perdu pour le client.
 */
export async function consommerCodeInvitation(
    supabase: SupabaseClient,
    saisie: unknown,
    contexte: { ref: string; email?: string | null },
): Promise<ResultatConsommation> {
    const verdict = await verifierCodeInvitation(supabase, saisie, contexte.email)
    if (!verdict.valide || !verdict.code) {
        return { ok: false, motif: verdict.motif, couvreDossier: false, couvreAncestrale: false }
    }

    /* LA course est ici. `eq('statut', 'actif')` fait de cette écriture un
       verrou : si un autre appel a consommé le code entre la vérification et
       maintenant, la condition ne matche plus et `lignes` revient vide. On ne
       se fie donc pas à ce qu'on vient de lire, mais à ce que la base accepte
       d'écrire. */
    const { data: lignes, error } = await supabase
        .from('nationality_invitation_codes')
        .update({
            statut: 'utilise',
            utilise_le: new Date().toISOString(),
            utilise_par_ref: contexte.ref,
            utilise_par_email: contexte.email || null,
        })
        .eq('id', verdict.code.id)
        .eq('statut', 'actif')
        .select('id')

    if (error || !lignes || lignes.length === 0) {
        return {
            ok: false,
            motif: 'Ce code vient d’être utilisé.',
            couvreDossier: false,
            couvreAncestrale: false,
        }
    }

    return {
        ok: true,
        code: verdict.code.code,
        couvreDossier: verdict.code.couvre_dossier,
        couvreAncestrale: verdict.code.couvre_ancestrale,
    }
}

/**
 * Le code couvre-t-il la recherche ancestrale ?
 *
 * Interrogé APRÈS consommation, quand le client accepte la proposition de
 * recherche : le code a déjà servi pour le dossier, mais sa portée reste
 * lisible et fait foi.
 */
export async function codeCouvreAncestrale(
    supabase: SupabaseClient,
    saisie: unknown,
    refDossier: string,
): Promise<boolean> {
    const code = normaliserCode(saisie)
    if (!code) return false
    const { data } = await supabase
        .from('nationality_invitation_codes')
        .select('couvre_ancestrale, utilise_par_ref')
        .eq('code', code)
        .maybeSingle()
    if (!data) return false
    /* Le code doit avoir servi POUR CE DOSSIER : sinon n'importe quel code
       couvrant l'ancestrale offrirait la recherche à n'importe qui. */
    return data.couvre_ancestrale === true && data.utilise_par_ref === refDossier
}
