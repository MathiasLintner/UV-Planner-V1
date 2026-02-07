// ==========================================
// ELEKTRO-PLANER - DATENMODELLE
// ==========================================

// Phasen-Typen
export type Phase = 'L1' | 'L2' | 'L3' | 'N' | 'PE';

// Phasen-Farben gemäß ÖVE-Normen
export const PHASE_COLORS: Record<Phase, string> = {
  L1: '#8B4513', // Braun
  L2: '#000000', // Schwarz
  L3: '#808080', // Grau
  N: '#3B82F6',  // Blau
  PE: '#22C55E', // Grün-Gelb
};

// ==========================================
// KOMPONENTEN-TYPEN
// ==========================================

export type ComponentType =
  | 'fi-schalter'
  | 'ls-schalter'
  | 'fi-ls-kombi'
  | 'nh-sicherung'
  | 'schraub-sicherung'
  | 'neozed-sicherung'
  | 'sammelschiene'
  | 'zaehler'
  | 'schuetz'
  | 'klemme'
  | 'versorgungsklemme'
  | 'abgangsklemme';

// Netzsystem-Typen
export type Netzsystem = 'TN-C' | 'TN-S' | 'TN-C-S' | 'TT' | 'IT';

// Auslöse-Charakteristiken für LS-Schalter
export type LSCharakteristik = 'A' | 'B' | 'C' | 'D' | 'K' | 'Z';

// FI-Typen
export type FITyp = 'A' | 'AC' | 'B' | 'B+' | 'F';

// FI-Verzögerung
export type FIVerzoegerung = 'Standard' | 'G' | 'S';

// Sicherungs-Kennlinien (Betriebsklassen)
export type SicherungsKennlinie = 'gG' | 'gL' | 'aM' | 'aR' | 'gR' | 'gS';

// ==========================================
// KOMPONENTEN-PARAMETER
// ==========================================

export interface BaseComponentParams {
  id: string;
  type: ComponentType;
  name: string;
  position: {
    rail: number;      // Hutschienen-Index (0-4)
    slot: number;      // Position auf der Hutschiene (Teilungseinheiten)
  };
  teilungseinheiten: number; // Breite in TE (1 TE = 18mm)
  hasError?: boolean;
  errorMessages?: string[];
}

// FI-Schalter Parameter
export interface FISchalterParams extends BaseComponentParams {
  type: 'fi-schalter';
  bemessungsStrom: number;      // In [A]
  bemessungsFehlerstrom: number; // IΔn [mA] (30, 100, 300, 500)
  fiTyp: FITyp;
  polzahl: 2 | 4;               // 2-polig oder 4-polig
  verzoegerung: FIVerzoegerung; // Verzögerung: Standard, G (kurzverzögert), S (zeitverzögert)
}

// LS-Schalter Parameter
export interface LSSchalterParams extends BaseComponentParams {
  type: 'ls-schalter';
  bemessungsStrom: number;      // In [A]
  charakteristik: LSCharakteristik;
  polzahl: 1 | 2 | 3 | 4;
  kurzschlussSchaltvermoegen: number; // Ik [kA]
}

// FI/LS-Kombination Parameter
export interface FILSKombiParams extends BaseComponentParams {
  type: 'fi-ls-kombi';
  bemessungsStrom: number;      // In [A]
  bemessungsFehlerstrom: number; // IΔn [mA]
  fiTyp: FITyp;
  verzoegerung: FIVerzoegerung; // Verzögerung: Standard, G (kurzverzögert), S (zeitverzögert)
  charakteristik: LSCharakteristik;
  polzahl: 1 | 2 | 3 | 4;
  kurzschlussSchaltvermoegen: number;
}

// NH-Sicherung Parameter
export interface NHSicherungParams extends BaseComponentParams {
  type: 'nh-sicherung';
  bemessungsStrom: number;      // In [A]
  groesse: '00' | '0' | '1' | '2' | '3';
  betriebsklasse: 'gG' | 'gL' | 'aM' | 'aR';
}

// Schraub-Sicherung Parameter
export interface SchraubSicherungParams extends BaseComponentParams {
  type: 'schraub-sicherung';
  bemessungsStrom: number;      // In [A]
  groesse: 'D01' | 'D02' | 'D03' | 'DIII';
}

