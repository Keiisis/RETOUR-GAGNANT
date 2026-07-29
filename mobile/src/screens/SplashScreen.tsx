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
import { screenColors } from '../config/theme'

const { width } = Dimensions.get('window');

/* ═══════════════════════════════════════
   Couleurs — Silent Luxury
═══════════════════════════════════════ */
// Palette de l'ecran : plus de copie locale. Toutes les couleurs
// viennent du design system v2 (blanc + tricolore Benin).
const C = screenColors

/* ═══════════════════════════════════════
   Props — Contrat avec AppNavigator
═══════════════════════════════════════ */
interface SplashScreenProps {
    isLoading?: boolean;
    onContinue?: () => void;
}

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
   ÉCRAN 1 — Splash pur
═══════════════════════════════════════ */
function SplashView() {
    const opacity = useSharedValue(0);
    const scale = useSharedValue(0.96);
    const textOpacity = useSharedValue(0);
    const textY = useSharedValue(8);

    useEffect(() => {
        opacity.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) });
        scale.value = withSpring(1, { damping: 20, stiffness: 90 });
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

            <Animated.View style={[styles.brandText, aText]}>
                <View style={styles.brandRow}>
                    <Text style={[styles.brandWord, styles.brandGreen]}>RETOUR</Text>
                    <Text style={styles.brandSpace}> </Text>
                    <Text style={[styles.brandWord, styles.brandYellow]}>GAGNANT</Text>
                </View>
                <Text style={[styles.brandWord, styles.brandRed]}>BÉNIN</Text>
            </Animated.View>
        </View>
    );
}

/* ═══════════════════════════════════════
   ÉCRAN 2 — Sélection langue
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

            {/* Liste — style iOS natif */}
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

            {/* CTA — bouton unique, plein, comme toutes les apps modernes */}
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
    brandRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    brandWord: {
        fontSize: 30,
        fontWeight: '900',
        letterSpacing: 3,
        fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    },
    brandSpace: {
        fontSize: 30,
    },
    brandGreen: {
        color: '#008751',  // Vert Bénin
    },
    brandYellow: {
        color: '#FCD116',  // Jaune Bénin
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
        fontWeight: '700',
        color: C.ink,
        letterSpacing: -1,
        marginBottom: 8,
        fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
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
        fontWeight: '500',
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
        borderWidth: 1.5,
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
        fontWeight: '600',
        letterSpacing: -0.2,
    },
    ctaTextDisabled: {
        color: C.inkMuted,
    },
});