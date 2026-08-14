/* Langues & Racines - contenu (RDV, sans paiement) + bloc « Choisir mon format ».
   Gabarit partagé ServiceRdvLanding. Fidèle à la maquette Sleek exportée. */
import React from 'react'
import {
    Languages, Mic, Video, UserCheck, Dna, Clock, MapPin, Award, Monitor, Gift,
} from 'lucide-react-native'
import ServiceRdvLanding, { type RdvLandingContent } from '../../components/ServiceRdvLanding'

const CONTENT: RdvLandingContent = {
    serviceLabel: 'Langues & Racines',
    shareMessage: 'Apprenez la langue de vos ancêtres (fon, yoruba, goun, mina) avec Retour Gagnant : https://www.retourgagnantbenin.bj/services/langues-racines',
    heroIcon: Languages,
    badge: 'Langues & Racines',
    title: 'La langue de vos ancêtres est la première porte du retour',
    subtitle: 'Le fon, le yoruba, le goun ou le mina portent la mémoire de votre lignée. Apprenez-les en immersion au Bénin ou en visioconférence.',
    chips: [
        { icon: Mic, label: 'Locuteurs natifs' },
        { icon: Languages, label: 'Fon · Yoruba · Goun · Mina' },
        { icon: Video, label: 'Présentiel ou visio' },
        { icon: UserCheck, label: 'Parcours personnalisé' },
    ],
    trust: ['Premier RDV gratuit', 'Locuteurs natifs', 'Sur mesure'],
    piliers: [
        { icon: Mic, title: 'Locuteurs natifs', desc: 'Apprentissage authentique avec des experts locaux passionnés.' },
        { icon: Dna, title: 'Votre langue', desc: 'Le dialecte précis de votre lignée familiale respecté.' },
        { icon: Clock, title: 'À votre rythme', desc: 'Progression adaptée, de débutant complet à avancé.' },
        { icon: MapPin, title: 'Deux formats', desc: 'En présentiel au Bénin ou en visioconférence partout.' },
    ],
    missionEyebrow: 'Notre métier',
    missionTitle: "On ne revient jamais tout à fait chez soi tant qu'on n'en parle pas la langue.",
    missionText: "Notre programme de transmission linguistique ne se limite pas à la grammaire. C'est une immersion dans la culture, les proverbes et la vision du monde portée par nos langues nationales.",
    etapesEyebrow: 'Comment ça se passe',
    etapes: [
        { num: '01', title: 'Premier rendez-vous', desc: 'Échange gratuit pour identifier vos racines et vos objectifs personnels.' },
        { num: '02', title: 'Parcours personnalisé', desc: 'Définition de votre programme, de la fréquence et du choix du format idéal.' },
        { num: '03', title: 'Immersion culturelle', desc: "Début de l'apprentissage avec un locuteur natif et connexion au patrimoine." },
    ],
    contrastEyebrow: 'La différence',
    contrastPre: "Apprendre sa langue d'origine,",
    contrastAccent: "ça ne s'apprend pas dans une appli.",
    contrastSub: 'Le fon, le yoruba ou le goun ne se résument pas à du vocabulaire : ils portent une culture. Sans locuteur natif ni immersion, on passe à côté de l\'essentiel.',
    soloTitle: 'En solo',
    solo: [
        'Ressources rares, souvent inexactes ou incomplètes',
        'Aucune immersion, progression purement théorique',
        'Prononciation et codes culturels mal transmis',
        'Motivation difficile à maintenir seul sur le long terme',
    ],
    avecTitle: 'Avec Retour Gagnant',
    avec: [
        'Locuteurs natifs certifiés pour chaque langue',
        'Apprentissage ciblé selon votre lignée familiale',
        'Immersion culturelle et contexte historique',
        'Programme personnalisé en présentiel ou visio',
    ],
    formatSelector: {
        eyebrow: 'Composez votre parcours',
        title: 'Choisir mon format',
        formatLabel: "Format d'apprentissage",
        formats: [
            { icon: MapPin, label: 'En présentiel' },
            { icon: Video, label: 'Visioconférence' },
        ],
        languesLabel: 'Langue souhaitée',
        langues: ['Fon', 'Yoruba', 'Goun', 'Mina'],
        niveauLabel: 'Niveau actuel',
        niveaux: ['Débutant', 'Intermédiaire', 'Avancé'],
        note: 'Premier rendez-vous gratuit pour définir votre programme sur mesure.',
    },
    stickyScrollToSelector: true,
    prestaEyebrow: 'Nos parcours',
    prestaTitle: 'Un parcours pensé pour la diaspora.',
    presta: [
        'Cours assurés par des locuteurs natifs',
        'Choix entre 4 langues nationales',
        'Tous niveaux, de débutant à avancé',
        'Immersion culturelle et linguistique',
        'Format flexible : présentiel ou visio',
        'Programme 100% personnalisé',
    ],
    prestaNote: 'Supports de cours numériques et audios inclus dans tous nos parcours.',
    reassurance: [
        { icon: Gift, title: 'Premier RDV gratuit', desc: 'Pour définir votre parcours.' },
        { icon: Award, title: 'Locuteurs natifs', desc: 'Une transmission authentique.' },
        { icon: Monitor, title: 'Deux formats', desc: 'Présentiel au Bénin ou visio.' },
    ],
    faqEyebrow: 'Foire aux questions',
    faq: [
        { q: 'Quelles langues sont proposées ?', r: 'Fon, Yoruba, Goun ou Mina, selon votre lignée et votre région d\'origine. Nous vous orientons lors du premier rendez-vous.' },
        { q: 'Faut-il avoir des bases ?', r: 'Non. Nos parcours vont du niveau débutant à avancé et s\'adaptent à votre rythme.' },
        { q: 'Peut-on changer de format en cours ?', r: "Oui. Vous pouvez passer du présentiel à la visioconférence (ou l'inverse) selon vos disponibilités ; nous adaptons votre parcours." },
    ],
    finalTitle: 'Renouez le fil, un mot à la fois.',
    finalText: 'Identifiez la langue de vos ancêtres et commencez votre voyage linguistique dès aujourd\'hui.',
    finalNote: 'Premier rendez-vous gratuit • Présentiel ou visio',
    primaryCtaLabel: 'Prendre rendez-vous',
    stickyLabel: 'Premier RDV',
    stickyValue: 'Gratuit',
    stickyBtnLabel: 'Choisir mon format',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function LanguesScreen({ navigation }: { navigation: any }) {
    return <ServiceRdvLanding navigation={navigation} content={CONTENT} />
}
