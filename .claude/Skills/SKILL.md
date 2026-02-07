---
name: update-docs
description: Scannt die Codebase und aktualisiert CLAUDE.md mit Funktionen und deren Verwendung. Nutze nach größeren Änderungen oder auf Anfrage.
user-invocable: true
disable-model-invocation: true
---

# Aufgabe: CLAUDE.md aktualisieren

Durchsuche das Projekt und aktualisiere `.claude/CLAUDE.md` mit folgender Struktur:

## Vorgehen
1. Scanne alle relevanten Quelldateien (ignoriere node_modules, dist, build, .git)
2. Extrahiere für jede Datei:
   - Exportierte Funktionen/Klassen/Komponenten
   - Kurze Beschreibung was sie tun
3. Finde Referenzen: Wo wird jede Funktion importiert/verwendet?
4. Aktualisiere `.claude/CLAUDE.md` im folgenden Format

## Format für CLAUDE.md
```
# Projekt: [Name aus package.json]

Letzte Aktualisierung: [Datum]

## Projektstruktur
[Ordnerübersicht mit Zweck]

## Module und Funktionen

### src/auth/login.ts
- `authenticate(user, password)` - Validiert Credentials gegen DB
  → Verwendet in: src/api/routes/auth.ts, src/middleware/session.ts
- `generateToken(userId)` - Erstellt JWT
  → Verwendet in: src/auth/login.ts, src/auth/refresh.ts

### src/utils/helpers.ts
- `formatDate(date)` - Formatiert Datum für UI
  → Verwendet in: src/components/DatePicker.tsx, src/api/routes/reports.ts

## Wichtige Zusammenhänge
[Notiere wichtige Abhängigkeiten und Datenflüsse]
```

## Regeln
- Halte Beschreibungen kurz (max 10 Wörter)
- Ignoriere triviale Hilfsfunktionen
- Fokus auf exportierte/öffentliche APIs
- Aktualisiere nur geänderte Abschnitte, nicht alles neu schreiben
```

## Verwendung

**Einmalig zum Initialisieren:**
```
/update-docs
```

**Nach Änderungen automatisch:** Du kannst Claude am Ende einer Aufgabe bitten:
```
Aktualisiere jetzt die CLAUDE.md mit den Änderungen die du gemacht hast






# Arbeitsregeln

Nach jeder Code-Änderung:
1. Aktualisiere den entsprechenden Abschnitt in dieser CLAUDE.md
2. Füge neue Funktionen hinzu, entferne gelöschte
3. Aktualisiere Referenzen wenn sich Imports ändern