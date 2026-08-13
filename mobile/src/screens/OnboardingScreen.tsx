import React, { useRef, useState } from 'react'
import {
    View, Text, StyleSheet, TouchableOpacity,
    Animated, Dimensions, Pressable, ImageBackground,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import ReAnimated, { FadeIn, FadeInUp } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { useLang } from '../contexts/LangContext'
import { screenColors as C, fonts, flag } from '../config/theme'

const { width, height } = Dimensions.get('window')
const IMAGE_H = height * 0.56

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
   Slides : storytelling clair (charte v2 : fond blanc, jamais de noir).
   Rendu fidèle à la maquette Sleek exportée (image en haut fondue vers le
   blanc, puce de progression, titre, corps, bouton vert plein).
═══════════════════════════════════════ */
const SLIDES: Slide[] = [
    {
        key: 'roots',
        kicker: 'Vos Racines',
        title: 'Retrouvez votre terre d\'origine',
        body: 'Vous êtes Afro-descendant et le Bénin vous appelle. Retour Gagnant vous accompagne pour reconnecter avec vos racines.',
        image: require('../../assets/onboarding/slide_1_roots.png'),
        accent: '#008751',
    },
    {
        key: 'process',
        kicker: 'Votre Dossier',
        title: 'Nationalité, passeport, simplifié',
        body: 'Démarches administratives, obtention de la nationalité béninoise, passeport : notre expertise VIP transforme le complexe en simple.',
        image: require('../../assets/onboarding/slide_2_process.png'),
        accent: '#FCD116',
    },
    {
        key: 'home',
        kicker: 'Votre Retour',
        title: 'Bienvenue chez vous, au Bénin',
        body: 'Au-delà des papiers, c\'est une nouvelle vie qui commence. Installation, communauté, héritage : votre retour gagnant.',
        image: require('../../assets/onboarding/slide_3_home.png'),
        accent: '#E8112D',
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
    const slide = SLIDES[current]

    return (
        <View style={styles.container}>
            {/* Liseré tricolore */}
            <View style={[styles.flag, { top: insets.top }]}>
                <View style={[styles.flagBand, { backgroundColor: flag[0] }]} />
                <View style={[styles.flagBand, { backgroundColor: flag[1] }]} />
                <View style={[styles.flagBand, { backgroundColor: flag[2] }]} />
            </View>

            {/* Bouton Passer */}
            {!isLast && (
                <Pressable hitSlop={12} onPress={onComplete} style={[styles.skipBtn, { top: insets.top + 24 }]} accessibilityRole="button">
                    <Text style={styles.skipText}>{t('Passer')}</Text>
                </Pressable>
            )}

            {/* Images (pager horizontal, Ken Burns léger) */}
            <View style={styles.imageArea}>
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
                        <SlideImage item={item} index={index} scrollX={scrollX} />
                    )}
                />
                {/* Fondu vers le blanc en bas de l'image */}
                <LinearGradient
                    colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.55)', '#FFFFFF']}
                    locations={[0, 0.6, 1]}
                    style={styles.fade}
                    pointerEvents="none"
                />
            </View>

            {/* Panneau de contenu (blanc) */}
            <View style={[styles.panel, { paddingBottom: insets.bottom + 24 }]}>
                <ReAnimated.View key={current} entering={FadeInUp.duration(420)} style={styles.panelInner}>
                    {/* Puce de progression */}
                    <View style={styles.dots}>
                        {SLIDES.map((_, i) => (
                            <View key={i} style={[styles.dot, i === current && styles.dotActive]} />
                        ))}
                    </View>

                    <Text style={[styles.kicker, { color: slide.accent === '#FCD116' ? C.accentInk : slide.accent }]}>
                        {t(slide.kicker).toUpperCase()}
                    </Text>
                    <Text style={styles.title}>{t(slide.title)}</Text>
                    <Text style={styles.body}>{t(slide.body)}</Text>
                </ReAnimated.View>

                <ReAnimated.View entering={FadeIn.duration(500)}>
                    <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={goNext}
                        style={styles.cta}
                        accessibilityRole="button"
                        hitSlop={6}
                    >
                        <Text style={styles.ctaText}>
                            {isLast ? t('Commencer l\'aventure') : t('Continuer')}
                        </Text>
                        <ArrowIcon />
                    </TouchableOpacity>
                </ReAnimated.View>
            </View>
        </View>
    )
}

/* ═══════════════════════════════════════
   Image d'un slide : Ken Burns + parallax doux
═══════════════════════════════════════ */
function SlideImage({ item, index, scrollX }: { item: Slide; index: number; scrollX: Animated.Value }) {
    const inputRange = [(index - 1) * width, index * width, (index + 1) * width]
    const scale = scrollX.interpolate({ inputRange, outputRange: [1.12, 1, 1.12], extrapolate: 'clamp' })
    const translateX = scrollX.interpolate({ inputRange, outputRange: [width * 0.2, 0, -width * 0.2], extrapolate: 'clamp' })

    return (
        <View style={styles.slide}>
            <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale }, { translateX }] }]}>
                <ImageBackground source={item.image} style={styles.image} resizeMode="cover" />
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
            <Path d="M5 12h14M13 6l6 6-6 6" stroke={C.primaryText} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
    )
}

/* ═══════════════════════════════════════
   STYLES (fond blanc, charte v2)
═══════════════════════════════════════ */
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },

    flag: { position: 'absolute', left: 0, right: 0, height: 6, flexDirection: 'row', zIndex: 20 },
    flagBand: { flex: 1 },

    skipBtn: { position: 'absolute', right: 20, zIndex: 20, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.7)' },
    skipText: { fontSize: 14, fontFamily: fonts.bold, color: C.textMuted, letterSpacing: -0.2 },

    imageArea: { height: IMAGE_H, width },
    slide: { width, height: IMAGE_H },
    image: { width: '100%', height: '100%' },
    fade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: IMAGE_H * 0.5 },

    panel: { flex: 1, paddingHorizontal: 28, justifyContent: 'space-between', paddingTop: 8 },
    panelInner: {},

    dots: { flexDirection: 'row', gap: 6, marginBottom: 22 },
    dot: { width: 8, height: 6, borderRadius: 3, backgroundColor: C.primarySoft },
    dotActive: { width: 26, backgroundColor: C.primary },

    kicker: { fontSize: 12, fontFamily: fonts.bold, letterSpacing: 3, marginBottom: 14 },
    title: { fontSize: 32, lineHeight: 38, fontFamily: fonts.extrabold, color: C.text, letterSpacing: -1, marginBottom: 16 },
    body: { fontSize: 16, lineHeight: 25, fontFamily: fonts.regular, color: C.textMuted, letterSpacing: -0.2 },

    cta: {
        height: 58, borderRadius: 16, backgroundColor: C.primary,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
        shadowColor: '#008751', shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8,
    },
    ctaText: { fontSize: 16, fontFamily: fonts.bold, color: C.primaryText, letterSpacing: -0.3 },
})
