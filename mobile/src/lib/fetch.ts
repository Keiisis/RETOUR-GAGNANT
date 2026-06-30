/**
 * fetchWithTimeout — wraps fetch with an AbortController so requests can't hang forever.
 *
 * On unreliable mobile networks (or when EXPO_PUBLIC_API_URL points to a host
 * that no longer exists, e.g. a stale dev IP), a plain `fetch()` will keep the
 * UI spinning indefinitely. This helper bounds every request to a max duration.
 *
 * Throws an Error with `name === 'AbortError'` on timeout.
 */
export async function fetchWithTimeout(
    input: string,
    init?: RequestInit & { timeoutMs?: number }
): Promise<Response> {
    const { timeoutMs = 10000, ...rest } = init || {}
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
        return await fetch(input, { ...rest, signal: controller.signal })
    } finally {
        clearTimeout(timer)
    }
}
