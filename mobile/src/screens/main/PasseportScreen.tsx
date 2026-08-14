/* Passeport & Documents - contenu (RDV/devis, sans paiement). Gabarit partagé.
   Contenu fidèle au web (DEFAULT_PASSEPORT). */
import React from 'react'
import {
    BookMarked, FileCheck2, ShieldCheck, Eye, Zap, Unlock, UserCheck, Lock,
} from 'lucide-react-native'
import ServiceRdvLanding, { type RdvLandingContent } from '../../components/ServiceRdvLanding'

const CONTENT: RdvLandingContent = {
    serviceLabel: 'Passeport & Documents',
    shareMessage: 'Passeport biométrique béninois : accompagnement complet par Retour Gagnant : https://www.retourgagnantbenin.bj/services/passeport',
    heroIcon: BookMarked,
    badge: 'Passeport & documents officiels',
    title: 'Passeport biométrique béninois : accompagnement complet',
    subtitle: "Documents officiels et accompagnement pour la diaspora béninoise. Constitution du dossier, coordination avec les autorités et suivi jusqu'à la remise de votre titre.",
    chips: [
        { icon: FileCheck2, label: 'Dossier pris en charge' },
        { icon: ShieldCheck, label: 'Coordination officielle' },
        { icon: Eye, label: "Suivi jusqu'à la remise" },
        { icon: Zap, label: 'Option express jour-J' },
    ],
    trust: ['Premier appel gratuit', 'Référent dédié', 'Confidentialité'],
    piliers: [
        { icon: FileCheck2, title: 'Dossier maîtrisé', desc: 'Constitué et vérifié pièce par pièce.' },
        { icon: ShieldCheck, title: 'Coordination officielle', desc: 'Avec les autorités compétentes.' },
        { icon: Eye, title: 'Suivi transparent', desc: 'Jusqu\'à la remise de votre titre.' },
        { icon: Zap, title: 'Pack VIP express', desc: 'Traitement possible en une journée.' },
    ],
    missionEyebrow: 'Notre métier',
    missionTitle: 'Un accompagnement structuré, sans improvisation.',
    missionText: "Nous prenons en charge l'ensemble des démarches liées à l'obtention ou au renouvellement de votre passeport biométrique béninois. Constitution du dossier, coordination avec les autorités compétentes et suivi jusqu'à la remise de votre titre.",
    etapesEyebrow: 'Pack VIP : en une journée',
    etapes: [
        { num: '01', title: 'Enrôlement État Civil', desc: 'Obtention de votre extrait de naissance certifié conforme auprès des autorités de l\'état civil béninois.' },
        { num: '02', title: "Carte d'Identité (CIP A)", desc: 'Constitution du dossier et enrôlement biométrique pour votre titre d\'identité officiel béninois.' },
        { num: '03', title: 'Passeport Express Jour-J', desc: 'Prise en charge prioritaire de votre demande de passeport biométrique : déposée et traitée le jour même.' },
    ],
    contrastEyebrow: 'La différence',
    contrastPre: 'Une démarche officielle,',
    contrastAccent: 'des pièces qui ne tolèrent aucune erreur.',
    contrastSub: "Un document manquant, périmé ou non conforme, et le rendez-vous saute. Depuis l'étranger, chaque aller-retour coûte du temps et de l'argent. Nous sécurisons chaque étape.",
    soloTitle: 'En solo, à distance',
    solo: [
        'Pièces non conformes = rendez-vous refusé',
        "Files d'attente et déplacements depuis l'étranger",
        'Exigences biométriques mal comprises',
        'Délais qui s\'allongent sans visibilité',
    ],
    avecTitle: 'Avec Retour Gagnant',
    avec: [
        'Chaque pièce vérifiée et conforme avant dépôt',
        'Coordination avec les autorités compétentes',
        'Option Pack VIP : état civil → CIP → passeport en un jour',
        'Suivi transparent jusqu\'à la remise du titre',
    ],
    prestaEyebrow: 'On sait exactement quoi réunir',
    prestaTitle: 'Pièces à fournir',
    presta: [
        'Copie intégrale du passeport en cours de validité',
        'Acte de naissance certifié conforme (mairie béninoise)',
        'Certificat de nationalité béninoise (Tribunal de Première Instance)',
        "Carte d'Identité Personnelle (CIP A) en cours de validité",
        'Casier judiciaire béninois : Bulletin n°3 (moins de 3 mois)',
        'Justificatif de domicile de moins de 3 mois',
        "4 photos d'identité biométriques (fond blanc, 3,5 × 4,5 cm)",
        'Formulaire officiel de demande de passeport rempli et signé',
    ],
    prestaNote: 'Cette liste peut varier selon votre situation. Nos conseillers vous transmettent la liste définitive lors du rendez-vous.',
    reassurance: [
        { icon: Unlock, title: 'Sans engagement', desc: 'Le premier appel de 15 min est gratuit.' },
        { icon: UserCheck, title: 'Un référent dédié', desc: 'La même personne suit votre dossier.' },
        { icon: Lock, title: 'Confidentialité', desc: 'Vos documents restent strictement privés.' },
    ],
    faqEyebrow: 'Questions fréquentes',
    faq: [
        { q: "Puis-je faire ma demande depuis l'étranger ?", r: 'Oui. Nous préparons et coordonnons votre dossier à distance et vous indiquons précisément les étapes qui nécessitent votre présence.' },
        { q: 'En quoi consiste le Pack VIP express ?', r: "Une prise en charge intégrale et prioritaire, de l'état civil à la délivrance du passeport, organisée pour être traitée en une seule journée." },
        { q: "Que se passe-t-il s'il me manque une pièce ?", r: 'Nous vous indiquons les documents alternatifs acceptés et vous aidons à les obtenir avant tout dépôt, pour éviter un refus.' },
        { q: "Combien de temps prend l'obtention ?", r: 'Cela dépend de la formule choisie et des autorités. Nous vous donnons une estimation réaliste dès l\'analyse de votre dossier.' },
    ],
    finalTitle: 'Un passeport, ça se prépare, ça ne s\'improvise pas.',
    finalText: 'Nous constituons un dossier conforme, coordonnons avec les autorités et vous suivons jusqu\'à la remise de votre titre.',
    finalNote: 'Premier appel de 15 min gratuit • Sans engagement',
    primaryCtaLabel: 'Prendre rendez-vous',
    stickyLabel: 'Conseil & Devis',
    stickyValue: 'Appel gratuit 15 min',
    stickyBtnLabel: 'Prendre RDV',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function PasseportScreen({ navigation }: { navigation: any }) {
    return <ServiceRdvLanding navigation={navigation} content={CONTENT} />
}
