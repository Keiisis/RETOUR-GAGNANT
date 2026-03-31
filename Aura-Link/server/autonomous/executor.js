// ════════════════════════════════════════════════════════════════
//  ⚙️ AURA HIVE v4.0 — EXECUTOR (Safe Code Runner)
//  Rewritten: Pre-flight syntax checks, auto-backups,
//  multi-language support, event-driven, execution history
// ════════════════════════════════════════════════════════════════
const { exec, execSync, spawn } = require('child_process');
const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
// ════════════════════════════════════════════
// EXECUTOR CLASS
// ════════════════════════════════════════════
class Executor extends EventEmitter {
    constructor(projectRoot, options = {}) {
        super();
        this.projectRoot = projectRoot;
        this.executionHistory = [];
        this.maxHistory = options.maxHistory || 100;
        this.backupDir = path.join(projectRoot, '.aura', 'backups');
        this.defaultTimeout = options.timeout || 15000;

        // Statistics
        this.stats = {
            totalExecutions: 0,
            successCount: 0,
            failureCount: 0,
            totalFilesWritten: 0,
            totalBackupsCreated: 0,
        };

        // Ensure backup directory exists
        this._ensureBackupDir();
    }

    async _ensureBackupDir() {
        try {
            await fs.mkdir(this.backupDir, { recursive: true });
        } catch { }
    }
    // ════════════════════════════════════════════
    // LANGUAGE DETECTION
    // ════════════════════════════════════════════

    detectLanguage(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const map = {
            '.js': { lang: 'javascript', cmd: 'node', checkCmd: 'node --check', executable: true },
            '.mjs': { lang: 'javascript', cmd: 'node', checkCmd: 'node --check', executable: true },
            '.cjs': { lang: 'javascript', cmd: 'node', checkCmd: 'node --check', executable: true },
            '.ts': { lang: 'typescript', cmd: 'npx tsx', checkCmd: null, executable: true },
            '.tsx': { lang: 'typescript', cmd: 'npx tsx', checkCmd: null, executable: false }, // TSX needs a bundler
            '.jsx': { lang: 'javascript', cmd: 'node', checkCmd: null, executable: false }, // JSX needs a bundler
            '.py': { lang: 'python', cmd: 'python3', checkCmd: 'python3 -m py_compile', executable: true },
            '.sh': { lang: 'shell', cmd: 'bash', checkCmd: 'bash -n', executable: true },
            '.rb': { lang: 'ruby', cmd: 'ruby', checkCmd: 'ruby -c', executable: true },
            '.go': { lang: 'go', cmd: 'go run', checkCmd: 'go vet', executable: true },
            '.rs': { lang: 'rust', cmd: 'rustc', checkCmd: 'rustc --edition 2021', executable: true },
            '.json': { lang: 'json', cmd: null, checkCmd: null, executable: false },
            '.html': { lang: 'html', cmd: null, checkCmd: null, executable: false },
            '.css': { lang: 'css', cmd: null, checkCmd: null, executable: false },
            '.scss': { lang: 'scss', cmd: null, checkCmd: null, executable: false },
            '.md': { lang: 'markdown', cmd: null, checkCmd: null, executable: false },
            '.yaml': { lang: 'yaml', cmd: null, checkCmd: null, executable: false },
            '.yml': { lang: 'yaml', cmd: null, checkCmd: null, executable: false },
            '.toml': { lang: 'toml', cmd: null, checkCmd: null, executable: false },
            '.env': { lang: 'env', cmd: null, checkCmd: null, executable: false },
            '.sql': { lang: 'sql', cmd: null, checkCmd: null, executable: false },
            '.prisma': { lang: 'prisma', cmd: null, checkCmd: null, executable: false },
        };
        return map[ext] || { lang: 'unknown', cmd: null, checkCmd: null, executable: false };
    }
    // ════════════════════════════════════════════
    // PRE-FLIGHT SYNTAX CHECK
    // ════════════════════════════════════════════

