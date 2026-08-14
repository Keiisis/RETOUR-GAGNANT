'use strict';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { confirm, toast } from '../../lib/feedback'
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    Image,
    Dimensions,
    Platform,
    Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withRepeat,
    withSequence,
    withDelay,
    Easing,
    interpolate,
    useAnimatedScrollHandler,
    Extrapolation,
} from 'react-native-reanimated';
import {
    ArrowLeft,
    Minus,
    Plus,
    ShoppingCart,
    Star,
    Tag,
    ChevronRight,
    ShieldCheck,
    Truck,
    Sparkles,
    Heart,
    Share2,
    Check,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { useLang } from '../../contexts/LangContext';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { screenColors } from '../../config/theme'

const { width } = Dimensions.get('window');
const HERO_HEIGHT = width * 1.05;

/* ─────────────────────────────────────────
   Corporate Premium 2026 : Palette locale
   (aligné avec PaymentsScreen / RegisterScreen)
   ───────────────────────────────────────── */
// Palette de l'ecran : plus de copie locale. Toutes les couleurs
// viennent du design system v2 (blanc + tricolore Benin).
const C = screenColors

const AnimatedScroll = Animated.createAnimatedComponent(ScrollView);

type Nav = NativeStackNavigationProp<RootStackParamList, 'ProductDetail'>;
type Route = RouteProp<RootStackParamList, 'ProductDetail'>;

interface Props {
    navigation: Nav;
    route: Route;
}

/* ─────────────────────────────────────────
   Bouton interactif (press scale)
   ───────────────────────────────────────── */
function InteractiveButton({
    children,
    onPress,
    disabled,
    style,
}: {
    children: React.ReactNode;
    onPress?: () => void;
    disabled?: boolean;
    style?: any;
}) {
    const s = useSharedValue(1);
    const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));

    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            onPressIn={() => (s.value = withTiming(0.96, { duration: 120 }))}
            onPressOut={() => (s.value = withTiming(1, { duration: 160 }))}
            accessibilityRole="button"
            hitSlop={6}
        >
            <Animated.View style={[aStyle, style]}>{children}</Animated.View>
        </Pressable>
    );
}

/* ─────────────────────────────────────────
   Section animée (fade + translateY)
   ───────────────────────────────────────── */
function AnimatedSection({
    children,
    delay = 0,
    style,
}: {
    children: React.ReactNode;
    delay?: number;
    style?: any;
}) {
    const p = useSharedValue(0);
    useEffect(() => {
        p.value = withDelay(delay, withTiming(1, { duration: 620, easing: Easing.out(Easing.cubic) }));
    }, [delay, p]);

    const aStyle = useAnimatedStyle(() => ({
        opacity: p.value,
        transform: [{ translateY: interpolate(p.value, [0, 1], [22, 0]) }],
    }));

    return <Animated.View style={[aStyle, style]}>{children}</Animated.View>;
}

