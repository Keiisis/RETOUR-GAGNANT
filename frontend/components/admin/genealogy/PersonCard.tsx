'use client';

import { Person } from '@/lib/genealogy/types';
import { getRoleLabel } from '@/lib/genealogy/requirements';
import { CheckCircle as CheckCircle2, Warning as AlertTriangle, WarningCircle as AlertCircle, Crown, MapPin, Calendar } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/lib/theme/ThemeContext';

interface PersonCardProps {
  person: Person;
  status: 'complete' | 'partial' | 'missing';
  onClick?: () => void;
  selected?: boolean;
  childNumber?: number;
  compact?: boolean;
}

/* ── Formate une date ISO en DD/MM/YYYY ── */
function formatFullDate(iso: string | null): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  } catch {
    return iso;
  }
}

export default function PersonCard({ person, status, onClick, selected, childNumber, compact = false }: PersonCardProps) {
  const isSelf = person.is_self || person.relation_role === 'self';
  const isPartner = ['husband', 'wife', 'fiance', 'fiancee'].includes(person.relation_role || '');
  const isDeceased = !!person.death_date;
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const statusConfig = {
    complete: {
      border: 'border-[#008751]/40',
      ring: 'ring-[#008751]/50',
      text: 'text-[#008751]',
      glow: 'shadow-[0_0_32px_-8px_rgba(0,135,81,0.6)]',
      dotColor: 'bg-[#008751]',
      icon: CheckCircle2,
      label: 'Complet',
    },
    partial: {
      border: 'border-[#FCD116]/35',
      ring: 'ring-[#FCD116]/50',
      text: 'text-[#FCD116]',
      glow: 'shadow-[0_0_32px_-8px_rgba(252,209,22,0.5)]',
      dotColor: 'bg-[#FCD116]',
      icon: AlertTriangle,
      label: 'Partiel',
    },
    missing: {
      border: 'border-[#E8112D]/20',
      ring: 'ring-[#E8112D]/30',
      text: 'text-[#E8112D]/80',
      glow: 'shadow-[0_0_32px_-10px_rgba(232,17,45,0.4)]',
      dotColor: 'bg-[#E8112D]',
      icon: AlertCircle,
      label: 'Incomplet',
    },
  }[status];

  const StatusIcon = statusConfig.icon;

  // Gender-based theming
  const genderTheme =
    person.gender === 'male'
      ? {
        backdrop: 'from-blue-500/[0.10] to-transparent',
        ringHover: 'group-hover:shadow-[0_0_20px_-4px_rgba(59,130,246,0.35)]',
        accentColor: 'rgba(59,130,246,0.15)',
      }
      : person.gender === 'female'
        ? {
          backdrop: 'from-pink-500/[0.10] to-transparent',
          ringHover: 'group-hover:shadow-[0_0_20px_-4px_rgba(236,72,153,0.35)]',
          accentColor: 'rgba(236,72,153,0.15)',
        }
        : {
          backdrop: 'from-violet-500/[0.08] to-transparent',
          ringHover: 'group-hover:shadow-[0_0_20px_-4px_rgba(139,92,246,0.35)]',
          accentColor: 'rgba(139,92,246,0.15)',
        };

  // Full date display: DD/MM/YYYY – DD/MM/YYYY
  const birthStr = formatFullDate(person.birth_date);
  const deathStr = formatFullDate(person.death_date);
  const dateDisplay = birthStr
    ? deathStr ? `${birthStr} – ${deathStr}` : birthStr
    : '';

  // Gender-aware role label
  const roleLabel = person.relation_role === 'child' && childNumber !== undefined
    ? `${childNumber}${childNumber === 1 ? 'er' : 'ème'} Enfant`
    : getRoleLabel(person.relation_role, person.gender);

  // ─── COMPACT MODE (for A4 print) ───
  if (compact) {
    return (
      <div
        onClick={onClick}
        className={cn(
          'group relative flex h-full w-full cursor-pointer flex-col justify-center overflow-hidden transition-all duration-200',
          'border backdrop-blur-lg px-2 py-1.5 rounded-lg',
          statusConfig.border,
          isDeceased && 'opacity-75',
          selected && cn('ring-1 scale-[1.02]', statusConfig.ring),
          isSelf && 'ring-1 ring-[#FCD116]/20'
        )}
        style={{
          background: isDark ? 'rgba(10,15,24,0.95)' : 'rgba(255,255,255,0.95)',
        }}
      >
        {/* Top accent bar */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[1px] rounded-t-lg opacity-40"
          style={{ background: 'linear-gradient(90deg, transparent, #008751, #FCD116, #E8112D, transparent)' }}
        />

        {/* Crown badge for self */}
        {isSelf && (
          <div className="absolute -right-0.5 -top-0.5 z-20 flex h-4 w-4 items-center justify-center rounded-full border border-[#FCD116]/50 bg-[#FCD116]/25">
            <Crown size={8} className="text-[#FCD116]" />
          </div>
        )}

        <div className="flex flex-col items-center justify-center text-center gap-0.5 w-full">
          {/* First name */}
          <p className="w-full truncate text-[11px] font-black leading-tight text-[#1a2332] dark:text-white">
            {person.first_name || 'Sans prénom'}
          </p>
          {/* Last name */}
          <p className="w-full truncate text-[9px] font-black uppercase tracking-wide leading-tight text-[#1a2332] dark:text-white">
            {person.last_name || 'Sans nom'}
          </p>
          {/* Role */}
          <span className="w-full truncate text-[7px] font-bold uppercase tracking-[0.1em] leading-snug"
            style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(26,35,50,0.6)' }}
          >
            {roleLabel}
          </span>
          {/* Date only */}
          <p className="w-full truncate font-mono text-[8px] font-bold text-[#1a2332] dark:text-white leading-snug mt-0.5">
            {dateDisplay || '—'}
          </p>
        </div>
      </div>
    );
  }

  // ─── NORMAL MODE ───
  return (
    <div
      onClick={onClick}
      className={cn(
        'group relative flex h-full w-full cursor-pointer flex-col justify-center overflow-hidden rounded-2xl transition-all duration-300',
        'border-2 backdrop-blur-lg px-4 py-3',
        statusConfig.border,
        isDeceased && 'opacity-75',
        selected
          ? cn('ring-2 scale-[1.04]', statusConfig.ring, statusConfig.glow)
          : cn('hover:scale-[1.03]', genderTheme.ringHover),
        isSelf && 'ring-1 ring-[#FCD116]/20'
      )}
      style={{
        background: isDark ? 'rgba(10,15,24,0.95)' : 'rgba(255,255,255,0.95)',
      }}
    >
      {/* Background gradient based on gender */}
      <div
        className={cn(
          'pointer-events-none absolute inset-0 -z-10 rounded-2xl bg-gradient-to-br opacity-60 transition-opacity group-hover:opacity-100',
          genderTheme.backdrop
        )}
      />

      {/* Top accent bar (tricolore subtil) */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[2px] rounded-t-2xl opacity-40"
        style={{ background: 'linear-gradient(90deg, transparent, #008751, #FCD116, #E8112D, transparent)' }}
      />

      {/* Crown badge for self */}
      {isSelf && (
        <div className="absolute -right-0.5 -top-0.5 z-20 flex h-6 w-6 items-center justify-center rounded-full border border-[#FCD116]/50 bg-[#FCD116]/25 shadow-[0_0_12px_rgba(252,209,22,0.5)]">
          <Crown size={11} className="text-[#FCD116]" />
        </div>
      )}

      {/* ── Content: Names prominent, no avatar ── */}
      <div className="flex flex-col items-center justify-center text-center gap-1 w-full">
        {/* First name — large and bold */}
        <p className="w-full truncate text-[19px] font-black leading-tight text-[#1a2332] dark:text-white">
          {person.first_name || 'Sans prénom'}
        </p>
        {/* Last name — slightly smaller, uppercase */}
        <p className="w-full truncate text-[15px] font-black uppercase tracking-wide leading-tight text-[#1a2332] dark:text-white">
          {person.last_name || 'Sans nom'}
        </p>

        {/* Role label — gendered */}
        <span className="mt-1 w-full truncate text-[10px] font-black uppercase tracking-[0.12em] leading-snug"
          style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(26,35,50,0.6)' }}
        >
          {roleLabel}
        </span>

        {/* Birth place — bold, black/white, visible */}
        <div className="flex items-center justify-center gap-1.5 w-full mt-1.5 px-1">
          <MapPin size={14} className="shrink-0 text-[#1a2332] dark:text-white" />
          <p className="truncate text-[13px] font-black text-[#1a2332] dark:text-white leading-snug">
            {person.birth_place || 'Lieu inconnu'}
          </p>
        </div>

        {/* Birth / death dates — bold, black/white, visible */}
        <div className="flex items-center justify-center gap-1.5 w-full mt-0.5 px-1">
          <Calendar size={14} className="shrink-0 text-[#1a2332] dark:text-white" />
          <p className="truncate font-mono text-[13px] font-black text-[#1a2332] dark:text-white leading-snug">
            {dateDisplay || 'Dates inconnues'}
          </p>
        </div>

        {/* Bottom row: status */}
        <div className="mt-1.5 flex items-center justify-center gap-1.5 shrink-0">
          <StatusIcon size={12} className={statusConfig.text} />
          <span className={cn('relative flex h-2 w-2 rounded-full', statusConfig.dotColor)}>
            {status === 'complete' && (
              <span className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-50', statusConfig.dotColor)} />
            )}
          </span>
          <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 ml-0.5">
            {statusConfig.label}
          </span>
        </div>
      </div>
    </div>
  );
}