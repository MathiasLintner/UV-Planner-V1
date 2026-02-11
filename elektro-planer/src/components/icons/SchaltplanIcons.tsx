import React from 'react';
import type { ElektroComponent, Phase } from '../../types';
import { PHASE_COLORS } from '../../types';

interface IconProps {
  width: number;
  height: number;
  polzahl?: number;
  phase?: Phase;
}

// ==========================================
// LS-SCHALTER (Leitungsschutzschalter)
// ==========================================
export const LSSchalterIcon: React.FC<IconProps> = ({ width, height, polzahl = 1 }) => {
  const iconMap: Record<number, string> = {
    1: '/Leitungsschutzschalter 1 polig.png',
    2: '/Leitungsschutzschalter 2 polig.png',
    3: '/Leitungsschutzschalter 3 polig.png',
    4: '/Leitungsschutzschalter 4 polig.png',
  };

  const iconPath = iconMap[polzahl] || iconMap[1];

  return (
    <img
      src={iconPath}
      alt={`Leitungsschutzschalter ${polzahl}-polig`}
      style={{ width: `${width}px`, height: `${height}px`, objectFit: 'contain' }}
    />
  );
};

// ==========================================
// FI-SCHALTER (Fehlerstrom-Schutzschalter)
// ==========================================
export const FISchalterIcon: React.FC<IconProps> = ({ width, height, polzahl = 4 }) => {
  const iconMap: Record<number, string> = {
    2: '/RCD 2 Polig.png',
    4: '/RCD 4 polig.png',
  };

  const iconPath = iconMap[polzahl] || iconMap[4];

  return (
    <img
      src={iconPath}
      alt={`FI-Schalter ${polzahl}-polig`}
      style={{ width: `${width}px`, height: `${height}px`, objectFit: 'contain' }}
    />
  );
};

// ==========================================
// FI/LS-KOMBINATION
// ==========================================
export const FILSKombiIcon: React.FC<IconProps> = ({ width, height, polzahl = 2 }) => {
  const poleWidth = width / polzahl;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* Summenstromwandler */}
      <ellipse cx={width / 2} cy={height * 0.35} rx={width * 0.3} ry={height * 0.1} fill="none" stroke="#333" strokeWidth={1} />

      {Array.from({ length: polzahl }).map((_, i) => {
        const x = i * poleWidth + poleWidth / 2;
        return (
          <g key={i}>
            {/* Eingang */}
            <line x1={x} y1={0} x2={x} y2={height * 0.2} stroke="#333" strokeWidth={2} />
            {/* Schaltkontakt FI */}
            <line x1={x} y1={height * 0.2} x2={x + 2} y2={height * 0.35} stroke="#333" strokeWidth={1.5} />
            {/* Durch Wandler */}
            <line x1={x} y1={height * 0.35} x2={x} y2={height * 0.5} stroke="#333" strokeWidth={2} />
            {/* Schaltkontakt LS */}
            <line x1={x} y1={height * 0.5} x2={x + 3} y2={height * 0.65} stroke="#333" strokeWidth={1.5} />
            {/* Thermisches Element */}
            <rect x={x - 2} y={height * 0.65} width={4} height={height * 0.1} fill="none" stroke="#333" strokeWidth={1} />
            {/* Magnetisches Element */}
            <path d={`M ${x - 3} ${height * 0.78} A 3 3 0 0 1 ${x + 3} ${height * 0.78}`} fill="none" stroke="#333" strokeWidth={1} />
            {/* Ausgang */}
            <line x1={x} y1={height * 0.82} x2={x} y2={height} stroke="#333" strokeWidth={2} />
          </g>
        );
      })}
    </svg>
  );
};

// ==========================================
// NH-SICHERUNG
// ==========================================
export const NHSicherungIcon: React.FC<IconProps> = ({ width, height }) => {
  return (
    <img
      src="/3 fach NH Sicherung.png"
      alt="NH-Sicherung 3-fach"
      style={{ width: `${width}px`, height: `${height}px`, objectFit: 'contain' }}
    />
  );
};

// ==========================================
// SCHRAUB-SICHERUNG (Diazed/Neozed)
// ==========================================
export const SchraubSicherungIcon: React.FC<IconProps> = ({ width, height }) => {
  return (
    <img
      src="/Schmelzsicherung 1fach.png"
      alt="Schraub-Sicherung 1-fach"
      style={{ width: `${width}px`, height: `${height}px`, objectFit: 'contain' }}
    />
  );
};

