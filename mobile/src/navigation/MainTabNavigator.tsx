import React, { useEffect } from 'react'
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { Platform, StyleSheet, View, Text, Pressable } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    Easing,
} from 'react-native-reanimated'
import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'
import {
    Home,
    Folder,
    Briefcase,
    Calendar,
    MessageSquare,
    User,
    LucideIcon,
} from 'lucide-react-native'
import { colors, fonts } from '../config/theme'
import { useLang } from '../contexts/LangContext'

import HomeScreen from '../screens/main/HomeScreen'
import ServicesScreen from '../screens/main/ServicesScreen'
import DossierScreen from '../screens/main/DossierScreen'
import MessagesScreen from '../screens/main/MessagesScreen'
import ProfilScreen from '../screens/main/ProfilScreen'
import EventsScreen from '../screens/main/EventsScreen'

export type MainTabParamList = {
    Home: undefined
    Services: undefined
    Dossier: undefined
    Events: undefined
    Messages: undefined
    Profil: undefined
}

const Tab = createBottomTabNavigator<MainTabParamList>()

const TAB_ICONS: Record<keyof MainTabParamList, LucideIcon> = {
    Home: Home,
    Dossier: Folder,
    Services: Briefcase,
    Events: Calendar,
    Messages: MessageSquare,
    Profil: User,
}

/* ───────────── Layout constants ───────────── */
const BAR_HEIGHT = 56
const TOP_PADDING = 8

/* ═══════════════════════════════════════════════════════════════
   TabButton — icône + label compact, jamais de débordement.
   - Largeur contrainte par flex:1 (jamais de overflow horizontal)
   - Icône scale au focus, gold dot sous l'icône active
   - Haptics légers, ripple Android, hitSlop confortable
═══════════════════════════════════════════════════════════════ */

interface TabButtonProps {
    label: string
    Icon: LucideIcon
    focused: boolean
    onPress: () => void
    onLongPress: () => void
    accessibilityLabel?: string
    testID?: string
    badgeCount?: number
}

function TabButton({
    label,
    Icon,
    focused,
    onPress,
    onLongPress,
    accessibilityLabel,
    testID,
    badgeCount,
}: TabButtonProps) {
    const progress = useSharedValue(focused ? 1 : 0)
    const press = useSharedValue(1)

    useEffect(() => {
        progress.value = withSpring(focused ? 1 : 0, {
            damping: 18,
            stiffness: 240,
            mass: 0.6,
        })
    }, [focused, progress])

    const iconStyle = useAnimatedStyle(() => ({
        transform: [
            { scale: (0.94 + progress.value * 0.12) * press.value },
            { translateY: -progress.value * 1.5 },
        ],
    }))

    const dotStyle = useAnimatedStyle(() => ({
        opacity: progress.value,
        transform: [{ scale: 0.4 + progress.value * 0.6 }],
    }))

    const labelStyle = useAnimatedStyle(() => ({
        opacity: 0.65 + progress.value * 0.35,
    }))

    const handlePressIn = () => {
        press.value = withTiming(0.94, { duration: 80, easing: Easing.out(Easing.quad) })
    }
    const handlePressOut = () => {
        press.value = withSpring(1, { damping: 14, stiffness: 260 })
    }

    const handlePress = () => {
        if (!focused) {
            try {
                Haptics.selectionAsync()
            } catch {
                /* silent */
            }
        }
        onPress()
    }

    const tint = focused ? colors.primary : colors.textMuted
    const strokeWidth = focused ? 2.4 : 1.8

    return (
        <Pressable
            onPress={handlePress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onLongPress={onLongPress}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel || label}
            accessibilityState={{ selected: focused }}
            testID={testID}
            android_ripple={{ color: 'rgba(15,23,42,0.08)', borderless: true, radius: 28 }}
            hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}
            style={styles.tabBtn}
        >
            <View style={styles.tabBtnInner}>
                <Animated.View style={[styles.iconWrap, iconStyle]}>
                    <Icon size={22} color={tint} strokeWidth={strokeWidth} />
                    {badgeCount != null && badgeCount > 0 && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>
                                {badgeCount > 9 ? '9+' : badgeCount}
                            </Text>
                        </View>
                    )}
                </Animated.View>

                <Animated.Text
                    numberOfLines={1}
                    allowFontScaling={false}
                    style={[
                        styles.label,
                        {
                            color: tint,
                            fontFamily: focused ? fonts.bodyBold : fonts.bodyMedium,
                        },
                        labelStyle,
                    ]}
                >
                    {label}
                </Animated.Text>

                <Animated.View style={[styles.activeDot, dotStyle]} />
            </View>
        </Pressable>
    )
}

