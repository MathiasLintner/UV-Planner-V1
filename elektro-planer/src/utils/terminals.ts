import type { ElektroComponent, Phase } from '../types';

// ==========================================
// TERMINAL-DEFINITIONEN
// ==========================================

export interface Terminal {
  id: string;           // z.B. "IN_L1", "OUT_N"
  label: string;        // Beschriftung
  phase: Phase;
  position: 'top' | 'bottom';
  offsetX: number;      // Position relativ zur Komponente (0-1)
}

// Gibt alle Terminals einer Komponente zurück
export function getComponentTerminals(component: ElektroComponent): Terminal[] {
  switch (component.type) {
    case 'ls-schalter':
      return getLSTerminals(component.polzahl);

    case 'fi-schalter':
      return getFITerminals(component.polzahl);

    case 'fi-ls-kombi':
      return getFILSTerminals(component.polzahl);

    case 'nh-sicherung':
      return getNHTerminals();

    case 'schraub-sicherung':
      return getSchraubSicherungTerminals();

    case 'neozed-sicherung':
      return getNeozedSicherungTerminals(component.polzahl);

    case 'sammelschiene':
      return getSammelSchieneTerminals(component.phase, component.teilungseinheiten);

    case 'zaehler':
      return getZaehlerTerminals(component.phasen);

    case 'schuetz':
      return getSchuetzTerminals(component.polzahl);

    case 'klemme':
      return getKlemmeTerminals(component.phase);

    case 'versorgungsklemme':
      return getVersorgungsklemmeTerminals();

    case 'abgangsklemme':
      return getAbgangsklemmeTerminals(component.polzahl);

    case 'ueberspannungsschutz':
      return getSPDTerminals(component.systemTyp, component.polzahl);

    default:
      return [];
  }
}

// ==========================================
// LS-SCHALTER TERMINALS
// ==========================================
function getLSTerminals(polzahl: 1 | 2 | 3 | 4): Terminal[] {
  const terminals: Terminal[] = [];
  // Für 2-polig: L1 + N (wie beim FI), für 3/4-polig: L1, L2, L3, N
  const phases: Phase[] = polzahl === 2 ? ['L1', 'N'] : ['L1', 'L2', 'L3', 'N'];

  for (let i = 0; i < polzahl; i++) {
    const phase = polzahl === 1 ? 'L1' : phases[i];
    const offsetX = (i + 0.5) / polzahl;

    terminals.push({
      id: `IN_${phase}`,
      label: phase,
      phase,
      position: 'top',
      offsetX,
    });

    terminals.push({
      id: `OUT_${phase}`,
      label: phase,
      phase,
      position: 'bottom',
      offsetX,
    });
  }

  return terminals;
}

// ==========================================
// FI-SCHALTER TERMINALS
// ==========================================
function getFITerminals(polzahl: 2 | 4): Terminal[] {
  const terminals: Terminal[] = [];

  if (polzahl === 2) {
    // 2-polig: L und N
    terminals.push(
      { id: 'IN_L1', label: 'L', phase: 'L1', position: 'top', offsetX: 0.25 },
      { id: 'IN_N', label: 'N', phase: 'N', position: 'top', offsetX: 0.75 },
      { id: 'OUT_L1', label: 'L', phase: 'L1', position: 'bottom', offsetX: 0.25 },
      { id: 'OUT_N', label: 'N', phase: 'N', position: 'bottom', offsetX: 0.75 }
    );
  } else {
    // 4-polig: L1, L2, L3, N
    const phases: [Phase, string][] = [['L1', '1'], ['L2', '3'], ['L3', '5'], ['N', 'N']];
    phases.forEach(([phase, label], i) => {
      const offsetX = (i + 0.5) / 4;
      terminals.push(
        { id: `IN_${phase}`, label, phase, position: 'top', offsetX },
        { id: `OUT_${phase}`, label, phase, position: 'bottom', offsetX }
      );
    });
  }

  return terminals;
}

