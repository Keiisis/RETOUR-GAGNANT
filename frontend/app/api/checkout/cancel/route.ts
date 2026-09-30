import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { guardPublic } from '@/lib/api-guard'
import { PAYMENT_ROUTE_LIMIT } from '@/lib/rate-limit'
import { getMobileUserId } from '@/lib/mobile-auth'
import { emailDuProfil, estUuid } from '@/lib/mobile-paiement'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

/* ══════════════════════════════════════════════════════════════
   POST /api/checkout/cancel — le client ferme le widget de paiement.

   Connaître un order_id ne suffit plus : il faut PROUVER être l'acheteur.
   Preuves acceptées (une seule suffit) :
     1. jeton mobile (Bearer) dont le compte porte l'email de la commande ;
     2. session web dont le compte porte l'email de la commande ;
     3. coordonnées saisies dans le formulaire de paiement (customer_email
        ou customer_phone) identiques à celles enregistrées sur la commande —
        l'acheteur les a sous les yeux, un tiers qui ne connaît que l'id non.
   Seule une commande `pending` bascule en `abandoned` (mise à jour
   conditionnelle : une vérification concurrente qui la passe `completed`
   gagne toujours).
   ══════════════════════════════════════════════════════════════ */

const norm = (v: unknown) => String(v ?? '').trim().toLowerCase()
/** Chiffres seuls, 8 derniers : « +229 01 97… » et « 0197… » concordent. */
const telNorm = (v: unknown) => String(v ?? '').replace(/\D/g, '').slice(-8)

async function emailSessionWeb(): Promise<string> {
    try {
        const jar = await cookies()
        const sb = createServerClient(supabaseUrl, supabaseAnonKey, {
            cookies: { getAll: () => jar.getAll(), setAll: () => { /* lecture seule */ } },
        })
        const { data } = await sb.auth.getUser()
        return norm(data?.user?.email)
    } catch {
        return ''
    }
}

export async function POST(request: Request) {
    const trop = guardPublic(request, 'checkout/cancel', PAYMENT_ROUTE_LIMIT)
    if (trop) return trop

    try {
        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json(
                { error: 'Configuration serveur manquante' },
                { status: 503 }
            )
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        const body = await request.json().catch(() => ({}))
        const order_id = body?.order_id

        if (!order_id) {
            return NextResponse.json({ error: 'order_id manquant' }, { status: 400 })
        }
        if (!estUuid(String(order_id))) {
            return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })
        }

        // Récupérer la commande
        const { data: order, error: fetchError } = await supabase
            .from('orders')
            .select('payment_status, customer_email, customer_phone')
            .eq('id', order_id)
            .single()

        if (fetchError || !order) {
            return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })
        }

        // ── Preuve d'appartenance ──────────────────────────────────
        const emailCommande = norm(order.customer_email)
        const telCommande = telNorm(order.customer_phone)
        let prouve = false

        // 3. Coordonnées du formulaire (appelants web, pas de compte requis)
        const emailFourni = norm(body?.customer_email)
        const telFourni = telNorm(body?.customer_phone)
        if (emailCommande && emailFourni && emailFourni === emailCommande) prouve = true
        if (!prouve && telCommande.length >= 8 && telFourni.length >= 8 && telFourni === telCommande) prouve = true

        // 1. Jeton mobile : email du compte (auth) ou du profil
        if (!prouve && emailCommande && (request.headers.get('authorization') || '').startsWith('Bearer ')) {
            const uid = await getMobileUserId(request)
            if (uid) {
                const { data: u } = await supabase.auth.admin.getUserById(uid)
                const emailAuth = norm(u?.user?.email)
                const emailProfil = await emailDuProfil(supabase, uid)
                if (emailCommande === emailAuth || emailCommande === emailProfil) prouve = true
            }
        }

        // 2. Session web
        if (!prouve && emailCommande) {
            const emailWeb = await emailSessionWeb()
            if (emailWeb && emailWeb === emailCommande) prouve = true
        }

        if (!prouve) {
            return NextResponse.json({ error: 'Annulation non autorisée pour cette commande.' }, { status: 403 })
        }

        // Déjà annulée ou abandonnée : idempotent
        if (order.payment_status === 'cancelled' || order.payment_status === 'abandoned') {
            return NextResponse.json({ success: true })
        }

        // Seule une commande en attente s'annule (jamais completed/paid/failed…)
        if (order.payment_status !== 'pending') {
            return NextResponse.json({ error: 'Commande non annulable (statut : ' + String(order.payment_status) + ')' }, { status: 409 })
        }

        // Marquer la commande comme panier abandonné — conditionnel sur `pending`
        const { data: basculee, error: updError } = await supabase
            .from('orders')
            .update({ payment_status: 'abandoned' })
            .eq('id', order_id)
            .eq('payment_status', 'pending')
            .select('id')

        if (updError) {
            return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
        }
        if (!basculee || basculee.length === 0) {
            // Un paiement a été confirmé entre-temps : on ne touche à rien.
            return NextResponse.json({ error: 'Commande non annulable (statut modifié)' }, { status: 409 })
        }

        // Déclencher la notification d'abandon
        try {
            const proto = request.headers.get('x-forwarded-proto') || 'http'
            const host = request.headers.get('host')
            const notifUrl = new URL('/api/notifications/order', `${proto}://${host}`).toString()
            await fetch(notifUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_id, type: 'abandoned' })
            })
        } catch (e) {
            console.error('Erreur notification abandon:', e)
        }

        return NextResponse.json({ success: true })
    } catch {
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
}
