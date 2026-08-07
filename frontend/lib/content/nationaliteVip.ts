// ══════════════════════════════════════════════════════════════
//  Contenu ÉDITABLE de la page /services/nationalite-vip
//  Source unique partagée par la page publique ET l'éditeur admin
//  (/admin/nationalite/content) → aucune dérive possible.
//  Stocké dans Supabase : page_sections(page='nationalite-vip',
//  section_key='page_content').content (JSONB).
// ══════════════════════════════════════════════════════════════

export interface PricingOption { label: string; price: string }
export interface Pilier { title: string; desc: string }
export interface Etape { num: string; title: string; desc: string }
export interface Reassurance { title: string; desc: string }
export interface FaqQA { q: string; r: string }

export interface NationaliteVipContent {
    // Hero
    hero_badge: string
    hero_title: string
    hero_subtitle: string
    hero_chips: string[]
    // Piliers (bande verte) — 4 icônes fixes (Couronne / Suivi / Diaspora / Horloge)
    piliers: Pilier[]
    // Accompagnement
    accompagnement_eyebrow: string
    accompagnement_title: string
    accompagnement_text: string
    etapes: Etape[]
    // Contraste solo vs accompagné
    contrast_title: string
    contrast_title_accent: string
    contrast_intro: string
    solo: string[]
    avec: string[]
    // Pièces
    documents_eyebrow: string
    documents_title: string
    documents_intro: string
    documents: string[]
    documents_note: string
    // Éligibilité (mini-check)
    elig_title: string
    elig_intro: string
    elig_q1: string
    elig_q2: string
    // Réassurance — 3 icônes fixes
    reassurance: Reassurance[]
    // FAQ
    faq: FaqQA[]
    // Tarifs (calculateur — gardé, gated par les réglages globaux)
    pricing_show_calculator: boolean
    pricing_options: PricingOption[]
    // CTA 1 (formulaire) + CTA 2 (rendez-vous)
    cta1_title: string
    cta1_description: string
    cta1_button_text: string
    cta2_title: string
    cta2_description: string
    cta2_button_text: string
    cta2_note: string
    // CTA final
    final_title: string
    final_text: string
    final_note: string
}

