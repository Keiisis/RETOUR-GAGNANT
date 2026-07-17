'use client';

import { Person, DocumentItem } from '@/lib/genealogy/types';
import { ROLE_LABELS } from '@/lib/genealogy/requirements';
import PersonCard from './PersonCard';
import { Plus, UserPlus, Users, Baby } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';
import { useTheme } from '@/lib/theme/ThemeContext';

/* ══════════════════════════════════════════════════════════════════
   PLAN DE COMPOSITION DE FAMILLE PROFESSIONNEL — LAYOUT HIÉRARCHIQUE (6 GÉNÉRATIONS)
   
   Architecture de rendu :
   - Chaque génération est une ligne horizontale
   - Les couples sont liés par un nœud mariage ()
   - Les enfants descendent depuis le nœud mariage
   - Courbes de Bézier pour les connexions
   - Design premium avec dégradés et animations
   ══════════════════════════════════════════════════════════════════ */

/* ─── Dimensions (moved inside component for dynamic scaling) ─── */

/**
 * Ordre généalogique d'une fratrie/descendance : aîné → cadet.
 * Avant, le tri se faisait sur l'UUID (`id`) → ordre visuel aléatoire et
 * instable. On ordonne par date de naissance (les datés d'abord), puis par
 * nom, et enfin par id pour la stabilité.
 */
function byBirthOrder(a: Person, b: Person): number {
  const at = a.birth_date ? new Date(a.birth_date).getTime() : NaN;
  const bt = b.birth_date ? new Date(b.birth_date).getTime() : NaN;
  const aok = !isNaN(at);
  const bok = !isNaN(bt);
  if (aok && bok && at !== bt) return at - bt;     // aîné d'abord
  if (aok !== bok) return aok ? -1 : 1;            // ceux avec date avant ceux sans
  const an = `${a.last_name ?? ''} ${a.first_name ?? ''}`.trim().toLowerCase();
  const bn = `${b.last_name ?? ''} ${b.first_name ?? ''}`.trim().toLowerCase();
  if (an && bn && an !== bn) return an.localeCompare(bn);
  return a.id.localeCompare(b.id);                 // stabilité
}

/* ─── Types internes ─── */
interface TreeNode {
  id: string;
  role: string;
  person?: Person;
  x: number;
  y: number;
  gen: number;
}

interface CoupleLink {
  leftNode: TreeNode;
  rightNode: TreeNode;
  midX: number;
  midY: number;
}

interface ChildLink {
  parentMidX: number;
  parentMidY: number;
  childX: number;
  childTopY: number;
  active?: boolean;
}

interface SiblingGroup {
  parentMidX: number;
  parentMidY: number;
  children: { x: number; topY: number; active?: boolean }[];
  active?: boolean;
}

interface FamilyTreeProps {
  persons: Person[];
  documents: DocumentItem[];
  selectedPerson?: Person | null;
  onSelect: (person: Person) => void;
  onAddRelative?: (action: string, contextPersonId?: string) => void;
}

