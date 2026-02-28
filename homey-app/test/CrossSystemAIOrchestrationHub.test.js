'use strict';

const { describe, it, run } = require('./helpers/runner');
const { assert, assertEqual, assertType, assertInstanceOf } = require('./helpers/assert');
const { createMockHomey } = require('./helpers/mockHomey');
const CrossSystemAIOrchestrationHub = require('../lib/CrossSystemAIOrchestrationHub');

/* ── timer-leak prevention ── */
const _origSetTimeout = global.setTimeout;
const _origSetInterval = global.setInterval;
const activeHandles = [];
global.setTimeout = (...a) => { const id = _origSetTimeout(...a); activeHandles.push({ type: 'timeout', id }); return id; };
global.setInterval = (...a) => { const id = _origSetInterval(...a); activeHandles.push({ type: 'interval', id }); return id; };
function cleanup(sys) {
  try { sys.destroy(); } catch (_) { /* ignore */ }
  while (activeHandles.length > 0) {
    const h = activeHandles.pop();
    if (h.type === 'timeout') clearTimeout(h.id); else clearInterval(h.id);
  }
}

function makeSys() {
  return new CrossSystemAIOrchestrationHub(createMockHomey());
}

async function initSys() {
  const sys = makeSys();
  await sys.initialize();
  return sys;
}

/* ── constructor ── */
describe('CrossSystemAIOrchestrationHub – constructor', () => {
  it('creates default data structures', () => {
    const sys = makeSys();
    try {
      assertEqual(sys.initialized, false);
      assertInstanceOf(sys.systems, Map);
      assertEqual(sys.systems.size, 0);
      assert(Array.isArray(sys.systemCategories), 'systemCategories is array');
      assertEqual(sys.systemCategories.length, 12);
      assertInstanceOf(sys.scenarios, Map);
      assertInstanceOf(sys.circuitBreakers, Map);
      assertInstanceOf(sys.resourceBudgets, Map);
      assertInstanceOf(sys.dependencyGraph, Map);
      assertInstanceOf(sys.communicationChannels, Map);
      assertInstanceOf(sys.pendingRequests, Map);
      assertEqual(sys.requestTimeout, 5000);
      assertEqual(sys.confidenceThreshold, 0.6);
      assert(Array.isArray(sys.decisionLog), 'decisionLog');
      assert(Array.isArray(sys.learningFeedback), 'learningFeedback');
      assert(Array.isArray(sys.discoveredSystems), 'discoveredSystems');
      assert(Array.isArray(sys.integrationSuggestions), 'integrationSuggestions');
      assert(Array.isArray(sys.intervals), 'intervals');
      assertType(sys.performanceMetrics, 'object');
      assertType(sys.eventBusAnalytics, 'object');
      assertType(sys.mlPatterns, 'object');
      assertType(sys.loadBalancer, 'object');
      assertType(sys.orchestrationQueue, 'object');
    } finally { cleanup(sys); }
  });

  it('has 12 system categories', () => {
    const sys = makeSys();
    try {
      const expected = [
        'energy', 'security', 'comfort', 'health', 'utility', 'automation',
        'entertainment', 'environment', 'transport', 'food', 'education', 'maintenance'
      ];
      for (const cat of expected) {
        assert(sys.systemCategories.includes(cat), 'missing category: ' + cat);
      }
    } finally { cleanup(sys); }
  });
});

/* ── initialize ── */
describe('CrossSystemAIOrchestrationHub – initialize', () => {
  it('populates rules, scenarios, dependencies and intervals', async () => {
    const sys = makeSys();
    try {
      await sys.initialize();
      assertEqual(sys.initialized, true);
      assertEqual(sys.rulesDatabase.length, 52);
      assertEqual(sys.scenarios.size, 15);
      assertEqual(sys.dependencyGraph.size, 10);
      assert(sys.intervals.length >= 10, 'at least 10 intervals');
    } finally { cleanup(sys); }
  });
});

