'use strict'
import React, { useEffect, useState, useRef, useCallback } from 'react'
import { toast } from '../../lib/feedback'
import {
    View, Text, FlatList, TextInput, TouchableOpacity,
    StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
    Pressable, Dimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    withDelay,
    withRepeat,
    withSequence,
    Easing,
    interpolate,
    interpolateColor,
} from 'react-native-reanimated'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../config/supabase'
import { FlagBar } from '../../components/ui'
import { useLang } from '../../contexts/LangContext'
import { screenColors, typography, spacing, radius, shadows } from '../../config/theme'

/* ═══════════════════════════════════════════════════════════
   MessagesScreen — THEME "CORPORATE PREMIUM 2026"
═══════════════════════════════════════════════════════════ */

const { width } = Dimensions.get('window')

// Palette de l'agence (cohérente avec Register & Legal)
// Palette de l'ecran : plus de copie locale. Toutes les couleurs
// viennent du design system v2 (blanc + tricolore Benin).
const C = screenColors

/* ── Types ── */
interface ChatMessage {
    id: string
    conversation_id: string
    role: 'client' | 'agent'
    content: string
    created_at: string
}

/* ═══════════════════════════════════════════════════════════
   COMPOSANT : SUGGESTION CHIP (animée)
═══════════════════════════════════════════════════════════ */
function SuggestionChip({ text, onPress, delay = 0 }: { text: string; onPress: () => void; delay?: number }) {
    const anim = useSharedValue(0)
    const pressAnim = useSharedValue(0)

    useEffect(() => {
        anim.value = withDelay(delay, withTiming(1, { duration: 600, easing: Easing.out(Easing.quad) }))
    }, [delay])

    const entryStyle = useAnimatedStyle(() => ({
        opacity: anim.value,
        transform: [{ translateY: 20 * (1 - anim.value) }],
    }))

    const pressStyle = useAnimatedStyle(() => ({
        backgroundColor: interpolateColor(
            pressAnim.value, [0, 1],
            [C.surface, 'rgba(252, 209, 22, 0.08)']
        ),
        borderColor: interpolateColor(
            pressAnim.value, [0, 1],
            [C.border, C.accent]
        ),
        transform: [{ scale: interpolate(pressAnim.value, [0, 1], [1, 0.98]) }],
    }))

    return (
        <Animated.View style={entryStyle}>
            <Pressable
                onPress={onPress}
                onPressIn={() => { pressAnim.value = withSpring(1) }}
                onPressOut={() => { pressAnim.value = withSpring(0) }}
                accessibilityRole="button"
                hitSlop={6}
            >
                <Animated.View style={[styles.suggestion, pressStyle]}>
                    <View style={styles.suggestionIconWrap}>
                        <Ionicons name="chatbubble-ellipses-outline" size={13} color={C.accent} />
                    </View>
                    <Text style={styles.suggestionText} numberOfLines={2}>{text}</Text>
                    <Ionicons name="arrow-forward" size={14} color={C.textMuted} />
                </Animated.View>
            </Pressable>
        </Animated.View>
    )
}

