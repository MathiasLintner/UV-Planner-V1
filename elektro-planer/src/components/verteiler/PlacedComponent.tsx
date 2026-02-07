import React from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { useStore } from '../../store/useStore';
import type { ElektroComponent, Phase } from '../../types';
import { PHASE_COLORS } from '../../types';
import { getComponentTerminals, type Terminal } from '../../utils/terminals';
import { getComponentIcon } from '../icons/SchaltplanIcons';

interface PlacedComponentProps {
  component: ElektroComponent;
  teWidth: number;
}

const COMPONENT_HEIGHT = 90;
const TERMINAL_SIZE = 10;

const VERBRAUCHER_ICONS: Record<string, string> = {
  licht: '💡',
  steckdose: '🔌',
  herd: '🍳',
  backofen: '🥧',
  kuehlschrank: '🧊',
  waschmaschine: '🧺',
  trockner: '👕',
  geschirrspueler: '🍽️',
  warmwasser: '🚿',
  heizung: '🔥',
  klimaanlage: '❄️',
  wallbox: '🚗',
  sonstige: '⚡',
};

export const PlacedComponent: React.FC<PlacedComponentProps> = ({
  component,
  teWidth,
}) => {
  const { verteiler, ui, setSelectedComponent, removeComponent, setWiringStart, setWiringMode, setActiveTab, addWire, clearWiringWaypoints, assignVerbraucherToComponent } = useStore();
  const isSelected = ui.selectedComponentId === component.id;
  const componentWidth = component.teilungseinheiten * teWidth - 2;

  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'placed-component',
    item: {
      type: 'component',
      componentType: component.type,
      sourceId: component.id,
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [component]);

  // Drop-Funktionalität für Abgangsklemmen (akzeptiert Verbraucher)
  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: 'verbraucher',
    canDrop: (item: { type: string; verbraucherId: string }) => {
      if (component.type !== 'abgangsklemme') return false;

      // Prüfe ob 3-phasiger Verbraucher auf 3-polige (1-phasige) Abgangsklemme gezogen wird
      const verbraucher = verteiler.verbraucher.find(v => v.id === item.verbraucherId);
      if (!verbraucher) return false;

      const abgangsklemme = component as any;
      const ist3PolKlemme = abgangsklemme.polzahl === 3;
      const istDrehstromVerbraucher = verbraucher.spannung === 400;

      // 3-phasiger Verbraucher kann nicht auf 3-polige (1-phasige) Klemme
      if (ist3PolKlemme && istDrehstromVerbraucher) {
        return false;
      }

      return true;
    },
    drop: (item: { type: string; verbraucherId: string }) => {
      if (component.type === 'abgangsklemme') {
        // Prüfe ob 3-phasiger Verbraucher auf 3-polige (1-phasige) Abgangsklemme gezogen wird
        const verbraucher = verteiler.verbraucher.find(v => v.id === item.verbraucherId);
        if (!verbraucher) return;

        const abgangsklemme = component as any;
        const ist3PolKlemme = abgangsklemme.polzahl === 3;
        const istDrehstromVerbraucher = verbraucher.spannung === 400;

        if (ist3PolKlemme && istDrehstromVerbraucher) {
          alert(`Der Drehstromverbraucher "${verbraucher.name}" (400V) kann nicht einer 3-poligen Abgangsklemme zugewiesen werden.\n\nBitte verwenden Sie eine 5-polige Abgangsklemme für Drehstromverbraucher.`);
          return;
        }

        // Verwende assignVerbraucherToComponent für korrekte Zuweisung
        // Diese Funktion kümmert sich auch um das Entfernen des alten Verbrauchers
        assignVerbraucherToComponent(item.verbraucherId, component.id);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  }), [component, verteiler.verbraucher, assignVerbraucherToComponent]);

  // Kombiniere drag und drop refs
  const combinedRef = (el: HTMLDivElement | null) => {
    drag(el);
    if (component.type === 'abgangsklemme') {
      drop(el);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (ui.wiringMode) {
      // Im Verdrahtungsmodus: Wechsel zu Normal und zum Komponenten-Tab
      setWiringMode(false);
      clearWiringWaypoints();
      setActiveTab('komponenten');
      setSelectedComponent(component.id);
    } else {
      setSelectedComponent(component.id);
    }
  };

  const handleTerminalClick = (e: React.MouseEvent, terminal: Terminal) => {
    e.stopPropagation();

    // Im Nicht-Wiring-Mode: Wechsel zu Verdrahtungsmodus
    if (!ui.wiringMode) {
      setWiringMode(true);
      setWiringStart({
        componentId: component.id,
        terminal: terminal.id,
        phase: terminal.phase,
      });
      return;
    }

    if (!ui.wiringStart) {
      setWiringStart({
        componentId: component.id,
        terminal: terminal.id,
        phase: terminal.phase,
      });
    } else if (ui.wiringStart.componentId !== component.id) {
      // Erlaube Verbindungen zwischen allen Phasen (für Klemmen etc.)
      // Die Drahtfarbe wird von der Startphase bestimmt
      addWire({
        id: crypto.randomUUID(),
        von: ui.wiringStart,
        nach: {
          componentId: component.id,
          terminal: terminal.id,
          phase: terminal.phase,
        },
        waypoints: [...(ui.wiringWaypoints || [])], // Übernehme die Zwischenpunkte
        querschnitt: 2.5,
        laenge: 1,
        phase: ui.wiringStart.phase, // Farbe vom Startpunkt
        material: 'Cu',
      });
      setWiringStart(null);
      clearWiringWaypoints();
    } else {
      setWiringStart(null);
      clearWiringWaypoints();
    }
  };

  const terminals = getComponentTerminals(component);
  const topTerminals = terminals.filter(t => t.position === 'top');
  const bottomTerminals = terminals.filter(t => t.position === 'bottom');

  const getLabel = (): string => {
    if ('charakteristik' in component && 'bemessungsStrom' in component) {
      return `${(component as any).charakteristik}${(component as any).bemessungsStrom}`;
    }
    if ('bemessungsStrom' in component) {
      return `${(component as any).bemessungsStrom}A`;
    }
    // Für Abgangsklemmen: Zeige Anzahl zugewiesener Verbraucher
    if (component.type === 'abgangsklemme') {
      const count = component.zugewieseneVerbraucher?.length || 0;
      return count > 0 ? `${component.name} (${count})` : component.name;
    }
    return component.name;
  };

  const getTooltip = (): string => {
    if (component.type === 'abgangsklemme') {
      const count = component.zugewieseneVerbraucher?.length || 0;
      return count > 0
        ? `${component.name} - ${count} Verbraucher zugewiesen\n(Verbraucher hierher ziehen zum Zuweisen)`
        : `${component.name}\n(Verbraucher hierher ziehen zum Zuweisen)`;
    }
    return component.name;
  };

  return (
    <div
      ref={combinedRef as unknown as React.Ref<HTMLDivElement>}
      onClick={handleClick}
      className={`
        absolute rounded-sm cursor-pointer
        pointer-events-auto
        transition-all duration-150 border border-gray-400
        bg-white shadow-sm
        ${isDragging ? 'opacity-50' : ''}
        ${isSelected ? 'ring-2 ring-blue-500 ring-offset-1 z-10' : ''}
        ${component.hasError ? 'error-highlight' : ''}
        ${isOver && canDrop ? 'ring-2 ring-green-500 bg-green-50' : ''}
      `}
      style={{
        left: `${component.position.slot * teWidth}px`,
        width: `${componentWidth}px`,
        height: `${COMPONENT_HEIGHT}px`,
        top: '0px',
      }}
      title={getTooltip()}
    >
      <div className="absolute left-0 right-0 flex justify-around px-1" style={{ top: '-6px' }}>
        {topTerminals.map((terminal) => (
          <TerminalPoint
            key={terminal.id}
            terminal={terminal}
            isWiringMode={ui.wiringMode}
            isWiringStart={ui.wiringStart?.componentId === component.id && ui.wiringStart?.terminal === terminal.id}
            selectedPhase={ui.selectedPhase}
            onClick={(e) => handleTerminalClick(e, terminal)}
          />
        ))}
      </div>

      <div
        className="absolute flex items-center justify-center overflow-hidden"
        style={{ top: '14px', left: '2px', right: '2px', bottom: '24px' }}
      >
        {getComponentIcon(component, Math.max(componentWidth - 6, 12), Math.max(COMPONENT_HEIGHT - 42, 30))}
      </div>

      <div
        className="absolute left-0 right-0 text-center bg-gray-100 border-t border-gray-300"
        style={{ bottom: '10px', height: '14px' }}
      >
        <span className="text-[9px] text-gray-700 font-semibold truncate block px-1 leading-[14px]">
          {getLabel()}
        </span>
      </div>

      <div className="absolute left-0 right-0 flex justify-around px-1" style={{ bottom: '-6px' }}>
        {bottomTerminals.map((terminal) => (
          <TerminalPoint
            key={terminal.id}
            terminal={terminal}
            isWiringMode={ui.wiringMode}
            isWiringStart={ui.wiringStart?.componentId === component.id && ui.wiringStart?.terminal === terminal.id}
            selectedPhase={ui.selectedPhase}
            onClick={(e) => handleTerminalClick(e, terminal)}
          />
        ))}
      </div>

      {/* Verbraucher-Anzeige für Abgangsklemmen */}
      {component.type === 'abgangsklemme' && component.zugewieseneVerbraucher && component.zugewieseneVerbraucher.length > 0 && (
        <div
          className="absolute left-0 right-0 flex flex-col items-center gap-0.5 pointer-events-none"
          style={{ top: `${COMPONENT_HEIGHT + 6}px`, maxWidth: `${componentWidth}px` }}
        >
          {component.zugewieseneVerbraucher.map((verbraucherId) => {
            const verbraucher = verteiler.verbraucher.find(v => v.id === verbraucherId);
            if (!verbraucher) return null;

            const icon = VERBRAUCHER_ICONS[verbraucher.typ] || '⚡';

            return (
              <div
                key={verbraucher.id}
                className="flex flex-col items-center"
                style={{ maxWidth: `${componentWidth}px` }}
              >
                <div className="text-xs" style={{ fontSize: '14px' }}>
                  {icon}
                </div>
                <div
                  className="text-[8px] text-gray-600 font-medium truncate text-center"
                  style={{ maxWidth: `${componentWidth}px` }}
                  title={verbraucher.name}
                >
                  {verbraucher.name}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

interface TerminalPointProps {
  terminal: Terminal;
  isWiringMode: boolean;
  isWiringStart: boolean;
  selectedPhase: Phase;
  onClick: (e: React.MouseEvent) => void;
}

const TerminalPoint: React.FC<TerminalPointProps> = ({
  terminal,
  isWiringMode,
  isWiringStart,
  onClick,
}) => {
  const color = PHASE_COLORS[terminal.phase];

  return (
    <div
      onClick={onClick}
      className={`flex flex-col items-center ${isWiringMode ? 'pointer-events-auto cursor-crosshair' : 'pointer-events-auto'}`}
    >
      <div
        className={`
          rounded-sm transition-all border-2
          ${isWiringStart ? 'ring-2 ring-yellow-400 scale-125' : ''}
          ${isWiringMode ? 'hover:scale-150 shadow-lg' : ''}
        `}
        style={{
          width: `${TERMINAL_SIZE}px`,
          height: `${TERMINAL_SIZE}px`,
          backgroundColor: color,
          borderColor: '#333',
        }}
        title={`${terminal.label || terminal.phase} - Klicken zum Verbinden`}
      />
    </div>
  );
};
