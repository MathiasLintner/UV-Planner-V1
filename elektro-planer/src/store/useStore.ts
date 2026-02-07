import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type {
  Verteiler,
  ElektroComponent,
  Verbraucher,
  Wire,
  ConnectionPoint,
  WireWaypoint,
  UIState,
  ValidationResult,
  Phase,
  Hutschiene,
} from '../types';
import { validateVerteiler } from '../utils/validation';
import { updateWireCurrentsInVerteiler } from '../utils/circuitGraph';

// ==========================================
// STORE INTERFACE
// ==========================================

interface AppState {
  // Verteiler-Daten
  verteiler: Verteiler;

  // UI-Zustand
  ui: UIState;

  // Validierungsergebnis
  validationResult: ValidationResult | null;

  // Aktionen - Verteiler
  setVerteiler: (verteiler: Verteiler) => void;
  updateVerteilerInfo: (info: Partial<Pick<Verteiler, 'name' | 'beschreibung' | 'nennspannung' | 'nennstrom' | 'kurzschlussStrom'>>) => void;
  addHutschiene: () => void;
  removeHutschiene: (index: number) => void;

  // Aktionen - Komponenten
  addComponent: (component: ElektroComponent) => void;
  updateComponent: (id: string, updates: Partial<ElektroComponent>) => void;
  removeComponent: (id: string) => void;
  moveComponent: (id: string, position: { rail: number; slot: number }) => void;

  // Aktionen - Verbraucher
  addVerbraucher: (verbraucher: Verbraucher) => void;
  updateVerbraucher: (id: string, updates: Partial<Verbraucher>) => void;
  removeVerbraucher: (id: string) => void;
  assignVerbraucherToComponent: (verbraucherId: string, componentId: string) => void;

  // Aktionen - Verdrahtung
  addWire: (wire: Wire) => void;
  updateWire: (id: string, updates: Partial<Wire>) => void;
  removeWire: (id: string) => void;
  clearWires: () => void;
  setSelectedWire: (id: string | null) => void;

  // Aktionen - UI
  setSelectedComponent: (id: string | null) => void;
  setSelectedVerbraucher: (id: string | null) => void;
  setWiringMode: (active: boolean) => void;
  setWiringOrthoMode: (active: boolean) => void;
  setWiringStart: (point: ConnectionPoint | null) => void;
  addWiringWaypoint: (waypoint: WireWaypoint) => void;
  clearWiringWaypoints: () => void;
  setSelectedPhase: (phase: Phase) => void;
  setZoom: (zoom: number) => void;
  setPanOffset: (offset: { x: number; y: number }) => void;
  setShowErrors: (show: boolean) => void;
  setActiveTab: (tab: UIState['activeTab']) => void;

  // Aktionen - Validierung
  runValidation: () => void;
  clearValidation: () => void;

  // Aktionen - Projekt
  loadProject: (project: { verteiler: Verteiler }) => void;
  resetProject: () => void;
  resetProjectCustom: (config: { slots: number; schienen: number }) => void;
  loadTemplate: () => void;
}

// ==========================================
// INITIAL STATE
// ==========================================

const createEmptyVerteiler = (): Verteiler => ({
  id: uuidv4(),
  name: 'Neuer Verteiler',
  beschreibung: '',
  hutschienen: [
    { id: uuidv4(), index: 0, slots: 24 },
    { id: uuidv4(), index: 1, slots: 24 },
    { id: uuidv4(), index: 2, slots: 24 },
  ],
  komponenten: [],
  verbraucher: [],
  verbindungen: [],
  nennspannung: 400,
  nennstrom: 63,
  kurzschlussStrom: 6,
});

const createCustomVerteiler = (slots: number, schienen: number): Verteiler => ({
  id: uuidv4(),
  name: 'Neuer Verteiler',
  beschreibung: '',
  hutschienen: Array.from({ length: schienen }, (_, i) => ({
    id: uuidv4(),
    index: i,
    slots: slots,
  })),
  komponenten: [],
  verbraucher: [],
  verbindungen: [],
  nennspannung: 400,
  nennstrom: 63,
  kurzschlussStrom: 6,
});

const initialUIState: UIState = {
  selectedComponentId: null,
  selectedVerbraucherId: null,
  selectedWireId: null,
  wiringMode: false,
  wiringOrthoMode: false,
  wiringStart: null,
  wiringWaypoints: [],
  selectedPhase: 'L1',
  zoom: 1,
  panOffset: { x: 0, y: 0 },
  showErrors: true,
  activeTab: 'komponenten',
};