/* ── destroy ── */
describe('CrossSystemAIOrchestrationHub – destroy', () => {
  it('clears all collections and resets state', async () => {
    const sys = await initSys();
    sys.registerSystem({ name: 'destroy-test', category: 'energy' });
    sys.destroy();
    assertEqual(sys.initialized, false);
    assertEqual(sys.systems.size, 0);
    assertEqual(sys.scenarios.size, 0);
    assertEqual(sys.circuitBreakers.size, 0);
    assertEqual(sys.dependencyGraph.size, 0);
    assertEqual(sys.resourceBudgets.size, 0);
    assertEqual(sys.communicationChannels.size, 0);
    assertEqual(sys.pendingRequests.size, 0);
    assertEqual(sys.intervals.length, 0);
    assertEqual(sys.decisionLog.length, 0);
    assertEqual(sys.learningFeedback.length, 0);
    assertEqual(sys.discoveredSystems.length, 0);
    assertEqual(sys.orchestrationQueue.queue.length, 0);
    assertEqual(sys.orchestrationQueue.deadLetterQueue.length, 0);
    cleanup(sys);
  });
});

/* ── registerSystem ── */
describe('CrossSystemAIOrchestrationHub – registerSystem', () => {
  it('registers a valid system and creates circuit breaker + budget', async () => {
    const sys = await initSys();
    try {
      const result = sys.registerSystem({ name: 'test-lights', category: 'comfort' });
      assertEqual(result, true);
      assert(sys.systems.has('test-lights'), 'system registered');
      assertEqual(sys.systems.get('test-lights').category, 'comfort');
      assert(sys.circuitBreakers.has('test-lights'), 'circuit breaker created');
      assert(sys.resourceBudgets.has('test-lights'), 'resource budget created');
    } finally { cleanup(sys); }
  });

  it('returns false when name is missing', async () => {
    const sys = await initSys();
    try {
      assertEqual(sys.registerSystem({ category: 'energy' }), false);
    } finally { cleanup(sys); }
  });

  it('returns false for invalid category', async () => {
    const sys = await initSys();
    try {
      assertEqual(sys.registerSystem({ name: 'x', category: 'bogus-cat' }), false);
    } finally { cleanup(sys); }
  });
});

/* ── unregisterSystem ── */
describe('CrossSystemAIOrchestrationHub – unregisterSystem', () => {
  it('removes existing system', async () => {
    const sys = await initSys();
    try {
      sys.registerSystem({ name: 'unreg', category: 'energy' });
      assertEqual(sys.unregisterSystem('unreg'), true);
      assertEqual(sys.systems.has('unreg'), false);
      assertEqual(sys.circuitBreakers.has('unreg'), false);
    } finally { cleanup(sys); }
  });

  it('returns false for unknown system', async () => {
    const sys = await initSys();
    try {
      assertEqual(sys.unregisterSystem('nonexistent'), false);
    } finally { cleanup(sys); }
  });
});

/* ── heartbeat ── */
describe('CrossSystemAIOrchestrationHub – heartbeat', () => {
  it('updates system metrics', async () => {
    const sys = await initSys();
    try {
      sys.registerSystem({ name: 'hb', category: 'energy' });
      assertEqual(sys.heartbeat('hb', { cpuUsagePercent: 25, memoryUsageMB: 64 }), true);
      const entry = sys.systems.get('hb');
      assertEqual(entry.cpuUsagePercent, 25);
      assertEqual(entry.memoryUsageMB, 64);
    } finally { cleanup(sys); }
  });

  it('recovers degraded system with half-open circuit breaker', async () => {
    const sys = await initSys();
    try {
      sys.registerSystem({ name: 'rec', category: 'energy' });
      const entry = sys.systems.get('rec');
      entry.status = 'degraded';
      const cb = sys.circuitBreakers.get('rec');
      cb.state = 'half-open';
      sys.heartbeat('rec', { cpuUsagePercent: 10 });
      assertEqual(entry.status, 'online');
      assertEqual(cb.state, 'closed');
    } finally { cleanup(sys); }
  });

  it('returns false for unknown system', async () => {
    const sys = await initSys();
    try {
      assertEqual(sys.heartbeat('ghost', {}), false);
    } finally { cleanup(sys); }
  });
});

