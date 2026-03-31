// ════════════════════════════════════════════════════════════════
//  🕷️ AURA HIVE v5.0 — OSINT & WEB RECONNAISSANCE ENGINE
//  Automated recon: DNS, subdomains, ports, SSL, headers, tech
//  100% native Node.js — zero external dependencies
// ════════════════════════════════════════════════════════════════
const dns = require('dns').promises;
const net = require('net');
const tls = require('tls');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const crypto = require('crypto');
const { EventEmitter } = require('events');

// ════════════════════════════════════════════
// TECH FINGERPRINT SIGNATURES
// ════════════════════════════════════════════
const TECH_SIGNATURES = {
    // Server-side
    'Node.js/Express': { headers: ['x-powered-by: express'] },
    'PHP': { headers: ['x-powered-by: php'] },
    'ASP.NET': { headers: ['x-aspnet-version', 'x-powered-by: asp.net'] },
    'Django': { headers: ['x-frame-options: deny'], body: ['csrfmiddlewaretoken'] },
    'Ruby on Rails': { headers: ['x-powered-by: phusion passenger', 'x-runtime'], body: ['csrf-token'] },
    'Java/Spring': { headers: ['x-application-context'], body: ['jsessionid'] },

    // Frontend frameworks (body patterns)
    'React': { body: ['_reactRootContainer', '__NEXT_DATA__', 'react-root', 'data-reactroot'] },
    'Next.js': { body: ['__NEXT_DATA__', '_next/static', 'next/dist'] },
    'Vue.js': { body: ['data-v-', '__vue__', 'vue-router'] },
    'Nuxt.js': { body: ['__NUXT__', '_nuxt/'] },
    'Angular': { body: ['ng-version', 'ng-app', 'angular.min.js'] },
    'Svelte': { body: ['__svelte'] },

    // CMS
    'WordPress': { body: ['wp-content', 'wp-includes', 'wp-json', '/xmlrpc.php'] },
    'Drupal': { body: ['Drupal.settings', 'drupal.js', 'sites/default'] },
    'Joomla': { body: ['/media/jui/', 'Joomla!'] },
    'Shopify': { body: ['cdn.shopify.com', 'Shopify.theme'] },
    'Webflow': { body: ['webflow.js', 'wf-page'] },
    'Ghost': { body: ['ghost.url', 'ghost-'] },
    'Squarespace': { body: ['squarespace.com', 'static.squarespace'] },

    // CDN / Infrastructure
    'Cloudflare': { headers: ['server: cloudflare', 'cf-ray'] },
    'AWS CloudFront': { headers: ['x-amz-cf-id', 'via: cloudfront'] },
    'Vercel': { headers: ['x-vercel-id', 'server: vercel'] },
    'Netlify': { headers: ['x-nf-request-id', 'server: netlify'] },
    'Nginx': { headers: ['server: nginx'] },
    'Apache': { headers: ['server: apache'] },
    'IIS': { headers: ['server: microsoft-iis'] },
    'LiteSpeed': { headers: ['server: litespeed'] },

    // Security
    'WAF Detected': { headers: ['x-sucuri-id', 'x-cdn: imperva', 'server: cloudflare'] },
    'Akamai': { headers: ['x-akamai-transformed', 'server: akamaighost'] }
};

