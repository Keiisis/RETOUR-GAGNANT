'use strict'
import React, { useEffect, useState, useCallback } from 'react'
import {
    View, Text, ScrollView, StyleSheet,
    Dimensions, Platform, RefreshControl, ActivityIndicator,
    Pressable, TouchableOpacity,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withDelay,
    withSpring,
    withTiming,
    withRepeat,
    withSequence,
    Easing,
    interpolate,
} from 'react-native-reanimated'
import { useLang } from '../../contexts/LangContext'
import { supabase } from '../../config/supabase'

/* ═══════════════════════════════════════════════════════════
   ServicesScreen — THEME "CORPORATE PREMIUM 2026"
   (Aligné avec RegisterScreen.tsx)
═══════════════════════════════════════════════════════════ */

const { width } = Dimensions.get('window')

// Palette de l'agence (identique à RegisterScreen)
const C = {
    bg: '#FFFFFF',
    surface: 'rgba(255, 255, 255, 0.92)',
    surfaceSolid: '#FFFFFF',
    border: 'rgba(16, 185, 129, 0.12)',

    primary: '#047857',      // Émeraude Profond (Identité App)
    accent: '#C9A84C',       // Or (Agence)
    accentDark: '#A68B3C',   // Or sombre
    accentLight: '#E2C97E',  // Or clair
    auraGreen: '#10B981',    // Émeraude vif
    error: '#EF4444',        // Rouge

    textSec: '#4A5568',
    placeholder: '#718096',
    primaryText: '#FFFFFF',
}

const CARD_GAP = 14
const H_PADDING = 20
const CARD_W = (width - H_PADDING * 2 - CARD_GAP) / 2

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PricingOption {
    label: string
    price: string
}

export interface ServiceFull {
    id: string
    icon: keyof typeof Ionicons.glyphMap
    title: string
    subtitle: string
    desc: string
    fullDescription: string
    duration: string
    price: string
    documents: string[]
    features: string[]
    pricing_options: PricingOption[]
    color: string
}

// ═══════════════════════════════════════════════════════════════════════════════
// DONNÉES SYNCHRONISÉES AVEC LE SITE WEB
// ═══════════════════════════════════════════════════════════════════════════════

