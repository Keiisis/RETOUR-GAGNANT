// ══════════════════════════════════════════════════════════════
// 📋 WAF RULES : Jeu de règles complet inspiré OWASP CRS 4.x
// 500+ patterns organisés par catégorie, avec scoring de sévérité
// IDs alignés sur la numérotation ModSecurity OWASP CRS
//
// ⚠️  CIBLAGE STRICT :
//   - SQL rules → ['query','body','cookie','referer'] ou ['dataDecoded']
//              → JAMAIS urlPath (évite faux positifs /admin/xxx/create)
//   - XSS/LFI/RCE → ['allDecoded'] (inclut urlPath, pas de faux positifs)
//   - 'urlPath'   → LFI traversal, scanner patterns, exécutables
//   - 'allDecoded' → règles nécessitant toutes les parties sauf ciblage SQL
// ══════════════════════════════════════════════════════════════

export type Severity    = 1 | 2 | 3 | 4 | 5  // 1=CRITICAL 5=NOTICE
export type RuleTarget  =
    | 'urlPath'      // chemin URL seul (/admin/events/create)
    | 'query'        // query string
    | 'body'         // corps de la requête
    | 'userAgent'    // User-Agent header
    | 'referer'      // Referer header
    | 'cookie'       // cookies
    | 'dataDecoded'  // query+body+cookie+referer (SANS urlPath) ← SQL rules
    | 'allDecoded'   // tout y compris urlPath (XSS, LFI, RCE)

export type RuleCategory =
    | 'sql_injection'
    | 'xss'
    | 'lfi'
    | 'rfi'
    | 'rce'
    | 'php_injection'
    | 'nodejs_injection'
    | 'protocol_violation'
    | 'scanner_detection'
    | 'data_leakage'
    | 'session_fixation'
    | 'http_smuggling'
    | 'command_injection'
    | 'ssrf'
    | 'xxe'
    | 'honeypot'
    | 'enumeration'
    | 'custom_rule'

export interface WafRule {
    id:          number
    category:    RuleCategory
    description: string
    pattern:     RegExp
    severity:    Severity
    targets:     RuleTarget[]
    paranoia:    1 | 2 | 3 | 4   // niveau requis pour activer (1=tous, 4=strict)
}

// ── Cibles pré-définies ───────────────────────────────────────
const DATA_TARGETS: RuleTarget[] = ['query', 'body', 'cookie', 'referer']
const DATA_DECODED: RuleTarget[] = ['dataDecoded']
const PATH_AND_DATA: RuleTarget[] = ['urlPath', 'query', 'body']
const ALL_DECODED: RuleTarget[] = ['allDecoded']
const URL_ONLY: RuleTarget[] = ['urlPath']
const QUERY_BODY: RuleTarget[] = ['query', 'body']
const UA_ONLY: RuleTarget[] = ['userAgent']

