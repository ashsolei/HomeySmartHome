'use strict';

const { describe, it, run } = require('./helpers/runner');
const { assert, assertEqual, assertType } = require('./helpers/assert');

/* ── timer-leak prevention ─────────────────────────────────────────── */
const _origSetTimeout = global.setTimeout;
const _origSetInterval = global.setInterval;
const activeHandles = [];
global.setTimeout = (...a) => { const id = _origSetTimeout(...a); activeHandles.push({ type: 'timeout', id }); return id; };
global.setInterval = (...a) => { const id = _origSetInterval(...a); activeHandles.push({ type: 'interval', id }); return id; };
function cleanup(sys) {
  try { if (sys && typeof sys.destroy === 'function') sys.destroy(); } catch (_) {}
  try { if (sys && sys.monitoring && sys.monitoring.interval) { clearInterval(sys.monitoring.interval); sys.monitoring.interval = null; } } catch (_) {}
  while (activeHandles.length > 0) {
    const h = activeHandles.pop();
    if (h.type === 'timeout') clearTimeout(h.id); else clearInterval(h.id);
  }
}

const DeepLearningVisionSystem = require('../lib/DeepLearningVisionSystem');

describe('Vision — constructor & lifecycle', () => {
  it('instantiates without errors', () => {
    const sys = new DeepLearningVisionSystem();
    assert(sys, 'should create instance');
    cleanup(sys);
  });

  it('constructor populates default data', () => {
    const sys = new DeepLearningVisionSystem();
    assert(sys.cameras.size >= 3, 'should have cameras');
    assert(sys.recognizedFaces.size >= 3, 'should have faces');
    assert(sys.detectedObjects.size >= 2, 'should have detections');
    assert(sys.activityHistory.length >= 3, 'should have activity history');
    assert(sys.anomalies.length >= 3, 'should have anomalies');
    cleanup(sys);
  });

  it('constructor initializes models', () => {
    const sys = new DeepLearningVisionSystem();
    assert(sys.models.objectDetection, 'should have object detection model');
    assert(sys.models.faceRecognition, 'should have face recognition model');
    assert(sys.models.activityRecognition, 'should have activity recognition model');
    assert(sys.models.anomalyDetection, 'should have anomaly detection model');
    cleanup(sys);
  });

  it('initialize starts monitoring', async () => {
    const sys = new DeepLearningVisionSystem();
    await sys.initialize();
    assert(sys.monitoring.interval, 'should have monitoring interval');
    cleanup(sys);
  });
});

describe('Vision — frame processing', () => {
  it('processFrame returns results for valid camera', async () => {
    const sys = new DeepLearningVisionSystem();
    const result = await sys.processFrame('cam-001', {});
    assert(result, 'should return result');
    assertEqual(result.cameraId, 'cam-001');
    assert(Array.isArray(result.objects), 'should have objects array');
    assert(Array.isArray(result.faces), 'should have faces array');
    cleanup(sys);
  });

  it('processFrame returns null for unknown camera', async () => {
    const sys = new DeepLearningVisionSystem();
    const result = await sys.processFrame('nonexistent', {});
    assertEqual(result, null);
    cleanup(sys);
  });

  it('processFrame updates statistics', async () => {
    const sys = new DeepLearningVisionSystem();
    const before = sys.statistics.totalFramesProcessed;
    await sys.processFrame('cam-001', {});
    assert(sys.statistics.totalFramesProcessed > before, 'should increment frames');
    cleanup(sys);
  });
});

describe('Vision — object detection', () => {
  it('detectObjects returns array of objects', async () => {
    const sys = new DeepLearningVisionSystem();
    const objects = await sys.detectObjects({});
    assert(Array.isArray(objects), 'should be array');
    if (objects.length > 0) {
      assertType(objects[0].class, 'string');
      assertType(objects[0].confidence, 'number');
      assert(Array.isArray(objects[0].bbox), 'should have bbox');
    }
    cleanup(sys);
  });

  it('detectObjects filters by confidence threshold', async () => {
    const sys = new DeepLearningVisionSystem();
    const objects = await sys.detectObjects({});
    for (const obj of objects) {
      assert(obj.confidence >= sys.settings.confidenceThreshold, 'should meet threshold');
    }
    cleanup(sys);
  });
});

