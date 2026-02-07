# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projekt-Übersicht

**Elektro-Planer** ist eine browserbasierte Lernanwendung für Elektrotechnik-Lehrlinge zum Erlernen der Installationsverteiler-Planung. Die Anwendung ermöglicht das visuelle Platzieren elektrischer Komponenten (Leitungsschutzschalter, FI-Schutzschalter, Klemmen, etc.) und deren Verdrahtung mit automatischer Validierung nach ÖVE-Normen.

## Wichtige Befehle

### Development
```bash
cd elektro-planer
npm run dev          # Startet Vite Dev-Server auf http://localhost:5173
npm run build        # TypeScript-Kompilierung + Vite Build
npm run preview      # Vorschau des Production Builds
npm run lint         # ESLint auf gesamtes Projekt
```

### Einzelne Tests / Debugging
- Es gibt keine Test-Suite im Projekt
- Zum Debuggen: Browser DevTools + React DevTools Extension verwenden
- State-Debugging: Zustand DevTools Extension verwenden

## Architektur

### Tech Stack
- **Frontend**: React 19 mit TypeScript 5.9
- **Build Tool**: Vite 7
- **State Management**: Zustand 5 mit localStorage Persistierung
- **Drag & Drop**: React-DnD 16 mit HTML5Backend
- **Styling**: Tailwind CSS 3 + Inline-SVG für Schaltpläne
- **Export**: jsPDF (PDF), XLSX (Excel)

### Code-Struktur

```
elektro-planer/src/
├── store/useStore.ts          # Zentraler Zustand (720 Zeilen)
│                              # - State: verteiler, ui, validationResult
│                              # - Actions: alle CRUD-Operationen für Komponenten/Drähte
│                              # - localStorage Persistierung via Zustand middleware
│
├── types/index.ts             # Zentrale TypeScript-Definitionen (783 Zeilen)
│                              # - COMPONENT_LIBRARY: 20+ vordefinierte Komponenten
│                              # - ElektroComponent Union-Typ (12 Typen)
│                              # - Validierungs-Taxonomie
│
├── utils/
│   ├── validation.ts          # ÖVE-konforme Validierungs-Engine
│   │                          # - Stromlast-, Spannungsfall-, Schleifenimpedanz-Berechnung
│   │                          # - Überlast-/Selektivitätsprüfung
│   │                          # - 8+ Fehlertypen mit Schweregrad
│   │
│   ├── circuitGraph.ts        # Netzwerk-Topologie-Analyse
│   │                          # - Graphen-Modell (Klemmen=Knoten, Drähte=Kanten)
│   │                          # - Pfad-Erkennung von Versorgung zu Abgängen
│   │                          # - BFS für Hierarchie-Tiefe
│   │
│   ├── export.ts              # PDF/Excel-Export
│   ├── terminals.ts           # Terminal-Positionen pro Komponententyp
│   └── constants.ts           # UI-Konstanten (TE_WIDTH, HEIGHTS, etc.)
│
└── components/
    ├── verteiler/             # Hauptschaltplan-Canvas
    │   ├── VerteilerCanvas.tsx    # Top-Level Container
    │   ├── Hutschiene.tsx         # Einzelne Hutschiene mit Slots (max 10 TE)
    │   ├── ComponentSlot.tsx      # Drop-Zone für Komponenten-Platzierung
    │   ├── PlacedComponent.tsx    # Einzelne Komponente (Draggable + Terminals)
    │   └── WiringOverlay.tsx      # SVG für Drähte + Interaktion
    │
    ├── sidebar/               # Rechtes Panel mit 3 Tabs
    │   ├── ComponentLibrary.tsx   # Drag-Source für neue Komponenten
    │   ├── PropertyPanel.tsx      # Komponenten-Eigenschaften
    │   ├── WirePropertyPanel.tsx  # Draht-Eigenschaften
    │   ├── VerbraucherPanel.tsx   # Verbraucher-Management
    │   └── ValidationPanel.tsx    # Prüfungs-Engine + Ergebnisse
    │
    └── common/
        └── Header.tsx         # Projekt-Management, Export, Settings
```

### State Management Pattern

**Zustand Single Store** mit drei Hauptbereichen:

