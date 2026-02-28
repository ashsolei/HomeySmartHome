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
  try { if (sys && typeof sys.destroy === 'function') sys.destroy(); } catch (_) { /* ignore */ }
  while (activeHandles.length > 0) {
    const h = activeHandles.pop();
    if (h.type === 'timeout') clearTimeout(h.id); else clearInterval(h.id);
  }
}

/* ── helpers ────────────────────────────────────────────────────────── */
const PushNotificationSystem = require('../lib/PushNotificationSystem');

function createSystem() {
  const homey = createMockHomey();
  const sys = new PushNotificationSystem(homey);
  return sys;
}

async function createInitialized() {
  const sys = createSystem();
  await sys.initialize();
  return sys;
}

function mockSubscription(endpoint, userId) {
  return {
    subscription: {
      endpoint: endpoint || 'https://push.example.com/sub/abc123',
      keys: {
        p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8p8l930ds',
        auth: 'tBHItJI5svbpC7sc5XnQ3g',
      },
    },
    userId: userId || 'user1',
  };
}

/* ════════════════════════════════════════════════════════════════════ */
/*  TESTS                                                              */
/* ════════════════════════════════════════════════════════════════════ */

describe('PushNotificationSystem', () => {

  // ── constructor ──────────────────────────────────────────────────

  describe('constructor', () => {
    it('creates instance with expected defaults', () => {
      const sys = createSystem();
      try {
        assertEqual(sys.subscriptions.size, 0);
        assertEqual(sys.sentCount, 0);
        assertEqual(sys.failedCount, 0);
        assertEqual(sys.lastSent, null);
        assertEqual(sys.stubMode, true);
        assertEqual(sys.webPush, null);
      } finally { cleanup(sys); }
    });

    it('reads VAPID config from env vars', () => {
      const origPub = process.env.VAPID_PUBLIC_KEY;
      const origPriv = process.env.VAPID_PRIVATE_KEY;
      const origSubj = process.env.VAPID_SUBJECT;
      try {
        process.env.VAPID_PUBLIC_KEY = 'test_pub';
        process.env.VAPID_PRIVATE_KEY = 'test_priv';
        process.env.VAPID_SUBJECT = 'mailto:test@test.com';

        const sys = new PushNotificationSystem(createMockHomey());
        assertEqual(sys.vapidPublicKey, 'test_pub');
        assertEqual(sys.vapidPrivateKey, 'test_priv');
        assertEqual(sys.vapidSubject, 'mailto:test@test.com');
        cleanup(sys);
      } finally {
        if (origPub === undefined) delete process.env.VAPID_PUBLIC_KEY;
        else process.env.VAPID_PUBLIC_KEY = origPub;
        if (origPriv === undefined) delete process.env.VAPID_PRIVATE_KEY;
        else process.env.VAPID_PRIVATE_KEY = origPriv;
        if (origSubj === undefined) delete process.env.VAPID_SUBJECT;
        else process.env.VAPID_SUBJECT = origSubj;
      }
    });
  });

  // ── initialize ───────────────────────────────────────────────────

  describe('initialize', () => {
    it('initializes in stub mode without web-push', async () => {
      const sys = await createInitialized();
      try {
        assertEqual(sys.stubMode, true);
      } finally { cleanup(sys); }
    });
  });

  // ── subscribe / unsubscribe ──────────────────────────────────────

  describe('subscribe', () => {
    it('adds a subscription', async () => {
      const sys = await createInitialized();
      try {
        const sub = mockSubscription();
        const result = sys.subscribe(sub.subscription, sub.userId);
        assert(result.success, 'subscribe should return success');
        assertEqual(sys.subscriptions.size, 1);
        assertEqual(result.endpoint, sub.subscription.endpoint);
      } finally { cleanup(sys); }
    });

    it('throws on missing endpoint', async () => {
      const sys = await createInitialized();
      try {
        let threw = false;
        try {
          sys.subscribe({});
        } catch (err) {
          threw = true;
          assert(err.message.includes('endpoint'), 'error should mention endpoint');
        }
        assert(threw, 'should throw on invalid subscription');
      } finally { cleanup(sys); }
    });

    it('supports multiple subscriptions', async () => {
      const sys = await createInitialized();
      try {
        sys.subscribe(mockSubscription('https://push.example.com/1').subscription, 'user1');
        sys.subscribe(mockSubscription('https://push.example.com/2').subscription, 'user2');
        sys.subscribe(mockSubscription('https://push.example.com/3').subscription, 'user1');
        assertEqual(sys.subscriptions.size, 3);
      } finally { cleanup(sys); }
    });
  });

  describe('unsubscribe', () => {
    it('removes an existing subscription', async () => {
      const sys = await createInitialized();
      try {
        const sub = mockSubscription();
        sys.subscribe(sub.subscription, sub.userId);
        assertEqual(sys.subscriptions.size, 1);
        const result = sys.unsubscribe(sub.subscription.endpoint);
        assert(result.success, 'unsubscribe should return success');
        assertEqual(sys.subscriptions.size, 0);
      } finally { cleanup(sys); }
    });

    it('returns false for non-existent endpoint', async () => {
      const sys = await createInitialized();
      try {
        const result = sys.unsubscribe('https://push.example.com/nonexistent');
        assertEqual(result.success, false);
      } finally { cleanup(sys); }
    });
  });

  describe('getSubscriptions', () => {
    it('returns formatted subscription list', async () => {
      const sys = await createInitialized();
      try {
        sys.subscribe(mockSubscription('https://push.example.com/1').subscription, 'user1');
        sys.subscribe(mockSubscription('https://push.example.com/2').subscription, 'user2');

        const subs = sys.getSubscriptions();
        assertEqual(subs.length, 2);
        assertEqual(subs[0].userId, 'user1');
        assertEqual(subs[0].endpoint, 'https://push.example.com/1');
        assertType(subs[0].createdAt, 'number');
      } finally { cleanup(sys); }
    });
  });

  // ── sendNotification ─────────────────────────────────────────────

  describe('sendNotification', () => {
    it('sends to all subscribers in stub mode', async () => {
      const sys = await createInitialized();
      try {
        sys.subscribe(mockSubscription('https://push.example.com/1').subscription, 'user1');
        sys.subscribe(mockSubscription('https://push.example.com/2').subscription, 'user2');

        const result = await sys.sendNotification('Test Title', 'Test Body', null, { key: 'val' });
        assertEqual(result.sent, 2);
        assertEqual(result.failed, 0);
        assertEqual(sys.sentCount, 2);
        assertType(sys.lastSent, 'number');
      } finally { cleanup(sys); }
    });

    it('sends to zero subscribers without error', async () => {
      const sys = await createInitialized();
      try {
        const result = await sys.sendNotification('Test', 'Body');
        assertEqual(result.sent, 0);
        assertEqual(result.failed, 0);
      } finally { cleanup(sys); }
    });
  });

  // ── sendToUser ───────────────────────────────────────────────────

  describe('sendToUser', () => {
    it('sends only to the target user', async () => {
      const sys = await createInitialized();
      try {
        sys.subscribe(mockSubscription('https://push.example.com/1').subscription, 'user1');
        sys.subscribe(mockSubscription('https://push.example.com/2').subscription, 'user2');
        sys.subscribe(mockSubscription('https://push.example.com/3').subscription, 'user1');

        const result = await sys.sendToUser('user1', 'Alert', 'User1 only');
        assertEqual(result.sent, 2);
        assertEqual(result.failed, 0);
      } finally { cleanup(sys); }
    });

    it('returns zero for non-existent user', async () => {
      const sys = await createInitialized();
      try {
        sys.subscribe(mockSubscription('https://push.example.com/1').subscription, 'user1');
        const result = await sys.sendToUser('nobody', 'Alert', 'Body');
        assertEqual(result.sent, 0);
      } finally { cleanup(sys); }
    });
  });

  // ── getStatistics ────────────────────────────────────────────────

  describe('getStatistics', () => {
    it('returns correct statistics', async () => {
      const sys = await createInitialized();
      try {
        sys.subscribe(mockSubscription('https://push.example.com/1').subscription, 'user1');
        await sys.sendNotification('Test', 'Body');

        const stats = sys.getStatistics();
        assertEqual(stats.stubMode, true);
        assertEqual(stats.subscriptionCount, 1);
        assertEqual(stats.sentCount, 1);
        assertEqual(stats.failedCount, 0);
        assertType(stats.lastSent, 'number');
      } finally { cleanup(sys); }
    });
  });

  // ── destroy ──────────────────────────────────────────────────────

  describe('destroy', () => {
    it('clears all state', async () => {
      const sys = await createInitialized();
      sys.subscribe(mockSubscription().subscription, 'user1');
      sys.destroy();
      assertEqual(sys.subscriptions.size, 0);
    });
  });
});

run();
