import React, { useEffect, useState } from 'react';
import {
    View, Image, StyleSheet, Text, Platform,
    TouchableOpacity, Dimensions, StatusBar, Pressable,
} from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    withDelay,
    Easing,
} from 'react-native-reanimated';
import { useLang, SUPPORTED_LANGUAGES, type LangCode } from '../contexts/LangContext';
import { screenColors, fonts } from '../config/theme'

const { width } = Dimensions.get('window');

/* ═══════════════════════════════════════
   Couleurs : Silent Luxury
═══════════════════════════════════════ */
// Palette de l'ecran : plus de copie locale. Toutes les couleurs
// viennent du design system v2 (blanc + tricolore Benin).
const C = screenColors

/* ═══════════════════════════════════════
   Props : Contrat avec AppNavigator
═══════════════════════════════════════ */
interface SplashScreenProps {
    isLoading?: boolean;
    onContinue?: () => void;
}

/* Android applique l interlettrage APRES le dernier caractere sans le
   compter dans la largeur mesuree du texte : la derniere lettre se faisait
   couper. Le remplissage a droite n y change rien — en React Native il
   elargit la vue mais le texte reste cale sur le bord de la zone de contenu.
   Il faut un CARACTERE qui absorbe l espace fantome : une espace fine
   (U+2009) en fin de mot. */
const ESPACE_FINE = String.fromCharCode(0x2009)

/* ─────────────────────────────────────────────────────────────
   POURQUOI CE BLOC EST ECRIT COMME CA — a lire avant d y toucher.

   Cinq corrections successives ont echoue ici, toutes fondees sur la meme
   hypothese jamais verifiee : « le texte deborde de l ecran ». Les metriques
   du fichier de police disent le contraire.

   Mesure de Plus Jakarta Sans ExtraBold (tables head/cmap/hmtx, script
   scripts/mesure-mot-symbole.js), interlettrage de 2 compris :

       « RETOUR GAGNANT »  26 px = 271 dp     « GAGNANT »  26 px = 147 dp
       ecran le plus etroit vise (320 dp) = 272 dp utiles

   Le texte a TOUJOURS tenu. Le debordement n a jamais existe.

   Le vrai defaut etait visible sur la capture du 2026-08-27 : « BÉNIN »
   s affichait parfaitement, « RETOUR GAGNANT » perdait son second mot.
   Difference entre les deux : BÉNIN est un <Text> SIMPLE, l autre etait un
   <Text> parent portant `letterSpacing` avec des fragments <Text> imbriques
   pour les couleurs. Android compose alors un SpannableString et ne rend que
   le premier fragment.

   D ou la regle : UN MOT = UN <Text> AUTONOME, jamais d imbrication.
   C est le motif qui fonctionne deja sur cet ecran, applique aux trois mots.

   Second defaut, independant : le jaune du drapeau (#FCD116) sur fond blanc
   vaut 1,2:1 de contraste. Meme rendu, il reste illisible. Le theme prevoit
   `yellowInk` (#856809, 4,9:1) exactement pour ce cas.

   26 px est fixe, pas calcule : la mesure ci-dessus donne 1,85x de marge sur
   l appareil le plus etroit. Un calcul dynamique n ajouterait qu une variable
   de plus a se tromper.
   ───────────────────────────────────────────────────────────── */
const TAILLE_MARQUE = 26

export default function SplashScreen({ isLoading = false, onContinue }: SplashScreenProps) {
    const [screen, setScreen] = useState<'splash' | 'language'>('splash');

    useEffect(() => {
        if (isLoading) return; // Pas de transition auto en mode chargement
        // Auto-transition après 1.8s (comme vraies apps)
        const t = setTimeout(() => setScreen('language'), 1800);
        return () => clearTimeout(t);
    }, [isLoading]);

    return (
        <View style={styles.root}>
            <StatusBar barStyle="dark-content" />
            {screen === 'splash' || isLoading
                ? <SplashView />
                : <LanguageView onContinue={onContinue} />
            }
        </View>
    );
}

