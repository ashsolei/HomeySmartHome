---
mode: "agent"
description: "Add proper error handling and graceful degradation to HomeySmartHome code"
---

# Error Handling Improvement

Add comprehensive error handling to HomeySmartHome modules and routes.

## Patterns to Apply

### Express Route Error Handling
```javascript
router.get('/api/v1/resource', async (req, res) => {
  try {
    const data = await fetchData();
    res.json({ success: true, data });
  } catch (error) {
    console.error('❌ /api/v1/resource error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
    // NEVER send error.stack or error.message to the client
  }
});
```

### Module Initialization
```javascript
async initialize() {
  try {
    await this._setupDependencies();
    this._initialized = true;
    console.log('✅ ModuleName initialized');
  } catch (error) {
    console.error('❌ ModuleName init failed:', error.message);
    // Module should still be usable in degraded mode
    this._initialized = false;
  }
}
```

### Promise Rejection Handling
```javascript
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled rejection:', reason);
});
```

### Graceful Shutdown
```javascript
process.on('SIGTERM', async () => {
  console.log('⚠️ SIGTERM received, shutting down gracefully...');
  await server.close();
  process.exit(0);
});
```

## Rules
1. NEVER expose stack traces or internal error details to clients
2. ALWAYS log errors server-side with the `❌` prefix
3. Return appropriate HTTP status codes (400 for client errors, 500 for server errors)
4. Modules should degrade gracefully, not crash the entire service
5. All `async` functions must have try/catch or be wrapped in error middleware
