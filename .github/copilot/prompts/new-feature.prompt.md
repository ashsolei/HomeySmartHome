---
mode: "agent"
description: "Scaffold a new feature with module, API endpoint, tests, and documentation"
---

# New Feature Implementation

You are implementing a new feature for HomeySmartHome. Follow this systematic workflow:

## Step 1: Requirements Analysis
1. Identify which service owns this feature (backend, dashboard, or both)
2. Determine which module wave (1-10) it belongs to
3. List required API endpoints and Socket.IO events
4. Identify dependencies on existing modules

## Step 2: Create Backend Module (if needed)
Create `homey-app/lib/FeatureName.js`:
```javascript
'use strict';

class FeatureName {
  constructor(homey) {
    this.homey = homey;
    this._initialized = false;
  }

  async initialize() {
    try {
      // Setup logic here
      this._initialized = true;
      console.log('✅ FeatureName initialized');
    } catch (error) {
      console.error('❌ FeatureName initialization failed:', error.message);
    }
  }

  async getStatus() {
    return { active: this._initialized, name: 'FeatureName' };
  }
}

module.exports = FeatureName;
```

## Step 3: Register the Module
Add the import and initialization in `homey-app/app.js`.

## Step 4: Add API Endpoints
Add routes in `homey-app/api.js` or `homey-app/server.js` following Express 5 patterns.

## Step 5: Create Dashboard Module (if needed)
Create `web-dashboard/feature-name.js` with Express router and Socket.IO events.

## Step 6: Write Tests
Add test cases in the appropriate test file.

## Step 7: Update Documentation
- Add to `MODULES.md` under the appropriate wave
- Add API endpoints to `API.md`

## Quality Gates
- [ ] `npm run lint:all` passes
- [ ] `npm run test:all` passes
- [ ] Health endpoints still respond correctly
- [ ] No hardcoded secrets
- [ ] Error handling on all async operations
