import type { ServiceLandingContent } from './serviceLanding'

export const DEFAULT_RECHERCHE_ANCESTRALE: ServiceLandingContent = {
    hero_badge: "Recherche ancestrale & généalogie",
    hero_title: "Retrouvez la trace de ceux que l'histoire a effacés",
    hero_subtitle: "Pour des millions de descendants de la diaspora africaine, une partie de la lignée a été effacée par la traite transatlantique. Nous mobilisons archives, bases de données spécialisées et associations expertes pour reconstituer votre lignée africaine.",
    hero_chips: ["Archives officielles", "Bases de données spécialisées", "Associations partenaires", "Accompagnement dédié"],
    hero_image: "/assets/icones/Recherche Ancestrale.png",
    cta1_label: "Lancer ma recherche",
    cta1_href: "/rendez-vous?service=recherche-ancestrale",
    cta2_label: "Nous contacter",
    cta2_href: "/contact",

    piliers: [
        { title: "Archives officielles", desc: "Sources d'état civil vérifiées" },
        { title: "Bases spécialisées", desc: "Données diasporiques" },
        { title: "Associations expertes", desc: "Partenariats afro-descendants" },
        { title: "Accompagnement", desc: "Un référent tout au long" },
    ],

    intro_eyebrow: "Notre métier",
    intro_title: "Notre accompagnement",
    intro_text: "La traite transatlantique a interrompu le fil de nombreuses familles. Nous mobilisons archives officielles, bases de données spécialisées et associations expertes pour reconstituer votre lignée africaine, pièce après pièce, avec méthode et respect.",
    etapes_title: "Comment ça se passe",
    etapes: [
        { num: "01", title: "Collecte des pièces", desc: "Nous réunissons les actes disponibles de votre lignée (parents, grands-parents, aïeux)." },
        { num: "02", title: "Recherche en archives", desc: "Consultation des archives officielles et des bases de données diasporiques." },
        { num: "03", title: "Reconstitution", desc: "Avec nos associations partenaires, nous reconstituons le fil de votre lignée." },
    ],

    contrast_title: "Reconstituer une lignée effacée,",
    contrast_accent: "ça demande méthode et bons interlocuteurs.",
    contrast_intro: "Sans accès aux archives ni aux réseaux spécialisés, la recherche s'arrête vite. Nous ouvrons les bonnes portes.",
    solo: [
        "Accès limité aux archives officielles",
        "Bases de données diasporiques méconnues",
        "Pièces d'état civil difficiles à obtenir",
        "Recherche qui s'essouffle faute de réseau",
    ],
    avec: [
        "Consultation d'archives officielles",
        "Accès à des bases de données spécialisées",
        "Partenariats avec des associations expertes",
        "Un accompagnement méthodique et respectueux",
    ],

    features_eyebrow: "Ce que nous mobilisons",
    features_title: "Notre démarche",
    features_intro: "Pièces à réunir et moyens mis en œuvre pour votre recherche.",
    features: [
        "Extrait de naissance de vos deux parents (père et mère)",
        "Extrait de naissance ou de décès de vos grands-parents (côté paternel et maternel)",
        "Actes de mariage, notariés, militaires ou de décès des arrière-grands-parents",
        "Consultation d'archives officielles et bases de données diasporiques",
        "Partenariats avec associations spécialisées dans la généalogie afro-descendante",
    ],
    features_note: "* L'ensemble des pièces sont à transmettre par voie électronique — une démarche simple et sécurisée pour débuter votre recherche.",

    reassurance: [
        { title: "Sans engagement", desc: "Le premier échange est gratuit." },
        { title: "Confidentialité", desc: "Vos documents restent strictement privés." },
        { title: "Respect & méthode", desc: "Une démarche rigoureuse et humaine." },
    ],

    faq: [
        { q: "Quelles pièces dois-je fournir pour commencer ?", r: "Les actes disponibles de votre lignée (parents, grands-parents, arrière-grands-parents). Nous vous indiquons les alternatives pour ce qui manque." },
        { q: "Comment se déroule la recherche ?", r: "Nous combinons archives officielles, bases de données diasporiques et associations partenaires pour reconstituer votre lignée." },
        { q: "Que se passe-t-il si des documents manquent ?", r: "C'est fréquent sur plusieurs générations. Nous explorons les sources alternatives et vous accompagnons pour reconstituer les pièces." },
    ],

    final_title: "Renouez le fil interrompu de votre histoire.",
    final_text: "Archives, bases de données et associations expertes : nous reconstituons votre lignée africaine, avec méthode et respect.",
    final_note: "Premier échange gratuit · confidentialité garantie.",
}
