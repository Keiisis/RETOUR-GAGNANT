/* Investissement - contenu (RDV/devis, sans paiement). Gabarit ServiceRdvLanding.
   Contenu fidèle au web (DEFAULT_INVESTISSEMENT). */
import React from 'react'
import {
    TrendingUp, CheckCircle, ShieldCheck, Scale, Search, LineChart, Unlock, Eye,
} from 'lucide-react-native'
import ServiceRdvLanding, { type RdvLandingContent } from '../../components/ServiceRdvLanding'

const CONTENT: RdvLandingContent = {
    serviceLabel: 'Investissement',
    shareMessage: 'Investissez au Bénin en connaissance de cause avec Retour Gagnant : https://www.retourgagnantbenin.bj/services/investissement',
    heroIcon: TrendingUp,
    badge: 'Opportunités & investissement',
    title: 'Investissez au Bénin, avec une lecture fine du terrain',
    subtitle: "Le Bénin connaît une dynamique économique réelle. Les opportunités existent dans l'immobilier, l'agriculture, le commerce et les services, mais elles demandent d'évaluer les risques et de structurer dans le cadre juridique local.",
    chips: [
        { icon: CheckCircle, label: 'Opportunités vérifiées' },
        { icon: ShieldCheck, label: 'Évaluation des risques' },
        { icon: Scale, label: 'Cadre juridique local' },
        { icon: TrendingUp, label: 'Suivi & optimisation' },
    ],
    trust: ['Premier échange gratuit', 'Analyse honnête', 'Cadre légal'],
    piliers: [
        { icon: Search, title: 'Opportunités sérieuses', desc: 'Projets identifiés et vérifiés.' },
        { icon: ShieldCheck, title: 'Risques maîtrisés', desc: 'Analyse approfondie avant tout.' },
        { icon: Scale, title: 'Cadre légal', desc: 'Respect strict du droit local.' },
        { icon: LineChart, title: 'Suivi actif', desc: 'Optimisation dans la durée.' },
    ],
    missionEyebrow: 'Notre métier',
    missionTitle: 'Investir au Bénin en connaissance de cause.',
    missionText: "Le Bénin connaît une dynamique économique portée par des réformes structurelles et des investissements publics soutenus. Nous vous aidons à identifier des projets sérieux, à évaluer les risques réels et à structurer vos investissements dans le respect du cadre juridique local.",
    etapesEyebrow: 'Notre méthode',
    etapes: [
        { num: '01', title: 'Identification', desc: "Repérage d'opportunités sérieuses : immobilier, agriculture, commerce, services." },
        { num: '02', title: 'Évaluation des risques', desc: 'Analyse financière, juridique et opérationnelle approfondie de chaque projet.' },
        { num: '03', title: 'Structuration & suivi', desc: 'Montage dans le cadre légal local, puis suivi et optimisation de vos placements.' },
    ],
    contrastEyebrow: 'La différence',
    contrastPre: 'Investir de loin,',
    contrastAccent: "sans évaluation, c'est jouer à l'aveugle.",
    contrastSub: 'Projets fantômes, risques juridiques sous-estimés, absence de suivi : investir à distance sans lecture du terrain expose à des pertes évitables.',
    soloTitle: 'En solo, à distance',
    solo: [
        'Opportunités difficiles à vérifier à distance',
        'Risques juridiques et fonciers sous-estimés',
        'Aucun suivi réel sur place',
        'Exposition aux arnaques et projets fantômes',
    ],
    avecTitle: 'Avec Retour Gagnant',
    avec: [
        'Projets sérieux identifiés et vérifiés',
        'Évaluation approfondie des risques',
        'Structuration dans le cadre légal local',
        'Suivi et optimisation de vos investissements',
    ],
    prestaEyebrow: 'Ce que nous proposons',
    prestaTitle: 'Nos prestations',
    presta: [
        'Vente exclusive de particuliers à particuliers (terrain, immeuble, maison)',
        'Projets agricoles rentables et autres secteurs porteurs',
        'Évaluation approfondie des risques financiers, juridiques et opérationnels',
        "Veilles d'opportunités : marchés, appels d'offres, partenariats",
        'Suivi et optimisation de vos investissements au Bénin',
        'Stratégies fiscales adaptées au contexte local',
    ],
    prestaNote: 'Prestations modulables (étude de marché, accompagnement complet, consultation). Le périmètre est défini ensemble.',
    reassurance: [
        { icon: Unlock, title: 'Sans engagement', desc: 'Le premier échange est gratuit.' },
        { icon: Eye, title: 'Analyse honnête', desc: 'Nous signalons aussi les risques.' },
        { icon: ShieldCheck, title: 'Cadre légal', desc: 'Tout est structuré dans les règles.' },
    ],
    faqEyebrow: 'Questions fréquentes',
    faq: [
        { q: "Dans quels secteurs pouvez-vous m'accompagner ?", r: "Immobilier, agriculture, commerce et services, notamment. Nous évaluons l'opportunité selon votre profil et vos objectifs." },
        { q: 'Comment vérifiez-vous le sérieux d\'un projet ?', r: 'Par une due diligence financière, juridique et opérationnelle, et une vérification sur le terrain avant toute recommandation.' },
        { q: "M'aidez-vous à sécuriser juridiquement l'investissement ?", r: "Oui. Nous structurons l'opération dans le cadre légal local et vous conseillons sur la fiscalité applicable." },
        { q: "Assurez-vous un suivi après l'investissement ?", r: 'Oui, nous assurons le suivi et l\'optimisation de vos placements dans la durée.' },
    ],
    finalTitle: 'Faites fructifier votre héritage, en connaissance de cause.',
    finalText: 'Des opportunités vérifiées, des risques évalués et une structuration légale : investissez au Bénin sans naviguer à l\'aveugle.',
    finalNote: 'Premier échange gratuit • Analyse honnête • Sans engagement',
    primaryCtaLabel: 'Prendre rendez-vous',
    stickyLabel: 'Conseil & Devis',
    stickyValue: 'Gratuit sous 24h',
    stickyBtnLabel: 'Prendre RDV',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function InvestissementScreen({ navigation }: { navigation: any }) {
    return <ServiceRdvLanding navigation={navigation} content={CONTENT} />
}