// ==========================================
// NEOZED-SICHERUNG (1-polig oder 3-polig)
// ==========================================
export const NeozedSicherungIcon: React.FC<IconProps> = ({ width, height, polzahl = 1 }) => {
  const iconMap: Record<number, string> = {
    1: '/Schmelzsicherung 1fach.png',
    3: '/Schmelzsicherung 3 Fach.png',
  };

  const iconPath = iconMap[polzahl] || iconMap[1];

  return (
    <img
      src={iconPath}
      alt={`Neozed-Sicherung ${polzahl}-fach`}
      style={{ width: `${width}px`, height: `${height}px`, objectFit: 'contain' }}
    />
  );
};

// ==========================================
// SAMMELSCHIENE
// ==========================================
export const SammelSchieneIcon: React.FC<IconProps & { phase: Phase }> = ({ width, height, phase }) => {
  const color = PHASE_COLORS[phase];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* Schiene */}
      <rect x={2} y={height * 0.4} width={width - 4} height={height * 0.2} fill={color} stroke="#333" strokeWidth={1} />
      {/* Anschlusspunkte oben */}
      {Array.from({ length: Math.floor(width / 15) }).map((_, i) => (
        <g key={`top-${i}`}>
          <line x1={10 + i * 15} y1={0} x2={10 + i * 15} y2={height * 0.4} stroke={color} strokeWidth={2} />
          <circle cx={10 + i * 15} cy={height * 0.1} r={3} fill={color} stroke="#333" strokeWidth={1} />
        </g>
      ))}
      {/* Anschlusspunkte unten */}
      {Array.from({ length: Math.floor(width / 15) }).map((_, i) => (
        <g key={`bottom-${i}`}>
          <line x1={10 + i * 15} y1={height * 0.6} x2={10 + i * 15} y2={height} stroke={color} strokeWidth={2} />
          <circle cx={10 + i * 15} cy={height * 0.9} r={3} fill={color} stroke="#333" strokeWidth={1} />
        </g>
      ))}
    </svg>
  );
};

// ==========================================
// ZÄHLER
// ==========================================
export const ZaehlerIcon: React.FC<IconProps & { phasen: 1 | 3 }> = ({ width, height, phasen }) => {
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* Zählergehäuse */}
      <rect x={4} y={height * 0.1} width={width - 8} height={height * 0.8} fill="#f8f8f8" stroke="#333" strokeWidth={1.5} rx={2} />
      {/* Display */}
      <rect x={8} y={height * 0.2} width={width - 16} height={height * 0.25} fill="#c8e6c9" stroke="#333" strokeWidth={1} />
      <text x={width / 2} y={height * 0.38} textAnchor="middle" fontSize={8} fill="#333">kWh</text>
      {/* Anschlüsse oben */}
      {Array.from({ length: phasen === 3 ? 4 : 2 }).map((_, i) => {
        const x = width * (0.2 + i * 0.2);
        return <line key={`in-${i}`} x1={x} y1={0} x2={x} y2={height * 0.1} stroke="#333" strokeWidth={2} />;
      })}
      {/* Anschlüsse unten */}
      {Array.from({ length: phasen === 3 ? 4 : 2 }).map((_, i) => {
        const x = width * (0.2 + i * 0.2);
        return <line key={`out-${i}`} x1={x} y1={height * 0.9} x2={x} y2={height} stroke="#333" strokeWidth={2} />;
      })}
    </svg>
  );
};

// ==========================================
// SCHÜTZ
// ==========================================
export const SchuetzIcon: React.FC<IconProps> = ({ width, height, polzahl = 3 }) => {
  const poleWidth = width / (polzahl + 1); // +1 für Spule

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* Hauptkontakte */}
      {Array.from({ length: polzahl }).map((_, i) => {
        const x = i * poleWidth + poleWidth / 2;
        return (
          <g key={i}>
            <line x1={x} y1={0} x2={x} y2={height * 0.35} stroke="#333" strokeWidth={2} />
            <line x1={x} y1={height * 0.35} x2={x + 4} y2={height * 0.55} stroke="#333" strokeWidth={2} />
            <circle cx={x} cy={height * 0.35} r={2} fill="#333" />
            <circle cx={x} cy={height * 0.6} r={2} fill="#333" />
            <line x1={x} y1={height * 0.6} x2={x} y2={height} stroke="#333" strokeWidth={2} />
          </g>
        );
      })}
      {/* Spule */}
      <g>
        <rect x={width - poleWidth} y={height * 0.3} width={poleWidth * 0.6} height={height * 0.4} fill="none" stroke="#333" strokeWidth={1.5} />
        <line x1={width - poleWidth * 0.7} y1={height * 0.3} x2={width - poleWidth * 0.7} y2={0} stroke="#333" strokeWidth={1.5} />
        <line x1={width - poleWidth * 0.7} y1={height * 0.7} x2={width - poleWidth * 0.7} y2={height} stroke="#333" strokeWidth={1.5} />
      </g>
    </svg>
  );
};

