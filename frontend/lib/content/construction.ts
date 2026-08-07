import type { ServiceLandingContent } from './serviceLanding'

export const DEFAULT_CONSTRUCTION: ServiceLandingContent = {
    hero_badge: "Suivi de chantier & maîtrise d'ouvrage",
    hero_title: "Construisez au Bénin, sans y être — sous l'œil d'un représentant de confiance",
    hero_subtitle: "Devis approximatifs, délais non tenus, matériaux de qualité variable : les risques sont réels. Nous sommes votre représentant exigeant, présent à chaque étape du chantier.",
    hero_chips: ["Représentant sur place", "Rapports hebdo photos/vidéos", "Contrôle qualité", "Devis maîtrisés"],
    hero_image: "/assets/icones/icone_Construction.png",
    cta1_label: "Prendre rendez-vous",
    cta1_href: "/rendez-vous?service=construction",
    cta2_label: "Nous contacter",
    cta2_href: "/contact",

    piliers: [
        { title: "Votre représentant", desc: "Présent physiquement sur le chantier" },
        { title: "Transparence totale", desc: "Rapports WhatsApp chaque semaine" },
        { title: "Qualité contrôlée", desc: "Matériaux et travaux vérifiés" },
        { title: "Budget maîtrisé", desc: "Factures fournisseurs validées" },
    ],

    intro_eyebrow: "Notre métier",
    intro_title: "Notre accompagnement",
    intro_text: "Construire au Bénin depuis l'étranger, c'est possible — à condition d'être bien entouré. Nous agissons comme votre représentant sur place : présents à chaque étape, exigeants sur la qualité, transparents dans nos rapports. Votre investissement mérite un suivi professionnel.",
    etapes_title: "Notre mission",
    etapes: [
        { num: "01", title: "Cadrage & plans", desc: "Aide à l'achat du terrain, bureau d'architecte, conception et devis maîtrisés." },
        { num: "02", title: "Contrôle du chantier", desc: "Visites régulières, sélection des matériaux, validation des factures fournisseurs." },
        { num: "03", title: "Livraison clé en main", desc: "Réception des travaux, nettoyage et remise du chantier terminé." },
    ],

    contrast_title: "Construire à distance,",
    contrast_accent: "sans contrôle, c'est le piège assuré.",
    contrast_intro: "Sans représentant exigeant sur place, un chantier dérape vite : surfacturation, retards et malfaçons. Nous veillons à votre place.",
    solo: [
        "Devis gonflés et coûts qui dérapent",
        "Délais non tenus, sans visibilité",
        "Matériaux de qualité variable",
        "Aucun contrôle réel sur l'avancement",
    ],
    avec: [
        "Visites et contrôle réguliers du chantier",
        "Rapports photos et vidéos chaque semaine",
        "Factures fournisseurs vérifiées et validées",
        "Livraison propre et conforme au projet",
    ],

    features_eyebrow: "Ce que nous prenons en charge",
    features_title: "Nos prestations",
    features_intro: "Un accompagnement complet, du terrain à la remise des clés.",
    features: [
        "Aide à l'achat et à la location de terrain ou de bien immobilier",
        "Bureau d'architecte — conception et plans techniques",
        "Surveillance et contrôle de chantier (visites régulières, tous moyens)",
        "Vérification et validation des factures fournisseurs",
        "Achats de matériaux — sélection et négociation",
        "Rapports WhatsApp hebdomadaires (photos et vidéos)",
        "Mise en relation et coordination des intervenants du chantier",
        "Livraison et nettoyage du chantier clé en main",
    ],
    features_note: "* Missions modulables (suivi mensuel, mission complète, audit ponctuel). Le périmètre est défini ensemble.",

    reassurance: [
        { title: "Sans engagement", desc: "Le premier échange est gratuit." },
        { title: "Un référent dédié", desc: "Le même interlocuteur sur le chantier." },
        { title: "Transparence", desc: "Rapports réguliers, aucune zone d'ombre." },
    ],

    faq: [
        { q: "À quelle fréquence suis-je informé de l'avancement ?", r: "Vous recevez des rapports hebdomadaires avec photos et vidéos, et vous pouvez nous joindre à tout moment." },
        { q: "Pouvez-vous gérer l'achat du terrain aussi ?", r: "Oui. Nous vous accompagnons de la recherche et la sécurisation du terrain jusqu'à la livraison de la construction." },
        { q: "Comment évitez-vous la surfacturation des matériaux ?", r: "Nous sélectionnons et négocions les matériaux, et validons chaque facture fournisseur avant paiement." },
        { q: "Quelles formules proposez-vous ?", r: "Suivi mensuel, mission complète ou audit ponctuel — nous adaptons la formule à votre projet et votre budget." },
    ],

    final_title: "Votre investissement mérite un suivi professionnel.",
    final_text: "Nous contrôlons la qualité, maîtrisons le budget et vous rendons compte chaque semaine — jusqu'à la remise des clés.",
    final_note: "Premier échange gratuit · rapports transparents · sans engagement.",
}