export const SERVICES_DATA: ServiceFull[] = [
    {
        id: 'passeport',
        icon: 'document-text-outline',
        title: 'Passeport & Documents',
        subtitle: 'Documents officiels et accompagnement pour la diaspora béninoise',
        desc: 'Obtention et renouvellement de passeport, acte de naissance, légalisation et apostille — accompagnement complet pour vos démarches officielles.',
        fullDescription: "Nous prenons en charge l'ensemble des démarches liées à l'obtention ou au renouvellement de votre passeport biométrique béninois. Constitution du dossier, coordination avec les autorités compétentes et suivi jusqu'à la remise de votre titre — un accompagnement structuré, sans improvisation.",
        duration: '2 à 4 semaines',
        price: 'À partir de 50 000 FCFA',
        color: C.primary,
        features: [
            "Copie intégrale du passeport en cours de validité",
            "Acte de naissance certifié conforme délivré par la mairie béninoise",
            "Certificat de nationalité béninoise (Tribunal de Première Instance)",
            "Carte d'Identité Personnelle (CIP A) en cours de validité",
            "Extrait de casier judiciaire béninois — Bulletin n°3 (moins de 3 mois)",
            "Justificatif de domicile de moins de 3 mois (quittance ou bail)",
            "4 photos d'identité biométriques (fond blanc, 3,5 × 4,5 cm, sans lunettes)",
            "Formulaire officiel de demande de passeport rempli et signé",
        ],
        documents: [
            "Copie intégrale du passeport en cours de validité",
            "Acte de naissance certifié conforme délivré par la mairie béninoise",
            "Certificat de nationalité béninoise (Tribunal de Première Instance)",
            "Carte d'Identité Personnelle (CIP A) en cours de validité",
            "Extrait de casier judiciaire béninois — Bulletin n°3 (moins de 3 mois)",
            "Justificatif de domicile de moins de 3 mois (quittance ou bail)",
            "4 photos d'identité biométriques (fond blanc, 3,5 × 4,5 cm, sans lunettes)",
            "Formulaire officiel de demande de passeport rempli et signé",
        ],
        pricing_options: [
            { label: 'Pack Standard — Passeport ordinaire', price: '75 000 FCFA' },
            { label: 'Pack VIP — Traitement express jour-J', price: '350 000 FCFA' },
            { label: 'Renouvellement accompagné', price: '50 000 FCFA' },
        ],
    },
    {
        id: 'logement',
        icon: 'home-outline',
        title: 'Acheter ou Louer',
        subtitle: 'Vérifiez, informez-vous et Sécurisez vos transactions foncières et immobilières',
        desc: 'Acquisition immobilière, location longue durée, sécurisation foncière et vérification juridique de vos biens au Bénin.',
        fullDescription: "L'immobilier au Bénin offre de réelles opportunités — à condition de savoir naviguer dans un marché foncier qui requiert vigilance et expertise juridique. Nous vous accompagnons de la sélection du bien à la signature de l'acte notarié, en veillant à chaque étape à la solidité juridique de votre acquisition.",
        duration: '4 à 12 semaines',
        price: 'À partir de 25 000 FCFA',
        color: C.accent,
        features: [
            "Vérification du Titre Foncier (TF) et purge des oppositions cadastrales",
            "Bornage et identification parcellaire auprès de l'ANDF",
            "Due diligence juridique sur la chaîne de propriété",
            "Accompagnement notarial et rédaction des actes de vente ou de bail",
            "Gestion locative et suivi des relations bailleurs-locataires",
            "Conseil en fiscalité immobilière (droits de mutation, impôts fonciers)",
        ],
        documents: [
            "Pièce d'identité valide (passeport ou CNI)",
            "Justificatif de revenus ou preuve de fonds disponibles",
            "Lettre d'intention d'achat ou de location",
            "Budget précis et critères de recherche",
        ],
        pricing_options: [
            { label: 'Accompagnement en Acquisition Foncière', price: '3% du montant' },
            { label: 'Gestion locative mensuelle', price: '8% des loyers' },
            { label: 'Consultation juridique', price: '25 000 FCFA' },
        ],
    },
    {
        id: 'business',
        icon: 'briefcase-outline',
        title: "Création d'Entreprise",
        subtitle: "Création et immatriculation d'entreprise au Bénin pour la diaspora.",
        desc: "Immatriculation RCCM, ouverture de compte professionnel, conseils fiscaux et accompagnement des formalités de création.",
        fullDescription: "Nous facilitons l'implantation économique des entrepreneurs de la diaspora au Bénin. De la création juridique de votre structure à l'ouverture de votre compte bancaire, en passant par les démarches fiscales, notre équipe vous accompagne à chaque étape.",
        duration: '3 à 6 semaines',
        price: 'À partir de 150 000 FCFA',
        color: C.auraGreen,
        features: [
            "Création SARL / SA / SASU clé en main",
            "Immatriculation RCCM et formalités fiscales",
            "Ouverture de compte bancaire professionnel",
            "Domiciliation commerciale à Cotonou",
            "Cabinet de recrutement — sélection de talents locaux",
            "Mise en relation avec les acteurs économiques locaux",
        ],
        documents: [
            "Pièce d'identité de tous les associés (passeport)",
            "Projet de statuts ou intentions (forme juridique, capital)",
            "Justificatif de siège social (bail ou titre de propriété)",
            "Capital social disponible (preuve de dépôt)",
            "Casier judiciaire des gérants (moins de 3 mois)",
        ],
        pricing_options: [
            { label: 'Création SARL', price: '150 000 FCFA' },
            { label: 'Création SA', price: '250 000 FCFA' },
            { label: 'Accompagnement complet', price: 'Sur devis' },
        ],
    },
    {
        id: 'culture',
        icon: 'map-outline',
        title: 'Tourisme & Culture',
        subtitle: 'Reconnectez-vous avec vos racines. La richesse des Cauris.',
        desc: 'Circuits touristiques, visites patrimoniales, organisation de séjours et découverte du Bénin authentique.',
        fullDescription: "Le Bénin est l'un des berceaux les plus vivants de la culture africaine. Loin des circuits touristiques standardisés, nous vous proposons une immersion sincère dans les traditions, les savoirs et les rencontres qui font l'identité profonde de ce pays. Ici, la culture se vit, elle ne se contemple pas de loin.",
        duration: 'De 1 à 14 jours',
        price: 'À partir de 80 000 FCFA/pers',
        color: C.error,
        features: [
            'Consultation du Fa — oracle traditionnel yoruba-fon',
            "Cérémonie du Nom et validation à l'état civil",
            'Soins par les plantes et approche de la médecine ancestrale',
            'Audience privée avec dignitaires et rois traditionnels',
            'Initiation et sensibilisation à la culture vodoun',
            'Programmes de visite : Ganvié, Ouidah, Abomey, Porto-Novo',
            "Guide historien expert et passionné par l'histoire du Bénin",
            'Ateliers culinaires — recettes et saveurs béninoises',
            "Découverte de l'artisanat local et des savoir-faire traditionnels",
        ],
        documents: [
            'Passeport valide (6 mois de validité minimum)',
            'Visa Bénin si nécessaire (selon nationalité)',
            'Assurance voyage internationale',
        ],
        pricing_options: [
            { label: 'Circuit culturel (3 jours)', price: '120 000 FCFA/pers' },
            { label: 'Immersion complète (7 jours)', price: '280 000 FCFA/pers' },
            { label: 'Programme sur mesure', price: 'Nous consulter' },
        ],
    },
    {
        id: 'construction',
        icon: 'hammer-outline',
        title: 'Suivi de Chantier',
        subtitle: 'Bâtissez pour la postérité. Votre chantier, géré avec rigueur.',
        desc: "Maîtrise d'ouvrage déléguée, contrôle des travaux et coordination des entreprises locales pour votre construction.",
        fullDescription: "Construire au Bénin depuis l'étranger, c'est possible — à condition d'être bien entouré. Entre les devis approximatifs, les délais non respectés et les matériaux de qualité variable, les risques sont réels. Nous agissons comme votre représentant sur place : présents à chaque étape, exigeants sur la qualité, transparents dans nos rapports. Votre investissement mérite un suivi professionnel.",
        duration: 'Selon durée des travaux',
        price: 'À partir de 50 000 FCFA',
        color: C.accent,
        features: [
            "Aide à l'achat et à la location de terrain ou de bien immobilier",
            "Bureau d'architecte — conception et plans techniques",
            'Surveillance et contrôle de chantier (visites régulières, tous moyens)',
            'Vérification et validation des factures fournisseurs',
            'Achats de matériaux — sélection et négociation',
            'Rapports WhatsApp hebdomadaires (photos et vidéos)',
            'Mise en relation et coordination des intervenants du chantier',
            'Livraison et nettoyage du chantier clé en main',
        ],
        documents: [
            'Plan architectural approuvé (fichier PDF/DWG)',
            'Titre foncier ou contrat de bail du terrain',
            'Budget détaillé des travaux',
            'Permis de construire (si disponible)',
        ],
        pricing_options: [
            { label: 'Suivi mensuel', price: '75 000 FCFA/mois' },
            { label: 'Mission complète', price: '5% du montant travaux' },
            { label: 'Audit ponctuel', price: '50 000 FCFA' },
        ],
    },
    {
        id: 'investissement',
        icon: 'trending-up-outline',
        title: 'Investissement',
        subtitle: "Opportunités d'affaires rentables. Faites fructifier votre héritage.",
        desc: "Identification d'opportunités d'affaires, partenariats locaux et accompagnement stratégique pour vos projets d'investissement au Bénin.",
        fullDescription: "Le Bénin connaît une dynamique économique réelle, portée par des réformes structurelles et des investissements publics soutenus. Les opportunités existent — dans l'immobilier, l'agriculture, le commerce et les services — mais elles demandent une lecture fine du terrain. Nous vous aidons à identifier des projets sérieux, à évaluer les risques réels et à structurer vos investissements dans le respect du cadre juridique local.",
        duration: 'Accompagnement continu',
        price: 'À partir de 50 000 FCFA',
        color: C.auraGreen,
        features: [
            'Vente exclusive de particuliers à particuliers (terrain, immeuble, maison)',
            'Projets agricoles rentables et autres secteurs porteurs',
            'Évaluation approfondie des risques financiers, juridiques et opérationnels',
            "Veilles d'opportunités — marchés, appels d'offres, partenariats",
            'Suivi et optimisation de vos investissements au Bénin',
            'Stratégies fiscales adaptées au contexte local',
        ],
        documents: [
            "Lettre d'intention d'investissement",
            'Budget disponible estimatif',
            "Secteur(s) d'intérêt ciblé(s)",
            "Pièce d'identité (passeport)",
            'Justificatif de domicile fiscal dans le pays de résidence',
        ],
        pricing_options: [
            { label: 'Étude de marché', price: '200 000 FCFA' },
            { label: 'Accompagnement complet', price: 'Sur devis' },
            { label: 'Consultation stratégique', price: '50 000 FCFA' },
        ],
    },
    {
        id: 'nationalite-vip',
        icon: 'ribbon-outline',
        title: 'Nationalité VIP',
        subtitle: 'Obtenir la nationalité béninoise pour la diaspora afro-descendante',
        desc: "Accompagnement personnalisé pour l'obtention de la nationalité béninoise — dossier complet, suivi administratif et prise en charge prioritaire.",
        fullDescription: "Accompagnement personnalisé pour les membres de la diaspora souhaitant obtenir la nationalité béninoise. Suivi de dossier, coordination avec les autorités compétentes et prise en charge prioritaire.",
        duration: '3 à 6 mois',
        price: 'À partir de 150 000 FCFA',
        color: C.primary,
        features: [
            'Constitution et vérification du dossier complet',
            'Liaison avec le Ministère de la Justice',
            'Suivi administratif pas à pas',
            "Accompagnement pour l'apostille et traductions certifiées",
            'Pack VIP : suivi prioritaire avec référent dédié',
        ],
        documents: [
            'Acte de naissance + apostille (moins de 6 mois)',
            'Passeport en cours de validité (toutes pages)',
            'Justificatif de résidence au Bénin (3 mois min)',
            'Casier judiciaire du pays de résidence (moins de 3 mois)',
            'Preuve de lien ancestral ou appartenance à la diaspora',
            "Photos d'identité récentes (fond blanc, norme ICAO)",
        ],
        pricing_options: [
            { label: 'Accompagnement dossier standard', price: '150 000 FCFA' },
            { label: 'Pack VIP — suivi prioritaire', price: '350 000 FCFA' },
            { label: 'Consultation initiale', price: 'Gratuit' },
        ],
    },
    {
        id: 'recherche-ancestrale',
        icon: 'search-circle-outline',
        title: 'Recherche Ancestrale',
        subtitle: "Retrouvez la trace de ceux que l'histoire a effacés",
        desc: 'Retrouvez la trace de vos ancêtres réduits en esclavage — archives, bases de données spécialisées et accompagnement généalogique pour reconstituer votre lignée africaine.',
        fullDescription: "Pour des millions de descendants de la diaspora africaine, une partie de l'arbre généalogique a été effacée par la traite transatlantique. Nous mobilisons archives, bases de données spécialisées et associations expertes pour reconstituer votre lignée africaine.",
        duration: '4 à 10 semaines',
        price: '250 €',
        color: C.accent,
        features: [
            "Extrait de naissance de vos deux parents (père et mère)",
            "Extrait de naissance ou de décès de vos grands-parents (côté paternel et maternel)",
            "Actes de mariage, notariés, militaires ou de décès des arrière-grands-parents",
            "Consultation d'archives officielles et bases de données diasporiques",
            "Partenariats avec associations spécialisées en généalogie afro-descendante",
        ],
        documents: [
            'Informations sur les ancêtres connus (noms, lieux, dates)',
            'Documents familiaux disponibles (photos, lettres, actes)',
            'Nom de jeune fille des grands-mères maternelles',
            "Pays ou région d'origine présumée",
            'Résultats de test ADN si déjà effectué (optionnel)',
        ],
        pricing_options: [
            { label: 'Recherche complète — archives, bases de données & associations', price: '250 €' },
        ],
    },
    {
        id: 'consultation-fa-racines',
        icon: 'sparkles-outline',
        title: 'Consultation Fa & Racines',
        subtitle: 'Rencontrez un Bokonon, la sagesse du Fa dans un cadre organisé et respectueux',
        desc: "Mise en relation avec un Bokonon (prêtre Fa) pour une consultation traditionnelle — en présentiel au Bénin ou à distance en visioconférence.",
        fullDescription: "Le Fa est l'un des plus anciens systèmes de sagesse d'Afrique de l'Ouest, inscrit au patrimoine culturel immatériel de l'humanité. Nous vous mettons en relation avec un Bokonon (prêtre du Fa) reconnu, pour une consultation traditionnelle menée dans les règles de l'art. Retour Gagnant Bénin intervient exclusivement comme intermédiaire de mise en relation : un accord est signé dès l'enclenchement de la procédure.",
        duration: 'Selon disponibilité du Bokonon',
        price: 'Présentiel 550 € · Visio 780 €',
        color: '#7C5CCA',
        features: [
            'Mise en relation avec un Bokonon (prêtre Fa) reconnu et expérimenté',
            "Présentiel — accueil, prise de rendez-vous avec le prêtre Fa, aide sur place",
            "Présentiel — réservation d'hôtel et change de monnaie sur place",
            'Visio — organisation de la séance à distance et liaison avec le Bokonon',
            'Visio — assistance et veille technique pendant toute la consultation',
            'Accord de mise en relation signé avant le début de la procédure',
        ],
        documents: [
            "Pièce d'identité",
            'Coordonnées de contact (email, WhatsApp)',
            'Vos disponibilités pour la consultation',
        ],
        pricing_options: [
            { label: 'Consultation en Présentiel — accueil, RDV, aide, hôtel, change', price: '550 €' },
            { label: 'Consultation en Visio — assistance et veille à distance', price: '780 €' },
        ],
    },
    {
        id: 'langues-racines',
        icon: 'language-outline',
        title: 'Langues & Racines',
        subtitle: 'La langue de vos ancêtres est la première porte du retour',
        desc: 'Apprenez le fon, le yoruba, le goun ou le mina avec des locuteurs natifs — en présentiel au Bénin ou en visioconférence.',
        fullDescription: "On ne revient jamais tout à fait chez soi tant qu'on n'en parle pas la langue. Le fon, le yoruba, le goun ou le mina portent la mémoire et la vision du monde de vos ancêtres : les apprendre, c'est renouer le fil que l'histoire a interrompu. Parcours animés par des locuteurs natifs, pensés pour la diaspora, en présentiel ou en visio.",
        duration: 'Parcours personnalisé',
        price: 'Sur devis — premier rendez-vous gratuit',
        color: '#0EA5E9',
        features: [
            'Cours animés par des locuteurs natifs qualifiés',
            "Fon, Yoruba, Goun, Mina — selon votre lignée et votre région d'origine",
            'Parcours débutant à avancé, adapté à votre rythme',
            'Immersion culturelle : proverbes, salutations, codes sociaux',
            'En présentiel au Bénin ou en visioconférence depuis l\'étranger',
            'Programme personnalisé défini lors d\'un premier rendez-vous gratuit',
        ],
        documents: [
            'Aucun document requis pour commencer',
            'Vos objectifs et disponibilités',
        ],
        pricing_options: [
            { label: 'Premier rendez-vous découverte', price: 'Gratuit' },
            { label: 'Parcours personnalisé', price: 'Sur devis' },
        ],
    },
    {
        id: 'autres',
        icon: 'apps-outline',
        title: 'Autres Services',
        subtitle: 'Transport, santé, scolarité et démarches du quotidien',
        desc: 'Transport, santé, scolarité et démarches administratives — des solutions complémentaires pour faciliter votre installation au Bénin.',
        fullDescription: "Des solutions complémentaires pour faciliter chaque aspect de votre installation au Bénin — de l'aéroport à l'école de vos enfants, en passant par l'accès aux soins et les démarches administratives courantes.",
        duration: 'Selon la demande',
        price: 'Nous contacter',
        color: C.textSec,
        features: [
            'Transfert aéroport et location de véhicule avec chauffeur',
            'Mise en relation avec médecins et cliniques partenaires',
            'Inscription scolaire et suivi pédagogique',
            'Accompagnement démarches administratives locales',
        ],
        documents: [
            "Pièce d'identité",
            'Documents spécifiques selon le service demandé',
            'Contacter notre équipe pour plus de détails',
        ],
        pricing_options: [
            { label: 'Consultation', price: 'Nous contacter' },
        ],
    },
]