export default function ProductDetailScreen({ navigation, route }: Props) {
    const insets = useSafeAreaInsets();
    const { product, onAddToCart } = route.params;
    const { t } = useLang();
    const [quantity, setQuantity] = useState(1);
    const [activeImage, setActiveImage] = useState(0);
    const [favorite, setFavorite] = useState(false);
    const carouselRef = useRef<ScrollView>(null);

    const hasDiscount = product.sale_price && product.sale_price < product.price;
    const displayPrice = hasDiscount ? product.sale_price! : product.price;
    const outOfStock = product.stock <= 0;
    const formatPrice = (n: number) => n.toLocaleString('fr-FR') + ' FCFA';

    /* Scroll parallax */
    const scrollY = useSharedValue(0);
    const onScroll = useAnimatedScrollHandler({
        onScroll: (e) => {
            scrollY.value = e.contentOffset.y;
        },
    });

    const heroStyle = useAnimatedStyle(() => ({
        transform: [
            {
                translateY: interpolate(scrollY.value, [-200, 0, HERO_HEIGHT], [-100, 0, HERO_HEIGHT * 0.4], Extrapolation.CLAMP),
            },
            {
                scale: interpolate(scrollY.value, [-200, 0], [1.25, 1], Extrapolation.CLAMP),
            },
        ],
    }));

    const headerStyle = useAnimatedStyle(() => ({
        opacity: interpolate(scrollY.value, [HERO_HEIGHT * 0.55, HERO_HEIGHT * 0.85], [0, 1], Extrapolation.CLAMP),
    }));

    /* Shine animé sur le prix */
    const shine = useSharedValue(0);
    useEffect(() => {
        shine.value = withTiming(1, { duration: 600 });
    }, [shine]);
    const shineStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: interpolate(shine.value, [0, 1], [-160, 220]) }],
        opacity: interpolate(shine.value, [0, 0.5, 1], [0, 0.55, 0]),
    }));

    /* Heart pulse */
    const heartScale = useSharedValue(1);
    const toggleFav = useCallback(() => {
        setFavorite((f) => !f);
        heartScale.value = withSequence(
            withTiming(1.3, { duration: 140, easing: Easing.out(Easing.quad) }),
            withTiming(1, { duration: 180, easing: Easing.inOut(Easing.quad) }),
        );
    }, [heartScale]);
    const heartStyle = useAnimatedStyle(() => ({ transform: [{ scale: heartScale.value }] }));

    const handleAddToCart = () => {
        if (outOfStock) return;
        if (quantity > product.stock) {
            toast(t('Stock insuffisant'), t('Quantité demandée supérieure au stock disponible.'));
            return;
        }
        onAddToCart(quantity);
        confirm({
            title: t('Ajouté au panier'),
            message: t('{qty} × {title} ajouté à votre panier.', { qty: quantity, title: product.title }),
            confirmLabel: t('Voir le panier'),
            cancelLabel: t('Continuer mes achats'),
            onConfirm: () => navigation.goBack(),
            onCancel: () => navigation.goBack(),
        });
    };

    const onImageScroll = (event: { nativeEvent: { contentOffset: { x: number } } }) => {
        const idx = Math.round(event.nativeEvent.contentOffset.x / width);
        setActiveImage(idx);
    };

    const images = product.images && product.images.length > 0 ? product.images : [];
    const discountPct = hasDiscount
        ? Math.round(((product.price - product.sale_price!) / product.price) * 100)
        : 0;

    return (
        <View style={styles.container}>

            {/* Header flottant (apparait au scroll) */}
            <Animated.View style={[styles.floatingHeader, headerStyle]} pointerEvents="box-none">
                <LinearGradient
                    colors={[C.bg, 'rgba(245,241,234,0.92)']}
                    style={StyleSheet.absoluteFill}
                />
                <View style={[styles.floatingHeaderInner, { paddingTop: insets.top + 8 }]}>
                    <Text numberOfLines={1} style={styles.floatingTitle}>
                        {t(product.title)}
                    </Text>
                    <Text style={styles.floatingPrice}>{formatPrice(displayPrice)}</Text>
                </View>
            </Animated.View>

            <AnimatedScroll
                onScroll={onScroll}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 140 + insets.bottom }}
            >
                {/* ── HERO CAROUSEL ── */}
                <View style={styles.carouselWrap}>
                    <Animated.View style={[StyleSheet.absoluteFill, heroStyle]}>
                        {images.length > 0 ? (
                            <ScrollView
                                ref={carouselRef}
                                horizontal
                                pagingEnabled
                                showsHorizontalScrollIndicator={false}
                                onScroll={onImageScroll}
                                scrollEventThrottle={16}
                            >
                                {images.map((uri, i) => (
                                    <View key={i} style={{ width, height: HERO_HEIGHT }}>
                                        <Image source={{ uri }} style={styles.heroImage} resizeMode="cover" />
                                        <LinearGradient
                                            colors={['rgba(8,27,51,0.35)', 'transparent', 'rgba(245,241,234,0.95)']}
                                            locations={[0, 0.45, 1]}
                                            style={StyleSheet.absoluteFill}
                                        />
                                    </View>
                                ))}
                            </ScrollView>
                        ) : (
                            <View style={[styles.heroImage, styles.heroImagePlaceholder]}>
                                <LinearGradient
                                    colors={[C.primarySoft, C.primaryDeep]}
                                    style={StyleSheet.absoluteFill}
                                />
                                <ShoppingCart size={64} color={C.primaryText} strokeWidth={1.25} />
                            </View>
                        )}
                    </Animated.View>

                    {/* Top action bar */}
                    <View style={[styles.topBar, { top: insets.top + 8 }]}>
                        <InteractiveButton onPress={() => navigation.goBack()} style={styles.iconBtn}>
                            <ArrowLeft size={20} color={C.surface} strokeWidth={2} />
                        </InteractiveButton>

                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <InteractiveButton style={styles.iconBtn}>
                                <Share2 size={18} color={C.surface} strokeWidth={2} />
                            </InteractiveButton>
                            <InteractiveButton onPress={toggleFav} style={styles.iconBtn}>
                                <Animated.View style={heartStyle}>
                                    <Heart
                                        size={18}
                                        color={favorite ? C.gold : C.surface}
                                        fill={favorite ? C.gold : 'transparent'}
                                        strokeWidth={2}
                                    />
                                </Animated.View>
                            </InteractiveButton>
                        </View>
                    </View>

                    {/* Badges flottants */}
                    <View style={styles.badgesRow}>
                        {product.is_featured && (
                            <LinearGradient
                                colors={[C.gold, C.goldDeep]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.featuredBadge}
                            >
                                <Sparkles size={11} color={C.primaryDeep} strokeWidth={2.2} />
                                <Text style={styles.featuredText}>{t('Coup de cœur')}</Text>
                            </LinearGradient>
                        )}
                        {hasDiscount && (
                            <View style={styles.discountBadge}>
                                <Text style={styles.discountText}>-{discountPct}%</Text>
                            </View>
                        )}
                    </View>

                    {/* Indicateurs */}
                    {images.length > 1 && (
                        <View style={styles.dots}>
                            {images.map((_, i) => (
                                <View key={i} style={[styles.dot, i === activeImage && styles.dotActive]} />
                            ))}
                        </View>
                    )}
                </View>

                {/* ── INFO CARD ── */}
                <AnimatedSection delay={120} style={styles.infoCard}>
                    <View style={styles.infoCardInner}>
                        {product.category ? (
                            <View style={styles.categoryChip}>
                                <View style={styles.categoryDot} />
                                <Text style={styles.category}>{t(product.category)}</Text>
                            </View>
                        ) : null}

                        <Text style={styles.title}>{t(product.title)}</Text>

                        {/* Rating placeholder esthétique */}
                        <View style={styles.ratingRow}>
                            <View style={styles.starsRow}>
                                {[0, 1, 2, 3, 4].map((i) => (
                                    <Star key={i} size={13} color={C.primary} fill={i < 4 ? C.gold : 'transparent'} strokeWidth={1.5} />
                                ))}
                            </View>
                            <Text style={styles.ratingText}>4.8 · 124 {t('avis')}</Text>
                        </View>

                        {/* Prix avec shine animé */}
                        <View style={styles.priceBlock}>
                            <View style={styles.priceRow}>
                                <Text style={styles.priceMain}>{formatPrice(displayPrice)}</Text>
                                {hasDiscount && <Text style={styles.priceOld}>{formatPrice(product.price)}</Text>}
                            </View>
                            <View style={styles.priceShineWrap} pointerEvents="none">
                                <Animated.View style={[styles.priceShine, shineStyle]}>
                                    <LinearGradient
                                        colors={['transparent', 'rgba(0, 135, 81,0.5)', 'transparent']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={StyleSheet.absoluteFill}
                                    />
                                </Animated.View>
                            </View>
                        </View>

                        {/* Stock */}
                        <View style={[styles.stockBadge, outOfStock && styles.stockBadgeOut]}>
                            <View style={[styles.stockDot, outOfStock && styles.stockDotOut]} />
                            <Text style={[styles.stockText, outOfStock && styles.stockTextOut]}>
                                {outOfStock
                                    ? t('Rupture de stock')
                                    : t('{stock} en stock', { stock: product.stock })}
                            </Text>
                        </View>
                    </View>
                </AnimatedSection>

                {/* ── TRUST ROW ── */}
                <AnimatedSection delay={220} style={styles.trustRow}>
                    <View style={styles.trustItem}>
                        <View style={[styles.trustIcon, { backgroundColor: 'rgba(10,107,59,0.10)' }]}>
                            <Truck size={16} color={C.green} strokeWidth={1.8} />
                        </View>
                        <Text style={styles.trustLabel}>{t('Livraison')}</Text>
                        <Text style={styles.trustValue}>{t('24-48h')}</Text>
                    </View>
                    <View style={styles.trustItem}>
                        <View style={[styles.trustIcon, { backgroundColor: 'rgba(0, 135, 81,0.14)' }]}>
                            <ShieldCheck size={16} color={C.goldDeep} strokeWidth={1.8} />
                        </View>
                        <Text style={styles.trustLabel}>{t('Garantie')}</Text>
                        <Text style={styles.trustValue}>{t('Authentique')}</Text>
                    </View>
                    <View style={styles.trustItem}>
                        <View style={[styles.trustIcon, { backgroundColor: 'rgba(0,135,81,0.10)' }]}>
                            <Check size={16} color={C.primary} strokeWidth={2} />
                        </View>
                        <Text style={styles.trustLabel}>{t('Retours')}</Text>
                        <Text style={styles.trustValue}>{t('Sous 7j')}</Text>
                    </View>
                </AnimatedSection>

                {/* ── DESCRIPTION COURTE ── */}
                {product.description ? (
                    <AnimatedSection delay={300}>
                        <Text style={styles.description}>{t(product.description)}</Text>
                    </AnimatedSection>
                ) : null}

                {/* ── DESCRIPTION LONGUE ── */}
                {product.long_description ? (
                    <AnimatedSection delay={380} style={styles.longDescBox}>
                        <View style={styles.sectionHeader}>
                            <View style={styles.sectionIconWrap}>
                                <Tag size={14} color={C.primary} strokeWidth={1.8} />
                            </View>
                            <Text style={styles.sectionTitle}>{t('Description détaillée')}</Text>
                        </View>
                        <Text style={styles.longDesc}>{t(product.long_description)}</Text>
                    </AnimatedSection>
                ) : null}

                {/* ── QUANTITÉ ── */}
                {!outOfStock && (
                    <AnimatedSection delay={460} style={styles.qtyBlock}>
                        <View style={styles.qtyHeader}>
                            <Text style={styles.qtyLabel}>{t('Quantité')}</Text>
                            <Text style={styles.qtyHint}>
                                {t('Max')} {product.stock}
                            </Text>
                        </View>

                        <View style={styles.qtyRow}>
                            <View style={styles.qtyControls}>
                                <InteractiveButton
                                    onPress={() => setQuantity((q) => Math.max(1, q - 1))}
                                    disabled={quantity <= 1}
                                    style={[styles.qtyBtn, quantity <= 1 && styles.qtyBtnDisabled]}
                                >
                                    <Minus
                                        size={16}
                                        color={quantity <= 1 ? C.textMuted : C.primary}
                                        strokeWidth={2.4}
                                    />
                                </InteractiveButton>

                                <View style={styles.qtyValueWrap}>
                                    <Text style={styles.qtyValue}>{quantity}</Text>
                                </View>

                                <InteractiveButton
                                    onPress={() => setQuantity((q) => Math.min(product.stock, q + 1))}
                                    disabled={quantity >= product.stock}
                                    style={[styles.qtyBtn, quantity >= product.stock && styles.qtyBtnDisabled]}
                                >
                                    <Plus
                                        size={16}
                                        color={quantity >= product.stock ? C.textMuted : C.primary}
                                        strokeWidth={2.4}
                                    />
                                </InteractiveButton>
                            </View>

                            <View style={styles.totalBox}>
                                <Text style={styles.totalLabel}>{t('Total')}</Text>
                                <Text style={styles.totalValue}>{formatPrice(displayPrice * quantity)}</Text>
                            </View>
                        </View>
                    </AnimatedSection>
                )}
            </AnimatedScroll>

            {/* ── CTA FIXE BAS ──
                La marge basse vient de `insets`, jamais d'une constante : sous
                Android 15+ l'application dessine SOUS la barre de navigation
                système. Une valeur codée en dur (18 dp) passait dessous sur les
                appareils à trois boutons, qui en occupent près de 48 : le
                bouton devenait inatteignable. */}
            <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 14 }]}>
                <LinearGradient
                    colors={['rgba(245,241,234,0)', C.bg]}
                    style={styles.bottomFade}
                    pointerEvents="none"
                />
                <InteractiveButton
                    onPress={handleAddToCart}
                    disabled={outOfStock}
                    style={[styles.addBtn, outOfStock && styles.addBtnDisabled]}
                >
                    <LinearGradient
                        colors={outOfStock ? [C.textMuted, C.textMuted] : [C.primary, C.primaryDeep]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFill}
                    />
                    {outOfStock ? (
                        <Text style={styles.addBtnText}>{t('Indisponible')}</Text>
                    ) : (
                        <>
                            <View style={styles.addBtnIcon}>
                                <ShoppingCart size={18} color={C.primary} strokeWidth={2} />
                            </View>
                            <Text style={styles.addBtnText}>{t('Ajouter au panier')}</Text>
                            <ChevronRight size={18} color={C.primary} strokeWidth={2.2} />
                        </>
                    )}
                </InteractiveButton>
            </View>
        </View>
    );
}