/* ═══════════════════════════════════════════════════════════
   ÉCRAN PRINCIPAL : MESSAGES
═══════════════════════════════════════════════════════════ */
export default function MessagesScreen({ navigation }: any) {
    const { profile } = useAuth()
    const { t } = useLang()
    const insets = useSafeAreaInsets()
    const [conversationId, setConversationId] = useState<string | null>(null)
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
    const [newMessage, setNewMessage] = useState('')
    const [sending, setSending] = useState(false)
    const [loading, setLoading] = useState(true)
    const [inputFocused, setInputFocused] = useState(false)
    const flatListRef = useRef<FlatList>(null)

    /* ── Animations Corporate ── */
    const headerAnim = useSharedValue(0)
    const contentAnim = useSharedValue(0)
    const onlineDot = useSharedValue(0)

    useEffect(() => {
        headerAnim.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) })
        contentAnim.value = withDelay(200, withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) }))

        // Pulsation du dot "en ligne"
        onlineDot.value = withTiming(1, { duration: 600 })
    }, [])

    const styleHeader = useAnimatedStyle(() => ({
        opacity: headerAnim.value,
        transform: [{ translateY: 30 * (1 - headerAnim.value) }],
    }))
    const styleContent = useAnimatedStyle(() => ({
        opacity: contentAnim.value,
        transform: [{ translateY: 40 * (1 - contentAnim.value) }],
    }))
    const onlineDotStyle = useAnimatedStyle(() => ({
        opacity: interpolate(onlineDot.value, [0, 1], [0.4, 1]),
        transform: [{ scale: interpolate(onlineDot.value, [0, 1], [0.8, 1.2]) }],
    }))

    /* ── 1. Find or create the conversation thread ── */
    const findOrCreateConversation = useCallback(async () => {
        if (!profile) return null
        const { data: existing, error: findErr } = await supabase
            .from('messages')
            .select('id')
            .eq('client_id', profile.id)
            .eq('type', 'chat')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

        if (findErr) console.warn('[Messages] Find conversation error:', findErr.message)
        if (existing) {
            setConversationId(existing.id)
            return existing.id
        }
        return null
    }, [profile])

    /* ── 2. Load chat history ── */
    const fetchChatHistory = useCallback(async (convId: string) => {
        const { data, error } = await supabase
            .from('chat_messages')
            .select('id, conversation_id, role, content, created_at')
            .eq('conversation_id', convId)
            .order('created_at', { ascending: true })
            .limit(200)

        if (!error && data) setChatMessages(data as ChatMessage[])
        else if (error) console.warn('[Messages] Fetch history error:', error.message)
        setLoading(false)
    }, [])

    /* ── Init ── */
    useEffect(() => {
        const init = async () => {
            const convId = await findOrCreateConversation()
            if (convId) await fetchChatHistory(convId)
            else setLoading(false)
            if (profile?.id) {
                AsyncStorage.setItem(`@rg_chat_last_seen_${profile.id}`, new Date().toISOString()).catch(() => { })
            }
        }
        init()
    }, [findOrCreateConversation, fetchChatHistory, profile?.id])

    /* ── 3. Realtime ── */
    useEffect(() => {
        if (!conversationId) return
        const channel = supabase
            .channel(`chat-${conversationId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'chat_messages',
                filter: `conversation_id=eq.${conversationId}`,
            }, (payload) => {
                const msg = payload.new as ChatMessage
                setChatMessages(prev => {
                    if (prev.find(m => m.id === msg.id)) return prev
                    const tempIndex = prev.findIndex(
                        m => m.id.startsWith('temp-') && m.content === msg.content && m.role === msg.role
                    )
                    if (tempIndex >= 0) {
                        const updated = [...prev]
                        updated[tempIndex] = msg
                        return updated
                    }
                    return [...prev, msg]
                })
                setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100)
            })
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [conversationId])

    /* ── 4. Send message ── */
    const sendMessage = async () => {
        if (!newMessage.trim() || !profile || sending) return
        const text = newMessage.trim()
        setNewMessage('')
        setSending(true)

        let activeConvId = conversationId

        if (!activeConvId) {
            const { data: convData, error: convErr } = await supabase
                .from('messages')
                .insert({
                    message: text,
                    client_id: profile.id,
                    sender_id: null,
                    recipient_id: null,
                    type: 'chat',
                    nom: profile.nom || '',
                    prenom: profile.prenom || '',
                    email: profile.email || '',
                    telephone: profile.phone || '',
                    sujet: `Chat — ${profile.prenom || ''} ${profile.nom || ''}`.trim(),
                    is_read: false,
                    lu: false,
                })
                .select('id')
                .single()

            if (convErr || !convData) {
                console.warn('[Messages] Create conversation error:', convErr?.message)
                setSending(false)
                toast(t('Erreur'), t('Impossible de démarrer la conversation.'))
                return
            }
            activeConvId = convData.id
            setConversationId(activeConvId)
        }

        const tempId = `temp-${Date.now()}`
        const tempMsg: ChatMessage = {
            id: tempId,
            conversation_id: activeConvId!,
            role: 'client',
            content: text,
            created_at: new Date().toISOString(),
        }
        setChatMessages(prev => [...prev, tempMsg])
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50)

        const { data, error } = await supabase
            .from('chat_messages')
            .insert({ conversation_id: activeConvId, role: 'client', content: text })
            .select('id, conversation_id, role, content, created_at')
            .single()

        setSending(false)

        if (error) {
            console.warn('[Messages] Send error:', error.message, error.code)
            setChatMessages(prev => prev.filter(m => m.id !== tempId))
            toast(t('Erreur'), t('Impossible d\'envoyer le message. Vérifiez votre connexion.'))
        } else if (data) {
            setChatMessages(prev => prev.map(m => m.id === tempId ? data as ChatMessage : m))
        }
    }

    /* ── Helpers ── */
    const fmtTime = (d: string) =>
        new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    const fmtDate = (d: string) =>
        new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

    /* ── Render Message ── */
    const renderMessage = ({ item, index }: { item: ChatMessage; index: number }) => {
        const isMe = item.role === 'client'
        const isTemp = item.id.startsWith('temp-')
        const showDate = index === 0 ||
            fmtDate(chatMessages[index - 1].created_at) !== fmtDate(item.created_at)

        return (
            <>
                {showDate && (
                    <View style={styles.dateSep}>
                        <View style={styles.dateLine} />
                        <View style={styles.datePill}>
                            <Text style={styles.dateText}>{fmtDate(item.created_at)}</Text>
                        </View>
                        <View style={styles.dateLine} />
                    </View>
                )}
                <View style={[styles.row, isMe ? styles.rowMe : styles.rowThem]}>
                    {!isMe && (
                        <View style={styles.agentAvatar}>
                            <Ionicons name="people" size={14} color={C.accent} />
                        </View>
                    )}
                    <View style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble]}>
                        {!isMe && (
                            <View style={styles.agentNameRow}>
                                <Text style={styles.agentName}>{t('Équipe RGB')}</Text>
                                <View style={styles.agentBadge}>
                                    <Ionicons name="shield-checkmark" size={9} color={C.accent} />
                                </View>
                            </View>
                        )}
                        <Text style={[styles.bubbleText, isMe ? styles.myText : styles.theirText]}>
                            {item.content}
                        </Text>
                        <View style={styles.bubbleMeta}>
                            <Text style={[styles.bubbleTime, isMe ? styles.myTime : styles.theirTime]}>
                                {fmtTime(item.created_at)}
                            </Text>
                            {isMe && (
                                isTemp
                                    ? <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.55)" />
                                    : <Ionicons name="checkmark-done" size={13} color={C.accentLight} />
                            )}
                        </View>
                    </View>
                </View>
            </>
        )
    }

    const inputBorderColor = inputFocused ? C.accent : C.border

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >

            {/* NAV BAR */}
            {/* LISERÉ TRICOLORE */}
            <View style={[styles.topFlag, { marginTop: insets.top + 8 }]}>
                <FlagBar height={6} radiusTop={false} />
            </View>

            {/* EN-TÊTE */}
            <View style={styles.navBar}>
                {navigation?.canGoBack?.() ? (
                    <Pressable
                        onPress={() => navigation?.goBack()}
                        accessibilityRole="button"
                        accessibilityLabel={t('Retour')}
                        hitSlop={8}
                        style={styles.iconContainer}
                    >
                        <Ionicons name="arrow-back" size={20} color={C.text} />
                    </Pressable>
                ) : null}

                <View style={{ flex: 1 }}>
                    <Text style={styles.navTitle} numberOfLines={1}>{t('Messagerie')}</Text>
                    {/* Aucun délai de réponse annoncé : l'app n'a pas de SLA réel
                        à afficher. On nomme l'interlocuteur, c'est vérifiable. */}
                    <Text style={styles.navSubtitle} numberOfLines={1}>{t('Équipe RGB')}</Text>
                </View>
            </View>

            {/* ZONE MESSAGES */}
            <Animated.View style={[{ flex: 1 }, styleContent]}>
                {loading ? (
                    <View style={styles.loadingState}>
                        <View style={styles.loadingIconWrap}>
                            <ActivityIndicator color={C.primary} size="large" />
                        </View>
                        <Text style={styles.loadingTitle}>{t('Chargement')}</Text>
                        <Text style={styles.loadingText}>{t('Récupération de vos messages…')}</Text>
                    </View>
                ) : chatMessages.length === 0 ? (
                    <View style={styles.empty}>
                        {/* Hero icon premium */}
                        <View style={styles.emptyHero}>
                            <View style={styles.emptyHeroGlow} />
                            <View style={styles.emptyIconWrap}>
                                <Ionicons name="chatbubbles" size={36} color={C.accent} />
                            </View>
                        </View>

                        <Text style={styles.emptyTitle}>{t('Démarrez la conversation')}</Text>
                        <Text style={styles.emptyText}>
                            {t('Échangez directement avec notre équipe d\'experts pour être accompagné dans votre projet de retour au Bénin.')}
                        </Text>

                        {/* Suggestions */}
                        <View style={styles.suggestionsHeader}>
                            <View style={styles.suggestionsLine} />
                            <Text style={styles.suggestionsTitle}>{t('SUGGESTIONS')}</Text>
                            <View style={styles.suggestionsLine} />
                        </View>

                        <View style={styles.suggestionsWrap}>
                            {[
                                t('Bonjour, je souhaite des informations sur la nationalité béninoise.'),
                                t('Comment fonctionne le service de recherche ancestrale ?'),
                                t('Quels documents faut-il pour initier un dossier ?'),
                            ].map((s, i) => (
                                <SuggestionChip
                                    key={i}
                                    text={s}
                                    delay={i * 100}
                                    onPress={() => setNewMessage(s)}
                                />
                            ))}
                        </View>
                    </View>
                ) : (
                    <FlatList
                        ref={flatListRef}
                        data={chatMessages}
                        keyExtractor={i => i.id}
                        renderItem={renderMessage}
                        contentContainerStyle={styles.list}
                        showsVerticalScrollIndicator={false}
                        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
                        onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
                    />
                )}
            </Animated.View>

            {/* BARRE D'ENVOI */}
            <View style={styles.inputBar}>
                <View style={[styles.inputWrap, { borderColor: inputBorderColor }]}>
                    <Ionicons
                        name="chatbubble-outline"
                        size={18}
                        color={inputFocused ? C.accent : C.placeholder}
                        style={styles.inputIcon}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder={t('Votre message…')}
                        placeholderTextColor={C.placeholder}
                        value={newMessage}
                        onChangeText={setNewMessage}
                        onFocus={() => setInputFocused(true)}
                        onBlur={() => setInputFocused(false)}
                        multiline
                        maxLength={1000}
                        selectionColor={C.accent}
                    />
                </View>
                <TouchableOpacity
                    style={[
                        styles.sendBtn,
                        (!newMessage.trim() || sending) && styles.sendBtnDisabled,
                    ]}
                    onPress={sendMessage}
                    disabled={!newMessage.trim() || sending}
                    activeOpacity={0.85}
                    accessibilityLabel={t('Envoyer le message')}
                    accessibilityState={{ disabled: !newMessage.trim() || sending }}
                    accessibilityRole="button"
                    hitSlop={6}
                >
                    {sending ? (
                        <ActivityIndicator color={C.primaryText} size="small" />
                    ) : (
                        <Ionicons name="arrow-up" size={20} color={C.primaryText} />
                    )}
                </TouchableOpacity>
            </View>
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

    /* ── Nav Bar ── */
    topFlag: { marginHorizontal: 20, borderRadius: radius.pill, overflow: 'hidden' },
    navTitle: { ...typography.h1, color: C.text },
    navSubtitle: { ...typography.bodySmall, color: C.textMuted, marginTop: 2 },
    navBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: spacing.lg, paddingBottom: spacing.md, gap: spacing.md },
    iconContainer: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: C.success,
    },

    /* ── Header ── */

    /* ── Loading ── */
    loadingState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        paddingHorizontal: 40,
    },
    loadingIconWrap: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: C.surface,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.2,
        borderColor: C.border,
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 2,
    },
    loadingTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: C.primary,
        letterSpacing: -0.2,
        marginTop: 6,
    },
    loadingText: {
        fontSize: 13,
        color: C.textSec,
        fontWeight: '500',
    },

    /* ── Empty State ── */
    empty: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 28,
        paddingTop: 10,
    },
    emptyHero: {
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 22,
    },
    emptyHeroGlow: { display: 'none' },
    emptyIconWrap: {
        width: 84,
        height: 84,
        borderRadius: 28,
        backgroundColor: C.surfaceSolid,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: C.border,
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
        elevation: 6,
    },
    emptyTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: C.primary,
        letterSpacing: -0.3,
        textAlign: 'center',
        marginBottom: 10,
    },
    emptyText: {
        fontSize: 13.5,
        color: C.textSec,
        textAlign: 'center',
        lineHeight: 20,
        fontWeight: '400',
        marginBottom: 28,
        paddingHorizontal: 10,
    },

    /* ── Suggestions ── */
    suggestionsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 14,
        width: '100%',
    },
    suggestionsLine: {
        flex: 1,
        height: 1,
        backgroundColor: C.border,
    },
    suggestionsTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: C.accentDark,
        letterSpacing: 1.5,
    },
    suggestionsWrap: {
        width: '100%',
        gap: 10,
    },
    suggestion: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: C.surface,
        borderRadius: 14,
        padding: 14,
        borderWidth: 1.2,
        borderColor: C.border,
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 1,
    },
    suggestionIconWrap: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: 'rgba(252, 209, 22, 0.10)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: C.border,
    },
    suggestionText: {
        flex: 1,
        fontSize: 12.5,
        color: C.primary,
        fontWeight: '500',
        lineHeight: 18,
    },

    /* ── Chat List ── */
    list: {
        paddingHorizontal: 20,
        paddingBottom: 12,
        paddingTop: 8,
    },

    /* ── Date Separator ── */
    dateSep: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginVertical: 16,
    },
    dateLine: {
        flex: 1,
        height: 1,
        backgroundColor: C.border,
    },
    datePill: {
        backgroundColor: C.surface,
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: C.border,
    },
    dateText: {
        fontSize: 12,
        color: C.textSec,
        fontWeight: '700',
        letterSpacing: 0.3,
        textTransform: 'capitalize',
    },

    /* ── Bubbles ── */
    row: {
        flexDirection: 'row',
        marginBottom: 8,
        alignItems: 'flex-end',
    },
    rowMe: { justifyContent: 'flex-end' },
    rowThem: { justifyContent: 'flex-start', gap: 8 },

    agentAvatar: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: C.primary,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: C.accent,
    },
    agentNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    agentName: {
        fontSize: 12,
        fontWeight: '800',
        color: C.accent,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
    },
    agentBadge: {
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: 'rgba(252, 209, 22, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },

    bubble: {
        maxWidth: '78%',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 18,
    },
    myBubble: {
        backgroundColor: C.primary,
        borderBottomRightRadius: 4,
        borderWidth: 1.2,
        borderColor: C.border,
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 8,
        elevation: 4,
    },
    theirBubble: {
        backgroundColor: C.surfaceSolid,
        borderBottomLeftRadius: 4,
        borderWidth: 1.2,
        borderColor: C.border,
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    bubbleText: {
        fontSize: 14.5,
        lineHeight: 21,
        fontWeight: '400',
    },
    myText: { color: C.primaryText },
    theirText: { color: C.primary },

    bubbleMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 6,
        justifyContent: 'flex-end',
    },
    bubbleTime: {
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 0.2,
    },
    myTime: { color: 'rgba(255,255,255,0.65)' },
    theirTime: { color: C.textMuted },

    /* ── Input Bar ── */
    inputBar: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        backgroundColor: C.surfaceSolid,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: Platform.OS === 'ios' ? 30 : 14,
        borderTopWidth: 1,
        borderTopColor: C.border,
        gap: 10,
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.04,
        shadowRadius: 12,
        elevation: 8,
    },
    inputWrap: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.bg,
        borderRadius: 16,
        borderWidth: 1.2,
        paddingHorizontal: 14,
        minHeight: 52,
        maxHeight: 120,
    },
    inputIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        fontSize: 14.5,
        color: C.primary,
        fontWeight: '500',
        paddingVertical: Platform.OS === 'ios' ? 14 : 10,
        maxHeight: 100,
    },
    sendBtn: {
        width: 52,
        height: 52,
        borderRadius: 16,
        backgroundColor: C.primary,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 6,
        borderWidth: 1.2,
        borderColor: C.border,
    },
    sendBtnDisabled: {
        backgroundColor: '#E4E4E4',
        shadowOpacity: 0,
        elevation: 0,
        borderColor: 'transparent',
    },
})