// ==========================================
// STORE IMPLEMENTATION
// ==========================================

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      verteiler: createEmptyVerteiler(),
      ui: initialUIState,
      validationResult: null,

      // Verteiler-Aktionen
      setVerteiler: (verteiler) => set({ verteiler }),

      updateVerteilerInfo: (info) => set((state) => ({
        verteiler: { ...state.verteiler, ...info },
      })),

      addHutschiene: () => set((state) => {
        if (state.verteiler.hutschienen.length >= 5) return state;
        const newIndex = state.verteiler.hutschienen.length;
        return {
          verteiler: {
            ...state.verteiler,
            hutschienen: [
              ...state.verteiler.hutschienen,
              { id: uuidv4(), index: newIndex, slots: 24 } as Hutschiene,
            ],
          },
        };
      }),

      removeHutschiene: (index) => set((state) => {
        if (state.verteiler.hutschienen.length <= 1) return state;
        return {
          verteiler: {
            ...state.verteiler,
            hutschienen: state.verteiler.hutschienen
              .filter((h) => h.index !== index)
              .map((h, i) => ({ ...h, index: i })),
            komponenten: state.verteiler.komponenten.filter(
              (c) => c.position.rail !== index
            ),
          },
        };
      }),

      // Komponenten-Aktionen
      addComponent: (component) => set((state) => ({
        verteiler: {
          ...state.verteiler,
          komponenten: [...state.verteiler.komponenten, component],
        },
      })),

      updateComponent: (id, updates) => set((state) => ({
        verteiler: {
          ...state.verteiler,
          komponenten: state.verteiler.komponenten.map((c) =>
            c.id === id ? { ...c, ...updates } as ElektroComponent : c
          ),
        },
      })),

      removeComponent: (id) => set((state) => ({
        verteiler: {
          ...state.verteiler,
          komponenten: state.verteiler.komponenten.filter((c) => c.id !== id),
          verbindungen: state.verteiler.verbindungen.filter(
            (w) => w.von.componentId !== id && w.nach.componentId !== id
          ),
        },
        ui: state.ui.selectedComponentId === id
          ? { ...state.ui, selectedComponentId: null }
          : state.ui,
      })),

      moveComponent: (id, position) => set((state) => ({
        verteiler: {
          ...state.verteiler,
          komponenten: state.verteiler.komponenten.map((c) =>
            c.id === id ? { ...c, position } : c
          ),
        },
      })),

      // Verbraucher-Aktionen
      addVerbraucher: (verbraucher) => set((state) => ({
        verteiler: {
          ...state.verteiler,
          verbraucher: [...state.verteiler.verbraucher, verbraucher],
        },
      })),

      updateVerbraucher: (id, updates) => set((state) => {
        // Finde den aktuellen Verbraucher um die alte Zuweisung zu kennen
        const currentVerbraucher = state.verteiler.verbraucher.find(v => v.id === id);
        const oldComponentId = currentVerbraucher?.zugewieseneKomponente;
        const newComponentId = updates.zugewieseneKomponente;

        // Wenn sich die Zuweisung ändert, müssen wir die zugewieseneVerbraucher-Listen der Komponenten aktualisieren
        let updatedKomponenten = state.verteiler.komponenten;
        let updatedVerbraucher = state.verteiler.verbraucher;

        if ('zugewieseneKomponente' in updates && oldComponentId !== newComponentId && newComponentId) {
          // Finde den bisherigen Verbraucher auf der neuen Komponente (falls vorhanden)
          const newKlemme = state.verteiler.komponenten.find(k => k.id === newComponentId);
          if (newKlemme && newKlemme.type === 'abgangsklemme') {
            const bisherigZugewiesene = (newKlemme as any).zugewieseneVerbraucher || [];
            // Entferne die Zuweisung vom bisherigen Verbraucher
            if (bisherigZugewiesene.length > 0) {
              updatedVerbraucher = state.verteiler.verbraucher.map((v) => {
                if (bisherigZugewiesene.includes(v.id) && v.id !== id) {
                  return { ...v, zugewieseneKomponente: undefined };
                }
                return v;
              });
            }
          }

          updatedKomponenten = state.verteiler.komponenten.map((k) => {
            // Wenn es eine Abgangsklemme ist
            if (k.type === 'abgangsklemme') {
              const klemme = k as any;
              const zugewieseneVerbraucher = klemme.zugewieseneVerbraucher || [];

              // Von alter Komponente entfernen
              if (k.id === oldComponentId) {
                return {
                  ...k,
                  zugewieseneVerbraucher: zugewieseneVerbraucher.filter((vId: string) => vId !== id),
                };
              }

              // Zur neuen Komponente hinzufügen (nur dieser eine Verbraucher)
              if (k.id === newComponentId) {
                return {
                  ...k,
                  zugewieseneVerbraucher: [id], // Nur ein Verbraucher pro Klemme!
                };
              }
            }
            return k;
          });
        }

        return {
          verteiler: {
            ...state.verteiler,
            komponenten: updatedKomponenten,
            verbraucher: updatedVerbraucher.map((v) =>
              v.id === id ? { ...v, ...updates } : v
            ),
          },
        };
      }),

      removeVerbraucher: (id) => set((state) => ({
        verteiler: {
          ...state.verteiler,
          verbraucher: state.verteiler.verbraucher.filter((v) => v.id !== id),
        },
        ui: state.ui.selectedVerbraucherId === id
          ? { ...state.ui, selectedVerbraucherId: null }
          : state.ui,
      })),

      assignVerbraucherToComponent: (verbraucherId, componentId) => set((state) => {
        // Finde die Ziel-Komponente
        const targetKlemme = state.verteiler.komponenten.find(k => k.id === componentId);

        // Finde den bisherigen Verbraucher auf dieser Klemme (falls vorhanden)
        let updatedVerbraucher = state.verteiler.verbraucher;
        let updatedKomponenten = state.verteiler.komponenten;

        if (targetKlemme && targetKlemme.type === 'abgangsklemme') {
          const bisherigZugewiesene = (targetKlemme as any).zugewieseneVerbraucher || [];

          // Entferne die Zuweisung vom bisherigen Verbraucher
          if (bisherigZugewiesene.length > 0) {
            updatedVerbraucher = state.verteiler.verbraucher.map((v) => {
              if (bisherigZugewiesene.includes(v.id) && v.id !== verbraucherId) {
                return { ...v, zugewieseneKomponente: undefined };
              }
              return v;
            });
          }

          // Aktualisiere die Komponenten-Liste
          updatedKomponenten = state.verteiler.komponenten.map((k) => {
            if (k.type === 'abgangsklemme') {
              const klemme = k as any;
              const zugewieseneVerbraucher = klemme.zugewieseneVerbraucher || [];

              // Von alter Komponente des neuen Verbrauchers entfernen
              const altVerbraucher = state.verteiler.verbraucher.find(v => v.id === verbraucherId);
              if (altVerbraucher?.zugewieseneKomponente === k.id && k.id !== componentId) {
                return {
                  ...k,
                  zugewieseneVerbraucher: zugewieseneVerbraucher.filter((vId: string) => vId !== verbraucherId),
                };
              }

              // Zur neuen Komponente hinzufügen (nur dieser eine Verbraucher)
              if (k.id === componentId) {
                return {
                  ...k,
                  zugewieseneVerbraucher: [verbraucherId], // Nur ein Verbraucher pro Klemme!
                };
              }
            }
            return k;
          });
        }

        return {
          verteiler: {
            ...state.verteiler,
            komponenten: updatedKomponenten,
            verbraucher: updatedVerbraucher.map((v) =>
              v.id === verbraucherId
                ? { ...v, zugewieseneKomponente: componentId }
                : v
            ),
          },
        };
      }),

      // Verdrahtungs-Aktionen
      addWire: (wire) => set((state) => ({
        verteiler: {
          ...state.verteiler,
          verbindungen: [...state.verteiler.verbindungen, wire],
        },
      })),

      updateWire: (id, updates) => set((state) => ({
        verteiler: {
          ...state.verteiler,
          verbindungen: state.verteiler.verbindungen.map((w) =>
            w.id === id ? { ...w, ...updates } : w
          ),
        },
      })),

      removeWire: (id) => set((state) => ({
        verteiler: {
          ...state.verteiler,
          verbindungen: state.verteiler.verbindungen.filter((w) => w.id !== id),
        },
        ui: { ...state.ui, selectedWireId: state.ui.selectedWireId === id ? null : state.ui.selectedWireId },
      })),

      clearWires: () => set((state) => ({
        verteiler: {
          ...state.verteiler,
          verbindungen: [],
        },
        ui: { ...state.ui, selectedWireId: null },
      })),

      setSelectedWire: (id) => set((state) => ({
        ui: { ...state.ui, selectedWireId: id, selectedComponentId: null, selectedVerbraucherId: null },
      })),

      // UI-Aktionen
      setSelectedComponent: (id) => set((state) => ({
        ui: { ...state.ui, selectedComponentId: id, selectedVerbraucherId: null, selectedWireId: null },
      })),

      setSelectedVerbraucher: (id) => set((state) => ({
        ui: { ...state.ui, selectedVerbraucherId: id, selectedComponentId: null, selectedWireId: null },
      })),

      setWiringMode: (active) => set((state) => ({
        ui: { ...state.ui, wiringMode: active, wiringStart: null, wiringWaypoints: [] },
      })),

      setWiringOrthoMode: (active) => set((state) => ({
        ui: { ...state.ui, wiringOrthoMode: active },
      })),

      setWiringStart: (point) => set((state) => ({
        ui: { ...state.ui, wiringStart: point, wiringWaypoints: [] },
      })),

      addWiringWaypoint: (waypoint) => set((state) => ({
        ui: { ...state.ui, wiringWaypoints: [...state.ui.wiringWaypoints, waypoint] },
      })),

      clearWiringWaypoints: () => set((state) => ({
        ui: { ...state.ui, wiringWaypoints: [] },
      })),

      setSelectedPhase: (phase) => set((state) => ({
        ui: { ...state.ui, selectedPhase: phase },
      })),

      setZoom: (zoom) => set((state) => ({
        ui: { ...state.ui, zoom: Math.max(0.5, Math.min(2, zoom)) },
      })),

      setPanOffset: (offset) => set((state) => ({
        ui: { ...state.ui, panOffset: offset },
      })),

      setShowErrors: (show) => set((state) => ({
        ui: { ...state.ui, showErrors: show },
      })),

      setActiveTab: (tab) => set((state) => ({
        ui: { ...state.ui, activeTab: tab },
      })),

      // Validierung
      runValidation: () => {
        const state = get();

        // Berechne zuerst die Ströme für alle Drähte
        const verteilerMitStrom = updateWireCurrentsInVerteiler(state.verteiler);

        const result = validateVerteiler(verteilerMitStrom);

        // Markiere Komponenten mit Fehlern
        const errorComponentIds = new Set(result.errors.map((e) => e.komponenteId));
        const updatedKomponenten = verteilerMitStrom.komponenten.map((c) => ({
          ...c,
          hasError: errorComponentIds.has(c.id),
          errorMessages: result.errors
            .filter((e) => e.komponenteId === c.id)
            .map((e) => e.beschreibung),
        }));

        set({
          validationResult: result,
          verteiler: {
            ...verteilerMitStrom,
            komponenten: updatedKomponenten,
          },
        });
      },

      clearValidation: () => set({
        validationResult: null,
        verteiler: {
          ...get().verteiler,
          komponenten: get().verteiler.komponenten.map((c) => ({
            ...c,
            hasError: false,
            errorMessages: [],
          })),
        },
      }),

      // Projekt-Aktionen
      loadProject: (project) => set({
        verteiler: project.verteiler,
        validationResult: null,
      }),

      resetProject: () => set({
        verteiler: createEmptyVerteiler(),
        ui: initialUIState,
        validationResult: null,
      }),

      resetProjectCustom: (config) => set({
        verteiler: createCustomVerteiler(config.slots, config.schienen),
        ui: initialUIState,
        validationResult: null,
      }),

      loadTemplate: () => {
        const template = createHausanschlussTemplate();
        set({
          verteiler: template,
          ui: initialUIState,
          validationResult: null,
        });
      },
    }),
    {
      name: 'elektro-planer-storage',
      partialize: (state) => ({
        verteiler: state.verteiler,
      }),
    }
  )
);