```typescript
AppState {
  verteiler: {
    komponenten: Map<id, ElektroComponent>  // Alle platzierten Komponenten
    hutschienen: Hutschiene[]               // 4 Reihen á 10 TE
    wires: Map<id, Wire>                    // Alle Verdrahtungen
    verbraucher: Map<id, Verbraucher>       // Verbraucher-Definitionen
    anspeisung: Anspeisung                  // Spannungs-/Impedanz-Quelle
  }
  ui: {
    selectedComponentId, selectedWireId     // Selektion
    wiringMode, wiringOrthoMode             # Verdrahtungs-Modus
    wiringStartTerminal, wiringWaypoints    # Draht-Aufbau-State
    activeTab                               # Sidebar-Navigation
    zoomLevel, panOffset                    # Canvas-Ansicht
  }
  validationResult: ValidationResult | null # Validierungs-Cache
}
```

**Wichtige Actions**:
- `addComponent`, `updateComponent`, `removeComponent`
- `addWire`, `updateWire`, `removeWire`
- `addVerbraucher`, `updateVerbraucher`, `removeVerbraucher`
- `setSelectedComponent`, `setWiringMode`
- `runValidation` - Führt vollständige ÖVE-Validierung aus

### Drag & Drop System

**React-DnD Integration**:
1. **ComponentLibrary** → `useDrag` mit `type: 'COMPONENT'`
2. **ComponentSlot** → `useDrop` mit Typ-Validierung + automatischem Einrasten
3. **PlacedComponent** → `useDrag` für Verschiebung + `useDrop` (für Verbraucher)
4. **Verbraucher-Zuweisung** → Drag auf Abgangsklemmen mit Phasen-Matching

### Verdrahtungs-System

**Zwei Modi**:
- **Direkt-Modus** (`wiringOrthoMode: false`): Freie Waypoints mit 6px-Snap-Raster
- **Ortho-Modus** (`wiringOrthoMode: true`): Nur horizontale/vertikale Segmente

**Ablauf**:
1. Wiring-Modus aktivieren (`setWiringMode(true)`)
2. Start-Terminal klicken → `ui.wiringStartTerminal` setzen
3. Waypoints platzieren → `ui.wiringWaypoints` erweitern
4. Ziel-Terminal klicken → `addWire()` + Modus zurücksetzen

**Wire-Rendering**: SVG-Paths in `WiringOverlay.tsx` mit Live-Vorschau beim Draht-Aufbau

### Validierungs-System

**Trigger**: Automatisch nach jeder Änderung (via `runValidation()`)

**Berechnungen** (in `utils/validation.ts`):
- **Stromlast**: `I = P / (√3 · U · cos φ)` für Drehstrom
- **Spannungsfall**: `ΔU = √3 · I · (R · cosφ + X · sinφ)` nach ÖVE E 8101
- **Schleifenimpedanz**: `Zs = R_Quelle + R_Leitung + R_Last`
- **Überlast-Check**: Vergleich Stromkreis-Last vs. LS-Nennstrom
- **Selektivität**: Hierarchie-Prüfung (Abgang-LS < Gruppen-LS < Haupt-LS)

**Fehler-Typen** (8+):
- `OVERLOAD`, `OVERCURRENT`, `SHORT_CIRCUIT`
- `SELECTIVITY_VIOLATION`, `VOLTAGE_DROP_EXCEEDED`
- `LOOP_IMPEDANCE_HIGH`, `PHASE_IMBALANCE`
- `MISSING_CONNECTION`, `DOUBLE_ASSIGNMENT`

**Output**: `validationResult.errors[]` mit Schweregrad (error/warning)

## Elektrotechnik-Spezifika

### Phasen-System
- **5 Phasen**: L1, L2, L3 (Außenleiter), N (Neutralleiter), PE (Schutzleiter)
- **Farb-Codierung**: IEC 60445-konform (L1=braun, L2=schwarz, L3=grau, N=blau, PE=grün-gelb)
- **3-phasige Symmetrie**: Validierung prüft gleichmäßige Lastverteilung

### ÖVE-Normen Integration
- **Spannungsfall**: Max. 4% (ÖVE E 8101)
- **Abschaltzeit**: 0.4s bei 230V (ÖVE/ÖNORM E 8001-1)
- **Leiter-Belastbarkeit**: Nachschlagetabelle in `validation.ts`
- **Kupfer-Widerstand**: ρ = 0.0178 Ω·mm²/m

