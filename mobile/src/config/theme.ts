/* ═══════════════════════════════════════════════════════════
   RETOUR GAGNANT BÉNIN — Design System mobile v2

   Direction validée le 2026-07-28. Les valeurs de la section « SOCLE »
   sont reprises TELLES QUELLES du design approuvé (projet Sleek
   YoYrfLsdtLI) : ce fichier traduit les maquettes, il ne les réinterprète pas.

   Principe : LE BLANC EST LA FORCE.
   Fonds blancs francs, respiration large, aucune surface sombre en fond de
   page. L'identité vient du drapeau béninois, exactement comme sur les
   factures officielles et la grille tarifaire du cabinet :
     · vert  #008751 → toute action (boutons, liens, coches, progression)
     · jaune #FCD116 → accent premium (badges, filets)
     · rouge #E8112D → uniquement alertes et suppressions
     · un fin liseré tricolore en tête d'écran, signature des documents.

   ⚠️ RÈGLE : aucun écran ne redéfinit sa propre palette. Avant cette
   refonte, 29 écrans sur 33 déclaraient un `const C = {…}` local dont le
   vert (#008751) CONTREDISAIT ce fichier, et 7 des 9 composants partagés
   n'étaient importés nulle part. Tout doit désormais passer par ici.

   La section « COMPATIBILITÉ » plus bas conserve les anciens noms de
   tokens : les écrans non encore migrés continuent de fonctionner, mais
   pointent sur les nouvelles valeurs et basculent donc visuellement.
═══════════════════════════════════════════════════════════ */

/* ─────────────────────────── SOCLE v2 ─────────────────────────── */

/** Les trois bandes du liseré, dans l'ordre du drapeau. */
export const flag = ['#008751', '#FCD116', '#E8112D'] as const

const v2 = {
    green: '#008751',
    greenDark: '#00643C',
    greenPressed: '#006B40',
    greenSoft: '#E6F3ED',

    yellow: '#FCD116',
    yellowSoft: '#FEF7DC',
    yellowInk: '#8A6D08',

    red: '#E8112D',
    redSoft: '#FDECEA',

    white: '#FFFFFF',
    neutral: '#F5F5F5',

    ink: '#3C3C3C',       // anthracite, jamais #000
    inkMuted: '#505050',
    inkFaint: '#8A8A8A',

    line: '#F0F0F0',
    lineStrong: '#E4E4E4',

    floating: '#3C3C3C',  // barres flottantes (pattern iOS)
} as const

