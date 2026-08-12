// ══════════════════════════════════════════════════════════════
//  ROBOTS D'INDEXATION LÉGITIMES
//
//  Problème résolu : `detectHeadlessBrowser` classe le vrai Googlebot
//  comme navigateur sans interface. Son User-Agent contient « Chrome »,
//  et il n'envoie ni `accept-language` ni `sec-ch-ua` : soit deux ou
//  trois indicateurs, au-dessus du seuil. Chaque passage dégradait donc
//  la confiance de l'IP jusqu'au blocage : le site finit par disparaître
//  de l'index sans qu'aucune alerte ne le dise.
//
//  On ne peut pas se fier au seul User-Agent : n'importe qui peut se
//  déclarer Googlebot. La vérification se fait sur les plages d'adresses
//  PUBLIÉES par les moteurs eux-mêmes, rafraîchies par le cron
//  waf-maintenance et stockées dans `waf_config`.
//
//  Conséquence voulue : un vrai robot est exempté, un imposteur qui
//  usurpe son User-Agent reste traité comme suspect : et l'usurpation
//  devient elle-même un signal.
// ══════════════════════════════════════════════════════════════

/** Sources officielles. Les moteurs les tiennent à jour ; nous non. */
export const SOURCES_PLAGES: Record<string, string> = {
    google_common: 'https://developers.google.com/static/crawling/ipranges/common-crawlers.json',
    google_special: 'https://developers.google.com/static/crawling/ipranges/special-crawlers.json',
    bing: 'https://www.bing.com/toolbox/bingbot.json',
}

/**
 * Motifs de User-Agent des robots qu'on accepte d'exempter.
 *
 * Volontairement court : chaque entrée doit avoir une liste de plages
 * publiée en face. Un robot sans plages vérifiables n'a rien à faire
 * ici : on ne peut pas distinguer le vrai du faux.
 */
const MOTIFS: Array<{ nom: string; motif: RegExp }> = [
    { nom: 'googlebot', motif: /googlebot|google-inspectiontool|storebot-google/i },
    { nom: 'bingbot', motif: /bingbot|adidxbot|microsoftpreview/i },
]

// ─── Comparaison d'adresses ───────────────────────────────────

/** IPv4 « a.b.c.d » → entier 32 bits, ou null si ce n'en est pas une. */
function ipv4EnEntier(ip: string): number | null {
    const parties = ip.split('.')
    if (parties.length !== 4) return null
    let n = 0
    for (const p of parties) {
        if (!/^\d{1,3}$/.test(p)) return null
        const v = Number(p)
        if (v > 255) return null
        n = (n << 8) | v
    }
    return n >>> 0
}

/**
 * IPv6 → 8 groupes de 16 bits, formes abrégées (::) et IPv4-mappées comprises.
 *
 * On reste sur des nombres plutôt que des BigInt : la comparaison de préfixe
 * se fait groupe par groupe, et cela évite d'imposer une cible ES2020 au
 * projet entier pour une poignée de masques.
 */
function ipv6EnGroupes(ip: string): number[] | null {
    let adresse = ip
    // Forme « ::ffff:1.2.3.4 » : on convertit la queue IPv4 en hexadécimal
    const queueV4 = adresse.match(/(\d{1,3}(?:\.\d{1,3}){3})$/)
    if (queueV4) {
        const v4 = ipv4EnEntier(queueV4[1])
        if (v4 === null) return null
        const haut = (v4 >>> 16).toString(16)
        const bas = (v4 & 0xffff).toString(16)
        adresse = adresse.slice(0, queueV4.index) + `${haut}:${bas}`
    }

    const cotes = adresse.split('::')
    if (cotes.length > 2) return null

    const gauche = cotes[0] ? cotes[0].split(':').filter(Boolean) : []
    const droite = cotes[1] !== undefined && cotes[1] ? cotes[1].split(':').filter(Boolean) : []

    if (cotes.length === 1 && gauche.length !== 8) return null
    const manquants = 8 - gauche.length - droite.length
    if (manquants < 0) return null

    const groupes = [
        ...gauche,
        ...Array<string>(cotes.length === 2 ? manquants : 0).fill('0'),
        ...droite,
    ]
    if (groupes.length !== 8) return null

    const valeurs: number[] = []
    for (const g of groupes) {
        if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null
        valeurs.push(parseInt(g, 16))
    }
    return valeurs
}

/**
 * L'adresse `ip` appartient-elle au préfixe CIDR donné ?
 * Renvoie false : jamais une exception : sur une entrée malformée :
 * une plage illisible ne doit pas exempter, ni faire tomber le WAF.
 */
