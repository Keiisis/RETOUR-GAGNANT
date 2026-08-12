// ══════════════════════════════════════════════════════════════
// 💀 lib/waf/rce.ts : Remote Code Execution Detection
// ══════════════════════════════════════════════════════════════
//
// Détecte les tentatives d'exécution de code à distance via :
// - Désérialisation malveillante (Java, Python, PHP, Node.js)
// - Injection de commandes shell
// - Template injection (SSTI)
// - Expression Language injection (EL/OGNL/SpEL)
//
// Usage : scanForRCE(path, queryString, body?)
// ══════════════════════════════════════════════════════════════

export interface RCEResult {
    detected: boolean
    confidence: number         // 0-100
    pattern: string
    category: RCECategory
    detail: string
}

export type RCECategory =
    | 'java_deserialization'
    | 'python_deserialization'
    | 'php_deserialization'
    | 'nodejs_injection'
    | 'shell_injection'
    | 'template_injection'
    | 'expression_language'

// ── Java Deserialization (confidence 95-100) ─────────────────
const JAVA_PATTERNS: Array<{ regex: RegExp; label: string; confidence: number }> = [
    // Signatures binaires Java sérialisés
    { regex: /rO0AB/i, label: 'Java serialized base64', confidence: 100 },
    { regex: /aced0005/i, label: 'Java serialized hex (magic bytes)', confidence: 100 },
    { regex: /ObjectInputStream/i, label: 'ObjectInputStream reference', confidence: 90 },
    // Gadget chains connues (ysoserial)
    { regex: /(?:CommonsCollections|CommonsBeanutils|Spring|JBoss|Hibernate)\d*/i, label: 'Gadget chain class', confidence: 95 },
    { regex: /java\.lang\.Runtime/i, label: 'Runtime reference', confidence: 95 },
    { regex: /ProcessBuilder/i, label: 'ProcessBuilder', confidence: 90 },
    { regex: /java\.lang\.reflect/i, label: 'Reflection API', confidence: 80 },
    // JNDI injection (Log4Shell style)
    { regex: /\$\{jndi:/i, label: 'JNDI injection (Log4Shell)', confidence: 100 },
    { regex: /\$\{(?:lower|upper|env|sys|java|main):/i, label: 'Log4j lookup', confidence: 95 },
]

// ── Python Deserialization (confidence 90-100) ───────────────
const PYTHON_PATTERNS: Array<{ regex: RegExp; label: string; confidence: number }> = [
    { regex: /pickle\.loads/i, label: 'pickle.loads', confidence: 95 },
    { regex: /__reduce__/i, label: '__reduce__ (pickle exploit)', confidence: 100 },
    { regex: /__import__\s*\(/i, label: '__import__()', confidence: 95 },
    { regex: /os\.(?:system|popen|exec[lv]?[pe]?)\s*\(/i, label: 'os.system/popen', confidence: 95 },
    { regex: /subprocess\.(?:call|run|Popen|check_output)\s*\(/i, label: 'subprocess', confidence: 95 },
    { regex: /exec\s*\(\s*compile/i, label: 'exec(compile(...))', confidence: 90 },
    { regex: /yaml\.(?:unsafe_)?load\s*\(/i, label: 'YAML unsafe load', confidence: 85 },
    { regex: /marshal\.loads/i, label: 'marshal.loads', confidence: 90 },
]

// ── PHP Deserialization (confidence 90-100) ──────────────────
const PHP_PATTERNS: Array<{ regex: RegExp; label: string; confidence: number }> = [
    // Objets sérialisés PHP (O:4:"User":...)
    { regex: /O:\d+:"[^"]+":(\d+):\{/i, label: 'PHP serialized object', confidence: 95 },
    { regex: /unserialize\s*\(/i, label: 'unserialize()', confidence: 95 },
    { regex: /phar:\/\//i, label: 'phar:// stream wrapper', confidence: 100 },
    { regex: /__(?:wakeup|destruct|toString|call)\b/i, label: 'PHP magic method', confidence: 85 },
    { regex: /system\s*\(\s*\$_(?:GET|POST|REQUEST|COOKIE)/i, label: 'system() with user input', confidence: 100 },
    { regex: /eval\s*\(\s*(?:base64_decode|gzinflate|str_rot13)/i, label: 'eval(encoded)', confidence: 100 },
    { regex: /assert\s*\(\s*\$/i, label: 'assert() with variable', confidence: 90 },
    { regex: /preg_replace\s*\(.*\/e/i, label: 'preg_replace /e modifier', confidence: 95 },
]

// ── Node.js Injection (confidence 85-100) ────────────────────
const NODEJS_PATTERNS: Array<{ regex: RegExp; label: string; confidence: number }> = [
    { regex: /require\s*\(\s*['"]child_process['"]\s*\)/i, label: 'require(child_process)', confidence: 100 },
    { regex: /child_process/i, label: 'child_process reference', confidence: 85 },
    { regex: /(?:^|[^a-z])eval\s*\(\s*(?:req\.|process\.|Buffer)/i, label: 'eval() with runtime object', confidence: 95 },
    { regex: /Function\s*\(\s*['"`].*(?:return|process|require)/i, label: 'new Function() with code', confidence: 90 },
    { regex: /vm\.(?:runInNewContext|createScript|compileFunction)/i, label: 'vm module eval', confidence: 90 },
    { regex: /process\.(?:exit|kill|binding|dlopen)/i, label: 'process dangerous method', confidence: 85 },
    { regex: /\.constructor\s*\(\s*['"]return\s+this['"]\s*\)\s*\(\)/i, label: 'constructor sandbox escape', confidence: 95 },
]

// ── Shell Injection (confidence 80-95) ──────────────────────
const SHELL_PATTERNS: Array<{ regex: RegExp; label: string; confidence: number }> = [
    { regex: /;\s*(?:cat|ls|id|whoami|uname|pwd|wget|curl)\b/i, label: 'Shell command after semicolon', confidence: 90 },
    { regex: /\|\s*(?:cat|base64|nc|ncat|bash|sh|zsh)\b/i, label: 'Pipe to shell command', confidence: 90 },
    { regex: /`[^`]*(?:cat|ls|id|whoami|wget|curl)[^`]*`/i, label: 'Backtick command execution', confidence: 90 },
    { regex: /\$\([^)]*(?:cat|ls|id|whoami|wget|curl)[^)]*\)/i, label: '$(command) execution', confidence: 90 },
    { regex: /\/(?:bin|usr\/bin|usr\/sbin)\/(?:sh|bash|dash|zsh|csh|ksh|fish)/i, label: 'Shell path', confidence: 85 },
    { regex: /cmd(?:\.exe)?\s*\/[ck]\b/i, label: 'cmd.exe /c', confidence: 90 },
    { regex: /powershell(?:\.exe)?\s*(?:-[cefw]|-enc|-nop)/i, label: 'PowerShell execution', confidence: 95 },
    // Redirection + fichiers sensibles
    { regex: />\s*\/etc\/(?:passwd|shadow|crontab)/i, label: 'Write to /etc/', confidence: 95 },
    { regex: /&&\s*(?:rm|chmod|chown|kill|reboot|shutdown)/i, label: 'Destructive command chain', confidence: 95 },
]

// ── Template Injection / SSTI (confidence 85-95) ─────────────
const SSTI_PATTERNS: Array<{ regex: RegExp; label: string; confidence: number }> = [
    // Jinja2 / Twig / Django
    { regex: /\{\{\s*[0-9]+\s*\*\s*[0-9]+\s*\}\}/i, label: 'SSTI probe (math eval)', confidence: 85 },
    { regex: /\{\{.*(?:__class__|__mro__|__subclasses__|__globals__|__builtins__)/i, label: 'Python SSTI gadget', confidence: 100 },
    { regex: /\{%\s*(?:import|include|extends)\s/i, label: 'Jinja2 template tag', confidence: 85 },
    // Freemarker
    { regex: /<#assign\s/i, label: 'Freemarker assign', confidence: 90 },
    { regex: /\$\{.*?\.getClass\(\)/i, label: 'Java SSTI getClass()', confidence: 95 },
    // Expression Language (Java EL, OGNL, SpEL)
    { regex: /\$\{T\s*\(\s*java\.lang/i, label: 'SpEL injection', confidence: 95 },
    { regex: /#\{.*?runtime/i, label: 'EL runtime access', confidence: 90 },
    { regex: /@java\.lang\.Runtime@getRuntime/i, label: 'OGNL runtime injection', confidence: 100 },
]

/**
 * Scanne une requête pour détecter les tentatives RCE
 */
export function scanForRCE(
    path: string,
    queryString: string,
    body?: string
): RCEResult {
    const surfaces = [path, queryString, body || ''].join(' ')
    if (!surfaces || surfaces.length < 4) {
        return { detected: false, confidence: 0, pattern: '', category: 'shell_injection', detail: '' }
    }

    // Décoder les couches d'encodage
    const decoded = decodeMultiLayer(surfaces)

    // Tester toutes les catégories par ordre de criticité
    const categories: Array<{ patterns: typeof JAVA_PATTERNS; category: RCECategory }> = [
        { patterns: JAVA_PATTERNS, category: 'java_deserialization' },
        { patterns: PYTHON_PATTERNS, category: 'python_deserialization' },
        { patterns: PHP_PATTERNS, category: 'php_deserialization' },
        { patterns: NODEJS_PATTERNS, category: 'nodejs_injection' },
        { patterns: SHELL_PATTERNS, category: 'shell_injection' },
        { patterns: SSTI_PATTERNS, category: 'template_injection' },
    ]

    let bestMatch: RCEResult | null = null

    for (const { patterns, category } of categories) {
        for (const p of patterns) {
            if (p.regex.test(decoded) || p.regex.test(surfaces)) {
                if (!bestMatch || p.confidence > bestMatch.confidence) {
                    bestMatch = {
                        detected: true,
                        confidence: p.confidence,
                        pattern: p.label,
                        category,
                        detail: `RCE [${category}]: ${p.label} détecté`,
                    }
                }
                // Si confiance maximale, pas besoin de continuer
                if (p.confidence >= 100) return bestMatch
            }
        }
    }

    return bestMatch || { detected: false, confidence: 0, pattern: '', category: 'shell_injection', detail: '' }
}

/**
 * Décode plusieurs couches d'URL encoding + base64
 */
function decodeMultiLayer(input: string): string {
    let result = input

    // URL decode (3 passes max)
    for (let i = 0; i < 3; i++) {
        try {
            const decoded = decodeURIComponent(result)
            if (decoded === result) break
            result = decoded
        } catch { break }
    }

    // Tenter decode base64 si le contenu ressemble à du base64
    const b64match = result.match(/(?:^|[=&])(?:data|cmd|exec|payload|code)=([A-Za-z0-9+/]{20,}={0,2})/)
    if (b64match) {
        try {
            const decoded = Buffer.from(b64match[1], 'base64').toString('utf-8')
            if (decoded && /[\x20-\x7E]/.test(decoded)) {
                result = result + ' ' + decoded
            }
        } catch { /* pas du base64 valide */ }
    }

    return result
}
