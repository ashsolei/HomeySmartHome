# Autonomy Guardrails — HomeySmartHome

This document defines hard policies for all Copilot agents, prompts, and skills operating on this project. Every agent MUST comply. Violations invalidate the output.

---

## 1. No Placeholders Policy

- **NEVER** use `TODO: fill later`, `<placeholder>`, `CHANGEME`, or pseudo commands
- Every file path must reference a real file in this project
- Every command must be executable in this project's environment
- Every code example must use the actual project language (JavaScript/CommonJS) and conventions
- If a value is unknown, use the project's safe default or derive it from existing config

## 2. Mandatory Quality Gates

Before finalizing ANY change, ALL of these must pass:

```bash
# Lint
cd homey-app && npm run lint
cd web-dashboard && npm run lint

# Tests
npm run test:all

# Security audit
cd homey-app && npm audit --audit-level=moderate
cd web-dashboard && npm audit --audit-level=moderate

# Docker build
docker compose build
```

A change that breaks any gate is **not done** and must be fixed before commit.

## 3. Branch and Commit Safety

- Use conventional commit messages: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `ci:`
- Each commit must be small and logically scoped — one concern per commit
- No WIP commits on shared branches
- Never force-push to `main` or `develop`
- Never amend published commits
- Always verify with `git status` before committing

## 4. Command Validation

Before including any command in agents, prompts, or skills:

1. Verify the command exists: check `package.json` scripts, `deploy.sh`, or system binaries
2. Verify the paths referenced exist in the repo
3. Test the command runs without error in a clean environment
4. Document any prerequisites (environment variables, Docker running, etc.)

## 5. Rollback and Revert Strategy

- Every deployment must have a documented rollback path
- Default rollback: `docker compose down && git checkout HEAD~1 && docker compose build && docker compose up -d`
- Database migrations must be reversible (if applicable in future)
- Feature flags preferred over long-lived branches for risky features
- Keep previous Docker images tagged for quick rollback

## 6. Dependency Update Safety

1. Run `npm outdated` to identify updates
2. Update one dependency at a time for major versions
3. Run full quality gates after each update
4. Check changelogs for breaking changes
5. Verify Docker builds succeed with updated dependencies
6. Never update dependencies in a commit mixed with feature code

## 7. Security Expectations

- Never commit secrets (tokens, passwords, API keys) — use `.env`
- `.env` must be in `.gitignore` (verified)
- All user inputs must be validated at system boundaries
- Error responses must never expose stack traces, file paths, or internal details
- Docker containers must run as non-root with read-only filesystem
- Rate limiting must be active on all public-facing endpoints
- Run `npm audit` as part of every CI pipeline

## 8. Definition of Done

A task is "done" when ALL of the following are true:

- [ ] Code follows project conventions (`'use strict'`, CommonJS, PascalCase classes, etc.)
- [ ] All quality gates pass (lint, tests, audit, Docker build)
- [ ] No new lint warnings or errors introduced
- [ ] Error handling covers all async operations
- [ ] No hardcoded secrets or credentials
- [ ] Health endpoints still respond correctly
- [ ] Changes are documented (API.md, MODULES.md if applicable)
- [ ] Commit message follows conventional format
- [ ] Repo is clean — no temp files, no dead code, no unused imports

## 9. Agent Conflict Resolution

When multiple agents propose conflicting changes:

1. The **orchestrator** agent has final authority on sequencing
2. **Security** concerns override all other agents
3. **Test failures** block all other work until resolved
4. **Breaking changes** require explicit documentation and migration path
5. When in doubt, prefer the smaller, safer change

## 10. Silent Mode Expectations

- Agents must not ask questions — they must decide and act
- When assumptions are made, document them in code comments or commit messages
- If a task is genuinely blocked (missing credentials, inaccessible service), document the blocker and move to the next task
- Never leave work in a broken state — either complete it or revert cleanly
