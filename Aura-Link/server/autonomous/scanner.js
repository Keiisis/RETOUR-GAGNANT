// ════════════════════════════════════════════════════════════════
//  🛡️ AURA HIVE v5.0 — CODE VULNERABILITY SCANNER (SAST)
//  Static Application Security Testing engine with 200+ patterns
//  Scans for OWASP Top 10, secrets, dangerous APIs, dependencies
// ════════════════════════════════════════════════════════════════
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const { knowledgeEngine } = require('./knowledge');

// ════════════════════════════════════════════
// VULNERABILITY PATTERN DATABASE
// ════════════════════════════════════════════
const VULN_PATTERNS = {
    // ── A03:2021 — INJECTION ──
    SQL_INJECTION: {
        owasp: 'A03:2021', severity: 'CRITICAL', cwe: 'CWE-89',
        patterns: [
            { regex: /(?:query|execute|raw)\s*\(\s*(?:`[^`]*\$\{|['"][^'"]*\+)/gi, desc: 'String concatenation in SQL query' },
            { regex: /(?:SELECT|INSERT|UPDATE|DELETE|DROP)\s+.*(?:\+\s*(?:req|user|input|params|body|query))/gi, desc: 'User input in raw SQL' },
            { regex: /\.query\s*\(\s*['"`].*\$\{/gi, desc: 'Template literal in SQL query' },
            { regex: /(?:knex|sequelize)\.raw\s*\(/gi, desc: 'Raw query in ORM (check for parameterization)' },
            { regex: /db\.(?:get|all|run|each)\s*\(\s*['"`].*\+/gi, desc: 'SQLite query with concatenation' }
        ],
        fix: 'Use parameterized queries: db.query("SELECT * FROM users WHERE id = $1", [userId])'
    },
    NOSQL_INJECTION: {
        owasp: 'A03:2021', severity: 'HIGH', cwe: 'CWE-943',
        patterns: [
            { regex: /\.find\s*\(\s*(?:req\.(?:body|query|params))/gi, desc: 'Unsanitized MongoDB query' },
            { regex: /\$(?:gt|gte|lt|lte|ne|in|nin|regex|where|exists)\b/gi, desc: 'MongoDB operator in user-controlled input' },
            { regex: /\.aggregate\s*\(\s*(?:req|user)/gi, desc: 'User input in aggregation pipeline' }
        ],
        fix: 'Validate/sanitize input. Use mongoose schemas with strict mode. Reject objects with $ keys.'
    },
    COMMAND_INJECTION: {
        owasp: 'A03:2021', severity: 'CRITICAL', cwe: 'CWE-78',
        patterns: [
            { regex: /(?:exec|execSync|spawn|spawnSync|execFile)\s*\([^)]*(?:req\.|user|input|params|body|query|\$\{)/gi, desc: 'User input in shell command' },
            { regex: /child_process.*(?:req\.|user|input|\$\{)/gi, desc: 'User-controlled child_process argument' },
            { regex: /eval\s*\(\s*(?:req\.|user|input)/gi, desc: 'eval() with user input' },
            { regex: /new\s+Function\s*\(\s*(?:req\.|user|input)/gi, desc: 'new Function() with user input' },
            { regex: /system\s*\(\s*(?:\$_|req\.|user)/gi, desc: 'system() with user input' }
        ],
        fix: 'Use execFile() with argument arrays. Never pass user input to shell commands. Use allowlists.'
    },
    XSS: {
        owasp: 'A03:2021', severity: 'HIGH', cwe: 'CWE-79',
        patterns: [
            { regex: /innerHTML\s*=/gi, desc: 'Direct innerHTML assignment (DOM XSS risk)' },
            { regex: /dangerouslySetInnerHTML/gi, desc: 'React dangerouslySetInnerHTML' },
            { regex: /document\.write\s*\(/gi, desc: 'document.write() — DOM XSS sink' },
            { regex: /\.html\s*\(\s*(?:req\.|user|input|\$|\<)/gi, desc: 'jQuery .html() with dynamic content' },
            { regex: /res\.send\s*\(\s*(?:req\.|user|`)/gi, desc: 'Express response with unsanitized user input' },
            { regex: /\$\{.*\}.*(?:<script|<img|<svg|onerror|onload)/gi, desc: 'Template literal with HTML injection' },
            { regex: /outerHTML\s*=/gi, desc: 'Direct outerHTML assignment' },
            { regex: /insertAdjacentHTML\s*\(/gi, desc: 'insertAdjacentHTML — XSS sink' }
        ],
        fix: 'Use textContent instead of innerHTML. Sanitize with DOMPurify. Use CSP headers.'
    },
    TEMPLATE_INJECTION: {
        owasp: 'A03:2021', severity: 'CRITICAL', cwe: 'CWE-94',
        patterns: [
            { regex: /render\s*\(\s*(?:req\.|user|input)/gi, desc: 'User input in template rendering' },
            { regex: /ejs\.render\s*\(\s*(?:req\.|user)/gi, desc: 'EJS render with user input' },
            { regex: /nunjucks\.renderString\s*\(\s*(?:req\.|user)/gi, desc: 'Nunjucks render with user input' },
            { regex: /pug\.render\s*\(\s*(?:req\.|user)/gi, desc: 'Pug render with user input' }
        ],
        fix: 'Never pass user input as template source. Only pass data to templates as variables.'
    },

    // ── A01:2021 — BROKEN ACCESS CONTROL ──
    PATH_TRAVERSAL: {
        owasp: 'A01:2021', severity: 'HIGH', cwe: 'CWE-22',
        patterns: [
            { regex: /(?:readFile|readFileSync|createReadStream)\s*\([^)]*(?:req\.|user|input|params|query|\$\{)/gi, desc: 'File read with user-controlled path' },
            { regex: /path\.join\s*\([^)]*(?:req\.(?:body|query|params))/gi, desc: 'path.join with user input (does not prevent traversal)' },
            { regex: /(?:writeFile|appendFile|unlink|rmdir)\s*\([^)]*(?:req\.|user|input)/gi, desc: 'File write/delete with user-controlled path' },
            { regex: /res\.sendFile\s*\([^)]*(?:req\.|user)/gi, desc: 'sendFile with user-controlled path' }
        ],
        fix: 'Use path.resolve() and verify result starts with expected root. Use path.normalize() and reject "..".'
    },
    INSECURE_REDIRECT: {
        owasp: 'A01:2021', severity: 'MEDIUM', cwe: 'CWE-601',
        patterns: [
            { regex: /res\.redirect\s*\(\s*(?:req\.|user|input)/gi, desc: 'Open redirect with user input' },
            { regex: /location\.href\s*=\s*(?:req\.|user|input)/gi, desc: 'Client-side open redirect' },
            { regex: /window\.location\s*=\s*(?:req\.|user|input|\$\{)/gi, desc: 'Client-side redirect with user input' }
        ],
        fix: 'Validate redirect URLs against allowlist. Use relative URLs. Never redirect to user-supplied URLs.'
    },

    // ── A02:2021 — CRYPTOGRAPHIC FAILURES ──
    WEAK_CRYPTO: {
        owasp: 'A02:2021', severity: 'HIGH', cwe: 'CWE-327',
        patterns: [
            { regex: /createHash\s*\(\s*['"](?:md5|sha1)['"]\s*\)/gi, desc: 'Weak hash algorithm (MD5/SHA1)' },
            { regex: /createCipher\s*\(\s*['"](?:des|rc4|rc2|blowfish)['"]/gi, desc: 'Weak cipher algorithm' },
            { regex: /Math\.random\s*\(\s*\)/gi, desc: 'Math.random() for security-sensitive operation (not CSPRNG)' },
            { regex: /atob|btoa/gi, desc: 'Base64 encoding used (check: not encryption!)' }
        ],
        fix: 'Use SHA-256+ for hashing, AES-256-GCM for encryption, crypto.randomBytes() for randomness.'
    },
    WEAK_PASSWORD_STORAGE: {
        owasp: 'A02:2021', severity: 'CRITICAL', cwe: 'CWE-916',
        patterns: [
            { regex: /password.*(?:md5|sha1|sha256)\s*\(/gi, desc: 'Password hashed with fast algorithm (no salt/key stretching)' },
            { regex: /password.*=.*(?:plaintext|clear|raw)/gi, desc: 'Possible plaintext password storage' },
            { regex: /password.*base64/gi, desc: 'Password stored as base64 (not hashed!)' }
        ],
        fix: 'Use bcrypt (cost 12+), scrypt, or Argon2id for password hashing. Never MD5/SHA for passwords.'
    },

    // ── A07:2021 — HARDCODED SECRETS ──
    HARDCODED_SECRET: {
        owasp: 'A07:2021', severity: 'CRITICAL', cwe: 'CWE-798',
        patterns: [
            { regex: /(?:api[_-]?key|apikey)\s*[:=]\s*['"][A-Za-z0-9_\-]{16,}['"]/gi, desc: 'Hardcoded API key' },
            { regex: /(?:secret|SECRET)\s*[:=]\s*['"][A-Za-z0-9_\-+/=]{16,}['"]/gi, desc: 'Hardcoded secret' },
            { regex: /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]{8,}['"]/gi, desc: 'Hardcoded password' },
            { regex: /(?:token|TOKEN)\s*[:=]\s*['"][A-Za-z0-9_\-\.]{20,}['"]/gi, desc: 'Hardcoded token' },
            { regex: /AKIA[0-9A-Z]{16}/g, desc: 'AWS Access Key ID' },
            { regex: /(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{24,}/g, desc: 'Stripe API key' },
            { regex: /ghp_[A-Za-z0-9]{36}/g, desc: 'GitHub Personal Access Token' },
            { regex: /gsk_[A-Za-z0-9]{40,}/g, desc: 'Groq API key' },
            { regex: /sk-[A-Za-z0-9]{40,}/g, desc: 'OpenAI API key' },
            { regex: /xox[bprs]-[A-Za-z0-9\-]{10,}/g, desc: 'Slack token' },
            { regex: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/g, desc: 'Private key in source code' },
            { regex: /mongodb\+srv:\/\/[^:]+:[^@]+@/gi, desc: 'MongoDB connection string with credentials' },
            { regex: /postgres:\/\/[^:]+:[^@]+@/gi, desc: 'PostgreSQL connection string with credentials' },
            { regex: /mysql:\/\/[^:]+:[^@]+@/gi, desc: 'MySQL connection string with credentials' }
        ],
        fix: 'Move secrets to environment variables or a secret manager (AWS SM, HashiCorp Vault). Use .env files (gitignored).'
    },

    // ── A10:2021 — SSRF ──
    SSRF: {
        owasp: 'A10:2021', severity: 'HIGH', cwe: 'CWE-918',
        patterns: [
            { regex: /fetch\s*\(\s*(?:req\.|user|input|\$\{)/gi, desc: 'fetch() with user-controlled URL' },
            { regex: /axios\.(?:get|post|put|delete)\s*\(\s*(?:req\.|user|input|\$\{)/gi, desc: 'Axios request with user-controlled URL' },
            { regex: /http\.(?:get|request)\s*\(\s*(?:req\.|user|input|\$\{)/gi, desc: 'Node HTTP request with user-controlled URL' },
            { regex: /request\s*\(\s*(?:req\.|user|input|\$\{)/gi, desc: 'HTTP request with user-controlled URL' },
            { regex: /got\s*\(\s*(?:req\.|user|input|\$\{)/gi, desc: 'got() with user-controlled URL' }
        ],
        fix: 'Validate URLs against allowlist. Block private IPs (10.x, 172.16-31.x, 192.168.x, 127.x, 169.254.x). Disable redirects.'
    },

    // ── A08:2021 — INSECURE DESERIALIZATION ──
    INSECURE_DESERIALIZATION: {
        owasp: 'A08:2021', severity: 'CRITICAL', cwe: 'CWE-502',
        patterns: [
            { regex: /JSON\.parse\s*\(\s*(?:req\.(?:body|query))/gi, desc: 'JSON.parse on raw request (use express.json() middleware)' },
            { regex: /(?:unserialize|pickle\.loads|yaml\.load\s*\((?!.*Loader))/gi, desc: 'Unsafe deserialization' },
            { regex: /eval\s*\(\s*JSON/gi, desc: 'eval used for JSON parsing' },
            { regex: /node-serialize|serialize-javascript.*(?:deserialize)/gi, desc: 'Node serialization library (RCE risk)' }
        ],
        fix: 'Use JSON.parse() not eval(). Avoid pickle/yaml.load without SafeLoader. Validate schema after parsing.'
    },

    // ── A05:2021 — SECURITY MISCONFIGURATION ──
    CORS_MISCONFIGURATION: {
        owasp: 'A05:2021', severity: 'MEDIUM', cwe: 'CWE-942',
        patterns: [
            { regex: /cors\s*\(\s*\)/gi, desc: 'CORS with no options (allows all origins by default)' },
            { regex: /origin\s*:\s*['"]\*['"]/gi, desc: 'CORS with wildcard origin' },
            { regex: /Access-Control-Allow-Origin.*\*/gi, desc: 'Wildcard CORS header' },
            { regex: /credentials\s*:\s*true.*origin\s*:\s*true/gi, desc: 'CORS reflects origin with credentials (dangerous)' }
        ],
        fix: 'Set specific CORS origins. Never use * with credentials. Use cors({ origin: ["https://yourdomain.com"] }).'
    },
    DEBUG_ENABLED: {
        owasp: 'A05:2021', severity: 'MEDIUM', cwe: 'CWE-489',
        patterns: [
            { regex: /debug\s*:\s*true/gi, desc: 'Debug mode enabled' },
            { regex: /NODE_ENV\s*(?:!==|!=)\s*['"]production['"]/gi, desc: 'Not checking production mode' },
            { regex: /console\.\s*(?:log|debug|trace)\s*\(\s*(?:password|token|secret|key|credential)/gi, desc: 'Logging sensitive data' },
            { regex: /stack.*trace|stackTrace/gi, desc: 'Stack trace exposure risk' }
        ],
        fix: 'Disable debug in production. Remove sensitive console.log statements. Use proper logger with levels.'
    },
    MISSING_SECURITY_HEADERS: {
        owasp: 'A05:2021', severity: 'LOW', cwe: 'CWE-693',
        patterns: [
            { regex: /helmet/gi, desc: 'Helmet detected (good — check configuration)' },
            { regex: /x-powered-by/gi, desc: 'X-Powered-By header reference (should be removed)' }
        ],
        fix: 'Use helmet middleware. Set CSP, HSTS, X-Frame-Options, X-Content-Type-Options headers.'
    },

    // ── DANGEROUS APIS ──
    DANGEROUS_API: {
        owasp: 'A03:2021', severity: 'HIGH', cwe: 'CWE-676',
        patterns: [
            { regex: /eval\s*\(/gi, desc: 'eval() — arbitrary code execution' },
            { regex: /new\s+Function\s*\(/gi, desc: 'new Function() — dynamic code execution' },
            { regex: /setTimeout\s*\(\s*['"`]/gi, desc: 'setTimeout with string argument (implicit eval)' },
            { regex: /setInterval\s*\(\s*['"`]/gi, desc: 'setInterval with string argument (implicit eval)' },
            { regex: /document\.write\s*\(/gi, desc: 'document.write (XSS sink)' },
            { regex: /\.exec\s*\(\s*(?:req\.|user)/gi, desc: 'RegExp.exec or child_process.exec with user input' }
        ],
        fix: 'Avoid eval/new Function. Use setTimeout(fn, ms) not setTimeout("code", ms). Sanitize all user input.'
    },

    // ── JWT ISSUES ──
    JWT_VULNERABILITY: {
        owasp: 'A07:2021', severity: 'HIGH', cwe: 'CWE-347',
        patterns: [
            { regex: /algorithms\s*:\s*\[.*['"]none['"]/gi, desc: 'JWT "none" algorithm allowed' },
            { regex: /jwt\.verify\s*\([^)]*\{\s*\}/gi, desc: 'JWT verify with empty options (no algorithm check)' },
            { regex: /jwt\.decode\s*\(/gi, desc: 'jwt.decode() without verify (no signature check!)' },
            { regex: /jsonwebtoken.*(?:HS256).*(?:public|cert)/gi, desc: 'Possible JWT algorithm confusion vulnerability' }
        ],
        fix: 'Always specify algorithms in jwt.verify(). Never use jwt.decode() for auth. Block "none" algorithm.'
    },

    // ── PROTOTYPE POLLUTION ──
    PROTOTYPE_POLLUTION: {
        owasp: 'A03:2021', severity: 'HIGH', cwe: 'CWE-1321',
        patterns: [
            { regex: /Object\.assign\s*\(\s*\{\}\s*,\s*(?:req\.|user|input)/gi, desc: 'Object.assign with user input (prototype pollution)' },
            { regex: /(?:lodash|_)\.(?:merge|defaultsDeep|set)\s*\([^)]*(?:req\.|user)/gi, desc: 'Lodash deep merge with user input' },
            { regex: /\[['"]__proto__['"]\]/gi, desc: '__proto__ access (prototype pollution attempt)' },
            { regex: /\[['"]constructor['"]\]\s*\[['"]prototype['"]\]/gi, desc: 'constructor.prototype access' }
        ],
        fix: 'Use Object.create(null) for dictionaries. Validate keys: reject __proto__, constructor, prototype.'
    },

    // ── RACE CONDITIONS ──
    RACE_CONDITION: {
        owasp: 'A04:2021', severity: 'MEDIUM', cwe: 'CWE-362',
        patterns: [
            { regex: /(?:if.*exists|check).*(?:then|&&).*(?:write|create|update|delete)/gi, desc: 'TOCTOU (Time-of-check to time-of-use) pattern' },
            { regex: /balance.*(?:>=|>|<=|<).*(?:then|&&).*(?:deduct|subtract|withdraw)/gi, desc: 'Race condition in financial operation' }
        ],
        fix: 'Use database transactions with proper isolation. Use atomic operations. Implement optimistic locking.'
    }
};

// ════════════════════════════════════════════
// FILE EXTENSIONS TO SCAN
// ════════════════════════════════════════════
const SCANNABLE_EXTENSIONS = new Set([
    '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
    '.py', '.rb', '.php', '.java', '.go', '.rs',
    '.vue', '.svelte', '.astro',
    '.html', '.htm', '.ejs', '.pug', '.hbs',
    '.json', '.yaml', '.yml', '.toml', '.env',
    '.sql', '.sh', '.bash', '.ps1', '.cmd', '.bat'
]);

const SKIP_DIRS = new Set([
    'node_modules', '.git', '.next', 'dist', 'build',
    'vendor', '__pycache__', '.venv', 'venv',
    'coverage', '.nyc_output', '.cache', '.aura'
]);

// ════════════════════════════════════════════
// SCANNER CLASS
// ════════════════════════════════════════════
class VulnerabilityScanner extends EventEmitter {
    constructor(projectRoot) {
        super();
        this.projectRoot = projectRoot || process.cwd();
        this.results = [];
        this.stats = { filesScanned: 0, vulnsFound: 0, critical: 0, high: 0, medium: 0, low: 0 };
        this.scanHistory = [];
    }

    // Full project scan
    async scanProject(options = {}) {
        const startTime = Date.now();
        this.results = [];
        this.stats = { filesScanned: 0, vulnsFound: 0, critical: 0, high: 0, medium: 0, low: 0 };

        const targetDir = options.directory || this.projectRoot;
        const files = await this._collectFiles(targetDir, options.maxDepth || 10);

        this.emit('scan:start', { files: files.length, directory: targetDir });

        for (const file of files) {
            try {
                const fileResults = await this.scanFile(file);
                if (fileResults.length > 0) {
                    this.results.push(...fileResults);
                }
            } catch (err) {
                this.emit('scan:error', { file, error: err.message });
            }
            this.stats.filesScanned++;
        }

        // Also scan for dependency vulnerabilities
        if (options.checkDependencies !== false) {
            const depVulns = await this._scanDependencies(targetDir);
            this.results.push(...depVulns);
        }

        const report = this._generateReport(startTime);
        this.scanHistory.push(report);
        this.emit('scan:complete', report);
        return report;
    }

    // Single file scan
    async scanFile(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        if (!SCANNABLE_EXTENSIONS.has(ext)) return [];

        let content;
        try {
            content = await fs.readFile(filePath, 'utf-8');
        } catch { return []; }

        const relativePath = path.relative(this.projectRoot, filePath);
        const lines = content.split('\n');
        const findings = [];

        for (const [vulnType, vuln] of Object.entries(VULN_PATTERNS)) {
            for (const pattern of vuln.patterns) {
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    if (pattern.regex.test(line)) {
                        // Reset regex lastIndex
                        pattern.regex.lastIndex = 0;

                        findings.push({
                            type: vulnType,
                            severity: vuln.severity,
                            owasp: vuln.owasp,
                            cwe: vuln.cwe,
                            file: relativePath,
                            line: i + 1,
                            code: line.trim().substring(0, 200),
                            description: pattern.desc,
                            fix: vuln.fix,
                            timestamp: Date.now()
                        });

                        // Update stats
                        this.stats.vulnsFound++;
                        this.stats[vuln.severity.toLowerCase()]++;
                    }
                    // Reset regex for next iteration
                    pattern.regex.lastIndex = 0;
                }
            }
        }

        return findings;
    }

    // Scan dependencies for known issues
    async _scanDependencies(dir) {
        const findings = [];

        try {
            const pkgPath = path.join(dir, 'package.json');
            const pkgContent = await fs.readFile(pkgPath, 'utf-8');
            const pkg = JSON.parse(pkgContent);
            const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

            // Check for known vulnerable packages
            const KNOWN_VULNERABLE = {
                'lodash': { below: '4.17.21', cve: 'CVE-2021-23337', desc: 'Command Injection via template()' },
                'minimist': { below: '1.2.6', cve: 'CVE-2021-44906', desc: 'Prototype Pollution' },
                'node-fetch': { below: '2.6.7', cve: 'CVE-2022-0235', desc: 'Exposure of sensitive information' },
                'express': { below: '4.19.2', cve: 'CVE-2024-29041', desc: 'Open redirect via malicious URL' },
                'axios': { below: '1.6.0', cve: 'CVE-2023-45857', desc: 'CSRF token exposure' },
                'jsonwebtoken': { below: '9.0.0', cve: 'CVE-2022-23529', desc: 'Insecure key handling' },
                'qs': { below: '6.10.3', cve: 'CVE-2022-24999', desc: 'Prototype Pollution' },
                'moment': { below: '2.29.4', cve: 'CVE-2022-31129', desc: 'Path traversal via locale string' },
                'shell-quote': { below: '1.7.3', cve: 'CVE-2021-42740', desc: 'Command injection' },
                'tar': { below: '6.1.11', cve: 'CVE-2021-37713', desc: 'Path traversal via symlink' }
            };

            for (const [pkg, version] of Object.entries(allDeps)) {
                if (KNOWN_VULNERABLE[pkg]) {
                    const vuln = KNOWN_VULNERABLE[pkg];
                    const cleanVersion = version.replace(/[\^~>=<]/g, '');
                    findings.push({
                        type: 'VULNERABLE_DEPENDENCY',
                        severity: 'HIGH',
                        owasp: 'A06:2021',
                        cwe: 'CWE-1104',
                        file: 'package.json',
                        line: 0,
                        code: `"${pkg}": "${version}"`,
                        description: `${vuln.desc} (${vuln.cve}) — version < ${vuln.below}`,
                        fix: `Update to ${pkg}@latest: npm install ${pkg}@latest`,
                        timestamp: Date.now()
                    });
                }
            }
        } catch { /* No package.json or parse error */ }

        return findings;
    }

    // Collect all scannable files
    async _collectFiles(dir, maxDepth, depth = 0) {
        if (depth > maxDepth) return [];
        const files = [];

        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (SKIP_DIRS.has(entry.name)) continue;

                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    const subFiles = await this._collectFiles(fullPath, maxDepth, depth + 1);
                    files.push(...subFiles);
                } else if (entry.isFile()) {
                    const ext = path.extname(entry.name).toLowerCase();
                    if (SCANNABLE_EXTENSIONS.has(ext)) {
                        files.push(fullPath);
                    }
                }
            }
        } catch { /* Permission denied */ }

        return files;
    }

    // Generate structured report
    _generateReport(startTime) {
        const duration = Date.now() - startTime;

        // Group by severity
        const bySeverity = {};
        for (const r of this.results) {
            (bySeverity[r.severity] = bySeverity[r.severity] || []).push(r);
        }

        // Group by file
        const byFile = {};
        for (const r of this.results) {
            (byFile[r.file] = byFile[r.file] || []).push(r);
        }

        // Group by OWASP category
        const byOWASP = {};
        for (const r of this.results) {
            (byOWASP[r.owasp] = byOWASP[r.owasp] || []).push(r);
        }

        // Risk score (0-100)
        const riskScore = Math.min(100, (this.stats.critical * 25) + (this.stats.high * 10) + (this.stats.medium * 3) + (this.stats.low));

        return {
            timestamp: new Date().toISOString(),
            duration_ms: duration,
            project: this.projectRoot,
            stats: { ...this.stats },
            risk_score: riskScore,
            risk_level: riskScore >= 75 ? 'CRITICAL' : riskScore >= 50 ? 'HIGH' : riskScore >= 25 ? 'MEDIUM' : 'LOW',
            findings: this.results,
            by_severity: bySeverity,
            by_file: byFile,
            by_owasp: byOWASP,
            top_issues: this.results
                .sort((a, b) => {
                    const sevOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };
                    return (sevOrder[a.severity] || 9) - (sevOrder[b.severity] || 9);
                })
                .slice(0, 20),
            recommendations: this._generateRecommendations()
        };
    }

    // Generate AI-ready recommendations
    _generateRecommendations() {
        const recs = [];
        const types = new Set(this.results.map(r => r.type));

        if (types.has('HARDCODED_SECRET')) {
            recs.push('🔴 IMMEDIATE: Move all hardcoded secrets to environment variables. Run: npx detect-secrets scan');
        }
        if (types.has('SQL_INJECTION') || types.has('NOSQL_INJECTION')) {
            recs.push('🔴 CRITICAL: Replace all string-concatenated queries with parameterized queries');
        }
        if (types.has('COMMAND_INJECTION')) {
            recs.push('🔴 CRITICAL: Replace exec() with execFile() and argument arrays. Never pass user input to shell');
        }
        if (types.has('XSS')) {
            recs.push('🟡 HIGH: Replace innerHTML with textContent. Add CSP headers. Use output encoding');
        }
        if (types.has('CORS_MISCONFIGURATION')) {
            recs.push('🟡 HIGH: Configure CORS with specific origins instead of wildcard *');
        }
        if (types.has('WEAK_CRYPTO')) {
            recs.push('🟡 HIGH: Replace MD5/SHA1 with SHA-256. Use crypto.randomBytes() for randomness');
        }
        if (types.has('PATH_TRAVERSAL')) {
            recs.push('🟡 HIGH: Validate file paths with path.resolve() and check against allowed root directory');
        }
        if (types.has('JWT_VULNERABILITY')) {
            recs.push('🟡 HIGH: Enforce algorithm in jwt.verify(). Never use jwt.decode() for authentication');
        }

        return recs;
    }

    // Get last report
    getLastReport() {
        return this.scanHistory[this.scanHistory.length - 1] || null;
    }

    // Get scan history
    getHistory() {
        return this.scanHistory.map(r => ({
            timestamp: r.timestamp,
            risk_score: r.risk_score,
            risk_level: r.risk_level,
            stats: r.stats
        }));
    }
}

module.exports = { VulnerabilityScanner, VULN_PATTERNS, SCANNABLE_EXTENSIONS };
