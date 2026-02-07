/**
 * Circuit Graph - Verdrahtungs-Baumstruktur (KLEMMEN-BASIERT)
 *
 * Diese Datei enthält die Logik zur Analyse der Verdrahtungsstruktur
 * als Baumstruktur mit der Versorgungsklemme als Wurzel.
 *
 * WICHTIG: Der Graph arbeitet auf KLEMMEN-EBENE, nicht auf Komponenten-Ebene!
 *
 * Kernkonzepte:
 * - KNOTEN = Klemmen (Terminals) wie "LS1:IN_L1", "LS1:OUT_L1"
 * - KANTEN = Zwei Arten von Verbindungen:
 *   1. EXTERNE Verbindungen (Wire-Objekte) - verbinden Klemmen verschiedener Komponenten
 *   2. INTERNE Verbindungen (Komponenten-Durchgang) - verbinden IN mit OUT derselben Komponente
 *
 * Vorteile:
 * - Drahtbrücken von einer Eingangsklemme zu einer anderen werden korrekt erkannt
 * - Zwei LS mit verbügelten Eingängen werden als PARALLEL erkannt (gleicher Parent-Knoten)
 * - Bidirektional: Komponenten können von oben oder unten angespeist werden
 *
 * Selektivität:
 * - Nur Komponenten die WIRKLICH in Serie sind (auf dem Parent-Pfad) werden verglichen
 * - Parallele Komponenten (nach einer Verzweigung) werden NICHT verglichen
 */

import type {
  Verteiler,
  ElektroComponent,
  Wire,
  Phase,
  FISchalterParams,
  FILSKombiParams,
  LSSchalterParams,
} from '../types';

// ==========================================
// TYPEN FÜR DIE GRAPHEN-ANALYSE
// ==========================================

/**
 * Ein Knoten im Verdrahtungsgraphen
 */
export interface CircuitNode {
  componentId: string;
  component: ElektroComponent;
  // Alle eingehenden Verbindungen (von der Versorgung aus gesehen)
  incomingWires: Wire[];
  // Alle ausgehenden Verbindungen (zu den Abgängen hin)
  outgoingWires: Wire[];
  // Tiefe im Baum (0 = Versorgung)
  depth: number;
}

/**
 * Ein Pfad von der Versorgung zu einem Abgang
 * Die Komponenten sind in der Reihenfolge von der Versorgung zum Abgang sortiert
 */
export interface CircuitPath {
  // ID des Pfads (basierend auf der Abgangsklemme)
  id: string;
  // Alle Komponenten auf diesem Pfad, sortiert von Versorgung zu Abgang
  components: ElektroComponent[];
  // Die zugehörigen Verbindungen auf diesem Pfad
  wires: Wire[];
  // Die Abgangsklemme (Endpunkt des Pfads)
  endComponent: ElektroComponent;
  // Die Phase(n) dieses Pfads
  phases: Phase[];
}

/**
 * Ergebnis der Selektivitätsprüfung auf einem Pfad
 */
export interface SelectivityResult {
  pathId: string;
  isSelective: boolean;
  violations: SelectivityViolation[];
}

export interface SelectivityViolation {
  upstreamComponent: ElektroComponent;    // Vorgelagerte Komponente (näher an Versorgung)
  downstreamComponent: ElektroComponent;  // Nachgelagerte Komponente (näher am Abgang)
  type: 'fi' | 'ls' | 'fuse';
  reason: string;
  severity: 'error' | 'warning';
}

// ==========================================
// HAUPTFUNKTION: Baue Graphenstruktur auf
// ==========================================

/**
 * Baut die Graphenstruktur des Verteilers auf.
 * Die Versorgungsklemme ist die Wurzel.
 * Verbindungen werden bidirektional verfolgt (oben/unten spielt keine Rolle).
 */
export function buildCircuitGraph(verteiler: Verteiler): Map<string, CircuitNode> {
  const nodeMap = new Map<string, CircuitNode>();

  // Initialisiere alle Komponenten als Knoten
  for (const component of verteiler.komponenten) {
    nodeMap.set(component.id, {
      componentId: component.id,
      component,
      incomingWires: [],
      outgoingWires: [],
      depth: -1, // Noch nicht berechnet
    });
  }

  // Finde Versorgungsklemme
  const versorgung = verteiler.komponenten.find(k => k.type === 'versorgungsklemme');
  if (!versorgung) {
    return nodeMap;
  }

  // Berechne Tiefe für jeden Knoten mittels BFS von der Versorgung aus
  const queue: { id: string; depth: number; fromWire?: Wire }[] = [{ id: versorgung.id, depth: 0 }];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (visited.has(current.id)) continue;
    visited.add(current.id);

    const node = nodeMap.get(current.id);
    if (!node) continue;

    node.depth = current.depth;

    // Finde alle Verbindungen dieser Komponente (bidirektional)
    const connectedWires = verteiler.verbindungen.filter(w =>
      w.von.componentId === current.id || w.nach.componentId === current.id
    );

    for (const wire of connectedWires) {
      const neighborId = wire.von.componentId === current.id
        ? wire.nach.componentId
        : wire.von.componentId;

      if (!visited.has(neighborId)) {
        // Diese Verbindung führt "weg" von der Versorgung (ausgehend)
        node.outgoingWires.push(wire);

        const neighborNode = nodeMap.get(neighborId);
        if (neighborNode) {
          // Die umgekehrte Richtung ist "eingehend" für den Nachbarn
          neighborNode.incomingWires.push(wire);
        }

        queue.push({ id: neighborId, depth: current.depth + 1, fromWire: wire });
      }
    }
  }

  return nodeMap;
}

// ==========================================
// PFAD-FUNKTIONEN
// ==========================================

/**
 * Findet ALLE Pfade von der Versorgungsklemme zu den Abgangsklemmen.
 * Jeder Pfad repräsentiert einen Stromkreis.
 *
 * WICHTIG: Als Endpunkte gelten nur ABGANGSKLEMMEN, nicht LS-Schalter!
 * LS-Schalter sind Durchgangs-Komponenten auf dem Pfad, keine Endpunkte.
 */
export function findAllCircuitPaths(verteiler: Verteiler): CircuitPath[] {
  const paths: CircuitPath[] = [];

  // Finde Versorgungsklemme
  const versorgung = verteiler.komponenten.find(k => k.type === 'versorgungsklemme');
  if (!versorgung) return paths;

  // Finde alle Abgangsklemmen - NUR diese sind echte Endpunkte!
  const abgangsklemmen = verteiler.komponenten.filter(k => k.type === 'abgangsklemme');

  // Für jede Abgangsklemme, finde den Pfad zur Versorgung
  for (const endpunkt of abgangsklemmen) {
    const pathResult = findPathToVersorgung(verteiler, endpunkt.id, versorgung.id);

    if (pathResult) {
      // Pfad gefunden - von Versorgung zu Endpunkt sortieren
      const components = pathResult.components.reverse();
      const wires = pathResult.wires.reverse();

      // Sammle alle Phasen auf dem Pfad
      const phases = new Set<Phase>();
      for (const wire of wires) {
        phases.add(wire.phase);
      }

      paths.push({
        id: endpunkt.id,
        components,
        wires,
        endComponent: endpunkt,
        phases: Array.from(phases),
      });
    }
  }

  return paths;
}

/**
 * Findet einen Pfad von einer Komponente zur Versorgungsklemme.
 * Arbeitet bidirektional - folgt allen Verbindungen unabhängig von der Richtung.
 *
 * Rückgabe: Pfad von der Startkomponente zur Versorgung (nicht umgekehrt!)
 */
export function findPathToVersorgung(
  verteiler: Verteiler,
  startId: string,
  versorgungId: string
): { components: ElektroComponent[]; wires: Wire[] } | null {

  // BFS mit Pfad-Tracking
  const queue: {
    currentId: string;
    path: ElektroComponent[];
    wires: Wire[];
    visitedWires: Set<string>;
  }[] = [];

  const startComponent = verteiler.komponenten.find(k => k.id === startId);
  if (!startComponent) return null;

  queue.push({
    currentId: startId,
    path: [startComponent],
    wires: [],
    visitedWires: new Set()
  });

  const visitedComponents = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current.currentId === versorgungId) {
      // Pfad gefunden!
      return { components: current.path, wires: current.wires };
    }

    if (visitedComponents.has(current.currentId)) continue;
    visitedComponents.add(current.currentId);

    // Finde alle Verbindungen dieser Komponente (bidirektional)
    const connectedWires = verteiler.verbindungen.filter(w =>
      (w.von.componentId === current.currentId || w.nach.componentId === current.currentId) &&
      !current.visitedWires.has(w.id)
    );

    for (const wire of connectedWires) {
      const neighborId = wire.von.componentId === current.currentId
        ? wire.nach.componentId
        : wire.von.componentId;

      if (!visitedComponents.has(neighborId)) {
        const neighborComponent = verteiler.komponenten.find(k => k.id === neighborId);
        if (neighborComponent) {
          const newVisitedWires = new Set(current.visitedWires);
          newVisitedWires.add(wire.id);

          queue.push({
            currentId: neighborId,
            path: [...current.path, neighborComponent],
            wires: [...current.wires, wire],
            visitedWires: newVisitedWires
          });
        }
      }
    }
  }

  return null; // Kein Pfad gefunden
}

/**
 * Findet alle Pfade von einer Komponente zur Versorgung.
 * Im Gegensatz zu findPathToVersorgung findet diese Funktion ALLE möglichen Pfade,
 * nicht nur einen.
 */
export function findAllPathsToVersorgung(
  verteiler: Verteiler,
  startId: string,
  versorgungId: string
): { components: ElektroComponent[]; wires: Wire[] }[] {
  const allPaths: { components: ElektroComponent[]; wires: Wire[] }[] = [];

  const startComponent = verteiler.komponenten.find(k => k.id === startId);
  if (!startComponent) return allPaths;

  // DFS mit Pfad-Tracking für alle Pfade
  function dfs(
    currentId: string,
    path: ElektroComponent[],
    wires: Wire[],
    visitedComponents: Set<string>,
    visitedWires: Set<string>
  ): void {
    if (currentId === versorgungId) {
      // Pfad gefunden!
      allPaths.push({ components: [...path], wires: [...wires] });
      return;
    }

    // Finde alle Verbindungen dieser Komponente (bidirektional)
    const connectedWires = verteiler.verbindungen.filter(w =>
      (w.von.componentId === currentId || w.nach.componentId === currentId) &&
      !visitedWires.has(w.id)
    );

    for (const wire of connectedWires) {
      const neighborId = wire.von.componentId === currentId
        ? wire.nach.componentId
        : wire.von.componentId;

      if (!visitedComponents.has(neighborId)) {
        const neighborComponent = verteiler.komponenten.find(k => k.id === neighborId);
        if (neighborComponent) {
          visitedComponents.add(neighborId);
          visitedWires.add(wire.id);

          dfs(
            neighborId,
            [...path, neighborComponent],
            [...wires, wire],
            visitedComponents,
            visitedWires
          );

          visitedComponents.delete(neighborId);
          visitedWires.delete(wire.id);
        }
      }
    }
  }

  const initialVisited = new Set<string>([startId]);
  dfs(startId, [startComponent], [], initialVisited, new Set());

  return allPaths;
}

