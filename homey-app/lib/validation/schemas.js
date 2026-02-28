'use strict';

/**
 * Centralized validation schemas for API input.
 * Used by the validate() engine to enforce type, format, range, and enum
 * constraints on request body fields across all API endpoints.
 *
 * @module lib/validation/schemas
 */

const SCHEMAS = {
  // ── Identifiers ──
  id: {
    type: 'string',
    pattern: /^[a-zA-Z0-9_:-]{1,128}$/,
    message: 'ID must be 1-128 alphanumeric characters, hyphens, underscores, or colons',
  },
  userId: {
    type: 'string',
    minLength: 1,
    maxLength: 128,
    message: 'userId is required and must be at most 128 characters',
  },

  // ── Security & Access Control ──
  accessCode: {
    type: 'string',
    pattern: /^[a-zA-Z0-9#*-]{4,32}$/,
    message: 'Access code must be 4-32 alphanumeric characters (plus # * -)',
  },
  securityMode: {
    type: 'string',
    enum: ['home', 'away', 'night', 'disarmed', 'vacation', 'custom'],
    message: 'Security mode must be one of: home, away, night, disarmed, vacation, custom',
  },
  authRole: {
    type: 'string',
    enum: ['VIEWER', 'USER', 'ADMIN'],
    message: 'Role must be one of: VIEWER, USER, ADMIN',
  },
  ttl: {
    type: 'number',
    min: 60,
    max: 86400,
    integer: true,
    message: 'TTL must be an integer between 60 and 86400 seconds',
  },

  // ── Device Control ──
  capability: {
    type: 'string',
    pattern: /^[a-zA-Z0-9_.]{1,64}$/,
    message: 'Capability must be 1-64 alphanumeric characters, dots, or underscores',
  },
  temperature: {
    type: 'number',
    min: 5,
    max: 40,
    message: 'Temperature must be between 5 and 40 degrees',
  },
  garageDoorAction: {
    type: 'string',
    enum: ['open', 'close'],
    message: 'Garage door action must be "open" or "close"',
  },
  purifierMode: {
    type: 'string',
    enum: ['auto', 'manual', 'sleep', 'turbo', 'off'],
    message: 'Purifier mode must be one of: auto, manual, sleep, turbo, off',
  },
  durationHours: {
    type: 'number',
    min: 0.25,
    max: 720,
    message: 'Duration must be between 0.25 and 720 hours',
  },

  // ── Emergency ──
  emergencyType: {
    type: 'string',
    enum: ['fire', 'flood', 'intrusion', 'medical', 'gas', 'earthquake', 'other'],
    message: 'Emergency type must be one of: fire, flood, intrusion, medical, gas, earthquake, other',
  },
  severity: {
    type: 'string',
    enum: ['low', 'medium', 'high', 'critical'],
    message: 'Severity must be one of: low, medium, high, critical',
  },

  // ── Generic strings ──
  shortString: {
    type: 'string',
    minLength: 1,
    maxLength: 256,
    message: 'Must be a non-empty string of at most 256 characters',
  },
  mediumString: {
    type: 'string',
    minLength: 1,
    maxLength: 1024,
    message: 'Must be a non-empty string of at most 1024 characters',
  },
  optionalString: {
    type: 'string',
    maxLength: 256,
    message: 'Must be at most 256 characters',
  },

  // ── Composite schemas for specific endpoints ──

  unlockDoor: {
    type: 'object',
    required: ['accessCode'],
    properties: {
      accessCode: {
        type: 'string',
        pattern: /^[a-zA-Z0-9#*-]{4,32}$/,
        message: 'Access code must be 4-32 characters',
      },
      userId: {
        type: 'string',
        minLength: 1,
        maxLength: 128,
        message: 'userId must be a non-empty string',
      },
    },
  },

  grantTemporaryAccess: {
    type: 'object',
    required: ['userId', 'durationHours'],
    properties: {
      userId: {
        type: 'string',
        minLength: 1,
        maxLength: 128,
        message: 'userId is required',
      },
      durationHours: {
        type: 'number',
        min: 0.25,
        max: 720,
        message: 'Duration must be between 0.25 and 720 hours',
      },
      allowedLocks: {
        type: 'array',
        message: 'allowedLocks must be an array',
      },
    },
  },

  addAccessCode: {
    type: 'object',
    required: ['code'],
    properties: {
      code: {
        type: 'string',
        pattern: /^[a-zA-Z0-9#*-]{4,32}$/,
        message: 'Access code must be 4-32 alphanumeric characters',
      },
    },
  },

  setSecurityMode: {
    type: 'object',
    required: ['mode'],
    properties: {
      mode: {
        type: 'string',
        enum: ['home', 'away', 'night', 'disarmed', 'vacation', 'custom'],
        message: 'Security mode must be one of: home, away, night, disarmed, vacation, custom',
      },
    },
  },

  setDeviceState: {
    type: 'object',
    required: ['capability', 'value'],
    properties: {
      capability: {
        type: 'string',
        pattern: /^[a-zA-Z0-9_.]{1,64}$/,
        message: 'Invalid capability name',
      },
    },
  },

  setZoneTemperature: {
    type: 'object',
    required: ['zoneId', 'temperature'],
    properties: {
      zoneId: {
        type: 'string',
        minLength: 1,
        maxLength: 128,
        message: 'zoneId is required',
      },
      temperature: {
        type: 'number',
        min: 5,
        max: 40,
        message: 'Temperature must be between 5 and 40',
      },
    },
  },

  createUser: {
    type: 'object',
    required: ['name'],
    properties: {
      name: {
        type: 'string',
        minLength: 1,
        maxLength: 128,
        message: 'Name is required (1-128 characters)',
      },
      email: {
        type: 'string',
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        maxLength: 254,
        message: 'Must be a valid email address',
      },
      role: {
        type: 'string',
        enum: ['VIEWER', 'USER', 'ADMIN'],
        message: 'Role must be VIEWER, USER, or ADMIN',
      },
    },
  },

  setActiveUser: {
    type: 'object',
    required: ['userId'],
    properties: {
      userId: {
        type: 'string',
        minLength: 1,
        maxLength: 128,
        message: 'userId is required',
      },
    },
  },

  createAuthToken: {
    type: 'object',
    required: ['userId'],
    properties: {
      userId: {
        type: 'string',
        minLength: 1,
        maxLength: 128,
        message: 'userId is required',
      },
      role: {
        type: 'string',
        enum: ['VIEWER', 'USER', 'ADMIN'],
        message: 'Role must be VIEWER, USER, or ADMIN',
      },
      ttl: {
        type: 'number',
        min: 60,
        max: 86400,
        integer: true,
        message: 'TTL must be 60-86400 seconds',
      },
    },
  },

  createScene: {
    type: 'object',
    required: ['id', 'name'],
    properties: {
      id: {
        type: 'string',
        pattern: /^[a-zA-Z0-9_:-]{1,128}$/,
        message: 'Scene ID must be 1-128 safe characters',
      },
      name: {
        type: 'string',
        minLength: 1,
        maxLength: 256,
        message: 'Scene name is required (1-256 characters)',
      },
    },
  },

  createRoutine: {
    type: 'object',
    required: ['id', 'name'],
    properties: {
      id: {
        type: 'string',
        pattern: /^[a-zA-Z0-9_:-]{1,128}$/,
        message: 'Routine ID must be 1-128 safe characters',
      },
      name: {
        type: 'string',
        minLength: 1,
        maxLength: 256,
        message: 'Routine name is required (1-256 characters)',
      },
    },
  },

  controlGarageDoor: {
    type: 'object',
    required: ['action'],
    properties: {
      action: {
        type: 'string',
        enum: ['open', 'close'],
        message: 'Action must be "open" or "close"',
      },
    },
  },

  controlPurifier: {
    type: 'object',
    required: ['mode'],
    properties: {
      mode: {
        type: 'string',
        enum: ['auto', 'manual', 'sleep', 'turbo', 'off'],
        message: 'Purifier mode must be one of: auto, manual, sleep, turbo, off',
      },
    },
  },

  triggerEmergency: {
    type: 'object',
    required: ['type'],
    properties: {
      type: {
        type: 'string',
        enum: ['fire', 'flood', 'intrusion', 'medical', 'gas', 'earthquake', 'other'],
        message: 'Emergency type is required',
      },
      location: {
        type: 'string',
        maxLength: 256,
        message: 'Location must be at most 256 characters',
      },
      severity: {
        type: 'string',
        enum: ['low', 'medium', 'high', 'critical'],
        message: 'Severity must be: low, medium, high, critical',
      },
    },
  },

  sendNotification: {
    type: 'object',
    required: ['message'],
    properties: {
      message: {
        type: 'string',
        minLength: 1,
        maxLength: 2048,
        message: 'Notification message is required (1-2048 characters)',
      },
      title: {
        type: 'string',
        maxLength: 256,
        message: 'Title must be at most 256 characters',
      },
      priority: {
        type: 'string',
        enum: ['low', 'normal', 'high', 'critical'],
        message: 'Priority must be: low, normal, high, critical',
      },
    },
  },

  processVoiceInput: {
    type: 'object',
    required: ['input'],
    properties: {
      input: {
        type: 'string',
        minLength: 1,
        maxLength: 4096,
        message: 'Voice input is required (1-4096 characters)',
      },
      userId: {
        type: 'string',
        maxLength: 128,
        message: 'userId must be at most 128 characters',
      },
    },
  },

  // ── Guest & Visitor Management ──
  createGuestProfile: {
    type: 'object',
    required: ['name'],
    properties: {
      name: {
        type: 'string',
        minLength: 1,
        maxLength: 128,
        message: 'Guest name is required (1-128 characters)',
      },
      email: {
        type: 'string',
        maxLength: 254,
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        message: 'Email must be a valid address',
      },
      phone: {
        type: 'string',
        maxLength: 32,
        pattern: /^[+0-9\s()-]{4,32}$/,
        message: 'Phone must be a valid number (4-32 characters)',
      },
      notes: {
        type: 'string',
        maxLength: 1024,
        message: 'Notes must be at most 1024 characters',
      },
    },
  },

  generateGuestAccessCode: {
    type: 'object',
    properties: {
      guestId: {
        type: 'string',
        minLength: 1,
        maxLength: 128,
        message: 'guestId must be 1-128 characters',
      },
      expiresInHours: {
        type: 'number',
        min: 0.25,
        max: 720,
        message: 'expiresInHours must be 0.25-720',
      },
    },
  },

  // ── COD-33: Additional endpoint schemas ──

  createAdvancedAutomation: {
    type: 'object',
    required: ['name'],
    properties: {
      name: {
        type: 'string',
        minLength: 1,
        maxLength: 100,
        message: 'Automation name is required (1-100 characters)',
      },
      type: {
        type: 'string',
        enum: ['time', 'device', 'condition', 'composite'],
        message: 'Type must be one of: time, device, condition, composite',
      },
      conditions: {
        type: 'array',
        message: 'Conditions must be an array',
      },
      actions: {
        type: 'array',
        message: 'Actions must be an array',
      },
    },
  },

  createWebhook: {
    type: 'object',
    required: ['url', 'event'],
    properties: {
      url: {
        type: 'string',
        minLength: 1,
        maxLength: 2048,
        pattern: /^https?:\/\/.+/,
        message: 'URL must be a valid http(s) URL',
      },
      event: {
        type: 'string',
        minLength: 1,
        maxLength: 128,
        message: 'Event name is required (1-128 characters)',
      },
    },
  },

  createApiConnector: {
    type: 'object',
    required: ['name', 'endpoint'],
    properties: {
      name: {
        type: 'string',
        minLength: 1,
        maxLength: 128,
        message: 'Connector name is required (1-128 characters)',
      },
      endpoint: {
        type: 'string',
        minLength: 1,
        maxLength: 2048,
        pattern: /^https?:\/\/.+/,
        message: 'Endpoint must be a valid http(s) URL',
      },
    },
  },

  createIntegrationAutomation: {
    type: 'object',
    required: ['name'],
    properties: {
      name: {
        type: 'string',
        minLength: 1,
        maxLength: 100,
        message: 'Automation name is required (1-100 characters)',
      },
    },
  },

  recordUserAction: {
    type: 'object',
    required: ['action'],
    properties: {
      action: {
        type: 'string',
        minLength: 1,
        maxLength: 256,
        message: 'Action is required (1-256 characters)',
      },
    },
  },

  createDashboard: {
    type: 'object',
    required: ['name'],
    properties: {
      name: {
        type: 'string',
        minLength: 1,
        maxLength: 128,
        message: 'Dashboard name is required (1-128 characters)',
      },
    },
  },

  createNotificationRule: {
    type: 'object',
    required: ['name'],
    properties: {
      name: {
        type: 'string',
        minLength: 1,
        maxLength: 128,
        message: 'Rule name is required (1-128 characters)',
      },
    },
  },

  createScheduledTask: {
    type: 'object',
    required: ['name'],
    properties: {
      name: {
        type: 'string',
        minLength: 1,
        maxLength: 128,
        message: 'Task name is required (1-128 characters)',
      },
    },
  },

  toggleAutomation: {
    type: 'object',
    required: ['enabled'],
    properties: {
      enabled: {
        type: 'boolean',
        message: 'enabled must be a boolean',
      },
    },
  },
};

module.exports = SCHEMAS;
