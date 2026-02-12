import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import type {
  ElektroComponent,
  FISchalterParams,
  LSSchalterParams,
  FILSKombiParams,
  NHSicherungParams,
  SchraubSicherungParams,
  NeozedSicherungParams,
  SammelSchieneParams,
  ZaehlerParams,
  SchuetzParams,
  KlemmeParams,
  VersorgungsklemmeParams,
  UeberspannungsschutzParams,
  Phase,
  Netzsystem,
  SicherungsKennlinie,
  SPDKlasse,
  SPDSystemTyp,
} from '../../types';

// Aufklappbare Sektion
const CollapsibleSection: React.FC<{
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ title, defaultOpen = false, children }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-gray-200 rounded">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 flex items-center justify-between text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-t"
      >
        <span>{title}</span>
        <span className="text-gray-400">{isOpen ? '▼' : '▶'}</span>
      </button>
      {isOpen && (
        <div className="p-3 border-t border-gray-200">
          {children}
        </div>
      )}
    </div>
  );
};

export const PropertyPanel: React.FC = () => {
  const { verteiler, ui, updateComponent, removeComponent, setSelectedComponent } = useStore();

  const selectedComponent = ui.selectedComponentId
    ? verteiler.komponenten.find((c) => c.id === ui.selectedComponentId)
    : null;

  if (!selectedComponent) {
    return (
      <div className="text-center text-gray-500 py-8">
        <p className="text-sm">Keine Komponente ausgewählt</p>
        <p className="text-xs mt-2">Klicken Sie auf eine Komponente, um ihre Eigenschaften zu bearbeiten</p>
      </div>
    );
  }

  const handleUpdate = (updates: Partial<ElektroComponent>) => {
    updateComponent(selectedComponent.id, updates);
  };

  const handleDelete = () => {
    removeComponent(selectedComponent.id);
    setSelectedComponent(null);
  };

  // Finde alle Verbindungen die mit dieser Komponente verbunden sind
  const connectedWires = verteiler.verbindungen.filter(
    (w) => w.von.componentId === selectedComponent.id || w.nach.componentId === selectedComponent.id
  );

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-700">Eigenschaften</h3>

      {/* Basis-Eigenschaften */}
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Name</label>
          <input
            type="text"
            value={selectedComponent.name}
            onChange={(e) => handleUpdate({ name: e.target.value })}
            className="w-full px-2 py-1.5 border rounded text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Typ-spezifische Eigenschaften */}
      {renderTypeSpecificProperties(selectedComponent, handleUpdate)}

      {/* Aufklappbare Schienenposition */}
      <CollapsibleSection title="Schienenposition">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Schiene</label>
            <input
              type="number"
              value={selectedComponent.position.rail + 1}
              readOnly
              className="w-full px-2 py-1.5 border rounded text-sm bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Position (TE)</label>
            <input
              type="number"
              value={selectedComponent.position.slot}
              readOnly
              className="w-full px-2 py-1.5 border rounded text-sm bg-gray-50"
            />
          </div>
        </div>
        <div className="mt-2">
          <label className="block text-xs text-gray-500 mb-1">Breite</label>
          <input
            type="text"
            value={`${selectedComponent.teilungseinheiten} TE`}
            readOnly
            className="w-full px-2 py-1.5 border rounded text-sm bg-gray-50"
          />
        </div>
      </CollapsibleSection>

      {/* Aufklappbare Verbindungsanzeige */}
      <CollapsibleSection title={`Verbindungen (${connectedWires.length})`}>
        {connectedWires.length === 0 ? (
          <p className="text-xs text-gray-400">Keine Verbindungen</p>
        ) : (
          <div className="space-y-2">
            {connectedWires.map((wire) => {
              const isSource = wire.von.componentId === selectedComponent.id;
              const otherComponentId = isSource ? wire.nach.componentId : wire.von.componentId;
              const otherComponent = verteiler.komponenten.find((c) => c.id === otherComponentId);
              const direction = isSource ? '→' : '←';
              const terminal = isSource ? wire.von.terminal : wire.nach.terminal;

              return (
                <div key={wire.id} className="text-xs p-2 bg-gray-50 rounded flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{
                      backgroundColor:
                        wire.phase === 'L1' ? '#8B4513' :
                        wire.phase === 'L2' ? '#000000' :
                        wire.phase === 'L3' ? '#808080' :
                        wire.phase === 'N' ? '#3B82F6' :
                        wire.phase === 'PE' ? '#22C55E' : '#888',
                    }}
                  />
                  <span className="text-gray-600">{terminal}</span>
                  <span className="text-gray-400">{direction}</span>
                  <span className="font-medium truncate">{otherComponent?.name || 'Unbekannt'}</span>
                </div>
              );
            })}
          </div>
        )}
      </CollapsibleSection>

      {/* Lösch-Button */}
      <button
        onClick={handleDelete}
        className="w-full px-3 py-2 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition-colors"
      >
        Komponente löschen
      </button>
    </div>
  );
};

