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
    withRepeat,
    Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLang, SUPPORTED_LANGUAGES, type LangCode } from '../contexts/LangContext';
import { screenColors, fonts } from '../config/theme'

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

/* ─────────────────────────────────────────────────────────────
   LE MOT-SYMBOLE EST UNE IMAGE, PAS DU TEXTE. Ne pas revenir en arriere.

   Sept corrections successives ont echoue a l afficher en entier sur
   Android, chacune sur une hypothese differente : interlettrage qui deborde,
   rangee flex trop large, fragments <Text> imbriques, taille de police.
   Le symptome revenait sous une forme voisine a chaque fois — « RETOU »,
   « GAGNAN », « BÉNI », et jusqu au dernier mot entier de l accroche qui
   disparaissait. Le point commun : la vue de texte etait mesuree plus
   etroite que ce que le moteur y dessinait, et le surplus etait coupe net.

   La mesure des metriques de la police (scripts/mesure-mot-symbole.js)
   ecarte le debordement : « RETOUR GAGNANT » fait 243 dp a 26 px pour
   272 dp utiles sur l ecran le plus etroit vise. La cause exacte n a pas pu
   etre isolee a distance, faute d appareil de deverminage.

   D ou ce choix, qui est de toute facon celui de la plupart des
   applications pour leur logotype : le nom est un ASSET. Une image ne se
   mesure pas, ne se recompose pas, ne se rogne pas. Elle s affiche au pixel
   pres, quels que soient l appareil, la version du systeme et les polices
   disponibles. Toute cette classe de defauts disparait avec elle.

   L image est produite par scripts/generer-mot-symbole.js, qui lit les
   contours des glyphes dans Plus Jakarta Sans ExtraBold et les ecrit en
   chemins vectoriels. Modifier le libelle ou les couleurs = editer ce
   script et le relancer, jamais retoucher l image a la main.

   Contrepartie assumee : le nom ne suit plus l agrandissement systeme des
   polices. L ecran ne dure que 1,8 s et tout le reste de l application
   reste du vrai texte.
   ───────────────────────────────────────────────────────────── */

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

    /* Rotation continue du témoin de chargement. Reanimated coupe de
       lui-même les répétitions quand « Réduire les animations » est actif :
       aucun garde-fou à ajouter. */
    const rotation = useSharedValue(0);
    useEffect(() => {
        rotation.value = withRepeat(
            withTiming(360, { duration: 900, easing: Easing.linear }),
            -1,
            false,
        );
    }, []);

    const aLogo = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ scale: scale.value }],
    }));
    const aText = useAnimatedStyle(() => ({
        opacity: textOpacity.value,
        transform: [{ translateY: textY.value }],
    }));
    const aSpinner = useAnimatedStyle(() => ({
        transform: [{ rotate: `${rotation.value}deg` }],
    }));

    return (
        <View style={styles.splashContent}>
            {/* Bande tricolore en tête d'écran, comme sur la maquette. */}
            <View style={styles.flagBar}>
                <View style={styles.flagGreen} />
                <View style={styles.flagYellow} />
                <View style={styles.flagRed} />
            </View>

            <View style={styles.centre}>
                <Animated.View style={aLogo}>
                    <Image
                        source={require('../../assets/splash-icon.png')}
                        style={styles.logo}
                        resizeMode="contain"
                    />
                </Animated.View>

                {/* Le mot-symbole est une IMAGE, pas du texte — voir la note en
                    tête de fichier. `accessibilityLabel` rend le nom au lecteur
                    d'écran, que l'image ne peut évidemment pas énoncer. */}
                <Animated.Image
                    source={require('../../assets/mot-symbole.png')}
                    style={[styles.motSymbole, aText]}
                    resizeMode="contain"
                    accessibilityRole="image"
                    accessibilityLabel="Retour Gagnant Bénin — l'accompagnement premium"
                />
            </View>

            <Animated.View style={[styles.spinner, aSpinner]} />
        </View>
    );
}

/* ═══════════════════════════════════════
   ÉCRAN 2 : Sélection langue
═══════════════════════════════════════ */
function LanguageView({ onContinue }: { onContinue?: () => void }) {
    const { lang, setLang } = useLang();
    const [selected, setSelected] = useState<LangCode>(lang);
    /* Le bas de l'écran appartient au système : barre de navigation à trois
       boutons ou barre de geste. Un remplissage fixe de 24 dp passait dessous
       et « Continuer » se retrouvait derrière les touches du téléphone. */
    const marges = useSafeAreaInsets();
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
        <Animated.View
            style={[
                styles.langContent,
                { paddingBottom: Math.max(marges.bottom, 12) + 24 },
                aContent,
            ]}
        >
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
    /* Bande tricolore, 6 dp, trois parts égales. */
    flagBar: {
        position: 'absolute',
        top: 0, left: 0, right: 0,
        height: 6,
        flexDirection: 'row',
    },
    flagGreen: { flex: 1, backgroundColor: '#008751' },
    flagYellow: { flex: 1, backgroundColor: '#FCD116' },
    flagRed: { flex: 1, backgroundColor: '#E8112D' },

    centre: {
        alignSelf: 'stretch',
        alignItems: 'center',
    },
    /* Plus de tuile autour du logo : le logo porte déjà son propre cercle,
       un second cadre faisait doublon et le rapetissait. */
    logo: {
        width: 260,
        height: 260,
        marginBottom: 24,
    },
    /* Proportions de l'image produite par scripts/generer-mot-symbole.js
       (908 x 303 px, soit 303 x 101 dp). La largeur suit celle de l'écran et
       plafonne à sa taille native : sur un téléphone étroit elle rétrécit
       proportionnellement au lieu de déborder. */
    motSymbole: {
        width: '100%',
        maxWidth: 303,
        aspectRatio: 908 / 303,
    },
    /* Témoin de chargement : anneau ouvert, un seul côté teinté. */
    spinner: {
        position: 'absolute',
        bottom: 56,
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: '#CCE7DC',   // vert Bénin à 20 % sur blanc
        borderTopColor: '#008751',
    },

    /* ── Langue ── */
    langContent: {
        flex: 1,
        paddingTop: Platform.OS === 'ios' ? 100 : 80,
        paddingHorizontal: 24,
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