import {
  Person, DocumentItem, DossierType,
  RequirementResult, DossierReport, Alert, RelationRole,
} from './types';
import {
  DOSSIER_DEFS, RequirementDef, BIRTH_OR_DEATH_KEYS, ROLE_LABELS,
} from './requirements';
import { isDocExpired, expiryMonthsFor } from './expiry';

/**
 * Un document est-il périmé ? Délègue à la source unique de vérité
 * (lib/genealogy/expiry.ts). Les actes historiques (naissance, décès…)
 * ne périment jamais ; seuls les justificatifs « à fraîcheur » expirent.
 */
function isExpired(doc: DocumentItem): boolean {
  return isDocExpired(doc.doc_type, doc.issued_date);
}

/** Trouve la personne correspondant à un rôle généalogique. */
function findPersonByRole(persons: Person[], role: RelationRole | 'self'): Person | undefined {
  return persons.find(p => (role === 'self' ? p.is_self : p.relation_role === role));
}

/** Documents rattachés à une personne et d'un type donné. */
function docsFor(documents: DocumentItem[], personId: string | undefined, docTypes: string[]): DocumentItem[] {
  if (!personId) return [];
  return documents.filter(d => d.person_id === personId && docTypes.includes(d.doc_type));
}

/**
 * Évalue UNE exigence.
 */
function evaluateRequirement(
  def: RequirementDef,
  persons: Person[],
  documents: DocumentItem[],
): RequirementResult {
  const person = findPersonByRole(persons, def.targetRole);
  const missingPerson = def.targetRole !== 'self' && !person && !def.optional;

  // Dossier 2 : naissance OU décès accepté pour grands-parents
  const acceptedTypes = BIRTH_OR_DEATH_KEYS.includes(def.key)
    ? ['birth_certificate', 'death_certificate']
    : [def.docType];

  const docs = docsFor(documents, person?.id, acceptedTypes);
  const validDocs = docs.filter(d => !(def.validityCheck && isExpired(d)));
  const expiredOnly = docs.length > 0 && validDocs.length === 0 && !!def.validityCheck;

  const fulfilled = validDocs.length > 0;

  let message: string | undefined;
  if (missingPerson) {
    message = `Ajoutez d'abord ${ROLE_LABELS[def.targetRole] ?? 'cette personne'} dans l'arbre.`;
  } else if (expiredOnly) {
    const months = expiryMonthsFor(def.docType) ?? 3;
    message = `Document périmé (doit dater de moins de ${months} mois). À renouveler.`;
  } else if (!fulfilled && !def.optional) {
    const who = def.targetRole === 'self' ? 'vous' : ROLE_LABELS[def.targetRole];
    message = `Manquant : ${def.label} (${who}).`;
  }

  return {
    key: def.key,
    label: def.label,
    docType: def.docType,
    targetRole: def.targetRole,
    required: !def.optional,
    fulfilled,
    expired: expiredOnly,
    missingPerson,
    message,
  };
}

/**
 * Génère le rapport complet d'un dossier.
 */
export function buildDossierReport(
  dossierType: DossierType,
  persons: Person[],
  documents: DocumentItem[],
): DossierReport {
  const defs = DOSSIER_DEFS[dossierType];
  const items = defs.map(def => evaluateRequirement(def, persons, documents));

  const required = items.filter(i => i.required);
  const totalRequired = required.length;
  const totalFulfilled = required.filter(i => i.fulfilled).length;
  const progress = totalRequired === 0 ? 100 : Math.round((totalFulfilled / totalRequired) * 100);

  // Génération des alertes priorisées
  const alerts: Alert[] = [];

  items.filter(i => i.expired).forEach(i => {
    alerts.push({ level: 'warning', message: `⏰ ${i.label} : document périmé, à renouveler.`, relatedRole: i.targetRole });
  });

  items.filter(i => i.missingPerson).forEach(i => {
 alerts.push({ level: 'error', message: `${ROLE_LABELS[i.targetRole] ?? i.label} absent de l'arbre — ajoutez-le pour avancer.`, relatedRole: i.targetRole });
  });

  items.filter(i => i.required && !i.fulfilled && !i.missingPerson && !i.expired).forEach(i => {
 alerts.push({ level: 'error', message: `${i.message}`, relatedRole: i.targetRole });
  });

  if (progress === 100) {
 alerts.unshift({ level: 'success', message: 'Dossier complet ! Vous pouvez générer le PDF final.'});
  }

  return { dossierType, progress, totalRequired, totalFulfilled, items, alerts };
}

