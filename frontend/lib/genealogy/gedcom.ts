import { Person, Tree } from './types';

/**
 * Export an entire tree to GEDCOM 5.5.1 format.
 * GEDCOM is the standard interchange format for genealogical data.
 */
export function exportToGedcom(tree: Tree, persons: Person[]): string {
  const lines: string[] = [];
  const now = new Date();
  const dateStr = `${now.getDate()} ${['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][now.getMonth()]} ${now.getFullYear()}`;

  // === HEADER ===
  lines.push('0 HEAD');
  lines.push('1 SOUR RETOUR_GAGNANT');
  lines.push('2 VERS 1.0');
  lines.push('2 NAME Retour Gagnant Bénin');
  lines.push('1 DEST GEDCOM');
  lines.push(`1 DATE ${dateStr}`);
  lines.push('1 SUBM @SUBM1@');
  lines.push('1 GEDC');
  lines.push('2 VERS 5.5.1');
  lines.push('2 FORM LINEAGE-LINKED');
  lines.push('1 CHAR UTF-8');

  // === SUBMITTER ===
  lines.push('0 @SUBM1@ SUBM');
  lines.push(`1 NAME Retour Gagnant Bénin`);

  // === INDIVIDUAL RECORDS ===
  // Build a map of person.id -> GEDCOM INDI xref
  const indiMap = new Map<string, string>();
  persons.forEach((p, i) => {
    indiMap.set(p.id, `@I${i + 1}@`);
  });

  // Detect family groups (couples with children)
  interface FamilyGroup {
    fatherId: string | null;
    motherId: string | null;
    childIds: string[];
  }
  const familyGroups: FamilyGroup[] = [];
  const familyKey = (fId: string | null, mId: string | null) => `${fId || 'X'}-${mId || 'X'}`;
  const familyMap = new Map<string, number>();

  for (const p of persons) {
    if (p.father_id || p.mother_id) {
      const key = familyKey(p.father_id, p.mother_id);
      if (familyMap.has(key)) {
        familyGroups[familyMap.get(key)!].childIds.push(p.id);
      } else {
        const idx = familyGroups.length;
        familyMap.set(key, idx);
        familyGroups.push({
          fatherId: p.father_id,
          motherId: p.mother_id,
          childIds: [p.id],
        });
      }
    }
  }

  // Build family xref map
  const famXrefMap = new Map<number, string>();
  familyGroups.forEach((_, i) => {
    famXrefMap.set(i, `@F${i + 1}@`);
  });

  // Write INDI records
  for (const p of persons) {
    const xref = indiMap.get(p.id)!;
    lines.push(`0 ${xref} INDI`);

    // Name
    const firstName = p.first_name || '';
    const lastName = p.last_name || '';
    if (firstName || lastName) {
      lines.push(`1 NAME ${firstName} /${lastName}/`);
      if (firstName) lines.push(`2 GIVN ${firstName}`);
      if (lastName) lines.push(`2 SURN ${lastName}`);
    }

    // Sex
    if (p.gender === 'male') lines.push('1 SEX M');
    else if (p.gender === 'female') lines.push('1 SEX F');

    // Birth
    if (p.birth_date || p.birth_place) {
      lines.push('1 BIRT');
      if (p.birth_date) lines.push(`2 DATE ${formatGedcomDate(p.birth_date)}`);
      if (p.birth_place) lines.push(`2 PLAC ${p.birth_place}`);
    }

    // Death
    if (p.death_date || p.death_place) {
      lines.push('1 DEAT');
      if (p.death_date) lines.push(`2 DATE ${formatGedcomDate(p.death_date)}`);
      if (p.death_place) lines.push(`2 PLAC ${p.death_place}`);
    }

    // Notes
    if (p.notes) {
      lines.push(`1 NOTE ${p.notes.replace(/\n/g, ' ')}`);
    }

    // Family as child (FAMC)
    for (const [idx, fg] of familyGroups.entries()) {
      if (fg.childIds.includes(p.id)) {
        lines.push(`1 FAMC ${famXrefMap.get(idx)}`);
      }
    }

    // Family as spouse (FAMS)
    for (const [idx, fg] of familyGroups.entries()) {
      if (fg.fatherId === p.id || fg.motherId === p.id) {
        lines.push(`1 FAMS ${famXrefMap.get(idx)}`);
      }
    }
  }

  // === FAMILY RECORDS ===
  for (const [idx, fg] of familyGroups.entries()) {
    const xref = famXrefMap.get(idx)!;
    lines.push(`0 ${xref} FAM`);
    if (fg.fatherId && indiMap.has(fg.fatherId)) {
      lines.push(`1 HUSB ${indiMap.get(fg.fatherId)}`);
    }
    if (fg.motherId && indiMap.has(fg.motherId)) {
      lines.push(`1 WIFE ${indiMap.get(fg.motherId)}`);
    }
    for (const childId of fg.childIds) {
      if (indiMap.has(childId)) {
        lines.push(`1 CHIL ${indiMap.get(childId)}`);
      }
    }
  }

  // === TRAILER ===
  lines.push('0 TRLR');

  return lines.join('\r\n');
}

/**
 * Convert ISO date (YYYY-MM-DD) to GEDCOM date format (DD MMM YYYY).
 */
function formatGedcomDate(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return isoDate;
    const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  } catch {
    return isoDate;
  }
}

/**
 * Trigger download of a GEDCOM file.
 */
export function downloadGedcom(tree: Tree, persons: Person[]): void {
  const content = exportToGedcom(tree, persons);
  const blob = new Blob([content], { type: 'text/x-gedcom;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  const safeName = (tree.client_first_name || tree.name || 'arbre')
    .replace(/\s+/g, '_')
    .toLowerCase();
  link.download = `genealogie_${safeName}.ged`;
  link.click();
  URL.revokeObjectURL(link.href);
}
