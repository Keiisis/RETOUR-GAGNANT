/* Création d'Entreprise - contenu (RDV/devis, sans paiement). Gabarit partagé
   ServiceRdvLanding. Fidèle à la maquette Sleek validée. */
import React from 'react'
import {
    Briefcase, CheckCircle, FileText, Building2, Users,
    Scale, FileCheck2, Globe, Network, Unlock, UserCheck, Eye,
} from 'lucide-react-native'
import ServiceRdvLanding, { type RdvLandingContent } from '../../components/ServiceRdvLanding'

const CONTENT: RdvLandingContent = {
    serviceLabel: "Création d'Entreprise",
    shareMessage: "Créez votre entreprise au Bénin depuis la diaspora avec Retour Gagnant : https://www.retourgagnantbenin.bj/services/business",
    heroIcon: Briefcase,
    badge: 'B2B & Investissement',
    title: 'Créez votre entreprise au Bénin, depuis la diaspora',
    subtitle: 'Un accompagnement juridique et administratif complet pour lancer votre projet sans vous déplacer.',
    chips: [
        { icon: CheckCircle, label: 'Création clé en main' },
        { icon: FileText, label: 'RCCM & fiscalité' },
        { icon: Building2, label: 'Compte bancaire pro' },
        { icon: Users, label: 'Réseau local' },
    ],
    trust: ['Premier échange gratuit', 'Interlocuteur unique', 'Transparence'],
    piliers: [
        { icon: Scale, title: 'Conseil Expert', desc: 'Choix de la structure (SARL, SAS, EI) adapté à votre projet.' },
        { icon: FileCheck2, title: 'Conformité', desc: 'Enregistrements légaux et fiscaux garantis sans failles.' },
        { icon: Globe, title: '100% à distance', desc: 'Signatures et formalités gérées sans voyager.' },
        { icon: Network, title: 'Réseau Business', desc: 'Accès direct aux banques et notaires partenaires.' },
    ],
    missionEyebrow: 'Notre mission',
    missionTitle: 'Sécuriser votre investissement entrepreneurial.',
    missionText: "Entreprendre au Bénin depuis l'étranger demande une rigueur juridique et un réseau de confiance. Nous sommes votre bras droit local pour transformer votre vision en une entité légale prospère.",
    etapesEyebrow: 'Processus de création',
    etapes: [
        { num: '01', title: 'Structuration juridique', desc: 'Analyse de votre projet et rédaction des statuts par nos juristes.' },
        { num: '02', title: 'Formalités & Compte pro', desc: 'Immatriculation au RCCM, IFU et ouverture de compte bancaire professionnel.' },
        { num: '03', title: 'Lancement & Réseau', desc: 'Mise en relation avec notre écosystème de partenaires locaux pour votre démarrage.' },
    ],
    contrastEyebrow: 'La différence',
    contrastPre: 'Entreprendre à distance,',
    contrastAccent: 'sans partenaire fiable',
    contrastPost: ", c'est risqué.",
    contrastSub: "Ne laissez pas l'incertitude freiner vos ambitions.",
    soloTitle: 'En solo au pays',
    solo: [
        "Files d'attente interminables aux guichets administratifs.",
        'Insécurité juridique liée aux prête-noms et intermédiaires non agréés.',
        'Délais imprévisibles et absence de suivi structuré.',
        'Frais cachés et corruption par manque de transparence.',
    ],
    avecTitle: 'Avec Retour Gagnant',
    avec: [
        'Gestion 100% à distance depuis votre pays de résidence.',
        'Cabinet agréé assurant une conformité légale totale.',
        'Réseau de partenaires bancaires et notaires pré-validés.',
        'Suivi en temps réel via WhatsApp et votre dossier digital.',
    ],
    prestaEyebrow: 'Prestations incluses',
    prestaTitle: 'Un pack complet pour réussir.',
    presta: [
        'Rédaction des statuts personnalisés',
        'Immatriculation au RCCM',
        'Obtention du numéro IFU',
        'Carte de Commerçant / Importateur',
        'Compte bancaire pro (UBA, BOA, etc.)',
        'Domiciliation initiale (si requise)',
    ],
    prestaNote: 'Note : les frais de greffe et honoraires de notaire sont inclus dans nos devis personnalisés.',
    reassurance: [
        { icon: Unlock, title: 'Sans engagement', desc: 'Devis gratuit et sans frais cachés.' },
        { icon: UserCheck, title: 'Interlocuteur unique', desc: 'Un conseiller dédié pour tout le process.' },
        { icon: Eye, title: 'Transparence', desc: "Suivi administratif via l'application." },
    ],
    faqEyebrow: 'Questions fréquentes',
    faq: [
        { q: 'Puis-je créer ma société sans venir au Bénin ?', r: "Oui. Nous réalisons l'intégralité des formalités sur place (statuts, RCCM, IFU) et ne sollicitons votre présence ou votre signature que lorsque c'est strictement nécessaire, le plus souvent à distance." },
        { q: 'Quel est le capital minimum requis ?', r: 'Pour une SARL au Bénin, le capital minimum légal est de 100 000 FCFA. Le montant conseillé dépend de votre activité ; nous vous orientons lors du premier échange.' },
        { q: "Quels sont les délais d'immatriculation ?", r: "Comptez en général 5 à 10 jours ouvrés pour l'immatriculation au RCCM et l'obtention de l'IFU, une fois votre dossier complet." },
        { q: "Comment se passe l'ouverture du compte ?", r: "Nous constituons votre dossier bancaire et vous mettons en relation avec nos banques partenaires (UBA, BOA, etc.) pour ouvrir votre compte professionnel, à distance quand c'est possible." },
    ],
    finalTitle: 'Prêt à lancer votre projet ?',
    finalText: 'Discutez gratuitement de votre projet avec un expert en investissement local.',
    finalNote: 'Premier échange gratuit • Devis clair • Sans engagement',
    primaryCtaLabel: 'Prendre rendez-vous',
    stickyLabel: 'Conseil & Devis',
    stickyValue: 'Gratuit sous 24h',
    stickyBtnLabel: 'Prendre RDV',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function BusinessScreen({ navigation }: { navigation: any }) {
    return <ServiceRdvLanding navigation={navigation} content={CONTENT} />
}
