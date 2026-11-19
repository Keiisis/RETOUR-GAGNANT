import type { ServiceLandingContent } from './serviceLanding'

// Décision du 18/11/2026 : le passeport est gratuit et inclus dans la demande
// de nationalité. L'État le remet lors de la cérémonie officielle de remise ;
// plus aucune démarche ni aucun frais séparés.
export const DEFAULT_PASSEPORT: ServiceLandingContent = {
    hero_badge: "Passeport : inclus et gratuit",
    hero_title: "Passeport béninois : inclus dans votre demande de nationalité",
    hero_subtitle: "L'État vous remet directement votre passeport béninois lors de la cérémonie officielle de remise, au terme de votre demande de nationalité. Aucune démarche séparée, aucun frais.",
    hero_chips: ["Gratuit", "Remis par l'État", "Cérémonie officielle de remise", "Agence agréée"],
    hero_image: "/assets/icones/icone_Passeport_Documents.png",
    cta1_label: "Faire ma demande de nationalité",
    cta1_href: "/nationalite/formulaire",
    cta2_label: "Nous contacter",
    cta2_href: "/contact",

    piliers: [
        { title: "Inclus", desc: "Dans la demande de nationalité" },
        { title: "Gratuit", desc: "Aucun frais de passeport" },
        { title: "Remis par l'État", desc: "Lors de la cérémonie officielle" },
        { title: "Agence agréée", desc: "Accompagnement sans frais" },
    ],

    intro_eyebrow: "Comment ça se passe",
    intro_title: "Un seul parcours : la demande de nationalité",
    intro_text: "Vous n'avez plus de démarche passeport à mener. Vous déposez votre demande de nationalité béninoise, notre agence agréée vous accompagne gratuitement, et au terme de la procédure l'État vous remet votre passeport lors de la cérémonie officielle de remise.",
    etapes_title: "Du dépôt à la remise",
    etapes: [
        { num: "01", title: "Demande de nationalité", desc: "Vous remplissez le formulaire en ligne et déposez vos pièces. La demande est gratuite." },
        { num: "02", title: "Suivi du dossier", desc: "Notre agence agréée vérifie votre dossier et en assure le suivi auprès des autorités." },
        { num: "03", title: "Cérémonie officielle de remise", desc: "L'État vous remet votre passeport béninois lors de la cérémonie." },
    ],

    contrast_title: "Aucune démarche passeport séparée.",
    contrast_accent: "Tout passe par la demande de nationalité.",
    contrast_intro: "Le passeport ne se commande plus à part : il fait partie de la procédure de nationalité, et l'État le remet lui-même.",
    solo: [
        "Procédure de nationalité à comprendre seul",
        "Pièces non conformes, dossier retardé",
        "Allers-retours administratifs depuis l'étranger",
        "Aucune visibilité sur l'avancement",
    ],
    avec: [
        "Demande de nationalité gratuite",
        "Dossier vérifié par une agence agréée",
        "Passeport remis par l'État lors de la cérémonie",
        "Aucun frais de passeport",
    ],

    features_eyebrow: "L'essentiel",
    features_title: "Ce qu'il faut retenir",
    features_intro: "Le passeport n'est plus un service séparé.",
    features: [
        "Le passeport est inclus dans la demande de nationalité",
        "Aucun frais de passeport, aucune commande séparée",
        "Le passeport est remis directement par l'État",
        "La remise a lieu lors de la cérémonie officielle",
        "Les pièces à fournir sont celles de la demande de nationalité",
        "Notre agence agréée vous accompagne sans frais",
    ],
    features_note: "* Les pièces à fournir sont détaillées dans le formulaire de demande de nationalité.",

    reassurance: [
        { title: "Gratuit", desc: "Ni la demande ni le passeport ne vous sont facturés." },
        { title: "Agence agréée", desc: "Votre dossier est suivi par une agence agréée." },
        { title: "Confidentialité", desc: "Vos documents restent strictement privés." },
    ],

    faq: [
        { q: "Dois-je faire une demande de passeport à part ?", r: "Non. Le passeport est inclus dans la demande de nationalité : il n'y a aucune démarche séparée." },
        { q: "Le passeport est-il payant ?", r: "Non. Le passeport est gratuit, comme la demande de nationalité et notre accompagnement." },
        { q: "Qui me remet le passeport ?", r: "L'État, directement, lors de la cérémonie officielle de remise qui clôt la procédure de nationalité." },
        { q: "Par où commencer ?", r: "Par la demande de nationalité en ligne. Nous vous accompagnons ensuite jusqu'à la cérémonie." },
    ],

    final_title: "Votre passeport commence par la demande de nationalité.",
    final_text: "Déposez votre demande gratuitement : notre agence agréée suit votre dossier jusqu'à la cérémonie officielle où l'État vous remet votre passeport.",
    final_note: "Gratuit · agence agréée · aucune démarche passeport séparée.",
}
