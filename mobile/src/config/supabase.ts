import { createClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

/* ═══════════════════════════════════════════════════════════
   Secure Storage adapter for Supabase auth tokens
   ───────────────────────────────────────────────────────────
   - iOS   : stockage dans le Keychain (chiffré hardware)
   - Android: stockage dans le Android Keystore (chiffré AES-256)
   - Web   : fallback sur localStorage (pour Expo Web/debug)
   
   Avantage vs AsyncStorage : les tokens ne sont JAMAIS en clair
   sur le disque. Même un appareil rooté/jailbreaké ne peut pas
   lire directement les clés sans déchiffrement hardware.
═══════════════════════════════════════════════════════════ */

const SecureStorageAdapter = {
    getItem: async (key: string): Promise<string | null> => {
        try {
            if (Platform.OS === 'web') {
                return typeof window !== 'undefined' ? localStorage.getItem(key) : null
            }
            return await SecureStore.getItemAsync(key)
        } catch {
            return null
        }
    },
    setItem: async (key: string, value: string): Promise<void> => {
        try {
            if (Platform.OS === 'web') {
                if (typeof window !== 'undefined') localStorage.setItem(key, value)
                return
            }
            await SecureStore.setItemAsync(key, value)
        } catch {
            // Silently fail on storage errors : ne pas bloquer l'auth
        }
    },
    removeItem: async (key: string): Promise<void> => {
        try {
            if (Platform.OS === 'web') {
                if (typeof window !== 'undefined') localStorage.removeItem(key)
                return
            }
            await SecureStore.deleteItemAsync(key)
        } catch {
            // Silently fail
        }
    },
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        storage: SecureStorageAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
})