export default function FamilyTree({
  persons,
  documents,
  selectedPerson,
  onSelect,
  onAddRelative,
  compact = false,
}: FamilyTreeProps & { compact?: boolean }) {
  const CARD_W   = compact ? 190 : 280;
  const CARD_H   = compact ? 95  : 170;
  const H_GAP    = compact ? 20  : 56;
  const V_GAP    = compact ? 50  : 140;
  const COUPLE_R = compact ? 10  : 18;
  const UNIT     = CARD_W + H_GAP;

  const { theme } = useTheme();
  const isDark = theme === 'dark';

  /* ─── Helpers: find person by role ─── */
  const byRole = useMemo(() => {
    const map: Record<string, Person> = {};
    persons.forEach(p => {
      if (p.is_self) map['self'] = p;
      if (p.relation_role) map[p.relation_role] = p;
    });
    return map;
  }, [persons]);

  const findPerson = (role: string) => byRole[role] || undefined;

  /* ─── Find key people in the tree ─── */
  const self = useMemo(() => persons.find(p => p.is_self || p.relation_role === 'self'), [persons]);
  const father = useMemo(() => persons.find(p => p.relation_role === 'father'), [persons]);
  const mother = useMemo(() => persons.find(p => p.relation_role === 'mother'), [persons]);
  const paternalGrandfather = useMemo(() => persons.find(p => p.relation_role === 'paternal_grandfather'), [persons]);
  const paternalGrandmother = useMemo(() => persons.find(p => p.relation_role === 'paternal_grandmother'), [persons]);
  const maternalGrandfather = useMemo(() => persons.find(p => p.relation_role === 'maternal_grandfather'), [persons]);
  const maternalGrandmother = useMemo(() => persons.find(p => p.relation_role === 'maternal_grandmother'), [persons]);

  /* ─── Collateral persons (linked by database IDs OR roles) ─── */
  const siblings = useMemo(() => {
    return persons
      .filter(p => !p.is_self && p.relation_role !== 'self')
      .filter(p => 
        ['brother', 'sister', 'sibling'].includes(p.relation_role || '') ||
        (father && p.father_id === father.id) ||
        (mother && p.mother_id === mother.id)
      )
      .filter((value, index, selfArr) => selfArr.findIndex(t => t.id === value.id) === index)
      .sort(byBirthOrder);
  }, [persons, father, mother]);

  const paternalUncles = useMemo(() => {
    return persons
      .filter(p => 
        ['paternal_uncle', 'paternal_aunt'].includes(p.relation_role || '') ||
        (paternalGrandfather && p.father_id === paternalGrandfather.id) ||
        (paternalGrandmother && p.mother_id === paternalGrandmother.id)
      )
      .filter(p => p.relation_role !== 'father' && p.relation_role !== 'paternal_grandfather' && p.relation_role !== 'paternal_grandmother')
      .filter((value, index, selfArr) => selfArr.findIndex(t => t.id === value.id) === index)
      .sort(byBirthOrder);
  }, [persons, paternalGrandfather, paternalGrandmother]);

  const maternalUncles = useMemo(() => {
    return persons
      .filter(p => 
        ['maternal_uncle', 'maternal_aunt'].includes(p.relation_role || '') ||
        (maternalGrandfather && p.father_id === maternalGrandfather.id) ||
        (maternalGrandmother && p.mother_id === maternalGrandmother.id)
      )
      .filter(p => p.relation_role !== 'mother' && p.relation_role !== 'maternal_grandfather' && p.relation_role !== 'maternal_grandmother')
      .filter((value, index, selfArr) => selfArr.findIndex(t => t.id === value.id) === index)
      .sort(byBirthOrder);
  }, [persons, maternalGrandfather, maternalGrandmother]);

  const childPersons = useMemo(() => {
    return persons
      .filter(p => 
        p.relation_role === 'child' ||
        (self && (p.father_id === self.id || p.mother_id === self.id))
      )
      .filter((value, index, selfArr) => selfArr.findIndex(t => t.id === value.id) === index)
      .sort(byBirthOrder);
  }, [persons, self]);

  /* ─── Partners (husband, wife, fiancé, fiancée) ─── */
  const partnerPersons = useMemo(() => {
    return persons
      .filter(p => ['husband', 'wife', 'fiance', 'fiancee'].includes(p.relation_role || ''))
      .filter((value, index, selfArr) => selfArr.findIndex(t => t.id === value.id) === index)
      .sort(byBirthOrder);
  }, [persons]);

  /* ─── GG-level siblings: persons with sibling_of_* roles or ancestors sharing parents ─── */
  const ggRolesList = [
    'paternal_ggf_1', 'paternal_ggm_1', 'paternal_ggf_2', 'paternal_ggm_2',
    'maternal_ggf_1', 'maternal_ggm_1', 'maternal_ggf_2', 'maternal_ggm_2',
  ];
  // Map sibling_of_* role → ggRole it belongs to
  const ggSiblingRoleMap: Record<string, string> = {
    sibling_of_paternal_ggf_1: 'paternal_ggf_1',
    sibling_of_paternal_ggm_1: 'paternal_ggm_1',
    sibling_of_paternal_ggf_2: 'paternal_ggf_2',
    sibling_of_paternal_ggm_2: 'paternal_ggm_2',
    sibling_of_maternal_ggf_1: 'maternal_ggf_1',
    sibling_of_maternal_ggm_1: 'maternal_ggm_1',
    sibling_of_maternal_ggf_2: 'maternal_ggf_2',
    sibling_of_maternal_ggm_2: 'maternal_ggm_2',
  };
  const ggSiblings = useMemo(() => {
    const ggPersons = persons.filter(p => ggRolesList.includes(p.relation_role || ''));
    const result: { person: Person; ggRole: string }[] = [];
    persons.forEach(p => {
      // Direct role match: sibling_of_paternal_ggm_1 → paternal_ggm_1
      const mappedGgRole = ggSiblingRoleMap[p.relation_role || ''];
      if (mappedGgRole) {
        result.push({ person: p, ggRole: mappedGgRole });
        return;
      }
      // Backward compat: ancestor with parent links matching a GG person
      if (p.relation_role === 'ancestor' && (p.father_id || p.mother_id)) {
        for (const gg of ggPersons) {
          if (
            (p.father_id && gg.father_id && p.father_id === gg.father_id) ||
            (p.mother_id && gg.mother_id && p.mother_id === gg.mother_id)
          ) {
            result.push({ person: p, ggRole: gg.relation_role || '' });
            break;
          }
        }
      }
    });
    return result;
  }, [persons]);

  /* ─── GP-level siblings: persons with sibling_of_* roles or ancestors sharing parents ─── */
  const gpRolesList = [
    'paternal_grandfather', 'paternal_grandmother',
    'maternal_grandfather', 'maternal_grandmother',
  ];
  // Map sibling_of_* role → gpRole it belongs to
  const gpSiblingRoleMap: Record<string, string> = {
    sibling_of_paternal_grandfather: 'paternal_grandfather',
    sibling_of_paternal_grandmother: 'paternal_grandmother',
    sibling_of_maternal_grandfather: 'maternal_grandfather',
    sibling_of_maternal_grandmother: 'maternal_grandmother',
  };
  const gpSiblings = useMemo(() => {
    const gpPersons = persons.filter(p => gpRolesList.includes(p.relation_role || ''));
    const result: { person: Person; gpRole: string }[] = [];
    persons.forEach(p => {
      const mappedGpRole = gpSiblingRoleMap[p.relation_role || ''];
      if (mappedGpRole) {
        result.push({ person: p, gpRole: mappedGpRole });
        return;
      }
      if (p.relation_role === 'ancestor' && (p.father_id || p.mother_id)) {
        for (const gp of gpPersons) {
          if (
            (p.father_id && gp.father_id && p.father_id === gp.father_id) ||
            (p.mother_id && gp.mother_id && p.mother_id === gp.mother_id)
          ) {
            result.push({ person: p, gpRole: gp.relation_role || '' });
            break;
          }
        }
      }
    });
    return result;
  }, [persons]);


  /* ═══════════════════════════════════════════════════════════════
     LAYOUT ENGINE — Positionnement hiérarchique (6 Générations)
     
     Génération 0 (haut)  : Trisaïeuls (Parents des arrière-grands-parents)
     Génération 1         : Arrière-grands-parents
     Génération 2         : Grands-parents
     Génération 3         : Parents + oncles/tantes
     Génération 4         : Self + fratrie
     Génération 5 (bas)   : Enfants
     ═══════════════════════════════════════════════════════════════ */

  const layout = useMemo(() => {
    const nodes: TreeNode[] = [];
    const couples: CoupleLink[] = [];
    const childLinks: ChildLink[] = [];
    const siblingGroups: SiblingGroup[] = [];

    const genY = (gen: number) => gen * (CARD_H + V_GAP) + 40;

    // Helper to get center bottom / center top of a node
    const cx = (n: TreeNode) => n.x + CARD_W / 2;
    const bot = (n: TreeNode) => n.y + CARD_H;
    const top = (n: TreeNode) => n.y;

    /* ─── Gen 0: Trisaïeuls (16 slots potentiels) ─── */
    const ggRolesInfo = [
      { role: 'paternal_ggf_1', fCol: 0, mCol: 1 },
      { role: 'paternal_ggm_1', fCol: 2, mCol: 3 },
      { role: 'paternal_ggf_2', fCol: 4, mCol: 5 },
      { role: 'paternal_ggm_2', fCol: 6, mCol: 7 },
      { role: 'maternal_ggf_1', fCol: 9, mCol: 10 },
      { role: 'maternal_ggm_1', fCol: 11, mCol: 12 },
      { role: 'maternal_ggf_2', fCol: 13, mCol: 14 },
      { role: 'maternal_ggm_2', fCol: 15, mCol: 16 },
    ];

    ggRolesInfo.forEach(({ role, fCol, mCol }) => {
      const ggPerson = findPerson(role);
      if (ggPerson) {
        const fatherPerson = ggPerson.father_id ? persons.find(p => p.id === ggPerson.father_id) : undefined;
        const motherPerson = ggPerson.mother_id ? persons.find(p => p.id === ggPerson.mother_id) : undefined;

        // Father of GG
        nodes.push({
          id: `father_of_${ggPerson.id}`,
          role: `father_of_${ggPerson.id}`,
          person: fatherPerson,
          x: fCol * UNIT,
          y: genY(0),
          gen: 0,
        });

        // Mother of GG
        nodes.push({
          id: `mother_of_${ggPerson.id}`,
          role: `mother_of_${ggPerson.id}`,
          person: motherPerson,
          x: mCol * UNIT,
          y: genY(0),
          gen: 0,
        });
      }
    });

    /* ─── Gen 1: Arrière-grands-parents (8 slots) ─── */
    const ggRoles = [
      { role: 'paternal_ggf_1', col: 0.5 },
      { role: 'paternal_ggm_1', col: 2.5 },
      { role: 'paternal_ggf_2', col: 4.5 },
      { role: 'paternal_ggm_2', col: 6.5 },
      { role: 'maternal_ggf_1', col: 9.5 },
      { role: 'maternal_ggm_1', col: 11.5 },
      { role: 'maternal_ggf_2', col: 13.5 },
      { role: 'maternal_ggm_2', col: 15.5 },
    ];

    ggRoles.forEach(({ role, col }) => {
      nodes.push({
        id: role,
        role,
        person: findPerson(role),
        x: col * UNIT,
        y: genY(1),
        gen: 1,
      });
    });

    // GG-level siblings (ancestors who share parents with a GG person)
    const ggColMap: Record<string, number> = {};
    ggRoles.forEach(({ role, col }) => { ggColMap[role] = col; });

    ggSiblings.forEach((gs, i) => {
      const baseCol = ggColMap[gs.ggRole] ?? 0;
      const col = baseCol + 1.0 + i * 1.0; // offset right next to the GG person
      nodes.push({
        id: gs.person.id,
        role: 'ancestor',
        person: gs.person,
        x: col * UNIT,
        y: genY(1),
        gen: 1,
      });
    });

    // GG couples
    const ggCouples: [string, string][] = [
      ['paternal_ggf_1', 'paternal_ggm_1'],
      ['paternal_ggf_2', 'paternal_ggm_2'],
      ['maternal_ggf_1', 'maternal_ggm_1'],
      ['maternal_ggf_2', 'maternal_ggm_2'],
    ];

    /* ─── Gen 2: Grands-parents (4 slots) ─── */
    const gpRoles = [
      { role: 'paternal_grandfather', col: 1.5 },
      { role: 'paternal_grandmother', col: 5.5 },
      { role: 'maternal_grandfather', col: 10.5 },
      { role: 'maternal_grandmother', col: 14.5 },
    ];

    gpRoles.forEach(({ role, col }) => {
      nodes.push({
        id: role,
        role,
        person: findPerson(role),
        x: col * UNIT,
        y: genY(2),
        gen: 2,
      });
    });

    // GP-level siblings (uncles/aunts of parents)
    const gpColMap: Record<string, number> = {};
    gpRoles.forEach(({ role, col }) => { gpColMap[role] = col; });

    gpSiblings.forEach((gs, i) => {
      const baseCol = gpColMap[gs.gpRole] ?? 0;
      const col = baseCol + 1.0 + i * 1.0; // offset right next to the GP person
      nodes.push({
        id: gs.person.id,
        role: gs.person.relation_role || 'sibling_of_paternal_grandfather',
        person: gs.person,
        x: col * UNIT,
        y: genY(2),
        gen: 2,
      });
    });

    // GP couples
    const gpCouples: [string, string][] = [
      ['paternal_grandfather', 'paternal_grandmother'],
      ['maternal_grandfather', 'maternal_grandmother'],
    ];

    /* ─── Gen 3: Parents + oncles/tantes ─── */
    const fatherCol = 3.5;
    const motherCol = 12.5;

    // Father
    nodes.push({
      id: 'father',
      role: 'father',
      person: findPerson('father'),
      x: fatherCol * UNIT,
      y: genY(3),
      gen: 3,
    });

    // Mother
    nodes.push({
      id: 'mother',
      role: 'mother',
      person: findPerson('mother'),
      x: motherCol * UNIT,
      y: genY(3),
      gen: 3,
    });

    // Paternal uncles/aunts
    paternalUncles.forEach((unc, i) => {
      const offset = i % 2 === 0 ? -(Math.floor(i / 2) + 1) : (Math.floor(i / 2) + 1);
      const col = fatherCol + offset * 2.8;
      nodes.push({
        id: unc.id,
        role: unc.relation_role || 'paternal_uncle',
        person: unc,
        x: col * UNIT,
        y: genY(3),
        gen: 3,
      });
    });

    // Maternal uncles/aunts
    maternalUncles.forEach((unc, i) => {
      const offset = i % 2 === 0 ? (Math.floor(i / 2) + 1) : -(Math.floor(i / 2) + 1);
      const col = motherCol + offset * 2.8;
      nodes.push({
        id: unc.id,
        role: unc.relation_role || 'maternal_uncle',
        person: unc,
        x: col * UNIT,
        y: genY(3),
        gen: 3,
      });
    });

    /* ─── Gen 4: Self + partner + siblings ─── */
    const selfCol = (fatherCol + motherCol) / 2;

    const hasPartner = partnerPersons.length > 0;
    const selfActualCol = hasPartner ? selfCol - 1.2 : selfCol;
    const partnerCol = selfCol + 1.2;

    nodes.push({
      id: 'self',
      role: 'self',
      person: findPerson('self'),
      x: selfActualCol * UNIT,
      y: genY(4),
      gen: 4,
    });

    // Partners next to self
    partnerPersons.forEach((partner, i) => {
      const col = partnerCol + i * 2.4;
      nodes.push({
        id: partner.id,
        role: partner.relation_role || 'husband',
        person: partner,
        x: col * UNIT,
        y: genY(4),
        gen: 4,
      });
    });

    // Siblings offset from self (linear spacing to the left to avoid overlapping partner)
    siblings.forEach((sib, i) => {
      const col = selfActualCol - 3.0 - i * 3.0;
      nodes.push({
        id: sib.id,
        role: sib.relation_role || 'sibling',
        person: sib,
        x: col * UNIT,
        y: genY(4),
        gen: 4,
      });
    });

    /* ─── Gen 5: Children ─── */
    const childrenCenterCol = hasPartner ? (selfActualCol + partnerCol) / 2 : selfActualCol;
    const CHILD_SPREAD = 4.4;  // espacement entre enfants
    childPersons.forEach((child, i) => {
      const total = childPersons.length;
      const startCol = childrenCenterCol - ((total - 1) * CHILD_SPREAD) / 2;
      const col = startCol + i * CHILD_SPREAD;
      nodes.push({
        id: child.id,
        role: 'child',
        person: child,
        x: col * UNIT,
        y: genY(5),
        gen: 5,
      });
    });

    /* ═══ BUILD CONNECTIONS ═══ */
    const nodeMap: Record<string, TreeNode> = {};
    nodes.forEach(n => { nodeMap[n.id] = n; });

    // Build Gen 0 -> Gen 1 couples & child links (including GG siblings)
    ggRolesInfo.forEach(({ role, fCol, mCol }) => {
      const ggPerson = findPerson(role);
      if (ggPerson) {
        const fNode = nodeMap[`father_of_${ggPerson.id}`];
        const mNode = nodeMap[`mother_of_${ggPerson.id}`];
        const ggNode = nodeMap[role];

        if (fNode && mNode && ggNode) {
          const midX = (cx(fNode) + cx(mNode)) / 2;
          const midY = bot(fNode) + 16;
          couples.push({
            leftNode: fNode,
            rightNode: mNode,
            midX,
            midY,
          });

          const active = !!fNode.person || !!mNode.person;

          // Find GG siblings for this GG person
          const ggSiblingsForRole = ggSiblings
            .filter(gs => gs.ggRole === role)
            .map(gs => nodeMap[gs.person.id])
            .filter(Boolean);

          if (ggSiblingsForRole.length > 0) {
            // Use sibling group fork for GG person + siblings
            const allChildren = [ggNode, ...ggSiblingsForRole];
            siblingGroups.push({
              parentMidX: midX,
              parentMidY: midY,
              children: allChildren.map(n => ({ x: cx(n), topY: top(n), active: active && !!n.person })),
              active,
            });
          } else {
            // Single child link
            childLinks.push({
              parentMidX: midX,
              parentMidY: midY,
              childX: cx(ggNode),
              childTopY: top(ggNode),
              active: active && !!ggNode.person,
            });
          }
        }
      }
    });

    // Build couple links
    const allCouples: [string, string][] = [
      ...ggCouples,
      ...gpCouples,
      ['father', 'mother'],
    ];

    // Self + partner couple links
    partnerPersons.forEach(partner => {
      allCouples.push(['self', partner.id]);
    });

    allCouples.forEach(([a, b]) => {
      const nA = nodeMap[a];
      const nB = nodeMap[b];
      if (nA && nB) {
        const midX = (cx(nA) + cx(nB)) / 2;
        const midY = bot(nA) + 16;
        couples.push({ leftNode: nA, rightNode: nB, midX, midY });
      }
    });

    // Build parent-to-child links using couple midpoints
    // GG couples -> GP children
    const ggToGp: Record<string, string> = {
      'paternal_ggf_1,paternal_ggm_1': 'paternal_grandfather',
      'paternal_ggf_2,paternal_ggm_2': 'paternal_grandmother',
      'maternal_ggf_1,maternal_ggm_1': 'maternal_grandfather',
      'maternal_ggf_2,maternal_ggm_2': 'maternal_grandmother',
    };

    Object.entries(ggToGp).forEach(([coupleKey, childRole]) => {
      const couple = couples.find(c => {
        const key = `${c.leftNode.id},${c.rightNode.id}`;
        return key === coupleKey;
      });
      const childNode = nodeMap[childRole];
      if (couple && childNode) {
        const hasParents = !!couple.leftNode.person || !!couple.rightNode.person;
        
        // Find GP siblings for this GP person
        const gpSiblingsForRole = gpSiblings
          .filter(gs => gs.gpRole === childRole)
          .map(gs => nodeMap[gs.person.id])
          .filter(Boolean);

        if (gpSiblingsForRole.length > 0) {
          const allChildren = [childNode, ...gpSiblingsForRole];
          siblingGroups.push({
            parentMidX: couple.midX,
            parentMidY: couple.midY,
            children: allChildren.map(n => ({ x: cx(n), topY: top(n), active: hasParents && !!n.person })),
            active: hasParents,
          });
        } else {
          childLinks.push({
            parentMidX: couple.midX,
            parentMidY: couple.midY,
            childX: cx(childNode),
            childTopY: top(childNode),
            active: hasParents && !!childNode.person,
          });
        }
      }
    });

    // GP couples -> parents + uncles/aunts
    const pgfCouple = couples.find(c => c.leftNode.id === 'paternal_grandfather' && c.rightNode.id === 'paternal_grandmother');
    if (pgfCouple) {
      const fatherSiblings = [nodeMap['father'], ...paternalUncles.map(u => nodeMap[u.id])].filter(Boolean);
      if (fatherSiblings.length > 0) {
        const hasParents = !!pgfCouple.leftNode.person || !!pgfCouple.rightNode.person;
        siblingGroups.push({
          parentMidX: pgfCouple.midX,
          parentMidY: pgfCouple.midY,
          children: fatherSiblings.map(n => ({ x: cx(n), topY: top(n), active: hasParents && !!n.person })),
          active: hasParents,
        });
      }
    }

    const mgfCouple = couples.find(c => c.leftNode.id === 'maternal_grandfather' && c.rightNode.id === 'maternal_grandmother');
    if (mgfCouple) {
      const motherSiblings = [nodeMap['mother'], ...maternalUncles.map(u => nodeMap[u.id])].filter(Boolean);
      if (motherSiblings.length > 0) {
        const hasParents = !!mgfCouple.leftNode.person || !!mgfCouple.rightNode.person;
        siblingGroups.push({
          parentMidX: mgfCouple.midX,
          parentMidY: mgfCouple.midY,
          children: motherSiblings.map(n => ({ x: cx(n), topY: top(n), active: hasParents && !!n.person })),
          active: hasParents,
        });
      }
    }

    // Parents couple -> self + siblings
    const parentsCouple = couples.find(c => c.leftNode.id === 'father' && c.rightNode.id === 'mother');
    if (parentsCouple) {
      const selfSiblings = [nodeMap['self'], ...siblings.map(s => nodeMap[s.id])].filter(Boolean);
      if (selfSiblings.length > 0) {
        const hasParents = !!parentsCouple.leftNode.person || !!parentsCouple.rightNode.person;
        siblingGroups.push({
          parentMidX: parentsCouple.midX,
          parentMidY: parentsCouple.midY,
          children: selfSiblings.map(n => ({ x: cx(n), topY: top(n), active: hasParents && !!n.person })),
          active: hasParents,
        });
      }
    }

    // Self (+ partner) -> children
    const selfNode = nodeMap['self'];
    if (selfNode && childPersons.length > 0) {
      const selfPartnerCouple = partnerPersons.length > 0
        ? couples.find(c => (c.leftNode.id === 'self' && partnerPersons.some(p => p.id === c.rightNode.id)))
        : null;

      const parentMidX = selfPartnerCouple ? selfPartnerCouple.midX : cx(selfNode);
      const parentMidY = selfPartnerCouple ? selfPartnerCouple.midY : bot(selfNode) + 16;
      const hasSelf = !!selfNode.person;
      siblingGroups.push({
        parentMidX,
        parentMidY,
        children: childPersons.map(c => {
          const n = nodeMap[c.id];
          return n 
            ? { x: cx(n), topY: top(n), active: hasSelf && !!n.person } 
            : { x: parentMidX, topY: genY(5), active: false };
        }),
        active: hasSelf,
      });
    }

    // Calculate canvas dimensions
    const allX = nodes.map(n => n.x);
    const allY = nodes.map(n => n.y);
    const minX = Math.min(...allX, 0);
    const maxX = Math.max(...allX.map(x => x + CARD_W), CARD_W);
    const maxY = Math.max(...allY.map(y => y + CARD_H), CARD_H) + 60;

    return { nodes, couples, childLinks, siblingGroups, width: maxX - minX + 80, height: maxY + 40, offsetX: -minX + 40 };
  }, [persons, byRole, siblings, paternalUncles, maternalUncles, childPersons, partnerPersons, ggSiblings, gpSiblings, compact, CARD_W, CARD_H, H_GAP, V_GAP, COUPLE_R, UNIT]);
  /* ─── Document status ─── */
  function statusOf(person: Person, docs: DocumentItem[]): 'complete' | 'partial' | 'missing' {
    const d = docs.filter(doc => doc.person_id === person.id);
    const hasCore = person.first_name && person.last_name && person.birth_date;
    if (d.length > 0 && hasCore) return 'complete';
    if (d.length > 0 || hasCore) return 'partial';
    return 'missing';
  }

  /* ═══════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════ */

  const { nodes, couples, childLinks, siblingGroups, width, height, offsetX } = layout;

  const activeColor = isDark ? '#10B981' : '#008751';
  const inactiveColor = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,135,81,0.35)';

  // Generation labels
  const genLabels: Record<number, string> = {
    0: 'Trisaïeuls',
    1: 'Arrière-grands-parents',
    2: 'Grands-parents',
    3: 'Parents',
    4: 'Sujet & Fratrie',
    5: 'Descendants',
  };

  const activeGens = new Set(nodes.filter(n => n.person).map(n => n.gen));

  return (
    <div
      className="relative"
      style={{ width, height, minWidth: width }}
    >
      {/* ─── SVG Background Layer: connections ─── */}
      <svg
        className="absolute inset-0 pointer-events-none z-0"
        width={width}
        height={height}
        style={{ overflow: 'visible' }}
      >
        <defs>
          {/* Gradient for main tree lines */}
          <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={isDark ? '#008751' : '#005B36'} stopOpacity="1" />
            <stop offset="100%" stopColor={isDark ? '#FCD116' : '#008751'} stopOpacity="0.9" />
          </linearGradient>
          
          {/* Glow filter */}
          <filter id="lineGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Heart gradient for couple nodes */}
          <radialGradient id="heartGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FCD116" />
            <stop offset="100%" stopColor="#E8112D" />
          </radialGradient>

          {/* Subtle skeleton line style */}
          <linearGradient id="skelGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={isDark ? 'white' : '#005B36'} stopOpacity={isDark ? 0.15 : 0.25} />
            <stop offset="100%" stopColor={isDark ? 'white' : '#005B36'} stopOpacity={isDark ? 0.05 : 0.12} />
          </linearGradient>
        </defs>

        {/* ── Generation bands (subtle stripes) ── */}
        {[0, 1, 2, 3, 4, 5].map(gen => {
          const y = gen * (CARD_H + V_GAP) + 40;
          return (
            <g key={`gen-band-${gen}`}>
              <rect
                x={0}
                y={y - 10}
                width={width}
                height={CARD_H + 20}
                fill={gen % 2 === 0 ? 'rgba(0,135,81,0.015)' : 'rgba(252,209,22,0.008)'}
                rx="16"
              />
              {/* Gen label */}
              <text
                x={16}
                y={y + CARD_H / 2 + 4}
                fill={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}
                fontSize="12"
                fontWeight="900"
                fontFamily="system-ui, sans-serif"
                textAnchor="start"
                letterSpacing="0.15em"
              >
                {genLabels[gen]?.toUpperCase() || ''}
              </text>
            </g>
          );
        })}

        {/* ── Couple horizontal bars ── */}
        {couples.map((couple, i) => {
          const lx = couple.leftNode.x + offsetX + CARD_W / 2;
          const rx = couple.rightNode.x + offsetX + CARD_W / 2;
          const by = couple.leftNode.y + CARD_H;
          const my = couple.midY;
          const mx = (lx + rx) / 2;
          const hasLeft = !!couple.leftNode.person;
          const hasRight = !!couple.rightNode.person;
          const active = hasLeft || hasRight;

          return (
            <g key={`couple-${i}`} opacity={active ? 1 : 0.6}>
              {/* Vertical drops from each card to the marriage bar level */}
              <path
                d={`M ${lx} ${by} V ${my}`}
                fill="none"
                stroke={active ? activeColor : inactiveColor}
                strokeWidth={active ? 3.5 : 2}
                strokeLinecap="round"
                strokeDasharray={active ? undefined : "6,5"}
              />
              <path
                d={`M ${rx} ${by} V ${my}`}
                fill="none"
                stroke={active ? activeColor : inactiveColor}
                strokeWidth={active ? 3.5 : 2}
                strokeLinecap="round"
                strokeDasharray={active ? undefined : "6,5"}
              />
              {/* Horizontal bar */}
              <line
                x1={lx} y1={my}
                x2={rx} y2={my}
                stroke={active ? '#FCD116' : inactiveColor}
                strokeWidth={active ? 4 : 2}
                strokeLinecap="round"
                strokeDasharray={active ? undefined : "6,5"}
              />
              {/* Marriage/union node (heart) */}
              {active && (
                <g>
                  <circle cx={mx} cy={my} r={COUPLE_R + 6} fill="none" stroke="#FCD116" strokeWidth="1" opacity="0.2">
                    <animate attributeName="r" values={`${COUPLE_R + 3};${COUPLE_R + 9};${COUPLE_R + 3}`} dur="3s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.2;0.4;0.2" dur="3s" repeatCount="indefinite" />
                  </circle>
                  <circle cx={mx} cy={my} r={COUPLE_R} fill={isDark ? '#0a0f18' : '#FFFFFF'} stroke="#FCD116" strokeWidth="2.5" />
                  <text
                    x={mx}
                    y={my + 6}
                    textAnchor="middle"
                    fontSize="15"
                    fill="#FCD116"
                  >
                    
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* ── Single child links ── */}
        {childLinks.map((link, i) => {
          const px = link.parentMidX + offsetX;
          const py = link.parentMidY;
          const childCx = link.childX + offsetX;
          const childTy = link.childTopY;
          const midY = (py + childTy) / 2;
          const active = link.active;

          return (
            <g key={`child-link-${i}`} opacity={active ? 1 : 0.6}>
              {active && (
                /* Glow background */
                <path
                  d={`M ${px} ${py} C ${px} ${midY}, ${childCx} ${midY}, ${childCx} ${childTy}`}
                  fill="none"
                  stroke={activeColor}
                  strokeWidth="6"
                  strokeLinecap="round"
                  opacity="0.15"
                />
              )}
              {/* Main line */}
              <path
                d={`M ${px} ${py} C ${px} ${midY}, ${childCx} ${midY}, ${childCx} ${childTy}`}
                fill="none"
                stroke={active ? activeColor : inactiveColor}
                strokeWidth={active ? 3 : 1.5}
                strokeLinecap="round"
                strokeDasharray={active ? undefined : "4,4"}
              />
              {/* Animated dot */}
              {active && (
                <circle r="3" fill="#008751" opacity="0.8">
                  <animateMotion
                    dur="3s"
                    repeatCount="indefinite"
                    path={`M ${px} ${py} C ${px} ${midY}, ${childCx} ${midY}, ${childCx} ${childTy}`}
                  />
                </circle>
              )}
            </g>
          );
        })}

        {/* ── Sibling group fork lines ── */}
        {siblingGroups.map((group, gi) => {
          const px = group.parentMidX + offsetX;
          const py = group.parentMidY;
          const busY = py + (V_GAP - 24) / 2 + 12;
          const groupActive = group.active;

          const sorted = [...group.children].sort((a, b) => a.x - b.x);
          if (sorted.length === 0) return null;

          const minCx = Math.min(px, sorted[0].x + offsetX);
          const maxCx = Math.max(px, sorted[sorted.length - 1].x + offsetX);

          return (
            <g key={`fork-${gi}`} opacity={groupActive ? 1 : 0.6}>
              {/* Vertical drop from couple mid to bus level */}
              <path
                d={`M ${px} ${py} V ${busY}`}
                fill="none"
                stroke={groupActive ? activeColor : inactiveColor}
                strokeWidth={groupActive ? 3.5 : 2}
                strokeLinecap="round"
                strokeDasharray={groupActive ? undefined : "6,5"}
              />
              {groupActive && (
                /* Glow under vertical drop */
                <path
                  d={`M ${px} ${py} V ${busY}`}
                  fill="none"
                  stroke={activeColor}
                  strokeWidth="8"
                  strokeLinecap="round"
                  opacity="0.12"
                />
              )}

              {/* Horizontal bus bar */}
              {maxCx - minCx > 1 && (
                <>
                  <line
                    x1={minCx} y1={busY}
                    x2={maxCx} y2={busY}
                    stroke={groupActive ? activeColor : inactiveColor}
                    strokeWidth={groupActive ? 3.5 : 2}
                    strokeLinecap="round"
                    strokeDasharray={groupActive ? undefined : "6,5"}
                  />
                  {groupActive && (
                    <line
                      x1={minCx} y1={busY}
                      x2={maxCx} y2={busY}
                      stroke={activeColor}
                      strokeWidth="8"
                      strokeLinecap="round"
                      opacity="0.1"
                    />
                  )}
                </>
              )}

              {/* Vertical drops to each child */}
              {sorted.map((child, ci) => {
                const childCx = child.x + offsetX;
                const childActive = child.active;
                return (
                  <g key={`fork-child-${gi}-${ci}`}>
                    <path
                      d={`M ${childCx} ${busY} V ${child.topY}`}
                      fill="none"
                      stroke={childActive ? activeColor : inactiveColor}
                      strokeWidth={childActive ? 3 : 2}
                      strokeLinecap="round"
                      strokeDasharray={childActive ? undefined : "6,5"}
                    />
                    {/* Small dot at junction */}
                    {childActive && (
                      <circle cx={childCx} cy={busY} r="4" fill="#008751" opacity="0.8" />
                    )}
                  </g>
                );
              })}

              {/* Main junction dot */}
              {groupActive && (
                <circle cx={px} cy={busY} r="5" fill="#008751" opacity="0.95" />
              )}
            </g>
          );
        })}
      </svg>

      {/* ─── HTML Card Layer ─── */}
      <div className="relative z-10">
        {nodes.map((node) => {
          // In compact mode, skip empty placeholder slots
          if (compact && !node.person) return null;
          return (
            <div
              key={node.id}
              className="absolute group/card"
              style={{
                left: node.x + offsetX,
                top: node.y,
                width: CARD_W,
                height: CARD_H,
              }}
            >
              {node.person ? (
                <>
                  {(() => {
                    let childNumber: number | undefined = undefined;
                    if (node.person.relation_role === 'child') {
                      const fatherId = node.person.father_id;
                      const motherId = node.person.mother_id;
                      const sameParentChildren = persons
                        .filter(p => 
                          p.relation_role === 'child' && 
                          (
                            (fatherId && p.father_id === fatherId) ||
                            (motherId && p.mother_id === motherId) ||
                            (!fatherId && !motherId && !p.father_id && !p.mother_id)
                          )
                        )
                        .sort((a, b) => {
                          if (!a.birth_date && !b.birth_date) return a.id.localeCompare(b.id);
                          if (!a.birth_date) return 1;
                          if (!b.birth_date) return -1;
                          return a.birth_date.localeCompare(b.birth_date);
                        });
                      const idx = sameParentChildren.findIndex(p => p.id === node.person!.id);
                      if (idx !== -1) {
                        childNumber = idx + 1;
                      }
                    }
                    return (
                      <PersonCard
                        person={node.person}
                        status={statusOf(node.person, documents)}
                        selected={selectedPerson?.id === node.person.id}
                        onClick={() => onSelect(node.person!)}
                        childNumber={childNumber}
                        compact={compact}
                      />
                    );
                  })()}
                  {/* Quick action overlay on hover (hidden in compact mode) */}
                  {!compact && (
                  <div
                    className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 opacity-0 group-hover/card:opacity-100 transition-all duration-300 rounded-full px-2.5 py-1 z-30 shadow-2xl backdrop-blur-md"
                    style={{
                      background: isDark ? 'rgba(8,13,18,0.95)' : 'rgba(255,255,255,0.95)',
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                    }}
                  >
                    {/* Add Father (if no father_id) */}
                    {!node.person.father_id && (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); onAddRelative?.('add_father', node.person!.id); }}
                          title="Ajouter le père"
                          className="p-1 text-gray-400 hover:text-blue-400 transition-colors"
                        >
                          <UserPlus size={12} />
                        </button>
                        <div className="w-px h-3" style={{ background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }} />
                      </>
                    )}
                    {/* Add Mother (if no mother_id) */}
                    {!node.person.mother_id && (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); onAddRelative?.('add_mother', node.person!.id); }}
                          title="Ajouter la mère"
                          className="p-1 text-gray-400 hover:text-pink-400 transition-colors"
                        >
                          <UserPlus size={12} />
                        </button>
                        <div className="w-px h-3" style={{ background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }} />
                      </>
                    )}
                    {/* Add Child (always available) */}
                    <button
                      onClick={(e) => { e.stopPropagation(); onAddRelative?.('add_child', node.person!.id); }}
                      title="Ajouter un enfant"
                      className="p-1 text-gray-400 hover:text-[#008751] transition-colors"
                    >
                      <Baby size={12} />
                    </button>
                    {/* Add sibling (for self, GP, and GG persons who have parents) */}
                    {(node.role === 'self' || node.person.is_self || ((ggRolesList.includes(node.role) || gpRolesList.includes(node.role)) && (node.person.father_id || node.person.mother_id))) && (
                      <>
                        <div className="w-px h-3" style={{ background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }} />
                        <button
                          onClick={(e) => { e.stopPropagation(); onAddRelative?.('add_sibling', node.person!.id); }}
                          title="Ajouter un frère / sœur"
                          className="p-1 text-gray-400 hover:text-[#FCD116] transition-colors"
                        >
                          <Users size={12} />
                        </button>
                      </>
                    )}
                    {/* Add partner (only for self) */}
                    {(node.role === 'self' || node.person.is_self) && (
                      <>
                        <div className="w-px h-3" style={{ background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }} />
                        <button
                          onClick={(e) => { e.stopPropagation(); onAddRelative?.('add_partner', node.person!.id); }}
                          title="Ajouter un mari / une femme"
                          className="p-1 text-gray-400 hover:text-[#E8112D] transition-colors"
                        >
                          <Plus size={12} />
                        </button>
                      </>
                    )}
                  </div>
                  )}
                </>
              ) : (
                <button
                  onClick={() => {
                    if (node.role.startsWith('father_of_')) {
                      const ggId = node.role.replace('father_of_', '');
                      onAddRelative?.('add_father', ggId);
                    } else if (node.role.startsWith('mother_of_')) {
                      const ggId = node.role.replace('mother_of_', '');
                      onAddRelative?.('add_mother', ggId);
                    } else {
                      onAddRelative?.(node.role);
                    }
                  }}
                  className={cn(
                    'group flex h-full w-full flex-col items-center justify-center rounded-2xl transition-all duration-300 p-4 text-center',
                    'border-2 border-dashed border-white/[0.07] bg-white/[0.015]',
                    'hover:border-emerald-500/30 hover:bg-emerald-500/[0.03]',
                    'hover:shadow-[0_0_30px_-12px_rgba(0,135,81,0.4)]'
                  )}
                >
                  <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.04] border border-white/[0.06] transition-all group-hover:scale-110 group-hover:bg-emerald-500/10 group-hover:border-emerald-500/30">
                    <Plus size={18} className="text-gray-500 transition-colors group-hover:text-[#008751]" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-[0.14em] text-gray-500 group-hover:text-white transition-colors leading-tight">
                    {node.role.startsWith('father_of_') ? 'Père' : node.role.startsWith('mother_of_') ? 'Mère' : ROLE_LABELS[node.role] || 'Ajouter'}
                  </span>
                  <span className="mt-0.5 text-[8px] font-semibold text-gray-700 group-hover:text-emerald-500/70 transition-colors uppercase tracking-wider">
                    Cliquer pour ajouter
                  </span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* ─── Empty state ─── */}
      {persons.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
          <div className="text-center max-w-xs">
            <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-gradient-to-br from-[#008751]/20 to-[#FCD116]/10 flex items-center justify-center" style={{ border: `1px solid var(--panel-border)` }}>
              <Plus size={24} className="text-[#008751]" />
            </div>
            <p className="text-sm font-black text-white mb-1">Commencez votre arbre</p>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              Cliquez sur un emplacement pour ajouter votre premier membre de famille
            </p>
          </div>
        </div>
      )}
    </div>
  );
}