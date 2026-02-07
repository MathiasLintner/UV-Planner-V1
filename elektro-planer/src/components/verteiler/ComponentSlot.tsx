import React from 'react';
import { useDrop } from 'react-dnd';
import { v4 as uuidv4 } from 'uuid';
import { useStore } from '../../store/useStore';
import type { DragItem, ElektroComponent } from '../../types';
import { COMPONENT_LIBRARY } from '../../types';

interface ComponentSlotProps {
  railIndex: number;
  slotIndex: number;
  isOccupied: boolean;
}

const TE_WIDTH = 18;

export const ComponentSlot: React.FC<ComponentSlotProps> = ({
  railIndex,
  slotIndex,
  isOccupied,
}) => {
  const { addComponent, moveComponent, verteiler } = useStore();

  const [{ isOver, canDrop }, drop] = useDrop<DragItem, void, { isOver: boolean; canDrop: boolean }>(() => ({
    accept: ['component', 'placed-component'],
    canDrop: (item) => {
      if (isOccupied) return false;

      // Finde die Bibliotheks-Komponente anhand der variantId oder sourceId
      let libItem = item.variantId
        ? COMPONENT_LIBRARY.find((c) => c.variantId === item.variantId)
        : null;

      // Bei verschobenen Komponenten: Finde die aktuelle Komponente
      if (item.sourceId) {
        const existingComp = verteiler.komponenten.find(k => k.id === item.sourceId);
        if (existingComp) {
          const endSlot = slotIndex + existingComp.teilungseinheiten;
          const schiene = verteiler.hutschienen.find((h) => h.index === railIndex);
          if (!schiene || endSlot > schiene.slots) return false;

          const belegteSlots = verteiler.komponenten
            .filter((k) => k.position.rail === railIndex && k.id !== item.sourceId)
            .flatMap((k) => {
              const slots = [];
              for (let i = 0; i < k.teilungseinheiten; i++) {
                slots.push(k.position.slot + i);
              }
              return slots;
            });

          for (let i = slotIndex; i < endSlot; i++) {
            if (belegteSlots.includes(i)) return false;
          }
          return true;
        }
      }

      // Prüfe ob genug Platz für die neue Komponente
      if (libItem) {
        const endSlot = slotIndex + libItem.teilungseinheiten;
        const schiene = verteiler.hutschienen.find((h) => h.index === railIndex);
        if (!schiene || endSlot > schiene.slots) return false;

        // Prüfe ob alle benötigten Slots frei sind
        const belegteSlots = verteiler.komponenten
          .filter((k) => k.position.rail === railIndex)
          .flatMap((k) => {
            const slots = [];
            for (let i = 0; i < k.teilungseinheiten; i++) {
              slots.push(k.position.slot + i);
            }
            return slots;
          });

        for (let i = slotIndex; i < endSlot; i++) {
          if (belegteSlots.includes(i)) return false;
        }
      }

      return true;
    },
    drop: (item) => {
      if (item.sourceId) {
        // Verschiebe existierende Komponente
        moveComponent(item.sourceId, { rail: railIndex, slot: slotIndex });
      } else if (item.variantId) {
        // Neue Komponente hinzufügen basierend auf variantId
        const newComponent = createComponentFromVariant(item.variantId, railIndex, slotIndex);
        if (newComponent) {
          addComponent(newComponent);
        }
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  }), [railIndex, slotIndex, isOccupied, verteiler]);

  return (
    <div
      ref={drop as unknown as React.Ref<HTMLDivElement>}
      className={`
        h-full
        transition-all duration-150
        ${isOver && canDrop ? 'bg-blue-200/50' : ''}
        ${isOver && !canDrop ? 'bg-red-200/50' : ''}
        ${!isOccupied && canDrop && !isOver ? 'hover:bg-gray-200/30' : ''}
      `}
      style={{
        width: `${TE_WIDTH}px`,
        pointerEvents: isOccupied ? 'none' : 'auto',
      }}
    />
  );
};

// Hilfsfunktion zum Erstellen einer neuen Komponente basierend auf variantId
function createComponentFromVariant(
  variantId: string,
  rail: number,
  slot: number
): ElektroComponent | null {
  const libItem = COMPONENT_LIBRARY.find((c) => c.variantId === variantId);
  if (!libItem) return null;

  const baseParams = {
    id: uuidv4(),
    type: libItem.type,
    name: libItem.name,
    position: { rail, slot },
    teilungseinheiten: libItem.teilungseinheiten,
  };

  // Erstelle die Komponente basierend auf dem Typ mit den defaultParams aus der Library
  switch (libItem.type) {
    case 'fi-schalter':
      return {
        ...baseParams,
        type: 'fi-schalter',
        bemessungsStrom: (libItem.defaultParams as any).bemessungsStrom || 40,
        bemessungsFehlerstrom: (libItem.defaultParams as any).bemessungsFehlerstrom || 30,
        fiTyp: (libItem.defaultParams as any).fiTyp || 'A',
        polzahl: (libItem.defaultParams as any).polzahl || 4,
        verzoegerung: (libItem.defaultParams as any).verzoegerung || 'Standard',
      };
    case 'ls-schalter':
      return {
        ...baseParams,
        type: 'ls-schalter',
        bemessungsStrom: (libItem.defaultParams as any).bemessungsStrom || 16,
        charakteristik: (libItem.defaultParams as any).charakteristik || 'B',
        polzahl: (libItem.defaultParams as any).polzahl || 1,
        kurzschlussSchaltvermoegen: (libItem.defaultParams as any).kurzschlussSchaltvermoegen || 6,
      };
    case 'fi-ls-kombi':
      return {
        ...baseParams,
        type: 'fi-ls-kombi',
        bemessungsStrom: (libItem.defaultParams as any).bemessungsStrom || 16,
        bemessungsFehlerstrom: (libItem.defaultParams as any).bemessungsFehlerstrom || 30,
        fiTyp: (libItem.defaultParams as any).fiTyp || 'A',
        verzoegerung: (libItem.defaultParams as any).verzoegerung || 'Standard',
        charakteristik: (libItem.defaultParams as any).charakteristik || 'C',
        polzahl: (libItem.defaultParams as any).polzahl || 2,
        kurzschlussSchaltvermoegen: (libItem.defaultParams as any).kurzschlussSchaltvermoegen || 6,
      };
    case 'nh-sicherung':
      return {
        ...baseParams,
        type: 'nh-sicherung',
        bemessungsStrom: (libItem.defaultParams as any).bemessungsStrom || 63,
        groesse: (libItem.defaultParams as any).groesse || '00',
        betriebsklasse: (libItem.defaultParams as any).betriebsklasse || 'gG',
      };
    case 'schraub-sicherung':
      return {
        ...baseParams,
        type: 'schraub-sicherung',
        bemessungsStrom: (libItem.defaultParams as any).bemessungsStrom || 16,
        groesse: (libItem.defaultParams as any).groesse || 'D02',
      };
    case 'neozed-sicherung':
      return {
        ...baseParams,
        type: 'neozed-sicherung',
        bemessungsStrom: (libItem.defaultParams as any).bemessungsStrom || 16,
        kennlinie: (libItem.defaultParams as any).kennlinie || 'gG',
        polzahl: (libItem.defaultParams as any).polzahl || 1,
      };
    case 'sammelschiene':
      return {
        ...baseParams,
        type: 'sammelschiene',
        phase: (libItem.defaultParams as any).phase || 'L1',
        laenge: (libItem.defaultParams as any).laenge || 12,
        querschnitt: (libItem.defaultParams as any).querschnitt || 16,
      };
    case 'zaehler':
      return {
        ...baseParams,
        type: 'zaehler',
        art: (libItem.defaultParams as any).art || 'elektronisch',
        phasen: (libItem.defaultParams as any).phasen || 3,
      };
    case 'schuetz':
      return {
        ...baseParams,
        type: 'schuetz',
        bemessungsStrom: (libItem.defaultParams as any).bemessungsStrom || 25,
        spulenSpannung: (libItem.defaultParams as any).spulenSpannung || 230,
        polzahl: (libItem.defaultParams as any).polzahl || 3,
      };
    case 'klemme':
      return {
        ...baseParams,
        type: 'klemme',
        phase: (libItem.defaultParams as any).phase || 'N',
        querschnitt: (libItem.defaultParams as any).querschnitt || 16,
      };
    case 'versorgungsklemme':
      return {
        ...baseParams,
        type: 'versorgungsklemme',
        spannung: (libItem.defaultParams as any).spannung || 400,
        kurzschlussStrom: (libItem.defaultParams as any).kurzschlussStrom || 6,
        schleifenimpedanz: (libItem.defaultParams as any).schleifenimpedanz || 0.5,
        netzsystem: (libItem.defaultParams as any).netzsystem || 'TN-C-S',
      };
    case 'abgangsklemme':
      return {
        ...baseParams,
        type: 'abgangsklemme',
        polzahl: (libItem.defaultParams as any).polzahl || 3,
        querschnitt: (libItem.defaultParams as any).querschnitt || 16,
        zugewieseneVerbraucher: (libItem.defaultParams as any).zugewieseneVerbraucher || [],
      };
    default:
      return null;
  }
}
