// ════════════════════════════════════════════════════════════════
//  🧠 AURA HIVE v6.0 "PHANTOM" — MULTI-DRONE SWARM AI
//  Orchestrate multiple AI chatbots simultaneously:
//  task decomposition, parallel execution, consensus building
// ════════════════════════════════════════════════════════════════
const crypto = require('crypto');
const { EventEmitter } = require('events');

// ════════════════════════════════════════════
// DRONE REGISTRY — Supported AI platforms
// ════════════════════════════════════════════
const DRONE_PROFILES = {
    claude: {
        name: 'Claude',
        strengths: ['reasoning', 'code quality', 'architecture', 'security', 'documentation'],
        weaknesses: ['latest trends', 'real-time data'],
        bestFor: ['backend', 'system design', 'refactoring', 'testing', 'security audit']
    },
    chatgpt: {
        name: 'ChatGPT',
        strengths: ['creativity', 'frontend', 'rapid prototyping', 'explanations', 'variety'],
        weaknesses: ['verbose code', 'consistency'],
        bestFor: ['frontend', 'UI/UX', 'brainstorming', 'content', 'creative tasks']
    },
    gemini: {
        name: 'Gemini',
        strengths: ['search integration', 'data analysis', 'multimodal', 'latest APIs'],
        weaknesses: ['complex logic'],
        bestFor: ['research', 'data processing', 'API integration', 'documentation']
    },
    deepseek: {
        name: 'DeepSeek',
        strengths: ['code generation', 'algorithms', 'math', 'optimization'],
        weaknesses: ['UI design', 'creative writing'],
        bestFor: ['algorithms', 'performance', 'data structures', 'optimization']
    },
    arena: {
        name: 'LMSys Arena',
        strengths: ['comparison', 'diverse models'],
        weaknesses: ['consistency'],
        bestFor: ['testing', 'comparison', 'benchmarking']
    }
};

// ════════════════════════════════════════════
// TASK DECOMPOSITION STRATEGIES
// ════════════════════════════════════════════
const DECOMPOSITION_STRATEGIES = {
    // Split by layer
    fullstack: {
        description: 'Split frontend, backend, and tests across drones',
        split: (goal) => [
            { role: 'backend', prompt: `Backend implementation for: ${goal}. Focus on API, data models, server logic. Node.js.`, bestDrone: 'claude' },
            { role: 'frontend', prompt: `Frontend implementation for: ${goal}. Focus on UI, components, styling. React/HTML.`, bestDrone: 'chatgpt' },
            { role: 'testing', prompt: `Write comprehensive tests for: ${goal}. Unit + integration tests.`, bestDrone: 'gemini' }
        ]
    },
    // Split by feature
    parallel_features: {
        description: 'Each drone builds a different feature',
        split: (goal, features) => features.map((f, i) => ({
            role: `feature_${i}`,
            prompt: `Implement this feature as part of: ${goal}. Feature: ${f}`,
            bestDrone: Object.keys(DRONE_PROFILES)[i % Object.keys(DRONE_PROFILES).length]
        }))
    },
    // Code review consensus
    review: {
        description: 'Multiple drones review the same code for consensus',
        split: (goal, code) => [
            { role: 'reviewer_security', prompt: `Security review this code for: ${goal}. Find vulnerabilities.\n\nCode:\n${code}`, bestDrone: 'claude' },
            { role: 'reviewer_quality', prompt: `Code quality review for: ${goal}. Find bugs, improvements.\n\nCode:\n${code}`, bestDrone: 'chatgpt' },
            { role: 'reviewer_performance', prompt: `Performance review for: ${goal}. Find bottlenecks, optimizations.\n\nCode:\n${code}`, bestDrone: 'deepseek' }
        ]
    },
    // Research + implement
    research_first: {
        description: 'One drone researches, another implements',
        split: (goal) => [
            { role: 'researcher', prompt: `Research best practices, patterns, and approaches for: ${goal}. Provide a technical spec.`, bestDrone: 'gemini', phase: 1 },
            { role: 'implementor', prompt: `Implement the following based on research:\n${goal}`, bestDrone: 'claude', phase: 2, dependsOn: 'researcher' }
        ]
    }
};

// ════════════════════════════════════════════
// SWARM ORCHESTRATOR CLASS
// ════════════════════════════════════════════
class SwarmOrchestrator extends EventEmitter {
    constructor() {
        super();
        this.drones = new Map();       // droneId → { id, platform, status, tabId }
        this.missions = new Map();     // missionId → { goal, tasks, status, results }
        this.taskQueue = [];           // Pending tasks for assignment
        this.activeTasks = new Map();  // taskId → { droneId, status, prompt }
    }

