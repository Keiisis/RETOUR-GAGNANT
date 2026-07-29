'use strict'
import React, { useEffect, useState, useCallback } from 'react'
import {
    View, Text, StyleSheet, TouchableOpacity, TouchableWithoutFeedback,
    Image, Dimensions, Platform, RefreshControl, ActivityIndicator,
    ScrollView, Pressable,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    useAnimatedScrollHandler,
    withSpring,
    withTiming,
    withDelay,
    withRepeat,
    withSequence,
    interpolate,
    Extrapolation,
    Easing,
    interpolateColor,
} from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import { Video, ResizeMode } from 'expo-av'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { FlagBar } from '../../components/ui'
import { useLang } from '../../contexts/LangContext'
import { useCart } from '../../contexts/CartContext'
import { fetchWithTimeout } from '../../lib/fetch'
import { RootStackParamList, BoutiqueProduct } from '../../navigation/AppNavigator'
import { screenColors, typography, spacing, radius, shadows } from '../../config/theme'

/* ═══════════════════════════════════════════════════════════
   BoutiqueScreen — THEME "CORPORATE PREMIUM 2026"
   (Aligné avec RegisterScreen / ServicesScreen / SignatureScreen)
═══════════════════════════════════════════════════════════ */

const { width, height } = Dimensions.get('window')

// Palette de l'agence (strictement identique aux autres écrans)
// Palette de l'ecran : plus de copie locale. Toutes les couleurs
// viennent du design system v2 (blanc + tricolore Benin).
const C = screenColors

const CARD_GAP = 14
const H_PADDING = 20
const CARD_W = (width - H_PADDING * 2 - CARD_GAP) / 2
const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.retourgagnantbenin.bj'

type Nav = NativeStackNavigationProp<RootStackParamList, 'Boutique'>

/* ═══════════════════════════════════════════════════════════
   COMPOSANT : STOREFRONT VIDEO (Vidéo animée premium)
   La vidéo est conservée et tourne normalement.
═══════════════════════════════════════════════════════════ */

const StorefrontVideo = () => {
    const scale = useSharedValue(0.96)
    const opacity = useSharedValue(0)

    // Reflet doré qui glisse lentement sur la vidéo (effet "verre teinté")
    const shineX = useSharedValue(-1)

    useEffect(() => {
        scale.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) })
        opacity.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.quad) })

        shineX.value = withTiming(1, { duration: 600 })
    }, [])

    const animStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ scale: scale.value }],
    }))

    const shineStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: interpolate(shineX.value, [-1, 1.2], [-200, width]) }],
    }))

    // Dimensions
    const STORE_WIDTH = width - H_PADDING * 2
    const STORE_HEIGHT = 200

    return (
        <Animated.View
            style={[
                videoStyles.container,
                { width: STORE_WIDTH, height: STORE_HEIGHT },
                animStyle,
            ]}
        >
            <Video
                source={require('../../../assets/images/boutique_video.mp4')}
                style={StyleSheet.absoluteFillObject}
                resizeMode={ResizeMode.COVER}
                shouldPlay
                isLooping
                isMuted={true}
            />

            {/* Overlay bleu agence très subtil pour cohérence chromatique */}
            <View style={videoStyles.tintOverlay} pointerEvents="none" />

            {/* Vignette sombre sur les bords (effet cinéma premium) */}
            <View style={videoStyles.vignette} pointerEvents="none" />

            {/* Reflet doré animé (style "lumière de luxe") */}
            <Animated.View style={[videoStyles.shine, shineStyle]} pointerEvents="none" />

            {/* Bordure intérieure dorée subtile */}
            <View style={videoStyles.innerBorder} pointerEvents="none" />

            {/* Badge corner "COLLECTION" */}
            <View style={videoStyles.cornerBadge} pointerEvents="none">
                <View style={videoStyles.cornerDot} />
                <Text style={videoStyles.cornerText}>COLLECTION 2026</Text>
            </View>
        </Animated.View>
    )
}

