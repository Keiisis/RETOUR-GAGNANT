import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { scanRequestBody } from '@/lib/waf'
import { getMobileUserId } from '@/lib/mobile-auth'

// Service role : bypasse RLS pour créer/lire les dossiers depuis l'app mobile
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/* ⚠️ SOURCE DE VÉRITÉ = `dossier_tracking` (le tracker admin/agent).
   La table `dossiers` est celle de la GÉNÉALOGIE (tree_id/dossier_type) : elle
   n'a PAS de client_id/service_type et faisait échouer toute création. On lit
   et écrit donc les dossiers de SERVICE dans `dossier_tracking`, ce qui unifie
   mobile <-> admin <-> agent sur une seule table + les statuts globaux. */
const TRACKING_TO_MOBILE_STATUS: Record<string, string> = {
    reception: 'soumis', verification: 'verifie', traitement: 'traitement',
    validation: 'validation', finalisation: 'validation', termine: 'termine', annule: 'annule',
}
const ACTIVE_TRACKING_STATUTS = ['reception', 'verification', 'traitement', 'validation', 'finalisation']

// ─── GET : tous les dossiers d'un client avec leurs documents ────────────────
export async function GET(req: NextRequest) {
    try {
        // Identité dérivée du jeton (anti-IDOR) : on ignore tout client_id fourni
        const clientId = await getMobileUserId(req)
        if (!clientId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

        // Rattachement par identifiant OU par EMAIL.
        //
        // Mesuré en base le 2026-08-18 : 23 dossiers sur 25 n'ont PAS de
        // client_id — les dossiers ouverts depuis le site ne portent que
        // l'email. Filtrer sur le seul client_id revenait donc à cacher au
        // client la quasi-totalité de ses dossiers (compteur « 00 » sur le
        // profil, onglet Dossier vide).
        //
        // L'email est lu sur le PROFIL rattaché au jeton, jamais sur un
        // paramètre : sinon il suffirait d'envoyer l'email d'autrui pour lire
        // ses dossiers.
        const { data: cp } = await supabase
            .from('client_profiles')
            .select('email')
            .eq('id', clientId)
            .maybeSingle()
        const email = String(cp?.email || '').trim().toLowerCase()

        const criteres = [`client_id.eq.${clientId}`]
        if (email) criteres.push(`client_email.eq.${email}`)

        const { data: tracking, error } = await supabase
            .from('dossier_tracking')
            .select('id, dossier_ref_id, statut, progression, service_type, notes, created_at, updated_at')
            .or(criteres.join(','))
            .order('created_at', { ascending: false })

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        // Pour chaque dossier (tracking), charger ses documents + mapper le statut
        // global vers le statut d'affichage mobile.
        const dossiersWithDocs = await Promise.all((tracking || []).map(async (t) => {
            const ids = [t.id, t.dossier_ref_id].filter(Boolean) as string[]
            const { data: docs } = await supabase
                .from('dossier_documents')
                .select('id, file_name, file_url, file_type, status, created_at')
                .in('dossier_id', ids)
                .order('created_at', { ascending: false })

            // Fallback sur table "documents" si dossier_documents vide
            let finalDocs = docs || []
            if (finalDocs.length === 0) {
                const { data: docs2 } = await supabase
                    .from('documents')
                    .select('id, file_name, file_url, file_type, status, created_at')
                    .in('dossier_id', ids)
                    .order('created_at', { ascending: false })
                finalDocs = docs2 || []
            }

            return {
                id: t.id,
                status: TRACKING_TO_MOBILE_STATUS[String(t.statut)] || 'soumis',
                progress: typeof t.progression === 'number' ? t.progression : 0,
                service_type: t.service_type,
                notes: t.notes,
                created_at: t.created_at,
                updated_at: t.updated_at,
                documents: finalDocs,
            }
        }))

        // ─── Conseiller assigné ───────────────────────────────────────────
        // L'assignation vit dans dossier_tracking.agent_assigne (voir
        // /api/admin/dossiers/assign). On remonte le dossier suivi le plus
        // récent qui possède un agent, puis son nom d'affichage.
        // On n'expose QUE le nom : ni l'e-mail, ni l'identifiant de l'agent.
        let advisor: { name: string } | null = null
        try {
            const { data: tracking } = await supabase
                .from('dossier_tracking')
                .select('agent_assigne, updated_at')
                .eq('client_id', clientId)
                .not('agent_assigne', 'is', null)
                .order('updated_at', { ascending: false })
                .limit(1)
                .maybeSingle()

            if (tracking?.agent_assigne) {
                const { data: agent } = await supabase
                    .from('user_profiles')
                    .select('full_name, role')
                    .eq('id', tracking.agent_assigne)
                    .eq('role', 'agent')
                    .maybeSingle()

                const name = (agent?.full_name || '').trim()
                if (name) advisor = { name }
            }
        } catch {
            // Pas de conseiller remonté : l'app retombe sur « Équipe RGB ».
        }

        return NextResponse.json({ dossiers: dossiersWithDocs, advisor })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur' }, { status: 500 })
    }
}

// ─── Verify Kkiapay transaction (server-side, anti-fraud) ───────────────────
async function verifyKkiapayTransaction(transactionId: string): Promise<{ ok: boolean; status: string; amount?: number }> {
    const { data: settings } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['kkiapay_private_key', 'kkiapay_secret_key', 'kkiapay_sandbox'])
    const privateKey = settings?.find(s => s.key === 'kkiapay_private_key')?.value
    const secretKey = settings?.find(s => s.key === 'kkiapay_secret_key')?.value
    const sandbox = settings?.find(s => s.key === 'kkiapay_sandbox')?.value === 'true'
    const apiUrl = sandbox
        ? 'https://api-sandbox.kkiapay.me/api/v1/transactions/status'
        : 'https://api.kkiapay.me/api/v1/transactions/status'

    if (!privateKey || !secretKey) return { ok: false, status: 'config_missing' }

    try {
        const res = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-private-key': String(privateKey),
                'x-secret-key': String(secretKey),
            },
            body: JSON.stringify({ transactionId }),
        })
        if (!res.ok) return { ok: false, status: `kkiapay_http_${res.status}` }
        const data = await res.json()
        return { ok: data?.status === 'SUCCESS', status: data?.status || 'unknown', amount: data?.amount }
    } catch (e) {
        return { ok: false, status: e instanceof Error ? e.message : 'verify_failed' }
    }
}

