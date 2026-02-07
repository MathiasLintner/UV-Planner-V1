import React from 'react';
import { useDrag } from 'react-dnd';
import { COMPONENT_LIBRARY, type ComponentLibraryItem } from '../../types';

interface DraggableComponentProps {
  item: ComponentLibraryItem;
}

const DraggableComponent: React.FC<DraggableComponentProps> = ({ item }) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'component',
    item: {
      type: 'component',
      variantId: item.variantId, // Verwende variantId statt componentType
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [item]);

  const getCategoryColor = () => {
    switch (item.kategorie) {
      case 'schutz':
        return 'bg-red-100 border-red-300';
      case 'sicherung':
        return 'bg-orange-100 border-orange-300';
      case 'schaltung':
        return 'bg-blue-100 border-blue-300';
      case 'verteilung':
        return 'bg-green-100 border-green-300';
      default:
        return 'bg-gray-100 border-gray-300';
    }
  };

  return (
    <div
      ref={drag as unknown as React.Ref<HTMLDivElement>}
      className={`
        p-2 rounded border cursor-grab
        ${getCategoryColor()}
        ${isDragging ? 'opacity-50' : ''}
        hover:shadow-md transition-shadow
      `}
    >
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-white rounded flex items-center justify-center text-sm font-bold text-gray-700">
          {item.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-800 truncate">
            {item.name}
          </div>
          <div className="text-xs text-gray-500">
            {item.teilungseinheiten} TE
          </div>
        </div>
      </div>
    </div>
  );
};

export const ComponentLibrary: React.FC = () => {
  // Gruppiere nach Kategorie
  const categories = [
    { key: 'schutz', label: 'Schutzeinrichtungen' },
    { key: 'sicherung', label: 'Sicherungen' },
    { key: 'schaltung', label: 'Schaltgeräte' },
    { key: 'verteilung', label: 'Verteilung' },
    { key: 'sonstige', label: 'Sonstige' },
  ];

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-700 px-1">Komponenten</h3>
      <p className="text-xs text-gray-500 px-1">
        Ziehen Sie Komponenten auf die Hutschienen
      </p>

      {categories.map(({ key, label }) => {
        const items = COMPONENT_LIBRARY.filter((c) => c.kategorie === key);
        if (items.length === 0) return null;

        return (
          <div key={key}>
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 px-1">
              {label}
            </h4>
            <div className="space-y-2">
              {items.map((item) => (
                <DraggableComponent key={item.variantId} item={item} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};