// ==========================================
// SELEKTIVITÄTSPRÜFUNG AUF PFADEN
// ==========================================

/**
 * Prüft die Selektivität für alle Komponenten auf einem Pfad.
 * Nur Komponenten die auf demselben Pfad (in Serie) sind werden geprüft.
 */
export function checkPathSelectivity(path: CircuitPath): SelectivityResult {
  const violations: SelectivityViolation[] = [];

  // Extrahiere alle Schutzeinrichtungen auf dem Pfad
  const schutzeinrichtungen = path.components.filter(c =>
    c.type === 'fi-schalter' || c.type === 'fi-ls-kombi' ||
    c.type === 'ls-schalter' || c.type === 'nh-sicherung' ||
    c.type === 'neozed-sicherung' || c.type === 'schraub-sicherung'
  );

  // Prüfe FI-Selektivität
  const fiViolations = checkFISelectivityOnPath(schutzeinrichtungen);
  violations.push(...fiViolations);

  // Prüfe LS-Selektivität
  const lsViolations = checkLSSelectivityOnPath(schutzeinrichtungen);
  violations.push(...lsViolations);

  return {
    pathId: path.id,
    isSelective: violations.filter(v => v.severity === 'error').length === 0,
    violations
  };
}

/**
 * Prüft FI-Selektivität auf einem Pfad.
 * Die Reihenfolge muss von Standard → G → S sein (von Abgang zur Versorgung).
 */
function checkFISelectivityOnPath(schutzeinrichtungen: ElektroComponent[]): SelectivityViolation[] {
  const violations: SelectivityViolation[] = [];

  // Finde alle FI-Schalter und FI/LS-Kombis
  const fiSchalter = schutzeinrichtungen.filter(s =>
    s.type === 'fi-schalter' || s.type === 'fi-ls-kombi'
  ) as (FISchalterParams | FILSKombiParams)[];

  if (fiSchalter.length < 2) return violations;

  // Verzögerungshierarchie: Standard < G < S
  const verzögerungsHierarchie: Record<string, number> = {
    'Standard': 0,
    'G': 1,
    'S': 2
  };

  // Die Liste ist bereits sortiert von Versorgung zu Abgang
  // Also muss die Verzögerung von vorne (Versorgung) nach hinten (Abgang) abnehmen
  // d.h. S → G → Standard

  for (let i = 0; i < fiSchalter.length - 1; i++) {
    const upstream = fiSchalter[i];     // Näher an Versorgung
    const downstream = fiSchalter[i + 1]; // Näher am Abgang

    const upstreamDelay = verzögerungsHierarchie[upstream.verzoegerung] ?? 0;
    const downstreamDelay = verzögerungsHierarchie[downstream.verzoegerung] ?? 0;

    // Vorgelagerter FI muss HÖHERE Verzögerung haben als nachgelagerter
    if (upstreamDelay < downstreamDelay) {
      violations.push({
        upstreamComponent: upstream,
        downstreamComponent: downstream,
        type: 'fi',
        reason: `FI-Selektivität nicht gewährleistet: ${upstream.name} (${upstream.verzoegerung}) ist weniger verzögert als ${downstream.name} (${downstream.verzoegerung}). Reihenfolge muss S → G → Standard sein (von Versorgung zu Abgang).`,
        severity: 'error'
      });
    } else if (upstreamDelay === downstreamDelay) {
      violations.push({
        upstreamComponent: upstream,
        downstreamComponent: downstream,
        type: 'fi',
        reason: `FI-Selektivität fraglich: ${upstream.name} und ${downstream.name} haben beide Verzögerung "${upstream.verzoegerung}". Keine zuverlässige Selektivität möglich.`,
        severity: 'warning'
      });
    }

    // Prüfe auch Fehlerstrom-Selektivität: Vorgelagerter FI sollte höheren Fehlerstrom haben
    if (upstream.bemessungsFehlerstrom <= downstream.bemessungsFehlerstrom) {
      violations.push({
        upstreamComponent: upstream,
        downstreamComponent: downstream,
        type: 'fi',
        reason: `FI-Fehlerstrom-Selektivität nicht optimal: ${upstream.name} (${upstream.bemessungsFehlerstrom}mA) sollte höheren Bemessungsfehlerstrom haben als ${downstream.name} (${downstream.bemessungsFehlerstrom}mA).`,
        severity: 'warning'
      });
    }
  }

  return violations;
}

/**
 * Prüft LS-Selektivität auf einem Pfad.
 * Die vorgelagerte Sicherung muss mindestens das 1.6-fache des nachgelagerten haben.
 *
 * WICHTIG: Vergleicht nur DIREKT BENACHBARTE Schutzeinrichtungen auf dem Pfad,
 * d.h. zwischen ihnen darf nur eine Verteilkomponente (Sammelschiene, Klemme) liegen.
 * Zwei Schutzeinrichtungen die über eine Verzweigung verbunden sind, werden NICHT verglichen.
 */
function checkLSSelectivityOnPath(schutzeinrichtungen: ElektroComponent[]): SelectivityViolation[] {
  const violations: SelectivityViolation[] = [];

  // Finde alle LS-Schalter, FI/LS-Kombis und Sicherungen
  const lsSchalter = schutzeinrichtungen.filter(s =>
    s.type === 'ls-schalter' || s.type === 'fi-ls-kombi' ||
    s.type === 'nh-sicherung' || s.type === 'neozed-sicherung' || s.type === 'schraub-sicherung'
  );

  if (lsSchalter.length < 2) return violations;

  // Die Liste ist bereits sortiert von Versorgung zu Abgang
  // Wir vergleichen nur direkt aufeinanderfolgende Schutzeinrichtungen
  for (let i = 0; i < lsSchalter.length - 1; i++) {
    const upstream = lsSchalter[i];     // Näher an Versorgung
    const downstream = lsSchalter[i + 1]; // Näher am Abgang

    // Prüfe ob zwischen upstream und downstream nur Verteilkomponenten liegen
    // Wenn eine andere Schutzeinrichtung dazwischen liegt, sind sie nicht direkt in Serie
    const upstreamIndex = schutzeinrichtungen.findIndex(s => s.id === upstream.id);
    const downstreamIndex = schutzeinrichtungen.findIndex(s => s.id === downstream.id);

    // Prüfe ob eine andere Schutzeinrichtung dazwischen liegt
    let hasOtherProtectionBetween = false;
    for (let j = upstreamIndex + 1; j < downstreamIndex; j++) {
      const between = schutzeinrichtungen[j];
      if (between.type === 'ls-schalter' || between.type === 'fi-ls-kombi' ||
          between.type === 'nh-sicherung' || between.type === 'neozed-sicherung' ||
          between.type === 'schraub-sicherung' || between.type === 'fi-schalter') {
        hasOtherProtectionBetween = true;
        break;
      }
    }

    // Wenn eine andere Schutzeinrichtung dazwischen liegt, überspringe dieses Paar
    if (hasOtherProtectionBetween) continue;

    const upstreamCurrent = getBemessungsStrom(upstream);
    const downstreamCurrent = getBemessungsStrom(downstream);

    if (upstreamCurrent === 0 || downstreamCurrent === 0) continue;

    // Selektivitätsfaktor: Vorgelagert >= 1.6 × Nachgelagert
    const faktor = upstreamCurrent / downstreamCurrent;

    if (faktor < 1.6) {
      violations.push({
        upstreamComponent: upstream,
        downstreamComponent: downstream,
        type: 'ls',
        reason: `LS-Selektivität nicht gewährleistet: ${upstream.name} (${upstreamCurrent}A) / ${downstream.name} (${downstreamCurrent}A) = ${faktor.toFixed(2)} < 1.6. Vorgelagerte Sicherung sollte mindestens ${Math.ceil(downstreamCurrent * 1.6)}A haben.`,
        severity: faktor < 1.0 ? 'error' : 'warning'
      });
    }
  }

  return violations;
}

/**
 * Hilfsfunktion: Holt den Bemessungsstrom einer Komponente
 */
function getBemessungsStrom(component: ElektroComponent): number {
  switch (component.type) {
    case 'ls-schalter':
      return (component as LSSchalterParams).bemessungsStrom;
    case 'fi-ls-kombi':
      return (component as FILSKombiParams).bemessungsStrom;
    case 'fi-schalter':
      return (component as FISchalterParams).bemessungsStrom;
    case 'nh-sicherung':
    case 'neozed-sicherung':
    case 'schraub-sicherung':
      return (component as any).bemessungsStrom || 0;
    default:
      return 0;
  }
}

// ==========================================
// HILFSFUNKTIONEN FÜR SERIEN-/PARALLEL-ERKENNUNG
// ==========================================

/**
 * Prüft ob zwei Komponenten in Serie geschaltet sind.
 * Zwei Komponenten sind in Serie, wenn sie auf ALLEN Pfaden zur Versorgung
 * gemeinsam vorkommen (eine liegt immer auf dem Weg der anderen zur Versorgung).
 */
export function areInSeries(
  verteiler: Verteiler,
  componentA: string,
  componentB: string
): boolean {
  const versorgung = verteiler.komponenten.find(k => k.type === 'versorgungsklemme');
  if (!versorgung) return false;

  // Finde alle Pfade von A zur Versorgung
  const pathsA = findAllPathsToVersorgung(verteiler, componentA, versorgung.id);

  // Finde alle Pfade von B zur Versorgung
  const pathsB = findAllPathsToVersorgung(verteiler, componentB, versorgung.id);

  // Prüfe ob B auf ALLEN Pfaden von A vorkommt
  const bOnAllPathsOfA = pathsA.every(path =>
    path.components.some(c => c.id === componentB)
  );

  // Prüfe ob A auf ALLEN Pfaden von B vorkommt
  const aOnAllPathsOfB = pathsB.every(path =>
    path.components.some(c => c.id === componentA)
  );

  // Wenn A auf allen Pfaden von B liegt ODER B auf allen Pfaden von A liegt → Serie
  return bOnAllPathsOfA || aOnAllPathsOfB;
}

