// ══════════════════════════════════════════════════════════════
//  TRADUCTION D'UN DEVIS / D'UNE FACTURE (textes saisis seulement)
//
//  GET /api/documents/traduction?id=<uuid>&lang=en
//  → { lang, traductions: { segment français → traduction } }
//
//  Appelé par le téléchargement navigateur (portail client, panels admin /
//  agent) avant de dessiner le PDF dans la langue choisie. Comme le portail
//  /portail/[id], l'identifiant du document EST le secret : la route ne
//  renvoie que des traductions de textes du document, jamais ses montants
//  ni les coordonnées du client. Débit limité.
// ══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { guardPublic, TRANSLATE_LIMIT } from '@/lib/api-guard'
import { langueDoc } from '@/lib/document-langues'
import { modeleDepuisContenu } from '@/lib/document-pdf'
import { segmentsDocument } from '@/lib/document-traduction'
import { traduireSegments } from '@/lib/translation/documents'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: NextRequest) {
    const trop = guardPublic(request, 'documents-traduction', TRANSLATE_LIMIT)
    if (trop) return trop

    const id = request.nextUrl.searchParams.get('id') || ''
    const lang = langueDoc(request.nextUrl.searchParams.get('lang'))
    if (!UUID.test(id)) return NextResponse.json({ error: 'id invalide' }, { status: 400 })
    if (lang === 'fr') return NextResponse.json({ lang, traductions: {} })

    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const [{ data: doc }, { data: tpl }] = await Promise.all([
        sb.from('documents_financiers').select('items, notes, conditions, validite, payment_method, payment_provider, total_tva').eq('id', id).maybeSingle(),
        sb.from('document_templates').select('content').eq('id', 'official_devis_facture').maybeSingle(),
    ])
    if (!doc) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })

    const segments = segmentsDocument({
        invoiceRef: '', date: '', isPaid: false, clientName: '', currency: 'XOF',
        sous_total: 0, total: 0, remise: 0, total_tva: Number(doc.total_tva) || 0,
        items: (Array.isArray(doc.items) ? doc.items : []).map((i: Record<string, unknown>) => ({ description: String(i.description || ''), quantity: 0, unit_price: 0, tva: 0 })),
        notes: doc.notes || undefined,
        conditions: doc.conditions || undefined,
        validite: doc.validite || undefined,
        paymentMethod: doc.payment_method || doc.payment_provider || undefined,
        modele: modeleDepuisContenu(tpl?.content as Record<string, unknown> | undefined),
    })
    const traductions = await traduireSegments(segments, lang)
    return NextResponse.json({ lang, traductions }, { headers: { 'Cache-Control': 'private, no-store' } })
}
