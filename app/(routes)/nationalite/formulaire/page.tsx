'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import {
    ArrowLeft, ArrowRight, CheckCircle2, Globe2, User,
    FileText, Upload, Send, Shield, ChevronLeft, Loader2, AlertCircle
} from 'lucide-react'
import Link from 'next/link'

const STEPS = [
    { num: 1, label: 'Afro-descendance' },
    { num: 2, label: 'Infos personnelles' },
    { num: 3, label: 'Document d\'identité' },
    { num: 4, label: 'Pièces jointes' },
    { num: 5, label: 'Récapitulatif' },
]

const COUNTRIES = ['Bénin', 'France', 'États-Unis', 'Brésil', 'Haïti', 'Canada', 'Royaume-Uni', 'Jamaïque', 'Trinidad', 'Colombie', 'Cuba', 'Guadeloupe', 'Martinique', 'Guyane', 'Suriname', 'Barbade', 'Bahamas', 'Allemagne', 'Belgique', 'Suisse', 'Pays-Bas', 'Italie', 'Espagne', 'Portugal', 'Ghana', 'Togo', 'Nigeria', 'Sénégal', 'Côte d\'Ivoire', 'Cameroun', 'Autre']
const PROFESSIONS = ['Salarié(e)', 'Entrepreneur/Commerçant', 'Profession libérale', 'Étudiant(e)', 'Fonctionnaire', 'Retraité(e)', 'Artisan', 'Agriculteur', 'Sans emploi', 'Autre']