/**
 * Prüft ob zwei Komponenten parallel geschaltet sind.
 * Zwei Komponenten sind parallel, wenn sie auf verschiedenen Pfaden liegen
 * (nach einer Verzweigung).
 */
export function areInParallel(
  verteiler: Verteiler,
  componentA: string,
  componentB: string
): boolean {
  // Wenn sie nicht in Serie sind und beide mit der Versorgung verbunden sind → Parallel
  if (areInSeries(verteiler, componentA, componentB)) return false;

  const versorgung = verteiler.komponenten.find(k => k.type === 'versorgungsklemme');
  if (!versorgung) return false;

  // Prüfe ob beide zur Versorgung verbunden sind
  const pathsA = findAllPathsToVersorgung(verteiler, componentA, versorgung.id);
  const pathsB = findAllPathsToVersorgung(verteiler, componentB, versorgung.id);

  return pathsA.length > 0 && pathsB.length > 0;
}

// ==========================================
// KLEMMEN-BASIERTER GRAPH (NEU)
// ==========================================

/**
 * Erzeugt eine eindeutige Terminal-ID aus Komponenten-ID und Terminal-Name
 */
function getTerminalId(componentId: string, terminal: string): string {
  return `${componentId}:${terminal}`;
}

/**
 * Parst eine Terminal-ID zurück in Komponenten-ID und Terminal-Name
 */
function parseTerminalId(terminalId: string): { componentId: string; terminal: string } {
  const lastColon = terminalId.lastIndexOf(':');
  return {
    componentId: terminalId.substring(0, lastColon),
    terminal: terminalId.substring(lastColon + 1)
  };
}

/**
 * Ermittelt die internen Terminal-Verbindungen einer Komponente.
 * Jede Komponente verbindet intern ihre Eingänge mit ihren Ausgängen.
 *
 * Beispiel: Ein LS-Schalter verbindet IN_L1 ↔ OUT_L1
 * Diese Verbindung ist bidirektional (Strom kann von oben oder unten kommen).
 *
 * WICHTIG: Bei Klemmen und Sammelschienen sind ALLE Terminals untereinander
 * verbunden (Verteilpunkte). Das ermöglicht die korrekte Erkennung von
 * Drahtbrücken und parallelen Abzweigungen.
 */
function getInternalTerminalConnections(component: ElektroComponent): { from: string; to: string }[] {
  const connections: { from: string; to: string }[] = [];

  // Basierend auf dem Komponententyp die internen Verbindungen ermitteln
  switch (component.type) {
    case 'ls-schalter': {
      const ls = component as LSSchalterParams;
      // Für jede Phase: IN ↔ OUT verbinden
      if (ls.polzahl >= 1) connections.push({ from: 'IN_L1', to: 'OUT_L1' });
      if (ls.polzahl === 2) {
        // 2-polig: L1 + N
        connections.push({ from: 'IN_N', to: 'OUT_N' });
      } else if (ls.polzahl >= 3) {
        // 3/4-polig: L1, L2, L3 (und optional N)
        connections.push({ from: 'IN_L2', to: 'OUT_L2' });
        connections.push({ from: 'IN_L3', to: 'OUT_L3' });
        if (ls.polzahl >= 4) connections.push({ from: 'IN_N', to: 'OUT_N' });
      }
      break;
    }
    case 'fi-schalter': {
      const fi = component as FISchalterParams;
      if (fi.polzahl === 2) {
        connections.push({ from: 'IN_L1', to: 'OUT_L1' });
        connections.push({ from: 'IN_N', to: 'OUT_N' });
      } else if (fi.polzahl === 4) {
        connections.push({ from: 'IN_L1', to: 'OUT_L1' });
        connections.push({ from: 'IN_L2', to: 'OUT_L2' });
        connections.push({ from: 'IN_L3', to: 'OUT_L3' });
        connections.push({ from: 'IN_N', to: 'OUT_N' });
      }
      break;
    }
    case 'fi-ls-kombi': {
      const fils = component as FILSKombiParams;
      // FI/LS-Kombi: IN → OUT für jede verwendete Phase
      connections.push({ from: 'IN_L1', to: 'OUT_L1' });
      connections.push({ from: 'IN_N', to: 'OUT_N' }); // Immer N (auch bei 1P+N)
      if (fils.polzahl >= 3) {
        connections.push({ from: 'IN_L2', to: 'OUT_L2' });
        connections.push({ from: 'IN_L3', to: 'OUT_L3' });
      }
      break;
    }
    case 'nh-sicherung':
      // NH-Sicherung: 3-polig (L1, L2, L3)
      connections.push({ from: 'IN_L1', to: 'OUT_L1' });
      connections.push({ from: 'IN_L2', to: 'OUT_L2' });
      connections.push({ from: 'IN_L3', to: 'OUT_L3' });
      break;
    case 'neozed-sicherung': {
      // Neozed: 1-polig oder 3-polig
      const polzahl = (component as any).polzahl || 1;
      connections.push({ from: 'IN_L1', to: 'OUT_L1' });
      if (polzahl >= 3) {
        connections.push({ from: 'IN_L2', to: 'OUT_L2' });
        connections.push({ from: 'IN_L3', to: 'OUT_L3' });
      }
      break;
    }
    case 'schraub-sicherung':
      // Schraub-Sicherung: 1-polig
      connections.push({ from: 'IN_L1', to: 'OUT_L1' });
      break;
    case 'sammelschiene': {
      // Sammelschiene: ALLE Terminals sind untereinander verbunden!
      // Terminals: TOP_0, TOP_1, ..., BOT_0, BOT_1, ...
      // Jedes Terminal muss mit jedem anderen verbunden sein (Vollvermaschung)
      const teBreite = component.teilungseinheiten || 2;
      // WICHTIG: Gleiche Berechnung wie in terminals.ts!
      // Bei 2 TE: 3 Anschlüsse, sonst 1 pro 2 TE
      const anzahlAnschluesse = teBreite === 2 ? 3 : Math.max(1, Math.floor(teBreite / 2));
      const allTerminals: string[] = [];
      for (let i = 0; i < anzahlAnschluesse; i++) {
        allTerminals.push(`TOP_${i}`);
        allTerminals.push(`BOT_${i}`);
      }
      // Verbinde alle Terminals miteinander (Sternförmig zum ersten Terminal)
      // Das reicht für BFS - alle sind dann erreichbar
      for (let i = 1; i < allTerminals.length; i++) {
        connections.push({ from: allTerminals[0], to: allTerminals[i] });
      }
      break;
    }
    case 'klemme': {
      // Klemme: TOP_0 und BOT_0 sind untereinander verbunden (Durchgang)
      // Eine Klemme hat nur 1 Anschluss oben und 1 unten (siehe terminals.ts)
      connections.push({ from: 'TOP_0', to: 'BOT_0' });
      break;
    }
    case 'versorgungsklemme':
      // Versorgungsklemme: Alle OUT-Terminals sind der Ausgangspunkt
      // KEINE internen Verbindungen - jede Phase ist separat
      // (OUT_L1, OUT_L2, OUT_L3, OUT_N, OUT_PE sind die Startpunkte des BFS)
      break;
    case 'abgangsklemme': {
      // Abgangsklemme: IN ist verbunden mit OUT (Durchgang)
      // 3-polig: L1, N, PE oder 5-polig: L1, L2, L3, N, PE
      const polzahl = (component as any).polzahl || 3;
      connections.push({ from: 'IN_L1', to: 'OUT_L1' });
      connections.push({ from: 'IN_N', to: 'OUT_N' });
      connections.push({ from: 'IN_PE', to: 'OUT_PE' });
      if (polzahl === 5) {
        connections.push({ from: 'IN_L2', to: 'OUT_L2' });
        connections.push({ from: 'IN_L3', to: 'OUT_L3' });
      }
      break;
    }
    case 'zaehler': {
      // Zähler: IN ↔ OUT durchgeschleift
      // 1-phasig: L1, N | 3-phasig: L1, L2, L3, N
      const phasen = (component as any).phasen || 1;
      connections.push({ from: 'IN_L1', to: 'OUT_L1' });
      connections.push({ from: 'IN_N', to: 'OUT_N' });
      if (phasen === 3) {
        connections.push({ from: 'IN_L2', to: 'OUT_L2' });
        connections.push({ from: 'IN_L3', to: 'OUT_L3' });
      }
      break;
    }
    case 'schuetz': {
      // Schütz: IN ↔ OUT für jede Phase (Hauptkontakte)
      // Phasenreihenfolge: L1, L2, L3, N (wie in terminals.ts)
      // A1/A2 sind Steueranschlüsse und werden NICHT als Durchgang verbunden
      const polzahl = (component as any).polzahl || 3;
      const schuetzPhasen = (['L1', 'L2', 'L3', 'N'] as const).slice(0, polzahl);
      for (const phase of schuetzPhasen) {
        connections.push({ from: `IN_${phase}`, to: `OUT_${phase}` });
      }
      break;
    }
  }

  return connections;
}

/**
 * Baut eine Parent-Map auf KLEMMEN-EBENE (Terminal-Level).
 *
 * WICHTIG: Dies ist der Kern des neuen Algorithmus!
 *
 * - Knoten = Terminal-IDs wie "LS1:IN_L1", "LS1:OUT_L1"
 * - Kanten = Wire-Verbindungen UND interne Komponenten-Durchgänge
 * - BFS von der Versorgung aus → jede Klemme bekommt genau EINEN Parent
 *
 * Dadurch wird korrekt erkannt:
 * - Zwei LS mit verbügelten Eingängen → gleicher Parent (Verzweigungspunkt) → PARALLEL
 * - LS nach FI über dessen Ausgang → verschiedene Parent-Kette → IN SERIE
 */
