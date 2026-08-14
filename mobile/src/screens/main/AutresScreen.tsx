/* Autres Services - contenu (contact-first, sans paiement). Gabarit partagé.
   Fidèle à la maquette Sleek complète (détail des services en cartes). */
import React from 'react'
import {
    Sparkles, Car, Stethoscope, GraduationCap, FileText, Plane, HeartPulse,
    BookOpen, ClipboardCheck, ShieldCheck, Settings2, PhoneCall,
} from 'lucide-react-native'
import ServiceRdvLanding, { type RdvLandingContent } from '../../components/ServiceRdvLanding'

const CONTENT: RdvLandingContent = {
    serviceLabel: 'Autres Services',
    shareMessage: 'Transport, santé, scolarité, démarches : le quotidien facilité au Bénin avec Retour Gagnant : https://www.retourgagnantbenin.bj/services/autres',
    heroIcon: Sparkles,
    badge: 'Services du quotidien',
    title: 'Transport, santé, scolarité : le quotidien facilité au Bénin',
    subtitle: "Parce que réussir son retour, c'est aussi s'assurer une vie quotidienne sereine pour soi et sa famille dès le premier jour.",
    chips: [
        { icon: Car, label: 'Transport & aéroport' },
        { icon: Stethoscope, label: 'Santé & cliniques' },
        { icon: GraduationCap, label: 'Scolarité' },
        { icon: FileText, label: 'Démarches' },
    ],
    trust: ['Accompagnement réactif', 'Réseau de confiance', 'Installation sereine'],
    piliers: [
        { icon: Plane, title: 'Arrivée sereine', desc: "Prise en charge dès la sortie de l'avion." },
        { icon: HeartPulse, title: 'Accès aux soins', desc: 'Mise en relation avec les meilleures cliniques.' },
        { icon: BookOpen, title: 'Scolarité', desc: "Inscription et suivi dans des écoles d'élite." },
        { icon: ClipboardCheck, title: 'Démarches', desc: 'Gestion des formalités locales complexes.' },
    ],
    missionEyebrow: 'Notre accompagnement',
    missionTitle: 'Le Bénin à vos côtés',
    missionText: "Nous avons sélectionné pour vous des partenaires rigoureux pour répondre à tous les besoins de votre nouvelle vie. Notre rôle est de vous mettre en relation avec les bons professionnels et de s'assurer du bon déroulement de chaque service.",
    etapesEyebrow: 'Comment ça marche',
    etapes: [
        { num: '01', title: 'Votre besoin', desc: 'Décrivez-nous votre besoin spécifique (transport, santé, école).' },
        { num: '02', title: 'Mise en relation', desc: 'Nous vous mettons en contact avec le partenaire certifié idéal.' },
        { num: '03', title: 'Suivi', desc: "Votre conseiller s'assure que le service répond à vos attentes." },
    ],
    contrastEyebrow: 'La différence',
    contrastPre: "S'installer au Bénin,",
    contrastAccent: "c'est mille petits détails à régler.",
    contrastSub: 'Transport, soins, école, papiers : seul et à distance, chaque détail devient un obstacle. Nous vous simplifions le quotidien.',
    soloTitle: 'En solo',
    solo: [
        'Chercher des prestataires au hasard',
        'Risques de surfacturation',
        'Absence de garantie de qualité',
        'Stress des imprévus',
    ],
    avecTitle: 'Avec Retour Gagnant',
    avec: [
        'Prestataires triés sur le volet',
        'Tarifs négociés',
        'Interlocuteur dédié',
        'Sérénité totale pour vous et vos proches',
    ],
    prestaEyebrow: 'Nos services',
    prestaTitle: 'Détail des services',
    presta: [],
    prestaCards: [
        { icon: Car, title: 'Transport & Véhicules', desc: 'Transferts aéroport, véhicule premium avec chauffeur privé pour vos déplacements professionnels ou familiaux.' },
        { icon: HeartPulse, title: 'Santé & Bien-être', desc: 'Mise en relation avec des médecins référents et les cliniques privées les plus modernes de Cotonou.' },
        { icon: GraduationCap, title: 'Inscription Scolaire', desc: "Accompagnement pour le choix de l'école et les démarches d'inscription pour vos enfants." },
        { icon: ClipboardCheck, title: 'Démarches Locales', desc: 'Ouverture de compte bancaire, abonnement internet, électricité et autres formalités indispensables.' },
    ],
    prestaNote: 'Un besoin particulier non listé ? Contactez-nous directement.',
    reassurance: [
        { icon: ShieldCheck, title: 'Partenaires de confiance', desc: 'Un réseau local sélectionné.' },
        { icon: Settings2, title: 'Sur mesure', desc: 'Nous étudions chaque demande.' },
        { icon: PhoneCall, title: 'Disponibles', desc: 'Un suivi dans la durée.' },
    ],
    faqEyebrow: 'Questions fréquentes',
    faq: [
        { q: 'Quels sont les délais de mise en relation ?', r: 'Nous revenons vers vous rapidement, généralement sous 24 à 48 h, pour vous orienter vers le bon partenaire.' },
        { q: 'Les prestataires sont-ils vérifiés ?', r: 'Oui. Nous ne travaillons qu\'avec des partenaires sélectionnés et éprouvés (cliniques, écoles, transporteurs).' },
        { q: 'Comment se passe le paiement des services ?', r: 'Selon la prestation, directement auprès du partenaire ou via nous. Tout est clair et convenu à l\'avance, sans surprise.' },
    ],
    finalTitle: "Besoin d'aide pour votre installation ?",
    finalText: 'Nos conseillers sont à votre écoute pour organiser votre quotidien au Bénin.',
    finalNote: 'Réponse rapide • Partenaires de confiance',
    primaryCtaLabel: 'Nous contacter',
    primaryContact: true,
    stickyLabel: 'Un besoin ?',
    stickyValue: 'Réponse rapide',
    stickyBtnLabel: 'Nous contacter',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function AutresScreen({ navigation }: { navigation: any }) {
    return <ServiceRdvLanding navigation={navigation} content={CONTENT} />
}
