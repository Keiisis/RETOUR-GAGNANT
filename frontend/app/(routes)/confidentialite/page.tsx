import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Politique de Confidentialité | Retour Gagnant Bénin',
    description: 'Notre politique de confidentialité détaille la collecte, l\'utilisation et la protection de vos données personnelles.',
}

export default function ConfidentialitePage() {
    return (
        <div className="min-h-screen bg-gray-50">
            <section className="py-16 md:py-24 bg-gradient-to-b from-[#FBFDFC] to-white text-slate-900 border-b border-slate-100">
                <div className="container mx-auto px-4 text-center">
                    <h1 className="font-display text-4xl md:text-5xl font-bold mb-4 tracking-[-0.02em] text-[#008751]">Politique de Confidentialité</h1>
                    <p className="text-slate-500 max-w-xl mx-auto">Protection et traitement de vos données personnelles</p>
                </div>
            </section>

            <div className="container mx-auto px-4 py-12 md:py-16 max-w-4xl">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-10 space-y-10">

                    <section>
                        <h2 className="text-xl font-bold text-[#1a2332] mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-[#008751] rounded-full" />
                            1. Responsable du traitement
                        </h2>
                        <p className="text-gray-600 pl-4 leading-relaxed">
                            Le responsable du traitement des données personnelles collectées sur le site <strong>retourgagnantbenin.bj</strong> est Retour Gagnant Bénin, dont le siège social est situé à Haie-Vive Cocotiers, Carré n°1158, Cotonou, République du Bénin.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-[#1a2332] mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-[#FCD116] rounded-full" />
                            2. Données collectées
                        </h2>
                        <div className="text-gray-600 pl-4 space-y-3">
                            <p>Nous collectons les données suivantes :</p>
                            <ul className="list-disc pl-6 space-y-1.5">
                                <li><strong>Données d&apos;identification :</strong> nom, prénom, adresse email, numéro de téléphone/WhatsApp</li>
                                <li><strong>Données de navigation :</strong> pages visitées, durée des sessions, appareil utilisé</li>
                                <li><strong>Données de formulaire :</strong> informations fournies via nos formulaires de contact, d&apos;éligibilité et de rendez-vous</li>
                                <li><strong>Données de dossier :</strong> documents et informations nécessaires au traitement de vos demandes de services</li>
                            </ul>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-[#1a2332] mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-[#E8112D] rounded-full" />
                            3. Finalités du traitement
                        </h2>
                        <div className="text-gray-600 pl-4 space-y-3">
                            <p>Vos données sont utilisées pour :</p>
                            <ul className="list-disc pl-6 space-y-1.5">
                                <li>Traiter vos demandes de services et vous accompagner dans vos démarches</li>
                                <li>Gérer les rendez-vous et le suivi de vos dossiers</li>
                                <li>Vous envoyer des communications relatives à nos services (avec votre consentement)</li>
                                <li>Améliorer notre site et personnaliser votre expérience</li>
                                <li>Assurer la sécurité du site et prévenir les fraudes</li>
                            </ul>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-[#1a2332] mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-[#008751] rounded-full" />
                            4. Conservation des données
                        </h2>
                        <p className="text-gray-600 pl-4 leading-relaxed">
                            Vos données personnelles sont conservées pendant la durée strictement nécessaire à la réalisation des finalités mentionnées ci-dessus. Les données liées aux dossiers clients sont conservées pendant 5 ans après la clôture du dossier. Les données de navigation sont conservées pendant 13 mois maximum.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-[#1a2332] mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-[#FCD116] rounded-full" />
                            5. Partage des données
                        </h2>
                        <p className="text-gray-600 pl-4 leading-relaxed">
                            Vos données ne sont jamais vendues. Elles peuvent être communiquées, uniquement dans la stricte mesure nécessaire à la fourniture de nos services et sous obligation contractuelle de confidentialité, aux <strong>catégories de destinataires</strong> suivantes :
                        </p>
                        <ul className="list-disc pl-10 mt-3 space-y-1.5 text-gray-600 leading-relaxed">
                            <li>nos sous-traitants techniques d&apos;<strong>hébergement et d&apos;infrastructure</strong> ;</li>
                            <li>nos prestataires de <strong>traitement et de stockage des données</strong> ;</li>
                            <li>les <strong>prestataires de paiement agréés</strong>, pour les seules transactions que vous initiez ;</li>
                            <li>le cas échéant, les <strong>autorités administratives ou judiciaires</strong> compétentes, sur réquisition légale.</li>
                        </ul>
                        <p className="text-gray-600 pl-4 leading-relaxed mt-3">
                            Tous nos sous-traitants sont liés par un contrat conforme à la réglementation. Lorsque des données sont transférées hors de l&apos;Union européenne, ces transferts sont encadrés par des garanties appropriées (clauses contractuelles types ou mécanisme équivalent). La liste détaillée et nominative de nos sous-traitants est tenue à jour dans notre registre interne et peut vous être communiquée sur demande à <a href="mailto:contact@retourgagnantbenin.bj" className="text-[#008751] hover:underline">contact@retourgagnantbenin.bj</a>.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-[#1a2332] mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-[#E8112D] rounded-full" />
                            6. Cookies
                        </h2>
                        <p className="text-gray-600 pl-4 leading-relaxed">
                            Notre site n&apos;utilise actuellement que des cookies et stockages <strong>strictement nécessaires</strong> à son fonctionnement (session d&apos;authentification, préférence de langue) ; ceux-ci ne requièrent pas de consentement. <strong>Aucun traceur publicitaire ni outil de mesure d&apos;audience tiers (Google Analytics, pixels…) n&apos;est chargé.</strong> Si un outil de mesure d&apos;audience devait être ajouté à l&apos;avenir, il ne serait activé qu&apos;<strong>après votre acceptation</strong> via la bannière de consentement, que vous pouvez accepter ou refuser librement.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-[#1a2332] mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-[#008751] rounded-full" />
                            7. Vos droits
                        </h2>
                        <div className="text-gray-600 pl-4 space-y-3">
                            <p>Conformément à la réglementation applicable, vous disposez des droits suivants :</p>
                            <ul className="list-disc pl-6 space-y-1.5">
                                <li><strong>Droit d&apos;accès :</strong> obtenir une copie de vos données personnelles</li>
                                <li><strong>Droit de rectification :</strong> corriger vos données inexactes</li>
                                <li><strong>Droit de suppression :</strong> demander l&apos;effacement de vos données</li>
                                <li><strong>Droit d&apos;opposition :</strong> vous opposer au traitement de vos données</li>
                                <li><strong>Droit à la portabilité :</strong> recevoir vos données dans un format structuré</li>
                            </ul>
                            <p className="mt-3">
                                Vous pouvez exercer vous-même vos droits d&apos;accès et de suppression, en toute autonomie, depuis notre espace sécurisé <a href="/mes-donnees" className="text-[#008751] font-medium hover:underline">« Mes données »</a> (une vérification par e-mail vous est demandée).
                            </p>
                            <p className="mt-2">Vous pouvez aussi nous écrire à : <a href="mailto:contact@retourgagnantbenin.bj" className="text-[#008751] hover:underline">contact@retourgagnantbenin.bj</a></p>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-[#1a2332] mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-[#FCD116] rounded-full" />
                            8. Sécurité
                        </h2>
                        <p className="text-gray-600 pl-4 leading-relaxed">
                            Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour protéger vos données personnelles contre tout accès non autorisé, modification, divulgation ou destruction. Notre site est protégé par un pare-feu applicatif (WAF), un chiffrement SSL/TLS, et une authentification renforcée pour les accès administratifs.
                        </p>
                    </section>

                    <div className="text-center pt-6 border-t border-gray-100">
                        <p className="text-sm text-gray-400">Dernière mise à jour : Juin 2026</p>
                    </div>
                </div>
            </div>
        </div>
    )
}
