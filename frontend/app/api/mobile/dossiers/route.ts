import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { scanRequestBody } from '@/lib/waf'
import { getMobileUserId } from '@/lib/mobile-auth'

// Service role — bypasse RLS pour créer/lire les dossiers depuis l'app mobile
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── GET : tous les dossiers d'un client avec leurs documents ────────────────
export async function GET(req: NextRequest) {
    try {
        // Identité dérivée du jeton (anti-IDOR) — on ignore tout client_id fourni
        const clientId = await getMobileUserId(req)
        if (!clientId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

        const { data: dossiers, error } = await supabase
            .from('dossiers')
            .select('id, status, progress, service_type, notes, created_at, updated_at')
            .eq('client_id', clientId)
            .order('created_at', { ascending: false })

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        // Pour chaque dossier, charger ses documents
        const dossiersWithDocs = await Promise.all((dossiers || []).map(async (d) => {
            const { data: docs } = await supabase
                .from('dossier_documents')
                .select('id, file_name, file_url, file_type, status, created_at')
                .eq('dossier_id', d.id)
                .order('created_at', { ascending: false })

            // Fallback sur table "documents" si dossier_documents vide
            let finalDocs = docs || []
            if (finalDocs.length === 0) {
                const { data: docs2 } = await supabase
                    .from('documents')
                    .select('id, file_name, file_url, file_type, status, created_at')
                    .eq('dossier_id', d.id)
                    .order('created_at', { ascending: false })
                finalDocs = docs2 || []
            }

            return { ...d, documents: finalDocs }
        }))

        return NextResponse.json({ dossiers: dossiersWithDocs })
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
        // Identité dérivée du jeton (anti-IDOR) — on ignore tout client_id du corps
        const client_id = await getMobileUserId(req)
        if (!client_id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const body = (scanned ?? {}) as any
        const { service_type, service_id, notes } = body
        const transactionId: string | undefined = body.payment_tx_id || body.transaction_id
        const paymentAmount: number | null =
            body.payment_amount !== undefined && body.payment_amount !== null
                ? Number(body.payment_amount)
                : null
        const paymentCurrency: string = String(body.payment_currency || 'XOF')

        if (!service_type) {
            return NextResponse.json(
                { error: 'service_type est requis' },
                { status: 400 }
            )
        }

        // ── Vérification paiement Kkiapay côté serveur (anti-fraude) ──
        // Idempotence : si un dossier existe déjà avec ce transaction_id, on le renvoie.
        if (transactionId) {
            const { data: existingByTx } = await supabase
                .from('dossiers')
                .select('id, status')
                .eq('transaction_id', transactionId)
                .maybeSingle()
            if (existingByTx) {
                return NextResponse.json({ id: existingByTx.id, exists: true, message: 'Already created' }, { status: 200 })
            }

            // Vérifier le paiement Kkiapay
            const verify = await verifyKkiapayTransaction(transactionId)
            if (!verify.ok) {
                console.warn(`[mobile/dossiers] Paiement non confirmé : ${verify.status}`)
                return NextResponse.json(
                    { error: `Paiement non confirmé (${verify.status})` },
                    { status: 402 }
                )
            }
        }

        // S'assurer que le client existe dans client_profiles (cas inscription mobile)
        const { data: cp } = await supabase
            .from('client_profiles')
            .select('id')
            .eq('id', client_id)
            .single()

        if (!cp) {
            // Récupérer l'email depuis auth.users et créer le profil manquant
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
            }
        }

        // Vérifier si un dossier actif existe déjà
        const { data: existing } = await supabase
            .from('dossiers')
            .select('id')
            .eq('client_id', client_id)
            .eq('service_type', service_type)
            .in('status', ['en_cours', 'en_attente', 'soumis', 'verifie', 'traitement', 'validation'])
            .limit(1)
            .single()

        if (existing) {
            return NextResponse.json({ exists: true, id: existing.id }, { status: 200 })
        }

        // Créer le dossier (avec trace paiement complète si fournie)
        const { data, error } = await supabase
            .from('dossiers')
            .insert({
                client_id,
                service_type,
                service_id: service_id || null,
                status: 'soumis',
                progress: 0,
                notes: notes || null,
                transaction_id: transactionId || null,
                payment_method: transactionId ? 'kkiapay' : null,
                payment_amount: paymentAmount,
                payment_currency: paymentCurrency,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .select('id')
            .single()

        if (error) {
            console.error('[api/mobile/dossiers POST]', error)
            return NextResponse.json(
                { error: error.message, code: error.code },
                { status: 500 }
            )
        }

        // Créer la notification client
        await supabase.from('notifications').insert({
            user_id: client_id,
            title: 'Dossier créé',
            body: `Votre dossier "${service_type}" a été créé. Notre équipe vous contactera sous 24h.`,
            type: 'dossier',
            is_read: false,
            created_at: new Date().toISOString(),
        })

        // ── Sync vers dossier_tracking pour le dashboard agent ──
        try {
            const { data: clientProfile } = await supabase
                .from('client_profiles')
                .select('nom, prenom, email, phone')
                .eq('id', client_id)
                .single()

            const numDossier = `DOS-${Date.now().toString(36).toUpperCase()}`
            await supabase.from('dossier_tracking').insert({
                dossier_ref_id: data.id,
                num_dossier: numDossier,
                client_nom: clientProfile?.nom || '',
                client_prenom: clientProfile?.prenom || '',
                client_email: clientProfile?.email || '',
                client_phone: clientProfile?.phone || '',
                service_type,
                statut: 'reception',
                progression: 10,
                etapes: [],
                notes: notes || null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
        } catch (syncErr) {
            console.warn('[api/mobile/dossiers] Sync vers dossier_tracking échoué:', syncErr)
        }

        return NextResponse.json({ id: data.id }, { status: 201 })
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Erreur serveur' },
            { status: 500 }
        )
    }
}
