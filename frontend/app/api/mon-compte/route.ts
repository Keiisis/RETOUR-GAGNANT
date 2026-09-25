// GET    /api/mon-compte — données de l'espace client de l'email PROUVÉ.
// DELETE /api/mon-compte — déconnexion (efface le cookie).
// Remplace les lectures directes en clé publique de /mon-compte (audit 25/09/2026).
import { NextRequest, NextResponse } from 'next/server'
import { supabaseServeur } from '@/lib/supabase-serveur'
import { emailProuve, fermerSession } from '@/lib/espace-email'

export async function GET(req: NextRequest) {
    const email = await emailProuve(req)
    if (!email) return NextResponse.json({ error: 'Session expirée.' }, { status: 401 })

    const sb = supabaseServeur
    // ilike = insensible à la casse ; `_` et `%` échappés (sinon jokers :
    // « a_b@x.com » lirait aussi « axb@x.com »).
    const motif = email.replace(/[\\%_]/g, c => '\\' + c)
    const par = (table: string, col: string) =>
        sb.from(table).select('*').ilike(col, motif).order('created_at', { ascending: false }).limit(200)

    const [dossiers, oracle, documents, contrats, commandes] = await Promise.all([
        par('dossier_tracking', 'client_email'),
        par('eligibility_results', 'client_email'),
        par('client_documents', 'client_email'),
        par('contracts', 'client_email'),
        par('orders', 'customer_email'),
    ])
    const erreur = [dossiers, oracle, documents, contrats, commandes].find(r => r.error)?.error
    if (erreur) return NextResponse.json({ error: erreur.message }, { status: 500 })

    return NextResponse.json({
        email,
        dossiers: dossiers.data || [],
        oracle: oracle.data || [],
        documents: documents.data || [],
        contrats: contrats.data || [],
        commandes: commandes.data || [],
    })
}

export async function DELETE() {
    const res = NextResponse.json({ ok: true })
    fermerSession(res)
    return res
}
