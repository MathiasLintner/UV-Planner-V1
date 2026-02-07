import React from 'react';
import { useStore } from '../../store/useStore';
import { ComponentLibrary } from './ComponentLibrary';
import { PropertyPanel } from './PropertyPanel';
import { WirePropertyPanel } from './WirePropertyPanel';
import { VerbraucherPanel } from './VerbraucherPanel';
import { ValidationPanel } from './ValidationPanel';

export const Sidebar: React.FC = () => {
  const { ui, setActiveTab } = useStore();

  const tabs = [
    { id: 'komponenten' as const, label: 'Komponenten', icon: '🔧' },
    { id: 'verbraucher' as const, label: 'Verbraucher', icon: '⚡' },
    { id: 'pruefung' as const, label: 'Prüfung', icon: '✓' },
  ];

  // Zeige WirePropertyPanel wenn ein Draht ausgewählt ist
  const showWirePanel = ui.selectedWireId !== null;

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full">
      {/* Tab-Navigation */}
      <div className="flex border-b">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex-1 py-3 text-sm font-medium transition-colors
              ${ui.activeTab === tab.id
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }
            `}
          >
            <span className="mr-1">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab-Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {ui.activeTab === 'komponenten' && (
          <div className="space-y-6">
            {/* Properties oben anzeigen */}
            {showWirePanel ? <WirePropertyPanel /> : <PropertyPanel />}
            <hr />
            <ComponentLibrary />
          </div>
        )}

        {ui.activeTab === 'verbraucher' && <VerbraucherPanel />}

        {ui.activeTab === 'pruefung' && <ValidationPanel />}
      </div>
    </div>
  );
};
