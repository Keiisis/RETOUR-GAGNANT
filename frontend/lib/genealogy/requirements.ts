import { DocType, DossierType, RelationRole, Gender } from './types';

export interface RequirementDef {
  key: string;
  label: string;
  docType: DocType;
  targetRole: RelationRole | 'self';
  validityCheck?: boolean;   // doit dater de moins de 3 mois
  optional?: boolean;        // "tout autre document" = renforcement
}

// ---------- DOSSIER 1 : AFRO-DESCENDANCE ----------
export const AFRO_DESCENDANCE: RequirementDef[] = [
  { key: 'afro_proof',     label: "Preuve d'afro-descendance",        docType: 'afro_descent_proof', targetRole: 'self', validityCheck: true },
  { key: 'profession',     label: 'Preuve de profession',             docType: 'profession_proof',   targetRole: 'self', validityCheck: true },
  { key: 'address',        label: 'Justificatif de domicile',         docType: 'address_proof',      targetRole: 'self', validityCheck: true },
  { key: 'identity',       label: "Pièce d'identité valide",          docType: 'identity',           targetRole: 'self', validityCheck: true },
  { key: 'birth_self',     label: 'Votre extrait de naissance',       docType: 'birth_certificate',  targetRole: 'self', validityCheck: true },
  { key: 'criminal',       label: 'Casier judiciaire',                docType: 'criminal_record',    targetRole: 'self', validityCheck: true },
  { key: 'birth_father',   label: 'Extrait de naissance du père',     docType: 'birth_certificate',  targetRole: 'father' },
  { key: 'birth_mother',   label: 'Extrait de naissance de la mère',  docType: 'birth_certificate',  targetRole: 'mother' },
  { key: 'familybook_parents', label: 'Livret de famille des parents', docType: 'family_book',       targetRole: 'father' },
  // arrière-grands-parents (4)
  { key: 'birth_pggf1', label: 'Extrait naissance arrière-grand-père paternel', docType: 'birth_certificate', targetRole: 'paternal_ggf_1' },
  { key: 'birth_pggm1', label: 'Extrait naissance arrière-grand-mère paternelle', docType: 'birth_certificate', targetRole: 'paternal_ggm_1' },
  { key: 'birth_mggf1', label: 'Extrait naissance arrière-grand-père maternel', docType: 'birth_certificate', targetRole: 'maternal_ggf_1' },
  { key: 'birth_mggm1', label: 'Extrait naissance arrière-grand-mère maternelle', docType: 'birth_certificate', targetRole: 'maternal_ggm_1' },
  // documents de renforcement (facultatifs mais valorisés)
  { key: 'extra_gp_marriage', label: 'Acte de mariage grands-parents', docType: 'marriage_certificate', targetRole: 'paternal_grandfather', optional: true },
  { key: 'extra_gp_death',    label: 'Acte de décès grands-parents',   docType: 'death_certificate',    targetRole: 'paternal_grandfather', optional: true },
];

// ---------- DOSSIER 2 : ANCÊTRE RÉDUIT EN ESCLAVAGE ----------
export const ANCETRE_ESCLAVAGE: RequirementDef[] = [
  { key: 'birth_father', label: 'Extrait de naissance du père', docType: 'birth_certificate', targetRole: 'father' },
  { key: 'birth_mother', label: 'Extrait de naissance de la mère', docType: 'birth_certificate', targetRole: 'mother' },
  // grands-parents : naissance OU décès accepté (géré dans le moteur)
  { key: 'gp_pgf', label: 'Naissance/décès grand-père paternel', docType: 'birth_certificate', targetRole: 'paternal_grandfather' },
  { key: 'gp_pgm', label: 'Naissance/décès grand-mère paternelle', docType: 'birth_certificate', targetRole: 'paternal_grandmother' },
  { key: 'gp_mgf', label: 'Naissance/décès grand-père maternel', docType: 'birth_certificate', targetRole: 'maternal_grandfather' },
  { key: 'gp_mgm', label: 'Naissance/décès grand-mère maternelle', docType: 'birth_certificate', targetRole: 'maternal_grandmother' },
  // tout autre acte
  { key: 'extra_acts', label: 'Acte (mariage/notarial/militaire/décès) grands & arrière-grands-parents', docType: 'marriage_certificate', targetRole: 'paternal_grandfather', optional: true },
];

export const DOSSIER_DEFS: Record<DossierType, RequirementDef[]> = {
  afro_descendance: AFRO_DESCENDANCE,
  ancetre_esclavage: ANCETRE_ESCLAVAGE,
};

export const DOSSIER_LABELS: Record<DossierType, string> = {
  afro_descendance: 'Dossier Afro-descendance',
  ancetre_esclavage: "Dossier Ancêtre réduit en esclavage",
};