// ════════════════════════════════════════════
// SUBDOMAIN WORDLIST (top entries)
// ════════════════════════════════════════════
const SUBDOMAIN_WORDLIST = [
    'www', 'mail', 'ftp', 'admin', 'api', 'app', 'dev', 'staging', 'test',
    'blog', 'shop', 'store', 'help', 'support', 'portal', 'secure', 'vpn',
    'remote', 'cms', 'cdn', 'assets', 'static', 'media', 'img', 'images',
    'docs', 'wiki', 'git', 'gitlab', 'github', 'ci', 'jenkins', 'monitor',
    'grafana', 'prometheus', 'kibana', 'elastic', 'status', 'health',
    'login', 'auth', 'sso', 'oauth', 'id', 'accounts', 'register',
    'dashboard', 'panel', 'console', 'control', 'manage', 'manager',
    'internal', 'intranet', 'extranet', 'private', 'corp', 'office',
    'm', 'mobile', 'wap', 'mobi',
    'ns1', 'ns2', 'ns3', 'dns', 'dns1', 'dns2',
    'mx', 'mx1', 'mx2', 'smtp', 'pop', 'imap', 'webmail', 'exchange',
    'db', 'database', 'sql', 'mysql', 'postgres', 'mongo', 'redis',
    'cache', 'proxy', 'gateway', 'lb', 'load', 'balancer',
    'staging', 'uat', 'qa', 'preprod', 'pre', 'beta', 'alpha', 'canary',
    'backup', 'bak', 'old', 'legacy', 'archive', 'temp', 'tmp',
    'sandbox', 'demo', 'poc', 'lab', 'playground',
    'v1', 'v2', 'v3', 'api-v1', 'api-v2',
    'ws', 'websocket', 'socket', 'wss',
    'relay', 'edge', 'origin', 'upstream',
    's3', 'bucket', 'storage', 'files', 'upload', 'downloads',
    'payment', 'billing', 'checkout', 'orders',
    'tracking', 'analytics', 'stats', 'metrics',
    'notify', 'push', 'events', 'hooks', 'webhooks', 'callback',
    'search', 'solr', 'elasticsearch',
    'queue', 'mq', 'rabbitmq', 'kafka',
    'crm', 'erp', 'hr', 'finance',
    'autodiscover', 'autoconfig', 'lyncdiscover',
    'cpanel', 'whm', 'plesk', 'webmin'
];

// ════════════════════════════════════════════
// SECURITY HEADERS TO CHECK
// ════════════════════════════════════════════
const REQUIRED_SECURITY_HEADERS = {
    'strict-transport-security': { required: true, desc: 'HSTS — Force HTTPS', severity: 'HIGH' },
    'content-security-policy': { required: true, desc: 'CSP — Prevent XSS/injection', severity: 'HIGH' },
    'x-content-type-options': { required: true, desc: 'Prevent MIME sniffing', severity: 'MEDIUM' },
    'x-frame-options': { required: true, desc: 'Prevent clickjacking', severity: 'MEDIUM' },
    'referrer-policy': { required: true, desc: 'Control referrer info', severity: 'LOW' },
    'permissions-policy': { required: false, desc: 'Control browser features', severity: 'LOW' },
    'cross-origin-opener-policy': { required: false, desc: 'Isolate browsing context', severity: 'LOW' },
    'cross-origin-resource-policy': { required: false, desc: 'Control cross-origin reads', severity: 'LOW' }
};

const DANGEROUS_HEADERS = ['x-powered-by', 'server', 'x-aspnet-version', 'x-debug-token'];

// ════════════════════════════════════════════
// RECON ENGINE CLASS
// ════════════════════════════════════════════
class ReconEngine extends EventEmitter {
    constructor() {
        super();
        this.reports = [];
    }

