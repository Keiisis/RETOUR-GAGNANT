/* Recherche Ancestrale - contenu (RDV, sans paiement à l'écran ; le forfait est
   fixé plus tard, par dossier, par l'équipe). Gabarit partagé ServiceRdvLanding.
   Fidèle à la maquette Sleek exportée + contenu web (DEFAULT_RECHERCHE_ANCESTRALE). */
import React from 'react'
import {
    GitBranch, Library, Database, Users, ShieldCheck, Unlock, Lock,
} from 'lucide-react-native'
import ServiceRdvLanding, { type RdvLandingContent } from '../../components/ServiceRdvLanding'

const CONTENT: RdvLandingContent = {
    serviceLabel: 'Recherche Ancestrale',
    shareMessage: "Retrouvez la trace de vos ancêtres avec Retour Gagnant : https://www.retourgagnantbenin.bj/services/recherche-ancestrale",
    heroIcon: GitBranch,
    badge: 'Recherche ancestrale & généalogie',
    title: "Retrouvez la trace de ceux que l'histoire a effacés",
    subtitle: 'Pour des millions de descendants, le lien a été rompu. Nous mobilisons archives officielles, bases de données spécialisées et associations expertes pour reconstituer votre lignée africaine avec méthode et respect.',
    chips: [
        { icon: Library, label: 'Archives officielles' },
        { icon: Database, label: 'Bases spécialisées' },
        { icon: Users, label: 'Associations partenaires' },
        { icon: ShieldCheck, label: 'Accompagnement dédié' },
    ],
    trust: ['Premier échange gratuit', 'Confidentialité', 'Respect & méthode'],
    piliers: [
        { icon: Library, title: 'Archives officielles', desc: "Accès direct aux registres d'état civil et fonds coloniaux." },
        { icon: Database, title: 'Bases spécialisées', desc: 'Croisement avec les bases diasporiques mondiales.' },
        { icon: Users, title: 'Associations expertes', desc: 'Réseau local de généalogistes au Bénin et en Afrique.' },
        { icon: ShieldCheck, title: 'Accompagnement', desc: 'Un conseiller dédié pour interpréter chaque découverte.' },
    ],
    missionEyebrow: 'Notre métier',
    missionTitle: 'Restaurer la dignité du souvenir.',
    missionText: "La traite transatlantique a interrompu le fil de nombreuses familles. Notre mission est de renouer ce lien brisé, avec la rigueur d'une étude et le respect dû à vos ancêtres.",
    etapesEyebrow: 'Comment ça se passe',
    etapes: [
        { num: '01', title: 'Collecte des pièces', desc: 'Inventaire des documents familiaux en votre possession pour établir le point de départ.' },
        { num: '02', title: 'Recherche en archives', desc: 'Investigation croisée dans les registres nationaux, archives départementales et bases internationales.' },
        { num: '03', title: 'Reconstitution', desc: 'Avec nos associations partenaires, nous reconstituons le fil de votre lignée.' },
    ],
    contrastEyebrow: 'La différence',
    contrastPre: 'Reconstituer une lignée effacée,',
    contrastAccent: 'ça demande méthode et bons interlocuteurs.',
    contrastSub: "Sans accès aux archives ni aux réseaux spécialisés, la recherche s'arrête vite. Nous ouvrons les bonnes portes.",
    soloTitle: 'En solo',
    solo: [
        'Accès limité aux archives officielles',
        'Bases de données diasporiques méconnues',
        "Pièces d'état civil difficiles à obtenir",
        'Recherche qui s\'essouffle faute de réseau',
    ],
    avecTitle: 'Avec Retour Gagnant',
    avec: [
        "Consultation d'archives officielles",
        'Accès à des bases de données spécialisées',
        'Partenariats avec des associations expertes',
        'Un accompagnement méthodique et respectueux',
    ],
    prestaEyebrow: 'Ce que nous mobilisons',
    prestaTitle: 'Notre démarche',
    presta: [
        'Extrait de naissance de vos deux parents (père et mère)',
        'Extrait de naissance ou de décès de vos grands-parents (paternel et maternel)',
        'Actes de mariage, notariés, militaires ou de décès des arrière-grands-parents',
        "Consultation d'archives officielles et bases de données diasporiques",
        'Partenariats avec associations spécialisées en généalogie afro-descendante',
    ],
    prestaNote: "L'ensemble des pièces sont à transmettre par voie électronique : une démarche simple et sécurisée pour débuter votre recherche.",
    reassurance: [
        { icon: Unlock, title: 'Sans engagement', desc: 'Le premier échange est gratuit.' },
        { icon: Lock, title: 'Confidentialité', desc: 'Vos documents restent strictement privés.' },
        { icon: ShieldCheck, title: 'Respect & méthode', desc: 'Une démarche rigoureuse et humaine.' },
    ],
    faqEyebrow: 'Questions fréquentes',
    faq: [
        { q: 'Quelles pièces dois-je fournir pour commencer ?', r: 'Les actes disponibles de votre lignée (parents, grands-parents, arrière-grands-parents). Nous vous indiquons les alternatives pour ce qui manque.' },
        { q: 'Comment se déroule la recherche ?', r: 'Nous combinons archives officielles, bases de données diasporiques et associations partenaires pour reconstituer votre lignée.' },
        { q: 'Que se passe-t-il si des documents manquent ?', r: "C'est fréquent sur plusieurs générations. Nous explorons les sources alternatives et vous accompagnons pour reconstituer les pièces." },
    ],
    finalTitle: 'Renouez le fil interrompu de votre histoire.',
    finalText: 'Archives, bases de données et associations expertes : nous reconstituons votre lignée africaine, avec méthode et respect.',
    finalNote: 'Premier échange gratuit • Confidentialité garantie',
    primaryCtaLabel: 'Lancer ma recherche',
    stickyLabel: 'Premier échange',
    stickyValue: 'Gratuit',
    stickyBtnLabel: 'Lancer ma recherche',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function RechercheAncestraleScreen({ navigation }: { navigation: any }) {
    return <ServiceRdvLanding navigation={navigation} content={CONTENT} />
}