function buildTerminalParentMap(verteiler: Verteiler): Map<string, string> {
  const parentMap = new Map<string, string>();
  const visited = new Set<string>();
  const queue: string[] = [];

  // Finde Versorgungsklemme
  const versorgung = verteiler.komponenten.find(k => k.type === 'versorgungsklemme');
  if (!versorgung) return parentMap;

  // Startpunkte: Alle Output-Terminals der Versorgungsklemme
  const startTerminals = ['OUT_L1', 'OUT_L2', 'OUT_L3', 'OUT_N', 'OUT_PE'];
  for (const terminal of startTerminals) {
    const terminalId = getTerminalId(versorgung.id, terminal);
    queue.push(terminalId);
    visited.add(terminalId);
  }

  // Baue eine Adjazenzliste für schnelleren Zugriff
  // Map: Terminal-ID → Liste von verbundenen Terminal-IDs
  const adjacency = new Map<string, string[]>();

  // 1. Externe Verbindungen (Wire-Objekte)
  for (const wire of verteiler.verbindungen) {
    const fromTerminal = getTerminalId(wire.von.componentId, wire.von.terminal);
    const toTerminal = getTerminalId(wire.nach.componentId, wire.nach.terminal);

    // Bidirektional hinzufügen
    if (!adjacency.has(fromTerminal)) adjacency.set(fromTerminal, []);
    if (!adjacency.has(toTerminal)) adjacency.set(toTerminal, []);
    adjacency.get(fromTerminal)!.push(toTerminal);
    adjacency.get(toTerminal)!.push(fromTerminal);
  }

  // 2. Interne Verbindungen (Komponenten-Durchgänge)
  for (const component of verteiler.komponenten) {
    const internalConnections = getInternalTerminalConnections(component);
    for (const conn of internalConnections) {
      const fromTerminal = getTerminalId(component.id, conn.from);
      const toTerminal = getTerminalId(component.id, conn.to);

      // Bidirektional hinzufügen
      if (!adjacency.has(fromTerminal)) adjacency.set(fromTerminal, []);
      if (!adjacency.has(toTerminal)) adjacency.set(toTerminal, []);
      adjacency.get(fromTerminal)!.push(toTerminal);
      adjacency.get(toTerminal)!.push(fromTerminal);
    }
  }

  // BFS von der Versorgung aus
  while (queue.length > 0) {
    const currentTerminal = queue.shift()!;
    const neighbors = adjacency.get(currentTerminal) || [];

    for (const neighborTerminal of neighbors) {
      if (!visited.has(neighborTerminal)) {
        visited.add(neighborTerminal);
        parentMap.set(neighborTerminal, currentTerminal);
        queue.push(neighborTerminal);
      }
    }
  }

  return parentMap;
}

/**
 * Ergebnis einer Drehfeldprüfung
 */
export interface DrehfeldResult {
  isCorrect: boolean;
  details: {
    componentId: string;
    componentName: string;
    localPhase: Phase;      // Phase am Verbraucher/Komponente (z.B. L1)
    connectedToPhase: Phase; // Phase an der Versorgung (z.B. L2)
  }[];
}

/**
 * Prüft das Drehfeld für eine Komponente.
 *
 * Stellt sicher dass:
 * - L1 am Verbraucher mit L1 an der Versorgungsklemme verbunden ist
 * - L2 am Verbraucher mit L2 an der Versorgungsklemme verbunden ist
 * - L3 am Verbraucher mit L3 an der Versorgungsklemme verbunden ist
 * - N am Verbraucher mit N an der Versorgungsklemme verbunden ist
 *
 * Ein falsches Drehfeld kann bei Drehstrommotoren zu Rückwärtslauf führen!
 */
export function checkDrehfeldForComponent(
  verteiler: Verteiler,
  componentId: string
): DrehfeldResult {
  const result: DrehfeldResult = {
    isCorrect: true,
    details: []
  };

  const versorgung = verteiler.komponenten.find(k => k.type === 'versorgungsklemme');
  if (!versorgung) return result;

  // Baue Terminal-basierte Parent-Map
  const terminalParentMap = buildTerminalParentMap(verteiler);

  // Phasen die geprüft werden sollen
  const phasenZuPruefen: Phase[] = ['L1', 'L2', 'L3', 'N'];

  // Mapping von Phase zu möglichen Terminal-Suffixen
  const phaseToTerminals: Record<Phase, string[]> = {
    'L1': ['IN_L1', 'OUT_L1'],
    'L2': ['IN_L2', 'OUT_L2'],
    'L3': ['IN_L3', 'OUT_L3'],
    'N': ['IN_N', 'OUT_N'],
    'PE': ['IN_PE', 'OUT_PE'],
  };

  // Für jede Phase: Finde welche Versorgungsphase damit verbunden ist
  for (const localPhase of phasenZuPruefen) {
    const terminalsForPhase = phaseToTerminals[localPhase];
    let connectedVersorgungsPhase: Phase | undefined = undefined;

    // Versuche von jedem möglichen Terminal dieser Phase zu starten
    for (const terminalSuffix of terminalsForPhase) {
      const startTerminalId = getTerminalId(componentId, terminalSuffix);

      // Nur wenn dieses Terminal im Graph existiert
      if (!terminalParentMap.has(startTerminalId)) continue;

      // Folge der Parent-Kette zur Versorgung
      let currentTerminal = startTerminalId;

      while (true) {
        const { componentId: currentComponentId, terminal: currentTerminalName } = parseTerminalId(currentTerminal);

        // Haben wir die Versorgungsklemme erreicht?
        if (currentComponentId === versorgung.id) {
          // Welche Phase der Versorgung haben wir erreicht?
          if (currentTerminalName === 'OUT_L1') connectedVersorgungsPhase = 'L1';
          else if (currentTerminalName === 'OUT_L2') connectedVersorgungsPhase = 'L2';
          else if (currentTerminalName === 'OUT_L3') connectedVersorgungsPhase = 'L3';
          else if (currentTerminalName === 'OUT_N') connectedVersorgungsPhase = 'N';
          break;
        }

        // Kein Parent mehr? → Sackgasse
        if (!terminalParentMap.has(currentTerminal)) {
          break;
        }
        currentTerminal = terminalParentMap.get(currentTerminal)!;
      }

      // Wenn wir eine Verbindung gefunden haben, nicht mehr weiter suchen
      if (connectedVersorgungsPhase) break;
    }

    // Prüfe ob die Phase korrekt verbunden ist
    if (connectedVersorgungsPhase && connectedVersorgungsPhase !== localPhase) {
      // Falsche Phase! L1 ist z.B. mit L2 verbunden
      result.isCorrect = false;

      const component = verteiler.komponenten.find(k => k.id === componentId);
      result.details.push({
        componentId,
        componentName: component?.name || componentId,
        localPhase,
        connectedToPhase: connectedVersorgungsPhase
      });
    }
  }

  return result;
}

/**
 * Baut eine vollständige Adjazenzliste für den Terminal-Graphen.
 * Wird für die Kurzschlusserkennung benötigt.
 */
function buildTerminalAdjacency(verteiler: Verteiler): Map<string, string[]> {
  const adjacency = new Map<string, string[]>();

  // 1. Externe Verbindungen (Wire-Objekte)
  for (const wire of verteiler.verbindungen) {
    const fromTerminal = getTerminalId(wire.von.componentId, wire.von.terminal);
    const toTerminal = getTerminalId(wire.nach.componentId, wire.nach.terminal);

    // Bidirektional hinzufügen
    if (!adjacency.has(fromTerminal)) adjacency.set(fromTerminal, []);
    if (!adjacency.has(toTerminal)) adjacency.set(toTerminal, []);
    adjacency.get(fromTerminal)!.push(toTerminal);
    adjacency.get(toTerminal)!.push(fromTerminal);
  }

  // 2. Interne Verbindungen (Komponenten-Durchgänge)
  for (const component of verteiler.komponenten) {
    const internalConnections = getInternalTerminalConnections(component);
    for (const conn of internalConnections) {
      const fromTerminal = getTerminalId(component.id, conn.from);
      const toTerminal = getTerminalId(component.id, conn.to);

      // Bidirektional hinzufügen
      if (!adjacency.has(fromTerminal)) adjacency.set(fromTerminal, []);
      if (!adjacency.has(toTerminal)) adjacency.set(toTerminal, []);
      adjacency.get(fromTerminal)!.push(toTerminal);
      adjacency.get(toTerminal)!.push(fromTerminal);
    }
  }

  return adjacency;
}

/**
 * Ergebnis einer Kurzschlussprüfung
 */
export interface KurzschlussResult {
  hasKurzschluss: boolean;
  details: {
    componentId: string;
    componentName: string;
    phase1: Phase;
    phase2: Phase;
    terminal1: string;
    terminal2: string;
  }[];
}

/**
 * Prüft ob verschiedene Phasen (L1, L2, L3, N) irgendwo im Verteiler
 * miteinander verbunden sind - was einen Kurzschluss bedeuten würde.
 *
 * WICHTIG: Es darf NICHT möglich sein, von einer Phase zu einer anderen
 * Phase zu gelangen (außer über die interne Verbindung einer Komponente).
 *
 * Algorithmus:
 * 1. Für jede Abgangsklemme: Prüfe ob man von einem Phasen-Terminal
 *    zu einem anderen Phasen-Terminal gelangen kann
 * 2. Wenn ja → Kurzschluss zwischen den Phasen
 */
export function detectKurzschluss(verteiler: Verteiler): KurzschlussResult {
  const result: KurzschlussResult = {
    hasKurzschluss: false,
    details: []
  };

  // Baue Adjazenzliste
  const adjacency = buildTerminalAdjacency(verteiler);

  // Prüfe für jede Abgangsklemme
  const abgangsklemmen = verteiler.komponenten.filter(k => k.type === 'abgangsklemme');

  for (const klemme of abgangsklemmen) {
    // Ermittle die Phasen dieser Klemme basierend auf Polzahl
    // Inklusive PE für Kurzschlussprüfung zwischen PE und Außenleitern
    const polzahl = (klemme as any).polzahl || 3;
    const klemmenPhasen: Phase[] = polzahl === 3
      ? ['L1', 'N', 'PE']  // 3-polig: L1, N, PE
      : ['L1', 'L2', 'L3', 'N', 'PE'];  // 5-polig: L1, L2, L3, N, PE

    // Für jede Phase: Prüfe ob sie mit einer anderen Phase verbunden ist
    for (let i = 0; i < klemmenPhasen.length; i++) {
      const phase1 = klemmenPhasen[i];
      const terminal1 = `IN_${phase1}`;
      const terminalId1 = getTerminalId(klemme.id, terminal1);

      // BFS von diesem Terminal aus - finde alle erreichbaren Terminals
      const erreichbar = findAllReachableTerminals(adjacency, terminalId1, klemme.id);

      // Prüfe ob wir ein Terminal einer ANDEREN Phase DERSELBEN Klemme erreichen können
      for (let j = i + 1; j < klemmenPhasen.length; j++) {
        const phase2 = klemmenPhasen[j];
        const terminal2 = `IN_${phase2}`;
        const terminalId2 = getTerminalId(klemme.id, terminal2);

        if (erreichbar.has(terminalId2)) {
          // Kurzschluss gefunden!
          result.hasKurzschluss = true;
          result.details.push({
            componentId: klemme.id,
            componentName: klemme.name,
            phase1,
            phase2,
            terminal1,
            terminal2
          });
        }
      }
    }
  }

  // Prüfe auch die Versorgungsklemme
  // Inklusive PE für Kurzschlussprüfung zwischen PE und Außenleitern
  const versorgungsPhasen: Phase[] = ['L1', 'L2', 'L3', 'N', 'PE'];
  const versorgung = verteiler.komponenten.find(k => k.type === 'versorgungsklemme');
  if (versorgung) {
    for (let i = 0; i < versorgungsPhasen.length; i++) {
      const phase1 = versorgungsPhasen[i];
      const terminal1 = `OUT_${phase1}`;
      const terminalId1 = getTerminalId(versorgung.id, terminal1);

      // BFS von diesem Terminal aus
      const erreichbar = findAllReachableTerminals(adjacency, terminalId1, versorgung.id);

      // Prüfe ob wir ein Terminal einer ANDEREN Phase DERSELBEN Versorgungsklemme erreichen
      for (let j = i + 1; j < versorgungsPhasen.length; j++) {
        const phase2 = versorgungsPhasen[j];
        const terminal2 = `OUT_${phase2}`;
        const terminalId2 = getTerminalId(versorgung.id, terminal2);

        if (erreichbar.has(terminalId2)) {
          // Kurzschluss gefunden!
          result.hasKurzschluss = true;
          result.details.push({
            componentId: versorgung.id,
            componentName: versorgung.name,
            phase1,
            phase2,
            terminal1,
            terminal2
          });
        }
      }
    }
  }

  return result;
}

