// ══════════════════════════════════════════════════════════════
//  TESTS — RECONNAISSANCE DES ROBOTS D'INDEXATION
//
//  Cette logique décide qui échappe au WAF. Une erreur dans un sens
//  fait disparaître le site de Google ; dans l'autre, elle ouvre une
//  porte à quiconque met « Googlebot » dans son User-Agent.
// ══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import { ipDansCidr, identifierRobot, robotRevendique } from '@/lib/waf/crawlers'
import { detectHeadlessBrowser } from '@/lib/waf/fingerprint'

// Plages réellement publiées par Google et Bing (extraits)
const PLAGES = [
    '66.249.64.0/27',
    '66.249.66.0/27',
    '192.178.5.0/27',
    '2001:4860:4801:10::/64',
    '157.55.39.0/24',
    '40.77.167.0/24',
]

const UA_GOOGLEBOT =
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1; ' +
    '+http://www.google.com/bot.html) Chrome/W.X.Y.Z Safari/537.36'
const UA_GOOGLEBOT_MOBILE =
    'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/W.X.Y.Z Mobile Safari/537.36 (compatible; Googlebot/2.1; ' +
    '+http://www.google.com/bot.html)'
const UA_BINGBOT = 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)'
const UA_CHROME =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
    'Chrome/131.0.0.0 Safari/537.36'

describe('appartenance CIDR', () => {
    it('reconnaît une IPv4 dans sa plage', () => {
        expect(ipDansCidr('66.249.64.1', '66.249.64.0/27')).toBe(true)
        expect(ipDansCidr('66.249.64.31', '66.249.64.0/27')).toBe(true)
    })

    it('rejette une IPv4 hors plage, même très proche', () => {
        // .32 est le premier hôte du /27 SUIVANT : la limite doit être exacte
        expect(ipDansCidr('66.249.64.32', '66.249.64.0/27')).toBe(false)
        expect(ipDansCidr('66.249.65.1', '66.249.64.0/27')).toBe(false)
    })

    it('gère les IPv6, y compris la forme abrégée', () => {
        expect(ipDansCidr('2001:4860:4801:10::1', '2001:4860:4801:10::/64')).toBe(true)
        expect(ipDansCidr('2001:4860:4801:11::1', '2001:4860:4801:10::/64')).toBe(false)
    })

    it('ne mélange pas les familles d’adresses', () => {
        expect(ipDansCidr('66.249.64.1', '2001:4860:4801:10::/64')).toBe(false)
        expect(ipDansCidr('2001:4860:4801:10::1', '66.249.64.0/27')).toBe(false)
    })

    it('renvoie false sur une entrée malformée au lieu de lever', () => {
        // Une plage illisible ne doit ni exempter, ni faire tomber le WAF.
        expect(ipDansCidr('pas-une-ip', '66.249.64.0/27')).toBe(false)
        expect(ipDansCidr('66.249.64.1', 'n’importe quoi')).toBe(false)
        expect(ipDansCidr('66.249.64.1', '66.249.64.0/99')).toBe(false)
        expect(ipDansCidr('999.999.999.999', '66.249.64.0/27')).toBe(false)
        expect(ipDansCidr('', '')).toBe(false)
    })
})

describe('identification des robots', () => {
    it('reconnaît Googlebot depuis une adresse Google publiée', () => {
        const v = identifierRobot(UA_GOOGLEBOT, '66.249.64.1', PLAGES)
        expect(v.nom).toBe('googlebot')
        expect(v.verifie).toBe(true)
        expect(v.usurpation).toBe(false)
    })

    it('reconnaît Bingbot depuis une adresse Bing publiée', () => {
        const v = identifierRobot(UA_BINGBOT, '157.55.39.10', PLAGES)
        expect(v.nom).toBe('bingbot')
        expect(v.verifie).toBe(true)
    })

    it('démasque un imposteur qui se déclare Googlebot', () => {
        // Le cœur du dispositif : le User-Agent ne prouve rien.
        const v = identifierRobot(UA_GOOGLEBOT, '203.0.113.7', PLAGES)
        expect(v.nom).toBe('googlebot')
        expect(v.verifie).toBe(false)
        expect(v.usurpation).toBe(true)
    })

    it('n’exempte pas un proxy Google qui n’est pas un robot', () => {
        // google-proxy-*.google.com (Traduction, aperçu d’images) : adresse
        // Google, mais absente des plages de robots ET User-Agent non robot.
        const v = identifierRobot(UA_CHROME, '66.249.93.68', PLAGES)
        expect(v.nom).toBeNull()
        expect(v.verifie).toBe(false)
    })

    it('ignore un visiteur ordinaire', () => {
        expect(robotRevendique(UA_CHROME)).toBeNull()
        expect(identifierRobot(UA_CHROME, '88.120.4.5', PLAGES).nom).toBeNull()
    })

    it('n’exempte rien tant que les plages ne sont pas chargées', () => {
        // Sans preuve possible, on refuse d'exempter — mais on n'accuse pas
        // non plus d'usurpation : la liste est peut-être juste vide au démarrage.
        const v = identifierRobot(UA_GOOGLEBOT, '66.249.64.1', [])
        expect(v.verifie).toBe(false)
        expect(v.usurpation).toBe(false)
    })
})

describe('le défaut corrigé', () => {
    it('le vrai Googlebot EST vu comme headless par la détection', () => {
        // C'est la cause racine : sans exemption, chaque passage de
        // Googlebot dégradait la confiance de son IP jusqu'au blocage.
        for (const ua of [UA_GOOGLEBOT, UA_GOOGLEBOT_MOBILE]) {
            const r = detectHeadlessBrowser(new Headers({
                'user-agent': ua,
                'accept-encoding': 'gzip, deflate, br',
            }))
            expect(r.isHeadless).toBe(true)
        }
    })

    it('un navigateur humain complet n’est pas vu comme headless', () => {
        const r = detectHeadlessBrowser(new Headers({
            'user-agent': UA_CHROME,
            'accept-language': 'fr-FR,fr;q=0.9',
            'accept-encoding': 'gzip, deflate, br',
            'sec-ch-ua': '"Chromium";v="131"',
            'sec-fetch-mode': 'navigate',
        }))
        expect(r.isHeadless).toBe(false)
    })
})
