'use strict'
import React, { useState, useEffect, useCallback } from 'react'
import { toast } from '../../lib/feedback'
import {
    View, Text, ScrollView, StyleSheet, TouchableOpacity,
    TextInput, Platform, ActivityIndicator,
    KeyboardAvoidingView, Pressable, Dimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withDelay,
    withRepeat,
    withSequence,
    withSpring,
    Easing,
    interpolate,
    interpolateColor,
} from 'react-native-reanimated'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RouteProp } from '@react-navigation/native'
import { FlagBar } from '../../components/ui'
import { useLang } from '../../contexts/LangContext'
import { useAuth } from '../../contexts/AuthContext'
import KkiapayModal from '../../components/KkiapayModal'
import { fetchWithTimeout } from '../../lib/fetch'
import { ttcFromHt, tvaFromHt } from '../../lib/tax'
import { authHeaders } from '../../config/api'
import { RootStackParamList } from '../../navigation/AppNavigator'
import { screenColors, typography, spacing, radius, shadows } from '../../config/theme'

/* ═══════════════════════════════════════════════════════════
   CheckoutScreen — THEME "CORPORATE PREMIUM 2026"
   (Aligné avec tous les autres écrans)
═══════════════════════════════════════════════════════════ */

const { width } = Dimensions.get('window')

// Palette de l'agence (identique aux autres écrans)
// Palette de l'ecran : plus de copie locale. Toutes les couleurs
// viennent du design system v2 (blanc + tricolore Benin).
const C = screenColors

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.retourgagnantbenin.bj'
const SHIPPING_KEY = '@rg_mobile_shipping'

type Nav = NativeStackNavigationProp<RootStackParamList, 'Checkout'>
type Route = RouteProp<RootStackParamList, 'Checkout'>

interface SavedShipping {
    name: string
    phone: string
    email: string
    address: string
    city: string
    postal: string
    country: string
    notes: string
}

const EMPTY_SHIPPING: SavedShipping = {
    name: '', phone: '', email: '',
    address: '', city: '', postal: '', country: 'Bénin',
    notes: '',
}

/* ═══════════════════════════════════════════════════════════
   COMPOSANT : ANIMATED SECTION (Stagger d'entrée)
═══════════════════════════════════════════════════════════ */

function AnimatedSection({
    children, delay = 0, style,
}: {
    children: React.ReactNode
    delay?: number
    style?: any
}) {
    const anim = useSharedValue(0)

    useEffect(() => {
        anim.value = withDelay(delay, withTiming(1, {
            duration: 800,
            easing: Easing.out(Easing.quad),
        }))
    }, [delay])

    const animStyle = useAnimatedStyle(() => ({
        opacity: anim.value,
        transform: [{ translateY: 30 * (1 - anim.value) }],
    }))

    return <Animated.View style={[animStyle, style]}>{children}</Animated.View>
}

/* ═══════════════════════════════════════════════════════════
   COMPOSANT : FIELD (bordure Or au focus, identique RegisterScreen)
═══════════════════════════════════════════════════════════ */

function Field({
    label, value, onChange, placeholder, icon,
    keyboardType = 'default', autoCapitalize = 'sentences',
    multiline = false, required = false,
}: {
    label: string
    value: string
    onChange: (v: string) => void
    placeholder?: string
    icon?: keyof typeof Ionicons.glyphMap
    keyboardType?: 'default' | 'phone-pad' | 'email-address'
    autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'
    multiline?: boolean
    required?: boolean
}) {
    const [focused, setFocused] = useState(false)
    const focusAnim = useSharedValue(0)

    useEffect(() => {
        focusAnim.value = withSpring(focused ? 1 : 0, { damping: 15, stiffness: 150 })
    }, [focused])

    const wrapStyle = useAnimatedStyle(() => ({
        borderColor: interpolateColor(focusAnim.value, [0, 1], [C.border, C.accent]),
        backgroundColor: focused ? C.surfaceSolid : C.surface,
        shadowOpacity: interpolate(focusAnim.value, [0, 1], [0.01, 0.08]),
        transform: [{ scale: interpolate(focusAnim.value, [0, 1], [1, 1.005]) }],
    }))

    const iconColor = focused ? C.accent : C.placeholder

    return (
        <View style={styles.field}>
            <View style={styles.labelRow}>
                <Text style={styles.fieldLabel}>{label}</Text>
                {required && <Text style={styles.fieldRequired}>•</Text>}
            </View>
            <Animated.View
                style={[
                    styles.inputWrap,
                    multiline && styles.inputWrapMultiline,
                    wrapStyle,
                ]}
            >
                {icon && (
                    <Ionicons
                        name={icon}
                        size={18}
                        color={iconColor}
                        style={[styles.inputIcon, multiline && { marginTop: 2 }]}
                    />
                )}
                <TextInput
                    style={[styles.input, multiline && styles.inputMultiline]}
                    value={value}
                    onChangeText={onChange}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    placeholder={placeholder}
                    placeholderTextColor={C.placeholder}
                    keyboardType={keyboardType}
                    autoCapitalize={autoCapitalize}
                    autoCorrect={false}
                    multiline={multiline}
                    numberOfLines={multiline ? 3 : 1}
                    selectionColor={C.accent}
                />
            </Animated.View>
        </View>
    )
}