/**
 * Findet alle Terminals die von einem Start-Terminal aus erreichbar sind.
 * WICHTIG: Ignoriert das Start-Terminal der eigenen Komponente für den Rückweg-Check.
 */
function findAllReachableTerminals(
  adjacency: Map<string, string[]>,
  startTerminalId: string,
  startComponentId: string
): Set<string> {
  const visited = new Set<string>();
  const queue: string[] = [startTerminalId];
  visited.add(startTerminalId);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = adjacency.get(current) || [];

    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  return visited;
}

/**
 * Findet alle Komponenten die in Serie mit einer gegebenen Komponente sind.
 *
 * WICHTIG: Arbeitet auf KLEMMEN-EBENE!
 *
 * Algorithmus:
 * 1. Sammle ALLE verbundenen Terminals der Komponente
 * 2. Für jedes Terminal: Folge der Parent-Kette zur Versorgung
 * 3. Sammle alle besuchten Terminals aller anderen Komponenten
 * 4. Eine Komponente ist in Serie wenn sie DURCHQUERT wird (IN und OUT besucht)
 *
 * KRITISCH: Eine Komponente ist nur "in Serie" wenn der Pfad durch sie HINDURCHGEHT,
 * d.h. auf einer Seite rein (z.B. IN_L1) und auf der anderen raus (z.B. OUT_L1).
 *
 * Wenn der Pfad nur eine Klemme berührt (z.B. nur IN_L1 weil dort eine Brücke abgeht),
 * ist das ein VERZWEIGUNGSPUNKT und die Komponente ist NICHT in Serie!
 */
export function findSeriesComponents(
  verteiler: Verteiler,
  componentId: string
): ElektroComponent[] {
  const versorgung = verteiler.komponenten.find(k => k.type === 'versorgungsklemme');
  if (!versorgung) return [];

  // Baue Terminal-basierte Parent-Map
  const terminalParentMap = buildTerminalParentMap(verteiler);

  // Alle möglichen Terminal-Namen
  const possibleTerminals = [
    'OUT_L1', 'OUT_L2', 'OUT_L3', 'OUT_N', 'OUT_PE',
    'IN_L1', 'IN_L2', 'IN_L3', 'IN_N', 'IN_PE',
    'TOP_0', 'TOP_1', 'TOP_2', 'TOP_3', 'TOP_4', 'TOP_5',
    'BOT_0', 'BOT_1', 'BOT_2', 'BOT_3', 'BOT_4', 'BOT_5',
    'IN', 'OUT'
  ];

  // Sammle alle besuchten Terminals pro Komponente über ALLE Pfade
  const componentTerminalVisits = new Map<string, Set<string>>();

  // Für JEDES verbundene Terminal der Start-Komponente: Folge dem Pfad zur Versorgung
  for (const terminal of possibleTerminals) {
    const terminalId = getTerminalId(componentId, terminal);

    // Nur wenn dieses Terminal im Graph existiert
    if (!terminalParentMap.has(terminalId)) continue;

    // Folge der Parent-Kette von diesem Terminal zur Versorgung
    let currentTerminal = terminalId;

    while (true) {
      const { componentId: currentComponentId, terminal: currentTerminalName } = parseTerminalId(currentTerminal);

      // Sammle das besuchte Terminal für diese Komponente
      if (!componentTerminalVisits.has(currentComponentId)) {
        componentTerminalVisits.set(currentComponentId, new Set());
      }
      componentTerminalVisits.get(currentComponentId)!.add(currentTerminalName);

      // Zur Versorgung erreicht?
      if (!terminalParentMap.has(currentTerminal)) {
        break;
      }
      currentTerminal = terminalParentMap.get(currentTerminal)!;
    }
  }

  // Jetzt prüfen welche Komponenten DURCHQUERT wurden (IN und OUT besucht)
  const seriesComponents: ElektroComponent[] = [];

  for (const [compId, terminals] of componentTerminalVisits) {
    // Überspringe die Start-Komponente selbst
    if (compId === componentId) continue;

    // Überspringe die Versorgungsklemme
    if (compId === versorgung.id) continue;

    const component = verteiler.komponenten.find(k => k.id === compId);
    if (!component) continue;

    // Prüfe ob die Komponente DURCHQUERT wurde
    const isDurchquert = isComponentTraversed(component, terminals);

    if (isDurchquert) {
      seriesComponents.push(component);
    }
  }

  return seriesComponents;
}

/**
 * Prüft ob eine Komponente durchquert wurde (Strom fließt hindurch).
 *
 * Eine Komponente ist durchquert wenn:
 * - Bei IN/OUT-Komponenten: Mindestens ein IN_x UND ein OUT_x Terminal besucht wurde
 * - Bei Klemmen/Sammelschienen: Mindestens 2 verschiedene Terminals besucht wurden
 *   (da alle intern verbunden sind, bedeutet das Durchgang)
 */
function isComponentTraversed(component: ElektroComponent, visitedTerminals: Set<string>): boolean {
  const terminals = Array.from(visitedTerminals);

  // Spezialfall: Klemmen und Sammelschienen
  // Diese sind Verteilpunkte - hier zählt "durchquert" wenn mind. 2 Terminals besucht
  if (component.type === 'klemme' || component.type === 'sammelschiene') {
    return terminals.length >= 2;
  }

  // Für normale Komponenten: Prüfe ob IN und OUT Seite besucht wurden
  const hasIN = terminals.some(t => t.startsWith('IN_') || t.startsWith('TOP_'));
  const hasOUT = terminals.some(t => t.startsWith('OUT_') || t.startsWith('BOT_'));

  return hasIN && hasOUT;
}

/**
 * Findet alle FI-Schalter die in Serie mit einer Komponente sind.
 * Nützlich für die FI-Selektivitätsprüfung.
 */
export function findSeriesFIs(
  verteiler: Verteiler,
  componentId: string
): (FISchalterParams | FILSKombiParams)[] {
  const seriesComponents = findSeriesComponents(verteiler, componentId);
  return seriesComponents.filter(c =>
    c.type === 'fi-schalter' || c.type === 'fi-ls-kombi'
  ) as (FISchalterParams | FILSKombiParams)[];
}

/**
 * Findet alle Schutzeinrichtungen (LS, Sicherungen) die in Serie mit einer Komponente sind.
 */
export function findSeriesProtection(
  verteiler: Verteiler,
  componentId: string
): ElektroComponent[] {
  const seriesComponents = findSeriesComponents(verteiler, componentId);
  return seriesComponents.filter(c =>
    c.type === 'ls-schalter' || c.type === 'fi-ls-kombi' ||
    c.type === 'nh-sicherung' || c.type === 'neozed-sicherung' || c.type === 'schraub-sicherung'
  );
}

/**
 * Findet den NÄCHSTEN FI-Schalter für jede Phase einer Komponente.
 *
 * WICHTIG: Nur der nächste FI (der dem Verbraucher am nächsten ist) wird zurückgegeben!
 * Vorgelagerte FIs werden ignoriert.
 *
 * Diese Funktion ist kritisch für die Neutralleiter-FI-Prüfung:
 * Alle Phasen (L1, L2, L3, N) eines Verbrauchers müssen durch denselben nächsten FI gehen.
 *
 * @returns Map von Phase → FI-ID (oder undefined wenn kein FI auf dem Pfad)
 */
export function findNearestFIPerPhase(
  verteiler: Verteiler,
  componentId: string
): Map<Phase, string | undefined> {
  const result = new Map<Phase, string | undefined>();
  const versorgung = verteiler.komponenten.find(k => k.type === 'versorgungsklemme');
  if (!versorgung) return result;

  // Baue Terminal-basierte Parent-Map
  const terminalParentMap = buildTerminalParentMap(verteiler);

  // Mapping von Phase zu Terminal-Suffix
  const phaseToTerminals: Record<Phase, string[]> = {
    'L1': ['OUT_L1', 'IN_L1', 'BOT_0', 'TOP_0'],
    'L2': ['OUT_L2', 'IN_L2', 'BOT_1', 'TOP_1'],
    'L3': ['OUT_L3', 'IN_L3', 'BOT_2', 'TOP_2'],
    'N': ['OUT_N', 'IN_N'],
    'PE': ['OUT_PE', 'IN_PE'],
  };

  // Für jede Phase: Finde den nächsten FI auf dem Pfad zur Versorgung
  for (const phase of ['L1', 'L2', 'L3', 'N', 'PE'] as Phase[]) {
    const terminalsForPhase = phaseToTerminals[phase];
    let nearestFI: string | undefined = undefined;

    // Versuche von jedem möglichen Terminal dieser Phase zu starten
    for (const terminalSuffix of terminalsForPhase) {
      const startTerminalId = getTerminalId(componentId, terminalSuffix);

      // Nur wenn dieses Terminal im Graph existiert
      if (!terminalParentMap.has(startTerminalId)) continue;

      // Folge der Parent-Kette zur Versorgung
      let currentTerminal = startTerminalId;

      while (true) {
        const { componentId: currentComponentId } = parseTerminalId(currentTerminal);

        // Prüfe ob diese Komponente ein FI ist
        const component = verteiler.komponenten.find(k => k.id === currentComponentId);
        if (component && (component.type === 'fi-schalter' || component.type === 'fi-ls-kombi')) {
          // Prüfe ob dieser FI diese Phase führt
          if (componentHasPhase(component, phase)) {
            nearestFI = currentComponentId;
            break; // ERSTER gefundener FI = NÄCHSTER FI
          }
        }

        // Versorgung erreicht?
        if (!terminalParentMap.has(currentTerminal)) {
          break;
        }
        currentTerminal = terminalParentMap.get(currentTerminal)!;
      }

      // Wenn wir einen FI gefunden haben, nicht mehr weiter suchen
      if (nearestFI) break;
    }

    result.set(phase, nearestFI);
  }

  return result;
}

