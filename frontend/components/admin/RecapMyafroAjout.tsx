'use client'

// ══════════════════════════════════════════════════════════════
//  SAISIE MANUELLE d'un récap de dossier MyAfroOrigins.
//
//  Le service n'entrait que par le formulaire public. Un client qui appelle,
//  écrit par WhatsApp ou se présente à l'agence n'existait donc nulle part, et
//  l'équipe ne pouvait pas lui produire de fiche d'analyse. Ce formulaire ouvre
//  la même file au panel — admin comme agent.
//
//  Il est volontairement COURT : cinq champs obligatoires, le reste replié.
//  Un formulaire de saisie au téléphone doit se remplir pendant que le client
//  parle, pas après.
// ══════════════════════════════════════════════════════════════
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, FloppyDisk, CircleNotch, WarningCircle, CaretDown, CaretRight } from '@phosphor-icons/react'

interface Props {
    ouvert: boolean
    onFermer: () => void
    /** Appelée avec la demande créée, pour l'insérer en tête de liste. */
    onCree: (demande: Record<string, unknown>) => void
}

const CANAUX = ['Téléphone', 'WhatsApp', 'E-mail', 'En agence', 'Visioconférence']

export default function RecapMyafroAjout({ ouvert, onFermer, onCree }: Props) {
    const [f, setF] = useState({
        prenom: '', nom: '', email: '', telephone: '',
        pays_residence: '', myafro_reference: '', depuis_quand: '',
        situation: '', attentes: '', notes_agent: '',
        paiement_statut: 'en_attente', montant: '50', devise: 'EUR',
        paiement_moyen: '', paiement_ref: '',
        consentement: false, consentement_canal: 'Téléphone',
    })
    const [plus, setPlus] = useState(false)
    const [envoi, setEnvoi] = useState(false)
    const [erreur, setErreur] = useState('')

    const maj = (k: keyof typeof f, v: string | boolean) => setF(p => ({ ...p, [k]: v }))

    const soumettre = async (e: React.FormEvent) => {
        e.preventDefault()
        setErreur(''); setEnvoi(true)
        try {
            const res = await fetch('/api/admin/myafro-recap', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...f, montant: Number(f.montant) || 50 }),
            })
            const json = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(json.error || 'Enregistrement impossible.')
            onCree(json.demande)
            setF(p => ({
                ...p, prenom: '', nom: '', email: '', telephone: '',
                pays_residence: '', myafro_reference: '', depuis_quand: '',
                situation: '', attentes: '', notes_agent: '',
                paiement_ref: '', consentement: false,
            }))
            onFermer()
        } catch (err) {
            setErreur(err instanceof Error ? err.message : 'Enregistrement impossible.')
        } finally { setEnvoi(false) }
    }

    const champ = 'w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-emerald-500/50 outline-none'
    const etiquette = 'block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5'

    return (
        <AnimatePresence>
            {ouvert && (
                <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-4 sm:p-8"
                    onClick={onFermer}
                >
                    <motion.div
                        initial={{ opacity: 0, y: 24, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 24, scale: 0.98 }}
                        onClick={e => e.stopPropagation()}
                        className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#0e1512] shadow-2xl"
                    >
                        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
                            <div>
                                <h3 className="text-lg font-black text-white">Ajouter un client</h3>
                                <p className="text-[11px] text-gray-500 mt-0.5">
                                    Demande reçue hors du site : téléphone, WhatsApp, agence.
                                </p>
                            </div>
                            <button type="button" onClick={onFermer} title="Fermer"
                                className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-gray-400 hover:text-white">
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={soumettre} className="p-6 space-y-4">
                            <div className="grid sm:grid-cols-2 gap-4">
                                <div>
                                    <label className={etiquette}>Prénom *</label>
                                    <input required value={f.prenom} onChange={e => maj('prenom', e.target.value)} className={champ} placeholder="Awa" />
                                </div>
                                <div>
                                    <label className={etiquette}>Nom *</label>
                                    <input required value={f.nom} onChange={e => maj('nom', e.target.value)} className={champ} placeholder="DIALLO" />
                                </div>
                                <div>
                                    <label className={etiquette}>E-mail *</label>
                                    <input required type="email" value={f.email} onChange={e => maj('email', e.target.value)} className={champ} placeholder="awa.diallo@exemple.com" />
                                </div>
                                <div>
                                    <label className={etiquette}>Téléphone *</label>
                                    <input required value={f.telephone} onChange={e => maj('telephone', e.target.value)} className={champ} placeholder="+33 6 12 34 56 78" />
                                </div>
                            </div>

                            <div>
                                <label className={etiquette}>Situation décrite par le client *</label>
                                <textarea required rows={5} value={f.situation} onChange={e => maj('situation', e.target.value)}
                                    className={champ + ' resize-y leading-relaxed'}
                                    placeholder="Ce que le client raconte : depuis quand son dossier est bloqué, ce qu'il a déjà tenté, ce qu'on lui a répondu…" />
                                <p className="mt-1 text-[11px] text-gray-600">
                                    C’est la matière de la fiche d’analyse : plus le récit est fidèle, plus la fiche est juste.
                                    <span className={f.situation.trim().length < 40 ? ' text-amber-400' : ' text-emerald-400'}>
                                        {' '}{f.situation.trim().length} / 40 caractères minimum
                                    </span>
                                </p>
                            </div>

                            {/* ── Le reste, replié : on ne l'a pas toujours au téléphone ── */}
                            <button type="button" onClick={() => setPlus(p => !p)}
                                className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300">
                                {plus ? <CaretDown size={12} /> : <CaretRight size={12} />}
                                Informations complémentaires
                            </button>

                            {plus && (
                                <div className="space-y-4 rounded-2xl bg-white/[0.02] border border-white/5 p-4">
                                    <div className="grid sm:grid-cols-3 gap-4">
                                        <div>
                                            <label className={etiquette}>Pays de résidence</label>
                                            <input value={f.pays_residence} onChange={e => maj('pays_residence', e.target.value)} className={champ} placeholder="France" />
                                        </div>
                                        <div>
                                            <label className={etiquette}>Réf. MyAfroOrigins</label>
                                            <input value={f.myafro_reference} onChange={e => maj('myafro_reference', e.target.value)} className={champ} placeholder="si connue" />
                                        </div>
                                        <div>
                                            <label className={etiquette}>Bloqué depuis</label>
                                            <input value={f.depuis_quand} onChange={e => maj('depuis_quand', e.target.value)} className={champ} placeholder="8 mois" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className={etiquette}>Attentes du client</label>
                                        <textarea rows={2} value={f.attentes} onChange={e => maj('attentes', e.target.value)} className={champ + ' resize-y'} placeholder="Ce qu’il espère de nous." />
                                    </div>
                                    <div>
                                        <label className={etiquette}>Notes internes</label>
                                        <textarea rows={2} value={f.notes_agent} onChange={e => maj('notes_agent', e.target.value)} className={champ + ' resize-y'} placeholder="Pour l’équipe, jamais transmis au client." />
                                    </div>

                                    <div className="grid sm:grid-cols-4 gap-4">
                                        <div>
                                            <label className={etiquette}>Règlement</label>
                                            <select value={f.paiement_statut} onChange={e => maj('paiement_statut', e.target.value)} className={champ} title="Statut du règlement">
                                                <option value="en_attente">En attente</option>
                                                <option value="paye">Payé</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className={etiquette}>Montant</label>
                                            <input type="number" min="0" step="any" value={f.montant} onChange={e => maj('montant', e.target.value)} className={champ} title="Montant" />
                                        </div>
                                        <div>
                                            <label className={etiquette}>Devise</label>
                                            <select value={f.devise} onChange={e => maj('devise', e.target.value)} className={champ} title="Devise">
                                                <option value="EUR">EUR</option>
                                                <option value="XOF">XOF</option>
                                                <option value="USD">USD</option>
                                                <option value="GBP">GBP</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className={etiquette}>Référence</label>
                                            <input value={f.paiement_ref} onChange={e => maj('paiement_ref', e.target.value)} className={champ} placeholder="N° reçu" />
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-gray-600">
                                        Un dossier saisi à la main n’est pas réputé payé : laissez « en attente » tant que
                                        l’encaissement n’est pas fait, pour ne pas gonfler les recettes.
                                    </p>
                                </div>
                            )}

                            {/* ── CONSENTEMENT : la contrainte est en base, pas dans ce formulaire ── */}
                            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] p-4">
                                <label className="flex items-start gap-3 cursor-pointer">
                                    <input type="checkbox" checked={f.consentement}
                                        onChange={e => maj('consentement', e.target.checked)}
                                        className="mt-0.5 w-4 h-4 accent-emerald-500 shrink-0" />
                                    <span className="text-xs text-gray-300 leading-relaxed">
                                        <strong className="text-white">J’atteste avoir recueilli le consentement du client</strong> pour
                                        l’enregistrement et le traitement de ces données (Code du numérique béninois).
                                        Personne ne peut cocher à sa place : cette attestation vous engage, et elle est
                                        tracée avec votre nom et la date.
                                    </span>
                                </label>
                                {f.consentement && (
                                    <div className="mt-3 pl-7">
                                        <label className={etiquette}>Recueilli par</label>
                                        <select value={f.consentement_canal} onChange={e => maj('consentement_canal', e.target.value)}
                                            className={champ + ' max-w-xs'} title="Canal du consentement">
                                            {CANAUX.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                )}
                            </div>

                            {erreur && (
                                <div className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/30 p-3">
                                    <WarningCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                                    <p className="text-xs text-red-300">{erreur}</p>
                                </div>
                            )}

                            <div className="flex gap-3 pt-1">
                                <button type="button" onClick={onFermer}
                                    className="px-5 py-3 rounded-xl bg-white/5 text-gray-300 text-xs font-black hover:bg-white/10">
                                    Annuler
                                </button>
                                <button type="submit" disabled={envoi || !f.consentement}
                                    className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-500 text-black text-xs font-black hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed">
                                    {envoi ? <CircleNotch size={14} className="animate-spin" /> : <FloppyDisk size={14} />}
                                    Enregistrer la demande
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
