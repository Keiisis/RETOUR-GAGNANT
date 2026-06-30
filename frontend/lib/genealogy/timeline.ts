import { Person } from './types';

export interface FamilyEvent {
  id: string;
  person: Person;
  type: 'birth' | 'death';
  date: string;
  year: number;
  place: string | null;
  ageAtEvent: number | null;
}

export interface Anniversary {
  person: Person;
  type: 'birth' | 'death';
  date: string;
  daysRemaining: number;
  yearsAgo: number;
}

/**
 * Build a chronological list of family events (births and deaths).
 */
export function buildFamilyTimeline(persons: Person[]): FamilyEvent[] {
  const events: FamilyEvent[] = [];

  for (const person of persons) {
    if (person.birth_date) {
      const year = new Date(person.birth_date).getFullYear();
      events.push({
        id: `${person.id}-birth`,
        person,
        type: 'birth',
        date: person.birth_date,
        year,
        place: person.birth_place,
        ageAtEvent: null,
      });
    }

    if (person.death_date) {
      const year = new Date(person.death_date).getFullYear();
      let ageAtDeath: number | null = null;
      if (person.birth_date) {
        const birthTime = new Date(person.birth_date).getTime();
        const deathTime = new Date(person.death_date).getTime();
        ageAtDeath = Math.floor((deathTime - birthTime) / (365.25 * 24 * 60 * 60 * 1000));
        if (ageAtDeath < 0) ageAtDeath = 0;
      }
      events.push({
        id: `${person.id}-death`,
        person,
        type: 'death',
        date: person.death_date,
        year,
        place: person.death_place,
        ageAtEvent: ageAtDeath,
      });
    }
  }

  // Sort chronologically (earliest to latest)
  return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

/**
 * Get upcoming anniversaries in the family tree.
 */
export function getUpcomingAnniversaries(persons: Person[]): Anniversary[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const anniversaries: Anniversary[] = [];

  for (const person of persons) {
    const dates = [
      { type: 'birth' as const, dateStr: person.birth_date },
      { type: 'death' as const, dateStr: person.death_date },
    ];

    for (const { type, dateStr } of dates) {
      if (!dateStr) continue;

      const dateObj = new Date(dateStr);
      const eventMonth = dateObj.getMonth();
      const eventDate = dateObj.getDate();

      // Calculate next occurrence date
      const nextAnniv = new Date(today.getFullYear(), eventMonth, eventDate);
      if (nextAnniv < today) {
        nextAnniv.setFullYear(today.getFullYear() + 1);
      }

      const diffTime = nextAnniv.getTime() - today.getTime();
      const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) % 365;
      const yearsAgo = nextAnniv.getFullYear() - dateObj.getFullYear();

      anniversaries.push({
        person,
        type,
        date: dateStr,
        daysRemaining: daysRemaining === 0 && nextAnniv.getTime() === today.getTime() ? 0 : daysRemaining || 365,
        yearsAgo,
      });
    }
  }

  // Sort by closest (daysRemaining ascending)
  return anniversaries.sort((a, b) => a.daysRemaining - b.daysRemaining);
}
