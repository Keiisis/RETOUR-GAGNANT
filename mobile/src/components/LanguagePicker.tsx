import React, { useMemo, useState } from 'react'
import {
    View, Text, StyleSheet, TextInput,
    Modal, ScrollView, Pressable,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Check, ChevronLeft, Search } from 'lucide-react-native'
import { useLang, SUPPORTED_LANGUAGES, type LangCode } from '../contexts/LangContext'
import { screenColors as C, spacing, radius, typography, shadows, fonts } from '../config/theme'
import { FlagBar } from './ui'

interface LanguagePickerProps {
    visible: boolean
    onClose: () => void
}

/* Écran « Langue de l'application » : plein écran, fidèle à la maquette Sleek.
   LOGIQUE préservée : useLang / setLang / les 6 langues supportées ; le choix
   s'applique instantanément au tap (traduction en direct), pas de bouton. */
export default function LanguagePicker({ visible, onClose }: LanguagePickerProps) {
    const { lang, setLang, t } = useLang()
    const insets = useSafeAreaInsets()
    const [query, setQuery] = useState('')

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        if (!q) return SUPPORTED_LANGUAGES
        return SUPPORTED_LANGUAGES.filter(l =>
            l.nativeLabel.toLowerCase().includes(q) || l.label.toLowerCase().includes(q)
        )
    }, [query])

    const handleSelect = (code: LangCode) => {
        setLang(code)
        setTimeout(onClose, 140)
    }

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
            <View style={styles.container}>
                {/* Liseré tricolore */}
                <View style={{ paddingTop: insets.top }}>
                    <FlagBar height={6} radiusTop={false} />
                </View>

                {/* Header */}
                <View style={styles.header}>
                    <Pressable
                        onPress={onClose}
                        style={styles.backBtn}
                        accessibilityRole="button"
                        accessibilityLabel={t('Retour')}
                        hitSlop={8}
                    >
                        <ChevronLeft size={24} color={C.text} strokeWidth={2} />
                    </Pressable>
                    <Text style={styles.headerTitle}>{t("Langue de l'application")}</Text>
                </View>

                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.lg }]}
                    keyboardShouldPersistTaps="handled"
                >
                    <Text style={styles.intro}>
                        {t("Choisissez la langue d'affichage. La traduction s'applique instantanément.")}
                    </Text>

                    {/* Recherche */}
                    <View style={styles.searchBar}>
                        <Search size={20} color={C.textMuted} strokeWidth={2} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder={t('Rechercher une langue...')}
                            placeholderTextColor={C.textMuted}
                            value={query}
                            onChangeText={setQuery}
                            selectionColor={C.primary}
                        />
                    </View>

                    {/* Liste */}
                    <Text style={styles.sectionLabel}>{t('Langues disponibles')}</Text>
                    <View style={styles.card}>
                        {filtered.map((item, index) => {
                            const isSelected = item.code === lang
                            const isLast = index === filtered.length - 1
                            return (
                                <React.Fragment key={item.code}>
                                    <Pressable
                                        style={styles.row}
                                        onPress={() => handleSelect(item.code)}
                                        accessibilityRole="button"
                                        accessibilityState={{ selected: isSelected }}
                                        hitSlop={4}
                                    >
                                        <View style={styles.flagTile}>
                                            <Text style={styles.flag}>{item.flag}</Text>
                                        </View>
                                        <View style={styles.labels}>
                                            <Text style={styles.nativeLabel}>{item.nativeLabel}</Text>
                                            <Text style={styles.frenchLabel}>{item.label}</Text>
                                        </View>
                                        {isSelected && (
                                            <View style={styles.checkCircle}>
                                                <Check size={14} color={C.primaryText} strokeWidth={3} />
                                            </View>
                                        )}
                                    </Pressable>
                                    {!isLast && <View style={styles.divider} />}
                                </React.Fragment>
                            )
                        })}
                    </View>

                    <Text style={styles.note}>
                        {t('La traduction est automatique et peut comporter des imperfections.')}
                    </Text>
                </ScrollView>
            </View>
        </Modal>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.lg,
        paddingHorizontal: spacing.gutter,
        paddingTop: spacing.md,
        paddingBottom: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: C.border,
    },
    backBtn: {
        width: 40, height: 40, borderRadius: radius.pill,
        borderWidth: 1, borderColor: C.border,
        alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: { ...typography.h2, fontFamily: fonts.extrabold, fontSize: 19, color: C.text },

    scroll: { paddingHorizontal: spacing.gutter, paddingTop: spacing.lg },

    intro: { ...typography.bodySmall, color: C.textMuted, lineHeight: 20, marginBottom: spacing.lg, paddingHorizontal: 2 },

    searchBar: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        backgroundColor: C.surfaceAlt,
        borderWidth: 1, borderColor: C.border,
        borderRadius: radius.lg,
        paddingHorizontal: 16, paddingVertical: 14,
        marginBottom: spacing.xl,
    },
    searchInput: { flex: 1, ...typography.bodySmall, color: C.text, padding: 0 },

    sectionLabel: {
        ...typography.caption, fontSize: 10, color: C.primary,
        textTransform: 'uppercase', letterSpacing: 2,
        marginBottom: spacing.md, marginLeft: 2,
    },
    card: {
        backgroundColor: C.surface,
        borderRadius: radius.xxl,
        borderWidth: 1, borderColor: C.border,
        overflow: 'hidden',
        ...shadows.card,
    },
    row: {
        flexDirection: 'row', alignItems: 'center', gap: 14,
        paddingHorizontal: spacing.lg, paddingVertical: spacing.md + 2,
    },
    flagTile: {
        width: 40, height: 40, borderRadius: radius.md,
        backgroundColor: C.surfaceAlt,
        borderWidth: 1, borderColor: C.border,
        alignItems: 'center', justifyContent: 'center',
    },
    flag: { fontSize: 20 },
    labels: { flex: 1 },
    nativeLabel: { ...typography.button, fontSize: 14, color: C.text },
    frenchLabel: { ...typography.caption, fontSize: 10, color: C.textMuted, marginTop: 2 },
    checkCircle: {
        width: 24, height: 24, borderRadius: 12,
        backgroundColor: C.primary,
        alignItems: 'center', justifyContent: 'center',
        ...shadows.card,
    },
    divider: { height: 1, backgroundColor: C.border, marginHorizontal: spacing.lg },

    note: {
        ...typography.caption, fontSize: 10, color: C.textMuted,
        textAlign: 'center', lineHeight: 16,
        marginTop: spacing.xl, paddingHorizontal: spacing.xl,
    },
})
