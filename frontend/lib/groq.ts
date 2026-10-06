// ══════════════════════════════════════════════════════════════
//  MODÈLES GROQ — source unique.
//
//  `llama-3.3-70b-versatile` a été RETIRÉ par Groq : toute génération
//  répondait « model_not_found » (404). Le nom était recopié dans 21 fichiers,
//  donc une seule dépréciation cassait l'IA partout à la fois. Il vit
//  désormais ici : le jour où Groq retire encore un modèle, une seule ligne
//  change.
//
//  Vérifié le 2026-08-18 auprès de GET /openai/v1/models avec les clés du
//  projet : ces deux identifiants répondent bien 200.
// ══════════════════════════════════════════════════════════════

/** Raisonnement, rédaction, génération de propositions. */
export const GROQ_MODEL = 'openai/gpt-oss-120b'

/** Tâches courtes et fréquentes (détection de langue, classement, traduction) :
 *  même famille, plus rapide et moins coûteuse. */
export const GROQ_MODEL_FAST = 'openai/gpt-oss-20b'

/* Toutes les clés GROQ_API_KEY_<n> présentes (puis GROQ_API_KEY). La liste
   figée _1.._3 ignorait les clés ajoutées ensuite (_4.._6). */
export const GROQ_KEYS = [
    // références explicites : présentes même là où process.env ne s'énumère pas (edge)
    process.env.GROQ_API_KEY_1, process.env.GROQ_API_KEY_2, process.env.GROQ_API_KEY_3,
    process.env.GROQ_API_KEY_4, process.env.GROQ_API_KEY_5, process.env.GROQ_API_KEY_6,
    ...Object.keys(process.env).filter(k => /^GROQ_API_KEY_\d+$/.test(k))
        .sort((a, b) => Number(a.split('_').pop()) - Number(b.split('_').pop()))
        .map(k => process.env[k]),
    process.env.GROQ_API_KEY,
].filter((k, i, t): k is string => !!k && t.indexOf(k) === i);

/* Refus propre À LA CLÉ (et non à la requête) : on passe à la suivante.
   Constat du 06/10/2026 : la clé n°1 répondait 400 « Organization has been
   restricted » ; seule l'erreur 429 faisait tourner les clés, donc TOUTE
   l'IA du site (traductions comprises) échouait sur cette première clé. */
async function refusDeLaCle(res: Response): Promise<boolean> {
    if ([401, 403, 429].includes(res.status) || res.status >= 500) return true
    if (res.status !== 400) return false
    const corps = await res.clone().text().catch(() => '')
    return /restricted|organization|invalid_api_key|api key/i.test(corps)
}

let currentKeyIndex = 0;

export function getGroqApiKey(): string {
    if (GROQ_KEYS.length === 0) {
        throw new Error("Missing Groq API keys in environment variables");
    }
    return GROQ_KEYS[currentKeyIndex];
}

export function rotateGroqApiKey(): string {
    if (GROQ_KEYS.length <= 1) return getGroqApiKey();
    currentKeyIndex = (currentKeyIndex + 1) % GROQ_KEYS.length;
    console.warn(`[Groq] Rotated API Key to index ${currentKeyIndex}`);
    return GROQ_KEYS[currentKeyIndex];
}

/**
 * Wrapper for fetch API pointing to Groq's completions endpoint.
 * Automatically rotates API keys on HTTP 429 Rate Limit Exceeded.
 * 
 * @param payload The JSON payload to send to Groq
 * @param customApiKey An optional preferred API key to try first (e.g. from DB config)
 */
export async function fetchWithGroqRotation(payload: Record<string, unknown>, customApiKey?: string, maxRetries: number = GROQ_KEYS.length + 1): Promise<Response> {
    let usedCustomKey = false;

    for (let attempts = 0; attempts < maxRetries; attempts++) {
        // Use custom key on first attempt if provided, otherwise grab from the pool
        const apiKey = (attempts === 0 && customApiKey) ? customApiKey : getGroqApiKey();

        if (attempts === 0 && customApiKey) {
            usedCustomKey = true;
        }

        try {
            const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (attempts < maxRetries - 1 && await refusDeLaCle(res)) {
                console.warn(`[Groq] ${res.status} avec la clé ...${apiKey.slice(-5)} : clé suivante.`);

                if (usedCustomKey && attempts === 0) {
                    console.warn(`[Groq] Custom API key from DB was refused. Falling back to system pool.`);
                } else {
                    rotateGroqApiKey();
                }

                // backoff court (plus long sur limite de débit) avant la clé suivante
                await new Promise(r => setTimeout(r, res.status === 429 ? 1000 : 150));
                continue;
            }

            return res;
        } catch (error) {
            console.error("[Groq] Fetch network error:", error);
            if (attempts === maxRetries - 1) throw error;
        }
    }

    throw new Error("All Groq API keys exhausted or rate limited.");
}

/**
 * Standard fetch replacement for use with @ai-sdk/groq to provide auto-rotation.
 * Pass this as the `fetch` option in `createGroq({ fetch: customGroqFetch })`.
 */
export async function customGroqFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const maxRetries = GROQ_KEYS.length + 1;

    for (let attempts = 0; attempts < maxRetries; attempts++) {
        const apiKey = getGroqApiKey();

        const currentInit = { ...init };
        const headers = new Headers(currentInit.headers);
        headers.set('Authorization', `Bearer ${apiKey}`);
        currentInit.headers = headers;

        try {
            const res = await fetch(input, currentInit);

            if (attempts < maxRetries - 1 && await refusDeLaCle(res)) {
                console.warn(`[Groq AI SDK] ${res.status} avec la clé ...${apiKey.slice(-5)} : clé suivante.`);
                rotateGroqApiKey();
                await new Promise(r => setTimeout(r, res.status === 429 ? 1000 : 150));
                continue;
            }

            return res;
        } catch (error) {
            console.error("[Groq AI SDK] Fetch network error:", error);
            if (attempts === maxRetries - 1) throw error;
        }
    }

    throw new Error("All Groq API keys exhausted or rate limited in AI SDK.");
}
