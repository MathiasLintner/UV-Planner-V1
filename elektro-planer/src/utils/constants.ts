// ==========================================
// GEMEINSAME LAYOUT-KONSTANTEN
// ==========================================

// Teilungseinheiten-Breite (1 TE = 18mm)
export const TE_WIDTH = 18;

// Komponenten-Höhe
export const COMPONENT_HEIGHT = 90;

// Drahtbereiche (verdoppelt für mehr Platz zwischen Hutschienen)
export const WIRE_AREA_TOP = 120; // Platz für Drähte oberhalb der Komponenten (verdoppelt)
export const WIRE_AREA_BOTTOM = 100; // Platz für Drähte unterhalb der Komponenten (verdoppelt)

// Label-Bereich Höhe (Schiene X + TE-Anzeige) - jetzt links neben der Schiene, nicht mehr oben
export const LABEL_HEIGHT = 0; // Label ist jetzt seitlich, nimmt keine vertikale Höhe

// Gesamthöhe einer Hutschiene inkl. aller Bereiche
export const RAIL_TOTAL_HEIGHT = WIRE_AREA_TOP + COMPONENT_HEIGHT + WIRE_AREA_BOTTOM;

// Raster-Konfiguration für Drahtführung
export const WIRE_LANES = 20; // Anzahl Drahtbahnen ober- und unterhalb (feineres Raster)
export const WIRE_LANE_SPACING = 3; // Abstand zwischen Drahtbahnen in px

// Horizontaler Rasterabstand für feine Drahtpositionierung
export const WIRE_GRID_X = 3;

// Terminal-Größe
export const TERMINAL_SIZE = 10;

// Horizontaler Rand links und rechts der Hutschiene für symmetrische Verdrahtung
export const HUTSCHIENE_HORIZONTAL_MARGIN = 120; // Platz links und rechts der Hutschiene
