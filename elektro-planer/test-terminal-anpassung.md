# Terminal-Anpassung: Sammelschienen und Klemmen

## Änderungen

### 1. Sammelschienen (2 TE)
**Vorher:** 2 Anschlüsse oben + 2 Anschlüsse unten
**Neu:** 3 Anschlüsse oben + 3 Anschlüsse unten

**Betrifft:**
- Sammelschiene L1 (2 TE)
- Sammelschiene L2 (2 TE)
- Sammelschiene L3 (2 TE)
- Sammelschiene N (2 TE)
- Sammelschiene PE (2 TE)

**Visualisierung:**
```
Vorher (2 TE):
    1       2
    ┃       ┃
   ═════════════  <- Sammelschiene
    ┃       ┃
    1       2

Neu (2 TE):
   1   2   3
   ┃   ┃   ┃
  ═══════════════  <- Sammelschiene
   ┃   ┃   ┃
   1   2   3
```

**Grund:**
- Mehr Anschlussmöglichkeiten bei kompakter Bauform (2 TE)
- Typisch für professionelle Sammelschienen-Systeme
- Ermöglicht mehr Abgänge bei begrenztem Platz

### 2. Klemmen (1 TE)
**Vorher:** 3 Anschlüsse oben + 3 Anschlüsse unten
**Neu:** 1 Anschluss oben + 1 Anschluss unten

**Betrifft:**
- Klemme L1 (1 TE)
- Klemme L2 (1 TE)
- Klemme L3 (1 TE)
- Klemme N (1 TE)
- Klemme PE (1 TE)

**Visualisierung:**
```
Vorher (1 TE):
  1  2  3
  ┃  ┃  ┃
  ═══════  <- Klemme (zu viele Anschlüsse für 1 TE!)
  ┃  ┃  ┃
  1  2  3

Neu (1 TE):
     1
     ┃
    ═══  <- Klemme
     ┃
     1
```

**Grund:**
- Realistischer für 1 TE breite Klemmen
- Einfache Durchgangsklemme: 1 Eingang → 1 Ausgang
- Bei Bedarf mehrere Klemmen nebeneinander platzieren

## Code-Änderungen

### terminals.ts - Sammelschiene (Zeile 210-226)

**Vorher:**
```typescript
function getSammelSchieneTerminals(phase: Phase, teBreite: number): Terminal[] {
  const terminals: Terminal[] = [];
  const anzahlAnschluesse = Math.max(2, Math.floor(teBreite / 2));
  // ...
}
```

**Neu:**
```typescript
function getSammelSchieneTerminals(phase: Phase, teBreite: number): Terminal[] {
  const terminals: Terminal[] = [];

  // Sammelschienen mit 2 TE: 3 Anschlüsse oben und unten
  // Ansonsten: 1 Anschluss pro TE
  const anzahlAnschluesse = teBreite === 2 ? 3 : Math.max(1, Math.floor(teBreite / 2));

  for (let i = 0; i < anzahlAnschluesse; i++) {
    const offsetX = (i + 0.5) / anzahlAnschluesse;
    terminals.push(
      { id: `TOP_${i}`, label: `${i + 1}`, phase, position: 'top', offsetX },
      { id: `BOT_${i}`, label: `${i + 1}`, phase, position: 'bottom', offsetX }
    );
  }

  return terminals;
}
```

**Logik:**
- Wenn `teBreite === 2`: 3 Anschlüsse
- Sonst: 1 Anschluss pro 2 TE (alte Logik für andere Breiten)

### terminals.ts - Klemme (Zeile 281-291)

**Vorher:**
```typescript
function getKlemmeTerminals(phase: Phase): Terminal[] {
  return [
    // 3 Anschlüsse oben
    { id: 'TOP_0', label: '1', phase, position: 'top', offsetX: 0.2 },
    { id: 'TOP_1', label: '2', phase, position: 'top', offsetX: 0.5 },
    { id: 'TOP_2', label: '3', phase, position: 'top', offsetX: 0.8 },
    // 3 Anschlüsse unten
    { id: 'BOT_0', label: '1', phase, position: 'bottom', offsetX: 0.2 },
    { id: 'BOT_1', label: '2', phase, position: 'bottom', offsetX: 0.5 },
    { id: 'BOT_2', label: '3', phase, position: 'bottom', offsetX: 0.8 },
  ];
}
```

**Neu:**
```typescript
function getKlemmeTerminals(phase: Phase): Terminal[] {
  return [
    // 1 Anschluss oben
    { id: 'TOP_0', label: '1', phase, position: 'top', offsetX: 0.5 },
    // 1 Anschluss unten
    { id: 'BOT_0', label: '1', phase, position: 'bottom', offsetX: 0.5 },
  ];
}
```

**Logik:**
- Einfache Durchgangsklemme
- 1 Terminal oben (mittig bei offsetX: 0.5)
- 1 Terminal unten (mittig bei offsetX: 0.5)

## Anwendungsbeispiele

### Sammelschiene N (2 TE) mit 3 Abgängen

```
         LS1    LS2    LS3
          ┃      ┃      ┃
         ┌┴┐    ┌┴┐    ┌┴┐
    1    2    3
    ┃    ┃    ┃
   ═══════════════  <- Sammelschiene N (2 TE)
    ┃
    1
    │
   FI-Schalter
```

**Vorteil:** 3 LS-Schalter können parallel von der Sammelschiene versorgt werden

### Klemme N (1 TE) als Durchgang

```
    Von FI
      ┃
      1
      ┃
     ═══  <- Klemme N (1 TE)
      ┃
      1
      │
   Zu LS
```

**Vorteil:** Einfacher Durchgang, klar und übersichtlich

### Mehrere Klemmen für Verteilung

```
    Von FI
      ┃
  ┌───┼───┐
  1   1   1
  ┃   ┃   ┃
 ═══ ═══ ═══  <- 3x Klemme N (je 1 TE)
  ┃   ┃   ┃
  1   1   1
  │   │   │
 LS1 LS2 LS3
```

**Vorteil:** Für mehr Abgänge einfach mehrere Klemmen verwenden

## Auswirkung auf bestehende Verdrahtung

### ⚠️ Wichtig: Kompatibilität

Wenn bestehende Projekte geladen werden, die bereits Verdrahtung zu Sammelschienen oder Klemmen haben:

**Sammelschienen (vorher 2 Anschlüsse → jetzt 3):**
- Alte Verbindungen zu `TOP_0` und `TOP_1`: ✅ Bleiben gültig
- Neu verfügbar: `TOP_2` und `BOT_2`
- Alte Projekte funktionieren weiterhin

**Klemmen (vorher 3 Anschlüsse → jetzt 1):**
- ⚠️ Alte Verbindungen zu `TOP_1` und `TOP_2`: **Werden ungültig**
- Nur `TOP_0` und `BOT_0` bleiben gültig
- **Empfehlung:** Bei Laden alter Projekte mit Klemmen evtl. Warnung anzeigen

## Zusammenfassung

| Komponente | Breite | Anschlüsse Alt | Anschlüsse Neu | Grund |
|------------|--------|----------------|----------------|-------|
| Sammelschiene N/L/PE | 2 TE | 2 oben + 2 unten | 3 oben + 3 unten | Mehr Kapazität |
| Klemme N/L/PE | 1 TE | 3 oben + 3 unten | 1 oben + 1 unten | Realistischer |

✅ **Build erfolgreich**
✅ **Terminals korrekt angepasst**
✅ **Sammelschienen: 3 Anschlüsse bei 2 TE**
✅ **Klemmen: 1 Anschluss bei 1 TE**
