# 📡 API Dokumentation

**REST API & WebSocket** för Homey Smart Home System

---

## 🌐 Base URL

```
http://localhost:3000/api
```

## 🔐 Autentisering

Alla requests kräver Homey Personal Access Token:

```javascript
headers: {
  'Authorization': 'Bearer YOUR_TOKEN_HERE'
}
```

---

## 📊 Dashboard Endpoints

### GET `/api/dashboard`
Hämta komplett dashboard-data.

**Response:**
```json
{
  "overview": {
    "power": 847,
    "temperature": 21.5,
    "security": "home",
    "devices": { "total": 25, "online": 23 }
  },
  "rooms": [...],
  "energy": {...},
  "security": {...}
}
```

### GET `/api/overview`
Snabb översikt (minimal data för mobil).

---

## 🏠 Enheter (Devices)

### GET `/api/devices`
Lista alla enheter.

**Query params:**
- `zone` - Filtrera på zon-ID
- `type` - Filtrera på enhetstyp (light, sensor, etc)

**Response:**
```json
{
  "devices": [
    {
      "id": "device-123",
      "name": "Vardagsrum Lampa",
      "zone": "living_room",
      "capabilities": {
        "onoff": true,
        "dim": 0.75
      }
    }
  ]
}
```

### GET `/api/device/:id`
Hämta specifik enhet.

### POST `/api/device/:id/capability/:capability`
Styr enhetkapacitet.

**Body:**
```json
{
  "value": true
}
```

**Exempel:**
```bash
# Tänd lampa
curl -X POST http://localhost:3000/api/device/light-1/capability/onoff \
  -H "Content-Type: application/json" \
  -d '{"value": true}'

# Dimma till 50%
curl -X POST http://localhost:3000/api/device/light-1/capability/dim \
  -H "Content-Type: application/json" \
  -d '{"value": 0.5}'
```

---

## 🗺️ Zoner (Zones)

### GET `/api/zones`
Lista alla zoner.

**Response:**
```json
{
  "zones": [
    {
      "id": "living_room",
      "name": "Vardagsrum",
      "devices": 8,
      "temperature": 21.5,
      "humidity": 45
    }
  ]
}
```

### GET `/api/zone/:id`
Hämta specifik zon med alla enheter.

---

## ⚡ Energi

### GET `/api/energy`
Energiöversikt.

**Response:**
```json
{
  "current": {
    "power": 847,
    "production": 2100,
    "battery": 75,
    "grid": -1253
  },
  "today": {
    "consumption": 18.5,
    "production": 24.2,
    "cost": 42.50
  }
}
```

### GET `/api/energy/history`
Historisk energidata.

**Query params:**
- `period` - hour, day, week, month
- `from` - Start timestamp
- `to` - Slut timestamp

### GET `/api/energy/price`
Aktuellt energipris (Nordpool).

**Response:**
```json
{
  "current": 1.85,
  "unit": "SEK/kWh",
  "next_hour": 1.92,
  "today_avg": 1.67
}
```

---

## 🚗 Elbilar & Laddning

### GET `/api/ev/vehicles`
Lista fordon.

### GET `/api/ev/vehicle/:id`
Fordonsdetaljer.

**Response:**
```json
{
  "id": "tesla_model3",
  "name": "Tesla Model 3",
  "battery": 75,
  "range": 225,
  "location": "home",
  "charging": false
}
```

### POST `/api/ev/start-charging`
Starta smart laddning.

**Body:**
```json
{
  "vehicleId": "tesla_model3",
  "targetBattery": 80,
  "departureTime": "2026-02-03T07:00:00Z"
}
```

### GET `/api/ev/charging-schedule`
Hämta laddschema.

---

## 🔒 Säkerhet

### GET `/api/security`
Säkerhetsstatus.

**Response:**
```json
{
  "mode": "home",
  "armed": false,
  "sensors": {
    "motion": 0,
    "door": 0,
    "window": 0
  },
  "cameras": {
    "active": 2,
    "recording": 1
  }
}
```

### POST `/api/security/mode`
Ändra säkerhetsläge.

**Body:**
```json
{
  "mode": "away"
}
```

**Modes:** `home`, `away`, `night`, `vacation`

### GET `/api/security/events`
Säkerhetshändelser.

**Query params:**
- `limit` - Antal händelser (default: 50)
- `type` - Filtrera på typ (motion, door, alarm)

---

## 🌐 Nätverk & Cybersäkerhet

### GET `/api/network/devices`
Lista nätverksenheter.

**Response:**
```json
{
  "devices": [
    {
      "ip": "192.168.1.10",
      "mac": "AA:BB:CC:DD:EE:01",
      "name": "Anna Laptop",
      "type": "computer",
      "status": "online",
      "trust": "trusted"
    }
  ]
}
```

### GET `/api/network/threats`
Säkerhetshot.

### POST `/api/network/block-device`
Blockera enhet.

**Body:**
```json
{
  "deviceId": "device_123"
}
```

---

## 🛏️ Smart Säng

### GET `/api/bed/:bedId/status`
Sängstatus.

**Response:**
```json
{
  "occupied": {
    "left": true,
    "right": false
  },
  "position": {
    "left": { "head": 30, "foot": 0 },
    "right": { "head": 0, "foot": 0 }
  },
  "temperature": {
    "left": 19,
    "right": 20
  }
}
```

### POST `/api/bed/:bedId/position`
Justera position.

**Body:**
```json
{
  "side": "left",
  "part": "head",
  "degrees": 35
}
```

### POST `/api/bed/:bedId/massage`
Starta massage.

**Body:**
```json
{
  "side": "left",
  "program": "wave",
  "intensity": 7
}
```

---

