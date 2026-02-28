'use strict';

const { describe, it, run } = require('./helpers/runner');
const { assert, assertEqual, assertType } = require('./helpers/assert');
const { createMockHomey } = require('./helpers/mockHomey');

/* ── timer-leak prevention ─────────────────────────────────────────── */
const _origSetTimeout = global.setTimeout;
const _origSetInterval = global.setInterval;
const activeHandles = [];
global.setTimeout = (...a) => { const id = _origSetTimeout(...a); activeHandles.push({ type: 'timeout', id }); return id; };
global.setInterval = (...a) => { const id = _origSetInterval(...a); activeHandles.push({ type: 'interval', id }); return id; };
function cleanup(sys) {
  try { if (sys && typeof sys.destroy === 'function') sys.destroy(); } catch (_) {}
  while (activeHandles.length > 0) {
    const h = activeHandles.pop();
    if (h.type === 'timeout') clearTimeout(h.id); else clearInterval(h.id);
  }
}

const AdvancedGuestEntertainmentSystem = require('../lib/AdvancedGuestEntertainmentSystem');

describe('GuestEntertainment — constructor & lifecycle', () => {
  it('instantiates without errors', () => {
    const sys = new AdvancedGuestEntertainmentSystem(createMockHomey());
    assert(sys, 'should create instance');
    cleanup(sys);
  });

  it('initialize sets initialized flag', async () => {
    const sys = new AdvancedGuestEntertainmentSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.initialized, true);
    cleanup(sys);
  });

  it('initialize is idempotent', async () => {
    const sys = new AdvancedGuestEntertainmentSystem(createMockHomey());
    await sys.initialize();
    await sys.initialize();
    assertEqual(sys.initialized, true);
    cleanup(sys);
  });

  it('destroy clears state', async () => {
    const sys = new AdvancedGuestEntertainmentSystem(createMockHomey());
    await sys.initialize();
    sys.destroy();
    assertEqual(sys.initialized, false);
    assertEqual(sys.guests.size, 0);
    cleanup(sys);
  });
});

describe('GuestEntertainment — guest profiles', () => {
  it('addGuest creates a guest', async () => {
    const sys = new AdvancedGuestEntertainmentSystem(createMockHomey());
    await sys.initialize();
    const guest = sys.addGuest({ name: 'Alice', relationship: 'friend' });
    assert(guest, 'should return guest');
    assertEqual(guest.name, 'Alice');
    assert(guest.id, 'should have id');
    cleanup(sys);
  });

  it('addGuest returns null when max reached', async () => {
    const sys = new AdvancedGuestEntertainmentSystem(createMockHomey());
    await sys.initialize();
    for (let i = 0; i < sys.maxGuests; i++) {
      sys.addGuest({ name: `Guest${i}` });
    }
    const result = sys.addGuest({ name: 'Extra' });
    assertEqual(result, null);
    cleanup(sys);
  });

  it('updateGuest updates fields', async () => {
    const sys = new AdvancedGuestEntertainmentSystem(createMockHomey());
    await sys.initialize();
    const guest = sys.addGuest({ name: 'Bob' });
    const updated = sys.updateGuest(guest.id, { name: 'Robert', vip: true });
    assertEqual(updated.name, 'Robert');
    assertEqual(updated.vip, true);
    cleanup(sys);
  });

  it('updateGuest returns null for unknown guest', async () => {
    const sys = new AdvancedGuestEntertainmentSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.updateGuest('nonexistent', { name: 'X' }), null);
    cleanup(sys);
  });

  it('removeGuest removes and returns true', async () => {
    const sys = new AdvancedGuestEntertainmentSystem(createMockHomey());
    await sys.initialize();
    const guest = sys.addGuest({ name: 'Carol' });
    assertEqual(sys.removeGuest(guest.id), true);
    assertEqual(sys.getGuest(guest.id), null);
    cleanup(sys);
  });

  it('removeGuest returns false for unknown id', async () => {
    const sys = new AdvancedGuestEntertainmentSystem(createMockHomey());
    await sys.initialize();
    assertEqual(sys.removeGuest('nonexistent'), false);
    cleanup(sys);
  });

  it('getAllGuests returns array', async () => {
    const sys = new AdvancedGuestEntertainmentSystem(createMockHomey());
    await sys.initialize();
    sys.addGuest({ name: 'Dave' });
    const all = sys.getAllGuests();
    assert(Array.isArray(all), 'should be array');
    assert(all.length >= 1, 'should have guests');
    cleanup(sys);
  });
});

