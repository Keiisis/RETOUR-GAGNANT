import type { ServiceLandingContent } from './serviceLanding'

export const DEFAULT_BUSINESS: ServiceLandingContent = {
    hero_badge: "Création & implantation d'entreprise",
    hero_title: "Créez votre entreprise au Bénin, depuis la diaspora",
    hero_subtitle: "De la création juridique de votre structure à l'ouverture de votre compte bancaire, en passant par les formalités fiscales — nous vous accompagnons à chaque étape.",
    hero_chips: ["Création clé en main", "RCCM & fiscalité", "Compte bancaire pro", "Réseau local"],
    hero_image: "/assets/icones/icone_Creation_d_Entreprise.png",
    cta1_label: "Prendre rendez-vous",
    cta1_href: "/rendez-vous?service=business",
    cta2_label: "Nous contacter",
    cta2_href: "/contact",

    piliers: [
        { title: "Création clé en main", desc: "SARL / SA / SASU, sans déplacement" },
        { title: "Formalités officielles", desc: "RCCM, fiscalité, domiciliation" },
        { title: "Compte bancaire pro", desc: "Ouverture accompagnée" },
        { title: "Réseau local", desc: "Talents & partenaires de confiance" },
    ],

    intro_eyebrow: "Notre métier",
    intro_title: "Notre accompagnement",
    intro_text: "Nous facilitons l'implantation économique des entrepreneurs de la diaspora au Bénin. De la création juridique de votre structure à l'ouverture de votre compte bancaire, en passant par les démarches fiscales, notre équipe vous accompagne à chaque étape — sur place, pour vous.",
    etapes_title: "Comment nous procédons",
    etapes: [
        { num: "01", title: "Structuration juridique", desc: "Choix de la forme (SARL, SA, SASU), statuts et immatriculation RCCM." },
        { num: "02", title: "Formalités & compte pro", desc: "Démarches fiscales, domiciliation à Cotonou et ouverture de compte bancaire professionnel." },
        { num: "03", title: "Lancement & réseau", desc: "Recrutement de talents locaux et mise en relation avec les acteurs économiques." },
    ],

    contrast_title: "Entreprendre à distance,",
    contrast_accent: "sans partenaire local fiable, c'est risqué.",
    contrast_intro: "Formalités opaques, interlocuteurs multiples, comptes bloqués : monter une structure depuis l'étranger multiplie les pièges. Nous agissons comme votre représentant sur place.",
    solo: [
        "Formalités RCCM et fiscales complexes à distance",
        "Ouverture de compte bancaire difficile sans présence",
        "Pas de relais de confiance sur le terrain",
        "Risque d'erreurs juridiques coûteuses",
    ],
    avec: [
        "Création clé en main, statuts et RCCM gérés pour vous",
        "Domiciliation et ouverture de compte accompagnées",
        "Un interlocuteur unique sur place, transparent",
        "Accès à un réseau de talents et de partenaires locaux",
    ],

    features_eyebrow: "Ce que nous prenons en charge",
    features_title: "Nos prestations",
    features_intro: "Un accompagnement complet pour créer et lancer votre activité au Bénin.",
    features: [
        "Création SARL / SA / SASU clé en main",
        "Immatriculation RCCM et formalités fiscales",
        "Ouverture de compte bancaire professionnel",
        "Domiciliation commerciale à Cotonou",
        "Cabinet de recrutement — sélection de talents locaux",
        "Mise en relation avec les acteurs économiques locaux",
    ],
    features_note: "* Prestations modulables selon votre projet. Un premier échange permet de définir le périmètre exact.",

    reassurance: [
        { title: "Sans engagement", desc: "Le premier échange est gratuit." },
        { title: "Un interlocuteur unique", desc: "Votre représentant dédié sur place." },
        { title: "Transparence", desc: "Devis clair, aucune mauvaise surprise." },
    ],

    faq: [
        { q: "Dois-je être présent au Bénin pour créer ma société ?", r: "Non. Nous réalisons les formalités pour vous et vous indiquons uniquement les étapes qui requièrent votre signature ou votre présence." },
        { q: "Quelle forme juridique choisir ?", r: "Cela dépend de votre activité, du nombre d'associés et de vos objectifs. Nous vous conseillons la structure la plus adaptée lors du premier échange." },
        { q: "Pouvez-vous ouvrir le compte bancaire professionnel ?", r: "Oui, nous accompagnons l'ouverture du compte pro et la constitution du dossier bancaire." },
        { q: "Aidez-vous au recrutement local ?", r: "Oui. Notre cabinet sélectionne des talents locaux et vous met en relation avec des partenaires de confiance." },
    ],

    final_title: "Votre entreprise au Bénin, montée sur des bases solides.",
    final_text: "Structuration juridique, formalités, compte bancaire et réseau local : nous gérons tout sur place pour que votre projet démarre sans faux pas.",
    final_note: "Premier échange gratuit · devis clair · sans engagement.",
}