    async syntaxCheck(filePath, content) {
        const errors = [];
        const warnings = [];
        const ext = path.extname(filePath).toLowerCase();
        const fullPath = path.join(this.projectRoot, filePath);
        // ── JavaScript: node --check ──
        if (['.js', '.mjs', '.cjs'].includes(ext)) {
            try {
                execSync(`node --check "${fullPath}"`, {
                    cwd: this.projectRoot,
                    timeout: 5000,
                    stdio: 'pipe'
                });
            } catch (e) {
                const stderr = e.stderr?.toString() || e.message;
                errors.push({
                    type: 'syntax',
                    language: 'javascript',
                    message: this._cleanErrorMessage(stderr),
                    severity: 'error',
                    line: this._extractLineNumber(stderr)
                });
            }
        }
        // ── TypeScript: Quick check ──
        if (['.ts', '.tsx'].includes(ext)) {
            try {
                // Only check if tsconfig exists
                const tsconfigExists = fsSync.existsSync(path.join(this.projectRoot, 'tsconfig.json'));
                if (tsconfigExists) {
                    const result = execSync(
                        `npx tsc --noEmit --skipLibCheck --pretty false "${fullPath}" 2>&1 | head -30`,
                        { cwd: this.projectRoot, timeout: 20000, stdio: 'pipe', shell: true }
                    );
                    const output = result.toString();
                    if (output.includes('error TS')) {
                        // Extract first 3 errors only
                        const tsErrors = output.split('\n')
                            .filter(l => l.includes('error TS'))
                            .slice(0, 3);
                        tsErrors.forEach(err => {
                            errors.push({
                                type: 'typescript',
                                language: 'typescript',
                                message: err.trim(),
                                severity: 'error',
                                line: this._extractLineNumber(err)
                            });
                        });
                    }
                }
            } catch (e) {
                const output = (e.stdout?.toString() || '') + (e.stderr?.toString() || '');
                if (output.includes('error TS')) {
                    errors.push({
                        type: 'typescript',
                        language: 'typescript',
                        message: output.substring(0, 500),
                        severity: 'error'
                    });
                }
                // If tsc not found, just warn — don't block
                if (output.includes('not found') || output.includes('ENOENT')) {
                    warnings.push({ type: 'tool_missing', message: 'TypeScript compiler not available for checking' });
                }
            }
        }
        // ── Python: py_compile ──
        if (['.py'].includes(ext)) {
            try {
                execSync(`python3 -m py_compile "${fullPath}"`, {
                    cwd: this.projectRoot,
                    timeout: 5000,
                    stdio: 'pipe'
                });
            } catch (e) {
                errors.push({
                    type: 'syntax',
                    language: 'python',
                    message: this._cleanErrorMessage(e.stderr?.toString() || e.message),
                    severity: 'error'
                });
            }
        }
        // ── JSON: Parse check ──
        if (ext === '.json') {
            try {
                JSON.parse(content);
            } catch (e) {
                errors.push({
                    type: 'json',
                    language: 'json',
                    message: `Invalid JSON: ${e.message}`,
                    severity: 'error',
                    line: this._extractJsonErrorLine(e.message)
                });
            }
        }
        // ── Shell: bash -n ──
        if (['.sh', '.bash'].includes(ext)) {
            try {
                execSync(`bash -n "${fullPath}"`, {
                    cwd: this.projectRoot,
                    timeout: 3000,
                    stdio: 'pipe'
                });
            } catch (e) {
                errors.push({
                    type: 'syntax',
                    language: 'shell',
                    message: this._cleanErrorMessage(e.stderr?.toString() || e.message),
                    severity: 'error'
                });
            }
        }
        // ── Content-based heuristics ──
        if (content) {
            // Check for common issues
            if (content.includes('<<<<<<< ')) {
                errors.push({
                    type: 'merge_conflict',
                    message: 'File contains unresolved merge conflict markers',
                    severity: 'error'
                });
            }

            if (content.trim().length === 0) {
                warnings.push({
                    type: 'empty_file',
                    message: 'File is empty',
                    severity: 'warning'
                });
            }

            // Check for placeholder/todo markers that suggest incomplete code
            const placeholders = (content.match(/TODO:|FIXME:|HACK:|XXX:/g) || []).length;
            if (placeholders > 3) {
                warnings.push({
                    type: 'many_todos',
                    message: `File has ${placeholders} TODO/FIXME markers`,
                    severity: 'warning'
                });
            }
        }
        return {
            passed: errors.length === 0,
            errors,
            warnings,
            totalChecks: errors.length + warnings.length
        };
    }
    // ════════════════════════════════════════════
    // SAFE FILE WRITE (with Backup)
    // ════════════════════════════════════════════

