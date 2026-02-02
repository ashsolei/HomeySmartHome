# Smart Home Pro - Automationsbibliotek

Detta är ett komplett bibliotek med avancerade automationer för Homey Pro.

## 📋 Innehåll

1. [Närvarautomationer](#närvarautomationer)
2. [Ljusautomationer](#ljusautomationer)
3. [Klimatautomationer](#klimatautomationer)
4. [Energiautomationer](#energiautomationer)
5. [Säkerhetsautomationer](#säkerhetsautomationer)
6. [Tidbaserade automationer](#tidbaserade-automationer)
7. [Avancerade scenarion](#avancerade-scenarion)

---

## 🚶 Närvarautomationer

### 1. Sista personen lämnar hemmet
**Trigger:** Sista användaren lämnar hemmet
**Åtgärder:**
- Vänta 5 minuter (för att undvika falska triggers)
- Släck alla lampor
- Sänk termostater till 16°C
- Aktivera säkerhetsläge "Borta"
- Stäng av onödiga apparater (TV, stereo)
- Skicka notifikation: "Hemmet är säkrat"

### 2. Första personen kommer hem
**Trigger:** Första användaren kommer hem
**Villkor:** Tid mellan solnedgång och 23:00
**Åtgärder:**
- Avaktivera säkerhetsläge
- Tänd hallampan
- Höj temperaturen till 21°C
- Om efter 18:00: Aktivera "Kvällsscen"

### 3. Välkomstbelysning
**Trigger:** Användare kommer hem
**Villkor:** Det är mörkt ute
**Åtgärder:**
- Tänd ytterbelysning 2 minuter innan ankomst (via geofencing)
- Tänd hallampan
- Efter 3 minuter: Släck ytterbelysning

---

## 💡 Ljusautomationer

### 4. Morgonljus (Gradvis väckning)
**Trigger:** Vardagar kl 06:30
**Villkor:** Någon är hemma
**Åtgärder:**
- Börja med 5% ljusstyrka i sovrummet
- Öka 10% var 5:e minut
- Efter 30 min: Full ljusstyrka
- Tänd köksbelysning

### 5. Adaptivt ljus baserat på dagsljus
**Trigger:** Var 15:e minut
**Villkor:** Någon är i rummet (rörelse)
**Åtgärder:**
- Läs ljussensor
- Om ljus < 300 lux OCH lampa är av: Tänd till 30%
- Om ljus < 150 lux: Öka till 60%
- Om ljus > 500 lux: Dimra till 0%

### 6. Rörelsestyrd belysning
**Trigger:** Rörelse upptäckt
**Villkor:** Det är mörkt
**Åtgärder:**
- Tänd lampa i zonen
- Starta timer på 5 minuter
- När ingen rörelse på 5 min: Släck

### 7. Filmkvällsläge
**Trigger:** TV:n slås på efter 19:00
**Villkor:** Vardagsrummet
**Åtgärder:**
- Dimra vardagsrumslampa till 10%
- Sätt färg till varm vit (2700K)
- Tänd bias-belysning bakom TV

---

## 🌡️ Klimatautomationer

### 8. Smart uppvärmning
**Trigger:** Temperatur under 19°C
**Villkor:** Någon är hemma
**Åtgärder:**
- Aktivera värmepump
- Sätt termostat till 21°C
- Notifiera om det tar mer än 1 timme att nå måltemperatur

### 9. Ventilation vid hög luftfuktighet
**Trigger:** Luftfuktighet > 70%
**Villkor:** I badrum eller kök
**Åtgärder:**
- Starta frånluftsfläkt
- Kör i 30 minuter
- Stäng av när luftfuktighet < 55%

### 10. Natttemperatur
**Trigger:** Kl 22:00
**Villkor:** Någon är hemma
**Åtgärder:**
- Sänk sovrumstemperatur till 18°C
- Höj vardagsrumstemperatur till 21°C (för de som är uppe)
- Kl 00:00: Sänk hela huset till 18°C

### 11. Öppet fönster-detektion
**Trigger:** Temperatur sjunker snabbt (>2°C på 10 min)
**Åtgärder:**
- Pausa uppvärmning i det rummet
- Skicka notifikation: "Möjligt öppet fönster i [rum]"
- Återuppta efter 30 min eller när temp stabiliseras

---

## ⚡ Energiautomationer

### 12. Standby-killer
**Trigger:** Kl 23:00 eller när alla lämnar hemmet
**Åtgärder:**
- Stäng av alla enheter i "Standby"-gruppen
- Behåll: Kyl/frys, router, Homey
- Spara förbrukningsdata

### 13. Hög förbrukning-varning
**Trigger:** Total förbrukning > 5000W i 10 minuter
**Åtgärder:**
- Skicka kritisk notifikation
- Lista topp 5 förbrukare
- Föreslå åtgärder

### 14. Tvättmaskinen klar
**Trigger:** Tvättmaskinens effekt < 5W (var aktiv > 100W)
**Åtgärder:**
- Skicka notifikation: "Tvättmaskinen är klar!"
- Om ingen öppnar luckan på 30 min: Påminn igen

### 15. Solcells-optimering
**Trigger:** Solproduktion > hushållsförbrukning
**Åtgärder:**
- Starta laddning av elbil
- Starta varmvattenberedare (om möjligt)
- Notifiera om överskott

---

## 🔒 Säkerhetsautomationer

### 16. Inbrottsimulering (Semesterläge)
**Trigger:** Semesterläge aktivt + solnedgång
**Åtgärder:**
- Tänd/släck lampor slumpmässigt
- Variera tider ±30 min varje dag
- Dra för gardiner vid skymning
- Spela radio/TV-ljud slumpmässigt

### 17. Dörr öppen för länge
**Trigger:** Dörrsensor öppen > 5 minuter
**Villkor:** Temperatur ute < 10°C
**Åtgärder:**
- Skicka notifikation: "[Dörr] har varit öppen i 5 minuter"
- Pausa uppvärmning i närliggande zon
- Upprepa var 5:e minut tills stängd

### 18. Rökdetektor-respons
**Trigger:** Rökdetektor aktiveras
**Åtgärder:**
- KRITISK notifikation till alla
- Tänd ALLA lampor till 100%
- Lås upp alla dörrar
- Stäng av ventilation
- Spela varningsmeddelande

### 19. Översvämningsdetektor
**Trigger:** Vattensensor aktiveras
**Åtgärder:**
- KRITISK notifikation
- Stäng av huvudvattenventil (om smart ventil finns)
- Notera tid och plats i logg

### 20. Nattlig rörelsedetektion
**Trigger:** Rörelse upptäckt mellan 02:00-05:00
**Villkor:** Ingen schemalagd aktivitet
**Åtgärder:**
- Skicka tyst notifikation
- Spara kamerabild (om tillgänglig)
- Logga händelse

---

## ⏰ Tidbaserade automationer

### 21. Morgonrutin (Vardagar)
**Trigger:** Alarm på telefonen eller kl 06:45
**Åtgärder:**
- T+0: Starta kaffemaskin
- T+0: Gradvis ljus i sovrum
- T+5: Tänd köksbelysning
- T+5: Säg väderleksrapport (valfritt)
- T+15: Höj badrumstemperatur
- T+30: Spela nyhetspodcast (valfritt)

### 22. Helgmorgon
**Trigger:** Lördag/söndag + rörelse i kök
**Villkor:** Tid mellan 07:00-10:00
**Åtgärder:**
- Spela lugn musik på låg volym
- Tänd belysning till 50%
- Sätt "Stör ej" på alla enheter

### 23. Kvällsrutin
**Trigger:** Kl 21:00
**Villkor:** Någon är hemma
**Åtgärder:**
- Dimra alla lampor till 40%
- Skift till varm vit färgtemperatur
- Sänk volym på alla mediaspelare
- Skicka påminnelse om att ta medicin (valfritt)

### 24. Veckovis städpåminnelse
**Trigger:** Söndag kl 10:00
**Åtgärder:**
- Notifikation: "Dags för veckostädning!"
- Föreslå rum baserat på rörelsedata (minst använda rum först)

---

## 🎭 Avancerade scenarion

### 25. Gäster hemma
**Trigger:** Manuell aktivering eller > 4 telefoner anslutna till WiFi
**Åtgärder:**
- Höj gästbadrummets temperatur
- Sätt gästnätverket på "high performance"
- Aktivera festbelysning i vardagsrum
- Pausa robotdammsugare
- Förenkla alla röststyrningskommandon

### 26. Barnsovning
**Trigger:** Manuell aktivering
**Åtgärder:**
- Tänd nattlampa i barnrummet (5% varm vit)
- Starta white noise på Sonos
- Stäng av alla notifikationer i huset
- Aktivera "tyst läge" på alla enheter
- Dimra alla lampor utanför barnrummet

### 27. Träningspass
**Trigger:** Träningsrum får rörelse + hjärtfrekvensmätare ansluts
**Åtgärder:**
- Starta träningsspellista
- Höj ventilation i träningsrummet
- Visa statistik på skärm (om tillgänglig)
- Efter 45 min utan rörelse: Skicka "Bra jobbat!"-notifikation

### 28. Arbeta hemifrån
**Trigger:** Vardagar + länge stillasittande i kontoret
**Åtgärder:**
- Aktivera fokusläge (inga notifikationer)
- Optimal kontorsbelysning
- Var 50:e minut: "Ta en paus" med ljusändring
- Lunchpåminnelse kl 12:00
- Avslutningsritual kl 17:00

### 29. Regndetektion
**Trigger:** Regndata från väderstation eller API
**Åtgärder:**
- Stäng takfönster (om automatiska)
- Pausa bevattningssystem
- Dra in markiser
- Notifikation: "Det börjar regna - fönster stängda"

### 30. Strömavbrott-återställning
**Trigger:** Homey startar om
**Villkor:** Tid mellan 00:00-06:00
**Åtgärder:**
- Sätt alla lampor till AV (undvik att de tänds mitt i natten)
- Kontrollera säkerhetsstatus
- Skicka notifikation om strömavbrott
- Logga händelsen

---

## 📝 Implementeringsguide

### Steg 1: Grundkonfiguration
1. Konfigurera alla enheter i Homey
2. Skapa zoner (Vardagsrum, Sovrum, etc.)
3. Tilldela enheter till zoner

### Steg 2: Installera Smart Home Pro-appen
```bash
cd ~/HomeySmartHome/homey-app
npx homey app run
```

### Steg 3: Skapa Flows
Använd Homeys Flow-editor eller Smart Home Pro-appens API för att implementera automationerna.

### Steg 4: Testa och finjustera
- Börja med enkla automationer
- Testa varje trigger och villkor
- Justera tidsfördröjningar efter behov
- Övervaka loggarna för problem

---

## 🔧 API-referens

### Aktivera scen
```javascript
POST /api/scene/:sceneId
```

### Hämta energidata
```javascript
GET /api/energy
```

### Ställ in säkerhetsläge
```javascript
POST /api/security/mode
Body: { "mode": "home|away|night|disarmed" }
```

### Styr enhet
```javascript
POST /api/device/:deviceId/capability/:capability
Body: { "value": true|false|number }
```

---

## 💡 Tips

1. **Börja enkelt** - Implementera en automation i taget
2. **Testa noggrant** - Varje automation bör testas i olika scenarion
3. **Använd villkor** - Undvik oönskade triggers med rätt villkor
4. **Logga allt** - Aktivitetsloggen hjälper vid felsökning
5. **Backup** - Exportera dina Flows regelbundet