function renderTypeSpecificProperties(
  component: ElektroComponent,
  handleUpdate: (updates: Partial<ElektroComponent>) => void
) {
  switch (component.type) {
    case 'fi-schalter':
      return <FISchalterProperties component={component} onUpdate={handleUpdate} />;
    case 'ls-schalter':
      return <LSSchalterProperties component={component} onUpdate={handleUpdate} />;
    case 'fi-ls-kombi':
      return <FILSKombiProperties component={component} onUpdate={handleUpdate} />;
    case 'nh-sicherung':
      return <NHSicherungProperties component={component} onUpdate={handleUpdate} />;
    case 'schraub-sicherung':
      return <SchraubSicherungProperties component={component} onUpdate={handleUpdate} />;
    case 'neozed-sicherung':
      return <NeozedSicherungProperties component={component} onUpdate={handleUpdate} />;
    case 'sammelschiene':
      return <SammelSchieneProperties component={component} onUpdate={handleUpdate} />;
    case 'zaehler':
      return <ZaehlerProperties component={component} onUpdate={handleUpdate} />;
    case 'schuetz':
      return <SchuetzProperties component={component} onUpdate={handleUpdate} />;
    case 'klemme':
      return <KlemmeProperties component={component} onUpdate={handleUpdate} />;
    case 'versorgungsklemme':
      return <VersorgungsklemmeProperties component={component} onUpdate={handleUpdate} />;
    case 'ueberspannungsschutz':
      return <UeberspannungsschutzProperties component={component} onUpdate={handleUpdate} />;
    default:
      return null;
  }
}

