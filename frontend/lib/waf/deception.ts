// ══════════════════════════════════════════════════════════════
// 🎭 WAF DECEPTION : Cyber-Déception & Gaslighting
// Retourne des faux payloads crédibles aux attaquants détectés
// L'attaquant ne sait pas qu'il est piégé : il perd du temps
// ══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'

// ── Types ────────────────────────────────────────────────────
export interface DeceptionPayload {
    id?:              string
    status_code:      number
    content_type:     string
    response_body:    string
    response_headers: Record<string, string>
    payload_name?:    string
}

export type AttackType =
    | 'sql_injection'
    | 'xss'
    | 'lfi'
    | 'rce'
    | 'scanner_detection'
    | 'honeypot'
    | 'path_traversal'
    | 'command_injection'
    | string

// ── Cache local des payloads ─────────────────────────────────
let deceptionPayloadsCache: DeceptionPayload[] = []
let deceptionCacheTs = 0
const DECEPTION_CACHE_TTL = 5 * 60_000 // 5 minutes

export function setDeceptionCache(payloads: DeceptionPayload[]): void {
    deceptionPayloadsCache = payloads
    deceptionCacheTs = Date.now()
}

export function isDeceptionCacheStale(): boolean {
    return Date.now() - deceptionCacheTs > DECEPTION_CACHE_TTL
}

// ── Faux headers HTTP pour tromper les scanners ──────────────
const FAKE_HEADERS_POOL: Record<string, string>[] = [
    {
        'Server': 'Apache/2.4.41 (Ubuntu)',
        'X-Powered-By': 'PHP/7.4.33',
        'X-AspNet-Version': '4.0.30319',
    },
    {
        'Server': 'nginx/1.14.2',
        'X-Powered-By': 'Express/4.17.1',
        'X-Generator': 'Drupal 7 (https://www.drupal.org)',
    },
    {
        'Server': 'Microsoft-IIS/10.0',
        'X-Powered-By': 'ASP.NET',
        'X-AspNetMvc-Version': '5.2.7',
    },
    {
        'Server': 'Apache/2.2.22 (Debian)',
        'X-Powered-By': 'PHP/5.6.40',
        'X-Generator': 'WordPress 4.9.18',
    },
]

// ── Payloads de fallback intégrés (si DB vide) ───────────────
const FALLBACK_PAYLOADS: Record<string, DeceptionPayload> = {
    sql_injection: {
        status_code: 500,
        content_type: 'text/html; charset=utf-8',
        response_body: `<!DOCTYPE html><html><head><title>Database Error</title></head><body>
<h1>Internal Server Error</h1>
<p><b>MySQL Error 1045:</b> Access denied for user 'webapp_prod'@'10.0.3.42' (using password: YES)</p>
<p>Query: <code>SELECT * FROM users WHERE id = ''</code></p>
<p>Table: <code>prod_users_v2</code></p>
<p>Server: <code>db-replica-03.internal.corp</code></p>
<!-- Debug: MySQL 5.7.38-log, InnoDB engine -->
</body></html>`,
        response_headers: {
            'Server': 'Apache/2.4.41 (Ubuntu)',
            'X-Powered-By': 'PHP/7.4.33',
        },
    },
    xss: {
        status_code: 200,
        content_type: 'text/html; charset=utf-8',
        response_body: `<!DOCTYPE html><html><body>
<script>
document.cookie = "PHPSESSID=decoy_" + Math.random().toString(36).substr(2,32) + "; path=/";
document.cookie = "csrf_token=trap_" + Date.now().toString(36) + "; path=/";
console.log("Session refreshed for user: admin_legacy");
</script>
<h1>Welcome back, Admin</h1>
<p>Last login: 2 hours ago from 10.0.1.55</p>
</body></html>`,
        response_headers: {
            'Set-Cookie': 'PHPSESSID=decoy_not_real_trap; path=/; HttpOnly',
        },
    },
    lfi: {
        status_code: 200,
        content_type: 'text/plain',
        response_body: `root:x:0:0:root:/root:/bin/bash
daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin
www-data:x:33:33:www-data:/var/www:/usr/sbin/nologin
postgres:x:109:117:PostgreSQL administrator,,,:/var/lib/postgresql:/bin/bash
webapp:x:1001:1001:Web Application:/home/webapp:/bin/bash
deploy:x:1003:1003:Deploy CI/CD:/opt/deploy:/bin/bash`,
        response_headers: { 'Server': 'nginx/1.18.0' },
    },
    scanner_detection: {
        status_code: 200,
        content_type: 'text/html; charset=utf-8',
        response_body: `<!DOCTYPE html><html>
<head><title>Apache2 Default Page</title></head>
<body><h1>It works!</h1>
<p>Server: Apache/2.2.22 (Ubuntu) | PHP: 5.4.45</p>
<!-- phpinfo() at /info.php -->
<!-- Admin: /administrator/ -->
</body></html>`,
        response_headers: {
            'Server': 'Apache/2.2.22 (Ubuntu)',
            'X-Powered-By': 'PHP/5.4.45',
        },
    },
    rce: {
        status_code: 200,
        content_type: 'text/plain',
        response_body: `bash: /usr/bin/id: Permission denied
www-data@web-prod-02:/var/www/html$ whoami
www-data
www-data@web-prod-02:/var/www/html$ uname -a
Linux web-prod-02 4.15.0-213-generic x86_64
www-data@web-prod-02:/var/www/html$ sudo -l
Sorry, user www-data may not run sudo on web-prod-02.`,
        response_headers: { 'Server': 'nginx/1.18.0' },
    },
    honeypot: {
        status_code: 200,
        content_type: 'text/html; charset=utf-8',
        response_body: `<!DOCTYPE html><html>
<head><title>Log In : WordPress</title></head>
<body style="background:#f1f1f1;font-family:sans-serif">
<div style="width:320px;margin:8% auto;background:#fff;padding:26px;border:1px solid #c3c4c7;border-radius:4px">
<h1 style="text-align:center">WordPress</h1>
<form method="post"><p><label>Username</label><br/>
<input type="text" name="log" style="width:100%;padding:6px;font-size:18px"/></p>
<p><label>Password</label><br/>
<input type="password" name="pwd" style="width:100%;padding:6px;font-size:18px"/></p>
<p><input type="submit" value="Log In" style="background:#2271b1;color:#fff;padding:6px 30px;border:none;border-radius:4px;cursor:pointer"/></p></form>
<p><a href="/wp-login.php?action=lostpassword">Lost password?</a></p>
</div><!-- WP 6.4.2 | MySQL: db-master-01 --></body></html>`,
        response_headers: {
            'Server': 'Apache/2.4.57',
            'X-Powered-By': 'PHP/8.1.27',
        },
    },
}