    async safeWrite(filePath, content, options = {}) {
        const { createBackup = true, validateContent = true } = options;
        const fullPath = path.join(this.projectRoot, filePath);
        const normalizedPath = path.normalize(filePath);

        // Security: prevent path traversal
        if (normalizedPath.startsWith('..') || path.isAbsolute(normalizedPath)) {
            return { success: false, error: 'Path traversal blocked: ' + filePath };
        }

        try {
            // ── Create backup if file exists ──
            if (createBackup) {
                try {
                    const existing = await fs.readFile(fullPath, 'utf-8');
                    if (existing !== content) { // Only backup if content changed
                        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                        const safeName = filePath.replace(/[\\/\\\\]/g, '_');
                        const backupName = `${safeName}.${timestamp}.bak`;

                        await fs.mkdir(this.backupDir, { recursive: true });
                        await fs.writeFile(path.join(this.backupDir, backupName), existing);
                        this.stats.totalBackupsCreated++;

                        console.log(`  📦 Backup created: ${backupName}`);
                    }
                } catch {
                    // File doesn't exist yet — no backup needed
                }
            }
            // ── Validate content ──
            if (validateContent && content) {
                // Remove potential code fence wrappers from AI output
                content = this._cleanCodeContent(content);
            }
            // ── Ensure directory exists ──
            await fs.mkdir(path.dirname(fullPath), { recursive: true });
            // ── Write file ──
            await fs.writeFile(fullPath, content, 'utf-8');

            const stats = {
                path: filePath,
                size: Buffer.byteLength(content, 'utf-8'),
                lines: content.split('\n').length,
                language: this.detectLanguage(filePath).lang
            };

            this.stats.totalFilesWritten++;
            this.emit('file-written', stats);

            console.log(`  💾 Written: ${filePath} (${stats.lines} lines, ${stats.size} bytes)`);
            return { success: true, ...stats };
        } catch (e) {
            console.error(`  ❌ Write failed (${filePath}): ${e.message}`);
            return { success: false, error: e.message, path: filePath };
        }
    }
    // ── Clean AI-generated code (remove fences, etc.) ──
    _cleanCodeContent(content) {
        let cleaned = content;

        // Remove leading markdown code fence
        if (cleaned.startsWith('```')) {
            const firstNewline = cleaned.indexOf('\n');
            if (firstNewline > 0) {
                cleaned = cleaned.substring(firstNewline + 1);
            }
        }

        // Remove trailing code fence
        if (cleaned.trimEnd().endsWith('```')) {
            cleaned = cleaned.trimEnd().slice(0, -3).trimEnd();
        }

        return cleaned;
    }
    // ════════════════════════════════════════════
    // EXECUTE CODE
    // ════════════════════════════════════════════

