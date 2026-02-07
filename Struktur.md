# Elektro-Planer - Projektstruktur

## Übersicht

Der Elektro-Planer ist eine React-basierte Webanwendung zur Planung und Validierung von Elektroverteilern. Die Anwendung verwendet TypeScript, Zustand für State Management, React-DnD für Drag & Drop und Tailwind CSS für Styling.

---

## 📁 Verzeichnisstruktur

```
elektro-planer/
├── public/
│   └── kabel_belastbarkeit.json     # ÖVE E 8101 Strombelastbarkeitstabelle
├── src/
│   ├── main.tsx                     # Einstiegspunkt der Anwendung
│   ├── App.tsx                      # Haupt-App-Komponente mit Layout
│   ├── index.css                    # Globale Styles (Tailwind)
│   │
│   ├── types/
│   │   └── index.ts                 # Zentrale TypeScript-Definitionen
│   │
│   ├── store/
│   │   └── useStore.ts              # Zustand State Management
│   │
│   ├── utils/
│   │   ├── validation.ts            # ÖVE-Validierungslogik
│   │   ├── circuitGraph.ts          # Netzwerk-Topologie-Analyse
│   │   ├── export.ts                # PDF/Excel Export
│   │   ├── terminals.ts             # Terminal-Positionen für Komponenten
│   │   └── constants.ts             # UI-Konstanten (TE_WIDTH, etc.)
│   │
│   └── components/
│       ├── common/
│       │   └── Header.tsx           # Kopfzeile mit Projekt-Management
│       │
│       ├── icons/
│       │   └── SchaltplanIcons.tsx  # SVG-Icons für Komponenten
│       │
│       ├── verteiler/
│       │   ├── VerteilerCanvas.tsx  # Haupt-Canvas für Schaltplan
│       │   ├── Hutschiene.tsx       # Einzelne Hutschiene
│       │   ├── ComponentSlot.tsx    # Drop-Zone für Komponenten
│       │   ├── PlacedComponent.tsx  # Einzelne platzierte Komponente
│       │   └── WiringOverlay.tsx    # SVG-Overlay für Drähte
│       │
│       └── sidebar/
│           ├── Sidebar.tsx          # Rechtes Panel mit Tabs
│           ├── ComponentLibrary.tsx # Komponenten-Bibliothek
│           ├── PropertyPanel.tsx    # Komponenten-Eigenschaften
│           ├── WirePropertyPanel.tsx # Draht-Eigenschaften
│           ├── VerbraucherPanel.tsx # Verbraucher-Management
│           └── ValidationPanel.tsx  # Validierungs-Ergebnisse
```

---

## 🔑 Schlüsseldateien und ihre Funktionen

### 1. **main.tsx** - Einstiegspunkt
```
Verantwortlichkeiten:
- React-DOM Rendering
- DnD Provider Setup (HTML5Backend)
- App-Komponente mounten

Abhängigkeiten:
→ App.tsx
→ react-dnd, react-dnd-html5-backend
```

### 2. **App.tsx** - Haupt-Layout
```
Verantwortlichkeiten:
- Layout-Struktur (Header, Canvas, Sidebar)
- Keyboard-Handler (Delete-Taste)
- DnD Context Provider

Interaktionen:
→ Header (Projekt-Management)
→ VerteilerCanvas (Hauptbereich)
→ Sidebar (Eigenschaften/Bibliothek)
← useStore (für Keyboard-Actions)
```

---

## 📊 State Management

### **store/useStore.ts** - Zentraler Zustand
```typescript
Interface: AppState {
  verteiler: Verteiler           // Alle technischen Daten
  ui: UIState                    // UI-Zustand (Selektion, Modus)
  validationResult: ValidationResult | null
}
```

**Hauptverantwortlichkeiten:**
1. **Verteiler-Management**
   - `addComponent()`, `updateComponent()`, `removeComponent()`
   - `addHutschiene()`, `removeHutschiene()`
   - `updateVerteilerInfo()`