/* ═══════════════════════════════════════
   ÉCRAN 1 : Splash pur
═══════════════════════════════════════ */
function SplashView() {
    // Logo figé à son état final = identique au splash NATIF (blanc + logo centré).
    // Sans ça, il repartait d'opacity 0 → clignotait entre le natif et le custom,
    // donnant l'impression de « 2 splash ». Seul le nom s'anime maintenant.
    const opacity = useSharedValue(1);
    const scale = useSharedValue(1);
    const textOpacity = useSharedValue(0);
    const textY = useSharedValue(8);

    useEffect(() => {
        textOpacity.value = withDelay(250, withTiming(1, { duration: 500 }));
        textY.value = withDelay(250, withSpring(0, { damping: 22, stiffness: 100 }));
    }, []);

    const aLogo = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ scale: scale.value }],
    }));
    const aText = useAnimatedStyle(() => ({
        opacity: textOpacity.value,
        transform: [{ translateY: textY.value }],
    }));

    return (
        <View style={styles.splashContent}>
            <Animated.View style={[styles.logoWrap, aLogo]}>
                <Image
                    source={require('../../assets/splash-icon.png')}
                    style={styles.logo}
                    resizeMode="contain"
                />
            </Animated.View>

            {/* Trois mots, trois <Text> autonomes empilés. Aucun fragment
                imbriqué, aucune rangée flex : voir la note en tête de fichier
                — c'est l'imbrication qui effaçait « GAGNANT ». */}
            <Animated.View style={[styles.brandText, aText]}>
                <Text style={[styles.brandLine, styles.brandGreen]}>
                    {'RETOUR' + ESPACE_FINE}
                </Text>
                <Text style={[styles.brandLine, styles.brandYellow]}>
                    {'GAGNANT' + ESPACE_FINE}
                </Text>
                <Text style={[styles.brandLine, styles.brandRed]}>
                    {'BÉNIN' + ESPACE_FINE}
                </Text>
            </Animated.View>
        </View>
    );
}

/* ═══════════════════════════════════════
   ÉCRAN 2 : Sélection langue
═══════════════════════════════════════ */
function LanguageView({ onContinue }: { onContinue?: () => void }) {
    const { lang, setLang } = useLang();
    const [selected, setSelected] = useState<LangCode>(lang);
    const opacity = useSharedValue(0);
    const slide = useSharedValue(12);

    useEffect(() => {
        opacity.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) });
        slide.value = withSpring(0, { damping: 24, stiffness: 90 });
    }, []);

    const aContent = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ translateY: slide.value }],
    }));

    const handleContinue = () => {
        if (!selected) return;
        setLang(selected);
        onContinue?.();
    };

    return (
        <Animated.View style={[styles.langContent, aContent]}>
            {/* Header */}
            <View style={styles.langHeader}>
                <Text style={styles.langTitle}>Bienvenue</Text>
                <Text style={styles.langSubtitle}>
                    Choisissez votre langue pour continuer
                </Text>
            </View>

            {/* Liste : style iOS natif */}
            <View style={styles.langList}>
                {SUPPORTED_LANGUAGES.map((item, idx) => {
                    const isActive = selected === item.code;
                    const isLast = idx === SUPPORTED_LANGUAGES.length - 1;
                    return (
                        <Pressable
                            key={item.code}
                            onPress={() => setSelected(item.code)}
                            style={({ pressed }) => [
                                styles.langRow,
                                !isLast && styles.langRowBorder,
                                pressed && { backgroundColor: C.bgDeep },
                            ]}
                            accessibilityRole="button"
                            hitSlop={6}
                        >
                            <Text style={styles.langFlag}>{item.flag}</Text>
                            <View style={styles.langRowText}>
                                <Text style={styles.langLabel}>{item.nativeLabel}</Text>
                                <Text style={styles.langSub}>{item.label}</Text>
                            </View>
                            <View style={[
                                styles.radio,
                                isActive && styles.radioActive,
                            ]}>
                                {isActive && <View style={styles.radioDot} />}
                            </View>
                        </Pressable>
                    );
                })}
            </View>

            {/* CTA : bouton unique, plein, comme toutes les apps modernes */}
            <TouchableOpacity
                style={[styles.cta, !selected && styles.ctaDisabled]}
                disabled={!selected}
                activeOpacity={0.85}
                onPress={handleContinue}
                accessibilityRole="button"
                hitSlop={6}
            >
                <Text style={[styles.ctaText, !selected && styles.ctaTextDisabled]}>
                    Continuer
                </Text>
            </TouchableOpacity>
        </Animated.View>
    );
}