// Sammelschiene Parameter
export interface SammelSchieneParams extends BaseComponentParams {
  type: 'sammelschiene';
  phase: Phase;
  laenge: number;               // Länge in TE
  querschnitt: number;          // mm²
}

// Zähler Parameter
export interface ZaehlerParams extends BaseComponentParams {
  type: 'zaehler';
  art: 'ferraris' | 'elektronisch' | 'smart-meter';
  phasen: 1 | 3;
}

// Neozed-Sicherung Parameter
export interface NeozedSicherungParams extends BaseComponentParams {
  type: 'neozed-sicherung';
  bemessungsStrom: number;      // In [A]
  kennlinie: SicherungsKennlinie;
  polzahl: 1 | 3;               // 1-polig (1 TE) oder 3-polig (3 TE)
}

// Schütz Parameter
export interface SchuetzParams extends BaseComponentParams {
  type: 'schuetz';
  bemessungsStrom: number;
  spulenSpannung: number;       // [V]
  polzahl: 1 | 2 | 3 | 4;
}

// Klemme Parameter
export interface KlemmeParams extends BaseComponentParams {
  type: 'klemme';
  phase: Phase;
  querschnitt: number;          // max. mm²
}

// Versorgungsanschlussklemme Parameter
export interface VersorgungsklemmeParams extends BaseComponentParams {
  type: 'versorgungsklemme';
  spannung: number;             // Nennspannung [V] (230/400)
  kurzschlussStrom: number;     // Ik [kA] am Einspeisepunkt
  schleifenimpedanz: number;    // Zs [Ω] Schleifenimpedanz
  netzsystem: Netzsystem;       // TN-C, TN-S, TN-C-S, TT, IT
}

// Abgangsklemme Parameter
export interface AbgangsklemmeParams extends BaseComponentParams {
  type: 'abgangsklemme';
  polzahl: 3 | 5;               // 3-polig (TE 2) oder 5-polig (TE 4)
  querschnitt: number;          // max. mm²
  zugewieseneVerbraucher: string[]; // IDs der zugewiesenen Verbraucher
}

// Union-Typ für alle Komponenten
export type ElektroComponent =
  | FISchalterParams
  | LSSchalterParams
  | FILSKombiParams
  | NHSicherungParams
  | SchraubSicherungParams
  | NeozedSicherungParams
  | SammelSchieneParams
  | ZaehlerParams
  | SchuetzParams
  | KlemmeParams
  | VersorgungsklemmeParams
  | AbgangsklemmeParams;

// ==========================================
// VERBRAUCHER
// ==========================================

export type VerbraucherTyp =
  | 'licht'
  | 'steckdose'
  | 'herd'
  | 'backofen'
  | 'kuehlschrank'
  | 'waschmaschine'
  | 'trockner'
  | 'geschirrspueler'
  | 'warmwasser'
  | 'heizung'
  | 'klimaanlage'
  | 'wallbox'
  | 'sonstige';

export interface Verbraucher {
  id: string;
  name: string;
  typ: VerbraucherTyp;
  leistung: number;             // [W]
  spannung: number;             // [V]
  phasen: Phase[];              // Angeschlossene Phasen
  gleichzeitigkeitsfaktor: number; // 0-1
  gruppe?: string;              // Optionale Gruppierung
  zugewieseneKomponente?: string; // ID der zugewiesenen Schutzeinrichtung (LS oder Abgangsklemme)
  leitungslaenge?: number;      // Leitungslänge in [m]
  leitungsquerschnitt?: number; // Leitungsquerschnitt in [mm²]
}

// Default-Werte für Verbraucher
export const VERBRAUCHER_DEFAULTS: Record<VerbraucherTyp, { leistung: number; spannung: number }> = {
  licht: { leistung: 100, spannung: 230 },
  steckdose: { leistung: 3680, spannung: 230 },
  herd: { leistung: 11000, spannung: 400 },
  backofen: { leistung: 3500, spannung: 230 },
  kuehlschrank: { leistung: 150, spannung: 230 },
  waschmaschine: { leistung: 2200, spannung: 230 },
  trockner: { leistung: 2500, spannung: 230 },
  geschirrspueler: { leistung: 2200, spannung: 230 },
  warmwasser: { leistung: 2000, spannung: 230 },
  heizung: { leistung: 2000, spannung: 230 },
  klimaanlage: { leistung: 3000, spannung: 230 },
  wallbox: { leistung: 11000, spannung: 400 },
  sonstige: { leistung: 1000, spannung: 230 },
};