// ─── Mapping slug → icon ──────────────────────────────────────────────────────

const ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
    nationalite: 'ribbon-outline', nationalite_vip: 'ribbon-outline',
    ancestrale: 'search-circle-outline', recherche: 'search-circle-outline',
    passeport: 'document-text-outline',
    logement: 'home-outline', immobilier: 'home-outline',
    business: 'briefcase-outline', entreprise: 'briefcase-outline',
    culture: 'map-outline', tourisme: 'map-outline',
    construction: 'hammer-outline', chantier: 'hammer-outline',
    investissement: 'trending-up-outline',
    consultation: 'sparkles-outline', fa: 'sparkles-outline',
    langues: 'language-outline', racines: 'language-outline',
    autres: 'apps-outline',
}

function getIconForSlug(slug: string, icon_type?: string): keyof typeof Ionicons.glyphMap {
    if (icon_type && ICON_MAP[icon_type]) return ICON_MAP[icon_type]
    const key = slug.toLowerCase().replace(/-/g, '_')
    for (const [k, v] of Object.entries(ICON_MAP)) {
        if (key.includes(k)) return v
    }
    return 'briefcase-outline'
}

/* ═══════════════════════════════════════════════════════════
   COMPOSANT : SERVICE CARD (Verre translucide, bordure Or au press)
═══════════════════════════════════════════════════════════ */