/* ── getSystem ── */
describe('CrossSystemAIOrchestrationHub – getSystem', () => {
  it('returns direct reference for existing system', async () => {
    const sys = await initSys();
    try {
      sys.registerSystem({ name: 'direct', category: 'comfort' });
      const ref = sys.getSystem('direct');
      assertType(ref, 'object');
      ref.status = 'offline';
      assertEqual(sys.systems.get('direct').status, 'offline');
    } finally { cleanup(sys); }
  });

  it('returns null for unknown system', async () => {
    const sys = await initSys();
    try {
      assertEqual(sys.getSystem('nope'), null);
    } finally { cleanup(sys); }
  });
});

/* ── getSystemsByCategory ── */
describe('CrossSystemAIOrchestrationHub – getSystemsByCategory', () => {
  it('returns shallow copies of matched systems', async () => {
    const sys = await initSys();
    try {
      sys.registerSystem({ name: 'e1', category: 'energy' });
      sys.registerSystem({ name: 'e2', category: 'energy' });
      sys.registerSystem({ name: 'c1', category: 'comfort' });
      const results = sys.getSystemsByCategory('energy');
      assertEqual(results.length, 2);
      results[0].status = 'offline';
      assertEqual(sys.systems.get('e1').status, 'online');
    } finally { cleanup(sys); }
  });
});

/* ── getOnlineSystems ── */
describe('CrossSystemAIOrchestrationHub – getOnlineSystems', () => {
  it('filters by online status and returns copies', async () => {
    const sys = await initSys();
    try {
      sys.registerSystem({ name: 'on1', category: 'energy' });
      sys.registerSystem({ name: 'off1', category: 'comfort' });
      sys.systems.get('off1').status = 'offline';
      const online = sys.getOnlineSystems();
      assertEqual(online.length, 1);
      assert(online.every(s => s.status === 'online'), 'all online');
    } finally { cleanup(sys); }
  });
});

/* ── reportSystemError ── */
describe('CrossSystemAIOrchestrationHub – reportSystemError', () => {
  it('opens circuit breaker after 3 failures', async () => {
    const sys = await initSys();
    try {
      sys.registerSystem({ name: 'err-sys', category: 'security' });
      sys.reportSystemError('err-sys', new Error('fail 1'));
      sys.reportSystemError('err-sys', new Error('fail 2'));
      assertEqual(sys.circuitBreakers.get('err-sys').state, 'closed');
      sys.reportSystemError('err-sys', new Error('fail 3'));
      assertEqual(sys.circuitBreakers.get('err-sys').state, 'open');
      assertEqual(sys.systems.get('err-sys').status, 'degraded');
    } finally { cleanup(sys); }
  });
});

/* ── evaluateRules ── */
describe('CrossSystemAIOrchestrationHub – evaluateRules', () => {
  it('returns array of decisions for matching context', async () => {
    const sys = await initSys();
    try {
      const decisions = await sys.evaluateRules({ temperature: 30 });
      assert(Array.isArray(decisions), 'returns array');
    } finally { cleanup(sys); }
  });

  it('returns array for empty context', async () => {
    const sys = await initSys();
    try {
      const decisions = await sys.evaluateRules({});
      assert(Array.isArray(decisions), 'returns array');
    } finally { cleanup(sys); }
  });
});

/* ── executeScenario ── */
describe('CrossSystemAIOrchestrationHub – executeScenario', () => {
  it('returns error for unknown scenario', async () => {
    const sys = await initSys();
    try {
      const result = await sys.executeScenario('nonexistent');
      assertEqual(result.success, false);
      assertEqual(result.error, 'Unknown scenario');
    } finally { cleanup(sys); }
  });

  it('returns error for disabled scenario', async () => {
    const sys = await initSys();
    try {
      sys.setScenarioEnabled('morning-routine', false);
      const result = await sys.executeScenario('morning-routine');
      assertEqual(result.success, false);
      assertEqual(result.error, 'Scenario disabled');
    } finally { cleanup(sys); }
  });

  it('executes enabled scenario successfully', async () => {
    const sys = await initSys();
    try {
      const result = await sys.executeScenario('morning-routine');
      assertEqual(result.success, true);
      assertType(result.duration, 'number');
      assert(Array.isArray(result.results), 'results is array');
      assertEqual(sys.scenarios.get('morning-routine').executionCount, 1);
    } finally { cleanup(sys); }
  });
});

