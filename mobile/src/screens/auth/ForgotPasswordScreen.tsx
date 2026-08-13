import React, { useState } from 'react'
import {
    View, Text, TextInput, Pressable, ScrollView, StyleSheet,
    KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ChevronLeft, Mail } from 'lucide-react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { useAuth } from '../../contexts/AuthContext'
import { useLang } from '../../contexts/LangContext'
import { toast } from '../../lib/feedback'
import { FlagBar } from '../../components/ui'
import { screenColors, spacing, radius } from '../../config/theme'

const C = screenColors

/**
 * Écran Mot de passe oublié : rendu fidèle à la maquette Sleek exportée
 * (« Pas d'inquiétude. » + champ email + bouton « Envoyer le lien »). LOGIQUE
 * préservée : resetPassword puis retour à la connexion.
 */
export default function ForgotPasswordScreen({ navigation }: any) {
    const insets = useSafeAreaInsets()
    const { resetPassword } = useAuth()
    const { t } = useLang()

    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [focused, setFocused] = useState(false)

    const handleReset = async () => {
        if (!email.trim()) {
            toast(t('Champs requis'), t('Veuillez entrer votre adresse email.'))
            return
        }
        setLoading(true)
        const { error } = await resetPassword(email.trim())
        setLoading(false)
        if (error) {
            toast(t('Erreur'), error.message)
        } else {
            toast(t('Email envoyé'), t('Vérifiez votre boîte de réception pour réinitialiser votre mot de passe.'), 'success')
            navigation.navigate('Login')
        }
    }

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
            <View style={{ paddingTop: insets.top }}>
                <FlagBar height={6} radiusTop={false} />
            </View>
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Animated.View entering={FadeInDown.duration(500)} style={styles.header}>
                    <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Retour')}>
                        <ChevronLeft size={24} color={C.text} strokeWidth={2.2} />
                    </Pressable>
                    <Text style={styles.title}>{t("Pas d'inquiétude.")}</Text>
                    <Text style={styles.subtitle}>{t('Entrez votre email pour recevoir un lien de réinitialisation.')}</Text>
                </Animated.View>

                <Animated.View entering={FadeInDown.duration(500).delay(120)} style={styles.form}>
                    <Text style={styles.label}>{t('Adresse email')}</Text>
                    <View style={[styles.field, focused && styles.fieldFocused]}>
                        <Mail size={20} color={C.textMuted} strokeWidth={2} />
                        <TextInput
                            value={email}
                            onChangeText={setEmail}
                            onFocus={() => setFocused(true)}
                            onBlur={() => setFocused(false)}
                            onSubmitEditing={handleReset}
                            placeholder="nom@exemple.com"
                            placeholderTextColor={C.placeholder}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                            style={styles.input}
                        />
                    </View>

                    <Pressable
                        onPress={handleReset}
                        disabled={loading}
                        style={({ pressed }) => [styles.submitBtn, pressed && { transform: [{ scale: 0.98 }] }, loading && { opacity: 0.7 }]}
                        accessibilityRole="button"
                    >
                        {loading ? <ActivityIndicator color={C.primaryText} /> : <Text style={styles.submitText}>{t('Envoyer le lien')}</Text>}
                    </Pressable>

                    <Pressable onPress={() => navigation.navigate('Login')} style={styles.backLink} hitSlop={6}>
                        <Text style={styles.backLinkText}>{t('Retour à la connexion')}</Text>
                    </Pressable>
                </Animated.View>
            </ScrollView>
        </KeyboardAvoidingView>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    scroll: { paddingBottom: 40 },
    header: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.lg },
    backBtn: {
        width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: C.border,
        alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xl,
    },
    title: { fontSize: 30, lineHeight: 36, fontFamily: 'Inter_800ExtraBold', color: C.text, letterSpacing: -0.5, marginBottom: 6 },
    subtitle: { fontSize: 15, lineHeight: 22, fontFamily: 'Inter_500Medium', color: C.textSec },

    form: { paddingHorizontal: spacing.lg, gap: spacing.md },
    label: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1, textTransform: 'uppercase', color: C.textMuted, marginBottom: 8, marginLeft: 4 },
    field: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.border,
        borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: 14,
    },
    fieldFocused: { borderColor: C.primary, backgroundColor: C.surface },
    input: { flex: 1, fontSize: 15, fontFamily: 'Inter_500Medium', color: C.text, padding: 0 },

    submitBtn: {
        marginTop: spacing.sm, backgroundColor: C.primary, borderRadius: radius.lg, paddingVertical: 18,
        alignItems: 'center', justifyContent: 'center',
        shadowColor: '#008751', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 6,
    },
    submitText: { color: C.primaryText, fontSize: 16, fontFamily: 'Inter_700Bold', letterSpacing: 0.2 },
    backLink: { alignSelf: 'center', marginTop: spacing.lg },
    backLinkText: { fontSize: 14, fontFamily: 'Inter_700Bold', color: C.primary },
})