export function ipDansCidr(ip: string, cidr: string): boolean {
    const [base, bitsTexte] = cidr.split('/')
    if (!base || !bitsTexte) return false
    const bits = Number(bitsTexte)
    if (!Number.isInteger(bits) || bits < 0) return false

    const ipV4 = ipv4EnEntier(ip)
    const baseV4 = ipv4EnEntier(base)

    if (ipV4 !== null && baseV4 !== null) {
        if (bits > 32) return false
        if (bits === 0) return true
        const masque = (0xffffffff << (32 - bits)) >>> 0
        return (ipV4 & masque) === (baseV4 & masque)
    }

    const ipV6 = ipv6EnGroupes(ip)
    const baseV6 = ipv6EnGroupes(base)
    if (ipV6 === null || baseV6 === null || bits > 128) return false
    if (bits === 0) return true

    // Comparaison groupe par groupe : les groupes entièrement couverts par le
    // préfixe doivent être identiques, le dernier partiellement couvert est
    // comparé sous masque.
    let restants = bits
    for (let i = 0; i < 8 && restants > 0; i++) {
        if (restants >= 16) {
            if (ipV6[i] !== baseV6[i]) return false
            restants -= 16
        } else {
            const masque = (0xffff << (16 - restants)) & 0xffff
            if ((ipV6[i] & masque) !== (baseV6[i] & masque)) return false
            restants = 0
        }
    }
    return true
}

// ─── Identification ───────────────────────────────────────────

export interface VerdictRobot {
    /** Nom du robot annoncé par le User-Agent, sinon null. */
    nom: string | null
    /** L'adresse appartient à une plage publiée par ce moteur. */
    verifie: boolean
    /**
     * Le User-Agent revendique un robot mais l'adresse ne correspond pas.
     * C'est une usurpation : plus suspect qu'un visiteur ordinaire.
     */
    usurpation: boolean
}

const AUCUN: VerdictRobot = { nom: null, verifie: false, usurpation: false }

/** Le User-Agent revendique-t-il un robot connu ? (sans preuve) */
export function robotRevendique(userAgent: string): string | null {
    const ua = userAgent || ''
    for (const { nom, motif } of MOTIFS) {
        if (motif.test(ua)) return nom
    }
    return null
}

/**
 * Identifie un robot et vérifie son adresse contre les plages publiées.
 *
 * `plages` est la liste des préfixes CIDR connus, tous moteurs confondus :
 * un robot Google ne peut de toute façon pas se trouver dans une plage
 * Bing, et fusionner évite d'avoir à maintenir la correspondance.
 */
export function identifierRobot(
    userAgent: string,
    ip: string,
    plages: string[],
): VerdictRobot {
    const nom = robotRevendique(userAgent)
    if (!nom) return AUCUN
    if (!ip || ip === 'unknown' || plages.length === 0) {
        // Sans plages chargées, on ne peut rien prouver. On n'exempte pas,
        // mais on ne crie pas non plus à l'usurpation.
        return { nom, verifie: false, usurpation: false }
    }

    const verifie = plages.some(p => ipDansCidr(ip, p))
    return { nom, verifie, usurpation: !verifie }
}

// ─── Récupération des plages officielles ──────────────────────

interface PrefixePublie {
    ipv4Prefix?: string
    ipv6Prefix?: string
}

/**
 * Télécharge et fusionne les plages publiées par les moteurs.
 *
 * Appelée par le cron waf-maintenance, pas par le middleware : une
 * requête utilisateur ne doit jamais attendre trois appels réseau.
 * Une source injoignable est ignorée : on conserve les autres plutôt
 * que d'échouer en bloc.
 */
export async function recupererPlagesOfficielles(): Promise<{
    plages: string[]
    sources: Record<string, number>
    erreurs: string[]
}> {
    const plages = new Set<string>()
    const sources: Record<string, number> = {}
    const erreurs: string[] = []

    await Promise.all(
        Object.entries(SOURCES_PLAGES).map(async ([nom, url]) => {
            try {
                const res = await fetch(url, {
                    headers: { accept: 'application/json' },
                    signal: AbortSignal.timeout(15_000),
                })
                if (!res.ok) {
                    erreurs.push(`${nom}: HTTP ${res.status}`)
                    return
                }
                const data = await res.json() as { prefixes?: PrefixePublie[] }
                const liste = Array.isArray(data?.prefixes) ? data.prefixes : []
                let n = 0
                for (const p of liste) {
                    const cidr = p.ipv4Prefix || p.ipv6Prefix
                    if (cidr && cidr.includes('/')) {
                        plages.add(cidr)
                        n++
                    }
                }
                sources[nom] = n
            } catch (e) {
                erreurs.push(`${nom}: ${e instanceof Error ? e.message : 'échec'}`)
            }
        }),
    )

    return { plages: [...plages], sources, erreurs }
}
