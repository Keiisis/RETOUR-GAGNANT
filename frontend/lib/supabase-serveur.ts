// ══════════════════════════════════════════════════════════════
//  Client Supabase SERVEUR (service role) — à n'importer QUE depuis des
//  routes API, des actions serveur ou des crons. Jamais depuis un composant
//  'use client' : la clé service contourne toutes les règles d'accès.
//
//  Plusieurs routes serveur importaient le client du NAVIGATEUR
//  (`@/lib/supabase`, clé anonyme publique). Elles ne lisaient les clés
//  secrètes de paiement que parce que les règles d'accès de `settings`
//  laissaient la clé anonyme les lire — c'est-à-dire n'importe quel
//  visiteur. Fermer cette faille exige que le serveur lise avec sa propre
//  clé.
// ══════════════════════════════════════════════════════════════
import { createClient } from '@supabase/supabase-js'

export const supabaseServeur = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
)
