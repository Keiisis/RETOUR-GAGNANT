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
   LE MOT-SYMBOLE — six corrections avant celle-ci. Lire avant d y toucher.

   Les cinq premieres poursuivaient une hypothese jamais verifiee : « le
   texte deborde de l ecran ». Les metriques de la police disent l inverse.
   Mesure des tables du fichier (scripts/mesure-mot-symbole.js, lecture de
   head/cmap/hhea/hmtx de Plus Jakarta Sans ExtraBold) :

       « RETOUR GAGNANT »  26 px, sans interlettrage = 243 dp
       ecran le plus etroit vise (320 dp) = 272 dp utiles

   Il tenait depuis le debut.

   DEUX CAUSES REELLES, toutes deux supprimees ici :

   1. `letterSpacing` POSITIF. Android ajoute l interlettrage apres CHAQUE
      caractere, dernier compris, mais ne le compte pas dans la largeur
      mesuree du texte. La vue est donc trop etroite de la valeur d un
      interlettrage et la derniere lettre se fait rogner — « RETOU »,
      « GAGNAN ». Une espace fine en fin de mot n y change rien : Android
      supprime les blancs de fin de ligne au moment du calcul.

      La maquette de reference demande `tracking-tight`, donc un
      interlettrage serre. Il est desormais nul ou negatif partout dans la
      marque : plus de largeur fantome, plus de rognage.

   2. FRAGMENTS <Text> IMBRIQUES. Un <Text> parent contenant des <Text>
      enfants colores devient un SpannableString, dont Android ne rendait
      que le premier fragment — « GAGNANT » disparaissait entierement.
      Les deux mots de la premiere ligne sont maintenant deux <Text> FRERES
      dans une rangee, jamais imbriques.

   Regle de securite conservee : tout texte portant un interlettrage positif
   (ici la seule accroche) est etire sur toute la largeur avec
   `textAlign: 'center'`. Sa zone de dessin depasse alors largement le texte,
   donc rien ne peut etre rogne.
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
                <Animated.View style={[styles.logoTile, aLogo]}>
                    <Image
                        source={require('../../assets/splash-icon.png')}
                        style={styles.logo}
                        resizeMode="contain"
                    />
                </Animated.View>

                <Animated.View style={[styles.brandText, aText]}>
                    {/* Deux <Text> FRÈRES dans une rangée — jamais imbriqués,
                        c'est l'imbrication qui effaçait « GAGNANT ». La rangée
                        mesure 243 dp à 26 px, contre 272 dp utiles sur le plus
                        étroit des écrans visés. */}
                    <View style={styles.brandRow}>
                        <Text style={[styles.brandWord, styles.brandGreen]}>RETOUR</Text>
                        <Text style={[styles.brandWord, styles.brandSpace]}> </Text>
                        <Text style={[styles.brandWord, styles.brandYellow]}>GAGNANT</Text>
                    </View>
                    <Text style={[styles.brandWord, styles.brandRed]}>BÉNIN</Text>

                    <Text style={styles.tagline}>L'ACCOMPAGNEMENT PREMIUM</Text>
                </Animated.View>
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
        alignItems: 'center',
    },
    /* Tuile du logo : vert Bénin à 5 % sur blanc, angles très arrondis. */
    logoTile: {
        width: 148,
        height: 148,
        borderRadius: 44,
        backgroundColor: '#F2F8F5',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 28,
    },
    logo: {
        width: 108,
        height: 108,
    },
    brandText: {
        alignItems: 'center',
    },
    brandRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    /* AUCUN interlettrage positif : c'est lui qui rognait la dernière lettre
       (« RETOU », « GAGNAN »). La maquette demande `tracking-tight`, donc une
       valeur négative — qui, en prime, ne peut pas créer de largeur fantôme. */
    brandWord: {
        fontSize: TAILLE_MARQUE,
        fontFamily: fonts.extrabold,
        letterSpacing: -0.4,
        includeFontPadding: false,
        textAlign: 'center',
    },
    brandSpace: {
        /* L'espace entre les deux mots : une vue de texte à part entière, pour
           ne pas ré-imbriquer de fragment dans un même <Text>. */
        color: 'transparent',
    },
    brandGreen: {
        color: '#008751',  // Vert Bénin
    },
    brandYellow: {
        /* Jaune du drapeau, choix du propriétaire du projet (2026-08-27) après
           avoir vu la variante or foncé. À savoir : sur fond blanc il ne vaut
           que 1,2:1 de contraste — c'est un parti pris d'identité, pas un
           réglage de lisibilité. */
        color: '#FCD116',
    },
    brandRed: {
        color: '#E8112D',  // Rouge Bénin
        marginTop: 2,
    },
    /* Accroche : seul texte à interlettrage large de l'écran. Étirée sur toute
       la largeur pour que sa zone de dessin dépasse le texte — sans quoi la
       dernière lettre serait rognée comme l'était le mot-symbole. */
    tagline: {
        alignSelf: 'stretch',
        textAlign: 'center',
        marginTop: 16,
        fontSize: 12,
        fontFamily: fonts.medium,
        color: C.inkSoft,
        letterSpacing: 2.5,
        includeFontPadding: false,
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