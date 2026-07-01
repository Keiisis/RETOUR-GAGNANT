import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Mentions Légales | Retour Gagnant Bénin',
    description: 'Mentions légales du site Retour Gagnant Bénin — informations sur l\'éditeur, l\'hébergeur et les conditions d\'utilisation.',
}

export default function MentionsLegalesPage() {
    return (
        <div className="min-h-screen bg-gray-50">
            <section className="py-16 md:py-24 bg-gradient-to-br from-[#0f141e] via-[#1a2a3a] to-[#0f141e] text-white">
                <div className="container mx-auto px-4 text-center">
                    <h1 className="text-3xl md:text-5xl font-bold font-heading mb-4">Mentions Légales</h1>
                    <p className="text-white/60 max-w-xl mx-auto">Informations légales relatives au site retourgagnantbenin.bj</p>
                </div>
            </section>

            <div className="container mx-auto px-4 py-12 md:py-16 max-w-4xl">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-10 space-y-10">

                    <section>
                        <h2 className="text-xl font-bold text-[#1a2332] mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-[#008751] rounded-full" />
                            1. Éditeur du site
                        </h2>
                        <div className="text-gray-600 space-y-2 pl-4">
                            <p><strong>Raison sociale :</strong> Retour Gagnant Bénin</p>
                            <p><strong>Siège social :</strong> Haie-Vive Cocotiers, Carré n°1158, Cotonou, République du Bénin</p>
                            <p><strong>Email :</strong> contact@retourgagnantbenin.bj</p>
                            <p><strong>Téléphone :</strong> +229 01 60 32 21 21 / +229 01 94 35 50 50</p>
                            <p><strong>Directeur de la publication :</strong> La direction de Retour Gagnant Bénin</p>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-[#1a2332] mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-[#FCD116] rounded-full" />
                            2. Hébergeur
                        </h2>
                        <div className="text-gray-600 space-y-2 pl-4">
                            <p>Le site est hébergé sur une infrastructure cloud sécurisée et certifiée. L&apos;identité et les coordonnées complètes de l&apos;hébergeur sont disponibles sur simple demande à <a href="mailto:contact@retourgagnantbenin.bj" className="text-[#008751] hover:underline">contact@retourgagnantbenin.bj</a>.</p>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-[#1a2332] mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-[#E8112D] rounded-full" />
                            3. Propriété intellectuelle
                        </h2>
                        <p className="text-gray-600 pl-4 leading-relaxed">
                            L&apos;ensemble du contenu du site (textes, images, logos, graphismes, icônes, vidéos, sons, logiciels) est la propriété exclusive de Retour Gagnant Bénin ou de ses partenaires. Toute reproduction, représentation, modification, publication, adaptation de tout ou partie des éléments du site, quel que soit le moyen ou le procédé utilisé, est interdite sans autorisation écrite préalable.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-[#1a2332] mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-[#008751] rounded-full" />
                            4. Limitation de responsabilité
                        </h2>
                        <p className="text-gray-600 pl-4 leading-relaxed">
                            Retour Gagnant Bénin s&apos;efforce d&apos;assurer au mieux l&apos;exactitude et la mise à jour des informations diffusées sur ce site, dont il se réserve le droit de modifier le contenu à tout moment. Toutefois, Retour Gagnant Bénin ne peut garantir l&apos;exactitude, la précision ou l&apos;exhaustivité des informations mises à disposition sur ce site. En conséquence, l&apos;utilisateur reconnaît utiliser ces informations sous sa responsabilité exclusive.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-[#1a2332] mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-[#FCD116] rounded-full" />
                            5. Liens hypertextes
                        </h2>
                        <p className="text-gray-600 pl-4 leading-relaxed">
                            Le site peut contenir des liens hypertextes vers d&apos;autres sites présents sur le réseau Internet. Les liens vers ces autres ressources ne constituent pas une recommandation de Retour Gagnant Bénin. Retour Gagnant Bénin n&apos;est pas responsable du contenu des sites tiers.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-[#1a2332] mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-[#E8112D] rounded-full" />
                            6. Droit applicable
                        </h2>
                        <p className="text-gray-600 pl-4 leading-relaxed">
                            Le présent site et ses mentions légales sont régis par le droit béninois. En cas de litige, et après tentative de recherche d&apos;une solution amiable, compétence est attribuée aux tribunaux compétents de Cotonou, République du Bénin.
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
