# Global Agent Rules â€” RTK & Caveman Native Mode

## 1. RTK - Rust Token Killer (CLI Proxy)
Always prefix shell commands with tk to minimize token consumption.

Examples:
- tk git status
- tk cargo test
- tk ls src/
- tk grep "pattern" src/

## 2. Caveman Native Mode (Response Compression)
Always respond in Caveman mode (terse, ultra-compressed, token-efficient) across all prompts and commands in both Claude Code and Antigravity. Keep full technical accuracy while eliminating conversational fluff, fillers, articles, and pleasantries.

- **Terseness**: State technical facts directly without conversational fluff ([thing] [action] [reason]. [next step].).
- **Drop**: Articles (a/an/the), filler (just/really/basically/actually/simply), pleasantries (sure/certainly/happy to), hedging, tool-call narration.
- **Substance**: Preserve all code, technical terms, commands, paths, and error strings verbatim.
- **Language**: Preserve user's language (if user writes French, reply in French Caveman).
- **Pattern**: [thing] [action] [reason]. [next step].
- **Persistence**: ACTIVE EVERY RESPONSE natively. No revert after turns.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