export const DEFAULT_NATIONALITE_VIP: NationaliteVipContent = {
    hero_badge: "Service phare — Nationalité béninoise",
    hero_title: "Nationalité Béninoise — Accompagnement VIP",
    hero_subtitle: "Procédure personnalisée et accompagnée de A à Z pour obtenir la nationalité béninoise.",
    hero_chips: ["De A à Z", "Suivi transparent", "Diaspora afro-descendante", "Réponse 48 h"],

    piliers: [
        { title: "Accompagnement VIP", desc: "Pris en charge de A à Z" },
        { title: "Suivi personnalisé", desc: "Un conseiller dédié, transparent" },
        { title: "Pensé pour la diaspora", desc: "Tout géré à distance" },
        { title: "Réponse sous 48 h", desc: "Sans engagement" },
    ],

    accompagnement_eyebrow: "Notre métier",
    accompagnement_title: "Notre accompagnement",
    accompagnement_text: "Nous guidons les membres de la diaspora afro-descendante dans l'ensemble des démarches administratives nécessaires à l'obtention de la nationalité béninoise. De la constitution du dossier à la remise des documents officiels, notre équipe assure un suivi personnalisé et transparent à chaque étape.",
    etapes: [
        { num: "01", title: "Constitution du dossier", desc: "Nous réunissons et fiabilisons chaque pièce — la vôtre et celle de votre lignée." },
        { num: "02", title: "Suivi personnalisé", desc: "Un conseiller dédié vous accompagne, étape par étape, en toute transparence." },
        { num: "03", title: "Remise des documents", desc: "Nous vous accompagnons jusqu'à la remise de vos documents officiels." },
    ],

    contrast_title: "Une procédure exigeante.",
    contrast_title_accent: "Un dossier qui ne pardonne pas l'à-peu-près.",
    contrast_intro: "La nationalité par afro-descendance demande des actes sur plusieurs générations. Une pièce manquante ou non conforme, et tout est retardé. C'est là que nous intervenons.",
    solo: [
        "Actes d'état civil sur plusieurs générations, difficiles à réunir",
        "Exigences mal comprises = dossier rejeté",
        "Allers-retours administratifs depuis l'étranger",
        "Délais qui s'allongent, procédure qui traîne",
    ],
    avec: [
        "On vous dit exactement quoi fournir, pièce par pièce",
        "Dossier vérifié et fiabilisé avant tout dépôt",
        "Tout géré à distance — zéro déplacement pour la diaspora",
        "Suivi transparent jusqu'à la remise des documents",
    ],

    documents_eyebrow: "On sait exactement quoi réunir",
    documents_title: "Pièces à fournir",
    documents_intro: "Nous vous guidons pièce par pièce — y compris pour les actes de vos parents, grands-parents et arrière-grands-parents.",
    documents: [
        "Preuve d'afro-descendance",
        "Preuve de profession",
        "Justificatif de domicile",
        "Pièce d'identité en cours de validité",
        "Votre extrait de naissance",
        "Casier judiciaire",
        "Extrait de naissance de vos deux parents (père et mère)",
        "Copie du livret de famille de vos parents",
        "Extrait de naissance de vos arrière-grands-parents (du côté du père et du côté de la mère)",
        "Copie de votre livret de famille si enfant mineur",
        "Et tout autre document (acte de mariage ; notariale ; acte militaire ; de décès) de vos grands-parents et arrière-grands-parents.",
    ],
    documents_note: "* Cette liste peut varier selon votre situation individuelle. Nos conseillers vous transmettront la liste définitive lors de votre consultation.",

    elig_title: "Suis-je concerné(e) ?",
    elig_intro: "Deux questions pour une première orientation. Aucune donnée n'est enregistrée — c'est indicatif.",
    elig_q1: "Êtes-vous afro-descendant(e) de la diaspora ?",
    elig_q2: "Pouvez-vous documenter un lien avec le Bénin (ascendance, actes) ?",

    reassurance: [
        { title: "Sans engagement", desc: "Le premier échange n'engage à rien." },
        { title: "Un conseiller dédié", desc: "La même personne vous suit du début à la fin." },
        { title: "Confidentialité", desc: "Vos documents et informations restent privés." },
    ],

    faq: [
        { q: "Qui peut demander la nationalité par afro-descendance ?", r: "Toute personne de la diaspora afro-descendante en mesure d'établir un lien avec le Bénin. Nos conseillers évaluent précisément votre situation lors du premier échange, sans engagement." },
        { q: "Dois-je résider au Bénin pour lancer la démarche ?", r: "Non. Nous accompagnons la diaspora à distance : la constitution du dossier et le suivi se font sans que vous ayez à vous déplacer." },
        { q: "Et si des documents de mes parents ou grands-parents manquent ?", r: "C'est fréquent sur plusieurs générations. Nous vous indiquons les pièces alternatives acceptées et vous aidons à reconstituer ce qui manque." },
        { q: "Combien de temps prend la procédure ?", r: "Les délais dépendent de votre dossier et de l'administration. Nous vous donnons une estimation réaliste dès l'analyse de votre situation." },
        { q: "Comment se passe le premier échange ?", r: "Un premier échange sans engagement permet d'évaluer votre situation et de préparer la suite. Le détail de l'accompagnement vous est présenté ensuite." },
    ],

    pricing_show_calculator: false,
    pricing_options: [
        { label: "Accompagnement dossier standard", price: "150.000 FCFA" },
        { label: "Pack VIP — suivi prioritaire complet", price: "350.000 FCFA" },
        { label: "Consultation initiale", price: "Gratuit" },
    ],

    cta1_title: "Commencer ma demande",
    cta1_description: "Remplissez le formulaire de demande en ligne. Notre équipe vous recontactera sous 48h.",
    cta1_button_text: "Commencer ma demande",
    cta2_title: "Prendre un rendez-vous",
    cta2_description: "Échangez avec un conseiller pour évaluer votre situation et préparer votre dossier.",
    cta2_button_text: "Réserver un créneau",
    cta2_note: "Premier appel de 15 min gratuit",

    final_title: "La nationalité se gagne sur un dossier impeccable.",
    final_text: "Un dossier mal monté, c'est un rejet et des mois perdus. Nous montons le vôtre pour qu'il passe — et nous vous suivons jusqu'à la remise de vos documents.",
    final_note: "Sans engagement · réponse sous 48 h · premier échange gratuit.",
}