2. **Verbraucher-Management**
   - `addVerbraucher()`, `updateVerbraucher()`, `removeVerbraucher()`
   - `assignVerbraucherToComponent()`

3. **Verdrahtung**
   - `addWire()`, `updateWire()`, `removeWire()`
   - `setWiringMode()`, `setWiringOrthoMode()`
   - `addWiringWaypoint()`, `clearWiringWaypoints()`

4. **UI-Zustand**
   - `setSelectedComponent()`, `setSelectedVerbraucher()`, `setSelectedWire()`
   - `setActiveTab()`, `setZoom()`, `setPanOffset()`

5. **Validierung**
   - `runValidation()` - Ruft validation.ts auf

6. **Projekt-Operationen**
   - `loadProject()`, `resetProject()`, `resetProjectCustom()`

**Persistierung:**
- Zustand Middleware `persist`
- Speichert `verteiler` in localStorage
- Automatische Wiederherstellung beim Laden

**Interaktionen:**
```
useStore ←→ Alle Komponenten (via Hooks)
useStore → validation.ts (runValidation)
useStore → circuitGraph.ts (updateWireCurrentsInVerteiler)
```

---

## 🎨 Komponenten-Hierarchie

### **Header** (components/common/Header.tsx)
```
Verantwortlichkeiten:
- Projekt-Aktionen (Neu, Speichern, Öffnen)
- Export (PDF, Excel)
- Verdrahtungs-Modus-Toggle
- Phasen-Auswahl (L1, L2, L3, N, PE)
- Verteiler-Einstellungen (Name, Spannung, Nennstrom)

Interaktionen:
← useStore (verteiler, ui, Aktionen)
→ export.ts (exportToPDF, exportToExcel)
```

### **VerteilerCanvas** (components/verteiler/VerteilerCanvas.tsx)
```
Verantwortlichkeiten:
- Container für alle Hutschienen
- Layout der Schaltplan-Ansicht
- Koordinaten-System für Verdrahtung

Interaktionen:
← useStore (verteiler.hutschienen)
→ Hutschiene (für jede Reihe)
→ WiringOverlay (Draht-SVG)
```

### **Hutschiene** (components/verteiler/Hutschiene.tsx)
```
Verantwortlichkeiten:
- Darstellung einer einzelnen Hutschiene
- Slots-Layout (Teilungseinheiten)
- Labels und Spacing

Interaktionen:
← verteiler.hutschienen[index]
→ ComponentSlot (für jeden Slot)
```

### **ComponentSlot** (components/verteiler/ComponentSlot.tsx)
```
Verantwortlichkeiten:
- Drop-Zone für Drag & Drop
- Erkennung von Slot-Belegung
- Drag-Feedback (Hover-Effekt)

React-DnD:
- useDrop mit type: 'COMPONENT'
- Prüfung auf Slot-Verfügbarkeit

Interaktionen:
← useStore (addComponent, moveComponent)
→ PlacedComponent (wenn belegt)
```

### **PlacedComponent** (components/verteiler/PlacedComponent.tsx)
```
Verantwortlichkeiten:
- Darstellung einer platzierten Komponente
- Terminal-Rendering für Verdrahtung
- Drag-Funktionalität (Verschieben)
- Drop-Zone für Verbraucher-Zuweisung
- Fehler-Highlighting

React-DnD:
- useDrag (Komponente verschieben)
- useDrop (Verbraucher zuweisen)

Interaktionen:
← useStore (komponenten, ui.selectedComponentId)
→ SchaltplanIcons (Icon-Darstellung)
→ terminals.ts (Terminal-Positionen)
← validation.ts (hasError, errorMessages)
```

