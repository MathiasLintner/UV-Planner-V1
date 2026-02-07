# Test: FI-Schalter ohne LS-Schutz

## Problem: Verbraucher direkt am FI-Schalter

Ein FI-Schalter schützt **NUR** vor Fehlerstrom (Isolationsfehler), **NICHT** vor Überstrom/Kurzschluss!

Daher ist diese Konfiguration **FALSCH**:
```
NH-Sicherung → FI-Schalter → Verbraucher
```

## Neue Validierung

### Szenario 1: Verbraucher direkt am FI-Schalter (mit vorgeschalteter Sicherung)
```
NH-Sicherung 63A → FI-Schalter 40A/30mA → Verbraucher 3680W
```

**Problem:**
- Direkte Schutzeinrichtung: ❌ Keine (FI ist kein Überstromschutz!)
- Vorgeschaltete Sicherung: ✅ NH-Sicherung 63A
- **Aber:** Zwischen FI und Verbraucher fehlt LS-Schalter!

**Fehlermeldung:**
```
Typ: fehlende-schutzeinrichtung
Schweregrad: kritisch

Beschreibung:
"Zwischen FI-Schalter und Verbraucher fehlt Überstromschutz"

Hinweis:
"Der Verbraucher ist direkt an einem FI-Schalter angeschlossen,
aber zwischen FI und Verbraucher fehlt eine Überstromschutzeinrichtung
(LS-Schalter). Auch wenn vorgeschaltete Sicherungen vorhanden sind,
muss jeder Abgang am FI-Schalter durch einen LS-Schalter oder
FI/LS-Kombi geschützt werden."
```

### Szenario 2: Verbraucher am FI ohne jegliche Sicherung
```
Versorgung → FI-Schalter 40A/30mA → Verbraucher 3680W
```

**Problem:**
- Direkte Schutzeinrichtung: ❌ Keine
- Vorgeschaltete Sicherung: ❌ Keine

**Fehlermeldung:**
```
Typ: fehlende-schutzeinrichtung
Schweregrad: kritisch

Beschreibung:
"Verbraucher hat keine Schutzeinrichtung"

Hinweis:
"Der Verbraucher mit 3680W Leistung (16.0A) hat weder eine
direkt zugewiesene noch eine vorgeschaltete Überstromschutzeinrichtung.
Jeder Verbraucher muss durch mindestens eine Sicherung
(LS-Schalter, FI/LS-Kombi, NH-Sicherung, etc.) geschützt sein."
```

## Korrekte Konfigurationen

### ✅ RICHTIG: FI + LS-Schalter
```
NH-Sicherung 63A → FI-Schalter 40A/30mA → LS-Schalter 16A → Verbraucher 3680W
```
- Vorgeschaltete Sicherung: NH-Sicherung 63A
- Direkte Schutzeinrichtung: LS-Schalter 16A ✓
- FI-Schutz: FI-Schalter 40A/30mA ✓

### ✅ RICHTIG: FI/LS-Kombi
```
NH-Sicherung 63A → FI/LS-Kombi 16A/30mA → Verbraucher 3680W
```
- Vorgeschaltete Sicherung: NH-Sicherung 63A
- Direkte Schutzeinrichtung: FI/LS-Kombi 16A ✓
- Überstrom + FI in einem Gerät ✓

### ✅ RICHTIG: Nur LS-Schalter (ohne FI)
```
NH-Sicherung 63A → LS-Schalter 16A → Verbraucher 3680W
```
- Vorgeschaltete Sicherung: NH-Sicherung 63A
- Direkte Schutzeinrichtung: LS-Schalter 16A ✓
- Hinweis: FI wird für Steckdosen empfohlen, aber nicht zwingend für alle Verbraucher

## Code-Änderungen

### validation.ts (Zeile 1706-1721)

**Neue Prüfung:**
```typescript
// Prüfe ob nur vorgeschaltete Sicherung vorhanden ist,
// aber keine direkte Schutzeinrichtung
if (!hatDirekteSchutzeinrichtung && hatVorgeschalteteSicherung) {
  // Prüfe ob die zugewiesene Komponente ein FI-Schalter ist
  if (zugewieseneKomponente.type === 'fi-schalter') {
    errors.push({
      id: uuidv4(),
      typ: 'fehlende-schutzeinrichtung',
      komponenteId: verbraucher.id,
      komponenteName: verbraucher.name,
      beschreibung: `Zwischen FI-Schalter und Verbraucher fehlt Überstromschutz`,
      hinweis: `Der Verbraucher ist direkt an einem FI-Schalter angeschlossen...`,
      schweregrad: 'kritisch',
    });
  }
}
```

## Übersicht aller Fälle

| Konfiguration | Direkt | Vorgeschaltet | Ergebnis |
|---------------|--------|---------------|----------|
| Verbraucher → LS-Schalter | ✅ LS | - | ✅ OK |
| Verbraucher → FI/LS-Kombi | ✅ FI/LS | - | ✅ OK |
| Verbraucher → LS → NH-Sicherung | ✅ LS | ✅ NH | ✅ OK |
| Verbraucher → FI → LS → NH-Sicherung | ✅ LS | ✅ NH | ✅ OK |
| Verbraucher → **FI → NH-Sicherung** | ❌ Keine | ✅ NH | ❌ **FEHLER: Zwischen FI und Verbraucher fehlt LS** |
| Verbraucher → **FI** | ❌ Keine | ❌ Keine | ❌ **FEHLER: Keine Schutzeinrichtung** |
| Verbraucher → **Phasenverteiler** | ❌ Keine | ❌ Keine | ❌ **FEHLER: Keine Schutzeinrichtung** |

## Warum ist das wichtig?

### Problem 1: Überlast
Ein Verbraucher zieht mehr Strom als die Leitung verträgt.
- FI-Schalter: Löst **NICHT** aus (erkennt nur Fehlerstrom!)
- NH-Sicherung: Ist zu groß (z.B. 63A), schützt Leitung nicht
- **Folge:** Leitung überhitzt, Brandgefahr!

### Problem 2: Kurzschluss am Verbraucher
Ein Kurzschluss tritt direkt am Verbraucher auf.
- FI-Schalter: Könnte auslösen, ist aber **nicht dafür ausgelegt**
- NH-Sicherung: Ist zu weit weg und zu träge
- **Folge:** Kabel brennt durch, bevor Sicherung auslöst

### Lösung: LS-Schalter zwischen FI und Verbraucher
- LS-Schalter ist **direkt** am Verbraucher
- LS-Schalter ist **schnell** genug für Kurzschlussschutz
- LS-Schalter ist **passend dimensioniert** (z.B. 16A für 3680W)

## Zusammenfassung

✅ **Neu:** Verbraucher direkt am FI-Schalter werden als kritischer Fehler erkannt
✅ **Grund:** FI schützt NUR vor Fehlerstrom, NICHT vor Überstrom
✅ **Lösung:** LS-Schalter oder FI/LS-Kombi zwischen FI und Verbraucher einfügen
✅ **Auch bei vorgeschalteten Sicherungen:** Jeder FI-Abgang braucht eigenen LS-Schalter
