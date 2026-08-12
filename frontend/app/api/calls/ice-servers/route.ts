// ══════════════════════════════════════════════════════════════
//  SERVEURS ICE POUR L'APPEL VOCAL
//  GET /api/calls/ice-servers
//
//  Renvoie la liste des serveurs que les deux parties d'un appel
//  utilisent pour se trouver.
//
//  Trois niveaux, du plus léger au plus robuste :
//
//   1. STUN public (Google) : gratuit, sans compte. Suffit dès qu'un
//      des deux interlocuteurs est joignable directement.
//   2. TURN public (Open Relay Project de Metered) : gratuit, sans
//      compte. Relaie la voix quand les deux côtés sont derrière un
//      réseau opérateur qui masque leur adresse. Service au mieux :
//      aucun engagement de disponibilité.
//   3. TURN propre à l'agence : si `turn_url` / `turn_username` /
//      `turn_credential` sont renseignés dans `settings`, ils
//      REMPLACENT le relais public.
//
//  Le système ne DÉPEND d'aucun de ces niveaux : un appel dont tous
//  les relais tombent se rabat sur la connexion directe, qui couvre
//  déjà la majorité des cas.
//
//  Pourquoi une route serveur plutôt qu'une lecture directe :
//  la table `settings` est protégée par une politique « admin only ».
//  Un client ou un agent qui la lirait depuis le navigateur recevrait
//  toujours une liste vide, et TURN serait ignoré sans le moindre
//  message d'erreur. De plus, un identifiant TURN est un secret : il
//  n'a rien à faire dans une table lisible côté client.
// ══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

interface IceServer {
    urls: string | string[]
    username?: string
    credential?: string
}

/** Découverte d'adresse publique. Gratuit, sans compte. */
const STUN_PUBLIC: IceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
]

/**
 * Relais public gratuit : Open Relay Project (Metered).
 * Les trois ports couvrent les réseaux les plus filtrés :
 *   80    : UDP, le plus rapide ;
 *   443   : UDP sur un port toujours ouvert ;
 *   443/tcp : dernier recours derrière un pare-feu d'entreprise.
 * Identifiants publics et documentés : ce ne sont pas des secrets.
 */
const TURN_PUBLIC: IceServer[] = [
    // Point d'entree historique.
    {
        urls: [
            'turn:openrelay.metered.ca:80',
            'turn:openrelay.metered.ca:443',
            'turn:openrelay.metered.ca:443?transport=tcp',
        ],
        username: 'openrelayproject',
        credential: 'openrelayproject',
    },
    // Point d'entree actuel du meme projet. Les deux sont declares : si
    // l'un ne repond plus, l'autre reste disponible. Un serveur ICE muet
    // ne bloque rien : le navigateur essaie tous les candidats en parallele.
    {
        urls: [
            'turn:staticauth.openrelay.metered.ca:80',
            'turn:staticauth.openrelay.metered.ca:443',
            'turn:staticauth.openrelay.metered.ca:443?transport=tcp',
        ],
        username: 'openrelayproject',
        credential: 'openrelayproject',
    },
]

export async function GET(request: NextRequest) {
    // Un appel non authentifié n'obtient que le strict nécessaire.
    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!token) {
        return NextResponse.json({ iceServers: [...STUN_PUBLIC, ...TURN_PUBLIC], turn: 'public' })
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const { data: userData } = await supabase.auth.getUser(token)
    if (!userData?.user) {
        return NextResponse.json({ iceServers: [...STUN_PUBLIC, ...TURN_PUBLIC], turn: 'public' })
    }

    try {
        const { data } = await supabase
            .from('settings')
            .select('key, value')
            .in('key', ['turn_url', 'turn_username', 'turn_credential'])

        const map = new Map((data || []).map(r => [r.key as string, r.value as string]))
        const url = (map.get('turn_url') || '').trim()
        const username = (map.get('turn_username') || '').trim()
        const credential = (map.get('turn_credential') || '').trim()

        if (url && username && credential) {
            // Plusieurs URLs séparées par des virgules : chaque transport
            // supplémentaire augmente les chances de traverser un réseau filtré.
            const urls = url.split(',').map(u => u.trim()).filter(Boolean)
            return NextResponse.json({
                iceServers: [...STUN_PUBLIC, { urls, username, credential }],
                turn: 'agence',
            })
        }
    } catch {
        // Réglages illisibles : le relais public prend le relais.
    }

    return NextResponse.json({ iceServers: [...STUN_PUBLIC, ...TURN_PUBLIC], turn: 'public' })
}