// Verfügbare Leitungsquerschnitte in mm² (gemäß ÖVE)
export const VERFUEGBARE_QUERSCHNITTE = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120];

// ==========================================
// VERDRAHTUNG / VERBINDUNGEN
// ==========================================

export interface ConnectionPoint {
  componentId: string;
  terminal: string;             // z.B. 'IN_L1', 'OUT_L1', 'N', 'PE'
  phase: Phase;
}

// Wegpunkt für freie Drahtführung
export interface WireWaypoint {
  x: number;
  y: number;
}

export interface Wire {
  id: string;
  von: ConnectionPoint;
  nach: ConnectionPoint;
  waypoints: WireWaypoint[];    // Zwischenpunkte für freie Drahtführung
  querschnitt: number;          // [mm²]
  laenge: number;               // [m]
  phase: Phase;
  material: 'Cu' | 'Al';
  strom?: number;               // Berechneter Maximalstrom [A] - wird bei Validierung gesetzt
  durchpihnittsstrom?: number;   // Berechneter Durchschnittsstrom mit GZF [A]
}

// ==========================================
// VERTEILER (HAUPTMODELL)
// ==========================================

export interface Hutschiene {
  id: string;
  index: number;                // 0-4
  slots: number;                // Anzahl TE (typisch 12, 18, 24)
}

export interface Verteiler {
  id: string;
  name: string;
  beschreibung?: string;
  hutschienen: Hutschiene[];
  komponenten: ElektroComponent[];
  verbraucher: Verbraucher[];
  verbindungen: Wire[];
  nennspannung: number;         // [V]
  nennstrom: number;            // [A] Hauptsicherung
  kurzschlussStrom: number;     // [kA] am Einspeisepunkt
}

// ==========================================
// VALIDIERUNG / FEHLER
// ==========================================

export type FehlerTyp =
  | 'ueberlast'
  | 'ueberstrom'
  | 'kurzschluss'
  | 'selektivitaet'
  | 'spannungsfall'
  | 'schleifenimpedanz'
  | 'phasensymmetrie'
  | 'fehlende-verbindung'
  | 'doppelbelegung'
  | 'falsche-dimensionierung'
  | 'fehlerstrom'
  | 'erdung'
  | 'drehfeld'
  | 'fehlende-schutzeinrichtung';

export interface ValidationError {
  id: string;
  typ: FehlerTyp;
  komponenteId: string;
  komponenteName: string;
  beschreibung: string;
  hinweis: string;
  schweregrad: 'info' | 'warnung' | 'fehler' | 'kritisch';
}

