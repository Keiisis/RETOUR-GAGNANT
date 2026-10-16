import { describe, it, expect } from 'vitest'
import { construireSuivi, lireAvancement, statutPourAvancement, suiviNationalite, suiviEnAvance } from '@/lib/suivi-nationalite'

// Incident 2026-10-16 (RG-NAT-2026-8250) : dossier « En traitement », suivi figé sur « Réception », 14 %.
const creation = [
    { id: 1, label: 'Réception du dossier', status: 'completed', date: '2026-09-16', note: 'Soumission en ligne' },
    ...[2, 3, 4, 5, 6, 7].map(id => ({ id, label: `étape ${id}`, status: 'pending', date: null, note: '' })),
]
const jour = new Date('2026-10-16T10:00:00Z')

describe('suivi dérivé du statut de la demande', () => {
    it('en traitement : réception et vérification faites, conformité en cours', () => {
        const s = suiviNationalite('en_traitement', creation, jour)
        expect(s.statut).toBe('traitement')
        expect(s.etapes.map(e => e.status)).toEqual(['completed', 'completed', 'in_progress', 'pending', 'pending', 'pending', 'pending'])
        expect(s.progression).toBe(29)
        // La réception garde sa date et sa note d'origine.
        expect(s.etapes[0]).toMatchObject({ date: '2026-09-16', note: 'Soumission en ligne' })
        expect(s.etapes[1].date).toBe('2026-10-16')
    })

    it('soumis : seule la réception est faite', () => {
        const s = suiviNationalite('soumis', creation, jour)
        expect(s.statut).toBe('reception')
        expect(s.progression).toBe(14)
    })

    it('approuvé : délivrance du certificat en cours', () => {
        const s = suiviNationalite('approuve', creation, jour)
        expect(s.statut).toBe('finalisation')
        expect(s.etapes[6].status).toBe('in_progress')
        expect(s.etapes[5].note).toBe('Demande approuvée.')
    })

    it('rejeté : pas d’étape de délivrance, suivi clos', () => {
        const s = suiviNationalite('rejete', creation, jour)
        expect(s.etapes).toHaveLength(6)
        expect(s.etapes.every(e => e.status === 'completed')).toBe(true)
        expect(s).toMatchObject({ statut: 'termine', progression: 100 })
    })

    it('retour en arrière : les étapes repassent en attente', () => {
        const approuve = suiviNationalite('approuve', creation, jour).etapes
        const s = suiviNationalite('en_traitement', approuve, jour)
        expect(s.etapes[4]).toMatchObject({ status: 'pending', date: null })
    })

    it('webhook à une seule étape : le parcours complet est rétabli', () => {
        expect(suiviNationalite('en_traitement', [creation[0]], jour).etapes).toHaveLength(7)
    })

    it('étapes cochées à la main au-delà du statut : signalées', () => {
        const manuel = creation.map(e => e.id <= 4 ? { ...e, status: 'completed' } : e)
        expect(suiviEnAvance('en_traitement', manuel)).toBe(true)
        expect(suiviEnAvance('en_traitement', creation)).toBe(false)
    })

    it('panneau : étape exacte, statut déduit', () => {
        const s = construireSuivi({ faites: 4, enCours: true }, creation, { maintenant: jour })
        expect(s.etapes.map(e => e.status)).toEqual(['completed', 'completed', 'completed', 'completed', 'in_progress', 'pending', 'pending'])
        expect(statutPourAvancement(4)).toBe('verification')
        expect([1, 2, 3, 5, 6, 7].map(statutPourAvancement)).toEqual(['soumis', 'en_traitement', 'verification', 'verification', 'approuve', 'approuve'])
        expect(construireSuivi({ faites: 7, enCours: false }, creation).statut).toBe('termine')
    })

    it('statut choisi qui contient déjà l’étape : le suivi ne recule pas', () => {
        const commission = construireSuivi({ faites: 4, enCours: true }, creation, { maintenant: jour }).etapes
        expect(lireAvancement(suiviNationalite('verification', commission, jour).etapes)).toEqual({ faites: 4, enCours: true })
        expect(lireAvancement(suiviNationalite('en_traitement', commission, jour).etapes).faites).toBe(2)
    })

    it('note de l’équipe conservée quand l’étape se termine', () => {
        const enCours = construireSuivi({ faites: 2, enCours: true }, creation, { notes: { 3: 'Dossier transmis au juriste.' }, maintenant: jour }).etapes
        const fini = construireSuivi({ faites: 3, enCours: true }, enCours, { maintenant: jour }).etapes
        expect(fini[2]).toMatchObject({ status: 'completed', note: 'Dossier transmis au juriste.' })
        expect(fini[1].note).toBe('Pièces justificatives vérifiées.')
    })
})
