import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { scanRequestBody } from '@/lib/waf'
import { convertCurrency } from '@/lib/currency'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
)

// ══════════════════════════════════════════════════════════════
// POST /api/services/fa-checkout — Consultation Fa & Racines.
// Crée la commande CÔTÉ SERVEUR avec le PRIX FIXÉ ICI (jamais celui du
// client), lu depuis les tarifs admin du service, converti en XOF (taux BCEAO).
// La commande entre ensuite dans le pipeline standard : widget Kkiapay/
// FedaPay avec { order_id } → /api/checkout/verify → webhook (filet) →
// facture + reçu automatiques.
// L'acceptation de la clause de mise en relation est OBLIGATOIRE et
// horodatée dans la commande.
// ══════════════════════════════════════════════════════════════

// Tarifs de REPLI si le service n'est pas configuré en base
const FALLBACK_PRICES_EUR = { presentiel: 550, visio: 780 } as const

/** Extrait un montant EUR d'un libellé tarifaire (« 350 € », « 1 200 € »). */
function parseEur(s: string): number | null {
    const clean = String(s || '').replace(/[^\d,.]/g, '')
    const m = clean.match(/(\d+(?:[.,]\d+)?)/)
    if (!m) return null
    const n = Number(m[1].replace(',', '.'))
    return isFinite(n) && n > 0 ? n : null
}

/**
 * Tarifs pilotés depuis l'admin (services.pricing_options du service
 * « consultation-fa-racines ») — MÊME source que la page et le calculateur.
 * Le prix reste fixé CÔTÉ SERVEUR : le client ne l'envoie jamais.
 */
async function getPricesEUR(): Promise<{ presentiel: number; visio: number }> {
    try {
        const { data } = await supabase
            .from('services').select('pricing_options').eq('slug', 'consultation-fa-racines').maybeSingle()
        const opts = data?.pricing_options as Array<{ label: string; price: string }> | undefined
        if (!Array.isArray(opts)) return { ...FALLBACK_PRICES_EUR }
        const find = (needle: string) => {
            const o = opts.find(x => (x.label || '').toLowerCase().includes(needle))
            return o ? parseEur(o.price) : null
        }
        return {
            presentiel: find('présentiel') ?? find('presentiel') ?? FALLBACK_PRICES_EUR.presentiel,
            visio: find('visio') ?? FALLBACK_PRICES_EUR.visio,
        }
    } catch {
        return { ...FALLBACK_PRICES_EUR }
    }
}

export async function POST(request: NextRequest) {
    try {
        const { body: scanned, rejection } = await scanRequestBody(request)
        if (rejection) return rejection
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const body = (scanned ?? {}) as any

        const mode = body.mode === 'visio' ? 'visio' as const : body.mode === 'presentiel' ? 'presentiel' as const : null
        const customerName = String(body.customer_name || '').trim()
        const customerEmail = String(body.customer_email || '').trim().toLowerCase()
        const customerPhone = String(body.customer_phone || '').trim()
        const clauseAccepted = body.clause_accepted === true

        if (!mode) return NextResponse.json({ error: 'Formule invalide (présentiel ou visio).' }, { status: 400 })
        if (!customerName || !customerPhone) return NextResponse.json({ error: 'Nom et téléphone requis.' }, { status: 400 })
        if (!customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
            return NextResponse.json({ error: 'Email invalide.' }, { status: 400 })
        }
        if (!clauseAccepted) {
            return NextResponse.json({ error: 'Vous devez accepter la clause de mise en relation pour poursuivre.' }, { status: 400 })
        }

        // Prix fixé serveur (source admin) — jamais fourni par le client
        const PRICES_EUR = await getPricesEUR()
        const amountEUR = PRICES_EUR[mode]
        const amountXOF = Math.round(convertCurrency(amountEUR, 'EUR', 'XOF'))

        const modeLabel = mode === 'presentiel' ? 'Présentiel' : 'Visio'
        const title = `Consultation Fa & Racines — ${modeLabel} (${amountEUR} €)`

        const { data: order, error } = await supabase
            .from('orders')
            .insert({
                product_id: null,
                product_title: title,
                quantity: 1,
                amount: amountXOF,
                currency: 'XOF',
                customer_name: customerName,
                customer_email: customerEmail,
                customer_phone: customerPhone,
                payment_method: body.payment_method === 'fedapay' ? 'fedapay' : 'kkiapay',
                payment_status: 'pending',
                cart_items: [{
                    title,
                    quantity: 1,
                    price: amountXOF,
                    service: 'consultation-fa-racines',
                    mode,
                    price_eur: amountEUR,
                    clause_mise_en_relation_acceptee_le: new Date().toISOString(),
                }],
            })
            .select('id')
            .single()

        if (error) {
            console.error('[fa-checkout] insert error:', error.message)
            return NextResponse.json({ error: `Erreur DB: ${error.message}` }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            order_id: order.id,
            amount_xof: amountXOF,
            amount_eur: amountEUR,
            mode,
        })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur' }, { status: 500 })
    }
}