/* ── setScenarioEnabled ── */
describe('CrossSystemAIOrchestrationHub – setScenarioEnabled', () => {
  it('toggles scenario enabled state', async () => {
    const sys = await initSys();
    try {
      assertEqual(sys.setScenarioEnabled('bedtime', false), true);
      assertEqual(sys.scenarios.get('bedtime').enabled, false);
      assertEqual(sys.setScenarioEnabled('bedtime', true), true);
      assertEqual(sys.scenarios.get('bedtime').enabled, true);
    } finally { cleanup(sys); }
  });

  it('returns false for unknown scenario', async () => {
    const sys = await initSys();
    try {
      assertEqual(sys.setScenarioEnabled('fake', false), false);
    } finally { cleanup(sys); }
  });
});

/* ── getScenario ── */
describe('CrossSystemAIOrchestrationHub – getScenario', () => {
  it('returns direct reference for known scenario', async () => {
    const sys = await initSys();
    try {
      const s = sys.getScenario('party-mode');
      assertType(s, 'object');
      assertEqual(s.name, 'party-mode');
    } finally { cleanup(sys); }
  });

  it('returns null for unknown scenario', async () => {
    const sys = await initSys();
    try {
      assertEqual(sys.getScenario('nope'), null);
    } finally { cleanup(sys); }
  });
});

/* ── listScenarios ── */
describe('CrossSystemAIOrchestrationHub – listScenarios', () => {
  it('returns 15 summary objects', async () => {
    const sys = await initSys();
    try {
      const list = sys.listScenarios();
      assertEqual(list.length, 15);
      const first = list[0];
      assertType(first.name, 'string');
      assertType(first.description, 'string');
      assertType(first.enabled, 'boolean');
      assertType(first.priority, 'number');
      assertType(first.executionCount, 'number');
    } finally { cleanup(sys); }
  });
});

/* ── recordEvent ── */
describe('CrossSystemAIOrchestrationHub – recordEvent', () => {
  it('increments eventsProcessed counter', async () => {
    const sys = await initSys();
    try {
      const before = sys.performanceMetrics.eventsProcessed;
      sys.recordEvent('test-event', 'src', 'tgt');
      assertEqual(sys.performanceMetrics.eventsProcessed, before + 1);
    } finally { cleanup(sys); }
  });
});

/* ── recordResponseTime ── */
describe('CrossSystemAIOrchestrationHub – recordResponseTime', () => {
  it('pushes to responseTimes array', async () => {
    const sys = await initSys();
    try {
      sys.registerSystem({ name: 'rt', category: 'utility' });
      const before = sys.performanceMetrics.responseTimes.length;
      sys.recordResponseTime('rt', 42);
      assertEqual(sys.performanceMetrics.responseTimes.length, before + 1);
    } finally { cleanup(sys); }
  });
});

/* ── getEventBusTopActors ── */
describe('CrossSystemAIOrchestrationHub – getEventBusTopActors', () => {
  it('returns publishers, subscribers, bottlenecks', async () => {
    const sys = await initSys();
    try {
      sys.recordEvent('ev1', 'pub-a', 'sub-b');
      const actors = sys.getEventBusTopActors();
      assert(Array.isArray(actors.publishers), 'publishers');
      assert(Array.isArray(actors.subscribers), 'subscribers');
      assert(Array.isArray(actors.bottlenecks), 'bottlenecks');
    } finally { cleanup(sys); }
  });
});

