# Test: Fehlende Schutzeinrichtung

## Neue Validierungsregel

**Ziel:** Jeder Verbraucher MUSS mindestens eine Überstromschutzeinrichtung haben.

## Geprüfte Schutzeinrichtungen

### Direkt zugewiesene Schutzeinrichtungen:
- LS-Schalter (Leitungsschutzschalter)
- FI/LS-Kombi (Fehlerstrom-/Leitungsschutzschalter)

### Vorgeschaltete Schutzeinrichtungen:
- NH-Sicherungen
- Neozed-Sicherungen
- Schraubsicherungen
- Weitere LS-Schalter und FI/LS-Kombis in der Kette

## Fehlertypen

### 1. Verbraucher hat KEINE Schutzeinrichtung (NEU!)
```
Typ: fehlende-schutzeinrichtung
Schweregrad: kritisch

Beschreibung:
"Verbraucher hat keine Schutzeinrichtung"

Hinweis:
"Der Verbraucher mit 3680W Leistung (16.0A) hat weder eine direkt
zugewiesene noch eine vorgeschaltete Überstromschutzeinrichtung.
Jeder Verbraucher muss durch mindestens eine Sicherung
(LS-Schalter, FI/LS-Kombi, NH-Sicherung, etc.) geschützt sein."
```

**Wann tritt dieser Fehler auf?**
- Verbraucher ist z.B. direkt an einem FI-Schalter angeschlossen
- Verbraucher ist an einem Phasenverteiler angeschlossen
- Verbraucher ist an einem Neutralleiterverteiler angeschlossen
- **KEINE** vorgeschaltete Sicherung im gesamten Stromkreis

### 2. Verbraucher hat höheren Strom als Sicherung (BESTEHENDES VERHALTEN)
```
Typ: ueberstrom
Schweregrad: fehler

Beschreibung:
"Verbraucher hat höheren Strom (16.0A) als zugewiesene
Sicherung 'LS1' (10A)"

Hinweis:
"Der Verbraucher mit 3680W Leistung benötigt 16.0A, aber die
Sicherung ist nur für 10A ausgelegt. Erhöhen Sie den
Bemessungsstrom der Sicherung oder reduzieren Sie die
Verbraucherleistung."
```

## Beispiel-Szenarien

### ✅ KORREKT - Verbraucher mit LS-Schalter
```
Versorgung → LS-Schalter 16A → Verbraucher 3680W
```
- Direkte Schutzeinrichtung: LS-Schalter 16A ✓
- Keine Fehlermeldung

### ✅ KORREKT - Verbraucher mit vorgeschalteter NH-Sicherung
```
Versorgung → NH-Sicherung 63A → FI-Schalter → Verbraucher 3680W
```
- Direkte Schutzeinrichtung: Keine
- Vorgeschaltete Schutzeinrichtung: NH-Sicherung 63A ✓
- Keine Fehlermeldung

### ❌ FEHLER - Verbraucher ohne jegliche Sicherung
```
Versorgung → FI-Schalter → Verbraucher 3680W
```
- Direkte Schutzeinrichtung: Keine (FI ist KEIN Überstromschutz!)
- Vorgeschaltete Schutzeinrichtung: Keine
- **FEHLER:** "Verbraucher hat keine Schutzeinrichtung" (kritisch)

### ❌ FEHLER - Verbraucher nur an Phasenverteiler
```
Versorgung → Phasenverteiler → Verbraucher 3680W
```
- Direkte Schutzeinrichtung: Keine
- Vorgeschaltete Schutzeinrichtung: Keine
- **FEHLER:** "Verbraucher hat keine Schutzeinrichtung" (kritisch)

### ⚠️ ÜBERSTROM - Sicherung zu klein
```
Versorgung → LS-Schalter 10A → Verbraucher 3680W (16A)
```
- Direkte Schutzeinrichtung: LS-Schalter 10A
- **FEHLER:** "Verbraucher hat höheren Strom (16.0A) als zugewiesene Sicherung (10A)" (fehler)

## Code-Änderungen

### validation.ts (Zeile 1647-1704)

**Neue Variablen:**
- `hatDirekteSchutzeinrichtung`: Prüft ob LS-Schalter oder FI/LS-Kombi direkt zugewiesen
- `hatVorgeschalteteSicherung`: Prüft ob irgendeine Sicherung vorgeschaltet ist

**Neue Prüfung (Zeile 1693-1704):**
```typescript
// Prüfe ob ÜBERHAUPT KEINE Sicherung vorhanden ist
if (!hatDirekteSchutzeinrichtung && !hatVorgeschalteteSicherung) {
  errors.push({
    id: uuidv4(),
    typ: 'fehlende-schutzeinrichtung',
    // ... Fehlerdetails
  });
}
```

### types/index.ts (Zeile 303)

**Neuer Fehlertyp hinzugefügt:**
```typescript
export type FehlerTyp =
  | 'ueberlast'
  | 'ueberstrom'
  | 'kurzschluss'
  // ... weitere Typen
  | 'fehlende-schutzeinrichtung'; // NEU!
```

## Wichtig: Unterscheidung FI vs. Überstromschutz

**FI-Schalter:**
- Schützt nur vor Fehlerstrom (Isolationsfehler, Körperschluss)
- Löst bei Differenzstrom aus (z.B. 30mA)
- **KEIN** Schutz vor Überstrom/Kurzschluss!

**Überstromschutz (LS-Schalter, Sicherungen):**
- Schützt vor zu hohem Strom (Überlast, Kurzschluss)
- Löst bei Überschreitung des Bemessungsstroms aus

**Richtige Kombination:**
- FI/LS-Kombi: Beides in einem Gerät ✓
- FI + LS-Schalter: Beide nacheinander ✓
- Nur FI: ❌ Fehlt Überstromschutz!
- Nur LS: Funktioniert, aber FI empfohlen (z.B. für Steckdosen)

## Zusammenfassung

✅ **Neu:** Verbraucher ohne jegliche Schutzeinrichtung werden als kritischer Fehler erkannt
✅ **Bestehend:** Verbraucher mit zu kleiner Sicherung werden weiterhin als Fehler erkannt
✅ **Korrekt:** Sowohl direkt zugewiesene als auch vorgeschaltete Sicherungen werden berücksichtigt
