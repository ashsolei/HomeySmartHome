---
name: orchestration-plan
description: "Coordinates multi-agent work across HomeySmartHome with parallelization patterns, agent responsibility mapping, conflict resolution, and task sequencing to maximize throughput while maintaining quality gates"
argument-hint: "[task-list]"
---

# Orchestration Plan

Coordinates multi-agent work across the HomeySmartHome platform (179 modules,
Node.js 22, Express 5, Socket.IO 4.8, Docker Compose) to maximize throughput
while preventing merge conflicts and quality regressions.

## Step 1 — Decompose the Task List

Break every incoming task list into atomic work units. Each unit must touch a
distinct set of files so agents can operate in parallel without conflicts.

```js
// Example: decompose a feature request into work units
const workUnits = [
  { id: 'wu-1', scope: 'homey-app/lib/NewSystem.js', type: 'new-module', agent: 'backend' },
  { id: 'wu-2', scope: 'homey-app/server.js',        type: 'registration', agent: 'backend', dependsOn: ['wu-1'] },
  { id: 'wu-3', scope: 'web-dashboard/src/',          type: 'dashboard',    agent: 'frontend' },
  { id: 'wu-4', scope: 'test/',                       type: 'testing',      agent: 'qa', dependsOn: ['wu-1', 'wu-3'] },
  { id: 'wu-5', scope: 'docker-compose.yml',          type: 'infra',        agent: 'devops', dependsOn: ['wu-1'] },
];
```

## Step 2 — Agent Responsibility Matrix

| Agent     | Owns                                      | May Read              | Must Not Touch          |
|-----------|-------------------------------------------|-----------------------|-------------------------|
| backend   | `homey-app/lib/`, `homey-app/server.js`   | `docker-compose.yml`  | `web-dashboard/src/`    |
| frontend  | `web-dashboard/src/`, `web-dashboard/public/` | `homey-app/server.js` | `homey-app/lib/`    |
| qa        | `homey-app/test/`, `web-dashboard/test/`  | all source files      | production source files |
| devops    | `docker-compose.yml`, `deploy.sh`, `nginx/` | all files           | `homey-app/lib/`        |
| docs      | `*.md` in project root and `.github/`     | all files             | any `.js` file          |

Rules:
- An agent must never write to files outside its "Owns" column.
- If a task requires cross-boundary changes, split it into two work units assigned to the correct agents.
- The orchestrator resolves ownership disputes; the agent whose "Owns" list is more specific wins.

## Step 3 — Determine Parallel vs Sequential Execution

```js
// Build a dependency graph from work units
function buildExecutionPlan(workUnits) {
  const graph = {};
  for (const wu of workUnits) {
    graph[wu.id] = { ...wu, blocked: (wu.dependsOn || []).length > 0 };
  }

  const waves = [];
  const completed = new Set();

  while (completed.size < workUnits.length) {
    const wave = Object.values(graph).filter(
      (wu) => !completed.has(wu.id) && (wu.dependsOn || []).every((d) => completed.has(d))
    );
    if (wave.length === 0) throw new Error('Circular dependency detected');
    waves.push(wave.map((wu) => wu.id));
    for (const wu of wave) completed.add(wu.id);
  }
  return waves; // e.g. [['wu-1','wu-3'], ['wu-2','wu-5'], ['wu-4']]
}
```

Decision rules:
- Tasks with **no shared files** and **no dependency edges** run in parallel.
- Tasks that modify `server.js` must be serialized (single registration file).
- Tasks that modify `docker-compose.yml` must be serialized.
- Dashboard module additions are always parallelizable across different component directories.

## Step 4 — Conflict Resolution Protocol

When two agents need to edit the same file:

1. **Lock declaration** — The first agent to start declares a lock on the file path.
2. **Queue** — The second agent queues its change and waits for the lock release.
3. **Merge window** — After the first agent commits, the second agent rebases before applying.
4. **Conflict escalation** — If a rebase fails, the orchestrator reviews both diffs and merges manually.

