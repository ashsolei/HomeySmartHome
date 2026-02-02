# 🚀 Snabbstart - Homey Smart Home

**5 minuter till din smarta hem-dashboard**

---

## 📋 Förutsättningar

- ✅ Homey Pro (v2023 eller senare)
- ✅ Node.js 16+ och npm
- ✅ Webbläsare (Chrome, Firefox, Safari)
- ✅ Hemma-nätverk där Homey är ansluten

---

## ⚡ Snabbinstallation

### Steg 1: Klona projektet (30 sek)

```bash
# Klona repository
git clone https://github.com/ditt-repo/HomeySmartHome.git
cd HomeySmartHome
```

### Steg 2: Installera beroenden (2 min)

```bash
# Dashboard beroenden
cd web-dashboard
npm install

# Homey app beroenden  
cd ../homey-app
npm install
```

### Steg 3: Konfigurera Homey-anslutning (1 min)

```bash
# Kopiera miljövariabler
cd web-dashboard
cp .env.example .env
```

Redigera `.env` och lägg till dina Homey-uppgifter:

```env
# Homey IP-adress (hitta i Homey-appen under Inställningar > Allmänt)
HOMEY_URL=http://192.168.1.100

# Personal Access Token (skapas nedan)
HOMEY_TOKEN=din-token-här

# Dashboard port
PORT=3000
```

**Skapa Personal Access Token:**

1. Gå till https://developer.athom.com/tools/personal-access-tokens
2. Logga in med ditt Athom-konto
3. Klicka "Create Token"
4. Ge den ett namn (t.ex. "Smart Home Dashboard")
5. Välj alla behörigheter
6. Kopiera token och klistra in i `.env`

### Steg 4: Starta dashboard (30 sek)

```bash
# Från web-dashboard mappen
npm start
```

Dashboard öppnas automatiskt på: **http://localhost:3000**

### Steg 5: (Valfritt) Kör Homey-app i utvecklingsläge

```bash
# I ny terminal
cd homey-app
npx homey login
npx homey app run
```

---

## 🎯 Första Användning

### Dashboard-översikt

När du öppnar dashboard ser du:

#### 📊 Huvudöversikt
```
┌────────────────────────────────────────┐
│ 🏠 Smart Home Dashboard               │
├────────────────────────────────────────┤
│ ⚡ 847W  🌡️ 21.5°C  💧 12L/h  🔒 Hemma│
├────────────────────────────────────────┤
│ Snabbknappar                          │
│ [🌅 Morgon] [🌆 Kväll] [🌙 Natt]     │
├────────────────────────────────────────┤
│ Rum (klicka för detaljer)            │
│ 🛋️ Vardagsrum  🛏️ Sovrum  🍳 Kök     │
└────────────────────────────────────────┘
```

#### 🎛️ Huvudfunktioner

1. **Översikt** - Real-time status för hem
2. **Rum** - Kontrollera varje rum individuellt
3. **Energi** - Förbrukning, produktion, kostnader
4. **Säkerhet** - Larm, kameror, lås
5. **Automation** - Scener och scheman
6. **Inställningar** - Konfigurera system

### Testa Systemet

#### Test 1: Kontrollera en lampa (10 sek)

1. Klicka på "Vardagsrum"
2. Se alla enheter i rummet
3. Klicka på lampa-ikonen för att tända/släcka
4. Justera ljusstyrka med slider

#### Test 2: Aktivera en scen (5 sek)

1. Klicka "🌆 Kväll" i snabbknappar
2. Se hur alla lampor dimmas
3. Temperatur justeras
4. Bekräftelse visas

#### Test 3: Energiöversikt (20 sek)

1. Klicka "Energi" i menyn
2. Se real-time förbrukning (W)
3. Dagens förbrukning (kWh)
4. Kostnad (SEK)
5. Historik-graf

---

## 🔧 Avancerade Funktioner

### AI & Intelligens

Systemet lär sig automatiskt:
- **Vanemönster** - När du brukar vara hemma/borta
- **Preferenser** - Optimal temperatur, ljusstyrka per rum
- **Förbrukningsmönster** - Normal energi/vatten-användning

**Aktivera AI-lärande:**

```javascript
// Via Dashboard: Inställningar > AI > Aktivera Lärande
// Eller via kod:
const intelligence = require('./intelligence-engine');
intelligence.enableLearning(true);
```

### Smart EV-laddning

**Setup (30 sek):**

1. Dashboard > Fordon > "Lägg till fordon"
2. Välj: Tesla Model 3 / Volvo XC40 / Annan
3. Ange batteristorlek (kWh)
4. Välj laddstation: Hemma / Arbete

**Användning:**

```javascript
// Ladda billigast natt
Smart laddning: PÅ
Avgångstid: 07:00
Målbatteri: 80%

→ Systemet laddar automatiskt 00-06 (0.8 SEK/kWh)
→ Besparing: ~60% vs kvälls-laddning
```

### Smart Spegel

**Aktivera (15 sek):**