### **WiringOverlay** (components/verteiler/WiringOverlay.tsx)
```
Verantwortlichkeiten:
- SVG-Layer für alle Drähte
- Live-Draht-Vorschau während Verdrahtung
- Waypoint-Rendering
- Click-Handler für Terminal-Verbindungen
- Snap-to-Grid Logik

Interaktionen:
← useStore (wires, ui.wiringMode, ui.wiringWaypoints)
← terminals.ts (Terminal-Koordinaten)
→ useStore (addWire, addWiringWaypoint)
← constants.ts (WIRE_GRID_X, WIRE_GRID_Y)
```

---

## 📚 Sidebar-Komponenten

### **Sidebar** (components/sidebar/Sidebar.tsx)
```
Verantwortlichkeiten:
- Tab-Navigation (Komponenten, Verbraucher, Prüfung)
- Conditional Rendering der Tab-Inhalte

Tabs:
1. 'komponenten' → ComponentLibrary + PropertyPanel
2. 'verbraucher' → VerbraucherPanel
3. 'pruefung' → ValidationPanel

Interaktionen:
← useStore (ui.activeTab)
→ useStore (setActiveTab)
```

### **ComponentLibrary** (components/sidebar/ComponentLibrary.tsx)
```
Verantwortlichkeiten:
- Darstellung aller verfügbaren Komponenten
- Kategorisierung (Schutz, Sicherung, Schaltung, Verteilung)
- Drag-Source für neue Komponenten

React-DnD:
- useDrag für jede Komponente
- item: { type: 'COMPONENT', componentType, variant }

Datenquelle:
← types/index.ts (COMPONENT_LIBRARY)

Interaktionen:
→ ComponentSlot (Drop-Target)
```

### **PropertyPanel** (components/sidebar/PropertyPanel.tsx)
```
Verantwortlichkeiten:
- Anzeige/Bearbeitung der Eigenschaften selektierter Komponenten
- Typ-spezifische Formularfelder
- Delete-Button

Interaktionen:
← useStore (selectedComponent, updateComponent, removeComponent)
→ useStore (setSelectedComponent)
```

### **WirePropertyPanel** (components/sidebar/WirePropertyPanel.tsx)
```
Verantwortlichkeiten:
- Anzeige/Bearbeitung selektierter Drähte
- Phase, Querschnitt, Waypoints
- Delete-Button

Interaktionen:
← useStore (selectedWire, updateWire, removeWire)
→ useStore (setSelectedWire)
```

### **VerbraucherPanel** (components/sidebar/VerbraucherPanel.tsx)
```
Verantwortlichkeiten:
- Liste aller Verbraucher (gruppiert nach Zuweisung)
- Hinzufügen neuer Verbraucher
- Bearbeiten (Leistung, GZF, Leitungsdaten, Verlegeart, Material)
- Drag-Source für Verbraucher-Zuweisung

React-DnD:
- useDrag mit type: 'verbraucher'

Interaktionen:
← useStore (verbraucher, addVerbraucher, updateVerbraucher)
→ PlacedComponent (Drop-Target für Zuweisung)
← circuitGraph.ts (detectPhaseForComponent)
← types/index.ts (VERBRAUCHER_DEFAULTS, VERLEGEART_BESCHREIBUNGEN)
```

### **ValidationPanel** (components/sidebar/ValidationPanel.tsx)
```
Verantwortlichkeiten:
- Validierungs-Button
- Fehler-/Warnungsliste (gruppiert nach Typ)
- Stromkreis-Analysen
- Berechnungen (Gesamtleistung, Strom)

Interaktionen:
← useStore (validationResult, runValidation)
→ useStore (setSelectedComponent - bei Fehler-Klick)
```

---

## 🔧 Utilities

### **types/index.ts** - Zentrale Typen
```
Exports:
- Phase, ComponentType, Netzsystem, LSCharakteristik, FITyp, ...
- Verlegeart, Leitermaterial
- BaseComponentParams + 12 Komponenten-Interfaces
- Verbraucher, Wire, ConnectionPoint, WireWaypoint
- UIState, ValidationError, ValidationResult, StromkreisResult
- COMPONENT_LIBRARY (20+ vordefinierte Komponenten)
- VERBRAUCHER_DEFAULTS, VERFUEGBARE_QUERSCHNITTE
- VERLEGEART_BESCHREIBUNGEN
- PHASE_COLORS

Verwendung:
← Von ALLEN Komponenten und Utils
```

