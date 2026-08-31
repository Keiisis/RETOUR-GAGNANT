// ══════════════════════════════════════════════════════════════
//  IDENTITÉ IP : LE POINT UNIQUE
//
//  Règle du dépôt : tout ce qui COMPTE, LIMITE, NOTE ou BANNIT un visiteur
//  passe par `clefIp()` / `sousReseauIp()` d'ici. Personne ne redécoupe une
//  adresse ailleurs. Les journaux, eux, gardent l'adresse complète : elle
//  sert à l'enquête, pas à l'identification.
//
//  ── Pourquoi ────────────────────────────────────────────────────────────
//  Un abonné Orange se présente en `2001:861:2409:afe0:c5e7:1cee:233e:e49a`.
//  Les 64 derniers bits sont tirés au hasard (RFC 4941 / RFC 7217) et
//  changent chaque jour, à chaque redémarrage de la box. Compter sur
//  l'adresse entière, c'est :
//    · offrir un quota neuf à chaque rotation (limites poreuses) ;
//    · perdre le score de confiance d'un foyer connu ;
//    · bannir une adresse qui n'existera plus demain ;
//    · gonfler `waf_ip_memory` d'une ligne par rotation.
//  Et un découpage IPv4 (`ip.split('.')`) rendait `null` en IPv6 : la
//  détection d'attaque coordonnée n'existait pas pour ces visiteurs.
//
//  ── Les deux granularités ───────────────────────────────────────────────
//    · `clefIp()`       : l'ABONNÉ.  IPv4 → l'adresse ; IPv6 → son /64.
//                         (Le /64 est le réseau local livré par le FAI ;
//                          c'est l'équivalent d'une IPv4 chez un particulier.)
//    · `sousReseauIp()` : le SITE.   IPv4 → /24 ; IPv6 → /48.
//                         Sert au regroupement d'attaques coordonnées, jamais
//                         au comptage d'un client.
//
//  ⚠️ Ne JAMAIS élargir au-delà : `2001:861::/32` désigne TOUT Orange France.
//  Bannir à ce niveau couperait le pays, pas l'attaquant.
// ══════════════════════════════════════════════════════════════

/** Valeur convenue quand aucune adresse fiable n'a pu être lue. */
export const IP_INCONNUE = 'unknown'

const RE_IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/
// Forme large : la validation fine est faite par l'expansion (`groupesIpv6`).
const RE_IPV6 = /^[0-9a-f:]+$/i

/**
 * Ramène une adresse à sa forme canonique de travail.
 *
 * Absorbe ce que les proxys, CDN et runtimes ajoutent : crochets, port,
 * identifiant de zone (`%eth0`), casse, espaces, et la forme « IPv4 mappée »
 * (`::ffff:88.170.12.4`) qui doit être traitée comme de l'IPv4 — sans quoi le
 * même visiteur porterait deux identités selon le chemin réseau emprunté.
 *
 * Renvoie `IP_INCONNUE` si ce n'est pas une adresse : jamais une chaîne
 * douteuse, qui deviendrait une clef de comptage fantôme.
 */
export function normaliserIp(brut?: string | null): string {
    let ip = String(brut ?? '').trim().toLowerCase()
    if (!ip) return IP_INCONNUE

    // [2001:db8::1]:443 → 2001:db8::1
    if (ip.startsWith('[')) {
        const fin = ip.indexOf(']')
        if (fin > 0) ip = ip.slice(1, fin)
    }

    // fe80::1%eth0 → fe80::1
    const zone = ip.indexOf('%')
    if (zone > 0) ip = ip.slice(0, zone)

    // 88.170.12.4:52344 → 88.170.12.4 (un seul « : » = port sur IPv4)
    if (ip.includes('.') && ip.split(':').length === 2) ip = ip.split(':')[0]

    // ::ffff:88.170.12.4 → 88.170.12.4
    const mappee = /^::ffff:((?:\d{1,3}\.){3}\d{1,3})$/.exec(ip)
    if (mappee) ip = mappee[1]

    if (RE_IPV4.test(ip)) return ip
    if (ip.includes(':') && RE_IPV6.test(ip) && groupesIpv6(ip)) return ip

    return IP_INCONNUE
}

/** Vraie IPv6 (une IPv4 mappée répond `false` : c'est de l'IPv4). */
export function estIpv6(brut?: string | null): boolean {
    const ip = normaliserIp(brut)
    return ip !== IP_INCONNUE && ip.includes(':')
}

