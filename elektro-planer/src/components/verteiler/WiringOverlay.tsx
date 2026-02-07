import React, { useRef, useEffect, useState } from 'react';
import { useStore } from '../../store/useStore';
import type { Wire, WireWaypoint } from '../../types';
import { PHASE_COLORS } from '../../types';
import { getComponentTerminals } from '../../utils/terminals';
import {
  TE_WIDTH,
  COMPONENT_HEIGHT,
  WIRE_AREA_TOP,
  WIRE_AREA_BOTTOM,
  LABEL_HEIGHT,
  RAIL_TOTAL_HEIGHT,
  WIRE_LANES,
  WIRE_LANE_SPACING,
  WIRE_GRID_X,
  HUTSCHIENE_HORIZONTAL_MARGIN,
} from '../../utils/constants';

export const WiringOverlay: React.FC = () => {
  const { verteiler, ui, removeWire, addWiringWaypoint, addWire, setWiringStart, clearWiringWaypoints, setSelectedWire } = useStore();
  const svgRef = useRef<SVGSVGElement>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [snappedPos, setSnappedPos] = useState<{ x: number; y: number } | null>(null);

  const maxSlots = Math.max(...verteiler.hutschienen.map((h) => h.slots));
  const svgWidth = maxSlots * TE_WIDTH + 2 * HUTSCHIENE_HORIZONTAL_MARGIN + 100;
  const svgHeight = verteiler.hutschienen.length * RAIL_TOTAL_HEIGHT + 50;

  // Berechne die Y-Position der Komponenten-Oberkante für eine Hutschiene
  const getComponentTopY = (railIndex: number): number => {
    return railIndex * RAIL_TOTAL_HEIGHT + LABEL_HEIGHT + WIRE_AREA_TOP;
  };

  // Berechne die Y-Position für eine Drahtbahn
  const getLaneY = (railIndex: number, position: 'top' | 'bottom', laneIndex: number): number => {
    const componentTopY = getComponentTopY(railIndex);
    if (position === 'top') {
      // Oberhalb der Komponente (von unten nach oben nummeriert)
      return componentTopY - (laneIndex + 1) * WIRE_LANE_SPACING;
    } else {
      // Unterhalb der Komponente (von oben nach unten nummeriert)
      return componentTopY + COMPONENT_HEIGHT + (laneIndex + 1) * WIRE_LANE_SPACING;
    }
  };

  // Snap Position zum nächsten Rasterpunkt
  const snapToGrid = (x: number, y: number): { x: number; y: number; railIndex: number; position: 'top' | 'bottom'; laneIndex: number } | null => {
    // Finde die nächste Hutschiene
    for (let railIndex = 0; railIndex < verteiler.hutschienen.length; railIndex++) {
      const componentTopY = getComponentTopY(railIndex);

      // Prüfe oberen Bereich
      for (let lane = 0; lane < WIRE_LANES; lane++) {
        const laneY = getLaneY(railIndex, 'top', lane);
        if (Math.abs(y - laneY) < WIRE_LANE_SPACING) {
          // Snap X auf feines Raster (WIRE_GRID_X = 6px)
          const snappedX = Math.round(x / WIRE_GRID_X) * WIRE_GRID_X;
          return { x: snappedX, y: laneY, railIndex, position: 'top', laneIndex: lane };
        }
      }

      // Prüfe unteren Bereich
      for (let lane = 0; lane < WIRE_LANES; lane++) {
        const laneY = getLaneY(railIndex, 'bottom', lane);
        if (Math.abs(y - laneY) < WIRE_LANE_SPACING) {
          const snappedX = Math.round(x / WIRE_GRID_X) * WIRE_GRID_X;
          return { x: snappedX, y: laneY, railIndex, position: 'bottom', laneIndex: lane };
        }
      }
    }

    // Fallback: Snap nur X
    const snappedX = Math.round(x / WIRE_GRID_X) * WIRE_GRID_X;
    return { x: snappedX, y, railIndex: -1, position: 'top', laneIndex: -1 };
  };

  useEffect(() => {
    if (!ui.wiringMode) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        setMousePos({ x, y });

        const snapped = snapToGrid(x, y);
        if (snapped) {
          setSnappedPos({ x: snapped.x, y: snapped.y });
        }
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [ui.wiringMode, verteiler.hutschienen.length]);

  const getTerminalPosition = (componentId: string, terminalId: string): { x: number; y: number; position: 'top' | 'bottom'; rail: number } | null => {
    const component = verteiler.komponenten.find((c) => c.id === componentId);
    if (!component) return null;

    const terminals = getComponentTerminals(component);
    const terminal = terminals.find(t => t.id === terminalId);

    const componentWidth = component.teilungseinheiten * TE_WIDTH - 2;
    const componentX = HUTSCHIENE_HORIZONTAL_MARGIN + component.position.slot * TE_WIDTH;
    // Verwende die gleiche Berechnung wie getComponentTopY
    const componentY = getComponentTopY(component.position.rail);

    // Terminal-Offset: In PlacedComponent.tsx sind die Terminals um 6px versetzt
    const TERMINAL_OFFSET = 6;
    // Padding: px-1 = 4px auf jeder Seite
    const TERMINAL_PADDING = 4;
    // Terminal-Größe (für Zentrierung)
    const TERMINAL_SIZE = 10;

    if (!terminal) {
      return {
        x: componentX + componentWidth / 2,
        y: componentY + COMPONENT_HEIGHT / 2,
        position: 'top',
        rail: component.position.rail,
      };
    }

    // Berechne die Terminal-Positionen entsprechend justify-around + px-1
    // Die Terminals sind in einem Bereich von (componentWidth - 2*TERMINAL_PADDING)
    // justify-around: gleicher Abstand zwischen allen Elementen, halber Abstand am Rand
    const samePositionTerminals = terminals.filter(t => t.position === terminal.position);
    const terminalIndex = samePositionTerminals.findIndex(t => t.id === terminal.id);
    const numTerminals = samePositionTerminals.length;

    // Verfügbare Breite für Terminals (abzüglich Padding)
    const availableWidth = componentWidth - 2 * TERMINAL_PADDING;

    // justify-around: Elemente gleichmäßig verteilen mit halbem Abstand am Rand
    // Position = padding + (index + 0.5) * (availableWidth / numTerminals)
    const terminalX = componentX + TERMINAL_PADDING + (terminalIndex + 0.5) * (availableWidth / numTerminals);

    return {
      x: terminalX,
      // Top-Terminals sind 6px oberhalb, Bottom-Terminals 6px unterhalb der Komponente
      y: terminal.position === 'top'
        ? componentY - TERMINAL_OFFSET
        : componentY + COMPONENT_HEIGHT + TERMINAL_OFFSET,
      position: terminal.position,
      rail: component.position.rail,
    };
  };

  // Erstelle SVG-Pfad aus Waypoints
  const createPathFromWaypoints = (startX: number, startY: number, waypoints: WireWaypoint[], endX: number, endY: number): string => {
    let path = `M ${startX} ${startY}`;

    for (const wp of waypoints) {
      path += ` L ${wp.x} ${wp.y}`;
    }

    path += ` L ${endX} ${endY}`;
    return path;
  };

  const renderWire = (wire: Wire) => {
    const vonPos = getTerminalPosition(wire.von.componentId, wire.von.terminal);
    const nachPos = getTerminalPosition(wire.nach.componentId, wire.nach.terminal);

    if (!vonPos || !nachPos) return null;

    const color = PHASE_COLORS[wire.phase];
    const waypoints = wire.waypoints || [];
    const isSelected = ui.selectedWireId === wire.id;

    const path = createPathFromWaypoints(vonPos.x, vonPos.y, waypoints, nachPos.x, nachPos.y);

    return (
      <g
        key={wire.id}
        className="cursor-pointer group"
        onClick={(e) => handleWireClick(e, wire.id)}
        style={{ pointerEvents: 'auto' }}
      >
        {/* Highlight für ausgewählten Draht */}
        {isSelected && (
          <path
            d={path}
            stroke="#3B82F6"
            strokeWidth={8}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="opacity-40"
            style={{ pointerEvents: 'none' }}
          />
        )}
        {/* Unsichtbarer breiter Pfad für einfacheres Klicken */}
        <path
          d={path}
          stroke="transparent"
          strokeWidth={16}
          fill="none"
          style={{ pointerEvents: 'stroke' }}
        />
        <path
          d={path}
          stroke={color}
          strokeWidth={isSelected ? 3.5 : 2.5}
          fill="none"
          className="group-hover:stroke-[4] transition-all"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ pointerEvents: 'none' }}
        />
        <circle
          cx={vonPos.x}
          cy={vonPos.y}
          r={isSelected ? 5 : 4}
          fill={color}
          stroke={isSelected ? "#3B82F6" : "#333"}
          strokeWidth={isSelected ? 2 : 1}
          style={{ pointerEvents: 'auto' }}
        />
        <circle
          cx={nachPos.x}
          cy={nachPos.y}
          r={isSelected ? 5 : 4}
          fill={color}
          stroke={isSelected ? "#3B82F6" : "#333"}
          strokeWidth={isSelected ? 2 : 1}
          style={{ pointerEvents: 'auto' }}
        />
      </g>
    );
  };

  // Berechnet die Ortho-Position (nur horizontal oder vertikal vom letzten Punkt)
  const getOrthoPosition = (lastPoint: { x: number; y: number }, currentPos: { x: number; y: number }): { x: number; y: number } => {
    const dx = Math.abs(currentPos.x - lastPoint.x);
    const dy = Math.abs(currentPos.y - lastPoint.y);

    // Wähle die Richtung mit der größeren Distanz
    if (dx > dy) {
      // Horizontal
      return { x: currentPos.x, y: lastPoint.y };
    } else {
      // Vertikal
      return { x: lastPoint.x, y: currentPos.y };
    }
  };

  const renderWiringPreview = () => {
    if (!ui.wiringMode || !ui.wiringStart) return null;

    const startPos = getTerminalPosition(ui.wiringStart.componentId, ui.wiringStart.terminal);
    if (!startPos) return null;

    const color = PHASE_COLORS[ui.wiringStart.phase];
    const waypoints = ui.wiringWaypoints || [];

    // Bestimme den letzten Referenzpunkt (letzter Waypoint oder Startpunkt)
    const lastPoint = waypoints.length > 0 ? waypoints[waypoints.length - 1] : startPos;

    // Erstelle Pfad von Start über Waypoints zum Cursor
    let previewPath = `M ${startPos.x} ${startPos.y}`;
    for (const wp of waypoints) {
      previewPath += ` L ${wp.x} ${wp.y}`;
    }

    let endPos = snappedPos || mousePos;

    // Im Ortho-Modus: Beschränke auf horizontal oder vertikal
    if (endPos && ui.wiringOrthoMode) {
      endPos = getOrthoPosition(lastPoint, endPos);
    }

    if (endPos) {
      previewPath += ` L ${endPos.x} ${endPos.y}`;
    }

    return (
      <>
        {/* Vorschau-Pfad */}
        <path
          d={previewPath}
          stroke={color}
          strokeWidth={2}
          strokeDasharray="5,5"
          fill="none"
          className="pointer-events-none"
        />

        {/* Startpunkt */}
        <circle
          cx={startPos.x}
          cy={startPos.y}
          r={6}
          fill={color}
          stroke="#fff"
          strokeWidth={2}
          className="pointer-events-none animate-pulse"
        />

        {/* Waypoints */}
        {waypoints.map((wp, i) => (
          <circle
            key={i}
            cx={wp.x}
            cy={wp.y}
            r={4}
            fill={color}
            stroke="#fff"
            strokeWidth={1}
            className="pointer-events-none"
          />
        ))}

        {/* Cursor-Position (gesnapped, im Ortho-Modus angepasst) */}
        {endPos && (
          <circle
            cx={endPos.x}
            cy={endPos.y}
            r={5}
            fill="none"
            stroke={color}
            strokeWidth={2}
            className="pointer-events-none"
          />
        )}
      </>
    );
  };

  // Raster-Linien für visuelle Hilfe (nur im Wiring-Mode)
  const renderGridLines = () => {
    if (!ui.wiringMode) return null;

    const lines: React.ReactElement[] = [];

    for (let railIndex = 0; railIndex < verteiler.hutschienen.length; railIndex++) {
      // Obere Drahtbahnen
      for (let lane = 0; lane < WIRE_LANES; lane++) {
        const y = getLaneY(railIndex, 'top', lane);
        lines.push(
          <line
            key={`top-${railIndex}-${lane}`}
            x1={0}
            y1={y}
            x2={svgWidth}
            y2={y}
            stroke="#e5e7eb"
            strokeWidth={0.5}
            strokeDasharray="2,4"
            className="pointer-events-none"
          />
        );
      }

      // Untere Drahtbahnen
      for (let lane = 0; lane < WIRE_LANES; lane++) {
        const y = getLaneY(railIndex, 'bottom', lane);
        lines.push(
          <line
            key={`bottom-${railIndex}-${lane}`}
            x1={0}
            y1={y}
            x2={svgWidth}
            y2={y}
            stroke="#e5e7eb"
            strokeWidth={0.5}
            strokeDasharray="2,4"
            className="pointer-events-none"
          />
        );
      }
    }

    return <g className="opacity-50">{lines}</g>;
  };

  const handleWireClick = (e: React.MouseEvent, wireId: string) => {
    e.stopPropagation(); // Verhindere dass der SVG-Click-Handler auch feuert
    // Wähle den Draht aus (zeigt Eigenschaften in der Sidebar)
    setSelectedWire(wireId);
  };

  // Klick auf SVG um Waypoint hinzuzufügen
  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!ui.wiringMode || !ui.wiringStart) return;

    // Verhindere Klicks auf Drähte
    if ((e.target as Element).tagName === 'path' || (e.target as Element).tagName === 'circle') {
      return;
    }

    if (snappedPos) {
      // Im Ortho-Modus: Berechne die eingeschränkte Position
      if (ui.wiringOrthoMode) {
        const startPos = getTerminalPosition(ui.wiringStart.componentId, ui.wiringStart.terminal);
        if (startPos) {
          const waypoints = ui.wiringWaypoints || [];
          const lastPoint = waypoints.length > 0 ? waypoints[waypoints.length - 1] : startPos;
          const orthoPos = getOrthoPosition(lastPoint, snappedPos);
          addWiringWaypoint({ x: orthoPos.x, y: orthoPos.y });
        }
      } else {
        addWiringWaypoint({ x: snappedPos.x, y: snappedPos.y });
      }
    }
  };

  // Rechtsklick zum Abbrechen
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (ui.wiringMode && ui.wiringStart) {
      setWiringStart(null);
      clearWiringWaypoints();
    }
  };

  return (
    <div className="absolute top-0 left-0" style={{ marginTop: '0', pointerEvents: 'none' }}>
      <svg
        ref={svgRef}
        width={svgWidth}
        height={svgHeight}
        className={ui.wiringMode ? 'cursor-crosshair' : ''}
        style={{ overflow: 'visible', pointerEvents: ui.wiringMode ? 'auto' : 'none' }}
        onClick={handleSvgClick}
        onContextMenu={handleContextMenu}
      >
        {renderGridLines()}
        {verteiler.verbindungen.map(renderWire)}
        {renderWiringPreview()}
      </svg>
    </div>
  );
};
