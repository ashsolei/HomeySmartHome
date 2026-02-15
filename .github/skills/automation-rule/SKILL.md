---
name: automation-rule
description: "Creates smart home automation rules for HomeySmartHome with triggers, conditions, actions, and safety bounds. Supports energy, climate, security, lighting, and comfort automations."
argument-hint: "[automation-name] [category]"
---

# Automation Rule Creation

Creates smart home automation rules for the HomeySmartHome automation library.

## Automation Architecture

```
Trigger (sensor, schedule, event)
  → Condition Check (value comparison, time window, device state)
    → Action Execution (device control, notification, scene activation)
      → Cooldown Period (prevent rapid cycling)
```

## Automation Template

Add to `automations/automation-library.json`:

```json
{
  "id": "unique-automation-id",
  "name": "Human Readable Name",
  "description": "Clear description of what this automation does and when it triggers",
  "category": "energy",
  "version": "1.0.0",
  "enabled": true,
  "trigger": {
    "type": "device.state",
    "device": "temperature-sensor-living-room",
    "property": "temperature",
    "event": "changed"
  },
  "conditions": [
    {
      "type": "value",
      "property": "temperature",
      "operator": "gt",
      "value": 25
    },
    {
      "type": "time",
      "operator": "between",
      "start": "07:00",
      "end": "22:00"
    },
    {
      "type": "device.state",
      "device": "presence-sensor",
      "property": "occupied",
      "operator": "eq",
      "value": true
    }
  ],
  "actions": [
    {
      "type": "device.control",
      "device": "air-conditioner-living-room",
      "command": "setTemperature",
      "args": { "temperature": 22 },
      "delay": 0
    },
    {
      "type": "notification",
      "channel": "push",
      "message": "AC activated: Living room temperature above 25°C",
      "priority": "normal"
    }
  ],
  "settings": {
    "cooldown": 300,
    "maxExecutionsPerDay": 10,
    "priority": "normal",
    "retryOnFailure": true,
    "maxRetries": 2,
    "logExecution": true
  },
  "tags": ["climate", "comfort", "automation"],
  "createdAt": "2025-01-15T00:00:00.000Z"
}
```

## Categories

| Category | Description | Common Triggers |
|----------|-------------|-----------------|
| energy | Energy optimization | Price changes, solar production, battery levels |
| climate | Temperature/humidity | Sensor readings, weather forecast, schedules |
| security | Safety monitoring | Motion sensors, door/window contacts, cameras |
| lighting | Light control | Time of day, motion, presence, ambient light |
| comfort | Multi-device comfort | Presence, schedules, user preferences |

## Trigger Types

| Type | Description | Example |
|------|-------------|---------|
| `device.state` | Device property changes | Temperature exceeds threshold |
| `schedule` | Cron-based schedule | Every weekday at 7:00 AM |
| `event` | System event | User arrives home |
| `sensor` | Raw sensor data | Light level drops below threshold |
| `webhook` | External HTTP trigger | IFTTT, third-party service |

## Condition Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `eq` | Equal | `temperature eq 22` |
| `neq` | Not equal | `mode neq "away"` |
| `gt` | Greater than | `temperature gt 25` |
| `lt` | Less than | `humidity lt 30` |
| `gte` | Greater or equal | `power gte 1000` |
| `lte` | Less or equal | `price lte 0.50` |
| `between` | Range check | `time between 07:00-22:00` |
| `contains` | String contains | `name contains "bedroom"` |

## Safety Rules

1. **Cooldown period** — Minimum 60 seconds between executions (default: 300s)
2. **Max executions** — Limit daily execution count to prevent runaway automations
3. **Safety bounds** — Temperature: 15-30°C, humidity: 20-80%, power: 0-5000W
4. **Offline handling** — Skip action if target device is unavailable
5. **Override** — User manual control always takes priority over automation
6. **Logging** — Every execution is logged with timestamp and result
7. **Retry limits** — Maximum 2 retries on failure, then alert user
8. **Time windows** — Noisy automations restricted to 07:00-22:00 by default

## Documentation

Add entry to `automations/AUTOMATIONS.md`:

```markdown
### Automation Name
**ID:** `automation-id` | **Category:** energy

Description of what this automation does.

**Trigger:** When temperature exceeds 25°C
**Conditions:** Between 07:00-22:00, someone home
**Actions:** Turn on AC, send notification
**Cooldown:** 5 minutes
```
