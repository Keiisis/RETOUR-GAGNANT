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

    /* Les champs suivent le THÈME DU PANEL (clair ⇄ sombre). Ils étaient écrits
       en dur pour le sombre : en mode clair, la fenêtre restait noire et le
       texte devenait presque illisible. Le panel expose ses couleurs en
       variables CSS — les lire coûte moins qu'un second jeu de classes. */
    const champ = 'w-full rounded-xl px-3.5 py-2.5 text-sm outline-none border focus:border-emerald-500/60'
    const styleChamp = {
        background: 'var(--panel-surface-alt)',
        borderColor: 'var(--panel-border)',
        color: 'var(--panel-text)',
    } as React.CSSProperties
    const etiquette = 'block text-[10px] font-bold uppercase tracking-widest mb-1.5'
    const styleEtiquette = { color: 'var(--panel-text-muted)' } as React.CSSProperties

    return (
        <AnimatePresence>
            {ouvert && (
                <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    /* CENTRÉ, et JAMAIS plus haut que l'écran.
                       La fenêtre était collée en haut (`items-start`) et sa
                       hauteur n'était pas bornée : sur un formulaire long, le
                       bas — donc le bouton d'enregistrement — sortait de
                       l'écran. Ici elle se centre, se limite à 92 % de la
                       hauteur, et c'est SON CORPS qui défile : l'en-tête et le
                       bouton restent visibles en permanence. */
                    className="fixed inset-0 z-50 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
                    style={{ background: 'color-mix(in srgb, var(--panel-bg) 78%, transparent)' }}
                    onClick={onFermer}
                >
                    <motion.div
                        initial={{ opacity: 0, y: 24, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 24, scale: 0.98 }}
                        onClick={e => e.stopPropagation()}
                        className="w-full max-w-2xl rounded-3xl border shadow-2xl flex flex-col max-h-[92vh]"
                        style={{ background: 'var(--panel-surface)', borderColor: 'var(--panel-border)' }}
                    >
                        <div className="flex items-center justify-between px-6 py-5 border-b shrink-0"
                            style={{ borderColor: 'var(--panel-border)' }}>
                            <div>
                                <h3 className="text-lg font-black" style={{ color: 'var(--panel-text-heading)' }}>Ajouter un client</h3>
                                <p className="text-[11px] mt-0.5" style={{ color: 'var(--panel-text-muted)' }}>
                                    Demande reçue hors du site : téléphone, WhatsApp, agence.
                                </p>
                            </div>
                            <button type="button" onClick={onFermer} title="Fermer"
                                className="w-9 h-9 rounded-xl flex items-center justify-center"
                                style={{ background: 'var(--panel-surface-hover)', color: 'var(--panel-text-muted)' }}>
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={soumettre} className="flex flex-col min-h-0 flex-1">
                            <div className="p-6 space-y-4 overflow-y-auto min-h-0 flex-1">
                            <div className="grid sm:grid-cols-2 gap-4">
                                <div>
                                    <label className={etiquette} style={styleEtiquette}>Prénom *</label>
                                    <input required value={f.prenom} onChange={e => maj('prenom', e.target.value)} className={champ} style={styleChamp} placeholder="Awa" />
                                </div>
                                <div>
                                    <label className={etiquette} style={styleEtiquette}>Nom *</label>
                                    <input required value={f.nom} onChange={e => maj('nom', e.target.value)} className={champ} style={styleChamp} placeholder="DIALLO" />
                                </div>
                                <div>
                                    <label className={etiquette} style={styleEtiquette}>E-mail *</label>
                                    <input required type="email" value={f.email} onChange={e => maj('email', e.target.value)} className={champ} style={styleChamp} placeholder="awa.diallo@exemple.com" />
                                </div>
                                <div>
                                    <label className={etiquette} style={styleEtiquette}>Téléphone *</label>
                                    <input required value={f.telephone} onChange={e => maj('telephone', e.target.value)} className={champ} style={styleChamp} placeholder="+33 6 12 34 56 78" />
                                </div>
                            </div>

                            {/* ── LES MÊMES CHAMPS QUE LE FORMULAIRE PUBLIC ──
                                Ces trois-là étaient repliés sous « Informations
                                complémentaires », alors que le client les remplit
                                d'emblée sur /services/recap-myafroorigins. L'agent qui
                                saisit au téléphone recueillait donc MOINS d'informations
                                que le formulaire en libre-service — et la fiche d'analyse,
                                qui s'appuie dessus, en pâtissait. */}
                            <div className="grid sm:grid-cols-3 gap-4">
                                <div>
                                    <label className={etiquette} style={styleEtiquette}>Pays de résidence</label>
                                    <input value={f.pays_residence} onChange={e => maj('pays_residence', e.target.value)} className={champ} style={styleChamp} placeholder="France, Martinique…" />
                                </div>
                                <div>
                                    <label className={etiquette} style={styleEtiquette}>Réf. MyAfroOrigins</label>
                                    <input value={f.myafro_reference} onChange={e => maj('myafro_reference', e.target.value)} className={champ} style={styleChamp} placeholder="s’il l’a" />
                                </div>
                                <div>
                                    <label className={etiquette} style={styleEtiquette}>Sans nouvelle depuis</label>
                                    <input value={f.depuis_quand} onChange={e => maj('depuis_quand', e.target.value)} className={champ} style={styleChamp} placeholder="8 mois…" />
                                </div>
                            </div>

                            <div>
                                <label className={etiquette} style={styleEtiquette}>Situation décrite par le client *</label>
                                <textarea required rows={5} maxLength={4000} value={f.situation} onChange={e => maj('situation', e.target.value)}
                                    className={champ + ' resize-y leading-relaxed'} style={styleChamp}
                                    placeholder="Quand a-t-il déposé sa demande ? Qu’a-t-il fourni ? Qu’est-ce qu’on lui a répondu, s’il y a eu une réponse ? Qu’est-ce qui semble bloquer ?" />
                                <div className="mt-1 flex items-baseline justify-between gap-3 text-[11px]">
                                    <span style={{ color: 'var(--panel-text-muted)' }}>
                                        {f.situation.trim().length < 40
                                            ? `Encore ${40 - f.situation.trim().length} caractères pour une analyse exploitable.`
                                            : 'C’est la matière de la fiche d’analyse : plus le récit est fidèle, plus la fiche est juste.'}
                                    </span>
                                    <span className={f.situation.trim().length < 40 ? 'text-amber-500 shrink-0' : 'text-emerald-500 shrink-0'}>
                                        {f.situation.length}/4000
                                    </span>
                                </div>
                            </div>

                            <div>
                                <label className={etiquette} style={styleEtiquette}>Ce qu’il attend de nous</label>
                                <textarea rows={3} maxLength={2000} value={f.attentes} onChange={e => maj('attentes', e.target.value)}
                                    className={champ + ' resize-y leading-relaxed'} style={styleChamp}
                                    placeholder="Ce que le client espère : comprendre le blocage, relancer la démarche, être accompagné jusqu’au bout…" />
                            </div>

                            {/* ── Ce qui n'existe QUE côté panel : règlement et notes ── */}
                            <button type="button" onClick={() => setPlus(p => !p)}
                                className="flex items-center gap-1.5 text-xs font-bold text-emerald-500 hover:text-emerald-400">
                                {plus ? <CaretDown size={12} /> : <CaretRight size={12} />}
                                Règlement et notes internes
                            </button>

                            {plus && (
                                <div className="space-y-4 rounded-2xl border p-4"
                                    style={{ background: 'var(--panel-surface-alt)', borderColor: 'var(--panel-border)' }}>
                                    <div>
                                        <label className={etiquette} style={styleEtiquette}>Notes internes</label>
                                        <textarea rows={2} value={f.notes_agent} onChange={e => maj('notes_agent', e.target.value)} className={champ + ' resize-y'} style={styleChamp} placeholder="Pour l’équipe, jamais transmis au client." />
                                    </div>

                                    <div className="grid sm:grid-cols-4 gap-4">
                                        <div>
                                            <label className={etiquette} style={styleEtiquette}>Règlement</label>
                                            <select value={f.paiement_statut} onChange={e => maj('paiement_statut', e.target.value)} className={champ} style={styleChamp} title="Statut du règlement">
                                                <option value="en_attente">En attente</option>
                                                <option value="paye">Payé</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className={etiquette} style={styleEtiquette}>Montant</label>
                                            <input type="number" min="0" step="any" value={f.montant} onChange={e => maj('montant', e.target.value)} className={champ} style={styleChamp} title="Montant" />
                                        </div>
                                        <div>
                                            <label className={etiquette} style={styleEtiquette}>Devise</label>
                                            <select value={f.devise} onChange={e => maj('devise', e.target.value)} className={champ} style={styleChamp} title="Devise">
                                                <option value="EUR">EUR</option>
                                                <option value="XOF">XOF</option>
                                                <option value="USD">USD</option>
                                                <option value="GBP">GBP</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className={etiquette} style={styleEtiquette}>Référence</label>
                                            <input value={f.paiement_ref} onChange={e => maj('paiement_ref', e.target.value)} className={champ} style={styleChamp} placeholder="N° reçu" />
                                        </div>
                                    </div>
                                    <p className="text-[11px]" style={{ color: 'var(--panel-text-muted)' }}>
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
                                    <span className="text-xs leading-relaxed" style={{ color: 'var(--panel-text)' }}>
                                        <strong style={{ color: 'var(--panel-text-heading)' }}>J’atteste avoir recueilli le consentement du client</strong> pour
                                        l’enregistrement et le traitement de ces données (Code du numérique béninois).
                                        Personne ne peut cocher à sa place : cette attestation vous engage, et elle est
                                        tracée avec votre nom et la date.
                                    </span>
                                </label>
                                {f.consentement && (
                                    <div className="mt-3 pl-7">
                                        <label className={etiquette} style={styleEtiquette}>Recueilli par</label>
                                        <select value={f.consentement_canal} onChange={e => maj('consentement_canal', e.target.value)}
                                            className={champ + ' max-w-xs'} style={styleChamp} title="Canal du consentement">
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

                            </div>

                            {/* Barre d'action : hors du defilement, toujours atteignable. */}
                            <div className="flex gap-3 px-6 py-4 border-t shrink-0"
                                style={{ borderColor: 'var(--panel-border)' }}>
                                <button type="button" onClick={onFermer}
                                    className="px-5 py-3 rounded-xl text-xs font-black"
                                    style={{ background: 'var(--panel-surface-hover)', color: 'var(--panel-text)' }}>
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
