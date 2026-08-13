import React, { useRef, useState } from 'react'
import {
    View, Text, StyleSheet, TouchableOpacity,
    Animated, Dimensions, Platform, Pressable, ImageBackground,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import Svg, { Path } from 'react-native-svg'
import { useLang } from '../contexts/LangContext'
import { fonts } from '../config/theme'

const { width, height } = Dimensions.get('window')

/* ═══════════════════════════════════════
   Types
═══════════════════════════════════════ */
interface OnboardingScreenProps {
    onComplete: () => void
}

interface Slide {
    key: string
    kicker: string
    title: string
    body: string
    image: any
    accent: string
}

/* ═══════════════════════════════════════
   Slides : Storytelling cinématique
═══════════════════════════════════════ */
const SLIDES: Slide[] = [
    {
        key: 'roots',
        kicker: 'Vos Racines',
        title: 'Retrouvez\nvotre terre\nd\'origine',
        body: 'Vous êtes Afro-descendant et le Bénin vous appelle. Retour Gagnant vous accompagne pour reconnecter avec vos racines.',
        image: require('../../assets/onboarding/slide_1_roots.png'),
        accent: '#008751',  // Vert Bénin
    },
    {
        key: 'process',
        kicker: 'Votre Dossier',
        title: 'Nationalité,\npasseport,\nsimplifié',
        body: 'Démarches administratives, obtention de la nationalité béninoise, passeport : notre expertise VIP transforme le complexe en simple.',
        image: require('../../assets/onboarding/slide_2_process.png'),
        accent: '#FCD116',  // Jaune Bénin
    },
    {
        key: 'home',
        kicker: 'Votre Retour',
        title: 'Bienvenue\nchez vous,\nau Bénin',
        body: 'Au-delà des papiers, c\'est une nouvelle vie qui commence. Installation, communauté, héritage : votre retour gagnant.',
        image: require('../../assets/onboarding/slide_3_home.png'),
        accent: '#E8112D',  // Rouge Bénin
    },
]

/* ═══════════════════════════════════════
   Composant principal
═══════════════════════════════════════ */
export default function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
    const insets = useSafeAreaInsets()
    const { t } = useLang()
    const [current, setCurrent] = useState(0)
    const flatRef = useRef<Animated.FlatList<Slide>>(null)
    const scrollX = useRef(new Animated.Value(0)).current

    const goNext = () => {
        if (current < SLIDES.length - 1) {
            const next = current + 1
            // @ts-ignore : FlatList ref typing quirk
            flatRef.current?.scrollToIndex({ index: next, animated: true })
            setCurrent(next)
        } else {
            onComplete()
        }
    }

    const isLast = current === SLIDES.length - 1

    return (
        <View style={styles.container}>
            {/* Header flottant */}
            <View style={styles.header}>
                <View style={styles.chapterPill}>
                    <Text style={styles.chapterText}>
                        {String(current + 1).padStart(2, '0')}
                        <Text style={styles.chapterDim}> / {String(SLIDES.length).padStart(2, '0')}</Text>
                    </Text>
                </View>

                {!isLast && (
                    <Pressable hitSlop={12} onPress={onComplete}
                        accessibilityRole="button">
                        <Text style={styles.skipText}>{t('Passer')}</Text>
                    </Pressable>
                )}
            </View>

            <Animated.FlatList
                ref={flatRef}
                data={SLIDES}
                keyExtractor={item => item.key}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                    { useNativeDriver: true }
                )}
                onMomentumScrollEnd={(e) => {
                    const idx = Math.round(e.nativeEvent.contentOffset.x / width)
                    setCurrent(idx)
                }}
                renderItem={({ item, index }) => (
                    <SlideView item={item} index={index} scrollX={scrollX} />
                )}
            />

            {/* Footer flottant */}
            <View style={styles.footer}>
                <LinearGradient
                    colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.85)']}
                    locations={[0, 0.4, 1]}
                    style={StyleSheet.absoluteFill}
                    pointerEvents="none"
                />

                {/* Marge basse issue de `insets` : sous Android 15+ l'app
                   dessine sous la barre systeme, et une constante placait le
                   bouton « Continuer » dessous. */}
                <View style={[styles.footerInner, { paddingBottom: insets.bottom + 20 }]}>
                    {/* Progress segments */}
                    <View style={styles.progressTrack}>
                        {SLIDES.map((_, i) => {
                            const inputRange = [(i - 1) * width, i * width, (i + 1) * width]
                            /* `flex` était animé ici, d'où l'erreur console
                               « Style property 'flex' is not supported by native
                               animated module » : le défilement est piloté par
                               le moteur natif (`useNativeDriver: true`), qui
                               n'accepte que les transformations et l'opacité.
                               `scaleX` produit le même effet : le segment actif
                               s'allonge : et il est nativement pris en charge. */
                            const scaleX = scrollX.interpolate({
                                inputRange,
                                outputRange: [1, 3, 1],
                                extrapolate: 'clamp',
                            })
                            const opacity = scrollX.interpolate({
                                inputRange,
                                outputRange: [0.3, 1, 0.3],
                                extrapolate: 'clamp',
                            })
                            return (
                                <Animated.View
                                    key={i}
                                    style={[
                                        styles.progressSeg,
                                        {
                                            opacity,
                                            backgroundColor: '#FFFFFF',
                                            transform: [{ scaleX }],
                                        },
                                    ]}
                                />
                            )
                        })}
                    </View>

                    <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={goNext}
                        style={styles.cta}
                        accessibilityRole="button"
                        hitSlop={6}
                    >
                        <Text style={styles.ctaText}>
                            {isLast ? t('Commencer mon retour') : t('Continuer')}
                        </Text>
                        <ArrowIcon />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    )
}