/* ── getPredictions ── */
describe('CrossSystemAIOrchestrationHub – getPredictions', () => {
  it('returns predictions structure', async () => {
    const sys = await initSys();
    try {
      const p = sys.getPredictions();
      assert(Array.isArray(p.predictions), 'predictions');
      assert(Array.isArray(p.anomalies), 'anomalies');
      assertType(p.patternCount, 'object');
    } finally { cleanup(sys); }
  });
});

/* ── setResourceBudget ── */
describe('CrossSystemAIOrchestrationHub – setResourceBudget', () => {
  it('updates existing budget', async () => {
    const sys = await initSys();
    try {
      sys.registerSystem({ name: 'rb', category: 'energy' });
      assertEqual(sys.setResourceBudget('rb', { maxCpuPercent: 30, maxMemoryMB: 256 }), true);
      const budget = sys.resourceBudgets.get('rb');
      assertEqual(budget.maxCpuPercent, 30);
      assertEqual(budget.maxMemoryMB, 256);
    } finally { cleanup(sys); }
  });

  it('returns false for non-existent system', async () => {
    const sys = await initSys();
    try {
      assertEqual(sys.setResourceBudget('nope', { maxCpuPercent: 10 }), false);
    } finally { cleanup(sys); }
  });
});

/* ── getResourceUsage ── */
describe('CrossSystemAIOrchestrationHub – getResourceUsage', () => {
  it('returns systems array and global object', async () => {
    const sys = await initSys();
    try {
      const usage = sys.getResourceUsage();
      assert(Array.isArray(usage.systems), 'systems array');
      assertType(usage.global, 'object');
    } finally { cleanup(sys); }
  });
});

/* ── getStartupOrder ── */
describe('CrossSystemAIOrchestrationHub – getStartupOrder', () => {
  it('returns topological sort of dependencies', async () => {
    const sys = await initSys();
    try {
      const order = sys.getStartupOrder();
      assert(Array.isArray(order), 'is array');
      assert(order.length > 0, 'has entries');
    } finally { cleanup(sys); }
  });
});

/* ── getDependents ── */
describe('CrossSystemAIOrchestrationHub – getDependents', () => {
  it('finds systems that depend on energy-manager', async () => {
    const sys = await initSys();
    try {
      const deps = sys.getDependents('energy-manager');
      assert(Array.isArray(deps), 'is array');
      assert(deps.length > 0, 'energy-manager has dependents');
    } finally { cleanup(sys); }
  });
});

/* ── getDependencyChain ── */
describe('CrossSystemAIOrchestrationHub – getDependencyChain', () => {
  it('returns chain of from-to pairs', async () => {
    const sys = await initSys();
    try {
      const chain = sys.getDependencyChain('hvac');
      assert(Array.isArray(chain), 'is array');
      if (chain.length > 0) {
        assertType(chain[0].from, 'string');
        assertType(chain[0].to, 'string');
      }
    } finally { cleanup(sys); }
  });
});

/* ── sendDirectMessage ── */
describe('CrossSystemAIOrchestrationHub – sendDirectMessage', () => {
  it('sends to online system', async () => {
    const sys = await initSys();
    try {
      sys.registerSystem({ name: 'msg-tgt', category: 'comfort' });
      const result = await sys.sendDirectMessage('msg-tgt', { cmd: 'test' });
      assertEqual(result.success, true);
      assertType(result.responseTime, 'number');
    } finally { cleanup(sys); }
  });

  it('fails for unavailable system', async () => {
    const sys = await initSys();
    try {
      const result = await sys.sendDirectMessage('nowhere', { cmd: 'test' });
      assertEqual(result.success, false);
      assertEqual(result.error, 'System unavailable');
    } finally { cleanup(sys); }
  });

  it('fails when circuit breaker is open', async () => {
    const sys = await initSys();
    try {
      sys.registerSystem({ name: 'cb-open', category: 'energy' });
      sys.circuitBreakers.get('cb-open').state = 'open';
      const result = await sys.sendDirectMessage('cb-open', { cmd: 'test' });
      assertEqual(result.success, false);
      assertEqual(result.error, 'Circuit breaker open');
    } finally { cleanup(sys); }
  });
});

