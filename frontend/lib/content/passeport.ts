import type { ServiceLandingContent } from './serviceLanding'

export const DEFAULT_PASSEPORT: ServiceLandingContent = {
    hero_badge: "Passeport & documents officiels",
    hero_title: "Passeport biométrique béninois : accompagnement complet",
    hero_subtitle: "Documents officiels et accompagnement pour la diaspora béninoise. Constitution du dossier, coordination avec les autorités et suivi jusqu'à la remise de votre titre.",
    hero_chips: ["Dossier pris en charge", "Coordination officielle", "Suivi jusqu'à la remise", "Option express jour-J"],
    hero_image: "/assets/icones/icone_Passeport_Documents.png",
    cta1_label: "Prendre rendez-vous",
    cta1_href: "/rendez-vous?service=passeport",
    cta2_label: "Nous contacter",
    cta2_href: "/contact",

    piliers: [
        { title: "Dossier maîtrisé", desc: "Constitué et vérifié pièce par pièce" },
        { title: "Coordination officielle", desc: "Avec les autorités compétentes" },
        { title: "Suivi transparent", desc: "Jusqu'à la remise de votre titre" },
        { title: "Pack VIP express", desc: "Traitement possible en une journée" },
    ],

    intro_eyebrow: "Notre métier",
    intro_title: "Notre accompagnement",
    intro_text: "Nous prenons en charge l'ensemble des démarches liées à l'obtention ou au renouvellement de votre passeport biométrique béninois. Constitution du dossier, coordination avec les autorités compétentes et suivi jusqu'à la remise de votre titre : un accompagnement structuré, sans improvisation.",
    etapes_title: "Pack VIP : en une journée",
    etapes: [
        { num: "01", title: "Enrôlement État Civil", desc: "Obtention de votre extrait de naissance certifié conforme auprès des autorités de l'état civil béninois." },
        { num: "02", title: "Carte d'Identité Personnelle (CIP A)", desc: "Constitution du dossier et enrôlement biométrique pour votre titre d'identité officiel béninois." },
        { num: "03", title: "Passeport Express Jour-J", desc: "Prise en charge prioritaire de votre demande de passeport biométrique : déposée et traitée le jour même." },
    ],

    contrast_title: "Une démarche officielle,",
    contrast_accent: "des pièces qui ne tolèrent aucune erreur.",
    contrast_intro: "Un document manquant, périmé ou non conforme, et le rendez-vous saute. Depuis l'étranger, chaque aller-retour coûte du temps et de l'argent. Nous sécurisons chaque étape.",
    solo: [
        "Pièces non conformes = rendez-vous refusé",
        "Files d'attente et déplacements depuis l'étranger",
        "Exigences biométriques mal comprises",
        "Délais qui s'allongent sans visibilité",
    ],
    avec: [
        "Chaque pièce vérifiée et conforme avant dépôt",
        "Coordination avec les autorités compétentes",
        "Option Pack VIP : état civil → CIP → passeport en un jour",
        "Suivi transparent jusqu'à la remise du titre",
    ],

    features_eyebrow: "On sait exactement quoi réunir",
    features_title: "Pièces à fournir",
    features_intro: "Liste des pièces pour la constitution de votre dossier passeport (diaspora afro-descendante).",
    features: [
        "Copie intégrale du passeport en cours de validité",
        "Acte de naissance certifié conforme délivré par la mairie béninoise",
        "Certificat de nationalité béninoise (Tribunal de Première Instance)",
        "Carte d'Identité Personnelle (CIP A) en cours de validité",
        "Extrait de casier judiciaire béninois : Bulletin n°3 (moins de 3 mois)",
        "Justificatif de domicile de moins de 3 mois (quittance ou bail)",
        "4 photos d'identité biométriques (fond blanc, 3,5 × 4,5 cm, sans lunettes)",
        "Formulaire officiel de demande de passeport rempli et signé",
    ],
    features_note: "* Cette liste peut varier selon votre situation. Nos conseillers vous transmettent la liste définitive lors de votre rendez-vous.",

    reassurance: [
        { title: "Sans engagement", desc: "Le premier appel de 15 min est gratuit." },
        { title: "Un référent dédié", desc: "La même personne suit votre dossier." },
        { title: "Confidentialité", desc: "Vos documents restent strictement privés." },
    ],

    faq: [
        { q: "Puis-je faire ma demande depuis l'étranger ?", r: "Oui. Nous préparons et coordonnons votre dossier à distance et vous indiquons précisément les étapes qui nécessitent votre présence." },
        { q: "En quoi consiste le Pack VIP express ?", r: "Une prise en charge intégrale et prioritaire : de l'état civil à la délivrance du passeport : organisée pour être traitée en une seule journée." },
        { q: "Que se passe-t-il s'il me manque une pièce ?", r: "Nous vous indiquons les documents alternatifs acceptés et vous aidons à les obtenir avant tout dépôt, pour éviter un refus." },
        { q: "Combien de temps prend l'obtention ?", r: "Cela dépend de la formule choisie et des autorités. Nous vous donnons une estimation réaliste dès l'analyse de votre dossier." },
    ],

    final_title: "Un passeport, ça se prépare : pas ça s'improvise.",
    final_text: "Nous constituons un dossier conforme, coordonnons avec les autorités et vous suivons jusqu'à la remise de votre titre.",
    final_note: "Premier appel de 15 min gratuit · sans engagement.",
}
