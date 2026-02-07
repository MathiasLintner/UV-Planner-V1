import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import type { Verteiler, ElektroComponent } from '../types';

// ==========================================
// PDF EXPORT
// ==========================================

export async function exportToPDF(verteiler: Verteiler): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 20;

  // Header
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Elektro-Verteiler Dokumentation', pageWidth / 2, yPos, { align: 'center' });
  yPos += 15;

  // Verteiler-Info
  doc.setFontSize(14);
  doc.text(verteiler.name, pageWidth / 2, yPos, { align: 'center' });
  yPos += 10;

  if (verteiler.beschreibung) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(verteiler.beschreibung, pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;
  }

  // Technische Daten
  yPos += 5;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Technische Daten', 20, yPos);
  yPos += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const techData = [
    `Nennspannung: ${verteiler.nennspannung} V`,
    `Nennstrom: ${verteiler.nennstrom} A`,
    `Kurzschlussstrom: ${verteiler.kurzschlussStrom} kA`,
    `Anzahl Hutschienen: ${verteiler.hutschienen.length}`,
  ];
  techData.forEach((line) => {
    doc.text(line, 25, yPos);
    yPos += 6;
  });

  // Komponentenliste
  yPos += 10;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Komponentenliste', 20, yPos);
  yPos += 10;

  // Tabellen-Header
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  const headers = ['Nr.', 'Typ', 'Name', 'Position', 'Parameter'];
  const colWidths = [15, 30, 50, 25, 50];
  let xPos = 20;

  headers.forEach((header, i) => {
    doc.text(header, xPos, yPos);
    xPos += colWidths[i];
  });

  yPos += 2;
  doc.line(20, yPos, pageWidth - 20, yPos);
  yPos += 5;

  // Tabellen-Inhalt
  doc.setFont('helvetica', 'normal');
  verteiler.komponenten.forEach((comp, index) => {
    // Neue Seite wenn nötig
    if (yPos > 270) {
      doc.addPage();
      yPos = 20;
    }

    xPos = 20;
    const rowData = [
      `${index + 1}`,
      getComponentTypeName(comp.type),
      comp.name.substring(0, 25),
      `S${comp.position.rail + 1}/${comp.position.slot}`,
      getComponentParams(comp).substring(0, 30),
    ];

    rowData.forEach((cell, i) => {
      doc.text(cell, xPos, yPos);
      xPos += colWidths[i];
    });

    yPos += 6;
  });

  // Verbraucherliste
  if (verteiler.verbraucher.length > 0) {
    yPos += 10;
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Verbraucherliste', 20, yPos);
    yPos += 10;

    doc.setFontSize(9);
    const vHeaders = ['Nr.', 'Name', 'Typ', 'Leistung', 'Phase(n)', 'Zuordnung'];
    const vColWidths = [15, 40, 30, 25, 25, 35];
    xPos = 20;

    doc.setFont('helvetica', 'bold');
    vHeaders.forEach((header, i) => {
      doc.text(header, xPos, yPos);
      xPos += vColWidths[i];
    });

    yPos += 2;
    doc.line(20, yPos, pageWidth - 20, yPos);
    yPos += 5;

    doc.setFont('helvetica', 'normal');
    verteiler.verbraucher.forEach((v, index) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }

      xPos = 20;
      const zuordnung = v.zugewieseneKomponente
        ? verteiler.komponenten.find((c) => c.id === v.zugewieseneKomponente)?.name || '-'
        : 'Nicht zugewiesen';

      const rowData = [
        `${index + 1}`,
        v.name.substring(0, 20),
        v.typ,
        `${v.leistung} W`,
        v.phasen.join(', '),
        zuordnung.substring(0, 18),
      ];

      rowData.forEach((cell, i) => {
        doc.text(cell, xPos, yPos);
        xPos += vColWidths[i];
      });

      yPos += 6;
    });
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128);
    doc.text(
      `Erstellt mit Elektro-Planer | Seite ${i} von ${pageCount} | ${new Date().toLocaleDateString('de-AT')}`,
      pageWidth / 2,
      290,
      { align: 'center' }
    );
  }

  // Download
  doc.save(`${verteiler.name.replace(/\s+/g, '_')}_Dokumentation.pdf`);
}

