/**
 * IDENTITÉ IP : la clef qui compte, pas l'adresse affichée.
 *
 * Pourquoi ce fichier existe : un client Orange (2001:861::/32) présente une
 * adresse IPv6 de confidentialité (RFC 4941/7217) qui CHANGE chaque jour. Tout
 * ce qui était compté ou banni sur l'adresse complète repartait donc de zéro
 * quotidiennement — quotas, score de confiance, bannissements — sans que rien
 * ne le signale. Et `getSubnet24()` (`ip.split('.')`) renvoyait `null` en IPv6 :
 * la détection d'attaque coordonnée n'existait tout simplement pas pour la
 * moitié moderne d'Internet.
 *
 * Ces tests sont la garde : ils échouent si quelqu'un remet une logique
 * IPv4-seulement dans le chemin d'identification.
 */
import { describe, it, expect } from 'vitest'
import {
    normaliserIp,
    estIpv6,
    clefIp,
    sousReseauIp,
    memeClefIp,
} from '../lib/net/ip-identity'
import { getSubnet24 } from '../lib/waf'

describe('normaliserIp', () => {
    it('rend une IPv4 telle quelle', () => {
        expect(normaliserIp('88.170.12.4')).toBe('88.170.12.4')
    })

    it('retire le port d\'une IPv4', () => {
        expect(normaliserIp('88.170.12.4:52344')).toBe('88.170.12.4')
    })

    it('retire les crochets et le port d\'une IPv6', () => {
        expect(normaliserIp('[2001:861:2409:afe0::1]:443')).toBe('2001:861:2409:afe0::1')
    })

    it('retire l\'identifiant de zone', () => {
        expect(normaliserIp('fe80::1%eth0')).toBe('fe80::1')
    })

    it('ramène une IPv4 mappée en IPv6 à sa forme IPv4', () => {
        expect(normaliserIp('::ffff:88.170.12.4')).toBe('88.170.12.4')
        expect(normaliserIp('::FFFF:88.170.12.4')).toBe('88.170.12.4')
    })

    it('met en minuscules et tolère les espaces', () => {
        expect(normaliserIp('  2001:861:2409:AFE0::1  ')).toBe('2001:861:2409:afe0::1')
    })

    it('rejette ce qui n\'est pas une adresse', () => {
        expect(normaliserIp('')).toBe('unknown')
        expect(normaliserIp('pas-une-ip')).toBe('unknown')
        expect(normaliserIp(undefined)).toBe('unknown')
        expect(normaliserIp('999.999.999.999')).toBe('unknown')
    })
})

describe('estIpv6', () => {
    it('distingue les deux familles', () => {
        expect(estIpv6('2001:861:2409:afe0:c5e7:1cee:233e:e49a')).toBe(true)
        expect(estIpv6('88.170.12.4')).toBe(false)
        expect(estIpv6('::ffff:88.170.12.4')).toBe(false)   // IPv4 déguisée
        expect(estIpv6('unknown')).toBe(false)
    })
})

describe('clefIp : /128 volatil → /64 stable', () => {
    // Les deux adresses du même abonné Orange, à un jour d'intervalle.
    const jour1 = '2001:861:2409:afe0:c5e7:1cee:233e:e49a'
    const jour2 = '2001:861:2409:afe0:9d21:4b7c:0011:2f80'

    it('regroupe deux adresses temporaires du même abonné', () => {
        expect(clefIp(jour1)).toBe(clefIp(jour2))
        expect(memeClefIp(jour1, jour2)).toBe(true)
    })

    it('produit une clef lisible et bornée au /64', () => {
        expect(clefIp(jour1)).toBe('2001:861:2409:afe0::/64')
    })

    it('ne confond pas deux abonnés voisins (/64 différents)', () => {
        const voisin = '2001:861:2409:afe1:c5e7:1cee:233e:e49a'
        expect(clefIp(jour1)).not.toBe(clefIp(voisin))
    })

    it('laisse une IPv4 intacte : elle identifie déjà son abonné', () => {
        expect(clefIp('88.170.12.4')).toBe('88.170.12.4')
    })

    it('traite une IPv4 mappée comme une IPv4', () => {
        expect(clefIp('::ffff:88.170.12.4')).toBe('88.170.12.4')
    })

    it('gère les formes compressées', () => {
        expect(clefIp('2001:db8::1')).toBe('2001:db8::/64')
        expect(clefIp('::1')).toBe('::/64')
    })

    it('laisse passer « unknown » sans le transformer', () => {
        expect(clefIp('unknown')).toBe('unknown')
        expect(clefIp('n\'importe quoi')).toBe('unknown')
    })
})

describe('sousReseauIp : regroupement anti-attaque coordonnée', () => {
    it('rend le /24 d\'une IPv4 (comportement historique conservé)', () => {
        expect(sousReseauIp('88.170.12.4')).toBe('88.170.12')
    })

    it('rend un /48 en IPv6 — ET JAMAIS null', () => {
        const sous = sousReseauIp('2001:861:2409:afe0:c5e7:1cee:233e:e49a')
        expect(sous).not.toBeNull()
        expect(sous).toBe('2001:861:2409::/48')
    })

    it('regroupe deux /64 du même site', () => {
        expect(sousReseauIp('2001:861:2409:afe0::1'))
            .toBe(sousReseauIp('2001:861:2409:beef::9'))
    })

    it('ne regroupe pas deux allocations distinctes', () => {
        expect(sousReseauIp('2001:861:2409:afe0::1'))
            .not.toBe(sousReseauIp('2001:861:9999:afe0::1'))
    })

    it('renvoie null pour une adresse inconnue', () => {
        expect(sousReseauIp('unknown')).toBeNull()
    })
})

/* GARDE : le point d'entrée historique du WAF ne doit plus être aveugle à
   l'IPv6. `getSubnet24` reste exporté (des appels existent), mais il délègue.
   Ce test échoue si quelqu'un lui rend son `ip.split('.')` d'origine. */
describe('garde anti-régression : getSubnet24 voit l\'IPv6', () => {
    it('ne renvoie plus null sur une adresse IPv6', () => {
        expect(getSubnet24('2001:861:2409:afe0:c5e7:1cee:233e:e49a')).not.toBeNull()
    })

    it('conserve le /24 IPv4', () => {
        expect(getSubnet24('88.170.12.4')).toBe('88.170.12')
    })
})