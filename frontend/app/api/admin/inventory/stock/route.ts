// ══════════════════════════════════════════════════════════════
//  ADMIN : Ajustement de stock (/admin/inventory)
//  - Article ERP (inventory_items) : entrée / sortie / correction, avec
//    mouvement tracé dans inventory_movements (colonnes réelles :
//    movement_type, quantity_changed, stock_after, created_by).
//  - Produit boutique (products) : saisie du stock réel. Pas de mouvement
//    possible : inventory_movements.item_id référence inventory_items.
//  Écriture conditionnelle sur l'ancien stock : si une vente a modifié le
//  stock entre la lecture et l'écriture, on refuse (409) au lieu d'écraser.
// ══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { requireStaff } from '@/lib/api-guard'
import { supabaseServeur } from '@/lib/supabase-serveur'

const MOUVEMENTS = ['in_purchase', 'in_return', 'adj_loss', 'adj_manual'] as const
type Mouvement = typeof MOUVEMENTS[number]

const CONFLIT = 'Le stock a changé entre-temps (vente en cours ?). Rechargez la page puis recommencez.'

export async function POST(request: NextRequest) {
    const garde = await requireStaff(request, 'agent')
    if (!garde.ok) return garde.response!

    let body: Record<string, unknown>
    try { body = await request.json() } catch { return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 }) }

    const source = body.source === 'boutique' ? 'boutique' : body.source === 'inventory' ? 'inventory' : null
    const id = String(body.id ?? '').trim()
    const valeur = Number(body.value)
    if (!source || !id) return NextResponse.json({ error: 'Article non précisé.' }, { status: 400 })
    if (!Number.isInteger(valeur)) return NextResponse.json({ error: 'Quantité invalide (nombre entier attendu).' }, { status: 400 })

    // ── Produit boutique : on saisit le stock réel ──
    if (source === 'boutique') {
        if (valeur < 0) return NextResponse.json({ error: 'Le stock ne peut pas être négatif.' }, { status: 400 })
        const { data: prod, error: lecture } = await supabaseServeur
            .from('products').select('id, stock').eq('id', id).maybeSingle()
        if (lecture) return NextResponse.json({ error: 'Lecture du produit impossible.' }, { status: 500 })
        if (!prod) return NextResponse.json({ error: 'Produit introuvable.' }, { status: 404 })

        const ancien = Number(prod.stock) || 0
        let maj = supabaseServeur.from('products')
            .update({ stock: valeur, updated_at: new Date().toISOString() })
            .eq('id', id)
        maj = prod.stock === null ? maj.is('stock', null) : maj.eq('stock', ancien)
        const { data, error } = await maj.select('id, stock')
        if (error) { console.error('[inventory/stock boutique]', error.message); return NextResponse.json({ error: 'Mise à jour impossible.' }, { status: 500 }) }
        if (!data || data.length === 0) return NextResponse.json({ error: CONFLIT }, { status: 409 })
        return NextResponse.json({ current_stock: Number(data[0].stock) || 0 })
    }

    // ── Article ERP : variation (+/-) ou correction absolue, tracée ──
    const mode = body.mode === 'set' ? 'set' : 'delta'
    const { data: item, error: lecture } = await supabaseServeur
        .from('inventory_items').select('id, title, track_inventory, current_stock').eq('id', id).maybeSingle()
    if (lecture) return NextResponse.json({ error: 'Lecture de l\'article impossible.' }, { status: 500 })
    if (!item) return NextResponse.json({ error: 'Article introuvable.' }, { status: 404 })
    if (!item.track_inventory) return NextResponse.json({ error: 'Cet article n\'a pas de suivi de stock.' }, { status: 400 })

    const ancien = Number(item.current_stock) || 0
    const nouveau = mode === 'set' ? valeur : ancien + valeur
    const variation = nouveau - ancien
    if (nouveau < 0) return NextResponse.json({ error: `Stock insuffisant : ${ancien} en stock.` }, { status: 400 })
    if (variation === 0) return NextResponse.json({ error: 'Aucune variation de stock.' }, { status: 400 })

    let type: Mouvement = mode === 'set' ? 'adj_manual' : (MOUVEMENTS as readonly string[]).includes(String(body.movement_type))
        ? body.movement_type as Mouvement : 'adj_manual'
    // Cohérence du sens : une entrée augmente, une perte diminue.
    if ((type === 'in_purchase' || type === 'in_return') && variation < 0) type = 'adj_manual'
    if (type === 'adj_loss' && variation > 0) type = 'adj_manual'

    const { data: maj, error } = await supabaseServeur
        .from('inventory_items')
        .update({ current_stock: nouveau, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('current_stock', ancien)
        .select('id, current_stock')
    if (error) { console.error('[inventory/stock ERP]', error.message); return NextResponse.json({ error: 'Mise à jour impossible.' }, { status: 500 }) }
    if (!maj || maj.length === 0) return NextResponse.json({ error: CONFLIT }, { status: 409 })

    const notes = String(body.notes ?? '').trim().slice(0, 500)
    const { error: mvtErr } = await supabaseServeur.from('inventory_movements').insert({
        item_id: id,
        movement_type: type,
        quantity_changed: variation,
        stock_after: nouveau,
        reference_type: 'manual',
        notes: notes || (mode === 'set' ? `Inventaire : stock corrigé de ${ancien} à ${nouveau}` : 'Ajustement manuel'),
        created_by: garde.userId || null,
    })
    if (mvtErr) {
        // Le stock est à jour mais la trace manque : on le dit, sans masquer.
        console.error('[inventory/stock ERP] mouvement', mvtErr.message)
        return NextResponse.json({ current_stock: nouveau, warning: 'Stock mis à jour, mais le mouvement n\'a pas pu être tracé.' })
    }
    return NextResponse.json({ current_stock: nouveau })
}
