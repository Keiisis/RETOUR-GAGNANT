import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { supabase } from '../config/supabase'

/* ═══════════════════════════════════════════════════════════
   Push Token Registration
   
   Registers the Expo Push Token in Supabase so the admin
   dashboard can send targeted push notifications to clients.
═══════════════════════════════════════════════════════════ */

/**
 * Request push notification permissions and register the
 * Expo push token in the `client_profiles` table.
 * 
 * Should be called once after successful login.
 */
export async function registerPushToken(userId: string): Promise<string | null> {
    // Push notifications only work on physical devices
    if (!Device.isDevice) {
        console.log('[Push] Skipping token registration : not a physical device')
        return null
    }

    try {
        // 1. Check / request permissions
        const { status: existingStatus } = await Notifications.getPermissionsAsync()
        let finalStatus = existingStatus

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync()
            finalStatus = status
        }

        if (finalStatus !== 'granted') {
            console.log('[Push] Permission not granted')
            return null
        }

        // 2. Get the Expo push token
        const tokenData = await Notifications.getExpoPushTokenAsync({
            projectId: '6101f41c-f687-4263-af3e-049669ec6973',
        })
        const token = tokenData.data
        console.log('[Push] Token obtained:', token.substring(0, 20) + '...')

        // 3. Save token to Supabase
        const { error } = await supabase
            .from('client_profiles')
            .update({
                push_token: token,
                push_token_updated_at: new Date().toISOString(),
            })
            .eq('id', userId)

        if (error) {
            console.warn('[Push] Failed to save token:', error.message)
        } else {
            console.log('[Push] Token registered successfully')
        }

        // 4. Android: set notification channel
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'Retour Gagnant',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#10B981',
                sound: 'default',
            })
        }

        return token
    } catch (err) {
        console.warn('[Push] Registration error:', err)
        return null
    }
}

/**
 * Clear the push token from Supabase (e.g., on logout).
 */
export async function clearPushToken(userId: string): Promise<void> {
    try {
        await supabase
            .from('client_profiles')
            .update({ push_token: null, push_token_updated_at: null })
            .eq('id', userId)
        console.log('[Push] Token cleared')
    } catch (err) {
        console.warn('[Push] Failed to clear token:', err)
    }
}