/**
 * Développe une IPv6 en ses 8 groupes de 16 bits, en hexadécimal sur 4
 * caractères. Renvoie `null` si l'adresse est malformée (plusieurs `::`,
 * trop de groupes, groupe hors bornes).
 */
function groupesIpv6(ip: string): string[] | null {
    if (!ip.includes(':')) return null
    const moitiés = ip.split('::')
    if (moitiés.length > 2) return null

    const lire = (part: string): string[] | null => {
        if (!part) return []
        const bouts = part.split(':')
        const sortie: string[] = []
        for (const b of bouts) {
            if (b === '' || b.length > 4 || !/^[0-9a-f]+$/.test(b)) return null
            sortie.push(b.padStart(4, '0'))
        }
        return sortie
    }

    const gauche = lire(moitiés[0])
    const droite = moitiés.length === 2 ? lire(moitiés[1]) : []
    if (!gauche || !droite) return null

    if (moitiés.length === 1) return gauche.length === 8 ? gauche : null

    const manquants = 8 - gauche.length - droite.length
    if (manquants < 1) return null
    return [...gauche, ...Array(manquants).fill('0000'), ...droite]
}

/**
 * LA CLEF D'UN VISITEUR. À utiliser pour tout quota, tout score, tout ban.
 *
 *   IPv4 → l'adresse elle-même (elle identifie déjà l'abonné)
 *   IPv6 → son /64, forme `2001:0861:2409:afe0::/64`
 *
 * Le suffixe `/64` est conservé dans la chaîne : une clef doit dire à quel
 * niveau elle regroupe, sinon un jour quelqu'un la compare à une adresse.
 */
export function clefIp(brut?: string | null): string {
    const ip = normaliserIp(brut)
    if (ip === IP_INCONNUE) return IP_INCONNUE
    if (!ip.includes(':')) return ip

    const g = groupesIpv6(ip)
    if (!g) return IP_INCONNUE
    return prefixe(g, 4)
}

/**
 * Écrit un préfixe IPv6 EXACTEMENT comme PostgreSQL l'écrirait
 * (`network(set_masklen(inet, n))::text`) : zéros de tête retirés, groupes
 * de queue nuls absorbés par le `::`.
 *
 * Ce n'est pas une coquetterie : la migration SQL et ce module doivent
 * produire la MÊME chaîne, sinon l'historique rallié en base ne correspond à
 * aucune clef calculée à l'exécution — deux mondes, et des verdicts ignorés
 * en silence. C'est précisément le genre de dérive qu'on vient de corriger.
 */
function prefixe(groupes: string[], combien: number): string {
    const bits = combien * 16
    const gardes = groupes.slice(0, combien).map(g => g.replace(/^0+(?=.)/, ''))
    while (gardes.length > 0 && gardes[gardes.length - 1] === '0') gardes.pop()
    return `${gardes.join(':')}::/${bits}`
}

/**
 * LE SITE, pour le regroupement d'attaques coordonnées uniquement.
 *
 *   IPv4 → `88.170.12`   (le /24 historique, format inchangé)
 *   IPv6 → `2001:0861:2409::/48`
 *
 * `null` si l'adresse est inconnue — l'appelant doit alors s'abstenir.
 */
export function sousReseauIp(brut?: string | null): string | null {
    const ip = normaliserIp(brut)
    if (ip === IP_INCONNUE) return null

    if (!ip.includes(':')) {
        const parts = ip.split('.')
        return parts.length === 4 ? `${parts[0]}.${parts[1]}.${parts[2]}` : null
    }

    const g = groupesIpv6(ip)
    if (!g) return null
    return prefixe(g, 3)
}

/** Deux adresses appartiennent-elles au même abonné ? */
export function memeClefIp(a?: string | null, b?: string | null): boolean {
    const ka = clefIp(a)
    const kb = clefIp(b)
    return ka !== IP_INCONNUE && ka === kb
}

/**
 * Étiquette pour un humain : la clef, plus l'adresse observée si elle en
 * diffère. Pour les journaux, les alertes et le panel — jamais comme clef.
 */
export function etiquetteIp(brut?: string | null): string {
    const ip = normaliserIp(brut)
    const clef = clefIp(ip)
    return clef === ip ? ip : `${clef} (vue : ${ip})`
}