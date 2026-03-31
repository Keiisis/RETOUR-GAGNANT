// ═══════════════════════════════════════════════════════
// Translation Engine — Simple hash utility
// ═══════════════════════════════════════════════════════

export const hashText = (text: string): string => {
    // Simple djb2 hash — fast, deterministic, no external deps
    let hash = 5381
    for (let i = 0; i < text.length; i++) {
        hash = ((hash << 5) + hash) + text.charCodeAt(i)
        hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36)
}
