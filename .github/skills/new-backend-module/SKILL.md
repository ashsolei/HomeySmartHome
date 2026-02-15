---
name: new-backend-module
description: "Creates a new backend system module for HomeySmartHome in homey-app/lib/ following the SmartXxxSystem pattern with proper initialization, status reporting, error handling, and module registration in app.js"
argument-hint: "[module-name] [wave-number]"
---

# New Backend Module

Creates a complete, production-ready backend module for the HomeySmartHome platform.

## Module Anatomy

Every backend module in HomeySmartHome follows this structure:

```
homey-app/lib/SmartModuleNameSystem.js   ← Module implementation
homey-app/app.js                          ← Module registration
homey-app/server.js or api.js             ← API routes (optional)
homey-app/test-suite.js                   ← Tests
MODULES.md                                ← Documentation entry
```

## Step-by-Step Process

### 1. Create the Module File

Create `homey-app/lib/SmartModuleNameSystem.js`:

```javascript
'use strict';

class SmartModuleNameSystem {
  constructor(homey) {
    this.homey = homey;
    this._initialized = false;
    this._config = {
      enabled: true,
      updateInterval: 60000,
      maxRetries: 3
    };
    this._data = new Map();
    this._updateTimer = null;
  }

  async initialize() {
    try {
      if (this._initialized) {
        console.log('⚠️ SmartModuleNameSystem already initialized');
        return;
      }

      // Load saved settings if available
      await this._loadSettings();

      // Start periodic updates
      this._startPeriodicUpdate();

      this._initialized = true;
      console.log('✅ SmartModuleNameSystem initialized');
    } catch (error) {
      console.error('❌ SmartModuleNameSystem initialization failed:', error.message);
      this._initialized = false;
    }
  }

  async getStatus() {
    return {
      active: this._initialized,
      name: 'SmartModuleNameSystem',
      config: this._config,
      dataPoints: this._data.size,
      uptime: this._initialized ? process.uptime() : 0
    };
  }

  async getData(key) {
    if (!this._initialized) {
      throw new Error('SmartModuleNameSystem not initialized');
    }
    if (key) {
      return this._data.get(key) || null;
    }
    return Object.fromEntries(this._data);
  }

  async updateData(key, value) {
    if (!this._initialized) {
      throw new Error('SmartModuleNameSystem not initialized');
    }
    this._data.set(key, {
      ...value,
      updatedAt: new Date().toISOString()
    });
    console.log(`✅ SmartModuleNameSystem: Updated ${key}`);
    return true;
  }

  async _loadSettings() {
    try {
      const saved = this.homey.settings.get('smartModuleName');
      if (saved) {
        this._config = { ...this._config, ...JSON.parse(saved) };
      }
    } catch (error) {
      console.log('⚠️ SmartModuleNameSystem: Using default settings');
    }
  }

  _startPeriodicUpdate() {
    if (this._updateTimer) {
      clearInterval(this._updateTimer);
    }
    this._updateTimer = setInterval(async () => {
      try {
        await this._performUpdate();
      } catch (error) {
        console.error('❌ SmartModuleNameSystem periodic update failed:', error.message);
      }
    }, this._config.updateInterval);
  }

  async _performUpdate() {
    // Override in subclasses or implement specific update logic
  }

  async shutdown() {
    if (this._updateTimer) {
      clearInterval(this._updateTimer);
      this._updateTimer = null;
    }
    this._data.clear();
    this._initialized = false;
    console.log('✅ SmartModuleNameSystem shut down');
  }
}

module.exports = SmartModuleNameSystem;
```

### 2. Register in app.js

Add the module import and initialization in `homey-app/app.js`:

```javascript
const SmartModuleNameSystem = require('./lib/SmartModuleNameSystem');

// In the initialization section:
this.smartModuleName = new SmartModuleNameSystem(this.homey);
await this.smartModuleName.initialize();
```

### 3. Add API Routes (Optional)

In `homey-app/server.js` or `homey-app/api.js`:

```javascript
app.get('/api/v1/module-name', async (req, res) => {
  try {
    const status = await smartModuleName.getStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    console.error('❌ /api/v1/module-name:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/v1/module-name/data', async (req, res) => {
  try {
    const data = await smartModuleName.getData(req.query.key);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

### 4. Add Tests

In `homey-app/test-suite.js`:

```javascript
async function testSmartModuleNameSystem() {
  console.log('\n📋 Testing SmartModuleNameSystem...');
  let passed = 0, failed = 0;

  try {
    const mod = new SmartModuleNameSystem(mockHomey);
    await mod.initialize();
    const status = await mod.getStatus();
    if (!status.active) throw new Error('Not active');
    passed++;
    console.log('  ✅ Initialization');
  } catch (e) {
    failed++;
    console.error('  ❌ Initialization:', e.message);
  }

  try {
    const mod = new SmartModuleNameSystem(mockHomey);
    await mod.initialize();
    await mod.updateData('test-key', { value: 42 });
    const data = await mod.getData('test-key');
    if (data.value !== 42) throw new Error('Data mismatch');
    passed++;
    console.log('  ✅ Data operations');
  } catch (e) {
    failed++;
    console.error('  ❌ Data operations:', e.message);
  }

  console.log(`📊 SmartModuleNameSystem: ${passed} passed, ${failed} failed`);
}
```

### 5. Document in MODULES.md

```markdown
### SmartModuleNameSystem
**Wave:** X | **File:** `homey-app/lib/SmartModuleNameSystem.js`

Description of what this module does.

**Key Methods:**
| Method | Description |
|--------|-------------|
| `initialize()` | Sets up the module and starts periodic updates |
| `getStatus()` | Returns active state, config, and data point count |
| `getData(key?)` | Returns data for a key or all data |
| `updateData(key, value)` | Updates a data point |
| `shutdown()` | Cleans up resources |
```

## Wave Assignment Guide

| Wave | Focus | Complexity |
|------|-------|------------|
| 1-2 | Core automation, energy, climate, security | Basic |
| 3-4 | Analytics, voice control, presence detection | Moderate |
| 5-6 | Advanced scheduling, multi-zone control | Advanced |
| 7-8 | AI prediction, anomaly detection | AI/ML |
| 9-10 | Machine learning, adaptive optimization | Advanced AI |

## Quality Rules

1. Always use `'use strict';` at file top
2. Class name must be PascalCase matching filename
3. All async operations must have try/catch
4. Private methods prefixed with `_`
5. Console logging with emoji prefixes: ✅ ❌ ⚠️
6. Module must be self-contained and independently initializable
7. Graceful degradation — initialization failure must not crash the service
8. Cleanup via `shutdown()` method
9. No hardcoded secrets — use `process.env` or `this.homey.settings`
10. Maximum file size: ~500 lines (split if larger)