export const colors = {
    /* ── Actions ── */
    primary: v2.green,
    primaryDark: v2.greenDark,
    primaryPressed: v2.greenPressed,
    primarySoft: v2.greenSoft,

    /* ── Accent premium ── */
    accent: v2.yellow,
    accentSoft: v2.yellowSoft,
    accentInk: v2.yellowInk,

    /* ── Fonds : le blanc domine ── */
    background: v2.white,
    surface: v2.white,
    surfaceMuted: v2.neutral,

    /* ── Textes ── */
    text: v2.ink,
    textMuted: v2.inkMuted,
    textFaint: v2.inkFaint,
    textOnPrimary: v2.white,

    /* ── Traits ── */
    border: v2.line,
    borderStrong: v2.lineStrong,

    /* ── Barres flottantes ── */
    floating: v2.floating,
    floatingText: v2.white,
    floatingMuted: '#9A9A9A',

    /* ── Sémantique (distincte de l'accent décoratif) ── */
    success: v2.green,
    successSoft: v2.greenSoft,
    warning: '#8A6D08',
    warningSoft: v2.yellowSoft,
    danger: v2.red,
    dangerSoft: v2.redSoft,
    info: v2.greenDark,
    infoSoft: v2.greenSoft,

    /* ── Drapeau (accès direct) ── */
    flagGreen: v2.green,
    flagYellow: v2.yellow,
    flagRed: v2.red,

    /* ═══ COMPATIBILITÉ — anciens noms, nouvelles valeurs ═══
       Ces clés existaient dans le thème v1. Elles sont conservées pour que
       les écrans non migrés compilent, mais pointent sur la palette v2 :
       l'app bascule donc visuellement d'un bloc. À retirer quand tous les
       écrans utiliseront les noms ci-dessus. */
    primaryLight: '#1FA36A',
    primaryMuted: v2.greenSoft,
    primaryGlow: 'rgba(0,135,81,0.20)',
    teal: v2.greenDark,
    gold: v2.yellow,
    goldLight: '#FDDE4F',
    goldDark: '#D4AF0C',
    goldSoft: v2.yellowSoft,
    goldMuted: 'rgba(252,209,22,0.12)',
    goldShimmer: 'rgba(252,209,22,0.06)',
    surfaceWarm: v2.neutral,
    surfaceElevated: v2.white,
    headerBg: v2.white,
    textPrimary: v2.ink,
    textSecondary: v2.inkMuted,
    textGold: v2.yellowInk,
    textOnDark: v2.white,
    textOnGold: v2.ink,
    navy: v2.ink,
    navyLight: v2.inkMuted,
    navyMuted: 'rgba(60,60,60,0.08)',
    successLight: 'rgba(0,135,81,0.20)',
    successBg: v2.greenSoft,
    warningLight: 'rgba(184,134,11,0.20)',
    warningBg: v2.yellowSoft,
    dangerLight: 'rgba(232,17,45,0.20)',
    dangerBg: v2.redSoft,
    infoLight: 'rgba(0,100,60,0.20)',
    infoBg: v2.greenSoft,
    borderLight: v2.line,
    borderGold: 'rgba(252,209,22,0.35)',
    borderPrimary: 'rgba(0,135,81,0.20)',
    overlay: 'rgba(60,60,60,0.55)',
    overlayLight: 'rgba(60,60,60,0.15)',
    glass: 'rgba(255,255,255,0.85)',
    glassDark: 'rgba(255,255,255,0.95)',
} as const

/* ── Typographie ──────────────────────────────────────────
   Plus Jakarta Sans porte toute l'interface, titres compris : c'est la
   police du design validé. Playfair reste disponible pour un moment
   éditorial ponctuel, JetBrains Mono pour les références de dossier. */
export const fonts = {
    regular: 'PlusJakartaSans_400Regular',
    medium: 'PlusJakartaSans_500Medium',
    semibold: 'PlusJakartaSans_600SemiBold',
    bold: 'PlusJakartaSans_700Bold',
    extrabold: 'PlusJakartaSans_800ExtraBold',
    serif: 'PlayfairDisplay_700Bold',

    /* ── Compatibilité v1 ── */
    heading: 'PlusJakartaSans_800ExtraBold',
    headingRegular: 'PlusJakartaSans_600SemiBold',
    body: 'PlusJakartaSans_400Regular',
    bodyMedium: 'PlusJakartaSans_500Medium',
    bodySemibold: 'PlusJakartaSans_600SemiBold',
    bodyBold: 'PlusJakartaSans_700Bold',
    Inter_400Regular: 'PlusJakartaSans_400Regular',
    Inter_500Medium: 'PlusJakartaSans_500Medium',
    Inter_600SemiBold: 'PlusJakartaSans_600SemiBold',
    Inter_700Bold: 'PlusJakartaSans_700Bold',
    PlayfairDisplay_700Bold: 'PlayfairDisplay_700Bold',
    PlayfairDisplay_400Regular: 'PlayfairDisplay_400Regular',
} as const

export const typography = {
    /** Titre d'écran (« Nos prestations », « Mon dossier ») */
    h1: { fontSize: 30, lineHeight: 36, fontFamily: fonts.extrabold, letterSpacing: -0.5 },
    /** Titre de carte principale */
    h2: { fontSize: 22, lineHeight: 28, fontFamily: fonts.bold, letterSpacing: -0.3 },
    /** Titre de section */
    h3: { fontSize: 17, lineHeight: 23, fontFamily: fonts.bold, letterSpacing: -0.2 },
    /** Intitulé de section en capitales (« ÉTAT CIVIL & NATIONALITÉ ») */
    overline: { fontSize: 12, lineHeight: 16, fontFamily: fonts.bold, letterSpacing: 1.2, textTransform: 'uppercase' as const },
    body: { fontSize: 15, lineHeight: 22, fontFamily: fonts.regular },
    bodySmall: { fontSize: 14, lineHeight: 20, fontFamily: fonts.regular },
    label: { fontSize: 13, lineHeight: 18, fontFamily: fonts.semibold },
    caption: { fontSize: 12, lineHeight: 17, fontFamily: fonts.regular },
    button: { fontSize: 15, lineHeight: 20, fontFamily: fonts.bold, letterSpacing: 0.2 },
} as const

