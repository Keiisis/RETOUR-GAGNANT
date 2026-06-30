import type { Metadata } from 'next'
import FAQClient from './FAQClient'

export const metadata: Metadata = {
    title: 'Questions Fréquentes (FAQ)',
    description: 'Trouvez les réponses à vos questions sur nos services d\'accompagnement : passeport, immobilier, création d\'entreprise, investissement au Bénin.',
    alternates: { canonical: '/faq' },
}

export default function FAQPage() {
    // JSON-LD FAQPage schema
    const faqItems = [
        {
            q: "Quels documents sont nécessaires pour obtenir un passeport béninois ?",
            a: "Il vous faut : une copie intégrale du passeport en cours de validité, un acte de naissance certifié conforme, un certificat de nationalité béninoise, une CIP A, un extrait de casier judiciaire, un justificatif de domicile, 4 photos biométriques et le formulaire officiel rempli."
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
            a: "Oui, le Bénin offre des procédures facilitées pour les afro-descendants. Notre Pack VIP inclut la constitution du dossier, la liaison avec le Ministère de la Justice et un suivi prioritaire avec référent dédié."
        },
        {
            q: "Comment se déroule un accompagnement immobilier ?",
            a: "Nous vérifions le Titre Foncier, réalisons une due diligence juridique, vous accompagnons chez le notaire et gérons les relations bailleurs-locataires. Chaque transaction est sécurisée juridiquement."
        },
        {
            q: "Quels sont vos délais de traitement ?",
            a: "Les délais varient selon le service. Un passeport standard prend généralement 2-4 semaines, le Pack VIP est traité en une journée. La création d'entreprise prend 1-2 semaines. Nous vous communiquons un délai précis lors de la consultation initiale."
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
