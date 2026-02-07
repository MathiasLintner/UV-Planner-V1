import React from 'react';
import { useStore } from '../../store/useStore';
import { Hutschiene } from './Hutschiene';
import { WiringOverlay } from './WiringOverlay';

export const VerteilerCanvas: React.FC = () => {
  const { verteiler, ui, setSelectedComponent, addHutschiene, removeHutschiene } = useStore();

  const handleCanvasClick = () => {
    setSelectedComponent(null);
  };

  return (
    <div className="flex-1 overflow-auto p-6 bg-gray-100">
      <div className="bg-white rounded-lg shadow-lg p-6 min-w-fit">
        {/* Verteiler-Header */}
        <div className="mb-6 pb-4 border-b">
          <h2 className="text-xl font-bold text-gray-800">{verteiler.name}</h2>
          {verteiler.beschreibung && (
            <p className="text-sm text-gray-500 mt-1">{verteiler.beschreibung}</p>
          )}
          <div className="flex gap-4 mt-2 text-xs text-gray-400">
            <span>Nennspannung: {verteiler.nennspannung}V</span>
            <span>Nennstrom: {verteiler.nennstrom}A</span>
            <span>Ik: {verteiler.kurzschlussStrom}kA</span>
          </div>
        </div>

        {/* Hutschienen-Container */}
        <div
          className="relative"
          onClick={handleCanvasClick}
        >
          {verteiler.hutschienen
            .sort((a, b) => a.index - b.index)
            .map((hutschiene) => (
              <Hutschiene key={hutschiene.id} hutschiene={hutschiene} />
            ))}

          {/* Verdrahtungs-Overlay */}
          <WiringOverlay />
        </div>

        {/* Hutschienen-Steuerung */}
        <div className="mt-6 pt-4 border-t flex gap-2">
          <button
            onClick={() => addHutschiene()}
            disabled={verteiler.hutschienen.length >= 5}
            className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + Hutschiene hinzufügen
          </button>
          {verteiler.hutschienen.length > 1 && (
            <button
              onClick={() => removeHutschiene(verteiler.hutschienen.length - 1)}
              className="px-3 py-1.5 bg-red-50 text-red-600 text-sm rounded hover:bg-red-100"
            >
              - Letzte entfernen
            </button>
          )}
          <span className="ml-auto text-xs text-gray-400 self-center">
            {verteiler.hutschienen.length}/5 Hutschienen
          </span>
        </div>
      </div>
    </div>
  );
};