describe('GuestEntertainment — entertainment & streaming', () => {
  it('getEntertainmentCatalog returns catalog object', async () => {
    const sys = new AdvancedGuestEntertainmentSystem(createMockHomey());
    await sys.initialize();
    const catalog = sys.getEntertainmentCatalog();
    assert(catalog, 'should return catalog');
    cleanup(sys);
  });

  it('searchEntertainment returns results', async () => {
    const sys = new AdvancedGuestEntertainmentSystem(createMockHomey());
    await sys.initialize();
    const results = sys.searchEntertainment('game');
    assert(Array.isArray(results), 'should be array');
    cleanup(sys);
  });

  it('createStreamingProfile creates profile', async () => {
    const sys = new AdvancedGuestEntertainmentSystem(createMockHomey());
    await sys.initialize();
    const guest = sys.addGuest({ name: 'Eve' });
    const profile = sys.createStreamingProfile(guest.id, ['netflix']);
    assert(profile, 'should return profile');
    assert(profile.id, 'should have id');
    cleanup(sys);
  });

  it('deactivateStreamingProfile deactivates', async () => {
    const sys = new AdvancedGuestEntertainmentSystem(createMockHomey());
    await sys.initialize();
    const guest = sys.addGuest({ name: 'Frank' });
    const profile = sys.createStreamingProfile(guest.id);
    const result = sys.deactivateStreamingProfile(profile.id);
    assertEqual(result, true);
    cleanup(sys);
  });
});

describe('GuestEntertainment — house rules', () => {
  it('getHouseRules returns rules map', async () => {
    const sys = new AdvancedGuestEntertainmentSystem(createMockHomey());
    await sys.initialize();
    const rules = sys.getHouseRules('en');
    assert(rules, 'should return rules');
    cleanup(sys);
  });

  it('addHouseRule adds a rule', async () => {
    const sys = new AdvancedGuestEntertainmentSystem(createMockHomey());
    await sys.initialize();
    const result = sys.addHouseRule('test_rule', { en: 'Test rule', sv: 'Testregel' });
    assert(result, 'should return rule object');
    assertEqual(result.key, 'test_rule');
    cleanup(sys);
  });

  it('removeHouseRule removes existing rule', async () => {
    const sys = new AdvancedGuestEntertainmentSystem(createMockHomey());
    await sys.initialize();
    sys.addHouseRule('temp_rule', { en: 'Temp' });
    assertEqual(sys.removeHouseRule('temp_rule'), true);
    cleanup(sys);
  });
});

describe('GuestEntertainment — room & ambiance', () => {
  it('createRoomChecklist creates checklist', async () => {
    const sys = new AdvancedGuestEntertainmentSystem(createMockHomey());
    await sys.initialize();
    const checklist = sys.createRoomChecklist('guest_bedroom');
    assert(checklist, 'should return checklist');
    cleanup(sys);
  });

  it('setPartyMusic sets party music', async () => {
    const sys = new AdvancedGuestEntertainmentSystem(createMockHomey());
    await sys.initialize();
    const result = sys.setPartyMusic(['living_room'], 'rock');
    assert(result, 'should return result');
    cleanup(sys);
  });

  it('setDinnerMusic sets dinner ambiance', async () => {
    const sys = new AdvancedGuestEntertainmentSystem(createMockHomey());
    await sys.initialize();
    const result = sys.setDinnerMusic('dining_room', 'classical');
    assert(result, 'should return result');
    cleanup(sys);
  });
});

