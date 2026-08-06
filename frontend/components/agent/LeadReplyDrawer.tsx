'use client'

import { useTranslation, T } from '@/lib/translation';
import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Envelope as Mail, Pencil, TextAlignLeft as AlignLeft, PaperPlaneTilt as Send, Sparkle as Sparkles, CheckCircle as CheckCircle2, WarningCircle as AlertCircle, User, Briefcase, Calendar, CaretRight as ChevronRight, CircleNotch as Loader2, ArrowCounterClockwise as RotateCcw } from '@phosphor-icons/react';

import { Lead } from '@/types/lead'

interface LeadReplyDrawerProps {
    lead: Lead | null
    onClose: () => void
    onSent: (lead: Lead) => void
}

type Status = 'idle' | 'improving' | 'sending' | 'success' | 'error'

const scoreStyle = (score: number) => {
    if (score >= 80) return { text: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/30' }
    if (score >= 60) return { text: 'text-amber-400', bg: 'bg-amber-500/15 border-amber-500/30' }
    return { text: 'text-red-400', bg: 'bg-red-500/15 border-red-500/30' }
}

export default function LeadReplyDrawer({ lead, onClose, onSent }: LeadReplyDrawerProps) {
    const { t } = useTranslation();
    const clientName = lead ? `${lead.client_prenom} ${lead.client_nom}`.trim() : ''
    const defaultSubject = lead
        ? `Retour Gagnant — Votre projet : ${lead.recommended_service}`
        : ''
    const defaultBody = lead
        ? `Bonjour ${lead.client_prenom},\n\nNous avons bien analysé votre profil soumis sur l'Oracle de Retour Gagnant Bénin (score d'éligibilité : ${lead.eligibility_score}%).\n\nVotre projet autour du service « ${lead.recommended_service} » retient toute notre attention et nous souhaitons vous accompagner personnellement dans cette démarche.\n\nPouvez-vous nous indiquer vos disponibilités pour un échange téléphonique ou en visioconférence ? Notre équipe d'experts se fera un plaisir de vous présenter les prochaines étapes.\n\nCordialement,\nL'équipe Retour Gagnant Bénin`
        : ''

    const [subject, setSubject] = useState(defaultSubject)
    const [body, setBody] = useState(defaultBody)
    const [status, setStatus] = useState<Status>('idle')
    const [errorMsg, setErrorMsg] = useState('')
    const [aiImproved, setAiImproved] = useState(false)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    // Reset form when lead changes
    useEffect(() => {
        setSubject(defaultSubject)
        setBody(defaultBody)
        setStatus('idle')
        setErrorMsg('')
        setAiImproved(false)
    }, [lead?.id, defaultSubject, defaultBody])

    // Auto-focus textarea on open
    useEffect(() => {
        if (lead && textareaRef.current) {
            setTimeout(() => textareaRef.current?.focus(), 350)
        }
    }, [lead])

    // Escape key to close
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && status !== 'sending') onClose()
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [onClose, status])

    const handleImproveWithAI = useCallback(async () => {
        if (!lead || !body.trim()) return
        setStatus('improving')
        setAiImproved(false)

        try {
            const prompt = `Tu es un conseiller senior de Retour Gagnant Bénin, cabinet spécialisé dans l'accompagnement des ressortissants béninois de la diaspora. Tu dois améliorer ce message d'agent destiné au client ${clientName} (score d'éligibilité : ${lead.eligibility_score}%, service recommandé : «${lead.recommended_service}»).\n\nGardes un ton professionnel, chaleureux et rassurant. Enrichis le contenu, rends-le plus convaincant et personnalisé. Conserve exactement la même structure (formule de politesse, corps, signature). Réponds UNIQUEMENT avec le message amélioré, sans commentaire ni explication.\n\nMessage original :\n\n${body}`

            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [{ role: 'user', content: prompt }],
                    context: 'agent',
                }),
            })

            if (!res.ok) throw new Error('Réponse IA invalide')

            const data = await res.json()
            if (data.reply) {
                setBody(data.reply)
                setAiImproved(true)
            } else {
                throw new Error('Aucune réponse reçue')
            }
        } catch {
            setErrorMsg("L'amélioration IA a échoué. Vérifiez la configuration de l'assistant.")
            setStatus('error')
            return
        }

        setStatus('idle')
    }, [lead, body, clientName])

    const handleSend = useCallback(async () => {
        if (!lead || !body.trim() || !subject.trim()) return
        setStatus('sending')
        setErrorMsg('')

        try {
            const res = await fetch('/api/email/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: lead.client_email,
                    subject,
                    message: body,
                    clientName,
                    context: 'agent_reply',
                    relatedId: lead.id,
                }),
            })

            const data = await res.json()

            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Erreur serveur inconnue')
            }

            setStatus('success')
            onSent(lead)

            // Auto-close after 2.5s
            setTimeout(() => {
                onClose()
                setStatus('idle')
            }, 2500)
        } catch (err: unknown) {
            setErrorMsg(err instanceof Error ? err.message : 'Erreur lors de l\'envoi.')
            setStatus('error')
        }
    }, [lead, subject, body, clientName, onClose, onSent])

    const score = lead ? scoreStyle(lead.eligibility_score) : scoreStyle(0)

    return (
        <AnimatePresence>
            {lead && (
                <>
                    {/* ── Backdrop ── */}
                    <motion.div
                        key="backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        onClick={() => status !== 'sending' && onClose()}
                        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
                    />

                    {/* ── Drawer ── */}
                    <motion.div
                        key="drawer"
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                        className="fixed right-0 top-0 h-full z-50 w-full max-w-2xl flex flex-col bg-[#050a12] border-l border-white/10 shadow-2xl shadow-black/50"
                    >
                        {/* ════════════════════════════════════ */}
                        {/* HEADER — Identité du lead           */}
                        {/* ════════════════════════════════════ */}
                        <div className="relative shrink-0 px-4 pt-5 pb-4 sm:px-8 sm:pt-8 sm:pb-6 border-b border-white/[0.06] bg-[#070d16]">
                            {/* Accent gradient top */}
                            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#008751] via-[#FCD116] to-[#E8112D]" />

                            <div className="flex items-start justify-between gap-4">
                                <div className="space-y-3 flex-1 min-w-0">
                                    {/* Title */}
                                    <div className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase tracking-[0.4em]">
                                        <Mail size={11} />
                                        Composer un email
                                    </div>

                                    {/* Client info */}
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/5 border border-white/10 shrink-0">
                                            <User size={18} className="text-gray-400" />
                                        </div>
                                        <div className="min-w-0">
                                            <h2 className="text-lg font-black text-white tracking-tight truncate">{clientName}</h2>
                                            <p className="text-xs text-gray-500 font-mono truncate">{lead.client_email}</p>
                                        </div>
                                    </div>

                                    {/* Meta badges */}
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-black ${score.bg} ${score.text}`}>
                                            {lead.eligibility_score}%
                                        </span>
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] font-bold text-gray-400">
                                            <Briefcase size={10} />
                                            {lead.recommended_service}
                                        </span>
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] font-bold text-gray-500">
                                            <Calendar size={10} />
                                            {new Date(lead.created_at).toLocaleDateString('fr-FR')}
                                        </span>
                                    </div>
                                </div>

                                {/* Close button */}
                                <button
                                    type="button"
                                    onClick={onClose}
                                    title={t("Fermer")}
                                    disabled={status === 'sending'}
                                    className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-gray-500 hover:text-white hover:bg-white/10 transition-all disabled:opacity-40"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        {/* ════════════════════════════════════ */}
                        {/* BODY — Formulaire                   */}
                        {/* ════════════════════════════════════ */}
                        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-8 sm:py-6 space-y-5">

                            {/* SUCCESS STATE */}
                            <AnimatePresence>
                                {status === 'success' && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="flex flex-col items-center justify-center h-64 gap-5 text-center"
                                    >
                                        <motion.div
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            transition={{ type: 'spring', delay: 0.1 }}
                                            className="w-20 h-20 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center"
                                        >
                                            <CheckCircle2 size={36} className="text-emerald-400" />
                                        </motion.div>
                                        <div>
                                            <h3 className="text-xl font-black text-white"><T>Email envoyé</T></h3>
                                            <p className="text-sm text-gray-500 mt-1">
                                                Message transmis à <span className="text-white font-bold">{lead.client_email}</span>
                                            </p>
                                        </div>
                                        <p className="text-[10px] text-gray-600 uppercase tracking-widest"><T>Fermeture automatique...</T></p>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* FORM FIELDS */}
                            {status !== 'success' && (
                                <>
                                    {/* ERROR BANNER */}
                                    <AnimatePresence>
                                        {status === 'error' && errorMsg && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -8 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0 }}
                                                className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20"
                                            >
                                                <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                                                <p className="text-xs text-red-400 font-medium">{errorMsg}</p>
                                                <button
                                                    type="button"
                                                    onClick={() => { setStatus('idle'); setErrorMsg('') }}
                                                    title={t("Fermer")}
                                                    className="ml-auto shrink-0 text-red-500 hover:text-red-300 transition-colors"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    {/* AI IMPROVED BANNER */}
                                    <AnimatePresence>
                                        {aiImproved && status === 'idle' && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -8 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0 }}
                                                className="flex items-center gap-3 p-3 rounded-xl bg-[#FCD116]/8 border border-[#FCD116]/20"
                                            >
                                                <Sparkles size={14} className="text-[#FCD116] shrink-0" />
                                                <p className="text-xs text-[#FCD116]/80 font-medium"><T>Message amélioré par l&apos;IA — Relisez avant d&apos;envoyer.</T></p>
                                                <button
                                                    type="button"
                                                    onClick={() => { setBody(defaultBody); setAiImproved(false) }}
                                                    className="ml-auto shrink-0 flex items-center gap-1 text-[10px] text-gray-500 hover:text-white transition-colors"
                                                >
                                                    <RotateCcw size={11} /> Réinitialiser
                                                </button>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    {/* SUBJECT FIELD */}
                                    <div className="space-y-2">
                                        <label className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase tracking-[0.35em]">
                                            <Pencil size={10} /> Objet
                                        </label>
                                        <input
                                            type="text"
                                            value={subject}
                                            onChange={(e) => setSubject(e.target.value)}
                                            disabled={status === 'improving' || status === 'sending'}
                                            title={t("Objet de l'email")}
                                            className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-5 py-3.5 text-sm text-white font-medium placeholder:text-gray-600 focus:outline-none focus:border-white/25 transition-all disabled:opacity-50"
                                        />
                                    </div>

                                    {/* MESSAGE FIELD */}
                                    <div className="space-y-2 flex-1">
                                        <div className="flex items-center justify-between">
                                            <label className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase tracking-[0.35em]">
                                                <AlignLeft size={10} /> Message
                                            </label>
                                            <span className="text-[10px] text-gray-600 font-mono tabular-nums">
                                                {body.length} car.
                                            </span>
                                        </div>

                                        <div className="relative">
                                            {/* AI loading shimmer overlay */}
                                            <AnimatePresence>
                                                {status === 'improving' && (
                                                    <motion.div
                                                        initial={{ opacity: 0 }}
                                                        animate={{ opacity: 1 }}
                                                        exit={{ opacity: 0 }}
                                                        className="absolute inset-0 z-10 rounded-xl overflow-hidden"
                                                    >
                                                        <div className="absolute inset-0 bg-[#070d16]/80 backdrop-blur-[2px]" />
                                                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                                                            <div className="relative">
                                                                <Sparkles size={24} className="text-[#FCD116] animate-pulse" />
                                                            </div>
                                                            <p className="text-xs font-bold text-[#FCD116]/80 uppercase tracking-widest"><T>Amélioration en cours...</T></p>
                                                            <div className="flex gap-1">
                                                                {[0, 1, 2].map(i => (
                                                                    <motion.div
                                                                        key={i}
                                                                        className="w-1.5 h-1.5 rounded-full bg-[#FCD116]/50"
                                                                        animate={{ opacity: [0.3, 1, 0.3] }}
                                                                        transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                                                                    />
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>

                                            <textarea
                                                ref={textareaRef}
                                                value={body}
                                                onChange={(e) => { setBody(e.target.value); if (aiImproved) setAiImproved(false) }}
                                                disabled={status === 'improving' || status === 'sending'}
                                                rows={10}
                                                title={t("Contenu de l'email")}
                                                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-5 py-4 text-sm text-white font-mono leading-relaxed placeholder:text-gray-600 focus:outline-none focus:border-white/25 transition-all disabled:opacity-50 resize-none"
                                                placeholder={t("Rédigez votre message...")}
                                            />
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* ════════════════════════════════════ */}
                        {/* FOOTER — Actions                    */}
                        {/* ════════════════════════════════════ */}
                        {status !== 'success' && (
                            <div className="shrink-0 px-4 py-4 sm:px-8 sm:py-5 border-t border-white/[0.06] bg-[#070d16]">
                                <div className="flex items-center gap-3">
                                    {/* Cancel */}
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        disabled={status === 'sending'}
                                        className="h-11 px-5 rounded-xl border border-white/10 text-gray-500 text-xs font-bold uppercase tracking-wider hover:text-white hover:border-white/20 transition-all disabled:opacity-40"
                                    >
                                        Annuler
                                    </button>

                                    {/* Spacer */}
                                    <div className="flex-1" />

                                    {/* Improve with AI */}
                                    <button
                                        type="button"
                                        onClick={handleImproveWithAI}
                                        disabled={status !== 'idle' || !body.trim()}
                                        className="relative h-11 px-5 rounded-xl border border-[#FCD116]/25 bg-[#FCD116]/8 text-[#FCD116] text-xs font-black uppercase tracking-wider hover:bg-[#FCD116]/15 hover:border-[#FCD116]/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 overflow-hidden group"
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#FCD116]/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                                        <Sparkles size={13} className="shrink-0" />
                                        Améliorer avec l&apos;IA
                                    </button>

                                    {/* Send */}
                                    <button
                                        type="button"
                                        onClick={handleSend}
                                        disabled={status !== 'idle' || !body.trim() || !subject.trim()}
                                        className="relative h-11 px-7 rounded-xl bg-[#008751] text-white text-xs font-black uppercase tracking-wider hover:bg-[#009960] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-[#008751]/20 overflow-hidden group"
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                                        {status === 'sending' ? (
                                            <Loader2 size={14} className="animate-spin" />
                                        ) : (
                                            <Send size={13} className="shrink-0" />
                                        )}
                                        {status === 'sending' ? 'Envoi...' : 'Envoyer'}
                                        {status === 'idle' && <ChevronRight size={13} className="-ml-1 group-hover:translate-x-0.5 transition-transform" />}
                                    </button>
                                </div>

                                {/* Keyboard hint */}
                                <p className="text-[10px] text-gray-700 text-right mt-2.5">
                                    Échap pour fermer
                                </p>
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