// ─── POST : créer un dossier (commande service depuis mobile) ─────────────────
//   Body : { client_id, service_type, service_id?, notes?, payment_tx_id?, transaction_id? }
//   Si payment_tx_id (ou transaction_id) est fourni : vérification Kkiapay côté serveur
//   pour éviter qu'un client malveillant crée un dossier sans payer.
export async function POST(req: NextRequest) {
    try {
        // ── WAF #2 : analyse structurelle du body (proto pollution / RCE / SSRF / DoS) ──
        const { body: scanned, rejection } = await scanRequestBody(req)
        if (rejection) return rejection
        // Identité dérivée du jeton (anti-IDOR) : on ignore tout client_id du corps
        const client_id = await getMobileUserId(req)
        if (!client_id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const body = (scanned ?? {}) as any
        const { service_type, service_id, notes } = body
        const transactionId: string | undefined = body.payment_tx_id || body.transaction_id

        if (!service_type) {
            return NextResponse.json(
                { error: 'service_type est requis' },
                { status: 400 }
            )
        }

        // ── Idempotence paiement + anti-fraude Kkiapay ──
        if (transactionId) {
            const { data: existingByTx } = await supabase
                .from('dossier_tracking')
                .select('id')
                .eq('transaction_id', transactionId)
                .maybeSingle()
            if (existingByTx) {
                return NextResponse.json({ id: existingByTx.id, exists: true, message: 'Already created' }, { status: 200 })
            }
            const verify = await verifyKkiapayTransaction(transactionId)
            if (!verify.ok) {
                console.warn(`[mobile/dossiers] Paiement non confirmé : ${verify.status}`)
                return NextResponse.json({ error: `Paiement non confirmé (${verify.status})` }, { status: 402 })
            }
        }

        // S'assurer que le client existe dans client_profiles + récupérer son identité
        let cp = (await supabase.from('client_profiles')
            .select('id, nom, prenom, email, phone').eq('id', client_id).maybeSingle()).data
        if (!cp) {
            const { data: authUser } = await supabase.auth.admin.getUserById(client_id)
            if (authUser?.user) {
                await supabase.from('client_profiles').upsert({
                    id: client_id,
                    email: authUser.user.email || '',
                    nom: authUser.user.user_metadata?.nom || null,
                    prenom: authUser.user.user_metadata?.prenom || null,
                    phone: authUser.user.user_metadata?.phone || null,
                    pays: 'France',
                }, { onConflict: 'id' })
                cp = (await supabase.from('client_profiles')
                    .select('id, nom, prenom, email, phone').eq('id', client_id).maybeSingle()).data
            }
        }

        // ── Anti-doublon : un dossier ACTIF pour ce service ne se recrée pas ──
        const { data: existing } = await supabase
            .from('dossier_tracking')
            .select('id')
            .eq('client_id', client_id)
            .eq('service_type', service_type)
            .in('statut', ACTIVE_TRACKING_STATUTS)
            .limit(1)
            .maybeSingle()
        if (existing) {
            return NextResponse.json({ exists: true, id: existing.id }, { status: 200 })
        }

        // ── Créer le dossier de SERVICE dans dossier_tracking (source unique,
        //    statut global 'reception', visible admin/agent + onglet Service Mobile) ──
        const numDossier = `DOS-${Date.now().toString(36).toUpperCase()}`
        const nowIso = new Date().toISOString()
        const { data, error } = await supabase
            .from('dossier_tracking')
            .insert({
                client_id,
                num_dossier: numDossier,
                client_nom: cp?.nom || '',
                client_prenom: cp?.prenom || '',
                client_email: cp?.email || '',
                client_phone: cp?.phone || '',
                service_type,
                service_id: service_id || null,
                statut: 'reception',
                progression: 10,
                etapes: [],
                notes: notes || null,
                source: 'mobile',
                transaction_id: transactionId || null,
                payment_method: transactionId ? 'kkiapay' : null,
                created_at: nowIso,
                updated_at: nowIso,
            })
            .select('id')
            .single()

        if (error) {
            console.error('[api/mobile/dossiers POST]', error)
            return NextResponse.json({ error: error.message, code: error.code }, { status: 500 })
        }

        // Notification client (cloche in-app)
        await supabase.from('notifications').insert({
            user_id: client_id,
            title: 'Dossier créé',
            body: `Votre dossier "${service_type}" a été créé. Notre équipe vous contactera sous 24h.`,
            type: 'dossier',
            is_read: false,
            created_at: nowIso,
        })

        return NextResponse.json({ id: data.id }, { status: 201 })
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Erreur serveur' },
            { status: 500 }
        )
    }
}
