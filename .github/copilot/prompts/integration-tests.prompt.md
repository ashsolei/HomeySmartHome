---
mode: "agent"
description: "Create integration tests that verify inter-service communication and API contracts"
---

# Integration Tests

Write integration tests that verify HomeySmartHome services work together.

## Test Categories

### 1. API Integration Tests
```javascript
'use strict';

const http = require('http');

async function testAPIIntegration() {
  console.log('\n📋 API Integration Tests...');
  let passed = 0, failed = 0;

  // Test backend health
  try {
    const res = await httpGet('http://localhost:3000/health');
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
    passed++;
    console.log('  ✅ Backend health');
  } catch (e) {
    failed++;
    console.error('  ❌ Backend health:', e.message);
  }

  // Test dashboard health
  try {
    const res = await httpGet('http://localhost:3001/health');
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
    passed++;
    console.log('  ✅ Dashboard health');
  } catch (e) {
    failed++;
    console.error('  ❌ Dashboard health:', e.message);
  }

  // Test Nginx proxy to backend
  try {
    const res = await httpGet('http://localhost/api/v1/health');
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
    passed++;
    console.log('  ✅ Nginx → Backend proxy');
  } catch (e) {
    failed++;
    console.error('  ❌ Nginx → Backend proxy:', e.message);
  }

  console.log(`\n📊 Integration: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, resolve).on('error', reject);
  });
}
```

### 2. Service Communication Tests
- Backend responds to all routes Nginx proxies
- Dashboard Socket.IO accepts connections through Nginx
- Rate limiting works end-to-end (Nginx → Express)
- Security headers present in responses

### 3. Running Integration Tests
```bash
# Start services first
docker compose up -d

# Wait for health
sleep 10

# Run integration tests
node integration-tests.js

# Cleanup
docker compose down
```

## Quality Gates
- [ ] All services start successfully
- [ ] Health endpoints respond through Nginx
- [ ] API routes return expected status codes
- [ ] Security headers present in responses
- [ ] Rate limiting active
