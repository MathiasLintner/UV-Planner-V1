import React, { useState, useRef } from 'react';
import { useStore } from '../../store/useStore';
import { exportToPDF, exportToExcel } from '../../utils/export';
import type { Phase, Verteiler } from '../../types';
import { PHASE_COLORS } from '../../types';

// Projektdatei-Struktur
interface ProjectFile {
  version: string;
  timestamp: string;
  verteiler: Verteiler;
}

export const Header: React.FC = () => {
  const {
    verteiler,
    ui,
    setWiringMode,
    setWiringOrthoMode,
    setSelectedPhase,
    resetProject,
    resetProjectCustom,
    loadProject,
    updateVerteilerInfo,
  } = useStore();
  const [showSettings, setShowSettings] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [customSlots, setCustomSlots] = useState(24);
  const [customSchienen, setCustomSchienen] = useState(3);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportPDF = async () => {
    await exportToPDF(verteiler);
    setShowExportMenu(false);
  };

  const handleExportExcel = () => {
    exportToExcel(verteiler);
    setShowExportMenu(false);
  };

  const handleNewProject = () => {
    setShowNewProjectDialog(true);
  };

  const handleCreateStandard = () => {
    resetProject();
    setShowNewProjectDialog(false);
  };

  const handleCreateCustom = () => {
    resetProjectCustom({ slots: customSlots, schienen: customSchienen });
    setShowNewProjectDialog(false);
  };

  // Projekt speichern
  const handleSaveProject = () => {
    const projectData: ProjectFile = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      verteiler: verteiler,
    };

    const jsonString = JSON.stringify(projectData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    // Dateiname aus Verteiler-Name erstellen
    const fileName = `${verteiler.name.replace(/[^a-zA-Z0-9äöüÄÖÜß\-_]/g, '_')}_${new Date().toISOString().split('T')[0]}.eplan`;

    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Projekt laden
  const handleLoadProject = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const projectData = JSON.parse(content) as ProjectFile;

        // Validiere die Projektdatei
        if (!projectData.verteiler || !projectData.verteiler.hutschienen) {
          alert('Ungültige Projektdatei: Die Datei enthält keine gültigen Verteilerdaten.');
          return;
        }

        // Lade das Projekt
        loadProject({ verteiler: projectData.verteiler });
        alert(`Projekt "${projectData.verteiler.name}" erfolgreich geladen!`);
      } catch (error) {
        console.error('Fehler beim Laden der Projektdatei:', error);
        alert('Fehler beim Laden der Projektdatei. Bitte überprüfen Sie, ob es sich um eine gültige .eplan Datei handelt.');
      }
    };

    reader.readAsText(file);

    // Reset file input
    event.target.value = '';
  };

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-2">
      <div className="flex items-center justify-between">
        {/* Logo & Titel */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚡</span>
            <div>
              <h1 className="text-lg font-bold text-gray-800">Elektro-Planer</h1>
              <p className="text-xs text-gray-500">Lern- und Simulationsumgebung</p>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2">
          {/* Projekt-Aktionen */}
          <div className="flex items-center gap-1 border-r pr-2 mr-2">
            <button
              onClick={handleNewProject}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
              title="Neues Projekt"
            >
              📄 Neu
            </button>
            <button
              onClick={handleSaveProject}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
              title="Projekt speichern"
            >
              💾 Speichern
            </button>
            <button
              onClick={handleLoadProject}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
              title="Projekt öffnen"
            >
              📂 Öffnen
            </button>
            {/* Hidden file input for loading projects */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".eplan,.json"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Verdrahtungsmodus */}
          <div className="flex items-center gap-2 border-r pr-2 mr-2">
            <button
              onClick={() => setWiringMode(!ui.wiringMode)}
              className={`
                px-3 py-1.5 text-sm rounded flex items-center gap-1
                ${ui.wiringMode
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
                }
              `}
            >
              🔗 Verdrahten
            </button>

            {/* Ortho-Modus Button */}
            {ui.wiringMode && (
              <button
                onClick={() => setWiringOrthoMode(!ui.wiringOrthoMode)}
                className={`
                  px-2 py-1.5 text-sm rounded flex items-center gap-1
                  ${ui.wiringOrthoMode
                    ? 'bg-green-500 text-white'
                    : 'text-gray-600 hover:bg-gray-100 border'
                  }
                `}
                title={ui.wiringOrthoMode ? 'Ortho-Modus aktiv (nur horizontal/vertikal)' : 'Ortho-Modus aktivieren'}
              >
                ┼
              </button>
            )}

            {/* Phasen-Auswahl */}
            {ui.wiringMode && (
              <div className="flex gap-1">
                {(['L1', 'L2', 'L3', 'N', 'PE'] as Phase[]).map((phase) => (
                  <button
                    key={phase}
                    onClick={() => setSelectedPhase(phase)}
                    className={`
                      w-8 h-8 rounded text-xs font-bold transition-all
                      ${ui.selectedPhase === phase
                        ? 'ring-2 ring-offset-1 ring-blue-500'
                        : ''
                      }
                    `}
                    style={{
                      backgroundColor: PHASE_COLORS[phase],
                      color: phase === 'L2' ? '#fff' : phase === 'N' ? '#fff' : '#fff',
                    }}
                    title={`Phase ${phase}`}
                  >
                    {phase}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Export */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded flex items-center gap-1"
            >
              📤 Export
              <span className="text-xs">▼</span>
            </button>

            {showExportMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg py-1 z-50 min-w-[150px]">
                <button
                  onClick={handleExportPDF}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50"
                >
                  📄 PDF Export
                </button>
                <button
                  onClick={handleExportExcel}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50"
                >
                  📊 Excel Export
                </button>
              </div>
            )}
          </div>

          {/* Einstellungen */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
            title="Verteiler-Einstellungen"
          >
            ⚙️
          </button>
        </div>
      </div>

      {/* Einstellungen-Panel */}
      {showSettings && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-medium text-gray-700 mb-3">Verteiler-Einstellungen</h3>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Name</label>
              <input
                type="text"
                value={verteiler.name}
                onChange={(e) => updateVerteilerInfo({ name: e.target.value })}
                className="w-full px-2 py-1.5 border rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Nennspannung (V)</label>
              <select
                value={verteiler.nennspannung}
                onChange={(e) => updateVerteilerInfo({ nennspannung: Number(e.target.value) })}
                className="w-full px-2 py-1.5 border rounded text-sm"
              >
                <option value={230}>230V (1-phasig)</option>
                <option value={400}>400V (3-phasig)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Nennstrom (A)</label>
              <select
                value={verteiler.nennstrom}
                onChange={(e) => updateVerteilerInfo({ nennstrom: Number(e.target.value) })}
                className="w-full px-2 py-1.5 border rounded text-sm"
              >
                <option value={25}>25 A</option>
                <option value={35}>35 A</option>
                <option value={50}>50 A</option>
                <option value={63}>63 A</option>
                <option value={80}>80 A</option>
                <option value={100}>100 A</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Kurzschlussstrom (kA)</label>
              <select
                value={verteiler.kurzschlussStrom}
                onChange={(e) => updateVerteilerInfo({ kurzschlussStrom: Number(e.target.value) })}
                className="w-full px-2 py-1.5 border rounded text-sm"
              >
                <option value={3}>3 kA</option>
                <option value={6}>6 kA</option>
                <option value={10}>10 kA</option>
                <option value={15}>15 kA</option>
                <option value={25}>25 kA</option>
              </select>
            </div>
          </div>
          <div className="mt-3">
            <label className="block text-xs text-gray-500 mb-1">Beschreibung</label>
            <textarea
              value={verteiler.beschreibung || ''}
              onChange={(e) => updateVerteilerInfo({ beschreibung: e.target.value })}
              className="w-full px-2 py-1.5 border rounded text-sm"
              rows={2}
              placeholder="Optionale Beschreibung des Verteilers..."
            />
          </div>
        </div>
      )}

      {/* Klick außerhalb schließt Dropdown */}
      {showExportMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowExportMenu(false)}
        />
      )}

      {/* Neues Projekt Dialog */}
      {showNewProjectDialog && (
        <>
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-50"
            onClick={() => setShowNewProjectDialog(false)}
          />
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl z-50 w-[400px]">
            <div className="p-4 border-b">
              <h2 className="text-lg font-bold text-gray-800">Neues Projekt erstellen</h2>
              <p className="text-sm text-gray-500 mt-1">
                Nicht gespeicherte Änderungen gehen verloren.
              </p>
            </div>

            <div className="p-4 space-y-4">
              {/* Standard-Verteiler Option */}
              <div
                className="p-3 border rounded-lg cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-colors"
                onClick={handleCreateStandard}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📋</span>
                  <div>
                    <h3 className="font-medium text-gray-800">Standard-Verteiler</h3>
                    <p className="text-sm text-gray-500">3 Schienen × 24 TE</p>
                  </div>
                </div>
              </div>

              {/* Trennlinie */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">oder</span>
                </div>
              </div>

              {/* Benutzerdefinierte Konfiguration */}
              <div className="p-3 border rounded-lg">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">⚙️</span>
                  <h3 className="font-medium text-gray-800">Benutzerdefiniert</h3>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Teilungseinheiten (TE)
                    </label>
                    <select
                      value={customSlots}
                      onChange={(e) => setCustomSlots(Number(e.target.value))}
                      className="w-full px-2 py-1.5 border rounded text-sm"
                    >
                      <option value={12}>12 TE</option>
                      <option value={18}>18 TE</option>
                      <option value={24}>24 TE</option>
                      <option value={36}>36 TE</option>
                      <option value={48}>48 TE</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Anzahl Hutschienen
                    </label>
                    <select
                      value={customSchienen}
                      onChange={(e) => setCustomSchienen(Number(e.target.value))}
                      className="w-full px-2 py-1.5 border rounded text-sm"
                    >
                      <option value={1}>1 Schiene</option>
                      <option value={2}>2 Schienen</option>
                      <option value={3}>3 Schienen</option>
                      <option value={4}>4 Schienen</option>
                      <option value={5}>5 Schienen</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={handleCreateCustom}
                  className="w-full mt-3 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm font-medium"
                >
                  Erstellen ({customSchienen} × {customSlots} TE)
                </button>
              </div>
            </div>

            <div className="p-4 border-t bg-gray-50 rounded-b-lg">
              <button
                onClick={() => setShowNewProjectDialog(false)}
                className="w-full px-4 py-2 text-gray-600 hover:bg-gray-200 rounded transition-colors text-sm"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </>
      )}
    </header>
  );
};