/* ── broadcast ── */
describe('CrossSystemAIOrchestrationHub – broadcast', () => {
  it('broadcasts to all online systems', async () => {
    const sys = await initSys();
    try {
      sys.registerSystem({ name: 'bc1', category: 'energy' });
      sys.registerSystem({ name: 'bc2', category: 'comfort' });
      const result = sys.broadcast({ type: 'alert' });
      assertType(result.recipientCount, 'number');
      assert(result.recipientCount >= 2, 'at least 2 recipients');
    } finally { cleanup(sys); }
  });

  it('filters by category', async () => {
    const sys = await initSys();
    try {
      sys.registerSystem({ name: 'fc1', category: 'energy' });
      sys.registerSystem({ name: 'fc2', category: 'comfort' });
      const result = sys.broadcast({ type: 'alert' }, 'energy');
      assertEqual(result.recipientCount, 1);
    } finally { cleanup(sys); }
  });
});

/* ── requestResponse ── */
describe('CrossSystemAIOrchestrationHub – requestResponse', () => {
  it('resolves with success for valid target', async () => {
    const sys = await initSys();
    try {
      sys.registerSystem({ name: 'rr-tgt', category: 'utility' });
      const result = await sys.requestResponse('rr-tgt', { action: 'status' }, 2000);
      assertEqual(result.success, true);
      assertType(result.result, 'object');
    } finally { cleanup(sys); }
  });
});

/* ── submitFeedback ── */
describe('CrossSystemAIOrchestrationHub – submitFeedback', () => {
  it('records feedback for existing decision', async () => {
    const sys = await initSys();
    try {
      const ts = Date.now();
      sys.decisionLog.push({ timestamp: ts, ruleId: 'R001', outcome: 'success', confidence: 0.8 });
      assertEqual(sys.submitFeedback(ts, 'success'), true);
      assertEqual(sys.decisionLog[0].userFeedback, 'success');
    } finally { cleanup(sys); }
  });

  it('returns false for unknown decision', async () => {
    const sys = await initSys();
    try {
      assertEqual(sys.submitFeedback(999999, 'success'), false);
    } finally { cleanup(sys); }
  });
});

/* ── getLearningStats ── */
describe('CrossSystemAIOrchestrationHub – getLearningStats', () => {
  it('returns zeros when empty', async () => {
    const sys = await initSys();
    try {
      const stats = sys.getLearningStats();
      assertEqual(stats.total, 0);
      assertEqual(stats.successRate, 0);
      assertEqual(stats.avgConfidence, 0);
    } finally { cleanup(sys); }
  });

  it('calculates stats from feedback entries', async () => {
    const sys = await initSys();
    try {
      sys.learningFeedback.push(
        { timestamp: 1, ruleId: 'R1', outcome: 'success', confidence: 0.9 },
        { timestamp: 2, ruleId: 'R2', outcome: 'failure', confidence: 0.7 }
      );
      const stats = sys.getLearningStats();
      assertEqual(stats.total, 2);
      assertEqual(stats.successRate, 0.5);
      assertEqual(stats.avgConfidence, 0.8);
      assertType(stats.ruleStats, 'object');
      assertType(stats.feedbackCount, 'number');
    } finally { cleanup(sys); }
  });
});

/* ── getDiscoveredSystems ── */
describe('CrossSystemAIOrchestrationHub – getDiscoveredSystems', () => {
  it('filters out auto-registered systems', async () => {
    const sys = await initSys();
    try {
      sys.discoveredSystems.push(
        { name: 'disc-a', autoRegistered: false },
        { name: 'disc-b', autoRegistered: true }
      );
      const result = sys.getDiscoveredSystems();
      assertEqual(result.length, 1);
      assertEqual(result[0].name, 'disc-a');
    } finally { cleanup(sys); }
  });
});

