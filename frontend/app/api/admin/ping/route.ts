import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { extractIp, logWafEvent } from '@/lib/waf'

// Met à jour last_seen_at de l'utilisateur connecté via service role
// Appelé par admin/layout.tsx et agent/layout.tsx à chaque connexion
//
// ── Et enregistre l'adresse IP du personnel (liste blanche dynamique) ──
//
// L'IP de l'agence est attribuée dynamiquement par l'opérateur : elle
// change sans prévenir, et une adresse recyclée arrive avec la réputation
// de son précédent occupant. Le 30/07/2026 l'administrateur s'est ainsi
// retrouvé bloqué par son propre WAF dans son back-office.
//
// Une liste blanche saisie à la main est périmée dès le lendemain. On
// enregistre donc l'adresse à chaque ouverture de panel, avec une durée de
// vie glissante de 7 jours : l'ancienne adresse s'efface d'elle-même.
//
// Ce point d'entrée était le bon endroit : les deux layouts l'appellent
// déjà au montage, donc aucun code client à ajouter et aucune requête
// supplémentaire dans le navigateur.
//
// ⚠️ L'adresse n'est JAMAIS lue dans le corps de la requête — un appelant
// pourrait y écrire ce qu'il veut. Elle est extraite des en-têtes de proxy
// de confiance par `extractIp`, la même fonction que le WAF utilise pour
// décider de bloquer.

const ROLES_INTERNES = ['admin', 'super_admin', 'superadmin', 'agent']

export async function POST(req: NextRequest) {
    const cookieStore = await cookies()

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll: () => cookieStore.getAll(),
                setAll: (cs) => {
                    cs.forEach(({ name, value, options }) => {
                        try { cookieStore.set(name, value, options) } catch { /* lecture seule en route handler */ }
                    })
                },
            },
        }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) return NextResponse.json({ error: 'Service key manquante' }, { status: 500 })

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey)

    // Le rôle est lu en base, jamais déduit du client.
    const { data: prof } = await admin
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
    const role = prof?.role || ''

    await admin
        .from('user_profiles')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', user.id)

    // ── Liste blanche dynamique ──
    // Réservée aux rôles internes : un simple client n'a rien à exempter.
    let ipEnregistree = false
    if (ROLES_INTERNES.includes(role)) {
        const ip = extractIp(req.headers)
        const { data: actives, error } = await admin.rpc('enregistrer_ip_de_confiance', {
            p_ip: ip,
            p_user_id: user.id,
            p_role: role,
            p_user_agent: req.headers.get('user-agent') || '',
        })

        // -1 : adresse refusée (privée, réservée, inconnue).
        ipEnregistree = !error && typeof actives === 'number' && actives >= 0

        if (ipEnregistree) {
            // Trace dans le journal WAF : toute exemption accordée doit
            // rester visible dans le panel, sinon elle échappe au contrôle.
            logWafEvent({
                ip, method: 'POST', path: '/api/admin/ping',
                userAgent: req.headers.get('user-agent') || '',
                threatType: 'trusted_ip_renewed',
                detail: `Liste blanche dynamique : ${role} — ${actives} adresse(s) active(s), valide 7 jours`,
                action: 'allow',
                supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
                serviceKey,
            })
        }
    }

    return NextResponse.json({ ok: true, ipEnregistree })
}
