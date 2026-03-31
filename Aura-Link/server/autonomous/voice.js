// ════════════════════════════════════════════════════════════════
//  🎙️ AURA HIVE v6.0 "PHANTOM" — VOICE COMMAND PROCESSOR
//  Interpret natural language voice commands → Hive actions
// ════════════════════════════════════════════════════════════════
const { EventEmitter } = require('events');

// ════════════════════════════════════════════
// VOICE COMMAND PROCESSOR
// ════════════════════════════════════════════
class VoiceProcessor extends EventEmitter {
    constructor() {
        super();
        this.intents = [
            {
                name: 'ATTACK_TARGET',
                patterns: [
                    /attack (.*)/i,
                    /scan (.*)/i,
                    /hack (.*)/i,
                    /check vulnerabilities on (.*)/i
                ],
                action: (match) => ({ type: 'ATTACK', target: this._cleanUrl(match[1]) })
            },
            {
                name: 'RECON_TARGET',
                patterns: [
                    /recon (.*)/i,
                    /reconnaissance (.*)/i,
                    /what is running on (.*)/i,
                    /analyze (.*)/i
                ],
                action: (match) => ({ type: 'RECON', target: this._cleanUrl(match[1]) })
            },
            {
                name: 'START_HIVE',
                patterns: [
                    /start hive/i,
                    /launch aura/i,
                    /wake up/i,
                    /start mission/i
                ],
                action: () => ({ type: 'START_HIVE' })
            },
            {
                name: 'STOP_HIVE',
                patterns: [
                    /stop hive/i,
                    /shutdown/i,
                    /abort mission/i,
                    /stop everything/i
                ],
                action: () => ({ type: 'STOP_HIVE' })
            },
            {
                name: 'CLONE_PROJECT',
                patterns: [
                    /clone (.*)/i,
                    /reverse engineer (.*)/i,
                    /copy (.*)/i,
                    /rebuild (.*)/i
                ],
                action: (match) => ({ type: 'CLONE', target: this._cleanUrl(match[1]) })
            },
            {
                name: 'STATUS_REPORT',
                patterns: [
                    /status report/i,
                    /hive status/i,
                    /what are you doing/i,
                    /show stats/i
                ],
                action: () => ({ type: 'STATUS' })
            }
        ];
    }

    // ── Process Command Text ──
    process(text) {
        if (!text) return { success: false, error: 'No text provided' };

        const normalized = text.trim();

        for (const intent of this.intents) {
            for (const pattern of intent.patterns) {
                const match = normalized.match(pattern);
                if (match) {
                    const result = intent.action(match);
                    this.emit('command:recognized', { text, intent: intent.name, result });
                    return {
                        success: true,
                        intent: intent.name,
                        command: result,
                        original: text,
                        response: this._generateResponse(intent.name, result)
                    };
                }
            }
        }

        // Fallback: General Query
        return {
            success: true,
            intent: 'GENERAL_QUERY',
            command: { type: 'QUERY', query: text },
            original: text,
            response: "Processing your request via the Brain."
        };
    }

    // ── Clean URL Helper ──
    _cleanUrl(input) {
        let url = input.trim().replace(/^(https?:\/\/)?(www\.)?/, '');
        if (!url.startsWith('http')) url = 'https://' + url;
        // Remove trailing punctuation often picked up by voice
        return url.replace(/[.,!?]$/, '');
    }

    // ── Generate Spoken Response ──
    _generateResponse(intent, data) {
        switch (intent) {
            case 'ATTACK_TARGET': return `Initiating attack protocols on ${data.target}.`;
            case 'RECON_TARGET': return `Starting reconnaissance on ${data.target}.`;
            case 'START_HIVE': return "Aura Hive activated.";
            case 'STOP_HIVE': return "Stopping all operations.";
            case 'CLONE_PROJECT': return `Analyzing ${data.target} for cloning.`;
            case 'STATUS_REPORT': return "Displaying system status.";
            default: return "Command recognized.";
        }
    }
}

module.exports = { VoiceProcessor };
