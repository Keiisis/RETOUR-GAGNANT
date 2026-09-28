import { SupabaseClient } from '@supabase/supabase-js'

// Helper LOT 3 : vérifie si la période comptable d'une date est clôturée.
// Retourne true si la date tombe dans un mois YYYY-MM présent dans clotures_mensuelles.
// Utilisé par les routes API qui mutent documents_financiers / paiements_manuels / depenses
// pour refuser les modifications sur un mois déjà archivé.

export const dateToPeriode = (isoOrDate: string | Date): string => {
    const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate
    const y = d.getUTCFullYear()
    const m = String(d.getUTCMonth() + 1).padStart(2, '0')
    return `${y}-${m}`
}

export const isPeriodLocked = async (
    supabase: SupabaseClient,
    date: string | Date,
): Promise<boolean> => {
    if (!date) return false
    const periode = dateToPeriode(date)
    // Une période ROUVERTE (status = 'reopened', la ligne est conservée pour
    // l'audit) n'est plus verrouillée. L'ancien test « la ligne existe »
    // laissait la période bloquée après réouverture : constaté le 28/09/2026
    // sur 2026-07 (status reopened) — tout ajout/modification y répondait 423.
    const { data } = await supabase
        .from('clotures_mensuelles')
        .select('id, status')
        .eq('periode', periode)
        .maybeSingle()
    return !!data && (data as { status?: string | null }).status !== 'reopened'
}