interface ServiceCardProps {
    svc: ServiceFull
    index: number
    onPress: () => void
    t: (s: string) => string
}

function ServiceCard({ svc, index, onPress, t }: ServiceCardProps) {
    const enterAnim = useSharedValue(0)
    const pressAnim = useSharedValue(0)

    useEffect(() => {
        enterAnim.value = withDelay(
            index * 80,
            withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) })
        )
    }, [index])

    const enterStyle = useAnimatedStyle(() => ({
        opacity: enterAnim.value,
        transform: [
            { translateY: 30 * (1 - enterAnim.value) },
            { scale: interpolate(pressAnim.value, [0, 1], [1, 0.97]) },
        ],
    }))

    return (
        <Animated.View style={[{ width: CARD_W }, enterStyle]}>
            <Pressable
                onPress={onPress}
                onPressIn={() => { pressAnim.value = withSpring(1, { damping: 15, stiffness: 200 }) }}
                onPressOut={() => { pressAnim.value = withSpring(0, { damping: 15, stiffness: 200 }) }}
                style={styles.card}
            >
                {/* Barre supérieure colorée — accent de service */}
                <View style={[styles.cardTopBar, { backgroundColor: svc.color }]} />

                <View style={styles.cardInner}>
                    {/* Icône dans cercle subtil */}
                    <View style={styles.cardIconWrap}>
                        <Ionicons name={svc.icon} size={24} color={C.primary} />
                    </View>

                    <Text style={styles.cardTitle} numberOfLines={2}>{t(svc.title)}</Text>
                    <Text style={styles.cardDesc} numberOfLines={3}>{t(svc.desc)}</Text>

                    {/* Prix en badge minimaliste */}
                    <View style={styles.cardPriceWrap}>
                        <Text style={styles.cardPriceText} numberOfLines={1}>{t(svc.price)}</Text>
                    </View>

                    {/* CTA footer */}
                    <View style={styles.cardFooter}>
                        <Text style={styles.cardActionText}>{t('En savoir plus')}</Text>
                        <Ionicons name="arrow-forward" size={13} color={C.accent} />
                    </View>
                </View>
            </Pressable>
        </Animated.View>
    )
}

