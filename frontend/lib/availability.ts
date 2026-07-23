// ══════════════════════════════════════════════════════════════
//  MOTEUR DE CRÉNEAUX
//  Les créneaux ne sont JAMAIS stockés : ils sont calculés à la
//  demande à partir des plages récurrentes, moins les fermetures
//  ponctuelles, moins les rendez-vous déjà pris (dans la limite de
//  la capacité). Modifier les horaires n'invalide donc jamais de
//  données existantes.
// ══════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js'

export interface Slot {
    /** « HH:MM » */
    heure: string
    restant: number
}
export interface DaySlots {
    /** « YYYY-MM-DD » */
    date: string
    /** true si le jour est totalement fermé */
    ferme: boolean
    motif?: string
    slots: Slot[]
}

interface Rule {
    weekday: number; start_time: string; end_time: string
    slot_minutes: number; service: string | null; capacity: number
}
interface Exception {
    date: string; kind: 'closed' | 'open'
    start_time: string | null; end_time: string | null
    slot_minutes: number | null; service: string | null
    capacity: number | null; reason: string | null
}

const toMin = (t: string) => {
    const [h, m] = String(t).slice(0, 5).split(':').map(Number)
    return (h || 0) * 60 + (m || 0)
}
const toHHMM = (m: number) =>
    `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

/** « YYYY-MM-DD » → jour de semaine JS (0 = dimanche), sans dérive de fuseau. */
function weekdayOf(dateISO: string): number {
    const [y, m, d] = dateISO.split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

function matchService(ruleService: string | null, asked?: string | null): boolean {
    if (!ruleService) return true          // règle « tous services »
    if (!asked) return true                // demande non typée : on accepte
    return ruleService === asked
}

/**
 * Calcule les créneaux libres pour une plage de dates.
 * @param from « YYYY-MM-DD » inclus
 * @param days nombre de jours à couvrir
 */
export async function computeAvailability(
    supabase: SupabaseClient,
    opts: { from: string; days?: number; service?: string | null; minLeadMinutes?: number },
): Promise<DaySlots[]> {
    const days = Math.min(Math.max(opts.days ?? 14, 1), 90)
    const service = opts.service || null
    // Délai minimum avant un rendez-vous (par défaut 2 h)
    const lead = opts.minLeadMinutes ?? 120

    // Bornes de la plage
    const [fy, fm, fd] = opts.from.split('-').map(Number)
    const start = new Date(Date.UTC(fy, fm - 1, fd))
    const dates: string[] = []
    for (let i = 0; i < days; i++) {
        const d = new Date(start.getTime() + i * 86_400_000)
        dates.push(d.toISOString().slice(0, 10))
    }
    const lastDate = dates[dates.length - 1]

    // Chargement en 3 requêtes (aucune boucle de requêtes)
    const [rulesRes, excRes, rdvRes] = await Promise.all([
        supabase.from('availability_rules')
            .select('weekday, start_time, end_time, slot_minutes, service, capacity')
            .eq('is_active', true),
        supabase.from('availability_exceptions')
            .select('date, kind, start_time, end_time, slot_minutes, service, capacity, reason')
            .gte('date', opts.from).lte('date', lastDate),
        supabase.from('rdv_requests')
            .select('date, heure, statut')
            .gte('date', opts.from).lte('date', lastDate),
    ])

    // Tables absentes (migration non appliquée) → aucun créneau, pas d'erreur
    if (rulesRes.error) return dates.map(date => ({ date, ferme: true, motif: 'Horaires non configurés', slots: [] }))

    const rules = (rulesRes.data || []) as Rule[]
    const exceptions = (excRes.data || []) as Exception[]

    // Occupation : « YYYY-MM-DD HH:MM » → nombre de RDV retenus
    const pris: Record<string, number> = {}
    for (const r of rdvRes.data || []) {
        if (r.statut === 'annule' || r.statut === 'refuse') continue
        const key = `${r.date} ${String(r.heure || '').slice(0, 5)}`
        pris[key] = (pris[key] || 0) + 1
    }

    const maintenant = Date.now()

    return dates.map(date => {
        const excJour = exceptions.filter(e => e.date === date && matchService(e.service, service))

        // Fermeture sur la journée entière
        const fermetureTotale = excJour.find(e => e.kind === 'closed' && !e.start_time)
        if (fermetureTotale) {
            return { date, ferme: true, motif: fermetureTotale.reason || 'Fermé', slots: [] }
        }

        // Plages du jour : règles récurrentes + ouvertures exceptionnelles
        const wd = weekdayOf(date)
        const plages: Array<{ from: number; to: number; step: number; cap: number }> = []
        for (const r of rules) {
            if (r.weekday !== wd || !matchService(r.service, service)) continue
            plages.push({ from: toMin(r.start_time), to: toMin(r.end_time), step: r.slot_minutes || 30, cap: r.capacity || 1 })
        }
        for (const e of excJour) {
            if (e.kind !== 'open' || !e.start_time || !e.end_time) continue
            plages.push({ from: toMin(e.start_time), to: toMin(e.end_time), step: e.slot_minutes || 30, cap: e.capacity || 1 })
        }
        if (plages.length === 0) return { date, ferme: true, motif: 'Fermé', slots: [] }

        // Fermetures partielles à retrancher
        const coupures = excJour
            .filter(e => e.kind === 'closed' && e.start_time && e.end_time)
            .map(e => ({ from: toMin(e.start_time!), to: toMin(e.end_time!) }))

        const parHeure: Record<string, number> = {}
        for (const p of plages) {
            for (let m = p.from; m + p.step <= p.to; m += p.step) {
                const fin = m + p.step
                if (coupures.some(c => m < c.to && fin > c.from)) continue   // chevauchement
                const hh = toHHMM(m)
                // Délai minimum : on masque les créneaux trop proches
                const ts = Date.parse(`${date}T${hh}:00Z`)
                if (isFinite(ts) && ts - maintenant < lead * 60_000) continue
                parHeure[hh] = Math.max(parHeure[hh] || 0, p.cap)
            }
        }

        const slots = Object.keys(parHeure).sort().map(hh => ({
            heure: hh,
            restant: Math.max(0, parHeure[hh] - (pris[`${date} ${hh}`] || 0)),
        })).filter(s => s.restant > 0)

        return { date, ferme: slots.length === 0, slots }
    })
}

/** Vérifie qu'un créneau précis est encore réservable (anti-conflit). */
export async function isSlotBookable(
    supabase: SupabaseClient,
    date: string,
    heure: string,
    service?: string | null,
): Promise<{ ok: boolean; reason?: string }> {
    const hh = String(heure || '').slice(0, 5)
    const jours = await computeAvailability(supabase, { from: date, days: 1, service })
    const jour = jours[0]
    if (!jour || jour.ferme) return { ok: false, reason: jour?.motif || 'Jour fermé' }
    const slot = jour.slots.find(s => s.heure === hh)
    if (!slot) return { ok: false, reason: 'Créneau hors des horaires d’ouverture' }
    if (slot.restant <= 0) return { ok: false, reason: 'Créneau complet' }
    return { ok: true }
}
