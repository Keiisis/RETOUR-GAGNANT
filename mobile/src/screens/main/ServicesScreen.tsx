'use strict'
import React, { useEffect, useState, useCallback } from 'react'
import {
    View, Text, ScrollView, StyleSheet, Image,
    Dimensions, Platform, RefreshControl, ActivityIndicator,
    Pressable, TouchableOpacity,
    TextInput,
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
import { FlagBar } from '../../components/ui'
import { getServiceMode, MODE_COPY } from '../../lib/service-mode'
import { pricingEnabled, showPriceFor } from '../../lib/pricing-visibility'
import { useLang } from '../../contexts/LangContext'
import { supabase } from '../../config/supabase'
import { screenColors, typography, spacing, radius, shadows } from '../../config/theme'

/* ═══════════════════════════════════════════════════════════
   ServicesScreen — THEME "CORPORATE PREMIUM 2026"
   (Aligné avec RegisterScreen.tsx)
═══════════════════════════════════════════════════════════ */

const { width } = Dimensions.get('window')

// Palette de l'agence (identique à RegisterScreen)
// Palette de l'ecran : plus de copie locale. Toutes les couleurs
// viennent du design system v2 (blanc + tricolore Benin).
const C = screenColors

const H_PADDING = 20

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
        color: C.success,
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
        color: C.success,
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
        color: C.accent,
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
        color: C.primary,
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
    pricingOn: boolean
    svc: ServiceFull
    index: number
    onPress: () => void
    t: (s: string) => string
}

function ServiceCard({ svc, index, onPress, t, pricingOn }: ServiceCardProps) {
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

    /* Le libellé du bouton reflète le parcours RÉEL de la prestation
       (rendez-vous / formulaire dédié / réservation payante / boutique).
       Source unique partagée avec le web et le panel client : lib/service-mode. */
    const mode = getServiceMode({ slug: svc.id })
    const cta = MODE_COPY[mode].cta
    // Le site masque les tarifs sur les fiches (services_show_calculator = false) :
    // l'app applique la meme regle plutot que d'annoncer un montant absent du web.
    const showPrice = showPriceFor(svc.id, pricingOn)

    return (
        <Animated.View style={enterStyle}>
            <Pressable
                onPress={onPress}
                onPressIn={() => { pressAnim.value = withSpring(1, { damping: 15, stiffness: 200 }) }}
                onPressOut={() => { pressAnim.value = withSpring(0, { damping: 15, stiffness: 200 }) }}
                accessibilityRole="button"
                accessibilityLabel={`${t(svc.title)} — ${t(cta)}`}
                style={styles.card}
                hitSlop={6}
            >
                <View style={styles.cardInner}>
                    <View style={styles.cardHead}>
                        <View style={styles.cardIconWrap}>
                            <Ionicons name={svc.icon} size={26} color={C.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.cardTitle}>{t(svc.title)}</Text>
                            <Text style={styles.cardDesc} numberOfLines={3}>{t(svc.desc)}</Text>
                        </View>
                    </View>

                    <View style={styles.cardDivider} />

                    <View style={styles.cardFooter}>
                        <View style={styles.cardMeta}>
                            {showPrice ? (
                                <>
                                    <Text style={styles.cardMetaLabel}>{t('Tarif')}</Text>
                                    <Text style={styles.cardMetaValue} numberOfLines={1}>{t(svc.price)}</Text>
                                </>
                            ) : (
                                <>
                                    <Text style={styles.cardMetaLabel}>{t('Devis')}</Text>
                                    <Text style={styles.cardMetaValue} numberOfLines={1}>
                                        {t('Établi en rendez-vous')}
                                    </Text>
                                </>
                            )}
                        </View>
                        <View style={styles.cardCta}>
                            <Text style={styles.cardCtaText}>{t(cta)}</Text>
                        </View>
                    </View>
                </View>
            </Pressable>
        </Animated.View>
    )
}


/* ═══════════════════════════════════════════════════════════
   FAMILLES DE PRESTATIONS
   Regroupement editorial des 11 services, aligne sur la lecture
   du site public. Aucun service n'est invente : chaque slug
   ci-dessous existe dans SERVICES_DATA.
═══════════════════════════════════════════════════════════ */
type Family = 'all' | 'etat-civil' | 'installation' | 'entreprise' | 'racines'

const FAMILY_ORDER: Family[] = ['all', 'etat-civil', 'installation', 'entreprise', 'racines']

const FAMILY_LABEL: Record<Family, string> = {
    'all': 'Tout',
    'etat-civil': 'Etat civil & nationalite',
    'installation': 'Installation & logement',
    'entreprise': 'Entreprise & investissement',
    'racines': 'Racines & culture',
}

const FAMILY_COVER: Record<Exclude<Family, 'all'>, number> = {
    'etat-civil': require('../../../assets/images/famille-etat-civil.webp'),
    'installation': require('../../../assets/images/famille-immobilier.webp'),
    'entreprise': require('../../../assets/images/famille-entreprise.webp'),
    'racines': require('../../../assets/images/famille-racines.webp'),
}

