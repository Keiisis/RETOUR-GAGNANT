'use client';

import { useEffect, useState, useCallback, useRef, lazy, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Person, DocumentItem, Tree, RelationRole } from '@/lib/genealogy/types';
import { ROLE_LABELS } from '@/lib/genealogy/requirements';
import FamilyTree from '@/components/admin/genealogy/FamilyTree';
import PersonForm from '@/components/admin/genealogy/PersonForm';
import DocumentUploader from '@/components/admin/genealogy/DocumentUploader';
import CollaboratorsModal from '@/components/admin/genealogy/CollaboratorsModal';
import GedcomImportButton from '@/components/admin/genealogy/GedcomImportButton';
import DossierPdfButton from '@/components/admin/genealogy/DossierPdfButton';
import AuditLogDrawer from '@/components/admin/genealogy/AuditLogDrawer';
import SuggestionsPanel from '@/components/admin/genealogy/SuggestionsPanel';
import DedupAlert from '@/components/admin/genealogy/DedupAlert';
import { downloadGedcom } from '@/lib/genealogy/gedcom';
import { findSiblings, buildTreeStats } from '@/lib/genealogy/siblings';
import { buildFamilyTimeline, getUpcomingAnniversaries } from '@/lib/genealogy/timeline';
import { useTheme } from '@/lib/theme/ThemeContext';
import { 
  ChevronLeft, ZoomIn, ZoomOut, Maximize2, Loader2,
  Trash2, FileText, Upload, X, Download,
  Map, BarChart3, TreeDeciduous, Share2, Users,
  Clock, Calendar, Search
} from 'lucide-react';

// Lazy load the map component (Leaflet is heavy)
const FamilyMap = lazy(() => import('@/components/admin/genealogy/FamilyMap'));

type ViewMode = 'tree' | 'map' | 'stats' | 'timeline' | 'anniversaries';