/* ═══════════════════════════════════════════════════════════
   COMPOSANT : VIP BANNER (Bleu agence massif, accent Or)
═══════════════════════════════════════════════════════════ */

function VipBanner({ onPress, t }: { onPress: () => void; t: (s: string) => string }) {
    const pressAnim = useSharedValue(0)

    const animStyle = useAnimatedStyle(() => ({
        transform: [{ scale: interpolate(pressAnim.value, [0, 1], [1, 0.98]) }],
    }))

    return (
        <Animated.View style={animStyle}>
            <TouchableOpacity
                activeOpacity={0.9}
                onPress={onPress}
                onPressIn={() => { pressAnim.value = withSpring(1) }}
                onPressOut={() => { pressAnim.value = withSpring(0) }}
                style={styles.vipBanner}
            >
                {/* Halo Or en arrière-plan */}
                <View style={styles.vipGlow} />

                <View style={styles.vipContent}>
                    <View style={styles.vipBadge}>
                        <Ionicons name="star" size={10} color={C.accent} />
                        <Text style={styles.vipBadgeText}>{t('LE PLUS POPULAIRE')}</Text>
                    </View>

                    <Text style={styles.vipTitle}>{t('Nationalité Béninoise VIP')}</Text>
                    <Text style={styles.vipDesc}>
                        {t('Accompagnement complet de A à Z · À partir de 150 000 FCFA')}
                    </Text>
                </View>

                <View style={styles.vipArrow}>
                    <Ionicons name="arrow-forward" size={18} color={C.primary} />
                </View>
            </TouchableOpacity>
        </Animated.View>
    )
}

