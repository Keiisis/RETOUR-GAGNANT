// ════════════════════════════════════════════════════════════════
//  🔐 AURA HIVE v5.0 — REAL-TIME SECURITY MONITOR (BLUE TEAM)
//  File integrity, anomaly detection, rate limiting, auto-response
//  Streams alerts via SSE for real-time dashboard
// ════════════════════════════════════════════════════════════════
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { EventEmitter } = require('events');

// ════════════════════════════════════════════
// ATTACK SIGNATURE DATABASE
// ════════════════════════════════════════════
const ATTACK_SIGNATURES = {
    SQL_INJECTION: {
        pattern: /('|"|;|--|\b(OR|AND|UNION|SELECT|DROP|INSERT|DELETE|UPDATE|ALTER|CREATE|EXEC|EXECUTE)\b)/gi,
        severity: 'HIGH',
        description: 'SQL Injection attempt detected'
    },
    XSS_ATTEMPT: {
        pattern: /(<script|javascript:|onerror\s*=|onload\s*=|eval\s*\(|alert\s*\(|<svg|<img[^>]+on\w+\s*=)/gi,
        severity: 'HIGH',
        description: 'Cross-Site Scripting attempt detected'
    },
    PATH_TRAVERSAL: {
        pattern: /(\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e\/|\.\.%2f|%252e%252e)/gi,
        severity: 'HIGH',
        description: 'Path traversal attempt detected'
    },
    COMMAND_INJECTION: {
        pattern: /([;&|`$]\s*(?:cat|ls|wget|curl|nc|bash|sh|python|perl|ruby|php|powershell|cmd))/gi,
        severity: 'CRITICAL',
        description: 'Command injection attempt detected'
    },
    SSRF_ATTEMPT: {
        pattern: /(169\.254\.169\.254|metadata\.google|127\.0\.0\.1|localhost|0x7f|file:\/\/|gopher:\/\/|dict:\/\/)/gi,
        severity: 'HIGH',
        description: 'SSRF attempt detected'
    },
    SENSITIVE_FILE_ACCESS: {
        pattern: /(\/etc\/passwd|\/etc\/shadow|\.env|\.git\/config|wp-config\.php|web\.config|\.htaccess|id_rsa)/gi,
        severity: 'CRITICAL',
        description: 'Sensitive file access attempt'
    },
    BRUTE_FORCE: {
        // Handled programmatically
        threshold: 10,
        windowMs: 60000,
        severity: 'HIGH',
        description: 'Brute force attack detected'
    }
};

// ════════════════════════════════════════════
// CRITICAL FILES TO MONITOR (FIM)
// ════════════════════════════════════════════
const CRITICAL_FILE_PATTERNS = [
    '**/*.env', '**/*.env.*',
    '**/package.json', '**/package-lock.json',
    '**/.gitignore', '**/.git/config',
    '**/firebase.json', '**/firestore.rules',
    '**/docker-compose.yml', '**/Dockerfile',
    '**/*.key', '**/*.pem', '**/*.cert',
    '**/config.js', '**/config.ts', '**/config.json',
    '**/auth*.js', '**/auth*.ts',
    '**/middleware*.js', '**/middleware*.ts'
];

// ════════════════════════════════════════════
// SECURITY MONITOR CLASS
// ════════════════════════════════════════════
class SecurityMonitor extends EventEmitter {
    constructor(projectRoot, options = {}) {
        super();
        this.projectRoot = projectRoot || process.cwd();
        this.isRunning = false;

        // File Integrity Monitoring
        this.fileHashes = new Map();        // filepath → SHA-256 hash
        this.fimInterval = null;
        this.fimIntervalMs = options.fimIntervalMs || 30000; // 30 seconds

        // Request monitoring
        this.requestLog = [];               // { ip, path, method, timestamp, flagged }
        this.ipCounters = new Map();        // ip → { count, firstRequest, blocked }
        this.blockedIPs = new Set();

        // Alerts
        this.alerts = [];                   // { id, timestamp, type, severity, description, details }
        this.maxAlerts = options.maxAlerts || 5000;

        // Rate limiting config
        this.rateLimit = {
            maxRequests: options.maxRequests || 100,
            windowMs: options.windowMs || 60000,
            blockDurationMs: options.blockDurationMs || 300000
        };

        // SSE clients for real-time streaming
        this.sseClients = [];

        // Stats
        this.stats = {
            started_at: null,
            requests_analyzed: 0,
            attacks_detected: 0,
            ips_blocked: 0,
            files_monitored: 0,
            integrity_violations: 0
        };
    }

    // ── Start Monitoring ──
    async start() {
        if (this.isRunning) return { status: 'already_running' };

        this.isRunning = true;
        this.stats.started_at = new Date().toISOString();

        // Initialize File Integrity baselines
        await this._initFileIntegrity();

        // Start FIM periodic check
        this.fimInterval = setInterval(() => this._checkFileIntegrity(), this.fimIntervalMs);

        // Start IP counter cleanup
        this._ipCleanupInterval = setInterval(() => this._cleanupIPCounters(), this.rateLimit.windowMs);

        this._raiseAlert('INFO', 'MONITOR_STARTED', 'Security Monitor activated', {
            files_monitored: this.fileHashes.size,
            rate_limit: `${this.rateLimit.maxRequests} req/${this.rateLimit.windowMs / 1000}s`
        });

        this.emit('monitor:started', this.stats);
        return { status: 'started', files_monitored: this.fileHashes.size };
    }

    // ── Stop Monitoring ──
    stop() {
        this.isRunning = false;
        if (this.fimInterval) clearInterval(this.fimInterval);
        if (this._ipCleanupInterval) clearInterval(this._ipCleanupInterval);

        this._raiseAlert('INFO', 'MONITOR_STOPPED', 'Security Monitor deactivated');
        this.emit('monitor:stopped');
        return { status: 'stopped', stats: this.getStats() };
    }

    // ── Analyze Incoming Request ──
    analyzeRequest(req) {
        if (!this.isRunning) return { allowed: true };

        const ip = req.ip || req.connection?.remoteAddress || 'unknown';
        const reqPath = req.path || req.url || '/';
        const method = req.method || 'GET';
        const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
        const queryString = req.originalUrl || reqPath;
        const userAgent = req.headers?.['user-agent'] || '';
        const fullInput = `${queryString} ${body} ${userAgent}`;

        this.stats.requests_analyzed++;

        // Check if IP is blocked
        if (this.blockedIPs.has(ip)) {
            return { allowed: false, reason: 'IP blocked', ip };
        }

        // Rate limiting
        const rateLimited = this._checkRateLimit(ip);
        if (rateLimited) {
            this._raiseAlert('HIGH', 'RATE_LIMIT_EXCEEDED', `Rate limit exceeded by ${ip}`, { ip, path: reqPath });
            return { allowed: false, reason: 'Rate limit exceeded', ip };
        }

        // Attack signature detection
        const attacks = this._detectAttacks(fullInput, ip, reqPath);

        // Log request
        this.requestLog.push({
            ip, path: reqPath, method,
            timestamp: Date.now(),
            flagged: attacks.length > 0,
            attacks: attacks.map(a => a.type)
        });

        // Trim request log
        if (this.requestLog.length > 10000) {
            this.requestLog = this.requestLog.slice(-5000);
        }

        if (attacks.length > 0) {
            return { allowed: true, warned: true, attacks };
        }

        return { allowed: true };
    }

    // ── Detect Attacks in Input ──
    _detectAttacks(input, ip, path) {
        const detected = [];

        for (const [type, sig] of Object.entries(ATTACK_SIGNATURES)) {
            if (type === 'BRUTE_FORCE') continue; // Handled by rate limiter

            if (sig.pattern && sig.pattern.test(input)) {
                sig.pattern.lastIndex = 0; // Reset regex

                detected.push({ type, severity: sig.severity });

                this.stats.attacks_detected++;
                this._raiseAlert(sig.severity, type, sig.description, {
                    ip,
                    path,
                    input_snippet: input.substring(0, 200)
                });

                // Auto-block on critical attacks
                if (sig.severity === 'CRITICAL') {
                    this._blockIP(ip, `Automatic block: ${type}`);
                }
            }
        }

        return detected;
    }

    // ── Rate Limiting ──
    _checkRateLimit(ip) {
        const now = Date.now();
        let counter = this.ipCounters.get(ip);

        if (!counter) {
            counter = { count: 0, firstRequest: now };
            this.ipCounters.set(ip, counter);
        }

        // Reset window if expired
        if (now - counter.firstRequest > this.rateLimit.windowMs) {
            counter.count = 0;
            counter.firstRequest = now;
        }

        counter.count++;

        if (counter.count > this.rateLimit.maxRequests) {
            this._blockIP(ip, 'Rate limit exceeded');
            return true;
        }

        return false;
    }

    // ── Block IP ──
    _blockIP(ip, reason) {
        if (this.blockedIPs.has(ip)) return;

        this.blockedIPs.add(ip);
        this.stats.ips_blocked++;

        this._raiseAlert('HIGH', 'IP_BLOCKED', `IP ${ip} blocked: ${reason}`, { ip, reason });

        // Auto-unblock after duration
        setTimeout(() => {
            this.blockedIPs.delete(ip);
            this._raiseAlert('INFO', 'IP_UNBLOCKED', `IP ${ip} unblocked after timeout`, { ip });
        }, this.rateLimit.blockDurationMs);
    }

    // ── Cleanup IP Counters ──
    _cleanupIPCounters() {
        const now = Date.now();
        for (const [ip, counter] of this.ipCounters.entries()) {
            if (now - counter.firstRequest > this.rateLimit.windowMs * 2) {
                this.ipCounters.delete(ip);
            }
        }
    }

    // ════════════════════════════════════════
    // FILE INTEGRITY MONITORING (FIM)
    // ════════════════════════════════════════

    // Initialize file hashes baseline
    async _initFileIntegrity() {
        this.fileHashes.clear();
        const files = await this._collectCriticalFiles(this.projectRoot);

        for (const file of files) {
            try {
                const hash = await this._hashFile(file);
                this.fileHashes.set(file, { hash, lastChecked: Date.now() });
            } catch { /* Skip unreadable files */ }
        }

        this.stats.files_monitored = this.fileHashes.size;
    }

    // Check file integrity against baseline
    async _checkFileIntegrity() {
        if (!this.isRunning) return;

        for (const [filePath, baseline] of this.fileHashes.entries()) {
            try {
                const currentHash = await this._hashFile(filePath);

                if (currentHash !== baseline.hash) {
                    this.stats.integrity_violations++;
                    const relativePath = path.relative(this.projectRoot, filePath);

                    this._raiseAlert('CRITICAL', 'FILE_INTEGRITY_VIOLATION', `File modified: ${relativePath}`, {
                        file: relativePath,
                        previous_hash: baseline.hash.substring(0, 16) + '...',
                        current_hash: currentHash.substring(0, 16) + '...'
                    });

                    // Update baseline to new hash (so we don't alert again)
                    baseline.hash = currentHash;
                    baseline.lastChecked = Date.now();
                }
            } catch (err) {
                // File was deleted
                if (err.code === 'ENOENT') {
                    const relativePath = path.relative(this.projectRoot, filePath);
                    this._raiseAlert('HIGH', 'FILE_DELETED', `Critical file deleted: ${relativePath}`, { file: relativePath });
                    this.fileHashes.delete(filePath);
                }
            }
        }
    }

    // Compute SHA-256 hash of a file
    async _hashFile(filePath) {
        const content = await fs.readFile(filePath);
        return crypto.createHash('sha256').update(content).digest('hex');
    }

    // Collect critical files matching patterns
    async _collectCriticalFiles(dir, depth = 0) {
        if (depth > 5) return [];
        const files = [];
        const skipDirs = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'vendor', '__pycache__', '.cache']);

        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });

            for (const entry of entries) {
                if (skipDirs.has(entry.name)) continue;

                const fullPath = path.join(dir, entry.name);

                if (entry.isDirectory()) {
                    const subFiles = await this._collectCriticalFiles(fullPath, depth + 1);
                    files.push(...subFiles);
                } else if (entry.isFile()) {
                    const name = entry.name.toLowerCase();
                    // Match critical patterns
                    if (
                        name.startsWith('.env') ||
                        name === 'package.json' ||
                        name === 'package-lock.json' ||
                        name.endsWith('.key') ||
                        name.endsWith('.pem') ||
                        name.endsWith('.cert') ||
                        name.includes('config') ||
                        name.includes('auth') ||
                        name.includes('middleware') ||
                        name === 'firebase.json' ||
                        name === 'firestore.rules' ||
                        name === 'docker-compose.yml' ||
                        name === 'Dockerfile' ||
                        name === '.gitignore'
                    ) {
                        files.push(fullPath);
                    }
                }
            }
        } catch { /* Permission denied */ }

        return files;
    }

    // ════════════════════════════════════════
    // ALERT SYSTEM
    // ════════════════════════════════════════

    _raiseAlert(severity, type, description, details = {}) {
        const alert = {
            id: crypto.randomBytes(6).toString('hex'),
            timestamp: new Date().toISOString(),
            severity,
            type,
            description,
            details
        };

        this.alerts.push(alert);
        if (this.alerts.length > this.maxAlerts) {
            this.alerts = this.alerts.slice(-Math.floor(this.maxAlerts / 2));
        }

        // Emit for SSE streaming
        this.emit('alert', alert);

        // Broadcast to SSE clients
        this._broadcastSSE(alert);

        return alert;
    }

    // SSE Broadcasting
    addSSEClient(res) {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });
        res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);

        this.sseClients.push(res);
        res.on('close', () => {
            this.sseClients = this.sseClients.filter(c => c !== res);
        });
    }

    _broadcastSSE(alert) {
        const data = JSON.stringify(alert);
        this.sseClients.forEach(client => {
            try {
                client.write(`event: alert\n`);
                client.write(`data: ${data}\n\n`);
            } catch { /* Client disconnected */ }
        });
    }

    // ════════════════════════════════════════
    // REPORTING
    // ════════════════════════════════════════

    getStats() {
        return {
            ...this.stats,
            is_running: this.isRunning,
            blocked_ips: [...this.blockedIPs],
            active_sse_clients: this.sseClients.length,
            total_alerts: this.alerts.length,
            alerts_by_severity: {
                CRITICAL: this.alerts.filter(a => a.severity === 'CRITICAL').length,
                HIGH: this.alerts.filter(a => a.severity === 'HIGH').length,
                MEDIUM: this.alerts.filter(a => a.severity === 'MEDIUM').length,
                LOW: this.alerts.filter(a => a.severity === 'LOW').length,
                INFO: this.alerts.filter(a => a.severity === 'INFO').length
            }
        };
    }

    getAlerts(options = {}) {
        let filtered = [...this.alerts];

        if (options.severity) {
            filtered = filtered.filter(a => a.severity === options.severity.toUpperCase());
        }
        if (options.type) {
            filtered = filtered.filter(a => a.type === options.type);
        }
        if (options.since) {
            const since = new Date(options.since).getTime();
            filtered = filtered.filter(a => new Date(a.timestamp).getTime() >= since);
        }

        const limit = options.limit || 100;
        return filtered.slice(-limit).reverse();
    }

    getRecentActivity(minutes = 5) {
        const since = Date.now() - (minutes * 60 * 1000);
        return {
            requests: this.requestLog.filter(r => r.timestamp >= since).length,
            attacks: this.requestLog.filter(r => r.timestamp >= since && r.flagged).length,
            alerts: this.alerts.filter(a => new Date(a.timestamp).getTime() >= since).length,
            unique_ips: new Set(this.requestLog.filter(r => r.timestamp >= since).map(r => r.ip)).size
        };
    }

    // Get dashboard data
    getDashboard() {
        return {
            status: this.isRunning ? '🟢 ACTIVE' : '🔴 INACTIVE',
            uptime: this.stats.started_at ? `${Math.floor((Date.now() - new Date(this.stats.started_at).getTime()) / 60000)}min` : 'N/A',
            stats: this.getStats(),
            recent_activity: this.getRecentActivity(),
            latest_alerts: this.getAlerts({ limit: 20 }),
            top_attackers: this._getTopAttackers(),
            integrity_status: {
                files_monitored: this.fileHashes.size,
                violations: this.stats.integrity_violations
            }
        };
    }

    _getTopAttackers() {
        const attackerMap = {};
        for (const req of this.requestLog) {
            if (req.flagged) {
                attackerMap[req.ip] = (attackerMap[req.ip] || 0) + 1;
            }
        }
        return Object.entries(attackerMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([ip, count]) => ({
                ip,
                attack_count: count,
                blocked: this.blockedIPs.has(ip)
            }));
    }
}

module.exports = { SecurityMonitor, ATTACK_SIGNATURES };
