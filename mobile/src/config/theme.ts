/* ═══════════════════════════════════════════════════════════
   Retour Gagnant Bénin — Design System v5.0 (Nexus Emerald)
   Palette : Vert Émeraude / Mode Sombre Futuriste (Glow)
   Typography : Outfit (body) + Playfair Display (headings)
   Directement hérité du front-end ("Agent Dashboard Design System")
   ─── UI/UX Pro Max compliant ───
═══════════════════════════════════════════════════════════ */

export const colors = {
    // ── Vert Émeraude primaire (accent principal Nexus) ──
    primary: '#10B981', // hsl(160, 84%, 39%) --nexus-accent
    primaryDark: '#047857', // hsl(160, 90%, 25%)
    primaryLight: '#34D399', // hsl(160, 65%, 50%)
    primarySoft: 'rgba(16, 185, 129, 0.15)', // --nexus-accent-soft
    primaryMuted: 'rgba(16, 185, 129, 0.12)',
    primaryGlow: 'rgba(16, 185, 129, 0.35)', // --nexus-glow

    // ── Teal / Info ──
    teal: '#14B8A6', // --nexus-teal hsl(174, 72%, 40%)

    // ── Couleurs du drapeau béninois (Optionnel/Touches) ──
    flagGreen: '#008751',
    flagYellow: '#FCD116',
    flagRed: '#E8112D',

    // ── Or (accent secondaire / premium) ──
    gold: '#C9A84C',
    goldLight: '#E2C97E',
    goldDark: '#A68B3C',
    goldSoft: '#F5EDD6',
    goldMuted: 'rgba(201, 168, 76, 0.12)',
    goldShimmer: 'rgba(201, 168, 76, 0.06)',

    // ── Fonds — Mode Clair (Identique Frontend) ──
    background: '#FFFFFF', 
    surface: '#FFFFFF', 
    surfaceWarm: '#F8FAF9', 
    surfaceElevated: '#FFFFFF', 
    headerBg: '#10B981', // En-tête avec la couleur primaire pour ressortir sur du fond blanc

    // ── Textes ──
    textPrimary: '#1a2332', 
    textSecondary: '#4A5568', 
    textMuted: '#718096', 
    textGold: '#A68B3C',
    textOnDark: '#FFFFFF',
    textOnPrimary: '#FFFFFF', 
    textOnGold: '#FFFFFF',

    // ── Bleu nuit (fallback dark sections) ──
    navy: '#0C1B33',
    navyLight: '#1A2D4D',
    navyMuted: 'rgba(12, 27, 51, 0.08)',

    // ── Statuts ──
    success: '#10B981',
    successLight: 'rgba(16, 185, 129, 0.2)',
    successBg: 'rgba(16, 185, 129, 0.1)',

    warning: '#F59E0B',
    warningLight: 'rgba(245, 158, 11, 0.2)',
    warningBg: 'rgba(245, 158, 11, 0.10)',

    danger: '#EF4444',
    dangerLight: 'rgba(239, 68, 68, 0.2)',
    dangerBg: 'rgba(239, 68, 68, 0.10)',

    info: '#3B82F6',
    infoLight: 'rgba(59, 130, 246, 0.2)',
    infoBg: 'rgba(59, 130, 246, 0.10)',

    // ── Borders ──
    // --nexus-border-subtle: hsla(160, 50%, 50%, 0.06);
    border: 'rgba(16, 185, 129, 0.12)', // --nexus-border-default hsla(160, 50%, 50%, 0.10)
    borderLight: 'rgba(16, 185, 129, 0.06)', 
    borderGold: 'rgba(201, 168, 76, 0.25)',
    borderPrimary: 'rgba(16, 185, 129, 0.20)', // --nexus-border-strong 

    // ── Overlays ──
    overlay: 'rgba(26, 35, 50, 0.70)',
    overlayLight: 'rgba(26, 35, 50, 0.20)',

    // ── Glass (transparence douce sur fond clair) ──
    glass: 'rgba(255, 255, 255, 0.85)',
    glassDark: 'rgba(255, 255, 255, 0.95)',
}

