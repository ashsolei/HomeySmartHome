---
mode: "agent"
description: "Create a new smart home system module for the HomeySmartHome backend"
---

# New Backend Module

Create a new system module in `homey-app/lib/` following project conventions.

## Module Template

```javascript
'use strict';

class SmartNewFeatureSystem {
  constructor(homey) {
    this.homey = homey;
    this._initialized = false;
    this._data = new Map();
  }

  async initialize() {
    try {
      // Load configuration
      // Set up event listeners
      // Initialize state

      this._initialized = true;
      console.log('✅ SmartNewFeatureSystem initialized');
    } catch (error) {
      console.error('❌ SmartNewFeatureSystem initialization failed:', error.message);
    }
  }

  async getStatus() {
    return {
      active: this._initialized,
      name: 'SmartNewFeatureSystem',
      dataPoints: this._data.size
    };
  }

  async getData() {
    if (!this._initialized) {
      throw new Error('Module not initialized');
    }
    return Object.fromEntries(this._data);
  }

  async _processInternal(input) {
    // Private helper method
  }

  async shutdown() {
    this._data.clear();
    this._initialized = false;
    console.log('✅ SmartNewFeatureSystem shut down');
  }
}

module.exports = SmartNewFeatureSystem;
```

## Registration Steps
1. Create file: `homey-app/lib/SmartNewFeatureSystem.js`
2. Import in `homey-app/app.js`
3. Add to module initialization array
4. Add API routes in `homey-app/server.js` or `homey-app/api.js`
5. Add tests in `homey-app/test-suite.js`
6. Document in `MODULES.md`

## Naming Convention
- File: `SmartXxxSystem.js` (PascalCase)
- Class: `SmartXxxSystem`
- Wave assignment: Based on complexity (1-2 core, 7-10 advanced AI/ML)
