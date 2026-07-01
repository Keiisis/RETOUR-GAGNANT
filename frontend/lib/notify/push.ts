// ══════════════════════════════════════════════════════════════
// Envoi de notifications push via l'API Expo Push.
// Utilisé par /api/notifications/push (déclenché quand une notification
// est créée pour un client qui a un token push enregistré).
// ══════════════════════════════════════════════════════════════

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

export interface PushPayload {
    title: string
    body: string
    data?: Record<string, unknown>
}

const isExpoToken = (t: string) => /^ExponentPushToken\[.+\]$/.test(t) || /^ExpoPushToken\[.+\]$/.test(t)

/**
 * Envoie une notification push à un ou plusieurs tokens Expo.
 * Best-effort : ne jette jamais, retourne le nombre d'envois acceptés.
 */
export async function sendExpoPush(tokens: string[], payload: PushPayload): Promise<number> {
    const valid = [...new Set(tokens.filter(Boolean).filter(isExpoToken))]
    if (valid.length === 0) return 0

    let sent = 0
    // Expo accepte jusqu'à 100 messages par requête
    for (let i = 0; i < valid.length; i += 100) {
        const chunk = valid.slice(i, i + 100)
        const messages = chunk.map(to => ({
            to,
            title: payload.title,
            body: payload.body,
            sound: 'default',
            priority: 'high',
            data: payload.data || {},
        }))
        try {
            const res = await fetch(EXPO_PUSH_URL, {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(messages),
            })
            if (res.ok) sent += chunk.length
            else console.warn('[push] Expo a répondu', res.status, (await res.text()).slice(0, 200))
        } catch (e) {
            console.warn('[push] Erreur réseau Expo:', e instanceof Error ? e.message : e)
        }
    }
    return sent
}