/**
 * Construit les 2 rapports d'un coup.
 */
export function buildAllReports(persons: Person[], documents: DocumentItem[]) {
  return {
    afro_descendance: buildDossierReport('afro_descendance', persons, documents),
    ancetre_esclavage: buildDossierReport('ancetre_esclavage', persons, documents),
  };
}

/**
 * Détection d'incohérences dans l'arbre.
 */
export function detectInconsistencies(persons: Person[]): Alert[] {
  const alerts: Alert[] = [];
  const byId = new Map(persons.map(p => [p.id, p]));
  const YEAR = 1000 * 60 * 60 * 24 * 365.25;
  const NINE_MONTHS = 1000 * 60 * 60 * 24 * 274;

  // Aligné sur le trigger SQL fn_check_person_timeline : on contrôle
  // père ET mère, l'écart d'âge plausible et la conception post-mortem.
  const checkParent = (
    p: Person,
    parent: Person | undefined,
    rel: 'père' | 'mère',
  ) => {
    if (!parent || !parent.birth_date || !p.birth_date) return;
    const childTs = new Date(p.birth_date).getTime();
    const parentTs = new Date(parent.birth_date).getTime();
    const name = p.first_name ?? 'Personne';

    // 1. Enfant né avant/le même jour que le parent
    if (childTs <= parentTs) {
 alerts.push({ level: 'warning', message: `${name} serait né(e) avant ou en même temps que ${rel === 'père'? 'son père': 'sa mère'}.`});
      return;
    }
    // 2. Parent trop jeune (< 12 ans) ou trop âgé (> 70 ans) à la naissance
    const ageAtBirth = (childTs - parentTs) / YEAR;
    if (ageAtBirth < 12) {
 alerts.push({ level: 'warning', message: `${rel === 'père'? 'Le père': 'La mère'} de ${name} aurait moins de 12 ans à sa naissance (écart improbable).`});
    } else if (ageAtBirth > 70) {
      alerts.push({ level: 'info', message: `ℹ️ ${rel === 'père' ? 'Le père' : 'La mère'} de ${name} aurait plus de 70 ans à sa naissance — à vérifier.` });
    }
    // 3. Conception après le décès du parent (tolérance 9 mois pour le père)
    if (parent.death_date) {
      const deathTs = new Date(parent.death_date).getTime();
      const limit = rel === 'père' ? deathTs + NINE_MONTHS : deathTs;
      if (childTs > limit) {
 alerts.push({ level: 'warning', message: `${name} serait né(e) après le décès de ${rel === 'père'? 'son père': 'sa mère'}.`});
      }
    }
  };

  for (const p of persons) {
    if (p.birth_date && p.death_date && new Date(p.death_date) < new Date(p.birth_date)) {
 alerts.push({ level: 'warning', message: `${p.first_name ?? 'Personne'} : date de décès antérieure à la naissance.`});
    }
    checkParent(p, byId.get(p.father_id ?? ''), 'père');
    checkParent(p, byId.get(p.mother_id ?? ''), 'mère');
  }
  return alerts;
}

/**
 * Suggestions de recherche selon la profondeur atteinte.
 */
export function buildResearchHints(persons: Person[]): Alert[] {
  const hints: Alert[] = [];
  const oldest = persons
    .filter(p => p.birth_date)
    .sort((a, b) => new Date(a.birth_date!).getTime() - new Date(b.birth_date!).getTime())[0];

  if (oldest?.birth_date) {
    const year = new Date(oldest.birth_date).getFullYear();
    if (year > 1894) {
      // Période coloniale française du Dahomey (1894–1960)
 hints.push({ level: 'info', message: `Votre ancêtre le plus ancien est né en ${year}. Pour remonter avant 1894, consultez les registres de l'état civil colonial du Dahomey (ANOM, Archives Nationales du Bénin à Porto-Novo).`});
    } else {
      // Avant l'établissement colonial : traite atlantique & royaumes (Danxomè)
 hints.push({ level: 'info', message: `Vous atteignez la période précoloniale (${year}). Explorez les registres de la traite atlantique, les archives missionnaires et la mémoire orale des royaumes (Danxomè, Porto-Novo, Allada).`});
    }
  } else {
 hints.push({ level: 'info', message: `Commencez par renseigner les dates de naissance pour activer les pistes d'archives.`});
  }
  return hints;
}
