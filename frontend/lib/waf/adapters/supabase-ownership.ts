// ══════════════════════════════════════════════════════════════
// 🔌  @waf-adapters/supabase-ownership — Resolver Supabase
// ══════════════════════════════════════════════════════════════
//
// COUCHE JETABLE/REMPLAÇABLE. C'est le SEUL fichier de la pile
// ownership qui connaît Supabase. Pour porter le WAF ailleurs :
//   - WordPress → écrire `wordpress-ownership.ts` (requête wpdb)
//   - PHP/PDO   → écrire `pdo-ownership.ts`
//   - Prisma    → écrire `prisma-ownership.ts`
// Le core (`core/ownership.ts`) ne change jamais.
//
// Principe : on déclare une CARTE `resourceType → {table, idColumn,
// ownerColumn}`. Le resolver fait un SELECT ciblé et renvoie l'owner.
// On interroge les VRAIES tables (pas une copie parallèle "shadow"
// qui dériverait) — c'est la critique #5b de l'audit corrigée.
// ══════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
    OwnershipResolver,
    OwnershipResolution,
} from '../core/ownership'

export interface ResourceMapEntry {
    /** Table Postgres réelle. */
    table: string
    /** Colonne identifiant de la ressource (défaut: 'id'). */
    idColumn?: string
    /** Colonne portant l'owner (ex: 'user_id', 'client_id'). */
    ownerColumn: string
    /**
     * Resolver d'owner indirect : certaines ressources n'ont pas
     * d'owner direct (ex: une ligne dont l'owner se déduit d'une
     * table parente). Fournir une requête custom dans ce cas.
     */
    indirect?: (supabase: SupabaseClient, resourceId: string) => Promise<string | null>
}

export type ResourceMap = Record<string, ResourceMapEntry>

/**
 * Carte par défaut pour Retour Gagnant. À ADAPTER par projet.
 * (Quand on extrait le WAF, cette carte est remplacée par celle
 *  du projet hôte — WordPress, autre SaaS, etc.)
 */
export const RGB_RESOURCE_MAP: ResourceMap = {
    invoice:        { table: 'invoices',           ownerColumn: 'client_id' },
    dossier:        { table: 'dossiers',           ownerColumn: 'client_id' },
    order:          { table: 'orders',             ownerColumn: 'client_id' },
    payment:        { table: 'paiements',          ownerColumn: 'client_id' },
    client_profile: { table: 'client_profiles',    ownerColumn: 'id' },
    // Généalogie : l'owner est l'owner de l'arbre (indirection)
    genealogy_person: {
        table: 'persons', ownerColumn: 'user_id',
        indirect: async (supabase, resourceId) => {
            const { data } = await supabase
                .from('persons')
                .select('tree_id, trees!inner(user_id)')
                .eq('id', resourceId)
                .maybeSingle()
            // @ts-expect-error jointure dynamique
            return data?.trees?.user_id ?? null
        },
    },
}

/**
 * Crée un resolver Supabase à partir d'une carte de ressources.
 * Le client Supabase doit être en SERVICE ROLE (bypass RLS) car on
 * vérifie nous-mêmes l'autorisation — c'est le but du WAF.
 */
export function createSupabaseOwnershipResolver(
    supabase: SupabaseClient,
    resourceMap: ResourceMap = RGB_RESOURCE_MAP
): OwnershipResolver {
    return async ({ resourceType, resourceId }): Promise<OwnershipResolution> => {
        const entry = resourceMap[resourceType]

        // Type de ressource non mappé → on ne peut pas statuer.
        // notFound=true → le core appliquera la missingPolicy (deny par défaut).
        if (!entry) {
            return { ownerId: null, notFound: true }
        }

        // Indirection custom
        if (entry.indirect) {
            const ownerId = await entry.indirect(supabase, resourceId)
            return { ownerId, notFound: ownerId === null }
        }

        const idCol = entry.idColumn || 'id'
        const { data, error } = await supabase
            .from(entry.table)
            .select(entry.ownerColumn)
            .eq(idCol, resourceId)
            .maybeSingle()

        if (error || !data) {
            return { ownerId: null, notFound: true }
        }

        const ownerId = (data as unknown as Record<string, unknown>)[entry.ownerColumn]
        return {
            ownerId: typeof ownerId === 'string' ? ownerId : null,
            notFound: ownerId == null,
        }
    }
}
