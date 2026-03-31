// ════════════════════════════════════════════════════════════════
//  💾 AURA HIVE v6.0 "PHANTOM" — PERSISTENT MEMORY & LEARNING
//  Cross-session memory: errors, solutions, preferences, context
//  Never makes the same mistake twice
// ════════════════════════════════════════════════════════════════
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { EventEmitter } = require('events');

const MEMORY_DIR = path.join(__dirname, '../../.aura-memory');

// ════════════════════════════════════════════
// MEMORY STORE CLASS
// ════════════════════════════════════════════
class MemoryStore extends EventEmitter {
    constructor(options = {}) {
        super();
        this.memoryDir = options.memoryDir || MEMORY_DIR;
        this.loaded = false;

        // Memory banks
        this.errors = [];            // { error, fix, context, timestamp, uses }
        this.solutions = [];         // { problem, solution, language, timestamp }
        this.projects = {};          // projectName → { files, deps, architecture, notes }
        this.preferences = {};       // key → value (coding style, tools, etc.)
        this.conversations = [];     // { id, goal, outcome, learnings, timestamp }
        this.codePatterns = [];      // { pattern, description, language, frequency }
        this.decisions = [];         // { question, decision, reasoning, timestamp }

        // Decay configuration
        this.maxMemories = options.maxMemories || 10000;
        this.decayDays = options.decayDays || 90; // Memories older than this lose priority
    }

    // ── Initialize ──
    async init() {
        try {
            await fs.mkdir(this.memoryDir, { recursive: true });

            // Load all memory banks
            this.errors = await this._loadBank('errors');
            this.solutions = await this._loadBank('solutions');
            this.projects = await this._loadBank('projects', {});
            this.preferences = await this._loadBank('preferences', {});
            this.conversations = await this._loadBank('conversations');
            this.codePatterns = await this._loadBank('codePatterns');
            this.decisions = await this._loadBank('decisions');

            this.loaded = true;
            this.emit('memory:loaded', this.getStats());
            return this.getStats();
        } catch (err) {
            this.emit('memory:error', err.message);
            return { error: err.message };
        }
    }

    // ── Save a Memory Bank ──
    async _saveBank(name, data) {
        const filePath = path.join(this.memoryDir, `${name}.json`);
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    }

