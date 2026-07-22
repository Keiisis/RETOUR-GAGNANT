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

    const [docsRes, ordersRes, depsRes, settingsRes, paiemRes, agentsRes, cloturesRes] = await Promise.all([
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
            // NB : PAS de colonne `notes` sur depenses (colonnes réelles :
            // titre, categorie, montant, devise, date_depense, agent_id) — la
            // demander faisait ECHOUER toute la requete → l'admin ne voyait
            // AUCUNE depense (dont celles des agents), faussant Dépenses Totales.
            .select('id,titre,categorie,montant,devise,date_depense,agent_id')
            .order('date_depense', { ascending: false })
            .limit(5000),
        // Source de vérité du taux de commission : system_settings/comptabilite_erp
        // (c'est là que l'écran Admin > Paramètres ERP l'enregistre). On lit AUSSI
        // l'ancienne clé settings.commission_rate en secours.
        supabase
            .from('system_settings')
            .select('value')
            .eq('id', 'comptabilite_erp')
            .maybeSingle(),
        supabase
            .from('paiements_manuels')
            .select('id,document_id,type,montant,date_paiement,reference,notes,agent_id')
            .order('date_paiement', { ascending: false })
            .limit(10000),
        supabase
            .from('user_profiles')
            .select('id,full_name,role')
            .in('role', ['agent', 'admin', 'ceo', 'super_admin']),
        supabase
            .from('clotures_mensuelles')
            .select('id,periode,date_cloture,cloture_par_nom,total_encaisse,total_depenses,total_tva,benefice_net,total_commissions,benefice_net_final,nb_documents,nb_paiements,nb_depenses,notes,hash_integrite,status,reopened_at,reopened_par_nom,reopen_count')
            .order('periode', { ascending: false }),
    ])

    // Taux de commission : lu depuis system_settings/comptabilite_erp (JSON
    // { commission_rate }). Peut valoir 0 (aucune commission). Validation 0..1.
    let commissionRate = 0.10
    const erpVal = settingsRes.data?.value as { commission_rate?: number } | null | undefined
    if (erpVal && typeof erpVal.commission_rate === 'number' && !isNaN(erpVal.commission_rate)) {
        const raw = erpVal.commission_rate
        commissionRate = raw > 1 ? raw / 100 : raw
        commissionRate = Math.max(0, Math.min(1, commissionRate))
    }

    return NextResponse.json({
        docs:           docsRes.data     || [],
        orders:         ordersRes.data   || [],
        depenses:       depsRes.data     || [],
        paiements:      paiemRes.data    || [],
        agents:         agentsRes.data   || [],
        clotures:       cloturesRes.data || [],
        commissionRate,
        errors: {
            docs:     docsRes.error?.message     || null,
            orders:   ordersRes.error?.message   || null,
            depenses: depsRes.error?.message     || null,
            paiements: paiemRes.error?.message   || null,
            agents:   agentsRes.error?.message   || null,
            clotures: cloturesRes.error?.message || null,
        }
    })
}
