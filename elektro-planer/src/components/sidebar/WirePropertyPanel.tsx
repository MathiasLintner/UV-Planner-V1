import React from 'react';
import { useStore } from '../../store/useStore';
import type { Wire, Phase } from '../../types';
import { PHASE_COLORS } from '../../types';

export const WirePropertyPanel: React.FC = () => {
  const { verteiler, ui, updateWire, removeWire, setSelectedWire } = useStore();

  const selectedWire = ui.selectedWireId
    ? verteiler.verbindungen.find((w) => w.id === ui.selectedWireId)
    : null;

  if (!selectedWire) {
    return null;
  }

  const handleUpdate = (updates: Partial<Wire>) => {
    updateWire(selectedWire.id, updates);
  };

  const handleDelete = () => {
    removeWire(selectedWire.id);
    setSelectedWire(null);
  };

  // Finde Komponenten-Namen für Anzeige
  const vonComponent = verteiler.komponenten.find(c => c.id === selectedWire.von.componentId);
  const nachComponent = verteiler.komponenten.find(c => c.id === selectedWire.nach.componentId);

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-700">Draht-Eigenschaften</h3>

      {/* Verbindungsinfo */}
      <div className="bg-gray-50 p-3 rounded text-sm">
        <div className="text-xs text-gray-500 mb-1">Verbindung</div>
        <div className="font-medium">
          {vonComponent?.name || 'Unbekannt'} ({selectedWire.von.terminal})
        </div>
        <div className="text-gray-400 text-center">↓</div>
        <div className="font-medium">
          {nachComponent?.name || 'Unbekannt'} ({selectedWire.nach.terminal})
        </div>
      </div>

      {/* Phase/Farbe */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Phase / Farbe</label>
        <select
          value={selectedWire.phase}
          onChange={(e) => handleUpdate({ phase: e.target.value as Phase })}
          className="w-full px-2 py-1.5 border rounded text-sm focus:ring-1 focus:ring-blue-500"
        >
          <option value="L1">L1 (Braun)</option>
          <option value="L2">L2 (Schwarz)</option>
          <option value="L3">L3 (Grau)</option>
          <option value="N">N (Blau)</option>
          <option value="PE">PE (Grün/Gelb)</option>
        </select>
        {/* Farb-Vorschau */}
        <div
          className="mt-2 h-3 rounded"
          style={{ backgroundColor: PHASE_COLORS[selectedWire.phase] }}
        />
      </div>

      {/* Querschnitt */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Querschnitt (mm²)</label>
        <select
          value={selectedWire.querschnitt}
          onChange={(e) => handleUpdate({ querschnitt: Number(e.target.value) })}
          className="w-full px-2 py-1.5 border rounded text-sm focus:ring-1 focus:ring-blue-500"
        >
          <option value={1.5}>1,5 mm²</option>
          <option value={2.5}>2,5 mm²</option>
          <option value={4}>4 mm²</option>
          <option value={6}>6 mm²</option>
          <option value={10}>10 mm²</option>
          <option value={16}>16 mm²</option>
          <option value={25}>25 mm²</option>
          <option value={35}>35 mm²</option>
          <option value={50}>50 mm²</option>
        </select>
      </div>

      {/* Material */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Material</label>
        <select
          value={selectedWire.material}
          onChange={(e) => handleUpdate({ material: e.target.value as 'Cu' | 'Al' })}
          className="w-full px-2 py-1.5 border rounded text-sm focus:ring-1 focus:ring-blue-500"
        >
          <option value="Cu">Kupfer (Cu)</option>
          <option value="Al">Aluminium (Al)</option>
        </select>
      </div>

      {/* Länge */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Länge (m)</label>
        <input
          type="number"
          value={selectedWire.laenge}
          min={0.1}
          step={0.1}
          onChange={(e) => handleUpdate({ laenge: Number(e.target.value) })}
          className="w-full px-2 py-1.5 border rounded text-sm focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Berechnete Ströme */}
      {selectedWire.strom !== undefined && (
        <div className="bg-blue-50 p-3 rounded space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Maximalstrom</label>
            <div className="font-semibold text-blue-700 text-lg">
              {selectedWire.strom.toFixed(2)} A
            </div>
          </div>
          {selectedWire.durchpihnittsstrom !== undefined && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Durchschnittsstrom (mit GZF)</label>
              <div className="font-semibold text-green-700 text-lg">
                {selectedWire.durchpihnittsstrom.toFixed(2)} A
              </div>
            </div>
          )}
          <div className="text-xs text-gray-500">
            (Wird bei Validierung berechnet)
          </div>
        </div>
      )}

      <hr className="my-4" />

      {/* Lösch-Button */}
      <button
        onClick={handleDelete}
        className="w-full px-3 py-2 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition-colors"
      >
        Verbindung löschen
      </button>
    </div>
  );
};
