---
mode: "agent"
description: "Auto-generate documentation for HomeySmartHome modules and APIs"
---

# Documentation Generation

Generate documentation for a HomeySmartHome module or API endpoint.

## Module Documentation Template (for MODULES.md)

```markdown
### ModuleName
**Wave:** X | **File:** `homey-app/lib/ModuleName.js`

Description of what this module does.

**Key Methods:**
| Method | Description |
|--------|-------------|
| `initialize()` | Sets up the module |
| `getStatus()` | Returns current status |

**Configuration:**
- `ENV_VAR` — Description (default: value)

**Dependencies:** List of other modules this depends on

**API Endpoints:**
- `GET /api/v1/module` — Description
```

## API Documentation Template (for API.md)

```markdown
### GET /api/v1/endpoint

Description of what this endpoint does.

**Headers:**
- `Authorization: Bearer <token>` (required)

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| limit | number | No | Max results (default: 50) |

**Response (200):**
```json
{ "success": true, "data": { ... } }
```

**Error (400):**
```json
{ "error": "message", "code": "ERROR_CODE" }
```
```

## Process
1. Read the source file to understand the module's purpose and methods
2. Identify all public methods, their parameters, and return types
3. Find related API endpoints and Socket.IO events
4. Check for environment variables and configuration
5. Generate documentation following the templates above
6. Add to the appropriate documentation file