describe('Vision — facial recognition', () => {
  it('registerPerson creates a new person', async () => {
    const sys = new DeepLearningVisionSystem();
    const person = await sys.registerPerson('Test User', 'visitor', {});
    assert(person.id, 'should have id');
    assertEqual(person.name, 'Test User');
    assertEqual(person.role, 'visitor');
    assertEqual(person.embedding.length, 512);
    assert(sys.recognizedFaces.has(person.id), 'should be in map');
    cleanup(sys);
  });

  it('searchPerson returns match or null', async () => {
    const sys = new DeepLearningVisionSystem();
    const result = await sys.searchPerson({});
    // Result can be null or a match object depending on random similarity
    if (result) {
      assert(result.personId, 'should have personId');
      assertType(result.similarity, 'number');
    }
    cleanup(sys);
  });

  it('recognizeFaces returns array', async () => {
    const sys = new DeepLearningVisionSystem();
    const faces = await sys.recognizeFaces({});
    assert(Array.isArray(faces), 'should be array');
    cleanup(sys);
  });
});

describe('Vision — activity recognition', () => {
  it('recognizeActivity returns activity or null', async () => {
    const sys = new DeepLearningVisionSystem();
    const result = await sys.recognizeActivity('cam-001', {});
    // Can be null if below threshold
    if (result) {
      assertType(result.activity, 'string');
      assertType(result.confidence, 'number');
      assertEqual(result.cameraId, 'cam-001');
    }
    cleanup(sys);
  });

  it('getActivityTimeline returns filtered activities', () => {
    const sys = new DeepLearningVisionSystem();
    const timeline = sys.getActivityTimeline('cam-001', 24);
    assert(Array.isArray(timeline), 'should be array');
    for (const entry of timeline) {
      assertEqual(entry.cameraId, 'cam-001');
    }
    cleanup(sys);
  });
});

describe('Vision — anomaly detection', () => {
  it('getAnomalyReport returns report', () => {
    const sys = new DeepLearningVisionSystem();
    const report = sys.getAnomalyReport(30);
    assertType(report.total, 'number');
    assertType(report.resolved, 'number');
    assertType(report.unresolved, 'number');
    assertType(report.byType, 'object');
    assertType(report.bySeverity, 'object');
    assert(Array.isArray(report.recent), 'should have recent array');
    cleanup(sys);
  });

  it('anomalies have expected structure', () => {
    const sys = new DeepLearningVisionSystem();
    const anomaly = sys.anomalies[0];
    assert(anomaly.id, 'should have id');
    assertType(anomaly.type, 'string');
    assertType(anomaly.severity, 'string');
    assertType(anomaly.description, 'string');
    cleanup(sys);
  });
});

describe('Vision — statistics & cache', () => {
  it('getVisionStatistics returns comprehensive stats', async () => {
    const sys = new DeepLearningVisionSystem();
    const stats = await sys.getVisionStatistics();
    assertType(stats.totalFramesProcessed, 'number');
    assertType(stats.objectsDetected, 'number');
    assert(stats.cameras, 'should have cameras section');
    assertType(stats.cameras.total, 'number');
    assertType(stats.cameras.online, 'number');
    assert(stats.recognition, 'should have recognition section');
    assertType(stats.recognition.knownFaces, 'number');
    assert(stats.performance, 'should have performance section');
    cleanup(sys);
  });

  it('getVisionStatistics uses cache', async () => {
    const sys = new DeepLearningVisionSystem();
    const stats1 = await sys.getVisionStatistics();
    const stats2 = await sys.getVisionStatistics();
    assertEqual(stats1.lastUpdate, stats2.lastUpdate);
    cleanup(sys);
  });

  it('clearCache empties cache', () => {
    const sys = new DeepLearningVisionSystem();
    sys.setCached('test', { data: 1 });
    assert(sys.getCached('test'), 'should have cached data');
    sys.clearCache();
    assertEqual(sys.getCached('test'), null);
    cleanup(sys);
  });

  it('settings have expected defaults', () => {
    const sys = new DeepLearningVisionSystem();
    assertEqual(sys.settings.enableFacialRecognition, true);
    assertEqual(sys.settings.enableObjectDetection, true);
    assertEqual(sys.settings.enableActivityRecognition, true);
    assertEqual(sys.settings.enableAnomalyDetection, true);
    assertType(sys.settings.confidenceThreshold, 'number');
    cleanup(sys);
  });
});

run();
