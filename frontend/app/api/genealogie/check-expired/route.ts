import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { EXPIRY_MONTHS } from '@/lib/genealogy/expiry'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// Règles d'expiration : SOURCE UNIQUE partagée avec engine.ts et l'uploader
// (lib/genealogy/expiry.ts). Avant, ce cron utilisait un vocabulaire
// (`acte_naissance`, `casier_judiciaire`…) qui ne correspondait JAMAIS aux
// doc_type réellement écrits par l'uploader → aucune notification ne partait.
const EXPIRATION_RULES_MONTHS: Record<string, number> = EXPIRY_MONTHS as Record<string, number>

// Seuil d'alerte avant expiration (jours)
const WARN_DAYS_BEFORE = 30

interface ExpiredDoc {
    doc_id: string
    tree_id: string
    person_id: string | null
    user_id: string | null
    doc_type: string
    title: string | null
    issued_date: string
    expires_on: string
    days_until_expiry: number
    person_name: string | null
}

function addMonths(date: Date, months: number): Date {
    const result = new Date(date)
    result.setMonth(result.getMonth() + months)
    return result
}

function daysBetween(a: Date, b: Date): number {
    const ms = b.getTime() - a.getTime()
    return Math.floor(ms / (1000 * 60 * 60 * 24))
}

// POST /api/genealogie/check-expired
// Scanne genealogy_documents avec expires_check=true, calcule la date d'expiration
// selon doc_type + issued_date, et insère une notification dans la table `notifications`
// pour chaque document expiré ou bientôt expiré (< WARN_DAYS_BEFORE jours).
// Idempotent : ne crée pas de doublon si une notif identique existe < 24h.
//
// Body optionnel : { tree_id?: string } — limite le scan à un seul arbre
//
// Sécurité : protégé par CRON_SECRET (env) en mode Vercel cron.
// En mode dev/admin, on accepte aussi la session staff.
export async function POST(request: NextRequest) {
    try {
        // Auth : soit cron secret, soit staff authentifié
        const authHeader = request.headers.get('authorization') || ''
        const cronSecret = process.env.CRON_SECRET || ''
        const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`

        if (!isCron) {
            // Vérifier qu'on est en mode appel utilisateur staff
            const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
            if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

            const authClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
            const { data: u } = await authClient.auth.getUser(token)
            const userId = u?.user?.id
            if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

            const supa = createClient(supabaseUrl, supabaseServiceKey)
            const { data: profile } = await supa
                .from('user_profiles').select('role').eq('id', userId).single()
            const isStaff = ['admin', 'super_admin', 'superadmin', 'ceo', 'agent'].includes(profile?.role || '')
            if (!isStaff) return NextResponse.json({ error: 'Réservé au staff' }, { status: 403 })
        }

        const body = await request.json().catch(() => ({} as { tree_id?: string }))
        const treeFilter = body.tree_id ? String(body.tree_id) : null

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // Récupérer tous les docs candidats à expiration
        let docQuery = supabase
            .from('genealogy_documents')
            .select('id, tree_id, person_id, user_id, doc_type, title, issued_date')
            .eq('expires_check', true)
            .not('issued_date', 'is', null)
        if (treeFilter) docQuery = docQuery.eq('tree_id', treeFilter)

        const { data: docs, error: docsErr } = await docQuery
        if (docsErr) return NextResponse.json({ error: docsErr.message }, { status: 500 })

        const now = new Date()
        const expired: ExpiredDoc[] = []
        const personIdsToFetch = new Set<string>()

        for (const doc of docs || []) {
            const months = EXPIRATION_RULES_MONTHS[doc.doc_type]
            if (!months || !doc.issued_date) continue
            const issuedDate = new Date(doc.issued_date)
            if (isNaN(issuedDate.getTime())) continue
            const expiresOn = addMonths(issuedDate, months)
            const daysLeft = daysBetween(now, expiresOn)

            // Inclure : déjà expiré (daysLeft <= 0) OU expire dans < WARN_DAYS_BEFORE jours
            if (daysLeft <= WARN_DAYS_BEFORE) {
                if (doc.person_id) personIdsToFetch.add(doc.person_id)
                expired.push({
                    doc_id: doc.id,
                    tree_id: doc.tree_id,
                    person_id: doc.person_id,
                    user_id: doc.user_id,
                    doc_type: doc.doc_type,
                    title: doc.title,
                    issued_date: doc.issued_date,
                    expires_on: expiresOn.toISOString().slice(0, 10),
                    days_until_expiry: daysLeft,
                    person_name: null,
                })
            }
        }

        // Enrichir avec les noms des personnes concernées
        if (personIdsToFetch.size > 0) {
            const { data: persons } = await supabase
                .from('persons')
                .select('id, first_name, last_name')
                .in('id', Array.from(personIdsToFetch))
            const nameMap: Record<string, string> = {}
            for (const p of persons || []) {
                nameMap[p.id] = `${p.first_name || ''} ${p.last_name || ''}`.trim()
            }
            for (const e of expired) {
                if (e.person_id) e.person_name = nameMap[e.person_id] || null
            }
        }

        // Créer les notifications (déduplication : pas de doublon < 24h)
        const created: string[] = []
        const skipped: string[] = []

        for (const e of expired) {
            // Identifier le destinataire : user_id du doc, sinon owner du tree
            let recipientId = e.user_id
            if (!recipientId) {
                const { data: tree } = await supabase
                    .from('trees').select('user_id').eq('id', e.tree_id).single()
                recipientId = tree?.user_id || null
            }
            if (!recipientId) continue

            const isExpired = e.days_until_expiry <= 0
            const title = isExpired
                ? `Document expiré : ${e.title || e.doc_type}`
                : `Document bientôt expiré (${e.days_until_expiry}j)`
            const personPart = e.person_name ? ` — ${e.person_name}` : ''
            const bodyMsg = `${e.title || e.doc_type}${personPart}. Date d'émission : ${e.issued_date}, expire le ${e.expires_on}.`

            // Déduplication 24h sur (user_id, title)
            const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
            const { data: existing } = await supabase
                .from('notifications')
                .select('id')
                .eq('user_id', recipientId)
                .eq('title', title)
                .gte('created_at', since)
                .limit(1)
            if (existing && existing.length > 0) {
                skipped.push(e.doc_id)
                continue
            }

            const { error: insErr } = await supabase.from('notifications').insert({
                user_id: recipientId,
                title,
                body: bodyMsg,
                type: 'event',     // cohérent avec le fix TYPE_CONFIG mobile
                is_read: false,
            })
            if (!insErr) created.push(e.doc_id)
        }

        return NextResponse.json({
            scanned: (docs || []).length,
            expired_count: expired.length,
            notifications_created: created.length,
            notifications_skipped_dedup: skipped.length,
            details: expired,
        })
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Erreur serveur' },
            { status: 500 }
        )
    }
}
