import type { ServiceLandingContent } from './serviceLanding'

/**
 * « Récap de dossier MyAfroOrigins ».
 *
 * Le cas est précis : la demande a été déposée sur MyAfroOrigins, et depuis,
 * rien. Ni refus, ni explication — le silence. Ce service ne promet pas la
 * nationalité : il remet au client la seule chose qui lui manque vraiment,
 * un état des lieux écrit de son dossier.
 *
 * Surchargeable depuis l'admin via page_sections(page='recap-myafroorigins',
 * section_key='page_content').
 */
export const DEFAULT_RECAP_MYAFRO: ServiceLandingContent = {
    hero_badge: "Reprise de dossier bloqué",
    hero_title: "Votre dossier MyAfroOrigins n'avance plus ?",
    hero_subtitle: "Vous avez déposé votre demande, et depuis, le silence. Nous reprenons votre situation, nous l'analysons, et nous vous remettons une fiche claire : ce qui bloque, ce qui manque, et par quoi commencer.",
    hero_chips: ["Analyse par un humain", "Fiche écrite à conserver", "Aucune pièce à fournir maintenant", "Réponse sous 48 h ouvrées"],
    hero_image: "/assets/icones/icone_recap-myafroorigins.png",
    cta1_label: "Demander mon récap",
    cta1_href: "#demande",
    cta2_label: "Nous contacter",
    cta2_href: "/contact",

    piliers: [
        { title: "Situation reformulée", desc: "Ce que nous avons compris, écrit noir sur blanc" },
        { title: "Blocages identifiés", desc: "Par ordre de gravité, sans jargon" },
        { title: "Pièces à réunir", desc: "La liste exacte, dans le bon ordre" },
        { title: "Marche à suivre", desc: "Étape par étape, une action à la fois" },
    ],

    intro_eyebrow: "Notre métier",
    intro_title: "Pourquoi un dossier s'arrête",
    intro_text: "Un dossier de reconnaissance de nationalité s'arrête rarement pour une seule raison. C'est presque toujours une pièce d'état civil introuvable, une filiation insuffisamment établie, ou une démarche laissée en suspens sans que personne ne l'ait dit clairement. Nous reprenons votre situation depuis le début, nous identifions ce qui bloque réellement, et nous vous le remettons par écrit — pour que vous sachiez enfin quoi faire, et dans quel ordre.",
    etapes_title: "Comment nous procédons",
    etapes: [
        { num: "01", title: "Vous racontez", desc: "Quand vous avez déposé, ce que vous avez fourni, ce qu'on vous a répondu. En quelques lignes, avec vos mots." },
        { num: "02", title: "Nous analysons", desc: "Un analyste reprend votre récit, le confronte à la loi n° 2024-31 et à la pratique des administrations béninoises." },
        { num: "03", title: "Vous recevez votre fiche", desc: "Un document écrit sous 48 heures ouvrées : blocages, pièces à réunir, marche à suivre, et ce que l’agence prend en charge ensuite." },
    ],

    contrast_title: "Attendre en silence,",
    contrast_accent: "c'est laisser le dossier se refermer.",
    contrast_intro: "Un dossier sans nouvelle n'est pas un dossier en cours : c'est souvent un dossier qui attend une pièce que personne ne vous a réclamée. Plus le temps passe, plus les actes d'état civil deviennent difficiles à obtenir.",
    solo: [
        "Aucune nouvelle, et personne à qui écrire",
        "Vous ignorez si le dossier est incomplet ou simplement en attente",
        "On vous réclame des pièces sans dire lesquelles manquent",
        "Vous relancez au hasard, sans savoir quoi demander",
    ],
    avec: [
        "Un état des lieux écrit de votre dossier",
        "Les blocages nommés, hiérarchisés, expliqués",
        "La liste exacte des pièces, dans l'ordre où les obtenir",
        "Une agence qui prend le relais si vous le souhaitez",
    ],

    features_eyebrow: "Ce que contient votre fiche",
    features_title: "Un document, pas une promesse",
    features_intro: "Quatre parties, aucune formule creuse. Vous la conservez, vous la montrez, vous vous en servez.",
    features: [
        "Votre situation reformulée — vous corrigez si nous nous trompons",
        "Les points de blocage, du plus grave au plus secondaire",
        "Ce qui relève de la plateforme, de vos pièces, ou de l'état civil béninois",
        "La liste des documents à réunir, dans l'ordre où les obtenir",
        "La marche à suivre, étape par étape",
        "Ce que l’agence peut prendre en charge à votre place",
    ],
    features_note: "* Nous n'exigeons aucune pièce d'identité à cette étape. Elles ne seront demandées que si l'analyse montre qu'elles sont nécessaires.",

    reassurance: [
        { title: "Analysé par un humain", desc: "Un analyste relit et signe chaque fiche avant qu'elle vous soit remise." },
        { title: "Aucune promesse de résultat", desc: "La décision appartient aux autorités béninoises. Nous vous disons où vous en êtes, honnêtement." },
        { title: "Vos données protégées", desc: "Conservation limitée à 3 ans, aucune revente, effacement sur simple demande." },
    ],

    faq: [
        {
            q: "Est-ce que vous garantissez l'obtention de la nationalité ?",
            r: "Non, et personne ne peut le faire honnêtement. Ce service vous dit précisément où en est votre dossier, ce qui le bloque et comment le débloquer. La décision appartient aux autorités béninoises.",
        },
        {
            q: "Faut-il envoyer mes pièces d'identité maintenant ?",
            r: "Non. À cette étape, nous ne demandons que votre identité de contact et le récit de votre situation. Les pièces ne sont réclamées qu'ensuite, si l'analyse montre qu'elles sont nécessaires.",
        },
        {
            q: "Sous combien de temps ai-je la fiche ?",
            r: "Sous 48 heures ouvrées. Vous recevez d'abord un email de confirmation avec votre référence, puis la fiche relue par un analyste.",
        },
        {
            q: "Et si mon dossier n'a jamais existé chez MyAfroOrigins ?",
            r: "Dites-le simplement dans votre description. L'analyse portera alors sur la constitution d'un dossier neuf, et nous vous indiquerons par quoi commencer.",
        },
        {
            q: "Que deviennent mes données ?",
            r: "Elles servent uniquement à traiter votre demande, sont conservées trois ans, et vous pouvez à tout moment demander à les consulter, les corriger ou les faire effacer. Traitement conforme à la loi n° 2017-20 portant Code du numérique en République du Bénin.",
        },
    ],

    final_title: "Votre dossier mérite une réponse",
    final_text: "Décrivez votre situation, réglez 50 €, et recevez votre fiche d'analyse sous 48 heures ouvrées.",
    final_note: "Analyse écrite · Aucune pièce à fournir maintenant · Données protégées",
}