/* ═══════════════════════════════════════════════════════════════
   CustomTabBar
   - Barre ANCRÉE en bas, pleine largeur (zéro débordement possible)
   - Hairline top border + blur léger (iOS) ou opaque (Android)
   - Safe area respectée via insets.bottom
═══════════════════════════════════════════════════════════════ */

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
    const insets = useSafeAreaInsets()
    const bottomPadding = Math.max(insets.bottom, Platform.OS === 'ios' ? 8 : 6)

    return (
        <View style={[styles.barOuter, { paddingBottom: bottomPadding }]}>
            {/* Blur de fond — iOS only, sinon couleur pleine */}
            {Platform.OS === 'ios' && (
                <BlurView
                    intensity={70}
                    tint="light"
                    style={StyleSheet.absoluteFill}
                />
            )}
            <View style={styles.barTint} pointerEvents="none" />
            <View style={styles.hairline} pointerEvents="none" />

            <View style={styles.barInner}>
                {state.routes.map((route, index) => {
                    const { options } = descriptors[route.key]
                    const focused = state.index === index
                    const Icon = TAB_ICONS[route.name as keyof MainTabParamList] || Home
                    const label = (options.tabBarLabel as string) || route.name

                    const onPress = () => {
                        const event = navigation.emit({
                            type: 'tabPress',
                            target: route.key,
                            canPreventDefault: true,
                        })
                        if (!focused && !event.defaultPrevented) {
                            navigation.navigate(route.name as never)
                        }
                    }

                    const onLongPress = () => {
                        navigation.emit({ type: 'tabLongPress', target: route.key })
                    }

                    return (
                        <TabButton
                            key={route.key}
                            label={label}
                            Icon={Icon}
                            focused={focused}
                            onPress={onPress}
                            onLongPress={onLongPress}
                            accessibilityLabel={options.tabBarAccessibilityLabel || label}
                            testID={options.tabBarButtonTestID}
                        />
                    )
                })}
            </View>
        </View>
    )
}

/* ═══════════════════════════════════════════════════════════════
   MainTabNavigator
═══════════════════════════════════════════════════════════════ */

export default function MainTabNavigator() {
    const { t } = useLang()

    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarHideOnKeyboard: true,
                sceneStyle: { backgroundColor: colors.background },
                animation: 'shift',
            }}
            tabBar={(props) => <CustomTabBar {...props} />}
        >
            <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: t('Accueil') }} />
            <Tab.Screen name="Dossier" component={DossierScreen} options={{ tabBarLabel: t('Dossier') }} />
            <Tab.Screen name="Services" component={ServicesScreen} options={{ tabBarLabel: t('Services') }} />
            <Tab.Screen name="Events" component={EventsScreen} options={{ tabBarLabel: t('Événements') }} />
            <Tab.Screen name="Messages" component={MessagesScreen} options={{ tabBarLabel: t('Messages') }} />
            <Tab.Screen name="Profil" component={ProfilScreen} options={{ tabBarLabel: t('Profil') }} />
        </Tab.Navigator>
    )
}

/* ═══════════════════════════════════════════════════════════════
   Styles — barre ancrée, hairline, zéro overflow horizontal
═══════════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
    barOuter: {
        backgroundColor:
            Platform.OS === 'ios' ? 'transparent' : colors.surface,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -2 },
                shadowOpacity: 0.04,
                shadowRadius: 8,
            },
            android: {
                elevation: 12,
            },
        }),
    },
    barTint: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor:
            Platform.OS === 'ios'
                ? 'rgba(255,255,255,0.78)'
                : 'transparent',
    },
    hairline: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: StyleSheet.hairlineWidth,
        backgroundColor: 'rgba(15,23,42,0.08)',
    },
    barInner: {
        flexDirection: 'row',
        alignItems: 'center',
        height: BAR_HEIGHT,
        paddingTop: TOP_PADDING,
    },
    tabBtn: {
        flex: 1,
        height: BAR_HEIGHT,
        alignItems: 'center',
        justifyContent: 'center',
        // Empêche un label long de pousser le voisin
        minWidth: 0,
    },
    tabBtnInner: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 2,
        width: '100%',
    },
    iconWrap: {
        width: 26,
        height: 26,
        alignItems: 'center',
        justifyContent: 'center',
    },
    label: {
        fontSize: 10.5,
        letterSpacing: 0.1,
        marginTop: 3,
        maxWidth: '100%',
        textAlign: 'center',
    },
    activeDot: {
        position: 'absolute',
        bottom: -5,
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: colors.gold,
    },
    badge: {
        position: 'absolute',
        top: -4,
        right: -7,
        minWidth: 15,
        height: 15,
        borderRadius: 8,
        backgroundColor: '#EF4444',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 3,
        borderWidth: 1.5,
        borderColor: colors.surface,
    },
    badgeText: {
        fontSize: 9,
        fontFamily: fonts.bodyBold,
        color: '#FFFFFF',
        lineHeight: 11,
    },
})
