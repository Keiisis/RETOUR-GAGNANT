'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Loader2, Bot, User, Trash2, Copy, CheckCheck, Sparkles, RefreshCw, Database, Brain, Plus, X } from 'lucide-react'

const GOLD = '#D4AF37'; const YELLOW = '#FCD116'; const GREEN = '#008751'
const GREEN_L = '#00A86B'; const BG = '#0B1F0D'; const TEXT = '#F0EBD8'
const PANEL = '#0D2615'

interface Message {
    id: string
    role: 'user' | 'assistant'
    content: string
    thinking?: string
    ts: Date
}

const SUGGESTIONS = [
    'Quel est le revenu total et le revenu de ce mois ?',
    'Analyse les commandes en attente et donne-moi les priorités',
    'Combien de clients et de nouveaux clients ce mois ?',
    'Y a-t-il des messages non lus ? Résume-les moi',
    'Quel est le score de sécurité actuel et les alertes en cours ?',
    'Rédige un rapport exécutif complet basé sur les données du jour',
    'Quelles sont les candidatures partenaires en attente ?',
    'Analyse les dossiers récents et donne-moi les points d\'attention',
]

function parseThinking(raw: string): { thinking: string; content: string } {
    const match = raw.match(/<think>([\s\S]*?)<\/think>([\s\S]*)/)
    if (match) return { thinking: match[1].trim(), content: match[2].trim() }
    return { thinking: '', content: raw }
}

function MarkdownText({ text }: { text: string }) {
    const lines = text.split('\n')
    return (
        <div className="space-y-1.5 text-sm leading-relaxed">
            {lines.map((line, i) => {
                if (line.startsWith('### ')) return <h3 key={i} className="font-black text-sm mt-3 mb-1" style={{ color: GOLD }}>{line.slice(4)}</h3>
                if (line.startsWith('## ')) return <h2 key={i} className="font-black text-base mt-4 mb-1" style={{ color: GOLD }}>{line.slice(3)}</h2>
                if (line.startsWith('# ')) return <h1 key={i} className="font-black text-lg mt-4 mb-2" style={{ color: GOLD }}>{line.slice(2)}</h1>
                if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="font-bold" style={{ color: TEXT }}>{line.slice(2, -2)}</p>
                if (line.startsWith('- ') || line.startsWith('• ')) return (
                    <div key={i} className="flex items-start gap-2">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: GOLD }} />
                        <span style={{ color: `${TEXT}CC` }}>{line.slice(2)}</span>
                    </div>
                )
                if (/^\d+\.\s/.test(line)) {
                    const num = line.match(/^(\d+)\.\s(.*)/)
                    return num ? (
                        <div key={i} className="flex items-start gap-2.5">
                            <span className="font-black text-xs shrink-0 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: `${GOLD}25`, color: GOLD }}>{num[1]}</span>
                            <span style={{ color: `${TEXT}CC` }}>{num[2]}</span>
                        </div>
                    ) : <p key={i} style={{ color: `${TEXT}CC` }}>{line}</p>
                }
                if (line === '') return <div key={i} className="h-1" />
                return <p key={i} style={{ color: `${TEXT}CC` }}>{line}</p>
            })}
        </div>
    )
}

