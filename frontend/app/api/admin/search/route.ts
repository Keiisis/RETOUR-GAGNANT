// ══════════════════════════════════════════════════════════════
//  RECHERCHE GLOBALE : Admin
//
//  Trouver un client d'un seul champ, au lieu d'ouvrir dossiers, puis
//  factures, puis messages tour à tour. On interroge les quatre surfaces
//  en parallèle et on renvoie des résultats groupés, chacun avec un lien
//  direct vers la section concernée.
//
//  Lecture seule, admin uniquement. La requête est échappée pour le
//  filtre PostgREST `ilike` (les caractères %,* sont neutralisés).
// ══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireStaff } from '@/lib/api-guard'

export const dynamic = 'force-dynamic'

const db = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

/** Neutralise les jokers PostgREST pour un ilike littéral. */
const echapper = (q: string) => q.replace(/[%,()*\\]/g, ' ').trim()

export interface ResultatRecherche {
    dossiers: Array<{ id: string; ref: string; client: string; statut: string; lien: string }>
    factures: Array<{ id: string; numero: string; client: string; total: number; devise: string; statut: string; lien: string }>
    messages: Array<{ id: string; sujet: string; expediteur: string; lien: string }>
    clients: Array<{ id: string; nom: string; email: string; phone: string | null }>
}

export async function GET(request: NextRequest) {
    const garde = await requireStaff(request, 'admin')
    if (!garde.ok) return garde.response!

    const brut = request.nextUrl.searchParams.get('q') || ''
    const q = echapper(brut)
    if (q.length < 2) {
        return NextResponse.json({ error: 'Tapez au moins 2 caractères.' }, { status: 400 })
    }

    const like = `%${q}%`
    const supabase = db()
    const LIM = 8

    const [dossRes, facRes, msgRes, cliRes] = await Promise.all([
        supabase.from('dossier_tracking')
            .select('id, num_dossier, client_nom, client_prenom, client_email, statut')
            .or(`num_dossier.ilike.${like},client_nom.ilike.${like},client_prenom.ilike.${like},client_email.ilike.${like}`)
            .order('created_at', { ascending: false })
            .limit(LIM),
        supabase.from('documents_financiers')
            .select('id, numero, client_nom, client_prenom, client_email, total, currency, status, type')
            .eq('type', 'facture')
            .or(`numero.ilike.${like},client_nom.ilike.${like},client_prenom.ilike.${like},client_email.ilike.${like}`)
            .order('created_at', { ascending: false })
            .limit(LIM),
        supabase.from('messages')
            .select('id, sujet, nom, prenom, email')
            .or(`sujet.ilike.${like},nom.ilike.${like},prenom.ilike.${like},email.ilike.${like}`)
            .order('created_at', { ascending: false })
            .limit(LIM),
        supabase.from('client_profiles')
            .select('id, nom, prenom, email, phone')
            .or(`nom.ilike.${like},prenom.ilike.${like},email.ilike.${like},phone.ilike.${like}`)
            .order('created_at', { ascending: false })
            .limit(LIM),
    ])

    const nom = (p: string | null, n: string | null, e: string | null) =>
        `${p || ''} ${n || ''}`.trim() || e || '-'

    const resultat: ResultatRecherche = {
        dossiers: (dossRes.data || []).map(d => ({
            id: d.id,
            ref: d.num_dossier || d.id.slice(0, 8),
            client: nom(d.client_prenom, d.client_nom, d.client_email),
            statut: d.statut || '',
            lien: '/admin/dossiers',
        })),
        factures: (facRes.data || []).map(f => ({
            id: f.id,
            numero: f.numero || f.id.slice(0, 8),
            client: nom(f.client_prenom, f.client_nom, f.client_email),
            total: Number(f.total) || 0,
            devise: f.currency || 'XOF',
            statut: f.status || '',
            lien: '/admin/facturation',
        })),
        messages: (msgRes.data || []).map(m => ({
            id: m.id,
            sujet: m.sujet || '(sans objet)',
            expediteur: nom(m.prenom, m.nom, m.email),
            lien: `/admin/messages/show/${m.id}`,
        })),
        clients: (cliRes.data || []).map(c => ({
            id: c.id,
            nom: nom(c.prenom, c.nom, c.email),
            email: c.email || '',
            phone: c.phone || null,
        })),
    }

    const total = resultat.dossiers.length + resultat.factures.length
        + resultat.messages.length + resultat.clients.length

    return NextResponse.json({ resultat, total, q: brut })
}
