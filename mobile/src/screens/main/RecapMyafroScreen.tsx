/* Récap de dossier MyAfroOrigins — contenu du service.

   L'écran était écrit sur mesure : il rendait correctement mais ne ressemblait
   à AUCUN autre service de l'application — ni la structure, ni la typographie,
   ni la bande verte de piliers, ni la barre collante. Il utilise désormais le
   même gabarit que Guide Culturel, Passeport ou Autres Services :
   `ServiceRdvLanding`.

   `primaryScreen` renvoie vers l'écran de demande, qui recueille le récit de
   la situation, le consentement et le règlement — un simple rendez-vous ne
   suffirait pas ici. */
import React from 'react'
import {
    FileSearch, AlertTriangle, ListOrdered, HandHeart, ShieldCheck, Clock,
    FileText, MessageCircle, Lock, UserCheck,
} from 'lucide-react-native'
import ServiceRdvLanding, { type RdvLandingContent } from '../../components/ServiceRdvLanding'

const CONTENT: RdvLandingContent = {
    serviceLabel: 'Récap de dossier MyAfroOrigins',
    shareMessage: "Votre dossier MyAfroOrigins n'avance plus ? Faites-le analyser par Retour Gagnant : https://www.retourgagnantbenin.bj/services/recap-myafroorigins",
    heroIcon: FileSearch,
    badge: 'Reprise de dossier bloqué',
    title: "Votre dossier MyAfroOrigins n'avance plus ?",
    subtitle: "Vous avez déposé votre demande, et depuis, le silence. Nous reprenons votre situation, nous l'analysons, et nous vous remettons une fiche claire : ce qui bloque, ce qui manque, et par quoi commencer.",
    chips: [
        { icon: UserCheck, label: 'Analysé par un humain' },
        { icon: FileText, label: 'Fiche écrite à conserver' },
        { icon: Clock, label: 'Réponse sous 48 h ouvrées' },
        { icon: Lock, label: 'Données protégées' },
    ],
    trust: ['Aucune pièce à fournir maintenant', 'Fiche écrite', 'Sous 48 h ouvrées'],

    piliers: [
        { icon: FileSearch, title: 'Situation reformulée', desc: 'Écrite noir sur blanc.' },
        { icon: AlertTriangle, title: 'Blocages identifiés', desc: 'Par ordre de gravité.' },
        { icon: ListOrdered, title: 'Pièces à réunir', desc: 'Dans le bon ordre.' },
        { icon: HandHeart, title: 'Marche à suivre', desc: 'Une action à la fois.' },
    ],

    missionEyebrow: 'Notre métier',
    missionTitle: "Pourquoi un dossier s'arrête.",
    missionText: "Un dossier de reconnaissance de nationalité s'arrête rarement pour une seule raison. C'est presque toujours une pièce d'état civil introuvable, une filiation insuffisamment établie, ou une démarche laissée en suspens sans que personne ne l'ait dit clairement. Nous reprenons votre situation depuis le début, nous identifions ce qui bloque réellement, et nous vous le remettons par écrit — pour que vous sachiez enfin quoi faire, et dans quel ordre.",

    etapesEyebrow: 'Comment nous procédons',
    etapes: [
        { num: '01', title: 'Vous racontez', desc: "Quand vous avez déposé, ce que vous avez fourni, ce qu'on vous a répondu. En quelques lignes, avec vos mots." },
        { num: '02', title: 'Nous analysons', desc: "Un analyste reprend votre récit et le confronte à la loi n° 2024-31 et à la pratique des administrations béninoises." },
        { num: '03', title: 'Vous recevez votre fiche', desc: "Sous 48 heures ouvrées : blocages, pièces à réunir, marche à suivre, et ce que le cabinet prend en charge ensuite." },
    ],

    contrastEyebrow: 'La différence',
    contrastPre: 'Attendre en silence,',
    contrastAccent: "c'est laisser le dossier se refermer.",
    contrastSub: "Un dossier sans nouvelle n'est pas un dossier en cours : c'est souvent un dossier qui attend une pièce que personne ne vous a réclamée. Plus le temps passe, plus les actes d'état civil deviennent difficiles à obtenir.",
    soloTitle: 'Seul, sans réponse',
    solo: [
        'Aucune nouvelle, et personne à qui écrire',
        'Vous ignorez si le dossier est incomplet ou en attente',
        'On vous réclame des pièces sans dire lesquelles manquent',
        'Vous relancez au hasard, sans savoir quoi demander',
    ],
    avecTitle: 'Avec le cabinet',
    avec: [
        'Un état des lieux écrit de votre dossier',
        'Les blocages nommés, hiérarchisés, expliqués',
        "La liste exacte des pièces, dans l'ordre où les obtenir",
        'Un cabinet qui prend le relais si vous le souhaitez',
    ],

    prestaEyebrow: 'Ce que contient votre fiche',
    prestaTitle: 'Un document, pas une promesse.',
    presta: [
        'Votre situation reformulée — vous corrigez si nous nous trompons',
        'Les points de blocage, du plus grave au plus secondaire',
        "Ce qui relève de la plateforme, de vos pièces, ou de l'état civil",
        'La liste des documents à réunir, dans le bon ordre',
        'La marche à suivre, étape par étape',
        'Ce que le cabinet peut prendre en charge à votre place',
    ],
    prestaNote: "Aucune pièce d'identité n'est demandée à cette étape. Elles ne le seront que si l'analyse montre qu'elles sont nécessaires.",

    reassurance: [
        { icon: UserCheck, title: 'Analysé par un humain', desc: 'Un analyste relit et signe chaque fiche avant remise.' },
        { icon: ShieldCheck, title: 'Aucune promesse de résultat', desc: 'La décision appartient aux autorités béninoises. Nous vous disons où vous en êtes, honnêtement.' },
        { icon: Lock, title: 'Vos données protégées', desc: 'Conservation limitée à 3 ans, aucune revente, effacement sur simple demande.' },
    ],

    faqEyebrow: 'Questions',
    faq: [
        {
            q: "Garantissez-vous l'obtention de la nationalité ?",
            r: "Non, et personne ne peut le faire honnêtement. Ce service vous dit précisément où en est votre dossier, ce qui le bloque et comment le débloquer. La décision appartient aux autorités béninoises.",
        },
        {
            q: "Faut-il envoyer mes pièces d'identité maintenant ?",
            r: "Non. À cette étape, nous ne demandons que votre identité de contact et le récit de votre situation. Les pièces ne sont réclamées qu'ensuite, si l'analyse montre qu'elles sont nécessaires.",
        },
        {
            q: 'Sous combien de temps ai-je la fiche ?',
            r: "Sous 48 heures ouvrées. Vous recevez d'abord un email de confirmation avec votre référence, puis la fiche relue par un analyste.",
        },
        {
            q: "Et si mon dossier n'a jamais existé chez MyAfroOrigins ?",
            r: "Dites-le simplement dans votre description. L'analyse portera alors sur la constitution d'un dossier neuf, et nous vous indiquerons par quoi commencer.",
        },
        {
            q: 'Que deviennent mes données ?',
            r: "Elles servent uniquement à traiter votre demande, sont conservées trois ans, et vous pouvez à tout moment demander à les consulter, les corriger ou les faire effacer. Traitement conforme à la loi n° 2017-20 (Code du numérique, Bénin).",
        },
    ],

    finalTitle: 'Votre dossier mérite une réponse',
    finalText: "Décrivez votre situation, réglez la fiche d'analyse, et recevez-la sous 48 heures ouvrées.",
    finalNote: 'Analyse écrite • Aucune pièce à fournir maintenant • Données protégées',

    // Une demande de récap ne se règle pas par un simple rendez-vous : elle
    // suppose le récit de la situation, le consentement au traitement des
    // données et le paiement. D'où l'écran dédié.
    primaryScreen: 'RecapMyafroDemande',
    primaryCtaLabel: 'Demander mon récap',
    stickyLabel: "Fiche d'analyse",
    stickyValue: 'Réponse sous 48 h ouvrées',
    stickyBtnLabel: 'Demander',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function RecapMyafroScreen({ navigation }: { navigation: any }) {
    return <ServiceRdvLanding navigation={navigation} content={CONTENT} />
}
