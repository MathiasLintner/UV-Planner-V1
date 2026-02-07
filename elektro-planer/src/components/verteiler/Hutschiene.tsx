import React from 'react';
import { useStore } from '../../store/useStore';
import type { Hutschiene as HutschieneType } from '../../types';
import { ComponentSlot } from './ComponentSlot';
import { PlacedComponent } from './PlacedComponent';
import { TE_WIDTH, COMPONENT_HEIGHT, WIRE_AREA_TOP, WIRE_AREA_BOTTOM, HUTSCHIENE_HORIZONTAL_MARGIN } from '../../utils/constants';

interface HutschieneProps {
  hutschiene: HutschieneType;
}

export const Hutschiene: React.FC<HutschieneProps> = ({ hutschiene }) => {
  const { verteiler } = useStore();

  const komponenten = verteiler.komponenten.filter(
    (k) => k.position.rail === hutschiene.index
  );

  const belegung: (string | null)[] = new Array(hutschiene.slots).fill(null);
  for (const komp of komponenten) {
    for (let i = 0; i < komp.teilungseinheiten; i++) {
      const slot = komp.position.slot + i;
      if (slot < hutschiene.slots) {
        belegung[slot] = komp.id;
      }
    }
  }

  const totalWidth = hutschiene.slots * TE_WIDTH + 2 * HUTSCHIENE_HORIZONTAL_MARGIN;

  return (
    <div style={{ marginBottom: `${WIRE_AREA_BOTTOM}px` }}>
      {/* Drahtbereich oben + Hutschiene mit Raster - mit Gesamtbreite für Verdrahtung */}
      <div className="relative" style={{ width: `${totalWidth}px`, height: `${WIRE_AREA_TOP + COMPONENT_HEIGHT}px`, paddingTop: `${WIRE_AREA_TOP}px` }}>
        {/* Hutschienen-Label - links neben der Schiene auf gleicher Höhe */}
        <div
          className="absolute flex flex-col items-end justify-center pr-2"
          style={{
            left: 0,
            width: `${HUTSCHIENE_HORIZONTAL_MARGIN}px`,
            top: `${WIRE_AREA_TOP}px`,
            height: `${COMPONENT_HEIGHT}px`,
          }}
        >
          <span className="text-sm font-medium text-gray-600 whitespace-nowrap">
            Schiene {hutschiene.index + 1}
          </span>
          <span className="text-xs text-gray-400">
            ({hutschiene.slots} TE)
          </span>
        </div>
        {/* Hutschienen-Hintergrund (in der Mitte der Komponenten, zentriert) */}
        <div
          className="hutschiene absolute"
          style={{
            width: `${hutschiene.slots * TE_WIDTH}px`,
            height: '20px',
            left: `${HUTSCHIENE_HORIZONTAL_MARGIN}px`,
            top: `${WIRE_AREA_TOP + COMPONENT_HEIGHT / 2 - 10}px`,
            zIndex: 1,
          }}
        >
          {/* Raster-Linien */}
          {Array.from({ length: hutschiene.slots + 1 }).map((_, i) => (
            <div
              key={i}
              className="absolute top-0 bottom-0 border-l border-gray-400/30"
              style={{ left: `${i * TE_WIDTH}px` }}
            />
          ))}
        </div>

        {/* Komponenten-Slots (Drop-Zonen) - ZUERST rendern (unten), zentriert */}
        <div
          className="absolute flex"
          style={{
            left: `${HUTSCHIENE_HORIZONTAL_MARGIN}px`,
            width: `${hutschiene.slots * TE_WIDTH}px`,
            height: `${COMPONENT_HEIGHT}px`,
            top: `${WIRE_AREA_TOP}px`,
            zIndex: 2,
          }}
        >
          {Array.from({ length: hutschiene.slots }).map((_, slotIndex) => (
            <ComponentSlot
              key={slotIndex}
              railIndex={hutschiene.index}
              slotIndex={slotIndex}
              isOccupied={belegung[slotIndex] !== null}
            />
          ))}
        </div>

        {/* Platzierte Komponenten - DANACH rendern (oben, klickbar), zentriert */}
        <div
          className="absolute"
          style={{
            left: `${HUTSCHIENE_HORIZONTAL_MARGIN}px`,
            width: `${hutschiene.slots * TE_WIDTH}px`,
            height: `${COMPONENT_HEIGHT}px`,
            top: `${WIRE_AREA_TOP}px`,
            zIndex: 3,
            pointerEvents: 'none', // Container lässt Klicks durch für Drop-Zonen
          }}
        >
          {komponenten.map((komponente) => (
            <PlacedComponent
              key={komponente.id}
              component={komponente}
              teWidth={TE_WIDTH}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