// Gemeinsame Input-Komponente
const PropertyInput: React.FC<{
  label: string;
  value: number | string;
  type?: 'number' | 'text';
  unit?: string;
  options?: { value: string | number; label: string }[];
  onChange: (value: any) => void;
}> = ({ label, value, type = 'number', unit, options, onChange }) => {
  if (options) {
    return (
      <div>
        <label className="block text-xs text-gray-500 mb-1">{label}</label>
        <select
          value={value}
          onChange={(e) => onChange(type === 'number' ? Number(e.target.value) : e.target.value)}
          className="w-full px-2 py-1.5 border rounded text-sm focus:ring-1 focus:ring-blue-500"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">
        {label} {unit && <span className="text-gray-400">({unit})</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(type === 'number' ? Number(e.target.value) : e.target.value)}
        className="w-full px-2 py-1.5 border rounded text-sm focus:ring-1 focus:ring-blue-500"
      />
    </div>
  );
};

// FI-Schalter
const FISchalterProperties: React.FC<{
  component: FISchalterParams;
  onUpdate: (updates: Partial<FISchalterParams>) => void;
}> = ({ component, onUpdate }) => (
  <div className="space-y-3">
    <PropertyInput
      label="Bemessungsstrom"
      value={component.bemessungsStrom}
      unit="A"
      options={[
        { value: 25, label: '25 A' },
        { value: 40, label: '40 A' },
        { value: 63, label: '63 A' },
        { value: 80, label: '80 A' },
      ]}
      onChange={(v) => onUpdate({ bemessungsStrom: v })}
    />
    <PropertyInput
      label="Bemessungsfehlerstrom"
      value={component.bemessungsFehlerstrom}
      unit="mA"
      options={[
        { value: 10, label: '10 mA' },
        { value: 30, label: '30 mA' },
        { value: 100, label: '100 mA' },
        { value: 300, label: '300 mA' },
        { value: 500, label: '500 mA' },
      ]}
      onChange={(v) => onUpdate({ bemessungsFehlerstrom: v })}
    />
    <PropertyInput
      label="FI-Typ"
      value={component.fiTyp}
      type="text"
      options={[
        { value: 'AC', label: 'Typ AC' },
        { value: 'A', label: 'Typ A' },
        { value: 'F', label: 'Typ F' },
        { value: 'B', label: 'Typ B' },
        { value: 'B+', label: 'Typ B+' },
      ]}
      onChange={(v) => onUpdate({ fiTyp: v })}
    />
    <PropertyInput
      label="Verzögerung"
      value={component.verzoegerung}
      type="text"
      options={[
        { value: 'Standard', label: 'Standard' },
        { value: 'G', label: 'G (kurzverzögert)' },
        { value: 'S', label: 'S (zeitverzögert)' },
      ]}
      onChange={(v) => onUpdate({ verzoegerung: v })}
    />
    <PropertyInput
      label="Polzahl"
      value={component.polzahl}
      options={[
        { value: 2, label: '2-polig' },
        { value: 4, label: '4-polig' },
      ]}
      onChange={(v) => onUpdate({ polzahl: v })}
    />
  </div>
);

// LS-Schalter
const LSSchalterProperties: React.FC<{
  component: LSSchalterParams;
  onUpdate: (updates: Partial<LSSchalterParams>) => void;
}> = ({ component, onUpdate }) => (
  <div className="space-y-3">
    <PropertyInput
      label="Bemessungsstrom"
      value={component.bemessungsStrom}
      unit="A"
      options={[
        { value: 6, label: '6 A' },
        { value: 10, label: '10 A' },
        { value: 13, label: '13 A' },
        { value: 16, label: '16 A' },
        { value: 20, label: '20 A' },
        { value: 25, label: '25 A' },
        { value: 32, label: '32 A' },
      ]}
      onChange={(v) => onUpdate({ bemessungsStrom: v })}
    />
    <PropertyInput
      label="Charakteristik"
      value={component.charakteristik}
      type="text"
      options={[
        { value: 'A', label: 'A (2-3x In)' },
        { value: 'B', label: 'B (3-5x In)' },
        { value: 'C', label: 'C (5-10x In)' },
        { value: 'D', label: 'D (10-20x In)' },
        { value: 'K', label: 'K (10-14x In)' },
        { value: 'Z', label: 'Z (2-3x In)' },
      ]}
      onChange={(v) => onUpdate({ charakteristik: v })}
    />
    <PropertyInput
      label="Polzahl"
      value={component.polzahl}
      options={[
        { value: 1, label: '1-polig' },
        { value: 2, label: '2-polig' },
        { value: 3, label: '3-polig' },
        { value: 4, label: '4-polig' },
      ]}
      onChange={(v) => onUpdate({ polzahl: v })}
    />
    <PropertyInput
      label="Kurzschluss-Schaltvermögen"
      value={component.kurzschlussSchaltvermoegen}
      unit="kA"
      options={[
        { value: 6, label: '6 kA' },
        { value: 10, label: '10 kA' },
        { value: 15, label: '15 kA' },
        { value: 25, label: '25 kA' },
      ]}
      onChange={(v) => onUpdate({ kurzschlussSchaltvermoegen: v })}
    />
  </div>
);

// FI/LS-Kombination
const FILSKombiProperties: React.FC<{
  component: FILSKombiParams;
  onUpdate: (updates: Partial<FILSKombiParams>) => void;
}> = ({ component, onUpdate }) => (
  <div className="space-y-3">
    <PropertyInput
      label="Bemessungsstrom"
      value={component.bemessungsStrom}
      unit="A"
      options={[
        { value: 6, label: '6 A' },
        { value: 10, label: '10 A' },
        { value: 13, label: '13 A' },
        { value: 16, label: '16 A' },
        { value: 20, label: '20 A' },
        { value: 25, label: '25 A' },
        { value: 32, label: '32 A' },
      ]}
      onChange={(v) => onUpdate({ bemessungsStrom: v })}
    />
    <PropertyInput
      label="Bemessungsfehlerstrom"
      value={component.bemessungsFehlerstrom}
      unit="mA"
      options={[
        { value: 10, label: '10 mA' },
        { value: 30, label: '30 mA' },
        { value: 100, label: '100 mA' },
        { value: 300, label: '300 mA' },
      ]}
      onChange={(v) => onUpdate({ bemessungsFehlerstrom: v })}
    />
    <PropertyInput
      label="FI-Typ"
      value={component.fiTyp}
      type="text"
      options={[
        { value: 'AC', label: 'Typ AC' },
        { value: 'A', label: 'Typ A' },
        { value: 'F', label: 'Typ F' },
        { value: 'B', label: 'Typ B' },
      ]}
      onChange={(v) => onUpdate({ fiTyp: v })}
    />
    <PropertyInput
      label="Verzögerung"
      value={component.verzoegerung}
      type="text"
      options={[
        { value: 'Standard', label: 'Standard' },
        { value: 'G', label: 'G (kurzverzögert)' },
        { value: 'S', label: 'S (zeitverzögert)' },
      ]}
      onChange={(v) => onUpdate({ verzoegerung: v })}
    />
    <PropertyInput
      label="Charakteristik"
      value={component.charakteristik}
      type="text"
      options={[
        { value: 'B', label: 'B (3-5x In)' },
        { value: 'C', label: 'C (5-10x In)' },
        { value: 'D', label: 'D (10-20x In)' },
      ]}
      onChange={(v) => onUpdate({ charakteristik: v })}
    />
    <PropertyInput
      label="Polzahl"
      value={component.polzahl}
      options={[
        { value: 1, label: '1P+N' },
        { value: 2, label: '2-polig' },
        { value: 3, label: '3P+N' },
        { value: 4, label: '4-polig' },
      ]}
      onChange={(v) => onUpdate({ polzahl: v })}
    />
    <PropertyInput
      label="Kurzschluss-Schaltvermögen"
      value={component.kurzschlussSchaltvermoegen}
      unit="kA"
      options={[
        { value: 6, label: '6 kA' },
        { value: 10, label: '10 kA' },
      ]}
      onChange={(v) => onUpdate({ kurzschlussSchaltvermoegen: v })}
    />
  </div>
);

// NH-Sicherung
const NHSicherungProperties: React.FC<{
  component: NHSicherungParams;
  onUpdate: (updates: Partial<NHSicherungParams>) => void;
}> = ({ component, onUpdate }) => (
  <div className="space-y-3">
    <PropertyInput
      label="Bemessungsstrom"
      value={component.bemessungsStrom}
      unit="A"
      options={[
        { value: 16, label: '16 A' },
        { value: 20, label: '20 A' },
        { value: 25, label: '25 A' },
        { value: 32, label: '32 A' },
        { value: 40, label: '40 A' },
        { value: 50, label: '50 A' },
        { value: 63, label: '63 A' },
        { value: 80, label: '80 A' },
        { value: 100, label: '100 A' },
        { value: 125, label: '125 A' },
        { value: 160, label: '160 A' },
      ]}
      onChange={(v) => onUpdate({ bemessungsStrom: v })}
    />
    <PropertyInput
      label="Größe"
      value={component.groesse}
      type="text"
      options={[
        { value: '00', label: 'NH00' },
        { value: '0', label: 'NH0' },
        { value: '1', label: 'NH1' },
        { value: '2', label: 'NH2' },
        { value: '3', label: 'NH3' },
      ]}
      onChange={(v) => onUpdate({ groesse: v })}
    />
    <PropertyInput
      label="Betriebsklasse"
      value={component.betriebsklasse}
      type="text"
      options={[
        { value: 'gG', label: 'gG (Ganzbereichsschutz)' },
        { value: 'gL', label: 'gL (Leitungsschutz)' },
        { value: 'aM', label: 'aM (Motorschutz)' },
        { value: 'aR', label: 'aR (Halbleiterschutz)' },
      ]}
      onChange={(v) => onUpdate({ betriebsklasse: v })}
    />
  </div>
);

// Schraub-Sicherung
const SchraubSicherungProperties: React.FC<{
  component: SchraubSicherungParams;
  onUpdate: (updates: Partial<SchraubSicherungParams>) => void;
}> = ({ component, onUpdate }) => (
  <div className="space-y-3">
    <PropertyInput
      label="Bemessungsstrom"
      value={component.bemessungsStrom}
      unit="A"
      options={[
        { value: 2, label: '2 A' },
        { value: 4, label: '4 A' },
        { value: 6, label: '6 A' },
        { value: 10, label: '10 A' },
        { value: 16, label: '16 A' },
        { value: 20, label: '20 A' },
        { value: 25, label: '25 A' },
        { value: 35, label: '35 A' },
        { value: 50, label: '50 A' },
        { value: 63, label: '63 A' },
      ]}
      onChange={(v) => onUpdate({ bemessungsStrom: v })}
    />
    <PropertyInput
      label="Größe"
      value={component.groesse}
      type="text"
      options={[
        { value: 'D01', label: 'D01 (bis 16A)' },
        { value: 'D02', label: 'D02 (bis 63A)' },
        { value: 'D03', label: 'D03 (bis 100A)' },
        { value: 'DIII', label: 'DIII (bis 63A)' },
      ]}
      onChange={(v) => onUpdate({ groesse: v })}
    />
  </div>
);

// Neozed-Sicherung
const NeozedSicherungProperties: React.FC<{
  component: NeozedSicherungParams;
  onUpdate: (updates: Partial<NeozedSicherungParams>) => void;
}> = ({ component, onUpdate }) => (
  <div className="space-y-3">
    <PropertyInput
      label="Auslösestrom"
      value={component.bemessungsStrom}
      unit="A"
      options={[
        { value: 2, label: '2 A' },
        { value: 4, label: '4 A' },
        { value: 6, label: '6 A' },
        { value: 10, label: '10 A' },
        { value: 13, label: '13 A' },
        { value: 16, label: '16 A' },
        { value: 20, label: '20 A' },
        { value: 25, label: '25 A' },
        { value: 32, label: '32 A' },
        { value: 35, label: '35 A' },
        { value: 40, label: '40 A' },
        { value: 50, label: '50 A' },
        { value: 63, label: '63 A' },
      ]}
      onChange={(v) => onUpdate({ bemessungsStrom: v })}
    />
    <PropertyInput
      label="Kennlinientyp"
      value={component.kennlinie}
      type="text"
      options={[
        { value: 'gG', label: 'gG (Ganzbereich, träge)' },
        { value: 'gL', label: 'gL (Leitungsschutz)' },
        { value: 'aM', label: 'aM (Motorschutz)' },
        { value: 'aR', label: 'aR (Halbleiterschutz)' },
        { value: 'gR', label: 'gR (Halbleiter Ganzbereich)' },
        { value: 'gS', label: 'gS (Halbleiter+Kabel)' },
      ]}
      onChange={(v) => onUpdate({ kennlinie: v as SicherungsKennlinie })}
    />
    <PropertyInput
      label="Polzahl"
      value={component.polzahl}
      options={[
        { value: 1, label: '1-polig' },
        { value: 3, label: '3-polig' },
      ]}
      onChange={(v) => onUpdate({ polzahl: v })}
    />
  </div>
);

// Sammelschiene
const SammelSchieneProperties: React.FC<{
  component: SammelSchieneParams;
  onUpdate: (updates: Partial<SammelSchieneParams>) => void;
}> = ({ component, onUpdate }) => (
  <div className="space-y-3">
    <PropertyInput
      label="Phase"
      value={component.phase}
      type="text"
      options={[
        { value: 'L1', label: 'L1 (Braun)' },
        { value: 'L2', label: 'L2 (Schwarz)' },
        { value: 'L3', label: 'L3 (Grau)' },
        { value: 'N', label: 'N (Blau)' },
        { value: 'PE', label: 'PE (Grün/Gelb)' },
      ]}
      onChange={(v) => onUpdate({ phase: v as Phase })}
    />
    <PropertyInput
      label="Querschnitt"
      value={component.querschnitt}
      unit="mm²"
      options={[
        { value: 10, label: '10 mm²' },
        { value: 16, label: '16 mm²' },
        { value: 25, label: '25 mm²' },
        { value: 35, label: '35 mm²' },
        { value: 50, label: '50 mm²' },
      ]}
      onChange={(v) => onUpdate({ querschnitt: v })}
    />
  </div>
);

// Zähler
const ZaehlerProperties: React.FC<{
  component: ZaehlerParams;
  onUpdate: (updates: Partial<ZaehlerParams>) => void;
}> = ({ component, onUpdate }) => (
  <div className="space-y-3">
    <PropertyInput
      label="Art"
      value={component.art}
      type="text"
      options={[
        { value: 'ferraris', label: 'Ferraris (mechanisch)' },
        { value: 'elektronisch', label: 'Elektronisch' },
        { value: 'smart-meter', label: 'Smart Meter' },
      ]}
      onChange={(v) => onUpdate({ art: v })}
    />
    <PropertyInput
      label="Phasen"
      value={component.phasen}
      options={[
        { value: 1, label: '1-phasig' },
        { value: 3, label: '3-phasig' },
      ]}
      onChange={(v) => onUpdate({ phasen: v })}
    />
  </div>
);

// Schütz
const SchuetzProperties: React.FC<{
  component: SchuetzParams;
  onUpdate: (updates: Partial<SchuetzParams>) => void;
}> = ({ component, onUpdate }) => (
  <div className="space-y-3">
    <PropertyInput
      label="Bemessungsstrom"
      value={component.bemessungsStrom}
      unit="A"
      options={[
        { value: 9, label: '9 A' },
        { value: 12, label: '12 A' },
        { value: 16, label: '16 A' },
        { value: 25, label: '25 A' },
        { value: 32, label: '32 A' },
        { value: 40, label: '40 A' },
      ]}
      onChange={(v) => onUpdate({ bemessungsStrom: v })}
    />
    <PropertyInput
      label="Spulenspannung"
      value={component.spulenSpannung}
      unit="V"
      options={[
        { value: 24, label: '24 V AC/DC' },
        { value: 230, label: '230 V AC' },
        { value: 400, label: '400 V AC' },
      ]}
      onChange={(v) => onUpdate({ spulenSpannung: v })}
    />
    <PropertyInput
      label="Polzahl"
      value={component.polzahl}
      options={[
        { value: 1, label: '1-polig' },
        { value: 2, label: '2-polig' },
        { value: 3, label: '3-polig' },
        { value: 4, label: '4-polig' },
      ]}
      onChange={(v) => onUpdate({ polzahl: v })}
    />
  </div>
);

// Klemme
const KlemmeProperties: React.FC<{
  component: KlemmeParams;
  onUpdate: (updates: Partial<KlemmeParams>) => void;
}> = ({ component, onUpdate }) => (
  <div className="space-y-3">
    <PropertyInput
      label="Phase"
      value={component.phase}
      type="text"
      options={[
        { value: 'L1', label: 'L1 (Braun)' },
        { value: 'L2', label: 'L2 (Schwarz)' },
        { value: 'L3', label: 'L3 (Grau)' },
        { value: 'N', label: 'N (Blau)' },
        { value: 'PE', label: 'PE (Grün/Gelb)' },
      ]}
      onChange={(v) => onUpdate({ phase: v as Phase })}
    />
    <PropertyInput
      label="Max. Querschnitt"
      value={component.querschnitt}
      unit="mm²"
      options={[
        { value: 4, label: '4 mm²' },
        { value: 6, label: '6 mm²' },
        { value: 10, label: '10 mm²' },
        { value: 16, label: '16 mm²' },
        { value: 25, label: '25 mm²' },
        { value: 35, label: '35 mm²' },
      ]}
      onChange={(v) => onUpdate({ querschnitt: v })}
    />
  </div>
);

// Versorgungsklemme
const VersorgungsklemmeProperties: React.FC<{
  component: VersorgungsklemmeParams;
  onUpdate: (updates: Partial<VersorgungsklemmeParams>) => void;
}> = ({ component, onUpdate }) => (
  <div className="space-y-3">
    <PropertyInput
      label="Schleifenimpedanz"
      value={component.schleifenimpedanz}
      unit="Ω"
      onChange={(v) => onUpdate({ schleifenimpedanz: v })}
    />
    <PropertyInput
      label="Netzsystem"
      value={component.netzsystem}
      type="text"
      options={[
        { value: 'TN-C', label: 'TN-C (PEN gemeinsam)' },
        { value: 'TN-S', label: 'TN-S (PE+N getrennt)' },
        { value: 'TN-C-S', label: 'TN-C-S (Standard)' },
        { value: 'TT', label: 'TT (eigene Erdung)' },
        { value: 'IT', label: 'IT (isoliert)' },
      ]}
      onChange={(v) => onUpdate({ netzsystem: v as Netzsystem })}
    />
  </div>
);

// Überspannungsschutz (SPD)
const UeberspannungsschutzProperties: React.FC<{
  component: UeberspannungsschutzParams;
  onUpdate: (updates: Partial<UeberspannungsschutzParams>) => void;
}> = ({ component, onUpdate }) => (
  <div className="space-y-3">
    <PropertyInput
      label="Schutzklasse"
      value={component.klasse}
      type="text"
      options={[
        { value: 'Typ 1', label: 'Typ 1 (Blitzschutz)' },
        { value: 'Typ 2', label: 'Typ 2 (Überspannung)' },
        { value: 'Typ 3', label: 'Typ 3 (Feinschutz)' },
        { value: 'Typ 1+2', label: 'Typ 1+2 (Kombi)' },
      ]}
      onChange={(v) => onUpdate({ klasse: v as SPDKlasse })}
    />
    <PropertyInput
      label="Bemessungsspannung Uc"
      value={component.bemessungsSpannung}
      unit="V"
      options={[
        { value: 230, label: '230 V' },
        { value: 400, label: '400 V' },
        { value: 600, label: '600 V' },
        { value: 1000, label: '1000 V' },
        { value: 1500, label: '1500 V' },
      ]}
      onChange={(v) => onUpdate({ bemessungsSpannung: v })}
    />
    <PropertyInput
      label="Nennableistrom In"
      value={component.nennAbleistrom}
      unit="kA"
      options={[
        { value: 5, label: '5 kA' },
        { value: 10, label: '10 kA' },
        { value: 15, label: '15 kA' },
        { value: 20, label: '20 kA' },
        { value: 40, label: '40 kA' },
        { value: 60, label: '60 kA' },
        { value: 100, label: '100 kA' },
      ]}
      onChange={(v) => onUpdate({ nennAbleistrom: v })}
    />
  </div>
);
