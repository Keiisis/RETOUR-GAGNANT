import React, { useEffect, useState, useMemo } from 'react'
import { Platform } from 'react-native'
import {
    createNativeStackNavigator,
    NativeStackNavigationOptions,
} from '@react-navigation/native-stack'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useAuth } from '../contexts/AuthContext'

import LoginScreen from '../screens/auth/LoginScreen'
import RegisterScreen from '../screens/auth/RegisterScreen'
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen'
import TwoFactorScreen from '../screens/auth/TwoFactorScreen'
import MainTabNavigator from './MainTabNavigator'
import SplashScreen from '../screens/SplashScreen'
import OnboardingScreen from '../screens/OnboardingScreen'
import ServiceDetailsScreen from '../screens/main/ServiceDetailsScreen'
import EventDetailScreen from '../screens/main/EventDetailScreen'
import EditProfilScreen from '../screens/main/EditProfilScreen'
import SecurityScreen from '../screens/main/SecurityScreen'
import NotificationsScreen from '../screens/main/NotificationsScreen'
import PaymentsScreen from '../screens/main/PaymentsScreen'
import AppointmentsScreen from '../screens/main/AppointmentsScreen'
import FAQScreen from '../screens/main/FAQScreen'
import AboutScreen from '../screens/main/AboutScreen'
import BoutiqueScreen from '../screens/main/BoutiqueScreen'
import ProductDetailScreen from '../screens/main/ProductDetailScreen'
import CheckoutScreen from '../screens/main/CheckoutScreen'
import OrdersScreen from '../screens/main/OrdersScreen'
import OrderDetailScreen from '../screens/main/OrderDetailScreen'
import OrderConfirmationScreen from '../screens/main/OrderConfirmationScreen'
import SignatureScreen from '../screens/main/SignatureScreen'
import InvoicesScreen from '../screens/main/InvoicesScreen'
import NationaliteFormScreen from '../screens/main/NationaliteFormScreen'
import LegalScreen from '../screens/main/LegalScreen'

/* ── Types de navigation ── */
export interface BoutiqueProduct {
    id: string
    title: string
    description: string
    long_description: string
    price: number
    sale_price: number | null
    currency: string
    images: string[]
    category: string
    stock: number
    is_active: boolean
    is_featured: boolean
}

export interface CartItemNav {
    product: BoutiqueProduct
    quantity: number
}

export type RootStackParamList = {
    Onboarding: undefined
    Login: undefined
    Register: undefined
    ForgotPassword: undefined
    TwoFactor: undefined
    Main: undefined
    ServiceDetails: {
        serviceId: string
        title: string
        desc: string
        color: string
        icon: string
    }
    EventDetail: { event: Record<string, unknown> }
    EditProfil: undefined
    Security: undefined
    Notifications: undefined
    Payments: undefined
    Appointments: undefined
    FAQ: undefined
    About: undefined
    Boutique: undefined
    ProductDetail: {
        product: BoutiqueProduct
        onAddToCart: (qty: number) => void
    }
    Checkout: {
        cart: CartItemNav[]
        total: number
    }
    Orders: undefined
    OrderDetail: {
        orderId: string
        trackingCode?: string
    }
    OrderConfirmation: {
        orderId: string
        transactionId: string
    }
    Signature: undefined
    Invoices: undefined
    NationaliteForm: undefined
    Legal: undefined
}

const Stack = createNativeStackNavigator<RootStackParamList>()

const isIOS = Platform.OS === 'ios'

/* ──────────────────────────────────────────────────────────────
   PRESETS — 100 % natifs, calibrés sur iOS UIKit / SwiftUI.
   Aucune transition de type "web" : tout glisse, respire,
   et respecte le rythme tactile du système.
   ────────────────────────────────────────────────────────────── */