```js
// Conflict lock tracking structure
const fileLocks = {
  'homey-app/server.js': { agent: 'backend', workUnit: 'wu-2', acquiredAt: Date.now() },
};

function acquireLock(filePath, agent, workUnit) {
  if (fileLocks[filePath]) {
    return { granted: false, heldBy: fileLocks[filePath].agent };
  }
  fileLocks[filePath] = { agent, workUnit, acquiredAt: Date.now() };
  return { granted: true };
}

function releaseLock(filePath, agent) {
  if (fileLocks[filePath] && fileLocks[filePath].agent === agent) {
    delete fileLocks[filePath];
    return true;
  }
  return false;
}
```

## Step 5 — Quality Gate Enforcement Between Waves

After each wave of parallel work completes, run all quality gates before the next
wave begins. This prevents cascading failures.

```js
const qualityGates = [
  { name: 'lint',   cmd: 'npm run lint:all',         maxDuration: 60000 },
  { name: 'test',   cmd: 'npm run test:all',          maxDuration: 120000 },
  { name: 'audit',  cmd: 'npm audit --audit-level=high', maxDuration: 30000 },
  { name: 'docker', cmd: 'docker compose build',      maxDuration: 300000 },
];

async function runGatesBetweenWaves(waveName) {
  console.log(`Running quality gates after wave: ${waveName}`);
  for (const gate of qualityGates) {
    const { execSync } = require('child_process');
    try {
      execSync(gate.cmd, { timeout: gate.maxDuration, cwd: '/Users/macbookpro/HomeySmartHome' });
      console.log(`  PASS: ${gate.name}`);
    } catch (err) {
      console.error(`  FAIL: ${gate.name} — halting pipeline`);
      throw new Error(`Quality gate "${gate.name}" failed after wave "${waveName}"`);
    }
  }
}
```

## Step 6 — Task Sequencing Template

For a typical feature addition across the 179-module platform:

| Wave | Tasks                                         | Agents            | Parallel |
|------|-----------------------------------------------|-------------------|----------|
| 1    | Create module class in `homey-app/lib/`       | backend           | yes      |
| 1    | Create dashboard component in `web-dashboard/`| frontend          | yes      |
| 2    | Register module in `server.js`                | backend           | no       |
| 2    | Add Socket.IO events for real-time updates    | backend           | no       |
| 3    | Write unit tests for module                   | qa                | yes      |
| 3    | Write integration tests for API endpoints     | qa                | yes      |
| 4    | Run all quality gates                         | orchestrator      | no       |
| 5    | Update `docker-compose.yml` if needed         | devops            | no       |
| 6    | Run `./deploy.sh test` for Docker verification| devops            | no       |

## Step 7 — Orchestration Checklist

Before starting:
- [ ] All tasks decomposed into atomic work units
- [ ] Each work unit assigned to exactly one agent
- [ ] Dependency graph has no cycles
- [ ] File ownership boundaries verified (no overlaps)
- [ ] Lock mechanism initialized for shared files

During execution:
- [ ] Each wave starts only after the previous wave passes quality gates
- [ ] File locks acquired before any write operation
- [ ] Agents rebase from main before starting each work unit
- [ ] Progress reported after each work unit completes

After completion:
- [ ] All quality gates pass: `npm run lint:all`, `npm run test:all`, `npm audit`
- [ ] Docker build succeeds: `docker compose build`
- [ ] Health checks pass: `./deploy.sh status`
- [ ] No uncommitted changes: `git status` shows clean working tree
- [ ] All file locks released

## Rules

1. Never start a new wave until the current wave passes all quality gates.
2. Never allow two agents to write to the same file simultaneously.
3. Always run `npm run test:all` before declaring a wave complete.
4. The orchestrator is the only entity that can override agent boundaries.
5. If any quality gate fails, the entire wave must be fixed before proceeding.
6. Keep the dependency graph as shallow as possible to maximize parallelism.
7. Document every lock acquisition and release for audit purposes.
8. Time-box each work unit; escalate if it exceeds 2x the estimated duration.
