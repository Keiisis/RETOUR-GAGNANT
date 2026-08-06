'use client';

import { Alert } from '@/lib/genealogy/types';
import { WarningCircle as AlertCircle, Warning as AlertTriangle, CheckCircle, Info, CaretRight as ChevronRight } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

const levelStyles: Record<string, { bg: string; border: string; text: string; icon: any }> = {
  error: { 
    bg: 'bg-[#fff5f5]/[0.02]', 
    border: 'border-[#E8112D]/20 hover:border-[#E8112D]/40', 
    text: 'text-[#E8112D]', 
    icon: AlertCircle 
  },
  warning: { 
    bg: 'bg-[#fffbeb]/[0.02]', 
    border: 'border-[#FCD116]/20 hover:border-[#FCD116]/40', 
    text: 'text-[#FCD116]', 
    icon: AlertTriangle 
  },
  success: { 
    bg: 'bg-[#f0fdf4]/[0.02]', 
    border: 'border-[#008751]/20 hover:border-[#008751]/40', 
    text: 'text-[#008751]', 
    icon: CheckCircle 
  },
  info: { 
    bg: 'bg-[#eff6ff]/[0.02]', 
    border: 'border-[#3b82f6]/20 hover:border-[#3b82f6]/40', 
    text: 'text-[#3b82f6]', 
    icon: Info 
  },
};

interface SmartAlertsProps {
  alerts: Alert[];
  title?: string;
  onAlertClick?: (role?: string) => void;
}

export default function SmartAlerts({ 
  alerts, 
  title = 'Actions Prioritaires',
  onAlertClick 
}: SmartAlertsProps) {
  if (!alerts.length) return null;

  return (
    <div className="bg-[#0a0f18]/80 backdrop-blur-md border border-white/5 p-5 rounded-[2rem] space-y-4">
      {/* Title */}
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <h3 className="text-xs font-black text-white uppercase tracking-widest font-heading">
          {title}
        </h3>
        <span className="bg-white/5 border border-white/10 text-[9px] font-mono font-bold text-gray-400 px-2 py-0.5 rounded-full">
          {alerts.length} ALERTES
        </span>
      </div>

      {/* Alerts list */}
      <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1 scrollbar-premium">
        {alerts.map((a, i) => {
          const s = levelStyles[a.level] || levelStyles.info;
          const Icon = s.icon;
          
          return (
            <div
              key={i}
              onClick={() => a.relatedRole && onAlertClick?.(a.relatedRole)}
              className={cn(
                "flex items-start justify-between gap-3 p-3.5 rounded-2xl border transition-all duration-300",
                s.bg,
                s.border,
                a.relatedRole ? "cursor-pointer group" : ""
              )}
            >
              <div className="flex items-start gap-2.5">
                <Icon size={14} className={cn("mt-0.5 shrink-0", s.text)} />
                <p className="text-[11px] font-medium text-gray-400 leading-relaxed">
                  {a.message}
                </p>
              </div>

              {a.relatedRole && (
                <ChevronRight 
                  size={12} 
                  className="text-gray-600 group-hover:text-white transition-colors shrink-0 mt-0.5" 
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