### Komponenten-Typen (12)
1. **Leitungsschutzschalter (LS)**: B/C/D-Charakteristik, 1-4 polig
2. **FI-Schutzschalter (RCD)**: 30/100/300 mA, 2/4 polig
3. **Klemmen**: Einspeise-/Abgang-/N-/PE-Klemmen mit 2-4 Anschlüssen
4. **ÜSpannungsschutz (SPD)**: Typ 1+2 Kombi
5. **Schütz**: 3-polig mit Steuereingang
6. **Zähler**: 1/3-phasig
7. **Motorschutz**: Mit Auslöser
8. **Zeitrelais**: Verzögert ein/aus
9. **Koppelrelais**: 1-pol Umschalter
10. **Signalleuchte**: Status-Anzeige
11. **Taster**: Schließer/Öffner
12. **Leerfeld**: Platzhalter

**COMPONENT_LIBRARY** in `types/index.ts` enthält 20+ vordefinierte Varianten.

### Raster-System
- **Teilungseinheit (TE)**: 18mm Standardbreite
- **Reihen-Layout**: 4 Hutschienen á 10 TE = 40 Slots
- **Automatisches Einrasten**: Snap-to-Grid beim Drag & Drop
- **Mehrpolige Komponenten**: Belegen mehrere TE (z.B. 3-pol LS = 3 TE)

### Verbraucher-Management
**Zwei-Phasen-Ansatz**:
1. **Definition**: Verbraucher anlegen mit Leistung, Phase, cos φ
2. **Zuweisung**: Drag auf Abgangsklemme → Link via `klemmeId`

**Auto-Berechnung**:
- Strom `I` aus Leistung `P` und Spannung `U` (1/3-phasig)
- Validierung prüft Überlast der zugewiesenen Schutzeinrichtung

## Projekt-Dateien

### Wichtige Dateien außerhalb von `elektro-planer/`
- **`Requirements für promt.txt`**: Vollständige Anforderungsanalyse (ChatGPT-Dialog)
- **`Requieremnets als JSON.txt`**: Strukturierte Requirements
- **`ToDo.txt`**: Aktuelle offene Aufgaben
  - Verbraucher-Symbol löschen bei Klemmen-Zuweisung aufheben
  - Verlegeart bei Verbraucher hinterlegen

### Persistierung
- **localStorage**: Automatisch via Zustand-Middleware (nur `verteiler`-State)
- **Export-Formate**:
  - `.eplan`: JSON mit Zeitstempel
  - `.pdf`: jsPDF (Schaltplan + Komponentenliste)
  - `.xlsx`: Excel-Tabelle

## Entwicklungs-Richtlinien

### TypeScript
- Strikte Typisierung: Keine `any`-Typen verwenden
- Union-Typen für Komponenten-Varianten bevorzugen
- Type Guards für Runtime-Typ-Checks (`component.typ === 'LS'`)

### State Updates
- Immer über Store-Actions mutieren (nie direkt)
- Komponenten-IDs via `uuid.v4()` generieren
- Nach strukturellen Änderungen `runValidation()` aufrufen

### Komponenten-Entwicklung
- Funktionale Komponenten mit TypeScript
- Custom Hooks in `hooks/` (bisher leer)
- Tailwind für Styling, Inline-SVG für technische Visualisierung
- Keine Klassennamen-Konflikte mit Tailwind-Utilities

### SVG-Rendering
- Terminalpunkte über `utils/terminals.ts` berechnen
- Koordinaten relativ zu Komponenten-Position
- 6px-Snap-Raster für Drähte (WIRE_GRID_X in `constants.ts`)

### Performance
- Zustand ist optimiert für React-Rerendering (automatisches Subscription)
- Maps für Komponenten/Drähte (schneller Lookup)
- Validierung ist synchron (bei großen Schaltungen ggf. debouncing erwägen)

## Bekannte Limitationen
- **Max. Projekt-Größe**: 4 Reihen á 10 TE (40 Slots)
- **Keine Multi-User**: Kein Backend, keine Echtzeit-Kollaboration
- **Keine Rückgängig-Funktion**: Undo/Redo nicht implementiert
- **Browser-Abhängigkeit**: localStorage für Persistierung (nicht geräte-übergreifend)
- **Keine Tests**: Test-Suite fehlt