const videoStyles = StyleSheet.create({
    container: {
        alignSelf: 'center',
        position: 'relative',
        marginBottom: 24,
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: '#000',
        borderWidth: 1.2,
        borderColor: C.border,
        shadowColor: C.primary,
        shadowOpacity: 0.18,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
        elevation: 10,
    },
    tintOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(13, 43, 78, 0.15)', // Bleu agence
    },
    vignette: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 16,
        shadowColor: '#000',
        shadowOpacity: 0.6,
        shadowRadius: 40,
        shadowOffset: { width: 0, height: 0 },
    },
    shine: {
        position: 'absolute',
        top: -20,
        bottom: -20,
        width: 80,
        backgroundColor: 'rgba(212, 160, 23, 0.18)',
        transform: [{ skewX: '-20deg' }],
    },
    innerBorder: {
        position: 'absolute',
        top: 6,
        left: 6,
        right: 6,
        bottom: 6,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(212, 160, 23, 0.25)',
    },
    cornerBadge: {
        position: 'absolute',
        top: 14,
        left: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: 'rgba(13, 43, 78, 0.75)',
        borderWidth: 1,
        borderColor: 'rgba(212, 160, 23, 0.4)',
    },
    cornerDot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: C.accent,
    },
    cornerText: {
        color: C.primaryText,
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 1.2,
    },
})

/* ═══════════════════════════════════════════════════════════
   COMPOSANT : PRODUCT CARD (Verre translucide, premium)
═══════════════════════════════════════════════════════════ */

