// ══════════════════════════════════════════════════════════════
//  ADMIN : Catalogue ERP (inventory_items) — création + modification
//  Les boutons « Ajouter un Article ERP » et « Modifier » de
//  /admin/inventory n'avaient aucune action : cette route les sert.
//  Écriture en service role, la garde de session est faite ici (et par
//  le middleware, qui réserve /api/admin/* aux administrateurs).
//  Le stock n'est PAS modifiable ici : il passe par /api/admin/inventory/stock
//  pour que chaque variation soit tracée dans inventory_movements.
// ══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { requireStaff } from '@/lib/api-guard'
import { supabaseServeur } from '@/lib/supabase-serveur'

const TYPES = ['physical', 'service', 'digital'] as const
type ItemType = typeof TYPES[number]

interface Champs {
    title?: string
    type?: ItemType
    sku?: string | null
    category?: string | null
    description?: string | null
    base_price?: number
    cost_price?: number
    tax_rate?: number
    track_inventory?: boolean
    low_stock_threshold?: number
    is_published?: boolean
}

function nombrePositif(v: unknown, nom: string): number {
    const n = Number(v)
    if (!Number.isFinite(n) || n < 0) throw new Error(`${nom} invalide.`)
    return n
}

function texteOuNull(v: unknown, max: number): string | null {
    if (v === null || v === undefined) return null
    const t = String(v).trim().slice(0, max)
    return t ? t : null
}

/** Ne garde que les champs connus et valides ; lève une Error lisible sinon. */
function lireChamps(body: Record<string, unknown>, creation: boolean): Champs {
    const c: Champs = {}
    if (creation || 'title' in body) {
        const title = String(body.title ?? '').trim().slice(0, 200)
        if (!title) throw new Error('Le titre est requis.')
        c.title = title
    }
    if (creation || 'type' in body) {
        const type = String(body.type ?? 'physical') as ItemType
        if (!TYPES.includes(type)) throw new Error('Type invalide.')
        c.type = type
    }
    if ('sku' in body) c.sku = texteOuNull(body.sku, 80)
    if ('category' in body) c.category = texteOuNull(body.category, 120)
    if ('description' in body) c.description = texteOuNull(body.description, 4000)
    if (creation || 'base_price' in body) c.base_price = nombrePositif(body.base_price ?? 0, 'Prix de vente')
    if (creation || 'cost_price' in body) c.cost_price = nombrePositif(body.cost_price ?? 0, 'Prix de revient')
    if (creation || 'tax_rate' in body) {
        const t = nombrePositif(body.tax_rate ?? 18, 'Taux de TVA')
        if (t > 100) throw new Error('Taux de TVA invalide.')
        c.tax_rate = t
    }
    if (creation || 'track_inventory' in body) c.track_inventory = body.track_inventory === undefined ? true : Boolean(body.track_inventory)
    if (creation || 'low_stock_threshold' in body) c.low_stock_threshold = Math.floor(nombrePositif(body.low_stock_threshold ?? 5, 'Seuil d\'alerte'))
    if (creation || 'is_published' in body) c.is_published = body.is_published === undefined ? true : Boolean(body.is_published)
    // Un service ou un bien numérique n'a pas de stock physique.
    if (c.type && c.type !== 'physical') c.track_inventory = false
    return c
}

function messageErreurBase(err: { code?: string; message?: string } | null): string {
    if (err?.code === '23505') return 'Ce SKU est déjà utilisé par un autre article.'
    return 'Enregistrement impossible.'
}

export async function POST(request: NextRequest) {
    const garde = await requireStaff(request, 'agent')
    if (!garde.ok) return garde.response!

    let body: Record<string, unknown>
    try { body = await request.json() } catch { return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 }) }

    let champs: Champs
    try { champs = lireChamps(body, true) } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Données invalides.' }, { status: 400 })
    }

    const stockInitial = champs.track_inventory ? Math.floor(Number(body.current_stock) || 0) : 0
    if (stockInitial < 0) return NextResponse.json({ error: 'Stock initial invalide.' }, { status: 400 })

    const { data, error } = await supabaseServeur
        .from('inventory_items')
        .insert({ ...champs, current_stock: stockInitial })
        .select('*')
        .single()
    if (error || !data) {
        console.error('[inventory POST]', error?.message)
        return NextResponse.json({ error: messageErreurBase(error) }, { status: error?.code === '23505' ? 409 : 500 })
    }

    // Stock d'ouverture tracé comme un mouvement manuel (audit)
    if (stockInitial > 0) {
        const { error: mvtErr } = await supabaseServeur.from('inventory_movements').insert({
            item_id: data.id,
            movement_type: 'adj_manual',
            quantity_changed: stockInitial,
            stock_after: stockInitial,
            reference_type: 'manual',
            notes: 'Stock initial à la création de l\'article',
            created_by: garde.userId || null,
        })
        if (mvtErr) console.error('[inventory POST] mouvement', mvtErr.message)
    }

    return NextResponse.json({ item: data }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
    const garde = await requireStaff(request, 'agent')
    if (!garde.ok) return garde.response!

    let body: Record<string, unknown>
    try { body = await request.json() } catch { return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 }) }

    const id = String(body.id ?? '').trim()
    if (!id) return NextResponse.json({ error: 'Identifiant manquant.' }, { status: 400 })

    let champs: Champs
    try { champs = lireChamps(body, false) } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Données invalides.' }, { status: 400 })
    }
    if (Object.keys(champs).length === 0) return NextResponse.json({ error: 'Aucune modification.' }, { status: 400 })

    const { data, error } = await supabaseServeur
        .from('inventory_items')
        .update({ ...champs, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .maybeSingle()
    if (error) {
        console.error('[inventory PATCH]', error.message)
        return NextResponse.json({ error: messageErreurBase(error) }, { status: error.code === '23505' ? 409 : 500 })
    }
    if (!data) return NextResponse.json({ error: 'Article introuvable.' }, { status: 404 })

    return NextResponse.json({ item: data })
}