// ══════════════════════════════════════════════════════════════
// 942xxx : SQL INJECTION
// Ciblage STRICT : jamais urlPath → évite faux positifs /create /update
// ══════════════════════════════════════════════════════════════
const SQL_RULES: WafRule[] = [
    {
        id: 942100, category: 'sql_injection', severity: 2,
        description: 'SQL Injection: mots-clés DML+clause',
        pattern: /(\b(?:union|select|insert|update|delete|drop|create|alter|exec|execute|truncate|replace|merge)\b\s+\b(?:all|distinct|from|into|where|set|table|database|schema)\b)/i,
        targets: DATA_TARGETS, paranoia: 1,
    },
    {
        id: 942110, category: 'sql_injection', severity: 2,
        description: 'SQL Injection: opérateurs booléens',
        pattern: /(\b(?:and|or|not)\b\s+(?:\d+\s*[=<>!]+\s*\d+|'[^']*'\s*=\s*'[^']*'|\d+\s*(?:between|in)\s*\(?))/i,
        targets: DATA_TARGETS, paranoia: 1,
    },
    {
        id: 942120, category: 'sql_injection', severity: 2,
        description: 'SQL Injection: opérateurs de comparaison',
        pattern: /(['"]\s*(?:=|!=|<>|>|<|>=|<=)\s*['"0-9]|[0-9]\s*(?:=|!=|<>)\s*[0-9])/i,
        targets: QUERY_BODY, paranoia: 1,
    },
    {
        id: 942130, category: 'sql_injection', severity: 2,
        description: 'SQL Tautologie (1=1, etc.)',
        pattern: /('|\b\d)\s*=\s*('|\d\b)|\bor\b\s+\d+\s*=\s*\d+|\band\b\s+\d+\s*=\s*\d+/i,
        targets: DATA_TARGETS, paranoia: 1,
    },
    {
        id: 942140, category: 'sql_injection', severity: 1,
        description: 'SQL UNION SELECT injection',
        pattern: /\bunion\b[\s\w]*\bselect\b/i,
        targets: DATA_DECODED, paranoia: 1,
    },
    {
        id: 942150, category: 'sql_injection', severity: 2,
        description: 'SQL Injection: fonctions sensibles (sleep/benchmark/load_file)',
        pattern: /\b(?:sleep|benchmark|pg_sleep|waitfor\s+delay|load_file|outfile|dumpfile|information_schema|sys\.objects|xp_cmdshell|sp_executesql|openrowset|opendatasource)\b/i,
        targets: DATA_DECODED, paranoia: 1,
    },
    {
        id: 942160, category: 'sql_injection', severity: 2,
        description: 'SQL blind injection (SLEEP/BENCHMARK)',
        pattern: /(?:sleep\s*\(\s*\d+|benchmark\s*\(\s*\d+|pg_sleep\s*\(\s*\d+|waitfor\s+delay\s+['"])/i,
        targets: DATA_DECODED, paranoia: 1,
    },
    {
        id: 942170, category: 'sql_injection', severity: 2,
        description: 'SQL stacked queries (;)',
        pattern: /;\s*(?:select|insert|update|delete|drop|create|alter|exec)/i,
        targets: QUERY_BODY, paranoia: 1,
    },
    {
        id: 942180, category: 'sql_injection', severity: 3,
        description: 'SQL commentaires inline --',
        pattern: /--\s*(?:[^\r\n]*)$|\/\*[^*]*\*+(?:[^/*][^*]*\*+)*\//m,
        targets: DATA_TARGETS, paranoia: 2,
    },
    {
        id: 942190, category: 'sql_injection', severity: 2,
        description: 'SQL fonctions information_schema / systables',
        pattern: /\b(?:information_schema|schema_name|table_name|column_name|table_schema|sys\.tables|sys\.columns|sysobjects|syscolumns)\b/i,
        targets: DATA_DECODED, paranoia: 1,
    },
    {
        id: 942200, category: 'sql_injection', severity: 2,
        description: 'MySQL injection obfusquée /*!',
        pattern: /\/\*!\s*(?:select|union|insert|update|delete|drop)\b/i,
        targets: DATA_DECODED, paranoia: 1,
    },
    {
        id: 942210, category: 'sql_injection', severity: 2,
        description: 'SQL Injection: chaînes concaténées',
        pattern: /(?:'[^']*'+[^']*'|"[^"]*"+"[^"]*")/i,
        targets: QUERY_BODY, paranoia: 2,
    },
    {
        id: 942220, category: 'sql_injection', severity: 2,
        description: 'SQL overflow/integer injection (EXP/EXTRACTVALUE)',
        pattern: /\b(?:exp\s*\(\s*~|pow\s*\(\s*\(|extractvalue\s*\(|updatexml\s*\(|floor\s*\(\s*rand)\b/i,
        targets: DATA_DECODED, paranoia: 1,
    },
    {
        id: 942230, category: 'sql_injection', severity: 2,
        description: 'SQL conditionals (CASE WHEN / IF)',
        pattern: /\b(?:case\s+when|if\s*\(|ifnull\s*\(|nullif\s*\(|iif\s*\(|coalesce\s*\()\b/i,
        targets: QUERY_BODY, paranoia: 2,
    },
    {
        id: 942240, category: 'sql_injection', severity: 2,
        description: 'SQL CONVERT/CAST/CHAR injection',
        pattern: /\b(?:convert\s*\(|cast\s*\(|char\s*\(|nchar\s*\(|varchar\s*\(|hex\s*\(|unhex\s*\()\b/i,
        targets: QUERY_BODY, paranoia: 2,
    },
    {
        id: 942250, category: 'sql_injection', severity: 2,
        description: 'SQL MATCH AGAINST injection',
        pattern: /\bmatch\s*\([^)]+\)\s+against\s*\(/i,
        targets: QUERY_BODY, paranoia: 3,
    },
    {
        id: 942260, category: 'sql_injection', severity: 1,
        description: 'SQL INTO OUTFILE/DUMPFILE',
        pattern: /\binto\s+(?:outfile|dumpfile)\b/i,
        targets: DATA_DECODED, paranoia: 1,
    },
    {
        id: 942270, category: 'sql_injection', severity: 2,
        description: 'SQL encodage hex 0x...',
        pattern: /\b0x[0-9a-f]{4,}\b/i,
        targets: QUERY_BODY, paranoia: 2,
    },
    {
        id: 942280, category: 'sql_injection', severity: 2,
        description: 'Postgres SQL injection (pg_read_file/COPY)',
        pattern: /\b(?:pg_read_file|pg_ls_dir|pg_stat_file|copy\s+.+\s+to\s+|copy\s+.+\s+from\s+)\b/i,
        targets: DATA_DECODED, paranoia: 1,
    },
    {
        id: 942290, category: 'sql_injection', severity: 2,
        description: 'NoSQL injection (MongoDB $where, $ne, etc.)',
        pattern: /\$(?:where|ne|gt|lt|gte|lte|in|nin|exists|type|mod|regex|or|and|nor|not)\b/,
        targets: QUERY_BODY, paranoia: 1,
    },
    {
        id: 942300, category: 'sql_injection', severity: 2,
        description: 'SQL injection: TIME-BASED (SLEEP/DELAY combiné)',
        pattern: /(?:and|or|;)\s*(?:sleep|pg_sleep|benchmark|waitfor\s+delay)\s*\(/i,
        targets: DATA_DECODED, paranoia: 1,
    },
    {
        id: 942310, category: 'sql_injection', severity: 1,
        description: 'SQL injection: LOAD DATA INFILE',
        pattern: /\bload\s+data\s+(?:local\s+)?infile\b/i,
        targets: DATA_DECODED, paranoia: 1,
    },
]

// ══════════════════════════════════════════════════════════════
// 941xxx : XSS (Cross-Site Scripting)
// ══════════════════════════════════════════════════════════════
const XSS_RULES: WafRule[] = [
    {
        id: 941100, category: 'xss', severity: 1,
        description: 'XSS: balise <script>',
        pattern: /<\s*script[\s/>]/i,
        targets: ALL_DECODED, paranoia: 1,
    },
    {
        id: 941110, category: 'xss', severity: 1,
        description: 'XSS: javascript: protocol',
        pattern: /javascript\s*:/i,
        targets: ALL_DECODED, paranoia: 1,
    },
    {
        id: 941120, category: 'xss', severity: 1,
        description: 'XSS: vbscript/data protocol',
        pattern: /(?:vbscript|data\s*:text\/html|data\s*:application\/x-javascript)\s*:/i,
        targets: ALL_DECODED, paranoia: 1,
    },
    {
        id: 941130, category: 'xss', severity: 2,
        description: 'XSS: event handlers (onload, onclick, onerror...)',
        pattern: /\bon(?:load|error|click|mouse(?:over|out|enter|leave|move|down|up)|focus|blur|change|input|submit|reset|select|keydown|keyup|keypress|drag|drop|scroll|resize|unload|beforeunload|hashchange|popstate|animationend|transitionend|message|readystatechange|contextmenu|dblclick|wheel|touchstart|touchend|touchmove)\s*=/i,
        targets: ALL_DECODED, paranoia: 1,
    },
    {
        id: 941140, category: 'xss', severity: 2,
        description: 'XSS: src/href injection javascript:',
        pattern: /<[^>]+\s+(?:src|href|action|formaction|xlink:href)\s*=\s*(?:javascript|vbscript|data)\s*:/i,
        targets: ALL_DECODED, paranoia: 1,
    },
    {
        id: 941150, category: 'xss', severity: 2,
        description: 'XSS: iframe/embed/object/applet',
        pattern: /<\s*(?:iframe|frame|embed|object|applet|meta|link|base)[^>]*/i,
        targets: ALL_DECODED, paranoia: 1,
    },
    {
        id: 941160, category: 'xss', severity: 2,
        description: 'XSS: document.cookie/write manipulation',
        pattern: /document\s*\.\s*(?:cookie|write|location|body|domain|referrer|title|URL)/i,
        targets: ALL_DECODED, paranoia: 1,
    },
    {
        id: 941170, category: 'xss', severity: 2,
        description: 'XSS: window.location manipulation',
        pattern: /window\s*\.\s*(?:location|open|alert|confirm|prompt|eval|setTimeout|setInterval)/i,
        targets: ALL_DECODED, paranoia: 1,
    },
    {
        id: 941180, category: 'xss', severity: 2,
        description: 'XSS: eval/atob/unescape',
        pattern: /\b(?:eval|atob|btoa|unescape|escape)\s*\(/i,
        targets: ALL_DECODED, paranoia: 1,
    },
    {
        id: 941190, category: 'xss', severity: 2,
        description: 'XSS: String.fromCharCode',
        pattern: /String\s*\.\s*fromCharCode\s*\(/i,
        targets: ALL_DECODED, paranoia: 1,
    },
    {
        id: 941200, category: 'xss', severity: 2,
        description: 'XSS: innerHTML/outerHTML assignment',
        pattern: /(?:inner|outer)HTML\s*=/i,
        targets: QUERY_BODY, paranoia: 2,
    },
    {
        id: 941210, category: 'xss', severity: 3,
        description: 'XSS: SVG XSS vectors',
        pattern: /<\s*svg[^>]*>|<\s*svg[^>]*on\w+\s*=/i,
        targets: ALL_DECODED, paranoia: 1,
    },
    {
        id: 941220, category: 'xss', severity: 2,
        description: 'XSS: CSS expression/import',
        pattern: /(?:expression\s*\(|@import\s+(?:url|['"])|behavior\s*:)/i,
        targets: ALL_DECODED, paranoia: 1,
    },
    {
        id: 941230, category: 'xss', severity: 2,
        description: 'XSS: srcdoc attribute',
        pattern: /\bsrcdoc\s*=/i,
        targets: ALL_DECODED, paranoia: 2,
    },
    {
        id: 941240, category: 'xss', severity: 2,
        description: 'XSS: import() dynamique',
        pattern: /\bimport\s*\(/i,
        targets: QUERY_BODY, paranoia: 2,
    },
    {
        id: 941250, category: 'xss', severity: 3,
        description: 'XSS: template literals avec expressions',
        pattern: /`[^`]*\$\{[^}]*(?:document|window|location|eval)[^}]*\}`/i,
        targets: QUERY_BODY, paranoia: 2,
    },
    {
        id: 941260, category: 'xss', severity: 2,
        description: 'XSS: mutation XSS (mXSS) via innerHTML',
        pattern: /(?:<noscript>|<\/noscript>|<template>|<\/template>|<xmp>|<\/xmp>)/i,
        targets: ALL_DECODED, paranoia: 2,
    },
    {
        id: 941270, category: 'xss', severity: 2,
        description: 'XSS: DOM clobbering (id=location/href)',
        pattern: /(?:\bid\s*=\s*['"](?:location|href|src|action|name)['"]\s*|name\s*=\s*['"](?:location|href|document)['"]\s*)/i,
        targets: QUERY_BODY, paranoia: 3,
    },
]

// ══════════════════════════════════════════════════════════════
// 930xxx : LOCAL FILE INCLUSION (LFI)
// ══════════════════════════════════════════════════════════════
const LFI_RULES: WafRule[] = [
    {
        id: 930100, category: 'lfi', severity: 1,
        description: 'LFI: path traversal ../',
        pattern: /\.\.[/\\]|\.\.%2f|\.\.%5c|%2e%2e%2f|%2e%2e%5c/i,
        targets: ['urlPath', 'query'], paranoia: 1,
    },
    {
        id: 930110, category: 'lfi', severity: 1,
        description: 'LFI: accès fichiers système Linux (/etc/passwd, /proc)',
        pattern: /\b(?:etc\/(?:passwd|shadow|hosts|group|hostname|issue|motd|sudoers|crontab)|proc\/(?:self\/(?:environ|cmdline|maps|mem)|version)|dev\/(?:tcp|udp))\b/i,
        targets: ALL_DECODED, paranoia: 1,
    },
    {
        id: 930120, category: 'lfi', severity: 1,
        description: 'LFI: accès fichiers Windows (win.ini, system32)',
        pattern: /(?:windows[\\/]system32|win\.ini|boot\.ini|autoexec\.bat|hosts\s*file|%systemroot%|%windir%)/i,
        targets: ALL_DECODED, paranoia: 1,
    },
    {
        id: 930130, category: 'lfi', severity: 2,
        description: 'LFI: wrappers PHP (php://, zip://, phar://)',
        pattern: /(?:php:\/\/(?:input|filter|data|zip)|zip:\/\/|phar:\/\/|expect:\/\/|glob:\/\/)/i,
        targets: ALL_DECODED, paranoia: 1,
    },
    {
        id: 930140, category: 'lfi', severity: 2,
        description: 'LFI: null byte terminaison',
        pattern: /(?:\x00|%00)(?:\.|[/\\])/,
        targets: ['urlPath', 'query'], paranoia: 1,
    },
]

// ══════════════════════════════════════════════════════════════
// 931xxx : REMOTE FILE INCLUSION (RFI)
// ══════════════════════════════════════════════════════════════
const RFI_RULES: WafRule[] = [
    {
        id: 931100, category: 'rfi', severity: 1,
        description: 'RFI: URL dans paramètre file/url/path',
        pattern: /(?:file|url|path|src|include|require|load)\s*=\s*(?:https?|ftp|ftps|dict|sftp|ldap|tftp|gopher|imap|smtp):\/\//i,
        targets: QUERY_BODY, paranoia: 1,
    },
    {
        id: 931110, category: 'rfi', severity: 1,
        description: 'RFI: adresse IP dans paramètre fichier',
        pattern: /(?:file|url|page|template|include)\s*=\s*(?:https?:\/\/)?(?:(?:25[0-5]|2[0-4]\d|\d{1,2})\.){3}(?:25[0-5]|2[0-4]\d|\d{1,2})/i,
        targets: QUERY_BODY, paranoia: 1,
    },
    {
        id: 931120, category: 'rfi', severity: 2,
        description: 'RFI: double slash indicateur',
        pattern: /(?:file|url|src|page)\s*=\s*\/\//i,
        targets: QUERY_BODY, paranoia: 2,
    },
]

// ══════════════════════════════════════════════════════════════
// 932xxx : RCE / OS COMMAND INJECTION
// ══════════════════════════════════════════════════════════════
const RCE_RULES: WafRule[] = [
    {
        id: 932100, category: 'rce', severity: 1,
        description: 'RCE: Unix command injection (;/|/& + commande)',
        pattern: /[;&|`]\s*(?:ls|cat|id|whoami|uname|pwd|echo|wget|curl|bash|sh|nc|python|perl|ruby|php|node)\b/i,
        targets: ALL_DECODED, paranoia: 1,
    },
    {
        id: 932110, category: 'rce', severity: 1,
        description: 'RCE: Windows command injection (cmd, powershell)',
        pattern: /[&|;]\s*(?:cmd|powershell|wscript|cscript|mshta|regsvr32|rundll32|certutil|bitsadmin)\b/i,
        targets: ALL_DECODED, paranoia: 1,
    },
    {
        id: 932120, category: 'rce', severity: 1,
        description: 'RCE: shell metacharacters (`cmd`, $(cmd), ${IFS})',
        pattern: /(?:;\s*[a-z]{2,10}\s+[/\\-]|`[^`]+`|\$\([^)]+\)|\$\{IFS\})/i,
        targets: QUERY_BODY, paranoia: 1,
    },
    {
        id: 932130, category: 'rce', severity: 2,
        description: 'RCE: upload/accès fichiers exécutables',
        pattern: /\.(?:php\d?|phtml|phar|asp|aspx|ashx|asmx|axd|jsp|jspx|cfm|cfc|sh|bash|csh|ksh|cmd|bat|ps1|vbs|vbe|jse|wsf|wsc|hta|sct|pif|scr|exe|dll|msi|app)$/i,
        targets: ['urlPath', 'query', 'body'], paranoia: 1,
    },
    {
        id: 932140, category: 'rce', severity: 1,
        description: 'RCE: variables d\'environnement Bash ($IFS, $PATH)',
        pattern: /\$(?:IFS|HOME|PATH|USER|SHELL|TERM|LANG|LC_ALL|LD_PRELOAD|LD_LIBRARY_PATH)\b/,
        targets: ALL_DECODED, paranoia: 1,
    },
    {
        id: 932150, category: 'rce', severity: 1,
        description: 'RCE: séparateurs de commandes encodés',
        pattern: /%(?:26(?:%26)?|7c(?:%7c)?|3b|60|24\()/i,
        targets: ['urlPath', 'query'], paranoia: 1,
    },
    {
        id: 932160, category: 'rce', severity: 2,
        description: 'RCE: network commands (wget/curl avec URL)',
        pattern: /\b(?:wget|curl|fetch|lwp-request|lwp-download|lynx|links|elinks|w3m)\s+(?:https?|ftp):\/\//i,
        targets: QUERY_BODY, paranoia: 1,
    },
    {
        id: 932170, category: 'rce', severity: 1,
        description: 'RCE: reverse shell patterns (bash -i, nc -e)',
        pattern: /(?:bash\s+-i\s*>&|nc\s+-(?:e|c)\s+\/bin|python\s+-c\s+['"]import\s+socket|\/bin\/(?:sh|bash)\s+-[ic]|ncat\s+.*--exec)/i,
        targets: ALL_DECODED, paranoia: 1,
    },
]

// ══════════════════════════════════════════════════════════════
// 933xxx : PHP INJECTION
// ══════════════════════════════════════════════════════════════
const PHP_RULES: WafRule[] = [
    {
        id: 933100, category: 'php_injection', severity: 1,
        description: 'PHP injection: balises PHP <?php ?>',
        pattern: /<\?\s*php|<\?=|\?>/i,
        targets: ALL_DECODED, paranoia: 1,
    },
    {
        id: 933110, category: 'php_injection', severity: 1,
        description: 'PHP injection: fonctions dangereuses (eval, system, exec)',
        pattern: /\b(?:eval|assert|preg_replace|create_function|call_user_func|call_user_func_array|array_map|array_filter|usort|system|exec|passthru|shell_exec|popen|proc_open|pcntl_exec|base64_decode|str_rot13|gzinflate|gzuncompress|str_replace)\s*\(/i,
        targets: QUERY_BODY, paranoia: 1,
    },
    {
        id: 933120, category: 'php_injection', severity: 2,
        description: 'PHP injection: sérialisation objet (O:N:"class")',
        pattern: /O:\d+:"[a-zA-Z_]\w*":\d+:\{|a:\d+:\{/,
        targets: ['query', 'body', 'cookie'], paranoia: 1,
    },
    {
        id: 933130, category: 'php_injection', severity: 2,
        description: 'PHP injection: superglobales ($_GET, $_POST)',
        pattern: /\$(?:_GET|_POST|_COOKIE|_REQUEST|_SERVER|_FILES|_SESSION|_ENV|GLOBALS)\b/,
        targets: QUERY_BODY, paranoia: 2,
    },
]

// ══════════════════════════════════════════════════════════════
// 934xxx : NODE.JS / SERVER-SIDE INJECTION
// ══════════════════════════════════════════════════════════════
const NODEJS_RULES: WafRule[] = [
    {
        id: 934100, category: 'nodejs_injection', severity: 1,
        description: 'Node.js: prototype pollution (__proto__, constructor)',
        pattern: /(?:__proto__|constructor\s*\[|prototype\s*\[|constructor\.prototype)/i,
        targets: ['query', 'body', 'cookie'], paranoia: 1,
    },
    {
        id: 934110, category: 'nodejs_injection', severity: 1,
        description: 'Node.js: require injection / child_process',
        pattern: /\brequire\s*\(\s*['"][./]|child_process|\.exec\s*\(|\.execSync\s*\(|\.spawn\s*\(/i,
        targets: QUERY_BODY, paranoia: 1,
    },
    {
        id: 934120, category: 'nodejs_injection', severity: 2,
        description: 'Node.js: SSTI template injection ({{require}}, ${process})',
        pattern: /\{\{[^}]*(?:require|process|global|module|__dirname|constructor)[^}]*\}\}|\$\{[^}]*(?:require|process|global)\b/i,
        targets: ALL_DECODED, paranoia: 1,
    },
    {
        id: 934130, category: 'nodejs_injection', severity: 2,
        description: 'Node.js: process.env / process.exit access',
        pattern: /process\s*\.\s*(?:env|exit|kill|mainModule|binding|dlopen)\b/i,
        targets: ALL_DECODED, paranoia: 1,
    },
]

// ══════════════════════════════════════════════════════════════
// 932xxx : COMMAND INJECTION (OS)
// ══════════════════════════════════════════════════════════════
const CMD_RULES: WafRule[] = [
    {
        id: 932200, category: 'command_injection', severity: 1,
        description: 'Injection commande: opérateurs pipe/chain avec commande Unix',
        pattern: /[|;`]\s*(?:cat|ls|dir|type|more|less|head|tail|id|whoami|pwd|uname|hostname|ifconfig|ipconfig|netstat|ps|top|df|du|chmod|chown|kill|rm|cp|mv|mkdir|touch|find|grep|awk|sed|sort|cut|wget|curl)\b/i,
        targets: QUERY_BODY, paranoia: 1,
    },
    {
        id: 932210, category: 'command_injection', severity: 2,
        description: 'Injection commande: redirection shell vers /etc ou /tmp',
        pattern: /(?:>\s*\/(?:dev|tmp|etc|var|proc)|>>\s*\/(?:etc\/(?:passwd|shadow)|tmp|dev\/null))/i,
        targets: QUERY_BODY, paranoia: 1,
    },
]

// ══════════════════════════════════════════════════════════════
// 913xxx : SCANNER DETECTION
// ══════════════════════════════════════════════════════════════
const SCANNER_RULES: WafRule[] = [
    {
        id: 913100, category: 'scanner_detection', severity: 2,
        description: 'Scanner: outils de pentest connus (sqlmap, nikto, nmap...)',
        pattern: /(?:sqlmap|nikto|nessus|masscan|nmap|zmap|openvas|w3af|burpsuite|acunetix|nexpose|qualys|rapid7|metasploit|arachni|skipfish|wapiti|zaproxy|dirbuster|gobuster|ffuf|feroxbuster|nuclei|subfinder|amass|httprobe|waybackurls|gau|hakrawler|gospider|katana|getallurls|hydra|medusa|aircrack|kismet|hashcat|john\s+the\s+ripper)/i,
        targets: UA_ONLY, paranoia: 1,
    },
    {
        id: 913110, category: 'scanner_detection', severity: 3,
        description: 'Scanner: librairies HTTP automatisées (python-requests, go-http)',
        pattern: /^(?:python-requests\/[01]|go-http-client\/[01]|java\/[0-9]|curl\/[0-9]|wget\/[0-9]|libwww-perl|lwp-trivial|zgrab|masscan|libcurl)/i,
        targets: UA_ONLY, paranoia: 1,
    },
    {
        id: 913120, category: 'scanner_detection', severity: 3,
        description: 'Scanner: patterns de fuzzing dans URL (.git, .env, wp-config)',
        pattern: /(?:\/\.git\/|\/\.svn\/|\/\.env|\/\.htpasswd|\/\.htaccess|\/wp-config\.php|\/config\.php|\/database\.yml|\/\.DS_Store|\/thumbs\.db|\/web\.config|\/app\.config|\/phpinfo\.php|\/test\.php|\/info\.php)/i,
        targets: URL_ONLY, paranoia: 1,
    },
    {
        id: 913130, category: 'scanner_detection', severity: 2,
        description: 'Scanner: header X-Scan-Memo ou Acunetix',
        pattern: /x-scan-memo|acunetix-product|x-requested-with.*(?:scanner|crawler|spider)/i,
        targets: ALL_DECODED, paranoia: 1,
    },
    {
        id: 913140, category: 'scanner_detection', severity: 3,
        description: 'Scanner: User-Agent vide ou suspicieusement court',
        pattern: /^.{0,4}$/,
        targets: UA_ONLY, paranoia: 2,
    },
    {
        id: 913150, category: 'scanner_detection', severity: 2,
        description: 'Scanner: outils de brute-force',
        pattern: /(?:hydra|medusa|thc-hydra|burp\s+intruder|patator|crowbar|brutus|l0phtcrack)/i,
        targets: UA_ONLY, paranoia: 1,
    },
]

// ══════════════════════════════════════════════════════════════
// 920xxx : PROTOCOL VIOLATIONS
// ══════════════════════════════════════════════════════════════
const PROTOCOL_RULES: WafRule[] = [
    {
        id: 920100, category: 'protocol_violation', severity: 3,
        description: 'Protocole: caractères de contrôle invalides dans URL',
        pattern: /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/,
        targets: ['urlPath', 'query'], paranoia: 1,
    },
    {
        id: 920200, category: 'protocol_violation', severity: 3,
        description: 'Protocole: header Referer malformé',
        pattern: /^(?:[^a-zA-Z0-9._\-\[\]:]).*|.*(?:[^a-zA-Z0-9._\-\[\]:])$/,
        targets: ['referer'], paranoia: 3,
    },
    {
        id: 920300, category: 'protocol_violation', severity: 4,
        description: 'Protocole: Content-Type JSON malformé',
        pattern: /^application\/json.*;\s*(?!charset)/i,
        targets: ['body'], paranoia: 4,
    },
    {
        id: 920400, category: 'protocol_violation', severity: 2,
        description: 'Protocole: URL trop longue (>2048 chars)',
        pattern: /.{2049,}/,
        targets: URL_ONLY, paranoia: 1,
    },
]

// ══════════════════════════════════════════════════════════════
// 951xxx : DATA LEAKAGE PREVENTION
// ══════════════════════════════════════════════════════════════
const DATA_LEAKAGE_RULES: WafRule[] = [
    {
        id: 951100, category: 'data_leakage', severity: 2,
        description: 'Leakage: numéro de carte bancaire potentiel',
        pattern: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12})\b/,
        targets: ['body'], paranoia: 2,
    },
    {
        id: 951110, category: 'data_leakage', severity: 3,
        description: 'Leakage: numéro de sécurité sociale US',
        pattern: /\b\d{3}-\d{2}-\d{4}\b/,
        targets: ['body'], paranoia: 3,
    },
]

// ══════════════════════════════════════════════════════════════
// 921xxx : HTTP REQUEST SMUGGLING
// ══════════════════════════════════════════════════════════════
const SMUGGLING_RULES: WafRule[] = [
    {
        id: 921100, category: 'http_smuggling', severity: 1,
        description: 'HTTP Smuggling: Transfer-Encoding + Content-Length conflict',
        pattern: /(?:transfer-encoding\s*:.*chunked.*content-length|content-length.*transfer-encoding\s*:.*chunked)/i,
        targets: ALL_DECODED, paranoia: 1,
    },
    {
        id: 921110, category: 'http_smuggling', severity: 2,
        description: 'HTTP Smuggling: CRLF injection dans headers',
        pattern: /(?:%0d%0a|%0a%0d|\r\n|\n\r)(?:content-type|content-length|set-cookie|location|status)/i,
        targets: ['query', 'body', 'referer'], paranoia: 1,
    },
]

// ══════════════════════════════════════════════════════════════
// SSRF : Server Side Request Forgery
// ══════════════════════════════════════════════════════════════
const SSRF_RULES: WafRule[] = [
    {
        id: 934200, category: 'ssrf', severity: 1,
        description: 'SSRF: IP metadata cloud (169.254.169.254)',
        pattern: /169\.254\.\d+\.\d+|metadata\.google\.internal|169\.254\.169\.254/i,
        targets: QUERY_BODY, paranoia: 1,
    },
    {
        id: 934210, category: 'ssrf', severity: 1,
        description: 'SSRF: loopback / localhost / 127.x',
        pattern: /(?:localhost|127\.[0-9.]+|::1|0\.0\.0\.0|0x7f000001)\b/i,
        targets: QUERY_BODY, paranoia: 1,
    },
    {
        id: 934220, category: 'ssrf', severity: 2,
        description: 'SSRF: plages IP privées RFC1918 (10.x, 172.16-31.x, 192.168.x)',
        pattern: /(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+)/,
        targets: QUERY_BODY, paranoia: 2,
    },
    {
        id: 934230, category: 'ssrf', severity: 1,
        description: 'SSRF: protocoles non-HTTP dangereux (file://, dict://, gopher://)',
        pattern: /(?:file|dict|sftp|ldap|ldaps|tftp|gopher|netdoc):\/\//i,
        targets: QUERY_BODY, paranoia: 1,
    },
]

// ══════════════════════════════════════════════════════════════
// XXE : XML External Entity Injection
// ══════════════════════════════════════════════════════════════
const XXE_RULES: WafRule[] = [
    {
        id: 921200, category: 'xxe', severity: 1,
        description: 'XXE: DOCTYPE ENTITY avec SYSTEM/PUBLIC',
        pattern: /<!(?:DOCTYPE|ENTITY)[^>]*(?:SYSTEM|PUBLIC)\s+['"][^'"]*['"]/i,
        targets: ['body'], paranoia: 1,
    },
    {
        id: 921210, category: 'xxe', severity: 1,
        description: 'XXE: entité externe SYSTEM',
        pattern: /<!ENTITY\s+\w+\s+SYSTEM\s+['"][^'"]*['"]\s*>/i,
        targets: ['body'], paranoia: 1,
    },
]

// ══════════════════════════════════════════════════════════════
// SESSION FIXATION
// ══════════════════════════════════════════════════════════════
const SESSION_RULES: WafRule[] = [
    {
        id: 943100, category: 'session_fixation', severity: 2,
        description: 'Session fixation: JSESSIONID/PHPSESSID dans URL',
        pattern: /(?:jsessionid|phpsessid|aspsessionid|cfid|cftoken|sid|sess_id)\s*=/i,
        targets: ['urlPath', 'query'], paranoia: 2,
    },
]

// ══════════════════════════════════════════════════════════════
// 950xxx : HONEYPOT (fichiers/endpoints piégés)
// Détecte les attaquants cherchant des fichiers sensibles connus
// ══════════════════════════════════════════════════════════════
const HONEYPOT_RULES: WafRule[] = [
    {
        id: 950100, category: 'honeypot', severity: 1,
        description: 'Honeypot: tentative d\'accès à des fichiers de config secrets',
        pattern: /\/(?:\.env(?:\.local|\.prod|\.dev|\.example)?|\.aws\/credentials|\.ssh\/(?:id_rsa|authorized_keys|known_hosts)|\.npmrc|\.pypirc|\.netrc|Dockerfile|docker-compose\.ya?ml)\b/i,
        targets: URL_ONLY, paranoia: 1,
    },
    {
        id: 950110, category: 'honeypot', severity: 1,
        description: 'Honeypot: tentative d\'accès aux sauvegardes / dumps',
        pattern: /\/(?:backup|dump|bkp|old|copy|save|archive|sql|db|database)s?\/|\.(?:bak|bkp|backup|old|sql|dump|tar|gz|zip|rar|7z)\b/i,
        targets: URL_ONLY, paranoia: 1,
    },
    {
        id: 950120, category: 'honeypot', severity: 1,
        description: 'Honeypot: WordPress traps (wp-login, xmlrpc)',
        pattern: /\/(?:wp-login\.php|wp-admin|xmlrpc\.php|wp-content\/uploads\/[^/]+\.php|wp-includes\/[^/]+\.php)\b/i,
        targets: URL_ONLY, paranoia: 1,
    },
    {
        id: 950130, category: 'honeypot', severity: 2,
        description: 'Honeypot: CMS traps (Joomla, Drupal, Magento)',
        pattern: /\/(?:administrator\/index\.php|includes\/application\.php|admin\/Cms_Wysiwyg|downloader\/index\.php|magento_version|app\/etc\/local\.xml)\b/i,
        targets: URL_ONLY, paranoia: 1,
    },
    {
        id: 950140, category: 'honeypot', severity: 2,
        description: 'Honeypot: accès aux clés API / secrets dans URL',
        pattern: /\/(?:api[-_]?key|secret[-_]?key|private[-_]?key|access[-_]?token|auth[-_]?token|apikey|secretkey)\b/i,
        targets: URL_ONLY, paranoia: 2,
    },
    {
        id: 950150, category: 'honeypot', severity: 2,
        description: 'Honeypot: accès .git exposé',
        pattern: /\/\.git(?:\/(?:HEAD|config|FETCH_HEAD|objects|refs|logs))?/i,
        targets: URL_ONLY, paranoia: 1,
    },
]

// ══════════════════════════════════════════════════════════════
// 960xxx : ENUMERATION (dénombrement de ressources)
// ══════════════════════════════════════════════════════════════
const ENUMERATION_RULES: WafRule[] = [
    {
        id: 960100, category: 'enumeration', severity: 3,
        description: 'Énumération: tentative d\'accès aux endpoints admin communs',
        pattern: /\/(?:admin|administrator|backend|manager|manage|dashboard|panel|control|controlpanel|cpanel|webadmin|sysadmin|superadmin|wp-admin|phpmyadmin|adminer|pgadmin|dbadmin|mysqladmin)(?:\/|$)/i,
        targets: URL_ONLY, paranoia: 2,
    },
    {
        id: 960110, category: 'enumeration', severity: 3,
        description: 'Énumération: tentative d\'accès aux pages de debug',
        pattern: /\/(?:debug|test|testing|dev|development|staging|demo|sample|example|temp|tmp|log|logs|error|errors)(?:\/|$)/i,
        targets: URL_ONLY, paranoia: 3,
    },
    {
        id: 960120, category: 'enumeration', severity: 4,
        description: 'Énumération: tentative d\'accès aux API de monitoring',
        pattern: /\/(?:actuator|metrics|health|status|info|trace|env|beans|mappings|configprops|loggers|threaddump|heapdump|prometheus|grafana)(?:\/|$)/i,
        targets: URL_ONLY, paranoia: 2,
    },
]

// ══════════════════════════════════════════════════════════════
// ANTI-BYPASS : Règles résistantes aux techniques d'évasion avancées
// ══════════════════════════════════════════════════════════════
const ANTI_BYPASS_RULES: WafRule[] = [
    // ── XSS bypass : <svg/onload= (slash au lieu d'espace) ───────
    {
        id: 970100, category: 'xss', severity: 1,
        description: 'XSS bypass: balise avec slash (svg/onload, img/onerror)',
        pattern: /<(?:svg|img|body|input|details|video|audio|source|iframe)[/\s][^>]*on\w+\s*=/i,
        targets: ALL_DECODED, paranoia: 1,
    },
    // ── XSS bypass : <script> avec attributs ou type alternatif ──
    {
        id: 970110, category: 'xss', severity: 1,
        description: 'XSS bypass: <script type=text/javascript> variantes',
        pattern: /<script[^>]*(?:type\s*=\s*['"]?(?:text\/(?:javascript|vbscript|jscript|livescript)|application\/(?:javascript|ecmascript))|src\s*=)[^>]*/i,
        targets: ALL_DECODED, paranoia: 1,
    },
    // ── SQL bypass : commentaires entre mots-clés (U/**/NION) ────
    // Note : le decoder normalise déjà les commentaires, mais protection double
    {
        id: 970120, category: 'sql_injection', severity: 1,
        description: 'SQL bypass: mots-clés SQL fragmentés par commentaires',
        pattern: /(?:u\s*\/\*+\s*\*\/\s*n\s*i\s*o\s*n|s\s*\/\*+\s*\*\/\s*e\s*l\s*e\s*c\s*t)/i,
        targets: DATA_DECODED, paranoia: 1,
    },
    // ── SQL bypass : encodage char() pour contourner les filtres ─
    {
        id: 970130, category: 'sql_injection', severity: 1,
        description: 'SQL bypass: CHAR()/CHR() pour encoder chaînes SQL',
        pattern: /(?:char|chr)\s*\(\s*\d+(?:\s*,\s*\d+){2,}\s*\)/i,
        targets: DATA_DECODED, paranoia: 1,
    },
    // ── SQL bypass : encodage binaire/octal ──────────────────────
    {
        id: 970140, category: 'sql_injection', severity: 2,
        description: 'SQL bypass: encodage binaire ou octal dans requête',
        pattern: /(?:b'[01]{8,}'|0b[01]{8,}|\\(?:[0-9]{3}){3,})/i,
        targets: DATA_DECODED, paranoia: 2,
    },
    // ── NoSQL bypass : opérateurs dans body JSON ──────────────────
    {
        id: 970150, category: 'sql_injection', severity: 1,
        description: 'NoSQL bypass: opérateurs MongoDB imbriqués dans body',
        pattern: /["']?\s*\$(?:where|ne|gt|lt|gte|lte|in|nin|regex|exists|expr|jsonSchema)\s*["']?\s*:/i,
        targets: ['body', 'cookie'], paranoia: 1,
    },
    // ── Path traversal encodé avancé ─────────────────────────────
    {
        id: 970160, category: 'lfi', severity: 1,
        description: 'LFI bypass: traversal avec encodage avancé (.%2e, %252e)',
        pattern: /(?:\.%2e|%2e\.|\.%252e|%252e\.|\.%c0%ae|%c0%ae\.)/i,
        targets: ['urlPath', 'query'], paranoia: 1,
    },
    // ── RCE bypass : variable expansion bash $'\x...' ─────────────
    {
        id: 970170, category: 'rce', severity: 1,
        description: 'RCE bypass: bash ANSI-C quoting $\'\\x...\' / $\'\\n...',
        pattern: /\$'\s*(?:\\x[0-9a-f]{2}|\\[0-9]{3}|\\u[0-9a-f]{4})+/i,
        targets: QUERY_BODY, paranoia: 2,
    },
    // ── Header injection multi-lignes ─────────────────────────────
    {
        id: 970180, category: 'http_smuggling', severity: 1,
        description: 'Header injection: caractères CRLF dans paramètres',
        pattern: /(?:%0d|%0a|%0D|%0A|\r|\n)(?:%0d|%0a|%0D|%0A|\r|\n)?(?:content-type|set-cookie|location|x-|authorization)/i,
        targets: ['query', 'referer', 'cookie'], paranoia: 1,
    },
    // ── Prototype pollution via JSON keys ─────────────────────────
    {
        id: 970190, category: 'nodejs_injection', severity: 1,
        description: 'Prototype pollution: __proto__ ou constructor dans JSON body',
        pattern: /["'](?:__proto__|constructor|prototype)["']\s*:/i,
        targets: ['body'], paranoia: 1,
    },
    // ── SSRF via redirecteurs DNS/IPv6 ───────────────────────────
    {
        id: 970200, category: 'ssrf', severity: 1,
        description: 'SSRF bypass: adresses IPv6 loopback ou link-local',
        pattern: /(?:\[::1\]|\[::ffff:127\.|\[fe80:|\[fc00:|0{4}:0{4}:0{4}:0{4}:0{4}:0{4}:0{4}:0001)/i,
        targets: QUERY_BODY, paranoia: 1,
    },
    // ── SSRF via @ dans URL ──────────────────────────────────────
    {
        id: 970210, category: 'ssrf', severity: 2,
        description: 'SSRF bypass: URL credentials pour confondre le parser (user@host)',
        pattern: /https?:\/\/[^@\s/]+@(?:localhost|127\.|10\.|192\.168\.|169\.254\.)/i,
        targets: QUERY_BODY, paranoia: 1,
    },
    // ── Open redirect générique ───────────────────────────────────
    {
        id: 970220, category: 'protocol_violation', severity: 2,
        description: 'Open redirect: paramètre de redirection vers URL externe',
        pattern: /(?:redirect|return|next|from|url|goto|destination)\s*=\s*(?:https?:\/\/|\/\/)[^/]/i,
        targets: ['query'], paranoia: 2,
    },
    // ── Log4Shell / JNDI injection ────────────────────────────────
    {
        id: 970230, category: 'rce', severity: 1,
        description: 'Log4Shell: JNDI lookup injection',
        pattern: /\$\{.*j.*n.*d.*i.*(?:ldap|rmi|dns|iiop|corba|nds|http|nis|cosnaming)/i,
        targets: ALL_DECODED, paranoia: 1,
    },
    // ── Spring4Shell ─────────────────────────────────────────────
    {
        id: 970240, category: 'rce', severity: 1,
        description: 'Spring4Shell: class.classLoader injection',
        pattern: /class\.(?:classLoader|module|forName)|(?:getRuntime|getClass)\(\s*\)\.exec/i,
        targets: ALL_DECODED, paranoia: 1,
    },
]

// ══════════════════════════════════════════════════════════════
// EXPORT : toutes les règles consolidées
// ══════════════════════════════════════════════════════════════
export const ALL_RULES: WafRule[] = [
    ...SQL_RULES,
    ...XSS_RULES,
    ...LFI_RULES,
    ...RFI_RULES,
    ...RCE_RULES,
    ...PHP_RULES,
    ...NODEJS_RULES,
    ...CMD_RULES,
    ...SCANNER_RULES,
    ...PROTOCOL_RULES,
    ...DATA_LEAKAGE_RULES,
    ...SMUGGLING_RULES,
    ...SSRF_RULES,
    ...XXE_RULES,
    ...SESSION_RULES,
    ...HONEYPOT_RULES,
    ...ENUMERATION_RULES,
    ...ANTI_BYPASS_RULES,
]

// Règles par catégorie pour accès rapide
export const RULES_BY_CATEGORY = ALL_RULES.reduce((acc, rule) => {
    if (!acc[rule.category]) acc[rule.category] = []
    acc[rule.category].push(rule)
    return acc
}, {} as Record<string, WafRule[]>)

// Scores de sévérité (comme ModSecurity OWASP CRS)
export const SEVERITY_SCORES: Record<Severity, number> = {
    1: 5,  // CRITICAL
    2: 4,  // ERROR
    3: 3,  // WARNING
    4: 2,  // NOTICE
    5: 1,  // INFO
}

// Seuils de blocage par niveau de paranoia
export const BLOCK_THRESHOLDS: Record<number, number> = {
    1: 5,   // Paranoia 1 (défaut) : block si score >= 5 (1 règle critique)
    2: 4,   // Paranoia 2 : block si score >= 4
    3: 3,   // Paranoia 3 : block si score >= 3
    4: 1,   // Paranoia 4 (strict) : block dès le moindre match
}
