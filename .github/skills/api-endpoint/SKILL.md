---
name: api-endpoint
description: "Creates new REST API endpoints for HomeySmartHome backend following Express 5 patterns with input validation, error handling, rate limiting, and proper response formats"
argument-hint: "[method] [path] [description]"
---

# API Endpoint Creation

Creates production-ready REST API endpoints for the HomeySmartHome platform.

## API Architecture

```
Nginx (80) → rate limiting → Backend (3000) → Express middleware → Route handler
                                                 ↓
                                            Helmet → CORS → Body parser → Auth → Handler
```

## Standard Response Formats

### Success
```json
{ "success": true, "data": { ... }, "timestamp": "2025-01-15T10:30:00.000Z" }
```

### Error
```json
{ "error": "Human-readable message", "code": "ERROR_CODE" }
```

### List with Pagination
```json
{ "success": true, "data": [...], "total": 100, "page": 1, "limit": 50 }
```

## Step-by-Step Process

### 1. Define the Endpoint

Choose HTTP method and path:
- `GET /api/v1/resource` — List/read
- `GET /api/v1/resource/:id` — Read single
- `POST /api/v1/resource` — Create
- `PUT /api/v1/resource/:id` — Update (full replace)
- `PATCH /api/v1/resource/:id` — Update (partial)
- `DELETE /api/v1/resource/:id` — Delete

### 2. Implement the Route

Add to `homey-app/server.js` or `homey-app/api.js`:

```javascript
// GET — List resources
app.get('/api/v1/resource', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));

    const data = await module.getData();
    const total = data.length;
    const paginated = data.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    res.json({ success: true, data: paginated, total, page: pageNum, limit: limitNum });
  } catch (error) {
    console.error('❌ GET /api/v1/resource:', error.message);
    res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

// GET — Single resource
app.get('/api/v1/resource/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Invalid id', code: 'INVALID_PARAM' });
    }

    const item = await module.getData(id);
    if (!item) {
      return res.status(404).json({ error: 'Resource not found', code: 'NOT_FOUND' });
    }

    res.json({ success: true, data: item });
  } catch (error) {
    console.error('❌ GET /api/v1/resource/:id:', error.message);
    res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

// POST — Create resource
app.post('/api/v1/resource', async (req, res) => {
  try {
    const { name, value } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'name is required', code: 'MISSING_FIELD' });
    }

    const created = await module.createItem({ name, value });
    res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error('❌ POST /api/v1/resource:', error.message);
    res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});
```

### 3. Add to Nginx (if new path prefix)

In `nginx/nginx.conf`, add proxy rule if the path prefix doesn't already route to the backend:

```nginx
location /api/v1/resource {
    limit_req zone=api_limit burst=20 nodelay;
    proxy_pass http://smarthomepro;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

### 4. Document in API.md

```markdown
### GET /api/v1/resource
Returns a list of resources with pagination.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 50 | Items per page (max 100) |

**Response 200:**
```json
{ "success": true, "data": [...], "total": 100, "page": 1, "limit": 50 }
```
```

### 5. Test

```bash
# List
curl http://localhost:3000/api/v1/resource
curl "http://localhost:3000/api/v1/resource?page=2&limit=10"

# Single
curl http://localhost:3000/api/v1/resource/item-id

# Create
curl -X POST http://localhost:3000/api/v1/resource \
  -H "Content-Type: application/json" \
  -d '{"name":"test","value":42}'
```

## HTTP Status Codes

| Code | Usage |
|------|-------|
| 200 | Successful read/update |
| 201 | Successful creation |
| 204 | Successful deletion |
| 400 | Invalid input, missing required fields |
| 401 | Missing or invalid authentication |
| 404 | Resource not found |
| 429 | Rate limit exceeded |
| 500 | Internal server error |

## Quality Rules

1. Always validate input before processing
2. Never expose internal error details (stack traces, system paths)
3. Use appropriate HTTP status codes
4. Include `code` field in error responses for programmatic handling
5. Log errors server-side with `❌` prefix
6. Wrap all handlers in try/catch
7. Paginate list endpoints (default limit: 50, max: 100)
8. Rate limiting is inherited from Nginx for `/api/` paths
9. Keep endpoint paths RESTful and consistent
10. Document every endpoint in API.md
