---
name: readme-standard
description: "Generates standardized README documentation for HomeySmartHome with required sections: overview, quickstart, architecture, API reference, Docker commands, environment variables, troubleshooting, and contributing"
argument-hint: "[section: all|quickstart|api|docker|env]"
---

# README Standard

## Overview

HomeySmartHome documentation must follow a consistent structure across the project README and any service-level documentation. The project is a Node.js 22 / Express 5 / Socket.IO 4.8 smart home platform with 179 modules, Docker Compose deployment (backend port 3000, dashboard port 3001, Nginx port 80). This skill defines required sections, templates, and generation patterns.

## Step-by-Step Workflow

### Step 1: Required Section Structure

Every HomeySmartHome README must include these sections in order.

```js
// scripts/docs/readmeStructure.js
const REQUIRED_SECTIONS = [
  { heading: 'Overview', level: 2, required: true },
  { heading: 'Features', level: 2, required: true },
  { heading: 'Quickstart', level: 2, required: true },
  { heading: 'Prerequisites', level: 3, required: true, parent: 'Quickstart' },
  { heading: 'Installation', level: 3, required: true, parent: 'Quickstart' },
  { heading: 'Running Locally', level: 3, required: true, parent: 'Quickstart' },
  { heading: 'Architecture', level: 2, required: true },
  { heading: 'API Reference', level: 2, required: true },
  { heading: 'Docker Deployment', level: 2, required: true },
  { heading: 'Environment Variables', level: 2, required: true },
  { heading: 'Testing', level: 2, required: true },
  { heading: 'Troubleshooting', level: 2, required: true },
  { heading: 'Contributing', level: 2, required: true },
  { heading: 'License', level: 2, required: true },
];

function validateReadmeStructure(content) {
  const headingPattern = /^(#{1,6})\s+(.+)$/gm;
  const foundHeadings = [];
  let match;
  while ((match = headingPattern.exec(content)) !== null) {
    foundHeadings.push({ level: match[1].length, text: match[2].trim() });
  }

  const issues = [];
  for (const section of REQUIRED_SECTIONS) {
    const found = foundHeadings.find(
      (h) => h.text === section.heading && h.level === section.level
    );
    if (!found && section.required) {
      issues.push(`Missing required section: ${'#'.repeat(section.level)} ${section.heading}`);
    }
  }
  return issues;
}

module.exports = { REQUIRED_SECTIONS, validateReadmeStructure };
```

### Step 2: Overview Section Template

```js
// scripts/docs/sections/overview.js
const fs = require('fs');

function generateOverview() {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  return `## Overview

HomeySmartHome is a comprehensive smart home automation platform built on Node.js ${process.version.split('.')[0].replace('v', '')} with Express 5 and Socket.IO 4.8. It manages ${179} automation modules across a backend API server, a real-time dashboard, and an Nginx reverse proxy.

- **Version**: ${pkg.version}
- **Backend**: Express 5.1.0 on port 3000
- **Dashboard**: Socket.IO 4.8.1 on port 3001
- **Proxy**: Nginx on port 80
- **Modules**: 179 smart home automation systems
- **Security**: Helmet 8.0, express-rate-limit 7.5, CORS 2.8
`;
}

module.exports = { generateOverview };
```

### Step 3: Quickstart Section Template

```js
// scripts/docs/sections/quickstart.js

function generateQuickstart() {
  return `## Quickstart

### Prerequisites

- Node.js 22.x
- npm 10.x or later
- Docker and Docker Compose
- Git

### Installation

\`\`\`bash
git clone https://github.com/your-org/HomeySmartHome.git
cd HomeySmartHome

# Install backend dependencies
cd homey-app && npm ci
cd ..

# Install dashboard dependencies
cd dashboard && npm ci
cd ..

# Copy environment templates
cp homey-app/.env.example homey-app/.env
cp dashboard/.env.example dashboard/.env
\`\`\`

### Running Locally

\`\`\`bash
# Start all services with Docker Compose
./deploy.sh start

# Verify services are running
./deploy.sh status

# Run health checks
./deploy.sh test

# Access the application
# Backend API: http://localhost:3000
# Dashboard: http://localhost:3001
# Nginx proxy: http://localhost:80
\`\`\`
`;
}

module.exports = { generateQuickstart };
```

### Step 4: Architecture Section Template

```js
// scripts/docs/sections/architecture.js

function generateArchitecture() {
  return `## Architecture

\`\`\`
                     +-------------------+
                     |    Nginx (:80)    |
                     |  Reverse Proxy    |
                     +--------+----------+
                              |
              +---------------+---------------+
              |                               |
    +---------v---------+          +----------v----------+
    | Backend (:3000)   |          | Dashboard (:3001)   |
    | Express 5.1.0     |          | Express 5.1.0       |
    | Helmet 8.0        |          | Socket.IO 4.8.1     |
    | Rate Limit 7.5    |          |                     |
    | CORS 2.8          |          |                     |
    | 179 Modules       |          |                     |
    +-------------------+          +---------------------+
\`\`\`

### Service Responsibilities

| Service     | Port | Technology         | Role                                  |
|-------------|------|--------------------|---------------------------------------|
| Backend     | 3000 | Express 5, Node 22 | API server, module orchestration      |
| Dashboard   | 3001 | Socket.IO 4.8      | Real-time UI, WebSocket connections   |
| Nginx       | 80   | Nginx              | Reverse proxy, static files, TLS      |

### Module Organization

All 179 modules reside in \`homey-app/lib/\` and follow the naming convention \`SmartHome<Name>System.js\`. Each module exports a class that is loaded by the dynamic ModuleLoader at startup.
`;
}