export default function CeoAssistant() {
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [loadingCtx, setLoadingCtx] = useState(false)
    const [copied, setCopied] = useState<string | null>(null)
    const [memoryOpen, setMemoryOpen] = useState(false)
    const [memories, setMemories] = useState<Array<{ id: string; type: string; content: string; importance: number }>>([])
    const [newMemory, setNewMemory] = useState('')
    const [memType, setMemType] = useState<'fact' | 'decision' | 'note' | 'alert'>('note')
    const rgbContextRef = useRef<string>('')
    const ctxLoadedAt = useRef<number>(0)
    const bottomRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)

    // Pré-chargement du contexte RGB (et refresh toutes les 5 min)
    const loadContext = useCallback(async () => {
        const now = Date.now()
        if (now - ctxLoadedAt.current < 5 * 60 * 1000 && rgbContextRef.current) return
        setLoadingCtx(true)
        try {
            const res = await fetch('/api/ai/gemma/context', { cache: 'no-store' })
            if (res.ok) {
                const d = await res.json()
                rgbContextRef.current = d.context || ''
                ctxLoadedAt.current = now
            }
        } catch { /* contexte vide, Gemma répondra sans données */ }
        setLoadingCtx(false)
    }, [])

    const loadMemory = useCallback(async () => {
        const res = await fetch('/api/ai/gemma/memory')
        if (res.ok) { const d = await res.json(); setMemories(d.memory || []) }
    }, [])

    const saveMemory = async () => {
        if (!newMemory.trim()) return
        await fetch('/api/ai/gemma/memory', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: memType, content: newMemory.trim(), importance: 4 }),
        })
        setNewMemory('')
        loadMemory()
    }

    const deleteMemory = async (id: string) => {
        await fetch('/api/ai/gemma/memory', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
        setMemories(prev => prev.filter(m => m.id !== id))
    }

    useEffect(() => { loadMemory(); loadContext() }, [loadMemory, loadContext])

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, loading])

    const send = useCallback(async (text?: string) => {
        const content = (text || input).trim()
        if (!content || loading) return

        const userMsg: Message = { id: Date.now().toString(), role: 'user', content, ts: new Date() }
        const assistantId = (Date.now() + 1).toString()

        setMessages(prev => [...prev, userMsg, {
            id: assistantId, role: 'assistant', content: '', ts: new Date(),
        }])
        setInput('')
        setLoading(true)

        try {
            // Rafraîchir contexte si expiré (async, n'attend pas)
            loadContext()

            const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }))
            const res = await fetch('/api/ai/gemma', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // Envoie le contexte déjà chargé — la route NVIDIA ne fait plus de requêtes DB
                body: JSON.stringify({ messages: history, context: rgbContextRef.current }),
            })

            if (!res.ok) throw new Error(`Erreur ${res.status}`)

            // Lecture du flux SSE token par token
            const reader = res.body!.getReader()
            const decoder = new TextDecoder()
            let buffer = ''
            let accumulated = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break
                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop() ?? ''

                for (const line of lines) {
                    const trimmed = line.trim()
                    if (!trimmed || trimmed === 'data: [DONE]' || trimmed.startsWith(': ')) continue
                    if (trimmed.startsWith('data: ')) {
                        try {
                            const json = JSON.parse(trimmed.slice(6))
                            if (json.error) throw new Error(json.error)
                            if (json.t) {
                                accumulated += json.t
                                const { thinking, content: answer } = parseThinking(accumulated)
                                setMessages(prev => prev.map(m =>
                                    m.id === assistantId
                                        ? { ...m, content: answer || accumulated, thinking: thinking || undefined }
                                        : m
                                ))
                            }
                        } catch (parseErr) {
                            if (parseErr instanceof Error && parseErr.message !== 'Unexpected end of JSON input') {
                                throw parseErr
                            }
                        }
                    }
                }
            }
        } catch (e) {
            setMessages(prev => prev.map(m =>
                m.id === (Date.now() + 1).toString()
                    ? { ...m, content: `Erreur : ${e instanceof Error ? e.message : 'inconnue'}` }
                    : m
            ).map(m => m.content === '' && m.role === 'assistant'
                ? { ...m, content: `Erreur de connexion à Gemma 4. ${e instanceof Error ? e.message : ''}` }
                : m
            ))
        }
        setLoading(false)
        inputRef.current?.focus()
    }, [input, loading, messages])

    const copy = (text: string, id: string) => {
        navigator.clipboard.writeText(text)
        setCopied(id)
        setTimeout(() => setCopied(null), 2000)
    }

    const fmtTime = (d: Date) => d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

    return (
        <div className="flex flex-col h-full" style={{ background: BG, color: TEXT }}>

            {/* Header */}
            <div className="px-6 py-4 border-b shrink-0 flex items-center justify-between" style={{ borderColor: `${GOLD}15`, background: PANEL }}>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center relative"
                        style={{ background: `linear-gradient(135deg, ${GOLD}, #9A7A00, ${YELLOW})` }}>
                        <Sparkles size={18} style={{ color: BG }} />
                        <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 animate-pulse"
                            style={{ background: GREEN_L, borderColor: BG }} />
                    </div>
                    <div>
                        <p className="font-black text-sm tracking-wider" style={{ color: GOLD }}>GEMMA 4</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: `${GREEN_L}80` }}>
                            31B · NVIDIA NIM · Connectée DB
                        </p>
                    </div>
                    {/* Indicateurs connexion */}
                    <div className="flex items-center gap-1.5 ml-2">
                        <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold"
                            style={{ background: loadingCtx ? `${YELLOW}15` : `${GREEN}15`, color: loadingCtx ? YELLOW : GREEN_L }}>
                            {loadingCtx ? <Loader2 size={9} className="animate-spin" /> : <Database size={9} />}
                            {loadingCtx ? 'Chargement...' : 'DB Connectée'}
                        </div>
                        <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold" style={{ background: `${GOLD}15`, color: GOLD }}>
                            <Brain size={9} /> {memories.length} mémoires
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setMemoryOpen(o => !o)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:opacity-80"
                        style={{ background: `${GOLD}15`, color: GOLD }}>
                        <Brain size={12} /> Mémoire
                    </button>
                    {messages.length > 0 && (
                        <button type="button" onClick={() => setMessages([])}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:opacity-80"
                            style={{ background: `${GOLD}12`, color: `${TEXT}50` }}>
                            <Trash2 size={12} /> Effacer
                        </button>
                    )}
                </div>
            </div>

            {/* Panneau mémoire */}
            <AnimatePresence>
                {memoryOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-b shrink-0" style={{ borderColor: `${GOLD}15`, background: '#0A1C0C' }}>
                        <div className="p-4">
                            <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: GOLD }}>
                                Mémoire persistante — {memories.length} entrées
                            </p>
                            {/* Ajouter une mémoire */}
                            <div className="flex gap-2 mb-3">
                                <select value={memType} onChange={e => setMemType(e.target.value as typeof memType)}
                                    title="Type de mémoire"
                                    className="px-2 py-1.5 rounded-lg text-xs outline-none"
                                    style={{ background: PANEL, border: `1px solid ${GOLD}20`, color: TEXT }}>
                                    <option value="fact">Fait</option>
                                    <option value="decision">Décision</option>
                                    <option value="note">Note</option>
                                    <option value="alert">Alerte</option>
                                </select>
                                <input value={newMemory} onChange={e => setNewMemory(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && saveMemory()}
                                    placeholder="Ajouter un fait, décision ou note important..."
                                    className="flex-1 px-3 py-1.5 rounded-lg text-xs outline-none"
                                    style={{ background: PANEL, border: `1px solid ${GOLD}20`, color: TEXT }} />
                                <button type="button" onClick={saveMemory} title="Enregistrer"
                                    className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-80"
                                    style={{ background: `${GOLD}25`, color: GOLD }}>
                                    <Plus size={12} />
                                </button>
                            </div>
                            {/* Liste des mémoires */}
                            <div className="space-y-1 max-h-40 overflow-y-auto">
                                {memories.slice(0, 15).map(m => (
                                    <div key={m.id} className="flex items-start justify-between gap-2 px-3 py-1.5 rounded-lg"
                                        style={{ background: PANEL, border: `1px solid ${GOLD}10` }}>
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded shrink-0"
                                                style={{ background: `${GOLD}20`, color: GOLD }}>{m.type}</span>
                                            <span className="text-xs truncate" style={{ color: `${TEXT}80` }}>{m.content}</span>
                                        </div>
                                        <button type="button" onClick={() => deleteMemory(m.id)} title="Supprimer"
                                            className="shrink-0 opacity-30 hover:opacity-70 transition-opacity">
                                            <X size={11} style={{ color: TEXT }} />
                                        </button>
                                    </div>
                                ))}
                                {memories.length === 0 && <p className="text-xs opacity-30 text-center py-2">Aucune mémoire enregistrée</p>}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">

                {/* Accueil */}
                {messages.length === 0 && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                        className="flex flex-col items-center justify-center min-h-[300px] text-center px-6">
                        <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6 shadow-2xl"
                            style={{ background: `linear-gradient(135deg, ${GOLD}, #9A7A00, ${YELLOW})` }}>
                            <Sparkles size={36} style={{ color: BG }} />
                        </div>
                        <h2 className="text-2xl font-black mb-2" style={{
                            background: `linear-gradient(135deg, ${GOLD}, ${YELLOW})`,
                            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
                        }}>Gemma 4 31B</h2>
                        <p className="text-sm opacity-50 mb-1">Propulsé par NVIDIA NIM · Thinking Mode activé</p>
                        <p className="text-xs opacity-30 mb-8">Votre assistant IA exécutif — stratégie, analyses, rédaction</p>

                        {/* Suggestions */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-2xl">
                            {SUGGESTIONS.map((s, i) => (
                                <motion.button key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.06 }}
                                    onClick={() => send(s)}
                                    className="text-left px-4 py-3 rounded-xl text-xs transition-all hover:opacity-80"
                                    style={{ background: `${GOLD}08`, border: `1px solid ${GOLD}15`, color: `${TEXT}70` }}>
                                    {s}
                                </motion.button>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* Historique */}
                <AnimatePresence initial={false}>
                    {messages.map(msg => (
                        <motion.div key={msg.id}
                            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                            className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>

                            {/* Avatar */}
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-1"
                                style={{
                                    background: msg.role === 'user'
                                        ? `${GOLD}25`
                                        : `linear-gradient(135deg, ${GOLD}, #9A7A00)`,
                                }}>
                                {msg.role === 'user'
                                    ? <User size={14} style={{ color: GOLD }} />
                                    : <Bot size={14} style={{ color: BG }} />}
                            </div>

                            <div className={`flex-1 max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>

                                {/* Thinking block */}
                                {msg.thinking && (
                                    <details className="w-full">
                                        <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg w-fit"
                                            style={{ color: `${GREEN_L}60`, background: `${GREEN}10` }}>
                                            <RefreshCw size={9} className="inline mr-1" />Processus de réflexion
                                        </summary>
                                        <div className="mt-1 px-3 py-2 rounded-xl text-xs italic opacity-40 border"
                                            style={{ borderColor: `${GREEN}20`, background: `${GREEN}08`, color: TEXT }}>
                                            {msg.thinking}
                                        </div>
                                    </details>
                                )}

                                {/* Bulle */}
                                <div className="relative group rounded-2xl px-4 py-3"
                                    style={{
                                        background: msg.role === 'user'
                                            ? `linear-gradient(135deg, ${GOLD}25, ${GOLD}15)`
                                            : PANEL,
                                        border: `1px solid ${msg.role === 'user' ? `${GOLD}25` : `${GOLD}10`}`,
                                    }}>
                                    {msg.role === 'assistant'
                                        ? <MarkdownText text={msg.content} />
                                        : <p className="text-sm leading-relaxed" style={{ color: TEXT }}>{msg.content}</p>
                                    }

                                    {/* Copy button */}
                                    <button onClick={() => copy(msg.content, msg.id)}
                                        className="absolute top-2 right-2 p-1 rounded-lg opacity-0 group-hover:opacity-70 transition-opacity"
                                        style={{ background: `${GOLD}15` }} title="Copier">
                                        {copied === msg.id
                                            ? <CheckCheck size={11} style={{ color: GREEN_L }} />
                                            : <Copy size={11} style={{ color: GOLD }} />}
                                    </button>
                                </div>

                                <span className="text-[10px] opacity-25 px-1">{fmtTime(msg.ts)}</span>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {/* Indicateur de chargement */}
                {loading && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                            style={{ background: `linear-gradient(135deg, ${GOLD}, #9A7A00)` }}>
                            <Bot size={14} style={{ color: BG }} />
                        </div>
                        <div className="px-4 py-3 rounded-2xl" style={{ background: PANEL, border: `1px solid ${GOLD}10` }}>
                            <div className="flex items-center gap-2">
                                <Loader2 size={14} className="animate-spin" style={{ color: GOLD }} />
                                <span className="text-xs" style={{ color: `${TEXT}50` }}>Gemma 4 réfléchit…</span>
                            </div>
                        </div>
                    </motion.div>
                )}

                <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="shrink-0 p-4 border-t" style={{ borderColor: `${GOLD}15`, background: PANEL }}>
                <div className="flex gap-3 items-end">
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
                        }}
                        placeholder="Posez une question à Gemma 4… (Entrée pour envoyer, Maj+Entrée pour aller à la ligne)"
                        rows={2}
                        className="flex-1 resize-none rounded-2xl px-4 py-3 text-sm outline-none transition-all"
                        style={{
                            background: `${BG}`,
                            border: `1px solid ${input ? `${GOLD}40` : `${GOLD}15`}`,
                            color: TEXT,
                            maxHeight: 160,
                        }}
                    />
                    <button
                        onClick={() => send()}
                        disabled={!input.trim() || loading}
                        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-all disabled:opacity-30"
                        style={{
                            background: input.trim() && !loading
                                ? `linear-gradient(135deg, ${GOLD}, #9A7A00)`
                                : `${GOLD}20`,
                        }}>
                        {loading
                            ? <Loader2 size={17} className="animate-spin" style={{ color: GOLD }} />
                            : <Send size={17} style={{ color: input.trim() ? BG : GOLD }} />}
                    </button>
                </div>
                <p className="text-[10px] text-center mt-2 opacity-20">
                    Gemma 4 31B · NVIDIA NIM · Thinking Mode · max 16 384 tokens
                </p>
            </div>
        </div>
    )
}
