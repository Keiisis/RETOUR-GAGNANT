import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!

// GET /api/admin/comptabilite
// Retourne toutes les données ERP avec la service role key (bypass RLS)
export async function GET(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    if (!serviceKey) {
        return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquante' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    const [docsRes, ordersRes, depsRes, settingsRes] = await Promise.all([
        supabase
            .from('documents_financiers')
            .select(`
                id, type, numero,
                client_nom, client_prenom, client_email, client_phone, client_adresse,
                items, sous_total, total_tva, remise, notes, conditions,
                total, status, created_at, agent_id, currency,
                signature_url, signed_at
            `)
            .order('created_at', { ascending: false })
            .limit(5000),
        supabase
            .from('orders')
            .select('id,customer_name,customer_email,product_title,amount,currency,payment_status,payment_method,created_at')
            .order('created_at', { ascending: false })
            .limit(5000),
        supabase
            .from('depenses')
            .select('id,titre,categorie,montant,date_depense,agent_id,notes')
            .order('date_depense', { ascending: false })
            .limit(5000),
        supabase
            .from('settings')
            .select('key,value')
            .eq('key', 'commission_rate')
            .maybeSingle(),
    ])

    // Validation commissionRate : doit être entre 0 et 1 (pas un % comme 10)
    let commissionRate = 0.10
    if (settingsRes.data?.value) {
        const raw = parseFloat(settingsRes.data.value)
        if (!isNaN(raw)) {
            // Si valeur > 1, c'est un pourcentage → diviser par 100
            commissionRate = raw > 1 ? raw / 100 : raw
            commissionRate = Math.max(0, Math.min(1, commissionRate))
        }
    }

    return NextResponse.json({
        docs:           docsRes.data     || [],
        orders:         ordersRes.data   || [],
        depenses:       depsRes.data     || [],
        commissionRate,
        errors: {
            docs:     docsRes.error?.message     || null,
            orders:   ordersRes.error?.message   || null,
            depenses: depsRes.error?.message     || null,
        }
    })
}