module.exports = { generateArchitecture };
```

### Step 5: API Reference Section Template

```js
// scripts/docs/sections/apiReference.js

function generateApiReference() {
  return `## API Reference

### Health Endpoints

| Method | Path              | Description                          |
|--------|-------------------|--------------------------------------|
| GET    | /health           | Liveness probe (returns 200)         |
| GET    | /health/ready     | Readiness probe (200 or 503)         |
| GET    | /health/detailed  | Full health with memory and uptime   |

### Metrics

| Method | Path     | Description                              |
|--------|----------|------------------------------------------|
| GET    | /metrics | Prometheus text format metrics            |

### Module Endpoints

| Method | Path                    | Description                     |
|--------|-------------------------|---------------------------------|
| GET    | /api/v1/modules         | List all loaded modules         |
| GET    | /api/v1/modules/:id     | Get module details by ID        |
| POST   | /api/v1/modules/:id/run | Trigger a module action         |
| GET    | /api/v1/status          | System status overview          |

### Query Parameters

| Parameter | Type    | Default | Description                  |
|-----------|---------|---------|------------------------------|
| page      | integer | 1       | Page number for pagination   |
| limit     | integer | 20      | Items per page (max 100)     |
| sort      | string  | name    | Sort field                   |
| order     | string  | asc     | Sort order (asc or desc)     |
`;
}

module.exports = { generateApiReference };
```

### Step 6: Docker and Environment Sections

```js
// scripts/docs/sections/docker.js

function generateDockerSection() {
  return `## Docker Deployment

### Build Images

\`\`\`bash
docker compose build
\`\`\`

### Deploy Commands

\`\`\`bash
# Start all services
./deploy.sh start

# Stop all services
./deploy.sh stop

# Check service status
./deploy.sh status

# Run health checks
./deploy.sh test

# Remove containers, images, and volumes
./deploy.sh clean
\`\`\`

### Individual Service Management

\`\`\`bash
# View logs for a specific service
docker compose logs backend --tail=100 -f
docker compose logs dashboard --tail=100 -f
docker compose logs nginx --tail=100 -f

# Restart a single service
docker compose restart backend

# Rebuild and restart a single service
docker compose up -d --build backend
\`\`\`
`;
}

function generateEnvSection() {
  return `## Environment Variables

### Backend (homey-app/.env)

| Variable              | Required | Default         | Description                   |
|-----------------------|----------|-----------------|-------------------------------|
| NODE_ENV              | Yes      | development     | Runtime environment           |
| PORT                  | Yes      | 3000            | Backend server port           |
| SESSION_SECRET        | Yes      | -               | Session signing secret        |
| CORS_ORIGIN           | Yes      | http://localhost:3001 | Allowed CORS origin      |
| RATE_LIMIT_WINDOW_MS  | No       | 900000          | Rate limit window (ms)        |
| RATE_LIMIT_MAX        | No       | 100             | Max requests per window       |
| LOG_LEVEL             | No       | info            | Logging level                 |

### Dashboard (dashboard/.env)

| Variable   | Required | Default | Description               |
|------------|----------|---------|---------------------------|
| NODE_ENV   | Yes      | development | Runtime environment   |
| PORT       | Yes      | 3001    | Dashboard server port     |
| API_URL    | Yes      | http://localhost:3000 | Backend API URL |
`;
}

module.exports = { generateDockerSection, generateEnvSection };
```

### Step 7: Testing and Troubleshooting Sections

```js
// scripts/docs/sections/testing.js

function generateTestingSection() {
  return `## Testing

### Run All Tests

\`\`\`bash
npm run test:all
\`\`\`

### Run Linting

\`\`\`bash
npm run lint:all
\`\`\`

### Run Backend Tests Only

\`\`\`bash
cd homey-app && npm test
\`\`\`

### Run Dashboard Tests Only

\`\`\`bash
cd dashboard && npm test
\`\`\`

### Verify Docker Deployment

\`\`\`bash
./deploy.sh test
\`\`\`
`;
}

