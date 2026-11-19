import type { Metadata } from 'next'
import FAQClient from './FAQClient'

export const metadata: Metadata = {
    title: 'Questions Fréquentes (FAQ)',
    description: 'Trouvez les réponses à vos questions sur nos services d\'accompagnement : nationalité béninoise, immobilier, création d\'entreprise, investissement au Bénin.',
    alternates: { canonical: '/faq' },
}

export default function FAQPage() {
    // JSON-LD FAQPage schema
    const faqItems = [
        {
            q: "Comment obtenir un passeport béninois ?",
            a: "Le passeport est inclus dans la demande de nationalité et il est gratuit. L'État le remet directement lors de la cérémonie officielle de remise, au terme de la procédure : aucune démarche ni aucun frais séparés."
        },
        {
            q: "Combien coûte la création d'une entreprise au Bénin ?",
            a: "La création d'une SARL commence à 150 000 FCFA, une SA à 250 000 FCFA. Un accompagnement complet est disponible sur devis selon la complexité de votre projet."
        },
        {
            q: "Comment fonctionne le suivi de chantier à distance ?",
            a: "Nous assurons des visites régulières sur votre chantier avec des rapports WhatsApp hebdomadaires (photos et vidéos). Nous vérifions les factures, négocions les matériaux et coordonnons les intervenants."
        },
        {
            q: "Puis-je obtenir la nationalité béninoise en tant qu'afro-descendant ?",
            a: "Oui, le Bénin offre des procédures facilitées pour les afro-descendants. La demande est gratuite, tout comme notre accompagnement complet : Retour Gagnant Bénin est une agence agréée. Nous constituons le dossier, assurons la liaison avec le Ministère de la Justice et le suivi jusqu'à la cérémonie officielle de remise."
        },
        {
            q: "Comment se déroule un accompagnement immobilier ?",
            a: "Nous vérifions le Titre Foncier, réalisons une due diligence juridique, vous accompagnons chez le notaire et gérons les relations bailleurs-locataires. Chaque transaction est sécurisée juridiquement."
        },
        {
            q: "Quels sont vos délais de traitement ?",
            a: "Les délais varient selon le service. Pour la nationalité, ils dépendent du dossier et de l'administration. La création d'entreprise prend 1-2 semaines. Nous vous communiquons un délai précis lors de la consultation initiale."
        },
        {
            q: "La première consultation est-elle gratuite ?",
            a: "Oui, nous offrons un premier appel de 15 minutes gratuit pour évaluer votre projet et vous orienter vers les services adaptés. Réservez votre créneau via notre page Rendez-vous."
        },
        {
            q: "Comment puis-je suivre l'avancement de mon dossier ?",
            a: "Chaque client dispose d'un espace personnel sécurisé pour suivre l'état de son dossier en temps réel. Vous pouvez aussi accéder au suivi via notre page dédiée avec votre numéro de dossier et email."
        },
    ]

    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": faqItems.map(item => ({
            "@type": "Question",
            "name": item.q,
            "acceptedAnswer": {
                "@type": "Answer",
                "text": item.a,
            }
        }))
    }

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <FAQClient items={faqItems} />
        </>
    )
}
