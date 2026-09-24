'use client'

/**
 * Reprise d'un dossier MyAfroOrigins — page ouverte par le lien que l'équipe
 * envoie (invitation par email ou lien copié depuis l'onglet « Dossiers
 * MyAfroOrigins »).
 *
 * Ces clients ont DÉJÀ leur dossier chez MyAfroOrigins : on le vérifie, on ne
 * le refait pas. D'où le formulaire du récap, et non celui de la demande de
 * nationalité — avec, en plus, la possibilité de joindre toutes les pièces de
 * ce dossier, aucune n'étant obligatoire.
 *
 * Le lien est lu par le SERVEUR : lui seul sait si le jeton est authentique
 * et si les frais sont déjà réglés.
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ShieldCheck, AlertCircle } from 'lucide-react'
import RecapMyafroForm, { type RepriseInfo } from '@/components/services/RecapMyafroForm'
import { useTranslation } from '@/lib/translation'

type Etat =
    | { phase: 'lecture' }
    | { phase: 'erreur'; message: string }
    | { phase: 'pret'; info: RepriseInfo; dejaUtilise: boolean }

export default function RepriseMyafroPage() {
    const { t } = useTranslation()
    const [etat, setEtat] = useState<Etat>({ phase: 'lecture' })

    useEffect(() => {
        const token = new URLSearchParams(window.location.search).get('t') || ''
        ;(async () => {
            if (!token) {
                setEtat({ phase: 'erreur', message: t('Ce lien est incomplet. Ouvrez-le directement depuis le message reçu.') })
                return
            }
            try {
                const res = await fetch(`/api/services/recap-myafroorigins/reprise?t=${encodeURIComponent(token)}`)
                const json = await res.json().catch(() => ({}))
                if (!res.ok || !json.valide) {
                    setEtat({ phase: 'erreur', message: json.error || t('Ce lien n’est plus valide.') })
                    return
                }
                setEtat({
                    phase: 'pret',
                    dejaUtilise: !!json.deja_utilise,
                    info: {
                        token,
                        prepaye: !!json.prepaye,
                        factureNumero: json.facture?.numero || null,
                        email: json.email || null,
                        nom: json.nom || null,
                    },
                })
            } catch {
                setEtat({ phase: 'erreur', message: t('Connexion impossible. Vérifiez votre réseau et rechargez la page.') })
            }
        })()
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <main className="min-h-screen bg-[#fdfbf7]">
            <header className="max-w-3xl mx-auto px-5 md:px-8 pt-28 md:pt-32">
                <p className="text-[11px] font-black uppercase tracking-[0.15em] text-[#008751] mb-3">
                    {t('Reprise de dossier MyAfroOrigins')}
                </p>
                <h1 className="font-display text-4xl md:text-5xl font-bold text-[#1c1917] leading-tight">
                    {t('Nous vérifions votre dossier')}
                </h1>
                <p className="mt-4 text-[#57534e] leading-relaxed max-w-2xl">
                    {t('Votre demande existe déjà sur MyAfroOrigins. Dites-nous où elle en est et joignez les pièces que vous avez : nous contrôlons votre dossier et vous remettons une fiche d’analyse.')}
                </p>
            </header>

            {etat.phase === 'lecture' && (
                <div className="flex items-center justify-center gap-3 py-24 text-[#008751] font-bold text-sm">
                    <span className="w-4 h-4 border-2 border-[#008751]/30 border-t-[#008751] rounded-full animate-spin" />
                    {t('Vérification de votre lien…')}
                </div>
            )}

            {etat.phase === 'erreur' && (
                <section className="max-w-3xl mx-auto px-5 md:px-8 py-12">
                    <div className="bg-white border border-[#E8112D]/25 rounded-3xl p-8 text-center">
                        <AlertCircle size={28} className="text-[#E8112D] mx-auto mb-4" />
                        <p className="text-[#1c1917] font-semibold">{etat.message}</p>
                        <Link href="/contact" className="inline-block mt-6 text-sm font-bold text-[#008751] underline underline-offset-4">
                            {t('Contacter l’équipe')}
                        </Link>
                    </div>
                </section>
            )}

            {etat.phase === 'pret' && (
                <>
                    {etat.dejaUtilise && (
                        <div className="max-w-3xl mx-auto px-5 md:px-8 pt-8">
                            <p className="flex items-start gap-2 text-[12.5px] text-[#57534e] bg-white border border-[#e7e1d8] rounded-xl px-4 py-3">
                                <ShieldCheck size={15} className="text-[#008751] shrink-0 mt-0.5" />
                                {t('Une demande a déjà été envoyée avec ce lien. Renvoyez-la avec la même adresse email pour retrouver votre référence et ajouter des pièces.')}
                            </p>
                        </div>
                    )}
                    <RecapMyafroForm reprise={etat.info} />
                </>
            )}
        </main>
    )
}
