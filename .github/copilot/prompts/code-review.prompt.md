---
mode: "agent"
description: "Structured code review for HomeySmartHome pull requests and changes"
---

# Code Review

Perform a structured code review of the specified changes.

## Review Process

### 1. Understand the Change
- Read the PR description or commit messages
- Check `git diff` to see all modified files
- Understand the intent — what problem does this solve?

### 2. Review Checklist

**Correctness:**
- [ ] Logic is correct and handles edge cases
- [ ] Async operations are properly awaited
- [ ] Error handling covers all failure paths

**Style:**
- [ ] `'use strict';` at file top
- [ ] CommonJS `require()` (not ES imports)
- [ ] PascalCase classes, camelCase functions, kebab-case files
- [ ] Private methods prefixed with `_`
- [ ] Console logging with emoji prefixes

**Security:**
- [ ] No hardcoded secrets
- [ ] User inputs validated
- [ ] No injection vulnerabilities
- [ ] Error responses don't expose internals

**Performance:**
- [ ] No unnecessary loops or allocations
- [ ] No blocking synchronous operations in async handlers
- [ ] Resources are cleaned up properly

**Testing:**
- [ ] New code has tests
- [ ] Existing tests still pass

**Documentation:**
- [ ] Public methods have JSDoc comments
- [ ] API changes reflected in API.md
- [ ] Module changes reflected in MODULES.md

### 3. Provide Feedback
For each issue found:
- **File:** Path and line number
- **Severity:** Blocker / Major / Minor / Suggestion
- **Issue:** What's wrong
- **Fix:** How to fix it
