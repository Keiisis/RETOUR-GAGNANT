import type { ServiceLandingContent } from './serviceLanding'

export const DEFAULT_AUTRES: ServiceLandingContent = {
    hero_badge: "Services du quotidien",
    hero_title: "Transport, santé, scolarité : le quotidien facilité au Bénin",
    hero_subtitle: "Des solutions complémentaires pour faciliter chaque aspect de votre installation : de l'aéroport à l'école de vos enfants, en passant par l'accès aux soins et les démarches administratives courantes.",
    hero_chips: ["Transport & aéroport", "Santé & cliniques", "Scolarité", "Démarches administratives"],
    hero_image: "/assets/icones/Autres Services.png",
    cta1_label: "Nous contacter",
    cta1_href: "/contact",
    cta2_label: "Prendre rendez-vous",
    cta2_href: "/rendez-vous?service=autres",

    piliers: [
        { title: "Arrivée sereine", desc: "Transfert aéroport & véhicule" },
        { title: "Accès aux soins", desc: "Médecins & cliniques partenaires" },
        { title: "Scolarité", desc: "Inscription & suivi pédagogique" },
        { title: "Démarches", desc: "Administratif du quotidien" },
    ],

    intro_eyebrow: "Notre métier",
    intro_title: "Notre accompagnement",
    intro_text: "Au-delà des grandes démarches, l'installation au Bénin se joue aussi dans le quotidien. Nous vous proposons des solutions complémentaires pour faciliter chaque aspect de votre vie sur place : sereinement, dès l'arrivée.",
    etapes_title: "Comment ça marche",
    etapes: [
        { num: "01", title: "Votre besoin", desc: "Vous nous indiquez ce dont vous avez besoin (transport, santé, école, démarche)." },
        { num: "02", title: "Mise en relation", desc: "Nous mobilisons nos partenaires de confiance et organisons la prestation." },
        { num: "03", title: "Suivi", desc: "Nous restons disponibles pour ajuster et vous accompagner dans la durée." },
    ],

    contrast_title: "S'installer au Bénin,",
    contrast_accent: "c'est mille petits détails à régler.",
    contrast_intro: "Transport, soins, école, papiers : seul et à distance, chaque détail devient un obstacle. Nous vous simplifions le quotidien.",
    solo: [
        "Trouver des prestataires fiables à distance",
        "Organiser l'arrivée et les déplacements",
        "Accéder à des soins de confiance",
        "S'y retrouver dans les démarches locales",
    ],
    avec: [
        "Transfert aéroport et véhicule avec chauffeur",
        "Médecins et cliniques partenaires",
        "Inscription scolaire et suivi pédagogique",
        "Accompagnement des démarches administratives",
    ],

    features_eyebrow: "Ce que nous proposons",
    features_title: "Nos services",
    features_intro: "Des solutions concrètes pour votre quotidien au Bénin.",
    features: [
        "Transfert aéroport et location de véhicule avec chauffeur",
        "Mise en relation avec médecins et cliniques partenaires",
        "Inscription scolaire et suivi pédagogique",
        "Accompagnement démarches administratives locales",
    ],
    features_note: "* Besoin particulier ? Contactez-nous : nous étudions chaque demande.",

    reassurance: [
        { title: "Partenaires de confiance", desc: "Un réseau local sélectionné." },
        { title: "Sur mesure", desc: "Nous étudions chaque demande." },
        { title: "Disponibles", desc: "Un suivi dans la durée." },
    ],

    faq: [
        { q: "Proposez-vous le transfert depuis l'aéroport ?", r: "Oui, transfert aéroport et location de véhicule avec chauffeur font partie de nos services." },
        { q: "Pouvez-vous m'aider pour la scolarité de mes enfants ?", r: "Oui : inscription scolaire et suivi pédagogique auprès d'établissements adaptés." },
        { q: "Et pour un besoin qui n'est pas listé ?", r: "Contactez-nous : nous étudions chaque demande particulière et mobilisons le bon partenaire." },
    ],

    final_title: "Votre quotidien au Bénin, simplifié.",
    final_text: "De l'aéroport à l'école, en passant par les soins et les papiers : dites-nous ce dont vous avez besoin.",
    final_note: "Réponse rapide · partenaires de confiance.",
}