// ==========================================
// EXCEL EXPORT
// ==========================================

export function exportToExcel(verteiler: Verteiler): void {
  const workbook = XLSX.utils.book_new();

  // Blatt 1: Übersicht
  const uebersichtData = [
    ['Elektro-Verteiler Dokumentation'],
    [],
    ['Verteiler-Name:', verteiler.name],
    ['Beschreibung:', verteiler.beschreibung || '-'],
    ['Nennspannung:', `${verteiler.nennspannung} V`],
    ['Nennstrom:', `${verteiler.nennstrom} A`],
    ['Kurzschlussstrom:', `${verteiler.kurzschlussStrom} kA`],
    ['Anzahl Hutschienen:', verteiler.hutschienen.length],
    ['Anzahl Komponenten:', verteiler.komponenten.length],
    ['Anzahl Verbraucher:', verteiler.verbraucher.length],
  ];
  const wsUebersicht = XLSX.utils.aoa_to_sheet(uebersichtData);
  XLSX.utils.book_append_sheet(workbook, wsUebersicht, 'Übersicht');

  // Blatt 2: Komponenten (nach Typ gruppiert)
  const komponentenData: any[][] = [['KOMPONENTEN - NACH TYP GRUPPIERT'], []];

  // Gruppiere Komponenten nach Typ
  const gruppiertNachTyp = verteiler.komponenten.reduce((acc, comp) => {
    const typName = getComponentTypeName(comp.type);
    if (!acc[typName]) acc[typName] = [];
    acc[typName].push(comp);
    return acc;
  }, {} as Record<string, ElektroComponent[]>);

  // Für jeden Typ eine Sektion erstellen
  let komponentenNr = 1;
  Object.entries(gruppiertNachTyp).forEach(([typName, komponenten]) => {
    // Typ-Überschrift
    komponentenData.push([`${typName.toUpperCase()} (${komponenten.length} Stück)`]);
    komponentenData.push([]);

    // Header für diese Gruppe
    komponentenData.push([
      'Nr.',
      'Name',
      'Position',
      'Breite',
      ...getDetailedParamHeaders(komponenten[0].type)
    ]);

    // Komponenten dieser Gruppe
    komponenten.forEach((comp) => {
      komponentenData.push([
        komponentenNr++,
        comp.name,
        `Schiene ${comp.position.rail + 1} / Slot ${comp.position.slot}`,
        `${comp.teilungseinheiten} TE`,
        ...getDetailedParams(comp)
      ]);
    });

    // Leerzeile nach jeder Gruppe
    komponentenData.push([]);
  });

  const wsKomponenten = XLSX.utils.aoa_to_sheet(komponentenData);

  // Spaltenbreiten setzen
  wsKomponenten['!cols'] = [
    { wch: 6 },  // Nr.
    { wch: 25 }, // Name
    { wch: 20 }, // Position
    { wch: 10 }, // Breite
    { wch: 15 }, // Parameter 1
    { wch: 15 }, // Parameter 2
    { wch: 15 }, // Parameter 3
    { wch: 15 }, // Parameter 4
  ];

  XLSX.utils.book_append_sheet(workbook, wsKomponenten, 'Komponenten');

  // Blatt 3: Verbraucher
  const verbraucherHeader = [
    'Nr.',
    'Name',
    'Typ',
    'Leistung (W)',
    'Spannung (V)',
    'Phase(n)',
    'Gleichzeitigkeitsfaktor',
    'Zugeordnete Komponente',
  ];
  const verbraucherData = verteiler.verbraucher.map((v, index) => {
    const zuordnung = v.zugewieseneKomponente
      ? verteiler.komponenten.find((c) => c.id === v.zugewieseneKomponente)?.name || '-'
      : 'Nicht zugewiesen';
    return [
      index + 1,
      v.name,
      v.typ,
      v.leistung,
      v.spannung,
      v.phasen.join(', '),
      v.gleichzeitigkeitsfaktor,
      zuordnung,
    ];
  });
  const wsVerbraucher = XLSX.utils.aoa_to_sheet([verbraucherHeader, ...verbraucherData]);
  XLSX.utils.book_append_sheet(workbook, wsVerbraucher, 'Verbraucher');

  // Blatt 4: Leistungsbilanz
  const leistungHeader = ['Phase', 'Last (W)', 'Last (kW)', 'Strom (A)'];
  const phasenLasten = calculatePhasenLasten(verteiler);
  const leistungData = Object.entries(phasenLasten).map(([phase, last]) => [
    phase,
    last,
    (last / 1000).toFixed(2),
    (last / 230).toFixed(2),
  ]);
  leistungData.push([
    'Gesamt',
    Object.values(phasenLasten).reduce((a, b) => a + b, 0),
    (Object.values(phasenLasten).reduce((a, b) => a + b, 0) / 1000).toFixed(2),
    '-',
  ]);
  const wsLeistung = XLSX.utils.aoa_to_sheet([leistungHeader, ...leistungData]);
  XLSX.utils.book_append_sheet(workbook, wsLeistung, 'Leistungsbilanz');

  // Download
  XLSX.writeFile(workbook, `${verteiler.name.replace(/\s+/g, '_')}_Export.xlsx`);
}

