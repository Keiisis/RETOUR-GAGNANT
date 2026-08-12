import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { scanRequestBody } from '@/lib/waf'
import { toXOFStrict } from '@/lib/server-rates'
import { guardPublic } from '@/lib/api-guard'
import { PAYMENT_ROUTE_LIMIT } from '@/lib/rate-limit'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
)

// ══════════════════════════════════════════════════════════════
// POST /api/services/permis-checkout : Permis de Conduire Béninois.
// Le PRIX dépend de la CATÉGORIE de permis choisie ; il est fixé CÔTÉ SERVEUR
// depuis la table permis_types (jamais fourni par le client), converti en XOF
// (taux BCEAO). L'auto-école est un choix facultatif (où suivre la formation).
// La commande entre dans le pipeline standard : widget Kkiapay/FedaPay avec
// { order_id } → /api/checkout/verify → webhook (filet) → facture + reçu.
// ══════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
    const trop = guardPublic(request, 'services/permis-checkout', PAYMENT_ROUTE_LIMIT)
    if (trop) return trop

    try {
        const { body: scanned, rejection } = await scanRequestBody(request)
        if (rejection) return rejection
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const body = (scanned ?? {}) as any

        const typeId = String(body.permis_type_id || '').trim()
        const schoolId = String(body.school_id || '').trim() || null
        const customerName = String(body.customer_name || '').trim()
        const customerEmail = String(body.customer_email || '').trim().toLowerCase()
        const customerPhone = String(body.customer_phone || '').trim()

        if (!typeId) return NextResponse.json({ error: 'Veuillez choisir une catégorie de permis.' }, { status: 400 })
        if (!customerName || !customerPhone) return NextResponse.json({ error: 'Nom et téléphone requis.' }, { status: 400 })
        if (!customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
            return NextResponse.json({ error: 'Email invalide.' }, { status: 400 })
        }

        // Catégorie choisie, validée en base : active uniquement. Le PRIX vient
        // d'ici (source unique, jamais falsifiable côté client).
        const { data: type } = await supabase
            .from('permis_types')
            .select('id, category, label, price_eur, duration')
            .eq('id', typeId).eq('is_active', true).maybeSingle()
        if (!type) {
            return NextResponse.json({ error: 'Catégorie indisponible. Actualisez la page.' }, { status: 400 })
        }

        const amountEUR = Number(type.price_eur)
        if (!isFinite(amountEUR) || amountEUR <= 0) {
            return NextResponse.json(
                { error: 'Tarif non configuré pour cette catégorie. Contactez-nous, nous régularisons immédiatement.' },
                { status: 503 },
            )
        }
        const amountXOF = await toXOFStrict(amountEUR, 'EUR')
        if (amountXOF === null || amountXOF <= 0) {
            return NextResponse.json(
                { error: 'Taux de change EUR indisponible. Réessayez dans un instant.' },
                { status: 503 },
            )
        }

        // Auto-école choisie (facultatif) : validée si fournie.
        let schoolName: string | null = null
        let schoolRef: string | null = null
        if (schoolId) {
            const { data: school } = await supabase
                .from('driving_schools').select('id, nom, ville')
                .eq('id', schoolId).eq('is_active', true).maybeSingle()
            if (school) {
                schoolRef = school.id
                schoolName = `${school.nom}${school.ville ? ` (${school.ville})` : ''}`
            }
        }

        const title = `Permis de Conduire Béninois : ${type.label} (${amountEUR} €)`
            + (schoolName ? ` / ${schoolName}` : '')

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
                    service: 'permis-conduire',
                    price_eur: amountEUR,
                    permis_type_id: type.id,
                    permis_category: type.category,
                    permis_label: type.label,
                    duration: type.duration || null,
                    school_id: schoolRef,
                    school_name: schoolName,
                }],
            })
            .select('id')
            .single()

        if (error) {
            console.error('[permis-checkout] insert error:', error.message)
            return NextResponse.json({ error: `Erreur DB: ${error.message}` }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            order_id: order.id,
            amount_xof: amountXOF,
            amount_eur: amountEUR,
        })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur' }, { status: 500 })
    }
}
