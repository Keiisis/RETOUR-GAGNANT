// ════════════════════════════════════════════════════════════════
//  ⚡ AURA HIVE v6.0 "PHANTOM" — CyberSec Meta-Agent Server
// ════════════════════════════════════════════════════════════════
const express = require('express');
const cors = require('cors');
const fs = require('fs/promises');
const path = require('path');
const { exec, spawn } = require('child_process');
const https = require('https');
const http = require('http');
const app = express();
const PORT = 3666;
// ── Groq AI Configuration ──
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = 'llama-3.3-70b-versatile';
app.use(cors());
app.use(express.json({ limit: '50mb' }));
// Racine du projet (3 niveaux au-dessus)
const PROJECT_ROOT = path.resolve(__dirname, '../../../');

// ── v5.0 CyberSec Modules ──
const { knowledgeEngine } = require('./autonomous/knowledge');
const { VulnerabilityScanner } = require('./autonomous/scanner');
const { ReconEngine } = require('./autonomous/recon');
const { ExploitLab } = require('./autonomous/exploit-lab');
const { SecurityMonitor } = require('./autonomous/monitor');
const { AttackClient } = require('./autonomous/attack-client');
const { SwarmOrchestrator } = require('./autonomous/swarm');
const { MemoryStore } = require('./autonomous/memory');
const { ProjectCloner } = require('./autonomous/cloner');
const { EvolutionEngine } = require('./autonomous/evolution');
const { VoiceProcessor } = require('./autonomous/voice');

// Instantiate CyberSec modules
const scanner = new VulnerabilityScanner(PROJECT_ROOT);
const recon = new ReconEngine();
const exploitLab = new ExploitLab();
const securityMonitor = new SecurityMonitor(PROJECT_ROOT);
const attackClient = new AttackClient();
const swarm = new SwarmOrchestrator();
const memory = new MemoryStore({ memoryDir: path.join(PROJECT_ROOT, '.aura-memory') });
const cloner = new ProjectCloner();
const evolution = new EvolutionEngine(PROJECT_ROOT);
const voice = new VoiceProcessor();

// Initialize Memory
memory.init().catch(err => console.error('[MEMORY] Init failed:', err));