// ==========================================
// TEMPLATE: Hausanschluss
// ==========================================

function createHausanschlussTemplate(): Verteiler {
  const verteilerId = uuidv4();

  // Komponenten-IDs
  const nhSicherungId = uuidv4();
  const zaehlerId = uuidv4();
  const hauptschalterId = uuidv4();
  const fiLs1Id = uuidv4();
  const fiLs2Id = uuidv4();
  const fiLs3Id = uuidv4();
  const sammelschieneL1Id = uuidv4();
  const sammelschieneL2Id = uuidv4();
  const sammelschieneL3Id = uuidv4();
  const sammelschieneNId = uuidv4();
  const sammelschienePEId = uuidv4();

  return {
    id: verteilerId,
    name: 'Hausanschluss-Verteiler (Vorlage)',
    beschreibung: 'Standard Hausanschluss-Setup mit Hauptsicherung, Zähler und FI/LS-Kombinationen',
    hutschienen: [
      { id: uuidv4(), index: 0, slots: 24 },
      { id: uuidv4(), index: 1, slots: 24 },
      { id: uuidv4(), index: 2, slots: 24 },
      { id: uuidv4(), index: 3, slots: 24 },
    ],
    nennspannung: 400,
    nennstrom: 63,
    kurzschlussStrom: 6,
    komponenten: [
      // Hutschiene 0: NH-Sicherung + Zähler
      {
        id: nhSicherungId,
        type: 'nh-sicherung',
        name: 'Hauptsicherung',
        position: { rail: 0, slot: 0 },
        teilungseinheiten: 3,
        bemessungsStrom: 63,
        groesse: '00',
        betriebsklasse: 'gG',
      },
      {
        id: zaehlerId,
        type: 'zaehler',
        name: 'Zähler',
        position: { rail: 0, slot: 4 },
        teilungseinheiten: 8,
        art: 'elektronisch',
        phasen: 3,
      },
      {
        id: hauptschalterId,
        type: 'hauptschalter',
        name: 'Hauptschalter',
        position: { rail: 0, slot: 13 },
        teilungseinheiten: 4,
        bemessungsStrom: 63,
        polzahl: 4,
      },

      // Hutschiene 1: FI/LS-Kombinationen
      {
        id: fiLs1Id,
        type: 'fi-ls-kombi',
        name: 'FI/LS Licht',
        position: { rail: 1, slot: 0 },
        teilungseinheiten: 2,
        bemessungsStrom: 10,
        bemessungsFehlerstrom: 30,
        fiTyp: 'A',
        charakteristik: 'B',
        polzahl: 2,
        kurzschlussSchaltvermoegen: 6,
      },
      {
        id: fiLs2Id,
        type: 'fi-ls-kombi',
        name: 'FI/LS Steckdosen',
        position: { rail: 1, slot: 3 },
        teilungseinheiten: 2,
        bemessungsStrom: 16,
        bemessungsFehlerstrom: 30,
        fiTyp: 'A',
        charakteristik: 'C',
        polzahl: 2,
        kurzschlussSchaltvermoegen: 6,
      },
      {
        id: fiLs3Id,
        type: 'fi-ls-kombi',
        name: 'FI/LS Küche',
        position: { rail: 1, slot: 6 },
        teilungseinheiten: 2,
        bemessungsStrom: 16,
        bemessungsFehlerstrom: 30,
        fiTyp: 'A',
        charakteristik: 'C',
        polzahl: 2,
        kurzschlussSchaltvermoegen: 6,
      },

      // Hutschiene 2: Sammelschienen
      {
        id: sammelschieneL1Id,
        type: 'sammelschiene',
        name: 'L1 Sammelschiene',
        position: { rail: 2, slot: 0 },
        teilungseinheiten: 12,
        phase: 'L1',
        laenge: 12,
        querschnitt: 16,
      },
      {
        id: sammelschieneL2Id,
        type: 'sammelschiene',
        name: 'L2 Sammelschiene',
        position: { rail: 2, slot: 12 },
        teilungseinheiten: 12,
        phase: 'L2',
        laenge: 12,
        querschnitt: 16,
      },

      // Hutschiene 3: N und PE Sammelschienen
      {
        id: sammelschieneL3Id,
        type: 'sammelschiene',
        name: 'L3 Sammelschiene',
        position: { rail: 3, slot: 0 },
        teilungseinheiten: 8,
        phase: 'L3',
        laenge: 8,
        querschnitt: 16,
      },
      {
        id: sammelschieneNId,
        type: 'sammelschiene',
        name: 'N Sammelschiene',
        position: { rail: 3, slot: 8 },
        teilungseinheiten: 8,
        phase: 'N',
        laenge: 8,
        querschnitt: 16,
      },
      {
        id: sammelschienePEId,
        type: 'sammelschiene',
        name: 'PE Sammelschiene',
        position: { rail: 3, slot: 16 },
        teilungseinheiten: 8,
        phase: 'PE',
        laenge: 8,
        querschnitt: 16,
      },
    ] as ElektroComponent[],
    verbraucher: [
      {
        id: uuidv4(),
        name: 'Wohnzimmer Licht',
        typ: 'licht',
        leistung: 200,
        spannung: 230,
        phasen: ['L1'],
        gleichzeitigkeitsfaktor: 0.8,
        zugewieseneKomponente: fiLs1Id,
      },
      {
        id: uuidv4(),
        name: 'Wohnzimmer Steckdosen',
        typ: 'steckdose',
        leistung: 3680,
        spannung: 230,
        phasen: ['L2'],
        gleichzeitigkeitsfaktor: 0.3,
        zugewieseneKomponente: fiLs2Id,
      },
      {
        id: uuidv4(),
        name: 'Küche Geräte',
        typ: 'steckdose',
        leistung: 3680,
        spannung: 230,
        phasen: ['L3'],
        gleichzeitigkeitsfaktor: 0.5,
        zugewieseneKomponente: fiLs3Id,
      },
    ],
    verbindungen: [],
  };
}

export default useStore;
