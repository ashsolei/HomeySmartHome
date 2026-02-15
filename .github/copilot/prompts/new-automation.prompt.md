---
mode: "agent"
description: "Create a new smart home automation rule with triggers, conditions, and actions"
---

# New Automation Rule

Create a new automation for the HomeySmartHome automation library.

## Automation Template

Add to `automations/automation-library.json`:

```json
{
  "id": "automation-name",
  "name": "Human Readable Name",
  "description": "What this automation does and why",
  "category": "energy|climate|security|lighting|comfort",
  "trigger": {
    "type": "device.state|schedule|event|sensor",
    "device": "device-id",
    "property": "temperature|motion|power",
    "schedule": "0 7 * * *"
  },
  "conditions": [
    { "property": "value", "operator": "gt|lt|eq|neq", "value": 25 },
    { "property": "time", "operator": "between", "value": ["07:00", "22:00"] }
  ],
  "actions": [
    { "type": "device.control", "device": "device-id", "command": "turnOn", "args": {} },
    { "type": "notification", "message": "Automation triggered" }
  ],
  "settings": {
    "enabled": true,
    "cooldown": 300,
    "priority": "normal"
  }
}
```

## Categories
- **energy** — Energy optimization (solar, EV charging, grid pricing)
- **climate** — Temperature, humidity, ventilation control
- **security** — Motion detection, door/window monitoring, cameras
- **lighting** — Lighting scenes, schedules, motion-triggered lights
- **comfort** — Multi-device comfort automation

## Checklist
1. Unique automation ID (kebab-case)
2. Clear trigger conditions with safety bounds
3. Cooldown period to prevent rapid cycling
4. Graceful handling when devices are offline
5. User-overridable settings
6. Document in `automations/AUTOMATIONS.md`
