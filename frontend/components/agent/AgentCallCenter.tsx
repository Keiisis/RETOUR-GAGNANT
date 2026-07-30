'use client'

/* ══════════════════════════════════════════════════════════════
   STANDARD TÉLÉPHONIQUE — côté agent

   Monté une seule fois dans le layout agent : l'appel sonne quelle que
   soit la page ouverte. Écoute la table `calls` en temps réel, affiche
   l'appel entrant, et ouvre la voix au décroché.

   La voix passe en pair-à-pair (WebRTC). Rien n'est enregistré.
══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Phone, PhoneOff, Mic, MicOff, User } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { CallEngine, formatDuree } from '@/lib/webrtc-call'

interface CallRow {
    id: string
    client_id: string
    client_nom: string
    client_email: string
    agent_id: string | null
    statut: 'ringing' | 'active' | 'ended' | 'declined' | 'missed'
    sujet: string | null
    created_at: string
}

export function AgentCallCenter() {
    const [call, setCall] = useState<CallRow | null>(null)
    const [connexion, setConnexion] = useState<RTCPeerConnectionState>('new')
    const [muet, setMuet] = useState(false)
    const [secondes, setSecondes] = useState(0)
    const [erreur, setErreur] = useState<string | null>(null)

    const engine = useRef<CallEngine | null>(null)
    const audioRef = useRef<HTMLAudioElement | null>(null)
    const sonnerie = useRef<ReturnType<typeof setInterval> | null>(null)
    const moiRef = useRef<{ id: string; nom: string } | null>(null)

    /* ── Identité de l'agent connecté ── */
    useEffect(() => {
        let vivant = true
        supabase.auth.getUser().then(async ({ data }) => {
            const uid = data.user?.id
            if (!uid || !vivant) return
            const { data: prof } = await supabase
                .from('user_profiles')
                .select('full_name, email, role')
                .eq('id', uid)
                .maybeSingle()
            if (!vivant) return
            if (prof?.role !== 'agent' && prof?.role !== 'admin') return
            moiRef.current = { id: uid, nom: prof.full_name || prof.email || 'Agent' }
        })
        return () => { vivant = false }
    }, [])

    /* ── Sonnerie : bip discret pendant que l'appel attend ── */
    useEffect(() => {
        if (call?.statut !== 'ringing') {
            if (sonnerie.current) { clearInterval(sonnerie.current); sonnerie.current = null }
            return
        }
        const bip = () => {
            try {
                const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
                const osc = ctx.createOscillator()
                const gain = ctx.createGain()
                osc.frequency.value = 880
                gain.gain.value = 0.05
                osc.connect(gain); gain.connect(ctx.destination)
                osc.start(); osc.stop(ctx.currentTime + 0.18)
                setTimeout(() => ctx.close().catch(() => {}), 400)
            } catch { /* audio indisponible : l'appel reste visible */ }
        }
        bip()
        sonnerie.current = setInterval(bip, 2200)
        return () => { if (sonnerie.current) clearInterval(sonnerie.current) }
    }, [call?.statut])

    /* ── Chronomètre ── */
    useEffect(() => {
        if (call?.statut !== 'active') { setSecondes(0); return }
        const id = setInterval(() => setSecondes(s => s + 1), 1000)
        return () => clearInterval(id)
    }, [call?.statut])

    /* ── Écoute des appels ── */
    useEffect(() => {
        // Un appel peut déjà sonner au chargement de la page.
        supabase
            .from('calls')
            .select('*')
            .eq('statut', 'ringing')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
            .then(({ data }) => { if (data) setCall(data as CallRow) })

        const canal = supabase
            .channel('agent-standard-appels')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'calls' }, (p) => {
                const row = p.new as CallRow
                if (row.statut === 'ringing') setCall(row)
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'calls' }, (p) => {
                const row = p.new as CallRow
                setCall(prev => {
                    if (!prev || prev.id !== row.id) return prev
                    // Un autre agent a décroché : l'appel disparaît de mon écran.
                    if (row.statut === 'active' && row.agent_id !== moiRef.current?.id) return null
                    if (row.statut === 'ended' || row.statut === 'declined' || row.statut === 'missed') {
                        engine.current?.hangup(); engine.current = null
                        return null
                    }
                    return row
                })
            })
            .subscribe()

        return () => { void supabase.removeChannel(canal) }
    }, [])

    /* ── Décrocher ── */
    const decrocher = useCallback(async () => {
        if (!call || !moiRef.current) return
        setErreur(null)
        try {
            // On revendique l'appel : la condition `statut = ringing` empêche
            // deux agents de décrocher le même appel.
            const { data, error } = await supabase
                .from('calls')
                .update({
                    statut: 'active',
                    agent_id: moiRef.current.id,
                    agent_nom: moiRef.current.nom,
                    answered_at: new Date().toISOString(),
                })
                .eq('id', call.id)
                .eq('statut', 'ringing')
                .select()
                .maybeSingle()

            if (error) throw new Error(error.message)
            if (!data) { setCall(null); return } // pris par un collègue

            const moteur = new CallEngine({
                supabase,
                callId: call.id,
                role: 'agent',
                onStateChange: setConnexion,
                onRemoteStream: (stream) => { if (audioRef.current) audioRef.current.srcObject = stream },
                onEnded: (raison) => { setErreur(raison); void raccrocher() },
                /* Micro perdu sans reprise possible : l'appel tient toujours
                   et on entend le client, mais lui ne nous entend plus. Sans
                   ce signal, l'agent parlait dans le vide. */
                onMicroPerdu: () => setErreur(
                    "Micro perdu — le client ne vous entend plus. Vérifiez votre casque, puis rappelez.",
                ),
            })
            engine.current = moteur
            await moteur.answer()
            setCall(data as CallRow)
        } catch (e) {
            setErreur(e instanceof Error ? e.message : 'Impossible de décrocher.')
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [call])

    /* ── Raccrocher / refuser ── */
    const raccrocher = useCallback(async (refus = false) => {
        const courant = call
        engine.current?.hangup()
        engine.current = null
        setCall(null)
        setMuet(false)
        if (!courant) return
        await supabase
            .from('calls')
            .update({
                statut: refus ? 'declined' : 'ended',
                termine_par: 'agent',
                ended_at: new Date().toISOString(),
            })
            .eq('id', courant.id)
            .in('statut', ['ringing', 'active'])
    }, [call])

    const basculerMicro = () => {
        const suivant = !muet
        setMuet(suivant)
        engine.current?.setMuted(suivant)
    }

    if (!call) return <audio ref={audioRef} autoPlay className="hidden" />

    const enCours = call.statut === 'active'

    return (
        <>
            <audio ref={audioRef} autoPlay className="hidden" />

            <div className="fixed bottom-6 right-6 z-[200] w-[330px] rounded-2xl overflow-hidden shadow-2xl border border-[#008751]/25 bg-white">
                {/* Liseré tricolore : signature de la marque */}
                <div className="flex h-1.5">
                    <div className="flex-[46] bg-[#008751]" />
                    <div className="flex-[27] bg-[#FCD116]" />
                    <div className="flex-[27] bg-[#E8112D]" />
                </div>

                <div className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-[#E6F3ED] flex items-center justify-center shrink-0">
                            <User size={22} className="text-[#008751]" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-bold tracking-widest text-[#8A8A8A] uppercase">
                                {enCours ? 'Appel en cours' : 'Appel entrant'}
                            </p>
                            <p className="text-[15px] font-bold text-[#3C3C3C] truncate">
                                {call.client_nom || call.client_email || 'Client'}
                            </p>
                            {call.sujet && (
                                <p className="text-[12px] text-[#8A8A8A] truncate">{call.sujet}</p>
                            )}
                        </div>
                        {enCours && (
                            <span className="text-[13px] font-bold text-[#008751] tabular-nums">
                                {formatDuree(secondes)}
                            </span>
                        )}
                    </div>

                    {enCours && connexion !== 'connected' && (
                        <p className="mt-3 text-[12px] text-[#8A8A8A]">Connexion audio…</p>
                    )}
                    {erreur && (
                        <p className="mt-3 text-[12px] text-[#E8112D]">{erreur}</p>
                    )}

                    <div className="mt-4 flex items-center gap-2">
                        {!enCours ? (
                            <>
                                <button
                                    onClick={decrocher}
                                    className="flex-1 h-11 rounded-full bg-[#008751] text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#00643C] transition-colors"
                                >
                                    <Phone size={17} /> Décrocher
                                </button>
                                <button
                                    onClick={() => raccrocher(true)}
                                    aria-label="Refuser l'appel"
                                    className="w-11 h-11 rounded-full bg-[#FDECEA] text-[#E8112D] flex items-center justify-center hover:bg-[#E8112D] hover:text-white transition-colors"
                                >
                                    <PhoneOff size={17} />
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={basculerMicro}
                                    aria-label={muet ? 'Réactiver le micro' : 'Couper le micro'}
                                    className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${
                                        muet ? 'bg-[#FDECEA] text-[#E8112D]' : 'bg-[#F5F5F5] text-[#3C3C3C]'
                                    }`}
                                >
                                    {muet ? <MicOff size={17} /> : <Mic size={17} />}
                                </button>
                                <button
                                    onClick={() => raccrocher(false)}
                                    className="flex-1 h-11 rounded-full bg-[#E8112D] text-white font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                                >
                                    <PhoneOff size={17} /> Raccrocher
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </>
    )
}
