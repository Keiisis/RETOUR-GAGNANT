// ══════════════════════════════════════════════════════════════
// Notifications WhatsApp via OpenWA (passerelle auto-hébergée)
// https://github.com/rmyndharis/OpenWA — NestJS + whatsapp-web.js
//
// Permet de recevoir AUTOMATIQUEMENT un message WhatsApp à chaque nouveau
// RDV / prospect nationalité / message de contact, sans qu'un agent soit
// connecté, et SANS les contraintes de Meta (pas de template, pas de
// fenêtre 24h — messages libres à tout moment).
//
// ⚠️ ARCHITECTURE : OpenWA tourne en PROCESSUS PERSISTANT (Docker) sur un
// serveur toujours allumé (VPS / Railway / Render / machine dédiée). Il ne
// peut PAS tourner dans l'app Next.js sur Vercel (serverless). L'app appelle
// ici l'API REST distante d'OpenWA.
//
// Configuration (variables d'environnement, côté serveur uniquement) :
//   WHATSAPP_ENABLED      = "true"
//   OPENWA_BASE_URL       = URL de la passerelle (ex. https://wa.mon-domaine.com
//                           ou http://IP:2785) — SANS slash final
//   OPENWA_API_KEY        = clé API OpenWA (en-tête X-API-Key)
//   OPENWA_SESSION_ID     = identifiant de la session WhatsApp (ex. "rgb")
//   WHATSAPP_NOTIFY_TO    = numéros destinataires séparés par des virgules,
//                           format international SANS "+", ex. 2290160322121
// ══════════════════════════════════════════════════════════════

interface WhatsAppResult {
    sent: boolean
    skipped?: boolean
    reason?: string
}

function getConfig() {
    return {
        enabled: process.env.WHATSAPP_ENABLED === 'true',
        baseUrl: (process.env.OPENWA_BASE_URL || '').replace(/\/+$/, ''),
        apiKey: process.env.OPENWA_API_KEY || '',
        sessionId: process.env.OPENWA_SESSION_ID || '',
        recipients: (process.env.WHATSAPP_NOTIFY_TO || '')
            .split(',').map(n => n.replace(/[^\d]/g, '')).filter(Boolean),
    }
}

/** Convertit un numéro international (sans +) en chatId WhatsApp. */
function toChatId(number: string): string {
    return `${number.replace(/[^\d]/g, '')}@c.us`
}

async function sendToOne(to: string, text: string): Promise<boolean> {
    const cfg = getConfig()
    const url = `${cfg.baseUrl}/api/sessions/${encodeURIComponent(cfg.sessionId)}/messages/send-text`
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'X-API-Key': cfg.apiKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ chatId: toChatId(to), text }),
        })
        if (!res.ok) {
            const err = await res.text()
            console.error('[WhatsApp/OpenWA] Envoi échoué:', res.status, err.slice(0, 300))
            return false
        }
        return true
    } catch (e) {
        console.error('[WhatsApp/OpenWA] Erreur réseau:', e instanceof Error ? e.message : e)
        return false
    }
}

/**
 * Envoie une notification WhatsApp à tous les numéros configurés via OpenWA.
 * No-op silencieux si non configuré (pour ne jamais casser un flux métier).
 * À appeler en fire-and-forget (ne pas bloquer la réponse HTTP).
 */
export async function sendWhatsAppNotification(text: string): Promise<WhatsAppResult> {
    const cfg = getConfig()
    if (!cfg.enabled || !cfg.baseUrl || !cfg.apiKey || !cfg.sessionId || cfg.recipients.length === 0) {
        return { sent: false, skipped: true, reason: 'WhatsApp/OpenWA non configuré' }
    }
    const results = await Promise.all(cfg.recipients.map(to => sendToOne(to, text)))
    return { sent: results.some(Boolean) }
}

/** Indique si la passerelle WhatsApp est configurée (utile pour l'affichage admin). */
export function isWhatsAppConfigured(): boolean {
    const cfg = getConfig()
    return cfg.enabled && !!cfg.baseUrl && !!cfg.apiKey && !!cfg.sessionId && cfg.recipients.length > 0
}