/* ── Espacement : échelle de 4 ── */
export const spacing = {
    xxs: 2, xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48, xxxl: 64,
    /* pas intermédiaires du design v2 */
    base: 16, gutter: 20,
} as const

/* ── Rayons : base 16 px, comme le design (--radius: 1rem) ── */
export const radius = {
    xs: 8, sm: 12, md: 14, lg: 16, xl: 20, xxl: 24, pill: 999, full: 999,
} as const

/* ── Ombres douces, TEINTÉES du gris de texte, jamais du noir pur.
      Valeurs relevées dans les maquettes. ── */
export const shadows = {
    /** Carte posée sur le blanc */
    card: { shadowColor: '#3C3C3C', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.06, shadowRadius: 32, elevation: 3 },
    /** Carte mise en avant */
    cardRaised: { shadowColor: '#3C3C3C', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.08, shadowRadius: 32, elevation: 5 },
    /** Barre flottante (tab bar, barre conseiller) */
    floating: { shadowColor: '#3C3C3C', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.30, shadowRadius: 40, elevation: 12 },
    /** Bouton d'action principal — ombre verte */
    action: { shadowColor: '#008751', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.40, shadowRadius: 20, elevation: 6 },

    /* ── Compatibilité v1 ── */
    xs: { shadowColor: '#3C3C3C', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
    sm: { shadowColor: '#3C3C3C', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 2 },
    md: { shadowColor: '#3C3C3C', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.06, shadowRadius: 32, elevation: 3 },
    lg: { shadowColor: '#3C3C3C', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.08, shadowRadius: 32, elevation: 5 },
    xl: { shadowColor: '#3C3C3C', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.30, shadowRadius: 40, elevation: 12 },
    /* Anciennes ombres colorées : ramenées sur la charte (le v2 n'utilise plus
       de halo doré ; l'accent d'action est le vert). */
    glow: { shadowColor: '#008751', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.30, shadowRadius: 20, elevation: 6 },
    gold: { shadowColor: '#D4AF0C', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.28, shadowRadius: 20, elevation: 6 },
    primary: { shadowColor: '#008751', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.40, shadowRadius: 20, elevation: 6 },
} as const

/* ── Motion : elle sert l'orientation, jamais la décoration. ── */
export const motion = {
    instant: 80, fast: 160, base: 240, slow: 320, slower: 480,
    spring: {
        snappy: { damping: 18, stiffness: 220, mass: 0.6 },
        soft: { damping: 22, stiffness: 140, mass: 0.8 },
        bounce: { damping: 14, stiffness: 180, mass: 0.7 },
    },
    pressScale: 0.97,
    pressScaleStrong: 0.94,
} as const

/** Squelettes de chargement (voir composant Skeleton). */
export const skeletonColors = {
    base: '#F0F0F0',
    highlight: '#F8F8F8',
} as const

/* Compat : d'anciens écrans importent `gradients` et `royal`.
   Le design v2 n'emploie plus de dégradé décoratif ; ces valeurs sont
   ramenées sur la palette officielle pour éviter toute couleur hors charte. */
export const gradients = {
    primary: [v2.green, v2.greenDark] as string[],
    primaryDark: [v2.greenDark, '#004E2E'] as string[],
    gold: [v2.yellow, '#D4AF0C'] as string[],
    flag: [v2.green, v2.yellow, v2.red] as string[],
    flagBtn: [v2.green, v2.yellow] as string[],
    navy: [v2.ink, '#2A2A2A'] as string[],
    lightBg: [v2.white, v2.neutral] as string[],
    card: [v2.white, v2.white] as string[],
    darkCard: [v2.neutral, v2.white] as string[],
}

export const royal = {
    bg: v2.white,
    bgWarm: v2.white,
    surface: v2.white,
    gold: v2.yellow,
    goldLight: '#FDDE4F',
    goldDark: '#D4AF0C',
    goldSoft: v2.yellowSoft,
    goldShimmer: 'rgba(252,209,22,0.06)',
    emerald: v2.green,
    lightEmerald: '#1FA36A',
    deepEmerald: v2.greenDark,
    deepLightEmerald: v2.greenPressed,
    terracotta: v2.red,
    textDark: v2.ink,
    textLight: v2.white,
    border: v2.line,
}

/* ═══════════════════════════════════════════════════════════
   PALETTE D'ÉCRAN — remplace les `const C = {…}` locaux

   29 écrans sur 33 déclaraient leur propre palette, copiée-collée, avec un
   vert #008751 qui contredisait le thème, un or #C9A84C hors charte et un
   bleu d'information #00643C absent du drapeau. Ce bloc expose EXACTEMENT
   les mêmes noms de clés, mappés sur la palette v2 : un écran remplace son
   bloc local par `const C = screenColors` et bascule d'un coup, sans qu'une
   seule référence ne casse.

   Aucune valeur sombre ici : les fonds d'écran restent blancs. Le sombre est
   réservé à la barre d'onglets flottante.
═══════════════════════════════════════════════════════════ */
export const screenColors = {
    /* Fonds — le blanc domine, plus de gris bleuté #F8F9FA */
    bg: v2.white,
    bgDeep: v2.neutral,
    surface: v2.white,
    surfaceSolid: v2.white,
    surfaceSoft: v2.greenSoft,
    surfaceAlt: v2.neutral,
    surfaceWarm: v2.neutral,

    /* Traits */
    border: v2.line,
    borderStrong: v2.lineStrong,
    line: v2.line,

    /* Vert d'action */
    primary: v2.green,
    primaryDark: v2.greenDark,
    primaryDeep: v2.greenDark,
    primaryLight: '#1FA36A',
    primarySoft: v2.greenSoft,
    primaryGlow: 'rgba(0,135,81,0.20)',
    primaryText: v2.white,
    green: v2.green,
    greenSoft: '#1FA36A',
    emerald: v2.green,
    successMid: '#1FA36A',
    accentInk: v2.yellowInk,
    floating: v2.floating,
    floatingMuted: '#9A9A9A',
    textFaint: v2.inkFaint,

    /* Jaune premium. `accentDark` sert de couleur de TEXTE : on prend l'encre
       jaune foncée, lisible sur blanc, pas un jaune vif illisible. */
    accent: v2.yellow,
    accentDark: v2.yellowInk,
    accentLight: v2.yellowSoft,
    accentSoft: v2.yellowSoft,
    gold: v2.yellow,
    goldSoft: v2.yellowSoft,
    goldDeep: v2.yellowInk,
    goldGlow: 'rgba(252,209,22,0.18)',

    /* Sémantique. `info` était bleu #00643C : hors drapeau, ramené au vert
       foncé. `purple` idem. */
    error: v2.red,
    danger: v2.red,
    dangerSoft: v2.redSoft,
    ruby: v2.red,
    success: v2.green,
    successBg: v2.greenSoft,
    info: v2.greenDark,
    warning: '#8A6D08',
    purple: v2.yellowInk,

    /* Textes */
    text: v2.ink,
    textPrimary: v2.ink,
    ink: v2.ink,
    textSec: v2.inkMuted,
    textSecond: v2.inkMuted,
    textSoft: v2.inkMuted,
    inkSoft: v2.inkMuted,
    textMuted: v2.inkFaint,
    textSubtle: v2.inkFaint,
    inkMuted: v2.inkFaint,
    placeholder: v2.inkFaint,

    overlay: 'rgba(60,60,60,0.55)',
} as const

export const theme = { colors, flag, fonts, typography, spacing, radius, shadows, motion, skeletonColors, screenColors }
export default theme