// Documents acceptés "naissance OU décès" pour les grands-parents (dossier 2)
export const BIRTH_OR_DEATH_KEYS = ['gp_pgf', 'gp_pgm', 'gp_mgf', 'gp_mgm'];

/* ═══════════════════════════════════════════════════════════════
   ROLE_LABELS — Étiquettes de rôle statiques (non genrées)
   Pour les labels genrés dynamiques, utiliser getRoleLabel()
   ═══════════════════════════════════════════════════════════════ */
export const ROLE_LABELS: Record<string, string> = {
  self: 'Le demandeur',
  father: 'Père',
  mother: 'Mère',
  paternal_grandfather: 'Grand-père paternel',
  paternal_grandmother: 'Grand-mère paternelle',
  maternal_grandfather: 'Grand-père maternel',
  maternal_grandmother: 'Grand-mère maternelle',
  paternal_ggf_1: 'Arr.-grand-père pat. (Père du GP pat.)',
  paternal_ggm_1: 'Arr.-grand-mère pat. (Mère du GP pat.)',
  paternal_ggf_2: 'Arr.-grand-père pat. (Père de la GM pat.)',
  paternal_ggm_2: 'Arr.-grand-mère pat. (Mère de la GM pat.)',
  maternal_ggf_1: 'Arr.-grand-père mat. (Père du GP mat.)',
  maternal_ggm_1: 'Arr.-grand-mère mat. (Mère du GP mat.)',
  maternal_ggf_2: 'Arr.-grand-père mat. (Père de la GM mat.)',
  maternal_ggm_2: 'Arr.-grand-mère mat. (Mère de la GM mat.)',
  /* Trisaïeuls — Gen 0: parents des arrière-grands-parents */
  trisaieul_paternal_ggf1_f: 'Arr.-arr.-grand-père (Père de l\'AGP pat. 1)',
  trisaieul_paternal_ggf1_m: 'Arr.-arr.-grand-mère (Mère de l\'AGP pat. 1)',
  trisaieul_paternal_ggm1_f: 'Arr.-arr.-grand-père (Père de l\'AGM pat. 1)',
  trisaieul_paternal_ggm1_m: 'Arr.-arr.-grand-mère (Mère de l\'AGM pat. 1)',
  trisaieul_paternal_ggf2_f: 'Arr.-arr.-grand-père (Père de l\'AGP pat. 2)',
  trisaieul_paternal_ggf2_m: 'Arr.-arr.-grand-mère (Mère de l\'AGP pat. 2)',
  trisaieul_paternal_ggm2_f: 'Arr.-arr.-grand-père (Père de l\'AGM pat. 2)',
  trisaieul_paternal_ggm2_m: 'Arr.-arr.-grand-mère (Mère de l\'AGM pat. 2)',
  trisaieul_maternal_ggf1_f: 'Arr.-arr.-grand-père (Père de l\'AGP mat. 1)',
  trisaieul_maternal_ggf1_m: 'Arr.-arr.-grand-mère (Mère de l\'AGP mat. 1)',
  trisaieul_maternal_ggm1_f: 'Arr.-arr.-grand-père (Père de l\'AGM mat. 1)',
  trisaieul_maternal_ggm1_m: 'Arr.-arr.-grand-mère (Mère de l\'AGM mat. 1)',
  trisaieul_maternal_ggf2_f: 'Arr.-arr.-grand-père (Père de l\'AGP mat. 2)',
  trisaieul_maternal_ggf2_m: 'Arr.-arr.-grand-mère (Mère de l\'AGP mat. 2)',
  trisaieul_maternal_ggm2_f: 'Arr.-arr.-grand-père (Père de l\'AGM mat. 2)',
  trisaieul_maternal_ggm2_m: 'Arr.-arr.-grand-mère (Mère de l\'AGM mat. 2)',
  /* Fratrie du sujet */
  brother: 'Frère',
  sister: 'Sœur',
  sibling: 'Frère / Sœur',
  /* Oncles / tantes (fratrie des parents) */
  paternal_uncle: 'Oncle paternel',
  paternal_aunt: 'Tante paternelle',
  maternal_uncle: 'Oncle maternel',
  maternal_aunt: 'Tante maternelle',
  /* Fratrie des grands-parents (grands-oncles / grand-tantes) */
  sibling_of_paternal_grandfather: 'Collatéral du GP paternel',
  sibling_of_paternal_grandmother: 'Collatéral de la GM paternelle',
  sibling_of_maternal_grandfather: 'Collatéral du GP maternel',
  sibling_of_maternal_grandmother: 'Collatéral de la GM maternelle',
  /* Fratrie des arrière-grands-parents */
  sibling_of_paternal_ggf_1: 'Collatéral de l\'AGP pat. 1',
  sibling_of_paternal_ggm_1: 'Collatéral de l\'AGM pat. 1',
  sibling_of_paternal_ggf_2: 'Collatéral de l\'AGP pat. 2',
  sibling_of_paternal_ggm_2: 'Collatéral de l\'AGM pat. 2',
  sibling_of_maternal_ggf_1: 'Collatéral de l\'AGP mat. 1',
  sibling_of_maternal_ggm_1: 'Collatéral de l\'AGM mat. 1',
  sibling_of_maternal_ggf_2: 'Collatéral de l\'AGP mat. 2',
  sibling_of_maternal_ggm_2: 'Collatéral de l\'AGM mat. 2',
  /* Conjoints */
  husband: 'Époux',
  wife: 'Épouse',
  fiance: 'Fiancé',
  fiancee: 'Fiancée',
  /* Descendance & autres */
  child: 'Enfant',
  ancestor: 'Ancêtre',
  other: 'Autre membre',
};