1. Dashboard > Smart Spegel
2. Välj layout: Morgon / Kväll / Träning / Minimal
3. Lägg till ansiktsigenkänning: Ladda upp 5 bilder per person

**Widgets:**
- Tid & Datum
- Väder (3-dagars)
- Kalender (nästa 3 event)
- Fitness (steg, kalorier, puls)
- Hemstatus

### Fitness Tracking

**Starta träningspass:**

1. Dashboard > Fitness > "Nytt pass"
2. Välj typ: Cardio / Styrka / Mixed
3. Logga övningar real-time
4. Systemet räknar kalorier automatiskt
5. Se sammanfattning när klar

**Personliga rekord:**
- Sparas automatiskt
- Firande när nytt rekord 🏆
- Historik över 30 dagar

---

## 🎨 Anpassa Systemet

### Lägg till egna scener

```javascript
// Dashboard > Automation > Ny Scen

Scen: "Film-kväll"
┌─────────────────────────────┐
│ Vardagsrum:                 │
│  - Lampor: Dimma till 20%   │
│  - Färg: Varmt vitt         │
│                             │
│ Kök:                        │
│  - Lampor: Av              │
│                             │
│ Hembiograf:                 │
│  - Projektor: På            │
│  - Duk: Ner                 │
│  - Soundbar: Vol 60%        │
│                             │
│ Klimat:                     │
│  - Temp: 21°C              │
└─────────────────────────────┘

Aktiveras: Manuellt eller 19:00 fredagar
```

### Skapa automationer

```javascript
// Dashboard > Automation > Ny Automation

Namn: "Energispar Dag"
Trigger: Energipris > 2.0 SEK/kWh
Villkor: Ingen hemma
Åtgärder:
  - Sänk temperatur till 18°C
  - Pausa EV-laddning
  - Stäng av icke-essentiella apparater
  - Notifikation: "Energisparläge aktiverat"
```

---

## 📱 Mobil Access

### QR-kod Setup

1. Dashboard > Inställningar > Mobilåtkomst
2. Generera QR-kod
3. Scanna med telefon
4. Installera PWA (Progressive Web App)

### Funktioner i mobil

- ✅ Full dashboard-åtkomst
- ✅ Push-notifikationer
- ✅ Geofencing (auto hem/borta)
- ✅ Röststyrning
- ✅ Quick actions widget

---

## 🚨 Felsökning

### Problem: Dashboard visar "Demo Mode"

**Lösning:**
```bash
# Kontrollera .env fil
cat web-dashboard/.env

# Testa Homey-anslutning
curl http://192.168.1.100/api/manager/devices/device

# Om 401 Unauthorized: Token är fel
# Skapa ny token på developer.athom.com
```

### Problem: Moduler laddas inte

**Lösning:**
```bash
# Återinstallera beroenden
cd web-dashboard
rm -rf node_modules package-lock.json
npm install

# Starta om server
npm start
```

### Problem: Homey-appen kraschar

**Lösning:**
```bash
# Kör i debug-läge
cd homey-app
npx homey app run --debug

# Kontrollera loggar
npx homey app log
```

### Problem: Saknar Homey-enheter

**Lösning:**
1. Öppna Homey-appen (mobil)
2. Kontrollera att enheter är kopplade
3. Dashboard > Inställningar > Synkronisera enheter
4. Uppdatera sidan (F5)

---

## 💡 Tips & Tricks

### 1. Optimera energi (spara ~6,000 SEK/år)
- Ladda elbil nattetid (0.8 SEK vs 2.0 SEK)
- Aktivera "Smart Scheduling" för tvättmaskin/diskmaskin
- Använd solenergi när tillgänglig (>5 kW produktion)

### 2. Förbättra säkerhet
- Aktivera Network Monitor för hotdetektering
- Setup Smart Doorbell med ansiktsigenkänning
- Enable auto-lock när alla lämnar hem

### 3. Komfort-automation
- Morgonrutin: gradvis väckning med ljus + värmare säng
- Kvällsrutin: dimma lampor kl 21, sänk temp kl 22
- Borta-läge: auto när geofencing detekterar alla borta

### 4. Hälsa & välmående
- Sleep tracking: se sömnkvalitet varje morgon
- Fitness goals: sätt veckomål (4 träningspass)
- Air quality: auto-ventilation när CO2 >1000 ppm

---

## 📚 Nästa Steg

### Utforska alla moduler
👉 [Komplett modullista (66 st)](MODULES.md)

### API-dokumentation
👉 [REST API & WebSocket](API.md)

