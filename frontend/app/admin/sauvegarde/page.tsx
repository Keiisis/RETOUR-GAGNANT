'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Archive, DownloadSimple, MagnifyingGlass, X, User, Envelope, Phone, MapPin,
    FolderOpen, Globe, Receipt, FileText, CreditCard, ChatText, Calendar,
    CheckCircle, WarningCircle, Buildings, Ticket, Sparkle, Spinner,
} from '@phosphor-icons/react'
import { supabase } from '@/lib/supabase'
import { T } from '@/lib/translation'

/* ═══════════════════════════════════════════════════════════
   ADMIN · SAUVEGARDE
   Vue complète de tous les clients reçus depuis le début +
   export ZIP (un dossier par client, tout dedans).
═══════════════════════════════════════════════════════════ */

interface Counts {
    dossiers: number; nationalite: number; commandes: number; factures: number
    devis: number; paiements: number; messages: number; rendez_vous: number
    documents: number; logements: number; evenements: number; contrats: number; total: number
}
interface ClientSummary {
    key: string; id: string | null; email: string; nom: string; prenom: string
    phone: string; ville: string; pays: string; created_at: string | null
    hasAccount: boolean; counts: Counts; services: string[]
}
interface Totals { clients: number; comptes: number; dossiers: number; nationalite: number; commandes: number; factures: number; paiements: number }

async function authHeaders(): Promise<HeadersInit> {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
}