// Stromkreis-Validierungsergebnis
export interface StromkreisResult {
  verbraucherId: string;
  verbraucherName: string;
  status: 'ok' | 'warnung' | 'fehler';
  berechnungen: {
    leistung: number;          // [W]
    strom: number;             // [A]
    spannungsfall?: number;    // [%]
    leitungslaenge?: number;   // [m]
    querschnitt?: number;      // [mm²]
    schleifenimpedanz?: number; // [mΩ] - Schleifenimpedanz bis zum Verbraucher
  };
  fehler: ValidationError[];
  warnungen: ValidationError[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  stromkreise: StromkreisResult[];  // Ergebnisse pro Verbraucher/Stromkreis
  berechnungen: {
    gesamtLeistung: number;
    spannungsfall: number;
    schleifenimpedanz: number;
    phasenLasten: Record<Phase, number>;
  };
}

// ==========================================
// UI STATE
// ==========================================

export interface UIState {
  selectedComponentId: string | null;
  selectedVerbraucherId: string | null;
  selectedWireId: string | null;
  wiringMode: boolean;
  wiringOrthoMode: boolean;  // Ortho-Modus: nur horizontale/vertikale Linien beim Drahtziehen
  wiringStart: ConnectionPoint | null;
  wiringWaypoints: WireWaypoint[];  // Aktuelle Zwischenpunkte während der Verdrahtung
  selectedPhase: Phase;
  zoom: number;
  panOffset: { x: number; y: number };
  showErrors: boolean;
  activeTab: 'komponenten' | 'verbraucher' | 'pruefung';
}

// ==========================================
// PROJEKT-SPEICHERUNG
// ==========================================

export interface ProjectState {
  version: string;
  lastModified: string;
  verteiler: Verteiler;
  uiState: Partial<UIState>;
}

// ==========================================
// DRAG & DROP
// ==========================================

export interface DragItem {
  type: 'component' | 'verbraucher';
  componentType?: ComponentType;
  variantId?: string;           // Varianten-ID für neue Komponenten
  verbraucherTyp?: VerbraucherTyp;
  sourceId?: string;            // Falls bereits platziert
}

export interface DropResult {
  rail: number;
  slot: number;
}

// ==========================================
// KOMPONENTEN-BIBLIOTHEK DEFINITIONEN
// ==========================================

export interface ComponentLibraryItem {
  type: ComponentType;
  variantId: string; // Eindeutige ID für die Variante (z.B. 'ls-1p', 'ls-3p')
  name: string;
  beschreibung: string;
  icon: string;
  teilungseinheiten: number;
  defaultParams: Partial<ElektroComponent>;
  kategorie: 'schutz' | 'sicherung' | 'schaltung' | 'verteilung' | 'sonstige';
}

export const COMPONENT_LIBRARY: ComponentLibraryItem[] = [
  // ==========================================
  // FI-SCHALTER (2-polig und 4-polig)
  // ==========================================
  {
    type: 'fi-schalter',
    variantId: 'fi-2p',
    name: 'FI 2-polig',
    beschreibung: 'FI-Schalter 2-polig (L+N)',
    icon: 'FI',
    teilungseinheiten: 2,
    defaultParams: {
      bemessungsStrom: 40,
      bemessungsFehlerstrom: 30,
      fiTyp: 'A',
      polzahl: 2,
      verzoegerung: 'Standard',
    },
    kategorie: 'schutz',
  },
  {
    type: 'fi-schalter',
    variantId: 'fi-4p',
    name: 'FI 4-polig',
    beschreibung: 'FI-Schalter 4-polig (3L+N)',
    icon: 'FI',
    teilungseinheiten: 4,
    defaultParams: {
      bemessungsStrom: 40,
      bemessungsFehlerstrom: 30,
      fiTyp: 'A',
      polzahl: 4,
      verzoegerung: 'Standard',
    },
    kategorie: 'schutz',
  },
  // ==========================================
  // LS-SCHALTER (1-4 polig)
  // ==========================================
  {
    type: 'ls-schalter',
    variantId: 'ls-1p',
    name: 'LS 1-polig',
    beschreibung: 'LS-Schalter 1-polig',
    icon: 'LS',
    teilungseinheiten: 1,
    defaultParams: {
      bemessungsStrom: 16,
      charakteristik: 'B',
      polzahl: 1,
      kurzschlussSchaltvermoegen: 6,
    },
    kategorie: 'schutz',
  },
  {
    type: 'ls-schalter',
    variantId: 'ls-2p',
    name: 'LS 2-polig',
    beschreibung: 'LS-Schalter 2-polig (L+N)',
    icon: 'LS',
    teilungseinheiten: 2,
    defaultParams: {
      bemessungsStrom: 16,
      charakteristik: 'B',
      polzahl: 2,
      kurzschlussSchaltvermoegen: 6,
    },
    kategorie: 'schutz',
  },
  {
    type: 'ls-schalter',
    variantId: 'ls-3p',
    name: 'LS 3-polig',
    beschreibung: 'LS-Schalter 3-polig (3L)',
    icon: 'LS',
    teilungseinheiten: 3,
    defaultParams: {
      bemessungsStrom: 16,
      charakteristik: 'C',
      polzahl: 3,
      kurzschlussSchaltvermoegen: 6,
    },
    kategorie: 'schutz',
  },
  {
    type: 'ls-schalter',
    variantId: 'ls-4p',
    name: 'LS 4-polig',
    beschreibung: 'LS-Schalter 4-polig (3L+N)',
    icon: 'LS',
    teilungseinheiten: 4,
    defaultParams: {
      bemessungsStrom: 16,
      charakteristik: 'C',
      polzahl: 4,
      kurzschlussSchaltvermoegen: 6,
    },
    kategorie: 'schutz',
  },
  // ==========================================
  // FI/LS-KOMBINATION (1P+N bis 4-polig)
  // ==========================================
  {
    type: 'fi-ls-kombi',
    variantId: 'fils-1pn',
    name: 'FI/LS 1P+N',
    beschreibung: 'FI/LS-Kombi 1-polig+N',
    icon: 'FI/LS',
    teilungseinheiten: 2,
    defaultParams: {
      bemessungsStrom: 16,
      bemessungsFehlerstrom: 30,
      fiTyp: 'A',
      verzoegerung: 'Standard',
      charakteristik: 'B',
      polzahl: 1,
      kurzschlussSchaltvermoegen: 6,
    },
    kategorie: 'schutz',
  },
  {
    type: 'fi-ls-kombi',
    variantId: 'fils-3pn',
    name: 'FI/LS 3P+N',
    beschreibung: 'FI/LS-Kombi 3-polig+N',
    icon: 'FI/LS',
    teilungseinheiten: 4,
    defaultParams: {
      bemessungsStrom: 16,
      bemessungsFehlerstrom: 30,
      fiTyp: 'A',
      verzoegerung: 'Standard',
      charakteristik: 'C',
      polzahl: 3,
      kurzschlussSchaltvermoegen: 6,
    },
    kategorie: 'schutz',
  },
  // ==========================================
  // SICHERUNGEN
  // ==========================================
  {
    type: 'nh-sicherung',
    variantId: 'nh',
    name: 'NH-Sicherung',
    beschreibung: 'NH-Sicherung 3-polig',
    icon: 'NH',
    teilungseinheiten: 5,
    defaultParams: {
      bemessungsStrom: 63,
      groesse: '00',
      betriebsklasse: 'gG',
    },
    kategorie: 'sicherung',
  },
  {
    type: 'schraub-sicherung',
    variantId: 'diazed',
    name: 'Schraub-Sicherung',
    beschreibung: 'Diazed/Neozed Sicherung',
    icon: 'D',
    teilungseinheiten: 1,
    defaultParams: {
      bemessungsStrom: 16,
      groesse: 'D02',
    },
    kategorie: 'sicherung',
  },
  {
    type: 'neozed-sicherung',
    variantId: 'neozed-1p',
    name: 'Neozed 1-polig',
    beschreibung: 'Neozed-Sicherung 1-polig',
    icon: 'N',
    teilungseinheiten: 2,
    defaultParams: {
      bemessungsStrom: 16,
      kennlinie: 'gG',
      polzahl: 1,
    },
    kategorie: 'sicherung',
  },
  {
    type: 'neozed-sicherung',
    variantId: 'neozed-3p',
    name: 'Neozed 3-polig',
    beschreibung: 'Neozed-Sicherung 3-polig (Dreifach)',
    icon: 'N',
    teilungseinheiten: 5,
    defaultParams: {
      bemessungsStrom: 16,
      kennlinie: 'gG',
      polzahl: 3,
    },
    kategorie: 'sicherung',
  },
  // ==========================================
  // VERTEILUNG
  // ==========================================
  {
    type: 'sammelschiene',
    variantId: 'sammelschiene-l1',
    name: 'Sammelschiene L1',
    beschreibung: 'Sammelschiene Phase L1 (Braun)',
    icon: '═',
    teilungseinheiten: 2,
    defaultParams: {
      phase: 'L1',
      laenge: 2,
      querschnitt: 16,
    },
    kategorie: 'verteilung',
  },
  {
    type: 'sammelschiene',
    variantId: 'sammelschiene-n',
    name: 'Sammelschiene N',
    beschreibung: 'Sammelschiene Neutralleiter (Blau)',
    icon: '═',
    teilungseinheiten: 2,
    defaultParams: {
      phase: 'N',
      laenge: 2,
      querschnitt: 16,
    },
    kategorie: 'verteilung',
  },
  {
    type: 'sammelschiene',
    variantId: 'sammelschiene-pe',
    name: 'Sammelschiene PE',
    beschreibung: 'Sammelschiene Schutzleiter (Grün/Gelb)',
    icon: '═',
    teilungseinheiten: 2,
    defaultParams: {
      phase: 'PE',
      laenge: 2,
      querschnitt: 16,
    },
    kategorie: 'verteilung',
  },
  // ==========================================
  // KLEMMEN
  // ==========================================
  {
    type: 'klemme',
    variantId: 'klemme-l',
    name: 'Klemme L',
    beschreibung: 'Reihenklemme für Phase',
    icon: '┬',
    teilungseinheiten: 1,
    defaultParams: {
      phase: 'L1',
      querschnitt: 16,
    },
    kategorie: 'verteilung',
  },
  {
    type: 'klemme',
    variantId: 'klemme-n',
    name: 'Klemme N',
    beschreibung: 'Reihenklemme für Neutralleiter',
    icon: '┬',
    teilungseinheiten: 1,
    defaultParams: {
      phase: 'N',
      querschnitt: 16,
    },
    kategorie: 'verteilung',
  },
  {
    type: 'klemme',
    variantId: 'klemme-pe',
    name: 'Klemme PE',
    beschreibung: 'Reihenklemme für Schutzleiter',
    icon: '┬',
    teilungseinheiten: 1,
    defaultParams: {
      phase: 'PE',
      querschnitt: 16,
    },
    kategorie: 'verteilung',
  },
  {
    type: 'versorgungsklemme',
    variantId: 'versorgungsklemme',
    name: 'Versorgungsklemme',
    beschreibung: 'Netzanschlussklemme mit Versorgungsdaten',
    icon: '⚡',
    teilungseinheiten: 4,
    defaultParams: {
      spannung: 400,
      kurzschlussStrom: 6,
      schleifenimpedanz: 0.5,
      netzsystem: 'TN-C-S',
    },
    kategorie: 'verteilung',
  },
  {
    type: 'abgangsklemme',
    variantId: 'abgangsklemme-3p',
    name: 'Abgangsklemme 3-polig',
    beschreibung: 'Abgangsklemme 3-polig (L+N+PE) - TE 2',
    icon: '⊣',
    teilungseinheiten: 2,
    defaultParams: {
      polzahl: 3,
      querschnitt: 16,
      zugewieseneVerbraucher: [],
    },
    kategorie: 'verteilung',
  },
  {
    type: 'abgangsklemme',
    variantId: 'abgangsklemme-5p',
    name: 'Abgangsklemme 5-polig',
    beschreibung: 'Abgangsklemme 5-polig (L1+L2+L3+N+PE) - TE 4',
    icon: '⊣',
    teilungseinheiten: 4,
    defaultParams: {
      polzahl: 5,
      querschnitt: 16,
      zugewieseneVerbraucher: [],
    },
    kategorie: 'verteilung',
  },
  // ==========================================
  // ZÄHLER
  // ==========================================
  {
    type: 'zaehler',
    variantId: 'zaehler-1p',
    name: 'Zähler 1-phasig',
    beschreibung: 'Stromzähler 1-phasig',
    icon: 'kWh',
    teilungseinheiten: 4,
    defaultParams: {
      art: 'elektronisch',
      phasen: 1,
    },
    kategorie: 'sonstige',
  },
  {
    type: 'zaehler',
    variantId: 'zaehler-3p',
    name: 'Zähler 3-phasig',
    beschreibung: 'Stromzähler 3-phasig',
    icon: 'kWh',
    teilungseinheiten: 5,
    defaultParams: {
      art: 'elektronisch',
      phasen: 3,
    },
    kategorie: 'sonstige',
  },
  // ==========================================
  // SCHALTGERÄTE
  // ==========================================
  {
    type: 'schuetz',
    variantId: 'schuetz-3p',
    name: 'Schütz 3-polig',
    beschreibung: 'Leistungsschütz 3-polig',
    icon: 'K',
    teilungseinheiten: 3,
    defaultParams: {
      bemessungsStrom: 25,
      spulenSpannung: 230,
      polzahl: 3,
    },
    kategorie: 'schaltung',
  },
];
