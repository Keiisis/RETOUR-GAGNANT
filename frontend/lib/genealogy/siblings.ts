import { Person } from './types';

export interface SiblingGroup {
  personId: string;
  fullSiblings: Person[];    // Same father AND mother
  halfSiblings: Person[];    // Same father OR mother (but not both)
}

/**
 * Detect siblings for a given person based on shared parents.
 */
export function findSiblings(person: Person, allPersons: Person[]): SiblingGroup {
  const fullSiblings: Person[] = [];
  const halfSiblings: Person[] = [];

  for (const other of allPersons) {
    if (other.id === person.id) continue;

    const sharedFather = person.father_id && other.father_id && person.father_id === other.father_id;
    const sharedMother = person.mother_id && other.mother_id && person.mother_id === other.mother_id;

    if (sharedFather && sharedMother) {
      fullSiblings.push(other);
    } else if (sharedFather || sharedMother) {
      halfSiblings.push(other);
    }
  }

  return { personId: person.id, fullSiblings, halfSiblings };
}

/**
 * Get all sibling groups across the tree.
 */
export function findAllSiblingGroups(persons: Person[]): SiblingGroup[] {
  return persons
    .filter(p => p.father_id || p.mother_id)
    .map(p => findSiblings(p, persons))
    .filter(g => g.fullSiblings.length > 0 || g.halfSiblings.length > 0);
}

/**
 * Find children of a given person.
 */
export function findChildren(person: Person, allPersons: Person[]): Person[] {
  return allPersons.filter(p => p.father_id === person.id || p.mother_id === person.id);
}

/**
 * Build a family statistics summary for the tree.
 */
export function buildTreeStats(persons: Person[]) {
  const total = persons.length;
  const males = persons.filter(p => p.gender === 'male').length;
  const females = persons.filter(p => p.gender === 'female').length;
  const withBirth = persons.filter(p => p.birth_date).length;
  const withDeath = persons.filter(p => p.death_date).length;
  const withPlace = persons.filter(p => p.birth_place || p.death_place).length;
  
  // Generations: count by role depth
  const generations = new Set<number>();
  for (const p of persons) {
    if (p.is_self || p.relation_role === 'self') generations.add(0);
    else if (p.relation_role === 'father' || p.relation_role === 'mother') generations.add(1);
    else if (p.relation_role === 'child') generations.add(-1);
    else if (p.relation_role?.includes('grandfather') || p.relation_role?.includes('grandmother')) generations.add(2);
    else if (p.relation_role?.startsWith('paternal_gg') || p.relation_role?.startsWith('maternal_gg')) generations.add(3);
    else if (p.relation_role?.includes('uncle') || p.relation_role?.includes('aunt')) generations.add(1);
    else if (p.relation_role === 'brother' || p.relation_role === 'sister' || p.relation_role === 'sibling') generations.add(0);
  }

  // Oldest/youngest
  const withBirthDates = persons.filter(p => p.birth_date).sort((a, b) => 
    new Date(a.birth_date!).getTime() - new Date(b.birth_date!).getTime()
  );
  const oldest = withBirthDates[0] || null;
  const youngest = withBirthDates[withBirthDates.length - 1] || null;

  // Places distribution
  const places = new Map<string, number>();
  for (const p of persons) {
    if (p.birth_place) places.set(p.birth_place, (places.get(p.birth_place) || 0) + 1);
    if (p.death_place) places.set(p.death_place, (places.get(p.death_place) || 0) + 1);
  }
  const topPlaces = [...places.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([place, count]) => ({ place, count }));

  return {
    total,
    males,
    females,
    withBirth,
    withDeath,
    withPlace,
    generationCount: generations.size,
    oldest,
    youngest,
    topPlaces,
  };
}