    // ── Register a Drone (browser tab) ──
    registerDrone(droneId, platform, tabId = null) {
        const profile = DRONE_PROFILES[platform] || DRONE_PROFILES.chatgpt;
        const drone = {
            id: droneId,
            platform,
            profile,
            tabId,
            status: 'idle',
            tasksCompleted: 0,
            registeredAt: new Date().toISOString()
        };
        this.drones.set(droneId, drone);
        this.emit('drone:registered', drone);
        return drone;
    }

    // ── Unregister a Drone ──
    unregisterDrone(droneId) {
        this.drones.delete(droneId);
        this.emit('drone:unregistered', { droneId });
    }

    // ── Create a Mission ──
    createMission(goal, options = {}) {
        const missionId = crypto.randomBytes(8).toString('hex');
        const strategy = options.strategy || 'fullstack';
        const decomposer = DECOMPOSITION_STRATEGIES[strategy];
        if (!decomposer) return { error: `Unknown strategy: ${strategy}. Available: ${Object.keys(DECOMPOSITION_STRATEGIES).join(', ')}` };

        // Decompose into tasks
        const tasks = decomposer.split(goal, options.features || options.code);

        const mission = {
            id: missionId,
            goal,
            strategy,
            created: new Date().toISOString(),
            status: 'pending',
            tasks: tasks.map((t, i) => ({
                id: `${missionId}-${i}`,
                ...t,
                status: 'pending',
                assignedDrone: null,
                result: null
            })),
            results: [],
            mergedResult: null
        };

        this.missions.set(missionId, mission);
        this.emit('mission:created', { missionId, goal, taskCount: tasks.length, strategy });
        return mission;
    }

    // ── Start a Mission (assign tasks to drones) ──
    startMission(missionId) {
        const mission = this.missions.get(missionId);
        if (!mission) return { error: 'Mission not found' };

        mission.status = 'running';
        mission.startedAt = new Date().toISOString();

        const assignments = [];

        // Get idle drones sorted by suitability
        for (const task of mission.tasks) {
            if (task.phase && task.dependsOn) {
                task.status = 'waiting'; // Wait for dependency
                continue;
            }

            const assignedDrone = this._findBestDrone(task.bestDrone);

            if (assignedDrone) {
                task.assignedDrone = assignedDrone.id;
                task.status = 'assigned';
                assignedDrone.status = 'busy';
                this.activeTasks.set(task.id, { droneId: assignedDrone.id, task });

                assignments.push({
                    taskId: task.id,
                    droneId: assignedDrone.id,
                    dronePlatform: assignedDrone.platform,
                    prompt: task.prompt,
                    role: task.role
                });

                this.emit('task:assigned', { missionId, taskId: task.id, droneId: assignedDrone.id });
            } else {
                task.status = 'queued';
                this.taskQueue.push({ missionId, task });
            }
        }

        return {
            missionId,
            status: 'running',
            assignments,
            queued: mission.tasks.filter(t => t.status === 'queued').length,
            instruction: 'Send each assignment prompt to its drone tab. Report results via /swarm/result'
        };
    }

    // ── Report Task Result ──
    reportResult(taskId, result) {
        const activeTask = this.activeTasks.get(taskId);
        if (!activeTask) return { error: 'Task not found' };

        const { droneId, task } = activeTask;
        const drone = this.drones.get(droneId);

        // Update task
        task.status = 'complete';
        task.result = result;
        task.completedAt = new Date().toISOString();

        // Free drone
        if (drone) {
            drone.status = 'idle';
            drone.tasksCompleted++;
        }

        this.activeTasks.delete(taskId);
        this.emit('task:completed', { taskId, droneId, role: task.role });

        // Find the mission for this task
        for (const [missionId, mission] of this.missions.entries()) {
            const missionTask = mission.tasks.find(t => t.id === taskId);
            if (missionTask) {
                missionTask.status = 'complete';
                missionTask.result = result;

                // Check for dependent tasks
                const waitingTasks = mission.tasks.filter(t => t.status === 'waiting' && t.dependsOn === task.role);
                for (const wt of waitingTasks) {
                    wt.prompt = wt.prompt + `\n\nResearch results from previous phase:\n${typeof result === 'string' ? result : JSON.stringify(result)}`;
                    wt.status = 'pending';

                    const bestDrone = this._findBestDrone(wt.bestDrone);
                    if (bestDrone) {
                        wt.assignedDrone = bestDrone.id;
                        wt.status = 'assigned';
                        bestDrone.status = 'busy';
                        this.activeTasks.set(wt.id, { droneId: bestDrone.id, task: wt });
                        this.emit('task:assigned', { missionId, taskId: wt.id, droneId: bestDrone.id, prompt: wt.prompt });
                    }
                }

                // Check if all tasks complete
                if (mission.tasks.every(t => t.status === 'complete')) {
                    mission.status = 'complete';
                    mission.completedAt = new Date().toISOString();
                    mission.mergedResult = this._mergeResults(mission);
                    this.emit('mission:complete', { missionId, mergedResult: mission.mergedResult });
                }

                break;
            }
        }

        // Process queue
        this._processQueue();

        return { success: true, taskId, status: 'complete' };
    }

