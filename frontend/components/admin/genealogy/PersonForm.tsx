'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { RelationRole, Gender, Person } from '@/lib/genealogy/types';
import { ROLE_LABELS } from '@/lib/genealogy/requirements';
import { useTheme } from '@/lib/theme/ThemeContext';
import {
  UserPlus, Save, UserCheck, Loader2, X, Calendar,
  MapPin, ScrollText, Mars, Venus, CircleUser, Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PersonFormProps {
  treeId: string;
  persons: Person[];
  onSaved?: () => void;
  presetRole?: string | null;
  selectedPerson?: Person | null;
  onCancelEdit?: () => void;
  /** ID of the person from which we're adding a relative (context for add_father/add_mother/add_child) */
  contextPersonId?: string | null;
  /** Action type: 'add_father', 'add_mother', 'add_child', 'add_sibling', 'add_partner' */
  addAction?: string | null;
}

/* ---------------------------------- styles ---------------------------------- */

const IC =
  'peer w-full bg-[var(--panel-surface-alt)] border border-[var(--panel-border)] rounded-xl py-2.5 pl-9 pr-3 text-[var(--panel-text)] text-[13px] ' +
  'focus:outline-none focus:border-emerald-500/60 focus:bg-emerald-500/[0.04] ' +
  'focus:ring-2 focus:ring-emerald-500/10 placeholder:text-[var(--panel-text-faint)] transition-all duration-300';

const LC =
  'text-[10px] font-black mb-1.5 ml-0.5 block uppercase tracking-[0.18em] text-[var(--panel-text-muted)]';

const SEL =
  'w-full appearance-none bg-[var(--panel-surface)] border border-[var(--panel-border)] rounded-xl py-2.5 pl-3 pr-9 ' +
  'text-[var(--panel-text)] text-[13px] focus:outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/10 ' +
  'transition-all duration-300 cursor-pointer';

/* --------------------------------- component -------------------------------- */

export default function PersonForm({
  treeId,
  persons,
  onSaved,
  presetRole,
  selectedPerson,
  onCancelEdit,
  contextPersonId,
  addAction,
}: PersonFormProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    gender: 'male' as Gender,
    birth_date: '',
    birth_place: '',
    death_date: '',
    death_place: '',
    relation_role: 'father' as RelationRole,
    notes: '',
    avatar_url: '',
  });

  const [fatherId, setFatherId] = useState<string | null>(null);
  const [motherId, setMotherId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const lastSessionKeyRef = useRef<string | null>(null);
  const lastRelationRoleRef = useRef<RelationRole | null>(null);

  /* ── Map: for a given GG role, what trisaïeul role is the father / mother ── */
  const TRISAIEUL_ROLE_MAP: Record<string, { father: RelationRole; mother: RelationRole }> = {
    paternal_ggf_1: { father: 'trisaieul_paternal_ggf1_f', mother: 'trisaieul_paternal_ggf1_m' },
    paternal_ggm_1: { father: 'trisaieul_paternal_ggm1_f', mother: 'trisaieul_paternal_ggm1_m' },
    paternal_ggf_2: { father: 'trisaieul_paternal_ggf2_f', mother: 'trisaieul_paternal_ggf2_m' },
    paternal_ggm_2: { father: 'trisaieul_paternal_ggm2_f', mother: 'trisaieul_paternal_ggm2_m' },
    maternal_ggf_1: { father: 'trisaieul_maternal_ggf1_f', mother: 'trisaieul_maternal_ggf1_m' },
    maternal_ggm_1: { father: 'trisaieul_maternal_ggm1_f', mother: 'trisaieul_maternal_ggm1_m' },
    maternal_ggf_2: { father: 'trisaieul_maternal_ggf2_f', mother: 'trisaieul_maternal_ggf2_m' },
    maternal_ggm_2: { father: 'trisaieul_maternal_ggm2_f', mother: 'trisaieul_maternal_ggm2_m' },
  };

  /* ── Compute correct role for add_father/add_mother based on context person's role ── */
  function computeRoleForParentAction(action: 'add_father' | 'add_mother', ctxPerson: Person): RelationRole {
    const ctxRole = ctxPerson.is_self ? 'self' : (ctxPerson.relation_role || '');
    const isFather = action === 'add_father';

    // Context is self → adding father/mother
    if (ctxRole === 'self') return isFather ? 'father' : 'mother';
    // Context is father → paternal grandparents
    if (ctxRole === 'father') return isFather ? 'paternal_grandfather' : 'paternal_grandmother';
    // Context is mother → maternal grandparents
    if (ctxRole === 'mother') return isFather ? 'maternal_grandfather' : 'maternal_grandmother';
    // Context is a grandparent → arrière-grand-parents
    if (ctxRole === 'paternal_grandfather') return isFather ? 'paternal_ggf_1' : 'paternal_ggm_1';
    if (ctxRole === 'paternal_grandmother') return isFather ? 'paternal_ggf_2' : 'paternal_ggm_2';
    if (ctxRole === 'maternal_grandfather') return isFather ? 'maternal_ggf_1' : 'maternal_ggm_1';
    if (ctxRole === 'maternal_grandmother') return isFather ? 'maternal_ggf_2' : 'maternal_ggm_2';
    // Context is an arrière-grand-parent → trisaïeul
    const trisMap = TRISAIEUL_ROLE_MAP[ctxRole];
    if (trisMap) return isFather ? trisMap.father : trisMap.mother;
    // Fallback: generic ancestor
    return 'ancestor';
  }

  useEffect(() => {
    const sessionKey = selectedPerson
      ? `edit-${selectedPerson.id}`
      : `add-${addAction || ''}-${contextPersonId || ''}-${presetRole || ''}`;

    const hasPersons = persons.length > 0;
    const isNewSession = lastSessionKeyRef.current !== sessionKey;

    if (isNewSession && hasPersons) {
      lastSessionKeyRef.current = sessionKey;

      let targetRole: RelationRole = 'father';

      if (selectedPerson) {
        targetRole = (selectedPerson.relation_role as RelationRole) || 'other';
        setForm({
          first_name: selectedPerson.first_name || '',
          last_name: selectedPerson.last_name || '',
          gender: (selectedPerson.gender as Gender) || 'male',
          birth_date: selectedPerson.birth_date || '',
          birth_place: selectedPerson.birth_place || '',
          death_date: selectedPerson.death_date || '',
          death_place: selectedPerson.death_place || '',
          relation_role: targetRole,
          notes: selectedPerson.notes || '',
          avatar_url: selectedPerson.avatar_url || '',
        });
        setFatherId(selectedPerson.father_id || null);
        setMotherId(selectedPerson.mother_id || null);
      } else if (addAction && contextPersonId) {
        const contextPerson = persons.find(p => p.id === contextPersonId);
        if (addAction === 'add_father') {
          targetRole = contextPerson ? computeRoleForParentAction('add_father', contextPerson) : 'ancestor';
          setForm({
            first_name: '',
            last_name: '',
            gender: 'male',
            birth_date: '',
            birth_place: '',
            death_date: '',
            death_place: '',
            relation_role: targetRole,
            notes: '',
            avatar_url: '',
          });
          setFatherId(null);
          setMotherId(null);
        } else if (addAction === 'add_mother') {
          targetRole = contextPerson ? computeRoleForParentAction('add_mother', contextPerson) : 'ancestor';
          setForm({
            first_name: '',
            last_name: '',
            gender: 'female',
            birth_date: '',
            birth_place: '',
            death_date: '',
            death_place: '',
            relation_role: targetRole,
            notes: '',
            avatar_url: '',
          });
          setFatherId(null);
          setMotherId(null);
        } else if (addAction === 'add_child') {
          targetRole = 'child';
          setForm({
            first_name: '',
            last_name: '',
            gender: 'male',
            birth_date: '',
            birth_place: '',
            death_date: '',
            death_place: '',
            relation_role: targetRole,
            notes: '',
            avatar_url: '',
          });
          let fId: string | null = null;
          let mId: string | null = null;
          if (contextPerson) {
            // Step 1: Set the contextPerson as the appropriate parent
            if (contextPerson.gender === 'male') {
              fId = contextPerson.id;
            } else {
              mId = contextPerson.id;
            }

            // Step 2: Find the co-parent (partner) of contextPerson
            // Strategy A: Look at existing children that have contextPerson as a parent
            //             and find the OTHER parent from those children
            let coParent: Person | undefined;
            for (const child of persons) {
              if (child.id === contextPerson.id) continue;
              if (contextPerson.gender === 'male' && child.father_id === contextPerson.id && child.mother_id) {
                coParent = persons.find(p => p.id === child.mother_id);
                if (coParent) break;
              } else if (contextPerson.gender === 'female' && child.mother_id === contextPerson.id && child.father_id) {
                coParent = persons.find(p => p.id === child.father_id);
                if (coParent) break;
              }
            }

            // Strategy B: If no existing children, look for a partner who shares
            //             the same parents as contextPerson's spouse (linked via partner roles)
            //             Only match partners that share parent links with contextPerson
            if (!coParent) {
              coParent = persons.find(p =>
                p.id !== contextPerson.id &&
                ['husband', 'wife', 'fiance', 'fiancee'].includes(p.relation_role || '') &&
                // Ensure this partner is actually linked to the contextPerson:
                // Either they share a child, or contextPerson also has a partner role
                (
                  ['husband', 'wife', 'fiance', 'fiancee', 'self'].includes(contextPerson.relation_role || '') ||
                  contextPerson.is_self
                )
              );
            }

            // Step 3: Assign the co-parent
            if (coParent) {
              if (coParent.gender === 'male' && !fId) fId = coParent.id;
              else if (coParent.gender === 'female' && !mId) mId = coParent.id;
            }
          }
          setFatherId(fId);
          setMotherId(mId);
        } else if (addAction === 'add_sibling') {
          // Determine the correct sibling role based on context person's role
          const ctxRole = contextPerson?.is_self ? 'self' : (contextPerson?.relation_role || '');

          // Map each role to its corresponding sibling_of_* role
          const siblingRoleMap: Record<string, RelationRole> = {
            self: 'sibling',
            // GP-level siblings
            paternal_grandfather: 'sibling_of_paternal_grandfather',
            paternal_grandmother: 'sibling_of_paternal_grandmother',
            maternal_grandfather: 'sibling_of_maternal_grandfather',
            maternal_grandmother: 'sibling_of_maternal_grandmother',
            // GG-level siblings
            paternal_ggf_1: 'sibling_of_paternal_ggf_1',
            paternal_ggm_1: 'sibling_of_paternal_ggm_1',
            paternal_ggf_2: 'sibling_of_paternal_ggf_2',
            paternal_ggm_2: 'sibling_of_paternal_ggm_2',
            maternal_ggf_1: 'sibling_of_maternal_ggf_1',
            maternal_ggm_1: 'sibling_of_maternal_ggm_1',
            maternal_ggf_2: 'sibling_of_maternal_ggf_2',
            maternal_ggm_2: 'sibling_of_maternal_ggm_2',
            // Parent-level siblings (oncles/tantes)
            father: 'paternal_uncle',
            mother: 'maternal_uncle',
          };

          targetRole = siblingRoleMap[ctxRole] || 'ancestor';

          setForm({
            first_name: '',
            last_name: '',
            gender: 'male',
            birth_date: '',
            birth_place: '',
            death_date: '',
            death_place: '',
            relation_role: targetRole,
            notes: '',
            avatar_url: '',
          });
          if (contextPerson) {
            setFatherId(contextPerson.father_id || null);
            setMotherId(contextPerson.mother_id || null);
          } else {
            setFatherId(null);
            setMotherId(null);
          }
        } else if (addAction === 'add_partner') {
          targetRole = 'wife';
          setForm({
            first_name: '',
            last_name: '',
            gender: 'female',
            birth_date: '',
            birth_place: '',
            death_date: '',
            death_place: '',
            relation_role: targetRole,
            notes: '',
            avatar_url: '',
          });
          setFatherId(null);
          setMotherId(null);
        }
      } else {
        targetRole = (presetRole as RelationRole) || 'father';
        setForm({
          first_name: '',
          last_name: '',
          gender: 'male',
          birth_date: '',
          birth_place: '',
          death_date: '',
          death_place: '',
          relation_role: targetRole,
          notes: '',
          avatar_url: '',
        });
        const { father_id, mother_id } = resolveParents(targetRole);
        setFatherId(father_id);
        setMotherId(mother_id);
      }

      lastRelationRoleRef.current = targetRole;
    }
  }, [selectedPerson, addAction, contextPersonId, presetRole, persons]);

  useEffect(() => {
    if (!selectedPerson && !addAction && form.relation_role !== lastRelationRoleRef.current) {
      lastRelationRoleRef.current = form.relation_role;
      const { father_id, mother_id } = resolveParents(form.relation_role);
      setFatherId(father_id);
      setMotherId(mother_id);
    }
  }, [form.relation_role, selectedPerson, addAction, persons]);

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  function flash(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setUploadingAvatar(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${treeId}/avatar_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('genealogia-avatars')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('genealogia-avatars')
        .getPublicUrl(fileName);

      set('avatar_url', publicUrl);
      flash('Photo téléchargée avec succès ! ', true);
    } catch (err: any) {
      flash('Erreur photo : ' + err.message, false);
    } finally {
      setUploadingAvatar(false);
    }
  };

  function resolveParents(role: RelationRole): { father_id: string | null; mother_id: string | null } {
    const findId = (r: RelationRole) => persons.find(p => p.relation_role === r || (r === 'self' && p.is_self))?.id || null;
    
    switch (role) {
      case 'self':
        return { father_id: findId('father'), mother_id: findId('mother') };
      case 'father':
        return { father_id: findId('paternal_grandfather'), mother_id: findId('paternal_grandmother') };
      case 'mother':
        return { father_id: findId('maternal_grandfather'), mother_id: findId('maternal_grandmother') };
      case 'paternal_grandfather':
        return { father_id: findId('paternal_ggf_1'), mother_id: findId('paternal_ggm_1') };
      case 'paternal_grandmother':
        return { father_id: findId('paternal_ggf_2'), mother_id: findId('paternal_ggm_2') };
      case 'maternal_grandfather':
        return { father_id: findId('maternal_ggf_1'), mother_id: findId('maternal_ggm_1') };
      case 'maternal_grandmother':
        return { father_id: findId('maternal_ggf_2'), mother_id: findId('maternal_ggm_2') };
      /* Arrière-grands-parents → trisaïeuls */
      case 'paternal_ggf_1':
        return { father_id: findId('trisaieul_paternal_ggf1_f'), mother_id: findId('trisaieul_paternal_ggf1_m') };
      case 'paternal_ggm_1':
        return { father_id: findId('trisaieul_paternal_ggm1_f'), mother_id: findId('trisaieul_paternal_ggm1_m') };
      case 'paternal_ggf_2':
        return { father_id: findId('trisaieul_paternal_ggf2_f'), mother_id: findId('trisaieul_paternal_ggf2_m') };
      case 'paternal_ggm_2':
        return { father_id: findId('trisaieul_paternal_ggm2_f'), mother_id: findId('trisaieul_paternal_ggm2_m') };
      case 'maternal_ggf_1':
        return { father_id: findId('trisaieul_maternal_ggf1_f'), mother_id: findId('trisaieul_maternal_ggf1_m') };
      case 'maternal_ggm_1':
        return { father_id: findId('trisaieul_maternal_ggm1_f'), mother_id: findId('trisaieul_maternal_ggm1_m') };
      case 'maternal_ggf_2':
        return { father_id: findId('trisaieul_maternal_ggf2_f'), mother_id: findId('trisaieul_maternal_ggf2_m') };
      case 'maternal_ggm_2':
        return { father_id: findId('trisaieul_maternal_ggm2_f'), mother_id: findId('trisaieul_maternal_ggm2_m') };
      case 'brother':
      case 'sister':
      case 'sibling':
        return { father_id: findId('father'), mother_id: findId('mother') };
      case 'paternal_uncle':
      case 'paternal_aunt':
        return { father_id: findId('paternal_grandfather'), mother_id: findId('paternal_grandmother') };
      case 'maternal_uncle':
      case 'maternal_aunt':
        return { father_id: findId('maternal_grandfather'), mother_id: findId('maternal_grandmother') };
      case 'husband':
      case 'wife':
      case 'fiance':
      case 'fiancee':
        // Partners don't auto-resolve parents from the tree
        return { father_id: null, mother_id: null };
      case 'child':
        // NOTE: When addAction is set, the useEffect already set the correct parent IDs.
        // This branch only runs for role-dropdown changes without addAction context.
        const self = persons.find(p => p.is_self || p.relation_role === 'self');
        const partner = persons.find(p => ['husband', 'wife', 'fiance', 'fiancee'].includes(p.relation_role || ''));
        if (!self) return { father_id: partner?.gender === 'male' ? partner.id : null, mother_id: partner?.gender === 'female' ? partner.id : null };
        // Assign self and partner as parents based on gender
        let fId: string | null = null;
        let mId: string | null = null;
        if (self.gender === 'male') { fId = self.id; } else { mId = self.id; }
        if (partner) {
          if (partner.gender === 'male' && !fId) { fId = partner.id; }
          else if (partner.gender === 'female' && !mId) { mId = partner.id; }
          else if (!fId) { fId = partner.id; }
          else if (!mId) { mId = partner.id; }
        }
        return { father_id: fId, mother_id: mId };
      default:
        // Trisaïeul roles and others don't auto-resolve parents
        return { father_id: null, mother_id: null };
    }
  }

  async function syncTreeRelations(treeId: string) {
    try {
      const { data: latestPersons, error } = await supabase
        .from('persons')
        .select('*')
        .eq('tree_id', treeId);
      if (error || !latestPersons) return;

      const getExpectedParentsForRole = (p: Person, pList: Person[]): { fatherId: string | null; motherId: string | null } => {
        const findIdByRole = (r: RelationRole) => pList.find(x => x.relation_role === r || (r === 'self' && x.is_self))?.id || null;
        const role = (p.is_self ? 'self' : p.relation_role) as RelationRole;

        switch (role) {
          case 'self':
            return { fatherId: findIdByRole('father'), motherId: findIdByRole('mother') };
          case 'father':
            return { fatherId: findIdByRole('paternal_grandfather'), motherId: findIdByRole('paternal_grandmother') };
          case 'mother':
            return { fatherId: findIdByRole('maternal_grandfather'), motherId: findIdByRole('maternal_grandmother') };
          case 'paternal_grandfather':
            return { fatherId: findIdByRole('paternal_ggf_1'), motherId: findIdByRole('paternal_ggm_1') };
          case 'paternal_grandmother':
            return { fatherId: findIdByRole('paternal_ggf_2'), motherId: findIdByRole('paternal_ggm_2') };
          case 'maternal_grandfather':
            return { fatherId: findIdByRole('maternal_ggf_1'), motherId: findIdByRole('maternal_ggm_1') };
          case 'maternal_grandmother':
            return { fatherId: findIdByRole('maternal_ggf_2'), motherId: findIdByRole('maternal_ggm_2') };
          case 'paternal_ggf_1':
            return { fatherId: findIdByRole('trisaieul_paternal_ggf1_f'), motherId: findIdByRole('trisaieul_paternal_ggf1_m') };
          case 'paternal_ggm_1':
            return { fatherId: findIdByRole('trisaieul_paternal_ggm1_f'), motherId: findIdByRole('trisaieul_paternal_ggm1_m') };
          case 'paternal_ggf_2':
            return { fatherId: findIdByRole('trisaieul_paternal_ggf2_f'), motherId: findIdByRole('trisaieul_paternal_ggf2_m') };
          case 'paternal_ggm_2':
            return { fatherId: findIdByRole('trisaieul_paternal_ggm2_f'), motherId: findIdByRole('trisaieul_paternal_ggm2_m') };
          case 'maternal_ggf_1':
            return { fatherId: findIdByRole('trisaieul_maternal_ggf1_f'), motherId: findIdByRole('trisaieul_maternal_ggf1_m') };
          case 'maternal_ggm_1':
            return { fatherId: findIdByRole('trisaieul_maternal_ggm1_f'), motherId: findIdByRole('trisaieul_maternal_ggm1_m') };
          case 'maternal_ggf_2':
            return { fatherId: findIdByRole('trisaieul_maternal_ggf2_f'), motherId: findIdByRole('trisaieul_maternal_ggf2_m') };
          case 'maternal_ggm_2':
            return { fatherId: findIdByRole('trisaieul_maternal_ggm2_f'), motherId: findIdByRole('trisaieul_maternal_ggm2_m') };
          case 'brother':
          case 'sister':
          case 'sibling':
            if (p.father_id || p.mother_id) {
              const fatherExists = p.father_id ? pList.some(x => x.id === p.father_id) : false;
              const motherExists = p.mother_id ? pList.some(x => x.id === p.mother_id) : false;
              return {
                fatherId: fatherExists ? p.father_id : null,
                motherId: motherExists ? p.mother_id : null,
              };
            }
            return { fatherId: findIdByRole('father'), motherId: findIdByRole('mother') };
          case 'paternal_uncle':
          case 'paternal_aunt':
            if (p.father_id || p.mother_id) {
              const fatherExists = p.father_id ? pList.some(x => x.id === p.father_id) : false;
              const motherExists = p.mother_id ? pList.some(x => x.id === p.mother_id) : false;
              return {
                fatherId: fatherExists ? p.father_id : null,
                motherId: motherExists ? p.mother_id : null,
              };
            }
            return { fatherId: findIdByRole('paternal_grandfather'), motherId: findIdByRole('paternal_grandmother') };
          case 'maternal_uncle':
          case 'maternal_aunt':
            if (p.father_id || p.mother_id) {
              const fatherExists = p.father_id ? pList.some(x => x.id === p.father_id) : false;
              const motherExists = p.mother_id ? pList.some(x => x.id === p.mother_id) : false;
              return {
                fatherId: fatherExists ? p.father_id : null,
                motherId: motherExists ? p.mother_id : null,
              };
            }
            return { fatherId: findIdByRole('maternal_grandfather'), motherId: findIdByRole('maternal_grandmother') };
          case 'child':
            // CRITICAL: Always preserve explicitly-set parent IDs for children.
            // A child's father_id and mother_id are the source of truth once set.
            // Only fill in missing parents using self/partner heuristics.
            if (p.father_id || p.mother_id) {
              // Verify the referenced parents still exist in the tree
              const fatherExists = p.father_id ? pList.some(x => x.id === p.father_id) : false;
              const motherExists = p.mother_id ? pList.some(x => x.id === p.mother_id) : false;
              return {
                fatherId: fatherExists ? p.father_id : null,
                motherId: motherExists ? p.mother_id : null,
              };
            }
            // No parents set yet: try to assign self + partner as default parents
            const selfPerson = pList.find(x => x.is_self || x.relation_role === 'self');
            const partnerPerson = pList.find(x => ['husband', 'wife', 'fiance', 'fiancee'].includes(x.relation_role || ''));
            let cFatherId: string | null = null;
            let cMotherId: string | null = null;
            if (selfPerson) {
              if (selfPerson.gender === 'male') { cFatherId = selfPerson.id; } else { cMotherId = selfPerson.id; }
            }
            if (partnerPerson) {
              if (partnerPerson.gender === 'male' && !cFatherId) { cFatherId = partnerPerson.id; }
              else if (partnerPerson.gender === 'female' && !cMotherId) { cMotherId = partnerPerson.id; }
              else if (!cFatherId) { cFatherId = partnerPerson.id; }
              else if (!cMotherId) { cMotherId = partnerPerson.id; }
            }
            return { fatherId: cFatherId, motherId: cMotherId };
          /* Collatéraux: fratrie des GP et GG — preserve parent links */
          case 'sibling_of_paternal_grandfather':
          case 'sibling_of_paternal_grandmother':
          case 'sibling_of_maternal_grandfather':
          case 'sibling_of_maternal_grandmother':
          case 'sibling_of_paternal_ggf_1':
          case 'sibling_of_paternal_ggm_1':
          case 'sibling_of_paternal_ggf_2':
          case 'sibling_of_paternal_ggm_2':
          case 'sibling_of_maternal_ggf_1':
          case 'sibling_of_maternal_ggm_1':
          case 'sibling_of_maternal_ggf_2':
          case 'sibling_of_maternal_ggm_2':
          case 'ancestor':
          case 'other':
            // Preserve existing parent IDs but validate they still exist
            if (p.father_id || p.mother_id) {
              const fatherExists = p.father_id ? pList.some(x => x.id === p.father_id) : false;
              const motherExists = p.mother_id ? pList.some(x => x.id === p.mother_id) : false;
              return {
                fatherId: fatherExists ? p.father_id : null,
                motherId: motherExists ? p.mother_id : null,
              };
            }
            return { fatherId: null, motherId: null };
          default:
            return { fatherId: p.father_id, motherId: p.mother_id };
        }
      };

      for (const p of latestPersons) {
        const role = (p.is_self ? 'self' : p.relation_role) as RelationRole;
        if (!role) continue;

        const expected = getExpectedParentsForRole(p, latestPersons);

        if (p.father_id !== expected.fatherId || p.mother_id !== expected.motherId) {
          await supabase
            .from('persons')
            .update({
              father_id: expected.fatherId,
              mother_id: expected.motherId,
            })
            .eq('id', p.id);
        }
      }
    } catch (e) {
      console.error('Error syncing tree relations:', e);
    }
  }

  async function save() {
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');

      const isEdit = !!selectedPerson;
      const payload = {
        tree_id: treeId,
        user_id: user.id,
        first_name: form.first_name || null,
        last_name: form.last_name || null,
        gender: form.gender,
        birth_date: form.birth_date || null,
        birth_place: form.birth_place || null,
        death_date: form.death_date || null,
        death_place: form.death_place || null,
        relation_role: form.relation_role,
        is_self: form.relation_role === 'self',
        notes: form.notes || null,
        avatar_url: form.avatar_url || null,
        father_id: fatherId || null,
        mother_id: motherId || null,
      };

      if (isEdit) {
        const { error } = await supabase
          .from('persons')
          .update(payload)
          .eq('id', selectedPerson.id);
        if (error) throw error;
        flash('Membre mis à jour avec succès', true);
      } else {
        const { data: insertedData, error } = await supabase.from('persons').insert(payload).select();
        if (error) throw error;
        
        // If we just added a father or mother via context, update the context person's father_id/mother_id
        if (addAction && contextPersonId && insertedData && insertedData[0]) {
          const newPersonId = insertedData[0].id;
          if (addAction === 'add_father') {
            await supabase.from('persons').update({ father_id: newPersonId }).eq('id', contextPersonId);
          } else if (addAction === 'add_mother') {
            await supabase.from('persons').update({ mother_id: newPersonId }).eq('id', contextPersonId);
          }
        }
        
        flash('Membre ajouté à votre arbre', true);
      }

      await syncTreeRelations(treeId);

      onSaved?.();

      if (!isEdit) {
        setForm({
          first_name: '',
          last_name: '',
          gender: 'male',
          birth_date: '',
          birth_place: '',
          death_date: '',
          death_place: '',
          relation_role: 'father',
          notes: '',
          avatar_url: '',
        });
      }
    } catch (err: any) {
      flash('Erreur : ' + err.message, false);
    } finally {
      setSaving(false);
    }
  }

  const isEditing = !!selectedPerson;
  const initials =
    (form.first_name?.[0] || '') + (form.last_name?.[0] || '') || '?';

  const accent = isEditing ? '#FCD116' : '#008751';

  const genders: { v: Gender; label: string; icon: any }[] = [
    { v: 'male', label: 'Homme', icon: Mars },
    { v: 'female', label: 'Femme', icon: Venus },
    { v: 'other', label: 'Autre', icon: CircleUser },
  ];

  return (
    <div className="relative group">
      {/* Aura lumineuse derrière la carte — visible seulement en thème sombre,
          sinon elle délave la carte blanche (effet « flou » en mode clair) */}
      {isDark && (
        <div
          className="absolute -inset-[1px] rounded-[2rem] opacity-60 blur-md transition-opacity duration-700 group-hover:opacity-100"
          style={{
            background: `conic-gradient(from 180deg, ${accent}22, transparent 25%, #E80000_50%, transparent 75%, ${accent}22)`,
          }}
        />
      )}

      <div 
        className="relative border rounded-[2rem] overflow-hidden"
        style={{
          backgroundColor: isDark ? 'var(--panel-surface)' : '#ffffff',
          borderColor: 'var(--panel-border)',
          opacity: 1,
        }}
      >
        {/* Halo de couleur en haut — discret en clair (0.35 d'un jaune/vert
            étalé sur une carte blanche = voile délavé) */}
        <div
          className="pointer-events-none absolute -top-24 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full blur-[80px]"
          style={{ background: accent, opacity: isDark ? 0.35 : 0.08 }}
        />
        {/* Texture grain subtile — sombre uniquement (invisible/salissant en clair) */}
        {isDark && (
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.025] mix-blend-overlay"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9'/%3E%3C/filter%3E%3Crect width='80' height='80' filter='url(%23n)'/%3E%3C/svg%3E\")",
            }}
          />
        )}

        <div className="relative p-6 space-y-5">
          {/* ---------------------------------- Header --------------------------------- */}
          <div className="flex items-center gap-4">
            {/* Avatar initiales */}
            <div 
              className="relative shrink-0 cursor-pointer group/avatar" 
              onClick={() => document.getElementById('avatar-input')?.click()}
              title="Cliquer pour téléverser une photo"
            >
              <input
                id="avatar-input"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
                disabled={uploadingAvatar}
              />
              {uploadingAvatar ? (
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--panel-surface-hover)] border border-[var(--panel-border)]">
                  <Loader2 size={16} className="animate-spin text-[#008751]" />
                </div>
              ) : form.avatar_url ? (
                <img
                  src={form.avatar_url}
                  alt="Avatar"
                  className="h-14 w-14 rounded-2xl object-cover border border-[var(--panel-border)] shadow-lg ring-1 ring-white/10 group-hover/avatar:opacity-80 transition-opacity"
                />
              ) : (
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-black shadow-lg ring-1 ring-white/10 group-hover/avatar:opacity-80 transition-opacity"
                  style={{
                    color: '#FFFFFF',
                    background: `linear-gradient(135deg, ${accent}, ${accent}55)`,
                  }}
                >
                  {initials.toUpperCase()}
                </div>
              )}
              <span
                className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-lg ring-1 ring-[var(--panel-border)]"
                style={{ backgroundColor: 'var(--panel-surface)' }}
              >
                {isEditing ? (
                  <UserCheck size={13} className="text-[#FCD116]" />
                ) : (
                  <UserPlus size={13} className="text-[#008751]" />
                )}
              </span>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.25em] text-[var(--panel-text-muted)]">
                <Sparkles size={10} style={{ color: accent }} />
                {isEditing ? 'Édition' : 'Création'}
              </div>
              <h3 
                className="truncate text-base font-black font-heading leading-tight"
                style={{ color: 'var(--panel-text-heading)' }}
              >
                {form.first_name || form.last_name
                  ? `${form.first_name} ${form.last_name}`.trim()
                  : isEditing
                    ? 'Modifier la fiche'
                    : 'Nouveau parent'}
              </h3>
              <p className="text-[11px] text-[var(--panel-text-muted)]">
                {ROLE_LABELS[form.relation_role] ?? 'Membre de la lignée'}
              </p>
            </div>
          </div>

          {/* ------------------------------- Identité --------------------------------- */}
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <label className={LC}>Prénom</label>
              <div className="relative">
                <CircleUser
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--panel-text-faint)] peer-focus:text-emerald-400"
                />
                <input
                  type="text"
                  className={IC}
                  placeholder="Prénom"
                  value={form.first_name}
                  onChange={(e) => set('first_name', e.target.value)}
                />
              </div>
            </div>

            <div className="relative">
              <label className={LC}>Nom de famille</label>
              <div className="relative">
                <CircleUser
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--panel-text-faint)] peer-focus:text-emerald-400"
                />
                <input
                  type="text"
                  className={IC}
                  placeholder="Nom"
                  value={form.last_name}
                  onChange={(e) => set('last_name', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* --------------------------- Sélecteur de genre --------------------------- */}
          <div>
            <label className={LC}>Genre / Sexe</label>
            <div className="grid grid-cols-3 gap-2">
              {genders.map(({ v, label, icon: Icon }) => {
                const active = form.gender === v;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => set('gender', v)}
                    className={cn(
                      'flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-[11px] font-bold transition-all duration-300',
                      active
                        ? 'border-emerald-400/40 bg-emerald-500/10 text-[var(--panel-text-heading)] shadow-[0_0_20px_-6px_#008751]'
                        : 'border-[var(--panel-border)] bg-[var(--panel-surface-alt)] text-[var(--panel-text-muted)] hover:border-[var(--panel-border-strong)] hover:text-[var(--panel-text-heading)]'
                    )}
                  >
                    <Icon size={13} className={active ? 'text-emerald-400' : ''} />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ---------------------------- Rôle dans le Plan de composition de Famille --------------------------- */}
          <div className="space-y-1.5 pt-2">
            <label className={LC}>Rôle dans le Plan de composition de Famille</label>
            <div className="relative">
              <select
                className={SEL}
                value={form.relation_role}
                onChange={(e) => set('relation_role', e.target.value as RelationRole)}
              >
                {Object.entries(ROLE_LABELS).map(([k, l]) => (
                  <option 
                    key={k} 
                    value={k} 
                    style={{ backgroundColor: 'var(--panel-surface)', color: 'var(--panel-text)' }}
                  >
                    {l}
                  </option>
                ))}
              </select>
              <svg
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--panel-text-faint)]"
                width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="3"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </div>
          </div>

          {/* ----------------─── Liaisons Parentales Manuelles ───--------------------- */}
          <div className="grid grid-cols-2 gap-3 border-t border-[var(--panel-border)] pt-4">
            <div>
              <label className={LC}>Père (Lien)</label>
              <div className="relative">
                <select
                  className={SEL}
                  value={fatherId || ''}
                  onChange={(e) => setFatherId(e.target.value || null)}
                >
                  <option value="" style={{ backgroundColor: 'var(--panel-surface)', color: 'var(--panel-text)' }}>-- Aucun / Auto --</option>
                  {persons
                    .filter(p => p.id !== selectedPerson?.id)
                    .map(p => (
                      <option 
                        key={p.id} 
                        value={p.id} 
                        style={{ backgroundColor: 'var(--panel-surface)', color: 'var(--panel-text)' }}
                      >
                        {p.first_name || p.last_name ? `${p.first_name || ''} ${p.last_name || ''}`.trim() : 'Sans nom'} ({ROLE_LABELS[p.relation_role || ''] || p.relation_role})
                      </option>
                    ))}
                </select>
                <svg
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--panel-text-faint)]"
                  width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="3"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </div>
            </div>

            <div>
              <label className={LC}>Mère (Lien)</label>
              <div className="relative">
                <select
                  className={SEL}
                  value={motherId || ''}
                  onChange={(e) => setMotherId(e.target.value || null)}
                >
                  <option value="" style={{ backgroundColor: 'var(--panel-surface)', color: 'var(--panel-text)' }}>-- Aucun / Auto --</option>
                  {persons
                    .filter(p => p.id !== selectedPerson?.id)
                    .map(p => (
                      <option 
                        key={p.id} 
                        value={p.id} 
                        style={{ backgroundColor: 'var(--panel-surface)', color: 'var(--panel-text)' }}
                      >
                        {p.first_name || p.last_name ? `${p.first_name || ''} ${p.last_name || ''}`.trim() : 'Sans nom'} ({ROLE_LABELS[p.relation_role || ''] || p.relation_role})
                      </option>
                    ))}
                </select>
                <svg
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--panel-text-faint)]"
                  width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="3"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </div>
            </div>
          </div>

          {/* -------------------------------- Naissance ------------------------------- */}
          <fieldset className="rounded-2xl border border-emerald-500/10 bg-emerald-500/[0.02] p-3.5 space-y-3">
            <legend className="flex items-center gap-1.5 px-2 text-[9px] font-black uppercase tracking-[0.2em] text-emerald-400/80">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Naissance
            </legend>
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <label className={LC}>Date</label>
                <div className="relative">
                  <Calendar size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--panel-text-faint)]" />
                  <input type="date" className={IC} value={form.birth_date} onChange={(e) => set('birth_date', e.target.value)} />
                </div>
              </div>
              <div className="relative">
                <label className={LC}>Lieu</label>
                <div className="relative">
                  <MapPin size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--panel-text-faint)]" />
                  <input type="text" className={IC} placeholder="Cotonou, Paris…" value={form.birth_place} onChange={(e) => set('birth_place', e.target.value)} />
                </div>
              </div>
            </div>
          </fieldset>

          {/* ---------------------------------- Décès --------------------------------- */}
          <fieldset className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-surface-alt)]/20 p-3.5 space-y-3">
            <legend className="flex items-center gap-1.5 px-2 text-[9px] font-black uppercase tracking-[0.2em] text-[var(--panel-text-muted)]">
              <span className="h-1.5 w-1.5 rounded-full bg-gray-500" />
              Décès <span className="font-medium normal-case tracking-normal text-[var(--panel-text-faint)]">(si applicable)</span>
            </legend>
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <label className={LC}>Date</label>
                <div className="relative">
                  <Calendar size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--panel-text-faint)]" />
                  <input type="date" className={IC} value={form.death_date} onChange={(e) => set('death_date', e.target.value)} />
                </div>
              </div>
              <div className="relative">
                <label className={LC}>Lieu</label>
                <div className="relative">
                  <MapPin size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--panel-text-faint)]" />
                  <input type="text" className={IC} placeholder="Lieu de décès" value={form.death_place} onChange={(e) => set('death_place', e.target.value)} />
                </div>
              </div>
            </div>
          </fieldset>

          {/* ---------------------------------- Notes --------------------------------- */}
          <div>
            <label className={LC}>Notes historiques / Anecdotes</label>
            <div className="relative">
              <ScrollText size={14} className="pointer-events-none absolute left-3 top-3 text-[var(--panel-text-faint)]" />
              <textarea
                rows={2}
                className="w-full resize-none rounded-xl border py-2.5 pl-9 pr-3 text-[13px] transition-all duration-300 focus:border-emerald-400/60 focus:bg-emerald-500/[0.04] focus:outline-none focus:ring-2 focus:ring-emerald-400/10"
                placeholder="Habitations, professions, mentions d'affranchissement…"
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                style={{
                  backgroundColor: 'var(--panel-surface-alt)',
                  borderColor: 'var(--panel-border)',
                  color: 'var(--panel-text)',
                }}
              />
            </div>
          </div>

          {/* -------------------------------- Actions --------------------------------- */}
          <div className="flex gap-2.5 pt-1">
            {isEditing && (
              <button
                type="button"
                onClick={onCancelEdit}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-3 text-xs font-bold transition-all"
                style={{
                  borderColor: 'var(--panel-border)',
                  backgroundColor: 'var(--panel-surface-hover)',
                  color: 'var(--panel-text)',
                }}
              >
                <X size={14} /> ANNULER
              </button>
            )}

            <button
              type="button"
              onClick={save}
              disabled={saving}
              className={cn(
                'relative flex flex-[2] items-center justify-center gap-2 overflow-hidden rounded-xl py-3 text-xs font-black uppercase tracking-wider transition-all duration-300 disabled:opacity-70',
                isEditing
                  ? 'bg-gradient-to-r from-[#FCD116] to-[#f0b400] text-black shadow-[0_8px_24px_-8px_#FCD116]'
                  : 'bg-gradient-to-r from-[#008751] to-[#00b56e] text-white shadow-[0_8px_24px_-8px_#008751]'
              )}
            >
              {/* reflet animé */}
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              {saving ? (
                <Loader2 size={15} className="animate-spin" />
              ) : isEditing ? (
                <Save size={15} />
              ) : (
                <UserPlus size={15} />
              )}
              {saving ? 'SAUVEGARDE…' : isEditing ? 'ENREGISTRER' : 'AJOUTER LE PARENT'}
            </button>
          </div>
        </div>

        {/* ---------------------------------- Toast --------------------------------- */}
        {toast && (
          <div
            className={cn(
              'absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2 text-[11px] font-bold backdrop-blur-md animate-in fade-in slide-in-from-bottom-2',
              toast.ok
                ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30'
                : 'bg-red-500/15 text-red-300 ring-1 ring-red-400/30'
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', toast.ok ? 'bg-emerald-400' : 'bg-red-400')} />
            {toast.msg}
          </div>
        )}
      </div>
    </div>
  );
}