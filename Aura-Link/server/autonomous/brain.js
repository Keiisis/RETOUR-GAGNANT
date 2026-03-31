// ════════════════════════════════════════════════════════════════
//  🧠 AURA HIVE v6.0 "PHANTOM" — META-AGENT BRAIN (BMAD Methodology)
//  Rewritten: Robust JSON parsing, exponential backoff,
//  goal decomposition, phase-aware decisions, error recovery
// ════════════════════════════════════════════════════════════════
const Groq = require('groq-sdk');
// ── Configuration ──
console.log('  🧠 Initializing Brain...');
const GROQ_API_KEY = process.env.GROQ_API_KEY;
console.log('  🔑 API Key status:', GROQ_API_KEY ? 'Loaded' : 'MISSING (Check .env)');

const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

let groq;
try {
    if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY is undefined');
    groq = new Groq({ apiKey: GROQ_API_KEY });
} catch (e) {
    console.error('  ❌ Brain Init Error:', e.message);
}

// ── BMAD Phase Definitions ──
const BMAD_PHASES = {
    BUSINESS: { id: 0, name: 'Business Analysis', emoji: '📊', description: 'Understand requirements, define user stories' },
    MODEL: { id: 1, name: 'Data Model & Schema', emoji: '🗄️', description: 'Define types, interfaces, database schemas' },
    ARCHITECTURE: { id: 2, name: 'Architecture & Setup', emoji: '🏗️', description: 'Project structure, configs, dependencies' },
    DEVELOPMENT: { id: 3, name: 'Core Development', emoji: '⚙️', description: 'Build features one file at a time' },
    INTEGRATION: { id: 4, name: 'Integration & Testing', emoji: '🔗', description: 'Wire components, add tests' },
    POLISH: { id: 5, name: 'Polish & Deploy', emoji: '✨', description: 'Refine UX, optimize, deploy configs' },
};
// ── Error Categories (for smarter recovery) ──
const ERROR_CATEGORIES = {
    SYNTAX: { pattern: /SyntaxError|Unexpected token|Parse error/i, fix: 'Fix the syntax error' },
    IMPORT: { pattern: /Cannot find module|Module not found|import.*from/i, fix: 'Fix the import path' },
    TYPE: { pattern: /TypeError|is not a function|is not defined|undefined/i, fix: 'Fix the type error' },
    REFERENCE: { pattern: /ReferenceError|is not defined/i, fix: 'The variable or function is not defined' },
    DEPENDENCY: { pattern: /ENOENT|no such file|missing dependency/i, fix: 'Install missing dependency or create missing file' },
    RUNTIME: { pattern: /Error:|FATAL|CRASH|segfault/i, fix: 'Fix the runtime error' },
    TYPESCRIPT: { pattern: /error TS\d+|Type.*is not assignable/i, fix: 'Fix the TypeScript type error' },
};
function categorizeError(errorLog) {
    for (const [category, info] of Object.entries(ERROR_CATEGORIES)) {
        if (info.pattern.test(errorLog)) {
            return { category, suggestion: info.fix };
        }
    }
    return { category: 'UNKNOWN', suggestion: 'Analyze and fix the error' };
}
// ── System Prompt (Senior Tech Lead — BMAD) ──
const SYSTEM_PROMPT = `
You are the AURA HIVE "Meta-Agent" — a Senior Technical Project Manager & Software Architect.
## YOUR ROLE
You orchestrate a "Coding Drone" (an AI chatbot in a browser: Claude, ChatGPT, Arena, Gemini).
You decide WHAT to build, WHEN to build it, and HOW to fix errors.
The Drone generates code from your prompts. You analyze the results and iterate.

## SERVER API TOOLKIT (v6.0 PHANTOM)
You can instruct the Drone to use these powerful server-side tools via fetch('http://localhost:3666/...'):

1. **ONLINE ATTACK**: POST /attack/start { target, type: 'fuzz'|'crawl'|'brute'|'auto'|'waf', options }
   - Use for: Penetration testing, vulnerability scanning, WAF detection.
2. **SWARM AI**: POST /swarm/mission { goal, strategy: 'fullstack'|'review', features: [] }
   - Use for: Parallel coding, multi-perspective review, complex task decomposition.
3. **MEMORY**: POST /memory/query { q: "search term" } or POST /memory/learn { type: 'error'|'solution', data }
   - Use for: Retrieving past solutions, checking if this error was seen before.
4. **CLONER**: POST /cloner/analyze { url, maxPages: 5 }
   - Use for: Reverse engineering websites to get their stack, design system, and component structure.
5. **EVOLUTION**: GET /evolution/health or POST /evolution/benchmark { script }
   - Use for: Checking code health, getting refactoring prompts, benchmarking performance.
6. **VOICE**: POST /voice/command { text }
   - Use for: Processing natural language commands.

## BMAD METHODOLOGY (STRICT ORDER)
Phase 0 — BUSINESS: Understand the goal. What are we building? For whom? Key features?
Phase 1 — MODEL: Define data structures, TypeScript interfaces, database schemas, API contracts.
Phase 2 — ARCHITECTURE: Project setup. package.json, tsconfig, folder structure, configs.
Phase 3 — DEVELOPMENT: Build features ONE FILE at a time. Components, utilities, services.
Phase 4 — INTEGRATION: Wire everything together. Routes, state management, API connections.
Phase 5 — POLISH: Styling, error boundaries, loading states, README, deployment configs.

## CRITICAL RULES
1. ALWAYS output valid JSON. No markdown fences, no explanations outside JSON.
2. Each prompt_for_drone MUST target exactly ONE file (except when using Swarm/Attack APIs).
3. ALWAYS include the full target filepath (e.g., "Create the file src/utils/auth.ts").
4. Start your prompt with "// file: path/to/file.ext" instruction for the Drone.
5. If last_status is 'error', your prompt MUST quote the exact error message and tell the Drone how to fix it.
6. If last_status is 'success', advance to the next logical file/step.
7. Keep prompts under 2000 characters. Be dense, precise, and technical.
8. Never skip phases. Foundation before features.
9. When fixing errors, reference the specific line and error type.
10. After 3+ errors on the same file, consider a different approach or simpler implementation.
11. **USE THE TOOLS**: If a task is complex, use Swarm. If debugging is hard, use Memory. If optimizing, use Evolution.

## ERROR HANDLING PROTOCOL
When you receive an error:
1. Read the FULL error log. Identify the root cause.
2. Classify: Syntax? Import path? Type mismatch? Missing dependency? Runtime?
3. Generate a TARGETED fix prompt:
   BAD: "Fix the error in the file"
   GOOD: "In file src/App.tsx, line 15, the import './components/Header' should be './components/Header.tsx'. Also, the Props interface is missing the 'onSubmit' property. Here is the corrected version:"
4. If the same file has failed 3+ times, simplify the approach or break it into smaller files.

## OUTPUT FORMAT (STRICT JSON — NO MARKDOWN)
{
  "analysis": "1-2 sentence analysis of current state and what happened",
  "phase": "BUSINESS|MODEL|ARCHITECTURE|DEVELOPMENT|INTEGRATION|POLISH",
  "next_action": "INPUT|STOP",
  "prompt_for_drone": "The exact prompt to send to the AI chatbot. Must start with // file: path/to/file.ext",
  "filename_target": "path/to/target_file.ext",
  "confidence": 0.0-1.0,
  "reasoning": "Why this is the right next step in the BMAD cycle",
  "estimated_complexity": "low|medium|high",
  "dependencies": ["list of files this depends on"]
}
`;
// ════════════════════════════════════════════
// JSON SANITIZER (Robust Parsing)
// ════════════════════════════════════════════
function sanitizeJsonResponse(raw) {
    if (!raw || typeof raw !== 'string') return '{}';

    let cleaned = raw.trim();

    // Remove markdown code fences (all variants)
    cleaned = cleaned.replace(/^```(?:json)?\s*/gim, '');
    cleaned = cleaned.replace(/```\s*$/gim, '');
    cleaned = cleaned.replace(/^```/gm, '');

    // Remove any text before the first {
    const firstBrace = cleaned.indexOf('{');
    if (firstBrace > 0) {
        cleaned = cleaned.substring(firstBrace);
    }

    // Remove any text after the last }
    const lastBrace = cleaned.lastIndexOf('}');
    if (lastBrace >= 0 && lastBrace < cleaned.length - 1) {
        cleaned = cleaned.substring(0, lastBrace + 1);
    }

    // Fix common JSON issues
    cleaned = cleaned.replace(/,\s*}/g, '}');     // trailing commas before }
    cleaned = cleaned.replace(/,\s*]/g, ']');     // trailing commas before ]
    cleaned = cleaned.replace(/\\'/g, "'");       // escaped single quotes
    cleaned = cleaned.replace(/\\t/g, '  ');       // tabs to spaces

    // Fix unescaped newlines inside strings
    cleaned = cleaned.replace(/"([^"]*?)\n([^"]*?)"/g, (match, p1, p2) => {
        return '"' + p1 + '\\n' + p2 + '"';
    });

    // Fix single quotes used as string delimiters (basic cases)
    // Only if no valid double-quoted strings found
    if (!cleaned.includes('"next_action"')) {
        cleaned = cleaned.replace(/'([^']*?)'/g, '"$1"');
    }

    return cleaned;
}
// ── Parse with Retry & Recovery ──
function parseJsonSafe(raw, retryCount = 0) {
    try {
        const sanitized = sanitizeJsonResponse(raw);
        const parsed = JSON.parse(sanitized);

        // Validate required fields
        const required = ['next_action', 'prompt_for_drone'];
        for (const field of required) {
            if (!parsed[field] && parsed[field] !== '') {
                throw new Error(`Missing required field: ${field}`);
            }
        }

        // Normalize & validate
        parsed.next_action = String(parsed.next_action).toUpperCase().trim();
        if (!['INPUT', 'STOP'].includes(parsed.next_action)) {
            parsed.next_action = 'STOP';
        }

        // Apply defaults
        parsed.analysis = parsed.analysis || 'No analysis provided';
        parsed.phase = parsed.phase || 'DEVELOPMENT';
        parsed.confidence = Math.min(1, Math.max(0, parseFloat(parsed.confidence) || 0.7));
        parsed.filename_target = parsed.filename_target || extractFileFromPrompt(parsed.prompt_for_drone);
        parsed.reasoning = parsed.reasoning || '';
        parsed.estimated_complexity = parsed.estimated_complexity || 'medium';
        parsed.dependencies = Array.isArray(parsed.dependencies) ? parsed.dependencies : [];

        return parsed;

    } catch (e) {
        console.error(`  ❌ JSON Parse Error (attempt ${retryCount + 1}): ${e.message}`);
        console.error(`  📄 Raw preview: ${(raw || '').substring(0, 300)}...`);

        // Recovery Strategy 1: Regex extraction
        if (retryCount < 2) {
            const recovered = recoverFromMalformedJson(raw);
            if (recovered) {
                console.log('  🔧 Recovered via regex extraction');
                return recovered;
            }
        }

        // Recovery Strategy 2: Return safe stop
        return {
            analysis: `Brain JSON parse failure: ${e.message}`,
            next_action: 'STOP',
            prompt_for_drone: 'System error — brain parse failure. Stopping.',
            phase: 'DEVELOPMENT',
            filename_target: 'error.log',
            confidence: 0,
            reasoning: `JSON parse failed after ${retryCount + 1} attempts. Raw: ${(raw || '').substring(0, 100)}`,
            estimated_complexity: 'low',
            dependencies: []
        };
    }
}
// ── Regex-based JSON Recovery ──
function recoverFromMalformedJson(raw) {
    if (!raw) return null;

    try {
        // Extract key fields via regex
        const actionMatch = raw.match(/"next_action"\s*:\s*"(INPUT|STOP)"/i);
        const promptMatch = raw.match(/"prompt_for_drone"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        const analysisMatch = raw.match(/"analysis"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        const fileMatch = raw.match(/"filename_target"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        const phaseMatch = raw.match(/"phase"\s*:\s*"(\w+)"/);
        const confidenceMatch = raw.match(/"confidence"\s*:\s*([\d.]+)/);

        if (actionMatch && promptMatch) {
            return {
                analysis: analysisMatch ? analysisMatch[1] : 'Recovered from malformed JSON',
                next_action: actionMatch[1].toUpperCase(),
                prompt_for_drone: promptMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"'),
                phase: phaseMatch ? phaseMatch[1] : 'DEVELOPMENT',
                filename_target: fileMatch ? fileMatch[1] : extractFileFromPrompt(promptMatch[1]),
                confidence: confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.5,
                reasoning: 'Auto-recovered from malformed JSON via regex extraction',
                estimated_complexity: 'medium',
                dependencies: []
            };
        }
    } catch (e) {
        console.error('  Recovery failed:', e.message);
    }

    return null;
}
// ── Extract filename from prompt text ──
function extractFileFromPrompt(prompt) {
    if (!prompt) return 'output.js';

    const patterns = [
        /\/\/\s*file:\s*([^\n]+)/i,
        /create\s+(?:the\s+)?file\s+['`"]?([\w./\-]+)['`"]?/i,
        /in\s+file\s+['`"]?([\w./\-]+)['`"]?/i,
        /([\w./\-]+\.(?:ts|tsx|js|jsx|py|css|html|json|md|yaml|yml|toml|sh))/i,
    ];

    for (const pattern of patterns) {
        const match = prompt.match(pattern);
        if (match) return match[1].trim();
    }

    return 'output.js';
}
// ════════════════════════════════════════════
// CONTEXT BUILDER
// ════════════════════════════════════════════
function buildContextMessage(context) {
    const { goal, history, currentStep, lastCode, lastError, projectFiles, plan } = context;

    // Build history summary (last 8 steps)
    const historySummary = history.length > 0
        ? history.slice(-8).map(h => {
            const status = h.status === 'error' ? '❌ ERROR' : '✅ OK';
            const errorInfo = h.error ? ` | Error: ${h.error.substring(0, 120)}` : '';
            return `  Step ${h.step} [${status}] → ${h.file || 'N/A'}${errorInfo}`;
        }).join('\n')
        : '  No history yet — this is step 1.';

    // Error analysis (if applicable)
    let errorAnalysis = '';
    if (lastError) {
        const { category, suggestion } = categorizeError(lastError);
        errorAnalysis = `
ERROR ANALYSIS:
  Category: ${category}
  Suggestion: ${suggestion}
  Full Error:
  ${lastError.substring(0, 600)}
`;
    }

    // Existing project files
    const fileList = projectFiles && projectFiles.length > 0
        ? `\nEXISTING PROJECT FILES (${projectFiles.length}):\n${projectFiles.slice(-30).map(f => '  📄 ' + f).join('\n')}`
        : '\nNo files created yet.';

    // Plan context
    const planInfo = plan && plan.steps
        ? `\nPLAN (${plan.steps.length} total steps):\n${plan.steps.slice(0, 8).map((s, i) => `  ${i + 1}. [${s.phase}] ${s.description} → ${s.file || 'TBD'}`).join('\n')}`
        : '';

    // Count consecutive errors
    const recentErrors = history.slice(-3).filter(h => h.status === 'error').length;
    const errorWarning = recentErrors >= 2
        ? `\n⚠️ WARNING: ${recentErrors} consecutive errors! Consider simplifying or taking a different approach.`
        : '';

    return `
GOAL: ${goal}
CURRENT STEP: ${currentStep} / ${context.maxSteps || 20}
BMAD PROGRESS: ${determineBmadPhase(history)}
${planInfo}
${fileList}
RECENT HISTORY (last 8 steps):
${historySummary}
${errorWarning}
LAST ACTION RESULT:
Status: ${lastError ? 'ERROR ❌' : (currentStep <= 1 ? '🆕 STARTING' : 'SUCCESS ✅')}
${errorAnalysis}
${lastCode ? `Last Generated Code (first 500 chars):\n${lastCode.substring(0, 500)}` : ''}
Based on BMAD methodology, decide the NEXT atomic step.
Remember: ONE file per step. Include "// file: path/to/file" in prompt_for_drone.
Output ONLY valid JSON. No markdown. No explanations.
`;
}
// ── Determine current BMAD phase from history ──
function determineBmadPhase(history) {
    const successCount = history.filter(h => h.status === 'success').length;

    if (successCount === 0) return 'ARCHITECTURE (Phase 2 — Setup)';
    if (successCount <= 1) return 'MODEL (Phase 1 — Types/Schemas)';
    if (successCount <= 3) return 'DEVELOPMENT (Phase 3 — Core Features)';
    if (successCount <= 6) return 'DEVELOPMENT (Phase 3 — Building Components)';
    if (successCount <= 8) return 'INTEGRATION (Phase 4 — Wiring)';
    return 'POLISH (Phase 5 — Refinement)';
}
// ════════════════════════════════════════════
// MAIN DECISION FUNCTION
// ════════════════════════════════════════════
async function decideNextStep(context, retries = 0) {
    const MAX_RETRIES = 3;
    const BASE_DELAY = 1500; // ms

    try {
        const userMessage = buildContextMessage(context);

        console.log(`  🧠 Brain thinking... (attempt ${retries + 1}, step ${context.currentStep})`);

        if (!groq) throw new Error('Groq client not initialized (check .env)');

        const completion = await groq.chat.completions.create({
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: userMessage }
            ],
            model: GROQ_MODEL,
            temperature: Math.min(0.4 + (retries * 0.15), 0.9), // Increase creativity on retries
            max_tokens: 2048,
            response_format: { type: 'json_object' }
        });

        const raw = completion.choices[0]?.message?.content || '';

        if (!raw.trim()) {
            throw new Error('Empty response from Groq API');
        }

        const decision = parseJsonSafe(raw, retries);

        // Validation: prompt_for_drone must be substantial
        if (decision.next_action === 'INPUT' && decision.prompt_for_drone.length < 20) {
            console.warn('  ⚠️ Prompt too short, may be invalid');
            decision.confidence = Math.min(decision.confidence, 0.3);
        }

        // Auto-inject file comment if missing
        if (decision.next_action === 'INPUT' && !decision.prompt_for_drone.includes('// file:')) {
            decision.prompt_for_drone = `// file: ${decision.filename_target}\n${decision.prompt_for_drone}`;
        }

        // Log decision
        const phase = BMAD_PHASES[decision.phase] || BMAD_PHASES.DEVELOPMENT;
        console.log(`  ${phase.emoji} Brain Decision [${phase.name}]`);
        console.log(`  → Action: ${decision.next_action} | Confidence: ${decision.confidence}`);
        console.log(`  → Target: ${decision.filename_target}`);
        console.log(`  → Analysis: ${decision.analysis.substring(0, 100)}`);

        // Log token usage
        if (completion.usage) {
            console.log(`  📊 Tokens: ${completion.usage.prompt_tokens} in / ${completion.usage.completion_tokens} out`);
        }

        return decision;

    } catch (e) {
        console.error(`  🧠 Brain API Error (attempt ${retries + 1}/${MAX_RETRIES}): ${e.message}`);

        if (retries < MAX_RETRIES) {
            const delay = BASE_DELAY * Math.pow(2, retries); // Exponential backoff: 1.5s, 3s, 6s
            console.log(`  ⏳ Retrying in ${delay}ms...`);
            await new Promise(r => setTimeout(r, delay));
            return decideNextStep(context, retries + 1);
        }

        // Final failure
        console.error(`  💀 Brain DEAD after ${MAX_RETRIES} retries`);
        return {
            analysis: `Brain API failure after ${MAX_RETRIES} retries: ${e.message}`,
            next_action: 'STOP',
            prompt_for_drone: 'Brain disconnected — stopping autonomous loop.',
            phase: 'DEVELOPMENT',
            filename_target: 'error.log',
            confidence: 0,
            reasoning: `API unreachable: ${e.message}`,
            estimated_complexity: 'low',
            dependencies: []
        };
    }
}
// ════════════════════════════════════════════
// GOAL DECOMPOSER (Pre-Planning)
// ════════════════════════════════════════════
async function decomposeGoal(goal, retries = 0) {
    const DECOMPOSE_PROMPT = `You are a senior software architect. Break down a development goal into 
an ordered list of atomic file-level steps following BMAD methodology.
Rules:
- Each step = ONE file to create/modify
- Follow order: types/models → config → utilities → components → pages → integration → polish
- Include file paths
- Keep it realistic (8-15 steps max)
- Output ONLY valid JSON
Output format:
{
  "project_name": "short name",
  "estimated_steps": 10,
  "stack": ["react", "typescript", "etc"],
  "steps": [
    { "phase": "MODEL", "description": "Define Todo interface", "file": "src/types/todo.ts", "priority": 1 },
    { "phase": "ARCHITECTURE", "description": "Setup project config", "file": "tsconfig.json", "priority": 2 }
  ]
}`;

    try {
        if (!groq) throw new Error('Groq client not initialized');

        const completion = await groq.chat.completions.create({
            messages: [
                { role: 'system', content: DECOMPOSE_PROMPT },
                { role: 'user', content: `Decompose this goal into atomic steps:\n\n${goal}` }
            ],
            model: GROQ_MODEL,
            temperature: 0.3,
            max_tokens: 2048,
            response_format: { type: 'json_object' }
        });

        const raw = completion.choices[0]?.message?.content || '{}';
        const plan = parseJsonSafe(raw, 0);

        console.log(`  📋 Goal decomposed: ${plan.steps?.length || 0} steps`);
        if (plan.steps) {
            plan.steps.forEach((s, i) => {
                console.log(`     ${i + 1}. [${s.phase}] ${s.description} → ${s.file}`);
            });
        }

        return plan;

    } catch (e) {
        console.error(`  📋 Goal decomposition failed (attempt ${retries + 1}): ${e.message}`);

        if (retries < 2) {
            await new Promise(r => setTimeout(r, 2000));
            return decomposeGoal(goal, retries + 1);
        }

        return { steps: [], project_name: 'unknown', estimated_steps: 0, stack: [] };
    }
}
// ════════════════════════════════════════════
// EXPORTS
// ════════════════════════════════════════════
module.exports = {
    decideNextStep,
    decomposeGoal,
    BMAD_PHASES,
    categorizeError,
    parseJsonSafe,
    sanitizeJsonResponse
};
