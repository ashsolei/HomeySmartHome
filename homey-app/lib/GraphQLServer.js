'use strict';

const { buildSchema } = require('graphql');

const schema = buildSchema(`
  type Device {
    id: String!
    name: String!
    status: String
    capabilities: [String]
  }

  type Automation {
    id: String!
    name: String!
    enabled: Boolean
  }

  type EnergySummary {
    todayKwh: Float
    thisMonthKwh: Float
  }

  type SecurityZone {
    id: String!
    name: String
    status: String
  }

  type SecurityStatus {
    armed: Boolean
    zones: [SecurityZone]
  }

  type SystemStats {
    uptime: Float
    modules: Int
    memoryMb: Float
  }

  type Query {
    devices: [Device]
    automations: [Automation]
    energySummary: EnergySummary
    securityStatus: SecurityStatus
    systemStats: SystemStats
  }
`);

class GraphQLServer {
  constructor(homey) {
    this.homey = homey;
  }

  async initialize() {
    // No background work needed
  }

  /**
   * Build root resolvers that pull live data from homey.app managers.
   */
  _resolvers() {
    const app = this.homey.app || {};

    return {
      devices: async () => {
        try {
          const dm = app.deviceManager;
          if (dm && typeof dm.getDevicesSummary === 'function') {
            const list = await dm.getDevicesSummary();
            return (Array.isArray(list) ? list : Object.values(list)).map(d => ({
              id: d.id || d.deviceId || 'unknown',
              name: d.name || 'Unnamed',
              status: d.status || (d.capabilitiesObj?.onoff?.value ? 'on' : 'off'),
              capabilities: d.capabilities || [],
            }));
          }
        } catch (_) { /* fallback below */ }
        return [];
      },

      automations: async () => {
        try {
          const am = app.automationManager;
          if (am && typeof am.getAutomations === 'function') {
            const list = await am.getAutomations();
            return (Array.isArray(list) ? list : Object.values(list)).map(a => ({
              id: a.id || 'unknown',
              name: a.name || 'Unnamed',
              enabled: a.enabled !== false,
            }));
          }
        } catch (_) { /* fallback below */ }
        return [];
      },

      energySummary: async () => {
        try {
          const em = app.energyManager;
          if (em && typeof em.getCurrentConsumption === 'function') {
            const data = await em.getCurrentConsumption();
            return {
              todayKwh: data.today ?? data.todayKwh ?? 0,
              thisMonthKwh: data.thisMonth ?? data.thisMonthKwh ?? 0,
            };
          }
        } catch (_) { /* fallback below */ }
        return { todayKwh: 0, thisMonthKwh: 0 };
      },

      securityStatus: () => {
        const mode = app.securityMode || 'disarmed';
        return {
          armed: mode !== 'disarmed',
          zones: [],
        };
      },

      systemStats: () => {
        const mem = process.memoryUsage();
        return {
          uptime: process.uptime(),
          modules: Object.keys(app).length,
          memoryMb: parseFloat((mem.rss / 1024 / 1024).toFixed(1)),
        };
      },
    };
  }

  /**
   * Return the schema and root value for use with graphql-http or manual execution.
   */
  getSchemaAndRoot() {
    return { schema, rootValue: this._resolvers() };
  }

  /**
   * Express middleware that handles POST /graphql queries manually
   * (no Apollo Server dependency needed).
   */
  middleware() {
    const { graphql: executeGraphQL } = require('graphql');

    return async (req, res) => {
      const { query, variables, operationName } = req.body || {};

      if (!query || typeof query !== 'string') {
        return res.status(400).json({ errors: [{ message: 'Missing query string' }] });
      }

      try {
        const result = await executeGraphQL({
          schema,
          source: query,
          rootValue: this._resolvers(),
          variableValues: variables,
          operationName,
        });
        res.json(result);
      } catch (err) {
        res.status(500).json({ errors: [{ message: err.message }] });
      }
    };
  }

  destroy() {
    // Nothing to clean up
  }
}

module.exports = GraphQLServer;
