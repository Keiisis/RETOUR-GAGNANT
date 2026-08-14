/* Construction - contenu (RDV/devis, sans paiement). Gabarit partagé.
   Contenu fidèle au web (DEFAULT_CONSTRUCTION). */
import React from 'react'
import {
    HardHat, MapPin, Camera, CheckCircle, Wallet, Eye, Unlock, UserCheck,
} from 'lucide-react-native'
import ServiceRdvLanding, { type RdvLandingContent } from '../../components/ServiceRdvLanding'

const CONTENT: RdvLandingContent = {
    serviceLabel: 'Construction',
    shareMessage: "Construisez au Bénin sous l'œil d'un représentant de confiance, par Retour Gagnant : https://www.retourgagnantbenin.bj/services/construction",
    heroIcon: HardHat,
    badge: "Suivi de chantier & maîtrise d'ouvrage",
    title: "Construisez au Bénin, sans y être, sous l'œil d'un représentant de confiance",
    subtitle: 'Devis approximatifs, délais non tenus, matériaux de qualité variable : les risques sont réels. Nous sommes votre représentant exigeant, présent à chaque étape du chantier.',
    chips: [
        { icon: MapPin, label: 'Représentant sur place' },
        { icon: Camera, label: 'Rapports hebdo photos/vidéos' },
        { icon: CheckCircle, label: 'Contrôle qualité' },
        { icon: Wallet, label: 'Devis maîtrisés' },
    ],
    trust: ['Premier échange gratuit', 'Référent dédié', 'Transparence'],
    piliers: [
        { icon: MapPin, title: 'Votre représentant', desc: 'Présent physiquement sur le chantier.' },
        { icon: Eye, title: 'Transparence totale', desc: 'Rapports WhatsApp chaque semaine.' },
        { icon: CheckCircle, title: 'Qualité contrôlée', desc: 'Matériaux et travaux vérifiés.' },
        { icon: Wallet, title: 'Budget maîtrisé', desc: 'Factures fournisseurs validées.' },
    ],
    missionEyebrow: 'Notre métier',
    missionTitle: 'Votre investissement mérite un suivi professionnel.',
    missionText: "Construire au Bénin depuis l'étranger, c'est possible à condition d'être bien entouré. Nous agissons comme votre représentant sur place : présents à chaque étape, exigeants sur la qualité, transparents dans nos rapports.",
    etapesEyebrow: 'Notre mission',
    etapes: [
        { num: '01', title: 'Cadrage & plans', desc: "Aide à l'achat du terrain, bureau d'architecte, conception et devis maîtrisés." },
        { num: '02', title: 'Contrôle du chantier', desc: 'Visites régulières, sélection des matériaux, validation des factures fournisseurs.' },
        { num: '03', title: 'Livraison clé en main', desc: 'Réception des travaux, nettoyage et remise du chantier terminé.' },
    ],
    contrastEyebrow: 'La différence',
    contrastPre: 'Construire à distance,',
    contrastAccent: "sans contrôle, c'est le piège assuré.",
    contrastSub: 'Sans représentant exigeant sur place, un chantier dérape vite : surfacturation, retards et malfaçons. Nous veillons à votre place.',
    soloTitle: 'En solo, à distance',
    solo: [
        'Devis gonflés et coûts qui dérapent',
        'Délais non tenus, sans visibilité',
        'Matériaux de qualité variable',
        "Aucun contrôle réel sur l'avancement",
    ],
    avecTitle: 'Avec Retour Gagnant',
    avec: [
        'Visites et contrôle réguliers du chantier',
        'Rapports photos et vidéos chaque semaine',
        'Factures fournisseurs vérifiées et validées',
        'Livraison propre et conforme au projet',
    ],
    prestaEyebrow: 'Ce que nous prenons en charge',
    prestaTitle: 'Nos prestations',
    presta: [
        "Aide à l'achat et à la location de terrain ou de bien immobilier",
        "Bureau d'architecte : conception et plans techniques",
        'Surveillance et contrôle de chantier (visites régulières)',
        'Vérification et validation des factures fournisseurs',
        'Achats de matériaux : sélection et négociation',
        'Rapports WhatsApp hebdomadaires (photos et vidéos)',
        'Coordination des intervenants du chantier',
        'Livraison et nettoyage du chantier clé en main',
    ],
    prestaNote: 'Missions modulables (suivi mensuel, mission complète, audit ponctuel). Le périmètre est défini ensemble.',
    reassurance: [
        { icon: Unlock, title: 'Sans engagement', desc: 'Le premier échange est gratuit.' },
        { icon: UserCheck, title: 'Un référent dédié', desc: 'Le même interlocuteur sur le chantier.' },
        { icon: Eye, title: 'Transparence', desc: "Rapports réguliers, aucune zone d'ombre." },
    ],
    faqEyebrow: 'Questions fréquentes',
    faq: [
        { q: "À quelle fréquence suis-je informé de l'avancement ?", r: 'Vous recevez des rapports hebdomadaires avec photos et vidéos, et vous pouvez nous joindre à tout moment.' },
        { q: "Pouvez-vous gérer l'achat du terrain aussi ?", r: 'Oui. Nous vous accompagnons de la recherche et la sécurisation du terrain jusqu\'à la livraison de la construction.' },
        { q: 'Comment évitez-vous la surfacturation des matériaux ?', r: 'Nous sélectionnons et négocions les matériaux, et validons chaque facture fournisseur avant paiement.' },
        { q: 'Quelles formules proposez-vous ?', r: 'Suivi mensuel, mission complète ou audit ponctuel : nous adaptons la formule à votre projet et votre budget.' },
    ],
    finalTitle: 'Votre investissement mérite un suivi professionnel.',
    finalText: 'Nous contrôlons la qualité, maîtrisons le budget et vous rendons compte chaque semaine, jusqu\'à la remise des clés.',
    finalNote: 'Premier échange gratuit • Rapports transparents • Sans engagement',
    primaryCtaLabel: 'Prendre rendez-vous',
    stickyLabel: 'Conseil & Devis',
    stickyValue: 'Gratuit sous 24h',
    stickyBtnLabel: 'Prendre RDV',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function ConstructionScreen({ navigation }: { navigation: any }) {
    return <ServiceRdvLanding navigation={navigation} content={CONTENT} />
}