/* ── autoRegisterDiscovered ── */
describe('CrossSystemAIOrchestrationHub – autoRegisterDiscovered', () => {
  it('registers a discovered system', async () => {
    const sys = await initSys();
    try {
      sys.discoveredSystems.push({ name: 'auto-reg', suggestedCategory: 'energy', autoRegistered: false });
      assertEqual(sys.autoRegisterDiscovered('auto-reg'), true);
      assert(sys.systems.has('auto-reg'), 'system registered');
    } finally { cleanup(sys); }
  });

  it('returns false for unknown system', async () => {
    const sys = await initSys();
    try {
      assertEqual(sys.autoRegisterDiscovered('nope'), false);
    } finally { cleanup(sys); }
  });
});

/* ── getLoadBalancingStatus ── */
describe('CrossSystemAIOrchestrationHub – getLoadBalancingStatus', () => {
  it('returns status structure', async () => {
    const sys = await initSys();
    try {
      const status = sys.getLoadBalancingStatus();
      assertType(status.sheddingActive, 'boolean');
      assertType(status.sheddedCount, 'number');
      assert(Array.isArray(status.systemLoads), 'systemLoads is array');
      assertEqual(status.overloadThreshold, 85);
    } finally { cleanup(sys); }
  });
});

/* ── enqueueAction ── */
describe('CrossSystemAIOrchestrationHub – enqueueAction', () => {
  it('enqueues action and returns queued result', async () => {
    const sys = await initSys();
    try {
      const result = sys.enqueueAction({ targetSystem: 'lights', actionType: 'on', priority: 5 });
      assertEqual(result.queued, true);
      assertType(result.id, 'string');
      assertType(result.position, 'number');
    } finally { cleanup(sys); }
  });

  it('orders by priority descending', async () => {
    const sys = await initSys();
    try {
      sys.enqueueAction({ targetSystem: 'a', actionType: 'low', priority: 3 });
      sys.enqueueAction({ targetSystem: 'b', actionType: 'high', priority: 9 });
      assertEqual(sys.orchestrationQueue.queue[0].priority, 9);
    } finally { cleanup(sys); }
  });
});

/* ── getQueueStatus ── */
describe('CrossSystemAIOrchestrationHub – getQueueStatus', () => {
  it('returns queue status structure', async () => {
    const sys = await initSys();
    try {
      sys.enqueueAction({ targetSystem: 'x', actionType: 'test' });
      const status = sys.getQueueStatus();
      assertType(status.queueLength, 'number');
      assertEqual(status.maxDepth, 200);
      assertType(status.processing, 'boolean');
      assertType(status.deadLetterCount, 'number');
      assertType(status.nextItem, 'object');
    } finally { cleanup(sys); }
  });
});

/* ── clearDeadLetterQueue ── */
describe('CrossSystemAIOrchestrationHub – clearDeadLetterQueue', () => {
  it('clears items and returns count', async () => {
    const sys = await initSys();
    try {
      sys.orchestrationQueue.deadLetterQueue.push({ id: 'd1' }, { id: 'd2' });
      const count = sys.clearDeadLetterQueue();
      assertEqual(count, 2);
      assertEqual(sys.orchestrationQueue.deadLetterQueue.length, 0);
    } finally { cleanup(sys); }
  });
});

/* ── getRecentDecisions ── */
describe('CrossSystemAIOrchestrationHub – getRecentDecisions', () => {
  it('returns reversed and limited decisions', async () => {
    const sys = await initSys();
    try {
      for (let i = 0; i < 5; i++) {
        sys.decisionLog.push({ timestamp: i, outcome: 'success' });
      }
      const recent = sys.getRecentDecisions(3);
      assertEqual(recent.length, 3);
      assertEqual(recent[0].timestamp, 4);
    } finally { cleanup(sys); }
  });
});

/* ── getDecisionsBySystem ── */
describe('CrossSystemAIOrchestrationHub – getDecisionsBySystem', () => {
  it('filters decisions by system name', async () => {
    const sys = await initSys();
    try {
      sys.decisionLog.push(
        { timestamp: 1, systems: ['lights', 'hvac'] },
        { timestamp: 2, systems: ['hvac'] },
        { timestamp: 3, systems: ['lights'] }
      );
      const result = sys.getDecisionsBySystem('lights');
      assertEqual(result.length, 2);
    } finally { cleanup(sys); }
  });
});