    // ── Find Best Available Drone ──
    _findBestDrone(preferredPlatform) {
        // Try preferred platform first
        for (const [, drone] of this.drones) {
            if (drone.status === 'idle' && drone.platform === preferredPlatform) return drone;
        }
        // Fallback to any idle drone
        for (const [, drone] of this.drones) {
            if (drone.status === 'idle') return drone;
        }
        return null;
    }

    // ── Process Task Queue ──
    _processQueue() {
        while (this.taskQueue.length > 0) {
            const { missionId, task } = this.taskQueue[0];
            const drone = this._findBestDrone(task.bestDrone);
            if (!drone) break;

            this.taskQueue.shift();
            task.assignedDrone = drone.id;
            task.status = 'assigned';
            drone.status = 'busy';
            this.activeTasks.set(task.id, { droneId: drone.id, task });
            this.emit('task:assigned', { missionId, taskId: task.id, droneId: drone.id });
        }
    }

    // ── Merge Results from All Tasks ──
    _mergeResults(mission) {
        const merged = {
            goal: mission.goal,
            strategy: mission.strategy,
            task_count: mission.tasks.length,
            results_by_role: {}
        };

        for (const task of mission.tasks) {
            merged.results_by_role[task.role] = {
                drone: task.assignedDrone,
                result: task.result
            };
        }

        return merged;
    }

    // ── Voting (Consensus) ──
    startVote(question, options = {}) {
        const voteId = crypto.randomBytes(6).toString('hex');
        const vote = {
            id: voteId,
            question,
            created: new Date().toISOString(),
            votes: {},
            status: 'open',
            prompt: `Answer this question with a clear recommendation and brief reasoning:\n\n${question}`
        };

        // Ask all idle drones
        const assignments = [];
        for (const [droneId, drone] of this.drones) {
            if (drone.status === 'idle' || options.forceAll) {
                assignments.push({ droneId, platform: drone.platform, prompt: vote.prompt });
            }
        }

        this.emit('vote:started', { voteId, question, drones: assignments.length });
        return { voteId, assignments, instruction: 'Send the prompt to each drone and report votes via /swarm/vote' };
    }

    // ── Submit Vote ──
    submitVote(voteId, droneId, response) {
        // Simple vote storage
        if (!this._votes) this._votes = new Map();
        let vote = this._votes.get(voteId);
        if (!vote) {
            vote = { id: voteId, votes: {} };
            this._votes.set(voteId, vote);
        }
        vote.votes[droneId] = response;
        this.emit('vote:submitted', { voteId, droneId });
        return { success: true, totalVotes: Object.keys(vote.votes).length };
    }

    // ── Status ──
    getStatus() {
        return {
            drones: [...this.drones.values()].map(d => ({
                id: d.id, platform: d.platform, status: d.status, tasksCompleted: d.tasksCompleted
            })),
            missions: [...this.missions.entries()].map(([id, m]) => ({
                id, goal: m.goal.substring(0, 80), status: m.status,
                tasks: m.tasks.length,
                completed: m.tasks.filter(t => t.status === 'complete').length
            })),
            activeTaskCount: this.activeTasks.size,
            queuedTasks: this.taskQueue.length
        };
    }

    getMission(missionId) { return this.missions.get(missionId); }
    getDroneProfiles() { return DRONE_PROFILES; }
    getStrategies() {
        return Object.entries(DECOMPOSITION_STRATEGIES).map(([name, s]) => ({ name, description: s.description }));
    }
}

module.exports = { SwarmOrchestrator, DRONE_PROFILES, DECOMPOSITION_STRATEGIES };