    // ── Full recon scan ──
    async fullScan(target, options = {}) {
        const startTime = Date.now();
        const modules = options.modules || ['dns', 'ports', 'headers', 'ssl', 'tech', 'subdomains'];
        const report = {
            target,
            timestamp: new Date().toISOString(),
            modules: {},
            risk_score: 0,
            issues: []
        };

        this.emit('recon:start', { target, modules });

        // DNS Resolution
        if (modules.includes('dns')) {
            try {
                report.modules.dns = await this.dnsEnum(target);
                this.emit('recon:module', { module: 'dns', status: 'done' });
            } catch (e) { report.modules.dns = { error: e.message }; }
        }

        // Port Scan
        if (modules.includes('ports')) {
            try {
                const ports = options.ports || [21, 22, 25, 53, 80, 110, 143, 443, 445, 993, 995, 1433, 3306, 3389, 5432, 6379, 8080, 8443, 9200, 27017];
                report.modules.ports = await this.portScan(target, ports, options.timeout || 2000);
                this.emit('recon:module', { module: 'ports', status: 'done' });
            } catch (e) { report.modules.ports = { error: e.message }; }
        }

        // HTTP Headers & Security
        if (modules.includes('headers')) {
            try {
                report.modules.headers = await this.analyzeHeaders(target);
                report.issues.push(...(report.modules.headers.issues || []));
                this.emit('recon:module', { module: 'headers', status: 'done' });
            } catch (e) { report.modules.headers = { error: e.message }; }
        }

        // SSL/TLS Analysis
        if (modules.includes('ssl')) {
            try {
                report.modules.ssl = await this.analyzeSsl(target);
                report.issues.push(...(report.modules.ssl.issues || []));
                this.emit('recon:module', { module: 'ssl', status: 'done' });
            } catch (e) { report.modules.ssl = { error: e.message }; }
        }

        // Technology Detection
        if (modules.includes('tech')) {
            try {
                report.modules.tech = await this.detectTech(target);
                this.emit('recon:module', { module: 'tech', status: 'done' });
            } catch (e) { report.modules.tech = { error: e.message }; }
        }

        // Subdomain Enumeration
        if (modules.includes('subdomains')) {
            try {
                const maxSubs = options.maxSubdomains || 30;
                report.modules.subdomains = await this.enumerateSubdomains(target, maxSubs);
                this.emit('recon:module', { module: 'subdomains', status: 'done' });
            } catch (e) { report.modules.subdomains = { error: e.message }; }
        }

        // Calculate risk score
        report.risk_score = this._calculateRisk(report);
        report.duration_ms = Date.now() - startTime;

        this.reports.push(report);
        this.emit('recon:complete', report);
        return report;
    }

