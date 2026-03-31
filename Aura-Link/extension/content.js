// ════════════════════════════════════════════════════════════════
//  ⚡ AURA HIVE v4.0 — Meta-Agent Extension — Content Script
//  Rewritten: Hive Control Panel, Multi-Platform Code Extraction,
//  SSE Terminal Streaming, Smart Auto-Send, Response Detection
// ════════════════════════════════════════════════════════════════

(() => {
    "use strict";

    const API_URL = "http://localhost:3666";
    const VERSION = "4.0.0";

    // ── State ──
    let treeCache = null;
    let treeCacheTime = 0;
    const TREE_CACHE_TTL = 10000;

    let selectedFiles = new Set();
    let expandedFolders = new Set();
    let currentFilter = '';
    let isModalOpen = false;
    let treeData = [];

    // ── Hive State (mirrored from server) ──
    let hiveState = {
        status: 'IDLE',
        goal: '',
        step: 0,
        maxSteps: 10,
        history: []
    };

    // ── Platform Detection ──
    const PLATFORM = detectPlatform();

    function detectPlatform() {
        const host = window.location.hostname;
        if (host.includes('claude.ai')) return 'claude';
        if (host.includes('chatgpt.com') || host.includes('chat.openai.com')) return 'chatgpt';
        if (host.includes('gemini.google.com')) return 'gemini';
        if (host.includes('copilot.microsoft.com')) return 'copilot';
        if (host.includes('arena') || host.includes('lmsys')) return 'arena';
        return 'unknown';
    }

    // ════════════════════════════════════════════
    // 1. UTILS
    // ════════════════════════════════════════════
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    function getFileIcon(ext) {
        const map = {
            js: '🟨', ts: '🟦', jsx: '⚛️', tsx: '⚛️',
            css: '🎨', scss: '🎨', html: '🌐',
            json: '📋', md: '📝', py: '🐍',
            go: '🐹', rs: '🦀', c: '🇨', cpp: '🇨',
            java: '☕', php: '🐘', rb: '💎',
            sql: '🗃️', prisma: '💎', env: '🔒',
            yml: '⚙️', yaml: '⚙️', toml: '⚙️',
            xml: '📰', sh: '🐚', bat: '🦇',
            png: '🖼️', jpg: '🖼️', jpeg: '🖼️', gif: '🖼️', svg: '🖼️',
            pdf: '📕', txt: '📄'
        };
        return map[ext] || '📄';
    }

    function showToast(message, type = 'info') {
        const existing = document.querySelectorAll('.aura-toast');
        existing.forEach(t => t.remove());

        const toast = document.createElement('div');
        toast.className = `aura-toast aura-toast-${type}`;
        toast.innerHTML = `
            <span>${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'}</span>
            <span>${message}</span>
        `;
        document.body.appendChild(toast);

        requestAnimationFrame(() => toast.style.transform = 'translateY(0)');

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    function truncate(str, max = 80) {
        if (!str) return '';
        return str.length > max ? str.substring(0, max) + '…' : str;
    }

    // ════════════════════════════════════════════
    // 2. API CLIENT
    // ════════════════════════════════════════════
    async function apiRequest(endpoint, method = "GET", body = null) {
        try {
            const options = {
                method,
                headers: { "Content-Type": "application/json" }
            };
            if (body) options.body = JSON.stringify(body);

            const res = await fetch(`${API_URL}${endpoint}`, options);
            if (!res.ok) {
                const text = await res.text();
                console.error(`[AuraHive] HTTP ${res.status}: ${text}`);
                return { success: false, error: `HTTP ${res.status}` };
            }
            return await res.json();
        } catch (e) {
            console.error(`[AuraHive] API Error (${endpoint}):`, e);
            return { success: false, error: "Server disconnected" };
        }
    }

    // ════════════════════════════════════════════
    // 3. UI COMPONENTS
    // ════════════════════════════════════════════

    // FAB (Floating Action Button)
    function createFAB() {
        if (document.getElementById('aura-fab')) return;

        const fab = document.createElement('div');
        fab.id = 'aura-fab';
        fab.innerHTML = `
            <button class="aura-fab-btn" id="aura-fab-save" title="Save Code Block">
                <span>💾</span> <span>SAVE</span>
            </button>
            <button class="aura-fab-btn aura-fab-main" id="aura-fab-inject" title="Open Aura Hive">
                <span>⚡</span> <span>HIVE</span>
            </button>
        `;
        document.body.appendChild(fab);

        document.getElementById('aura-fab-inject').addEventListener('click', toggleModal);
        document.getElementById('aura-fab-save').addEventListener('click', handleQuickSave);
    }

    // Main Modal
    function toggleModal() {
        if (isModalOpen) closeModal();
        else openModal();
    }

    function openModal() {
        if (document.getElementById('aura-modal')) return;
        isModalOpen = true;

        const overlay = document.createElement('div');
        overlay.id = 'aura-modal-overlay';

        const modal = document.createElement('div');
        modal.id = 'aura-modal';
        modal.innerHTML = `
            <!-- Header -->
            <div class="aura-header">
                <div class="aura-header-left">
                    <div class="aura-logo">⚡</div>
                    <div>
                        <div class="aura-title">Aura Hive v${VERSION}</div>
                        <div class="aura-subtitle" id="aura-connection-status">CONNECTING...</div>
                    </div>
                </div>
                <div class="aura-header-actions">
                    <span style="font-size:9px;color:rgba(255,255,255,0.2);font-weight:700;letter-spacing:1px;">${PLATFORM.toUpperCase()}</span>
                    <button class="aura-close-btn" id="aura-close">✕</button>
                </div>
            </div>

            <!-- Tabs -->
            <div class="aura-tab-bar">
                <button class="aura-tab aura-tab-active" data-tab="files">
                    <span class="aura-tab-icon">📂</span> FILES
                </button>
                <button class="aura-tab" data-tab="terminal">
                    <span class="aura-tab-icon">💻</span> TERMINAL
                </button>
                <button class="aura-tab" data-tab="hive">
                    <span class="aura-tab-icon">🐝</span> HIVE
                </button>
                <button class="aura-tab" data-tab="memory">
                    <span class="aura-tab-icon">🧠</span> MEMORY
                </button>
                <div style="flex:1"></div>
                <button class="aura-tab" id="aura-refresh-btn">
                    <span class="aura-tab-icon">↻</span>
                </button>
            </div>

            <!-- Content: FILES -->
            <div id="aura-tab-content-files" class="aura-tab-content">
                <div class="aura-search-wrapper">
                    <span class="aura-search-icon">🔍</span>
                    <input type="text" class="aura-search" id="aura-search-input" placeholder="Search files (regex allowed)...">
                </div>
                <div class="aura-stats-bar" id="aura-stats-bar">Loading tree...</div>
                <div class="aura-scroll-area" id="aura-tree-container">
                    <div class="aura-skeleton" style="width:60%"></div>
                    <div class="aura-skeleton" style="width:40%"></div>
                    <div class="aura-skeleton" style="width:70%"></div>
                </div>
                <div class="aura-footer">
                    <span class="aura-footer-info" id="aura-selection-info">0 files selected</span>
                    <div class="aura-footer-actions">
                        <button class="aura-btn aura-btn-secondary" id="aura-btn-clear">Clear</button>
                        <button class="aura-btn aura-btn-primary" id="aura-btn-inject-action" disabled>
                            ⚡ INJECT
                        </button>
                    </div>
                </div>
            </div>

            <!-- Content: TERMINAL -->
            <div id="aura-tab-content-terminal" class="aura-tab-content" style="display:none;">
                <div class="aura-terminal-header">
                    <div class="aura-terminal-dots">
                        <span style="background:#ef4444"></span>
                        <span style="background:#eab308"></span>
                        <span style="background:#22c55e"></span>
                    </div>
                    <div class="aura-live-badge">
                        <div class="aura-live-dot"></div>
                        <span class="aura-live-text">LIVE</span>
                    </div>
                </div>
                <div class="aura-terminal-output" id="aura-terminal-output">
                    <div class="aura-terminal-line">
                        <span class="aura-terminal-time">[SYSTEM]</span>
                        <span class="aura-terminal-text aura-term-info">Connecting to local terminal...</span>
                    </div>
                </div>
                <div class="aura-terminal-footer">
                    <input type="text" class="aura-ai-input" id="aura-cmd-input" placeholder="Enter command...">
                    <button class="aura-btn aura-btn-primary" id="aura-btn-run">RUN</button>
                </div>
            </div>

            <!-- Content: HIVE (NEW v4.0) -->
            <div id="aura-tab-content-hive" class="aura-tab-content" style="display:none;">
                <div style="padding:16px;border-bottom:1px solid rgba(255,255,255,0.06);">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
                        <span style="font-size:20px;">🐝</span>
                        <div>
                            <div style="font-size:13px;font-weight:800;color:#fff;">Autonomous Hive</div>
                            <div style="font-size:9px;color:rgba(255,255,255,0.3);font-weight:700;letter-spacing:1px;" id="aura-hive-status-label">STATUS: IDLE</div>
                        </div>
                        <div style="flex:1;"></div>
                        <div id="aura-hive-step-badge" style="padding:3px 10px;background:rgba(254,117,1,0.1);border:1px solid rgba(254,117,1,0.2);border-radius:8px;font-size:10px;font-weight:800;color:#FE7501;">
                            STEP 0/10
                        </div>
                    </div>
                    <input type="text" class="aura-search" id="aura-hive-goal-input" placeholder="Enter the goal... (e.g. Build a Todo app with React)" style="margin-bottom:8px;">
                    <div style="display:flex;gap:6px;">
                        <input type="number" class="aura-search" id="aura-hive-max-steps" value="10" min="1" max="50" style="width:80px;text-align:center;" title="Max Steps">
                        <button class="aura-btn aura-btn-primary" id="aura-hive-start" style="flex:1;">
                            🚀 START HIVE
                        </button>
                        <button class="aura-btn aura-btn-danger" id="aura-hive-stop" style="display:none;">
                            ⏹ STOP
                        </button>
                    </div>
                </div>
                <div class="aura-scroll-area" id="aura-hive-log" style="font-family:monospace;font-size:11px;line-height:1.8;">
                    <div style="color:rgba(255,255,255,0.15);text-align:center;padding:30px;">
                        No activity yet. Set a goal and press START.
                    </div>
                </div>
            </div>

            <!-- Content: MEMORY -->
            <div id="aura-tab-content-memory" class="aura-tab-content" style="display:none;">
                 <div class="aura-memory-header">
                    <div class="aura-title">Project Context</div>
                 </div>
                 <div class="aura-scroll-area">
                    <textarea class="aura-memory-editor" id="aura-memory-area" placeholder="Notes, tasks, code snippets... (Auto-saved)"></textarea>
                 </div>
            </div>
        `;

        document.body.appendChild(overlay);
        document.body.appendChild(modal);

        requestAnimationFrame(() => {
            overlay.classList.add('aura-visible');
        });

        // Toggle Tabs
        modal.querySelectorAll('.aura-tab[data-tab]').forEach(tab => {
            tab.addEventListener('click', () => switchTab(tab.dataset.tab));
        });

        // Close Handlers
        overlay.addEventListener('click', closeModal);
        document.getElementById('aura-close').addEventListener('click', closeModal);

        // Inject Handler
        document.getElementById('aura-btn-inject-action').addEventListener('click', handleInjectFiles);

        // Search
        document.getElementById('aura-search-input').addEventListener('input', (e) => {
            currentFilter = e.target.value.toLowerCase();
            renderTree();
        });

        // Clear Selection
        document.getElementById('aura-btn-clear').addEventListener('click', () => {
            selectedFiles.clear();
            renderTree();
            updateSelectionUI();
        });

        // Refresh
        document.getElementById('aura-refresh-btn').addEventListener('click', () => {
            treeCache = null;
            loadTree();
        });

        // Terminal command run
        const cmdInput = document.getElementById('aura-cmd-input');
        const runBtn = document.getElementById('aura-btn-run');
        if (cmdInput && runBtn) {
            runBtn.addEventListener('click', () => runTerminalCommand(cmdInput.value));
            cmdInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') runTerminalCommand(cmdInput.value);
            });
        }

        // Hive Controls
        document.getElementById('aura-hive-start').addEventListener('click', startHive);
        document.getElementById('aura-hive-stop').addEventListener('click', stopHive);

        // Load Initial Data
        checkServerStatus();
        loadTree();
        connectTerminalSSE();
    }

    function closeModal() {
        const overlay = document.getElementById('aura-modal-overlay');
        const modal = document.getElementById('aura-modal');
        if (overlay) {
            overlay.classList.remove('aura-visible');
            setTimeout(() => overlay.remove(), 200);
        }
        if (modal) {
            modal.style.transform = "translate(-50%, -48%) scale(0.95)";
            modal.style.opacity = "0";
            setTimeout(() => modal.remove(), 200);
        }
        isModalOpen = false;
    }

    function switchTab(tabName) {
        document.querySelectorAll('.aura-tab').forEach(t => t.classList.remove('aura-tab-active'));
        const activeTab = document.querySelector(`.aura-tab[data-tab="${tabName}"]`);
        if (activeTab) activeTab.classList.add('aura-tab-active');

        document.querySelectorAll('.aura-tab-content').forEach(c => c.style.display = 'none');
        const content = document.getElementById(`aura-tab-content-${tabName}`);
        if (content) content.style.display = 'flex';
    }

    // ════════════════════════════════════════════
    // 4. FILES TAB LOGIC
    // ════════════════════════════════════════════

    async function checkServerStatus() {
        const lbl = document.getElementById('aura-connection-status');
        if (!lbl) return;

        try {
            const res = await apiRequest('/tree?depth=1');
            if (res.success) {
                lbl.innerHTML = `<span style="color:#22c55e">● CONNECTED</span>`;
            } else {
                lbl.innerHTML = `<span style="color:#ef4444">● OFFLINE</span>`;
            }
        } catch {
            lbl.innerHTML = `<span style="color:#ef4444">● OFFLINE</span>`;
        }
    }

    async function loadTree() {
        const res = await apiRequest('/tree?depth=5');
        if (res.success) {
            treeData = res.tree;
            updateStats(res.stats);
            renderTree();
        } else {
            const container = document.getElementById('aura-tree-container');
            if (container) {
                container.innerHTML = `
                    <div class="aura-empty">
                        <span class="aura-empty-text" style="color:#ef4444">Server Offline</span>
                        <button class="aura-btn aura-btn-secondary" onclick="location.reload()">Retry</button>
                    </div>
                `;
            }
        }
    }

    function updateStats(stats) {
        const bar = document.getElementById('aura-stats-bar');
        if (bar) bar.innerHTML = `${stats.totalFiles} files · ${stats.totalDirectories} folders`;
    }

    function renderTree() {
        const container = document.getElementById('aura-tree-container');
        if (!container) return;
        container.innerHTML = '';

        if (treeData.length === 0) return;

        function buildNode(node, depth, parentEl) {
            const isFile = node.type === 'file';
            if (isFile && currentFilter && !node.path.toLowerCase().includes(currentFilter)) return;

            const el = document.createElement('div');
            el.className = 'aura-tree-node';

            const isExpanded = expandedFolders.has(node.path) || !!currentFilter;
            const isSelected = selectedFiles.has(node.path);

            if (node.type === 'directory') {
                el.innerHTML = `
                    <div class="aura-tree-item">
                        <span class="aura-folder-toggle ${isExpanded ? 'aura-open' : ''}">▶</span>
                        <span class="aura-icon">📂</span>
                        <span class="aura-file-name">${node.name}</span>
                    </div>
                `;
                el.querySelector('.aura-tree-item').addEventListener('click', () => {
                    if (expandedFolders.has(node.path)) expandedFolders.delete(node.path);
                    else expandedFolders.add(node.path);
                    renderTree();
                });

                if (isExpanded && node.children) {
                    const childContainer = document.createElement('div');
                    childContainer.className = 'aura-children';
                    node.children.forEach(child => buildNode(child, depth + 1, childContainer));
                    el.appendChild(childContainer);
                }
            } else {
                el.innerHTML = `
                    <div class="aura-tree-item ${isSelected ? 'aura-selected' : ''}">
                        <span class="aura-checkbox">${isSelected ? '✓' : ''}</span>
                        <span class="aura-icon">${getFileIcon(node.extension)}</span>
                        <span class="aura-file-name">${node.name}</span>
                        <span class="aura-file-size">${formatFileSize(node.size)}</span>
                    </div>
                `;
                el.querySelector('.aura-tree-item').addEventListener('click', () => {
                    if (selectedFiles.has(node.path)) selectedFiles.delete(node.path);
                    else selectedFiles.add(node.path);
                    updateSelectionUI();
                    renderTree();
                });
            }
            parentEl.appendChild(el);
        }

        treeData.forEach(node => buildNode(node, 0, container));
    }

    function updateSelectionUI() {
        const count = selectedFiles.size;
        const info = document.getElementById('aura-selection-info');
        if (info) info.innerText = `${count} files selected`;
        const btn = document.getElementById('aura-btn-inject-action');
        if (btn) {
            btn.disabled = count === 0;
            btn.innerHTML = count === 0 ? '⚡ INJECT' : `⚡ INJECT (${count})`;
        }
    }

    async function handleInjectFiles() {
        const files = Array.from(selectedFiles);
        if (files.length === 0) return;

        const btn = document.getElementById('aura-btn-inject-action');
        btn.innerHTML = `<span class="aura-spinner"></span> LOADING...`;

        const res = await apiRequest('/read-multiple', 'POST', { filePaths: files });

        if (res.success) {
            let injectionText = "";
            res.files.forEach(f => {
                if (f.success) {
                    const ext = f.path.split('.').pop();
                    injectionText += `File: ${f.path}\n\`\`\`${ext}\n${f.content}\n\`\`\`\n\n`;
                }
            });

            const success = injectIntoPage(injectionText);
            if (success) {
                showToast(`${res.files.length} files injected!`, 'success');
                closeModal();
            } else {
                showToast("Failed to inject. Click text input first.", 'error');
            }
        } else {
            showToast("Failed to read files.", 'error');
        }

        btn.innerHTML = `⚡ INJECT`;
    }

    // ════════════════════════════════════════════
    // 5. TERMINAL TAB
    // ════════════════════════════════════════════
    let terminalSSE = null;

    function connectTerminalSSE() {
        if (terminalSSE) return; // Already connected

        try {
            terminalSSE = new EventSource(`${API_URL}/terminal/stream`);

            terminalSSE.onmessage = (e) => {
                try {
                    const entry = JSON.parse(e.data);
                    appendTerminalLine(entry.text, entry.type);
                } catch { }
            };

            terminalSSE.onerror = () => {
                terminalSSE.close();
                terminalSSE = null;
                // Reconnect after 5s
                setTimeout(connectTerminalSSE, 5000);
            };
        } catch { }
    }

    function appendTerminalLine(text, type = 'info') {
        const output = document.getElementById('aura-terminal-output');
        if (!output) return;

        const line = document.createElement('div');
        line.className = 'aura-terminal-line';

        const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const colorMap = {
            error: '#ef4444', warning: '#eab308', success: '#22c55e',
            system: '#818cf8', info: 'rgba(255,255,255,0.5)'
        };
        const color = colorMap[type] || colorMap.info;

        line.innerHTML = `
            <span class="aura-terminal-time">[${time}]</span>
            <span class="aura-terminal-text" style="color:${color}">${text}</span>
        `;
        output.appendChild(line);
        output.scrollTop = output.scrollHeight;

        // Limit lines
        while (output.children.length > 500) {
            output.removeChild(output.firstChild);
        }
    }

    async function runTerminalCommand(cmd) {
        if (!cmd || !cmd.trim()) return;
        const input = document.getElementById('aura-cmd-input');
        if (input) input.value = '';

        appendTerminalLine(`$ ${cmd}`, 'system');
        const res = await apiRequest('/exec', 'POST', { command: cmd });
        if (res.success) {
            if (res.output) appendTerminalLine(res.output, 'info');
        } else {
            appendTerminalLine(`Error: ${res.error || 'Unknown'}`, 'error');
        }
    }

    // ════════════════════════════════════════════
    // 6. HIVE TAB (NEW v4.0)
    // ════════════════════════════════════════════

    async function startHive() {
        const goalInput = document.getElementById('aura-hive-goal-input');
        const maxStepsInput = document.getElementById('aura-hive-max-steps');
        const goal = goalInput ? goalInput.value.trim() : '';
        const maxSteps = maxStepsInput ? parseInt(maxStepsInput.value) || 10 : 10;

        if (!goal) {
            showToast('Enter a goal first!', 'warning');
            return;
        }

        hiveLog('🚀 Starting Hive...', '#FE7501');
        hiveLog(`📋 Goal: "${goal}"`, '#818cf8');
        hiveLog(`📊 Max Steps: ${maxSteps}`, 'rgba(255,255,255,0.4)');

        const res = await apiRequest('/autonomous/start', 'POST', { goal, maxSteps });

        if (res.success) {
            hiveState.status = 'RUNNING';
            hiveState.goal = goal;
            hiveState.step = 1;
            hiveState.maxSteps = maxSteps;
            hiveState.history = [];

            hiveLog('✅ Hive Activated — Brain is planning...', '#22c55e');
            if (res.decision) {
                hiveLog(`🧠 Brain: ${truncate(res.decision.analysis, 120)}`, '#818cf8');
            }
            updateHiveUI();
        } else {
            hiveLog(`❌ Failed to start: ${res.error || res.message || 'Unknown'}`, '#ef4444');
        }
    }

    async function stopHive() {
        const res = await apiRequest('/autonomous/stop', 'POST');
        hiveState.status = 'STOPPED';
        hiveLog('⏹ Hive Stopped by user.', '#ef4444');
        updateHiveUI();
    }

    function hiveLog(message, color = 'rgba(255,255,255,0.5)') {
        const log = document.getElementById('aura-hive-log');
        if (!log) return;

        // Clear placeholder
        if (log.querySelector('div[style*="text-align:center"]')) {
            log.innerHTML = '';
        }

        const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const line = document.createElement('div');
        line.style.cssText = `color:${color};padding:2px 4px;border-bottom:1px solid rgba(255,255,255,0.03);`;
        line.innerHTML = `<span style="color:rgba(255,255,255,0.15);margin-right:8px;">[${time}]</span>${message}`;
        log.appendChild(line);
        log.scrollTop = log.scrollHeight;
    }

    function updateHiveUI() {
        const statusLabel = document.getElementById('aura-hive-status-label');
        const stepBadge = document.getElementById('aura-hive-step-badge');
        const startBtn = document.getElementById('aura-hive-start');
        const stopBtn = document.getElementById('aura-hive-stop');

        if (statusLabel) {
            const colorMap = { IDLE: '#888', RUNNING: '#22c55e', STOPPED: '#ef4444', PAUSED: '#eab308' };
            const color = colorMap[hiveState.status] || '#888';
            statusLabel.innerHTML = `STATUS: <span style="color:${color}">${hiveState.status}</span>`;
        }

        if (stepBadge) {
            stepBadge.textContent = `STEP ${hiveState.step}/${hiveState.maxSteps}`;
        }

        if (startBtn && stopBtn) {
            if (hiveState.status === 'RUNNING') {
                startBtn.style.display = 'none';
                stopBtn.style.display = 'flex';
            } else {
                startBtn.style.display = 'flex';
                stopBtn.style.display = 'none';
            }
        }
    }

    // ════════════════════════════════════════════
    // 7. INJECTION ENGINE (Multi-Platform)
    // ════════════════════════════════════════════

    function injectIntoPage(text) {
        // Strategy 1: Use active element if it's an input
        const active = document.activeElement;
        if (active && (active.tagName === 'TEXTAREA' || active.isContentEditable)) {
            document.execCommand('insertText', false, text);
            return true;
        }

        // Strategy 2: Platform-specific selectors
        const platformSelectors = {
            chatgpt: ['#prompt-textarea', 'textarea[data-id="root"]', 'div[contenteditable="true"]'],
            claude: ['.ProseMirror', 'div[contenteditable="true"]', 'fieldset textarea'],
            gemini: ['div[contenteditable="true"]', '.ql-editor', 'rich-textarea textarea'],
            copilot: ['textarea#searchbox', 'textarea', 'div[contenteditable="true"]'],
            arena: ['textarea', '.ProseMirror', 'div[contenteditable="true"]'],
            unknown: ['textarea', 'div[contenteditable="true"]', '.ProseMirror']
        };

        const selectors = platformSelectors[PLATFORM] || platformSelectors.unknown;

        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el) {
                el.focus();
                // Small delay to let the element activate
                setTimeout(() => {
                    document.execCommand('insertText', false, text);
                }, 50);
                return true;
            }
        }

        // Strategy 3: Generic fallback
        const genericSelectors = [
            'textarea[placeholder*="message"]',
            'textarea[placeholder*="Message"]',
            'textarea'
        ];

        for (const sel of genericSelectors) {
            const el = document.querySelector(sel);
            if (el) {
                el.focus();
                document.execCommand('insertText', false, text);
                return true;
            }
        }

        return false;
    }

    // ════════════════════════════════════════════
    // 8. SMART AUTO-SEND (Platform-Aware)
    // ════════════════════════════════════════════

    async function autoClickSend() {
        // Wait for input to propagate in React/Vue virtual DOM
        await new Promise(r => setTimeout(r, 300));

        const platformButtons = {
            chatgpt: [
                'button[data-testid="send-button"]',
                'button[aria-label="Send prompt"]',
                'button[aria-label="Send message"]',
                'form button[type="submit"]'
            ],
            claude: [
                'button[aria-label="Send Message"]',
                'button[aria-label="Send message"]',
                'fieldset button:last-child',
                'button[type="submit"]'
            ],
            gemini: [
                'button[aria-label="Send message"]',
                'button.send-button',
                'mat-icon-button[aria-label="Send message"]'
            ],
            copilot: [
                'button[aria-label="Submit"]',
                'button.submit-button',
                'button[type="submit"]'
            ],
            arena: [
                'button.lg.primary',
                'button[type="submit"]',
                '#component-6 button'
            ],
            unknown: [
                'button[aria-label="Send message"]',
                'button[data-testid="send-button"]',
                'button[type="submit"]',
                'button.send-button'
            ]
        };

        const selectors = platformButtons[PLATFORM] || platformButtons.unknown;

        for (const sel of selectors) {
            const els = document.querySelectorAll(sel);
            for (const el of els) {
                if (el.offsetParent !== null && !el.disabled) {
                    el.click();
                    console.log(`⚡ [AuraHive] Clicked send: ${sel}`);
                    return true;
                }
            }
        }

        // Fallback: Simulate Enter key on active element
        const activeEl = document.activeElement;
        if (activeEl) {
            // For ChatGPT: Enter submits. For Claude: Enter submits.
            const enterEvent = new KeyboardEvent('keydown', {
                bubbles: true, cancelable: true, keyCode: 13, key: 'Enter'
            });
            activeEl.dispatchEvent(enterEvent);
            console.log(`⚡ [AuraHive] Sent via Enter key`);
            return true;
        }

        return false;
    }

    // ════════════════════════════════════════════
    // 9. CODE EXTRACTION (Multi-Platform)
    // ════════════════════════════════════════════

    function extractLastCodeBlock() {
        // Platform-specific code block selectors (ordered by priority)
        const codeSelectors = {
            chatgpt: ['pre code', 'div.code-block code', '.markdown pre code'],
            claude: ['pre code', '.code-block pre', 'code.language-'],
            gemini: ['pre code', '.code-block code', 'code-block code'],
            copilot: ['pre code', '.code-block code'],
            arena: ['pre code', '.code-block', 'pre'],
            unknown: ['pre code', '.code-block', 'pre']
        };

        const selectors = codeSelectors[PLATFORM] || codeSelectors.unknown;

        // Collect ALL code blocks across selectors
        let allBlocks = [];
        for (const sel of selectors) {
            const blocks = document.querySelectorAll(sel);
            if (blocks.length > 0) {
                allBlocks = [...blocks];
                break; // Use the first selector that matches
            }
        }

        if (allBlocks.length === 0) {
            // Last resort: any pre or code element
            allBlocks = [...document.querySelectorAll('pre code, pre')];
        }

        if (allBlocks.length > 0) {
            const lastBlock = allBlocks[allBlocks.length - 1];
            const code = lastBlock.innerText || lastBlock.textContent;
            return code.trim() || null;
        }

        return null;
    }

    // Extract ALL code blocks from the last AI response
    function extractAllCodeBlocks() {
        const blocks = document.querySelectorAll('pre code, pre');
        const results = [];

        blocks.forEach(block => {
            const text = (block.innerText || block.textContent).trim();
            if (text.length > 10) { // Skip tiny snippets
                results.push(text);
            }
        });

        return results;
    }

    // ════════════════════════════════════════════
    // 10. RESPONSE COMPLETION DETECTOR
    // ════════════════════════════════════════════

    function waitForResponseCompletion(stabilityMs = 3000) {
        return new Promise((resolve) => {
            let lastChange = Date.now();
            let settled = false;

            const observer = new MutationObserver(() => {
                lastChange = Date.now();
            });

            // Observe the main content area
            const targetNode = document.querySelector('main') || document.body;
            observer.observe(targetNode, {
                childList: true,
                subtree: true,
                characterData: true
            });

            // Check if "stop generating" / loading indicators disappear
            const checkInterval = setInterval(() => {
                // Platform-specific "generating" indicators
                const generatingIndicators = {
                    chatgpt: 'button[aria-label="Stop generating"]',
                    claude: 'button[aria-label="Stop Response"]',
                    gemini: '.loading-indicator, .generating',
                    copilot: '.typing-indicator',
                    arena: '.generating, .loading'
                };

                const indicator = generatingIndicators[PLATFORM];
                const stillGenerating = indicator ? document.querySelector(indicator) : null;

                if (stillGenerating && stillGenerating.offsetParent !== null) {
                    lastChange = Date.now(); // Reset if still generating
                    return;
                }

                // If no DOM changes for stabilityMs, assume done
                if (Date.now() - lastChange > stabilityMs && !settled) {
                    settled = true;
                    clearInterval(checkInterval);
                    observer.disconnect();
                    resolve();
                }
            }, 500);

            // Safety timeout (3 mins max)
            setTimeout(() => {
                if (!settled) {
                    settled = true;
                    clearInterval(checkInterval);
                    observer.disconnect();
                    console.warn('[AuraHive] Response timeout (180s)');
                    resolve();
                }
            }, 180000);
        });
    }

    // ════════════════════════════════════════════
    // 11. QUICK SAVE
    // ════════════════════════════════════════════

    async function handleQuickSave() {
        const blocks = document.querySelectorAll('pre code, div.code-block, pre');
        if (blocks.length === 0) {
            showToast('No code block found to save.', 'error');
            return;
        }

        const lastBlock = blocks[blocks.length - 1];
        const content = lastBlock.innerText;

        const filePath = prompt("Enter file path to save (e.g. src/utils.js):");
        if (!filePath) return;

        const res = await apiRequest('/write', 'POST', { filePath, content });
        if (res.success) showToast('File saved!', 'success');
        else showToast('Save failed: ' + res.error, 'error');
    }

    // ════════════════════════════════════════════
    // 12. REMOTE CONTROL & HIVE FEEDBACK LOOP
    // ════════════════════════════════════════════

    function initRemoteControl() {
        if (window.auraRemoteActive) return;
        window.auraRemoteActive = true;

        console.log("⚡ [AuraHive] Remote Control Connector Starting...");

        const eventSource = new EventSource(`${API_URL}/remote/stream`);

        eventSource.onopen = () => {
            console.log("⚡ [AuraHive] Connected to Command Center");
            showToast("Remote Control Active", "success");
        };

        eventSource.onerror = () => {
            console.warn("⚡ [AuraHive] Remote Disconnected (Retrying in 5s...)");
            eventSource.close();
            window.auraRemoteActive = false;
            setTimeout(initRemoteControl, 5000);
        };

        eventSource.addEventListener('command', async (e) => {
            try {
                const cmd = JSON.parse(e.data);
                console.log("⚡ [AuraHive] Executing:", cmd);

                let result = null;
                let status = 'success';
                let error = null;

                try {
                    if (cmd.action === 'input') {
                        // 1. Inject Prompt into AI
                        const injected = injectIntoPage(cmd.value);
                        result = injected ? "Input injected" : "Injection failed";

                        // 2. Auto-Send
                        console.log("⚡ [AuraHive] Auto-clicking Send...");
                        await new Promise(r => setTimeout(r, 600));
                        const sent = await autoClickSend();
                        if (sent) result += " & Sent";
                        else result += " (Send button not found — tried Enter)";

                        // 3. If HIVE step, wait for AI response & extract code
                        if (cmd.id && cmd.id.startsWith('hive-')) {
                            console.log("⚡ [AuraHive] Hive Step Detected — Waiting for AI response...");
                            showToast("⏳ Waiting for AI response...", "info");
                            hiveLog(`🔄 Step injected. Waiting for AI...`, '#eab308');

                            await waitForResponseCompletion(4000);

                            // Extract code
                            const code = extractLastCodeBlock();
                            const lastText = document.body.innerText;
                            const logs = lastText.substring(Math.max(0, lastText.length - 800));

                            console.log("⚡ [AuraHive] Response Captured. Code length:", code ? code.length : 0);

                            hiveLog(
                                code
                                    ? `✅ Code captured (${code.length} chars)`
                                    : `⚠️ No code block found in response`,
                                code ? '#22c55e' : '#eab308'
                            );

                            // Update local hive state
                            hiveState.step++;
                            updateHiveUI();

                            // 4. Send Feedback to Server
                            const feedbackRes = await apiRequest('/autonomous/feedback', 'POST', {
                                id: cmd.id,
                                code,
                                logs,
                                status: code ? 'success' : 'no_code'
                            });

                            if (feedbackRes.success) {
                                if (feedbackRes.decision) {
                                    hiveLog(`🧠 Brain: ${truncate(feedbackRes.decision.analysis, 120)}`, '#818cf8');
                                }
                                if (feedbackRes.action === 'stop' || feedbackRes.context?.state === 'STOPPED') {
                                    hiveState.status = 'STOPPED';
                                    hiveLog('🛑 Hive completed.', '#ef4444');
                                    updateHiveUI();
                                }
                            }

                            showToast("✅ Feedback Sent", "success");
                            return; // Feedback sent, done.
                        }
                    }
                    else if (cmd.action === 'click') {
                        const el = document.querySelector(cmd.selector);
                        if (el) {
                            el.click();
                            result = "Clicked " + cmd.selector;
                        } else {
                            throw new Error("Element not found: " + cmd.selector);
                        }
                    }
                    else if (cmd.action === 'scrape') {
                        result = document.body.innerText;
                    }
                    else if (cmd.action === 'extract_code') {
                        const code = extractLastCodeBlock();
                        result = code || 'No code block found';
                    }

                } catch (ex) {
                    status = 'error';
                    error = ex.message;
                    console.error(ex);
                    hiveLog(`❌ Command Error: ${ex.message}`, '#ef4444');
                }

                // Standard Result (non-hive)
                await apiRequest('/remote/result', 'POST', {
                    id: cmd.id,
                    status,
                    result: typeof result === 'string' ? result.substring(0, 5000) : result,
                    error
                });

            } catch (parseErr) {
                console.error("[AuraHive] Command Parse Error", parseErr);
            }
        });
    }

    // ════════════════════════════════════════════
    // 13. INITIALIZATION
    // ════════════════════════════════════════════

    function init() {
        console.log(`%c⚡ Aura Hive v${VERSION} Active [${PLATFORM.toUpperCase()}]`,
            "background: linear-gradient(135deg, #FE7501, #e06800); color: white; padding: 6px 12px; font-weight: bold; border-radius: 4px;"
        );

        // Anti-deletion loop (re-create FAB if removed)
        setInterval(() => {
            if (!document.getElementById('aura-fab')) {
                createFAB();
            }
        }, 2000);

        createFAB();
        initRemoteControl();

        // Keyboard Shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl+Shift+I = Toggle Modal
            if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'i') {
                e.preventDefault();
                toggleModal();
            }
            // Ctrl+Shift+H = Switch to Hive tab
            if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'h') {
                e.preventDefault();
                if (!isModalOpen) openModal();
                setTimeout(() => switchTab('hive'), 100);
            }
        });
    }

    // Run
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