/* ═══════════════════════════════════════════════════════════
   COMPOSANT : SKELETON CARD
═══════════════════════════════════════════════════════════ */

function SkeletonServiceCard() {
    const shimmer = useSharedValue(0)

    useEffect(() => {
        shimmer.value = withRepeat(
            withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
            -1,
            true
        )
    }, [])

    const shimmerStyle = useAnimatedStyle(() => ({
        opacity: interpolate(shimmer.value, [0, 1], [0.5, 1]),
    }))

    return (
        <Animated.View style={[styles.skeletonCard, shimmerStyle]}>
            <View style={styles.skeletonTopBar} />
            <View style={styles.cardInner}>
                <View style={styles.skeletonIcon} />
                <View style={[styles.skeletonLine, { width: '80%' }]} />
                <View style={[styles.skeletonLine, { width: '100%' }]} />
                <View style={[styles.skeletonLine, { width: '60%' }]} />
            </View>
        </Animated.View>
    )
}

/* ═══════════════════════════════════════════════════════════
   ÉCRAN PRINCIPAL : SERVICES SCREEN
═══════════════════════════════════════════════════════════ */

export default function ServicesScreen({ navigation }: any) {
    const insets = useSafeAreaInsets()
    const [services, setServices] = useState<ServiceFull[]>(SERVICES_DATA)
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const { t, lang, isTranslating, preloadTexts } = useLang()

    /* ── Animations d'entrée (Stagger) ── */
    const headerAnim = useSharedValue(0)
    const vipAnim = useSharedValue(0)

    /* ── Animation Corporate : Auras très subtiles et lentes ── */
    const aura1Y = useSharedValue(0)
    const aura2X = useSharedValue(0)

    useEffect(() => {
        // Apparition élégante
        headerAnim.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) })
        vipAnim.value = withDelay(400, withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) }))

        // Mouvement lent et imperceptible — donne vie au fond
        aura1Y.value = withRepeat(
            withSequence(
                withTiming(25, { duration: 6000, easing: Easing.inOut(Easing.quad) }),
                withTiming(-10, { duration: 6000, easing: Easing.inOut(Easing.quad) })
            ), -1, true
        )
        aura2X.value = withRepeat(
            withSequence(
                withTiming(-30, { duration: 7000, easing: Easing.inOut(Easing.quad) }),
                withTiming(15, { duration: 7000, easing: Easing.inOut(Easing.quad) })
            ), -1, true
        )
    }, [])

    const styleHeader = useAnimatedStyle(() => ({
        opacity: headerAnim.value,
        transform: [{ translateY: 30 * (1 - headerAnim.value) }],
    }))
    const styleVip = useAnimatedStyle(() => ({
        opacity: vipAnim.value,
        transform: [{ translateY: 40 * (1 - vipAnim.value) }],
    }))

    const aura1Style = useAnimatedStyle(() => ({ transform: [{ translateY: aura1Y.value }] }))
    const aura2Style = useAnimatedStyle(() => ({ transform: [{ translateX: aura2X.value }] }))

    const fetchServices = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('services')
                .select('id, title, slug, subtitle, description, color, icon_type, is_active, order_index, price_display, features, pricing_options')
                .eq('is_active', true)
                .order('order_index', { ascending: true })

            if (error) {
                console.warn('[Services] Supabase error, using static data:', error.message)
                setServices(SERVICES_DATA)
            } else if (data && data.length > 0) {
                const mapped: ServiceFull[] = data.map((s: Record<string, any>) => {
                    const staticMatch = SERVICES_DATA.find(sd =>
                        sd.id === s.slug ||
                        s.slug?.includes(sd.id.split('-')[0]) ||
                        sd.id.includes((s.slug || '').split('-')[0])
                    )
                    return {
                        id: s.slug || s.id,
                        icon: getIconForSlug(s.slug || '', s.icon_type),
                        title: s.title || staticMatch?.title || '',
                        subtitle: s.subtitle || staticMatch?.subtitle || '',
                        desc: s.subtitle || s.description || staticMatch?.desc || '',
                        fullDescription: s.description || staticMatch?.fullDescription || '',
                        duration: staticMatch?.duration || '4–8 semaines',
                        price: s.price_display || staticMatch?.price || 'Sur devis',
                        documents: staticMatch?.documents || ["Pièce d'identité valide", 'Documents selon le service'],
                        features: (Array.isArray(s.features) && s.features.length > 0)
                            ? s.features
                            : (staticMatch?.features || ['Consultation personnalisée', 'Accompagnement complet']),
                        pricing_options: (Array.isArray(s.pricing_options) && s.pricing_options.length > 0)
                            ? s.pricing_options
                            : (staticMatch?.pricing_options || [{ label: 'Standard', price: 'Nous consulter' }]),
                        color: s.color || staticMatch?.color || C.primary,
                    }
                })
                setServices(mapped)
            } else {
                console.warn('[Services] No data from Supabase, using static data')
                setServices(SERVICES_DATA)
            }
        } catch (e: any) {
            console.warn('[Services] Fetch failed, using static data:', e?.message)
            setServices(SERVICES_DATA)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchServices() }, [fetchServices])

    const onRefresh = async () => {
        setRefreshing(true)
        await fetchServices()
        setRefreshing(false)
    }

    // ── Pré-charger les textes visibles ──
    useEffect(() => {
        if (loading || lang === 'fr') return
        const textsToPreload: string[] = []
        for (const svc of services) {
            if (svc.title) textsToPreload.push(svc.title)
            if (svc.desc) textsToPreload.push(svc.desc)
            if (svc.price) textsToPreload.push(svc.price)
        }
        textsToPreload.push(
            'Nos Services',
            'Des solutions sur-mesure pour votre retour au Bénin.',
            'En savoir plus',
            'LE PLUS POPULAIRE',
            'Nationalité Béninoise VIP',
            'Accompagnement complet de A à Z · À partir de 150 000 FCFA',
            'Traduction en cours...',
        )
        console.log(`[Services] Pre-loading ${textsToPreload.length} grid-visible texts`)
        preloadTexts(textsToPreload)
    }, [loading, services, lang, preloadTexts])

    const handlePress = (svc: ServiceFull) => {
        // Consultation Fa & Racines → écran dédié (annuaire des prêtres + réservation).
        if (svc.id === 'consultation-fa-racines') {
            navigation.navigate('Fa')
            return
        }
        navigation.navigate('ServiceDetails', {
            serviceId: svc.id,
            title: svc.title,
            subtitle: svc.subtitle,
            desc: svc.desc,
            fullDescription: svc.fullDescription,
            duration: svc.duration,
            price: svc.price,
            documents: svc.documents,
            features: svc.features,
            pricing_options: svc.pricing_options,
            color: svc.color,
            icon: svc.icon,
        })
    }

    return (
        <View style={styles.container}>
            {/* 🎨 BACKGROUND PREMIUM : Auras diffuses aux couleurs de l'agence */}
            <Animated.View style={[styles.aura, styles.aura1, aura1Style]} />
            <Animated.View style={[styles.aura, styles.aura2, aura2Style]} />

            {/* NAV BAR */}
            <View style={[styles.navBar, { paddingTop: insets.top + 8 }]}>
                <Pressable onPress={() => navigation.goBack()} style={styles.navBack}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="arrow-back" size={22} color={C.primary} />
                    </View>
                </Pressable>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                bounces={true}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={C.primary}
                    />
                }
            >
                {/* HEADER TITRE */}
                <Animated.View style={[styles.headerContainer, styleHeader]}>
                    <Text style={styles.title}>{t('Nos')}</Text>
                    <Text style={styles.titleHighlight}>{t('Services.')}</Text>
                    <Text style={styles.subtitle}>
                        {t('Des solutions sur-mesure pour votre retour au Bénin.')}
                    </Text>
                </Animated.View>

                {/* Indicateur de traduction */}
                {isTranslating && lang !== 'fr' && (
                    <View style={styles.translatingBanner}>
                        <ActivityIndicator color={C.primary} size="small" />
                        <Text style={styles.translatingText}>{t('Traduction en cours...')}</Text>
                    </View>
                )}

                {/* BANDEAU VIP */}
                {!loading && (
                    <Animated.View style={styleVip}>
                        <VipBanner
                            onPress={() => handlePress(services.find(s => s.id === 'nationalite-vip') || services[0])}
                            t={t}
                        />
                    </Animated.View>
                )}

                {/* GRILLE DE SERVICES */}
                {loading ? (
                    <View style={styles.grid}>
                        {Array.from({ length: 6 }).map((_, i) => (
                            <SkeletonServiceCard key={i} />
                        ))}
                    </View>
                ) : (
                    <View style={styles.grid}>
                        {services
                            .filter(s => s.id !== 'nationalite-vip') // VIP affiché dans le bandeau
                            .map((svc, idx) => (
                                <ServiceCard
                                    key={svc.id}
                                    svc={svc}
                                    index={idx}
                                    onPress={() => handlePress(svc)}
                                    t={t}
                                />
                            ))}
                    </View>
                )}

                <View style={{ height: 60 }} />
            </ScrollView>
        </View>
    )
}