    // ── Load a Memory Bank ──
    async _loadBank(name, defaultVal = []) {
        const filePath = path.join(this.memoryDir, `${name}.json`);
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            return JSON.parse(content);
        } catch {
            return defaultVal;
        }
    }

    // ════════════════════════════════════════
    // ERROR LEARNING
    // ════════════════════════════════════════

    // Remember an error and its fix
    async rememberError(error, fix, context = {}) {
        const entry = {
            id: crypto.randomBytes(6).toString('hex'),
            error: typeof error === 'string' ? error : error.message || String(error),
            errorType: context.type || this._classifyError(error),
            fix,
            language: context.language || 'unknown',
            file: context.file || null,
            project: context.project || null,
            timestamp: new Date().toISOString(),
            uses: 0
        };

        // Check for duplicates
        const existing = this.errors.find(e =>
            e.error === entry.error || this._similarity(e.error, entry.error) > 0.85
        );

        if (existing) {
            existing.fix = fix; // Update with latest fix
            existing.uses++;
            existing.lastUsed = entry.timestamp;
        } else {
            this.errors.push(entry);
        }

        await this._saveBank('errors', this.errors);
        this.emit('memory:error_learned', entry);
        return entry;
    }

    // Find a fix for an error
    findFix(error) {
        const errorStr = typeof error === 'string' ? error : error.message || String(error);

        // Exact match first
        const exact = this.errors.find(e => e.error === errorStr);
        if (exact) {
            exact.uses++;
            return { found: true, confidence: 'HIGH', fix: exact.fix, matchType: 'exact', previousUses: exact.uses };
        }

        // Similarity search
        let bestMatch = null;
        let bestScore = 0;

        for (const e of this.errors) {
            const score = this._similarity(e.error, errorStr);
            if (score > bestScore && score > 0.6) {
                bestScore = score;
                bestMatch = e;
            }
        }

        if (bestMatch) {
            bestMatch.uses++;
            return {
                found: true,
                confidence: bestScore > 0.85 ? 'HIGH' : bestScore > 0.7 ? 'MEDIUM' : 'LOW',
                fix: bestMatch.fix,
                matchType: 'similar',
                similarity: Math.round(bestScore * 100) + '%',
                originalError: bestMatch.error
            };
        }

        return { found: false };
    }

    // ════════════════════════════════════════
    // SOLUTION MEMORY
    // ════════════════════════════════════════

    async rememberSolution(problem, solution, meta = {}) {
        const entry = {
            id: crypto.randomBytes(6).toString('hex'),
            problem,
            solution,
            language: meta.language || 'general',
            tags: meta.tags || [],
            timestamp: new Date().toISOString(),
            uses: 0
        };

        this.solutions.push(entry);
        await this._saveBank('solutions', this.solutions);
        this.emit('memory:solution_saved', entry);
        return entry;
    }

    findSolution(query) {
        const queryLower = query.toLowerCase();
        const keywords = queryLower.split(/\s+/).filter(w => w.length > 2);

        return this.solutions
            .map(s => {
                let score = 0;
                const combinedText = `${s.problem} ${s.tags.join(' ')}`.toLowerCase();
                for (const kw of keywords) {
                    if (combinedText.includes(kw)) score += 1;
                }
                score += this._similarity(s.problem.toLowerCase(), queryLower) * 3;
                return { ...s, relevance: score };
            })
            .filter(s => s.relevance > 1)
            .sort((a, b) => b.relevance - a.relevance)
            .slice(0, 5);
    }

    // ════════════════════════════════════════
    // PROJECT CONTEXT
    // ════════════════════════════════════════

    async rememberProject(name, context) {
        if (!this.projects[name]) {
            this.projects[name] = {
                created: new Date().toISOString(),
                files: [],
                dependencies: [],
                architecture: null,
                notes: [],
                techStack: [],
                decisions: []
            };
        }

        // Merge context
        const proj = this.projects[name];
        if (context.files) proj.files = [...new Set([...proj.files, ...context.files])];
        if (context.dependencies) proj.dependencies = [...new Set([...proj.dependencies, ...context.dependencies])];
        if (context.architecture) proj.architecture = context.architecture;
        if (context.note) proj.notes.push({ text: context.note, timestamp: new Date().toISOString() });
        if (context.techStack) proj.techStack = [...new Set([...proj.techStack, ...context.techStack])];
        if (context.decision) proj.decisions.push({ ...context.decision, timestamp: new Date().toISOString() });
        proj.lastUpdated = new Date().toISOString();

        await this._saveBank('projects', this.projects);
        this.emit('memory:project_updated', { name });
        return proj;
    }

    getProject(name) {
        return this.projects[name] || null;
    }

    // ════════════════════════════════════════
    // PREFERENCES
    // ════════════════════════════════════════

    async setPreference(key, value) {
        this.preferences[key] = { value, updatedAt: new Date().toISOString() };
        await this._saveBank('preferences', this.preferences);
        return { key, value };
    }

    getPreference(key) {
        return this.preferences[key]?.value || null;
    }

    getAllPreferences() {
        return Object.fromEntries(
            Object.entries(this.preferences).map(([k, v]) => [k, v.value])
        );
    }

    // ════════════════════════════════════════
    // CONVERSATION LOG
    // ════════════════════════════════════════

    async logConversation(goal, outcome, learnings = []) {
        const entry = {
            id: crypto.randomBytes(6).toString('hex'),
            goal,
            outcome,
            learnings,
            timestamp: new Date().toISOString()
        };

        this.conversations.push(entry);

        // Keep last 500
        if (this.conversations.length > 500) {
            this.conversations = this.conversations.slice(-500);
        }

        await this._saveBank('conversations', this.conversations);
        return entry;
    }

    // ════════════════════════════════════════
    // CODE PATTERNS
    // ════════════════════════════════════════

    async learnPattern(pattern, description, language) {
        const existing = this.codePatterns.find(p => p.pattern === pattern && p.language === language);
        if (existing) {
            existing.frequency++;
            existing.lastSeen = new Date().toISOString();
        } else {
            this.codePatterns.push({
                pattern, description, language,
                frequency: 1,
                firstSeen: new Date().toISOString(),
                lastSeen: new Date().toISOString()
            });
        }
        await this._saveBank('codePatterns', this.codePatterns);
    }

    getTopPatterns(language, limit = 10) {
        return this.codePatterns
            .filter(p => !language || p.language === language)
            .sort((a, b) => b.frequency - a.frequency)
            .slice(0, limit);
    }

    // ════════════════════════════════════════
    // DECISIONS (for Brain context)
    // ════════════════════════════════════════

    async recordDecision(question, decision, reasoning) {
        const entry = {
            id: crypto.randomBytes(6).toString('hex'),
            question, decision, reasoning,
            timestamp: new Date().toISOString()
        };
        this.decisions.push(entry);
        if (this.decisions.length > 200) this.decisions = this.decisions.slice(-200);
        await this._saveBank('decisions', this.decisions);
        return entry;
    }

    // ════════════════════════════════════════
    // BRAIN CONTEXT INJECTION
    // ════════════════════════════════════════

    // Generate context for the Brain's system prompt
    generateBrainContext(currentGoal, currentError = null) {
        const context = {
            relevant_errors: [],
            relevant_solutions: [],
            project_context: null,
            preferences: this.getAllPreferences(),
            recent_decisions: this.decisions.slice(-5)
        };

        // If there's an error, find previous fixes
        if (currentError) {
            const fix = this.findFix(currentError);
            if (fix.found) context.relevant_errors.push(fix);
        }

        // Find relevant solutions for current goal
        if (currentGoal) {
            context.relevant_solutions = this.findSolution(currentGoal);
        }

        return context;
    }

    // ════════════════════════════════════════
    // UTILITY
    // ════════════════════════════════════════

    // Simple string similarity (Dice coefficient)
    _similarity(a, b) {
        if (!a || !b) return 0;
        if (a === b) return 1;

        const aBigrams = new Set();
        const bBigrams = new Set();
        for (let i = 0; i < a.length - 1; i++) aBigrams.add(a.substring(i, i + 2).toLowerCase());
        for (let i = 0; i < b.length - 1; i++) bBigrams.add(b.substring(i, i + 2).toLowerCase());

        let intersection = 0;
        for (const bg of aBigrams) {
            if (bBigrams.has(bg)) intersection++;
        }

        return (2 * intersection) / (aBigrams.size + bBigrams.size);
    }

    // Classify error type
    _classifyError(error) {
        const msg = typeof error === 'string' ? error : error.message || '';
        if (msg.includes('SyntaxError') || msg.includes('Unexpected token')) return 'syntax';
        if (msg.includes('TypeError') || msg.includes('is not a function')) return 'type';
        if (msg.includes('ReferenceError') || msg.includes('is not defined')) return 'reference';
        if (msg.includes('Cannot find module') || msg.includes('MODULE_NOT_FOUND')) return 'module';
        if (msg.includes('ENOENT') || msg.includes('no such file')) return 'file';
        if (msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT')) return 'network';
        if (msg.includes('permission') || msg.includes('EACCES')) return 'permission';
        return 'unknown';
    }

    // Get complete stats
    getStats() {
        return {
            loaded: this.loaded,
            errors_memorized: this.errors.length,
            solutions_saved: this.solutions.length,
            projects_tracked: Object.keys(this.projects).length,
            preferences_set: Object.keys(this.preferences).length,
            conversations_logged: this.conversations.length,
            patterns_learned: this.codePatterns.length,
            decisions_recorded: this.decisions.length,
            total_memories: this.errors.length + this.solutions.length + this.conversations.length + this.codePatterns.length + this.decisions.length
        };
    }

    // Search across all memory banks
    search(query) {
        const results = [];
        const q = query.toLowerCase();

        for (const e of this.errors) {
            if (e.error.toLowerCase().includes(q) || e.fix.toLowerCase().includes(q)) {
                results.push({ type: 'error', data: e, bank: 'errors' });
            }
        }
        for (const s of this.solutions) {
            if (s.problem.toLowerCase().includes(q) || s.solution.toLowerCase().includes(q)) {
                results.push({ type: 'solution', data: s, bank: 'solutions' });
            }
        }
        for (const c of this.conversations) {
            if (c.goal.toLowerCase().includes(q) || c.outcome.toLowerCase().includes(q)) {
                results.push({ type: 'conversation', data: c, bank: 'conversations' });
            }
        }

        return results.slice(0, 20);
    }

    // Wipe all memories
    async wipe() {
        this.errors = [];
        this.solutions = [];
        this.projects = {};
        this.preferences = {};
        this.conversations = [];
        this.codePatterns = [];
        this.decisions = [];

        for (const bank of ['errors', 'solutions', 'projects', 'preferences', 'conversations', 'codePatterns', 'decisions']) {
            await this._saveBank(bank, bank === 'projects' || bank === 'preferences' ? {} : []);
        }

        this.emit('memory:wiped');
        return { status: 'wiped' };
    }
}

module.exports = { MemoryStore };
