// ══════════════════════════════════════════════════════════════
//  TESTS — MOTEUR DE CRÉNEAUX
//  Le calcul des disponibilités décide si un client peut réserver.
//  Une erreur ici = double réservation ou créneau fantôme.
// ══════════════════════════════════════════════════════════════

import { describe, it, expect, vi } from 'vitest'
import { computeAvailability, isSlotBookable } from '@/lib/availability'

type Row = Record<string, unknown>

/** Doublure Supabase : renvoie des jeux de données figés par table. */
function fakeDb(data: { rules?: Row[]; exceptions?: Row[]; rdv?: Row[]; failRules?: boolean }) {
    const build = (rows: Row[], fail = false) => {
        const q: Record<string, unknown> = {}
        const self = () => q
        q.select = self; q.eq = self; q.gte = self; q.lte = self; q.order = self
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(q as any).then = (resolve: (v: unknown) => void) =>
            resolve(fail ? { data: null, error: { message: 'relation absente' } } : { data: rows, error: null })
        return q
    }
    return {
        from: (table: string) => {
            if (table === 'availability_rules') return build(data.rules || [], data.failRules)
            if (table === 'availability_exceptions') return build(data.exceptions || [])
            return build(data.rdv || [])
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any
}

// Lundi 2026-08-03 (vérifié : getUTCDay() === 1)
const LUNDI = '2026-08-03'
const OUVERT_9_12 = [{ weekday: 1, start_time: '09:00', end_time: '12:00', slot_minutes: 60, service: null, capacity: 1 }]

// Le moteur masque les créneaux trop proches : on neutralise ce filtre
// en se plaçant loin dans le passé côté horloge.
const SANS_DELAI = { minLeadMinutes: 0 }

describe('Calcul des créneaux', () => {
    it('découpe la plage d’ouverture selon la durée de créneau', async () => {
        const db = fakeDb({ rules: OUVERT_9_12 })
        const [jour] = await computeAvailability(db, { from: LUNDI, days: 1, ...SANS_DELAI })
        expect(jour.ferme).toBe(false)
        expect(jour.slots.map(s => s.heure)).toEqual(['09:00', '10:00', '11:00'])
    })

    it('n’ouvre pas un jour sans règle correspondante', async () => {
        const db = fakeDb({ rules: [{ weekday: 3, start_time: '09:00', end_time: '12:00', slot_minutes: 60, service: null, capacity: 1 }] })
        const [jour] = await computeAvailability(db, { from: LUNDI, days: 1, ...SANS_DELAI })
        expect(jour.ferme).toBe(true)
        expect(jour.slots).toHaveLength(0)
    })

    it('retire un créneau déjà réservé (capacité 1)', async () => {
        const db = fakeDb({ rules: OUVERT_9_12, rdv: [{ date: LUNDI, heure: '10:00', statut: 'confirme' }] })
        const [jour] = await computeAvailability(db, { from: LUNDI, days: 1, ...SANS_DELAI })
        expect(jour.slots.map(s => s.heure)).toEqual(['09:00', '11:00'])
    })

    it('libère le créneau si le rendez-vous est annulé', async () => {
        const db = fakeDb({ rules: OUVERT_9_12, rdv: [{ date: LUNDI, heure: '10:00', statut: 'annule' }] })
        const [jour] = await computeAvailability(db, { from: LUNDI, days: 1, ...SANS_DELAI })
        expect(jour.slots.map(s => s.heure)).toContain('10:00')
    })

    it('respecte une capacité supérieure à 1', async () => {
        const db = fakeDb({
            rules: [{ weekday: 1, start_time: '09:00', end_time: '10:00', slot_minutes: 60, service: null, capacity: 3 }],
            rdv: [{ date: LUNDI, heure: '09:00', statut: 'confirme' }, { date: LUNDI, heure: '09:00', statut: 'confirme' }],
        })
        const [jour] = await computeAvailability(db, { from: LUNDI, days: 1, ...SANS_DELAI })
        expect(jour.slots[0]).toEqual({ heure: '09:00', restant: 1 })
    })

    it('ferme la journée entière sur exception sans horaire', async () => {
        const db = fakeDb({
            rules: OUVERT_9_12,
            exceptions: [{ date: LUNDI, kind: 'closed', start_time: null, end_time: null, service: null, reason: 'Jour férié' }],
        })
        const [jour] = await computeAvailability(db, { from: LUNDI, days: 1, ...SANS_DELAI })
        expect(jour.ferme).toBe(true)
        expect(jour.motif).toBe('Jour férié')
    })

    it('retire uniquement la plage d’une fermeture partielle', async () => {
        const db = fakeDb({
            rules: OUVERT_9_12,
            exceptions: [{ date: LUNDI, kind: 'closed', start_time: '10:00', end_time: '11:00', service: null, reason: null }],
        })
        const [jour] = await computeAvailability(db, { from: LUNDI, days: 1, ...SANS_DELAI })
        expect(jour.slots.map(s => s.heure)).toEqual(['09:00', '11:00'])
    })

    it('ouvre exceptionnellement un jour normalement fermé', async () => {
        const db = fakeDb({
            rules: [],
            exceptions: [{ date: LUNDI, kind: 'open', start_time: '14:00', end_time: '16:00', slot_minutes: 60, service: null, capacity: 1, reason: null }],
        })
        const [jour] = await computeAvailability(db, { from: LUNDI, days: 1, ...SANS_DELAI })
        expect(jour.ferme).toBe(false)
        expect(jour.slots.map(s => s.heure)).toEqual(['14:00', '15:00'])
    })

    it('ignore une règle destinée à un autre service', async () => {
        const db = fakeDb({ rules: [{ ...OUVERT_9_12[0], service: 'fa' }] })
        const [jour] = await computeAvailability(db, { from: LUNDI, days: 1, service: 'nationalite', ...SANS_DELAI })
        expect(jour.ferme).toBe(true)
    })

    it('masque les créneaux trop proches (délai minimum)', async () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date(`${LUNDI}T09:30:00Z`))
        const db = fakeDb({ rules: OUVERT_9_12 })
        const [jour] = await computeAvailability(db, { from: LUNDI, days: 1, minLeadMinutes: 120 })
        // 10:00 et 11:00 sont à moins de 2 h → seul rien ne reste
        expect(jour.slots.map(s => s.heure)).toEqual([])
        vi.useRealTimers()
    })

    it('ne casse pas si les tables n’existent pas encore', async () => {
        const db = fakeDb({ failRules: true })
        const [jour] = await computeAvailability(db, { from: LUNDI, days: 1 })
        expect(jour.ferme).toBe(true)
        expect(jour.motif).toBe('Horaires non configurés')
    })

    it('couvre bien le nombre de jours demandé', async () => {
        const db = fakeDb({ rules: OUVERT_9_12 })
        const jours = await computeAvailability(db, { from: LUNDI, days: 7, ...SANS_DELAI })
        expect(jours).toHaveLength(7)
        expect(jours[0].date).toBe(LUNDI)
    })
})

describe('Contrôle anti-conflit à la réservation', () => {
    it('accepte un créneau ouvert et libre', async () => {
        const db = fakeDb({ rules: OUVERT_9_12 })
        expect(await isSlotBookable(db, LUNDI, '09:00')).toEqual({ ok: true })
    })

    it('refuse un créneau hors horaires', async () => {
        const db = fakeDb({ rules: OUVERT_9_12 })
        const r = await isSlotBookable(db, LUNDI, '18:00')
        expect(r.ok).toBe(false)
    })

    it('refuse un créneau déjà pris', async () => {
        const db = fakeDb({ rules: OUVERT_9_12, rdv: [{ date: LUNDI, heure: '09:00', statut: 'confirme' }] })
        const r = await isSlotBookable(db, LUNDI, '09:00')
        expect(r.ok).toBe(false)
    })

    it('refuse un jour fermé', async () => {
        const db = fakeDb({
            rules: OUVERT_9_12,
            exceptions: [{ date: LUNDI, kind: 'closed', start_time: null, end_time: null, service: null, reason: 'Congés' }],
        })
        const r = await isSlotBookable(db, LUNDI, '09:00')
        expect(r).toEqual({ ok: false, reason: 'Congés' })
    })
})
