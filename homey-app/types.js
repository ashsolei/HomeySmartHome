'use strict';

/**
 * @fileoverview JSDoc type definitions for HomeySmartHome module interfaces.
 * Documentation-only — not imported at runtime.
 */

/**
 * @typedef {Object} HomeyContext
 * @property {Object} settings - Homey settings API
 * @property {Object} notifications - Homey notifications API
 * @property {Object} flow - Homey flow (automation) API
 * @property {Object} clock - Homey clock/time API
 * @property {Object} geolocation - Homey geolocation API
 */

/**
 * @typedef {Object} TimelineEvent
 * @property {string} id - Unique event ID
 * @property {Date} timestamp - When the event occurred
 * @property {string} type - Event type (security|energy|automation|device)
 * @property {string} module - Source module name
 * @property {string} title - Short human-readable title
 * @property {string} description - Detailed description
 * @property {'info'|'warning'|'error'} severity - Event severity
 * @property {Object} [metadata] - Additional event-specific data
 */

/**
 * @typedef {Object} DeviceRecord
 * @property {string} id - Unique device identifier
 * @property {string} name - Display name
 * @property {string} class - Device class (light, sensor, thermostat, socket, etc.)
 * @property {string} zone - Zone/room identifier
 * @property {string[]} capabilities - List of capability keys
 * @property {Object<string, {value: *}>} capabilitiesObj - Capability values keyed by name
 * @property {'online'|'offline'} [status] - Connection status
 */

/**
 * @typedef {Object} AutomationRule
 * @property {string} id - Unique automation identifier
 * @property {string} name - Human-readable name
 * @property {boolean} enabled - Whether the automation is active
 * @property {string} trigger - Trigger type (time, device, geofence, etc.)
 * @property {string} action - Action type (device_control, scene, notification, etc.)
 * @property {Object} [conditions] - Optional trigger conditions
 */

/**
 * @typedef {Object} EnergyReading
 * @property {string} id - Reading identifier
 * @property {string} timestamp - ISO 8601 timestamp
 * @property {number} kwh - Energy consumption in kWh
 * @property {number} cost - Estimated cost in local currency
 * @property {string} [source] - Measurement source device
 */

/**
 * @typedef {Object} SecurityZone
 * @property {string} id - Zone identifier
 * @property {string} name - Display name (e.g. Perimeter, Interior)
 * @property {boolean} armed - Whether the zone is currently armed
 * @property {string[]} [sensors] - Sensor IDs assigned to this zone
 * @property {string} [lastTriggered] - ISO 8601 timestamp of last trigger
 */

/**
 * @typedef {Object} BackupRecord
 * @property {string} id - Backup identifier
 * @property {string} timestamp - ISO 8601 creation timestamp
 * @property {'full'|'incremental'} type - Backup type
 * @property {number} sizeBytes - Backup size in bytes
 * @property {boolean} encrypted - Whether backup is encrypted
 * @property {string} [description] - Optional description
 */

/**
 * @typedef {Object} WebhookConfig
 * @property {string} id - Webhook identifier
 * @property {string} url - Target URL
 * @property {string[]} events - Event types to forward
 * @property {boolean} enabled - Whether the webhook is active
 * @property {string} [secret] - HMAC signing secret
 * @property {number} [retryCount] - Number of retry attempts on failure
 */

/**
 * @typedef {Object} GeofenceRule
 * @property {string} id - Rule identifier
 * @property {string} name - Display name
 * @property {number} latitude - Center latitude in decimal degrees
 * @property {number} longitude - Center longitude in decimal degrees
 * @property {number} radiusMeters - Geofence radius in metres
 * @property {'enter'|'exit'|'both'} trigger - When to fire
 * @property {string} action - Action to execute on trigger
 */
