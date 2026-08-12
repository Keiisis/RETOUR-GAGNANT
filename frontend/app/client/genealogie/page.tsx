'use client';

import { useEffect, useState, useCallback, useRef, lazy, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { Person, DocumentItem, Tree } from '@/lib/genealogy/types';
import FamilyTree from '@/components/admin/genealogy/FamilyTree';
import { ROLE_LABELS } from '@/lib/genealogy/requirements';
import { findSiblings, buildTreeStats } from '@/lib/genealogy/siblings';
import { buildFamilyTimeline, getUpcomingAnniversaries } from '@/lib/genealogy/timeline';
import { useTheme } from '@/lib/theme/ThemeContext';
import { GitFork, MagnifyingGlassPlus as ZoomIn, MagnifyingGlassMinus as ZoomOut, ArrowsOut as Maximize2, CircleNotch as Loader2, User, FileText, X, ShieldCheck, Clock, Calendar, MagnifyingGlass as Search, MapTrifold as Map, ChartBar as BarChart3, Tree as TreeDeciduous, Users } from '@phosphor-icons/react';

// Lazy load the map component (Leaflet is heavy)
const FamilyMap = lazy(() => import('@/components/admin/genealogy/FamilyMap'));

type ViewMode = 'tree' | 'map' | 'stats' | 'timeline' | 'anniversaries';

export default function ClientGenealogyPage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [tree, setTree] = useState<Tree | null>(null);
  const [persons, setPersons] = useState<Person[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);

  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('tree');
  const [searchQuery, setSearchQuery] = useState('');

  // Pan & Zoom States
  const [zoom, setZoom] = useState(0.85);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const viewRef = useRef<HTMLDivElement | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch user's assigned tree
      const { data: treeData, error: treeErr } = await supabase
        .from('trees')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (treeErr) throw treeErr;

      if (!treeData) {
        setTree(null);
        setLoading(false);
        return;
      }

      setTree(treeData);

      // Fetch persons and documents
      const [personsRes, docsRes] = await Promise.all([
        supabase.from('persons').select('*').eq('tree_id', treeData.id),
        supabase.from('genealogy_documents').select('*').eq('tree_id', treeData.id)
      ]);

      if (personsRes.error) throw personsRes.error;
      if (docsRes.error) throw docsRes.error;

      setPersons(personsRes.data || []);
      setDocuments(docsRes.data || []);
    } catch (err: any) {
      console.error(err);
      alert('Erreur chargement de votre arbre : ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Drag to Pan
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('.group')) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Zoom
  const handleZoomIn = () => setZoom(z => Math.min(1.8, z + 0.1));
  const handleZoomOut = () => setZoom(z => Math.max(0.4, z - 0.1));
  const handleResetZoom = () => {
    setZoom(0.85);
    setPan({ x: 0, y: 0 });
  };

  const handleSelectPerson = (person: Person) => {
    setSelectedPerson(person);
  };

  const handleCancelDetail = () => {
    setSelectedPerson(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-[var(--panel-accent)]" size={36} />
      </div>
    );
  }

  if (!tree) {
    return (
      <div className="bg-[#0a0f18]/80 border border-white/5 p-8 rounded-[2.5rem] backdrop-blur-md text-center max-w-xl mx-auto py-16">
        <GitFork size={36} className="text-gray-500 mx-auto mb-4" />
        <h3 className="text-lg font-black text-white uppercase tracking-wider">Arbre en cours de création</h3>
        <p className="text-xs text-gray-500 mt-2 leading-relaxed">
          {"Votre expert n'a pas encore initialisé votre plan de composition de famille ou n'a pas encore lié ce plan à votre compte. "}
          {"Dès que le plan sera prêt, vous pourrez suivre son évolution en temps réel d'ici."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 relative">
      
      {/* Title Header with Zoom tools */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-[var(--panel-accent)]">
            <GitFork size={16} />
            <span className="text-[10px] font-bold uppercase tracking-[0.3em]">Mon Espace Plan de composition de Famille</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-white font-heading mt-1">
            MON <span className="text-[var(--panel-accent)]">PLAN DE COMPOSITION DE FAMILLE</span>
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Search Box */}
          <div className="relative mr-2 hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
            <input
              type="text"
              placeholder="Rechercher un parent..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8 py-1.5 w-44 rounded-xl text-xs border bg-[#0c1322] text-white border-white/5 focus:outline-none focus:border-[var(--panel-accent)]/60 focus:w-60 transition-all duration-300"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
              >
                <X size={12} />
              </button>
            )}
            {/* Search Dropdown Results */}
            {searchQuery && (
              <div 
                className="absolute top-full right-0 mt-2 w-72 rounded-2xl border shadow-2xl p-2 max-h-[300px] overflow-y-auto z-[999] backdrop-blur-xl"
                style={{
                  background: isDark ? 'rgba(7, 11, 19, 0.98)' : 'rgba(255, 255, 255, 0.98)',
                  borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.1)',
                }}
              >
                {persons
                  .filter(p => 
                    `${p.first_name || ''} ${p.last_name || ''}`
                      .toLowerCase()
                      .includes(searchQuery.toLowerCase())
                  )
                  .map(p => (
                    <button
                      key={p.id}
                      onClick={() => {
                        handleSelectPerson(p);
                        setSearchQuery('');
                      }}
                      className="w-full flex items-center gap-3 p-2 rounded-xl text-left hover:bg-white/5 transition-all"
                    >
                      {p.avatar_url ? (
                        <img src={p.avatar_url} className="w-8 h-8 rounded-lg object-cover" />
                      ) : (
                        <div 
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black text-white bg-[var(--panel-accent)]"
                        >
                          {((p.first_name?.[0] || '') + (p.last_name?.[0] || '')).toUpperCase() || '?'}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate text-white">
                          {p.first_name} {p.last_name}
                        </p>
                        <p className="text-[9px] font-mono text-gray-500 uppercase">
                          {ROLE_LABELS[p.relation_role || ''] || 'Membre'}
                        </p>
                      </div>
                    </button>
                  ))}
                {persons.filter(p => 
                  `${p.first_name || ''} ${p.last_name || ''}`
                    .toLowerCase()
                    .includes(searchQuery.toLowerCase())
                ).length === 0 && (
                  <p className="text-[10px] text-center py-4 italic text-gray-500">Aucun membre trouvé</p>
                )}
              </div>
            )}
          </div>

          {/* View Mode Tabs */}
          <div className="flex items-center rounded-xl overflow-hidden bg-[#0c1322] border border-white/5">
            {[
              { key: 'tree' as ViewMode, icon: <TreeDeciduous size={14} />, label: 'Arbre' },
              { key: 'map' as ViewMode, icon: <Map size={14} />, label: 'Carte' },
              { key: 'stats' as ViewMode, icon: <BarChart3 size={14} />, label: 'Stats' },
              { key: 'timeline' as ViewMode, icon: <Clock size={14} />, label: 'Chronologie' },
              { key: 'anniversaries' as ViewMode, icon: <Calendar size={14} />, label: 'Anniv.' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setViewMode(tab.key)}
                className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold transition-all"
                style={{
                  background: viewMode === tab.key
                    ? 'rgba(59,130,246,0.15)'
                    : 'transparent',
                  color: viewMode === tab.key ? '#60a5fa' : '#94a3b8',
                  borderRight: '1px solid rgba(255,255,255,0.05)',
                }}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 bg-[#0c1322] border border-white/5 px-3 py-1.5 rounded-2xl">
            <button
              onClick={handleZoomOut}
              className="p-1 hover:bg-white/5 rounded-xl transition-all text-gray-400 hover:text-white"
              title="Zoom arrière"
            >
              <ZoomOut size={14} />
            </button>
            <span className="text-[10px] font-mono font-bold text-gray-400 min-w-[36px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              className="p-1 hover:bg-white/5 rounded-xl transition-all text-gray-400 hover:text-white"
              title="Zoom avant"
            >
              <ZoomIn size={14} />
            </button>
            <button
              onClick={handleResetZoom}
              className="p-1 hover:bg-white/5 rounded-xl transition-all text-gray-400 hover:text-white"
              title="Réinitialiser"
            >
              <Maximize2 size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Main content area : conditionally rendered based on viewMode */}
      {viewMode === 'tree' && (
        <div 
          ref={viewRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={`relative overflow-hidden bg-[#040810] border border-white/5 rounded-[2.5rem] min-h-[560px] h-[600px] cursor-grab ${isDragging ? 'cursor-grabbing' : ''}`}
        >
          <div 
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)`,
              backgroundSize: '20px 20px'
            }}
          />

          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
              transition: isDragging ? 'none' : 'transform 0.15s ease-out'
            }}
            className="absolute inset-0 flex items-center justify-center pointer-events-auto"
          >
            <FamilyTree
              persons={persons}
              documents={documents}
              selectedPerson={selectedPerson}
              onSelect={handleSelectPerson}
            />
          </div>
        </div>
      )}

      {/* Map View */}
      {viewMode === 'map' && (
        <div className="bg-[#040810] border border-white/5 rounded-[2.5rem] min-h-[560px] h-[600px] relative overflow-hidden">
          <Suspense fallback={
            <div className="w-full h-full flex items-center justify-center">
              <Loader2 className="animate-spin text-[var(--panel-accent)]" size={32} />
            </div>
          }>
            <FamilyMap persons={persons} />
          </Suspense>
        </div>
      )}

      {/* Stats View */}
      {viewMode === 'stats' && (
        <div className="bg-[#040810] border border-white/5 rounded-[2.5rem] p-6 space-y-6 overflow-y-auto max-h-[600px]">
          {(() => {
            const stats = buildTreeStats(persons);
            const selfPerson = persons.find(p => p.is_self || p.relation_role === 'self');
            const selfSiblings = selfPerson ? findSiblings(selfPerson, persons) : null;
            return (
              <div className="max-w-4xl mx-auto space-y-6">
                <div>
                  <h2 className="text-lg font-black text-white"> Statistiques familiales</h2>
                  <p className="text-xs text-gray-500">Vue d'ensemble de vos données de composition de famille</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Membres', value: stats.total, icon: <Users size={18} />, color: '#3b82f6' },
                    { label: 'Hommes', value: stats.males, icon: <span className="text-lg"></span>, color: '#3B82F6' },
                    { label: 'Femmes', value: stats.females, icon: <span className="text-lg"></span>, color: '#EC4899' },
                    { label: 'Générations', value: stats.generationCount, icon: <TreeDeciduous size={18} />, color: '#8B5CF6' },
                  ].map(kpi => (
                    <div
                      key={kpi.label}
                      className="rounded-2xl p-4 bg-[#0a0f18] border border-white/5"
                    >
                      <div className="flex items-center gap-2 mb-2" style={{ color: kpi.color }}>
                        {kpi.icon}
                        <span className="text-[10px] font-bold uppercase tracking-wider">{kpi.label}</span>
                      </div>
                      <p className="text-3xl font-black text-white">{kpi.value}</p>
                    </div>
                  ))}
                </div>

                {/* Data completeness */}
                <div className="rounded-2xl p-5 bg-[#0a0f18] border border-white/5">
                  <h3 className="text-sm font-bold text-white mb-3"> Complétude des données</h3>
                  <div className="space-y-3">
                    {[
                      { label: 'Dates de naissance', value: stats.withBirth, total: stats.total, color: '#10B981' },
                      { label: 'Dates de décès', value: stats.withDeath, total: stats.total, color: '#F59E0B' },
                      { label: 'Lieux renseignés', value: stats.withPlace, total: stats.total, color: '#6366F1' },
                    ].map(bar => (
                      <div key={bar.label}>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="text-gray-400">{bar.label}</span>
                          <span className="font-bold" style={{ color: bar.color }}>{bar.value}/{bar.total}</span>
                        </div>
                        <div className="w-full h-2 rounded-full overflow-hidden bg-white/5">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${bar.total > 0 ? (bar.value / bar.total) * 100 : 0}%`,
                              background: bar.color,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top Places */}
                {stats.topPlaces.length > 0 && (
                  <div className="rounded-2xl p-5 bg-[#0a0f18] border border-white/5">
                    <h3 className="text-sm font-bold text-white mb-3"> Lieux les plus fréquents</h3>
                    <div className="space-y-2">
                      {stats.topPlaces.map((p, i) => (
                        <div
                          key={p.place}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02]"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-white"
                              style={{ background: ['#3B82F6','#10B981','#8B5CF6','#EC4899','#F59E0B'][i] || '#6B7280' }}
                            >
                              {i + 1}
                            </span>
                            <span className="text-xs font-medium text-white">{p.place}</span>
                          </div>
                          <span className="text-[10px] font-bold text-gray-500">{p.count} mention{p.count > 1 ? 's' : ''}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Siblings */}
                {selfSiblings && (selfSiblings.fullSiblings.length > 0 || selfSiblings.halfSiblings.length > 0) && (
                  <div className="rounded-2xl p-5 bg-[#0a0f18] border border-white/5">
                    <h3 className="text-sm font-bold text-white mb-3">‍‍‍ Fratrie du proposant</h3>
                    {selfSiblings.fullSiblings.length > 0 && (
                      <div className="mb-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider mb-2 text-emerald-400">Frères/Sœurs (mêmes parents)</p>
                        <div className="flex flex-wrap gap-2">
                          {selfSiblings.fullSiblings.map(s => (
                            <span
                              key={s.id}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            >
                              {s.first_name || 'N/A'} {s.last_name || ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {selfSiblings.halfSiblings.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider mb-2 text-amber-400">Demi-frères/Demi-sœurs</p>
                        <div className="flex flex-wrap gap-2">
                          {selfSiblings.halfSiblings.map(s => (
                            <span
                              key={s.id}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            >
                              {s.first_name || 'N/A'} {s.last_name || ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Timeline View */}
      {viewMode === 'timeline' && (
        <div className="bg-[#040810] border border-white/5 rounded-[2.5rem] p-6 space-y-6 overflow-y-auto max-h-[600px]">
          <div className="max-w-3xl mx-auto space-y-6">
            <div>
              <h2 className="text-lg font-black text-white">⏳ Chronologie familiale</h2>
              <p className="text-xs text-gray-500">Histoire temporelle des événements de la famille</p>
            </div>

            <div className="relative border-l border-[var(--panel-accent)]/20 ml-4 pl-8 space-y-8">
              {buildFamilyTimeline(persons).map((event) => {
                const p = event.person;
                const isBirth = event.type === 'birth';
                return (
                  <div key={event.id} className="relative group/item">
                    {/* Circle Node on line */}
                    <div 
                      className="absolute -left-[41px] top-1.5 w-6 h-6 rounded-full border-2 flex items-center justify-center bg-[#040810] transition-all duration-300"
                      style={{
                        borderColor: isBirth ? '#3b82f6' : '#6B7280',
                      }}
                    >
                      {isBirth ? (
                        <span className="text-[10px]" title="Naissance"></span>
                      ) : (
                        <span className="text-[10px]" title="Décès"></span>
                      )}
                    </div>

                    {/* Timeline Event Card */}
                    <div 
                      onClick={() => handleSelectPerson(p)}
                      className="p-4 rounded-2xl border cursor-pointer bg-[#0a0f18] border-white/5 hover:border-[var(--panel-accent)]/50 hover:shadow-lg transition-all duration-300"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-sm font-black font-mono text-[var(--panel-accent)]">
                          {event.year}
                        </span>
                        <span className="text-[8px] font-mono font-black uppercase px-2 py-0.5 rounded-full bg-white/5 text-gray-400 border border-white/10">
                          {ROLE_LABELS[p.relation_role || ''] || 'Membre'}
                        </span>
                      </div>
                      
                      <h4 className="text-xs font-bold text-white group-hover/item:text-[var(--panel-accent)] transition-colors">
                        {p.first_name} {p.last_name}
                      </h4>

                      <p className="text-[11px] text-gray-400 mt-1.5">
                        {isBirth ? (
                          <>Naissance {event.place ? `à ${event.place}` : ''}</>
                        ) : (
                          <>
                            Décès {event.place ? `à ${event.place}` : ''}
                            {event.ageAtEvent !== null && ` à l'âge de ${event.ageAtEvent} ans`}
                          </>
                        )}
                      </p>

                      {p.notes && (
                        <p className="text-[10px] italic text-gray-500 mt-2 line-clamp-2">
                          {p.notes}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
              {persons.length === 0 && (
                <p className="text-xs italic text-gray-500">Aucun événement à afficher.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Anniversaries View */}
      {viewMode === 'anniversaries' && (
        <div className="bg-[#040810] border border-white/5 rounded-[2.5rem] p-6 space-y-6 overflow-y-auto max-h-[600px]">
          <div className="max-w-2xl mx-auto space-y-6">
            <div>
              <h2 className="text-lg font-black text-white"> Éphéméride & Anniversaires</h2>
              <p className="text-xs text-gray-500">Prochains anniversaires ou commémorations à venir</p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {getUpcomingAnniversaries(persons).map((anniv, i) => {
                const p = anniv.person;
                const isBirth = anniv.type === 'birth';
                const formatDays = (days: number) => {
                  if (days === 0) return "Aujourd'hui ";
                  if (days === 1) return "Demain";
                  return `Dans ${days} jours`;
                };

                return (
                  <div 
                    key={`${p.id}-${anniv.type}-${i}`}
                    onClick={() => handleSelectPerson(p)}
                    className="flex justify-between items-center p-4 rounded-2xl bg-[#0a0f18] border border-white/5 cursor-pointer hover:border-[var(--panel-accent)]/40 transition-all duration-300"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg bg-white/5"
                        style={{
                          color: isBirth ? '#3b82f6' : '#6B7280',
                        }}
                      >
                        {isBirth ? '' : ''}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">
                          {p.first_name} {p.last_name}
                        </h4>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {isBirth ? (
                            <>Anniversaire de naissance ({anniv.yearsAgo} ans)</>
                          ) : (
                            <>Commémoration de décès ({anniv.yearsAgo} ans)</>
                          )}
                          {' • '}
                          <span className="font-mono text-gray-500">
                            {new Date(anniv.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                          </span>
                        </p>
                      </div>
                    </div>

                    <span className="text-[10px] font-black px-3 py-1.5 rounded-xl font-mono"
                      style={{
                        background: anniv.daysRemaining <= 30 
                          ? 'rgba(239,68,68,0.1)' 
                          : 'rgba(255,255,255,0.05)',
                        color: anniv.daysRemaining <= 30 ? '#EF4444' : '#94a3b8',
                        border: `1px solid ${anniv.daysRemaining <= 30 ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.05)'}`,
                      }}
                    >
                      {formatDays(anniv.daysRemaining)}
                    </span>
                  </div>
                );
              })}
              {persons.length === 0 && (
                <p className="text-xs italic text-gray-500">Aucun anniversaire enregistré.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Detail Drawer (Read-Only) */}
      {selectedPerson && (
        <>
          {/* Backdrop overlay : FIXED position to cover entire viewport */}
          <div
            className="fixed inset-0 animate-in fade-in duration-200"
            style={{
              zIndex: 9998,
              background: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(15, 23, 42, 0.45)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
            onClick={handleCancelDetail}
          />
          {/* Drawer panel : FIXED position, always on top */}
          <div
            className="fixed right-0 bottom-0 w-[420px] flex flex-col overflow-y-auto animate-in slide-in-from-right duration-300 scrollbar-premium"
            style={{
              zIndex: 9999,
              top: 0,
              backgroundColor: isDark ? '#070b13' : '#ffffff',
              opacity: 1,
              borderLeft: `2px solid ${isDark ? '#1e293b' : '#d1d5db'}`,
              boxShadow: isDark
                ? '-20px 0 60px rgba(0,0,0,0.9), -4px 0 20px rgba(0,0,0,0.6)'
                : '-20px 0 80px rgba(0,0,0,0.35), -4px 0 30px rgba(0,0,0,0.15)',
            }}
          >
            <div className="p-6 space-y-6" style={{ backgroundColor: isDark ? '#070b13' : '#ffffff' }}>
              
              <div className="flex justify-between items-center border-b pb-3"
                style={{ borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)' }}
              >
                <div>
                  <p className="text-[9px] font-black text-[var(--panel-accent)] uppercase tracking-widest">
                    Fiche Parent (Lecture seule)
                  </p>
                  <h3 className="text-base font-black text-white"
                    style={{ color: isDark ? '#ffffff' : '#1e293b' }}
                  >
                    {selectedPerson.first_name || '-'} {selectedPerson.last_name || '-'}
                  </h3>
                </div>
                <button
                  onClick={handleCancelDetail}
                  className="p-2 rounded-xl transition-all text-gray-500 hover:text-[var(--panel-accent)]"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Profile Avatar Card */}
              <div className="flex items-center gap-4 p-4 rounded-2xl border"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.02)',
                  borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)'
                }}
              >
                {selectedPerson.avatar_url ? (
                  <img
                    src={selectedPerson.avatar_url}
                    alt="Avatar"
                    className="h-16 w-16 rounded-2xl object-cover border border-white/10 shadow-lg"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-2xl bg-[var(--panel-accent)] flex items-center justify-center text-xl font-black text-white">
                    {((selectedPerson.first_name?.[0] || '') + (selectedPerson.last_name?.[0] || '')).toUpperCase() || '?'}
                  </div>
                )}
                <div>
                  <p className="text-xs font-bold"
                    style={{ color: isDark ? '#ffffff' : '#1e293b' }}
                  >
                    {selectedPerson.first_name || '-'} {selectedPerson.last_name || '-'}
                  </p>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-mono mt-0.5">
                    {ROLE_LABELS[selectedPerson.relation_role || ''] || 'Membre'}
                  </p>
                </div>
              </div>

              {/* Detail Stats */}
              <div className="space-y-4 font-medium text-xs">
                <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl border"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.02)',
                    borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)'
                  }}
                >
                  <div>
                    <span className="text-[9px] text-gray-500 uppercase tracking-wider block">Naissance</span>
                    <p className="font-bold mt-0.5" style={{ color: isDark ? '#ffffff' : '#1e293b' }}>
                      {selectedPerson.birth_date || '-'}
                    </p>
                    <p className="text-gray-500 text-[10px] mt-0.5">{selectedPerson.birth_place || '-'}</p>
                  </div>
                  <div>
                    <span className="text-[9px] text-gray-500 uppercase tracking-wider block">Décès</span>
                    <p className="font-bold mt-0.5" style={{ color: isDark ? '#ffffff' : '#1e293b' }}>
                      {selectedPerson.death_date || '-'}
                    </p>
                    <p className="text-gray-500 text-[10px] mt-0.5">{selectedPerson.death_place || '-'}</p>
                  </div>
                </div>

                {selectedPerson.notes && (
                  <div className="space-y-1">
                    <span className="text-[9px] text-gray-500 uppercase tracking-widest block font-black">Notes & Anecdotes</span>
                    <p className="leading-relaxed p-3 rounded-xl border text-[11px]"
                      style={{
                        background: isDark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)',
                        borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)',
                        color: isDark ? '#d1d5db' : '#4b5563'
                      }}
                    >
                      {selectedPerson.notes}
                    </p>
                  </div>
                )}
              </div>

              {/* Civil documents list */}
              <div className="space-y-3 pt-2">
                <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                  <ShieldCheck size={12} className="text-emerald-400" /> Documents validés
                </h4>

                <div className="space-y-1.5">
                  {documents.filter(d => d.person_id === selectedPerson.id).map(d => (
                    <div 
                      key={d.id} 
                      className="flex items-center justify-between p-2.5 rounded-xl border"
                      style={{
                        background: isDark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.02)',
                        borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)'
                      }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText size={12} className="text-[var(--panel-accent)] shrink-0" />
                        <a 
                          href={d.file_url ?? '#'} 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-[11px] font-bold truncate hover:text-[var(--panel-accent)] hover:underline transition-all"
                          style={{ color: isDark ? '#d1d5db' : '#4b5563' }}
                        >
                          {d.title || 'Télécharger le document'}
                        </a>
                      </div>
                      <span className="text-[8px] font-mono font-bold text-gray-500 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full shrink-0">
                        {d.doc_type}
                      </span>
                    </div>
                  ))}
                  
                  {documents.filter(d => d.person_id === selectedPerson.id).length === 0 && (
                    <p className="text-[10px] text-gray-600 italic">Aucune pièce justificative validée.</p>
                  )}
                </div>
              </div>

            </div>
          </div>
        </>
      )}

    </div>
  );
}
