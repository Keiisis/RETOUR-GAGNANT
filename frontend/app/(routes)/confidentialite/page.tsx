import type { Metadata } from 'next'
import { T } from '@/lib/translation'

export const metadata: Metadata = {
    title: 'Politique de Confidentialité | Retour Gagnant Bénin',
    description: 'Notre politique de confidentialité détaille la collecte, l\'utilisation et la protection de vos données personnelles.',
}

export default function ConfidentialitePage() {
    return (
        <div className="min-h-screen bg-gray-50">
            <section className="py-16 md:py-24 bg-gradient-to-b from-[#FBFDFC] to-white text-slate-900 border-b border-slate-100">
                <div className="container mx-auto px-4 text-center">
                    <h1 className="font-display text-4xl md:text-5xl font-bold mb-4 tracking-[-0.02em] text-[#008751]"><T>Politique de Confidentialité</T></h1>
                    <p className="text-slate-500 max-w-xl mx-auto"><T>Protection et traitement de vos données personnelles</T></p>
                </div>
            </section>

            <div className="container mx-auto px-4 py-12 md:py-16 max-w-4xl">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-10 space-y-10">

                    <section>
                        <h2 className="text-xl font-bold text-[#1a2332] mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-[#008751] rounded-full" />
                            <T>1. Responsable du traitement</T>
                        </h2>
                        <p className="text-gray-600 pl-4 leading-relaxed">
                            <T>Le responsable du traitement des données personnelles collectées sur le site</T> <strong>retourgagnantbenin.bj</strong> <T>est Retour Gagnant Bénin, dont le siège social est situé à</T> Haie-Vive Cocotiers, Carré n°1158, Cotonou, <T>République du Bénin.</T>
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-[#1a2332] mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-[#FCD116] rounded-full" />
                            <T>2. Données collectées</T>
                        </h2>
                        <div className="text-gray-600 pl-4 space-y-3">
                            <p><T>Nous collectons les données suivantes :</T></p>
                            <ul className="list-disc pl-6 space-y-1.5">
                                <li><strong><T>Données d&apos;identification :</T></strong> <T>nom, prénom, adresse email, numéro de téléphone/WhatsApp</T></li>
                                <li><strong><T>Données de navigation :</T></strong> <T>pages visitées, durée des sessions, appareil utilisé</T></li>
                                <li><strong><T>Données de formulaire :</T></strong> <T>informations fournies via nos formulaires de contact, d&apos;éligibilité et de rendez-vous</T></li>
                                <li><strong><T>Données de dossier :</T></strong> <T>documents et informations nécessaires au traitement de vos demandes de services</T></li>
                            </ul>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-[#1a2332] mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-[#E8112D] rounded-full" />
                            <T>3. Finalités du traitement</T>
                        </h2>
                        <div className="text-gray-600 pl-4 space-y-3">
                            <p><T>Vos données sont utilisées pour :</T></p>
                            <ul className="list-disc pl-6 space-y-1.5">
                                <li><T>Traiter vos demandes de services et vous accompagner dans vos démarches</T></li>
                                <li><T>Gérer les rendez-vous et le suivi de vos dossiers</T></li>
                                <li><T>Vous envoyer des communications relatives à nos services (avec votre consentement)</T></li>
                                <li><T>Améliorer notre site et personnaliser votre expérience</T></li>
                                <li><T>Assurer la sécurité du site et prévenir les fraudes</T></li>
                            </ul>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-[#1a2332] mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-[#008751] rounded-full" />
                            <T>4. Conservation des données</T>
                        </h2>
                        <p className="text-gray-600 pl-4 leading-relaxed">
                            <T>Vos données personnelles sont conservées pendant la durée strictement nécessaire à la réalisation des finalités mentionnées ci-dessus. Les données liées aux dossiers clients sont conservées pendant 5 ans après la clôture du dossier. Les données de navigation sont conservées pendant 13 mois maximum.</T>
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-[#1a2332] mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-[#FCD116] rounded-full" />
                            <T>5. Partage des données</T>
                        </h2>
                        <p className="text-gray-600 pl-4 leading-relaxed">
                            <T>Vos données ne sont jamais vendues. Elles peuvent être communiquées, uniquement dans la stricte mesure nécessaire à la fourniture de nos services et sous obligation contractuelle de confidentialité, aux</T> <strong><T>catégories de destinataires</T></strong> <T>suivantes :</T>
                        </p>
                        <ul className="list-disc pl-10 mt-3 space-y-1.5 text-gray-600 leading-relaxed">
                            <li><T>nos sous-traitants techniques d&apos;</T><strong><T>hébergement et d&apos;infrastructure</T></strong> ;</li>
                            <li><T>nos prestataires de</T> <strong><T>traitement et de stockage des données</T></strong> ;</li>
                            <li><T>les</T> <strong><T>prestataires de paiement agréés</T></strong><T>, pour les seules transactions que vous initiez ;</T></li>
                            <li><T>le cas échéant, les</T> <strong><T>autorités administratives ou judiciaires</T></strong> <T>compétentes, sur réquisition légale.</T></li>
                        </ul>
                        <p className="text-gray-600 pl-4 leading-relaxed mt-3">
                            <T>Tous nos sous-traitants sont liés par un contrat conforme à la réglementation. Lorsque des données sont transférées hors de l&apos;Union européenne, ces transferts sont encadrés par des garanties appropriées (clauses contractuelles types ou mécanisme équivalent). La liste détaillée et nominative de nos sous-traitants est tenue à jour dans notre registre interne et peut vous être communiquée sur demande à</T> <a href="mailto:contact@retourgagnantbenin.bj" className="text-[#008751] hover:underline">contact@retourgagnantbenin.bj</a>.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-[#1a2332] mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-[#E8112D] rounded-full" />
                            <T>6. Cookies</T>
                        </h2>
                        <p className="text-gray-600 pl-4 leading-relaxed">
                            <T>Notre site n&apos;utilise actuellement que des cookies et stockages</T> <strong><T>strictement nécessaires</T></strong> <T>à son fonctionnement (session d&apos;authentification, préférence de langue) ; ceux-ci ne requièrent pas de consentement.</T> <strong><T>Aucun traceur publicitaire ni outil de mesure d&apos;audience tiers (Google Analytics, pixels…) n&apos;est chargé.</T></strong> <T>Si un outil de mesure d&apos;audience devait être ajouté à l&apos;avenir, il ne serait activé qu&apos;</T><strong><T>après votre acceptation</T></strong> <T>via la bannière de consentement, que vous pouvez accepter ou refuser librement.</T>
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-[#1a2332] mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-[#008751] rounded-full" />
                            <T>7. Vos droits</T>
                        </h2>
                        <div className="text-gray-600 pl-4 space-y-3">
                            <p><T>Conformément à la réglementation applicable, vous disposez des droits suivants :</T></p>
                            <ul className="list-disc pl-6 space-y-1.5">
                                <li><strong><T>Droit d&apos;accès :</T></strong> <T>obtenir une copie de vos données personnelles</T></li>
                                <li><strong><T>Droit de rectification :</T></strong> <T>corriger vos données inexactes</T></li>
                                <li><strong><T>Droit de suppression :</T></strong> <T>demander l&apos;effacement de vos données</T></li>
                                <li><strong><T>Droit d&apos;opposition :</T></strong> <T>vous opposer au traitement de vos données</T></li>
                                <li><strong><T>Droit à la portabilité :</T></strong> <T>recevoir vos données dans un format structuré</T></li>
                            </ul>
                            <p className="mt-3">
                                <T>Vous pouvez exercer vous-même vos droits d&apos;accès et de suppression, en toute autonomie, depuis notre espace sécurisé</T> <a href="/mes-donnees" className="text-[#008751] font-medium hover:underline"><T>« Mes données »</T></a> <T>(une vérification par e-mail vous est demandée).</T>
                            </p>
                            <p className="mt-2"><T>Vous pouvez aussi nous écrire à :</T> <a href="mailto:contact@retourgagnantbenin.bj" className="text-[#008751] hover:underline">contact@retourgagnantbenin.bj</a></p>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-[#1a2332] mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-[#FCD116] rounded-full" />
                            <T>8. Sécurité</T>
                        </h2>
                        <p className="text-gray-600 pl-4 leading-relaxed">
                            <T>Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour protéger vos données personnelles contre tout accès non autorisé, modification, divulgation ou destruction. Notre site est protégé par un pare-feu applicatif (WAF), un chiffrement SSL/TLS, et une authentification renforcée pour les accès administratifs.</T>
                        </p>
                    </section>

                    <div className="text-center pt-6 border-t border-gray-100">
                        <p className="text-sm text-gray-400"><T>Dernière mise à jour : Juin 2026</T></p>
                    </div>
                </div>
            </div>
        </div>
    )
}