const ProductCard = ({
    item, index, navigation, inCart, addToCart, removeFromCart,
    hasDiscount, displayPrice, outOfStock, t,
}: any) => {
    const enterAnim = useSharedValue(0)
    const pressAnim = useSharedValue(0)
    const inCartAnim = useSharedValue(inCart ? 1 : 0)

    useEffect(() => {
        const delay = index * 80
        enterAnim.value = withDelay(
            delay,
            withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) })
        )
    }, [index])

    useEffect(() => {
        inCartAnim.value = withSpring(inCart ? 1 : 0, { damping: 15, stiffness: 180 })
    }, [inCart])

    const onPressIn = () => { pressAnim.value = withSpring(1, { damping: 15, stiffness: 200 }) }
    const onPressOut = () => { pressAnim.value = withSpring(0, { damping: 15, stiffness: 200 }) }

    const cardStyle = useAnimatedStyle(() => ({
        opacity: enterAnim.value,
        transform: [
            { translateY: 30 * (1 - enterAnim.value) },
            { scale: interpolate(pressAnim.value, [0, 1], [1, 0.97]) },
        ],
    }))

    const quickBtnStyle = useAnimatedStyle(() => ({
        backgroundColor: interpolateColor(
            inCartAnim.value,
            [0, 1],
            [C.primary, C.error]
        ),
        transform: [{ scale: interpolate(inCartAnim.value, [0, 1], [1, 1.05]) }],
    }))

    return (
        <Animated.View style={[{ width: CARD_W }, cardStyle]}>
            <TouchableWithoutFeedback
                onPressIn={onPressIn}
                onPressOut={onPressOut}
                onPress={() => navigation.navigate('ProductDetail', {
                    product: item,
                    onAddToCart: (qty: number) => addToCart(item, qty)
                })}
            >
                <View style={cardStyles.card}>
                    {/* Image / placeholder */}
                    <View style={cardStyles.imageContainer}>
                        {item.images && item.images.length > 0 ? (
                            <Image source={{ uri: item.images[0] }} style={cardStyles.image} resizeMode="cover" />
                        ) : (
                            <View style={cardStyles.placeholder}>
                                <Ionicons name="sparkles-outline" size={28} color={C.accent} />
                            </View>
                        )}

                        {/* Overlay subtil sur l'image */}
                        <View style={cardStyles.imageOverlay} />

                        {/* Badges */}
                        <View style={cardStyles.tagWrap}>
                            {item.is_featured && (
                                <View style={cardStyles.vipTag}>
                                    <Ionicons name="star" size={8} color={C.accent} />
                                    <Text style={cardStyles.vipTagText}>VIP</Text>
                                </View>
                            )}
                            {hasDiscount && (
                                <View style={cardStyles.discountTag}>
                                    <Text style={cardStyles.discountText}>
                                        −{Math.round(((item.price - item.sale_price!) / item.price) * 100)}%
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Rupture de stock */}
                        {outOfStock && (
                            <View style={cardStyles.outOfStockOverlay}>
                                <Text style={cardStyles.outOfStockText}>RUPTURE</Text>
                            </View>
                        )}

                        {/* Quick add button */}
                        {!outOfStock && (
                            <TouchableOpacity
                                style={cardStyles.quickBtnTouch}
                                activeOpacity={0.7}
                                onPress={(e) => {
                                    e.stopPropagation()
                                    inCart ? removeFromCart(item.id) : addToCart(item, 1)
                                }}
                                accessibilityLabel={inCart ? t('Retirer du panier') : t('Ajouter au panier')}
                                accessibilityRole="button"
                                hitSlop={6}
                            >
                                <Animated.View style={[cardStyles.quickBtn, quickBtnStyle]}>
                                    <Ionicons
                                        name={inCart ? 'remove' : 'add'}
                                        size={18}
                                        color={C.primaryText}
                                    />
                                </Animated.View>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Contenu */}
                    <View style={cardStyles.content}>
                        <Text style={cardStyles.category} numberOfLines={1}>
                            {t(item.category).toUpperCase()}
                        </Text>
                        <Text style={cardStyles.title} numberOfLines={2}>
                            {t(item.title)}
                        </Text>

                        {/* Prix */}
                        <View style={cardStyles.priceRow}>
                            <Text style={cardStyles.price}>
                                {displayPrice.toLocaleString('fr-FR')} F
                            </Text>
                            {hasDiscount && (
                                <Text style={cardStyles.priceOld}>
                                    {item.price.toLocaleString('fr-FR')}
                                </Text>
                            )}
                        </View>

                        {/* Indicateur "dans le panier" */}
                        {inCart && (
                            <View style={cardStyles.inCartBadge}>
                                <Ionicons name="checkmark-circle" size={11} color={C.success} />
                                <Text style={cardStyles.inCartText}>
                                    {inCart.quantity} {t('réservé(s)')}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>
            </TouchableWithoutFeedback>
        </Animated.View>
    )
}

const cardStyles = StyleSheet.create({
    card: {
        width: CARD_W,
        backgroundColor: C.surface,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1.2,
        borderColor: C.border,
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 2,
    },
    imageContainer: {
        width: '100%',
        aspectRatio: 0.85,
        position: 'relative',
        backgroundColor: '#F5F5F5',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    imageOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(13, 43, 78, 0.03)',
    },
    placeholder: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(212, 160, 23, 0.08)',
    },
    tagWrap: {
        position: 'absolute',
        top: 10,
        left: 10,
        gap: 5,
        alignItems: 'flex-start',
    },
    vipTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: C.primary,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(212, 160, 23, 0.5)',
    },
    vipTagText: {
        fontSize: 12,
        fontWeight: '800',
        color: C.accent,
        letterSpacing: 0.5,
    },
    discountTag: {
        backgroundColor: C.error,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    discountText: {
        fontSize: 12,
        fontWeight: '800',
        color: C.primaryText,
        letterSpacing: 0.3,
    },
    outOfStockOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.7)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    outOfStockText: {
        fontSize: 12,
        fontWeight: '800',
        color: C.error,
        letterSpacing: 2,
        backgroundColor: C.surfaceSolid,
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: C.error,
    },
    quickBtnTouch: {
        position: 'absolute',
        bottom: 10,
        right: 10,
    },
    quickBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: C.primary,
        shadowOpacity: 0.3,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
        elevation: 5,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.4)',
    },
    content: {
        padding: 14,
        gap: 5,
    },
    category: {
        fontSize: 12,
        fontWeight: '700',
        color: C.accentDark,
        letterSpacing: 1.4,
    },
    title: { ...typography.h1, color: C.text },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 6,
        marginTop: 4,
    },
    price: {
        fontSize: 15,
        fontWeight: '800',
        color: C.primary,
        letterSpacing: -0.3,
    },
    priceOld: {
        fontSize: 12,
        color: C.textMuted,
        textDecorationLine: 'line-through',
        fontWeight: '500',
    },
    inCartBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(10, 107, 59, 0.10)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        marginTop: 6,
        borderWidth: 1,
        borderColor: 'rgba(10, 107, 59, 0.2)',
    },
    inCartText: {
        fontSize: 12,
        fontWeight: '700',
        color: C.success,
        letterSpacing: 0.2,
    },
})