/* ═══════════════════════════════════════════════════════════
   ÉCRAN PRINCIPAL : CHECKOUT
═══════════════════════════════════════════════════════════ */

export default function CheckoutScreen({ navigation, route }: { navigation: Nav; route: Route }) {
    const insets = useSafeAreaInsets()
    const { cart, total } = route.params
    // TVA « en sus » : le total passé est HORS TAXE (prix produits). Le client
    // paie le TTC (HT × 1,18), comme sur le web.
    const totalTtc = ttcFromHt(total)
    const totalTva = tvaFromHt(total)
    const { t } = useLang()
    const { profile } = useAuth()

    const [showPayment, setShowPayment] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [form, setForm] = useState<SavedShipping>(EMPTY_SHIPPING)

    /* ── Animations Corporate ── */
    const headerAnim = useSharedValue(0)

    /* ── Bouton "Payer" pulse subtil pour attirer l'œil ── */
    const payPulse = useSharedValue(0)

    useEffect(() => {
        headerAnim.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) })


        payPulse.value = withTiming(1, { duration: 600 })
    }, [])

    const styleHeader = useAnimatedStyle(() => ({
        opacity: headerAnim.value,
        transform: [{ translateY: 30 * (1 - headerAnim.value) }],
    }))

    const payGlowStyle = useAnimatedStyle(() => ({
        opacity: interpolate(payPulse.value, [0, 1], [0.15, 0.4]),
    }))

    /* ── Charger l'adresse précédemment utilisée ── */
    useEffect(() => {
        AsyncStorage.getItem(SHIPPING_KEY).then(raw => {
            if (raw) {
                try {
                    const saved = JSON.parse(raw) as SavedShipping
                    setForm({ ...EMPTY_SHIPPING, ...saved })
                    return
                } catch { /* ignore */ }
            }
            // Fallback : pré-remplir depuis le profil
            if (profile) {
                setForm(f => ({
                    ...f,
                    name: `${profile.prenom || ''} ${profile.nom || ''}`.trim(),
                    phone: profile.phone || '',
                    email: profile.email || '',
                    city: profile.ville || '',
                    country: profile.pays || 'Bénin',
                }))
            }
        }).catch(() => { })
    }, [profile])

    const set = (key: keyof SavedShipping) => (v: string) => setForm(f => ({ ...f, [key]: v }))
    const formatPrice = (n: number) => n.toLocaleString('fr-FR') + ' FCFA'

    /* ── Validation ── */
    const validateForm = (): string | null => {
        if (!form.name.trim()) return t('Veuillez renseigner votre nom complet.')
        if (!form.phone.trim() || form.phone.replace(/\D/g, '').length < 8) {
            return t('Numéro de téléphone invalide.')
        }
        if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
            return t('Email invalide.')
        }
        if (!form.address.trim()) return t("Veuillez renseigner l'adresse de livraison.")
        if (!form.city.trim()) return t('Veuillez renseigner la ville.')
        if (!form.country.trim()) return t('Veuillez renseigner le pays.')
        return null
    }

    /* ── Sauvegarder l'adresse ── */
    const persistShipping = useCallback(() => {
        AsyncStorage.setItem(SHIPPING_KEY, JSON.stringify(form)).catch(() => { })
    }, [form])

    /* ── Lancer le paiement ── */
    const handlePay = () => {
        const err = validateForm()
        if (err) {
            toast(t('Information requise'), err)
            return
        }
        persistShipping()
        setShowPayment(true)
    }

    /* ── Après paiement Kkiapay réussi ── */
    const handlePaymentSuccess = async (txId: string) => {
        if (!profile) {
            toast(t('Compte requis'), t('Veuillez vous connecter pour finaliser votre commande. Référence paiement : ') + txId)
            setShowPayment(false)
            return
        }

        setSubmitting(true)
        try {
            const cartItemsPayload = cart.map(c => ({
                product_id: c.product.id,
                title: c.product.title,
                quantity: c.quantity,
                unit_price: c.product.sale_price && c.product.sale_price < c.product.price
                    ? c.product.sale_price : c.product.price,
            }))

            const res = await fetchWithTimeout(`${API_BASE}/api/mobile/orders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
                timeoutMs: 20000,
                body: JSON.stringify({
                    client_id: profile.id,
                    customer_name: form.name.trim(),
                    customer_phone: form.phone.trim(),
                    customer_email: form.email.trim() || profile.email || null,
                    cart_items: cartItemsPayload,
                    amount: totalTtc,
                    currency: 'XOF',
                    transaction_id: txId,
                    shipping: {
                        address: form.address.trim(),
                        city: form.city.trim(),
                        postal: form.postal.trim() || null,
                        country: form.country.trim(),
                        notes: form.notes.trim() || null,
                    },
                }),
            })
            const data = await res.json().catch(() => ({}))

            if (!res.ok || !data.ok) {
                toast(t('Erreur enregistrement'), t("Le paiement a été reçu mais la commande n'a pas pu être enregistrée. Référence : ") + txId)
                return
            }

            setShowPayment(false)
            navigation.navigate('OrderConfirmation', {
                orderId: data.order_id,
                transactionId: txId,
            })
        } catch (e) {
            console.error('[Checkout] Submit failed:', e)
            toast(t('Erreur'), t('Impossible de finaliser votre commande. Référence : ') + txId)
        } finally {
            setSubmitting(false)
        }
    }

    const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0)

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >

            {/* NAV BAR */}
            <View style={[styles.topFlag, { marginTop: insets.top + 8 }]}>
                <FlagBar height={6} radiusTop={false} />
            </View>

            <View style={styles.navBar}>
                <Pressable onPress={() => navigation.goBack()} style={styles.navBack}
                    accessibilityRole="button"
                    hitSlop={6}
                    accessibilityLabel={t('Retour')}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="arrow-back" size={22} color={C.primary} />
                    </View>
                </Pressable>

                {/* Stepper visuel : étape 2/3 */}
                <View style={styles.stepper}>
                    <View style={[styles.step, styles.stepDone]}>
                        <Ionicons name="checkmark" size={12} color={C.primaryText} />
                    </View>
                    <View style={styles.stepLine} />
                    <View style={[styles.step, styles.stepActive]}>
                        <Text style={styles.stepText}>2</Text>
                    </View>
                    <View style={styles.stepLine} />
                    <View style={styles.step}>
                        <Text style={[styles.stepText, { color: C.textMuted }]}>3</Text>
                    </View>
                </View>

                <View style={{ width: 44 }} />
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scroll}
                keyboardShouldPersistTaps="handled"
            >
                {/* HEADER TITRE */}
                <Animated.View style={[styles.headerContainer, styleHeader]}>
                    <Text style={styles.title}>{t('Finaliser la commande')}</Text>
                    <Text style={styles.subtitle}>
                        {t('Renseignez votre adresse de livraison et procédez au paiement sécurisé.')}
                    </Text>
                </Animated.View>

                {/* ═══ RÉCAP PANIER ═══ */}
                <AnimatedSection delay={150}>
                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                            <View style={styles.cardHeaderBadge}>
                                <Ionicons name="bag-handle-outline" size={15} color={C.primary} />
                            </View>
                            <Text style={styles.cardTitle}>{t('Votre commande')}</Text>
                            <View style={styles.cardCountBadge}>
                                <Text style={styles.cardCountText}>
                                    {totalItems} {totalItems > 1 ? t('articles') : t('article')}
                                </Text>
                            </View>
                        </View>

                        {cart.map((item, i) => {
                            const unitPrice = item.product.sale_price && item.product.sale_price < item.product.price
                                ? item.product.sale_price
                                : item.product.price
                            return (
                                <View
                                    key={i}
                                    style={[
                                        styles.cartLine,
                                        i < cart.length - 1 && styles.cartLineBorder,
                                    ]}
                                >
                                    <View style={styles.cartQtyBadge}>
                                        <Text style={styles.cartQtyText}>×{item.quantity}</Text>
                                    </View>
                                    <Text style={styles.cartItemName} numberOfLines={2}>
                                        {t(item.product.title)}
                                    </Text>
                                    <Text style={styles.cartItemPrice}>
                                        {formatPrice(unitPrice * item.quantity)}
                                    </Text>
                                </View>
                            )
                        })}

                        {/* Sous-total HT + TVA + Total TTC */}
                        <View style={styles.taxRow}>
                            <Text style={styles.taxLabel}>{t('Sous-total HT')}</Text>
                            <Text style={styles.taxValue}>{formatPrice(total)}</Text>
                        </View>
                        <View style={styles.taxRow}>
                            <Text style={styles.taxLabel}>{t('TVA 18%')}</Text>
                            <Text style={styles.taxValue}>{formatPrice(totalTva)}</Text>
                        </View>
                        <View style={styles.totalRow}>
                            <View>
                                <Text style={styles.totalLabel}>{t('Total à payer')}</Text>
                                <Text style={styles.totalSubLabel}>{t('TTC, livraison incluse')}</Text>
                            </View>
                            <Text style={styles.totalValue}>{formatPrice(totalTtc)}</Text>
                        </View>
                    </View>
                </AnimatedSection>

                {/* ═══ FORMULAIRE LIVRAISON ═══ */}
                <AnimatedSection delay={250}>
                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                            <View style={styles.cardHeaderBadge}>
                                <Ionicons name="location-outline" size={15} color={C.primary} />
                            </View>
                            <Text style={styles.cardTitle}>{t('Adresse de livraison')}</Text>
                        </View>

                        <Field
                            label={t('Nom complet')}
                            value={form.name}
                            onChange={set('name')}
                            icon="person-outline"
                            placeholder={t('Jean Dupont')}
                            required
                        />
                        <Field
                            label={t('Téléphone')}
                            value={form.phone}
                            onChange={set('phone')}
                            icon="call-outline"
                            placeholder="+229 XX XX XX XX"
                            keyboardType="phone-pad"
                            required
                        />
                        <Field
                            label={t('Email')}
                            value={form.email}
                            onChange={set('email')}
                            icon="mail-outline"
                            placeholder="email@example.com"
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                        <Field
                            label={t('Adresse complète')}
                            value={form.address}
                            onChange={set('address')}
                            icon="location-outline"
                            placeholder={t('Quartier, rue, immeuble…')}
                            multiline
                            required
                        />

                        <View style={styles.row2}>
                            <View style={{ flex: 1 }}>
                                <Field
                                    label={t('Ville')}
                                    value={form.city}
                                    onChange={set('city')}
                                    placeholder={t('Cotonou')}
                                    required
                                />
                            </View>
                            <View style={{ width: 120 }}>
                                <Field
                                    label={t('Code postal')}
                                    value={form.postal}
                                    onChange={set('postal')}
                                    placeholder="00229"
                                />
                            </View>
                        </View>

                        <Field
                            label={t('Pays')}
                            value={form.country}
                            onChange={set('country')}
                            icon="earth-outline"
                            placeholder={t('Bénin')}
                            required
                        />
                        <Field
                            label={t('Instructions livraison (optionnel)')}
                            value={form.notes}
                            onChange={set('notes')}
                            placeholder={t('Étage, code, repère, horaire préféré…')}
                            multiline
                        />
                    </View>
                </AnimatedSection>

                {/* ═══ MOYENS DE PAIEMENT ═══ */}
                <AnimatedSection delay={350}>
                    <View style={styles.paymentMethodsCard}>
                        <View style={styles.cardHeader}>
                            <View style={styles.cardHeaderBadge}>
                                <Ionicons name="card-outline" size={15} color={C.primary} />
                            </View>
                            <Text style={styles.cardTitle}>{t('Moyens de paiement acceptés')}</Text>
                        </View>

                        <View style={styles.paymentLogos}>
                            <View style={styles.paymentLogo}>
                                <Ionicons name="phone-portrait-outline" size={18} color={C.accent} />
                                <Text style={styles.paymentLogoText}>Mobile Money</Text>
                            </View>
                            <View style={styles.paymentLogo}>
                                <Ionicons name="card-outline" size={18} color={C.accent} />
                                <Text style={styles.paymentLogoText}>Visa</Text>
                            </View>
                            <View style={styles.paymentLogo}>
                                <Ionicons name="card-outline" size={18} color={C.accent} />
                                <Text style={styles.paymentLogoText}>Mastercard</Text>
                            </View>
                            <View style={styles.paymentLogo}>
                                <Ionicons name="wallet-outline" size={18} color={C.accent} />
                                <Text style={styles.paymentLogoText}>Wave</Text>
                            </View>
                        </View>
                    </View>
                </AnimatedSection>

                {/* ═══ NOTE SÉCURITÉ ═══ */}
                <AnimatedSection delay={450}>
                    <View style={styles.securityNote}>
                        <View style={styles.securityIconWrap}>
                            <Ionicons name="shield-checkmark" size={16} color={C.success} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.securityTitle}>{t('Paiement 100% sécurisé')}</Text>
                            <Text style={styles.securityText}>
                                {t('Transactions chiffrées via Kkiapay · Norme PCI-DSS')}
                            </Text>
                        </View>
                    </View>
                </AnimatedSection>

                <View style={{ height: 140 }} />
            </ScrollView>

            {/* ═══ CTA FIXE : PAY ═══ */}
            <View style={styles.bottomBar}>
                <View style={styles.bottomBarInfo}>
                    <Text style={styles.bottomBarLabel}>{t('Total')}</Text>
                    <Text style={styles.bottomBarTotal}>{formatPrice(totalTtc)}</Text>
                </View>

                <View style={styles.payBtnWrap}>
                    <Animated.View style={[styles.payBtnGlow, payGlowStyle]} />

                    <TouchableOpacity
                        style={[styles.payBtn, submitting && styles.payBtnDisabled]}
                        onPress={handlePay}
                        disabled={submitting}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        hitSlop={6}
                    >
                        {submitting ? (
                            <ActivityIndicator color={C.primaryText} size="small" />
                        ) : (
                            <>
                                <Ionicons name="lock-closed" size={18} color={C.accent} style={{ marginRight: 8 }} />
                                <Text style={styles.payBtnText}>{t('Payer maintenant')}</Text>
                                <Ionicons name="arrow-forward" size={18} color={C.accent} style={{ marginLeft: 8 }} />
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            <KkiapayModal
                visible={showPayment}
                amount={String(totalTtc)}
                serviceName={cart.map(c => c.product.title).join(', ')}
                onClose={() => setShowPayment(false)}
                onSuccess={handlePaymentSuccess}
            />
        </KeyboardAvoidingView>
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

    /* ── Nav Bar avec stepper ── */
    topFlag: { marginHorizontal: 20, borderRadius: radius.pill, overflow: 'hidden' },
    navBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: spacing.lg, paddingBottom: spacing.md, gap: spacing.md },
    navBack: {
        width: 44,
        height: 44,
        justifyContent: 'center',
    },
    iconContainer: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },

    /* ── Stepper ── */
    stepper: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    step: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: C.surface,
        borderWidth: 1.2,
        borderColor: C.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepDone: {
        backgroundColor: C.success,
        borderColor: C.success,
    },
    stepActive: {
        backgroundColor: C.primary,
        borderColor: C.primary,
    },
    stepText: {
        fontSize: 12,
        fontWeight: '800',
        color: C.primaryText,
    },
    stepLine: {
        width: 18,
        height: 2,
        backgroundColor: C.border,
        borderRadius: 1,
    },

    scroll: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },

    /* ── Header (identique RegisterScreen) ── */
    headerContainer: {
        marginTop: 8,
        marginBottom: 24,
        paddingHorizontal: 8,
    },
    title: { ...typography.h1, color: C.text },
    subtitle: {
        fontSize: 15,
        color: C.textSec,
        marginTop: 14,
        lineHeight: 22,
        fontWeight: '400',
    },

    /* ── Card générique ── */
    card: {
        backgroundColor: C.surface,
        borderRadius: 16,
        padding: 20,
        borderWidth: 1.2,
        borderColor: C.border,
        marginBottom: 18,
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 16,
    },
    cardHeaderBadge: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: 'rgba(0, 135, 81, 0.06)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: C.primary,
        letterSpacing: -0.2,
        flex: 1,
    },
    cardCountBadge: {
        backgroundColor: 'rgba(252, 209, 22, 0.10)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: C.border,
    },
    cardCountText: {
        fontSize: 12,
        fontWeight: '700',
        color: C.accentDark,
        letterSpacing: 0.3,
    },

    /* ── Cart lines ── */
    cartLine: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 12,
    },
    cartLineBorder: {
        borderBottomWidth: 1,
        borderBottomColor: C.border,
    },
    cartQtyBadge: {
        minWidth: 32,
        height: 26,
        paddingHorizontal: 8,
        borderRadius: 8,
        backgroundColor: 'rgba(0, 135, 81, 0.06)',
        borderWidth: 1,
        borderColor: 'rgba(0, 135, 81, 0.08)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cartQtyText: {
        fontSize: 12,
        fontWeight: '800',
        color: C.primary,
    },
    cartItemName: {
        flex: 1,
        fontSize: 13.5,
        color: C.primary,
        fontWeight: '500',
        lineHeight: 18,
    },
    cartItemPrice: {
        fontSize: 14,
        fontWeight: '700',
        color: C.primary,
        letterSpacing: -0.2,
    },

    /* ── Total ── */
    taxRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 6,
    },
    taxLabel: { fontSize: 12.5, color: C.textMuted },
    taxValue: { fontSize: 12.5, color: C.textSec, fontWeight: '600' },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginTop: 12,
        paddingTop: 14,
        borderTopWidth: 1,
        borderTopColor: C.border,
    },
    totalLabel: {
        fontSize: 13,
        color: C.textSec,
        fontWeight: '600',
        letterSpacing: 0.2,
    },
    totalSubLabel: {
        fontSize: 12,
        color: C.textMuted,
        fontWeight: '500',
        marginTop: 3,
    },
    totalValue: {
        fontSize: 24,
        fontWeight: '800',
        color: C.primary,
        letterSpacing: -0.5,
    },

    /* ── Field ── */
    field: {
        marginBottom: 14,
    },
    labelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginBottom: 7,
    },
    fieldLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: C.textSec,
        letterSpacing: 0.3,
        textTransform: 'uppercase',
    },
    fieldRequired: {
        color: C.error,
        fontSize: 14,
        fontWeight: '800',
        lineHeight: 14,
    },
    inputWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 14,
        borderWidth: 1.2,
        paddingHorizontal: 14,
        minHeight: 52,
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 3 },
        shadowRadius: 8,
        elevation: 1,
    },
    inputWrapMultiline: {
        paddingTop: 12,
        paddingBottom: 12,
        minHeight: 80,
        alignItems: 'flex-start',
    },
    inputIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        color: C.primary,
        fontSize: 14,
        fontWeight: '500',
        paddingVertical: 0,
    },
    inputMultiline: {
        minHeight: 60,
        paddingTop: 0,
        textAlignVertical: 'top',
    },
    row2: {
        flexDirection: 'row',
        gap: 10,
    },

    /* ── Payment methods card ── */
    paymentMethodsCard: {
        backgroundColor: C.surface,
        borderRadius: 16,
        padding: 20,
        borderWidth: 1.2,
        borderColor: C.border,
        marginBottom: 14,
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 2,
    },
    paymentLogos: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    paymentLogo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: 'rgba(252, 209, 22, 0.06)',
        borderWidth: 1,
        borderColor: C.border,
    },
    paymentLogoText: {
        fontSize: 12,
        fontWeight: '700',
        color: C.primary,
        letterSpacing: 0.2,
    },

    /* ── Security Note ── */
    securityNote: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: 'rgba(0, 135, 81, 0.07)',
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: 'rgba(0, 135, 81, 0.18)',
    },
    securityIconWrap: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: 'rgba(0, 135, 81, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    securityTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: C.success,
        letterSpacing: -0.1,
        marginBottom: 2,
    },
    securityText: {
        fontSize: 12,
        color: C.textSec,
        fontWeight: '500',
        lineHeight: 16,
    },

    /* ── Bottom Bar (CTA fixe) ── */
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 14,
        paddingBottom: Platform.OS === 'ios' ? 34 : 18,
        backgroundColor: 'rgba(255, 255, 255, 0.96)',
        borderTopWidth: 1,
        borderTopColor: C.border,
        gap: 14,
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 10,
    },
    bottomBarInfo: {
        flex: 0.9,
    },
    bottomBarLabel: {
        fontSize: 12,
        color: C.textSec,
        fontWeight: '600',
        letterSpacing: 0.3,
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    bottomBarTotal: {
        fontSize: 18,
        fontWeight: '800',
        color: C.primary,
        letterSpacing: -0.4,
    },
    payBtnWrap: {
        flex: 1.4,
        position: 'relative',
    },
    payBtnGlow: { display: 'none' },
    payBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: C.primary,
        height: 56,
        borderRadius: 14,
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 8,
    },
    payBtnDisabled: {
        backgroundColor: '#E4E4E4',
        shadowOpacity: 0,
        elevation: 0,
    },
    payBtnText: {
        color: C.primaryText,
        fontSize: 15,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
})