    async executeCode(filePath, options = {}) {
        const {
            timeout = this.defaultTimeout,
            skipSyntaxCheck = false,
            env = {},
            args = []
        } = options;
        const fullPath = path.join(this.projectRoot, filePath);
        const langInfo = this.detectLanguage(filePath);
        const startTime = Date.now();
        // Result template
        const result = {
            success: false,
            filePath,
            language: langInfo.lang,
            stdout: '',
            stderr: '',
            exitCode: null,
            duration: 0,
            syntaxErrors: [],
            warnings: [],
            timestamp: new Date().toISOString()
        };
        this.stats.totalExecutions++;
        // ── Non-executable files: just validate ──
        if (!langInfo.executable || !langInfo.cmd) {
            // Still run syntax check for non-executable files
            if (!skipSyntaxCheck) {
                try {
                    const content = await fs.readFile(fullPath, 'utf-8');
                    const checkResult = await this.syntaxCheck(filePath, content);
                    if (!checkResult.passed) {
                        result.syntaxErrors = checkResult.errors;
                        result.warnings = checkResult.warnings;
                        result.stderr = checkResult.errors.map(e => `[${e.type}] ${e.message}`).join('\n');
                        result.exitCode = 1;
                        result.duration = Date.now() - startTime;
                        this.stats.failureCount++;
                        this.addToHistory(result);
                        this.emit('execution-failed', result);
                        return result;
                    }
                } catch { }
            }

            result.success = true;
            result.stdout = `File validated (no execution for ${langInfo.lang} files)`;
            result.exitCode = 0;
            result.duration = Date.now() - startTime;
            this.stats.successCount++;
            this.addToHistory(result);
            return result;
        }
        // ── Pre-flight syntax check ──
        if (!skipSyntaxCheck) {
            try {
                const content = await fs.readFile(fullPath, 'utf-8');
                const syntaxResult = await this.syntaxCheck(filePath, content);
                result.warnings = syntaxResult.warnings;

                if (!syntaxResult.passed) {
                    result.syntaxErrors = syntaxResult.errors;
                    result.stderr = syntaxResult.errors
                        .map(e => `[${e.type.toUpperCase()}] ${e.message}${e.line ? ' (line ' + e.line + ')' : ''}`)
                        .join('\n');
                    result.exitCode = 1;
                    result.duration = Date.now() - startTime;

                    console.log(`  ❌ Pre-flight check FAILED: ${result.stderr.substring(0, 120)}`);
                    this.stats.failureCount++;
                    this.addToHistory(result);
                    this.emit('execution-failed', result);
                    return result;
                }

                console.log(`  ✅ Pre-flight syntax check passed`);
            } catch (e) {
                // If we can't read the file, continue to execution anyway
                console.warn(`  ⚠️ Pre-flight check skipped: ${e.message}`);
            }
        }
        // ── Execute ──
        return new Promise((resolve) => {
            const cmdArgs = args.length > 0 ? ' ' + args.join(' ') : '';
            const cmd = `${langInfo.cmd} "${fullPath}"${cmdArgs}`;

            console.log(`  ⚙️ Executing: ${cmd}`);
            this.emit('execution-start', { filePath, cmd, language: langInfo.lang });
            const childProcess = exec(cmd, {
                cwd: this.projectRoot,
                timeout,
                maxBuffer: 5 * 1024 * 1024, // 5MB
                env: {
                    ...process.env,
                    ...env,
                    NODE_ENV: 'development',
                    FORCE_COLOR: '0' // Disable color codes in output
                },
                shell: true
            }, (error, stdout, stderr) => {
                result.stdout = this._cleanOutput(stdout?.toString() || '');
                result.stderr = this._cleanOutput(stderr?.toString() || '');
                result.exitCode = error ? (error.code || 1) : 0;
                result.success = !error;
                result.duration = Date.now() - startTime;
                this.addToHistory(result);

                if (result.success) {
                    console.log(`  ✅ Execution OK (${result.duration}ms)`);
                    if (result.stdout.trim()) {
                        console.log(`  📤 stdout: ${result.stdout.substring(0, 100)}`);
                    }
                    this.stats.successCount++;
                    this.emit('execution-success', result);
                } else {
                    console.log(`  ❌ Execution FAILED (${result.duration}ms)`);
                    console.log(`  📤 stderr: ${result.stderr.substring(0, 200)}`);
                    this.stats.failureCount++;
                    this.emit('execution-failed', result);
                }
                resolve(result);
            });
            // Handle process-level errors
            childProcess.on('error', (err) => {
                result.stderr = `Process error: ${err.message}`;
                result.exitCode = 1;
                result.duration = Date.now() - startTime;
                this.stats.failureCount++;
                this.addToHistory(result);
                this.emit('execution-failed', result);
                resolve(result);
            });
        });
    }
    // ════════════════════════════════════════════
    // NPM SCRIPT RUNNER
    // ════════════════════════════════════════════

    async runNpmScript(script, options = {}) {
        const { timeout = 30000, env = {} } = options;
        const startTime = Date.now();

        return new Promise((resolve) => {
            const cmd = `npm run ${script}`;
            console.log(`  📦 Running: ${cmd}`);

            exec(cmd, {
                cwd: this.projectRoot,
                timeout,
                maxBuffer: 10 * 1024 * 1024,
                env: { ...process.env, ...env, FORCE_COLOR: '0' }
            }, (error, stdout, stderr) => {
                const result = {
                    success: !error,
                    script,
                    cmd,
                    stdout: this._cleanOutput(stdout?.toString() || ''),
                    stderr: this._cleanOutput(stderr?.toString() || ''),
                    exitCode: error ? (error.code || 1) : 0,
                    duration: Date.now() - startTime
                };

                console.log(`  📦 npm run ${script}: ${result.success ? '✅' : '❌'} (${result.duration}ms)`);
                resolve(result);
            });
        });
    }
    // ════════════════════════════════════════════
    // DEPENDENCY INSTALLER
    // ════════════════════════════════════════════