    // ── DNS Enumeration ──
    async dnsEnum(domain) {
        const clean = domain.replace(/^https?:\/\//, '').replace(/[:/].*$/, '');
        const results = { domain: clean, records: {} };

        const recordTypes = [
            { type: 'A', fn: () => dns.resolve4(clean) },
            { type: 'AAAA', fn: () => dns.resolve6(clean) },
            { type: 'MX', fn: () => dns.resolveMx(clean) },
            { type: 'NS', fn: () => dns.resolveNs(clean) },
            { type: 'TXT', fn: () => dns.resolveTxt(clean) },
            { type: 'CNAME', fn: () => dns.resolveCname(clean) },
            { type: 'SOA', fn: () => dns.resolveSoa(clean) }
        ];

        for (const rt of recordTypes) {
            try {
                results.records[rt.type] = await rt.fn();
            } catch { results.records[rt.type] = []; }
        }

        // Reverse DNS for IPs
        try {
            if (results.records.A && results.records.A.length > 0) {
                results.reverse_dns = await dns.reverse(results.records.A[0]);
            }
        } catch { results.reverse_dns = []; }

        // SPF/DMARC analysis from TXT records
        const txtFlat = (results.records.TXT || []).flat();
        results.spf = txtFlat.find(t => t.startsWith('v=spf1')) || 'NOT SET';
        results.dmarc = txtFlat.find(t => t.startsWith('v=DMARC1')) || 'NOT SET';

        return results;
    }

    // ── TCP Port Scanner ──
    async portScan(target, ports, timeout = 2000) {
        const clean = target.replace(/^https?:\/\//, '').replace(/[:/].*$/, '');
        const COMMON_SERVICES = {
            21: 'FTP', 22: 'SSH', 23: 'Telnet', 25: 'SMTP', 53: 'DNS',
            80: 'HTTP', 110: 'POP3', 143: 'IMAP', 443: 'HTTPS', 445: 'SMB',
            993: 'IMAPS', 995: 'POP3S', 1433: 'MSSQL', 3306: 'MySQL',
            3389: 'RDP', 5432: 'PostgreSQL', 6379: 'Redis', 8080: 'HTTP-Alt',
            8443: 'HTTPS-Alt', 9200: 'Elasticsearch', 27017: 'MongoDB'
        };

        const openPorts = [];
        const closedPorts = [];

        // Scan in batches of 10 for speed
        const batchSize = 10;
        for (let i = 0; i < ports.length; i += batchSize) {
            const batch = ports.slice(i, i + batchSize);
            const results = await Promise.all(
                batch.map(port => this._checkPort(clean, port, timeout))
            );
            results.forEach((isOpen, idx) => {
                const port = batch[idx];
                if (isOpen) {
                    openPorts.push({ port, service: COMMON_SERVICES[port] || 'Unknown', state: 'OPEN' });
                } else {
                    closedPorts.push(port);
                }
            });
        }

        return {
            host: clean,
            open_ports: openPorts,
            closed_count: closedPorts.length,
            total_scanned: ports.length
        };
    }

    // Check single port
    _checkPort(host, port, timeout) {
        return new Promise(resolve => {
            const socket = new net.Socket();
            socket.setTimeout(timeout);
            socket.on('connect', () => { socket.destroy(); resolve(true); });
            socket.on('timeout', () => { socket.destroy(); resolve(false); });
            socket.on('error', () => { socket.destroy(); resolve(false); });
            socket.connect(port, host);
        });
    }

    // ── HTTP Header Analysis ──
    async analyzeHeaders(target) {
        const url = target.startsWith('http') ? target : `https://${target}`;
        const response = await this._httpGet(url);
        const headers = response.headers || {};
        const issues = [];

        // Check missing security headers
        const missingHeaders = [];
        const presentHeaders = {};
        for (const [header, config] of Object.entries(REQUIRED_SECURITY_HEADERS)) {
            const value = headers[header];
            if (!value) {
                if (config.required) {
                    issues.push({
                        type: 'MISSING_SECURITY_HEADER',
                        severity: config.severity,
                        header,
                        description: `Missing ${config.desc}`
                    });
                }
                missingHeaders.push(header);
            } else {
                presentHeaders[header] = value;
            }
        }

        // Check dangerous info-leak headers
        const infoLeaks = [];
        for (const h of DANGEROUS_HEADERS) {
            if (headers[h]) {
                infoLeaks.push({ header: h, value: headers[h] });
                issues.push({
                    type: 'INFO_LEAK_HEADER',
                    severity: 'LOW',
                    header: h,
                    value: headers[h],
                    description: `Server exposes ${h}: ${headers[h]}`
                });
            }
        }

        // Check CORS
        const corsOrigin = headers['access-control-allow-origin'];
        if (corsOrigin === '*') {
            issues.push({
                type: 'CORS_WILDCARD',
                severity: 'MEDIUM',
                description: 'CORS allows all origins (*) — potential data exposure'
            });
        }

        // Check cookies
        const setCookie = headers['set-cookie'];
        if (setCookie) {
            const cookieStr = Array.isArray(setCookie) ? setCookie.join('; ') : setCookie;
            if (!cookieStr.includes('HttpOnly')) {
                issues.push({ type: 'COOKIE_NO_HTTPONLY', severity: 'MEDIUM', description: 'Cookie missing HttpOnly flag' });
            }
            if (!cookieStr.includes('Secure')) {
                issues.push({ type: 'COOKIE_NO_SECURE', severity: 'MEDIUM', description: 'Cookie missing Secure flag' });
            }
            if (!cookieStr.includes('SameSite')) {
                issues.push({ type: 'COOKIE_NO_SAMESITE', severity: 'LOW', description: 'Cookie missing SameSite attribute' });
            }
        }

        return {
            url,
            status_code: response.statusCode,
            all_headers: headers,
            security_headers: presentHeaders,
            missing_headers: missingHeaders,
            info_leaks: infoLeaks,
            cors: corsOrigin || 'Not set',
            issues
        };
    }

    // ── SSL/TLS Analysis ──
    async analyzeSsl(target) {
        const host = target.replace(/^https?:\/\//, '').replace(/[:/].*$/, '');
        const issues = [];

        return new Promise((resolve) => {
            const socket = tls.connect(443, host, { servername: host, rejectUnauthorized: false }, () => {
                const cert = socket.getPeerCertificate(true);
                const cipher = socket.getCipher();
                const protocol = socket.getProtocol();

                // Certificate analysis
                const validFrom = new Date(cert.valid_from);
                const validTo = new Date(cert.valid_to);
                const daysUntilExpiry = Math.floor((validTo - Date.now()) / (1000 * 60 * 60 * 24));
                const isExpired = daysUntilExpiry < 0;
                const isExpiringSoon = daysUntilExpiry < 30 && daysUntilExpiry >= 0;

                if (isExpired) {
                    issues.push({ type: 'SSL_CERT_EXPIRED', severity: 'CRITICAL', description: `Certificate expired ${Math.abs(daysUntilExpiry)} days ago` });
                } else if (isExpiringSoon) {
                    issues.push({ type: 'SSL_CERT_EXPIRING', severity: 'HIGH', description: `Certificate expires in ${daysUntilExpiry} days` });
                }

                // Protocol version check
                if (protocol === 'TLSv1' || protocol === 'TLSv1.1') {
                    issues.push({ type: 'WEAK_TLS_VERSION', severity: 'HIGH', description: `Deprecated TLS version: ${protocol}` });
                }

                // Cipher strength
                const weakCiphers = ['RC4', 'DES', '3DES', 'NULL', 'EXPORT', 'anon'];
                if (cipher && weakCiphers.some(wc => cipher.name.toUpperCase().includes(wc))) {
                    issues.push({ type: 'WEAK_CIPHER', severity: 'HIGH', description: `Weak cipher suite: ${cipher.name}` });
                }

                // Self-signed check
                if (cert.issuer && cert.subject && JSON.stringify(cert.issuer) === JSON.stringify(cert.subject)) {
                    issues.push({ type: 'SELF_SIGNED_CERT', severity: 'MEDIUM', description: 'Self-signed certificate detected' });
                }

                socket.end();

                resolve({
                    host,
                    protocol,
                    cipher: cipher ? { name: cipher.name, version: cipher.version, bits: cipher.bits } : null,
                    certificate: {
                        subject: cert.subject,
                        issuer: cert.issuer,
                        valid_from: cert.valid_from,
                        valid_to: cert.valid_to,
                        days_until_expiry: daysUntilExpiry,
                        serial: cert.serialNumber,
                        fingerprint: cert.fingerprint256,
                        san: cert.subjectaltname
                    },
                    is_expired: isExpired,
                    is_expiring_soon: isExpiringSoon,
                    issues
                });
            });

            socket.on('error', (err) => {
                resolve({ host, error: err.message, issues: [{ type: 'SSL_CONNECTION_FAILED', severity: 'HIGH', description: err.message }] });
            });

            socket.setTimeout(10000, () => {
                socket.destroy();
                resolve({ host, error: 'Connection timeout', issues: [] });
            });
        });
    }

    // ── Technology Detection ──
    async detectTech(target) {
        const url = target.startsWith('http') ? target : `https://${target}`;
        const response = await this._httpGet(url);
        const headers = response.headers || {};
        const body = (response.body || '').toLowerCase();
        const headersStr = Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join('\n').toLowerCase();

        const detected = [];

        for (const [tech, sigs] of Object.entries(TECH_SIGNATURES)) {
            let found = false;

            // Check headers
            if (sigs.headers) {
                for (const hSig of sigs.headers) {
                    if (headersStr.includes(hSig.toLowerCase())) {
                        found = true;
                        break;
                    }
                }
            }

            // Check body
            if (!found && sigs.body) {
                for (const bSig of sigs.body) {
                    if (body.includes(bSig.toLowerCase())) {
                        found = true;
                        break;
                    }
                }
            }

            if (found) detected.push(tech);
        }

        return { url, technologies: detected, count: detected.length };
    }

    // ── Subdomain Enumeration ──
    async enumerateSubdomains(domain, maxResults = 30) {
        const clean = domain.replace(/^https?:\/\//, '').replace(/[:/].*$/, '');
        const found = [];
        let checked = 0;

        // Batch DNS resolution
        const batchSize = 15;
        for (let i = 0; i < SUBDOMAIN_WORDLIST.length && found.length < maxResults; i += batchSize) {
            const batch = SUBDOMAIN_WORDLIST.slice(i, i + batchSize);
            const results = await Promise.allSettled(
                batch.map(sub => {
                    const subdomain = `${sub}.${clean}`;
                    return dns.resolve4(subdomain)
                        .then(ips => ({ subdomain, ips, exists: true }))
                        .catch(() => ({ subdomain, exists: false }));
                })
            );

            for (const result of results) {
                checked++;
                if (result.status === 'fulfilled' && result.value.exists) {
                    found.push(result.value);
                    this.emit('recon:subdomain', result.value);
                    if (found.length >= maxResults) break;
                }
            }
        }

        return { domain: clean, found, total_found: found.length, total_checked: checked };
    }

    // ── HTTP GET Helper ──
    _httpGet(url, maxRedirects = 3) {
        return new Promise((resolve, reject) => {
            const isHttps = url.startsWith('https');
            const lib = isHttps ? https : http;
            const options = {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AuraHive/5.0 SecurityScanner',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                },
                rejectUnauthorized: false
            };

            const req = lib.get(url, options, (res) => {
                // Follow redirects
                if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location && maxRedirects > 0) {
                    const redirectUrl = res.headers.location.startsWith('http')
                        ? res.headers.location
                        : new URL(res.headers.location, url).href;
                    return this._httpGet(redirectUrl, maxRedirects - 1).then(resolve).catch(reject);
                }

                let body = '';
                res.setEncoding('utf-8');
                res.on('data', chunk => { body += chunk; if (body.length > 500000) res.destroy(); });
                res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: body.substring(0, 200000) }));
            });

            req.on('error', err => resolve({ statusCode: 0, headers: {}, body: '', error: err.message }));
            req.on('timeout', () => { req.destroy(); resolve({ statusCode: 0, headers: {}, body: '', error: 'Timeout' }); });
        });
    }

    // Calculate risk score
    _calculateRisk(report) {
        let score = 0;
        const sevWeights = { CRITICAL: 25, HIGH: 10, MEDIUM: 5, LOW: 2 };

        for (const issue of report.issues) {
            score += sevWeights[issue.severity] || 1;
        }

        // Open dangerous ports
        const dangerPorts = [21, 23, 25, 445, 1433, 3306, 3389, 5432, 6379, 9200, 27017];
        if (report.modules.ports && report.modules.ports.open_ports) {
            for (const p of report.modules.ports.open_ports) {
                if (dangerPorts.includes(p.port)) score += 10;
            }
        }

        return Math.min(100, score);
    }

    // Get report by index or last
    getReport(index) {
        if (index === undefined) return this.reports[this.reports.length - 1];
        return this.reports[index] || null;
    }

    getHistory() {
        return this.reports.map((r, i) => ({
            index: i,
            target: r.target,
            timestamp: r.timestamp,
            risk_score: r.risk_score,
            duration_ms: r.duration_ms
        }));
    }
}

module.exports = { ReconEngine, TECH_SIGNATURES, SUBDOMAIN_WORDLIST, REQUIRED_SECURITY_HEADERS };
