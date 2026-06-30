export interface ResearchResource {
  name: string;
  description: string;
  url: string;
  category: 'archives' | 'database' | 'association';
}

export const RESEARCH_RESOURCES: ResearchResource[] = [
  { name: 'ANOM — Archives nationales d\'outre-mer', description: 'État civil colonial, registres d\'individualité de 1848.', url: 'http://anom.archivesnationales.culture.gouv.fr', category: 'archives' },
  { name: 'Registres des nouveaux libres (1848)', description: 'Actes attribuant un patronyme aux personnes affranchies.', url: 'http://anom.archivesnationales.culture.gouv.fr', category: 'archives' },
  { name: 'Anchoukaj', description: 'Base de données généalogique des Antilles.', url: 'https://www.anchoukaj.org', category: 'database' },
  { name: 'Geneanet', description: 'Base collaborative mondiale.', url: 'https://www.geneanet.org', category: 'database' },
  { name: 'FamilySearch', description: 'Base mondiale gratuite (LDS).', url: 'https://www.familysearch.org', category: 'database' },
  { name: 'CM98', description: 'Comité Marche du 23 mai 1998 — accompagnement mémoriel.', url: 'https://www.cm98.fr', category: 'association' },
];
