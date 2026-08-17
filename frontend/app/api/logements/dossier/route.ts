// ══════════════════════════════════════════════════════════════
//  Encaissement des FRAIS DE CONSTITUTION DE DOSSIER logement (site web).
//
//  Pendant du parcours mobile : le prospect est déjà enregistré
//  (/api/logements/lead), le client règle ensuite les frais. Ici on VÉRIFIE le
//  paiement côté serveur puis on ouvre le dossier « Logement » dans
//  dossier_tracking, visible en admin et pour l'agent habilité.
//
//  Le montant fait autorité côté SERVEUR : il est relu depuis page_sections,
//  jamais accepté depuis le client (sinon n'importe qui paierait 1 FCFA).
// ══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { guardPublicBody, PUBLIC_FORM_LIMIT } from '@/lib/api-guard'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
)

const EUR_TO_XOF = 655.957
const FALLBACK_FEE = { amount: 250, currency: 'EUR' }
/** Tolérance d'écart sur le montant encaissé (arrondis de passerelle). */
const TOLERANCE_XOF = 50

async function feeConfig(): Promise<{ amount: number; currency: string }> {
    const { data } = await supabase
        .from('page_sections').select('content')
        .eq('page', 'logement').eq('section_key', 'form_settings').maybeSingle()
    const c = (data?.content || {}) as Record<string, unknown>
    const amount = Number(c.dossier_amount)
    return {
        amount: isFinite(amount) && amount > 0 ? amount : FALLBACK_FEE.amount,
        currency: String(c.dossier_currency || FALLBACK_FEE.currency).toUpperCase(),
    }
}

function toXof(amount: number, currency: string): number {
    return currency.toUpperCase() === 'EUR' ? Math.round(amount * EUR_TO_XOF) : Math.round(amount)
}

/** Vérifie une transaction Kkiapay auprès de la passerelle (anti-fraude). */
async function verifyKkiapay(transactionId: string): Promise<{ ok: boolean; status: string; amount?: number }> {
    const { data: settings } = await supabase
        .from('settings').select('key, value')
        .in('key', ['kkiapay_private_key', 'kkiapay_secret_key', 'kkiapay_sandbox'])
    const privateKey = settings?.find(s => s.key === 'kkiapay_private_key')?.value
    const secretKey = settings?.find(s => s.key === 'kkiapay_secret_key')?.value
    const sandbox = settings?.find(s => s.key === 'kkiapay_sandbox')?.value === 'true'
    if (!privateKey || !secretKey) return { ok: false, status: 'kkiapay_keys_missing' }

    const url = sandbox
        ? 'https://api-sandbox.kkiapay.me/api/v1/transactions/status'
        : 'https://api.kkiapay.me/api/v1/transactions/status'
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': privateKey,
                'x-private-key': privateKey,
                'x-secret-key': secretKey,
            },
            body: JSON.stringify({ transactionId }),
        })
        if (!res.ok) return { ok: false, status: `kkiapay_http_${res.status}` }
        const data = await res.json().catch(() => ({}))
        return { ok: data?.status === 'SUCCESS', status: data?.status || 'unknown', amount: Number(data?.amount) }
    } catch (e) {
        return { ok: false, status: e instanceof Error ? e.message : 'verify_failed' }
    }
}

export async function POST(request: NextRequest) {
    const guard = await guardPublicBody(request, 'logements/dossier', PUBLIC_FORM_LIMIT)
    if (guard.rejection) return guard.rejection
    const body = (guard.body || {}) as Record<string, unknown>

    const provider = String(body.payment_provider || '').trim().toLowerCase()
    const txId = String(body.payment_tx_id || '').trim()
    const leadId = String(body.lead_id || '').trim() || null
    const nom = String(body.nom || '').trim()
    const email = String(body.email || '').trim().toLowerCase()
    const telephone = String(body.telephone || '').trim()
    const logementNom = String(body.logement_nom || '').trim() || null

    if (!txId) return NextResponse.json({ error: 'Référence de paiement manquante.' }, { status: 400 })
    if (!nom || (!email && !telephone)) {
        return NextResponse.json({ error: 'Nom et un moyen de contact requis.' }, { status: 400 })
    }

    const fee = await feeConfig()
    const expectedXof = toXof(fee.amount, fee.currency)

    // Anti-rejeu : une même transaction ne peut ouvrir qu'un seul dossier.
    const { data: deja } = await supabase
        .from('dossier_tracking').select('id')
        .eq('transaction_id', txId).maybeSingle()
    if (deja) {
        return NextResponse.json({ success: true, already: true, dossier_id: deja.id })
    }

    // Kkiapay : vérification serveur obligatoire. Les autres passerelles sont
    // confirmées par leur webhook dédié ; on enregistre alors sans revérifier ici.
    if (provider === 'kkiapay') {
        const v = await verifyKkiapay(txId)
        if (!v.ok) {
            return NextResponse.json(
                { error: `Paiement non confirmé par la passerelle (${v.status}).` },
                { status: 402 },
            )
        }
        if (typeof v.amount === 'number' && v.amount > 0 && v.amount + TOLERANCE_XOF < expectedXof) {
            return NextResponse.json(
                { error: 'Montant encaissé inférieur aux frais de dossier.' },
                { status: 402 },
            )
        }
    }

    const nowIso = new Date().toISOString()
    const { data: dossier, error } = await supabase
        .from('dossier_tracking')
        .insert({
            num_dossier: `DOS-${Date.now().toString(36).toUpperCase()}`,
            client_nom: nom,
            client_prenom: String(body.prenom || '').trim() || '',
            client_email: email || '',
            client_phone: telephone || '',
            service_type: 'Logement',
            statut: 'reception',
            progression: 10,
            etapes: [],
            source: 'web',
            transaction_id: txId,
            payment_method: provider || null,
            notes: [
                'Frais de constitution de dossier réglés.',
                logementNom ? `Bien visé : ${logementNom}.` : 'Aucun bien précis : projet à qualifier.',
                leadId ? `Prospect : ${leadId}.` : null,
            ].filter(Boolean).join(' '),
            created_at: nowIso,
            updated_at: nowIso,
        })
        .select('id')
        .single()

    if (error) {
        console.error('[logements/dossier]', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Le prospect passe en « traité » : les frais sont réglés, le dossier est ouvert.
    if (leadId) {
        await supabase.from('logement_leads')
            .update({ statut: 'traite' }).eq('id', leadId)
            .then(() => undefined, () => undefined)
    }

    return NextResponse.json({ success: true, dossier_id: dossier.id })
}
