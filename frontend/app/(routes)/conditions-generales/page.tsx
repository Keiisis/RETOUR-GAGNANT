import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Conditions Générales de Vente | Retour Gagnant Bénin',
    description: 'Conditions générales de vente et de prestation de services de Retour Gagnant Bénin.',
}

export default function ConditionsGeneralesPage() {
    return (
        <div className="min-h-screen bg-gray-50">
            <section className="py-16 md:py-24 bg-gradient-to-b from-[#FBFDFC] to-white text-slate-900 border-b border-slate-100">
                <div className="container mx-auto px-4 text-center">
                    <h1 className="font-display text-4xl md:text-5xl font-bold mb-4 tracking-[-0.02em] text-[#008751]">Conditions Générales</h1>
                    <p className="text-slate-500 max-w-xl mx-auto">Conditions de vente et de prestation de nos services</p>
                </div>
            </section>

            <div className="container mx-auto px-4 py-12 md:py-16 max-w-4xl">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-10 space-y-10">

                    <section>
                        <h2 className="text-xl font-bold text-[#1a2332] mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-[#008751] rounded-full" />
                            1. Objet
                        </h2>
                        <p className="text-gray-600 pl-4 leading-relaxed">
                            Les présentes conditions générales de vente (CGV) régissent les relations contractuelles entre Retour Gagnant Bénin et tout client (ci-après &quot;le Client&quot;) ayant recours à ses services d&apos;accompagnement administratif, immobilier, business, culturel et tout autre service proposé sur le site retourgagnantbenin.bj.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-[#1a2332] mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-[#FCD116] rounded-full" />
                            2. Services proposés
                        </h2>
                        <div className="text-gray-600 pl-4 space-y-3">
                            <p>Retour Gagnant Bénin propose les services suivants :</p>
                            <ul className="list-disc pl-6 space-y-1.5">
                                <li>Accompagnement Passeport &amp; Documents administratifs</li>
                                <li>Accompagnement Immobilier (achat, location, sécurisation foncière)</li>
                                <li>Création et immatriculation d&apos;entreprise</li>
                                <li>Guide culturel et tourisme patrimonial</li>
                                <li>Suivi de chantier de construction</li>
                                <li>Conseil en investissement</li>
                                <li>Recherche ancestrale et généalogie</li>
                                <li>Accompagnement nationalité VIP</li>
                                <li>Vente de produits artisanaux (boutique en ligne)</li>
                            </ul>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-[#1a2332] mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-[#E8112D] rounded-full" />
                            3. Tarifs et paiement
                        </h2>
                        <div className="text-gray-600 pl-4 space-y-3">
                            <p>Les tarifs sont indiqués en FCFA (XOF) ou en EUR selon le service. Ils sont susceptibles de modification sans préavis, les tarifs applicables étant ceux en vigueur au moment de la commande.</p>
                            <p>Le paiement peut être effectué par :</p>
                            <ul className="list-disc pl-6 space-y-1.5">
                                <li>Virement bancaire</li>
                                <li>Mobile Money (MTN, Moov)</li>
                                <li>Paiement en ligne sécurisé</li>
                            </ul>
                            <p>Un acompte de 50% peut être demandé à la commande pour certains services. Le solde est dû à la livraison ou à l&apos;achèvement du service.</p>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-[#1a2332] mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-[#008751] rounded-full" />
                            4. Délais d&apos;exécution
                        </h2>
                        <p className="text-gray-600 pl-4 leading-relaxed">
                            Les délais d&apos;exécution sont donnés à titre indicatif et varient selon la nature du service et les contraintes administratives locales. Retour Gagnant Bénin s&apos;engage à informer le Client de tout retard significatif. Les délais liés aux administrations béninoises ne relèvent pas de la responsabilité de Retour Gagnant Bénin.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-[#1a2332] mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-[#FCD116] rounded-full" />
                            5. Annulation et remboursement
                        </h2>
                        <div className="text-gray-600 pl-4 space-y-3">
                            <p>Le Client peut annuler sa commande dans les conditions suivantes :</p>
                            <ul className="list-disc pl-6 space-y-1.5">
                                <li><strong>Avant démarrage :</strong> remboursement intégral sous 14 jours</li>
                                <li><strong>Après démarrage :</strong> les frais engagés sont non-remboursables. Le solde peut être remboursé au prorata des prestations non réalisées</li>
                                <li><strong>Boutique :</strong> retour possible sous 14 jours après réception, frais de retour à la charge du Client</li>
                            </ul>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-[#1a2332] mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-[#E8112D] rounded-full" />
                            6. Obligations du Client
                        </h2>
                        <p className="text-gray-600 pl-4 leading-relaxed">
                            Le Client s&apos;engage à fournir des informations exactes et complètes, à transmettre les documents nécessaires dans les délais convenus, et à coopérer de bonne foi avec l&apos;équipe Retour Gagnant Bénin. Tout retard dans la fourniture des documents peut entraîner un retard dans l&apos;exécution du service.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-[#1a2332] mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-[#008751] rounded-full" />
                            7. Litiges
                        </h2>
                        <p className="text-gray-600 pl-4 leading-relaxed">
                            En cas de litige, les parties s&apos;engagent à rechercher une solution amiable avant toute action judiciaire. À défaut d&apos;accord amiable, le litige sera soumis aux tribunaux compétents de Cotonou, République du Bénin.
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
