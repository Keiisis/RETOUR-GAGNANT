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

export const GROQ_KEYS = [
    process.env.GROQ_API_KEY_1,
    process.env.GROQ_API_KEY_2,
    process.env.GROQ_API_KEY_3,
    process.env.GROQ_API_KEY
].filter(Boolean) as string[];

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

            if (res.status === 429) {
                console.warn(`[Groq] 429 Rate Limit hit using key ending with ...${apiKey.slice(-5)}.`);

                if (usedCustomKey && attempts === 0) {
                    console.warn(`[Groq] Custom API key from DB was rate limited. Falling back to system pool.`);
                } else {
                    console.warn(`[Groq] Rotating system key...`);
                    rotateGroqApiKey();
                }

                // backoff for 1s just to be safe before hitting the new key
                await new Promise(r => setTimeout(r, 1000));
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

            if (res.status === 429) {
                console.warn(`[Groq AI SDK] 429 Rate Limit hit using key ending with ...${apiKey.slice(-5)}.`);
                rotateGroqApiKey();
                await new Promise(r => setTimeout(r, 1000));
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