    async installDeps(packages = [], options = {}) {
        const { dev = false, timeout = 120000 } = options;

        if (packages.length === 0) {
            return { success: true, message: 'No packages to install', packages: [] };
        }

        const flag = dev ? '--save-dev' : '--save';
        const cmd = `npm install ${packages.join(' ')} ${flag}`;

        console.log(`  📦 Installing: ${packages.join(', ')}`);

        return new Promise((resolve) => {
            exec(cmd, {
                cwd: this.projectRoot,
                timeout,
                maxBuffer: 10 * 1024 * 1024
            }, (error, stdout, stderr) => {
                const result = {
                    success: !error,
                    packages,
                    cmd,
                    stdout: stdout?.toString() || '',
                    stderr: stderr?.toString() || '',
                    exitCode: error ? (error.code || 1) : 0
                };

                if (result.success) {
                    console.log(`  ✅ Installed: ${packages.join(', ')}`);
                } else {
                    console.error(`  ❌ Install failed: ${result.stderr.substring(0, 200)}`);
                }

                resolve(result);
            });
        });
    }
    // ════════════════════════════════════════════
    // BATCH EXECUTION (Run multiple files)
    // ════════════════════════════════════════════

    async executeBatch(filePaths, options = {}) {
        const { stopOnError = true } = options;
        const results = [];

        for (const filePath of filePaths) {
            const result = await this.executeCode(filePath, options);
            results.push(result);

            if (!result.success && stopOnError) {
                console.log(`  ⏹️ Batch stopped on error: ${filePath}`);
                break;
            }
        }

        return {
            total: filePaths.length,
            executed: results.length,
            passed: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            results
        };
    }
    // ════════════════════════════════════════════
    // RESTORE FROM BACKUP
    // ════════════════════════════════════════════

    async restoreBackup(filePath) {
        const safeName = filePath.replace(/[\\/\\\\]/g, '_');

        try {
            const backups = await fs.readdir(this.backupDir);
            const matching = backups
                .filter(b => b.startsWith(safeName))
                .sort()
                .reverse();

            if (matching.length === 0) {
                return { success: false, error: 'No backup found for: ' + filePath };
            }

            const latestBackup = matching[0];
            const content = await fs.readFile(path.join(this.backupDir, latestBackup), 'utf-8');
            const fullPath = path.join(this.projectRoot, filePath);

            await fs.writeFile(fullPath, content, 'utf-8');

            console.log(`  🔄 Restored: ${filePath} from ${latestBackup}`);
            return { success: true, backup: latestBackup, path: filePath };

        } catch (e) {
            return { success: false, error: e.message };
        }
    }
    // ════════════════════════════════════════════
    // HISTORY MANAGEMENT
    // ════════════════════════════════════════════

    addToHistory(result) {
        this.executionHistory.push({
            ...result,
            // Don't store full stdout/stderr in history (memory)
            stdout: result.stdout?.substring(0, 500) || '',
            stderr: result.stderr?.substring(0, 500) || ''
        });

        if (this.executionHistory.length > this.maxHistory) {
            this.executionHistory = this.executionHistory.slice(-this.maxHistory);
        }
    }
    getHistory(limit = 10) {
        return this.executionHistory.slice(-limit);
    }
    getErrorHistory(limit = 10) {
        return this.executionHistory
            .filter(r => !r.success)
            .slice(-limit);
    }
    getStats() {
        return {
            ...this.stats,
            successRate: this.stats.totalExecutions > 0
                ? Math.round((this.stats.successCount / this.stats.totalExecutions) * 100)
                : 0,
            historySize: this.executionHistory.length
        };
    }
    // ════════════════════════════════════════════
    // UTILITY METHODS
    // ════════════════════════════════════════════

    _cleanOutput(text) {
        if (!text) return '';
        return text
            .split('\n')
            .filter(line => {
                // Remove Node.js noise
                if (line.includes('ExperimentalWarning')) return false;
                if (line.includes('--trace-deprecation')) return false;
                if (line.includes('source-map-support')) return false;
                if (line.includes('WARNING: Using')) return false;
                return true;
            })
            .join('\n')
            .trim();
    }
    _cleanErrorMessage(msg) {
        if (!msg) return '';
        return msg
            .replace(/\x1b\[[0-9;]*m/g, '')  // Remove ANSI colors
            .replace(/\r/g, '')               // Remove carriage returns
            .trim();
    }
    _extractLineNumber(errorMsg) {
        if (!errorMsg) return null;
        const match = errorMsg.match(/:(\d+)(?::\d+)?/);
        return match ? parseInt(match[1]) : null;
    }
    _extractJsonErrorLine(errorMsg) {
        if (!errorMsg) return null;
        const match = errorMsg.match(/position (\d+)/i);
        return match ? Math.ceil(parseInt(match[1]) / 80) : null; // Rough line estimate
    }
}
// ════════════════════════════════════════════
// EXPORTS
// ════════════════════════════════════════════
module.exports = { Executor };