// ==========================================
// FI/LS-KOMBINATION TERMINALS
// ==========================================
function getFILSTerminals(polzahl: 1 | 2 | 3 | 4): Terminal[] {
  const terminals: Terminal[] = [];

  if (polzahl === 1 || polzahl === 2) {
    // 1P+N oder 2-polig
    terminals.push(
      { id: 'IN_L1', label: 'L', phase: 'L1', position: 'top', offsetX: 0.25 },
      { id: 'IN_N', label: 'N', phase: 'N', position: 'top', offsetX: 0.75 },
      { id: 'OUT_L1', label: 'L', phase: 'L1', position: 'bottom', offsetX: 0.25 },
      { id: 'OUT_N', label: 'N', phase: 'N', position: 'bottom', offsetX: 0.75 }
    );
  } else if (polzahl === 3) {
    // 3P+N
    const phases: [Phase, string][] = [['L1', '1'], ['L2', '3'], ['L3', '5'], ['N', 'N']];
    phases.forEach(([phase, label], i) => {
      const offsetX = (i + 0.5) / 4;
      terminals.push(
        { id: `IN_${phase}`, label, phase, position: 'top', offsetX },
        { id: `OUT_${phase}`, label, phase, position: 'bottom', offsetX }
      );
    });
  } else {
    // 4-polig
    const phases: [Phase, string][] = [['L1', '1'], ['L2', '3'], ['L3', '5'], ['N', 'N']];
    phases.forEach(([phase, label], i) => {
      const offsetX = (i + 0.5) / 4;
      terminals.push(
        { id: `IN_${phase}`, label, phase, position: 'top', offsetX },
        { id: `OUT_${phase}`, label, phase, position: 'bottom', offsetX }
      );
    });
  }

  return terminals;
}

// ==========================================
// NH-SICHERUNG TERMINALS (3-polig)
// ==========================================
function getNHTerminals(): Terminal[] {
  const phases: Phase[] = ['L1', 'L2', 'L3'];
  const terminals: Terminal[] = [];

  phases.forEach((phase, i) => {
    const offsetX = (i + 0.5) / 3;
    terminals.push(
      { id: `IN_${phase}`, label: phase, phase, position: 'top', offsetX },
      { id: `OUT_${phase}`, label: phase, phase, position: 'bottom', offsetX }
    );
  });

  return terminals;
}

// ==========================================
// SCHRAUB-SICHERUNG TERMINALS (1-polig)
// ==========================================
function getSchraubSicherungTerminals(): Terminal[] {
  return [
    { id: 'IN_L1', label: 'L', phase: 'L1', position: 'top', offsetX: 0.5 },
    { id: 'OUT_L1', label: 'L', phase: 'L1', position: 'bottom', offsetX: 0.5 },
  ];
}

// ==========================================
// NEOZED-SICHERUNG TERMINALS (1-polig oder 3-polig)
// ==========================================
function getNeozedSicherungTerminals(polzahl: 1 | 3): Terminal[] {
  const terminals: Terminal[] = [];
  const phases: Phase[] = ['L1', 'L2', 'L3'];

  for (let i = 0; i < polzahl; i++) {
    const phase = phases[i];
    const offsetX = (i + 0.5) / polzahl;

    terminals.push(
      { id: `IN_${phase}`, label: phase, phase, position: 'top', offsetX },
      { id: `OUT_${phase}`, label: phase, phase, position: 'bottom', offsetX }
    );
  }

  return terminals;
}

// ==========================================
// SAMMELSCHIENE TERMINALS
// ==========================================
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

// ==========================================
// ZÄHLER TERMINALS
// ==========================================
function getZaehlerTerminals(phasen: 1 | 3): Terminal[] {
  const terminals: Terminal[] = [];

  if (phasen === 1) {
    terminals.push(
      { id: 'IN_L1', label: 'L', phase: 'L1', position: 'top', offsetX: 0.25 },
      { id: 'IN_N', label: 'N', phase: 'N', position: 'top', offsetX: 0.75 },
      { id: 'OUT_L1', label: 'L', phase: 'L1', position: 'bottom', offsetX: 0.25 },
      { id: 'OUT_N', label: 'N', phase: 'N', position: 'bottom', offsetX: 0.75 }
    );
  } else {
    // 3-phasig mit N
    const phases: [Phase, string][] = [['L1', '1'], ['L2', '4'], ['L3', '7'], ['N', '10']];
    phases.forEach(([phase, label], i) => {
      const offsetX = (i + 0.5) / 4;
      terminals.push(
        { id: `IN_${phase}`, label, phase, position: 'top', offsetX },
        { id: `OUT_${phase}`, label: String(Number(label) + 1), phase, position: 'bottom', offsetX }
      );
    });
  }

  return terminals;
}

// ==========================================
// SCHÜTZ TERMINALS
// ==========================================
function getSchuetzTerminals(polzahl: 1 | 2 | 3 | 4): Terminal[] {
  const terminals: Terminal[] = [];
  const phases = (['L1', 'L2', 'L3', 'N'] as Phase[]).slice(0, polzahl);

  // Hauptkontakte
  phases.forEach((phase, i) => {
    const offsetX = (i + 0.5) / (polzahl + 1); // +1 für Spule
    terminals.push(
      { id: `IN_${phase}`, label: phase, phase, position: 'top', offsetX },
      { id: `OUT_${phase}`, label: phase, phase, position: 'bottom', offsetX }
    );
  });

  // Spulenanschlüsse (A1, A2)
  terminals.push(
    { id: 'A1', label: 'A1', phase: 'L1', position: 'top', offsetX: (polzahl + 0.5) / (polzahl + 1) },
    { id: 'A2', label: 'A2', phase: 'N', position: 'bottom', offsetX: (polzahl + 0.5) / (polzahl + 1) }
  );

  return terminals;
}