### **utils/validation.ts** - Validierungs-Engine
```
Hauptfunktion: validateVerteiler(verteiler: Verteiler)

19 Validierungsschritte:
1. Doppelbelegungen
2. Überlast (Schutzeinrichtungen)
3. Selektivität
4. Spannungsfall
5. Schleifenimpedanz
6. Phasensymmetrie
7. Fehlende Verbindungen
8. Neutralleiter-Mehrfachspeisung
9. Verbraucher-Mehrfach-FI-Speisung
10. Schmelzsicherungen
11. Verbraucher-Schleifenimpedanz
12. Steckdosen-FI-Schutz (30mA)
13. FI-Selektivität
14. Erste Sicherung > Versorgungsnennstrom
15. Erdung (PE) für Verbraucher
16. Kurzschluss-Verbindungen
17. Drehfeld (Phasenzuordnung)
18. Verbraucher-Überstrom
19. Kabelbelastbarkeit (NEU!)

ÖVE-Konstanten:
- MAX_SPANNUNGSFALL_PROZENT: 4%
- RHO_KUPFER: 0.0178 Ω·mm²/m
- RHO_ALUMINIUM: 0.0286 Ω·mm²/m
- KABEL_BELASTBARKEIT (aus kabel_belastbarkeit.json)

Hilfsfunktionen:
- berechneVerbraucherStrom() - I = P / (√3 × U) für Drehstrom
- getStrombelastbarkeit() - Lookup in ÖVE-Tabelle
- checkKabelbelastbarkeit() - Schaltstromregel-Prüfung

Interaktionen:
← useStore (runValidation)
→ circuitGraph.ts (für Netzwerk-Analyse)
← types/index.ts (alle Typen)
```

### **utils/circuitGraph.ts** - Netzwerk-Topologie
```
Graphen-Modell:
- Knoten = Klemmen/Terminals
- Kanten = Wire-Objekte (externe Verbindungen) + interne Durchgänge

Hauptfunktionen:
1. findAllCircuitPaths() - Alle Pfade von Versorgung zu Verbrauchern
2. findPathToVersorgung() - Einzelner Pfad zur Versorgung
3. findSeriesComponents() - Alle Komponenten im Pfad
4. findSeriesFIs() - FI-Schalter im Pfad
5. findSeriesProtection() - Schutzeinrichtungen im Pfad
6. detectPhaseForComponent() - Phase-Erkennung via Pfadverfolgung
7. hasConnectionToPE() - PE-Verbindung prüfen
8. detectKurzschluss() - Kurzschlüsse erkennen
9. checkDrehfeldForComponent() - Drehfeld-Prüfung
10. analyzeSelectivity() - Selektivitäts-Analyse
11. updateWireCurrentsInVerteiler() - Strom-Berechnung pro Draht

Algorithmen:
- BFS (Breadth-First Search) für Tiefenberechnung
- DFS (Depth-First Search) für Pfadverfolgung
- Graphen-Traversierung für Topologie-Analyse

Interaktionen:
← validation.ts (alle Netzwerk-Prüfungen)
← useStore (updateWireCurrentsInVerteiler)
← VerbraucherPanel (detectPhaseForComponent)
```

### **utils/export.ts** - Export-Funktionen
```
Funktionen:
1. exportToPDF(verteiler: Verteiler)
   - jsPDF Library
   - Dokumentation + Komponentenliste
   - Schaltplan als Bild (html2canvas)

2. exportToExcel(verteiler: Verteiler)
   - XLSX Library
   - Komponentenliste
   - Verdrahtungs-Dokumentation

Interaktionen:
← Header (Export-Buttons)
```