/**
 * Hilfsfunktion: Prüft ob eine Komponente eine bestimmte Phase führt
 */
function componentHasPhase(component: ElektroComponent, phase: Phase): boolean {
  if (component.type === 'fi-schalter') {
    const fi = component as FISchalterParams;
    if (fi.polzahl === 2) {
      return phase === 'L1' || phase === 'N';
    } else if (fi.polzahl === 4) {
      return phase === 'L1' || phase === 'L2' || phase === 'L3' || phase === 'N';
    }
  } else if (component.type === 'fi-ls-kombi') {
    const fils = component as FILSKombiParams;
    if (fils.polzahl === 1 || fils.polzahl === 2) {
      return phase === 'L1' || phase === 'N';
    } else {
      return phase === 'L1' || phase === 'L2' || phase === 'L3' || phase === 'N';
    }
  }
  return false;
}

/**
 * Prüft ob eine Komponente eine Verbindung zum PE (Schutzleiter) der Versorgungsklemme hat.
 *
 * Diese Funktion ist kritisch für die Erdungsprüfung:
 * Jeder Verbraucher muss über seinen PE-Anschluss eine durchgehende Verbindung
 * zur Erdung (PE der Versorgungsklemme) haben.
 *
 * WICHTIG: Diese Funktion nutzt eine bidirektionale BFS-Suche über die Adjazenzliste,
 * um PE-Verbindungen über beliebig viele PE-Klemmen/Sammelschienen hinweg zu finden.
 *
 * Terminal-Typen für PE-Verbindungen:
 * - Abgangsklemme: IN_PE, OUT_PE
 * - PE-Klemme (type: 'klemme', phase: 'PE'): TOP_0, BOT_0
 * - PE-Sammelschiene (type: 'sammelschiene', phase: 'PE'): TOP_0, TOP_1, ..., BOT_0, BOT_1, ...
 * - Versorgungsklemme: OUT_PE
 *
 * @returns true wenn eine PE-Verbindung zur Versorgung besteht
 */
