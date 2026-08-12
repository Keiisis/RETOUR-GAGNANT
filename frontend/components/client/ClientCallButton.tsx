'use client'

/* ══════════════════════════════════════════════════════════════
   APPELER UN CONSEILLER : côté client (web)

   Crée une ligne dans `calls` puis ouvre le micro. Tous les agents
   connectés voient l'appel sonner dans leur panel ; le premier qui
   décroche prend la communication.

   La voix circule en pair-à-pair : elle ne transite par aucun serveur
   de l'agence.
══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Phone, PhoneSlash as PhoneOff, Microphone as Mic, MicrophoneSlash as MicOff } from '@phosphor-icons/react';
import { supabase } from '@/lib/supabase'
import { CallEngine, formatDuree } from '@/lib/webrtc-call'

type Etat = 'idle' | 'ringing' | 'active' | 'ending'

export function ClientCallButton({ sujet }: { sujet?: string }) {
    const [etat, setEtat] = useState<Etat>('idle')
    const [muet, setMuet] = useState(false)
    const [secondes, setSecondes] = useState(0)
    const [message, setMessage] = useState<string | null>(null)
    const [agentNom, setAgentNom] = useState<string | null>(null)

    const engine = useRef<CallEngine | null>(null)
    const audioRef = useRef<HTMLAudioElement | null>(null)
    const callIdRef = useRef<string | null>(null)
    const canalRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

    /* Chronomètre de conversation. */
    useEffect(() => {
        if (etat !== 'active') { setSecondes(0); return }
        const id = setInterval(() => setSecondes(s => s + 1), 1000)
        return () => clearInterval(id)
    }, [etat])

    const nettoyer = useCallback(() => {
        engine.current?.hangup()
        engine.current = null
        if (canalRef.current) { void supabase.removeChannel(canalRef.current); canalRef.current = null }
        callIdRef.current = null
        setEtat('idle')
        setMuet(false)
        setAgentNom(null)
    }, [])

    const raccrocher = useCallback(async () => {
        const id = callIdRef.current
        setEtat('ending')
        nettoyer()
        if (!id) return
        await supabase
            .from('calls')
            .update({ statut: 'ended', termine_par: 'client', ended_at: new Date().toISOString() })
            .eq('id', id)
            .in('statut', ['ringing', 'active'])
    }, [nettoyer])

    const appeler = useCallback(async () => {
        setMessage(null)
        try {
            const { data: auth } = await supabase.auth.getUser()
            const user = auth.user
            if (!user) { setMessage('Connectez-vous pour appeler un conseiller.'); return }

            const { data: prof } = await supabase
                .from('client_profiles')
                .select('prenom, nom, email')
                .eq('id', user.id)
                .maybeSingle()

            const nom = `${prof?.prenom || ''} ${prof?.nom || ''}`.trim() || (user.email || '')

            const { data: appel, error } = await supabase
                .from('calls')
                .insert({
                    client_id: user.id,
                    client_nom: nom,
                    client_email: prof?.email || user.email || '',
                    sujet: sujet || null,
                    statut: 'ringing',
                })
                .select()
                .single()

            if (error) throw new Error(error.message)

            callIdRef.current = appel.id
            setEtat('ringing')

            // Suivi de l'appel : décroché, refus, ou personne ne répond.
            canalRef.current = supabase
                .channel(`client-appel-${appel.id}`)
                .on('postgres_changes', {
                    event: 'UPDATE', schema: 'public', table: 'calls',
                    filter: `id=eq.${appel.id}`,
                }, (p) => {
                    const row = p.new as { statut: string; agent_nom: string | null }
                    if (row.statut === 'active') {
                        setAgentNom(row.agent_nom)
                        setEtat('active')
                    } else if (row.statut === 'declined') {
                        setMessage('Aucun conseiller disponible pour le moment.')
                        nettoyer()
                    } else if (row.statut === 'missed') {
                        setMessage('Personne n’a décroché. Réessayez ou écrivez-nous.')
                        nettoyer()
                    } else if (row.statut === 'ended') {
                        nettoyer()
                    }
                })
                .subscribe()

            const moteur = new CallEngine({
                supabase,
                callId: appel.id,
                role: 'client',
                onRemoteStream: (stream) => { if (audioRef.current) audioRef.current.srcObject = stream },
                onEnded: (raison) => { setMessage(raison); void raccrocher() },
            })
            engine.current = moteur
            await moteur.start()
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Appel impossible.'
            setMessage(
                msg.includes('Permission') || msg.includes('NotAllowed')
                    ? 'Autorisez le micro dans votre navigateur pour appeler.'
                    : msg,
            )
            nettoyer()
        }
    }, [sujet, nettoyer, raccrocher])

    const basculerMicro = () => {
        const suivant = !muet
        setMuet(suivant)
        engine.current?.setMuted(suivant)
    }

    return (
        <div className="space-y-2">
            <audio ref={audioRef} autoPlay className="hidden" />

            {etat === 'idle' ? (
                <button
                    onClick={appeler}
                    className="w-full h-12 rounded-xl bg-[#008751] text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#00643C] transition-colors"
                >
                    <Phone size={17} /> Appeler un conseiller
                </button>
            ) : (
                <div className="rounded-xl border border-[#008751]/25 bg-white overflow-hidden">
                    <div className="flex h-1.5">
                        <div className="flex-[46] bg-[#008751]" />
                        <div className="flex-[27] bg-[#FCD116]" />
                        <div className="flex-[27] bg-[#E8112D]" />
                    </div>
                    <div className="p-4">
                        <p className="text-[11px] font-bold tracking-widest text-[#8A8A8A] uppercase">
                            {etat === 'ringing' ? 'Appel en cours…' : 'En communication'}
                        </p>
                        <p className="text-[15px] font-bold text-[#3C3C3C] mt-0.5">
                            {etat === 'ringing'
                                ? 'Nous cherchons un conseiller disponible'
                                : (agentNom || 'Conseiller RGB')}
                        </p>
                        {etat === 'active' && (
                            <p className="text-[13px] font-bold text-[#008751] tabular-nums mt-1">
                                {formatDuree(secondes)}
                            </p>
                        )}

                        <div className="mt-4 flex items-center gap-2">
                            {etat === 'active' && (
                                <button
                                    onClick={basculerMicro}
                                    aria-label={muet ? 'Réactiver le micro' : 'Couper le micro'}
                                    className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${
                                        muet ? 'bg-[#FDECEA] text-[#E8112D]' : 'bg-[#F5F5F5] text-[#3C3C3C]'
                                    }`}
                                >
                                    {muet ? <MicOff size={17} /> : <Mic size={17} />}
                                </button>
                            )}
                            <button
                                onClick={raccrocher}
                                className="flex-1 h-11 rounded-full bg-[#E8112D] text-white font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                            >
                                <PhoneOff size={17} /> Raccrocher
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {message && <p className="text-[12px] text-[#8A6D08]">{message}</p>}
        </div>
    )
}