// Push iOS premium : slide horizontal + parallax de la vue précédente
// + swipe-back depuis n'importe où sur l'écran.
const pushIOS: NativeStackNavigationOptions = {
    animation: isIOS ? 'default' : 'slide_from_right',
    animationDuration: 380,
    gestureEnabled: true,
    fullScreenGestureEnabled: true,
    animationTypeForReplace: 'push',
    contentStyle: { backgroundColor: '#FFFFFF' },
    freezeOnBlur: true,
}

// Modale plein écran (flux long, focus total).
const modalIOS: NativeStackNavigationOptions = {
    presentation: 'modal',
    animation: 'slide_from_bottom',
    animationDuration: 420,
    gestureEnabled: true,
    gestureDirection: 'vertical',
    contentStyle: { backgroundColor: '#FFFFFF' },
    statusBarStyle: 'light',
    statusBarAnimation: 'fade',
}

// Form sheet façon iOS 17 — la vue parent reste visible derrière,
// coins arrondis, grabber, détents adaptatifs.
const formSheetIOS: NativeStackNavigationOptions = {
    presentation: isIOS ? 'formSheet' : 'modal',
    animation: 'slide_from_bottom',
    animationDuration: 420,
    gestureEnabled: true,
    gestureDirection: 'vertical',
    sheetGrabberVisible: true,
    sheetCornerRadius: 28,
    sheetAllowedDetents: 'fitToContents',
    sheetExpandsWhenScrolledToEdge: false,
    contentStyle: { backgroundColor: '#FFFFFF' },
}

// Sheet à détents multiples (mi-hauteur puis plein écran) — type Apple Maps.
const detentSheetIOS: NativeStackNavigationOptions = {
    presentation: isIOS ? 'formSheet' : 'modal',
    animation: 'slide_from_bottom',
    animationDuration: 420,
    gestureEnabled: true,
    sheetGrabberVisible: true,
    sheetCornerRadius: 28,
    sheetAllowedDetents: [0.5, 1.0],
    sheetLargestUndimmedDetentIndex: 0,
    contentStyle: { backgroundColor: '#FFFFFF' },
}

// Transparent modal : la page précédente reste pleinement visible derrière
// (parfait pour ProductDetail avec image héro qui "monte" du fond).
const transparentPushIOS: NativeStackNavigationOptions = {
    animation: isIOS ? 'default' : 'slide_from_right',
    animationDuration: 400,
    gestureEnabled: true,
    fullScreenGestureEnabled: true,
    contentStyle: { backgroundColor: '#FFFFFF' },
}

// Fade impactant pour les écrans "résultat".
const fadeReveal: NativeStackNavigationOptions = {
    animation: 'fade',
    animationDuration: 320,
    gestureEnabled: false,
    contentStyle: { backgroundColor: '#FFFFFF' },
}

// Switch root sans animation visible (Login ⇄ Main après auth).
const rootSwitch: NativeStackNavigationOptions = {
    animation: 'fade',
    animationDuration: 260,
    gestureEnabled: false,
    contentStyle: { backgroundColor: '#FFFFFF' },
}