### **utils/terminals.ts** - Terminal-Positionen
```
Funktion: getTerminalsForComponent(component)

Returns: Array von { id, x, y, phase, type }

Berechnet für jeden Komponententyp:
- Anzahl und Position der Terminals
- IN/OUT Terminals
- Phase-Zuordnung (L1, L2, L3, N, PE)
- Relative Koordinaten zur Komponente

Verwendung:
← PlacedComponent (Rendering)
← WiringOverlay (Verbindungspunkte)
```

### **utils/constants.ts** - UI-Konstanten
```
Exports:
- TE_WIDTH: 18 (1 Teilungseinheit in Pixel)
- RAIL_HEIGHT: 60 (Höhe einer Hutschiene)
- COMPONENT_HEIGHT: 50 (Standard-Komponentenhöhe)
- WIRE_GRID_X: 6 (Snap-Raster für Drähte horizontal)
- WIRE_GRID_Y: 10 (Snap-Raster für Drähte vertikal)

Verwendung:
← VerteilerCanvas (Layout-Berechnung)
← WiringOverlay (Snap-to-Grid)
← PlacedComponent (Positionierung)
```

---

## 🔄 Datenfluss

### 1. **Komponente hinzufügen**
```
ComponentLibrary (useDrag)
  → Drag-Start
    → ComponentSlot (useDrop)
      → Drop-Event
        → useStore.addComponent(component)
          → verteiler.komponenten.push(newComponent)
            → Re-render: PlacedComponent erscheint
```

### 2. **Verdrahtung erstellen**
```
Header (Verdrahten-Button)
  → useStore.setWiringMode(true)
    → WiringOverlay aktiviert
      → Klick auf Start-Terminal
        → useStore.setWiringStart(terminal)
          → Live-Vorschau (Maus-Position)
            → Waypoints hinzufügen (optional)
              → Klick auf Ziel-Terminal
                → useStore.addWire(wire)
                  → verteiler.verbindungen.push(wire)
                    → Re-render: Draht erscheint
```

### 3. **Verbraucher zuweisen**
```
VerbraucherPanel (useDrag verbraucher)
  → Drag-Start
    → PlacedComponent (useDrop auf Abgangsklemme)
      → Drop-Event + Validierung (Phasen-Matching)
        → useStore.assignVerbraucherToComponent(id, componentId)
          → verbraucher.zugewieseneKomponente = componentId
            → Re-render: Verbraucher-Symbol unter Klemme
```

### 4. **Validierung durchführen**
```
ValidationPanel (Prüfen-Button)
  → useStore.runValidation()
    → validation.ts: validateVerteiler(verteiler)
      → 19 Validierungsschritte
        → circuitGraph.ts (Netzwerk-Analyse)
          → Fehler/Warnungen sammeln
            → ValidationResult zurück
              → useStore.validationResult = result
                → Re-render: ValidationPanel zeigt Ergebnisse
                  → PlacedComponent: hasError = true (rot markiert)
```

### 5. **Projekt speichern**
```
Header (Speichern-Button)
  → Erstelle ProjectFile { version, timestamp, verteiler }
    → JSON.stringify()
      → Blob + Download-Link
        → .eplan Datei
```

### 6. **Projekt laden**
```
Header (Öffnen-Button)
  → FileReader.readAsText()
    → JSON.parse()
      → Validierung der Struktur
        → useStore.loadProject({ verteiler })
          → Migration (verlegeart, leitermaterial defaults)
            → State ersetzt
              → Vollständiger Re-render
```

---

## 🎯 React-DnD Integration

### Drag-Sources
```
ComponentLibrary → COMPONENT
  - Neue Komponenten aus Bibliothek

PlacedComponent → COMPONENT
  - Bestehende Komponenten verschieben

VerbraucherPanel → verbraucher
  - Verbraucher zuweisen
```

### Drop-Targets
```
ComponentSlot → COMPONENT
  - Komponenten platzieren/verschieben

PlacedComponent → verbraucher
  - Verbraucher-Zuweisung (nur bei Abgangsklemmen)
```

