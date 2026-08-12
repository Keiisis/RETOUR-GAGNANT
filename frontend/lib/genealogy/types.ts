export type Gender = 'male' | 'female' | 'other';

export type RelationRole =
  | 'self'
  | 'father' | 'mother'
  | 'paternal_grandfather' | 'paternal_grandmother'
  | 'maternal_grandfather' | 'maternal_grandmother'
  | 'paternal_ggf_1' | 'paternal_ggm_1'
  | 'paternal_ggf_2' | 'paternal_ggm_2'
  | 'maternal_ggf_1' | 'maternal_ggm_1'
  | 'maternal_ggf_2' | 'maternal_ggm_2'
  /* Trisaïeuls : parents des arrière-grands-parents (Gen 0) */
  | 'trisaieul_paternal_ggf1_f' | 'trisaieul_paternal_ggf1_m'
  | 'trisaieul_paternal_ggm1_f' | 'trisaieul_paternal_ggm1_m'
  | 'trisaieul_paternal_ggf2_f' | 'trisaieul_paternal_ggf2_m'
  | 'trisaieul_paternal_ggm2_f' | 'trisaieul_paternal_ggm2_m'
  | 'trisaieul_maternal_ggf1_f' | 'trisaieul_maternal_ggf1_m'
  | 'trisaieul_maternal_ggm1_f' | 'trisaieul_maternal_ggm1_m'
  | 'trisaieul_maternal_ggf2_f' | 'trisaieul_maternal_ggf2_m'
  | 'trisaieul_maternal_ggm2_f' | 'trisaieul_maternal_ggm2_m'
  /* Fratrie du sujet */
  | 'brother' | 'sister'
  /* Oncles / tantes (fratrie des parents) */
  | 'paternal_uncle' | 'paternal_aunt'
  | 'maternal_uncle' | 'maternal_aunt'
  /* Fratrie des grands-parents (grands-oncles / grand-tantes) */
  | 'sibling_of_paternal_grandfather' | 'sibling_of_paternal_grandmother'
  | 'sibling_of_maternal_grandfather' | 'sibling_of_maternal_grandmother'
  /* Fratrie des arrière-grands-parents (collatéraux Gen 1) */
  | 'sibling_of_paternal_ggf_1' | 'sibling_of_paternal_ggm_1'
  | 'sibling_of_paternal_ggf_2' | 'sibling_of_paternal_ggm_2'
  | 'sibling_of_maternal_ggf_1' | 'sibling_of_maternal_ggm_1'
  | 'sibling_of_maternal_ggf_2' | 'sibling_of_maternal_ggm_2'
  | 'sibling'
  | 'husband' | 'wife'
  | 'fiance' | 'fiancee'
  | 'child'
  | 'ancestor'
  | 'other';

export type DocType =
  | 'afro_descent_proof'
  | 'profession_proof'
  | 'address_proof'
  | 'identity'
  | 'birth_certificate'
  | 'criminal_record'
  | 'family_book'
  | 'marriage_certificate'
  | 'death_certificate'
  | 'notarial_act'
  | 'military_act'
  | 'baptism_certificate'
  | 'notoriety_act'
  | 'slave_register'
  | 'census_record'
  | 'custom_certificate'
  | 'historical_identity'
  | 'other';

export interface Tree {
  id: string;
  user_id: string | null;
  name: string;
  client_first_name: string | null;
  client_last_name: string | null;
  client_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface Person {
  id: string;
  tree_id: string;
  user_id: string | null;
  first_name: string | null;
  last_name: string | null;
  gender: Gender | null;
  birth_date: string | null;
  birth_place: string | null;
  death_date: string | null;
  death_place: string | null;
  is_self: boolean;
  relation_role: RelationRole | null;
  father_id: string | null;
  mother_id: string | null;
  notes: string | null;
  avatar_url: string | null;
}

export interface DocumentItem {
  id: string;
  user_id: string;
  tree_id: string;
  person_id: string | null;
  doc_type: DocType;
  title: string | null;
  file_path: string | null;
  file_url: string | null;
  issued_date: string | null;
  expires_check: boolean;
  metadata: Record<string, any>;
}

export type DossierType = 'afro_descendance' | 'ancetre_esclavage';

export interface RequirementResult {
  key: string;
  label: string;
  docType: DocType;
  targetRole: RelationRole | 'self';
  required: boolean;
  fulfilled: boolean;
  expired: boolean;     // règle des 3 mois
  missingPerson: boolean; // la personne cible n'existe pas dans l'arbre
  message?: string;
}

export interface DossierReport {
  dossierType: DossierType;
  progress: number;          // 0-100
  totalRequired: number;
  totalFulfilled: number;
  items: RequirementResult[];
  alerts: Alert[];
}

export interface Alert {
  level: 'error' | 'warning' | 'success' | 'info';
  message: string;
  relatedRole?: RelationRole | 'self';
}