// ==========================================
// HILFSFUNKTIONEN
// ==========================================

function getComponentTypeName(type: ElektroComponent['type']): string {
  const names: Record<string, string> = {
    'fi-schalter': 'FI-Schalter',
    'ls-schalter': 'LS-Schalter',
    'fi-ls-kombi': 'FI/LS-Kombination',
    'nh-sicherung': 'NH-Sicherung',
    'schraub-sicherung': 'Schraub-Sicherung',
    'sammelschiene': 'Sammelschiene',
    'zaehler': 'Zähler',
    'hauptschalter': 'Hauptschalter',
    'trennschalter': 'Trennschalter',
    'schuetz': 'Schütz',
    'klemme': 'Klemme',
  };
  return names[type] || type;
}

function getComponentParams(comp: ElektroComponent): string {
  switch (comp.type) {
    case 'fi-schalter':
      return `${comp.bemessungsStrom}A, ${comp.bemessungsFehlerstrom}mA, Typ ${comp.fiTyp}`;
    case 'ls-schalter':
      return `${comp.charakteristik}${comp.bemessungsStrom}A, ${comp.kurzschlussSchaltvermoegen}kA`;
    case 'fi-ls-kombi':
      return `${comp.charakteristik}${comp.bemessungsStrom}A, ${comp.bemessungsFehlerstrom}mA`;
    case 'nh-sicherung':
      return `${comp.bemessungsStrom}A, NH${comp.groesse}, ${comp.betriebsklasse}`;
    case 'schraub-sicherung':
      return `${comp.bemessungsStrom}A, ${comp.groesse}`;
    case 'neozed-sicherung':
      return `${comp.bemessungsStrom}A, ${comp.kennlinie}, ${comp.polzahl}-polig`;
    case 'sammelschiene':
      return `${comp.phase}, ${comp.querschnitt}mm²`;
    case 'zaehler':
      return `${comp.art}, ${comp.phasen}-phasig`;
    case 'schuetz':
      return `${comp.bemessungsStrom}A, ${comp.spulenSpannung}V`;
    case 'klemme':
      return `${comp.phase}, max. ${comp.querschnitt}mm²`;
    default:
      return '-';
  }
}