### Community
- 💬 [Diskussionsforum](https://forum.example.com)
- 📺 [Video tutorials](https://youtube.com/example)
- 📖 [Wiki](https://wiki.example.com)

---

## 🆘 Behöver hjälp?

- 📧 Email: support@example.com
- 💬 Discord: https://discord.gg/example
- 🐛 Buggrapport: GitHub Issues

---

**Lycka till med ditt smarta hem! 🏠✨**

*Senast uppdaterad: 2 februari 2026***Energidiagram**
- Blå linje = Faktisk förbrukning
- Orange streckad = AI-prognos

### Prediktioner Sida

**Förtroende-nivåer**
- 90-100%: Mycket säker prognos
- 70-89%: Pålitlig prognos
- 50-69%: Rimlig uppskattning
- <50%: Osäker, behöver mer data

### Insikter Sida

**Besparingsmöjligheter**
- Sorterade efter potential (högst först)
- Visa hur mycket du kan spara per månad
- Klicka "Tillämpa" för att implementera

### Optimering Sida

**Övergripande Poäng**
- Kombination av energi, komfort och automation
- Se individuella poäng för varje kategori
- Följ rekommenderade åtgärder för att förbättra

## 🔧 Anpassning

### Justera AI-parametrar

I `intelligence-engine.js`:

```javascript
// Ändra förtroende-tröskel (0-1)
this.confidenceThreshold = 0.7; // Standard

// Höj för mer konservativa rekommendationer
this.confidenceThreshold = 0.85;

// Sänk för fler (men mindre säkra) rekommendationer
this.confidenceThreshold = 0.6;
```

### Anpassa Elpris

I `predictive-analytics.js`:

```javascript
// Ändra elpris (SEK per kWh)
const pricePerKWh = 2.5; // Uppdatera till ditt elpris
```

### Lägg till Egna Automations-mallar

```javascript
// I advanced-automation.js, metoden createDefaultAutomations()

await this.createAutomation({
  name: 'Min Anpassade Automation',
  // ... din konfiguration
});
```

## 💡 Tips & Tricks

### 1. Låt AI:n lära
- AI behöver 1-2 veckor för att lära sig dina mönster
- Ju mer data, desto bättre prediktioner
- Undvik att ändra rutiner för mycket under inlärningsperioden

### 2. Granska Insikter Dagligen
- Kolla dashboarden varje morgon
- Implementera högprioritet-rekommendationer snabbt
- Spåra ditt effektivitetspoäng över tid

### 3. Experimentera med Automationer
- Börja med enkla automationer
- Aktivera `adaptiveBehavior` för kontinuerlig förbättring
- Använd `cooldown` för att undvika för frekvent körning

### 4. Optimera Energiförbrukning
- Identifiera topptimmar
- Flytta energikrävande aktiviteter till lågtrafik-timmar
- Implementera besparingsrekommendationer

### 5. Använd Kontextlägen
- Skapa automationer för olika kontexter (hemma, borta, sover, fest)
- Låt AI välja rätt automation baserat på kontext

## 🐛 Felsökning

### Problem: Dashboard visar inga insikter

**Lösning:**
1. Kontrollera att Homey är ansluten (grön indikator)
2. Vänta några minuter för datainsamling
3. Klicka "🔄 Uppdatera" knappen
4. Kontrollera browser console för fel (F12)

### Problem: Prediktioner är "null" eller "—"

**Lösning:**
- AI behöver mer historisk data
- Kör systemet några dagar
- Kontrollera att enheter rapporterar data

### Problem: Automationer triggas inte

**Lösning:**
1. Kontrollera att automation är aktiverad
2. Granska triggers och conditions
3. Kontrollera cooldown-inställning
4. Se execution log i automation-kortet

### Problem: Effektivitetspoäng är låg

**Tips för förbättring:**
1. Implementera besparingsrekommendationer
2. Skapa fler automationer
3. Optimera temperaturinställningar
4. Stäng av enheter i standby

## 📈 Mät Framsteg

### Veckans Mål
- [ ] Effektivitetspoäng: 75+
- [ ] Implementera minst 3 besparingsrekommendationer
- [ ] Skapa 2 nya AI-automationer
- [ ] Minska energiförbrukning med 10%

### Månadens Mål
- [ ] Effektivitetspoäng: 85+
- [ ] Spara 100+ kr på elkostnader
- [ ] Ha 5+ aktiva AI-automationer
- [ ] Nå "Utmärkt" komfortpoäng

## 📞 Få Hjälp

**Dokumentation:**
- [ADVANCED_FEATURES.md](ADVANCED_FEATURES.md) - Fullständig dokumentation
- [README.md](README.md) - Allmän information

**Exempel:**
- Se `homey-app/advanced-automation.js` för automation-exempel
- Se `web-dashboard/predictive-analytics.js` för analys-exempel

**Support:**
- Öppna ett issue på GitHub
- Email: info@smarthomepro.com

## 🎉 Nästa Steg

När du är bekväm med grunderna:

1. **Utforska API:et**
   - `GET /api/analytics/energy`
   - `GET /api/analytics/predictions`
   - `GET /api/dashboard/advanced`

2. **Skapa Egna Visualiseringar**
   - Använd Chart.js för nya diagram
   - Lägg till egna metrics

3. **Integrera Med Andra System**
   - Anslut till väder-API
   - Integrera med voice assistants
   - Bygg mobil-app

4. **Bidra Till Projektet**
   - Förbättra AI-algoritmer
   - Lägg till nya features
   - Dela dina automations-mallar

---

**Lycka till med ditt intelligenta smarta hem! 🏠🤖**