describe('GuestEntertainment — meal planning', () => {
  it('createMealPlan returns a plan', async () => {
    const sys = new AdvancedGuestEntertainmentSystem(createMockHomey());
    await sys.initialize();
    const guest = sys.addGuest({ name: 'Grace', dietary: 'vegetarian' });
    const plan = sys.createMealPlan([guest.id], 'dinner');
    assert(plan, 'should return plan');
    assert(plan.id, 'should have id');
    cleanup(sys);
  });

  it('getMealPlan retrieves plan by id', async () => {
    const sys = new AdvancedGuestEntertainmentSystem(createMockHomey());
    await sys.initialize();
    const guest = sys.addGuest({ name: 'Henry' });
    const plan = sys.createMealPlan([guest.id]);
    const retrieved = sys.getMealPlan(plan.id);
    assert(retrieved, 'should return plan');
    assertEqual(retrieved.id, plan.id);
    cleanup(sys);
  });
});

describe('GuestEntertainment — activities & sauna', () => {
  it('suggestActivities returns suggestions', async () => {
    const sys = new AdvancedGuestEntertainmentSystem(createMockHomey());
    await sys.initialize();
    const guest = sys.addGuest({ name: 'Iris' });
    const result = sys.suggestActivities(guest.id, 'sunny');
    assert(result, 'should return result');
    assert(Array.isArray(result.suggestions), 'should have suggestions array');
    assert(result.suggestions.length > 0, 'should have suggestions');
    cleanup(sys);
  });

  it('scheduleSaunaSession creates session', async () => {
    const sys = new AdvancedGuestEntertainmentSystem(createMockHomey());
    await sys.initialize();
    const session = sys.scheduleSaunaSession(new Date().toISOString(), { duration: 30, temperature: 80 });
    assert(session, 'should return session');
    assert(session.id, 'should have id');
    cleanup(sys);
  });

  it('getSaunaState returns sauna state', async () => {
    const sys = new AdvancedGuestEntertainmentSystem(createMockHomey());
    await sys.initialize();
    const state = sys.getSaunaState();
    assert(state, 'should return state');
    cleanup(sys);
  });
});

describe('GuestEntertainment — party mode & feedback', () => {
  it('activatePartyMode activates', async () => {
    const sys = new AdvancedGuestEntertainmentSystem(createMockHomey());
    await sys.initialize();
    const result = sys.activatePartyMode({ guestCount: 10, genre: 'dance' });
    assert(result, 'should return result');
    cleanup(sys);
  });

  it('deactivatePartyMode deactivates', async () => {
    const sys = new AdvancedGuestEntertainmentSystem(createMockHomey());
    await sys.initialize();
    sys.activatePartyMode({});
    const result = sys.deactivatePartyMode();
    assertEqual(result, true);
    cleanup(sys);
  });

  it('submitFeedback records feedback', async () => {
    const sys = new AdvancedGuestEntertainmentSystem(createMockHomey());
    await sys.initialize();
    const guest = sys.addGuest({ name: 'Jack' });
    const feedback = sys.submitFeedback(guest.id, 5, 'Great stay!');
    assert(feedback, 'should return feedback');
    cleanup(sys);
  });

  it('getStatistics returns comprehensive stats', async () => {
    const sys = new AdvancedGuestEntertainmentSystem(createMockHomey());
    await sys.initialize();
    const stats = sys.getStatistics();
    assert(stats, 'should return stats');
    assertType(stats.guests.total, 'number');
    cleanup(sys);
  });

  it('getBudgetStatus returns budget info', async () => {
    const sys = new AdvancedGuestEntertainmentSystem(createMockHomey());
    await sys.initialize();
    const budget = sys.getBudgetStatus();
    assert(budget, 'should return budget');
    assertType(budget.budget, 'number');
    assertType(budget.spent, 'number');
    cleanup(sys);
  });
});

run();
