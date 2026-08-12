'use client'

// ══════════════════════════════════════════════════════════════
//  SIGNATURE EN LIGNE : page publique accessible via lien sécurisé
//  Aucun compte requis. Le document A4 exact est affiché (iframe
//  du template officiel), le client signe en saisissant son nom
//  complet + consentement → statut « signé » automatique.
// ══════════════════════════════════════════════════════════════

import { useState, useEffect, use } from 'react'
import { motion } from 'framer-motion'
import { FileText as FileSignature, Download, CheckCircle as CheckCircle2, ShieldCheck, CircleNotch as Loader2, WarningCircle as AlertCircle, PencilLine as PenLine, Clock } from '@phosphor-icons/react';
import { T, useTranslation } from '@/lib/translation'

interface PublicContract {
    id: string
    serial: string | null
    client_nom: string
    title: string
    amount: number
    currency: string
    status: string
    signed_at: string | null
    signed_name: string | null
    expires_at: string | null
}

export default function ContractSignPage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = use(params)
    const { t } = useTranslation()
    const [contract, setContract] = useState<PublicContract | null>(null)
    const [loading, setLoading] = useState(true)
    const [notFound, setNotFound] = useState(false)
    const [signedName, setSignedName] = useState('')
    const [consent, setConsent] = useState(false)
    const [signing, setSigning] = useState(false)
    const [error, setError] = useState('')
    const [justSigned, setJustSigned] = useState(false)

    const printUrl = `/api/contracts/print?token=${encodeURIComponent(token)}`

    useEffect(() => {
        fetch(`/api/contracts/sign?token=${encodeURIComponent(token)}`)
            .then(r => r.json())
            .then(d => {
                if (d.contract) {
                    setContract(d.contract)
                    setSignedName(d.contract.client_nom || '')
                } else setNotFound(true)
            })
            .catch(() => setNotFound(true))
            .finally(() => setLoading(false))
    }, [token])

    const handleSign = async () => {
        if (!signedName.trim() || !consent || signing) return
        setSigning(true)
        setError('')
        try {
            const res = await fetch('/api/contracts/sign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, signedName: signedName.trim(), consent: true }),
            })
            const data = await res.json()
            if (data.success) {
                setJustSigned(true)
                setContract(c => c ? { ...c, status: 'signe', signed_at: data.signedAt, signed_name: signedName.trim() } : c)
            } else {
                setError(data.error || t('La signature a échoué. Réessayez.'))
                if (data.alreadySigned) setContract(c => c ? { ...c, status: 'signe' } : c)
            }
        } catch {
            setError(t('Connexion impossible. Vérifiez votre réseau puis réessayez.'))
        }
        setSigning(false)
    }

    const isExpired = !!contract?.expires_at && new Date(contract.expires_at).getTime() < Date.now() && contract.status !== 'signe'
    const isSigned = contract?.status === 'signe'

    if (loading) {
        return (
            <div className="min-h-screen bg-[#F4F7F5] flex items-center justify-center">
                <Loader2 className="animate-spin text-emerald-600" size={32} />
            </div>
        )
    }

    if (notFound || !contract) {
        return (
            <div className="min-h-screen bg-[#F4F7F5] flex items-center justify-center px-4">
                <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center max-w-md shadow-sm">
                    <AlertCircle className="mx-auto mb-4 text-amber-500" size={40} />
                    <h1 className="text-lg font-black text-[#1B2A4A] mb-2"><T>Lien invalide ou expiré</T></h1>
                    <p className="text-sm text-gray-500 leading-relaxed"><T>Ce lien de signature n&apos;est plus valide. Contactez-nous à</T> <a href="mailto:contact@retourgagnantbenin.bj" className="text-emerald-700 font-bold">contact@retourgagnantbenin.bj</a> <T>pour recevoir un nouveau lien.</T></p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#F4F7F5] py-10 px-4">
            <div className="max-w-4xl mx-auto">
                {/* En-tête */}
                <div className="text-center mb-8">
                    <span className="inline-flex items-center gap-2 text-[10px] font-black text-emerald-700 uppercase tracking-[0.3em] bg-emerald-50 border border-emerald-200 rounded-full px-4 py-1.5 mb-4">
                        <ShieldCheck size={12} /> <T>Signature électronique sécurisée</T>
                    </span>
                    <h1 className="text-2xl md:text-3xl font-black text-[#1B2A4A]">{contract.title}</h1>
                    <p className="text-sm text-gray-500 mt-2 font-mono">{contract.serial}</p>
                </div>

                {/* Statut signé */}
                {isSigned && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 mb-6 text-center">
                        <CheckCircle2 className="mx-auto mb-3 text-emerald-600" size={36} />
                        <p className="text-base font-black text-emerald-800">
                            {justSigned ? <T>Merci ! Votre contrat est signé.</T> : <T>Ce contrat a déjà été signé.</T>}
                        </p>
                        <p className="text-sm text-emerald-700/80 mt-1">
                            {contract.signed_name} : {contract.signed_at ? new Date(contract.signed_at).toLocaleString('fr-FR') : ''}
                        </p>
                        <p className="text-xs text-gray-500 mt-3"><T>Un exemplaire signé est disponible en téléchargement ci-dessous. Notre équipe vous recontacte très vite.</T></p>
                    </motion.div>
                )}

                {isExpired && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6 flex items-center gap-3">
                        <Clock className="text-amber-600 shrink-0" size={22} />
                        <p className="text-sm text-amber-800 font-semibold"><T>Cette offre contractuelle a expiré. Contactez-nous pour recevoir une version à jour.</T></p>
                    </div>
                )}

                {/* Document A4 exact */}
                <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm mb-6">
                    <iframe src={printUrl} title={t('Contrat')} className="w-full border-0" style={{ height: '75vh' }} />
                </div>

                {/* Actions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <a href={printUrl} target="_blank" rel="noopener noreferrer"
                        className="bg-white border border-gray-200 rounded-2xl p-6 hover:border-emerald-300 transition-all group">
                        <Download className="text-emerald-600 mb-3" size={22} />
                        <p className="text-sm font-black text-[#1B2A4A] mb-1"><T>Télécharger le contrat (PDF)</T></p>
                        <p className="text-xs text-gray-500 leading-relaxed"><T>Ouvrez le document puis « Imprimer / Enregistrer en PDF ». Vous pouvez aussi le signer à la main et nous le retourner par email.</T></p>
                    </a>

                    {!isSigned && !isExpired && (
                        <div className="bg-white border border-gray-200 rounded-2xl p-6">
                            <PenLine className="text-emerald-600 mb-3" size={22} />
                            <p className="text-sm font-black text-[#1B2A4A] mb-3"><T>Signer électroniquement</T></p>
                            <input
                                type="text"
                                value={signedName}
                                onChange={e => setSignedName(e.target.value)}
                                placeholder={t('Votre nom complet (valant signature)')}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 text-sm text-[#1B2A4A] focus:outline-none focus:border-emerald-400 mb-3"
                            />
                            <label className="flex items-start gap-2.5 cursor-pointer mb-4">
                                <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}
                                    className="mt-0.5 w-4 h-4 accent-emerald-600" />
                                <span className="text-xs text-gray-600 leading-relaxed"><T>J&apos;ai lu l&apos;intégralité du contrat et j&apos;en accepte les termes. Je consens à l&apos;utilisation de la signature électronique, dont je reconnais la valeur juridique.</T></span>
                            </label>
                            {error && (
                                <p className="text-xs text-red-600 font-semibold mb-3 flex items-center gap-1.5"><AlertCircle size={13} /> {error}</p>
                            )}
                            <button
                                onClick={handleSign}
                                disabled={!signedName.trim() || !consent || signing}
                                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-sm py-3.5 rounded-xl transition-all flex items-center justify-center gap-2"
                            >
                                {signing ? <Loader2 className="animate-spin" size={16} /> : <FileSignature size={16} />}
                                {signing ? <T>Signature en cours…</T> : <T>Je signe le contrat</T>}
                            </button>
                        </div>
                    )}
                </div>

                <p className="text-center text-[11px] text-gray-400 mt-8 leading-relaxed">
                    <T>Signature horodatée et scellée par empreinte cryptographique SHA-256.</T><br />
                    RETOUR GAGNANT BÉNIN : RCCM RB/COT/26 B 42001 : IFU 3202644573981
                </p>
            </div>
        </div>
    )
}