---

## 📊 Zustand-Persistierung

### LocalStorage Schema
```json
{
  "elektro-planer-storage": {
    "state": {
      "verteiler": {
        "id": "uuid",
        "name": "...",
        "hutschienen": [...],
        "komponenten": [...],
        "verbraucher": [...],
        "verbindungen": [...]
      }
    },
    "version": 0
  }
}
```

**Was wird gespeichert:**
- ✅ verteiler (vollständig)

**Was wird NICHT gespeichert:**
- ❌ ui (wird zurückgesetzt)
- ❌ validationResult (wird neu berechnet)

---

## 🔍 Debugging-Tipps

### State inspizieren
```typescript
// In beliebiger Komponente
const state = useStore();
console.log('Full State:', state);
```

### Zustand DevTools
```
Chrome Extension: Zustand DevTools
→ Zeigt alle State-Änderungen
→ Time-Travel Debugging
```

### Validierung testen
```typescript
// In Browser Console
import { validateVerteiler } from './utils/validation';
const result = validateVerteiler(useStore.getState().verteiler);
console.log(result);
```

### Netzwerk-Graphen visualisieren
```typescript
import { findAllCircuitPaths } from './utils/circuitGraph';
const paths = findAllCircuitPaths(verteiler);
console.log('Circuit Paths:', paths);
```

---

## 🚀 Performance-Überlegungen

### Optimierungen
1. **Zustand Subscription**: Komponenten abonnieren nur benötigte State-Teile
2. **React.memo**: Verhindert unnötige Re-renders (bisher nicht implementiert)
3. **SVG-Rendering**: WiringOverlay rendert alle Drähte in einem SVG
4. **LocalStorage**: Nur `verteiler` wird persistiert, nicht UI-State

### Potenzielle Bottlenecks
1. **Große Verteilerprojekte**: Viele Komponenten + Drähte
2. **Validierung**: 19 Checks bei jedem Aufruf
3. **Graphen-Algorithmen**: BFS/DFS bei komplexen Netzwerken

---

## 📝 Entwicklungs-Workflow

### 1. Neue Komponente hinzufügen
```
1. types/index.ts → Neues Interface + COMPONENT_LIBRARY
2. SchaltplanIcons.tsx → Icon hinzufügen
3. terminals.ts → Terminal-Positionen definieren
4. validation.ts → Validierungslogik (optional)
```

### 2. Neue Validierung hinzufügen
```
1. types/index.ts → Neuer FehlerTyp
2. validation.ts → check-Funktion schreiben
3. validateVerteiler() → Funktion aufrufen
4. ValidationPanel.tsx → Fehler-Darstellung (automatisch)
```

### 3. Neue UI-Funktion
```
1. useStore.ts → State + Action hinzufügen
2. Komponente → useStore Hook + Rendering
3. Keyboard/Mouse Handler (optional)
```

---

## 🎓 Zusammenfassung

### Haupt-Datenfluss
```
User-Aktion
  ↓
Komponente (Event-Handler)
  ↓
useStore (Action)
  ↓
State-Mutation
  ↓
Re-render (automatisch)
  ↓
UI-Update
```

### Validierungs-Pipeline
```
runValidation()
  ↓
validateVerteiler()
  ↓
19 × check-Funktionen
  ↓
circuitGraph.ts (Netzwerk-Analyse)
  ↓
ValidationResult
  ↓
UI-Feedback (Fehler-Markierungen)
```

### Schlüssel-Prinzipien
1. **Single Source of Truth**: useStore als zentrale State-Verwaltung
2. **Unidirektionaler Datenfluss**: Actions → State → UI
3. **Type Safety**: Strikte TypeScript-Typisierung überall
4. **ÖVE-Konformität**: Alle Validierungen nach ÖVE-Normen
5. **Modularität**: Klare Trennung von Verantwortlichkeiten

---

**Stand:** 2026-02-07
**Version:** 1.0
**Autor:** Claude Sonnet 4.5
