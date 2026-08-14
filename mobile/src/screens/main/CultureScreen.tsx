/* Guide Culturel - contenu (RDV/devis, sans paiement). Gabarit ServiceRdvLanding.
   Contenu fidèle au web (DEFAULT_CULTURE). */
import React from 'react'
import {
    Compass, BookOpen, Map, Users, MapPin, Heart, Sparkles, Unlock,
} from 'lucide-react-native'
import ServiceRdvLanding, { type RdvLandingContent } from '../../components/ServiceRdvLanding'

const CONTENT: RdvLandingContent = {
    serviceLabel: 'Guide Culturel',
    shareMessage: "Vivez le Bénin authentique avec un guide historien, par Retour Gagnant : https://www.retourgagnantbenin.bj/services/culture",
    heroIcon: Compass,
    badge: 'Tourisme & immersion culturelle',
    title: "Le Bénin authentique, vécu de l'intérieur",
    subtitle: "Loin des circuits standardisés, une immersion sincère dans les traditions, les savoirs et les rencontres qui font l'identité profonde du Bénin. Ici, la culture se vit, elle ne se contemple pas de loin.",
    chips: [
        { icon: BookOpen, label: 'Guide historien expert' },
        { icon: Map, label: 'Séjours sur mesure' },
        { icon: Users, label: 'Rencontres authentiques' },
        { icon: MapPin, label: 'Ganvié · Ouidah · Abomey' },
    ],
    trust: ['Premier échange gratuit', 'Guide dédié', 'Sur mesure'],
    piliers: [
        { icon: Heart, title: 'Immersion sincère', desc: 'Loin du tourisme de masse.' },
        { icon: BookOpen, title: 'Guide expert', desc: 'Historien passionné du Bénin.' },
        { icon: Sparkles, title: 'Sur mesure', desc: 'Un programme pensé pour vous.' },
        { icon: Users, title: 'Rencontres rares', desc: 'Dignitaires, rois, artisans.' },
    ],
    missionEyebrow: 'Notre métier',
    missionTitle: 'Une immersion sincère, guidée avec passion.',
    missionText: "Le Bénin est l'un des berceaux les plus vivants de la culture africaine. Nous vous proposons une immersion sincère dans les traditions, les savoirs et les rencontres qui font l'identité profonde de ce pays, accompagnés d'un guide historien passionné, dans le respect des lieux et des personnes.",
    etapesEyebrow: 'Comment ça se passe',
    etapes: [
        { num: '01', title: 'Définition du programme', desc: 'Nous construisons votre parcours selon vos envies, vos racines et le temps dont vous disposez.' },
        { num: '02', title: 'Organisation sur place', desc: 'Logistique, hébergement, guide et rencontres : tout est coordonné localement.' },
        { num: '03', title: 'Immersion accompagnée', desc: 'Un guide historien vous accompagne à chaque étape, pour une expérience qui a du sens.' },
    ],
    contrastEyebrow: 'La différence',
    contrastPre: 'Un voyage au Bénin,',
    contrastAccent: "ça ne s'improvise pas depuis l'étranger.",
    contrastSub: 'Circuits sans âme, rencontres impossibles à organiser seul, codes culturels méconnus : découvrir vraiment le Bénin demande un relais de confiance sur place.',
    soloTitle: 'En solo, à distance',
    solo: [
        'Circuits touristiques standardisés, sans profondeur',
        'Rencontres authentiques impossibles à obtenir seul',
        'Logistique locale complexe à distance',
        'Barrière de la langue et des codes sociaux',
    ],
    avecTitle: 'Avec Retour Gagnant',
    avec: [
        'Programme sur mesure, selon vos racines',
        'Accès à des rencontres rares (dignitaires, artisans)',
        'Logistique et guide gérés de bout en bout',
        'Immersion respectueuse et sincère',
    ],
    prestaEyebrow: 'Ce que nous proposons',
    prestaTitle: 'Nos expériences',
    presta: [
        'Consultation du Fa : oracle traditionnel yoruba-fon',
        'Cérémonie du Nom et validation à l\'état civil',
        'Soins par les plantes et approche de la médecine ancestrale',
        'Audience privée avec dignitaires et rois traditionnels',
        'Initiation et sensibilisation à la culture vodoun',
        'Programmes de visite : Ganvié, Ouidah, Abomey, Porto-Novo',
        'Guide historien expert et passionné par l\'histoire du Bénin',
        'Ateliers culinaires : recettes et saveurs béninoises',
        'Découverte de l\'artisanat local et des savoir-faire traditionnels',
    ],
    prestaNote: 'Programmes modulables et personnalisables. Un premier échange permet de définir votre séjour idéal.',
    reassurance: [
        { icon: Unlock, title: 'Sans engagement', desc: 'Le premier échange est gratuit.' },
        { icon: BookOpen, title: 'Guide dédié', desc: 'Un historien passionné à vos côtés.' },
        { icon: Sparkles, title: 'Sur mesure', desc: 'Un programme adapté à vos envies.' },
    ],
    faqEyebrow: 'Questions fréquentes',
    faq: [
        { q: 'Puis-je personnaliser entièrement mon séjour ?', r: "Oui. Chaque programme est construit avec vous, selon vos centres d'intérêt, vos racines et votre rythme." },
        { q: "Gérez-vous l'hébergement et les déplacements ?", r: 'Oui, nous coordonnons la logistique complète sur place : hébergement, transport et rencontres.' },
        { q: 'Les rencontres avec des dignitaires sont-elles garanties ?', r: 'Nous organisons ces rencontres selon les disponibilités et le protocole. Nous vous indiquons ce qui est possible dès la préparation.' },
        { q: 'Faut-il parler une langue locale ?', r: 'Non. Votre guide assure la traduction et vous initie aux codes culturels tout au long du séjour.' },
    ],
    finalTitle: 'Reconnectez-vous à vos racines, pour de vrai.',
    finalText: 'Un séjour pensé pour vous, guidé par un passionné, au plus près de l\'âme du Bénin.',
    finalNote: 'Premier échange gratuit • Programme sur mesure • Sans engagement',
    primaryCtaLabel: 'Préparer mon séjour',
    stickyLabel: 'Séjour sur mesure',
    stickyValue: 'Devis gratuit sous 24h',
    stickyBtnLabel: 'Préparer',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function CultureScreen({ navigation }: { navigation: any }) {
    return <ServiceRdvLanding navigation={navigation} content={CONTENT} />
}
