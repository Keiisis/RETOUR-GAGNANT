/* Passeport : écran d'information.
   Depuis l'agrément de l'agence (décision du 18/11/2026), le passeport est
   gratuit et inclus dans la demande de nationalité : l'État le remet
   directement lors de la cérémonie officielle de remise. Il n'y a plus de
   démarche passeport séparée ; l'action principale ouvre la demande de
   nationalité (écran `NationaliteForm`). */
import React from 'react'
import {
    BookMarked, FileCheck2, ShieldCheck, Eye, Award, Unlock, UserCheck, Lock,
} from 'lucide-react-native'
import ServiceRdvLanding, { type RdvLandingContent } from '../../components/ServiceRdvLanding'

const CONTENT: RdvLandingContent = {
    serviceLabel: 'Passeport béninois',
    shareMessage: 'Passeport béninois : gratuit et inclus dans la demande de nationalité, avec Retour Gagnant : https://www.retourgagnantbenin.bj/services/passeport',
    heroIcon: BookMarked,
    badge: 'Gratuit — agence agréée',
    title: 'Votre passeport est inclus dans la demande de nationalité',
    subtitle: "Aucune démarche séparée, aucun frais : le passeport béninois fait partie de votre demande de nationalité. L'État vous le remet directement lors de la cérémonie officielle de remise.",
    chips: [
        { icon: FileCheck2, label: 'Inclus dans la nationalité' },
        { icon: ShieldCheck, label: 'Gratuit — agence agréée' },
        { icon: Award, label: 'Remis lors de la cérémonie' },
        { icon: Eye, label: 'Suivi de votre dossier' },
    ],
    trust: ['Gratuit', 'Inclus dans la nationalité', 'Remis par l’État'],
    piliers: [
        { icon: FileCheck2, title: 'Une seule demande', desc: 'La nationalité et le passeport ensemble.' },
        { icon: ShieldCheck, title: 'Gratuit', desc: 'Aucun frais de démarche.' },
        { icon: Award, title: 'Remise officielle', desc: 'Lors de la cérémonie de remise.' },
        { icon: Eye, title: 'Suivi transparent', desc: 'Jusqu’à la remise de votre titre.' },
    ],
    missionEyebrow: 'Ce qui change',
    missionTitle: 'Le passeport fait partie de la nationalité.',
    missionText: "Retour Gagnant Bénin est désormais une agence agréée. Votre demande de nationalité est gratuite et elle inclut le passeport béninois : vous n'avez aucune démarche passeport à engager de votre côté. L'État vous remet votre passeport directement, lors de la cérémonie officielle de remise.",
    etapesEyebrow: 'Comment cela se passe',
    etapes: [
        { num: '01', title: 'Demande de nationalité', desc: 'Vous déposez gratuitement votre demande de nationalité depuis l’application.' },
        { num: '02', title: 'Traitement du dossier', desc: 'L’agence vérifie vos pièces et assure le suivi auprès des autorités compétentes.' },
        { num: '03', title: 'Cérémonie de remise', desc: 'L’État vous remet directement votre passeport lors de la cérémonie officielle.' },
    ],
    contrastEyebrow: 'La différence',
    contrastPre: 'Une seule demande,',
    contrastAccent: 'un dossier suivi de bout en bout.',
    contrastSub: 'Vous n’avez plus à mener deux démarches en parallèle : le passeport suit votre dossier de nationalité.',
    soloTitle: 'Avant',
    solo: [
        'Une démarche passeport à engager à part',
        'Des pièces à fournir deux fois',
        'Des frais supplémentaires',
    ],
    avecTitle: 'Désormais',
    avec: [
        'Le passeport inclus dans la demande de nationalité',
        'Une seule demande, gratuite',
        'Une remise officielle par l’État lors de la cérémonie',
    ],
    prestaEyebrow: 'En pratique',
    prestaTitle: 'Ce que vous avez à faire',
    presta: [
        'Déposer votre demande de nationalité dans l’application',
        'Fournir les pièces demandées dans le formulaire',
        'Suivre l’avancement de votre dossier dans votre espace',
    ],
    prestaNote: 'Aucune démarche passeport séparée n’est à engager. Nos conseillers restent disponibles pour toute question.',
    reassurance: [
        { icon: Unlock, title: 'Gratuit', desc: 'Demande de nationalité et passeport sans frais.' },
        { icon: UserCheck, title: 'Un référent dédié', desc: 'La même personne suit votre dossier.' },
        { icon: Lock, title: 'Confidentialité', desc: 'Vos documents restent strictement privés.' },
    ],
    faqEyebrow: 'Questions fréquentes',
    faq: [
        { q: 'Dois-je faire une demande de passeport à part ?', r: 'Non. Le passeport est inclus dans votre demande de nationalité ; aucune démarche séparée n’est nécessaire.' },
        { q: 'Le passeport est-il payant ?', r: 'Non. La demande de nationalité et le passeport sont gratuits.' },
        { q: 'Comment vais-je recevoir mon passeport ?', r: 'L’État vous le remet directement lors de la cérémonie officielle de remise.' },
        { q: 'Puis-je faire ma demande depuis l’étranger ?', r: 'Oui. Vous déposez votre demande de nationalité depuis l’application et suivez votre dossier à distance.' },
    ],
    finalTitle: 'Une demande, votre nationalité et votre passeport.',
    finalText: 'Déposez gratuitement votre demande de nationalité : le passeport vous sera remis lors de la cérémonie officielle.',
    finalNote: 'Gratuit — agence agréée • Passeport inclus',
    primaryScreen: 'NationaliteForm',
    primaryCtaLabel: 'Faire ma demande de nationalité',
    stickyLabel: 'Passeport inclus',
    stickyValue: 'Gratuit — agence agréée',
    stickyBtnLabel: 'Ma demande',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function PasseportScreen({ navigation }: { navigation: any }) {
    return <ServiceRdvLanding navigation={navigation} content={CONTENT} />
}