// ==========================================
// KLEMME / REIHENKLEMME
// ==========================================
export const KlemmeIcon: React.FC<IconProps & { phase: Phase }> = ({ width, height, phase }) => {
  const color = PHASE_COLORS[phase];
  const cx = width / 2;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* Eingang oben */}
      <line x1={cx} y1={0} x2={cx} y2={height * 0.25} stroke={color} strokeWidth={2} />
      <circle cx={cx} cy={height * 0.15} r={3} fill={color} stroke="#333" strokeWidth={1} />
      {/* Klemmkörper */}
      <rect x={cx - 5} y={height * 0.25} width={10} height={height * 0.5} fill="#f5f5f5" stroke="#333" strokeWidth={1.5} />
      {/* Verbindung innen */}
      <line x1={cx} y1={height * 0.35} x2={cx} y2={height * 0.65} stroke={color} strokeWidth={2} />
      {/* Ausgang unten */}
      <line x1={cx} y1={height * 0.75} x2={cx} y2={height} stroke={color} strokeWidth={2} />
      <circle cx={cx} cy={height * 0.85} r={3} fill={color} stroke="#333" strokeWidth={1} />
    </svg>
  );
};

// ==========================================
// VERSORGUNGSANSCHLUSSKLEMME
// ==========================================
export const VersorgungsklemmeIcon: React.FC<IconProps> = ({ width, height }) => {
  const phases: Phase[] = ['L1', 'L2', 'L3', 'N', 'PE'];
  const poleWidth = width / 5;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* Netz-Symbol oben */}
      <rect x={2} y={2} width={width - 4} height={height * 0.25} fill="#ffe4b5" stroke="#333" strokeWidth={1.5} rx={2} />
      <text x={width / 2} y={height * 0.18} textAnchor="middle" fontSize={8} fill="#333" fontWeight="bold">NETZ</text>

      {/* 5 Ausgänge unten (L1, L2, L3, N, PE) */}
      {phases.map((phase, i) => {
        const x = i * poleWidth + poleWidth / 2;
        const color = PHASE_COLORS[phase];
        return (
          <g key={phase}>
            <line x1={x} y1={height * 0.3} x2={x} y2={height * 0.5} stroke="#333" strokeWidth={1.5} />
            <rect x={x - 4} y={height * 0.5} width={8} height={height * 0.25} fill="#f5f5f5" stroke="#333" strokeWidth={1} />
            <line x1={x} y1={height * 0.75} x2={x} y2={height} stroke={color} strokeWidth={2} />
            <circle cx={x} cy={height * 0.9} r={3} fill={color} stroke="#333" strokeWidth={1} />
          </g>
        );
      })}
    </svg>
  );
};

// ==========================================
// ABGANGSKLEMME (3-polig oder 5-polig)
// ==========================================
export const AbgangsklemmeIcon: React.FC<IconProps> = ({ width, height, polzahl = 3 }) => {
  const phases: Phase[] = polzahl === 3 ? ['L1', 'N', 'PE'] : ['L1', 'L2', 'L3', 'N', 'PE'];
  const poleWidth = width / polzahl;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* Klemmenblock */}
      <rect x={2} y={height * 0.3} width={width - 4} height={height * 0.4} fill="#e8e8e8" stroke="#333" strokeWidth={1.5} rx={1} />

      {phases.map((phase, i) => {
        const x = i * poleWidth + poleWidth / 2;
        const color = PHASE_COLORS[phase];
        return (
          <g key={phase}>
            {/* Eingang oben */}
            <line x1={x} y1={0} x2={x} y2={height * 0.3} stroke={color} strokeWidth={2} />
            <circle cx={x} cy={height * 0.15} r={2} fill={color} stroke="#333" strokeWidth={1} />
            {/* Klemmverbindung */}
            <line x1={x} y1={height * 0.35} x2={x} y2={height * 0.65} stroke={color} strokeWidth={2} />
            <circle cx={x} cy={height * 0.5} r={2.5} fill={color} stroke="#333" strokeWidth={1} />
            {/* Ausgang unten */}
            <line x1={x} y1={height * 0.7} x2={x} y2={height} stroke={color} strokeWidth={2} />
            <circle cx={x} cy={height * 0.85} r={2} fill={color} stroke="#333" strokeWidth={1} />
          </g>
        );
      })}
    </svg>
  );
};

