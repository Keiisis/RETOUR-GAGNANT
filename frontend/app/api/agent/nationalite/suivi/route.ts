import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireStaff } from '@/lib/api-guard'
import { NATIONALITE_DECISIONS } from '@/lib/constants/statuts'
import { construireSuivi, statutPourAvancement } from '@/lib/suivi-nationalite'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
)

/* Panneau « Suivi client » des onglets nationalité (admin + agent).
   GET  ?id=  : étapes, pièces demandées, pièces déposées par le client.
   POST       : étape exacte, notes visibles du client, pièces demandées.
   Le statut de la demande découle de l'étape : panneau, sélecteur de
   statut et page /suivi-dossier disent la même chose. */

type Demande = { id: string; application_ref: string | null; status: string; nom: string | null; prenom: string | null; email: string | null; telephone: string | null }

async function lireDemande(id: string): Promise<Demande | null> {
    const { data } = await supabase.from('nationality_applications')
        .select('id, application_ref, status, nom, prenom, email, telephone').eq('id', id).maybeSingle()
    return data as Demande | null
}

const sur = (v: string) => v.replace(/[^\w.@-]/g, '_').slice(0, 80) // même règle que /api/tracking/piece

/** Pièces déposées par le client depuis /suivi-dossier pour CE dossier. */
async function piecesDeposees(d: Demande) {
    if (!d.email || !d.application_ref) return []
    const { data } = await supabase.from('client_documents')
        .select('id, file_name, storage_path, created_at')
        .ilike('client_email', d.email.trim())
        .like('storage_path', `%/suivi/${sur(d.application_ref.toUpperCase())}/%`)
        .order('created_at', { ascending: false })
    return Promise.all((data || []).map(async p => {
        const { data: lien } = await supabase.storage.from('client-documents').createSignedUrl(String(p.storage_path), 600)
        return { id: p.id, nom: p.file_name, date: p.created_at, url: lien?.signedUrl || null }
    }))
}

async function lireSuivi(d: Demande) {
    if (!d.application_ref) return null
    const { data } = await supabase.from('dossier_tracking')
        .select('id, etapes, progression, statut, documents_manquants').eq('num_dossier', d.application_ref).maybeSingle()
    return data
}

export async function GET(request: NextRequest) {
    const garde = await requireStaff(request, 'agent')
    if (!garde.ok) return garde.response!
    const id = request.nextUrl.searchParams.get('id') || ''
    const d = id ? await lireDemande(id) : null
    if (!d) return NextResponse.json({ error: 'Dossier introuvable' }, { status: 404 })
    const suivi = await lireSuivi(d)
    return NextResponse.json({
        ref: d.application_ref,
        status: d.status,
        etapes: suivi?.etapes || [],
        progression: suivi?.progression ?? null,
        documents_manquants: Array.isArray(suivi?.documents_manquants) ? suivi.documents_manquants : [],
        pieces: await piecesDeposees(d),
    }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function POST(request: NextRequest) {
    const garde = await requireStaff(request, 'agent')
    if (!garde.ok) return garde.response!

    const body = await request.json().catch(() => ({})) as {
        id?: unknown; faites?: unknown; enCours?: unknown; rejet?: unknown; notes?: unknown; documents_manquants?: unknown
    }
    const d = body.id ? await lireDemande(String(body.id)) : null
    if (!d) return NextResponse.json({ error: 'Dossier introuvable' }, { status: 404 })
    if (!d.application_ref) return NextResponse.json({ error: 'Dossier sans référence : suivi impossible.' }, { status: 400 })

    const faites = Number(body.faites)
    if (!Number.isInteger(faites) || faites < 1 || faites > 7) return NextResponse.json({ error: 'Étape invalide (1 à 7).' }, { status: 400 })
    const rejet = body.rejet === true
    const notes: Record<number, string> = {}
    if (body.notes && typeof body.notes === 'object') {
        for (const [k, v] of Object.entries(body.notes as Record<string, unknown>)) {
            const n = Number(k)
            if (Number.isInteger(n) && n >= 1 && n <= 7) notes[n] = String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, 500)
        }
    }
    const manquants = Array.isArray(body.documents_manquants)
        ? [...new Set(body.documents_manquants.map(x => String(x ?? '').replace(/\s+/g, ' ').trim().slice(0, 120)).filter(Boolean))].slice(0, 20)
        : null

    const avant = await lireSuivi(d)
    const s = construireSuivi({ faites, enCours: body.enCours !== false }, avant?.etapes || [], { rejet, notes })
    const ligne = {
        statut: s.statut, progression: s.progression, etapes: s.etapes, updated_at: new Date().toISOString(),
        ...(manquants ? { documents_manquants: manquants } : {}),
    }
    const { error: errSuivi } = avant
        ? await supabase.from('dossier_tracking').update(ligne).eq('id', avant.id)
        : await supabase.from('dossier_tracking').insert({
            ...ligne,
            num_dossier: d.application_ref,
            client_nom: d.nom, client_prenom: d.prenom,
            client_email: (d.email || '').toLowerCase(),
            client_phone: d.telephone || '', client_whatsapp: d.telephone || '',
            service_type: 'Reconnaissance de Nationalité', service: 'nationalite',
            documents_manquants: manquants || [],
        })
    if (errSuivi) return NextResponse.json({ error: errSuivi.message }, { status: 500 })

    // Le statut de la demande suit l'étape.
    const status = rejet ? 'rejete' : statutPourAvancement(faites)
    if (status !== d.status) {
        const { error } = await supabase.from('nationality_applications')
            .update({ status, decision_date: (NATIONALITE_DECISIONS as string[]).includes(status) ? new Date().toISOString() : null })
            .eq('id', d.id)
        if (error) return NextResponse.json({ error: `Suivi enregistré, statut non mis à jour : ${error.message}` }, { status: 500 })
    }

    return NextResponse.json({ success: true, status, etapes: s.etapes, progression: s.progression, documents_manquants: manquants ?? avant?.documents_manquants ?? [] })
}
