import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import type { ValidationError, StromkreisResult } from '../../types';

export const ValidationPanel: React.FC = () => {
  const { validationResult, runValidation, clearValidation, setSelectedComponent, ui } = useStore();

  const handleRunValidation = () => {
    runValidation();
  };

  const handleErrorClick = (error: ValidationError) => {
    if (error.komponenteId !== 'system') {
      setSelectedComponent(error.komponenteId);
    }
  };

  const getSeverityColor = (schweregrad: ValidationError['schweregrad']) => {
    switch (schweregrad) {
      case 'kritisch':
        return 'bg-red-100 border-red-400 text-red-800';
      case 'fehler':
        return 'bg-red-50 border-red-300 text-red-700';
      case 'warnung':
        return 'bg-yellow-50 border-yellow-300 text-yellow-700';
      case 'info':
        return 'bg-blue-50 border-blue-300 text-blue-700';
      default:
        return 'bg-gray-50 border-gray-300 text-gray-700';
    }
  };

  const getSeverityIcon = (schweregrad: ValidationError['schweregrad']) => {
    switch (schweregrad) {
      case 'kritisch':
        return '🚨';
      case 'fehler':
        return '❌';
      case 'warnung':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return 'ℹ️';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-700">Prüfung</h3>
        <button
          onClick={handleRunValidation}
          className="px-3 py-1.5 bg-green-500 text-white text-sm rounded hover:bg-green-600"
        >
          ▶ Prüflauf starten
        </button>
      </div>

      {/* Keine Prüfung durchgeführt */}
      {!validationResult && (
        <div className="text-center py-8 text-gray-500">
          <div className="text-4xl mb-2">🔍</div>
          <p className="text-sm">Noch keine Prüfung durchgeführt</p>
          <p className="text-xs mt-1 text-gray-400">
            Klicken Sie auf "Prüflauf starten" um den Verteiler zu überprüfen
          </p>
        </div>
      )}

      {/* Prüfergebnis */}
      {validationResult && (
        <div className="space-y-4">
          {/* Status-Zusammenfassung */}
          <div
            className={`
              p-4 rounded-lg text-center
              ${validationResult.isValid ? 'bg-green-100' : 'bg-red-100'}
            `}
          >
            <div className="text-3xl mb-1">
              {validationResult.isValid ? '✅' : '❌'}
            </div>
            <div className={`font-medium ${validationResult.isValid ? 'text-green-800' : 'text-red-800'}`}>
              {validationResult.isValid ? 'Prüfung bestanden' : 'Fehler gefunden'}
            </div>
            <div className="text-sm text-gray-600 mt-1">
              {validationResult.errors.length} Fehler, {validationResult.warnings.length} Warnungen
            </div>
          </div>

          {/* Berechnungsergebnisse */}
          <div className="bg-gray-50 p-3 rounded-lg">
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              Berechnungen
            </h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Gesamtleistung:</span>
                <span className="font-medium">
                  {(validationResult.berechnungen.gesamtLeistung / 1000).toFixed(2)} kW
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Max. Spannungsfall:</span>
                <span className={`font-medium ${validationResult.berechnungen.spannungsfall > 4 ? 'text-red-600' : ''}`}>
                  {validationResult.berechnungen.spannungsfall.toFixed(2)} %
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Schleifenimpedanz:</span>
                <span className="font-medium">
                  {validationResult.berechnungen.schleifenimpedanz.toFixed(1)} mΩ
                </span>
              </div>
            </div>

            {/* Phasenlasten */}
            <div className="mt-3 pt-3 border-t">
              <h5 className="text-xs text-gray-500 mb-2">Phasenlasten</h5>
              <div className="space-y-1">
                {(['L1', 'L2', 'L3'] as const).map((phase) => {
                  const last = validationResult.berechnungen.phasenLasten[phase];
                  const maxLast = Math.max(
                    validationResult.berechnungen.phasenLasten.L1,
                    validationResult.berechnungen.phasenLasten.L2,
                    validationResult.berechnungen.phasenLasten.L3
                  );
                  const prozent = maxLast > 0 ? (last / maxLast) * 100 : 0;

                  return (
                    <div key={phase} className="flex items-center gap-2">
                      <span className="text-xs w-6">{phase}</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            phase === 'L1' ? 'bg-amber-700' :
                            phase === 'L2' ? 'bg-gray-800' :
                            'bg-gray-500'
                          }`}
                          style={{ width: `${prozent}%` }}
                        />
                      </div>
                      <span className="text-xs w-16 text-right">
                        {(last / 1000).toFixed(1)} kW
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Stromkreis-Ergebnisse */}
          {validationResult.stromkreise && validationResult.stromkreise.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-2">
                Stromkreise ({validationResult.stromkreise.length})
              </h4>
              <div className="space-y-2">
                {validationResult.stromkreise.map((stromkreis) => (
                  <StromkreisItem key={stromkreis.verbraucherId} stromkreis={stromkreis} />
                ))}
              </div>
            </div>
          )}

          {/* Fehlerliste */}
          {validationResult.errors.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-red-600 uppercase tracking-wide mb-2">
                Alle Fehler ({validationResult.errors.length})
              </h4>
              <div className="space-y-2">
                {validationResult.errors.map((error) => (
                  <ErrorItem
                    key={error.id}
                    error={error}
                    onClick={() => handleErrorClick(error)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Warnungen (ohne Infos) */}
          {validationResult.warnings.filter(w => w.schweregrad !== 'info').length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-yellow-600 uppercase tracking-wide mb-2">
                Alle Warnungen ({validationResult.warnings.filter(w => w.schweregrad !== 'info').length})
              </h4>
              <div className="space-y-2">
                {validationResult.warnings.filter(w => w.schweregrad !== 'info').map((warning) => (
                  <ErrorItem
                    key={warning.id}
                    error={warning}
                    onClick={() => handleErrorClick(warning)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Infos */}
          {validationResult.warnings.filter(w => w.schweregrad === 'info').length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-blue-600 uppercase tracking-wide mb-2">
                Hinweise ({validationResult.warnings.filter(w => w.schweregrad === 'info').length})
              </h4>
              <div className="space-y-2">
                {validationResult.warnings.filter(w => w.schweregrad === 'info').map((info) => (
                  <ErrorItem
                    key={info.id}
                    error={info}
                    onClick={() => handleErrorClick(info)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Prüfung zurücksetzen */}
          <button
            onClick={clearValidation}
            className="w-full px-3 py-1.5 bg-gray-100 text-gray-600 text-sm rounded hover:bg-gray-200"
          >
            Prüfergebnis zurücksetzen
          </button>
        </div>
      )}
    </div>
  );
};

// Stromkreis-Item Komponente mit aufklappbaren Details
const StromkreisItem: React.FC<{ stromkreis: StromkreisResult }> = ({ stromkreis }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { setSelectedVerbraucher } = useStore();

  const getStatusColor = (status: StromkreisResult['status']) => {
    switch (status) {
      case 'ok':
        return 'bg-green-50 border-green-400';
      case 'warnung':
        return 'bg-yellow-50 border-yellow-400';
      case 'fehler':
        return 'bg-red-50 border-red-400';
    }
  };

  const getStatusIcon = (status: StromkreisResult['status']) => {
    switch (status) {
      case 'ok':
        return '✅';
      case 'warnung':
        return '⚠️';
      case 'fehler':
        return '❌';
    }
  };

  return (
    <div
      className={`rounded border transition-all ${getStatusColor(stromkreis.status)}`}
    >
      {/* Zusammenfassung (immer sichtbar) */}
      <div
        onClick={() => {
          setIsExpanded(!isExpanded);
          setSelectedVerbraucher(stromkreis.verbraucherId);
        }}
        className="p-2 cursor-pointer hover:bg-opacity-70 flex items-center gap-2"
      >
        <span className="text-sm">{getStatusIcon(stromkreis.status)}</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">
            {stromkreis.verbraucherName}
          </div>
          <div className="text-xs text-gray-600">
            {stromkreis.berechnungen.leistung.toFixed(0)}W • {stromkreis.berechnungen.strom.toFixed(1)}A
            {stromkreis.berechnungen.spannungsfall && ` • ${stromkreis.berechnungen.spannungsfall.toFixed(2)}% Spannungsfall`}
          </div>
        </div>
        <span className="text-gray-400 text-xs">
          {isExpanded ? '▼' : '▶'}
        </span>
      </div>

      {/* Details (aufklappbar) */}
      {isExpanded && (
        <div className="px-2 pb-2 pt-1 border-t border-gray-300 space-y-2" onClick={(e) => e.stopPropagation()}>
          {/* Berechnungen */}
          <div className="text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-600">Leistung:</span>
              <span className="font-medium">{stromkreis.berechnungen.leistung.toFixed(0)} W</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Strom:</span>
              <span className="font-medium">{stromkreis.berechnungen.strom.toFixed(2)} A</span>
            </div>
            {stromkreis.berechnungen.leitungslaenge && (
              <div className="flex justify-between">
                <span className="text-gray-600">Leitungslänge:</span>
                <span className="font-medium">{stromkreis.berechnungen.leitungslaenge} m</span>
              </div>
            )}
            {stromkreis.berechnungen.querschnitt && (
              <div className="flex justify-between">
                <span className="text-gray-600">Querschnitt:</span>
                <span className="font-medium">{stromkreis.berechnungen.querschnitt} mm²</span>
              </div>
            )}
            {stromkreis.berechnungen.spannungsfall !== undefined && (
              <div className="flex justify-between">
                <span className="text-gray-600">Spannungsfall:</span>
                <span className={`font-medium ${stromkreis.berechnungen.spannungsfall > 4 ? 'text-red-600' : ''}`}>
                  {stromkreis.berechnungen.spannungsfall.toFixed(2)} %
                </span>
              </div>
            )}
            {stromkreis.berechnungen.schleifenimpedanz !== undefined && (
              <div className="flex justify-between">
                <span className="text-gray-600">Schleifenimpedanz:</span>
                <span className="font-medium">
                  {stromkreis.berechnungen.schleifenimpedanz.toFixed(1)} mΩ
                </span>
              </div>
            )}
          </div>

          {/* Fehler und Warnungen */}
          {stromkreis.fehler.length > 0 && (
            <div className="pt-2 border-t border-red-300">
              <div className="text-xs font-medium text-red-700 mb-1">Fehler:</div>
              {stromkreis.fehler.map((fehler) => (
                <div key={fehler.id} className="text-xs text-red-600 mb-1">
                  • {fehler.beschreibung}
                </div>
              ))}
            </div>
          )}
          {stromkreis.warnungen.length > 0 && (
            <div className="pt-2 border-t border-yellow-300">
              <div className="text-xs font-medium text-yellow-700 mb-1">Warnungen:</div>
              {stromkreis.warnungen.map((warnung) => (
                <div key={warnung.id} className="text-xs text-yellow-600 mb-1">
                  • {warnung.beschreibung}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Fehler-Item Komponente
const ErrorItem: React.FC<{
  error: ValidationError;
  onClick: () => void;
}> = ({ error, onClick }) => {
  const getSeverityColor = (schweregrad: ValidationError['schweregrad']) => {
    switch (schweregrad) {
      case 'kritisch':
        return 'bg-red-100 border-red-400';
      case 'fehler':
        return 'bg-red-50 border-red-300';
      case 'warnung':
        return 'bg-yellow-50 border-yellow-300';
      case 'info':
        return 'bg-blue-50 border-blue-300';
      default:
        return 'bg-gray-50 border-gray-300';
    }
  };

  const getSeverityIcon = (schweregrad: ValidationError['schweregrad']) => {
    switch (schweregrad) {
      case 'kritisch':
        return '🚨';
      case 'fehler':
        return '❌';
      case 'warnung':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return 'ℹ️';
    }
  };

  return (
    <div
      onClick={onClick}
      className={`
        p-2 rounded border cursor-pointer transition-all hover:shadow-sm
        ${getSeverityColor(error.schweregrad)}
      `}
    >
      <div className="flex items-start gap-2">
        <span className="text-sm">{getSeverityIcon(error.schweregrad)}</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">
            {error.komponenteName}
          </div>
          <div className="text-xs text-gray-600 mt-0.5">
            {error.beschreibung}
          </div>
          <div className="text-xs text-blue-600 mt-1">
            💡 {error.hinweis}
          </div>
        </div>
      </div>
    </div>
  );
};