// ==========================================
// KLEMME TERMINALS (1 TE: 1 Anschluss oben und unten)
// ==========================================
function getKlemmeTerminals(phase: Phase): Terminal[] {
  return [
    // 1 Anschluss oben
    { id: 'TOP_0', label: '1', phase, position: 'top', offsetX: 0.5 },
    // 1 Anschluss unten
    { id: 'BOT_0', label: '1', phase, position: 'bottom', offsetX: 0.5 },
  ];
}

// ==========================================
// VERSORGUNGSKLEMME TERMINALS (L1, L2, L3, N, PE)
// ==========================================
function getVersorgungsklemmeTerminals(): Terminal[] {
  // 5 Anschlüsse: L1, L2, L3, N, PE - nur unten (Ausgang zur Verteilung)
  const phases: [Phase, string][] = [['L1', 'L1'], ['L2', 'L2'], ['L3', 'L3'], ['N', 'N'], ['PE', 'PE']];
  const terminals: Terminal[] = [];

  phases.forEach(([phase, label], i) => {
    const offsetX = (i + 0.5) / 5;
    terminals.push(
      { id: `OUT_${phase}`, label, phase, position: 'bottom', offsetX }
    );
  });

  return terminals;
}

// ==========================================
// ABGANGSKLEMME TERMINALS (3-polig oder 5-polig)
// ==========================================
function getAbgangsklemmeTerminals(polzahl: 3 | 5): Terminal[] {
  const terminals: Terminal[] = [];

  if (polzahl === 3) {
    // 3-polig: L, N, PE (oben Eingang, unten Ausgang zum Verbraucher)
    const phases: [Phase, string][] = [['L1', 'L'], ['N', 'N'], ['PE', 'PE']];
    phases.forEach(([phase, label], i) => {
      const offsetX = (i + 0.5) / 3;
      terminals.push(
        { id: `IN_${phase}`, label, phase, position: 'top', offsetX },
        { id: `OUT_${phase}`, label, phase, position: 'bottom', offsetX }
      );
    });
  } else {
    // 5-polig: L1, L2, L3, N, PE (oben Eingang, unten Ausgang zum Verbraucher)
    const phases: [Phase, string][] = [['L1', 'L1'], ['L2', 'L2'], ['L3', 'L3'], ['N', 'N'], ['PE', 'PE']];
    phases.forEach(([phase, label], i) => {
      const offsetX = (i + 0.5) / 5;
      terminals.push(
        { id: `IN_${phase}`, label, phase, position: 'top', offsetX },
        { id: `OUT_${phase}`, label, phase, position: 'bottom', offsetX }
      );
    });
  }

  return terminals;
}

// ==========================================
// ÜBERSPANNUNGSSCHUTZ (SPD) TERMINALS
// ==========================================
function getSPDTerminals(systemTyp: 'AC' | 'DC', polzahl: 2 | 3): Terminal[] {
  const terminals: Terminal[] = [];

  if (polzahl === 3 || systemTyp === 'AC') {
    // AC 3-polig: L1, L2, L3
    const phases: Phase[] = ['L1', 'L2', 'L3'];
    phases.forEach((phase, i) => {
      const offsetX = (i + 0.5) / 3;
      terminals.push(
        { id: `IN_${phase}`, label: phase, phase, position: 'top', offsetX },
        { id: `OUT_${phase}`, label: phase, phase, position: 'bottom', offsetX }
      );
    });
  } else {
    // DC 2-polig: Plus (+) und Minus (-)
    // Verwende L1 für Plus und N für Minus (Mapping auf existierende Phasen)
    terminals.push(
      { id: 'IN_PLUS', label: '+', phase: 'L1', position: 'top', offsetX: 0.25 },
      { id: 'IN_MINUS', label: '-', phase: 'N', position: 'top', offsetX: 0.75 },
      { id: 'OUT_PLUS', label: '+', phase: 'L1', position: 'bottom', offsetX: 0.25 },
      { id: 'OUT_MINUS', label: '-', phase: 'N', position: 'bottom', offsetX: 0.75 }
    );
  }

  return terminals;
}

// ==========================================
// HELPER: Berechne Pixel-Position eines Terminals
// ==========================================
export function getTerminalPosition(
  terminal: Terminal,
  componentX: number,
  componentY: number,
  componentWidth: number,
  componentHeight: number
): { x: number; y: number } {
  return {
    x: componentX + terminal.offsetX * componentWidth,
    y: terminal.position === 'top' ? componentY : componentY + componentHeight,
  };
}
