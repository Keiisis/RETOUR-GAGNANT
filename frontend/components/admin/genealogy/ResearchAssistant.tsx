'use client';

import { RESEARCH_RESOURCES } from '@/lib/genealogy/resources';
import { Alert } from '@/lib/genealogy/types';
import { Search, Globe, Library, Compass, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ResearchAssistantProps {
  hints: Alert[];
}

export default function ResearchAssistant({ hints }: ResearchAssistantProps) {
  
  const getResourceIcon = (category: string) => {
    switch (category) {
      case 'archives': return Library;
      case 'database': return Globe;
      case 'association': return Compass;
      default: return Search;
    }
  };

  return (
    <div className="bg-[#0a0f18]/80 backdrop-blur-md border border-white/5 p-6 rounded-[2rem] space-y-5">
      {/* Title */}
      <div className="flex items-center gap-2 border-b border-white/5 pb-3">
        <Search size={16} className="text-[#008751]" />
        <h3 className="text-sm font-black text-white uppercase tracking-widest font-heading">
          Assistant de Recherche
        </h3>
      </div>

      {/* Dynamic Hints Section */}
      {hints.length > 0 && (
        <div className="space-y-2">
          <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">
            Recommandations IA
          </p>
          {hints.map((h, i) => (
            <div 
              key={i} 
              className="bg-[#eff6ff]/[0.02] border border-[#3b82f6]/20 p-3.5 rounded-2xl flex items-start gap-2.5"
            >
              <span className="text-base shrink-0 select-none">💡</span>
              <p className="text-[11px] text-gray-400 font-medium leading-relaxed">
                {h.message}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Resources list */}
      <div className="space-y-3 pt-2">
        <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">
          Registres & Archives Utiles
        </p>
        
        <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1 scrollbar-premium">
          {RESEARCH_RESOURCES.map((r) => {
            const Icon = getResourceIcon(r.category);
            return (
              <a
                key={r.name}
                href={r.url}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  "flex items-start gap-3 p-3 rounded-2xl border border-white/5 bg-white/[0.01]",
                  "hover:bg-white/[0.03] hover:border-emerald-500/20 group transition-all duration-300"
                )}
              >
                <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-gray-400 group-hover:bg-[#008751]/10 group-hover:text-[#008751] transition-all flex-shrink-0 mt-0.5">
                  <Icon size={14} />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] font-black text-white truncate group-hover:text-[#FCD116] transition-colors">
                      {r.name}
                    </span>
                    <ArrowUpRight size={10} className="text-gray-600 group-hover:text-white transition-colors shrink-0" />
                  </div>
                  <p className="text-[10px] text-gray-500 font-medium truncate mt-0.5">
                    {r.description}
                  </p>
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}
