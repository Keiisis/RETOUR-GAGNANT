// ═══════════════════════════════════════════════════════
// Translation Engine — Constants & Language Config
// ═══════════════════════════════════════════════════════

export type LangCode = 'fr' | 'en' | 'es' | 'pt' | 'cr' | 'ht'

export interface LangConfig {
    code: LangCode
    label: string
    nativeLabel: string
    flag: string
    groqName: string
}

export const SUPPORTED_LANGUAGES: LangConfig[] = [
    { code: 'fr', label: 'Français', nativeLabel: 'Français', flag: '🇫🇷', groqName: 'French' },
    { code: 'en', label: 'Anglais', nativeLabel: 'English', flag: '🇬🇧', groqName: 'English' },
    { code: 'es', label: 'Espagnol', nativeLabel: 'Español', flag: '🇪🇸', groqName: 'Spanish' },
    { code: 'pt', label: 'Portugais', nativeLabel: 'Português', flag: '🇧🇷', groqName: 'Portuguese (Brazilian)' },
    { code: 'cr', label: 'Créole', nativeLabel: 'Kréyòl', flag: '🇬🇵', groqName: 'Guadeloupean Creole (Antillean Creole)' },
    { code: 'ht', label: 'Créole Haïtien', nativeLabel: 'Kreyòl Ayisyen', flag: '🇭🇹', groqName: 'Haitian Creole' },
]

export const DEFAULT_LANG: LangCode = 'fr'
export const LANG_COOKIE_NAME = 'rg_lang'
export const DASHBOARD_LANG_COOKIE = 'rg_dashboard_lang'
export const TRANSLATION_BATCH_SIZE = 20

export const getLangConfig = (code: LangCode): LangConfig =>
    SUPPORTED_LANGUAGES.find(l => l.code === code) || SUPPORTED_LANGUAGES[0]

export const isValidLang = (code: string): code is LangCode =>
    SUPPORTED_LANGUAGES.some(l => l.code === code)