function generateTroubleshootingSection() {
  return `## Troubleshooting

### Backend won't start

1. Check that port 3000 is not in use: \`lsof -i :3000\`
2. Verify \`.env\` file exists: \`ls homey-app/.env\`
3. Check logs: \`docker compose logs backend --tail=50\`
4. Ensure Node.js 22 is installed: \`node --version\`

### Dashboard WebSocket connection fails

1. Verify backend is running: \`curl http://localhost:3000/health\`
2. Check CORS origin matches dashboard URL in \`homey-app/.env\`
3. Verify Socket.IO version compatibility (must be 4.8.x)
4. Check Nginx WebSocket proxy configuration

### Docker build fails

1. Ensure Docker daemon is running: \`docker info\`
2. Check disk space: \`docker system df\`
3. Clear build cache: \`docker builder prune\`
4. Rebuild without cache: \`docker compose build --no-cache\`

### Health checks failing

1. Check individual service health:
   - Backend: \`curl http://localhost:3000/health\`
   - Dashboard: \`curl http://localhost:3001/health\`
   - Nginx: \`curl http://localhost:80/\`
2. Review service logs: \`docker compose logs --tail=100\`
3. Restart services: \`./deploy.sh stop && ./deploy.sh start\`

### Module loading errors

1. Check module count: \`curl http://localhost:3000/metrics | grep modules_loaded\`
2. Verify module files exist in \`homey-app/lib/SmartHome*.js\`
3. Check for syntax errors: \`npm run lint:all\`
4. Review backend startup logs for require() failures
`;
}

module.exports = { generateTestingSection, generateTroubleshootingSection };
```

### Step 8: Full README Generation and Validation

```js
// scripts/docs/generateReadme.js
const { generateOverview } = require('./sections/overview');
const { generateQuickstart } = require('./sections/quickstart');
const { generateArchitecture } = require('./sections/architecture');
const { generateApiReference } = require('./sections/apiReference');
const { generateDockerSection, generateEnvSection } = require('./sections/docker');
const { generateTestingSection, generateTroubleshootingSection } = require('./sections/testing');
const { validateReadmeStructure } = require('./readmeStructure');

function generateFullReadme() {
  const sections = [
    '# HomeySmartHome\n',
    generateOverview(),
    `## Features\n
- 179 smart home automation modules
- Real-time dashboard with Socket.IO 4.8 WebSocket connections
- RESTful API with Express 5 and comprehensive input validation
- Security hardening with Helmet 8, CORS, and rate limiting
- Prometheus metrics and structured JSON logging
- Docker Compose deployment with Nginx reverse proxy
- Automated health checks and deployment verification
- CI/CD pipeline with GitHub Actions
`,
    generateQuickstart(),
    generateArchitecture(),
    generateApiReference(),
    generateDockerSection(),
    generateEnvSection(),
    generateTestingSection(),
    generateTroubleshootingSection(),
    `## Contributing

1. Fork the repository
2. Create a feature branch: \`git checkout -b feature/your-feature\`
3. Install dependencies: \`cd homey-app && npm ci && cd ../dashboard && npm ci\`
4. Make your changes following the code style enforced by \`npm run lint:all\`
5. Add tests for new functionality
6. Run the full test suite: \`npm run test:all\`
7. Run linting: \`npm run lint:all\`
8. Build Docker images: \`docker compose build\`
9. Submit a pull request with a clear description of your changes
`,
    `## License

See [LICENSE](LICENSE) for details.
`,
  ];

  return sections.join('\n');
}

function generateAndValidate() {
  const readme = generateFullReadme();
  const issues = validateReadmeStructure(readme);
  if (issues.length > 0) {
    console.log('README validation issues:');
    issues.forEach((i) => console.log(`  - ${i}`));
    process.exit(1);
  }
  console.log('README structure is valid');
  return readme;
}

module.exports = { generateFullReadme, generateAndValidate };
```

## Rules

1. Every README must include all 14 required sections in the defined order.
2. The Overview section must state the project version, tech stack, and module count.
3. Quickstart must include Prerequisites, Installation, and Running Locally subsections.
4. Architecture must include a text-based diagram showing the three-service topology.
5. API Reference must document all health, metrics, and module endpoints with method, path, and description.
6. Docker section must reference `./deploy.sh` commands, not raw `docker compose` commands for production.
7. Environment Variables must list every variable with required/optional, default, and description.
8. Testing section must include commands for `npm run test:all`, `npm run lint:all`, and `./deploy.sh test`.
9. Troubleshooting must cover backend startup, WebSocket, Docker build, health check, and module loading issues.
10. Contributing must require lint and test passes before pull request submission.
11. Never include actual secret values or credentials in README examples.
12. Validate README structure programmatically before committing changes.

## Checklist

- [ ] Overview section states version, tech stack, and 179 module count
- [ ] Features section lists key capabilities
- [ ] Quickstart includes prerequisites (Node 22, Docker, npm, Git)
- [ ] Installation steps use `npm ci` for reproducible installs
- [ ] Architecture diagram shows backend, dashboard, and Nginx with ports
- [ ] API Reference documents health, metrics, and module endpoints
- [ ] Docker section references `./deploy.sh start|stop|status|test|clean`
- [ ] Environment variables table covers both services with all fields
- [ ] Testing section includes `npm run test:all` and `npm run lint:all`
- [ ] Troubleshooting covers five common failure scenarios with solutions
- [ ] Contributing section requires tests and lint before PRs
- [ ] License section present
- [ ] README validation script passes with zero issues
- [ ] No secrets or credentials appear in examples