export default function AppNavigator() {
    const { session, loading, twoFactorRequired } = useAuth()
    const [onboardingChecked, setOnboardingChecked] = useState(false)
    const [onboardingDone, setOnboardingDone] = useState(false)
    const [langChosen, setLangChosen] = useState(false)
    const [langChecked, setLangChecked] = useState(false)

    useEffect(() => {
        Promise.all([
            AsyncStorage.getItem('onboarding_complete'),
            AsyncStorage.getItem('lang_chosen'),
        ]).then(([obVal, langVal]) => {
            setOnboardingDone(obVal === 'true')
            setLangChosen(langVal === 'true')
            setOnboardingChecked(true)
            setLangChecked(true)
        })
    }, [])

    const globalScreenOptions = useMemo<NativeStackNavigationOptions>(
        () => ({
            headerShown: false,
            animation: 'fade',
            animationDuration: 320,
            contentStyle: { backgroundColor: '#FFFFFF' },
            statusBarAnimation: 'fade',
            statusBarStyle: 'dark',
            statusBarTranslucent: true,
            navigationBarColor: '#FFFFFF',
            navigationBarHidden: false,
            // Évite que les écrans non visibles consomment du CPU
            // (animations, vidéos, listes virtualisées) — gain de fluidité réel.
            freezeOnBlur: true,
        }),
        []
    )

    if (loading || !onboardingChecked || !langChecked) {
        return <SplashScreen isLoading />
    }

    if (!langChosen) {
        return (
            <SplashScreen
                onContinue={async () => {
                    await AsyncStorage.setItem('lang_chosen', 'true')
                    setLangChosen(true)
                }}
            />
        )
    }

    return (
        <Stack.Navigator screenOptions={globalScreenOptions}>
            {!onboardingDone ? (
                <Stack.Screen
                    name="Onboarding"
                    options={{ gestureEnabled: false, animation: 'fade' }}
                    children={() => (
                        <OnboardingScreen
                            onComplete={async () => {
                                await AsyncStorage.setItem('onboarding_complete', 'true')
                                setOnboardingDone(true)
                            }}
                        />
                    )}
                />
            ) : !session ? (
                <Stack.Group screenOptions={rootSwitch}>
                    <Stack.Screen name="Login" component={LoginScreen} />
                    <Stack.Screen
                        name="Register"
                        component={RegisterScreen}
                        options={pushIOS}
                    />
                    <Stack.Screen
                        name="ForgotPassword"
                        component={ForgotPasswordScreen}
                        options={pushIOS}
                    />
                </Stack.Group>
            ) : twoFactorRequired ? (
                // Connecté mais 2FA non validée pour cette session → défi obligatoire
                <Stack.Screen name="TwoFactor" component={TwoFactorScreen} options={{ gestureEnabled: false, animation: 'fade' }} />
            ) : (
                <>
                    {/* Racine authentifiée — tabs */}
                    <Stack.Screen
                        name="Main"
                        component={MainTabNavigator}
                        options={rootSwitch}
                    />

                    {/* Push iOS standard */}
                    <Stack.Group screenOptions={pushIOS}>
                        <Stack.Screen name="ServiceDetails" component={ServiceDetailsScreen} />
                        <Stack.Screen name="EventDetail" component={EventDetailScreen} />
                        <Stack.Screen name="Security" component={SecurityScreen} />
                        <Stack.Screen name="Notifications" component={NotificationsScreen} />
                        <Stack.Screen name="Payments" component={PaymentsScreen} />
                        <Stack.Screen name="Appointments" component={AppointmentsScreen} />
                        <Stack.Screen name="FAQ" component={FAQScreen} />
                        <Stack.Screen name="About" component={AboutScreen} />
                        <Stack.Screen name="Boutique" component={BoutiqueScreen} />
                        <Stack.Screen name="Checkout" component={CheckoutScreen} />
                        <Stack.Screen name="Orders" component={OrdersScreen} />
                        <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
                        <Stack.Screen name="Invoices" component={InvoicesScreen} />
                        <Stack.Screen name="Legal" component={LegalScreen} />
                    </Stack.Group>

                    {/* Push immersif : image héro qui monte du fond */}
                    <Stack.Screen
                        name="ProductDetail"
                        component={ProductDetailScreen}
                        options={transparentPushIOS}
                    />

                    {/* Form sheets : édition rapide, parent visible derrière */}
                    <Stack.Group screenOptions={formSheetIOS}>
                        <Stack.Screen name="EditProfil" component={EditProfilScreen} />
                        <Stack.Screen name="Signature" component={SignatureScreen} />
                    </Stack.Group>

                    {/* Sheet à détents (mi-hauteur → plein écran) */}
                    <Stack.Screen
                        name="NationaliteForm"
                        component={NationaliteFormScreen}
                        options={detentSheetIOS}
                    />

                    {/* Confirmation : fade dramatique, pas de retour gestuel */}
                    <Stack.Screen
                        name="OrderConfirmation"
                        component={OrderConfirmationScreen}
                        options={fadeReveal}
                    />
                </>
            )}
        </Stack.Navigator>
    )
}