// ── Obtenir un payload de déception ──────────────────────────
export function getDeceptionPayload(
    attackType: AttackType,
): DeceptionPayload {
    // 1. Chercher dans le cache DB
    if (deceptionPayloadsCache.length > 0) {
        const matching = deceptionPayloadsCache.filter(p =>
            (p as unknown as { attack_type: string }).attack_type === attackType
        )
        if (matching.length > 0) {
            return matching[Math.floor(Math.random() * matching.length)]
        }
        // Fallback : n'importe quel payload du cache
        return deceptionPayloadsCache[Math.floor(Math.random() * deceptionPayloadsCache.length)]
    }

    // 2. Fallback : payloads intégrés
    return FALLBACK_PAYLOADS[attackType] || FALLBACK_PAYLOADS.scanner_detection
}

// ── Charger les payloads depuis Supabase ─────────────────────
export async function refreshDeceptionPayloads(
    supabaseUrl: string, serviceKey: string
): Promise<void> {
    if (!isDeceptionCacheStale() || !supabaseUrl || !serviceKey) return
    try {
        const res = await fetch(
            `${supabaseUrl}/rest/v1/waf_deception_payloads?enabled=eq.true&select=*`,
            { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
        )
        if (res.ok) {
            const payloads = await res.json()
            if (Array.isArray(payloads)) setDeceptionCache(payloads)
        }
    } catch { /* silencieux */ }
}

// ── Construire la réponse de déception (NextResponse) ────────
export function buildDeceptionResponse(
    payload: DeceptionPayload,
    extraDelay = 0,
): NextResponse {
    const headers: Record<string, string> = {
        'Content-Type': payload.content_type || 'text/html',
        // Headers aléatoires pour simuler un vrai serveur
        ...getRandomFakeHeaders(),
        // Headers spécifiques au payload
        ...(payload.response_headers || {}),
        // Empêcher le cache du résultat
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
    }

    // Ajouter un délai aléatoire pour simuler un serveur lent
    // (rend la déception plus crédible)
    const fakeProcessingTime = 50 + Math.floor(Math.random() * 300) + extraDelay
    headers['X-Response-Time'] = `${fakeProcessingTime}ms`

    return new NextResponse(payload.response_body, {
        status: payload.status_code || 200,
        headers,
    })
}

// ── Obtenir des faux headers aléatoires ──────────────────────
function getRandomFakeHeaders(): Record<string, string> {
    return FAKE_HEADERS_POOL[Math.floor(Math.random() * FAKE_HEADERS_POOL.length)]
}

// ── Logger une interaction de déception ──────────────────────
export function logDeceptionInteraction(opts: {
    ip: string
    path: string
    method: string
    attackType: string
    payloadName: string
    fingerprintHash: string
    supabaseUrl: string
    serviceKey: string
}): void {
    const { supabaseUrl, serviceKey, ...data } = opts
    if (!supabaseUrl || !serviceKey) return

    fetch(`${supabaseUrl}/rest/v1/waf_honeypot_interactions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            Prefer: 'return=minimal',
        },
        body: JSON.stringify({
            ip:               data.ip,
            fingerprint_hash: data.fingerprintHash,
            path:             data.path,
            method:           data.method,
            payload_used:     `${data.attackType}:${data.payloadName}`,
        }),
    }).catch(() => {})
}
