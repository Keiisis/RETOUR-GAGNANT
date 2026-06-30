'use client';

import { DossierReport } from '@/lib/genealogy/types';
import { DOSSIER_LABELS } from '@/lib/genealogy/requirements';
import { FileText, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DossierProgressProps {
  report: DossierReport;
}

export default function DossierProgress({ report }: DossierProgressProps) {
  const isComplete = report.progress === 100;
  
  // Custom theme colors
  const colorClass = isComplete 
    ? 'text-[#008751]' 
    : report.progress >= 50 
      ? 'text-[#FCD116]' 
      : 'text-[#E8112D]';

  const barColorClass = isComplete
    ? 'bg-[#008751]'
    : report.progress >= 50
      ? 'bg-[#FCD116]'
      : 'bg-[#E8112D]';

  const glowStyle = isComplete
    ? 'shadow-[0_0_15px_rgba(0,135,81,0.2)]'
    : report.progress >= 50
      ? 'shadow-[0_0_15px_rgba(252,209,22,0.15)]'
      : 'shadow-[0_0_15px_rgba(232,17,45,0.1)]';

  return (
    <div className="bg-[#0a0f18]/80 backdrop-blur-md border border-white/5 rounded-3xl p-5 space-y-4">
      {/* Title & percentage */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-gray-400" />
          <h3 className="text-xs font-black tracking-widest text-white uppercase font-heading">
            {DOSSIER_LABELS[report.dossierType]}
          </h3>
        </div>
        
        <div className="flex items-center gap-1">
          {isComplete && <CheckCircle size={14} className="text-[#008751] animate-bounce" />}
          <span className={cn("text-sm font-black font-mono tracking-tight", colorClass)}>
            {report.progress}%
          </span>
        </div>
      </div>

      {/* Progress Track */}
      <div className="relative w-full bg-white/5 h-2 rounded-full overflow-hidden">
        <div 
          className={cn("h-full rounded-full transition-all duration-700 ease-out", barColorClass, glowStyle)}
          style={{ width: `${report.progress}%` }} 
        />
      </div>

      {/* Summary stats */}
      <div className="flex items-center justify-between text-[10px] text-gray-500 font-bold uppercase tracking-widest">
        <span>
          {report.totalFulfilled} / {report.totalRequired} documents validés
        </span>
        <span className="font-mono text-gray-600">
          {Math.round(report.progress)}% COMPLÉTÉ
        </span>
      </div>
    </div>
  );
}
