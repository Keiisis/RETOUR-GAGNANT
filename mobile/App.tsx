import React, { useEffect } from 'react'
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { Linking, Alert } from 'react-native'
import {
    useFonts,
    PlayfairDisplay_700Bold,
    PlayfairDisplay_400Regular,
} from '@expo-google-fonts/playfair-display'
import {
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
} from '@expo-google-fonts/inter'
import {
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans'
import {
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
} from '@expo-google-fonts/outfit'
import * as Notifications from 'expo-notifications'

import { AuthProvider } from './src/contexts/AuthContext'
import { LangProvider } from './src/contexts/LangContext'
import { FeedbackProvider } from './src/components/FeedbackProvider'
import { PaymentSettingsProvider } from './src/contexts/PaymentSettingsContext'
import { CartProvider } from './src/contexts/CartContext'
import AppNavigator from './src/navigation/AppNavigator'
import SplashScreen from './src/screens/SplashScreen'
import OfflineBanner from './src/components/OfflineBanner'
import { KkiapayProvider } from '@kkiapay-org/react-native-sdk'

/* ── Notification handler global (doit être défini avant tout rendu) ── */
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
})

/* ── Référence de navigation (pour ouvrir un écran depuis une notification) ── */
export const navigationRef = createNavigationContainerRef()

/* ── Configuration Deep Links ── */
const linking = {
    prefixes: ['retourgagnant://', 'https://www.retourgagnantbenin.bj', 'https://retourgagnantbenin.bj'],
    config: {
        screens: {
            Main: 'main',
            ServiceDetails: 'service/:serviceId',
            Payments: 'payments',
        },
    },
}

export default function App() {
    const [fontsLoaded] = useFonts({
        // Design v2 : Plus Jakarta Sans porte toute l'interface.
        PlusJakartaSans_400Regular,
        PlusJakartaSans_500Medium,
        PlusJakartaSans_600SemiBold,
        PlusJakartaSans_700Bold,
        PlusJakartaSans_800ExtraBold,
        PlayfairDisplay_700Bold,
        PlayfairDisplay_400Regular,
        Inter_400Regular,
        Inter_500Medium,
        Inter_600SemiBold,
        Inter_700Bold,
        Outfit_400Regular,
        Outfit_500Medium,
        Outfit_600SemiBold,
        Outfit_700Bold,
    })

    /* ── Écouter les deep links entrants (retour paiement Kkiapay) ── */
    useEffect(() => {
        const handleDeepLink = (event: { url: string }) => {
            const url = event.url
            if (url.includes('payment-success')) {
                const txMatch = url.match(/transactionId=([^&]+)/)
                const txId = txMatch ? txMatch[1] : 'N/A'
                Alert.alert(
                    '✅ Paiement confirmé',
                    `Votre paiement a bien été reçu.\nRéférence : ${txId}\n\nVotre dossier est en cours de création.`,
                    [{ text: 'OK', style: 'default' }]
                )
            } else if (url.includes('payment-failed')) {
                Alert.alert(
                    '❌ Paiement échoué',
                    'Le paiement n\'a pas pu être finalisé. Veuillez réessayer.',
                    [{ text: 'OK', style: 'cancel' }]
                )
            } else if (url.includes('payment-canceled')) {
                Alert.alert(
                    'Paiement annulé',
                    'Vous avez annulé le paiement. Vous pouvez réessayer à tout moment.',
                    [{ text: 'OK', style: 'default' }]
                )
            }
        }

        // Écoute les liens reçus quand l'app est déjà ouverte
        const sub = Linking.addEventListener('url', handleDeepLink)

        // Vérifie si l'app a été ouverte par un deep link
        Linking.getInitialURL().then((url) => {
            if (url) handleDeepLink({ url })
        })

        return () => sub.remove()
    }, [])

    /* ── Tap sur une notification push → ouvre l'écran Notifications ── */
    useEffect(() => {
        const sub = Notifications.addNotificationResponseReceivedListener(() => {
            if (navigationRef.isReady()) {
                // @ts-expect-error navigation dynamique
                navigationRef.navigate('Notifications')
            }
        })
        return () => sub.remove()
    }, [])

    // Attendre que les polices soient prêtes avant d'afficher l'app
    if (!fontsLoaded) {
        return <SplashScreen isLoading />
    }

    return (
        <SafeAreaProvider>
            <KkiapayProvider>
                <PaymentSettingsProvider>
                    <LangProvider>
                        <AuthProvider>
                            <CartProvider>
                                <FeedbackProvider>
                                    <NavigationContainer ref={navigationRef} linking={linking}>
                                        <StatusBar style="dark" />
                                        <AppNavigator />
                                        <OfflineBanner />
                                    </NavigationContainer>
                                </FeedbackProvider>
                            </CartProvider>
                        </AuthProvider>
                    </LangProvider>
                </PaymentSettingsProvider>
            </KkiapayProvider>
        </SafeAreaProvider>
    )
}