/* ═══════════════════════════════════════
   STYLES
═══════════════════════════════════════ */
const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: C.bg,
    },

    /* ── Splash ── */
    splashContent: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    logoWrap: {
        marginBottom: 28,
    },
    logo: {
        width: 200,
        height: 200,
    },
    brandText: {
        alignItems: 'center',
    },
    /* 26 px et interlettrage 2 : « RETOUR GAGNANT » mesure alors environ
       300 dp, contre 363 disponibles sur le plus étroit des écrans courants.
       La marge absorbe les polices plus larges et les écrans de 360 dp. */
    brandLine: {
        fontSize: TAILLE_MARQUE,
        fontFamily: fonts.extrabold,
        letterSpacing: 2,
        includeFontPadding: false,
        textAlign: 'center',
    },
    brandGreen: {
        color: '#008751',  // Vert Bénin
    },
    brandYellow: {
        /* PAS le jaune du drapeau (#FCD116) : 1,2:1 sur blanc, illisible.
           `yellowInk` est l'or foncé du thème, prévu pour du texte jaune sur
           fond clair (4,9:1). */
        color: C.premiumInk,
    },
    brandRed: {
        color: '#E8112D',  // Rouge Bénin
        marginTop: 2,
        letterSpacing: 8,
    },

    /* ── Langue ── */
    langContent: {
        flex: 1,
        paddingTop: Platform.OS === 'ios' ? 100 : 80,
        paddingHorizontal: 24,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    },
    langHeader: {
        marginBottom: 40,
    },
    langTitle: {
        fontSize: 34,
        fontFamily: fonts.bold,
        color: C.ink,
        letterSpacing: -1,
        marginBottom: 8,
    },
    langSubtitle: {
        fontSize: 16,
        color: C.inkSoft,
        lineHeight: 22,
        letterSpacing: -0.2,
    },

    langList: {
        backgroundColor: C.surface,
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 32,
        // Ombre très douce, iOS-style
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 2 },
    },
    langRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 18,
        backgroundColor: C.surface,
    },
    langRowBorder: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: C.line,
    },
    langFlag: {
        fontSize: 26,
        marginRight: 14,
    },
    langRowText: {
        flex: 1,
    },
    langLabel: {
        fontSize: 16,
        fontFamily: fonts.medium,
        color: C.ink,
        letterSpacing: -0.2,
        marginBottom: 2,
    },
    langSub: {
        fontSize: 13,
        color: C.inkMuted,
        letterSpacing: -0.1,
    },

    /* Radio iOS-style */
    radio: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 1,
        borderColor: C.line,
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioActive: {
        borderColor: C.ink,
    },
    radioDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: C.ink,
    },

    /* CTA */
    cta: {
        backgroundColor: C.ink,
        paddingVertical: 17,
        borderRadius: 14,
        alignItems: 'center',
        marginTop: 'auto',
    },
    ctaDisabled: {
        backgroundColor: C.line,
    },
    ctaText: {
        color: C.bg,
        fontSize: 16,
        fontFamily: fonts.semibold,
        letterSpacing: -0.2,
    },
    ctaTextDisabled: {
        color: C.inkMuted,
    },
});