export const gradients = {
    primary: ['#10B981', '#047857'] as string[],
    primaryDark: ['#047857', '#022C22'] as string[],
    gold: ['#E2C97E', '#C9A84C'] as string[],
    flag: ['#008751', '#FCD116', '#E8112D'] as string[],
    flagBtn: ['#008751', '#FCD116'] as string[],
    navy: ['#2A3A54', '#1a2332'] as string[],
    lightBg: ['#FFFFFF', '#F8FAF9'] as string[],
    card: ['#FFFFFF', '#F8FAF9'] as string[],
    darkCard: ['#F8FAF9', '#F0F9F5'] as string[],
}

export const spacing = {
    xxs: 2,
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
    xxxl: 64,
}

export const radius = {
    xs: 6,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 28,
    pill: 999,
    full: 999,
}

export const shadows = {
    xs: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 1,
    },
    sm: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 3,
    },
    md: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 5,
    },
    lg: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 24,
        elevation: 8,
    },
    primary: {
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 32,
        elevation: 10,
    },
    gold: {
        shadowColor: '#C9A84C',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.20,
        shadowRadius: 14,
        elevation: 6,
    },
    glow: {
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.35,
        shadowRadius: 20,
        elevation: 10,
    },
}

// ── Familles de polices (Outfit & Playfair Display) ──
export const fonts = {
    heading: 'PlayfairDisplay_700Bold',
    headingRegular: 'PlayfairDisplay_400Regular',
    body: 'Outfit_400Regular',
    bodyMedium: 'Outfit_500Medium',
    bodySemibold: 'Outfit_600SemiBold',
    bodyBold: 'Outfit_700Bold',
}

export const typography = {
    h1: { fontSize: 28, fontFamily: 'PlayfairDisplay_700Bold', letterSpacing: -0.3 },
    h2: { fontSize: 22, fontFamily: 'PlayfairDisplay_700Bold', letterSpacing: -0.2 },
    h3: { fontSize: 18, fontFamily: 'Outfit_600SemiBold', letterSpacing: -0.1 },
    body: { fontSize: 16, fontFamily: 'Outfit_400Regular', lineHeight: 24 },
    bodySmall: { fontSize: 14, fontFamily: 'Outfit_400Regular', lineHeight: 21 },
    caption: { fontSize: 12, fontFamily: 'Outfit_500Medium', lineHeight: 16 },
    overline: { fontSize: 11, fontFamily: 'Outfit_700Bold', letterSpacing: 1.5, textTransform: 'uppercase' as const },
    label: { fontSize: 13, fontFamily: 'Outfit_600SemiBold' },
    button: { fontSize: 15, fontFamily: 'Outfit_700Bold', letterSpacing: 0.3 },
}

/* ── Royal — Tokens dorés/chic utilisés par les écrans premium ── */
export const royal = {
    bg: colors.background,
    bgWarm: '#FDF9F1',           // Fond chaud Boutique
    surface: colors.surface,
    gold: colors.gold,
    goldLight: colors.goldLight,
    goldDark: colors.goldDark,
    goldSoft: '#F8E9C7',         // Or très pâle (backgrounds)
    goldShimmer: colors.goldShimmer,
    emerald: colors.primary,
    lightEmerald: colors.primaryLight,
    deepEmerald: '#0B4A2B',      // Vert très profond (headers, nav bars)
    deepLightEmerald: '#12683E', // Vert profond clair (gradients)
    terracotta: '#D45B3E',       // Accent chaud (badges, prix soldés)
    textDark: colors.textPrimary,
    textLight: colors.textOnDark,
    border: '#EBE2CD',           // Bordure douce chaude
}

/* ═══════════════════════════════════════════════════════════
   Motion — durées et easings standardisés (Reanimated 4)
   Évite les "magic numbers" dispersés. Référencer ces tokens
   pour toutes les animations de press, fade, slide.
═══════════════════════════════════════════════════════════ */
export const motion = {
    // Durées (ms)
    instant: 80,
    fast: 160,
    base: 220,
    slow: 320,
    slower: 480,

    // Spring presets pour Reanimated withSpring()
    spring: {
        snappy: { damping: 18, stiffness: 220, mass: 0.6 },
        soft:   { damping: 22, stiffness: 140, mass: 0.8 },
        bounce: { damping: 12, stiffness: 180, mass: 0.7 },
    },

    // Échelles standard pour press states
    pressScale: 0.97,
    pressScaleStrong: 0.94,
}

/* ═══════════════════════════════════════════════════════════
   Skeleton — couleurs shimmer pour les loading states
═══════════════════════════════════════════════════════════ */
export const skeletonColors = {
    base: '#EAEEF2',
    highlight: '#F5F8FA',
}
