---
mode: "agent"
description: "Turn a GitHub issue into a spec, implementation, tests, and documentation"
---

# Feature from Issue

Convert a GitHub issue or feature request into a complete implementation.

## Step 1: Analyze the Issue
1. Read the issue description, acceptance criteria, and comments
2. Identify which service(s) are affected (backend/dashboard/both)
3. Map to existing modules or determine if a new module is needed
4. List dependencies and prerequisites

## Step 2: Create Technical Spec
1. Define the API surface (endpoints, Socket.IO events)
2. Define data structures and state management
3. Map the data flow through the service stack
4. Identify security considerations
5. Estimate complexity and module wave assignment

## Step 3: Implement
1. Create or modify modules following project conventions
2. Add API routes with input validation
3. Add Socket.IO events if real-time updates needed
4. Register modules in entry points

## Step 4: Test
1. Write unit tests for new module methods
2. Test API endpoints with curl
3. Verify health endpoints still work
4. Run `npm run test:all` and `npm run lint:all`

## Step 5: Document
1. Add module to `MODULES.md`
2. Add endpoints to `API.md`
3. Update `QUICKSTART.md` if setup changes

## Step 6: Commit
```
feat: implement <feature-name> (closes #<issue-number>)
```

## Quality Gates
- [ ] All tests pass
- [ ] Lint clean
- [ ] Docker build succeeds
- [ ] Health endpoints respond
- [ ] No hardcoded secrets
