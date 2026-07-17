'use client';

import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { DocType } from '@/lib/genealogy/types';
import { EXPIRABLE_DOC_TYPES } from '@/lib/genealogy/expiry';
import { Upload, FileText, Calendar, Check, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const DOC_TYPES: { value: DocType; label: string }[] = [
  { value: 'birth_certificate', label: 'Extrait de naissance' },
  { value: 'death_certificate', label: 'Acte de décès' },
  { value: 'marriage_certificate', label: 'Acte de mariage' },
  { value: 'family_book', label: 'Livret de famille' },
  { value: 'identity', label: "Pièce d'identité" },
  { value: 'address_proof', label: 'Justificatif de domicile' },
  { value: 'profession_proof', label: 'Preuve de profession' },
  { value: 'criminal_record', label: 'Casier judiciaire' },
  { value: 'afro_descent_proof', label: "Preuve d'afro-descendance" },
  { value: 'notarial_act', label: 'Acte notarial' },
  { value: 'military_act', label: 'Acte militaire' },
  { value: 'baptism_certificate', label: 'Acte de baptême' },
  { value: 'notoriety_act', label: 'Acte de notoriété' },
  { value: 'slave_register', label: "Registre d'esclaves / Matricule" },
  { value: 'census_record', label: 'Recensement / Liste électorale' },
  { value: 'custom_certificate', label: 'Certificat de coutume' },
  { value: 'historical_identity', label: "Pièce d'identité historique" },
  { value: 'other', label: 'Autre document historique' },
];

interface DocumentUploaderProps {
  treeId: string;
  personId: string | null;
  onUploaded?: () => void;
}

export default function DocumentUploader({
  treeId,
  personId,
  onUploaded,
}: DocumentUploaderProps) {
  const [docType, setDocType] = useState<DocType>('birth_certificate');
  const [issuedDate, setIssuedDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File) {
    if (!file) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Utilisateur non authentifié');

      const path = `${user.id}/${treeId}/${Date.now()}_${file.name}`;
      
      // Upload file directly to genealogia-docs bucket
      const { error: upErr } = await supabase.storage
        .from('genealogia-docs')
        .upload(path, file);
      if (upErr) throw upErr;

      // Create signed URL for secure temporal access
      const { data: signed } = await supabase.storage
        .from('genealogia-docs')
        .createSignedUrl(path, 60 * 60 * 24 * 7); // Valid for 7 days

      const isExpirable = EXPIRABLE_DOC_TYPES.includes(docType);

      // Insert record inside documents table
      const { error: insErr } = await supabase.from('genealogy_documents').insert({
        user_id: user.id,
        tree_id: treeId,
        person_id: personId,
        doc_type: docType,
        title: file.name,
        file_path: path,
        file_url: signed?.signedUrl ?? null,
        issued_date: issuedDate || null,
        expires_check: isExpirable,
      });
      if (insErr) throw insErr;

      onUploaded?.();
      alert('Document téléversé et enregistré avec succès ! ');
      
      // Reset inputs
      setIssuedDate('');
    } catch (err: any) {
      console.error(err);
      alert('Erreur lors du transfert : ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      uploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      uploadFile(e.target.files[0]);
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-4">
      {/* Configuration row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-black text-gray-500 mb-1.5 block uppercase tracking-widest">
            Type de Pièce
          </label>
          <div className="relative">
            <select
              className="w-full bg-[#0a0f14] border border-white/5 rounded-xl py-2.5 px-3 text-white text-xs focus:outline-none focus:border-emerald-500/50"
              value={docType}
              onChange={e => setDocType(e.target.value as DocType)}
            >
              {DOC_TYPES.map(d => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-[10px] font-black text-gray-500 mb-1.5 block uppercase tracking-widest">
            Date de délivrance / émission
          </label>
          <div className="relative flex items-center">
            <input
              type="date"
              className="w-full bg-white/[0.03] border border-white/5 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-emerald-500/50 placeholder:text-gray-600"
              value={issuedDate}
              onChange={e => setIssuedDate(e.target.value)}
              title="Date d'émission de la pièce"
            />
          </div>
        </div>
      </div>

      {/* Drag & Drop Zone */}
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={onButtonClick}
        className={cn(
          "border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 min-h-[140px]",
          dragActive
            ? "border-[#FCD116] bg-[#FCD116]/5"
            : "border-white/5 bg-white/[0.01] hover:bg-white/[0.02] hover:border-white/10"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple={false}
          onChange={handleChange}
          accept="image/*,application/pdf"
          disabled={loading}
        />

        {loading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="animate-spin text-[#FCD116]" size={28} />
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Téléversement en cours…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center">
            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-3 text-gray-400 group-hover:text-white transition-colors">
              <Upload size={18} />
            </div>
            
            <p className="text-xs font-bold text-white mb-1">
              Glissez votre fichier ici, ou <span className="text-[#FCD116] underline underline-offset-4">parcourez</span>
            </p>
            <p className="text-[10px] text-gray-500 font-medium">
              Formats acceptés : PDF, PNG, JPG (Max 15 Mo)
            </p>
          </div>
        )}
      </div>

      {/* Requirements alerts */}
      {EXPIRABLE_DOC_TYPES.includes(docType) && (
        <div className="flex items-start gap-2 bg-[#fffbeb]/5 border border-[#b45309]/20 p-3 rounded-xl">
          <AlertCircle size={14} className="text-[#FCD116] mt-0.5 shrink-0" />
          <p className="text-[10px] text-gray-400 font-medium leading-relaxed">
            <strong className="text-[#FCD116]">Règle de validité :</strong> Ce type de document doit impérativement dater de <strong className="text-[#FCD116]">moins de 3 mois</strong> pour être accepté dans le dossier officiel. Veuillez indiquer la date d&apos;émission correcte.
          </p>
        </div>
      )}
    </div>
  );
}
