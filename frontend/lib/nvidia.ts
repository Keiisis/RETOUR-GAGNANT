const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions'

export interface NvidiaMessage {
    role: 'system' | 'user' | 'assistant'
    content: string
}

export interface NvidiaPayload {
    model?: string
    messages: NvidiaMessage[]
    max_tokens?: number
    temperature?: number
    top_p?: number
    stream?: boolean
    enable_thinking?: boolean
}

export async function fetchGemma(payload: NvidiaPayload): Promise<Response> {
    const apiKey = process.env.NVIDIA_API_KEY
    if (!apiKey) throw new Error('NVIDIA_API_KEY manquante')

    // enable_thinking=false par défaut — thinking mode multiplie le temps par 5-10x → 504
    const { enable_thinking = false, stream = true, ...rest } = payload

    return fetch(NVIDIA_API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Accept': stream ? 'text/event-stream' : 'application/json',
        },
        body: JSON.stringify({
            model: 'google/gemma-4-31b-it',
            max_tokens: 2048,        // 16384 → 2048 : premier token arrive 8x plus vite
            temperature: 0.7,
            top_p: 0.9,
            stream,
            chat_template_kwargs: { enable_thinking },
            ...rest,
        }),
    })
}

export async function getGemmaText(messages: NvidiaMessage[], systemPrompt?: string): Promise<string> {
    const msgs: NvidiaMessage[] = systemPrompt
        ? [{ role: 'system', content: systemPrompt }, ...messages]
        : messages

    const res = await fetchGemma({ messages: msgs, stream: false })
    if (!res.ok) {
        const err = await res.text()
        throw new Error(`NVIDIA API error ${res.status}: ${err}`)
    }
    const data = await res.json()
    return data.choices?.[0]?.message?.content?.trim() || ''
}
