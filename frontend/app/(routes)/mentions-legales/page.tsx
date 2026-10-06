import type { Metadata } from 'next'
import { T } from '@/lib/translation'

export const metadata: Metadata = {
    title: 'Mentions Légales | Retour Gagnant Bénin',
    description: 'Mentions légales du site Retour Gagnant Bénin : informations sur l\'éditeur, l\'hébergeur et les conditions d\'utilisation.',
}

export default function MentionsLegalesPage() {
    return (
        <div className="min-h-screen bg-gray-50">
            <section className="py-16 md:py-24 bg-gradient-to-b from-[#FBFDFC] to-white text-slate-900 border-b border-slate-100">
                <div className="container mx-auto px-4 text-center">
                    <h1 className="font-display text-4xl md:text-5xl font-bold mb-4 tracking-[-0.02em] text-[#008751]"><T>Mentions Légales</T></h1>
                    <p className="text-slate-500 max-w-xl mx-auto"><T>Informations légales relatives au site retourgagnantbenin.bj</T></p>
                </div>
            </section>

            <div className="container mx-auto px-4 py-12 md:py-16 max-w-4xl">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-10 space-y-10">

                    <section>
                        <h2 className="text-xl font-bold text-[#1a2332] mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-[#008751] rounded-full" />
                            <T>1. Éditeur du site</T>
                        </h2>
                        <div className="text-gray-600 space-y-2 pl-4">
                            <p><strong><T>Raison sociale :</T></strong> Retour Gagnant Bénin</p>
                            <p><strong><T>Siège social :</T></strong> Haie-Vive Cocotiers, Carré n°1158, Cotonou, République du Bénin</p>
                            <p><strong><T>Email :</T></strong> contact@retourgagnantbenin.bj</p>
                            <p><strong><T>Téléphone :</T></strong> +229 01 60 32 21 21 / +229 01 94 35 50 50</p>
                            <p><strong><T>Directeur de la publication :</T></strong> <T>La direction de Retour Gagnant Bénin</T></p>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-[#1a2332] mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-[#FCD116] rounded-full" />
                            <T>2. Hébergeur</T>
                        </h2>
                        <div className="text-gray-600 space-y-2 pl-4">
                            <p><T>Le site est hébergé sur une infrastructure cloud sécurisée et certifiée. L&apos;identité et les coordonnées complètes de l&apos;hébergeur sont disponibles sur simple demande à</T> <a href="mailto:contact@retourgagnantbenin.bj" className="text-[#008751] hover:underline">contact@retourgagnantbenin.bj</a>.</p>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-[#1a2332] mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-[#E8112D] rounded-full" />
                            <T>3. Propriété intellectuelle</T>
                        </h2>
                        <p className="text-gray-600 pl-4 leading-relaxed">
                            <T>L&apos;ensemble du contenu du site (textes, images, logos, graphismes, icônes, vidéos, sons, logiciels) est la propriété exclusive de Retour Gagnant Bénin ou de ses partenaires. Toute reproduction, représentation, modification, publication, adaptation de tout ou partie des éléments du site, quel que soit le moyen ou le procédé utilisé, est interdite sans autorisation écrite préalable.</T>
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-[#1a2332] mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-[#008751] rounded-full" />
                            <T>4. Limitation de responsabilité</T>
                        </h2>
                        <p className="text-gray-600 pl-4 leading-relaxed">
                            <T>Retour Gagnant Bénin s&apos;efforce d&apos;assurer au mieux l&apos;exactitude et la mise à jour des informations diffusées sur ce site, dont il se réserve le droit de modifier le contenu à tout moment. Toutefois, Retour Gagnant Bénin ne peut garantir l&apos;exactitude, la précision ou l&apos;exhaustivité des informations mises à disposition sur ce site. En conséquence, l&apos;utilisateur reconnaît utiliser ces informations sous sa responsabilité exclusive.</T>
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-[#1a2332] mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-[#FCD116] rounded-full" />
                            <T>5. Liens hypertextes</T>
                        </h2>
                        <p className="text-gray-600 pl-4 leading-relaxed">
                            <T>Le site peut contenir des liens hypertextes vers d&apos;autres sites présents sur le réseau Internet. Les liens vers ces autres ressources ne constituent pas une recommandation de Retour Gagnant Bénin. Retour Gagnant Bénin n&apos;est pas responsable du contenu des sites tiers.</T>
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-[#1a2332] mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-[#E8112D] rounded-full" />
                            <T>6. Droit applicable</T>
                        </h2>
                        <p className="text-gray-600 pl-4 leading-relaxed">
                            <T>Le présent site et ses mentions légales sont régis par le droit béninois. En cas de litige, et après tentative de recherche d&apos;une solution amiable, compétence est attribuée aux tribunaux compétents de Cotonou, République du Bénin.</T>
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