## 🏋️ Fitness

### GET `/api/fitness/users`
Lista användare.

### GET `/api/fitness/user/:userId/stats`
Användarstatistik.

### POST `/api/fitness/workout/start`
Starta träningspass.

**Body:**
```json
{
  "userId": "user_anna",
  "type": "cardio"
}
```

### POST `/api/fitness/workout/:workoutId/exercise`
Logga övning.

**Body:**
```json
{
  "exerciseId": "ex_run",
  "duration": 30,
  "distance": 5.2
}
```

### POST `/api/fitness/workout/:workoutId/end`
Avsluta träningspass.

---

## 🎬 Hembiograf

### GET `/api/theater/devices`
Lista enheter.

### GET `/api/theater/activities`
Lista aktiviteter.

### POST `/api/theater/activity/:activityId/start`
Starta aktivitet (film, gaming, etc).

---

## 🤖 AI & Automation

### GET `/api/ai/insights`
AI-insikter.

**Response:**
```json
{
  "insights": [
    {
      "type": "energy",
      "priority": "high",
      "message": "Ladda elbil nu - lågt energipris",
      "action": "start_ev_charging"
    }
  ]
}
```

### GET `/api/predictions`
Prediktioner.

**Query params:**
- `type` - energy, comfort, maintenance
- `timeframe` - hour, day, week

### POST `/api/automation/create`
Skapa automation.

**Body:**
```json
{
  "name": "Energispar Automation",
  "triggers": [
    { "type": "time", "time": "22:00" }
  ],
  "conditions": [
    { "type": "presence", "anyoneHome": false }
  ],
  "actions": [
    { "type": "scene", "sceneId": "energy_save" }
  ]
}
```

---

## 🎨 Scener

### GET `/api/scenes`
Lista scener.

### POST `/api/scene/:id/activate`
Aktivera scen.

### POST `/api/scene/create`
Skapa scen.

**Body:**
```json
{
  "name": "Film Kväll",
  "actions": [
    {
      "deviceId": "light-living",
      "capability": "dim",
      "value": 0.2
    },
    {
      "deviceId": "projector",
      "capability": "onoff",
      "value": true
    }
  ]
}
```

---

## 🔔 Notifikationer

### GET `/api/notifications`
Hämta notifikationer.

**Query params:**
- `unread` - true/false
- `limit` - Antal (default: 20)

### POST `/api/notification/read/:id`
Markera som läst.

### POST `/api/notification/send`
Skicka notifikation.

**Body:**
```json
{
  "title": "Test Notification",
  "message": "Detta är ett test",
  "priority": "normal",
  "users": ["user_anna", "user_erik"]
}
```

---

## 🌐 WebSocket Events

Anslut till WebSocket för real-time uppdateringar:

```javascript
const socket = io('http://localhost:3000');

// Lyssna på events
socket.on('device-updated', (data) => {
  console.log('Enhet uppdaterad:', data);
  // { deviceId, capability, value }
});

socket.on('energy-update', (data) => {
  console.log('Energi:', data);
  // { power, production, battery }
});

socket.on('security-alert', (data) => {
  console.log('Säkerhetsvarning:', data);
  // { type, message, severity }
});

socket.on('automation-triggered', (data) => {
  console.log('Automation:', data);
  // { automationId, name }
});

// Skicka kommandon
socket.emit('control-device', {
  deviceId: 'light-1',
  capability: 'onoff',
  value: true
});
```

### Tillgängliga Events

**Inkommande:**
- `device-updated` - Enhet ändrad
- `energy-update` - Energidata uppdaterad
- `security-alert` - Säkerhetsvarning
- `automation-triggered` - Automation kördes
- `scene-activated` - Scen aktiverad
- `notification` - Ny notifikation
- `ai-insight` - Ny AI-insikt
- `ev-charging-status` - Laddstatus ändrad
- `network-threat` - Nätverkshot detekterat

**Utgående:**
- `control-device` - Styr enhet
- `activate-scene` - Aktivera scen
- `subscribe` - Prenumerera på specifika events

---

## 📊 Rate Limits

- **Standard:** 100 requests/minut
- **Burst:** 200 requests/minut
- **WebSocket:** Obegränsat

## 🔒 Säkerhet

- Använd HTTPS i produktion
- Token rotation rekommenderas var 90:e dag
- Logga all API-access
- IP whitelist för kritiska endpoints

## 🐛 Felhantering

Alla fel returneras i format:

```json
{
  "error": {
    "code": "DEVICE_NOT_FOUND",
    "message": "Enhet kunde inte hittas",
    "details": {...}
  }
}
```

### HTTP Status Codes

- `200` - OK
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Rate Limited
- `500` - Server Error

---

## 📚 Exempel

### Full Dashboard Load

```javascript
async function loadDashboard() {
  const [overview, energy, security] = await Promise.all([
    fetch('/api/overview').then(r => r.json()),
    fetch('/api/energy').then(r => r.json()),
    fetch('/api/security').then(r => r.json())
  ]);
  
  updateUI({ overview, energy, security });
}
```

### Smart Morning Routine

```javascript
async function morningRoutine() {
  // 1. Gradvis väckning
  await fetch('/api/bed/bed_master/position', {
    method: 'POST',
    body: JSON.stringify({
      side: 'left',
      part: 'head',
      degrees: 30
    })
  });
  
  // 2. Smart spegel
  await fetch('/api/mirror/layout/morning', {
    method: 'POST'
  });
  
  // 3. Starta kaffe
  await fetch('/api/device/coffee-maker/capability/onoff', {
    method: 'POST',
    body: JSON.stringify({ value: true })
  });
}
```

---

*Senast uppdaterad: 2 februari 2026*
