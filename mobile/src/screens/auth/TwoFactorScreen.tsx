import React, { useState } from 'react'
import {
    View, Text, TextInput, StyleSheet, KeyboardAvoidingView,
    Platform, ActivityIndicator, Pressable, TouchableOpacity,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../../contexts/AuthContext'
import { useLang } from '../../contexts/LangContext'

const C = {
    bg: '#F8F9FA',
    surface: '#FFFFFF',
    border: '#E2E8F0',
    primary: '#047857',
    accent: '#C9A84C',
    text: '#1a2332',
    textSec: '#64748B',
    danger: '#EF4444',
}

export default function TwoFactorScreen() {
    const { verifyTwoFactor, signOut } = useAuth()
    const { t } = useLang()
    const [code, setCode] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const submit = async () => {
        if (!/^\d{6}$/.test(code)) { setError(t('Entrez le code à 6 chiffres.')); return }
        setLoading(true); setError('')
        const { error: err } = await verifyTwoFactor(code)
        setLoading(false)
        if (err) setError(err.message)
    }

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
            <View style={styles.card}>
                <View style={styles.iconWrap}>
                    <Ionicons name="shield-checkmark" size={30} color={C.primary} />
                </View>
                <Text style={styles.title}>{t('Vérification en deux étapes')}</Text>
                <Text style={styles.subtitle}>{t('Entrez le code à 6 chiffres de votre application d\'authentification.')}</Text>

                <TextInput
                    value={code}
                    onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
                    keyboardType="number-pad"
                    placeholder="123456"
                    placeholderTextColor={C.textSec}
                    style={styles.input}
                    maxLength={6}
                    autoFocus
                />

                {error ? (
                    <View style={styles.errorRow}>
                        <Ionicons name="alert-circle" size={15} color={C.danger} />
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                ) : null}

                <Pressable onPress={submit} disabled={loading} style={[styles.btn, loading && { opacity: 0.6 }]}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{t('Vérifier')}</Text>}
                </Pressable>

                <TouchableOpacity onPress={signOut} style={styles.logout} hitSlop={10}>
                    <Text style={styles.logoutText}>{t('Se déconnecter')}</Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg, justifyContent: 'center', paddingHorizontal: 24 },
    card: { backgroundColor: C.surface, borderRadius: 24, borderWidth: 1, borderColor: C.border, padding: 28, alignItems: 'center' },
    iconWrap: { width: 60, height: 60, borderRadius: 20, backgroundColor: 'rgba(4,120,87,0.10)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    title: { fontSize: 20, fontWeight: '800', color: C.text, textAlign: 'center' },
    subtitle: { fontSize: 13.5, color: C.textSec, textAlign: 'center', marginTop: 8, marginBottom: 22, lineHeight: 20 },
    input: { width: '100%', borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingVertical: 14, textAlign: 'center', fontSize: 22, letterSpacing: 8, color: C.text, backgroundColor: '#FBFCFD' },
    errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
    errorText: { color: C.danger, fontSize: 13 },
    btn: { width: '100%', backgroundColor: C.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 18 },
    btnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
    logout: { marginTop: 18 },
    logoutText: { color: C.textSec, fontSize: 13, fontWeight: '600' },
})