/* ═══════════════════════════════════════════════════════════════
   getRoleLabel() — Label genré dynamique
   Adapte le libellé selon le genre de la personne :
   - self → Le demandeur / La demandeuse
   - husband/wife → Époux / Épouse
   - sibling roles → Frère de... / Sœur de...
   - sibling_of_* → Grand-oncle / Grand-tante, etc.
   ═══════════════════════════════════════════════════════════════ */
export function getRoleLabel(role: string | null, gender: Gender | null): string {
  if (!role) return 'Individu';

  // Self: Le demandeur / La demandeuse
  if (role === 'self') {
    return gender === 'female' ? 'La demandeuse' : 'Le demandeur';
  }

  // Partner roles
  if (role === 'husband' || role === 'wife' || role === 'fiance' || role === 'fiancee') {
    if (gender === 'male') return role === 'fiance' || role === 'fiancee' ? 'Fiancé' : 'Époux';
    if (gender === 'female') return role === 'fiance' || role === 'fiancee' ? 'Fiancée' : 'Épouse';
    return ROLE_LABELS[role] || role;
  }

  // Siblings of self
  if (role === 'brother' || role === 'sister' || role === 'sibling') {
    if (gender === 'male') return 'Frère';
    if (gender === 'female') return 'Sœur';
    return 'Frère / Sœur';
  }

  // Paternal uncle/aunt
  if (role === 'paternal_uncle' || role === 'paternal_aunt') {
    if (gender === 'male') return 'Oncle paternel';
    if (gender === 'female') return 'Tante paternelle';
    return ROLE_LABELS[role] || role;
  }

  // Maternal uncle/aunt
  if (role === 'maternal_uncle' || role === 'maternal_aunt') {
    if (gender === 'male') return 'Oncle maternel';
    if (gender === 'female') return 'Tante maternelle';
    return ROLE_LABELS[role] || role;
  }

  // Sibling of GP (grand-uncle/grand-aunt)
  const gpSiblingMap: Record<string, string> = {
    sibling_of_paternal_grandfather: 'du Grand-père pat.',
    sibling_of_paternal_grandmother: 'de la Grand-mère pat.',
    sibling_of_maternal_grandfather: 'du Grand-père mat.',
    sibling_of_maternal_grandmother: 'de la Grand-mère mat.',
  };
  if (gpSiblingMap[role]) {
    const prefix = gender === 'female' ? 'Sœur' : 'Frère';
    return `${prefix} ${gpSiblingMap[role]}`;
  }

  // Sibling of GG (arrière-grand-uncle/aunt)
  const ggSiblingMap: Record<string, string> = {
    sibling_of_paternal_ggf_1: 'de l\'Arr.-GP pat. (Père du GP pat.)',
    sibling_of_paternal_ggm_1: 'de l\'Arr.-GM pat. (Mère du GP pat.)',
    sibling_of_paternal_ggf_2: 'de l\'Arr.-GP pat. (Père de la GM pat.)',
    sibling_of_paternal_ggm_2: 'de l\'Arr.-GM pat. (Mère de la GM pat.)',
    sibling_of_maternal_ggf_1: 'de l\'Arr.-GP mat. (Père du GP mat.)',
    sibling_of_maternal_ggm_1: 'de l\'Arr.-GM mat. (Mère du GP mat.)',
    sibling_of_maternal_ggf_2: 'de l\'Arr.-GP mat. (Père de la GM mat.)',
    sibling_of_maternal_ggm_2: 'de l\'Arr.-GM mat. (Mère de la GM mat.)',
  };
  if (ggSiblingMap[role]) {
    const prefix = gender === 'female' ? 'Sœur' : 'Frère';
    return `${prefix} ${ggSiblingMap[role]}`;
  }

  return ROLE_LABELS[role] || role;
}