/* ── getDashboardMetrics ── */
describe('CrossSystemAIOrchestrationHub – getDashboardMetrics', () => {
  it('returns shallow copy of metrics', async () => {
    const sys = await initSys();
    try {
      const metrics = sys.getDashboardMetrics();
      assertType(metrics, 'object');
      assertType(metrics.systemsOnline, 'number');
      assertType(metrics.systemsTotal, 'number');
      assertType(metrics.scenariosActive, 'number');
      assertType(metrics.scenariosTotal, 'number');
      metrics.systemsOnline = 99999;
      const fresh = sys.getDashboardMetrics();
      assert(fresh.systemsOnline !== 99999, 'should be a copy');
    } finally { cleanup(sys); }
  });
});

/* ── getStatistics ── */
describe('CrossSystemAIOrchestrationHub – getStatistics', () => {
  it('returns comprehensive statistics', async () => {
    const sys = await initSys();
    try {
      const stats = sys.getStatistics();
      assertEqual(stats.initialized, true);
      assertType(stats.systems, 'object');
      assertType(stats.systems.total, 'number');
      assertType(stats.scenarios, 'object');
      assertEqual(stats.scenarios.total, 15);
      assertType(stats.decisions, 'object');
      assertType(stats.conflicts, 'object');
      assertType(stats.performance, 'object');
      assertType(stats.ml, 'object');
      assertType(stats.queue, 'object');
      assertType(stats.loadBalancing, 'object');
      assertType(stats.discovery, 'object');
      assertEqual(stats.rules.total, 52);
      assertType(stats.learning, 'object');
    } finally { cleanup(sys); }
  });
});

/* ── getHealthReport ── */
describe('CrossSystemAIOrchestrationHub – getHealthReport', () => {
  it('reports healthy when all systems are online', async () => {
    const sys = await initSys();
    try {
      sys.registerSystem({ name: 'h1', category: 'energy' });
      const report = sys.getHealthReport();
      assertEqual(report.overall, 'healthy');
      assert(Array.isArray(report.systems), 'systems');
      assert(Array.isArray(report.warnings), 'warnings');
      assert(Array.isArray(report.criticalIssues), 'criticalIssues');
      assertType(report.timestamp, 'number');
    } finally { cleanup(sys); }
  });

  it('reports warning when system degraded', async () => {
    const sys = await initSys();
    try {
      sys.registerSystem({ name: 'deg', category: 'energy' });
      sys.systems.get('deg').status = 'degraded';
      const report = sys.getHealthReport();
      assertEqual(report.overall, 'warning');
      assert(report.warnings.length > 0, 'has warnings');
    } finally { cleanup(sys); }
  });

  it('reports critical when system offline', async () => {
    const sys = await initSys();
    try {
      sys.registerSystem({ name: 'off', category: 'energy' });
      sys.systems.get('off').status = 'offline';
      const report = sys.getHealthReport();
      assertEqual(report.overall, 'critical');
      assert(report.criticalIssues.length > 0, 'has critical issues');
    } finally { cleanup(sys); }
  });
});

/* ── full lifecycle ── */
describe('CrossSystemAIOrchestrationHub – full lifecycle', () => {
  it('init → register → heartbeat → scenario → destroy', async () => {
    const sys = makeSys();
    try {
      await sys.initialize();
      assertEqual(sys.initialized, true);

      sys.registerSystem({ name: 'lifecycle', category: 'automation' });
      assert(sys.systems.has('lifecycle'), 'registered');

      sys.heartbeat('lifecycle', { cpuUsagePercent: 5 });
      assertEqual(sys.systems.get('lifecycle').cpuUsagePercent, 5);

      const result = await sys.executeScenario('arriving-home');
      assertEqual(result.success, true);

      sys.destroy();
      assertEqual(sys.initialized, false);
      assertEqual(sys.systems.size, 0);
    } finally { cleanup(sys); }
  });
});

run();
