import type { ServiceLandingContent } from './serviceLanding'

// Contenu par défaut de la page « Permis de Conduire Béninois » (style logement /
// VIP). Éditable en admin via page_sections(page='permis-conduire',
// section_key='page_content'). Aucun tiret cadratin dans les textes.
export const DEFAULT_PERMIS: ServiceLandingContent = {
    hero_badge: "Permis de Conduire Béninois",
    hero_title: "Conduisez au Bénin en toute légalité",
    hero_subtitle: "Vous êtes afro-descendant et vous vous installez ou séjournez au Bénin ? Obtenez un permis de conduire béninois officiel, en règle, et circulez l'esprit tranquille. Nous vous accompagnons du choix de la catégorie jusqu'à l'obtention, avec une auto-école partenaire agréée.",
    hero_chips: ["Permis officiel ANATT", "Toutes les catégories", "Auto-écoles agréées", "Accompagnement complet"],
    hero_image: "/assets/icones/permis-conduire.png",
    cta1_label: "Choisir ma catégorie",
    cta1_href: "#reserver",
    cta2_label: "Nous contacter",
    cta2_href: "/contact",

    piliers: [
        { title: "Permis officiel", desc: "Reconnu par l'ANATT" },
        { title: "Toutes catégories", desc: "Moto, voiture, poids lourd, transport" },
        { title: "Auto-écoles agréées", desc: "Des partenaires de confiance" },
        { title: "Tout coordonné", desc: "De l'inscription à l'examen" },
    ],

    intro_eyebrow: "Notre métier",
    intro_title: "Un permis béninois, sans le parcours du combattant",
    intro_text: "Obtenir un permis quand on arrive de l'étranger peut vite tourner au casse-tête : démarches, catégories, auto-écoles, examens. Nous prenons tout en main. Vous choisissez la catégorie de permis adaptée à votre véhicule, nous vous orientons vers une auto-école partenaire agréée, et nous coordonnons chaque étape jusqu'à l'obtention de votre titre officiel.",
    etapes_title: "Comment ça se passe",
    etapes: [
        { num: "01", title: "Vous choisissez votre catégorie", desc: "Moto, voiture, poids lourd ou transport en commun : le tarif s'affiche selon la catégorie officielle choisie." },
        { num: "02", title: "Nous montons votre dossier", desc: "Inscription, pièces justificatives et orientation vers une auto-école partenaire proche de vous." },
        { num: "03", title: "Formation et examen", desc: "Cours de code, heures de conduite avec des moniteurs qualifiés, puis présentation à l'examen officiel." },
        { num: "04", title: "Vous obtenez votre permis", desc: "Nous suivons votre dossier jusqu'à la remise de votre permis béninois officiel." },
    ],

    contrast_title: "Un permis béninois,",
    contrast_accent: "ça se prépare sereinement.",
    contrast_intro: "Se repérer entre les catégories, trouver une auto-école fiable, comprendre les démarches administratives : seul, on perd du temps et parfois de l'argent. Nous sécurisons chaque étape.",
    solo: [
        "Difficile de savoir quelle catégorie choisir",
        "Auto-écoles inconnues, qualité incertaine",
        "Démarches administratives opaques",
        "Risque d'erreurs qui rallongent les délais",
    ],
    avec: [
        "La bonne catégorie identifiée avec vous",
        "Une auto-école partenaire agréée et fiable",
        "Dossier constitué et suivi de bout en bout",
        "Un tarif clair, fixé à l'avance selon la catégorie",
    ],

    features_eyebrow: "Ce que nous prenons en charge",
    features_title: "Un accompagnement complet",
    features_intro: "De la première question jusqu'à votre permis en poche.",
    features: [
        "Conseil sur la catégorie de permis adaptée à votre besoin",
        "Mise en relation avec une auto-école partenaire agréée",
        "Inscription et constitution complète du dossier",
        "Cours de code et heures de conduite avec des moniteurs qualifiés",
        "Présentation à l'examen officiel du permis béninois",
        "Suivi administratif jusqu'à l'obtention du titre",
        "Un interlocuteur dédié tout au long du parcours",
    ],
    features_note: "",

    reassurance: [
        { title: "Titre officiel", desc: "Un permis reconnu par les autorités béninoises." },
        { title: "Partenaires agréés", desc: "Uniquement des auto-écoles de confiance." },
        { title: "Tarif transparent", desc: "Le prix dépend de la catégorie, affiché à l'avance." },
    ],

    faq: [
        { q: "Quelle catégorie de permis me faut-il ?", r: "Cela dépend de votre véhicule : moto, voiture particulière, poids lourd ou transport en commun. Chaque catégorie officielle a son tarif ; choisissez la vôtre et le prix s'affiche automatiquement. En cas de doute, nous vous conseillons." },
        { q: "Combien de temps faut-il pour obtenir le permis ?", r: "La durée dépend de la catégorie et de votre disponibilité pour les cours. Elle est indiquée pour chaque catégorie au moment du choix." },
        { q: "Puis-je échanger mon permis étranger ?", r: "Selon votre pays d'origine, un échange peut être possible. Contactez-nous : nous étudions votre situation et vous orientons vers la meilleure démarche." },
        { q: "L'auto-école est-elle comprise ?", r: "Oui. Nous vous mettons en relation avec une auto-école partenaire agréée et nous coordonnons votre formation avec elle." },
    ],

    final_title: "Prenez la route au Bénin, en toute légalité.",
    final_text: "Choisissez votre catégorie de permis, réglez en ligne, et laissez-nous coordonner le reste avec une auto-école partenaire.",
    final_note: "Permis officiel ANATT · tarif fixé selon la catégorie.",
}