/* ═══════════════════════════════════════════════════════════
   ÉCRAN PRINCIPAL : BOUTIQUE
═══════════════════════════════════════════════════════════ */

export default function BoutiqueScreen({ navigation }: { navigation: Nav }) {
    const insets = useSafeAreaInsets()
    const [products, setProducts] = useState<BoutiqueProduct[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [showCart, setShowCart] = useState(false)
    const { t, lang, isTranslating, preloadTexts } = useLang()
    const { cart, addToCart, removeFromCart, cartCount, cartTotal } = useCart()

    /* ── Animations d'entrée (Stagger) ── */
    const headerAnim = useSharedValue(0)

    /* ── Cart FAB pulse ── */
    const pulseScale = useSharedValue(1)

    /* ── Scroll Y pour Nav Bar dynamique ── */
    const scrollY = useSharedValue(0)

    /* ── Bottom sheet animation ── */
    const sheetAnim = useSharedValue(0)

    useEffect(() => {
        headerAnim.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) })


        // Pulse léger sur le panier FAB
        pulseScale.value = withTiming(1, { duration: 600 })
    }, [])

    useEffect(() => {
        sheetAnim.value = withSpring(showCart ? 1 : 0, { damping: 20, stiffness: 180 })
    }, [showCart])

    const fetchProducts = useCallback(async () => {
        try {
            const res = await fetchWithTimeout(`${API_BASE}/api/products`, { timeoutMs: 10000 })
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            const data = await res.json()
            setProducts(data.products || [])
        } catch (e: any) {
            console.warn('[Boutique] Fetch failed:', e?.message)
            setProducts([])
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchProducts() }, [fetchProducts])
    const onRefresh = async () => { setRefreshing(true); await fetchProducts(); setRefreshing(false) }

    useEffect(() => {
        if (loading || lang === 'fr' || products.length === 0) return
        const texts = products.flatMap(p => [p.title, p.description].filter(Boolean))
        texts.push(
            'Joyaux & Créations',
            "L'essence de l'élégance béninoise.",
            'Ajouter', 'Panier', 'Payer', 'Rupture', 'En stock',
            'Sous-total', 'Sceller la Commande', 'Vos Merveilles',
            'Ouvrir le Panier', 'réservé(s)', 'COLLECTION 2026',
        )
        preloadTexts(texts)
    }, [loading, products, lang, preloadTexts])

    const getProductPrice = (p: BoutiqueProduct) =>
        (p.sale_price && p.sale_price < p.price) ? p.sale_price : p.price
    const formatPrice = (n: number) => n.toLocaleString('fr-FR') + ' FCFA'
    const cartItemForProduct = (id: string) => cart.find(c => c.product.id === id)

    // Scroll handler
    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (event) => {
            scrollY.value = event.contentOffset.y
        },
    })

    // Header animations
    const styleHeader = useAnimatedStyle(() => ({
        opacity: headerAnim.value,
        transform: [{ translateY: 30 * (1 - headerAnim.value) }],
    }))


    const pulseStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulseScale.value }],
    }))

    // Bottom sheet animation
    const sheetStyle = useAnimatedStyle(() => ({
        opacity: sheetAnim.value,
        transform: [{ translateY: interpolate(sheetAnim.value, [0, 1], [600, 0]) }],
    }))

    const overlayStyle = useAnimatedStyle(() => ({
        opacity: sheetAnim.value,
    }))

    // Header titre (apparaît au scroll)
    const stickyTitleStyle = useAnimatedStyle(() => ({
        opacity: interpolate(scrollY.value, [80, 180], [0, 1], Extrapolation.CLAMP),
        transform: [{ translateY: interpolate(scrollY.value, [80, 180], [10, 0], Extrapolation.CLAMP) }],
    }))

    /* ───────────────────────────────────────────────────────
       Header de liste (vidéo + titres)
    ─────────────────────────────────────────────────────── */
    const renderListHeader = () => (
        <Animated.View style={[styles.listHeader, styleHeader]}>
            {/* Vidéo en haut */}
            <StorefrontVideo />

            {/* Titre dual-line (style RegisterScreen) */}
            <View style={styles.titleWrap}>
                <Text style={styles.title}>{t('Boutique')}</Text>
                <Text style={styles.subtitle}>
                    {t("L'essence de l'élégance béninoise, sélectionnée avec exigence.")}
                </Text>

                {/* Compteur produits */}
                {!loading && products.length > 0 && (
                    <View style={styles.countBadge}>
                        <View style={styles.countDot} />
                        <Text style={styles.countText}>
                            {products.length} {t('pièces disponibles')}
                        </Text>
                    </View>
                )}
            </View>
        </Animated.View>
    )

    const renderProduct = ({ item, index }: { item: BoutiqueProduct, index: number }) => (
        <ProductCard
            item={item}
            index={index}
            navigation={navigation}
            inCart={cartItemForProduct(item.id)}
            addToCart={addToCart}
            removeFromCart={removeFromCart}
            hasDiscount={item.sale_price && item.sale_price < item.price}
            displayPrice={getProductPrice(item)}
            outOfStock={item.stock <= 0}
            t={t}
        />
    )

    return (
        <View style={styles.container}>

            {/* NAV BAR (fixe, style RegisterScreen avec ajout panier) */}
            <View style={[styles.topFlag, { marginTop: insets.top + 8 }]}>
                <FlagBar height={6} radiusTop={false} />
            </View>

            <View style={styles.navBar}>
                <Pressable onPress={() => navigation.goBack()} style={styles.navBtn}
                    accessibilityRole="button"
                    hitSlop={6}
                    accessibilityLabel={t('Retour')}>
                    <View style={styles.iconCircle}>
                        <Ionicons name="arrow-back" size={22} color={C.primary} />
                    </View>
                </Pressable>

                {/* Titre apparait au scroll */}
                <Animated.View style={[styles.navTitleWrap, stickyTitleStyle]}>
                    <Text style={styles.navTitle}>{t('La Boutique')}</Text>
                </Animated.View>

                <Pressable onPress={() => navigation.navigate('Orders')} style={styles.navBtn}
                    accessibilityRole="button"
                    accessibilityLabel={t('Mes commandes')}
                    hitSlop={6}>
                    <View style={styles.iconCircle}>
                        <Ionicons name="cube-outline" size={20} color={C.primary} />
                    </View>
                </Pressable>
            </View>

            {/* Bandeau traduction */}
            {isTranslating && lang !== 'fr' && (
                <View style={styles.translatingBanner}>
                    <ActivityIndicator color={C.primary} size="small" />
                    <Text style={styles.translatingText}>{t('Traduction en cours...')}</Text>
                </View>
            )}

            {loading ? (
                <View style={styles.loadingWrap}>
                    <ActivityIndicator color={C.primary} size="large" />
                    <Text style={styles.loadingText}>{t('Chargement de la collection...')}</Text>
                </View>
            ) : products.length === 0 ? (
                <ScrollView
                    contentContainerStyle={styles.emptyContainer}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />
                    }
                >
                    <Animated.View style={styleHeader}>
                        <StorefrontVideo />
                    </Animated.View>
                    <Text style={styles.title}>{t('Collection secrète')}</Text>
                    <Text style={[styles.subtitle, { textAlign: 'center', paddingHorizontal: 20 }]}>
                        {t('Les artisans sculptent les prochaines merveilles. Revenez bientôt.')}
                    </Text>
                </ScrollView>
            ) : (
                <Animated.FlatList
                    data={products}
                    keyExtractor={(item) => item.id}
                    renderItem={renderProduct}
                    numColumns={2}
                    contentContainerStyle={styles.gridContent}
                    columnWrapperStyle={styles.columnWrapper}
                    ListHeaderComponent={renderListHeader}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor={C.primary}
                            progressViewOffset={100}
                        />
                    }
                    onScroll={scrollHandler}
                    scrollEventThrottle={16}
                />
            )}

            {/* FAB PANIER (bleu massif, accent Or) */}
            {cartCount > 0 && (
                <Animated.View style={[styles.cartFabWrap, pulseStyle]}>
                    <TouchableOpacity
                        style={styles.cartFab}
                        activeOpacity={0.85}
                        onPress={() => setShowCart(true)}
                        accessibilityRole="button"
                        hitSlop={6}
                    >
                        <View style={styles.cartFabIconWrap}>
                            <Ionicons name="bag-handle" size={22} color={C.accent} />
                            <View style={styles.cartBadge}>
                                <Text style={styles.cartBadgeText}>{cartCount}</Text>
                            </View>
                        </View>
                        <View style={styles.cartFabTextWrap}>
                            <Text style={styles.cartFabLabel}>{t('Ouvrir le panier')}</Text>
                            <Text style={styles.cartFabTotal}>{formatPrice(cartTotal)}</Text>
                        </View>
                        <Ionicons name="arrow-forward" size={18} color={C.accent} />
                    </TouchableOpacity>
                </Animated.View>
            )}

            {/* BOTTOM SHEET PANIER */}
            {showCart && (
                <View style={styles.modalOverlay}>
                    <Animated.View style={[styles.modalBgAnim, overlayStyle]}>
                        <TouchableOpacity
                            style={styles.modalBg}
                            onPress={() => setShowCart(false)}
                            activeOpacity={1}
                            accessibilityRole="button"
                            hitSlop={6}
                        />
                    </Animated.View>

                    <Animated.View style={[styles.bottomSheet, sheetStyle]}>
                        <View style={styles.sheetHandle} />

                        <View style={styles.sheetHeader}>
                            <View>
                                <Text style={styles.sheetSubtitle}>{t('Votre panier')}</Text>
                                <Text style={styles.sheetTitle}>{t('Vos Merveilles')}</Text>
                            </View>
                            <Pressable onPress={() => setShowCart(false)} style={styles.closeBtn}
                                accessibilityRole="button"
                                hitSlop={6}
                                accessibilityLabel={t('Fermer')}>
                                <Ionicons name="close" size={20} color={C.primary} />
                            </Pressable>
                        </View>

                        <ScrollView style={{ maxHeight: height * 0.45 }} showsVerticalScrollIndicator={false}>
                            {cart.map((item, idx) => (
                                <View
                                    key={item.product.id}
                                    style={[
                                        styles.cartItem,
                                        idx === cart.length - 1 && { borderBottomWidth: 0 },
                                    ]}
                                >
                                    <View style={styles.cartImgWrap}>
                                        {item.product.images?.[0] ? (
                                            <Image source={{ uri: item.product.images[0] }} style={styles.cartImg} />
                                        ) : (
                                            <View style={[styles.cartImg, styles.cartImgPlaceholder]}>
                                                <Ionicons name="sparkles-outline" size={18} color={C.accent} />
                                            </View>
                                        )}
                                    </View>
                                    <View style={styles.cartInfo}>
                                        <Text style={styles.cartItemCategory}>
                                            {t(item.product.category).toUpperCase()}
                                        </Text>
                                        <Text style={styles.cartItemName} numberOfLines={2}>
                                            {t(item.product.title)}
                                        </Text>
                                        <Text style={styles.cartItemPrice}>
                                            {formatPrice(getProductPrice(item.product))}
                                        </Text>
                                    </View>
                                    <View style={styles.cartQtyControl}>
                                        <TouchableOpacity
                                            onPress={() => removeFromCart(item.product.id)}
                                            style={styles.qtyBtn}
                                            activeOpacity={0.7}
                                            accessibilityRole="button"
                                            hitSlop={6}
                                            accessibilityLabel={t('Retirer')}
                                        >
                                            <Ionicons name="remove" size={14} color={C.primary} />
                                        </TouchableOpacity>
                                        <Text style={styles.qtyValue}>{item.quantity}</Text>
                                        <TouchableOpacity
                                            onPress={() => addToCart(item.product, 1)}
                                            style={styles.qtyBtn}
                                            activeOpacity={0.7}
                                            accessibilityRole="button"
                                            hitSlop={6}
                                            accessibilityLabel={t('Ajouter')}
                                        >
                                            <Ionicons name="add" size={14} color={C.primary} />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}
                        </ScrollView>

                        <View style={styles.sheetFooter}>
                            <View style={styles.totalRow}>
                                <Text style={styles.totalLabel}>{t('Sous-total')}</Text>
                                <Text style={styles.totalValue}>{formatPrice(cartTotal)}</Text>
                            </View>

                            <TouchableOpacity
                                style={styles.checkoutBtn}
                                activeOpacity={0.85}
                                onPress={() => {
                                    setShowCart(false)
                                    navigation.navigate('Checkout', { cart, total: cartTotal })
                                }}
                                accessibilityRole="button"
                                hitSlop={6}
                            >
                                <Text style={styles.checkoutBtnText}>
                                    {t('Sceller la commande')}
                                </Text>
                                <Ionicons name="arrow-forward" size={18} color={C.accent} style={{ marginLeft: 8 }} />
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                </View>
            )}
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

    /* ── Nav Bar ── */
    topFlag: { marginHorizontal: 20, borderRadius: radius.pill, overflow: 'hidden' },
    navBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: spacing.lg, paddingBottom: spacing.md, gap: spacing.md },
    navBtn: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: C.surface,
        borderWidth: 1,
        borderColor: C.border,
        justifyContent: 'center',
        alignItems: 'center',
    },
    navTitleWrap: {
        flex: 1,
        alignItems: 'center',
    },
    navTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: C.primary,
        letterSpacing: 0.2,
    },

    /* ── Bandeau traduction ── */
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
        marginHorizontal: H_PADDING,
        marginTop: 8,
    },
    translatingText: {
        color: C.primary,
        fontSize: 12,
        fontWeight: '600',
    },

    /* ── Loading ── */
    loadingWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
    },
    loadingText: {
        color: C.textSec,
        fontSize: 13,
        fontWeight: '500',
    },

    /* ── Empty ── */
    emptyContainer: {
        paddingHorizontal: H_PADDING,
        paddingTop: 20,
        alignItems: 'center',
    },

    /* ── List Header ── */
    listHeader: {
        paddingTop: 12,
        paddingHorizontal: H_PADDING,
    },
    titleWrap: {
        marginTop: 8,
        marginBottom: 24,
        paddingHorizontal: 4,
    },
    title: {
        fontSize: 38,
        fontWeight: '700',
        color: C.primary,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 15,
        color: C.textSec,
        marginTop: 14,
        lineHeight: 22,
        fontWeight: '400',
    },
    countBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(212, 160, 23, 0.10)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(212, 160, 23, 0.25)',
        marginTop: 16,
    },
    countDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: C.success,
    },
    countText: {
        fontSize: 12,
        fontWeight: '700',
        color: C.accentDark,
        letterSpacing: 0.3,
    },

    /* ── Grid ── */
    gridContent: {
        paddingBottom: 140,
    },
    columnWrapper: {
        paddingHorizontal: H_PADDING,
        justifyContent: 'space-between',
        marginBottom: CARD_GAP,
    },

    /* ── Cart FAB ── */
    cartFabWrap: {
        position: 'absolute',
        bottom: Platform.OS === 'ios' ? 30 : 20,
        left: H_PADDING,
        right: H_PADDING,
    },
    cartFab: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.primary,
        height: 62,
        borderRadius: 16,
        paddingHorizontal: 18,
        gap: 14,
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 18,
        elevation: 12,
    },
    cartFabIconWrap: {
        position: 'relative',
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(212, 160, 23, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(212, 160, 23, 0.4)',
    },
    cartBadge: {
        position: 'absolute',
        top: -6,
        right: -6,
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: C.accent,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: C.primary,
        paddingHorizontal: 4,
    },
    cartBadgeText: {
        fontSize: 12,
        fontWeight: '800',
        color: C.primary,
    },
    cartFabTextWrap: {
        flex: 1,
    },
    cartFabLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.7)',
        letterSpacing: 0.3,
    },
    cartFabTotal: {
        fontSize: 15,
        fontWeight: '800',
        color: C.primaryText,
        letterSpacing: 0.2,
    },

    /* ── Bottom Sheet ── */
    modalOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'flex-end',
        zIndex: 100,
    },
    modalBgAnim: {
        ...StyleSheet.absoluteFillObject,
    },
    modalBg: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(13, 43, 78, 0.55)',
    },
    bottomSheet: {
        backgroundColor: C.bg,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingHorizontal: 24,
        paddingTop: 12,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
        shadowColor: C.primary,
        shadowOpacity: 0.3,
        shadowRadius: 30,
        shadowOffset: { width: 0, height: -15 },
        elevation: 20,
        borderTopWidth: 1,
        borderColor: C.border,
    },
    sheetHandle: {
        width: 44,
        height: 4,
        backgroundColor: C.border,
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 18,
    },
    sheetHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 18,
    },
    sheetSubtitle: {
        fontSize: 12,
        fontWeight: '600',
        color: C.accentDark,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    sheetTitle: {
        fontSize: 26,
        fontWeight: '800',
        color: C.primary,
        letterSpacing: -0.5,
    },
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: C.surface,
        borderWidth: 1,
        borderColor: C.border,
        alignItems: 'center',
        justifyContent: 'center',
    },

    /* ── Cart Item ── */
    cartItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: C.border,
    },
    cartImgWrap: {
        shadowColor: C.primary,
        shadowOpacity: 0.08,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
    },
    cartImg: {
        width: 64,
        height: 80,
        borderRadius: 10,
        backgroundColor: C.surface,
    },
    cartImgPlaceholder: {
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: C.border,
    },
    cartInfo: {
        flex: 1,
        marginLeft: 14,
    },
    cartItemCategory: {
        fontSize: 12,
        fontWeight: '700',
        color: C.accentDark,
        letterSpacing: 1.2,
        marginBottom: 4,
    },
    cartItemName: {
        fontSize: 14,
        fontWeight: '700',
        color: C.primary,
        marginBottom: 5,
        letterSpacing: -0.2,
        lineHeight: 18,
    },
    cartItemPrice: {
        fontSize: 13,
        fontWeight: '700',
        color: C.primary,
    },
    cartQtyControl: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.surface,
        borderRadius: 12,
        paddingHorizontal: 4,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: C.border,
    },
    qtyBtn: {
        width: 26,
        height: 26,
        borderRadius: 13,
        alignItems: 'center',
        justifyContent: 'center',
    },
    qtyValue: {
        fontSize: 13,
        fontWeight: '700',
        color: C.primary,
        minWidth: 18,
        textAlign: 'center',
    },

    /* ── Sheet Footer ── */
    sheetFooter: {
        marginTop: 18,
        paddingTop: 18,
        borderTopWidth: 1,
        borderTopColor: C.border,
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: 16,
    },
    totalLabel: {
        fontSize: 14,
        color: C.textSec,
        fontWeight: '500',
    },
    totalValue: {
        fontSize: 26,
        fontWeight: '800',
        color: C.primary,
        letterSpacing: -0.5,
    },
    checkoutBtn: {
        flexDirection: 'row',
        height: 60,
        backgroundColor: C.primary,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 8,
    },
    checkoutBtnText: {
        color: C.primaryText,
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
})