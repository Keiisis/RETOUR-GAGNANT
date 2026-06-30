'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Person, DocumentItem, Tree } from '@/lib/genealogy/types';
import { buildAllReports, detectInconsistencies, buildResearchHints } from '@/lib/genealogy/engine';
import DossierProgress from '@/components/admin/genealogy/DossierProgress';
import SmartAlerts from '@/components/admin/genealogy/SmartAlerts';
import ResearchAssistant from '@/components/admin/genealogy/ResearchAssistant';
import DocumentUploader from '@/components/admin/genealogy/DocumentUploader';
import PersonForm from '@/components/admin/genealogy/PersonForm';
import { 
  GitFork, Activity, Clock, Zap, Loader2, Plus, Search,
  Trash2, User, Globe, FileText, HelpCircle, RefreshCw, ChevronLeft, Link2, UserCheck, Eye
} from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';

interface UserProfile {
  id: string;
  full_name: string | null;
  email: string | null;
}

export default function AdminGenealogyPage() {
  const [trees, setTrees] = useState<Tree[]>([]);
  const [selectedTree, setSelectedTree] = useState<Tree | null>(null);
  const [persons, setPersons] = useState<Person[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [userProfiles, setUserProfiles] = useState<UserProfile[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [presetRole, setPresetRole] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Creation States
  const [newClient, setNewClient] = useState({
    first_name: '',
    last_name: '',
    email: '',
    tree_name: '',
    user_id: ''
  });
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Fetch all trees and user profiles
  const loadAllTrees = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      const [treesRes, profilesRes] = await Promise.all([
        supabase.from('trees').select('*').order('created_at', { ascending: false }),
        supabase.from('user_profiles').select('id, full_name, email').order('full_name', { ascending: true })
      ]);

      if (treesRes.error) throw treesRes.error;
      if (profilesRes.error) throw profilesRes.error;

      setTrees(treesRes.data || []);
      setUserProfiles(profilesRes.data || []);
    } catch (err: any) {
      console.error(err);
      alert('Erreur lors du chargement des arbres : ' + err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAllTrees();
  }, [loadAllTrees]);

  // Load persons and documents for the selected tree
  const loadTreeDetails = useCallback(async (tree: Tree, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [personsRes, docsRes] = await Promise.all([
        supabase.from('persons').select('*').eq('tree_id', tree.id),
        supabase.from('genealogy_documents').select('*').eq('tree_id', tree.id)
      ]);

      if (personsRes.error) throw personsRes.error;
      if (docsRes.error) throw docsRes.error;

      setPersons(personsRes.data || []);
      setDocuments(docsRes.data || []);
      
      // Update selected person ref
      if (selectedPerson) {
        const updatedSelected = (personsRes.data || []).find(p => p.id === selectedPerson.id);
        setSelectedPerson(updatedSelected || null);
      }
    } catch (err: any) {
      console.error(err);
      alert('Erreur chargement détails arbre : ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedPerson]);

  const handleSelectTree = (tree: Tree) => {
    setSelectedTree(tree);
    setSelectedPerson(null);
    setPresetRole(null);
    loadTreeDetails(tree);
  };

  const handleBackToList = () => {
    setSelectedTree(null);
    setPersons([]);
    setDocuments([]);
    setSelectedPerson(null);
    loadAllTrees(true);
  };

  // Create new Tree/Client
  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClient.first_name || !newClient.last_name) {
      alert('Veuillez saisir le nom et prénom du client.');
      return;
    }
    setCreating(true);
    try {
      const treeName = newClient.tree_name || `Arbre de ${newClient.first_name} ${newClient.last_name}`;
      const payload: any = {
        name: treeName,
        client_first_name: newClient.first_name,
        client_last_name: newClient.last_name,
        client_email: newClient.email || null,
        user_id: newClient.user_id || null
      };

      const { data: tree, error: treeErr } = await supabase
        .from('trees')
        .insert(payload)
        .select()
        .single();

      if (treeErr) throw treeErr;

      // Create 'self' person record automatically inside tree
      const { error: pErr } = await supabase.from('persons').insert({
        tree_id: tree.id,
        user_id: newClient.user_id || null,
        first_name: newClient.first_name,
        last_name: newClient.last_name,
        is_self: true,
        relation_role: 'self'
      });

      if (pErr) throw pErr;

      alert('Arbre client créé avec succès ! 🌳');
      setNewClient({ first_name: '', last_name: '', email: '', tree_name: '', user_id: '' });
      setShowCreateForm(false);
      loadAllTrees(true);
    } catch (err: any) {
      alert('Erreur création client : ' + err.message);
    } finally {
      setCreating(false);
    }
  };

  // Delete Tree
  const handleDeleteTree = async (id: string, name: string) => {
    if (!window.confirm(`Voulez-vous vraiment supprimer définitivement l'arbre "${name}" ? Cette action est irréversible.`)) return;
    try {
      const { error } = await supabase.from('trees').delete().eq('id', id);
      if (error) throw error;
      alert('Arbre supprimé avec succès.');
      loadAllTrees(true);
    } catch (err: any) {
      alert('Erreur : ' + err.message);
    }
  };

  // Link user account to Tree
  const handleLinkUser = async (userId: string) => {
    if (!selectedTree) return;
    try {
      const { error } = await supabase
        .from('trees')
        .update({ user_id: userId || null })
        .eq('id', selectedTree.id);
      if (error) throw error;

      // Update self person account connection as well
      const selfPerson = persons.find(p => p.is_self);
      if (selfPerson) {
        await supabase.from('persons').update({ user_id: userId || null }).eq('id', selfPerson.id);
      }

      alert('Compte client associé avec succès ! 🔗');
      setSelectedTree({ ...selectedTree, user_id: userId || null });
      loadTreeDetails({ ...selectedTree, user_id: userId || null }, true);
    } catch (err: any) {
      alert('Erreur association : ' + err.message);
    }
  };

  const handleAddRelative = (role?: string) => {
    setSelectedPerson(null);
    setPresetRole(role || null);
  };

  const handleSelectPerson = (person: Person) => {
    setPresetRole(null);
    setSelectedPerson(person);
  };

  const handleCancelEdit = () => {
    setSelectedPerson(null);
    setPresetRole(null);
  };

  const deletePerson = async (id: string) => {
    if (!window.confirm('Voulez-vous vraiment retirer ce parent de l\'arbre ?')) return;
    try {
      const { error } = await supabase.from('persons').delete().eq('id', id);
      if (error) throw error;
      
      alert('Parent retiré avec succès 🗑️');
      setSelectedPerson(null);
      if (selectedTree) loadTreeDetails(selectedTree, true);
    } catch (err: any) {
      alert('Erreur : ' + err.message);
    }
  };

  const reports = buildAllReports(persons, documents);
  const inconsistencies = detectInconsistencies(persons);
  const hints = buildResearchHints(persons);

  const allAlerts = [
    ...reports.afro_descendance.alerts,
    ...reports.ancetre_esclavage.alerts,
    ...inconsistencies,
  ];

  const filteredTrees = trees.filter(t => {
    const fullName = `${t.client_first_name || ''} ${t.client_last_name || ''} ${t.name}`.toLowerCase();
    const email = (t.client_email || '').toLowerCase();
    const query = searchQuery.toLowerCase();
    return fullName.includes(query) || email.includes(query);
  });

  if (loading && trees.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-[#008751]" size={36} />
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
      
      {/* Header sections */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[#FCD116]">
            <GitFork size={18} className="animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-[0.4em]">Dashboard Plan de composition de Famille</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-black text-white font-heading tracking-tight leading-none">
            PLAN DE <span className="text-benin-gradient">COMPOSITION DE FAMILLE</span>
          </h2>
          <p className="text-gray-500 max-w-xl font-medium text-sm">
            {selectedTree 
              ? `Gestion du plan de composition de famille de ${selectedTree.client_first_name} ${selectedTree.client_last_name}.`
              : "Reconstituez les lignées ancestrales des clients. Suivez et validez les pièces administratives d'état civil."
            }
          </p>
        </div>

        <div className="flex items-center gap-6 admin-card border p-4 rounded-3xl backdrop-blur-md">
          {selectedTree && (
            <button
              onClick={handleBackToList}
              className="flex items-center gap-2 admin-btn-ghost font-bold text-xs px-4 py-2.5 rounded-2xl transition-all"
            >
              <ChevronLeft size={14} /> Retour à la liste
            </button>
          )}

          <div className="flex flex-col text-right">
            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Actualiser</span>
            <button
              onClick={() => selectedTree ? loadTreeDetails(selectedTree) : loadAllTrees(true)}
              disabled={refreshing}
              className="flex items-center gap-2 text-white hover:text-[#FCD116] font-mono text-xs transition-colors"
            >
              <RefreshCw size={12} className={refreshing ? "animate-spin text-[#008751]" : "text-[#008751]"} />
              {refreshing ? 'Sync...' : 'Synchronisé'}
            </button>
          </div>
        </div>
      </div>

      {!selectedTree ? (
        // ========================================== LIST VIEW ==========================================
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 admin-card border p-4 rounded-3xl backdrop-blur-md">
            <div className="relative w-full sm:w-80">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="Rechercher un client..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full admin-input border rounded-2xl py-2 pl-10 pr-3 text-xs"
              />
            </div>
            
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="flex items-center gap-2 bg-benin-gradient text-black font-black text-xs px-5 py-3 rounded-2xl shadow-[0_4px_20px_rgba(0,135,81,0.2)] hover:scale-102 transition-transform shrink-0"
            >
              <Plus size={14} /> CRÉER UN ARBRE CLIENT
            </button>
          </div>

          {showCreateForm && (
            <motion.form 
              initial={{ opacity: 0, y: -10 }} 
              animate={{ opacity: 1, y: 0 }}
              onSubmit={handleCreateClient}
              className="admin-card-alt border p-6 rounded-3xl space-y-4 max-w-2xl"
            >
              <h3 className="text-sm font-black uppercase tracking-widest border-b pb-2" style={{ color: 'var(--panel-text-heading)', borderColor: 'var(--panel-border)' }}>
                Nouveau Client Plan de composition de Famille
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Prénom Client</label>
                  <input
                    type="text"
                    required
                    value={newClient.first_name}
                    onChange={e => setNewClient({ ...newClient, first_name: e.target.value })}
                    className="w-full admin-input border rounded-xl py-2 px-3 text-xs"
                    placeholder="ex: Nathalie"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Nom Client</label>
                  <input
                    type="text"
                    required
                    value={newClient.last_name}
                    onChange={e => setNewClient({ ...newClient, last_name: e.target.value })}
                    className="w-full admin-input border rounded-xl py-2 px-3 text-xs"
                    placeholder="ex: Martin"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Email de contact</label>
                  <input
                    type="email"
                    value={newClient.email}
                    onChange={e => setNewClient({ ...newClient, email: e.target.value })}
                    className="w-full admin-input border rounded-xl py-2 px-3 text-xs"
                    placeholder="ex: nathalie.martin@example.com"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">{"Nom de l'arbre (Optionnel)"}</label>
                  <input
                    type="text"
                    value={newClient.tree_name}
                    onChange={e => setNewClient({ ...newClient, tree_name: e.target.value })}
                    className="w-full admin-input border rounded-xl py-2 px-3 text-xs"
                    placeholder="ex: Arbre de la Famille Martin"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Associer à un compte utilisateur du site (Optionnel)</label>
                <select
                  value={newClient.user_id}
                  onChange={e => setNewClient({ ...newClient, user_id: e.target.value })}
                  className="w-full admin-input border rounded-xl py-2 px-3 text-xs"
                  aria-label="Associer à un compte utilisateur"
                >
                  <option value="">-- Ne pas associer pour le moment --</option>
                  {userProfiles.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.full_name || 'Utilisateur'} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 justify-end pt-2 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 admin-btn-ghost rounded-xl text-xs font-bold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 bg-[#008751] hover:bg-[#00a865] text-white rounded-xl text-xs font-black uppercase tracking-wider disabled:opacity-50"
                >
                  {creating ? 'Création...' : "Créer l'arbre"}
                </button>
              </div>
            </motion.form>
          )}

          {/* Grid Layout of clients */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTrees.map(t => {
              const displayName = t.client_first_name 
                ? `${t.client_first_name} ${t.client_last_name}`
                : t.name;

              return (
                <div 
                  key={t.id}
                  className="admin-card backdrop-blur-md border hover:border-emerald-500/20 p-5 rounded-[2rem] space-y-4 relative group overflow-hidden transition-all duration-300"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/[0.02] blur-3xl pointer-events-none" />
                  
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <h4 className="text-base font-black text-white leading-tight truncate max-w-[200px]">
                        {displayName}
                      </h4>
                      <p className="text-[10px] text-gray-500 font-medium">
                        {t.client_email || 'Pas d\'adresse email'}
                      </p>
                    </div>

                    <button
                      onClick={() => handleDeleteTree(t.id, displayName)}
                      title="Supprimer cet arbre"
                      className="p-2 rounded-xl bg-red-500/5 hover:bg-red-500/10 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  <div className="border-t border-white/5 pt-3 space-y-2">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-gray-500 uppercase tracking-widest font-bold">Nom Arbre</span>
                      <span className="text-gray-300 font-mono font-medium">{t.name}</span>
                    </div>

                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-gray-500 uppercase tracking-widest font-bold">Compte associé</span>
                      {t.user_id ? (
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                          <UserCheck size={10} /> Lié
                        </span>
                      ) : (
                        <span className="text-amber-500 font-bold flex items-center gap-1">
                          <Link2 size={10} /> Non lié
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => handleSelectTree(t)}
                      className="flex-1 flex items-center justify-center gap-2 admin-btn-ghost hover:border-emerald-500/40 font-bold text-xs py-2.5 rounded-xl transition-all"
                    >
                      <Activity size={12} className="text-emerald-400" /> Analyser
                    </button>
                    
                    <Link
                      href={`/admin/genealogie/arbre?id=${t.id}`}
                      className="flex-1 flex items-center justify-center gap-2 bg-[#008751] hover:bg-[#00a865] text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-[0_4px_12px_rgba(0,135,81,0.15)]"
                    >
                      <Eye size={12} /> Visualiser
                    </Link>
                  </div>
                </div>
              );
            })}

            {filteredTrees.length === 0 && (
              <div className="col-span-full py-16 admin-card rounded-[2.5rem] border border-dashed text-center">
                <Globe size={28} className="text-gray-600 mx-auto mb-3" />
                <p className="text-sm font-bold text-white">Aucun plan de composition de famille trouvé</p>
                <p className="text-[10px] text-gray-500 mt-1">Créez un nouvel arbre ou ajustez vos critères de recherche.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        // ========================================== DETAILS VIEW ==========================================
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left panel: Info and Association */}
          <div className="lg:col-span-4 space-y-4">
            <div className="admin-card border p-6 rounded-[2rem] space-y-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/[0.01] blur-3xl pointer-events-none" />
              
              <h3 className="text-sm font-black text-white uppercase tracking-widest border-b border-white/5 pb-2">
                Fiche Client
              </h3>
              
              <div className="space-y-3 font-medium">
                <div>
                  <span className="text-[9px] text-gray-500 uppercase tracking-widest font-black">Prénom & Nom</span>
                  <p className="text-sm font-bold text-white mt-0.5">
                    {selectedTree.client_first_name || '—'} {selectedTree.client_last_name || '—'}
                  </p>
                </div>
                <div>
                  <span className="text-[9px] text-gray-500 uppercase tracking-widest font-black">Email de contact</span>
                  <p className="text-sm font-bold text-white mt-0.5">
                    {selectedTree.client_email || 'Non renseigné'}
                  </p>
                </div>
                <div>
                  <span className="text-[9px] text-gray-500 uppercase tracking-widest font-black">{"Nom de l'arbre"}</span>
                  <p className="text-sm font-bold text-white mt-0.5">{selectedTree.name}</p>
                </div>
              </div>

              {/* Association Form */}
              <div className="border-t border-white/5 pt-4 space-y-2">
                <span className="text-[9px] text-gray-500 uppercase tracking-widest font-black block">Lien de Compte Utilisateur</span>
                <select
                  value={selectedTree.user_id || ''}
                  onChange={e => handleLinkUser(e.target.value)}
                  className="w-full admin-input border rounded-xl py-2 px-3 text-xs"
                  aria-label="Lien de compte utilisateur"
                >
                  <option value="">-- Non lié (hors ligne) --</option>
                  {userProfiles.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.full_name || 'Utilisateur'} ({u.email})
                    </option>
                  ))}
                </select>
                <p className="text-[9px] text-gray-600 leading-normal">
                  Une fois lié, le client pourra voir son plan de composition de famille en temps réel depuis son espace membre.
                </p>
              </div>

              <div className="pt-2">
                <Link
                  href={`/admin/genealogie/arbre?id=${selectedTree.id}`}
                  className="w-full flex items-center justify-center gap-2 bg-[#008751] hover:bg-[#00a865] text-white font-black text-xs py-3 rounded-xl transition-all shadow-[0_8px_20px_rgba(0,135,81,0.2)]"
                >
                  <Eye size={14} /> {"Visualiser l'arbre complet"}
                </Link>
              </div>
            </div>

            <DossierProgress report={reports.afro_descendance} />
            <DossierProgress report={reports.ancetre_esclavage} />
          </div>

          {/* Middle: Smart Alerts & Reports */}
          <div className="lg:col-span-4 space-y-4">
            <SmartAlerts alerts={allAlerts} onAlertClick={handleAddRelative} />
            <ResearchAssistant hints={hints} />
          </div>

          {/* Right: Selected Person Docs & Editing Forms */}
          <div className="lg:col-span-4 space-y-4">
            {selectedPerson ? (
              <div className="admin-card border p-6 rounded-[2rem] space-y-4 relative overflow-hidden animate-in slide-in-from-right duration-300">
                <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/5 rounded-full pointer-events-none flex items-center justify-center">
                  <User size={36} className="text-white/10" />
                </div>
                
                <div className="flex justify-between items-start border-b border-white/5 pb-3">
                  <div>
                    <p className="text-[10px] font-bold text-[#FCD116] uppercase tracking-widest font-mono">
                      FICHE ACTIVE
                    </p>
                    <h3 className="text-base font-black text-white font-heading mt-1">
                      {selectedPerson.first_name || '—'} {selectedPerson.last_name || '—'}
                    </h3>
                  </div>
                  
                  <button
                    onClick={() => deletePerson(selectedPerson.id)}
                    title="Retirer cette personne de l'arbre"
                    className="p-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/10 hover:bg-red-500/20 transition-all shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="space-y-2">
                  <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">
                    Déposer une pièce justificative
                  </p>
                  <DocumentUploader 
                    treeId={selectedTree.id} 
                    personId={selectedPerson.id} 
                    onUploaded={() => loadTreeDetails(selectedTree, true)} 
                  />
                </div>

                <div className="space-y-2 pt-2 border-t border-white/5">
                  <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">
                    Pièces Jointes Validées
                  </p>
                  
                  {documents.filter(d => d.person_id === selectedPerson.id).length > 0 ? (
                    <div className="space-y-1.5 max-h-[160px] overflow-y-auto scrollbar-premium pr-1">
                      {documents.filter(d => d.person_id === selectedPerson.id).map(d => (
                        <div 
                          key={d.id} 
                          className="flex items-center justify-between p-2.5 rounded-xl admin-card-alt border hover:bg-[var(--panel-surface-hover)] transition-all"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText size={12} className="text-[#008751] shrink-0" />
                            <a 
                              href={d.file_url ?? '#'} 
                              target="_blank" 
                              rel="noreferrer"
                              className="text-[11px] font-bold text-gray-300 truncate hover:text-[#FCD116] hover:underline transition-all"
                            >
                              {d.title || 'Document'}
                            </a>
                          </div>
                          <span className="text-[8px] font-mono font-bold text-gray-600 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full shrink-0">
                            {d.doc_type}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-gray-600 italic py-2">
                      Aucun document justificatif téléversé pour le moment.
                    </p>
                  )}
                </div>
              </div>
            ) : null}

            <PersonForm 
              treeId={selectedTree.id} 
              persons={persons}
              onSaved={() => loadTreeDetails(selectedTree, true)} 
              presetRole={presetRole}
              selectedPerson={selectedPerson}
              onCancelEdit={handleCancelEdit}
            />
          </div>

        </div>
      )}
    </div>
  );
}