function getDetailedParamHeaders(type: ElektroComponent['type']): string[] {
  switch (type) {
    case 'fi-schalter':
      return ['Bemessungsstrom', 'Fehlerstrom', 'FI-Typ', 'Verzögerung', 'Polzahl'];
    case 'ls-schalter':
      return ['Bemessungsstrom', 'Charakteristik', 'Polzahl', 'Schaltvermögen'];
    case 'fi-ls-kombi':
      return ['Bemessungsstrom', 'Fehlerstrom', 'FI-Typ', 'Verzögerung', 'Charakteristik', 'Polzahl'];
    case 'nh-sicherung':
      return ['Bemessungsstrom', 'Größe', 'Betriebsklasse'];
    case 'schraub-sicherung':
      return ['Bemessungsstrom', 'Größe'];
    case 'neozed-sicherung':
      return ['Bemessungsstrom', 'Kennlinie', 'Polzahl'];
    case 'sammelschiene':
      return ['Phase', 'Querschnitt'];
    case 'zaehler':
      return ['Art', 'Phasen'];
    case 'schuetz':
      return ['Bemessungsstrom', 'Spulenspannung', 'Polzahl'];
    case 'klemme':
      return ['Phase', 'Max. Querschnitt'];
    case 'versorgungsklemme':
      return ['Spannung', 'Kurzschlussstrom', 'Schleifenimpedanz', 'Netzsystem'];
    case 'abgangsklemme':
      return ['Polzahl', 'Max. Querschnitt', 'Anzahl Verbraucher'];
    default:
      return ['Parameter'];
  }
}

function getDetailedParams(comp: ElektroComponent): (string | number)[] {
  switch (comp.type) {
    case 'fi-schalter':
      return [
        `${comp.bemessungsStrom} A`,
        `${comp.bemessungsFehlerstrom} mA`,
        `Typ ${comp.fiTyp}`,
        comp.verzoegerung,
        `${comp.polzahl}-polig`
      ];
    case 'ls-schalter':
      return [
        `${comp.bemessungsStrom} A`,
        comp.charakteristik,
        `${comp.polzahl}-polig`,
        `${comp.kurzschlussSchaltvermoegen} kA`
      ];
    case 'fi-ls-kombi':
      return [
        `${comp.bemessungsStrom} A`,
        `${comp.bemessungsFehlerstrom} mA`,
        `Typ ${comp.fiTyp}`,
        comp.verzoegerung,
        comp.charakteristik,
        `${comp.polzahl}-polig`
      ];
    case 'nh-sicherung':
      return [
        `${comp.bemessungsStrom} A`,
        `NH${comp.groesse}`,
        comp.betriebsklasse
      ];
    case 'schraub-sicherung':
      return [
        `${comp.bemessungsStrom} A`,
        comp.groesse
      ];
    case 'neozed-sicherung':
      return [
        `${comp.bemessungsStrom} A`,
        comp.kennlinie,
        `${comp.polzahl}-polig`
      ];
    case 'sammelschiene':
      return [
        comp.phase,
        `${comp.querschnitt} mm²`
      ];
    case 'zaehler':
      return [
        comp.art,
        `${comp.phasen}-phasig`
      ];
    case 'schuetz':
      return [
        `${comp.bemessungsStrom} A`,
        `${comp.spulenSpannung} V`,
        `${comp.polzahl}-polig`
      ];
    case 'klemme':
      return [
        comp.phase,
        `${comp.querschnitt} mm²`
      ];
    case 'versorgungsklemme':
      return [
        `${comp.spannung} V`,
        `${comp.kurzschlussStrom} kA`,
        `${comp.schleifenimpedanz} Ω`,
        comp.netzsystem
      ];
    case 'abgangsklemme':
      return [
        `${comp.polzahl}-polig`,
        `${comp.querschnitt} mm²`,
        `${comp.zugewieseneVerbraucher?.length || 0} Stück`
      ];
    default:
      return ['-'];
  }
}

function calculatePhasenLasten(verteiler: Verteiler): Record<string, number> {
  const lasten: Record<string, number> = {
    L1: 0,
    L2: 0,
    L3: 0,
  };

  for (const v of verteiler.verbraucher) {
    const lastProPhase = (v.leistung * v.gleichzeitigkeitsfaktor) / v.phasen.filter((p) => p.startsWith('L')).length;
    for (const phase of v.phasen) {
      if (phase in lasten) {
        lasten[phase] += lastProPhase;
      }
    }
  }

  return lasten;
}