// Wire monitor events to terminal log
securityMonitor.on('alert', (alert) => {
    if (alert.severity === 'CRITICAL' || alert.severity === 'HIGH') {
        console.log(`[SECURITY] ${alert.severity}: ${alert.description}`);
    }
});
// ── Puppeteer (optionnel) ──
let puppeteer = null;
try {
    puppeteer = require('puppeteer-core');
} catch (e) { /* Puppeteer non installé — /snapshot dégradé */ }
// ────────────────────────────────────────────
// Commandes whitelistées pour /exec
// ────────────────────────────────────────────
const WHITELISTED_COMMANDS = ['npm', 'npx', 'git', 'ls', 'cat', 'pwd', 'echo', 'node', 'tsc'];
// ────────────────────────────────────────────
// Dossiers/fichiers ignorés pour /tree
// ────────────────────────────────────────────
const IGNORED_DIRS = new Set([
    'node_modules', '.git', '.next', '.turbo', '.vercel',
    '.cache', '.husky', 'dist', 'build', '.output',
    '__pycache__', '.svn', 'coverage', '.nyc_output',
    '.parcel-cache', '.DS_Store', '.aura'
]);
const IGNORED_FILES = new Set([
    '.DS_Store', 'Thumbs.db', '.env', '.env.local',
    '.env.production', '.env.development',
    'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'
]);
// ════════════════════════════════════════════
// TERMINAL MANAGEMENT
// ════════════════════════════════════════════
let terminalProcess = null;
let terminalLogs = [];
const MAX_TERMINAL_LOGS = 1000;
let sseClients = [];
function addTerminalLog(text, type = 'info') {
    const lines = text.toString().split('\n').filter(l => l.trim());
    for (const line of lines) {
        let logType = type;
        const lower = line.toLowerCase();
        if (lower.includes('error') || lower.includes('failed') || lower.includes('⨯')) logType = 'error';
        else if (lower.includes('warning') || lower.includes('⚠')) logType = 'warning';
        else if (lower.includes('✓') || lower.includes('ready') || lower.includes('compiled') || lower.includes('200')) logType = 'success';
        else if (lower.startsWith('$') || lower.startsWith('>')) logType = 'system';
        const entry = {
            id: Date.now() + Math.random(),
            text: line,
            type: logType,
            timestamp: new Date().toISOString()
        };
        terminalLogs.push(entry);
        if (terminalLogs.length > MAX_TERMINAL_LOGS) {
            terminalLogs = terminalLogs.slice(-MAX_TERMINAL_LOGS);
        }
        // Envoyer aux clients SSE
        sseClients.forEach(client => {
            try { client.write(`data: ${JSON.stringify(entry)}\n\n`); } catch (e) { }
        });
    }
}
// ════════════════════════════════════════════
// DEPENDENCY ANALYSIS
// ════════════════════════════════════════════
async function analyzeDependencies(content, filePath) {
    const deps = new Set();
    const dir = path.dirname(filePath);
    // ES6 import ... from '...'
    const importFromRegex = /import\s+(?:[\w*{}\s,]+\s+from\s+)?['"](\.[^'"]+)['"]/g;
    // require('...')
    const requireRegex = /require\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g;
    // CSS @import '...'
    const cssImportRegex = /@import\s+['"](\.[^'"]+)['"]/g;
    const regexes = [importFromRegex, requireRegex, cssImportRegex];
    for (const regex of regexes) {
        let match;
        while ((match = regex.exec(content)) !== null) {
            const depRaw = match[1];
            let resolved = path.normalize(path.join(dir, depRaw)).replace(/\\/g, '/');
            if (path.extname(resolved)) {
                deps.add(resolved);
            } else {
                // Essayer les extensions courantes
                const exts = ['.ts', '.tsx', '.js', '.jsx', '.css', '.json', '.mjs'];
                let found = false;
                for (const ext of exts) {
                    try {
                        await fs.access(path.join(PROJECT_ROOT, resolved + ext));
                        deps.add(resolved + ext);
                        found = true;
                        break;
                    } catch { }
                }
                if (!found) {
                    // Essayer /index.*
                    for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
                        try {
                            await fs.access(path.join(PROJECT_ROOT, resolved + '/index' + ext));
                            deps.add(resolved + '/index' + ext);
                            break;
                        } catch { }
                    }
                }
            }
        }
    }
    return [...deps];
}
// ════════════════════════════════════════════
// HTML TO MARKDOWN CONVERTER
// ════════════════════════════════════════════
function htmlToMarkdown(html) {
    let md = html;
    md = md.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    md = md.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    md = md.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '');
    md = md.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');
    md = md.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');
    md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n');
    md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n');
    md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n');
    md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n');
    md = md.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**');
    md = md.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**');
    md = md.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*');
    md = md.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*');
    md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');
    md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');
    md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');
    md = md.replace(/<\/?[uo]l[^>]*>/gi, '\n');
    md = md.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '\n```\n$1\n```\n');
    md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n$1\n');
    md = md.replace(/<br\s*\/?>/gi, '\n');
    md = md.replace(/<div[^>]*>/gi, '\n');
    md = md.replace(/<\/div>/gi, '');
    md = md.replace(/<[^>]+>/g, '');
    md = md.replace(/&nbsp;/g, ' ');
    md = md.replace(/&amp;/g, '&');
    md = md.replace(/&lt;/g, '<');
    md = md.replace(/&gt;/g, '>');
    md = md.replace(/&quot;/g, '"');
    md = md.replace(/&#39;/g, "'");
    md = md.replace(/\n{3,}/g, '\n\n');
    return md.trim();
}
// ════════════════════════════════════════════
// GROQ AI HELPER
// ════════════════════════════════════════════
function groqRequest(messages, model) {
    model = model || GROQ_MODEL;
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify({
            model,
            messages,
            temperature: 0.7,
            max_tokens: 4096,
            stream: false
        });
        const options = {
            hostname: 'api.groq.com',
            path: '/openai/v1/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + GROQ_API_KEY,
                'Content-Length': Buffer.byteLength(payload)
            }
        };
        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(body)); }
                catch (e) { reject(new Error('Groq parse error: ' + body.slice(0, 200))); }
            });
        });
        req.on('error', reject);
        req.setTimeout(60000, () => { req.destroy(); reject(new Error('Groq timeout')); });
        req.write(payload);
        req.end();
    });
}
// ════════════════════════════════════════════
// URL FETCHER
// ════════════════════════════════════════════
function fetchUrlContent(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        const req = client.get(url, { headers: { 'User-Agent': 'AuraLink/3.0' }, timeout: 15000 }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                fetchUrlContent(res.headers.location).then(resolve).catch(reject);
                return;
            }
            let data = '';
            res.setEncoding('utf8');
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    });
}
// ════════════════════════════════════════════
// BANNIÈRE DE DÉMARRAGE
// ════════════════════════════════════════════
function printBanner() {
    console.log('');
    console.log('  ╔══════════════════════════════════════════════════════╗');
    console.log('  ║                                                      ║');
    console.log('  ║   ⚡  AURA LINK v3.0 — AI Augmented Copilot  ⚡     ║');
    console.log('  ║                                                      ║');
    console.log('  ╠══════════════════════════════════════════════════════╣');
    console.log(`  ║  🔌  Port      : ${PORT}                                 ║`);
    console.log(`  ║  📂  Projet    : ${(PROJECT_ROOT.length > 30 ? '...' + PROJECT_ROOT.slice(-27) : PROJECT_ROOT).padEnd(30)}    ║`);
    console.log('  ║  🤖  AI        : Groq llama-3.3-70b-versatile        ║');
    console.log('  ║  🛡️   Sécurité  : Whitelist active                    ║');
    console.log(`  ║  📸  Snapshot  : ${puppeteer ? 'Puppeteer ready' : 'Dégradé (pas de puppeteer)'}       ║`);
    console.log('  ║                                                      ║');
    console.log('  ║  Endpoints v3.0 :                                    ║');
    console.log('  ║    POST /read            — Lire + dépendances        ║');
    console.log('  ║    POST /write           — Écrire un fichier         ║');
    console.log('  ║    GET  /tree            — Arborescence              ║');
    console.log('  ║    POST /exec            — Exécuter commande         ║');
    console.log('  ║    POST /read-multiple   — Lecture batch             ║');
    console.log('  ║    POST /dependency-scan — Analyse imports           ║');
    console.log('  ║    GET  /terminal/stream — Terminal SSE              ║');
    console.log('  ║    POST /terminal/start  — Lancer processus          ║');
    console.log('  ║    POST /terminal/stop   — Arrêter processus         ║');
    console.log('  ║    POST /ai/chat         — Groq AI proxy            ║');
    console.log('  ║    POST /fetch-url       — Web-to-Markdown          ║');
    console.log('  ║    GET  /memory          — Project Memory            ║');
    console.log('  ║    POST /memory          — Sauver Memory            ║');
    console.log('  ║    GET  /tasks           — Task Sync                ║');
    console.log('  ║    POST /tasks           — Update Tasks             ║');
    console.log('  ║    POST /snapshot        — Screenshot               ║');
    console.log('  ║                                                      ║');
    console.log('  ╚══════════════════════════════════════════════════════╝');
    console.log('');
}
// ════════════════════════════════════════════
// SCAN DIRECTORY (pour /tree)
// ════════════════════════════════════════════
async function scanDirectory(dirPath, relativePath = '', depth = 0, maxDepth = 10) {
    if (depth > maxDepth) return [];
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const result = [];
    const sorted = entries.sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
    });
    for (const entry of sorted) {
        const entryRelPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
            if (IGNORED_DIRS.has(entry.name)) continue;
            const children = await scanDirectory(path.join(dirPath, entry.name), entryRelPath, depth + 1, maxDepth);
            result.push({ name: entry.name, path: entryRelPath, type: 'directory', children });
        } else {
            if (IGNORED_FILES.has(entry.name)) continue;
            const ext = path.extname(entry.name).slice(1);
            let size = 0;
            try { const s = await fs.stat(path.join(dirPath, entry.name)); size = s.size; } catch { }
            result.push({ name: entry.name, path: entryRelPath, type: 'file', extension: ext, size });
        }
    }
    return result;
}
// ════════════════════════════════════════════════════════════════
// 1. LIRE UN FICHIER (ENHANCED avec dépendances)
// ════════════════════════════════════════════════════════════════
app.post('/read', async (req, res) => {
    try {
        const { filePath } = req.body;
        if (!filePath) return res.status(400).json({ success: false, error: 'filePath requis' });
        const normalizedPath = path.normalize(filePath);
        if (normalizedPath.startsWith('..') || path.isAbsolute(normalizedPath))
            return res.status(403).json({ success: false, error: 'Chemin interdit' });
        const fullPath = path.join(PROJECT_ROOT, normalizedPath);
        const content = await fs.readFile(fullPath, 'utf-8');
        const stats = await fs.stat(fullPath);
        const ext = path.extname(filePath).slice(1);
        const lines = content.split('\n').length;
        // Analyse des dépendances
        let suggestedFilePaths = [];
        try {
            suggestedFilePaths = await analyzeDependencies(content, normalizedPath);
        } catch (e) { /* ignore */ }
        res.json({
            success: true,
            content,
            suggestedFilePaths,
            meta: {
                path: filePath,
                extension: ext,
                lines,
                size: stats.size,
                modified: stats.mtime.toISOString()
            }
        });
        console.log(`  📖  Lu : ${filePath} (${lines} lignes, ${suggestedFilePaths.length} deps)`);
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
        console.log(`  ❌  Erreur lecture : ${e.message}`);
    }
});
// ════════════════════════════════════════════
// 2. ÉCRIRE UN FICHIER
// ════════════════════════════════════════════
app.post('/write', async (req, res) => {
    try {
        const { filePath, content } = req.body;
        if (!filePath || content === undefined)
            return res.status(400).json({ success: false, error: 'filePath et content requis' });
        const normalizedPath = path.normalize(filePath);
        if (normalizedPath.startsWith('..') || path.isAbsolute(normalizedPath))
            return res.status(403).json({ success: false, error: 'Chemin interdit' });
        const fullPath = path.join(PROJECT_ROOT, normalizedPath);
        let isNew = true;
        try { await fs.access(fullPath); isNew = false; } catch { }
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, content, 'utf-8');
        const lines = content.split('\n').length;
        res.json({
            success: true,
            meta: { path: filePath, lines, size: Buffer.byteLength(content, 'utf-8'), action: isNew ? 'created' : 'updated' }
        });
        console.log(`  ✍️  ${isNew ? 'Créé' : 'Modifié'} : ${filePath} (${lines} lignes)`);
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
// ════════════════════════════════════════════
// 3. ARBORESCENCE — /tree
// ════════════════════════════════════════════
app.get('/tree', async (req, res) => {
    try {
        const maxDepth = parseInt(req.query.depth) || 8;
        const subPath = req.query.path || '';
        const normalizedSub = path.normalize(subPath);
        if (normalizedSub.startsWith('..') || path.isAbsolute(normalizedSub))
            return res.status(403).json({ success: false, error: 'Chemin interdit' });
        const targetDir = subPath ? path.join(PROJECT_ROOT, normalizedSub) : PROJECT_ROOT;
        const tree = await scanDirectory(targetDir, subPath, 0, maxDepth);
        function countEntries(nodes) {
            let files = 0, dirs = 0;
            for (const n of nodes) {
                if (n.type === 'directory') { dirs++; const sub = countEntries(n.children); files += sub.files; dirs += sub.dirs; }
                else files++;
            }
            return { files, dirs };
        }
        const stats = countEntries(tree);
        res.json({ success: true, root: PROJECT_ROOT, stats: { totalFiles: stats.files, totalDirectories: stats.dirs, maxDepth }, tree });
        console.log(`  🌳  Arborescence : ${stats.files} fichiers, ${stats.dirs} dossiers`);
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
// ════════════════════════════════════════════
// 4. EXÉCUTER UNE COMMANDE — /exec
// ════════════════════════════════════════════
app.post('/exec', async (req, res) => {
    try {
        const { command } = req.body;
        if (!command || typeof command !== 'string')
            return res.status(400).json({ success: false, error: 'command (string) requis' });
        const parts = command.trim().split(/\s+/);
        const binary = parts[0];
        if (!WHITELISTED_COMMANDS.includes(binary))
            return res.status(403).json({ success: false, error: `"${binary}" non autorisée. Whitelist : ${WHITELISTED_COMMANDS.join(', ')}` });
        const dangerous = ['&&', '||', ';', '|', '`', '$(', 'rm -rf', 'sudo', '>', '>>'];
        for (const p of dangerous) {
            if (command.includes(p))
                return res.status(403).json({ success: false, error: `Pattern dangereux : "${p}"` });
        }
        console.log(`  🚀  Exécution : ${command}`);
        exec(command, { cwd: PROJECT_ROOT, timeout: 30000, maxBuffer: 5 * 1024 * 1024 }, (error, stdout, stderr) => {
            res.json({ success: !error, command, stdout: stdout || '', stderr: stderr || '', exitCode: error ? error.code || 1 : 0 });
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
// ════════════════════════════════════════════
// 5. LECTURE MULTIPLE — /read-multiple
// ════════════════════════════════════════════
app.post('/read-multiple', async (req, res) => {
    try {
        const { filePaths } = req.body;
        if (!Array.isArray(filePaths) || filePaths.length === 0)
            return res.status(400).json({ success: false, error: 'filePaths (array) requis' });
        if (filePaths.length > 30)
            return res.status(400).json({ success: false, error: 'Maximum 30 fichiers' });
        const results = await Promise.allSettled(
            filePaths.map(async (filePath) => {
                const np = path.normalize(filePath);
                if (np.startsWith('..') || path.isAbsolute(np)) throw new Error(`Chemin interdit : ${filePath}`);
                const fullPath = path.join(PROJECT_ROOT, np);
                const content = await fs.readFile(fullPath, 'utf-8');
                const stats = await fs.stat(fullPath);
                return { path: filePath, content, extension: path.extname(filePath).slice(1), lines: content.split('\n').length, size: stats.size };
            })
        );
        const files = results.map((r, i) => r.status === 'fulfilled' ? { success: true, ...r.value } : { success: false, path: filePaths[i], error: r.reason?.message });
        const ok = files.filter(f => f.success).length;
        res.json({ success: true, totalRequested: filePaths.length, totalRead: ok, totalFailed: filePaths.length - ok, files });
        console.log(`  📚  Lecture multiple : ${ok}/${filePaths.length}`);
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
// ════════════════════════════════════════════
// 6. DEPENDENCY SCAN — /dependency-scan
// ════════════════════════════════════════════
app.post('/dependency-scan', async (req, res) => {
    try {
        const { filePath } = req.body;
        if (!filePath) return res.status(400).json({ success: false, error: 'filePath requis' });
        const np = path.normalize(filePath);
        if (np.startsWith('..') || path.isAbsolute(np))
            return res.status(403).json({ success: false, error: 'Chemin interdit' });
        const fullPath = path.join(PROJECT_ROOT, np);
        const content = await fs.readFile(fullPath, 'utf-8');
        const dependencies = await analyzeDependencies(content, np);
        // Scan recursif profondeur 2
        const deepDeps = new Set(dependencies);
        for (const dep of dependencies) {
            try {
                const depContent = await fs.readFile(path.join(PROJECT_ROOT, dep), 'utf-8');
                const subDeps = await analyzeDependencies(depContent, dep);
                subDeps.forEach(d => deepDeps.add(d));
            } catch { }
        }
        res.json({
            success: true,
            filePath,
            directDependencies: dependencies,
            allDependencies: [...deepDeps],
            totalDirect: dependencies.length,
            totalDeep: deepDeps.size
        });
        console.log(`  🧠  Scan deps : ${filePath} → ${dependencies.length} direct, ${deepDeps.size} total`);
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
// ════════════════════════════════════════════
// 7. TERMINAL SSE — /terminal/stream
// ════════════════════════════════════════════
app.get('/terminal/stream', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
    });
    // Envoyer les logs existants
    terminalLogs.forEach(log => {
        res.write(`data: ${JSON.stringify(log)}\n\n`);
    });
    sseClients.push(res);
    console.log(`  📡  SSE client connecté (total: ${sseClients.length})`);
    req.on('close', () => {
        sseClients = sseClients.filter(c => c !== res);
        console.log(`  📡  SSE client déconnecté (total: ${sseClients.length})`);
    });
});
// ════════════════════════════════════════════
// 8. TERMINAL START — /terminal/start
// ════════════════════════════════════════════
app.post('/terminal/start', (req, res) => {
    try {
        const { command } = req.body;
        const cmd = command || 'npm run dev';
        if (terminalProcess) {
            return res.status(400).json({ success: false, error: 'Un processus tourne déjà. Stoppez-le d\'abord.' });
        }
        const parts = cmd.split(/\s+/);
        const binary = parts[0];
        if (!WHITELISTED_COMMANDS.includes(binary)) {
            return res.status(403).json({ success: false, error: `"${binary}" non autorisée` });
        }
        addTerminalLog(`$ ${cmd}`, 'system');
        const isWindows = process.platform === 'win32';
        terminalProcess = spawn(isWindows ? 'cmd' : 'sh', [isWindows ? '/c' : '-c', cmd], {
            cwd: PROJECT_ROOT,
            env: { ...process.env, FORCE_COLOR: '0' }
        });
        terminalProcess.stdout.on('data', (data) => addTerminalLog(data.toString()));
        terminalProcess.stderr.on('data', (data) => addTerminalLog(data.toString(), 'error'));
        terminalProcess.on('close', (code) => {
            addTerminalLog(`Processus terminé (code ${code})`, code === 0 ? 'success' : 'error');
            terminalProcess = null;
        });
        terminalProcess.on('error', (err) => {
            addTerminalLog(`Erreur processus: ${err.message}`, 'error');
            terminalProcess = null;
        });
        res.json({ success: true, message: `Processus "${cmd}" lancé`, pid: terminalProcess.pid });
        console.log(`  🖥️  Terminal lancé : ${cmd} (PID: ${terminalProcess.pid})`);
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
// ════════════════════════════════════════════
// 9. TERMINAL STOP — /terminal/stop
// ════════════════════════════════════════════
app.post('/terminal/stop', (req, res) => {
    if (!terminalProcess) {
        return res.json({ success: true, message: 'Aucun processus en cours' });
    }
    try {
        terminalProcess.kill('SIGTERM');
        addTerminalLog('Processus arrêté par l\'utilisateur', 'system');
        terminalProcess = null;
        res.json({ success: true, message: 'Processus arrêté' });
        console.log('  🛑  Terminal arrêté');
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
// ════════════════════════════════════════════
// 10. TERMINAL LOGS (polling fallback) — /terminal/logs
// ════════════════════════════════════════════
app.get('/terminal/logs', (req, res) => {
    const since = parseInt(req.query.since) || 0;
    const logs = since ? terminalLogs.filter(l => l.id > since) : terminalLogs.slice(-100);
    res.json({
        success: true,
        running: !!terminalProcess,
        totalLogs: terminalLogs.length,
        logs
    });
});
// ════════════════════════════════════════════
// 11. GROQ AI CHAT — /ai/chat
// ════════════════════════════════════════════
app.post('/ai/chat', async (req, res) => {
    try {
        const { messages, model, context } = req.body;
        if (!messages || !Array.isArray(messages))
            return res.status(400).json({ success: false, error: 'messages (array) requis' });
        // Construire les messages avec contexte optionnel
        let systemMessages = [];
        if (context) {
            systemMessages.push({
                role: 'system',
                content: `Tu es un assistant développeur expert intégré dans Aura Link, un outil de développement. Voici le contexte du projet :\n\n${context}\n\nRéponds de manière concise, technique et actionnable. Utilise du markdown avec des blocs de code quand pertinent.`
            });
        } else {
            systemMessages.push({
                role: 'system',
                content: 'Tu es un assistant développeur expert intégré dans Aura Link. Réponds de manière concise, technique et actionnable. Utilise du markdown avec des blocs de code quand pertinent.'
            });
        }
        const allMessages = [...systemMessages, ...messages];
        const result = await groqRequest(allMessages, model);
        if (result.error) {
            return res.status(500).json({ success: false, error: result.error.message || 'Groq API error' });
        }
        const reply = result.choices?.[0]?.message?.content || 'Pas de réponse';
        res.json({
            success: true,
            reply,
            model: result.model,
            usage: result.usage
        });
        console.log(`  🤖  AI Chat : ${messages.length} msgs → ${reply.length} chars`);
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
        console.log(`  ❌  AI Error : ${e.message}`);
    }
});
// ════════════════════════════════════════════
// 12. FETCH URL — /fetch-url
// ════════════════════════════════════════════
app.post('/fetch-url', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ success: false, error: 'url requis' });
        let cleanUrl = url.trim();
        if (!cleanUrl.startsWith('http')) cleanUrl = 'https://' + cleanUrl;
        console.log(`  🌐  Fetching : ${cleanUrl}`);
        const html = await fetchUrlContent(cleanUrl);
        const markdown = htmlToMarkdown(html);
        // Extraire le titre
        const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim() : new URL(cleanUrl).hostname;
        res.json({
            success: true,
            url: cleanUrl,
            title,
            markdown,
            rawLength: html.length,
            markdownLength: markdown.length
        });
        console.log(`  🌐  Converti : ${title} (${html.length} → ${markdown.length} chars)`);
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
// ════════════════════════════════════════════
// 13. PROJECT MEMORY — /memory
// ════════════════════════════════════════════
const MEMORY_PATH = path.join(PROJECT_ROOT, '.aura', 'memory.md');
const DEFAULT_MEMORY = `# 🧠 Aura Link — Project Memory
## Stack Technique
- **Framework**: [À compléter]
- **Styling**: [À compléter]
- **Language**: [À compléter]
## Architecture
- Décrivez la structure de votre projet ici.
## Conventions
- Décrivez vos conventions de code ici.
## Notes
- Ajoutez des notes importantes pour l'IA ici.
`;
app.get('/memory', async (req, res) => {
    try {
        let content;
        try {
            content = await fs.readFile(MEMORY_PATH, 'utf-8');
        } catch {
            // Créer le fichier par défaut
            await fs.mkdir(path.dirname(MEMORY_PATH), { recursive: true });
            await fs.writeFile(MEMORY_PATH, DEFAULT_MEMORY, 'utf-8');
            content = DEFAULT_MEMORY;
        }
        res.json({ success: true, content, path: '.aura/memory.md' });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
app.post('/memory', async (req, res) => {
    try {
        const { content } = req.body;
        if (content === undefined) return res.status(400).json({ success: false, error: 'content requis' });
        await fs.mkdir(path.dirname(MEMORY_PATH), { recursive: true });
        await fs.writeFile(MEMORY_PATH, content, 'utf-8');
        res.json({ success: true, message: 'Memory sauvegardée', lines: content.split('\n').length });
        console.log(`  🧠  Memory sauvegardée (${content.split('\n').length} lignes)`);
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
// ════════════════════════════════════════════
// 14. TASK SYNC — /tasks
// ════════════════════════════════════════════
const TASK_PATH = path.join(PROJECT_ROOT, 'task.md');
app.get('/tasks', async (req, res) => {
    try {
        let content;
        try {
            content = await fs.readFile(TASK_PATH, 'utf-8');
        } catch {
            content = '# Tasks\n\n- [ ] Première tâche\n';
            await fs.writeFile(TASK_PATH, content, 'utf-8');
        }
        // Parser les tâches markdown
        const tasks = [];
        const lines = content.split('\n');
        for (const line of lines) {
            const taskMatch = line.match(/^-\s*\[([ xX])\]\s*(.+)$/);
            if (taskMatch) {
                tasks.push({
                    id: tasks.length.toString(),
                    done: taskMatch[1] !== ' ',
                    text: taskMatch[2].trim(),
                    raw: line
                });
            }
        }
        res.json({ success: true, content, tasks, totalTasks: tasks.length, completedTasks: tasks.filter(t => t.done).length });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
app.post('/tasks', async (req, res) => {
    try {
        const { content } = req.body;
        if (content === undefined) return res.status(400).json({ success: false, error: 'content requis' });
        await fs.writeFile(TASK_PATH, content, 'utf-8');
        res.json({ success: true, message: 'Tasks sauvegardées' });
        console.log(`  ✅  Tasks sauvegardées`);
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
// ════════════════════════════════════════════
// 15. SNAPSHOT — /snapshot
// ════════════════════════════════════════════
app.post('/snapshot', async (req, res) => {
    try {
        const { url, viewport } = req.body;
        const targetUrl = url || 'http://localhost:3000';
        const vp = viewport || { width: 1920, height: 1080 };
        if (!puppeteer) {
            return res.status(501).json({
                success: false,
                error: 'Puppeteer non installé. Exécutez: npm install puppeteer-core',
                fallback: true
            });
        }
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.setViewport(vp);
        await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 15000 });
        const screenshot = await page.screenshot({ encoding: 'base64', fullPage: false });
        await browser.close();
        res.json({
            success: true,
            screenshot: `data:image/png;base64,${screenshot}`,
            url: targetUrl,
            viewport: vp,
            timestamp: new Date().toISOString()
        });
        console.log(`  📸  Screenshot : ${targetUrl} (${vp.width}x${vp.height})`);
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
// ════════════════════════════════════════════
// 16. HEALTH CHECK — /status
// ════════════════════════════════════════════
app.get('/status', (req, res) => {
    res.json({
        success: true,
        service: 'Aura Link — AI Augmented Copilot',
        version: '3.0.0',
        port: PORT,
        projectRoot: PROJECT_ROOT,
        uptime: Math.floor(process.uptime()),
        features: {
            ai: 'Groq ' + GROQ_MODEL,
            terminal: !!terminalProcess ? 'running' : 'stopped',
            terminalLogs: terminalLogs.length,
            sseClients: sseClients.length,
            snapshot: !!puppeteer
        },
        whitelistedCommands: WHITELISTED_COMMANDS
    });
});
// ════════════════════════════════════════════
// 17. REMOTE CONTROL (PROJECT PUPPETEER)
// ════════════════════════════════════════════
let remoteStreamClients = [];
let commandQueue = [];

// SSE Stream for Extension
app.get('/remote/stream', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
    });
    remoteStreamClients.push(res);
    console.log(`  🎮  Remote Client Connected (Total: ${remoteStreamClients.length})`);

    // Send keepalive
    const keepAlive = setInterval(() => res.write(': keepalive\n\n'), 15000);

    req.on('close', () => {
        clearInterval(keepAlive);
        remoteStreamClients = remoteStreamClients.filter(c => c !== res);
        console.log(`  🎮  Remote Client Disconnected`);
    });
});

// Push Command (from IDE/Antigravity)
app.post('/remote/push', (req, res) => {
    try {
        const { action, selector, value, id } = req.body;
        if (!action) return res.status(400).json({ success: false, error: 'action required' });

        const command = {
            id: id || Date.now().toString(),
            action,
            selector,
            value,
            timestamp: Date.now()
        };

        // Broadcast to all connected extensions
        remoteStreamClients.forEach(client => {
            client.write(`event: command\n`);
            client.write(`data: ${JSON.stringify(command)}\n\n`);
        });

        console.log(`  🚀  Command Pushed: ${action} -> [Extension]`);
        res.json({ success: true, message: 'Command pushed', command });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Receive Result (from Extension)
app.post('/remote/result', (req, res) => {
    const { id, result, status, error } = req.body;
    console.log(`  📬  Result [${id}] (${status}): ${status === 'success' ? (result ? result.substring(0, 50) + '...' : 'OK') : error}`);
    // Here we could store results in a buffer for polling, but for now just logging is fine
    // or broadcasting to a 'control' stream if we had one for the IDE.
    res.json({ success: true });
});

// ════════════════════════════════════════════
// ════════════════════════════════════════════
// 19. AURA HIVE v4.0 (META-AGENT MANAGER)
// ════════════════════════════════════════════
console.log('Loading Brain module...');
const brainModule = require('./autonomous/brain');
console.log('Brain Module Type:', typeof brainModule);
console.log('Brain Module Keys:', Object.keys(brainModule));
const { decideNextStep } = brainModule;
const { executeCode } = require('./autonomous/executor');

const LOOP_STATE = {
    IDLE: 'IDLE',
    RUNNING: 'RUNNING',
    PAUSED: 'PAUSED',
    STOPPED: 'STOPPED'
};

let loopContext = {
    state: LOOP_STATE.IDLE,
    goal: '',
    currentStep: 0,
    maxSteps: 10,
    history: [],
    lastActionTime: 0
};

// Start Hive
app.post('/autonomous/start', async (req, res) => {
    const { goal, maxSteps } = req.body;
    if (!goal) return res.status(400).json({ success: false, error: 'goal required' });

    loopContext = {
        state: LOOP_STATE.RUNNING,
        goal,
        currentStep: 1,
        maxSteps: maxSteps || 10,
        history: [],
        lastActionTime: Date.now()
    };

    console.log(`  🧠  Hive Activated: "${goal}"`);

    // Initial Brain Decision
    const decision = await decideNextStep({
        goal,
        currentStep: 0,
        history: [],
        lastCode: null,
        lastError: null
    });

    if (decision.next_action === 'INPUT') {
        pushCommandToExtension('input', decision.prompt_for_drone);
        res.json({ success: true, message: 'Hive Started', decision });
    } else {
        res.json({ success: false, message: 'Brain refused to start', decision });
    }
});

// Stop Hive
app.post('/autonomous/stop', (req, res) => {
    loopContext.state = LOOP_STATE.STOPPED;
    console.log(`  ⏹️  Hive STOPPED`);
    res.json({ success: true, message: 'Hive stopped' });
});

// Hive Feedback Loop
app.post('/autonomous/feedback', async (req, res) => {
    const { code, logs, status, id } = req.body; // id from cmd to track steps

    if (loopContext.state !== LOOP_STATE.RUNNING) {
        return res.json({ success: false, message: 'Hive not running' });
    }

    console.log(`  🐝  Drone Returned (Step ${loopContext.currentStep})`);

    // 1. Save File
    let lastError = null;
    let savedFile = null;

    if (code) {
        const targetFile = extractFileName(code) || `hive_step_${loopContext.currentStep}.js`;
        savedFile = targetFile;
        const fullPath = path.join(PROJECT_ROOT, targetFile);

        try {
            await fs.writeFile(fullPath, code, 'utf-8');
            console.log(`  💾  Saved: ${targetFile}`);

            // 2. Execute (The Reality Check)
            console.log(`  ⚙️  Verifying...`);
            const execResult = await executeCode(fullPath);

            if (!execResult.success) {
                lastError = execResult.logs;
                console.log(`  ❌  Verification Failed: ${lastError.substring(0, 50)}...`);
            } else {
                console.log(`  ✅  Verification Passed`);
            }

        } catch (e) {
            lastError = `Save Error: ${e.message}`;
        }
    } else {
        lastError = "No code extracted from response.";
    }

    // 3. Update History
    loopContext.history.push({
        step: loopContext.currentStep,
        file: savedFile,
        status: lastError ? 'error' : 'success',
        error: lastError
    });

    // 4. Brain Decides Next Move
    loopContext.currentStep++;

    if (loopContext.currentStep > loopContext.maxSteps) {
        loopContext.state = LOOP_STATE.STOPPED;
        return res.json({ success: true, action: 'stop', message: 'Max steps reached' });
    }

    // Brain needs recent context
    const decision = await decideNextStep({
        goal: loopContext.goal,
        currentStep: loopContext.currentStep,
        history: loopContext.history,
        lastCode: code,
        lastError: lastError
    });

    console.log(`  🧠  Brain Decision: ${decision.next_action.toUpperCase()} -> "${decision.analysis}"`);

    if (decision.next_action === 'INPUT') {
        const nextPrompt = decision.prompt_for_drone;
        // Safety delay
        setTimeout(() => {
            pushCommandToExtension('input', nextPrompt);
        }, 1000);
    } else {
        loopContext.state = LOOP_STATE.STOPPED;
        console.log("  🛑  Brain decided to STOP.");
    }

    res.json({ success: true, context: loopContext, decision });
});

function pushCommandToExtension(action, value) {
    const command = {
        id: `hive-${Date.now()}`,
        action,
        value,
        timestamp: Date.now()
    };
    remoteStreamClients.forEach(client => {
        client.write(`event: command\n`);
        client.write(`data: ${JSON.stringify(command)}\n\n`);
    });
}

function extractFileName(code) {
    const match = code.match(/\/\/\s*(?:file|filename|path):\s*([^\n]+)/i);
    return match ? match[1].trim() : null;
}

// ════════════════════════════════════════════
// 20. ROOT — /
// ════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════
// 🔐 v5.0 — CYBERSEC ENDPOINTS
// ════════════════════════════════════════════════════════════════

// ── KNOWLEDGE ENGINE ──
app.get('/knowledge/search', (req, res) => {
    const results = knowledgeEngine.search(req.query.q || '');
    res.json({ success: true, query: req.query.q, results });
});
app.get('/knowledge/owasp/:id', (req, res) => {
    const entry = knowledgeEngine.getOWASP(req.params.id);
    res.json(entry ? { success: true, data: entry } : { success: false, error: 'Not found' });
});
app.get('/knowledge/mitre/:id', (req, res) => {
    const entry = knowledgeEngine.getMITRE(req.params.id);
    res.json(entry ? { success: true, data: entry } : { success: false, error: 'Not found' });
});
app.get('/knowledge/checklist/:type', (req, res) => {
    const checklist = knowledgeEngine.getChecklist(req.params.type);
    res.json(checklist ? { success: true, data: checklist } : { success: false, error: 'Not found' });
});
app.get('/knowledge/cheatsheet/:name', (req, res) => {
    const sheet = knowledgeEngine.getCheatsheet(req.params.name);
    res.json(sheet ? { success: true, data: sheet } : { success: false, error: 'Not found' });
});
app.get('/knowledge/stats', (req, res) => {
    res.json({ success: true, stats: knowledgeEngine.getStats() });
});
app.post('/knowledge/enrich', (req, res) => {
    const enrichments = knowledgeEngine.enrichContext(req.body.context || {});
    res.json({ success: true, enrichments });
});

// ── VULNERABILITY SCANNER ──
app.post('/security/scan', async (req, res) => {
    try {
        const options = req.body || {};
        const report = await scanner.scanProject(options);
        res.json({ success: true, report });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});
app.post('/security/scan-file', async (req, res) => {
    try {
        const filePath = path.join(PROJECT_ROOT, req.body.file);
        const findings = await scanner.scanFile(filePath);
        res.json({ success: true, file: req.body.file, findings, count: findings.length });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});
app.get('/security/report', (req, res) => {
    const report = scanner.getLastReport();
    res.json(report ? { success: true, report } : { success: false, error: 'No scan reports yet' });
});
app.get('/security/history', (req, res) => {
    res.json({ success: true, history: scanner.getHistory() });
});

// ── OSINT RECON ──
app.post('/recon/scan', async (req, res) => {
    try {
        const { target, modules, ports, timeout, maxSubdomains } = req.body;
        if (!target) return res.json({ success: false, error: 'Target required' });
        const report = await recon.fullScan(target, { modules, ports, timeout, maxSubdomains });
        res.json({ success: true, report });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});
app.post('/recon/dns', async (req, res) => {
    try {
        const result = await recon.dnsEnum(req.body.target);
        res.json({ success: true, result });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});
app.post('/recon/portscan', async (req, res) => {
    try {
        const { target, ports, timeout } = req.body;
        const result = await recon.portScan(target, ports, timeout);
        res.json({ success: true, result });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});
app.post('/recon/headers', async (req, res) => {
    try {
        const result = await recon.analyzeHeaders(req.body.target);
        res.json({ success: true, result });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});
app.post('/recon/ssl', async (req, res) => {
    try {
        const result = await recon.analyzeSsl(req.body.target);
        res.json({ success: true, result });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});
app.post('/recon/tech', async (req, res) => {
    try {
        const result = await recon.detectTech(req.body.target);
        res.json({ success: true, result });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});
app.post('/recon/subdomains', async (req, res) => {
    try {
        const { target, max } = req.body;
        const result = await recon.enumerateSubdomains(target, max);
        res.json({ success: true, result });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});
app.get('/recon/history', (req, res) => {
    res.json({ success: true, history: recon.getHistory() });
});

// ── EXPLOIT LAB ──
app.post('/exploit/generate', (req, res) => {
    try {
        const { type, subcategory, context } = req.body;
        if (!type) return res.json({ success: false, error: 'Type required (xss, sqli, ssrf, cmdi, csrf, jwt, ssti, redirect)' });
        const result = exploitLab.generate(type, { subcategory, context });
        res.json({ success: true, result });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});
app.get('/exploit/library', (req, res) => {
    res.json({ success: true, library: exploitLab.getLibrary() });
});
app.get('/exploit/report/:id', (req, res) => {
    const report = exploitLab.generateReport(req.params.id);
    res.json(report ? { success: true, report } : { success: false, error: 'Exploit not found' });
});
app.get('/exploit/history', (req, res) => {
    res.json({ success: true, history: exploitLab.getHistory() });
});

// ── SECURITY MONITOR ──
app.post('/monitor/start', async (req, res) => {
    try {
        const result = await securityMonitor.start();
        res.json({ success: true, ...result });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});
app.post('/monitor/stop', (req, res) => {
    const result = securityMonitor.stop();
    res.json({ success: true, ...result });
});
app.get('/monitor/status', (req, res) => {
    res.json({ success: true, ...securityMonitor.getStats() });
});
app.get('/monitor/alerts', (req, res) => {
    const { severity, type, limit, since } = req.query;
    const alerts = securityMonitor.getAlerts({ severity, type, limit: parseInt(limit) || 100, since });
    res.json({ success: true, alerts, count: alerts.length });
});
app.get('/monitor/dashboard', (req, res) => {
    res.json({ success: true, ...securityMonitor.getDashboard() });
});
app.get('/monitor/stream', (req, res) => {
    securityMonitor.addSSEClient(res);
});

// ════════════════════════════════════════════
// ROOT — v5.0 Dashboard
// ════════════════════════════════════════════
app.get('/', (req, res) => {
    const monitorStats = securityMonitor.getStats();
    res.send(`
        <html>
        <body style="background:#0d0d12;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;">
            <div style="font-size:50px;">🔐</div>
            <h1 style="margin:10px 0;background:linear-gradient(135deg,#e11d48,#ff6b3c);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">Aura Hive v5.0 — Shadow Ops</h1>
            <p style="opacity:0.3;">CyberSec Meta-Agent • Port ${PORT}</p>
            <div style="margin-top:20px;padding:20px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px;font-family:monospace;font-size:12px;line-height:2;">
                STATUS: <span style="color:#22c55e;">ONLINE</span><br>
                VERSION: 5.0.0 (Shadow Ops)<br>
                AI: Groq ${GROQ_MODEL}<br>
                TERMINAL: ${terminalProcess ? '<span style="color:#22c55e;">RUNNING</span>' : '<span style="color:#666;">STOPPED</span>'}<br>
                MONITOR: ${monitorStats.is_running ? '<span style="color:#22c55e;">ACTIVE</span>' : '<span style="color:#e11d48;">INACTIVE</span>'}<br>
                ALERTS: ${monitorStats.total_alerts} | ATTACKS: ${monitorStats.attacks_detected}<br>
                SSE CLIENTS: ${sseClients.length}
            </div>
            <div style="margin-top:10px;padding:15px;background:rgba(225,29,72,0.05);border:1px solid rgba(225,29,72,0.15);border-radius:10px;font-family:monospace;font-size:11px;line-height:1.8;color:#f87171;">
                🛡️ Scanner • 🕷️ Recon • 🧬 Exploit Lab • 🔐 Monitor • 📚 Knowledge
            </div>
        </body>
        </html>
    `);
});
// ════════════════════════════════════════════════════════════════
//  🚀 v6.0 PHANTOM ENDPOINTS
// ════════════════════════════════════════════════════════════════

// ── ONLINE ATTACK CLIENT ──
app.post('/attack/start', async (req, res) => {
    try {
        const { target, type, options } = req.body;
        if (!target) return res.json({ success: false, error: 'Target required' });

        let result;
        if (type === 'fuzz') result = await attackClient.fuzzParams(target, options);
        else if (type === 'crawl') result = await attackClient.deepCrawl(target, options);
        else if (type === 'brute') result = await attackClient.bruteForceDirs(target, options);
        else if (type === 'auto') result = await attackClient.autoExploit(target, options);
        else result = await attackClient.detectWAF(target);

        res.json({ success: true, result });
    } catch (err) { res.json({ success: false, error: err.message }); }
});

// ── SWARM AI ──
app.post('/swarm/mission', (req, res) => {
    const { goal, strategy, features, code } = req.body;
    const mission = swarm.createMission(goal, { strategy, features, code });
    const start = swarm.startMission(mission.id);
    res.json({ success: true, mission, start });
});
app.post('/swarm/result', (req, res) => {
    const { taskId, result } = req.body; // Drones call this
    const status = swarm.reportResult(taskId, result);
    res.json(status);
});
app.get('/swarm/status', (req, res) => res.json(swarm.getStatus()));
app.get('/swarm/register', (req, res) => {
    const { id, platform } = req.query;
    const drone = swarm.registerDrone(id, platform);
    res.json({ success: true, drone });
});

// ── PERSISTENT MEMORY ──
app.post('/memory/query', (req, res) => {
    const { q } = req.body;
    const results = memory.search(q);
    res.json({ success: true, results });
});
app.post('/memory/learn', async (req, res) => {
    const { type, data } = req.body;
    if (type === 'error') await memory.rememberError(data.error, data.fix, data.context);
    else if (type === 'solution') await memory.rememberSolution(data.problem, data.solution, data.meta);
    res.json({ success: true });
});
app.get('/memory/stats', (req, res) => res.json(memory.getStats()));

// ── PROJECT CLONER (REVERSE ENGINEER) ──
app.post('/cloner/analyze', async (req, res) => {
    const { url, maxPages } = req.body;
    const analysis = await cloner.analyzeWebsite(url, { maxPages });
    res.json({ success: true, analysis });
});

// ── AUTO-CODE EVOLUTION ──
app.get('/evolution/health', async (req, res) => {
    const report = await evolution.analyzeHealth();
    const improvements = await evolution.generateImprovements(report);
    res.json({ success: true, report, improvements });
});
app.post('/evolution/benchmark', async (req, res) => {
    const { script } = req.body;
    const result = await evolution.benchmark(script);
    res.json({ success: true, result });
});

// ── VOICE COMMANDS ──
app.post('/voice/command', (req, res) => {
    const { text } = req.body;
    const result = voice.process(text);

    // Execute command if simple
    if (result.success && result.intent === 'START_HIVE') {
        console.log('VOICE: Starting Hive Mission...');
    }

    res.json(result);
});

// ════════════════════════════════════════════
// DÉMARRAGE
// ════════════════════════════════════════════
app.listen(PORT, () => {
    console.log(`
  ╔════════════════════════════════════════════════════╗
  ║    ⚡ AURA HIVE v6.0 "PHANTOM" IS ONLINE ⚡      ║
  ╠════════════════════════════════════════════════════╣
  ║  📡 Port: ${PORT}                                 ║
  ║  🤖 Modules: Attack, Swarm, Memory, Cloner       ║
  ║  🧬 Evolution: Active                            ║
  ║  🎙️ Voice: Listening                             ║
  ╚════════════════════════════════════════════════════╝
    `);
    console.log('  🔐 CyberSec Modules: Knowledge | Scanner | Recon | Exploit Lab | Monitor');
});