export default function DedicatedTreePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const treeId = searchParams.get('id');
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [searchQuery, setSearchQuery] = useState('');

  const [tree, setTree] = useState<Tree | null>(null);
  const [persons, setPersons] = useState<Person[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [presetRole, setPresetRole] = useState<string | null>(null);
  const [contextPersonId, setContextPersonId] = useState<string | null>(null);
  const [addAction, setAddAction] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadingPDF, setDownloadingPDF] = useState<false | 'A4' | 'A3'>(false);
  const [downloadingImageA4, setDownloadingImageA4] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('tree');

  // Pan & Zoom States
  const [zoom, setZoom] = useState(0.9);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const viewRef = useRef<HTMLDivElement | null>(null);
  const treeContainerRef = useRef<HTMLDivElement | null>(null);
  const compactTreeRef = useRef<HTMLDivElement | null>(null);

  const loadData = useCallback(async (silent = false) => {
    if (!treeId) return;
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      const [treeRes, personsRes, docsRes] = await Promise.all([
        supabase.from('trees').select('*').eq('id', treeId).single(),
        supabase.from('persons').select('*').eq('tree_id', treeId),
        supabase.from('genealogy_documents').select('*').eq('tree_id', treeId)
      ]);

      if (treeRes.error) throw treeRes.error;
      if (personsRes.error) throw personsRes.error;
      if (docsRes.error) throw docsRes.error;

      setTree(treeRes.data);
      setPersons(personsRes.data || []);
      setDocuments(docsRes.data || []);

      if (selectedPerson) {
        const fresh = (personsRes.data || []).find(p => p.id === selectedPerson.id);
        setSelectedPerson(fresh || null);
      }
    } catch (err: any) {
      console.error(err);
      alert('Erreur chargement arbre : ' + err.message);
      router.push('/admin/genealogie');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [treeId, selectedPerson, router]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treeId]);

  // Drag and Pan
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

  const handleZoomIn = () => setZoom(z => Math.min(1.8, z + 0.1));
  const handleZoomOut = () => setZoom(z => Math.max(0.4, z - 0.1));
  const handleResetZoom = () => {
    setZoom(0.9);
    setPan({ x: 0, y: 0 });
  };

  const handleSelectPerson = (person: Person) => {
    setPresetRole(null);
    setContextPersonId(null);
    setAddAction(null);
    setSelectedPerson(person);
  };

  const handleAddRelative = (role: string, contextId?: string) => {
    setSelectedPerson(null);
    if (contextId) {
      setContextPersonId(contextId);
      setAddAction(role);
      setPresetRole(null);
    } else {
      setContextPersonId(null);
      setAddAction(null);
      setPresetRole(role);
    }
  };

  const handleCancelEdit = () => {
    setSelectedPerson(null);
    setPresetRole(null);
    setContextPersonId(null);
    setAddAction(null);
  };

  const deletePerson = async (id: string) => {
    if (!window.confirm('Voulez-vous vraiment retirer ce parent de l\'arbre ?')) return;
    try {
      const { error } = await supabase.from('persons').delete().eq('id', id);
      if (error) throw error;
      
      alert('Parent retiré avec succès 🗑️');
      setSelectedPerson(null);
      loadData(true);
    } catch (err: any) {
      alert('Erreur : ' + err.message);
    }
  };

  /* ─── DOWNLOAD TREE AS IMAGE (2 images: RECTO = arbre, VERSO = rapport) ─── */
  const handleDownloadTree = async () => {
    setDownloading(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      
      const treeEl = treeContainerRef.current;
      if (!treeEl) throw new Error('Élément arbre introuvable');

      const dateStr = new Date().toISOString().slice(0, 10);
      const fileBase = clientName.replace(/\s+/g, '-').toLowerCase();

      // ═══════════════════════════════════════════════════
      // IMAGE 1 — RECTO : L'arbre seul, grand et lisible
      // ═══════════════════════════════════════════════════
      const treeWrapper = document.createElement('div');
      treeWrapper.style.cssText = 'position:absolute;left:-9999px;top:0;background:#FFFFFF;padding:60px 60px 40px;display:inline-block;width:max-content;';
      
      // Title header for the printed tree
      const header = document.createElement('div');
      header.style.cssText = 'text-align:center;margin-bottom:40px;font-family:system-ui,sans-serif;';
      header.innerHTML = `
        <div style="display:inline-block;background:#008751;color:white;padding:12px 40px;border-radius:16px;margin-bottom:12px;">
          <span style="font-size:22px;font-weight:900;letter-spacing:2px;">RETOUR GAGNANT BÉNIN</span>
        </div>
        <h1 style="font-size:28px;font-weight:900;color:#0A0F18;margin:16px 0 6px;letter-spacing:1px;">
          PLAN DE COMPOSITION DE FAMILLE
        </h1>
        <p style="font-size:18px;font-weight:700;color:#008751;margin:0 0 4px;">
          Famille ${clientName.toUpperCase()}
        </p>
        <p style="font-size:12px;color:#9CA3AF;margin:0;">
          ${persons.length} membre(s) • Généré le ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      `;
      treeWrapper.appendChild(header);

      // Clone tree
      const treeClone = treeEl.cloneNode(true) as HTMLElement;
      treeClone.style.transform = 'none';
      treeClone.style.position = 'relative';
      treeClone.style.justifyContent = 'flex-start';
      treeClone.style.alignItems = 'flex-start';
      treeClone.id = 'print-tree-root';

      let widthNum = 2000;
      let heightNum = 1200;
      // Explicitly set clone and wrapper width and height based on inner FamilyTree layout to avoid edge truncation
      const actualTree = treeClone.firstElementChild as HTMLElement;
      if (actualTree) {
        const w = actualTree.style.width || actualTree.style.minWidth;
        const h = actualTree.style.height;
        if (w) {
          treeClone.style.width = w;
          treeClone.style.minWidth = w;
          widthNum = parseFloat(w);
          treeWrapper.style.width = `${widthNum + 120}px`;
        }
        if (h) {
          treeClone.style.height = h;
          heightNum = parseFloat(h);
          treeWrapper.style.height = `${heightNum + 220}px`;
        }
      }

      // Inject high-fidelity print stylesheet
      const styleEl = document.createElement('style');
      styleEl.innerHTML = `
        #print-tree-root {
          background-color: #FFFFFF !important;
          color: #0A0F18 !important;
        }
        .truncate {
          text-overflow: clip !important;
          overflow: visible !important;
          white-space: normal !important;
          word-break: break-word !important;
        }
        .overflow-hidden {
          overflow: visible !important;
        }
        .group\\/card {
          overflow: visible !important;
          width: 280px !important; /* Keep fixed CARD_W to align with SVG connection lines */
        }
        .group\\/card > div {
          background-color: #FFFFFF !important;
          border: 3px solid #008751 !important; /* solid green border for maximum contrast */
          box-shadow: 0 4px 12px rgba(0,0,0,0.06) !important;
          opacity: 1 !important;
        }
        .group\\/card > div.border-\\[\\#008751\\] {
          border-color: #FCD116 !important; /* gold border for proposant/selected */
          background-color: #F0FDF4 !important;
        }
        .group\\/card > div.opacity-75 {
          opacity: 0.95 !important;
          border-color: #9CA3AF !important; /* gray border for deceased */
          background-color: #F9FAFB !important;
        }
        .group\\/card p, .group\\/card span {
          color: #000000 !important;
          font-weight: 900 !important;
        }
        .group\\/card p.text-\\[19px\\] {
          font-size: 19px !important;
          font-weight: 900 !important;
          color: #000000 !important;
        }
        .group\\/card p.text-\\[15px\\] {
          font-size: 15px !important;
          font-weight: 900 !important;
          color: #000000 !important;
        }
        .group\\/card span.uppercase {
          color: #008751 !important;
          font-size: 10px !important;
          font-weight: 900 !important;
        }
        .group\\/card p.text-\\[13px\\] {
          color: #000000 !important;
          font-size: 13px !important;
          font-weight: 900 !important;
        }
        .group\\/card svg {
          stroke: #000000 !important;
          opacity: 1 !important;
        }
        .group\\/card > button {
          background-color: #F9FAFB !important;
          border: 2px dashed #D1D5DB !important;
          opacity: 1 !important;
        }
        .group\\/card > button span, .group\\/card > button svg {
          color: #6B7280 !important;
        }
        svg path, svg line {
          stroke-opacity: 1 !important;
        }
        svg path[stroke="#10B981"], svg line[stroke="#10B981"],
        svg path[stroke="#008751"], svg line[stroke="#008751"] {
          stroke: #008751 !important;
        }
        svg path[stroke*="rgba"], svg line[stroke*="rgba"] {
          stroke: #9CA3AF !important;
          stroke-dasharray: 6,5 !important;
          opacity: 0.6 !important;
        }
        svg path[stroke-width="6"], svg path[stroke-width="8"] {
          display: none !important;
        }
        svg circle[stroke="#FCD116"] {
          stroke: #D9A406 !important;
          fill: #FFFFFF !important;
        }
        svg text[fill="#FCD116"] {
          fill: #EAB308 !important;
        }
        svg line[stroke="#FCD116"] {
          stroke: #D9A406 !important;
        }
        [class*="opacity-0"] {
          display: none !important;
        }
      `;
      treeWrapper.appendChild(styleEl);
      treeWrapper.appendChild(treeClone);
      document.body.appendChild(treeWrapper);

      await new Promise(r => setTimeout(r, 400));

      // Render at 3x scale for high-resolution print
      const treeCanvas = await html2canvas(treeWrapper, {
        backgroundColor: '#FFFFFF',
        scale: 3,
        useCORS: true,
        logging: false,
        width: widthNum + 120,
        height: heightNum + 220,
        windowWidth: widthNum + 120,
        windowHeight: heightNum + 220,
      });

      document.body.removeChild(treeWrapper);

      // Download Image 1 — RECTO
      const link1 = document.createElement('a');
      link1.download = `arbre-${fileBase}-RECTO-${dateStr}.png`;
      link1.href = treeCanvas.toDataURL('image/png');
      link1.click();

      // Small delay between the two downloads
      await new Promise(r => setTimeout(r, 500));

      // ═══════════════════════════════════════════════════
      // IMAGE 2 — VERSO : Le rapport (pour le dos de l'impression)
      // ═══════════════════════════════════════════════════
      const allDirectRoles: RelationRole[] = [
        'self', 'father', 'mother',
        'paternal_grandfather', 'paternal_grandmother',
        'maternal_grandfather', 'maternal_grandmother',
        'paternal_ggf_1', 'paternal_ggm_1',
        'maternal_ggf_1', 'maternal_ggm_1',
      ];
      const existingRoles = new Set<RelationRole | null>(
        persons.map(p => (p.is_self ? 'self' : p.relation_role) as RelationRole | null).filter(Boolean)
      );
      const missingRoles = allDirectRoles.filter(r => !existingRoles.has(r));
      const incompletePersons = persons.filter(p => !p.first_name || !p.last_name || !p.birth_date);

      const reportWrapper = document.createElement('div');
      reportWrapper.style.cssText = 'position:absolute;left:-9999px;top:0;background:#FFFFFF;padding:60px;min-width:800px;max-width:1000px;font-family:system-ui,sans-serif;';

      let reportHtml = `
        <div style="text-align:center;margin-bottom:40px;">
          <div style="display:inline-block;background:#008751;color:white;padding:10px 36px;border-radius:14px;margin-bottom:10px;">
            <span style="font-size:18px;font-weight:900;letter-spacing:2px;">RETOUR GAGNANT BÉNIN</span>
          </div>
          <h2 style="font-size:24px;font-weight:900;margin:14px 0 6px;color:#0A0F18;">📋 RAPPORT DU PLAN DE COMPOSITION DE FAMILLE</h2>
          <p style="font-size:16px;font-weight:700;color:#008751;margin:0 0 4px;">Famille ${clientName.toUpperCase()}</p>
          <p style="font-size:13px;color:#6B7280;margin:0;">
            Généré le ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} • ${persons.length} membre(s) enregistré(s)
          </p>
        </div>
      `;

      // Summary table of all members
      reportHtml += `
        <div style="margin-bottom:28px;padding:24px;background:#F9FAFB;border-radius:16px;border:1px solid #E5E7EB;">
          <h3 style="font-size:16px;font-weight:800;color:#0A0F18;margin:0 0 16px;">👥 Membres enregistrés (${persons.length})</h3>
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead>
              <tr style="border-bottom:2px solid #D1D5DB;">
                <th style="text-align:left;padding:8px 12px;color:#6B7280;font-weight:700;">Rôle</th>
                <th style="text-align:left;padding:8px 12px;color:#6B7280;font-weight:700;">Prénom</th>
                <th style="text-align:left;padding:8px 12px;color:#6B7280;font-weight:700;">Nom</th>
                <th style="text-align:left;padding:8px 12px;color:#6B7280;font-weight:700;">Né(e) le</th>
                <th style="text-align:left;padding:8px 12px;color:#6B7280;font-weight:700;">Lieu</th>
              </tr>
            </thead>
            <tbody>
      `;
      persons.forEach(p => {
        const roleName = ROLE_LABELS[p.relation_role || ''] || (p.is_self ? 'Sujet' : 'Membre');
        reportHtml += `
          <tr style="border-bottom:1px solid #E5E7EB;">
            <td style="padding:8px 12px;font-weight:600;color:#374151;">${roleName}</td>
            <td style="padding:8px 12px;color:#1F2937;">${p.first_name || '—'}</td>
            <td style="padding:8px 12px;color:#1F2937;">${p.last_name || '—'}</td>
            <td style="padding:8px 12px;color:#1F2937;">${p.birth_date || '—'}</td>
            <td style="padding:8px 12px;color:#1F2937;">${p.birth_place || '—'}</td>
          </tr>
        `;
      });
      reportHtml += `</tbody></table></div>`;

      // Missing roles
      if (missingRoles.length > 0) {
        reportHtml += `<div style="margin-bottom:20px;padding:20px;background:#FEF3C7;border-radius:14px;border:1px solid #FCD34D;">`;
        reportHtml += `<h3 style="font-size:15px;font-weight:800;color:#92400E;margin:0 0 12px;">⚠️ Membres manquants (${missingRoles.length})</h3>`;
        reportHtml += `<ul style="margin:0;padding:0 0 0 20px;font-size:13px;color:#78350F;line-height:1.8;">`;
        missingRoles.forEach(r => {
          reportHtml += `<li style="margin-bottom:4px;">${ROLE_LABELS[r] || r}</li>`;
        });
        reportHtml += `</ul></div>`;
      }
      
      // Incomplete persons
      if (incompletePersons.length > 0) {
        reportHtml += `<div style="margin-bottom:20px;padding:20px;background:#FEE2E2;border-radius:14px;border:1px solid #FCA5A5;">`;
        reportHtml += `<h3 style="font-size:15px;font-weight:800;color:#991B1B;margin:0 0 12px;">🔴 Fiches incomplètes (${incompletePersons.length})</h3>`;
        reportHtml += `<ul style="margin:0;padding:0 0 0 20px;font-size:13px;color:#7F1D1D;line-height:1.8;">`;
        incompletePersons.forEach(p => {
          const missing: string[] = [];
          if (!p.first_name) missing.push('prénom');
          if (!p.last_name) missing.push('nom');
          if (!p.birth_date) missing.push('date de naissance');
          reportHtml += `<li style="margin-bottom:4px;"><strong>${p.first_name || '?'} ${p.last_name || '?'}</strong> (${ROLE_LABELS[p.relation_role || ''] || 'Membre'}) — manque : ${missing.join(', ')}</li>`;
        });
        reportHtml += `</ul></div>`;
      }

      // All complete message
      if (missingRoles.length === 0 && incompletePersons.length === 0) {
        reportHtml += `<div style="padding:20px;background:#D1FAE5;border-radius:14px;border:1px solid #6EE7B7;">`;
        reportHtml += `<p style="font-size:15px;font-weight:700;color:#065F46;margin:0;">✅ Arbre complet — Toutes les fiches sont renseignées</p>`;
        reportHtml += `</div>`;
      }

      reportHtml += `
        <div style="margin-top:40px;padding-top:20px;border-top:2px solid #E5E7EB;text-align:center;">
          <p style="font-size:10px;color:#9CA3AF;margin:0;">RETOUR GAGNANT BÉNIN — Plan de composition de Famille • www.retourgagnantbenin.bj</p>
        </div>
      `;

      reportWrapper.innerHTML = reportHtml;
      document.body.appendChild(reportWrapper);
      await new Promise(r => setTimeout(r, 300));

      const reportCanvas = await html2canvas(reportWrapper, {
        backgroundColor: '#FFFFFF',
        scale: 3,
        useCORS: true,
        logging: false,
        width: reportWrapper.scrollWidth,
        height: reportWrapper.scrollHeight,
        windowWidth: reportWrapper.scrollWidth,
        windowHeight: reportWrapper.scrollHeight,
      });

      document.body.removeChild(reportWrapper);

      // Download Image 2 — VERSO
      const link2 = document.createElement('a');
      link2.download = `arbre-${fileBase}-VERSO-${dateStr}.png`;
      link2.href = reportCanvas.toDataURL('image/png');
      link2.click();

    } catch (err: any) {
      console.error('Download error:', err);
      alert('Erreur lors du téléchargement : ' + err.message);
    } finally {
      setDownloading(false);
    }
  };

  /* ─── Helper: temporarily bring compact tree on-screen so browser paints it ─── */
  const captureCompactTree = async (
    html2canvas: any,
    opts?: { scale?: number }
  ): Promise<{ canvas: HTMLCanvasElement; treeWidth: number; treeHeight: number }> => {
    const compactEl = compactTreeRef.current;
    if (!compactEl) throw new Error('Élément arbre compact introuvable');

    // 1. Temporarily bring the compact tree on-screen (invisible to user)
    const origStyle = compactEl.style.cssText;
    compactEl.style.cssText = `
      position: fixed;
      left: 0;
      top: 0;
      z-index: -9999;
      opacity: 0.01;
      pointer-events: none;
      background: #FFFFFF;
    `;
    // Force browser to layout/paint
    await new Promise(r => setTimeout(r, 300));
    // Force reflow
    void compactEl.offsetHeight;

    // 2. Read actual dimensions from the rendered FamilyTree root
    const treeRoot = compactEl.firstElementChild as HTMLElement;
    let treeWidth = treeRoot?.scrollWidth || treeRoot?.offsetWidth || 2000;
    let treeHeight = treeRoot?.scrollHeight || treeRoot?.offsetHeight || 1200;
    // Also check inline styles as fallback
    if (treeRoot) {
      const wStyle = treeRoot.style.width || treeRoot.style.minWidth;
      const hStyle = treeRoot.style.height;
      if (wStyle && parseFloat(wStyle) > 0) treeWidth = parseFloat(wStyle);
      if (hStyle && parseFloat(hStyle) > 0) treeHeight = parseFloat(hStyle);
    }

    // 3. Clone the now-painted tree into a capture wrapper
    const captureWrapper = document.createElement('div');
    captureWrapper.style.cssText = `position:absolute;left:-9999px;top:0;background:#FFFFFF;padding:30px;width:${treeWidth + 60}px;height:${treeHeight + 60}px;overflow:visible;`;
    
    const treeClone = compactEl.cloneNode(true) as HTMLElement;
    treeClone.style.cssText = `position:relative;left:auto;top:auto;opacity:1;z-index:auto;pointer-events:none;background:#FFFFFF;`;
    treeClone.id = 'print-tree-root';

    // Inject print stylesheet
    const printStyle = document.createElement('style');
    printStyle.innerHTML = `
      #print-tree-root {
        background-color: #FFFFFF !important;
        color: #0A0F18 !important;
      }
      .truncate {
        text-overflow: clip !important;
        overflow: visible !important;
        white-space: normal !important;
        word-break: break-word !important;
      }
      .overflow-hidden {
        overflow: visible !important;
      }
      .group\\/card {
        overflow: visible !important;
      }
      .group\\/card > div {
        background-color: #FFFFFF !important;
        border: 2px solid #008751 !important;
        box-shadow: 0 2px 6px rgba(0,0,0,0.04) !important;
        opacity: 1 !important;
      }
      .group\\/card > div.opacity-75 {
        opacity: 0.95 !important;
        border-color: #9CA3AF !important;
        background-color: #F9FAFB !important;
      }
      .group\\/card p, .group\\/card span {
        color: #000000 !important;
        font-weight: 900 !important;
      }
      .group\\/card svg {
        stroke: #000000 !important;
        opacity: 1 !important;
      }
      .group\\/card > button {
        background-color: #F9FAFB !important;
        border: 1px dashed #D1D5DB !important;
        opacity: 1 !important;
      }
      .group\\/card > button span, .group\\/card > button svg {
        color: #6B7280 !important;
      }
      svg path, svg line {
        stroke-opacity: 1 !important;
      }
      svg path[stroke="#10B981"], svg line[stroke="#10B981"],
      svg path[stroke="#008751"], svg line[stroke="#008751"] {
        stroke: #008751 !important;
      }
      svg path[stroke*="rgba"], svg line[stroke*="rgba"] {
        stroke: #9CA3AF !important;
        stroke-dasharray: 4,4 !important;
        opacity: 0.5 !important;
      }
      svg path[stroke-width="6"], svg path[stroke-width="8"] {
        display: none !important;
      }
      svg circle[stroke="#FCD116"] {
        stroke: #D9A406 !important;
        fill: #FFFFFF !important;
      }
      svg text[fill="#FCD116"] {
        fill: #EAB308 !important;
      }
      svg line[stroke="#FCD116"] {
        stroke: #D9A406 !important;
      }
      [class*="opacity-0"] {
        display: none !important;
      }
    `;
    captureWrapper.appendChild(printStyle);
    captureWrapper.appendChild(treeClone);
    document.body.appendChild(captureWrapper);

    await new Promise(r => setTimeout(r, 200));

    // 4. Capture with html2canvas
    const canvas = await html2canvas(captureWrapper, {
      backgroundColor: '#FFFFFF',
      scale: opts?.scale ?? 2,
      useCORS: true,
      logging: false,
      width: treeWidth + 60,
      height: treeHeight + 60,
      windowWidth: treeWidth + 60,
      windowHeight: treeHeight + 60,
    });

    // 5. Cleanup: remove wrapper and restore compact tree position
    document.body.removeChild(captureWrapper);
    compactEl.style.cssText = origStyle;

    return { canvas, treeWidth, treeHeight };
  };

  /* ─── DOWNLOAD TREE AS FILLABLE PDF ─── */
  const handleDownloadPDF = async (format: 'A4' | 'A3') => {
    setDownloadingPDF(format);
    try {
      // 1. Dynamic imports
      const html2canvas = (await import('html2canvas')).default;
      const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');

      // 2. Capture the compact tree using the helper that brings it on-screen first
      const { canvas } = await captureCompactTree(html2canvas, { scale: 2 });

      const treeImgData = canvas.toDataURL('image/jpeg', 0.9);

      // 3. Create PDF Doc
      const pdfDoc = await PDFDocument.create();
      const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const form = pdfDoc.getForm();

      // --- PAGE 1: COVER PAGE ---
      const page1 = pdfDoc.addPage([595, 842]);
      
      page1.drawRectangle({
        x: 0,
        y: 742,
        width: 595,
        height: 100,
        color: rgb(0, 0.53, 0.32),
      });

      page1.drawLine({
        start: { x: 0, y: 742 },
        end: { x: 595, y: 742 },
        thickness: 3,
        color: rgb(0.99, 0.82, 0.09),
      });

      page1.drawText('RETOUR GAGNANT BÉNIN', {
        x: 40,
        y: 785,
        size: 18,
        font: helveticaBold,
        color: rgb(1, 1, 1),
      });
      page1.drawText('PLAN DE COMPOSITION DE FAMILLE ET HISTOIRE FAMILIALE', {
        x: 40,
        y: 765,
        size: 8,
        font: helvetica,
        color: rgb(0.85, 0.85, 0.85),
      });

      page1.drawText('ARBRE & FICHE DE LIGNÉE DIRECTE', {
        x: 40,
        y: 520,
        size: 24,
        font: helveticaBold,
        color: rgb(0.06, 0.1, 0.18),
      });

      page1.drawText('Document interactif et modifiable en PDF', {
        x: 40,
        y: 495,
        size: 11,
        font: helvetica,
        color: rgb(0.42, 0.45, 0.5),
      });

      page1.drawRectangle({
        x: 40,
        y: 250,
        width: 515,
        height: 160,
        color: rgb(0.97, 0.97, 0.97),
        borderColor: rgb(0.9, 0.9, 0.9),
        borderWidth: 1,
      });

      page1.drawText('INFORMATIONS DOSSIER CLIENT', {
        x: 60,
        y: 380,
        size: 10,
        font: helveticaBold,
        color: rgb(0, 0.53, 0.32),
      });

      const cleanClientName = clientName || 'Non spécifié';
      const cleanTreeName = tree?.name || 'Arbre de Lignée';
      const generationDate = new Date().toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

      page1.drawText(`Client : ${cleanClientName}`, { x: 60, y: 345, size: 12, font: helvetica });
      page1.drawText(`Nom de l'arbre : ${cleanTreeName}`, { x: 60, y: 315, size: 12, font: helvetica });
      page1.drawText(`Membres enregistrés : ${persons.length}`, { x: 60, y: 285, size: 12, font: helvetica });

      page1.drawLine({ start: { x: 40, y: 80 }, end: { x: 555, y: 80 }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
      page1.drawText('Retour Gagnant Bénin — www.retourgagnantbenin.bj', {
        x: 40,
        y: 60,
        size: 8,
        font: helvetica,
        color: rgb(0.5, 0.5, 0.5),
      });
      page1.drawText(`Date : ${generationDate}`, {
        x: 460,
        y: 60,
        size: 8,
        font: helvetica,
        color: rgb(0.5, 0.5, 0.5),
      });

      // --- PAGE 2: FAMILY TREE VISUAL (LANDSCAPE) ---
      const isA3 = format === 'A3';
      const page2 = pdfDoc.addPage(isA3 ? [1191, 842] : [842, 595]);
      
      page2.drawText(`PLAN DE COMPOSITION DE FAMILLE : FAMILLE ${cleanClientName.toUpperCase()}`, {
        x: 40,
        y: isA3 ? 802 : 555,
        size: 14,
        font: helveticaBold,
        color: rgb(0.06, 0.1, 0.18),
      });
      page2.drawLine({ 
        start: { x: 40, y: isA3 ? 792 : 545 }, 
        end: { x: isA3 ? 1151 : 802, y: isA3 ? 792 : 545 }, 
        thickness: 1, 
        color: rgb(0, 0.53, 0.32) 
      });

      const embeddedTreeImg = await pdfDoc.embedJpg(treeImgData);
      const maxImgWidth = (isA3 ? 1191 : 842) - 80;
      const maxImgHeight = (isA3 ? 842 : 595) - 135;
      
      let drawWidth = maxImgWidth;
      let drawHeight = (embeddedTreeImg.height / embeddedTreeImg.width) * drawWidth;
      
      if (drawHeight > maxImgHeight) {
        drawHeight = maxImgHeight;
        drawWidth = (embeddedTreeImg.width / embeddedTreeImg.height) * drawHeight;
      }
      
      const xOffset = (maxImgWidth - drawWidth) / 2 + 40;
      const yOffset = (maxImgHeight - drawHeight) / 2 + 65;
      
      page2.drawImage(embeddedTreeImg, {
        x: xOffset,
        y: yOffset,
        width: drawWidth,
        height: drawHeight,
      });

      page2.drawText(`Page 2/Arbre (${isA3 ? 'A3' : 'A4'})`, {
        x: isA3 ? 1100 : 760,
        y: 20,
        size: 8,
        font: helvetica,
        color: rgb(0.6, 0.6, 0.6),
      });

      // --- PAGES 3+: INDIVIDUAL FORM SHEETS (PORTRAIT) ---
      const ancestorsToExport = [
        { role: 'father', label: 'PÈRE (G1)' },
        { role: 'mother', label: 'MÈRE (G1)' },
        { role: 'paternal_grandfather', label: 'GRAND-PÈRE PATERNEL (G2)' },
        { role: 'paternal_grandmother', label: 'GRAND-MÈRE PATERNELLE (G2)' },
        { role: 'maternal_grandfather', label: 'GRAND-PÈRE MATERNEL (G2)' },
        { role: 'maternal_grandmother', label: 'GRAND-MÈRE MATERNELLE (G2)' },
        { role: 'paternal_ggf_1', label: 'ARRIÈRE-GRAND-PÈRE PATERNEL (Père du Grand-père paternel) (G3)' },
        { role: 'paternal_ggm_1', label: 'ARRIÈRE-GRAND-MÈRE PATERNELLE (Mère du Grand-père paternel) (G3)' },
        { role: 'paternal_ggf_2', label: 'ARRIÈRE-GRAND-PÈRE PATERNEL (Père de la Grand-mère paternelle) (G3)' },
        { role: 'paternal_ggm_2', label: 'ARRIÈRE-GRAND-MÈRE PATERNELLE (Mère de la Grand-mère paternelle) (G3)' },
        { role: 'maternal_ggf_1', label: 'ARRIÈRE-GRAND-PÈRE MATERNEL (Père du Grand-père maternel) (G3)' },
        { role: 'maternal_ggm_1', label: 'ARRIÈRE-GRAND-MÈRE MATERNELLE (Mère du Grand-père maternel) (G3)' },
        { role: 'maternal_ggf_2', label: 'ARRIÈRE-GRAND-PÈRE MATERNEL (Père de la Grand-mère maternelle) (G3)' },
        { role: 'maternal_ggm_2', label: 'ARRIÈRE-GRAND-MÈRE MATERNELLE (Mère de la Grand-mère maternelle) (G3)' },
      ];

      interface ExportItem {
        person: Person | undefined;
        role: string;
        label: string;
      }

      const itemsToExport: ExportItem[] = [];

      // 1. Proposant (self)
      const selfPerson = persons.find(p => p.is_self || p.relation_role === 'self');
      itemsToExport.push({
        person: selfPerson,
        role: 'self',
        label: 'SUJET (G0)',
      });

      // 2. Partenaires (husband, wife, fiance, fiancee)
      const partnerPersons = persons.filter(p => ['husband', 'wife', 'fiance', 'fiancee'].includes(p.relation_role || ''));
      partnerPersons.forEach((partner) => {
        const partnerRole = partner.relation_role || 'husband';
        let roleLabel = 'CONJOINT (G0)';
        if (partnerRole === 'husband') roleLabel = 'ÉPOUX / MARI (G0)';
        else if (partnerRole === 'wife') roleLabel = 'ÉPOUSE / FEMME (G0)';
        else if (partnerRole === 'fiance') roleLabel = 'FIANCÉ (G0)';
        else if (partnerRole === 'fiancee') roleLabel = 'FIANCÉE (G0)';

        itemsToExport.push({
          person: partner,
          role: partnerRole,
          label: `${roleLabel} - ${partner.first_name || ''} ${partner.last_name || ''}`.trim(),
        });
      });

      // 3. Enfants (child)
      const childPersons = persons.filter(p => p.relation_role === 'child');
      childPersons.forEach((child, i) => {
        itemsToExport.push({
          person: child,
          role: 'child',
          label: `ENFANT N°${i + 1} - ${child.first_name || ''} ${child.last_name || ''}`.trim(),
        });
      });

      // 4. Ancêtres de la ligne directe
      ancestorsToExport.forEach(item => {
        const p = persons.find(x => x.relation_role === item.role);
        itemsToExport.push({
          person: p,
          role: item.role,
          label: item.label,
        });
      });

      let currentPage = null;
      let memberOnPageCount = 0;
      let pageNum = 3;

      for (let index = 0; index < itemsToExport.length; index++) {
        const { person, role, label } = itemsToExport[index];

        if (memberOnPageCount % 2 === 0) {
          currentPage = pdfDoc.addPage([595, 842]);
          memberOnPageCount = 0;

          currentPage.drawText('FICHES DES MEMBRES DE LA FAMILLE (MODIFIABLES)', {
            x: 40,
            y: 805,
            size: 10,
            font: helveticaBold,
            color: rgb(0, 0.53, 0.32),
          });
          currentPage.drawLine({ start: { x: 40, y: 795 }, end: { x: 555, y: 795 }, thickness: 1, color: rgb(0.9, 0.9, 0.9) });
          
          currentPage.drawText(`Page ${pageNum++}`, {
            x: 520,
            y: 20,
            size: 8,
            font: helvetica,
            color: rgb(0.6, 0.6, 0.6),
          });
        }

        const page = currentPage!;
        const yBase = memberOnPageCount === 0 ? 440 : 80;

        page.drawRectangle({
          x: 40,
          y: yBase,
          width: 515,
          height: 300,
          color: rgb(0.99, 0.99, 0.99),
          borderColor: rgb(0.85, 0.85, 0.85),
          borderWidth: 1,
        });

        page.drawRectangle({
          x: 40,
          y: yBase + 270,
          width: 515,
          height: 30,
          color: rgb(0.06, 0.1, 0.18),
        });

        page.drawText(label, {
          x: 55,
          y: yBase + 280,
          size: 10,
          font: helveticaBold,
          color: rgb(1, 1, 1),
        });

        const drawField = (fieldName: string, label: string, val: string, x: number, y: number, w: number) => {
          page.drawText(label, {
            x,
            y: y + 4,
            size: 8,
            font: helveticaBold,
            color: rgb(0.3, 0.35, 0.4),
          });

          const fieldId = `${role}_${fieldName}_${index}`;
          const textField = form.createTextField(fieldId);
          textField.acroField.setDefaultAppearance('/Helvetica 9 Tf 0 g');
          textField.setText(val);
          textField.setFontSize(9);
          
          textField.addToPage(page, {
            x: x + 65,
            y,
            width: w,
            height: 18,
          });
        };

        const fName = person?.first_name || '';
        const lName = person?.last_name || '';
        const bDate = person?.birth_date || '';
        const bPlace = person?.birth_place || '';
        const dDate = person?.death_date || '';
        const dPlace = person?.death_place || '';
        const noteText = person?.notes || '';

        drawField('first_name', 'Prénom :', fName, 55, yBase + 235, 200);
        drawField('last_name', 'Nom :', lName, 55, yBase + 205, 200);
        drawField('birth_date', 'Né(e) le :', bDate, 55, yBase + 175, 180);
        drawField('birth_place', 'à :', bPlace, 55, yBase + 145, 180);

        drawField('death_date', 'Mort(e) le :', dDate, 310, yBase + 175, 160);
        drawField('death_place', 'à :', dPlace, 310, yBase + 145, 160);

        page.drawText('Notes historiques & commentaires :', {
          x: 55,
          y: yBase + 115,
          size: 8,
          font: helveticaBold,
          color: rgb(0.3, 0.35, 0.4),
        });

        const noteFieldId = `${role}_notes_${index}`;
        const notesField = form.createTextField(noteFieldId);
        notesField.acroField.setDefaultAppearance('/Helvetica 7 Tf 0 g');
        notesField.setText(noteText);
        notesField.setFontSize(7);
        notesField.enableMultiline();
        notesField.addToPage(page, {
          x: 55,
          y: yBase + 20,
          width: 485,
          height: 80,
        });

        memberOnPageCount++;
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `plan_de_composition_de_famille_${cleanClientName.replace(/\s+/g, '_').toLowerCase()}_${format}.pdf`;
      link.click();
    } catch (err: any) {
      console.error('PDF error:', err);
      alert('Erreur lors du téléchargement PDF : ' + err.message);
    } finally {
      setDownloadingPDF(false);
    }
  };

  /* ─── DOWNLOAD TREE AS COMPACT A4 IMAGE ─── */
  const handleDownloadImageA4 = async () => {
    setDownloadingImageA4(true);
    try {
      const html2canvas = (await import('html2canvas')).default;

      const dateStr = new Date().toISOString().slice(0, 10);
      const fileBase = clientName.replace(/\s+/g, '-').toLowerCase();

      // 1. Capture the compact tree (the helper brings it on-screen temporarily)
      const { canvas: treeCanvas, treeWidth, treeHeight } = await captureCompactTree(html2canvas, { scale: 3 });

      // 2. Build the A4 landscape image (1200x848) with header, tree, footer
      const a4Canvas = document.createElement('canvas');
      const A4_W = 1200;
      const A4_H = 848;
      const PIXEL_RATIO = 3;
      a4Canvas.width = A4_W * PIXEL_RATIO;
      a4Canvas.height = A4_H * PIXEL_RATIO;
      const ctx = a4Canvas.getContext('2d')!;
      ctx.scale(PIXEL_RATIO, PIXEL_RATIO);

      // White background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, A4_W, A4_H);

      // Header: green badge
      const badgeW = 320;
      const badgeH = 32;
      const badgeX = (A4_W - badgeW) / 2;
      const badgeY = 25;
      ctx.fillStyle = '#008751';
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 12);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('RETOUR GAGNANT BÉNIN', A4_W / 2, badgeY + 22);

      // Title
      ctx.fillStyle = '#0A0F18';
      ctx.font = '900 20px system-ui, sans-serif';
      ctx.fillText('PLAN DE COMPOSITION DE FAMILLE', A4_W / 2, badgeY + badgeH + 28);

      // Family name
      ctx.fillStyle = '#008751';
      ctx.font = '700 14px system-ui, sans-serif';
      ctx.fillText(`Famille ${clientName.toUpperCase()}`, A4_W / 2, badgeY + badgeH + 50);

      // Subtitle
      ctx.fillStyle = '#9CA3AF';
      ctx.font = '400 10px system-ui, sans-serif';
      ctx.fillText(
        `${persons.length} membre(s) • Généré le ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`,
        A4_W / 2, badgeY + badgeH + 66
      );

      // Draw the tree image scaled to fit the remaining area
      const treeAreaTop = badgeY + badgeH + 80;
      const treeAreaBottom = A4_H - 40;
      const treeAreaH = treeAreaBottom - treeAreaTop;
      const treeAreaW = A4_W - 60;

      let drawW = treeAreaW;
      let drawH = (treeCanvas.height / treeCanvas.width) * drawW;
      if (drawH > treeAreaH) {
        drawH = treeAreaH;
        drawW = (treeCanvas.width / treeCanvas.height) * drawH;
      }
      const drawX = (A4_W - drawW) / 2;
      const drawY = treeAreaTop + (treeAreaH - drawH) / 2;

      ctx.drawImage(treeCanvas, drawX, drawY, drawW, drawH);

      // Footer line
      ctx.strokeStyle = '#E5E7EB';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(30, A4_H - 25);
      ctx.lineTo(A4_W - 30, A4_H - 25);
      ctx.stroke();

      ctx.fillStyle = '#9CA3AF';
      ctx.font = '400 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('RETOUR GAGNANT BÉNIN — Plan de composition de Famille • www.retourgagnantbenin.bj', A4_W / 2, A4_H - 10);

      // Download
      const link = document.createElement('a');
      link.download = `plan-de-composition-de-famille-${fileBase}-A4-${dateStr}.png`;
      link.href = a4Canvas.toDataURL('image/png');
      link.click();
    } catch (err: any) {
      console.error('A4 Image error:', err);
      alert('Erreur lors du téléchargement Image A4 : ' + err.message);
    } finally {
      setDownloadingImageA4(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--panel-bg)' }}>
        <Loader2 className="animate-spin text-[#008751]" size={36} />
      </div>
    );
  }

  const clientName = tree?.client_first_name 
    ? `${tree.client_first_name} ${tree.client_last_name}` 
    : 'Client';

  return (
    <div
      className="relative min-h-screen h-screen flex flex-col overflow-hidden select-none"
      style={{ background: 'var(--panel-bg)', color: 'var(--panel-text)' }}
    >
      
      {/* 1. Header Navigation Bar */}
      <header
        className="h-16 flex items-center justify-between px-6 border-b relative z-40 shadow-md"
        style={{
          background: 'var(--panel-surface)',
          borderColor: 'var(--panel-border)',
        }}
      >
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/admin/genealogie')}
            className="p-2 rounded-xl transition-all shrink-0"
            style={{ background: 'var(--panel-surface-hover)', color: 'var(--panel-text-muted)' }}
            title="Retour au Dashboard"
          >
            <ChevronLeft size={18} />
          </button>
          
          <div className="h-6 w-[1px]" style={{ background: 'var(--panel-border)' }} />

          <div>
            <h1 className="text-sm font-black uppercase tracking-wider" style={{ color: 'var(--panel-text-heading)' }}>
              Plan de composition de Famille de <span className="text-benin-gradient">{clientName}</span>
            </h1>
            <p className="text-[10px] font-mono" style={{ color: 'var(--panel-text-faint)' }}>
              {tree?.name} • {persons.length} MEMBRES
            </p>
          </div>
        </div>

        {/* Tool Controls */}
        <div className="flex items-center gap-2">
          {/* Download Button */}
          <button
            onClick={handleDownloadTree}
            disabled={downloading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all text-[11px] font-bold"
            style={{
              background: isDark ? 'rgba(0,135,81,0.12)' : 'rgba(0,135,81,0.08)',
              color: '#008751',
              border: `1px solid ${isDark ? 'rgba(0,135,81,0.25)' : 'rgba(0,135,81,0.2)'}`,
            }}
            title="Télécharger l'arbre complet en image"
          >
            {downloading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Download size={14} />
            )}
            {downloading ? 'Export…' : 'Télécharger'}
          </button>

          {/* Download A4 Image Button */}
          <button
            onClick={handleDownloadImageA4}
            disabled={downloadingImageA4}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all text-[11px] font-bold"
            style={{
              background: isDark ? 'rgba(0,135,81,0.12)' : 'rgba(0,135,81,0.08)',
              color: '#008751',
              border: `1px solid ${isDark ? 'rgba(0,135,81,0.25)' : 'rgba(0,135,81,0.2)'}`,
            }}
            title="Télécharger l'arbre compact en image A4 paysage"
          >
            {downloadingImageA4 ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Download size={14} />
            )}
            {downloadingImageA4 ? 'Export Image A4…' : 'Image A4'}
          </button>

          {/* Download PDF A4 Button */}
          <button
            onClick={() => handleDownloadPDF('A4')}
            disabled={!!downloadingPDF}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all text-[11px] font-bold"
            style={{
              background: isDark ? 'rgba(197,168,76,0.12)' : 'rgba(197,168,76,0.08)',
              color: 'var(--panel-accent)',
              border: `1px solid ${isDark ? 'rgba(197,168,76,0.25)' : 'rgba(197,168,76,0.2)'}`,
            }}
            title="Télécharger l'arbre en PDF A4"
          >
            {downloadingPDF === 'A4' ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <FileText size={14} />
            )}
            {downloadingPDF === 'A4' ? 'Export A4…' : 'Télécharger PDF A4'}
          </button>

          {/* Download PDF A3 Button */}
          <button
            onClick={() => handleDownloadPDF('A3')}
            disabled={!!downloadingPDF}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all text-[11px] font-bold"
            style={{
              background: isDark ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.08)',
              color: isDark ? '#34D399' : '#059669',
              border: `1px solid ${isDark ? 'rgba(16,185,129,0.25)' : 'rgba(16,185,129,0.2)'}`,
            }}
            title="Télécharger l'arbre en PDF A3 (Grand format)"
          >
            {downloadingPDF === 'A3' ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <FileText size={14} />
            )}
            {downloadingPDF === 'A3' ? 'Export A3…' : 'Télécharger PDF A3'}
          </button>

          {/* GEDCOM Export Button */}
          <button
            onClick={() => tree && downloadGedcom(tree, persons)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all text-[11px] font-bold"
            style={{
              background: isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.08)',
              color: '#6366F1',
              border: `1px solid ${isDark ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.2)'}`,
            }}
            title="Exporter au format GEDCOM (compatible Gramps, Geneanet, FamilySearch…)"
          >
            <Share2 size={14} />
            GEDCOM
          </button>

          {/* GEDCOM Import Button (P2.1) */}
          {treeId && (
            <GedcomImportButton
              treeId={treeId}
              onImported={() => loadData(true)}
              isDark={isDark}
            />
          )}

          {/* Dossier PDF complet (P2.4) */}
          {treeId && (
            <DossierPdfButton
              treeId={treeId}
              treeContainer={compactTreeRef.current}
              suggestedFilename={`Plan-de-Composition-Familiale-${clientName.replace(/[^a-zA-Z0-9-]/g, '_')}`}
              isDark={isDark}
            />
          )}

          {/* Collaborateurs / Partage (P1.2) */}
          {treeId && (
            <CollaboratorsModal treeId={treeId} isDark={isDark} />
          )}

          {/* Audit log (P1.1) */}
          {treeId && (
            <AuditLogDrawer treeId={treeId} isDark={isDark} />
          )}

          {/* Suggestions (#7) — sélectionne la personne ciblée à l'arrivée */}
          {treeId && (
            <SuggestionsPanel
              treeId={treeId}
              isDark={isDark}
              onSelectPerson={(pid) => {
                const target = persons.find(p => p.id === pid);
                if (target) handleSelectPerson(target);
              }}
            />
          )}

          {/* Doublons potentiels (#6) — badge masqué si rien à signaler */}
          {treeId && (
            <DedupAlert
              treeId={treeId}
              isDark={isDark}
              onMerged={() => loadData(true)}
            />
          )}

          {/* Search Box */}
          <div className="relative mr-2 hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--panel-text-faint)]" size={14} />
            <input
              type="text"
              placeholder="Rechercher un parent..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8 py-1.5 w-48 rounded-xl text-xs border bg-[var(--panel-surface-alt)] text-[var(--panel-text)] border-[var(--panel-border)] focus:outline-none focus:border-emerald-500/60 focus:w-64 transition-all duration-300"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                aria-label="Effacer la recherche"
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
                  borderColor: 'var(--panel-border)',
                }}
              >
                {persons
                  .filter(p => {
                    const q = searchQuery.toLowerCase().trim()
                    if (!q) return true
                    // Recherche étendue : nom + lieu naissance + lieu décès + dates + rôle
                    const haystack = [
                      p.first_name, p.last_name,
                      p.birth_place, p.death_place,
                      p.birth_date, p.death_date,
                      p.relation_role,
                      ROLE_LABELS[p.relation_role || ''] || '',
                    ].filter(Boolean).join(' ').toLowerCase()
                    return haystack.includes(q)
                  })
                  .map(p => (
                    <button
                      key={p.id}
                      onClick={() => {
                        handleSelectPerson(p);
                        setSearchQuery('');
                      }}
                      className="w-full flex items-center gap-3 p-2 rounded-xl text-left hover:bg-[var(--panel-surface-hover)] transition-all"
                    >
                      {p.avatar_url ? (
                        <img src={p.avatar_url} className="w-8 h-8 rounded-lg object-cover" alt={`${p.first_name || ''} ${p.last_name || ''}`} />
                      ) : (
                        <div 
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black text-white"
                          style={{
                            background: `linear-gradient(135deg, ${p.gender === 'female' ? '#EC4899' : '#008751'}, #6366F1)`,
                          }}
                        >
                          {((p.first_name?.[0] || '') + (p.last_name?.[0] || '')).toUpperCase() || '?'}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate" style={{ color: 'var(--panel-text-heading)' }}>
                          {p.first_name} {p.last_name}
                        </p>
                        <p className="text-[9px] font-mono text-[var(--panel-text-faint)] uppercase">
                          {ROLE_LABELS[p.relation_role || ''] || 'Membre'}
                        </p>
                      </div>
                    </button>
                  ))}
                {persons.filter(p => {
                  const q = searchQuery.toLowerCase().trim()
                  if (!q) return true
                  const haystack = [
                    p.first_name, p.last_name,
                    p.birth_place, p.death_place,
                    p.birth_date, p.death_date,
                    p.relation_role,
                    ROLE_LABELS[p.relation_role || ''] || '',
                  ].filter(Boolean).join(' ').toLowerCase()
                  return haystack.includes(q)
                }).length === 0 && (
                  <p className="text-[10px] text-center py-4 italic text-[var(--panel-text-faint)]">Aucun membre trouvé</p>
                )}
              </div>
            )}
          </div>

          <div className="h-6 w-[1px]" style={{ background: 'var(--panel-border)' }} />

          {/* View Mode Tabs */}
          <div className="flex items-center rounded-xl overflow-hidden" style={{ border: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}` }}>
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
                className="flex items-center gap-1 px-3 py-2 text-[11px] font-bold transition-all"
                style={{
                  background: viewMode === tab.key
                    ? (isDark ? 'rgba(0,135,81,0.2)' : 'rgba(0,135,81,0.1)')
                    : 'transparent',
                  color: viewMode === tab.key ? '#008751' : (isDark ? '#94a3b8' : '#64748b'),
                  borderRight: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`,
                }}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          <div className="h-6 w-[1px]" style={{ background: 'var(--panel-border)' }} />

          <button
            onClick={handleZoomOut}
            className="p-2.5 rounded-xl transition-all"
            style={{ background: 'var(--panel-surface-hover)', color: 'var(--panel-text-muted)' }}
            title="Zoom arrière"
          >
            <ZoomOut size={16} />
          </button>
          <span className="text-[11px] font-mono font-bold min-w-[40px] text-center" style={{ color: 'var(--panel-text-muted)' }}>
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            className="p-2.5 rounded-xl transition-all"
            style={{ background: 'var(--panel-surface-hover)', color: 'var(--panel-text-muted)' }}
            title="Zoom avant"
          >
            <ZoomIn size={16} />
          </button>
          <button
            onClick={handleResetZoom}
            className="p-2.5 rounded-xl transition-all"
            style={{ background: 'var(--panel-surface-hover)', color: 'var(--panel-text-muted)' }}
            title="Réinitialiser"
          >
            <Maximize2 size={16} />
          </button>
        </div>
      </header>

      {/* 2. Main content area — conditionally rendered based on viewMode */}
      {viewMode === 'tree' && (
        <div 
          ref={viewRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={`flex-1 relative overflow-hidden cursor-grab ${isDragging ? 'cursor-grabbing' : ''}`}
          style={{ background: 'var(--panel-bg)' }}
        >
          {/* Subtle grid pattern background */}
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              opacity: isDark ? 0.15 : 0.25,
              backgroundImage: isDark 
                ? 'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)'
                : 'radial-gradient(circle, rgba(0,0,0,0.06) 1px, transparent 1px)',
              backgroundSize: '24px 24px'
            }}
          />

          {/* Tree wrapper transformed by zoom and pan state */}
          <div
            ref={treeContainerRef}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
              transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)'
            }}
            className="absolute inset-0 flex items-center justify-center pointer-events-auto"
          >
            {treeId && (
              <FamilyTree
                persons={persons}
                documents={documents}
                selectedPerson={selectedPerson}
                onSelect={handleSelectPerson}
                onAddRelative={handleAddRelative}
              />
            )}
          </div>
        </div>
      )}

      {/* Map View */}
      {viewMode === 'map' && (
        <div className="flex-1 relative overflow-hidden" style={{ background: 'var(--panel-bg)' }}>
          <Suspense fallback={
            <div className="w-full h-full flex items-center justify-center">
              <Loader2 className="animate-spin text-[#008751]" size={32} />
            </div>
          }>
            <FamilyMap persons={persons} />
          </Suspense>
        </div>
      )}

      {/* Stats View */}
      {viewMode === 'stats' && (
        <div className="flex-1 relative overflow-y-auto p-6" style={{ background: 'var(--panel-bg)' }}>
          {(() => {
            const stats = buildTreeStats(persons);
            const selfPerson = persons.find(p => p.is_self || p.relation_role === 'self');
            const selfSiblings = selfPerson ? findSiblings(selfPerson, persons) : null;
            return (
              <div className="max-w-4xl mx-auto space-y-6">
                {/* Title */}
                <div>
                  <h2 className="text-lg font-black" style={{ color: 'var(--panel-text-heading)' }}>
                    📊 Statistiques de l'arbre
                  </h2>
                  <p className="text-xs" style={{ color: 'var(--panel-text-muted)' }}>
                    Vue d'ensemble de la famille de {tree?.client_first_name || 'l\'arbre'}
                  </p>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Membres', value: stats.total, icon: <Users size={18} />, color: '#008751' },
                    { label: 'Hommes', value: stats.males, icon: <span className="text-lg">♂</span>, color: '#3B82F6' },
                    { label: 'Femmes', value: stats.females, icon: <span className="text-lg">♀</span>, color: '#EC4899' },
                    { label: 'Générations', value: stats.generationCount, icon: <TreeDeciduous size={18} />, color: '#8B5CF6' },
                  ].map(kpi => (
                    <div
                      key={kpi.label}
                      className="rounded-2xl p-4 border"
                      style={{
                        background: 'var(--panel-surface)',
                        borderColor: 'var(--panel-border)',
                      }}
                    >
                      <div className="flex items-center gap-2 mb-2" style={{ color: kpi.color }}>
                        {kpi.icon}
                        <span className="text-[10px] font-bold uppercase tracking-wider">{kpi.label}</span>
                      </div>
                      <p className="text-3xl font-black" style={{ color: 'var(--panel-text-heading)' }}>
                        {kpi.value}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Data completeness */}
                <div
                  className="rounded-2xl p-5 border"
                  style={{ background: 'var(--panel-surface)', borderColor: 'var(--panel-border)' }}
                >
                  <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--panel-text-heading)' }}>
                    📋 Complétude des données
                  </h3>
                  <div className="space-y-3">
                    {[
                      { label: 'Dates de naissance', value: stats.withBirth, total: stats.total, color: '#10B981' },
                      { label: 'Dates de décès', value: stats.withDeath, total: stats.total, color: '#F59E0B' },
                      { label: 'Lieux renseignés', value: stats.withPlace, total: stats.total, color: '#6366F1' },
                    ].map(bar => (
                      <div key={bar.label}>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span style={{ color: 'var(--panel-text-muted)' }}>{bar.label}</span>
                          <span className="font-bold" style={{ color: bar.color }}>
                            {bar.value}/{bar.total}
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: isDark ? '#1e293b' : '#e2e8f0' }}>
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
                  <div
                    className="rounded-2xl p-5 border"
                    style={{ background: 'var(--panel-surface)', borderColor: 'var(--panel-border)' }}
                  >
                    <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--panel-text-heading)' }}>
                      📍 Lieux les plus fréquents
                    </h3>
                    <div className="space-y-2">
                      {stats.topPlaces.map((p, i) => (
                        <div
                          key={p.place}
                          className="flex items-center justify-between p-2.5 rounded-xl"
                          style={{ background: 'var(--panel-surface-hover)' }}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-white"
                              style={{ background: ['#008751','#3B82F6','#8B5CF6','#EC4899','#F59E0B'][i] || '#6B7280' }}
                            >
                              {i + 1}
                            </span>
                            <span className="text-xs font-medium" style={{ color: 'var(--panel-text)' }}>
                              {p.place}
                            </span>
                          </div>
                          <span className="text-[10px] font-bold" style={{ color: 'var(--panel-text-muted)' }}>
                            {p.count} mention{p.count > 1 ? 's' : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Siblings */}
                {selfSiblings && (selfSiblings.fullSiblings.length > 0 || selfSiblings.halfSiblings.length > 0) && (
                  <div
                    className="rounded-2xl p-5 border"
                    style={{ background: 'var(--panel-surface)', borderColor: 'var(--panel-border)' }}
                  >
                    <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--panel-text-heading)' }}>
                      👨‍👩‍👧‍👦 Fratrie du proposant
                    </h3>
                    {selfSiblings.fullSiblings.length > 0 && (
                      <div className="mb-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: '#10B981' }}>
                          Frères/Sœurs (mêmes parents)
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {selfSiblings.fullSiblings.map(s => (
                            <span
                              key={s.id}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold"
                              style={{
                                background: isDark ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.08)',
                                color: '#10B981',
                                border: `1px solid ${isDark ? 'rgba(16,185,129,0.25)' : 'rgba(16,185,129,0.15)'}`,
                              }}
                            >
                              {s.first_name || 'N/A'} {s.last_name || ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {selfSiblings.halfSiblings.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: '#F59E0B' }}>
                          Demi-frères/Demi-sœurs
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {selfSiblings.halfSiblings.map(s => (
                            <span
                              key={s.id}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold"
                              style={{
                                background: isDark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.08)',
                                color: '#F59E0B',
                                border: `1px solid ${isDark ? 'rgba(245,158,11,0.25)' : 'rgba(245,158,11,0.15)'}`,
                              }}
                            >
                              {s.first_name || 'N/A'} {s.last_name || ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Oldest/Youngest */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {stats.oldest && (
                    <div
                      className="rounded-2xl p-5 border"
                      style={{ background: 'var(--panel-surface)', borderColor: 'var(--panel-border)' }}
                    >
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#8B5CF6' }}>
                        🧓 Ancêtre le plus ancien
                      </p>
                      <p className="text-sm font-bold" style={{ color: 'var(--panel-text-heading)' }}>
                        {stats.oldest.first_name} {stats.oldest.last_name}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--panel-text-muted)' }}>
                        Né(e) le {stats.oldest.birth_date}
                        {stats.oldest.birth_place ? ` à ${stats.oldest.birth_place}` : ''}
                      </p>
                    </div>
                  )}
                  {stats.youngest && stats.youngest.id !== stats.oldest?.id && (
                    <div
                      className="rounded-2xl p-5 border"
                      style={{ background: 'var(--panel-surface)', borderColor: 'var(--panel-border)' }}
                    >
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#10B981' }}>
                        👶 Membre le plus jeune
                      </p>
                      <p className="text-sm font-bold" style={{ color: 'var(--panel-text-heading)' }}>
                        {stats.youngest.first_name} {stats.youngest.last_name}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--panel-text-muted)' }}>
                        Né(e) le {stats.youngest.birth_date}
                        {stats.youngest.birth_place ? ` à ${stats.youngest.birth_place}` : ''}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Timeline View */}
      {viewMode === 'timeline' && (
        <div className="flex-1 relative overflow-y-auto p-6" style={{ background: 'var(--panel-bg)' }}>
          <div className="max-w-3xl mx-auto space-y-6">
            <div>
              <h2 className="text-lg font-black" style={{ color: 'var(--panel-text-heading)' }}>
                ⏳ Chronologie familiale
              </h2>
              <p className="text-xs" style={{ color: 'var(--panel-text-muted)' }}>
                Histoire temporelle de la famille de {tree?.client_first_name || 'l\'arbre'}
              </p>
            </div>

            <div className="relative border-l border-emerald-500/20 ml-4 pl-8 space-y-8">
              {buildFamilyTimeline(persons).map((event, i) => {
                const p = event.person;
                const isBirth = event.type === 'birth';
                return (
                  <div key={event.id} className="relative group/item">
                    {/* Circle Node on line */}
                    <div 
                      className="absolute -left-[41px] top-1.5 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300"
                      style={{
                        backgroundColor: isDark ? '#070b13' : '#ffffff',
                        borderColor: isBirth ? '#10B981' : '#6B7280',
                      }}
                    >
                      {isBirth ? (
                        <span className="text-[10px]" title="Naissance">👶</span>
                      ) : (
                        <span className="text-[10px]" title="Décès">✝️</span>
                      )}
                    </div>

                    {/* Timeline Event Card */}
                    <div 
                      onClick={() => handleSelectPerson(p)}
                      className="p-4 rounded-2xl border cursor-pointer hover:border-emerald-500/50 hover:shadow-lg transition-all duration-300"
                      style={{
                        background: 'var(--panel-surface)',
                        borderColor: 'var(--panel-border)',
                      }}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-sm font-black font-mono text-emerald-400">
                          {event.year}
                        </span>
                        <span className="text-[8px] font-mono font-black uppercase px-2 py-0.5 rounded-full"
                          style={{
                            background: 'var(--panel-badge-bg)',
                            color: 'var(--panel-text-muted)',
                            border: '1px solid var(--panel-border)',
                          }}
                        >
                          {ROLE_LABELS[p.relation_role || ''] || 'Membre'}
                        </span>
                      </div>
                      
                      <h4 className="text-xs font-bold text-white group-hover/item:text-emerald-400 transition-colors">
                        {p.first_name} {p.last_name}
                      </h4>

                      <p className="text-[11px] text-[var(--panel-text-muted)] mt-1.5">
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
                        <p className="text-[10px] italic text-[var(--panel-text-faint)] mt-2 line-clamp-2">
                          {p.notes}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
              {persons.length === 0 && (
                <p className="text-xs italic text-[var(--panel-text-faint)]">Aucun événement à afficher.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Anniversaries View */}
      {viewMode === 'anniversaries' && (
        <div className="flex-1 relative overflow-y-auto p-6" style={{ background: 'var(--panel-bg)' }}>
          <div className="max-w-2xl mx-auto space-y-6">
            <div>
              <h2 className="text-lg font-black" style={{ color: 'var(--panel-text-heading)' }}>
                📅 Éphéméride & Anniversaires
              </h2>
              <p className="text-xs" style={{ color: 'var(--panel-text-muted)' }}>
                Prochains événements commémoratifs à venir dans l'année
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {getUpcomingAnniversaries(persons).map((anniv, i) => {
                const p = anniv.person;
                const isBirth = anniv.type === 'birth';
                const formatDays = (days: number) => {
                  if (days === 0) return "Aujourd'hui 🎉";
                  if (days === 1) return "Demain";
                  return `Dans ${days} jours`;
                };

                return (
                  <div 
                    key={`${p.id}-${anniv.type}-${i}`}
                    onClick={() => handleSelectPerson(p)}
                    className="flex justify-between items-center p-4 rounded-2xl border cursor-pointer hover:border-emerald-500/40 transition-all duration-300"
                    style={{
                      background: 'var(--panel-surface)',
                      borderColor: 'var(--panel-border)',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                        style={{
                          background: isBirth ? 'rgba(16,185,129,0.1)' : 'rgba(107,114,128,0.1)',
                          color: isBirth ? '#10B981' : '#6B7280',
                        }}
                      >
                        {isBirth ? '🎂' : '🕯️'}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">
                          {p.first_name} {p.last_name}
                        </h4>
                        <p className="text-[10px] text-[var(--panel-text-muted)] mt-0.5">
                          {isBirth ? (
                            <>Anniversaire de naissance ({anniv.yearsAgo} ans)</>
                          ) : (
                            <>Commémoration de décès ({anniv.yearsAgo} ans)</>
                          )}
                          {' • '}
                          <span className="font-mono text-[var(--panel-text-faint)]">
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
                        color: anniv.daysRemaining <= 30 ? '#EF4444' : 'var(--panel-text-muted)',
                        border: `1px solid ${anniv.daysRemaining <= 30 ? 'rgba(239,68,68,0.2)' : 'var(--panel-border)'}`,
                      }}
                    >
                      {formatDays(anniv.daysRemaining)}
                    </span>
                  </div>
                );
              })}
              {persons.length === 0 && (
                <p className="text-xs italic text-[var(--panel-text-faint)]">Aucun anniversaire enregistré.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. Drawer EDITER LE MEMBRE — style sidebar opaque pleine hauteur */}
      {(selectedPerson || presetRole || addAction) && tree && (
        <>
          {/* Backdrop 100% OPAQUE — masque totalement l'arrière-plan (l'arbre disparaît visuellement) */}
          <div
            className="fixed inset-0"
            style={{
              zIndex: 9998,
              backgroundColor: isDark ? '#02060C' : '#0F172A',
              opacity: 1,
            }}
            onClick={handleCancelEdit}
          />
          {/* Drawer panel — opaque solide, comme la sidebar admin, bordure or épaisse */}
          <div
            className="fixed right-0 top-0 bottom-0 w-[460px] max-w-[100vw] flex flex-col overflow-y-auto scrollbar-premium"
            style={{
              zIndex: 9999,
              backgroundColor: isDark ? '#070B13' : '#FFFFFF',
              opacity: 1,
              borderLeft: '4px solid #C9A84C',
              boxShadow: isDark
                ? '-30px 0 100px rgba(0,0,0,1), -12px 0 40px rgba(0,0,0,0.85)'
                : '-30px 0 100px rgba(15,23,42,0.55), -12px 0 40px rgba(15,23,42,0.30)',
            }}
          >
          {/* Ruban tricolore Bénin en tête — signature officielle */}
          <div
            style={{
              height: 6,
              background: 'linear-gradient(90deg, #008751 0%, #FCD116 50%, #E8112D 100%)',
              flexShrink: 0,
            }}
          />

          {/* ═══════ HEADER MASSIF — fond émeraude, titre BLANC énorme ═══════ */}
          <div
            style={{
              background: 'linear-gradient(135deg, #047857 0%, #065F46 60%, #064E3B 100%)',
              padding: '24px 28px',
              flexShrink: 0,
              borderBottom: '3px solid #C9A84C',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Halo doré décoratif en haut à droite */}
            <div
              style={{
                position: 'absolute',
                top: -60, right: -60,
                width: 160, height: 160, borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(201,168,76,0.35) 0%, transparent 70%)',
                pointerEvents: 'none',
              }}
            />

            <div className="relative flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                {/* Mini label sur badge or */}
                <div
                  className="inline-flex items-center gap-1.5 mb-3"
                  style={{
                    background: 'rgba(201,168,76,0.18)',
                    border: '1px solid rgba(201,168,76,0.55)',
                    padding: '4px 10px',
                    borderRadius: 999,
                  }}
                >
                  <span style={{
                    width: 6, height: 6, borderRadius: 3, backgroundColor: '#FCD116',
                    boxShadow: '0 0 8px rgba(252,209,22,0.8)',
                  }} />
                  <span style={{
                    fontSize: 10, fontWeight: 900, letterSpacing: '0.18em',
                    color: '#FCD116', textTransform: 'uppercase',
                  }}>
                    {selectedPerson ? 'Édition · Membre existant' : 'Nouveau · Création'}
                  </span>
                </div>

                {/* Titre énorme BLANC */}
                <h3
                  style={{
                    fontSize: 24,
                    fontWeight: 900,
                    color: '#FFFFFF',
                    lineHeight: 1.1,
                    letterSpacing: '-0.01em',
                    fontFamily: 'PlayfairDisplay_700Bold, serif',
                    textShadow: '0 2px 8px rgba(0,0,0,0.35)',
                  }}
                >
                  {selectedPerson
                    ? (`${selectedPerson.first_name || ''} ${selectedPerson.last_name || ''}`.trim() || 'Membre sans nom')
                    : 'Création de parenté'}
                </h3>

                {/* Sous-titre */}
                <p style={{
                  marginTop: 4,
                  fontSize: 12,
                  color: 'rgba(255,255,255,0.78)',
                  fontWeight: 600,
                }}>
                  {selectedPerson
                    ? (ROLE_LABELS[selectedPerson.relation_role || ''] || 'Membre de la famille')
                    : 'Renseignez les informations du nouveau membre'}
                </p>
              </div>

              {/* Bouton fermer en carré contrasté */}
              <button
                onClick={handleCancelEdit}
                title="Fermer"
                style={{
                  width: 36, height: 36,
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#FFFFFF',
                  flexShrink: 0,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.22)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)' }}
              >
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>
          </div>

          {/* ═══════ BODY du drawer — fond très blanc, contraste fort ═══════ */}
          <div className="p-6 space-y-5" style={{ backgroundColor: isDark ? '#0B1220' : '#FFFFFF', opacity: 1, flex: 1 }}>

            {/* Document upload inside details */}
            {selectedPerson && (
              <div className="space-y-4 border-b pb-5" style={{ borderColor: 'var(--panel-border)' }}>
                <div className="flex justify-between items-center">
                  <h4 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5" style={{ color: 'var(--panel-text-muted)' }}>
                    <Upload size={12} className="text-emerald-400" /> Documents état civil
                  </h4>
                  {selectedPerson.id && (
                    <button
                      onClick={() => deletePerson(selectedPerson.id)}
                      className="flex items-center gap-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-[10px] px-2.5 py-1 rounded-lg transition-all"
                    >
                      <Trash2 size={11} /> Supprimer membre
                    </button>
                  )}
                </div>

                <DocumentUploader
                  treeId={tree.id}
                  personId={selectedPerson.id}
                  onUploaded={() => loadData(true)}
                />

                <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                  {documents.filter(d => d.person_id === selectedPerson.id).map(d => (
                    <div 
                      key={d.id} 
                      className="flex items-center justify-between p-2.5 rounded-xl"
                      style={{
                        background: 'var(--panel-surface-hover)',
                        border: `1px solid var(--panel-border)`,
                      }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText size={12} className="text-[#008751] shrink-0" />
                        <a 
                          href={d.file_url ?? '#'} 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-[11px] font-bold truncate hover:text-[#FCD116] transition-all"
                          style={{ color: 'var(--panel-text)' }}
                        >
                          {d.title || 'Fichier'}
                        </a>
                      </div>
                      <span
                        className="text-[8px] font-mono font-bold px-2 py-0.5 rounded-full shrink-0"
                        style={{
                          color: 'var(--panel-text-faint)',
                          background: 'var(--panel-badge-bg)',
                          border: `1px solid var(--panel-border)`,
                        }}
                      >
                        {d.doc_type}
                      </span>
                    </div>
                  ))}
                  
                  {documents.filter(d => d.person_id === selectedPerson.id).length === 0 && (
                    <p className="text-[10px] italic" style={{ color: 'var(--panel-text-faint)' }}>Aucune pièce justificative.</p>
                  )}
                </div>
              </div>
            )}

            {/* Profile editing form */}
            <div className="pt-2">
              <PersonForm
                treeId={tree.id}
                persons={persons}
                onSaved={() => {
                  loadData(true);
                  handleCancelEdit();
                }}
                presetRole={presetRole}
                selectedPerson={selectedPerson}
                onCancelEdit={handleCancelEdit}
                contextPersonId={contextPersonId}
                addAction={addAction}
              />
            </div>

          </div>
        </div>
        </>
      )}

      {/* ─── Hidden compact tree for PDF capture (off-screen) ─── */}
      <div
        ref={compactTreeRef}
        aria-hidden="true"
        style={{
          position: 'fixed',
          left: '-99999px',
          top: 0,
          pointerEvents: 'none',
          zIndex: -1,
          background: '#FFFFFF',
        }}
      >
        {treeId && (
          <FamilyTree
            persons={persons}
            documents={documents}
            selectedPerson={null}
            onSelect={() => {}}
            compact={true}
          />
        )}
      </div>

    </div>
  );
}
