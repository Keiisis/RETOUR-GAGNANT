// ══════════════════════════════════════════════════════════════
//  TAUX DE CHANGE : lecture publique, écriture réservée à l'admin
//
//  La table `currencies` est la source unique dont dépendent les devis,
//  les factures, l'export comptable et surtout la conversion envoyée aux
//  passerelles de paiement (toXOFStrict). Écrire dans cette table, c'est
//  écrire dans chaque montant encaissé : l'écriture est donc gardée,
//  validée et journalisée.
// ══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireStaff } from '@/lib/api-guard'
import { logAudit } from '@/lib/audit-compta'

// Client avec service role key : bypasse RLS pour les opérations admin
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/**
 * Écart maximal toléré sans confirmation explicite.
 * Un taux bouge de quelques pourcents ; un facteur 2 est une faute de
 * frappe ou une attaque. On refuse et on demande `force: true`.
 */
const ECART_MAX = 0.25 // ±25 %

// GET /api/settings/currency : Lire tous les taux depuis la DB
// Public : le front a besoin des taux pour afficher les prix.
export async function GET() {
    try {
        const { data, error } = await supabaseAdmin
            .from('currencies')
            .select('code, name, symbol, exchange_rate_to_base, is_base, updated_at')
            .order('is_base', { ascending: false })

        if (error) {
            console.error('[currency GET] Supabase error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json(data || [])
    } catch (err) {
        console.error('[currency GET] Exception:', err)
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
}

// PUT /api/settings/currency : Mettre à jour les taux
// ADMIN UNIQUEMENT : modifier un taux modifie tous les encaissements.
export async function PUT(request: NextRequest) {
    const garde = await requireStaff(request, 'admin')
    if (!garde.ok) return garde.response!

    try {
        const payload = await request.json()
        // { currencies: [{ code, exchange_rate_to_base }], force?: boolean }
        // Ancien format accepté : un tableau nu.
        const body = Array.isArray(payload) ? payload : payload?.currencies
        const force = !Array.isArray(payload) && payload?.force === true

        if (!Array.isArray(body)) {
            return NextResponse.json({ error: 'Format invalide, tableau attendu' }, { status: 400 })
        }

        // État AVANT : sert à la validation d'écart ET à la trace d'audit
        const { data: avant } = await supabaseAdmin
            .from('currencies')
            .select('code, exchange_rate_to_base, is_base')

        const parCode = new Map(
            (avant || []).map(c => [String(c.code), c])
        )

        const now = new Date().toISOString()
        const errors: string[] = []
        const modifies: Array<{ code: string; ancien: number; nouveau: number }> = []

        for (const item of body) {
            if (!item.code || item.exchange_rate_to_base === undefined) continue

            const code = String(item.code).toUpperCase()
            const actuel = parCode.get(code)

            // Devise de base (XOF) : immuable par définition, son taux vaut 1.
            // On se fie à la BASE, pas au drapeau envoyé par le client.
            if (!actuel) {
                errors.push(`${code}: devise inconnue`)
                continue
            }
            if (actuel.is_base) continue

            const taux = Number(item.exchange_rate_to_base)
            if (!isFinite(taux) || taux <= 0) {
                errors.push(`${code}: taux invalide (${item.exchange_rate_to_base})`)
                continue
            }

            const ancien = Number(actuel.exchange_rate_to_base) || 0
            if (!force && ancien > 0) {
                const ecart = Math.abs(taux - ancien) / ancien
                if (ecart > ECART_MAX) {
                    errors.push(
                        `${code}: écart de ${(ecart * 100).toFixed(0)} % ` +
                        `(${ancien} → ${taux}). Confirmez avec force:true si c'est voulu.`
                    )
                    continue
                }
            }

            const { error } = await supabaseAdmin
                .from('currencies')
                .update({ exchange_rate_to_base: taux, updated_at: now })
                .eq('code', code)

            if (error) {
                console.error(`[currency PUT] Erreur mise à jour ${code}:`, error)
                errors.push(`${code}: ${error.message}`)
            } else {
                modifies.push({ code, ancien, nouveau: taux })
            }
        }

        // Un taux refusé ne doit pas passer inaperçu : on remonte l'erreur
        // même si d'autres devises ont été enregistrées.
        if (errors.length > 0) {
            return NextResponse.json(
                {
                    error: 'Certains taux n’ont pas été appliqués',
                    details: errors,
                    appliques: modifies,
                },
                { status: 400 }
            )
        }

        for (const m of modifies) {
            await logAudit(supabaseAdmin, {
                table: 'currencies',
                recordId: m.code,
                action: 'update',
                acteur: { userId: garde.userId, role: garde.role },
                avant: { exchange_rate_to_base: m.ancien },
                apres: { exchange_rate_to_base: m.nouveau },
            })
        }

        // Relire les taux après sauvegarde pour confirmer
        const { data: updated } = await supabaseAdmin
            .from('currencies')
            .select('code, name, symbol, exchange_rate_to_base, is_base, updated_at')
            .order('is_base', { ascending: false })

        return NextResponse.json({ success: true, currencies: updated || [] })
    } catch (err) {
        console.error('[currency PUT] Exception:', err)
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
}
