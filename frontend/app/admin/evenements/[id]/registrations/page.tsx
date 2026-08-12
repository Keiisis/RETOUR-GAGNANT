'use client'

import { useTranslation, T } from '@/lib/translation';
import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Users, QrCode, CheckCircle as CheckCircle2, Ticket, MagnifyingGlass as Search, Download, ArrowLeft, Envelope as Mail, Phone, Crown, Warning as AlertTriangle, ShieldCheck } from '@phosphor-icons/react';

// Dummy dynamic import placeholder for a hypothetical QR scanner
// import { Html5QrcodeScanner } from 'html5-qrcode'

interface TicketData {
    id: string
    ticket_code: string
    is_used: boolean
    used_at: string
    ticket_type: string
}

interface RegistrationData {
    id: string
    full_name: string
    email: string
    phone: string
    whatsapp: string
    ticket_type: string
    payment_status: string
    payment_method: string
    amount_paid: number
    currency: string
    created_at: string
    event_tickets: TicketData[]
}

export default function EventRegistrationsPage() {
    const { t } = useTranslation();
    const params = useParams()
    const router = useRouter()
    const eventId = params?.id as string

    const [regs, setRegs] = useState<RegistrationData[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [scanMode, setScanMode] = useState(false)
    const [scanResult, setScanResult] = useState<{ status: 'success' | 'error' | 'loading', message: string, data?: any } | null>(null)
    const [manualCode, setManualCode] = useState('')

    const fetchRegs = useCallback(() => {
        fetch(`/api/events/${eventId}/register?admin=true`)
            .then(r => r.json())
            .then(d => setRegs(d.registrations || []))
            .catch(() => { })
            .finally(() => setLoading(false))
    }, [eventId])

    useEffect(() => {
        if (eventId) fetchRegs()
    }, [eventId, fetchRegs])

    const validateTicket = async (code: string) => {
        setScanResult({ status: 'loading', message: 'Validation en cours...' })
        try {
            const res = await fetch(`/api/events/${eventId}/validate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ticket_code: code, validated_by: 'Admin' })
            })
            const data = await res.json()
            if (data.valid) {
                setScanResult({ status: 'success', message: data.message, data: data.ticket })
                fetchRegs() // Refresh list
            } else {
                setScanResult({ status: 'error', message: data.error })
            }
        } catch (e) {
            setScanResult({ status: 'error', message: 'Erreur réseau lors de la validation' })
        }
    }

    const filtered = regs.filter(r =>
        !search ||
        r.full_name.toLowerCase().includes(search.toLowerCase()) ||
        r.email.toLowerCase().includes(search.toLowerCase()) ||
        r.event_tickets?.[0]?.ticket_code.toLowerCase().includes(search.toLowerCase())
    )

    const totalVIP = regs.filter(r => r.ticket_type === 'vip').length
    const totalStandard = regs.filter(r => r.ticket_type === 'standard').length
    const totalRevenue = regs.reduce((sum, r) => sum + (r.amount_paid || 0), 0)

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.push('/admin/evenements')} className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center text-gray-500 hover:text-white transition-colors">
                        <ArrowLeft size={16} />
                    </button>
                    <div>
                        <h1 className="text-xl font-black flex items-center gap-2">
                            <Users size={18} className="text-[#008751]" /> Inscriptions
                        </h1>
                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mt-1">
                            {regs.length} participant{regs.length > 1 ? 's' : ''}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button onClick={() => setScanMode(!scanMode)}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all border ${scanMode ? 'bg-[#FCD116] text-black border-[#FCD116]' : 'bg-white/[0.04] text-white border-white/[0.08] hover:bg-white/[0.08]'}`}>
                        <QrCode size={14} /> {scanMode ? 'Fermer le Scanner' : 'Scanner QR Code'}
                    </button>
                    <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/[0.04] text-gray-300 text-xs font-black hover:bg-white/[0.08] border border-white/[0.08] transition-all">
                        <Download size={14} /> Exporter CSV
                    </button>
                </div>
            </div>

            {/* SCANNER VIEW */}
            {scanMode && (
                <div className="rounded-2xl border border-[#FCD116]/30 bg-[#FCD116]/5 p-6 animate-in fade-in slide-in-from-top-4">
                    <div className="max-w-md mx-auto space-y-5">
                        <div className="text-center">
                            <ShieldCheck size={32} className="mx-auto text-[#FCD116] mb-2" />
                            <h2 className="text-base font-black text-white"><T>Validation des tickets</T></h2>
                            <p className="text-xs text-gray-400"><T>Pour valider avec un pistolet laser, scannez le QR code ou utilisez la caméra de votre appareil.</T></p>
                        </div>

                        <div className="aspect-square bg-black rounded-xl border border-white/10 flex flex-col items-center justify-center text-gray-500 relative overflow-hidden">
                            <QrCode size={48} className="opacity-20 mb-4" />
                            <p className="text-xs font-bold text-center px-4"><T>Scanner caméra désactivé</T> <br /><T>(Simulé pour le test)</T></p>
                            {/* Scanning laser effect */}
                            <div className="absolute top-0 left-0 w-full h-[2px] bg-[#FCD116] shadow-[0_0_10px_#FCD116] animate-[scan_2s_ease-in-out_infinite] opacity-50" />
                        </div>

                        <div className="flex gap-2">
                            <input
                                type="text" value={manualCode} onChange={e => setManualCode(e.target.value.toUpperCase())}
                                placeholder={t("Code manuel (ex: RGB-XXXX)")}
                                className="flex-1 px-4 py-3 rounded-xl bg-black/50 border border-white/10 text-white font-mono text-sm focus:border-[#FCD116] outline-none"
                            />
                            <button onClick={() => validateTicket(manualCode)} disabled={!manualCode}
                                className="px-5 rounded-xl bg-[#FCD116] text-black font-black text-xs disabled:opacity-50"><T>Valider</T></button>
                        </div>

                        {scanResult && (
                            <div className={`p-4 rounded-xl border flex items-start gap-3 ${scanResult.status === 'success' ? 'bg-[#008751]/10 border-[#008751]/30 text-emerald-400' :
                                    scanResult.status === 'loading' ? 'bg-white/5 border-white/10 text-gray-400' :
                                        'bg-red-500/10 border-red-500/30 text-red-400'
                                }`}>
                                {scanResult.status === 'success' ? <CheckCircle2 size={16} className="mt-0.5" /> :
                                    scanResult.status === 'error' ? <AlertTriangle size={16} className="mt-0.5" /> :
                                        <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin mt-0.5" />}

                                <div>
                                    <p className="text-sm font-bold">{scanResult.message}</p>
                                    {scanResult.data && (
                                        <p className="text-[10px] opacity-70 mt-1">
                                            Ticket: {scanResult.data.ticket_code} : Validé à {new Date(scanResult.data.used_at).toLocaleTimeString()}
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* DASHBOARD STATS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                    <div className="text-[10px] font-bold text-gray-500 uppercase"><T>Total Inscrits</T></div>
                    <div className="text-2xl font-black mt-1">{regs.length}</div>
                </div>
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                    <div className="text-[10px] font-bold text-[#FCD116] uppercase"><T>VIP</T></div>
                    <div className="text-2xl font-black mt-1">{totalVIP}</div>
                </div>
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                    <div className="text-[10px] font-bold text-[#008751] uppercase"><T>Standard</T></div>
                    <div className="text-2xl font-black mt-1">{totalStandard}</div>
                </div>
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                    <div className="text-[10px] font-bold text-gray-500 uppercase"><T>Revenu généré</T></div>
                    <div className="text-2xl font-black mt-1">{totalRevenue > 0 ? formatPrice(totalRevenue) : '0'} <span className="text-xs text-gray-500"><T>FCFA</T></span></div>
                </div>
            </div>

            {/* TABLE */}
            <div className="rounded-2xl border border-white/[0.06] overflow-hidden bg-white/[0.01]">
                <div className="p-4 border-b border-white/[0.06]">
                    <div className="relative max-w-sm">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={t("Chercher un nom, email ou code ticket...")}
                            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-[#008751]/50" />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-white/[0.02]">
                            <tr className="border-b border-white/[0.06]">
                                <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider"><T>Participant</T></th>
                                <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider"><T>Contact</T></th>
                                <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider"><T>Ticket</T></th>
                                <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider"><T>Statut Paiement</T></th>
                                <th className="text-right px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider"><T>Action / Validation</T></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-12 text-center text-gray-500">
                                        <Users size={32} className="mx-auto mb-3 opacity-20" />
                                        Aucun inscrit trouvé.
                                    </td>
                                </tr>
                            ) : filtered.map(r => {
                                const ticket = r.event_tickets?.[0]
                                return (
                                    <tr key={r.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                                        <td className="px-5 py-4">
                                            <div className="font-bold text-white text-xs">{r.full_name}</div>
                                            <div className="text-[10px] text-gray-500 mt-0.5 flex items-center gap-1">
                                                {r.ticket_type === 'vip' ? <Crown size={10} className="text-[#FCD116]" /> : <Ticket size={10} />}
                                                {r.ticket_type.toUpperCase()}
                                            </div>
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-2 text-xs text-gray-400">
                                                <Mail size={12} className="text-gray-600" /> {r.email}
                                            </div>
                                            {r.phone && (
                                                <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                                                    <Phone size={12} className="text-gray-600" /> {r.phone}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-5 py-4">
                                            {ticket ? (
                                                <div className="font-mono text-[11px] font-bold px-2 py-1 rounded bg-black/50 border border-white/10 inline-block text-gray-300">
                                                    {ticket.ticket_code}
                                                </div>
                                            ) : (
                                                <span className="text-[10px] text-gray-500 italic"><T>Génération en attente</T></span>
                                            )}
                                        </td>
                                        <td className="px-5 py-4">
                                            {r.payment_status === 'completed' ? (
                                                <span className="text-[10px] font-bold text-[#008751] bg-[#008751]/10 px-2 py-1 rounded-full border border-[#008751]/20">Payé ({r.amount_paid} {r.currency})</span>
                                            ) : (
                                                <span className="text-[10px] font-bold text-gray-400 bg-gray-500/10 px-2 py-1 rounded-full border border-gray-500/20"><T>En attente</T></span>
                                            )}
                                        </td>
                                        <td className="px-5 py-4 text-right">
                                            {ticket ? (
                                                ticket.is_used ? (
                                                    <div className="inline-flex items-center gap-1.5 text-[10px] font-bold text-gray-500 bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/5">
                                                        <CheckCircle2 size={12} className="text-[#008751]" />
                                                        Validé le {new Date(ticket.used_at).toLocaleTimeString()}
                                                    </div>
                                                ) : (
                                                    <button onClick={() => validateTicket(ticket.ticket_code)}
                                                        className="px-3 py-1.5 rounded-lg text-[10px] font-black bg-[#FCD116]/10 text-[#FCD116] border border-[#FCD116]/30 hover:bg-[#FCD116] hover:text-black transition-all">
                                                        Valider manuellement
                                                    </button>
                                                )
                                            ) : (
                                                <span className="text-gray-600">-</span>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
            {/* Anim keyframes injected to support the scanner line */}
            <style jsx global>{`
                @keyframes scan {
                    0% { top: 0; }
                    50% { top: 100%; }
                    100% { top: 0; }
                }
            `}</style>
        </div>
    )
}

function formatPrice(n: number) {
    return new Intl.NumberFormat('fr-FR').format(n)
}