/* ═══════════════════════════════════════════════════════════
   STYLES
═══════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: C.bg,
    },

    /* ── Auras extrêmement discrètes (Corporate) ── */
    aura: {
        position: 'absolute',
        width: width * 0.9,
        height: width * 0.9,
        borderRadius: width,
        opacity: 0.05,
    },
    aura1: {
        top: -100,
        right: -100,
        backgroundColor: C.primary,
    },
    aura2: {
        bottom: 50,
        left: -100,
        backgroundColor: C.auraGreen,
    },

    /* ── Nav Bar (identique RegisterScreen) ── */
    navBar: {
        paddingHorizontal: 20,
        paddingBottom: 10,
        zIndex: 10,
    },
    navBack: {
        width: 44,
        height: 44,
        justifyContent: 'center',
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: C.surface,
        borderWidth: 1,
        borderColor: C.border,
        justifyContent: 'center',
        alignItems: 'center',
    },

    scrollContent: {
        paddingHorizontal: H_PADDING,
        paddingBottom: 40,
    },

    /* ── Header (identique RegisterScreen) ── */
    headerContainer: {
        marginTop: 15,
        marginBottom: 32,
        paddingHorizontal: 8,
    },
    title: {
        fontSize: 38,
        fontWeight: '700',
        color: C.primary,
        letterSpacing: -0.5,
    },
    titleHighlight: {
        fontSize: 38,
        fontWeight: '800',
        color: C.accent,
        letterSpacing: -0.5,
        marginTop: -4,
    },
    subtitle: {
        fontSize: 15,
        color: C.textSec,
        marginTop: 14,
        lineHeight: 22,
        fontWeight: '400',
    },

    /* ── Bandeau Traduction ── */
    translatingBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 10,
        backgroundColor: C.surface,
        borderWidth: 1,
        borderColor: C.border,
        borderRadius: 12,
        marginBottom: 20,
    },
    translatingText: {
        color: C.primary,
        fontSize: 12,
        fontWeight: '600',
    },

    /* ── Grille ── */
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: CARD_GAP,
        marginTop: 24,
    },

    /* ── Service Card ── */
    card: {
        width: CARD_W,
        backgroundColor: C.surface,
        borderRadius: 16, // Cohérent avec inputs/boutons RegisterScreen
        overflow: 'hidden',
        borderWidth: 1.2,
        borderColor: C.border,
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 2,
    },
    cardTopBar: {
        height: 3,
        width: '100%',
    },
    cardInner: {
        padding: 16,
        gap: 8,
    },
    cardIconWrap: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: 'rgba(13, 43, 78, 0.06)', // Bleu agence très diffus
        borderWidth: 1,
        borderColor: 'rgba(13, 43, 78, 0.08)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4,
    },
    cardTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: C.primary,
        lineHeight: 19,
        letterSpacing: -0.2,
    },
    cardDesc: {
        fontSize: 11.5,
        color: C.textSec,
        lineHeight: 16,
        fontWeight: '400',
    },
    cardPriceWrap: {
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(212, 160, 23, 0.10)', // Or très diffus
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 4,
        marginTop: 4,
        borderWidth: 1,
        borderColor: 'rgba(212, 160, 23, 0.25)',
    },
    cardPriceText: {
        fontSize: 10,
        fontWeight: '700',
        color: C.accentDark,
        letterSpacing: 0.2,
    },
    cardFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: C.border,
    },
    cardActionText: {
        fontSize: 11,
        fontWeight: '700',
        color: C.primary,
        letterSpacing: 0.2,
    },

    /* ── VIP Banner (Bleu massif, accent Or — comme bouton RegisterScreen) ── */
    vipBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.primary,
        borderRadius: 16,
        padding: 20,
        overflow: 'hidden',
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 8,
    },
    vipGlow: {
        position: 'absolute',
        top: -60,
        right: -60,
        width: 160,
        height: 160,
        borderRadius: 80,
        backgroundColor: C.accent,
        opacity: 0.15,
    },
    vipContent: {
        flex: 1,
        gap: 6,
    },
    vipBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: 'rgba(212, 160, 23, 0.18)',
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 5,
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: 'rgba(212, 160, 23, 0.4)',
    },
    vipBadgeText: {
        fontSize: 9,
        fontWeight: '700',
        color: C.accent,
        letterSpacing: 1.2,
    },
    vipTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: C.primaryText,
        letterSpacing: 0.2,
        marginTop: 4,
    },
    vipDesc: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.75)',
        lineHeight: 17,
        fontWeight: '400',
    },
    vipArrow: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: C.accent,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 12,
        shadowColor: C.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 4,
    },

    /* ── Skeleton ── */
    skeletonCard: {
        width: CARD_W,
        height: 200,
        backgroundColor: C.surface,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: C.border,
    },
    skeletonTopBar: {
        height: 3,
        backgroundColor: C.border,
    },
    skeletonIcon: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: C.border,
        marginBottom: 8,
    },
    skeletonLine: {
        height: 10,
        backgroundColor: C.border,
        borderRadius: 4,
        marginBottom: 6,
    },
})