// ==========================================
// ÜBERSPANNUNGSSCHUTZ (SPD)
// ==========================================
export const UeberspannungsschutzIcon: React.FC<IconProps & { systemTyp: 'AC' | 'DC', polzahl: 2 | 3 }> = ({ width, height, systemTyp, polzahl }) => {
  const poleWidth = width / polzahl;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* SPD-Gehäuse */}
      <rect x={2} y={height * 0.2} width={width - 4} height={height * 0.6} fill="#ffebcd" stroke="#333" strokeWidth={1.5} rx={2} />

      {/* SPD-Text */}
      <text x={width / 2} y={height * 0.55} textAnchor="middle" fontSize={7} fill="#333" fontWeight="bold">SPD</text>

      {Array.from({ length: polzahl }).map((_, i) => {
        const x = i * poleWidth + poleWidth / 2;
        return (
          <g key={i}>
            {/* Eingang oben */}
            <line x1={x} y1={0} x2={x} y2={height * 0.2} stroke="#333" strokeWidth={2} />

            {/* Varistor-Symbol (parallele Rechtecke mit Pfeil) */}
            <rect x={x - 3} y={height * 0.3} width={6} height={height * 0.1} fill="none" stroke="#333" strokeWidth={1} />

            {/* Pfeil durch Varistor (für spannungsabhängigen Widerstand) */}
            <line x1={x - 4} y1={height * 0.25} x2={x + 4} y2={height * 0.45} stroke="#333" strokeWidth={1.5} />
            <polygon points={`${x + 3},${height * 0.43} ${x + 4},${height * 0.45} ${x + 2.5},${height * 0.45}`} fill="#333" />

            {/* Funkenstrecke (zwei Elektroden) */}
            <circle cx={x - 2} cy={height * 0.6} r={2} fill="none" stroke="#333" strokeWidth={1} />
            <circle cx={x + 2} cy={height * 0.6} r={2} fill="none" stroke="#333" strokeWidth={1} />

            {/* Blitz-Symbol (Überspannung) */}
            <path d={`M ${x - 1} ${height * 0.55} L ${x + 1} ${height * 0.6} L ${x} ${height * 0.6} L ${x + 1} ${height * 0.65}`}
                  fill="#ff6b6b" stroke="none" />

            {/* Ausgang unten */}
            <line x1={x} y1={height * 0.8} x2={x} y2={height} stroke="#333" strokeWidth={2} />
          </g>
        );
      })}

      {/* System-Typ Label */}
      <text x={width / 2} y={height * 0.15} textAnchor="middle" fontSize={6} fill="#666">{systemTyp}</text>
    </svg>
  );
};

// ==========================================
// ICON SELECTOR
// ==========================================
export const getComponentIcon = (component: ElektroComponent, width: number, height: number): React.ReactNode => {
  switch (component.type) {
    case 'ls-schalter':
      return <LSSchalterIcon width={width} height={height} polzahl={component.polzahl} />;
    case 'fi-schalter':
      return <FISchalterIcon width={width} height={height} polzahl={component.polzahl} />;
    case 'fi-ls-kombi':
      return <FILSKombiIcon width={width} height={height} polzahl={component.polzahl} />;
    case 'nh-sicherung':
      return <NHSicherungIcon width={width} height={height} />;
    case 'schraub-sicherung':
      return <SchraubSicherungIcon width={width} height={height} />;
    case 'neozed-sicherung':
      return <NeozedSicherungIcon width={width} height={height} polzahl={component.polzahl} />;
    case 'sammelschiene':
      return <SammelSchieneIcon width={width} height={height} phase={component.phase} />;
    case 'zaehler':
      return <ZaehlerIcon width={width} height={height} phasen={component.phasen} />;
    case 'schuetz':
      return <SchuetzIcon width={width} height={height} polzahl={component.polzahl} />;
    case 'klemme':
      return <KlemmeIcon width={width} height={height} phase={component.phase} />;
    case 'versorgungsklemme':
      return <VersorgungsklemmeIcon width={width} height={height} />;
    case 'abgangsklemme':
      return <AbgangsklemmeIcon width={width} height={height} polzahl={component.polzahl} />;
    case 'ueberspannungsschutz':
      return <UeberspannungsschutzIcon width={width} height={height} systemTyp={component.systemTyp} polzahl={component.polzahl} />;
    default:
      return null;
  }
};
