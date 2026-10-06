import type { Metadata } from 'next'
import { T } from '@/lib/translation'

export const metadata: Metadata = {
    title: 'Conditions Générales de Vente | Retour Gagnant Bénin',
    description: 'Conditions générales de vente et de prestation de services de Retour Gagnant Bénin.',
}

export default function ConditionsGeneralesPage() {
    return (
        <div className="min-h-screen bg-gray-50">
            <section className="py-16 md:py-24 bg-gradient-to-b from-[#FBFDFC] to-white text-slate-900 border-b border-slate-100">
                <div className="container mx-auto px-4 text-center">
                    <h1 className="font-display text-4xl md:text-5xl font-bold mb-4 tracking-[-0.02em] text-[#008751]"><T>Conditions Générales</T></h1>
                    <p className="text-slate-500 max-w-xl mx-auto"><T>Conditions de vente et de prestation de nos services</T></p>
                </div>
            </section>

            <div className="container mx-auto px-4 py-12 md:py-16 max-w-4xl">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-10 space-y-10">

                    <section>
                        <h2 className="text-xl font-bold text-[#1a2332] mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-[#008751] rounded-full" />
                            <T>1. Objet</T>
                        </h2>
                        <p className="text-gray-600 pl-4 leading-relaxed">
                            <T>Les présentes conditions générales de vente (CGV) régissent les relations contractuelles entre Retour Gagnant Bénin et tout client (ci-après &quot;le Client&quot;) ayant recours à ses services d&apos;accompagnement administratif, immobilier, business, culturel et tout autre service proposé sur le site retourgagnantbenin.bj.</T>
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-[#1a2332] mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-[#FCD116] rounded-full" />
                            <T>2. Services proposés</T>
                        </h2>
                        <div className="text-gray-600 pl-4 space-y-3">
                            <p><T>Retour Gagnant Bénin propose les services suivants :</T></p>
                            <ul className="list-disc pl-6 space-y-1.5">
                                <li><T>Accompagnement Passeport &amp; Documents administratifs</T></li>
                                <li><T>Accompagnement Immobilier (achat, location, sécurisation foncière)</T></li>
                                <li><T>Création et immatriculation d&apos;entreprise</T></li>
                                <li><T>Guide culturel et tourisme patrimonial</T></li>
                                <li><T>Suivi de chantier de construction</T></li>
                                <li><T>Conseil en investissement</T></li>
                                <li><T>Recherche ancestrale et généalogie</T></li>
                                <li><T>Accompagnement à la nationalité béninoise</T></li>
                                <li><T>Vente de produits artisanaux (boutique en ligne)</T></li>
                            </ul>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-[#1a2332] mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-[#E8112D] rounded-full" />
                            <T>3. Tarifs et paiement</T>
                        </h2>
                        <div className="text-gray-600 pl-4 space-y-3">
                            <p><T>Les tarifs sont indiqués en FCFA (XOF) ou en EUR selon le service. Ils sont susceptibles de modification sans préavis, les tarifs applicables étant ceux en vigueur au moment de la commande.</T></p>
                            <p><T>Le paiement peut être effectué par :</T></p>
                            <ul className="list-disc pl-6 space-y-1.5">
                                <li><T>Virement bancaire</T></li>
                                <li><T>Mobile Money (MTN, Moov)</T></li>
                                <li><T>Paiement en ligne sécurisé</T></li>
                            </ul>
                            <p><T>Un acompte de 50% peut être demandé à la commande pour certains services. Le solde est dû à la livraison ou à l&apos;achèvement du service.</T></p>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-[#1a2332] mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-[#008751] rounded-full" />
                            <T>4. Délais d&apos;exécution</T>
                        </h2>
                        <p className="text-gray-600 pl-4 leading-relaxed">
                            <T>Les délais d&apos;exécution sont donnés à titre indicatif et varient selon la nature du service et les contraintes administratives locales. Retour Gagnant Bénin s&apos;engage à informer le Client de tout retard significatif. Les délais liés aux administrations béninoises ne relèvent pas de la responsabilité de Retour Gagnant Bénin.</T>
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-[#1a2332] mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-[#FCD116] rounded-full" />
                            <T>5. Annulation et remboursement</T>
                        </h2>
                        <div className="text-gray-600 pl-4 space-y-3">
                            <p><T>Le Client peut annuler sa commande dans les conditions suivantes :</T></p>
                            <ul className="list-disc pl-6 space-y-1.5">
                                <li><strong><T>Avant démarrage :</T></strong> <T>remboursement intégral sous 14 jours</T></li>
                                <li><strong><T>Après démarrage :</T></strong> <T>les frais engagés sont non-remboursables. Le solde peut être remboursé au prorata des prestations non réalisées</T></li>
                                <li><strong><T>Boutique :</T></strong> <T>retour possible sous 14 jours après réception, frais de retour à la charge du Client</T></li>
                            </ul>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-[#1a2332] mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-[#E8112D] rounded-full" />
                            <T>6. Obligations du Client</T>
                        </h2>
                        <p className="text-gray-600 pl-4 leading-relaxed">
                            <T>Le Client s&apos;engage à fournir des informations exactes et complètes, à transmettre les documents nécessaires dans les délais convenus, et à coopérer de bonne foi avec l&apos;équipe Retour Gagnant Bénin. Tout retard dans la fourniture des documents peut entraîner un retard dans l&apos;exécution du service.</T>
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-[#1a2332] mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-[#008751] rounded-full" />
                            <T>7. Litiges</T>
                        </h2>
                        <p className="text-gray-600 pl-4 leading-relaxed">
                            <T>En cas de litige, les parties s&apos;engagent à rechercher une solution amiable avant toute action judiciaire. À défaut d&apos;accord amiable, le litige sera soumis aux tribunaux compétents de Cotonou, République du Bénin.</T>
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
