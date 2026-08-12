// ═══════════════════════════════════════════════════════
// Translation Engine : Constants & Language Config
// ═══════════════════════════════════════════════════════

export type LangCode = 'fr' | 'en' | 'es' | 'pt' | 'cr' | 'ht'

export interface LangConfig {
    code: LangCode
    label: string
    nativeLabel: string
    flag: string
    groqName: string
    promptHint?: string // Extra instruction for the AI when translating to this language
}

export const SUPPORTED_LANGUAGES: LangConfig[] = [
    { code: 'fr', label: 'Français', nativeLabel: 'Français', flag: '🇫🇷', groqName: 'French' },
    { code: 'en', label: 'Anglais', nativeLabel: 'English', flag: '🇬🇧', groqName: 'English' },
    { code: 'es', label: 'Espagnol', nativeLabel: 'Español', flag: '🇪🇸', groqName: 'Spanish' },
    { code: 'pt', label: 'Portugais', nativeLabel: 'Português', flag: '🇧🇷', groqName: 'Portuguese (Brazilian)' },
    { code: 'cr', label: 'Créole', nativeLabel: 'Kréyòl', flag: '🇬🇵', groqName: 'Antillean Creole French', promptHint: 'This is Kréyòl (Antillean Creole spoken in Guadeloupe, Martinique, and the French Caribbean). Use authentic Creole expressions. Example: "Bonjour" → "Bonjou", "Comment allez-vous ?" → "Ka ou fè ?", "Merci" → "Mèsi", "Bienvenue" → "Byenvini".' },
    { code: 'ht', label: 'Créole Haïtien', nativeLabel: 'Kreyòl Ayisyen', flag: '🇭🇹', groqName: 'Haitian Creole', promptHint: 'This is Kreyòl Ayisyen (Haitian Creole). Use authentic Haitian Creole. Example: "Bonjour" → "Bonjou", "Comment allez-vous ?" → "Kijan ou ye ?", "Merci" → "Mèsi", "Bienvenue" → "Byenvini", "Je suis" → "Mwen se".' },
]

export const DEFAULT_LANG: LangCode = 'fr'
export const LANG_COOKIE_NAME = 'rg_lang'
export const DASHBOARD_LANG_COOKIE = 'rg_dashboard_lang'
export const TRANSLATION_BATCH_SIZE = 20

export const getLangConfig = (code: LangCode): LangConfig =>
    SUPPORTED_LANGUAGES.find(l => l.code === code) || SUPPORTED_LANGUAGES[0]

export const isValidLang = (code: string): code is LangCode =>
    SUPPORTED_LANGUAGES.some(l => l.code === code)