/* ─────────────────────────────────────────
   STYLES
   ───────────────────────────────────────── */
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },

    /* Header flottant */
    floatingHeader: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: Platform.OS === 'ios' ? 96 : 76,
        zIndex: 20,
        borderBottomWidth: 1,
        borderBottomColor: C.border,
    },
    floatingHeaderInner: {
        flex: 1,
        paddingHorizontal: 72,
        justifyContent: 'center',
        alignItems: 'center',
    },
    floatingTitle: {
        fontSize: 14,
        fontFamily: 'Outfit_600SemiBold',
        color: C.primary,
        letterSpacing: 0.2,
    },
    floatingPrice: {
        fontSize: 12,
        fontFamily: 'Outfit_700Bold',
        color: C.primaryDeep,
        marginTop: 2,
    },

    /* Carousel */
    carouselWrap: {
        position: 'relative',
        width,
        height: HERO_HEIGHT,
        backgroundColor: C.primaryDeep,
        overflow: 'hidden',
    },
    heroImage: { width, height: HERO_HEIGHT, backgroundColor: C.primaryDeep },
    heroImagePlaceholder: { alignItems: 'center', justifyContent: 'center' },

    topBar: {
        position: 'absolute',
        left: 16,
        right: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 5,
    },
    iconBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(8,27,51,0.55)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.18)',
    },

    badgesRow: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 110 : 90,
        left: 18,
        flexDirection: 'row',
        gap: 8,
        zIndex: 5,
    },
    featuredBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 11,
        paddingVertical: 6,
        borderRadius: 999,
        shadowColor: C.gold,
        shadowOpacity: 0.45,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
    },
    featuredText: {
        fontSize: 12,
        color: C.primaryDeep,
        fontFamily: 'Outfit_700Bold',
        letterSpacing: 0.6,
        textTransform: 'uppercase',
    },
    discountBadge: {
        backgroundColor: C.danger,
        paddingHorizontal: 11,
        paddingVertical: 6,
        borderRadius: 999,
        shadowColor: C.danger,
        shadowOpacity: 0.35,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 4,
    },
    discountText: {
        color: C.surface,
        fontSize: 12,
        fontFamily: 'Outfit_700Bold',
        letterSpacing: 0.4,
    },

    dots: {
        position: 'absolute',
        bottom: 28,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 6,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: 'rgba(255,255,255,0.45)',
    },
    dotActive: { backgroundColor: C.gold, width: 24 },

    /* Info card */
    infoCard: {
        marginTop: -32,
        paddingHorizontal: 18,
    },
    infoCardInner: {
        backgroundColor: C.surface,
        borderRadius: 28,
        padding: 22,
        borderWidth: 1,
        borderColor: C.border,
        shadowColor: '#3C3C3C',
        shadowOpacity: 0.10,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 12 },
        elevation: 8,
    },

    categoryChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        backgroundColor: 'rgba(0, 135, 81,0.10)',
        marginBottom: 10,
    },
    categoryDot: {
        width: 5,
        height: 5,
        borderRadius: 3,
        backgroundColor: C.gold,
    },
    category: {
        fontSize: 12,
        color: C.primaryDeep,
        fontFamily: 'Outfit_700Bold',
        letterSpacing: 1.4,
        textTransform: 'uppercase',
    },

    title: {
        fontSize: 24,
        lineHeight: 30,
        fontFamily: 'Outfit_700Bold',
        color: C.text,
        marginBottom: 10,
        letterSpacing: -0.3,
    },

    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 16,
    },
    starsRow: { flexDirection: 'row', gap: 2 },
    ratingText: {
        fontSize: 12,
        color: C.textMuted,
        fontFamily: 'Outfit_500Medium',
    },

    priceBlock: {
        position: 'relative',
        overflow: 'hidden',
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 16,
        backgroundColor: C.surfaceSoft,
        borderWidth: 1,
        borderColor: C.border,
        marginBottom: 14,
    },
    priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
    priceMain: {
        fontSize: 28,
        fontFamily: 'Outfit_700Bold',
        color: C.primary,
        letterSpacing: -0.5,
    },
    priceOld: {
        fontSize: 14,
        color: C.textMuted,
        textDecorationLine: 'line-through',
        fontFamily: 'Outfit_500Medium',
    },
    priceShineWrap: {
        ...StyleSheet.absoluteFill,
        overflow: 'hidden',
        borderRadius: 16,
    },
    priceShine: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: 110,
    },

    stockBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 6,
        backgroundColor: C.successBg,
        borderRadius: 999,
    },
    stockBadgeOut: { backgroundColor: C.dangerSoft },
    stockDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green },
    stockDotOut: { backgroundColor: C.danger },
    stockText: {
        fontSize: 12,
        color: C.green,
        fontFamily: 'Outfit_700Bold',
        letterSpacing: 0.4,
    },
    stockTextOut: { color: C.danger },

    /* Trust row */
    trustRow: {
        flexDirection: 'row',
        gap: 10,
        paddingHorizontal: 18,
        marginTop: 16,
    },
    trustItem: {
        flex: 1,
        backgroundColor: C.surface,
        borderRadius: 18,
        paddingVertical: 14,
        paddingHorizontal: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: C.border,
    },
    trustIcon: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    trustLabel: {
        fontSize: 12,
        color: C.textMuted,
        fontFamily: 'Outfit_500Medium',
        letterSpacing: 0.4,
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    trustValue: {
        fontSize: 12,
        color: C.text,
        fontFamily: 'Outfit_700Bold',
    },

    description: {
        fontSize: 14,
        lineHeight: 22,
        color: C.textSoft,
        fontFamily: 'Outfit_400Regular',
        paddingHorizontal: 22,
        marginTop: 20,
    },

    longDescBox: {
        marginHorizontal: 18,
        marginTop: 18,
        backgroundColor: C.surface,
        padding: 18,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: C.border,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 12,
    },
    sectionIconWrap: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(0, 135, 81,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sectionTitle: {
        fontSize: 13,
        color: C.primary,
        fontFamily: 'Outfit_700Bold',
        letterSpacing: 0.3,
        textTransform: 'uppercase',
    },
    longDesc: {
        fontSize: 13,
        lineHeight: 22,
        color: C.textSoft,
        fontFamily: 'Outfit_400Regular',
    },

    /* Quantité */
    qtyBlock: {
        marginHorizontal: 18,
        marginTop: 18,
        backgroundColor: C.surface,
        padding: 18,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: C.border,
    },
    qtyHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    qtyLabel: {
        fontSize: 12,
        color: C.primary,
        fontFamily: 'Outfit_700Bold',
        letterSpacing: 1.2,
        textTransform: 'uppercase',
    },
    qtyHint: {
        fontSize: 12,
        color: C.textMuted,
        fontFamily: 'Outfit_500Medium',
    },
    qtyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 14,
    },
    qtyControls: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.surfaceSoft,
        borderRadius: 999,
        padding: 4,
        borderWidth: 1,
        borderColor: C.border,
    },
    qtyBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: C.surface,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: C.borderStrong,
    },
    qtyBtnDisabled: {
        borderColor: C.border,
        backgroundColor: C.surfaceSoft,
    },
    qtyValueWrap: {
        minWidth: 44,
        alignItems: 'center',
    },
    qtyValue: {
        fontSize: 18,
        fontFamily: 'Outfit_700Bold',
        color: C.text,
    },
    totalBox: {
        alignItems: 'flex-end',
    },
    totalLabel: {
        fontSize: 12,
        color: C.textMuted,
        fontFamily: 'Outfit_500Medium',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    totalValue: {
        fontSize: 18,
        fontFamily: 'Outfit_700Bold',
        color: C.primaryDeep,
        letterSpacing: -0.3,
    },

    /* Bottom CTA */
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 18,
        paddingTop: 14,
        // paddingBottom fourni au montage depuis insets.bottom : voir l'usage.
    },
    bottomFade: {
        position: 'absolute',
        top: -28,
        left: 0,
        right: 0,
        height: 40,
    },
    addBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        paddingVertical: 16,
        borderRadius: 18,
        overflow: 'hidden',
        shadowColor: '#3C3C3C',
        shadowOpacity: 0.35,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
        elevation: 10,
    },
    addBtnDisabled: { opacity: 0.55 },
    addBtnIcon: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: 'rgba(0, 135, 81,0.18)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: C.border,
    },
    addBtnText: {
        color: C.surface,
        fontSize: 15,
        fontFamily: 'Outfit_700Bold',
        letterSpacing: 0.3,
    },
});
