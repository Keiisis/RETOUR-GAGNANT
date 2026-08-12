import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { parseGedcom, GedcomIndividual } from '@/lib/genealogy/gedcom-parser'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

async function getAuthUserId(req: NextRequest): Promise<string | null> {
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) return null
    const supa = createClient(supabaseUrl, supabaseAnonKey)
    const { data } = await supa.auth.getUser(token)
    return data?.user?.id || null
}

interface ImportResult {
    individuals_imported: number
    relations_set: number
    warnings: string[]
    errors: string[]
    tree_id: string
    gedcom_to_db: Record<string, string>  // mapping @I1@ → uuid DB
}

// POST /api/genealogie/import-gedcom
// Body : { tree_id: string, gedcom: string }
//   - tree_id : arbre cible (doit être éditable par l'utilisateur)
//   - gedcom  : contenu texte du fichier .ged
//
// Étapes :
//   1. Parse le GEDCOM (individus + familles)
//   2. Pour chaque individu : insert dans persons + récupère le uuid DB
//   3. Pour chaque famille : update children avec father_id / mother_id
//   4. Renvoie un récap
export async function POST(request: NextRequest) {
    try {
        const userId = await getAuthUserId(request)
        if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

        const body = await request.json()
        const treeId = String(body.tree_id || '')
        const gedcom = String(body.gedcom || '')

        if (!treeId || !gedcom) {
            return NextResponse.json({ error: 'tree_id et gedcom requis' }, { status: 400 })
        }

        if (gedcom.length > 10 * 1024 * 1024) {
            return NextResponse.json({ error: 'Fichier trop volumineux (max 10 Mo)' }, { status: 413 })
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // Vérifier que l'utilisateur peut écrire dans cet arbre (owner OU editor OU staff)
        const { data: canWrite } = await supabase.rpc('can_write_tree', { p_tree_id: treeId })
        if (!canWrite) {
            return NextResponse.json(
                { error: 'Accès en écriture refusé sur cet arbre' },
                { status: 403 }
            )
        }

        // Parse
        const parsed = parseGedcom(gedcom)
        if (parsed.individuals.size === 0) {
            return NextResponse.json(
                { error: 'Aucun individu trouvé dans le fichier GEDCOM', warnings: parsed.warnings },
                { status: 400 }
            )
        }

        const result: ImportResult = {
            individuals_imported: 0,
            relations_set: 0,
            warnings: [...parsed.warnings],
            errors: [],
            tree_id: treeId,
            gedcom_to_db: {},
        }

        // Étape 1 : insérer tous les individus (sans father_id/mother_id pour l'instant)
        // Bulk insert par batch de 50 pour éviter les timeouts
        const indiArray = Array.from(parsed.individuals.values())
        const BATCH_SIZE = 50

        for (let i = 0; i < indiArray.length; i += BATCH_SIZE) {
            const batch = indiArray.slice(i, i + BATCH_SIZE)
            const rows = batch.map((indi: GedcomIndividual) => ({
                tree_id: treeId,
                first_name: indi.first_name,
                last_name: indi.last_name,
                gender: indi.gender,
                birth_date: indi.birth_date,
                birth_place: indi.birth_place,
                death_date: indi.death_date,
                death_place: indi.death_place,
                notes: indi.notes.length > 0 ? indi.notes.join('\n---\n') : null,
            }))

            const { data: inserted, error: insErr } = await supabase
                .from('persons')
                .insert(rows)
                .select('id')

            if (insErr) {
                result.errors.push(`Batch ${i}-${i + batch.length} : ${insErr.message}`)
                continue
            }

            for (let j = 0; j < batch.length; j++) {
                const dbId = inserted?.[j]?.id
                if (dbId) {
                    result.gedcom_to_db[batch[j].id] = dbId
                    result.individuals_imported++
                }
            }
        }

        // Étape 2 : appliquer les relations parent/enfant depuis les familles
        for (const fam of Array.from(parsed.families.values())) {
            const fatherDbId = fam.husband ? result.gedcom_to_db[fam.husband] : null
            const motherDbId = fam.wife ? result.gedcom_to_db[fam.wife] : null

            for (const childGedcomId of fam.children) {
                const childDbId = result.gedcom_to_db[childGedcomId]
                if (!childDbId) {
                    result.warnings.push(`Enfant ${childGedcomId} introuvable après import : relation famille ${fam.id} ignorée`)
                    continue
                }
                const updates: Record<string, string | null> = {}
                if (fatherDbId) updates.father_id = fatherDbId
                if (motherDbId) updates.mother_id = motherDbId
                if (Object.keys(updates).length === 0) continue

                const { error: updErr } = await supabase
                    .from('persons')
                    .update(updates)
                    .eq('id', childDbId)
                if (updErr) {
                    result.errors.push(`Relation famille ${fam.id} sur enfant ${childGedcomId} : ${updErr.message}`)
                } else {
                    result.relations_set++
                }
            }
        }

        return NextResponse.json(result)
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Erreur serveur' },
            { status: 500 }
        )
    }
}
