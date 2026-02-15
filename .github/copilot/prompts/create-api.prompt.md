---
mode: "agent"
description: "Design and implement a new REST API endpoint for HomeySmartHome"
---

# Create API Endpoint

Implement a new REST API endpoint following HomeySmartHome conventions.

## Step 1: Design the Endpoint
- Choose HTTP method: GET (read), POST (create), PUT (update), DELETE (remove)
- Define the path following the `/api/v1/` prefix convention
- Specify request body schema (for POST/PUT)
- Define response format: `{ success: true, data: {...} }`
- Define error format: `{ error: "message", code: "ERROR_CODE" }`

## Step 2: Implement the Route

Add to `homey-app/api.js` or `homey-app/server.js`:

```javascript
router.get('/api/v1/resource', async (req, res) => {
  try {
    // Validate input
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Missing id parameter', code: 'MISSING_PARAM' });
    }

    // Business logic
    const data = await module.getData(id);
    if (!data) {
      return res.status(404).json({ error: 'Resource not found', code: 'NOT_FOUND' });
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});
```

## Step 3: Add Rate Limiting
Ensure the endpoint is covered by the existing rate limiting middleware or add specific limits.

## Step 4: Document
Add the endpoint to `API.md` with method, path, description, and example request/response.

## Step 5: Test
```bash
curl -X GET http://localhost:3000/api/v1/resource
curl -X POST http://localhost:3000/api/v1/resource -H "Content-Type: application/json" -d '{"key":"value"}'
```