export function hasConnectionToPE(
  verteiler: Verteiler,
  componentId: string
): boolean {
  const versorgung = verteiler.komponenten.find(k => k.type === 'versorgungsklemme');
  if (!versorgung) return false;

  // Baue bidirektionale Adjazenzliste für alle Terminals
  const adjacency = buildTerminalAdjacency(verteiler);

  // Finde die Start-Komponente um deren Typ zu bestimmen
  const startKomponente = verteiler.komponenten.find(k => k.id === componentId);
  if (!startKomponente) return false;

  // PE-Terminal-Suffixe abhängig vom Komponententyp:
  // - Abgangsklemme: IN_PE, OUT_PE
  // - Klemme (PE): TOP_0, BOT_0
  // - Sammelschiene (PE): TOP_0, TOP_1, ..., BOT_0, BOT_1, ... (mehrere Anschlüsse)
  // - Andere Komponenten: IN_PE, OUT_PE (falls vorhanden)
  let peStartTerminals: string[];
  if (startKomponente.type === 'klemme') {
    peStartTerminals = ['TOP_0', 'BOT_0'];
  } else if (startKomponente.type === 'sammelschiene') {
    // Sammelschienen haben mehrere Anschlüsse - alle möglichen Terminals
    const teBreite = startKomponente.teilungseinheiten || 2;
    const anzahlAnschluesse = teBreite === 2 ? 3 : Math.max(1, Math.floor(teBreite / 2));
    peStartTerminals = [];
    for (let i = 0; i < anzahlAnschluesse; i++) {
      peStartTerminals.push(`TOP_${i}`);
      peStartTerminals.push(`BOT_${i}`);
    }
  } else if (startKomponente.type === 'abgangsklemme') {
    peStartTerminals = ['IN_PE', 'OUT_PE'];
  } else {
    // Für andere Komponenten: versuche alle möglichen PE-Terminals
    peStartTerminals = ['IN_PE', 'OUT_PE', 'TOP_0', 'BOT_0'];
  }

  // Ziel: OUT_PE der Versorgungsklemme
  // Wir prüfen ob das aktuelle Terminal zur Versorgungsklemme gehört UND ein PE-Terminal ist
  const versorgungId = versorgung.id;

  // BFS von jedem möglichen PE-Terminal der Start-Komponente
  for (const terminalSuffix of peStartTerminals) {
    const startTerminalId = getTerminalId(componentId, terminalSuffix);

    // Prüfe ob dieses Start-Terminal überhaupt existiert (hat Verbindungen)
    if (!adjacency.has(startTerminalId)) continue;

    // BFS-Suche zum PE der Versorgungsklemme
    const visited = new Set<string>();
    const queue: string[] = [startTerminalId];
    visited.add(startTerminalId);

    while (queue.length > 0) {
      const currentTerminal = queue.shift()!;

      // Parse das aktuelle Terminal um zu prüfen ob wir bei der Versorgungsklemme sind
      const parsed = parseTerminalId(currentTerminal);

      // Haben wir die Versorgungsklemme erreicht?
      // Wir akzeptieren OUT_PE als Ziel (das ist das PE-Terminal der Versorgungsklemme)
      if (parsed.componentId === versorgungId && parsed.terminal === 'OUT_PE') {
        return true; // PE-Verbindung gefunden!
      }

      // Spezialfall: Verteilerklemme (type: 'klemme')
      // Wenn wir irgendein Terminal einer Verteilerklemme erreichen, sind ALLE Terminals
      // dieser Klemme erreichbar (interne Vollvermaschung)
      const currentComponent = verteiler.komponenten.find(k => k.id === parsed.componentId);
      if (currentComponent && currentComponent.type === 'klemme') {
        // Füge alle Terminals dieser Klemme zur Queue hinzu (TOP_0, BOT_0)
        const klemmeTerminals = ['TOP_0', 'BOT_0'];
        for (const termSuffix of klemmeTerminals) {
          const termId = getTerminalId(parsed.componentId, termSuffix);
          if (!visited.has(termId)) {
            visited.add(termId);
            queue.push(termId);
          }
        }
      }

      // Zusätzliche Prüfung: Haben wir eine PE-Sammelschiene oder PE-Klemme erreicht,
      // die direkt mit der Versorgungsklemme verbunden ist?
      // Prüfe die Wires ob einer davon zur Versorgungsklemme:OUT_PE führt
      for (const wire of verteiler.verbindungen) {
        const vonId = getTerminalId(wire.von.componentId, wire.von.terminal);
        const nachId = getTerminalId(wire.nach.componentId, wire.nach.terminal);

        // Wenn der aktuelle Terminal über einen Wire mit Versorgungsklemme:OUT_PE verbunden ist
        if (currentTerminal === vonId && wire.nach.componentId === versorgungId && wire.nach.terminal === 'OUT_PE') {
          return true;
        }
        if (currentTerminal === nachId && wire.von.componentId === versorgungId && wire.von.terminal === 'OUT_PE') {
          return true;
        }
      }

      // Alle Nachbarn besuchen
      const neighbors = adjacency.get(currentTerminal) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
  }

  return false; // Keine PE-Verbindung gefunden
}

// ==========================================
// EXPORT: Vereinfachte API für Validation
// ==========================================

/**
 * Hauptfunktion für die Validierung: Analysiert den Verteiler und gibt
 * alle Selektivitätsverstöße zurück.
 *
 * WICHTIG: Selektivität wird nur für Komponenten geprüft, die WIRKLICH in Serie sind.
 * Das bedeutet: Die nachgelagerte Komponente muss auf ALLEN Pfaden zur Versorgung
 * durch die vorgelagerte Komponente gehen.
 */
export function analyzeSelectivity(verteiler: Verteiler): SelectivityViolation[] {
  const allViolations: SelectivityViolation[] = [];

  // Statt Pfade zu analysieren, prüfen wir direkt die Serien-Beziehungen
  // Für jede Schutzeinrichtung finden wir die ECHTEN vorgelagerten Schutzeinrichtungen

  const schutzeinrichtungen = verteiler.komponenten.filter(k =>
    k.type === 'ls-schalter' || k.type === 'fi-ls-kombi' ||
    k.type === 'fi-schalter' || k.type === 'nh-sicherung' ||
    k.type === 'neozed-sicherung' || k.type === 'schraub-sicherung'
  );

  // Für jede Schutzeinrichtung: Finde die direkt vorgelagerten (in Serie)
  for (const downstream of schutzeinrichtungen) {
    // Finde alle Komponenten die WIRKLICH in Serie sind (auf ALLEN Pfaden zur Versorgung)
    const seriesComponents = findSeriesComponents(verteiler, downstream.id);

    // Filtere auf Schutzeinrichtungen
    const seriesProtection = seriesComponents.filter(c =>
      c.type === 'ls-schalter' || c.type === 'fi-ls-kombi' ||
      c.type === 'fi-schalter' || c.type === 'nh-sicherung' ||
      c.type === 'neozed-sicherung' || c.type === 'schraub-sicherung'
    );

    // Prüfe LS-Selektivität mit jeder vorgelagerten Schutzeinrichtung
    for (const upstream of seriesProtection) {
      // LS-Selektivität prüfen (nur für LS-Typen)
      if ((downstream.type === 'ls-schalter' || downstream.type === 'fi-ls-kombi' ||
           downstream.type === 'nh-sicherung' || downstream.type === 'neozed-sicherung' ||
           downstream.type === 'schraub-sicherung') &&
          (upstream.type === 'ls-schalter' || upstream.type === 'fi-ls-kombi' ||
           upstream.type === 'nh-sicherung' || upstream.type === 'neozed-sicherung' ||
           upstream.type === 'schraub-sicherung')) {

        const upstreamCurrent = getBemessungsStrom(upstream);
        const downstreamCurrent = getBemessungsStrom(downstream);

        if (upstreamCurrent > 0 && downstreamCurrent > 0) {
          const faktor = upstreamCurrent / downstreamCurrent;

          if (faktor < 1.6) {
            allViolations.push({
              upstreamComponent: upstream,
              downstreamComponent: downstream,
              type: 'ls',
              reason: `LS-Selektivität nicht gewährleistet: ${upstream.name} (${upstreamCurrent}A) / ${downstream.name} (${downstreamCurrent}A) = ${faktor.toFixed(2)} < 1.6. Vorgelagerte Sicherung sollte mindestens ${Math.ceil(downstreamCurrent * 1.6)}A haben.`,
              severity: faktor < 1.0 ? 'error' : 'warning'
            });
          }
        }
      }

      // FI-Selektivität prüfen
      if ((downstream.type === 'fi-schalter' || downstream.type === 'fi-ls-kombi') &&
          (upstream.type === 'fi-schalter' || upstream.type === 'fi-ls-kombi')) {

        const upstreamFI = upstream as FISchalterParams | FILSKombiParams;
        const downstreamFI = downstream as FISchalterParams | FILSKombiParams;

        const verzögerungsHierarchie: Record<string, number> = {
          'Standard': 0,
          'G': 1,
          'S': 2
        };

        const upstreamDelay = verzögerungsHierarchie[upstreamFI.verzoegerung] ?? 0;
        const downstreamDelay = verzögerungsHierarchie[downstreamFI.verzoegerung] ?? 0;

        // Vorgelagerter FI muss HÖHERE Verzögerung haben
        if (upstreamDelay < downstreamDelay) {
          allViolations.push({
            upstreamComponent: upstream,
            downstreamComponent: downstream,
            type: 'fi',
            reason: `FI-Selektivität nicht gewährleistet: ${upstream.name} (${upstreamFI.verzoegerung}) ist weniger verzögert als ${downstream.name} (${downstreamFI.verzoegerung}). Vorgelagerter FI muss höhere Verzögerung haben.`,
            severity: 'error'
          });
        } else if (upstreamDelay === downstreamDelay && upstreamDelay > 0) {
          // Gleiche Verzögerung bei nicht-Standard → Warnung
          allViolations.push({
            upstreamComponent: upstream,
            downstreamComponent: downstream,
            type: 'fi',
            reason: `FI-Selektivität fraglich: ${upstream.name} und ${downstream.name} haben beide Verzögerung "${upstreamFI.verzoegerung}".`,
            severity: 'warning'
          });
        }
      }
    }
  }

  // Entferne Duplikate
  const uniqueViolations = removeDuplicateViolations(allViolations);

  return uniqueViolations;
}

/**
 * Entfernt doppelte Verletzungen (basierend auf den beteiligten Komponenten)
 */
function removeDuplicateViolations(violations: SelectivityViolation[]): SelectivityViolation[] {
  const seen = new Set<string>();
  return violations.filter(v => {
    const key = `${v.upstreamComponent.id}-${v.downstreamComponent.id}-${v.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ==========================================
// EXPORT: Stromkreis-Info für Debugging/Anzeige
// ==========================================

/**
 * Informationen über einen Stromkreis-Pfad
 */
export interface CircuitPathInfo {
  /** ID des Endpunkts (Abgangsklemme oder Schutzeinrichtung) */
  endpointId: string;
  /** Name des Endpunkts */
  endpointName: string;
  /** Typ des Endpunkts */
  endpointType: string;
  /** Alle Komponenten auf dem Pfad von Versorgung zu Endpunkt */
  componentsOnPath: {
    id: string;
    name: string;
    type: string;
    /** Position im Pfad (0 = Versorgung, höher = näher am Endpunkt) */
    positionInPath: number;
  }[];
  /** FIs auf dem Pfad */
  fiSchalter: string[];
  /** LS-Schalter und Sicherungen auf dem Pfad */
  schutzeinrichtungen: string[];
  /** Ist der Pfad korrekt verbunden? */
  isConnected: boolean;
}

/**
 * Generiert einen strukturierten Überblick über alle Stromkreis-Pfade im Verteiler.
 * Nützlich für Debugging und zur Anzeige der Verdrahtungsstruktur.
 */
export function getCircuitPathInfo(verteiler: Verteiler): CircuitPathInfo[] {
  const paths = findAllCircuitPaths(verteiler);
  const pathInfos: CircuitPathInfo[] = [];

  for (const path of paths) {
    const fiSchalter = path.components
      .filter(c => c.type === 'fi-schalter' || c.type === 'fi-ls-kombi')
      .map(c => c.name);

    const schutzeinrichtungen = path.components
      .filter(c =>
        c.type === 'ls-schalter' || c.type === 'fi-ls-kombi' ||
        c.type === 'nh-sicherung' || c.type === 'neozed-sicherung' || c.type === 'schraub-sicherung'
      )
      .map(c => c.name);

    pathInfos.push({
      endpointId: path.endComponent.id,
      endpointName: path.endComponent.name,
      endpointType: path.endComponent.type,
      componentsOnPath: path.components.map((c, index) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        positionInPath: index,
      })),
      fiSchalter,
      schutzeinrichtungen,
      isConnected: path.components.length > 0,
    });
  }

  return pathInfos;
}

/**
 * Gibt einen lesbaren Text-Report über die Verdrahtungsstruktur zurück.
 * Gut für Debugging und Logging.
 */
export function getCircuitStructureReport(verteiler: Verteiler): string {
  const pathInfos = getCircuitPathInfo(verteiler);
  const versorgung = verteiler.komponenten.find(k => k.type === 'versorgungsklemme');

  let report = `=== VERDRAHTUNGSSTRUKTUR: ${verteiler.name} ===\n\n`;

  if (!versorgung) {
    report += 'WARNUNG: Keine Versorgungsklemme gefunden!\n';
    return report;
  }

  report += `Versorgungsklemme: ${versorgung.name}\n`;
  report += `Anzahl Stromkreis-Pfade: ${pathInfos.length}\n\n`;

  for (let i = 0; i < pathInfos.length; i++) {
    const info = pathInfos[i];
    report += `--- Pfad ${i + 1}: ${info.endpointName} (${info.endpointType}) ---\n`;
    report += `Komponenten auf dem Pfad:\n`;

    for (const comp of info.componentsOnPath) {
      const indent = '  '.repeat(comp.positionInPath + 1);
      report += `${indent}├─ ${comp.name} (${comp.type})\n`;
    }

    if (info.fiSchalter.length > 0) {
      report += `FI-Schalter: ${info.fiSchalter.join(' → ')}\n`;
    }

    if (info.schutzeinrichtungen.length > 0) {
      report += `Schutzeinrichtungen: ${info.schutzeinrichtungen.join(' → ')}\n`;
    }

    report += '\n';
  }

  return report;
}

/**
 * Gibt die effektiven Phasen für einen Verbraucher zurück.
 *
 * Für 1-phasige Verbraucher wird die tatsächlich angeschlossene Phase erkannt.
 * Für 3-phasige Verbraucher werden L1, L2, L3 zurückgegeben.
 *
 * @returns Array der effektiven Phasen (ohne N und PE)
 */
export function getEffectivePhasen(
  verteiler: Verteiler,
  verbraucher: { phasen: Phase[]; spannung: number; zugewieseneKomponente?: string }
): Phase[] {
  const phasenOhneNPE = verbraucher.phasen.filter(p => p !== 'N' && p !== 'PE') as Phase[];

  // 3-phasig: L1, L2, L3 zurückgeben
  if (phasenOhneNPE.length === 3 || verbraucher.spannung === 400) {
    return ['L1', 'L2', 'L3'];
  }

  // 1-phasig: Erkannte Phase verwenden
  if (verbraucher.zugewieseneKomponente) {
    const erkanntePhase = detectPhaseForComponent(verteiler, verbraucher.zugewieseneKomponente);
    if (erkanntePhase) {
      return [erkanntePhase];
    }
  }

  // Fallback: Original-Phase (L1)
  return phasenOhneNPE.length > 0 ? [phasenOhneNPE[0]] : ['L1'];
}

/**
 * Erkennt die tatsächliche Phase für einen 1-phasigen Verbraucher.
 *
 * Die Funktion sucht vom IN_L1 Terminal der Abgangsklemme zur Versorgungsklemme
 * und gibt die Phase zurück, mit der die Verbindung besteht (L1, L2 oder L3).
 *
 * Dies ist wichtig, weil ein 1-phasiger Verbraucher immer als "L1" markiert ist,
 * aber tatsächlich auf L2 oder L3 der Versorgung angeschlossen sein kann.
 */
export function detectPhaseForComponent(
  verteiler: Verteiler,
  componentId: string
): Phase | null {
  const versorgung = verteiler.komponenten.find(k => k.type === 'versorgungsklemme');
  if (!versorgung) return null;

  const component = verteiler.komponenten.find(k => k.id === componentId);
  if (!component) return null;

  // Baue bidirektionale Adjazenzliste für alle Terminals
  const adjacency = buildTerminalAdjacency(verteiler);

  // Starte von IN_L1 der Komponente (bei Abgangsklemmen)
  // oder von einem anderen geeigneten Terminal
  let startTerminal: string;
  if (component.type === 'abgangsklemme') {
    startTerminal = 'IN_L1';
  } else {
    startTerminal = 'IN_L1'; // Standardfall
  }

  const startTerminalId = getTerminalId(componentId, startTerminal);

  // BFS zur Versorgungsklemme
  const visited = new Set<string>();
  const queue: string[] = [startTerminalId];
  visited.add(startTerminalId);

  // Suche nach OUT_L1, OUT_L2 oder OUT_L3 der Versorgungsklemme
  const versorgungId = versorgung.id;
  const phasenTerminals: Phase[] = ['L1', 'L2', 'L3'];

  while (queue.length > 0) {
    const currentTerminal = queue.shift()!;
    const parsed = parseTerminalId(currentTerminal);

    // Haben wir die Versorgungsklemme erreicht?
    if (parsed.componentId === versorgungId) {
      // Prüfe welche Phase es ist
      for (const phase of phasenTerminals) {
        if (parsed.terminal === `OUT_${phase}`) {
          return phase;
        }
      }
    }

    // Spezialfall: Verteilerklemme (type: 'klemme')
    // Wenn wir irgendein Terminal erreichen, sind alle erreichbar
    const currentComponent = verteiler.komponenten.find(k => k.id === parsed.componentId);
    if (currentComponent && currentComponent.type === 'klemme') {
      const klemmeTerminals = ['TOP_0', 'BOT_0'];
      for (const termSuffix of klemmeTerminals) {
        const termId = getTerminalId(parsed.componentId, termSuffix);
        if (!visited.has(termId)) {
          visited.add(termId);
          queue.push(termId);
        }
      }
    }

    // Alle Nachbarn besuchen
    const neighbors = adjacency.get(currentTerminal) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  return null; // Keine Verbindung zur Versorgung gefunden
}

/**
 * Berechnet den Strom für jeden Draht im Verteiler.
 *
 * Algorithmus:
 * 1. Für jeden Verbraucher: Berechne den Strom basierend auf Leistung und Spannung
 * 2. Finde alle Drähte auf dem Pfad von der Abgangsklemme zur Versorgung
 * 3. Summiere die Ströme auf gemeinsamen Drähten
 *
 * Formeln:
 * - Einphasig (230V): I = P / 230
 * - Dreiphasig (400V): I = P / (√3 × 400)
 *
 * PE-Drähte bekommen keinen Strom (theoretisch 0).
 */
export function calculateWireCurrents(verteiler: Verteiler): Map<string, number> {
  const wireCurrents = new Map<string, number>();

  // Initialisiere alle Drähte mit 0
  for (const wire of verteiler.verbindungen) {
    wireCurrents.set(wire.id, 0);
  }

  // Baue Adjazenzliste für Pfadsuche
  const adjacency = buildTerminalAdjacency(verteiler);

  // Finde die Versorgungsklemme
  const versorgung = verteiler.komponenten.find(k => k.type === 'versorgungsklemme');
  if (!versorgung) return wireCurrents;

  // Für jeden Verbraucher: Berechne Strom und finde Pfad zur Versorgung
  for (const verbraucher of verteiler.verbraucher) {
    if (!verbraucher.zugewieseneKomponente) continue;

    // Verwende erkannte Phasen statt manueller Zuweisung
    const effectivePhasen = getEffectivePhasen(verteiler, verbraucher);
    const phasenAnzahl = effectivePhasen.length;

    // Berechne Strom des Verbrauchers
    const leistung = verbraucher.leistung; // Watt

    let strom: number;
    if (phasenAnzahl === 3) {
      // Dreiphasig: I = P / (√3 × 400V)
      strom = leistung / (Math.sqrt(3) * 400);
    } else {
      // Einphasig: I = P / 230V
      strom = leistung / 230;
    }

    // Finde die zugewiesene Abgangsklemme
    const abgangsklemme = verteiler.komponenten.find(k => k.id === verbraucher.zugewieseneKomponente);
    if (!abgangsklemme || abgangsklemme.type !== 'abgangsklemme') continue;

    // Für jede Phase des Verbrauchers: Finde den Pfad zur Versorgung
    const verbraucherPhasen = effectivePhasen;

    for (const phase of verbraucherPhasen) {
      // Bei dreiphasig: Strom pro Phase ist I/3 (gleichmäßig verteilt)
      // Bei einphasig: voller Strom auf dieser Phase
      const stromProPhase = phasenAnzahl === 3 ? strom : strom;

      // Startpunkt: IN_<phase> der Abgangsklemme
      // WICHTIG: Bei einphasigen Verbrauchern (auf L2 oder L3) hat die 3-polige Abgangsklemme
      // nur ein IN_L1 Terminal. Die erkannte Phase (L2/L3) bezieht sich auf die Versorgung,
      // nicht auf das Terminal der Abgangsklemme.
      // Bei dreiphasigen Verbrauchern (5-polige Abgangsklemme) gibt es IN_L1, IN_L2, IN_L3.
      const startTerminal = phasenAnzahl === 1 ? 'IN_L1' : `IN_${phase}`;
      const startTerminalId = getTerminalId(abgangsklemme.id, startTerminal);

      // Finde alle Drähte auf dem Pfad zur Versorgung für diese Phase
      const wiresOnPath = findWiresOnPathToVersorgung(
        verteiler,
        adjacency,
        startTerminalId,
        versorgung.id,
        phase
      );

      // Addiere den Strom zu jedem Draht auf dem Pfad
      for (const wireId of wiresOnPath) {
        const currentStrom = wireCurrents.get(wireId) || 0;
        wireCurrents.set(wireId, currentStrom + stromProPhase);
      }
    }
  }

  return wireCurrents;
}

/**
 * Findet alle Draht-IDs auf dem Pfad von einem Start-Terminal zur Versorgungsklemme.
 * Nur Drähte der angegebenen Phase werden berücksichtigt.
 */
function findWiresOnPathToVersorgung(
  verteiler: Verteiler,
  adjacency: Map<string, string[]>,
  startTerminalId: string,
  versorgungId: string,
  phase: Phase
): string[] {
  const visited = new Set<string>();
  const queue: { terminalId: string; wireIds: string[] }[] = [
    { terminalId: startTerminalId, wireIds: [] }
  ];
  visited.add(startTerminalId);

  while (queue.length > 0) {
    const { terminalId: currentTerminal, wireIds } = queue.shift()!;
    const parsed = parseTerminalId(currentTerminal);

    // Haben wir die Versorgungsklemme erreicht?
    if (parsed.componentId === versorgungId) {
      return wireIds;
    }

    // Spezialfall: Verteilerklemme (type: 'klemme')
    const currentComponent = verteiler.komponenten.find(k => k.id === parsed.componentId);
    if (currentComponent && currentComponent.type === 'klemme') {
      const klemmeTerminals = ['TOP_0', 'BOT_0'];
      for (const termSuffix of klemmeTerminals) {
        const termId = getTerminalId(parsed.componentId, termSuffix);
        if (!visited.has(termId)) {
          visited.add(termId);
          queue.push({ terminalId: termId, wireIds: [...wireIds] });
        }
      }
    }

    // Alle Nachbarn besuchen
    const neighbors = adjacency.get(currentTerminal) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);

        // Prüfe ob es einen Wire gibt, der diese Terminals verbindet
        const wire = findWireBetweenTerminals(verteiler, currentTerminal, neighbor);
        const newWireIds = wire ? [...wireIds, wire.id] : [...wireIds];

        queue.push({ terminalId: neighbor, wireIds: newWireIds });
      }
    }
  }

  return []; // Kein Pfad gefunden
}

/**
 * Findet einen Wire zwischen zwei Terminals (falls vorhanden).
 */
function findWireBetweenTerminals(
  verteiler: Verteiler,
  terminal1: string,
  terminal2: string
): Wire | null {
  const parsed1 = parseTerminalId(terminal1);
  const parsed2 = parseTerminalId(terminal2);

  for (const wire of verteiler.verbindungen) {
    const vonId = getTerminalId(wire.von.componentId, wire.von.terminal);
    const nachId = getTerminalId(wire.nach.componentId, wire.nach.terminal);

    if ((vonId === terminal1 && nachId === terminal2) ||
        (vonId === terminal2 && nachId === terminal1)) {
      return wire;
    }
  }

  return null;
}

/**
 * Berechnet den Durchschnittsstrom für jeden Draht unter Berücksichtigung des GZF.
 *
 * Der Gleichzeitigkeitsfaktor (GZF) jedes Verbrauchers wird berücksichtigt.
 * Formel: Durchschnittsstrom = Maximalstrom × GZF
 */
export function calculateWireAverageCurrents(verteiler: Verteiler): Map<string, number> {
  const wireCurrents = new Map<string, number>();

  // Initialisiere alle Drähte mit 0
  for (const wire of verteiler.verbindungen) {
    wireCurrents.set(wire.id, 0);
  }

  // Baue Adjazenzliste für Pfadsuche
  const adjacency = buildTerminalAdjacency(verteiler);

  // Finde die Versorgungsklemme
  const versorgung = verteiler.komponenten.find(k => k.type === 'versorgungsklemme');
  if (!versorgung) return wireCurrents;

  // Für jeden Verbraucher: Berechne Strom mit GZF und finde Pfad zur Versorgung
  for (const verbraucher of verteiler.verbraucher) {
    if (!verbraucher.zugewieseneKomponente) continue;

    // Verwende erkannte Phasen statt manueller Zuweisung
    const effectivePhasen = getEffectivePhasen(verteiler, verbraucher);
    const phasenAnzahl = effectivePhasen.length;

    // Berechne Strom des Verbrauchers
    const leistung = verbraucher.leistung; // Watt
    const gzf = verbraucher.gleichzeitigkeitsfaktor || 1; // GZF (Standard: 1)

    let strom: number;
    if (phasenAnzahl === 3) {
      // Dreiphasig: I = P / (√3 × 400V)
      strom = leistung / (Math.sqrt(3) * 400);
    } else {
      // Einphasig: I = P / 230V
      strom = leistung / 230;
    }

    // Durchschnittsstrom = Maximalstrom × GZF
    const durchschnittsstrom = strom * gzf;

    // Finde die zugewiesene Abgangsklemme
    const abgangsklemme = verteiler.komponenten.find(k => k.id === verbraucher.zugewieseneKomponente);
    if (!abgangsklemme || abgangsklemme.type !== 'abgangsklemme') continue;

    // Für jede Phase des Verbrauchers: Finde den Pfad zur Versorgung
    const verbraucherPhasen = effectivePhasen;

    for (const phase of verbraucherPhasen) {
      const stromProPhase = phasenAnzahl === 3 ? durchschnittsstrom : durchschnittsstrom;

      // WICHTIG: Bei einphasigen Verbrauchern (auf L2 oder L3) hat die 3-polige Abgangsklemme
      // nur ein IN_L1 Terminal. Die erkannte Phase (L2/L3) bezieht sich auf die Versorgung.
      const startTerminal = phasenAnzahl === 1 ? 'IN_L1' : `IN_${phase}`;
      const startTerminalId = getTerminalId(abgangsklemme.id, startTerminal);

      const wiresOnPath = findWiresOnPathToVersorgung(
        verteiler,
        adjacency,
        startTerminalId,
        versorgung.id,
        phase
      );

      for (const wireId of wiresOnPath) {
        const currentStrom = wireCurrents.get(wireId) || 0;
        wireCurrents.set(wireId, currentStrom + stromProPhase);
      }
    }
  }

  return wireCurrents;
}

/**
 * Aktualisiert die Strom-Werte in den Wire-Objekten des Verteilers.
 * Gibt den aktualisierten Verteiler zurück.
 */
export function updateWireCurrentsInVerteiler(verteiler: Verteiler): Verteiler {
  const wireCurrents = calculateWireCurrents(verteiler);
  const wireAverageCurrents = calculateWireAverageCurrents(verteiler);

  const updatedVerbindungen = verteiler.verbindungen.map(wire => {
    // PE-Drähte bekommen keinen Strom
    if (wire.phase === 'PE') {
      return { ...wire, strom: 0, durchpihnittsstrom: 0 };
    }

    const strom = wireCurrents.get(wire.id) || 0;
    const durchpihnittsstrom = wireAverageCurrents.get(wire.id) || 0;
    return {
      ...wire,
      strom: Math.round(strom * 100) / 100,
      durchpihnittsstrom: Math.round(durchpihnittsstrom * 100) / 100
    };
  });

  return {
    ...verteiler,
    verbindungen: updatedVerbindungen
  };
}
