import React, { useState, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useDrag } from 'react-dnd';
import { useStore } from '../../store/useStore';
import type { Verbraucher, VerbraucherTyp, Phase, Verlegeart, Leitermaterial } from '../../types';
import { VERBRAUCHER_DEFAULTS, VERFUEGBARE_QUERSCHNITTE, PHASE_COLORS, VERLEGEART_BESCHREIBUNGEN } from '../../types';
import { detectPhaseForComponent } from '../../utils/circuitGraph';

const VERBRAUCHER_ICONS: Record<VerbraucherTyp, string> = {
  licht: '💡',
  steckdose: '🔌',
  herd: '🍳',
  backofen: '🥧',
  trockner: '👕',
  warmwasser: '🚿',
  heizung: '🔥',
  klimaanlage: '❄️',
  wallbox: '🚗',
  sonstige: '⚡',
};

export const VerbraucherPanel: React.FC = () => {
  const { verteiler, addVerbraucher, updateVerbraucher, removeVerbraucher, ui, setSelectedVerbraucher } = useStore();
  const [isAdding, setIsAdding] = useState(false);
  const [newVerbraucher, setNewVerbraucher] = useState<Partial<Verbraucher>>({
    typ: 'steckdose',
    name: '',
    phasen: ['L1'],
    gleichzeitigkeitsfaktor: 1,
    leitungslaenge: 20,
    leitungsquerschnitt: 2.5,
    verlegeart: 'B1',
    leitermaterial: 'kupfer',
  });

  const handleAddVerbraucher = () => {
    if (!newVerbraucher.name || !newVerbraucher.typ) return;

    const defaults = VERBRAUCHER_DEFAULTS[newVerbraucher.typ as VerbraucherTyp];
    const verbraucher: Verbraucher = {
      id: uuidv4(),
      name: newVerbraucher.name,
      typ: newVerbraucher.typ as VerbraucherTyp,
      leistung: newVerbraucher.leistung || defaults.leistung,
      spannung: newVerbraucher.spannung || defaults.spannung,
      phasen: newVerbraucher.phasen as Phase[],
      gleichzeitigkeitsfaktor: newVerbraucher.gleichzeitigkeitsfaktor || 1,
      leitungslaenge: newVerbraucher.leitungslaenge || 20,
      leitungsquerschnitt: newVerbraucher.leitungsquerschnitt || 2.5,
      verlegeart: newVerbraucher.verlegeart as Verlegeart || 'B1',
      leitermaterial: newVerbraucher.leitermaterial as Leitermaterial || 'kupfer',
      zugewieseneKomponente: newVerbraucher.zugewieseneKomponente,
    };

    addVerbraucher(verbraucher);
    setNewVerbraucher({
      typ: 'steckdose',
      name: '',
      phasen: ['L1'],
      gleichzeitigkeitsfaktor: 1,
      leitungslaenge: 20,
      leitungsquerschnitt: 2.5,
      verlegeart: 'B1',
      leitermaterial: 'kupfer',
    });
    setIsAdding(false);
  };

  const handleTypeChange = (typ: VerbraucherTyp) => {
    const defaults = VERBRAUCHER_DEFAULTS[typ];
    setNewVerbraucher({
      ...newVerbraucher,
      typ,
      leistung: defaults.leistung,
      spannung: defaults.spannung,
      phasen: defaults.spannung === 400 ? ['L1', 'L2', 'L3'] : ['L1'],
    });
  };

  // Gruppiere nach zugewiesener Komponente
  const groupedVerbraucher = verteiler.verbraucher.reduce((acc, v) => {
    const key = v.zugewieseneKomponente || 'unassigned';
    if (!acc[key]) acc[key] = [];
    acc[key].push(v);
    return acc;
  }, {} as Record<string, Verbraucher[]>);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-700">Verbraucher</h3>
        <button
          onClick={() => setIsAdding(true)}
          className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
        >
          + Hinzufügen
        </button>
      </div>

      {/* Neuer Verbraucher Dialog */}
      {isAdding && (
        <div className="bg-blue-50 p-3 rounded-lg space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Typ</label>
            <select
              value={newVerbraucher.typ}
              onChange={(e) => handleTypeChange(e.target.value as VerbraucherTyp)}
              className="w-full px-2 py-1.5 border rounded text-sm"
            >
              {Object.keys(VERBRAUCHER_DEFAULTS).map((typ) => (
                <option key={typ} value={typ}>
                  {VERBRAUCHER_ICONS[typ as VerbraucherTyp]} {typ.charAt(0).toUpperCase() + typ.slice(1).replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Name</label>
            <input
              type="text"
              value={newVerbraucher.name}
              onChange={(e) => setNewVerbraucher({ ...newVerbraucher, name: e.target.value })}
              placeholder="z.B. Wohnzimmer Licht"
              className="w-full px-2 py-1.5 border rounded text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Zuweisung</label>
            <select
              value={newVerbraucher.zugewieseneKomponente || ''}
              onChange={(e) => setNewVerbraucher({ ...newVerbraucher, zugewieseneKomponente: e.target.value || undefined })}
              className="w-full px-2 py-1.5 border rounded text-sm"
            >
              <option value="">-- Nicht zugewiesen --</option>
              {verteiler.komponenten
                .filter((c) => c.type === 'abgangsklemme')
                .map((s) => {
                  const polzahl = (s as any).polzahl || 3;
                  const ist3PolKlemme = polzahl === 3;
                  const istDrehstromVerbraucher = newVerbraucher.spannung === 400;
                  const geeignet = !(ist3PolKlemme && istDrehstromVerbraucher);
                  return (
                    <option
                      key={s.id}
                      value={s.id}
                      disabled={!geeignet}
                      className={!geeignet ? 'text-gray-400' : ''}
                    >
                      {s.name} ({polzahl}-polig){!geeignet ? ' - ungeeignet' : ''}
                    </option>
                  );
                })}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Leistung (W)</label>
              <input
                type="number"
                value={newVerbraucher.leistung}
                onChange={(e) => setNewVerbraucher({ ...newVerbraucher, leistung: Number(e.target.value) })}
                className="w-full px-2 py-1.5 border rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Spannung (V)</label>
              <select
                value={newVerbraucher.spannung}
                onChange={(e) => setNewVerbraucher({
                  ...newVerbraucher,
                  spannung: Number(e.target.value),
                  phasen: Number(e.target.value) === 400 ? ['L1', 'L2', 'L3'] : ['L1'],
                })}
                className="w-full px-2 py-1.5 border rounded text-sm"
              >
                <option value={230}>230V (1-phasig)</option>
                <option value={400}>400V (3-phasig)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">GZF</label>
              <input
                type="number"
                min="0"
                max="1"
                step="0.1"
                value={newVerbraucher.gleichzeitigkeitsfaktor}
                onChange={(e) => setNewVerbraucher({ ...newVerbraucher, gleichzeitigkeitsfaktor: Number(e.target.value) })}
                className="w-full px-2 py-1.5 border rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Leitungslänge (m)</label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={newVerbraucher.leitungslaenge || ''}
                onChange={(e) => setNewVerbraucher({ ...newVerbraucher, leitungslaenge: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="z.B. 15"
                className="w-full px-2 py-1.5 border rounded text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Querschnitt (mm²)</label>
              <select
                value={newVerbraucher.leitungsquerschnitt || ''}
                onChange={(e) => setNewVerbraucher({ ...newVerbraucher, leitungsquerschnitt: e.target.value ? Number(e.target.value) : undefined })}
                className="w-full px-2 py-1.5 border rounded text-sm"
              >
                <option value="">-- Auswählen --</option>
                {VERFUEGBARE_QUERSCHNITTE.map((q) => (
                  <option key={q} value={q}>
                    {q} mm²
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Leitermaterial</label>
              <select
                value={newVerbraucher.leitermaterial || 'kupfer'}
                onChange={(e) => setNewVerbraucher({ ...newVerbraucher, leitermaterial: e.target.value as Leitermaterial })}
                className="w-full px-2 py-1.5 border rounded text-sm"
              >
                <option value="kupfer">Kupfer</option>
                <option value="aluminium">Aluminium</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Verlegeart</label>
            <select
              value={newVerbraucher.verlegeart || 'B1'}
              onChange={(e) => setNewVerbraucher({ ...newVerbraucher, verlegeart: e.target.value as Verlegeart })}
              className="w-full px-2 py-1.5 border rounded text-sm"
              title={newVerbraucher.verlegeart ? VERLEGEART_BESCHREIBUNGEN[newVerbraucher.verlegeart as Verlegeart] : ''}
            >
              {(Object.keys(VERLEGEART_BESCHREIBUNGEN) as Verlegeart[]).map((art) => (
                <option key={art} value={art} title={VERLEGEART_BESCHREIBUNGEN[art]}>
                  {art} - {VERLEGEART_BESCHREIBUNGEN[art].substring(0, 30)}...
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleAddVerbraucher}
              disabled={!newVerbraucher.name}
              className="flex-1 px-3 py-1.5 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 disabled:opacity-50"
            >
              Hinzufügen
            </button>
            <button
              onClick={() => setIsAdding(false)}
              className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* Verbraucher-Liste */}
      <div className="space-y-4">
        {/* Nicht zugewiesene Verbraucher */}
        {groupedVerbraucher['unassigned']?.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-orange-600 uppercase tracking-wide mb-2">
              ⚠️ Nicht zugewiesen
            </h4>
            <div className="space-y-2">
              {groupedVerbraucher['unassigned'].map((v) => (
                <VerbraucherItem key={v.id} verbraucher={v} />
              ))}
            </div>
          </div>
        )}

        {/* Nach Schutzeinrichtung gruppiert */}
        {Object.entries(groupedVerbraucher)
          .filter(([key]) => key !== 'unassigned')
          .map(([componentId, verbraucherList]) => {
            const component = verteiler.komponenten.find((c) => c.id === componentId);
            return (
              <div key={componentId}>
                <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  {component?.name || 'Unbekannt'}
                </h4>
                <div className="space-y-2">
                  {verbraucherList.map((v) => (
                    <VerbraucherItem key={v.id} verbraucher={v} />
                  ))}
                </div>
              </div>
            );
          })}

        {verteiler.verbraucher.length === 0 && !isAdding && (
          <p className="text-sm text-gray-400 text-center py-4">
            Noch keine Verbraucher hinzugefügt
          </p>
        )}
      </div>
    </div>
  );
};

// Einzelner Verbraucher
const VerbraucherItem: React.FC<{ verbraucher: Verbraucher }> = ({ verbraucher }) => {
  const { ui, setSelectedVerbraucher, updateVerbraucher, removeVerbraucher, verteiler, assignVerbraucherToComponent } = useStore();
  const [isEditing, setIsEditing] = useState(false);
  const isSelected = ui.selectedVerbraucherId === verbraucher.id;

  // Verbraucher können nur Abgangsklemmen zugewiesen werden
  const abgangsklemmen = verteiler.komponenten.filter(
    (c) => c.type === 'abgangsklemme'
  );

  // Prüft ob eine Abgangsklemme für diesen Verbraucher geeignet ist
  const istKlemmeGeeignet = (klemme: typeof abgangsklemmen[0]): boolean => {
    const abgangsklemme = klemme as any;
    const ist3PolKlemme = abgangsklemme.polzahl === 3;
    const istDrehstromVerbraucher = verbraucher.spannung === 400;
    // 3-phasiger Verbraucher braucht 5-polige Klemme
    if (ist3PolKlemme && istDrehstromVerbraucher) {
      return false;
    }
    return true;
  };

  // Handler für Zuweisungsänderung mit Validierung
  const handleZuweisungChange = (componentId: string) => {
    if (!componentId) {
      // Zuweisung entfernen
      updateVerbraucher(verbraucher.id, { zugewieseneKomponente: undefined });
      return;
    }

    const klemme = abgangsklemmen.find(k => k.id === componentId);
    if (!klemme) return;

    if (!istKlemmeGeeignet(klemme)) {
      alert(`Der Drehstromverbraucher "${verbraucher.name}" (400V) kann nicht einer 3-poligen Abgangsklemme zugewiesen werden.\n\nBitte verwenden Sie eine 5-polige Abgangsklemme für Drehstromverbraucher.`);
      return;
    }

    // Verwende assignVerbraucherToComponent für korrekte Zuweisung
    assignVerbraucherToComponent(verbraucher.id, componentId);
  };

  // Erkenne die tatsächliche Phase für einphasige Verbraucher
  const erkanntePhase = useMemo(() => {
    // Nur für einphasige Verbraucher mit Zuweisung
    const phasenOhneNPE = verbraucher.phasen.filter(p => p !== 'N' && p !== 'PE');
    if (phasenOhneNPE.length !== 1 || !verbraucher.zugewieseneKomponente) {
      return null;
    }
    return detectPhaseForComponent(verteiler, verbraucher.zugewieseneKomponente);
  }, [verbraucher, verteiler]);

  // Drag-Funktionalität für Verbraucher
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'verbraucher',
    item: {
      type: 'verbraucher',
      verbraucherId: verbraucher.id,
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [verbraucher.id]);

  return (
    <div
      ref={drag as unknown as React.Ref<HTMLDivElement>}
      className={`
        p-2 rounded border cursor-grab transition-all
        ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}
        ${!verbraucher.zugewieseneKomponente ? 'border-orange-300 bg-orange-50' : ''}
        ${isDragging ? 'opacity-50' : ''}
      `}
      onClick={() => setSelectedVerbraucher(verbraucher.id)}
    >
      <div className="flex items-center gap-2">
        <span className="text-lg">{VERBRAUCHER_ICONS[verbraucher.typ]}</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-800 truncate">
            {verbraucher.name}
          </div>
          <div className="text-xs text-gray-500 flex items-center gap-1">
            <span>{verbraucher.leistung}W</span>
            <span>•</span>
            {erkanntePhase ? (
              <span
                className="font-semibold px-1.5 py-0.5 rounded text-white"
                style={{ backgroundColor: PHASE_COLORS[erkanntePhase] }}
              >
                {erkanntePhase}
              </span>
            ) : verbraucher.spannung === 400 ? (
              <span className="text-gray-600">3-phasig</span>
            ) : (
              <span className="text-orange-500">Phase unbekannt</span>
            )}
            <span>•</span>
            <span>GZF: {verbraucher.gleichzeitigkeitsfaktor}</span>
          </div>
          {(verbraucher.leitungslaenge || verbraucher.leitungsquerschnitt || verbraucher.verlegeart || verbraucher.leitermaterial) && (
            <div className="text-xs text-blue-600">
              {verbraucher.leitungslaenge && `${verbraucher.leitungslaenge}m`}
              {verbraucher.leitungslaenge && verbraucher.leitungsquerschnitt && ' • '}
              {verbraucher.leitungsquerschnitt && `${verbraucher.leitungsquerschnitt}mm²`}
              {verbraucher.leitungsquerschnitt && verbraucher.leitermaterial && ' • '}
              {verbraucher.leitermaterial && verbraucher.leitermaterial.charAt(0).toUpperCase() + verbraucher.leitermaterial.slice(1)}
              {verbraucher.leitermaterial && verbraucher.verlegeart && ' • '}
              {verbraucher.verlegeart && `${verbraucher.verlegeart}`}
            </div>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsEditing(!isEditing);
          }}
          className="text-gray-400 hover:text-gray-600"
        >
          ✏️
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`"${verbraucher.name}" löschen?`)) {
              removeVerbraucher(verbraucher.id);
            }
          }}
          className="text-gray-400 hover:text-red-600"
        >
          🗑️
        </button>
      </div>

      {/* Editing Panel */}
      {isEditing && (
        <div className="mt-3 pt-3 border-t space-y-2" onClick={(e) => e.stopPropagation()}>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Zuweisung</label>
            <select
              value={verbraucher.zugewieseneKomponente || ''}
              onChange={(e) => handleZuweisungChange(e.target.value)}
              className="w-full px-2 py-1 border rounded text-sm"
            >
              <option value="">-- Nicht zugewiesen --</option>
              {abgangsklemmen.map((s) => {
                const geeignet = istKlemmeGeeignet(s);
                const polzahl = (s as any).polzahl || 3;
                return (
                  <option
                    key={s.id}
                    value={s.id}
                    disabled={!geeignet}
                    className={!geeignet ? 'text-gray-400' : ''}
                  >
                    {s.name} ({polzahl}-polig){!geeignet ? ' - ungeeignet' : ''}
                  </option>
                );
              })}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Leistung (W)</label>
              <input
                type="number"
                value={verbraucher.leistung}
                onChange={(e) => updateVerbraucher(verbraucher.id, { leistung: Number(e.target.value) })}
                className="w-full px-2 py-1 border rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">GZF</label>
              <input
                type="number"
                min="0"
                max="1"
                step="0.1"
                value={verbraucher.gleichzeitigkeitsfaktor}
                onChange={(e) => updateVerbraucher(verbraucher.id, { gleichzeitigkeitsfaktor: Number(e.target.value) })}
                className="w-full px-2 py-1 border rounded text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Leitungslänge (m)</label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={verbraucher.leitungslaenge || ''}
                onChange={(e) => updateVerbraucher(verbraucher.id, { leitungslaenge: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="z.B. 15"
                className="w-full px-2 py-1 border rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Querschnitt (mm²)</label>
              <select
                value={verbraucher.leitungsquerschnitt || ''}
                onChange={(e) => updateVerbraucher(verbraucher.id, { leitungsquerschnitt: e.target.value ? Number(e.target.value) : undefined })}
                className="w-full px-2 py-1 border rounded text-sm"
              >
                <option value="">-- Auswählen --</option>
                {VERFUEGBARE_QUERSCHNITTE.map((q) => (
                  <option key={q} value={q}>
                    {q} mm²
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Leitermaterial</label>
              <select
                value={verbraucher.leitermaterial || 'kupfer'}
                onChange={(e) => updateVerbraucher(verbraucher.id, { leitermaterial: e.target.value as Leitermaterial })}
                className="w-full px-2 py-1 border rounded text-sm"
              >
                <option value="kupfer">Kupfer</option>
                <option value="aluminium">Aluminium</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Verlegeart</label>
              <select
                value={verbraucher.verlegeart || 'B1'}
                onChange={(e) => updateVerbraucher(verbraucher.id, { verlegeart: e.target.value as Verlegeart })}
                className="w-full px-2 py-1 border rounded text-sm"
                title={verbraucher.verlegeart ? VERLEGEART_BESCHREIBUNGEN[verbraucher.verlegeart] : ''}
              >
                {(Object.keys(VERLEGEART_BESCHREIBUNGEN) as Verlegeart[]).map((art) => (
                  <option key={art} value={art} title={VERLEGEART_BESCHREIBUNGEN[art]}>
                    {art} - {VERLEGEART_BESCHREIBUNGEN[art].substring(0, 30)}...
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