export default function NationaliteFormPage() {
    const [step, setStep] = useState(1)
    const [submitting, setSubmitting] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [appRef, setAppRef] = useState('')
    const [errors, setErrors] = useState<string[]>([])

    const [form, setForm] = useState({
        knows_about_law: false, is_afro_descendant: true, afro_descendant_description: '',
        ancestor1_nom: '', ancestor1_prenom: '', ancestor1_date_naissance: '', ancestor1_lien_parente: '',
        ancestor1_vivant: true, ancestor1_nationalite: '', ancestor1_pays_residence: '', ancestor1_autres_infos: '',
        ancestor2_nom: '', ancestor2_prenom: '', ancestor2_date_naissance: '', ancestor2_lien_parente: '',
        ancestor2_vivant: true, ancestor2_nationalite: '', ancestor2_pays_residence: '', ancestor2_autres_infos: '',
        nom: '', prenom: '', genre: '', date_naissance: '', pays_naissance: '', ville_naissance: '',
        nationalite: '', pays_residence: '', adresse_residence: '', telephone: '', email: '', profession: '',
        demande_depuis_benin: false,
        type_document_identite: '', numero_document: '', date_expiration_document: '',
        pays_delivrance: '', lieu_delivrance: '', autorite_delivrance: '',
        pere_nom: '', pere_prenom: '', pere_date_naissance: '',
        mere_nom: '', mere_prenom: '', mere_date_naissance: '',
        documents_uploaded: [] as string[],
    })

    const u = (key: string, val: any) => setForm(p => ({ ...p, [key]: val }))
    const inputCls = "w-full bg-white/[0.04] border border-white/10 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-emerald-500/50 placeholder:text-gray-600 transition-all"
    const labelCls = "text-xs font-bold text-gray-400 mb-1.5 block"
    const reqCls = "text-red-400 ml-0.5"

    const validate = (): string[] => {
        const e: string[] = []
        if (step === 1 && !form.afro_descendant_description) e.push('Décrivez votre afro-descendance')
        if (step === 2) {
            if (!form.nom) e.push('Nom requis')
            if (!form.prenom) e.push('Prénom requis')
            if (!form.email) e.push('Email requis')
            if (!form.pays_residence) e.push('Pays de résidence requis')
        }
        if (step === 3 && !form.type_document_identite) e.push('Type de document requis')
        return e
    }

    const next = () => {
        const e = validate()
        if (e.length > 0) { setErrors(e); return }
        setErrors([])
        setStep(s => Math.min(s + 1, 5))
    }
    const prev = () => { setErrors([]); setStep(s => Math.max(s - 1, 1)) }

    const submit = async () => {
        setSubmitting(true)
        const ref = `RG-NAT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
        const { error } = await supabase.from('nationality_applications').insert({
            ...form,
            application_ref: ref,
            status: 'soumis',
            submitted_at: new Date().toISOString(),
            last_step_completed: 5,
            documents_uploaded: form.documents_uploaded,
        })
        if (!error) {
            setAppRef(ref)
            setSubmitted(true)
            try {
                await fetch('/api/email/send', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        to: form.email, subject: `Retour Gagnant — Demande de nationalité ${ref}`,
                        message: `Bonjour ${form.prenom} ${form.nom},\n\nVotre demande de reconnaissance de nationalité béninoise a été enregistrée sous la référence ${ref}.\n\nNotre équipe va examiner votre dossier et vous recontactera dans les plus brefs délais.\n\nL'équipe Retour Gagnant`,
                        clientName: `${form.prenom} ${form.nom}`, context: 'nationality_application', relatedId: ref
                    })
                })
            } catch { }
        }
        setSubmitting(false)
    }

    if (submitted) return (
        <div className="min-h-screen bg-[#0a0f14] flex items-center justify-center px-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white/[0.03] border border-emerald-500/20 rounded-3xl p-10 text-center max-w-md">
                <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6"><CheckCircle2 size={36} className="text-emerald-400" /></div>
                <h2 className="text-2xl font-black text-white mb-3">Demande Soumise</h2>
                <p className="text-sm text-gray-400 mb-4">Votre référence :</p>
                <p className="text-xl font-mono font-black text-[#FCD116] mb-6">{appRef}</p>
                <p className="text-xs text-gray-500 mb-8">Un email de confirmation a été envoyé à {form.email}</p>
                <Link href="/nationalite" className="bg-white/10 hover:bg-white/15 text-white font-bold text-sm px-6 py-3 rounded-xl transition-all">Retour</Link>
            </motion.div>
        </div>
    )

    return (
        <div className="min-h-screen bg-[#0a0f14] py-8 px-4">
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <Link href="/nationalite" className="inline-flex items-center gap-2 text-xs text-gray-500 hover:text-white mb-4 transition-colors"><ChevronLeft size={14} /> Retour</Link>
                    <h1 className="text-2xl md:text-3xl font-black text-white">Reconnaissance de Nationalité</h1>
                    <p className="text-sm text-gray-500 mt-2">Veuillez remplir le formulaire ci-dessous</p>
                </div>

                {/* Step indicator */}
                <div className="flex items-center justify-between mb-10 overflow-x-auto pb-2">
                    {STEPS.map((s, i) => (
                        <div key={s.num} className="flex items-center">
                            <div className={`flex items-center gap-2 shrink-0 ${step >= s.num ? 'text-emerald-400' : 'text-gray-600'}`}>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${step > s.num ? 'bg-emerald-500 text-white' : step === s.num ? 'bg-emerald-500/20 border border-emerald-500 text-emerald-400' : 'bg-white/5 border border-white/10 text-gray-600'}`}>{step > s.num ? <CheckCircle2 size={14} /> : s.num}</div>
                                <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:block whitespace-nowrap">{s.label}</span>
                            </div>
                            {i < 4 && <div className={`w-8 sm:w-16 h-px mx-2 ${step > s.num ? 'bg-emerald-500/50' : 'bg-white/10'}`} />}
                        </div>
                    ))}
                </div>

                {/* Errors */}
                {errors.length > 0 && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6">
                        {errors.map((e, i) => <p key={i} className="text-xs text-red-400 flex items-center gap-2"><AlertCircle size={12} /> {e}</p>)}
                    </div>
                )}

                {/* Form content */}
                <AnimatePresence mode="wait">
                    <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}
                        className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 md:p-8">

                        {step === 1 && (
                            <div className="space-y-6">
                                <h2 className="text-lg font-black text-white mb-2">Votre identification Afro-descendante</h2>
                                <div>
                                    <label className={labelCls}>Connaissez-vous la loi sur la reconnaissance de nationalité ?</label>
                                    <div className="flex gap-3 mt-1">
                                        {[true, false].map(v => <button key={String(v)} onClick={() => u('knows_about_law', v)} className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${form.knows_about_law === v ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-400' : 'bg-white/5 border border-white/10 text-gray-500'}`}>{v ? 'Oui' : 'Non'}</button>)}
                                    </div>
                                </div>
                                <div>
                                    <label className={labelCls}>Êtes-vous afro-descendant(e) ?<span className={reqCls}>*</span></label>
                                    <div className="flex gap-3 mt-1">
                                        {[true, false].map(v => <button key={String(v)} onClick={() => u('is_afro_descendant', v)} className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${form.is_afro_descendant === v ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-400' : 'bg-white/5 border border-white/10 text-gray-500'}`}>{v ? 'Oui' : 'Non'}</button>)}
                                    </div>
                                </div>
                                <div>
                                    <label className={labelCls}>Comment êtes-vous afro-descendant(e) ?<span className={reqCls}>*</span></label>
                                    <textarea rows={4} value={form.afro_descendant_description} onChange={e => u('afro_descendant_description', e.target.value)} placeholder="Décrivez en quelques mots votre ascendance afro-descendante..." className={inputCls + ' resize-none'} />
                                </div>
                                <div className="border-t border-white/5 pt-6">
                                    <h3 className="text-sm font-black text-white mb-4">Informations sur vos ancêtres</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {[1, 2].map(n => (
                                            <div key={n} className="space-y-3">
                                                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em]">{n === 1 ? '1ère' : '2ème'} Personne</span>
                                                <div><label className={labelCls}>Nom{n === 1 && <span className={reqCls}>*</span>}</label><input value={(form as any)[`ancestor${n}_nom`]} onChange={e => u(`ancestor${n}_nom`, e.target.value)} className={inputCls} placeholder="Nom" /></div>
                                                <div><label className={labelCls}>Prénom(s)</label><input value={(form as any)[`ancestor${n}_prenom`]} onChange={e => u(`ancestor${n}_prenom`, e.target.value)} className={inputCls} placeholder="Prénom(s)" /></div>
                                                <div><label className={labelCls}>Lien de parenté{n === 1 && <span className={reqCls}>*</span>}</label><input value={(form as any)[`ancestor${n}_lien_parente`]} onChange={e => u(`ancestor${n}_lien_parente`, e.target.value)} className={inputCls} placeholder="Ex: Grand-père" /></div>
                                                <div><label className={labelCls}>Nationalité</label><select value={(form as any)[`ancestor${n}_nationalite`]} onChange={e => u(`ancestor${n}_nationalite`, e.target.value)} className={inputCls}><option value="">Saisir un pays</option>{COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="space-y-5">
                                <h2 className="text-lg font-black text-white mb-2">Informations Personnelles</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div><label className={labelCls}>Nom<span className={reqCls}>*</span></label><input value={form.nom} onChange={e => u('nom', e.target.value)} className={inputCls} placeholder="Nom de famille" /></div>
                                    <div><label className={labelCls}>Prénom(s)<span className={reqCls}>*</span></label><input value={form.prenom} onChange={e => u('prenom', e.target.value)} className={inputCls} placeholder="Prénom(s)" /></div>
                                    <div><label className={labelCls}>Genre<span className={reqCls}>*</span></label><select value={form.genre} onChange={e => u('genre', e.target.value)} className={inputCls}><option value="">Choisir</option><option value="Masculin">Masculin</option><option value="Féminin">Féminin</option><option value="Autre">Autre</option></select></div>
                                    <div><label className={labelCls}>Date de naissance<span className={reqCls}>*</span></label><input type="date" value={form.date_naissance} onChange={e => u('date_naissance', e.target.value)} className={inputCls} /></div>
                                    <div><label className={labelCls}>Pays de naissance<span className={reqCls}>*</span></label><select value={form.pays_naissance} onChange={e => u('pays_naissance', e.target.value)} className={inputCls}><option value="">Saisir un pays</option>{COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                                    <div><label className={labelCls}>Ville de naissance</label><input value={form.ville_naissance} onChange={e => u('ville_naissance', e.target.value)} className={inputCls} placeholder="Ville" /></div>
                                    <div><label className={labelCls}>Pays de résidence<span className={reqCls}>*</span></label><select value={form.pays_residence} onChange={e => u('pays_residence', e.target.value)} className={inputCls}><option value="">Saisir un pays</option>{COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                                    <div><label className={labelCls}>Adresse de résidence</label><input value={form.adresse_residence} onChange={e => u('adresse_residence', e.target.value)} className={inputCls} placeholder="Adresse complète" /></div>
                                    <div><label className={labelCls}>Nationalité<span className={reqCls}>*</span></label><select value={form.nationalite} onChange={e => u('nationalite', e.target.value)} className={inputCls}><option value="">Saisir un pays</option>{COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                                    <div><label className={labelCls}>Téléphone</label><input value={form.telephone} onChange={e => u('telephone', e.target.value)} className={inputCls} placeholder="+229 XX XX XX XX" /></div>
                                    <div><label className={labelCls}>Email<span className={reqCls}>*</span></label><input type="email" value={form.email} onChange={e => u('email', e.target.value)} className={inputCls} placeholder="email@exemple.com" /></div>
                                    <div><label className={labelCls}>Profession<span className={reqCls}>*</span></label><select value={form.profession} onChange={e => u('profession', e.target.value)} className={inputCls}><option value="">Choisir</option>{PROFESSIONS.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
                                </div>
                                <div className="flex items-center gap-3 mt-4 bg-white/[0.03] border border-white/5 rounded-xl p-4">
                                    <button onClick={() => u('demande_depuis_benin', !form.demande_depuis_benin)} className={`w-12 h-6 rounded-full transition-all relative ${form.demande_depuis_benin ? 'bg-emerald-500' : 'bg-white/10'}`}><div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all shadow ${form.demande_depuis_benin ? 'left-6' : 'left-0.5'}`} /></button>
                                    <span className="text-sm text-gray-400">Faites-vous votre demande depuis le territoire béninois ?</span>
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="space-y-5">
                                <h2 className="text-lg font-black text-white mb-2">Document d'identité & Parents</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div><label className={labelCls}>Type de document<span className={reqCls}>*</span></label><select value={form.type_document_identite} onChange={e => u('type_document_identite', e.target.value)} className={inputCls}><option value="">Choisir</option><option value="passport">Passeport</option><option value="cni">Carte Nationale d'Identité</option><option value="carte_electeur">Carte d'électeur</option><option value="autre">Autre</option></select></div>
                                    <div><label className={labelCls}>Numéro du document</label><input value={form.numero_document} onChange={e => u('numero_document', e.target.value)} className={inputCls} /></div>
                                    <div><label className={labelCls}>Date d'expiration</label><input type="date" value={form.date_expiration_document} onChange={e => u('date_expiration_document', e.target.value)} className={inputCls} /></div>
                                    <div><label className={labelCls}>Pays de délivrance</label><select value={form.pays_delivrance} onChange={e => u('pays_delivrance', e.target.value)} className={inputCls}><option value="">Saisir un pays</option>{COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                                    <div><label className={labelCls}>Lieu de délivrance</label><input value={form.lieu_delivrance} onChange={e => u('lieu_delivrance', e.target.value)} className={inputCls} /></div>
                                    <div><label className={labelCls}>Autorité de délivrance</label><input value={form.autorite_delivrance} onChange={e => u('autorite_delivrance', e.target.value)} className={inputCls} /></div>
                                </div>
                                <div className="border-t border-white/5 pt-6 mt-6">
                                    <h3 className="text-sm font-black text-white mb-4">Informations sur vos parents</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {['Père', 'Mère'].map(p => {
                                            const k = p === 'Père' ? 'pere' : 'mere'; return (
                                                <div key={p} className="space-y-3">
                                                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em]">{p}</span>
                                                    <div><label className={labelCls}>Nom</label><input value={(form as any)[`${k}_nom`]} onChange={e => u(`${k}_nom`, e.target.value)} className={inputCls} /></div>
                                                    <div><label className={labelCls}>Prénom(s)</label><input value={(form as any)[`${k}_prenom`]} onChange={e => u(`${k}_prenom`, e.target.value)} className={inputCls} /></div>
                                                    <div><label className={labelCls}>Date de naissance</label><input type="date" value={(form as any)[`${k}_date_naissance`]} onChange={e => u(`${k}_date_naissance`, e.target.value)} className={inputCls} /></div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {step === 4 && (
                            <div className="space-y-5">
                                <h2 className="text-lg font-black text-white mb-2">Pièces à joindre</h2>
                                <p className="text-xs text-gray-500">Téléversez vos documents justificatifs. Formats acceptés : PDF, JPG, PNG (max 5 MB par fichier).</p>
                                {['Preuve d\'afro-descendance', 'Pièce d\'identité (scan)', 'Casier judiciaire', 'Justificatif de domicile', 'Preuve de profession'].map((doc, i) => (
                                    <div key={i} className="bg-white/[0.03] border border-white/5 rounded-xl p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <FileText size={16} className="text-emerald-400" />
                                            <span className="text-sm text-gray-300">{doc}</span>
                                        </div>
                                        <label className="cursor-pointer bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-bold px-4 py-2 rounded-lg transition-all flex items-center gap-2">
                                            <Upload size={12} /> Ajouter
                                            <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={e => {
                                                const f = e.target.files?.[0]
                                                if (f) u('documents_uploaded', [...form.documents_uploaded, `${doc}: ${f.name}`])
                                            }} />
                                        </label>
                                    </div>
                                ))}
                                {form.documents_uploaded.length > 0 && (
                                    <div className="space-y-2 mt-4">{form.documents_uploaded.map((d, i) => (
                                        <div key={i} className="text-xs text-emerald-400 flex items-center gap-2"><CheckCircle2 size={12} /> {d}</div>
                                    ))}</div>
                                )}
                            </div>
                        )}

                        {step === 5 && (
                            <div className="space-y-6">
                                <h2 className="text-lg font-black text-white mb-2">Récapitulatif de votre demande</h2>
                                {[
                                    { title: 'Infos personnelles', items: [['Nom', `${form.prenom} ${form.nom}`], ['Genre', form.genre], ['Date de naissance', form.date_naissance], ['Pays de résidence', form.pays_residence], ['Email', form.email], ['Profession', form.profession]] },
                                    { title: 'Afro-descendance', items: [['Description', form.afro_descendant_description], ['Ancêtre 1', `${form.ancestor1_prenom} ${form.ancestor1_nom} — ${form.ancestor1_lien_parente}`]] },
                                    { title: 'Document d\'identité', items: [['Type', form.type_document_identite], ['Numéro', form.numero_document], ['Pays', form.pays_delivrance]] },
                                    { title: 'Frais de traitement', items: [['Montant', '250 $ USD']] },
                                ].map((sec, si) => (
                                    <div key={si} className="bg-white/[0.02] border border-white/5 rounded-xl p-5">
                                        <h3 className="text-xs font-black text-emerald-400 uppercase tracking-[0.2em] mb-3">{sec.title}</h3>
                                        {sec.items.map(([k, v], i) => v && (
                                            <div key={i} className="flex justify-between py-1.5 border-b border-white/[0.03] last:border-0">
                                                <span className="text-xs text-gray-500">{k}</span>
                                                <span className="text-xs text-white font-bold">{v}</span>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>

                {/* Navigation */}
                <div className="flex items-center justify-between mt-8">
                    {step > 1 ? <button onClick={prev} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors font-bold"><ArrowLeft size={16} /> Précédent</button> : <div />}
                    {step < 5 ? (
                        <button onClick={next} className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-black text-sm px-6 py-3 rounded-xl transition-all flex items-center gap-2">
                            Suivant <ArrowRight size={16} />
                        </button>
                    ) : (
                        <button onClick={submit} disabled={submitting} className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-black text-sm px-8 py-3 rounded-xl transition-all flex items-center gap-2 disabled:opacity-50">
                            {submitting ? <><Loader2 size={16} className="animate-spin" /> Envoi...</> : <><Send size={16} /> Confirmer et Soumettre</>}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
