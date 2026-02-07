import React, { useEffect, useCallback } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Header } from './components/common';
import { VerteilerCanvas } from './components/verteiler';
import { Sidebar } from './components/sidebar';
import { useStore } from './store/useStore';

function App() {
  const selectedComponentId = useStore((state) => state.ui.selectedComponentId);
  const selectedWireId = useStore((state) => state.ui.selectedWireId);
  const removeComponent = useStore((state) => state.removeComponent);
  const removeWire = useStore((state) => state.removeWire);
  const setSelectedComponent = useStore((state) => state.setSelectedComponent);
  const setSelectedWire = useStore((state) => state.setSelectedWire);

  // Keyboard-Handler für Entf-Taste
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Ignoriere Tasteneingaben wenn ein Input-Element fokussiert ist
    const activeElement = document.activeElement;
    if (activeElement && (
      activeElement.tagName === 'INPUT' ||
      activeElement.tagName === 'TEXTAREA' ||
      activeElement.tagName === 'SELECT' ||
      (activeElement as HTMLElement).isContentEditable
    )) {
      return;
    }

    // Entf-Taste (Delete) zum Löschen
    if (event.key === 'Delete') {
      if (selectedComponentId) {
        removeComponent(selectedComponentId);
        setSelectedComponent(null);
      } else if (selectedWireId) {
        removeWire(selectedWireId);
        setSelectedWire(null);
      }
    }
  }, [selectedComponentId, selectedWireId, removeComponent, removeWire, setSelectedComponent, setSelectedWire]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="h-screen flex flex-col bg-gray-100">
        {/* Header */}
        <Header />

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Verteiler-Canvas */}
          <VerteilerCanvas />

          {/* Sidebar */}
          <Sidebar />
        </div>
      </div>
    </DndProvider>
  );
}

export default App;