const FAMILY_OF: Record<string, Family> = {
    'nationalite-vip': 'etat-civil',
    'passeport': 'etat-civil',
    'logement': 'installation',
    'construction': 'installation',
    'business': 'entreprise',
    'investissement': 'entreprise',
    'culture': 'racines',
    'recherche-ancestrale': 'racines',
    'consultation-fa-racines': 'racines',
    'langues-racines': 'racines',
    'autres': 'installation',
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
    const [query, setQuery] = useState('')
    const [pricingOn, setPricingOn] = useState(false)

    useEffect(() => { pricingEnabled().then(setPricingOn).catch(() => setPricingOn(false)) }, [])
    const [family, setFamily] = useState<Family>('all')

    /* Recherche + filtre famille, puis regroupement en sections.
       Filtre sur le contenu réel de la fiche (titre, sous-titre, description). */
    const visibleSections = React.useMemo(() => {
        const q = query.trim().toLowerCase()
        const matches = services.filter((svc) => {
            if (family !== 'all' && FAMILY_OF[svc.id] !== family) return false
            if (!q) return true
            return [svc.title, svc.subtitle, svc.desc]
                .some((f) => String(f || '').toLowerCase().includes(q))
        })
        return FAMILY_ORDER
            .filter((f) => f !== 'all')
            .map((fam) => ({ fam, items: matches.filter((s) => FAMILY_OF[s.id] === fam) }))
            .filter((sec) => sec.items.length > 0)
    }, [services, query, family])
    const { t, lang, isTranslating, preloadTexts } = useLang()

    /* ── Animations d'entrée (Stagger) ── */
    const headerAnim = useSharedValue(0)

    useEffect(() => {
        // Apparition élégante
        headerAnim.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) })

        // Mouvement lent et imperceptible — donne vie au fond
    }, [])

    const styleHeader = useAnimatedStyle(() => ({
        opacity: headerAnim.value,
        transform: [{ translateY: 30 * (1 - headerAnim.value) }],
    }))


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

            {/* LISERÉ TRICOLORE */}
            <View style={[styles.topFlag, { marginTop: insets.top + 8 }]}>
                <FlagBar height={6} radiusTop={false} />
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                bounces={true}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={C.primary}
                    />
                }
            >
                {/* TITRE */}
                <Text style={styles.title}>{t('Nos prestations')}</Text>

                {/* FILTRES PAR FAMILLE */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipsRow}
                >
                    {FAMILY_ORDER.map((fam) => {
                        const active = family === fam
                        return (
                            <Pressable
                                key={fam}
                                onPress={() => setFamily(fam)}
                                accessibilityRole="button"
                                accessibilityState={{ selected: active }}
                                style={[styles.chip, active && styles.chipActive]}
                                hitSlop={6}
                            >
                                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                                    {t(FAMILY_LABEL[fam])}
                                </Text>
                            </Pressable>
                        )
                    })}
                </ScrollView>

                {/* RECHERCHE */}
                <View style={styles.searchBar}>
                    <Ionicons name="search" size={19} color={C.textMuted} />
                    <TextInput
                        value={query}
                        onChangeText={setQuery}
                        placeholder={t('Quel accompagnement cherchez-vous ?')}
                        placeholderTextColor={C.textMuted}
                        accessibilityLabel={t('Rechercher une prestation')}
                        returnKeyType="search"
                        style={styles.searchInput}
                    />
                    {query.length > 0 && (
                        <Pressable
                            onPress={() => setQuery('')}
                            accessibilityRole="button"
                            accessibilityLabel={t('Effacer la recherche')}
                            hitSlop={8}
                        >
                            <Ionicons name="close-circle" size={19} color={C.textMuted} />
                        </Pressable>
                    )}
                </View>

                {/* Indicateur de traduction */}
                {isTranslating && lang !== 'fr' && (
                    <View style={styles.translatingBanner}>
                        <ActivityIndicator color={C.primary} size="small" />
                        <Text style={styles.translatingText}>{t('Traduction en cours...')}</Text>
                    </View>
                )}

                {/* LISTE PAR SECTION */}
                {loading ? (
                    <View style={{ gap: 14 }}>
                        {Array.from({ length: 4 }).map((_, i) => (
                            <SkeletonServiceCard key={i} />
                        ))}
                    </View>
                ) : visibleSections.length === 0 ? (
                    <View style={styles.noResult}>
                        <Ionicons name="search-outline" size={34} color={C.textMuted} />
                        <Text style={styles.noResultTitle}>{t('Aucune prestation trouvée')}</Text>
                        <Text style={styles.noResultText}>
                            {t('Essayez un autre mot-clé ou changez de catégorie.')}
                        </Text>
                    </View>
                ) : (
                    visibleSections.map(({ fam, items }) => (
                        <View key={fam} style={styles.section}>
                            <View style={styles.familyBanner}>
                                <Image
                                    source={FAMILY_COVER[fam as Exclude<Family, 'all'>]}
                                    style={styles.familyImage}
                                    resizeMode="cover"
                                    accessible={false}
                                />
                                <View style={styles.familyScrim} />
                                <Text style={styles.familyBannerText} numberOfLines={2}>
                                    {t(FAMILY_LABEL[fam])}
                                </Text>
                            </View>
                            <View style={{ gap: 14 }}>
                                {items.map((svc, idx) => (
                                    <ServiceCard
                                        key={svc.id}
                                        svc={svc}
                                        index={idx}
                                        onPress={() => handlePress(svc)}
                                        t={t}
                                        pricingOn={pricingOn}
                                    />
                                ))}
                            </View>
                        </View>
                    ))
                )}
            </ScrollView>
        </View>
    )
}