/* ═══════════════════════════════════════
   Slide individuel : Ken Burns + Parallax
═══════════════════════════════════════ */
function SlideView({
    item,
    index,
    scrollX,
}: {
    item: Slide
    index: number
    scrollX: Animated.Value
}) {
    const { t } = useLang()
    const inputRange = [(index - 1) * width, index * width, (index + 1) * width]

    // Ken Burns effect : zoom léger + parallax
    const imageScale = scrollX.interpolate({
        inputRange,
        outputRange: [1.15, 1, 1.15],
        extrapolate: 'clamp',
    })
    const imageTranslate = scrollX.interpolate({
        inputRange,
        outputRange: [width * 0.3, 0, -width * 0.3],
        extrapolate: 'clamp',
    })
    const textOpacity = scrollX.interpolate({
        inputRange,
        outputRange: [0, 1, 0],
        extrapolate: 'clamp',
    })
    const textTranslate = scrollX.interpolate({
        inputRange,
        outputRange: [40, 0, -40],
        extrapolate: 'clamp',
    })

    return (
        <View style={styles.slide}>
            {/* Image avec parallax + Ken Burns */}
            <Animated.View
                style={[
                    styles.imageWrap,
                    {
                        transform: [
                            { scale: imageScale },
                            { translateX: imageTranslate },
                        ],
                    },
                ]}
            >
                <ImageBackground source={item.image} style={styles.image} />
            </Animated.View>

            {/* Vignette sombre pour la lisibilité du texte */}
            <LinearGradient
                colors={[
                    'rgba(0,0,0,0.1)',
                    'rgba(0,0,0,0.3)',
                    'rgba(0,0,0,0.75)',
                    'rgba(0,0,0,0.95)',
                ]}
                locations={[0, 0.35, 0.7, 1]}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
            />

            {/* Texte */}
            <Animated.View
                style={[
                    styles.textBlock,
                    {
                        opacity: textOpacity,
                        transform: [{ translateY: textTranslate }],
                    },
                ]}
            >
                <Text style={[styles.kicker, { color: item.accent }]}>
                    {t(item.kicker).toUpperCase()}
                </Text>

                <Text style={styles.title}>{t(item.title)}</Text>

                <View style={[styles.accentLine, { backgroundColor: item.accent }]} />

                <Text style={styles.body}>{t(item.body)}</Text>
            </Animated.View>
        </View>
    )
}

/* ═══════════════════════════════════════
   Arrow Icon (inline SVG)
═══════════════════════════════════════ */
function ArrowIcon() {
    return (
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path
                d="M5 12h14M13 6l6 6-6 6"
                stroke="#3C3C3C"
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </Svg>
    )
}

/* ═══════════════════════════════════════
   STYLES
═══════════════════════════════════════ */
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    header: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 60 : 44,
        left: 24,
        right: 24,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 10,
    },
    chapterPill: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 100,
        backgroundColor: 'rgba(255, 255, 255, 0.18)',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255, 255, 255, 0.25)',
    },
    chapterText: {
        fontSize: 12,
        fontFamily: fonts.bold,
        color: '#FFFFFF',
        letterSpacing: 1.5,
    },
    chapterDim: {
        color: 'rgba(255, 255, 255, 0.55)',
        fontFamily: fonts.medium,
    },
    skipText: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.85)',
        fontFamily: fonts.medium,
        letterSpacing: -0.2,
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowRadius: 8,
    },

    slide: {
        width,
        height,
        backgroundColor: '#000',
    },
    imageWrap: {
        ...StyleSheet.absoluteFill,
    },
    image: {
        width: '100%',
        height: '100%',
    },

    textBlock: {
        position: 'absolute',
        left: 28,
        right: 28,
        bottom: 200,
    },
    kicker: {
        fontSize: 12,
        fontFamily: fonts.bold,
        letterSpacing: 3,
        marginBottom: 18,
    },
    title: {
        fontSize: 44,
        fontFamily: fonts.bold,
        color: '#FFFFFF',
        letterSpacing: -1.5,
        lineHeight: 48,
        marginBottom: 22,
        textShadowColor: 'rgba(0,0,0,0.4)',
        textShadowRadius: 12,
    },
    accentLine: {
        width: 36,
        height: 2,
        borderRadius: 1,
        marginBottom: 22,
    },
    body: {
        fontSize: 17,
        color: 'rgba(255, 255, 255, 0.88)',
        lineHeight: 26,
        letterSpacing: -0.2,
        fontFamily: fonts.body,
        textShadowColor: 'rgba(0,0,0,0.3)',
        textShadowRadius: 8,
    },

    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 180,
    },
    footerInner: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 24,
        // paddingBottom fourni au montage depuis insets.bottom
    },
    progressTrack: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 3,
        gap: 6,
        marginBottom: 22,
    },
    progressSeg: {
        /* Largeur fixe, indispensable depuis le passage de `flex` à `scaleX` :
           sans elle les segments n'auraient plus aucune dimension. Le segment
           actif est agrandi trois fois par l'animation. */
        width: 26,
        height: 3,
        borderRadius: 2,
    },
    cta: {
        height: 58,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 8 },
        elevation: 10,
    },
    ctaText: {
        fontSize: 16,
        fontFamily: fonts.bold,
        color: '#3C3C3C',
        letterSpacing: -0.3,
    },
})