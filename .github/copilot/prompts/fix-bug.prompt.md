---
mode: "agent"
description: "Diagnose and fix a bug systematically across HomeySmartHome services"
---

# Bug Fix Workflow

Follow this systematic approach to diagnose and fix bugs in HomeySmartHome.

## Step 1: Reproduce
1. Read the error message or bug description carefully
2. Identify which service is affected (backend/dashboard/nginx)
3. Check health endpoints: `curl http://localhost:3000/health` and `curl http://localhost:3001/health`
4. Check recent logs: `docker compose logs --tail 50 <service>`

## Step 2: Isolate
1. Search the codebase for the error message or related code
2. Trace the execution path from the entry point (server.js → route → module)
3. Check if the issue is in a specific module in `homey-app/lib/` or `web-dashboard/`
4. Verify environment variables and configuration

## Step 3: Root Cause Analysis
1. Read the affected file(s) completely
2. Check for recent changes: `git log --oneline -10`
3. Look for common issues:
   - Missing `await` on async operations
   - Uncaught promise rejections
   - Incorrect `require()` paths
   - Missing environment variables
   - Race conditions in module initialization

## Step 4: Fix
1. Make the minimal change needed to fix the bug
2. Add proper error handling if missing
3. Do NOT refactor surrounding code unless directly related

## Step 5: Verify
1. Run `npm run lint:all` — no new lint errors
2. Run `npm run test:all` — all tests pass
3. Test the specific scenario that triggered the bug
4. Check health endpoints still respond correctly