/* ═══════════════════════════════════════════════════════════
   STYLES
═══════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },

    topFlag: { marginHorizontal: 20, borderRadius: radius.pill, overflow: 'hidden' },

    scrollContent: { paddingHorizontal: 20, paddingTop: spacing.lg, paddingBottom: 20 },

    title: { ...typography.h1, color: C.text, marginBottom: spacing.lg },

    /* ── Filtres par famille ── */
    chipsRow: { gap: spacing.sm, paddingRight: spacing.lg, paddingBottom: spacing.lg },
    chip: {
        paddingHorizontal: spacing.md, paddingVertical: 10,
        borderRadius: radius.pill,
        backgroundColor: C.surface,
        borderWidth: 1, borderColor: C.border,
    },
    chipActive: { backgroundColor: C.floating, borderColor: C.floating },
    chipText: { ...typography.label, color: C.textMuted },
    chipTextActive: { color: C.primaryText },

    /* ── Recherche ── */
    searchBar: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
        backgroundColor: C.surface, borderRadius: radius.pill,
        paddingHorizontal: spacing.md, height: 54,
        borderWidth: 1, borderColor: C.border,
        marginBottom: spacing.lg,
        ...shadows.card,
    },
    searchInput: { flex: 1, ...typography.body, color: C.text, paddingVertical: 0 },

    /* ── Sections ── */
    section: { marginBottom: spacing.lg },
    sectionTitle: { ...typography.overline, color: C.primary, marginBottom: spacing.md },
    familyBanner: {
        height: 104, borderRadius: radius.xl, overflow: 'hidden',
        justifyContent: 'flex-end', marginBottom: spacing.md,
        backgroundColor: C.surfaceAlt,
    },
    familyImage: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
    /* Voile sombre uniquement SOUS le texte : garantit le contraste AA
       quelle que soit la photo, sans assombrir l'ecran. */
    familyScrim: {
        ...StyleSheet.absoluteFill,
        backgroundColor: 'rgba(0,0,0,0.34)',
    },
    familyBannerText: {
        ...typography.overline, fontSize: 13, color: '#FFFFFF',
        paddingHorizontal: spacing.md, paddingBottom: spacing.md,
    },

    /* ── Carte prestation ── */
    card: {
        backgroundColor: C.surface,
        borderRadius: radius.xl,
        overflow: 'hidden',
        ...shadows.card,
    },
    cardInner: { padding: spacing.md },
    cardHead: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
    cardIconWrap: {
        width: 56, height: 56, borderRadius: radius.lg,
        backgroundColor: C.surfaceSoft,
        alignItems: 'center', justifyContent: 'center',
    },
    cardTitle: { ...typography.h3, color: C.text, marginBottom: spacing.xs },
    cardDesc: { ...typography.bodySmall, color: C.textMuted },
    cardDivider: { height: 1, backgroundColor: C.border, marginVertical: spacing.md },
    cardFooter: { gap: spacing.md },
    cardMeta: { gap: 2 },
    cardMetaLabel: { ...typography.overline, fontSize: 12, color: C.textMuted },
    cardMetaValue: { ...typography.label, color: C.text, marginTop: 2 },
    cardCta: {
        backgroundColor: C.primary,
        borderRadius: radius.pill,
        paddingHorizontal: spacing.lg,
        paddingVertical: 14,
        alignItems: 'center',
    },
    cardCtaText: { ...typography.button, fontSize: 15, color: C.primaryText, textAlign: 'center' },

    /* ── Aucun resultat ── */
    noResult: { alignItems: 'center', paddingVertical: 48, gap: spacing.sm },
    noResultTitle: { ...typography.h3, color: C.text },
    noResultText: { ...typography.bodySmall, color: C.textMuted, textAlign: 'center' },

    /* ── Nav Bar (identique RegisterScreen) ── */


    /* ── Header (identique RegisterScreen) ── */

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

    /* ── Service Card ── */

    /* ── VIP Banner (Bleu massif, accent Or — comme bouton RegisterScreen) ── */

    /* ── Skeleton ── */
    skeletonCard: {
        height: 200,
        backgroundColor: C.surface,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: C.border,
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