export default function SauvegardePage() {
    const [clients, setClients] = useState<ClientSummary[]>([])
    const [totals, setTotals] = useState<Totals | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [search, setSearch] = useState('')
    const [exporting, setExporting] = useState(false)
    const [exportingKey, setExportingKey] = useState<string | null>(null)
    const [selected, setSelected] = useState<string | null>(null)

    const load = useCallback(async () => {
        setLoading(true); setError('')
        try {
            const res = await fetch('/api/admin/backup', { headers: await authHeaders(), cache: 'no-store' })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Échec du chargement')
            setClients(json.clients || [])
            setTotals(json.totals || null)
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Erreur inconnue')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { load() }, [load])

    const download = async (url: string, fallbackName: string, keyBusy?: string) => {
        if (keyBusy) setExportingKey(keyBusy); else setExporting(true)
        setError('')
        try {
            const res = await fetch(url, { headers: await authHeaders(), cache: 'no-store' })
            if (!res.ok) {
                let msg = 'Échec de l\'export'
                try { msg = (await res.json()).error || msg } catch { /* binaire */ }
                throw new Error(msg)
            }
            const blob = await res.blob()
            const cd = res.headers.get('Content-Disposition') || ''
            const m = cd.match(/filename="?([^"]+)"?/)
            const name = m ? m[1] : fallbackName
            const objUrl = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = objUrl; a.download = name
            document.body.appendChild(a); a.click(); a.remove()
            URL.revokeObjectURL(objUrl)
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Erreur inconnue')
        } finally {
            setExporting(false); setExportingKey(null)
        }
    }

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase()
        if (!q) return clients
        return clients.filter(c =>
            [c.nom, c.prenom, c.email, c.phone, c.ville, c.pays, ...c.services]
                .join(' ').toLowerCase().includes(q)
        )
    }, [clients, search])

    return (
        <div className="space-y-6">
            {/* ═══ En-tête ═══ */}
            <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
                className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Archive size={15} className="text-[var(--panel-accent)]" weight="fill" />
                        <span className="text-[10px] font-bold text-[var(--panel-accent)] uppercase tracking-[0.3em]">
                            <T>Sauvegarde</T>
                        </span>
                    </div>
                    <h1 className="text-2xl font-black font-heading tracking-tight text-[var(--panel-text)]">
                        <T>Sauvegarde des clients</T>
                    </h1>
                    <p className="text-sm text-[var(--panel-text-muted)] mt-1 max-w-2xl">
                        <T>Toutes les personnes reçues depuis le début : informations, services, discussions, dossiers, paiements, factures et devis. Exportez l&apos;intégralité dans un ZIP classé par client.</T>
                    </p>
                </div>
                <button
                    onClick={() => download('/api/admin/backup/export', 'sauvegarde-clients.zip')}
                    disabled={exporting || loading}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#FCD116] px-5 py-3 text-sm font-black text-[#0a0f18] shadow-[0_8px_24px_-6px_rgba(252,209,22,0.5)] transition-all hover:brightness-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {exporting
                        ? <Spinner size={18} className="animate-spin" />
                        : <DownloadSimple size={18} weight="bold" />}
                    <T>Exporter Sauvegarde</T>
                </button>
            </motion.div>

            {/* ═══ Stats ═══ */}
            {totals && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    <Stat label="Clients" value={totals.clients} icon={<User size={16} />} />
                    <Stat label="Comptes" value={totals.comptes} icon={<CheckCircle size={16} />} />
                    <Stat label="Dossiers" value={totals.dossiers} icon={<FolderOpen size={16} />} />
                    <Stat label="Nationalité" value={totals.nationalite} icon={<Globe size={16} />} />
                    <Stat label="Commandes" value={totals.commandes} icon={<Receipt size={16} />} />
                    <Stat label="Factures" value={totals.factures} icon={<FileText size={16} />} />
                </div>
            )}

            {/* ═══ Recherche ═══ */}
            <div className="relative max-w-md">
                <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--panel-text-muted)]" />
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Rechercher un client (nom, e-mail, service…)"
                    className="w-full rounded-xl border py-2.5 pl-9 pr-3 text-sm outline-none transition-colors"
                    style={{ background: 'var(--panel-surface)', borderColor: 'var(--panel-border)', color: 'var(--panel-text)' }}
                />
            </div>

            {error && (
                <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                    <WarningCircle size={16} weight="fill" /> {error}
                </div>
            )}

            {/* ═══ Liste ═══ */}
            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <Spinner size={28} className="animate-spin text-[var(--panel-accent)]" />
                </div>
            ) : filtered.length === 0 ? (
                <div className="rounded-2xl border border-dashed py-16 text-center text-sm text-[var(--panel-text-muted)]"
                    style={{ borderColor: 'var(--panel-border)' }}>
                    <T>Aucun client trouvé.</T>
                </div>
            ) : (
                <div className="rounded-2xl border overflow-hidden"
                    style={{ borderColor: 'var(--panel-border)', background: 'var(--panel-surface)' }}>
                    {filtered.map((c, i) => (
                        <button
                            key={c.key}
                            onClick={() => setSelected(c.key)}
                            className="flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.03]"
                            style={{ borderTop: i === 0 ? 'none' : '1px solid var(--panel-border)' }}
                        >
                            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-sm font-black"
                                style={{ background: 'var(--panel-accent)', color: '#0a0f18' }}>
                                {(c.prenom?.[0] || c.nom?.[0] || c.email?.[0] || '?').toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="truncate font-bold text-[var(--panel-text)]">
                                        {[c.prenom, c.nom].filter(Boolean).join(' ') || c.email || '(sans nom)'}
                                    </span>
                                    {c.hasAccount
                                        ? <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-[9px] font-bold uppercase text-green-400">Compte</span>
                                        : <span className="rounded-full bg-white/5 px-2 py-0.5 text-[9px] font-bold uppercase text-[var(--panel-text-muted)]">Hors-compte</span>}
                                </div>
                                <div className="truncate text-xs text-[var(--panel-text-muted)]">{c.email || c.phone || '—'}</div>
                                {c.services.length > 0 && (
                                    <div className="mt-1 flex flex-wrap gap-1">
                                        {c.services.map(sv => (
                                            <span key={sv} className="rounded-md bg-[var(--panel-accent)]/10 px-1.5 py-0.5 text-[9px] font-bold text-[var(--panel-accent)]">{sv}</span>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="hidden flex-shrink-0 items-center gap-3 text-[10px] font-bold text-[var(--panel-text-muted)] sm:flex">
                                <Pill n={c.counts.dossiers} label="Doss." />
                                <Pill n={c.counts.factures} label="Fact." />
                                <Pill n={c.counts.paiements} label="Paie." />
                                <Pill n={c.counts.messages} label="Msg" />
                            </div>
                            <span className="rounded-lg px-2 py-1 text-[10px] font-black"
                                style={{ background: 'var(--panel-bg)', color: 'var(--panel-text)' }}>
                                {c.counts.total} <T>éléments</T>
                            </span>
                        </button>
                    ))}
                </div>
            )}

            {/* ═══ Détail client ═══ */}
            <AnimatePresence>
                {selected && (
                    <ClientDetail
                        clientKey={selected}
                        onClose={() => setSelected(null)}
                        onExport={(k, name) => download(`/api/admin/backup/export?client=${encodeURIComponent(k)}`, name, k)}
                        exporting={exportingKey === selected}
                    />
                )}
            </AnimatePresence>
        </div>
    )
}

function Stat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
    return (
        <div className="rounded-xl border p-3" style={{ borderColor: 'var(--panel-border)', background: 'var(--panel-surface)' }}>
            <div className="flex items-center gap-1.5 text-[var(--panel-text-muted)]">
                {icon}
                <span className="text-[10px] font-bold uppercase tracking-wider"><T>{label}</T></span>
            </div>
            <div className="mt-1 text-2xl font-black text-[var(--panel-text)]">{value}</div>
        </div>
    )
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="flex items-center justify-between gap-3 border-b py-1.5 last:border-0" style={{ borderColor: 'var(--panel-border)' }}>
            <span className="flex items-center gap-1.5 text-xs text-[var(--panel-text-muted)]">
                <span className="text-[var(--panel-accent)]">{icon}</span>{label}
            </span>
            <span className="text-right text-sm font-semibold text-[var(--panel-text)] break-all">{value}</span>
        </div>
    )
}

function Pill({ n, label }: { n: number; label: string }) {
    return (
        <div className="flex flex-col items-center">
            <span className={`text-sm font-black ${n > 0 ? 'text-[var(--panel-text)]' : 'text-[var(--panel-text-muted)]/50'}`}>{n}</span>
            <span className="text-[8px] uppercase">{label}</span>
        </div>
    )
}

/* ─────────────────────────────────────────────────────────
   Détail complet d'un client (drawer)
───────────────────────────────────────────────────────── */
interface ClientDetailData {
    client: {
        key: string; id: string | null; email: string; nom: string; prenom: string
        phone: string; ville: string; pays: string; created_at: string | null; hasAccount: boolean
        profile: Record<string, unknown> | null
        data: Record<string, Record<string, unknown>[]>
        discussions: { thread: Record<string, unknown>; messages: Record<string, unknown>[] }[]
    }
    summary: ClientSummary
}

function ClientDetail({ clientKey, onClose, onExport, exporting }: {
    clientKey: string
    onClose: () => void
    onExport: (key: string, name: string) => void
    exporting: boolean
}) {
    const [data, setData] = useState<ClientDetailData | null>(null)
    const [loading, setLoading] = useState(true)
    const [err, setErr] = useState('')

    useEffect(() => {
        let alive = true
        ;(async () => {
            setLoading(true); setErr('')
            try {
                const res = await fetch(`/api/admin/backup?client=${encodeURIComponent(clientKey)}`, { headers: await authHeaders(), cache: 'no-store' })
                const json = await res.json()
                if (!res.ok) throw new Error(json.error || 'Échec')
                if (alive) setData(json)
            } catch (e) {
                if (alive) setErr(e instanceof Error ? e.message : 'Erreur')
            } finally {
                if (alive) setLoading(false)
            }
        })()
        return () => { alive = false }
    }, [clientKey])

    const c = data?.client
    const d = c?.data || {}
    const dfRows = (d.documents_financiers || [])
    const factures = dfRows.filter(r => String(r.type || '').toLowerCase() === 'facture')
    const devis = dfRows.filter(r => String(r.type || '').toLowerCase() === 'devis')

    const fdate = (v: unknown) => { const dd = new Date(String(v)); return isNaN(dd.getTime()) ? String(v ?? '') : dd.toLocaleString('fr-FR') }

    return (
        <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <motion.aside
                initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                transition={{ type: 'spring', stiffness: 300, damping: 32 }}
                className="fixed right-0 top-0 z-[91] flex h-full w-full max-w-2xl flex-col border-l shadow-2xl"
                style={{ background: 'var(--panel-bg)', borderColor: 'var(--panel-border)' }}
            >
                {/* Header drawer */}
                <div className="flex items-center justify-between gap-3 border-b px-5 py-4" style={{ borderColor: 'var(--panel-border)' }}>
                    <div className="min-w-0">
                        <h2 className="truncate text-lg font-black text-[var(--panel-text)]">
                            {c ? ([c.prenom, c.nom].filter(Boolean).join(' ') || c.email || 'Client') : '…'}
                        </h2>
                        {c && <p className="truncate text-xs text-[var(--panel-text-muted)]">{c.email}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                        {c && (
                            <button
                                onClick={() => onExport(c.key, `sauvegarde-${(c.nom || c.email || 'client')}.zip`)}
                                disabled={exporting}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-[#FCD116] px-3 py-2 text-xs font-black text-[#0a0f18] transition-all hover:brightness-105 active:scale-95 disabled:opacity-50"
                            >
                                {exporting ? <Spinner size={14} className="animate-spin" /> : <DownloadSimple size={14} weight="bold" />}
                                <T>Exporter</T>
                            </button>
                        )}
                        <button onClick={onClose} className="rounded-lg p-2 text-[var(--panel-text-muted)] hover:bg-white/5" title="Fermer">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Corps */}
                <div className="flex-1 overflow-y-auto p-5 scrollbar-premium">
                    {loading ? (
                        <div className="flex h-40 items-center justify-center"><Spinner size={24} className="animate-spin text-[var(--panel-accent)]" /></div>
                    ) : err ? (
                        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{err}</div>
                    ) : c ? (
                        <div className="space-y-6">
                            {/* Identité */}
                            <Section title="Identité" icon={<User size={15} />}>
                                <InfoRow icon={<Envelope size={13} />} label="E-mail" value={c.email || '—'} />
                                <InfoRow icon={<Phone size={13} />} label="Téléphone" value={c.phone || '—'} />
                                <InfoRow icon={<MapPin size={13} />} label="Ville / Pays" value={[c.ville, c.pays].filter(Boolean).join(', ') || '—'} />
                                <InfoRow icon={<Calendar size={13} />} label="Inscrit le" value={c.created_at ? fdate(c.created_at) : '—'} />
                                <InfoRow icon={<CheckCircle size={13} />} label="Compte" value={c.hasAccount ? `Oui (${c.id})` : 'Non (hors-compte)'} />
                            </Section>

                            {/* Dossiers */}
                            <ListSection title="Dossiers" icon={<FolderOpen size={15} />} rows={d.dossiers}
                                render={r => ({
                                    title: String(r.num_dossier || r.service_type || 'Dossier'),
                                    sub: `${String(r.statut || r.status || '—')} · ${fdate(r.created_at)}`,
                                })} />

                            {/* Nationalité */}
                            <ListSection title="Demandes de nationalité" icon={<Globe size={15} />} rows={d.nationalite}
                                render={r => ({
                                    title: String(r.reference || 'Demande'),
                                    sub: `${String(r.status || '—')} · ${String(r.payment_status || '')} · ${fdate(r.created_at)}`,
                                })} />

                            {/* Commandes */}
                            <ListSection title="Commandes" icon={<Receipt size={15} />} rows={d.commandes}
                                render={r => ({
                                    title: String(r.product_title || 'Commande'),
                                    sub: `${new Intl.NumberFormat('fr-FR').format(Number(r.amount) || 0)} ${String(r.currency || 'XOF')} · ${String(r.payment_status || '')} · ${fdate(r.created_at)}`,
                                })} />

                            {/* Factures */}
                            <ListSection title="Factures" icon={<FileText size={15} />} rows={factures}
                                render={r => ({
                                    title: String(r.numero || 'Facture'),
                                    sub: `${new Intl.NumberFormat('fr-FR').format(Number(r.total) || 0)} ${String(r.currency || 'XOF')} · ${String(r.status || '')} · ${fdate(r.created_at)}`,
                                })} />

                            {/* Devis */}
                            <ListSection title="Devis" icon={<FileText size={15} />} rows={devis}
                                render={r => ({
                                    title: String(r.numero || 'Devis'),
                                    sub: `${new Intl.NumberFormat('fr-FR').format(Number(r.total) || 0)} ${String(r.currency || 'XOF')} · ${String(r.status || '')} · ${fdate(r.created_at)}`,
                                })} />

                            {/* Paiements */}
                            <ListSection title="Paiements" icon={<CreditCard size={15} />}
                                rows={[...(d.paiements || []), ...(d.paiements_manuels || [])]}
                                render={r => ({
                                    title: `${new Intl.NumberFormat('fr-FR').format(Number(r.montant || r.amount) || 0)} ${String(r.currency || 'XOF')}`,
                                    sub: `${String(r.provider || r.methode || r.type || '')} · ${String(r.status || r.statut || '')} · ${fdate(r.created_at)}`,
                                })} />

                            {/* Rendez-vous */}
                            <ListSection title="Rendez-vous" icon={<Calendar size={15} />} rows={d.rendez_vous}
                                render={r => ({
                                    title: `${String(r.date || '')} ${String(r.heure || '')}`.trim() || 'Rendez-vous',
                                    sub: `${String(r.type || '')} · ${String(r.statut || '')}`,
                                })} />

                            {/* Logements */}
                            <ListSection title="Logements (leads)" icon={<Buildings size={15} />} rows={d.logements}
                                render={r => ({ title: String(r.programme || r.type || 'Lead logement'), sub: fdate(r.created_at) })} />

                            {/* Événements */}
                            <ListSection title="Événements" icon={<Ticket size={15} />} rows={d.evenements}
                                render={r => ({ title: String(r.event_title || r.event_id || 'Inscription'), sub: fdate(r.created_at) })} />

                            {/* Contrats */}
                            <ListSection title="Contrats" icon={<FileText size={15} />} rows={d.contrats}
                                render={r => ({ title: String(r.serial || r.titre || 'Contrat'), sub: `${String(r.status || '')} · ${fdate(r.created_at)}` })} />

                            {/* Documents téléversés */}
                            <ListSection title="Documents téléversés" icon={<FolderOpen size={15} />} rows={d.documents}
                                render={r => ({ title: String(r.nom_fichier || r.name || 'Document'), sub: `${String(r.type_fichier || '')} · ${fdate(r.created_at)}` })} />

                            {/* Discussions */}
                            <Section title={`Discussions (${c.discussions.length})`} icon={<ChatText size={15} />}>
                                {c.discussions.length === 0 ? (
                                    <p className="text-xs text-[var(--panel-text-muted)]"><T>Aucune discussion.</T></p>
                                ) : c.discussions.map((t, i) => (
                                    <div key={i} className="rounded-lg border p-3" style={{ borderColor: 'var(--panel-border)' }}>
                                        <div className="mb-2 flex items-center gap-2">
                                            <Sparkle size={12} className="text-[var(--panel-accent)]" />
                                            <span className="text-xs font-bold text-[var(--panel-text)]">{String(t.thread.sujet || 'Sans sujet')}</span>
                                            <span className="ml-auto text-[10px] text-[var(--panel-text-muted)]">{t.messages.length} msg</span>
                                        </div>
                                        <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                            {t.thread.message ? (
                                                <Bubble who="client" text={String(t.thread.message)} />
                                            ) : null}
                                            {t.messages.map((m, j) => (
                                                <Bubble key={j} who={String(m.role).toLowerCase() === 'client' ? 'client' : 'rgb'} text={String(m.content)} />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </Section>
                        </div>
                    ) : null}
                </div>
            </motion.aside>
        </>
    )
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <div>
            <div className="mb-2 flex items-center gap-2">
                <span className="text-[var(--panel-accent)]">{icon}</span>
                <h3 className="text-[11px] font-black uppercase tracking-[0.15em] text-[var(--panel-text)]">{title}</h3>
            </div>
            <div className="space-y-1.5 rounded-xl border p-3" style={{ borderColor: 'var(--panel-border)', background: 'var(--panel-surface)' }}>
                {children}
            </div>
        </div>
    )
}

function ListSection({ title, icon, rows, render }: {
    title: string; icon: React.ReactNode
    rows: Record<string, unknown>[] | undefined
    render: (r: Record<string, unknown>) => { title: string; sub: string }
}) {
    if (!rows || rows.length === 0) return null
    return (
        <Section title={`${title} (${rows.length})`} icon={icon}>
            {rows.map((r, i) => {
                const { title: t, sub } = render(r)
                return (
                    <div key={i} className="flex items-start justify-between gap-3 border-b py-1.5 last:border-0" style={{ borderColor: 'var(--panel-border)' }}>
                        <span className="text-sm font-semibold text-[var(--panel-text)]">{t}</span>
                        <span className="text-right text-[11px] text-[var(--panel-text-muted)]">{sub}</span>
                    </div>
                )
            })}
        </Section>
    )
}

function Bubble({ who, text }: { who: 'client' | 'rgb'; text: string }) {
    const mine = who === 'rgb'
    return (
        <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-lg px-2.5 py-1.5 text-xs ${mine ? 'bg-[var(--panel-accent)]/15 text-[var(--panel-text)]' : 'bg-white/5 text-[var(--panel-text-muted)]'}`}>
                <span className="mb-0.5 block text-[8px] font-bold uppercase opacity-60">{mine ? 'Équipe RGB' : 'Client'}</span>
                {text}
            </div>
        </div>
    )
}
