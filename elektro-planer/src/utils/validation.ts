import { v4 as uuidv4 } from 'uuid';
import type {
  Verteiler,
  ElektroComponent,
  ValidationResult,
  ValidationError,
  StromkreisResult,
  Phase,
  FILSKombiParams,
  LSSchalterParams,
  FISchalterParams,
  NHSicherungParams,
  NeozedSicherungParams,
  SchraubSicherungParams,
  Wire,
} from '../types';
import {
  findAllCircuitPaths,
  findPathToVersorgung,
  findAllPathsToVersorgung,
  findSeriesComponents,
  findSeriesFIs,
  findSeriesProtection,
  findNearestFIPerPhase,
  hasConnectionToPE,
  detectKurzschluss,
  checkDrehfeldForComponent,
  analyzeSelectivity,
  getEffectivePhasen,
  type CircuitPath,
  type SelectivityViolation,
} from './circuitGraph';

// ==========================================
// ÖVE-NORMEN KONSTANTEN
// ==========================================

// Maximaler Spannungsfall gemäß ÖVE E 8101
const MAX_SPANNUNGSFALL_PROZENT = 4; // 4% für Endstromkreise

// Hilfsfunktion: Berechnet den Strom eines Verbrauchers korrekt (mit √3 für Drehstrom)
function berechneVerbraucherStrom(
  leistung: number,
  spannung: number,
  phasen: Phase[]
): number {
  const phasenAnzahl = phasen.filter(p => p !== 'N' && p !== 'PE').length;

  if (phasenAnzahl === 3 && spannung === 400) {
    // Drehstrom: P = √3 × U × I  =>  I = P / (√3 × U)
    return leistung / (Math.sqrt(3) * spannung);
  } else {
    // Ein- oder Zweiphasig: P = U × I  =>  I = P / U
    return leistung / spannung;
  }
}

// Leitungsquerschnitte und deren maximale Belastbarkeit (Cu, Verlegeart B2)
const LEITER_BELASTBARKEIT: Record<number, number> = {
  1.5: 18,
  2.5: 26,
  4: 34,
  6: 44,
  10: 61,
  16: 82,
  25: 108,
  35: 135,
  50: 168,
  70: 213,
  95: 261,
  120: 301,
};

// Spezifischer Widerstand von Kupfer in Ohm*mm²/m
const RHO_KUPFER = 0.0178;
const RHO_ALUMINIUM = 0.0286;

// Abschaltzeiten gemäß ÖVE (für TN-System)
const MAX_ABSCHALTZEIT_230V = 0.4; // Sekunden

// ==========================================
// STROMBELASTBARKEIT NACH ÖVE E 8101
// ==========================================

// Strombelastbarkeit nach ÖVE E 8101 (aus kabel_belastbarkeit.json)
// Struktur: [anzahl_belastete_adern][material][querschnitt][verlegeart]
const KABEL_BELASTBARKEIT = {
  2: { // 2 belastete Adern (1-phasig)
    kupfer: {
      1.5: { A1: 14.5, A2: 14, B1: 17.5, B2: 16.5, C: 19.5, D1: 22, D2: 22 },
      2.5: { A1: 19.5, A2: 18.5, B1: 24, B2: 23, C: 27, D1: 29, D2: 28 },
      4: { A1: 26, A2: 25, B1: 32, B2: 30, C: 36, D1: 37, D2: 38 },
      6: { A1: 34, A2: 32, B1: 41, B2: 38, C: 46, D1: 46, D2: 48 },
      10: { A1: 46, A2: 43, B1: 57, B2: 52, C: 63, D1: 60, D2: 64 },
      16: { A1: 61, A2: 57, B1: 76, B2: 69, C: 85, D1: 78, D2: 83 },
      25: { A1: 80, A2: 75, B1: 101, B2: 90, C: 112, D1: 99, D2: 110 },
      35: { A1: 99, A2: 92, B1: 125, B2: 111, C: 138, D1: 119, D2: 132 },
      50: { A1: 119, A2: 110, B1: 151, B2: 133, C: 168, D1: 140, D2: 156 },
      70: { A1: 151, A2: 139, B1: 192, B2: 168, C: 213, D1: 173, D2: 192 },
      95: { A1: 182, A2: 167, B1: 232, B2: 201, C: 258, D1: 204, D2: 230 },
      120: { A1: 210, A2: 192, B1: 269, B2: 232, C: 299, D1: 231, D2: 261 },
      150: { A1: 240, A2: 219, B1: 309, B2: 258, C: 344, D1: 261, D2: 293 },
      185: { A1: 273, A2: 248, B1: 341, B2: 294, C: 392, D1: 292, D2: 331 },
      240: { A1: 321, A2: 291, B1: 400, B2: 344, C: 461, D1: 336, D2: 382 },
      300: { A1: 367, A2: 334, B1: 458, B2: 394, C: 530, D1: 379, D2: 427 },
    },
    aluminium: {
      2.5: { A1: 15, A2: 14.5, B1: 18.5, B2: 17.5, C: 21, D1: 22 },
      4: { A1: 20, A2: 19.5, B1: 25, B2: 24, C: 28, D1: 29 },
      6: { A1: 26, A2: 25, B1: 32, B2: 30, C: 36, D1: 36 },
      10: { A1: 36, A2: 33, B1: 44, B2: 41, C: 49, D1: 47 },
      16: { A1: 48, A2: 44, B1: 60, B2: 54, C: 66, D1: 61, D2: 63 },
      25: { A1: 63, A2: 58, B1: 79, B2: 71, C: 83, D1: 77, D2: 82 },
      35: { A1: 77, A2: 71, B1: 97, B2: 86, C: 103, D1: 93, D2: 98 },
      50: { A1: 93, A2: 86, B1: 118, B2: 104, C: 125, D1: 109, D2: 117 },
      70: { A1: 118, A2: 108, B1: 150, B2: 131, C: 160, D1: 135, D2: 145 },
      95: { A1: 142, A2: 130, B1: 181, B2: 157, C: 195, D1: 159, D2: 173 },
      120: { A1: 164, A2: 150, B1: 210, B2: 181, C: 226, D1: 180, D2: 200 },
      150: { A1: 189, A2: 172, B1: 234, B2: 201, C: 261, D1: 204, D2: 224 },
      185: { A1: 215, A2: 195, B1: 266, B2: 230, C: 298, D1: 228, D2: 255 },
      240: { A1: 252, A2: 229, B1: 312, B2: 269, C: 352, D1: 262, D2: 298 },
      300: { A1: 289, A2: 263, B1: 358, B2: 308, C: 406, D1: 296, D2: 338 },
    },
  },
  3: { // 3 belastete Adern (3-phasig)
    kupfer: {
      1.5: { A1: 13.5, A2: 13, B1: 15.5, B2: 15, C: 17.5, D1: 18, D2: 19 },
      2.5: { A1: 18, A2: 17.5, B1: 21, B2: 20, C: 24, D1: 24, D2: 24 },
      4: { A1: 24, A2: 23, B1: 28, B2: 27, C: 32, D1: 30, D2: 33 },
      6: { A1: 31, A2: 29, B1: 36, B2: 34, C: 41, D1: 38, D2: 41 },
      10: { A1: 42, A2: 39, B1: 50, B2: 46, C: 57, D1: 50, D2: 54 },
      16: { A1: 56, A2: 52, B1: 68, B2: 62, C: 76, D1: 64, D2: 70 },
      25: { A1: 73, A2: 68, B1: 89, B2: 80, C: 96, D1: 82, D2: 92 },
      35: { A1: 89, A2: 83, B1: 110, B2: 99, C: 119, D1: 98, D2: 110 },
      50: { A1: 108, A2: 99, B1: 134, B2: 118, C: 144, D1: 116, D2: 130 },
      70: { A1: 136, A2: 125, B1: 171, B2: 149, C: 184, D1: 143, D2: 162 },
      95: { A1: 164, A2: 150, B1: 207, B2: 179, C: 223, D1: 169, D2: 193 },
      120: { A1: 188, A2: 172, B1: 239, B2: 206, C: 259, D1: 192, D2: 220 },
      150: { A1: 216, A2: 196, B1: 262, B2: 225, C: 299, D1: 217, D2: 246 },
      185: { A1: 245, A2: 223, B1: 296, B2: 255, C: 341, D1: 243, D2: 278 },
      240: { A1: 286, A2: 261, B1: 346, B2: 297, C: 403, D1: 280, D2: 320 },
      300: { A1: 328, A2: 298, B1: 394, B2: 339, C: 464, D1: 316, D2: 359 },
    },
    aluminium: {
      2.5: { A1: 14, A2: 13.5, B1: 16.5, B2: 15.5, C: 18.5, D1: 18.5 },
      4: { A1: 18.5, A2: 17.5, B1: 22, B2: 21, C: 25, D1: 24 },
      6: { A1: 24, A2: 23, B1: 28, B2: 27, C: 32, D1: 30 },
      10: { A1: 32, A2: 31, B1: 39, B2: 36, C: 44, D1: 39 },
      16: { A1: 43, A2: 41, B1: 53, B2: 48, C: 59, D1: 50, D2: 53 },
      25: { A1: 57, A2: 53, B1: 70, B2: 62, C: 73, D1: 64, D2: 69 },
      35: { A1: 70, A2: 65, B1: 86, B2: 77, C: 90, D1: 77, D2: 83 },
      50: { A1: 84, A2: 78, B1: 104, B2: 92, C: 110, D1: 91, D2: 99 },
      70: { A1: 107, A2: 98, B1: 133, B2: 116, C: 140, D1: 112, D2: 122 },
      95: { A1: 129, A2: 118, B1: 161, B2: 139, C: 170, D1: 132, D2: 148 },
      120: { A1: 149, A2: 135, B1: 186, B2: 160, C: 197, D1: 150, D2: 169 },
      150: { A1: 170, A2: 155, B1: 204, B2: 176, C: 227, D1: 169, D2: 189 },
      185: { A1: 194, A2: 176, B1: 230, B2: 199, C: 259, D1: 190, D2: 214 },
      240: { A1: 227, A2: 207, B1: 269, B2: 232, C: 305, D1: 218, D2: 250 },
      300: { A1: 261, A2: 237, B1: 306, B2: 265, C: 351, D1: 247, D2: 282 },
    },
  },
};

// Funktion zum Abrufen der Strombelastbarkeit
function getStrombelastbarkeit(
  querschnitt: number,
  material: 'kupfer' | 'aluminium',
  verlegeart: string,
  anzahlAdern: 2 | 3
): number | null {
  const aderData = KABEL_BELASTBARKEIT[anzahlAdern]?.[material];

  if (!aderData) return null;

  const querschnittData = (aderData as any)[String(querschnitt)];
  if (!querschnittData) return null;

  const belastbarkeit = querschnittData[verlegeart];
  return typeof belastbarkeit === 'number' ? belastbarkeit : null;
}

// ==========================================
// HAUPT-VALIDIERUNGSFUNKTION
// ==========================================

export function validateVerteiler(verteiler: Verteiler): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // 1. Prüfe Doppelbelegungen auf Hutschienen
  const doppelbelegungsFehler = checkDoppelbelegung(verteiler);
  errors.push(...doppelbelegungsFehler);

  // 2. Prüfe Überlast für jede Schutzeinrichtung
  const ueberlastFehler = checkUeberlast(verteiler);
  errors.push(...ueberlastFehler);

  // 3. Prüfe Selektivität
  const selektivitaetsFehler = checkSelektivitaet(verteiler);
  warnings.push(...selektivitaetsFehler);

  // 4. Prüfe Spannungsfall
  const spannungsfallFehler = checkSpannungsfall(verteiler);
  errors.push(...spannungsfallFehler.errors);
  warnings.push(...spannungsfallFehler.warnings);

  // 5. Prüfe Schleifenimpedanz
  const schleifenimpedanzFehler = checkSchleifenimpedanz(verteiler);
  errors.push(...schleifenimpedanzFehler);

  // 6. Prüfe fehlende Verbindungen
  const verbindungsFehler = checkVerbindungen(verteiler);
  warnings.push(...verbindungsFehler);

  // 8. Prüfe Neutralleiterverteiler auf mehrfache FI-Speisung
  const neutralleiterFehler = checkNeutralleiterMehrfachspeisung(verteiler);
  errors.push(...neutralleiterFehler);

  // 9. Prüfe Verbraucher auf mehrfache FI-Speisung (unterschiedliche FIs für verschiedene Phasen)
  const verbraucherMehrfachFIFehler = checkVerbraucherMehrfachFISpeisung(verteiler);
  errors.push(...verbraucherMehrfachFIFehler);

  // 10. Prüfe Schmelzsicherungen (Betriebstrom < Nennstrom < zul. Leitungsstrom)
  const schmelzsicherungsFehler = checkSchmelzsicherungen(verteiler);
  errors.push(...schmelzsicherungsFehler.errors);
  warnings.push(...schmelzsicherungsFehler.warnings);

  // 11. Prüfe Schleifenimpedanz für Verbraucher
  const verbraucherSchleifenimpedanzFehler = checkVerbraucherSchleifenimpedanz(verteiler);
  errors.push(...verbraucherSchleifenimpedanzFehler.errors);
  warnings.push(...verbraucherSchleifenimpedanzFehler.warnings);

  // 12. Prüfe Steckdosen auf FI-Schutz (30mA)
  const steckdosenFIFehler = checkSteckdosenFISchutz(verteiler);
  errors.push(...steckdosenFIFehler);

  // 13. Prüfe FI-Selektivität bei Reihenschaltung
  const fiSelektivitaetFehler = checkFISelektivitaet(verteiler);
  errors.push(...fiSelektivitaetFehler.errors);
  warnings.push(...fiSelektivitaetFehler.warnings);

  // 14. Prüfe ob erste Sicherung nach Versorgungsklemme größer als Versorgungsnennstrom
  const ersteSicherungInfo = checkErsteSicherungGroesserVersorgung(verteiler);
  warnings.push(...ersteSicherungInfo);

  // 15. Prüfe Erdungsverbindung (PE) für jeden Verbraucher
  const erdungsFehler = checkVerbraucherErdung(verteiler);
  errors.push(...erdungsFehler);

  // 16. Prüfe Kurzschluss (verschiedene Phasen verbunden)
  const kurzschlussFehler = checkKurzschlussVerbindungen(verteiler);
  errors.push(...kurzschlussFehler);

  // 17. Prüfe Drehfeld (Phasenzuordnung L1→L1, L2→L2, L3→L3)
  const drehfeldFehler = checkVerbraucherDrehfeld(verteiler);
  errors.push(...drehfeldFehler);

  // 18. Prüfe ob einzelne Verbraucher höheren Strom als vorgelagerte Sicherung haben
  const verbraucherUeberstromFehler = checkVerbraucherUeberstrom(verteiler);
  errors.push(...verbraucherUeberstromFehler);

  // 19. Prüfe Kabelbelastbarkeit (Strombelastbarkeit des Leiters vs. Nennstrom der Schutzeinrichtung)
  const kabelbelastbarkeitFehler = checkKabelbelastbarkeit(verteiler);
  errors.push(...kabelbelastbarkeitFehler.errors);
  warnings.push(...kabelbelastbarkeitFehler.warnings);

  // Berechne Gesamtwerte
  const berechnungen = berechneGesamtwerte(verteiler);

  // Erstelle Stromkreis-Ergebnisse
  const stromkreise = erstelleStromkreisErgebnisse(verteiler, errors, warnings);

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    stromkreise,
    berechnungen,
  };
}

// ==========================================
// EINZELPRÜFUNGEN
// ==========================================

/**
 * Prüft auf Doppelbelegungen auf den Hutschienen
 */
function checkDoppelbelegung(verteiler: Verteiler): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const schiene of verteiler.hutschienen) {
    const komponenten = verteiler.komponenten.filter(
      (k) => k.position.rail === schiene.index
    );

    // Erstelle Belegungsarray
    const belegung: (string | null)[] = new Array(schiene.slots).fill(null);

    for (const komp of komponenten) {
      const startSlot = komp.position.slot;
      const endSlot = startSlot + komp.teilungseinheiten;

      for (let slot = startSlot; slot < endSlot; slot++) {
        if (slot >= schiene.slots) {
          errors.push({
            id: uuidv4(),
            typ: 'doppelbelegung',
            komponenteId: komp.id,
            komponenteName: komp.name,
            beschreibung: `Komponente "${komp.name}" ragt über Hutschiene hinaus`,
            hinweis: 'Verschieben Sie die Komponente oder vergrößern Sie die Hutschiene',
            schweregrad: 'fehler',
          });
          break;
        }

        if (belegung[slot] !== null) {
          const andereKomp = verteiler.komponenten.find((k) => k.id === belegung[slot]);
          errors.push({
            id: uuidv4(),
            typ: 'doppelbelegung',
            komponenteId: komp.id,
            komponenteName: komp.name,
            beschreibung: `Komponente "${komp.name}" überlappt mit "${andereKomp?.name}"`,
            hinweis: 'Verschieben Sie eine der Komponenten',
            schweregrad: 'fehler',
          });
          break;
        }

        belegung[slot] = komp.id;
      }
    }
  }

  return errors;
}

/**
 * Prüft auf Überlastung der Schutzeinrichtungen
 */
function checkUeberlast(verteiler: Verteiler): ValidationError[] {
  const errors: ValidationError[] = [];

  // Prüfe für jede Schutzeinrichtung die zugewiesenen Verbraucher
  const schutzeinrichtungen = verteiler.komponenten.filter(
    (k) => k.type === 'ls-schalter' || k.type === 'fi-ls-kombi' || k.type === 'fi-schalter'
  );

  for (const schutz of schutzeinrichtungen) {
    const zugewieseneVerbraucher = verteiler.verbraucher.filter(
      (v) => v.zugewieseneKomponente === schutz.id
    );

    // Berechne Gesamtstrom
    const gesamtLeistung = zugewieseneVerbraucher.reduce((sum, v) => {
      return sum + v.leistung * v.gleichzeitigkeitsfaktor;
    }, 0);

    const gesamtStrom = gesamtLeistung / 230; // Vereinfacht für 230V

    // Hole Bemessungsstrom der Schutzeinrichtung
    let bemessungsStrom = 0;
    if (schutz.type === 'ls-schalter') {
      bemessungsStrom = (schutz as LSSchalterParams).bemessungsStrom;
    } else if (schutz.type === 'fi-ls-kombi') {
      bemessungsStrom = (schutz as FILSKombiParams).bemessungsStrom;
    } else if (schutz.type === 'fi-schalter') {
      bemessungsStrom = (schutz as FISchalterParams).bemessungsStrom;
    }

    if (bemessungsStrom > 0 && gesamtStrom > bemessungsStrom) {
      errors.push({
        id: uuidv4(),
        typ: 'ueberlast',
        komponenteId: schutz.id,
        komponenteName: schutz.name,
        beschreibung: `Überlast: ${gesamtStrom.toFixed(1)}A > ${bemessungsStrom}A (Bemessungsstrom)`,
        hinweis: `Reduzieren Sie die Last oder wählen Sie eine höhere Absicherung`,
        schweregrad: 'fehler',
      });
    }
  }

  return errors;
}

/**
 * Prüft die Selektivität zwischen Schutzeinrichtungen.
 *
 * WICHTIG: Selektivität wird nur für Komponenten geprüft, die in SERIE geschaltet sind!
 * Die Analyse basiert auf der Baumstruktur der Verdrahtung mit der Versorgungsklemme als Wurzel.
 * Parallel geschaltete Komponenten (nach einer Verzweigung) werden NICHT gegeneinander geprüft.
 */
function checkSelektivitaet(verteiler: Verteiler): ValidationError[] {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Nutze die neue Baumstruktur-Analyse für Selektivitätsprüfung
  const selectivityViolations = analyzeSelectivity(verteiler);

  // Konvertiere Violations zu ValidationErrors
  for (const violation of selectivityViolations) {
    // Nur LS-Selektivitätsverstöße hier behandeln (FI wird separat geprüft)
    if (violation.type === 'ls') {
      const error: ValidationError = {
        id: uuidv4(),
        typ: 'selektivitaet',
        komponenteId: violation.downstreamComponent.id,
        komponenteName: violation.downstreamComponent.name,
        beschreibung: violation.reason,
        hinweis: 'Vorgelagerte Schutzeinrichtung sollte mindestens das 1.6-fache des Bemessungsstroms der nachgelagerten haben.',
        schweregrad: violation.severity === 'error' ? 'fehler' : 'warnung',
      };

      if (violation.severity === 'error') {
        errors.push(error);
      } else {
        warnings.push(error);
      }
    }
  }

  // Rückgabe: Nur Warnungen für Abwärtskompatibilität
  // (Fehler werden jetzt über die neue Pfad-basierte Prüfung gehandhabt)
  return [...errors, ...warnings];
}

/**
 * Prüft den Spannungsfall über die gesamte Leitung vom Netzanschluss bis zum Verbraucher
 */
function checkSpannungsfall(verteiler: Verteiler): { errors: ValidationError[]; warnings: ValidationError[] } {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Prüfe jeden Verbraucher mit Leitungsdaten
  for (const verbraucher of verteiler.verbraucher) {
    // Nur prüfen wenn Leitungslänge und Querschnitt angegeben sind
    if (!verbraucher.leitungslaenge || !verbraucher.leitungsquerschnitt) continue;

    // Berechne Strom des Verbrauchers (mit √3 für Drehstrom)
    const spannung = verbraucher.spannung;
    const leistung = verbraucher.leistung * verbraucher.gleichzeitigkeitsfaktor;
    const effectivePhasen = getEffectivePhasen(verteiler, verbraucher);
    const strom = berechneVerbraucherStrom(leistung, spannung, effectivePhasen);

    // Leitungswiderstand berechnen (Cu-Leitung angenommen)
    const rho = RHO_KUPFER;
    const widerstand = (2 * rho * verbraucher.leitungslaenge) / verbraucher.leitungsquerschnitt;

    // Spannungsfall berechnen
    const spannungsfall = widerstand * strom;
    const spannungsfallProzent = (spannungsfall / spannung) * 100;

    // Finde Versorgungsklemme für zusätzliche Leitungswiderstände
    const versorgungsklemme = verteiler.komponenten.find(k => k.type === 'versorgungsklemme');
    let gesamtSpannungsfallProzent = spannungsfallProzent;

    // Addiere Spannungsfall der Zuleitungen (von Versorgung bis zur Schutzeinrichtung)
    if (verbraucher.zugewieseneKomponente) {
      const schutzeinrichtung = verteiler.komponenten.find(k => k.id === verbraucher.zugewieseneKomponente);

      if (schutzeinrichtung && versorgungsklemme) {
        // Finde Verbindungen zur Schutzeinrichtung
        const zuleitungen = findLeitungspfad(verteiler, versorgungsklemme.id, schutzeinrichtung.id);

        for (const wire of zuleitungen) {
          const leitungRho = wire.material === 'Cu' ? RHO_KUPFER : RHO_ALUMINIUM;
          const leitungWiderstand = (2 * leitungRho * wire.laenge) / wire.querschnitt;
          const leitungSpannungsfall = leitungWiderstand * strom;
          gesamtSpannungsfallProzent += (leitungSpannungsfall / spannung) * 100;
        }
      }
    }

    // Bewerte Spannungsfall
    if (gesamtSpannungsfallProzent > MAX_SPANNUNGSFALL_PROZENT) {
      errors.push({
        id: uuidv4(),
        typ: 'spannungsfall',
        komponenteId: verbraucher.id,
        komponenteName: verbraucher.name,
        beschreibung: `Spannungsfall zu hoch: ${gesamtSpannungsfallProzent.toFixed(2)}% > ${MAX_SPANNUNGSFALL_PROZENT}% (${spannungsfall.toFixed(2)}V bei ${verbraucher.leitungslaenge}m, ${verbraucher.leitungsquerschnitt}mm²)`,
        hinweis: `Verwenden Sie einen größeren Leitungsquerschnitt (aktuell ${verbraucher.leitungsquerschnitt}mm²) oder verkürzen Sie die Leitung (aktuell ${verbraucher.leitungslaenge}m)`,
        schweregrad: 'fehler',
      });
    } else if (gesamtSpannungsfallProzent > MAX_SPANNUNGSFALL_PROZENT * 0.8) {
      warnings.push({
        id: uuidv4(),
        typ: 'spannungsfall',
        komponenteId: verbraucher.id,
        komponenteName: verbraucher.name,
        beschreibung: `Spannungsfall grenzwertig: ${gesamtSpannungsfallProzent.toFixed(2)}% (${spannungsfall.toFixed(2)}V bei ${verbraucher.leitungslaenge}m, ${verbraucher.leitungsquerschnitt}mm²)`,
        hinweis: 'Der Spannungsfall nähert sich dem Grenzwert von 4%',
        schweregrad: 'warnung',
      });
    }
  }

  return { errors, warnings };
}

/**
 * Findet alle Leitungen im Pfad zwischen zwei Komponenten.
 *
 * WICHTIG: Arbeitet bidirektional - Komponenten können von oben oder unten angespeist werden.
 * Nutzt die neue Pfad-Suche aus circuitGraph.ts.
 */
function findLeitungspfad(verteiler: Verteiler, startId: string, endId: string): Wire[] {
  // Nutze die neue bidirektionale Pfadsuche
  const pathResult = findPathToVersorgung(verteiler, startId, endId);

  if (pathResult) {
    return pathResult.wires;
  }

  // Fallback: Versuche umgekehrte Richtung
  const reversePathResult = findPathToVersorgung(verteiler, endId, startId);

  if (reversePathResult) {
    return reversePathResult.wires.reverse();
  }

  return [];
}

/**
 * Prüft die Schleifenimpedanz für den Kurzschlussschutz
 */
function checkSchleifenimpedanz(verteiler: Verteiler): ValidationError[] {
  const errors: ValidationError[] = [];

  // Finde Versorgungsklemme für Schleifenimpedanz
  const versorgungsklemme = verteiler.komponenten.find(k => k.type === 'versorgungsklemme');

  // Für jede Schutzeinrichtung prüfen
  const schutzeinrichtungen = verteiler.komponenten.filter(
    (k) => k.type === 'ls-schalter' || k.type === 'fi-ls-kombi'
  ) as (LSSchalterParams | FILSKombiParams)[];

  for (const schutz of schutzeinrichtungen) {
    // Berechne maximale zulässige Schleifenimpedanz nach ÖVE/ÖNORM E 8001-1
    // Zs_max = (2/3) × U0 / Ia (2/3-Regel für TN-System, 0,4s Abschaltzeit)
    const charakteristik = schutz.charakteristik;
    const bemessungsStrom = schutz.bemessungsStrom;

    // Auslösestrom je nach Charakteristik (magnetisches Auslösen)
    let ausloeseFaktor = 5; // Default für B
    switch (charakteristik) {
      case 'B':
        ausloeseFaktor = 5;
        break;
      case 'C':
        ausloeseFaktor = 10;
        break;
      case 'D':
      case 'K':
        ausloeseFaktor = 20;
        break;
    }

    const ausloesestrom = bemessungsStrom * ausloeseFaktor;
    const zsMax = (2 / 3) * (230 / ausloesestrom); // 2/3-Regel

    // Schleifenimpedanz am Einspeisepunkt:
    // Schleifenimpedanz aus Versorgungsklemme verwenden
    let zsVorgelagert: number;
    if (versorgungsklemme && (versorgungsklemme as any).schleifenimpedanz > 0) {
      zsVorgelagert = (versorgungsklemme as any).schleifenimpedanz; // Direkt in Ω
    } else {
      zsVorgelagert = 0.5; // Standardwert falls keine Versorgungsklemme vorhanden
    }

    // Addiere Leitungsimpedanz (vereinfacht)
    const zugehoerigeLeitungen = verteiler.verbindungen.filter(
      (w) => w.von.componentId === schutz.id || w.nach.componentId === schutz.id
    );

    let leitungsImpedanz = 0;
    for (const wire of zugehoerigeLeitungen) {
      const rho = wire.material === 'Cu' ? RHO_KUPFER : RHO_ALUMINIUM;
      leitungsImpedanz += (2 * rho * wire.laenge) / wire.querschnitt;
    }

    const zsGesamt = zsVorgelagert + leitungsImpedanz;

    if (zsGesamt > zsMax) {
      errors.push({
        id: uuidv4(),
        typ: 'schleifenimpedanz',
        komponenteId: schutz.id,
        komponenteName: schutz.name,
        beschreibung: `Schleifenimpedanz zu hoch: ${(zsGesamt * 1000).toFixed(1)}mΩ > ${(zsMax * 1000).toFixed(1)}mΩ`,
        hinweis: 'Abschaltbedingung nicht erfüllt! Größeren Querschnitt verwenden.',
        schweregrad: 'kritisch',
      });
    }
  }

  return errors;
}

/**
 * Prüft die Phasensymmetrie (Lastverteilung)
 */
function checkPhasensymmetrie(verteiler: Verteiler): ValidationError[] {
  const warnings: ValidationError[] = [];

  // Berechne Last pro Phase (mit erkannten Phasen für 1-phasige Verbraucher)
  const phasenLasten: Record<Phase, number> = {
    L1: 0,
    L2: 0,
    L3: 0,
    N: 0,
    PE: 0,
  };

  for (const verbraucher of verteiler.verbraucher) {
    // Verwende erkannte Phasen statt manueller Zuweisung
    const effectivePhasen = getEffectivePhasen(verteiler, verbraucher);
    const lastProPhase = (verbraucher.leistung * verbraucher.gleichzeitigkeitsfaktor) / effectivePhasen.length;
    for (const phase of effectivePhasen) {
      if (phase in phasenLasten) {
        phasenLasten[phase] += lastProPhase;
      }
    }
  }

  // Prüfe Symmetrie (nur L1, L2, L3)
  const phasenWerte = [phasenLasten.L1, phasenLasten.L2, phasenLasten.L3];
  const maxLast = Math.max(...phasenWerte);
  const minLast = Math.min(...phasenWerte);
  const durchschnitt = phasenWerte.reduce((a, b) => a + b, 0) / 3;

  if (maxLast > 0 && durchschnitt > 0) {
    const asymmetrie = ((maxLast - minLast) / durchschnitt) * 100;

    if (asymmetrie > 30) {
      warnings.push({
        id: uuidv4(),
        typ: 'phasensymmetrie',
        komponenteId: 'system',
        komponenteName: 'Gesamtsystem',
        beschreibung: `Phasenasymmetrie: ${asymmetrie.toFixed(1)}% (L1: ${(phasenLasten.L1/1000).toFixed(1)}kW, L2: ${(phasenLasten.L2/1000).toFixed(1)}kW, L3: ${(phasenLasten.L3/1000).toFixed(1)}kW)`,
        hinweis: 'Verteilen Sie die Verbraucher gleichmäßiger auf die Phasen',
        schweregrad: 'warnung',
      });
    }
  }

  return warnings;
}

/**
 * Prüft auf fehlende oder unvollständige Verbindungen
 */
function checkVerbindungen(verteiler: Verteiler): ValidationError[] {
  const warnings: ValidationError[] = [];

  // Prüfe ob Verbraucher zugewiesen sind
  for (const verbraucher of verteiler.verbraucher) {
    if (!verbraucher.zugewieseneKomponente) {
      warnings.push({
        id: uuidv4(),
        typ: 'fehlende-verbindung',
        komponenteId: verbraucher.id,
        komponenteName: verbraucher.name,
        beschreibung: `Verbraucher "${verbraucher.name}" ist keiner Schutzeinrichtung zugewiesen`,
        hinweis: 'Weisen Sie den Verbraucher einer passenden Schutzeinrichtung zu',
        schweregrad: 'warnung',
      });
    }
  }

  return warnings;
}

/**
 * Prüft ob Neutralleiterverteiler von mehreren FI-Schaltern gespeist werden
 * Dies führt zu Fehlfunktionen, da Differenzströme mehrerer FIs über denselben
 * Neutralleiter fließen können
 */
function checkNeutralleiterMehrfachspeisung(verteiler: Verteiler): ValidationError[] {
  const errors: ValidationError[] = [];

  // Finde alle Sammelschienen und Klemmen für Neutralleiter
  const neutralleiterVerteiler = verteiler.komponenten.filter(
    (k) => (k.type === 'sammelschiene' || k.type === 'klemme') && k.phase === 'N'
  );

  for (const nVerteiler of neutralleiterVerteiler) {
    // Finde alle eingehenden Verbindungen (von FIs zum Neutralleiterverteiler)
    const eingehendeVerbindungen = verteiler.verbindungen.filter(
      (w) => w.nach.componentId === nVerteiler.id && w.phase === 'N'
    );

    // Sammle alle FI-Schalter, die diesen Neutralleiterverteiler speisen
    const speisendeFIs = new Set<string>();

    for (const verbindung of eingehendeVerbindungen) {
      const quellKomponente = verteiler.komponenten.find(
        (k) => k.id === verbindung.von.componentId
      );

      if (quellKomponente) {
        // Prüfe ob die Quelle ein FI-Schalter oder FI/LS-Kombi ist
        if (quellKomponente.type === 'fi-schalter' || quellKomponente.type === 'fi-ls-kombi') {
          speisendeFIs.add(quellKomponente.id);
        }
      }
    }

    // Fehler melden, wenn mehr als ein FI diesen Neutralleiterverteiler speist
    if (speisendeFIs.size > 1) {
      const fiNamen = Array.from(speisendeFIs)
        .map(id => verteiler.komponenten.find(k => k.id === id)?.name)
        .filter(Boolean)
        .join(', ');

      errors.push({
        id: uuidv4(),
        typ: 'falsche-dimensionierung',
        komponenteId: nVerteiler.id,
        komponenteName: nVerteiler.name,
        beschreibung: `Neutralleiterverteiler wird von mehreren FI-Schaltern gespeist (${speisendeFIs.size} FIs: ${fiNamen})`,
        hinweis: 'Jeder FI-Schalter muss einen eigenen Neutralleiterverteiler haben, da sonst Fehlfunktionen auftreten können. Verwenden Sie separate Neutralleiterverteiler für jeden FI-Schutzbereich.',
        schweregrad: 'kritisch',
      });
    }
  }

  return errors;
}

/**
 * Prüft ob ein Verbraucher Leiter von verschiedenen FI-Schaltern bezieht.
 * Dies führt zu Fehlfunktionen, da nicht alle aktiven Außenleiter + N vom selben FI kommen.
 *
 * WICHTIG: Verwendet die neue Terminal-basierte Logik aus circuitGraph.ts!
 * - Findet den NÄCHSTEN FI pro Phase (nicht alle FIs auf dem Pfad)
 * - Prüft ob alle Phasen (L1, L2, L3, N) durch DENSELBEN nächsten FI gehen
 * - Funktioniert auch mit LS-Schaltern, N-Verteilern und anderen Komponenten dazwischen
 */
function checkVerbraucherMehrfachFISpeisung(verteiler: Verteiler): ValidationError[] {
  const errors: ValidationError[] = [];

  // Prüfe jeden Verbraucher
  for (const verbraucher of verteiler.verbraucher) {
    // Überspringe Verbraucher ohne Zuweisung
    if (!verbraucher.zugewieseneKomponente) continue;

    const zugewieseneKomponente = verteiler.komponenten.find(
      k => k.id === verbraucher.zugewieseneKomponente
    );

    if (!zugewieseneKomponente) continue;

    // Finde den NÄCHSTEN FI für jede Phase (Terminal-basierte Logik)
    const nearestFIs = findNearestFIPerPhase(verteiler, zugewieseneKomponente.id);

    // Sammle welche Phasen der Verbraucher braucht (immer mit N)
    const effectivePhasen = getEffectivePhasen(verteiler, verbraucher);
    const zuPruefendePhasen: Phase[] = [...effectivePhasen];
    if (!zuPruefendePhasen.includes('N')) {
      zuPruefendePhasen.push('N'); // Neutralleiter ist immer relevant
    }

    // Sammle die nächsten FIs für die relevanten Phasen
    const fiProPhase = new Map<Phase, string | undefined>();
    const alleFIs = new Set<string>();

    for (const phase of zuPruefendePhasen) {
      const fiId = nearestFIs.get(phase);
      fiProPhase.set(phase, fiId);
      if (fiId) {
        alleFIs.add(fiId);
      }
    }

    // Wenn mehr als ein FI beteiligt ist → Fehler!
    if (alleFIs.size > 1) {
      const phasenInfo: string[] = [];
      fiProPhase.forEach((fiId, phase) => {
        if (fiId) {
          const fiName = verteiler.komponenten.find(k => k.id === fiId)?.name || fiId;
          phasenInfo.push(`${phase}: ${fiName}`);
        } else {
          phasenInfo.push(`${phase}: kein FI`);
        }
      });

      errors.push({
        id: uuidv4(),
        typ: 'falsche-dimensionierung',
        komponenteId: verbraucher.id,
        komponenteName: verbraucher.name,
        beschreibung: `Verbraucher bezieht Leiter von verschiedenen FI-Schaltern`,
        hinweis: `Alle aktiven Außenleiter + N müssen vom selben FI-Schalter kommen. Aktuell: ${phasenInfo.join('; ')}. Verdrahtung korrigieren!`,
        schweregrad: 'kritisch',
      });
    }

    // Prüfe auch: Wenn manche Phasen FI haben, andere nicht
    const phasenMitFI = zuPruefendePhasen.filter(p => fiProPhase.get(p) !== undefined);
    const phasenOhneFI = zuPruefendePhasen.filter(p => fiProPhase.get(p) === undefined);

    if (phasenMitFI.length > 0 && phasenOhneFI.length > 0) {
      // Nur warnen wenn es FI-geschützte und nicht-geschützte Phasen gemischt gibt
      // Das ist auch ein Problem (aber evtl. gewollt bei bestimmten Konfigurationen)
      const mitFIInfo = phasenMitFI.map(p => {
        const fiId = fiProPhase.get(p);
        const fiName = fiId ? verteiler.komponenten.find(k => k.id === fiId)?.name || fiId : '';
        return `${p} über ${fiName}`;
      }).join(', ');

      errors.push({
        id: uuidv4(),
        typ: 'falsche-dimensionierung',
        komponenteId: verbraucher.id,
        komponenteName: verbraucher.name,
        beschreibung: `Verbraucher hat unvollständigen FI-Schutz`,
        hinweis: `Phasen ${phasenOhneFI.join(', ')} haben keinen FI-Schutz, aber ${mitFIInfo}. Alle Leiter sollten durch denselben FI gehen.`,
        schweregrad: 'kritisch',
      });
    }
  }

  return errors;
}

/**
 * Prüft ob jeder Verbraucher eine Erdungsverbindung (PE) zur Versorgungsklemme hat.
 *
 * WICHTIG: Verwendet die Terminal-basierte Pfadlogik aus circuitGraph.ts!
 * Prüft ob vom PE-Anschluss der zugewiesenen Abgangsklemme ein durchgehender
 * Pfad zum PE der Versorgungsklemme existiert.
 *
 * Die Prüfung sucht nach PE-Verbindungen über:
 * - Abgangsklemmen (haben IN_PE/OUT_PE Terminals)
 * - PE-Klemmen (type: 'klemme' mit phase: 'PE', haben TOP_0/BOT_0 Terminals)
 * - PE-Sammelschienen (type: 'sammelschiene' mit phase: 'PE', haben TOP_x/BOT_x Terminals)
 * - Zur Versorgungsklemme (hat OUT_PE Terminal)
 *
 * HINWEIS: Verbraucher können nur Abgangsklemmen zugewiesen werden.
 *
 * Gemäß ÖVE E 8101 muss jeder Verbraucher mit Schutzklasse I eine
 * durchgehende Schutzleiterverbindung haben.
 */
function checkVerbraucherErdung(verteiler: Verteiler): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const verbraucher of verteiler.verbraucher) {
    // Überspringe Verbraucher ohne Zuweisung
    if (!verbraucher.zugewieseneKomponente) continue;

    const zugewieseneKomponente = verteiler.komponenten.find(
      k => k.id === verbraucher.zugewieseneKomponente
    );

    if (!zugewieseneKomponente) continue;

    // Verbraucher sollten nur Abgangsklemmen zugewiesen sein
    // Prüfe direkt die PE-Verbindung der zugewiesenen Komponente
    const hasPE = hasConnectionToPE(verteiler, zugewieseneKomponente.id);

    if (!hasPE) {
      errors.push({
        id: uuidv4(),
        typ: 'erdung',
        komponenteId: verbraucher.id,
        komponenteName: verbraucher.name,
        beschreibung: `Verbraucher hat keine Erdungsverbindung (PE)`,
        hinweis: `Der Schutzleiter (PE) von ${zugewieseneKomponente.name} ist nicht mit der Erdung der Versorgungsklemme verbunden. Stellen Sie eine durchgehende PE-Verbindung über PE-Klemmen oder PE-Sammelschienen her.`,
        schweregrad: 'kritisch',
      });
    }
  }

  return errors;
}

/**
 * Prüft ob verschiedene Phasen (L1, L2, L3, N) irgendwo im Verteiler
 * miteinander verbunden sind - was einen Kurzschluss bedeuten würde.
 *
 * WICHTIG: Verwendet die Terminal-basierte Pfadlogik aus circuitGraph.ts!
 * Es darf nicht möglich sein, von einer Klemme einer Abgangsklemme zu einer
 * anderen Klemme derselben Abgangsklemme zu gelangen (verschiedene Phasen).
 */
function checkKurzschlussVerbindungen(verteiler: Verteiler): ValidationError[] {
  const errors: ValidationError[] = [];

  const kurzschlussResult = detectKurzschluss(verteiler);

  if (kurzschlussResult.hasKurzschluss) {
    for (const detail of kurzschlussResult.details) {
      // Spezialfall: N <-> PE ist ein Fehlerstrom, kein Kurzschluss
      const isFehlerstrom =
        (detail.phase1 === 'N' && detail.phase2 === 'PE') ||
        (detail.phase1 === 'PE' && detail.phase2 === 'N');

      if (isFehlerstrom) {
        errors.push({
          id: uuidv4(),
          typ: 'fehlerstrom',
          komponenteId: detail.componentId,
          komponenteName: detail.componentName,
          beschreibung: `Fehlerstrom zwischen ${detail.phase1} und ${detail.phase2}`,
          hinweis: `Der Neutralleiter (N) und der Schutzleiter (PE) sind über die Verdrahtung miteinander verbunden. Dies führt zu einem Fehlerstrom! Prüfen Sie die Verdrahtung und korrigieren Sie die fehlerhafte Verbindung.`,
          schweregrad: 'kritisch',
        });
      } else {
        errors.push({
          id: uuidv4(),
          typ: 'kurzschluss',
          komponenteId: detail.componentId,
          komponenteName: detail.componentName,
          beschreibung: `Kurzschluss zwischen ${detail.phase1} und ${detail.phase2}`,
          hinweis: `Die Phasen ${detail.phase1} und ${detail.phase2} sind über die Verdrahtung miteinander verbunden. Dies führt zu einem Kurzschluss! Prüfen Sie die Verdrahtung und korrigieren Sie die fehlerhafte Verbindung.`,
          schweregrad: 'kritisch',
        });
      }
    }
  }

  return errors;
}

/**
 * Prüft das Drehfeld für jeden Verbraucher.
 *
 * Stellt sicher dass die Phasen korrekt durchverbunden sind:
 * - L1 am Verbraucher muss mit L1 an der Versorgungsklemme verbunden sein
 * - L2 am Verbraucher muss mit L2 an der Versorgungsklemme verbunden sein
 * - L3 am Verbraucher muss mit L3 an der Versorgungsklemme verbunden sein
 *
 * Ein falsches Drehfeld kann bei Drehstrommotoren zu Rückwärtslauf führen!
 */
function checkVerbraucherDrehfeld(verteiler: Verteiler): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const verbraucher of verteiler.verbraucher) {
    // Überspringe Verbraucher ohne Zuweisung
    if (!verbraucher.zugewieseneKomponente) continue;

    // Prüfe nur 3-phasige Drehstromverbraucher (L1, L2, L3)
    const effectivePhasen = getEffectivePhasen(verteiler, verbraucher);
    const phasenAnzahl = effectivePhasen.filter(p => p !== 'N' && p !== 'PE').length;
    if (phasenAnzahl !== 3) continue;

    const zugewieseneKomponente = verteiler.komponenten.find(
      k => k.id === verbraucher.zugewieseneKomponente
    );

    if (!zugewieseneKomponente) continue;

    // Prüfe das Drehfeld für diese Komponente
    const drehfeldResult = checkDrehfeldForComponent(verteiler, zugewieseneKomponente.id);

    if (!drehfeldResult.isCorrect) {
      for (const detail of drehfeldResult.details) {
        errors.push({
          id: uuidv4(),
          typ: 'drehfeld',
          komponenteId: verbraucher.id,
          komponenteName: verbraucher.name,
          beschreibung: `Falsches Drehfeld: ${detail.localPhase} ist mit ${detail.connectedToPhase} verbunden`,
          hinweis: `Die Phase ${detail.localPhase} am Verbraucher ist über die Verdrahtung mit ${detail.connectedToPhase} an der Versorgung verbunden. Bei Drehstromverbrauchern kann dies zu Rückwärtslauf führen! Verdrahtung korrigieren: ${detail.localPhase} muss mit ${detail.localPhase} verbunden sein.`,
          schweregrad: 'kritisch',
        });
      }
    }
  }

  return errors;
}

/**
 * Prüft ob Steckdosen durch einen FI-Schalter mit max. 30mA geschützt sind
 */
function checkSteckdosenFISchutz(verteiler: Verteiler): ValidationError[] {
  const warnings: ValidationError[] = [];

  for (const verbraucher of verteiler.verbraucher) {
    // Prüfe nur Steckdosen
    if (verbraucher.typ !== 'steckdose') continue;

    // Überspringe Verbraucher ohne Zuweisung
    if (!verbraucher.zugewieseneKomponente) continue;

    const zugewieseneKomponente = verteiler.komponenten.find(
      k => k.id === verbraucher.zugewieseneKomponente
    );

    if (!zugewieseneKomponente) continue;

    // Finde alle FI-Schalter auf dem Pfad zur Versorgung
    const fisAufPfad = findeFIsAufPfad(verteiler, zugewieseneKomponente.id);

    // Prüfe ob ein FI mit 30mA vorhanden ist
    const hat30mAFI = fisAufPfad.some(fi => fi.bemessungsFehlerstrom <= 30);

    if (!hat30mAFI) {
      warnings.push({
        id: uuidv4(),
        typ: 'falsche-dimensionierung',
        komponenteId: verbraucher.id,
        komponenteName: verbraucher.name,
        beschreibung: `Steckdose ohne FI-Schutz mit max. 30mA`,
        hinweis: 'Steckdosen müssen gemäß ÖVE/ÖNORM durch einen FI-Schalter mit IΔn ≤ 30mA geschützt werden.',
        schweregrad: 'fehler',
      });
    }
  }

  return warnings;
}

/**
 * Prüft ob eine Komponente ein Verteiler-Typ ist (Sammelschiene, Klemme, etc.)
 * Bei diesen Komponenten verteilt sich der Strom auf mehrere Abgänge (Parallelschaltung)
 */
function isDistributionComponent(type: string): boolean {
  return ['sammelschiene', 'klemme', 'versorgungsklemme'].includes(type);
}

/**
 * Findet alle FI-Schalter auf dem DIREKTEN Strompfad von einer Komponente zur Versorgung.
 *
 * WICHTIG: Diese Funktion unterscheidet korrekt zwischen Serien- und Parallelschaltung:
 * - Komponenten können von OBEN oder UNTEN angespeist werden (bidirektional)
 * - Nur Komponenten die auf ALLEN Pfaden zur Versorgung liegen sind "vorgelagert" (Serie)
 * - Komponenten die über einen Verteiler (Sammelschiene/Klemme) erreichbar sind,
 *   aber nicht auf dem direkten Pfad liegen, sind PARALLEL
 *
 * Nutzt die neue Baumstruktur-Analyse aus circuitGraph.ts.
 */
function findeFIsAufPfad(
  verteiler: Verteiler,
  startKomponenteId: string
): (FISchalterParams | FILSKombiParams)[] {
  // Nutze die optimierte Funktion aus circuitGraph.ts
  return findSeriesFIs(verteiler, startKomponenteId);
}

/**
 * Prüft FI-Schalter in Reihenschaltung auf korrekte Selektivität
 * Gemäß ÖVE-Anforderungen:
 * 1. Reihenfolge muss von Standard → G → S sein (von Last zur Versorgung)
 * 2. Vorgelagerte Absicherung muss >= Bemessungsstrom des FI sein
 * 3. FI direkt an Versorgung: Versorgungsstrom muss >= FI-Bemessungsstrom sein
 *
 * WICHTIG: Selektivität wird nur für Komponenten geprüft, die in SERIE geschaltet sind!
 * Die Analyse nutzt die Baumstruktur der Verdrahtung aus circuitGraph.ts.
 */
function checkFISelektivitaet(verteiler: Verteiler): { errors: ValidationError[]; warnings: ValidationError[] } {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Nutze die neue Baumstruktur-Analyse für FI-Selektivität
  const selectivityViolations = analyzeSelectivity(verteiler);

  // Konvertiere FI-Violations zu ValidationErrors
  for (const violation of selectivityViolations) {
    if (violation.type === 'fi') {
      const error: ValidationError = {
        id: uuidv4(),
        typ: 'selektivitaet',
        komponenteId: violation.downstreamComponent.id,
        komponenteName: violation.downstreamComponent.name,
        beschreibung: violation.reason,
        hinweis: 'Für Selektivität muss die Reihenfolge S → G → Standard eingehalten werden (von Versorgung zur Last).',
        schweregrad: violation.severity === 'error' ? 'kritisch' : 'warnung',
      };

      if (violation.severity === 'error') {
        errors.push(error);
      } else {
        warnings.push(error);
      }
    }
  }

  // Finde alle reinen FI-Schalter (OHNE FI/LS-Kombis) für Vorsicherungs-Prüfung
  // FI/LS-Kombis haben einen integrierten LS-Schalter und brauchen keine Vorsicherung
  const alleFIs = verteiler.komponenten.filter(
    k => k.type === 'fi-schalter'
  ) as FISchalterParams[];

  // Wenn keine reinen FI-Schalter vorhanden sind, gibt es nichts weiter zu prüfen
  if (alleFIs.length === 0) {
    return { errors, warnings };
  }

  // Finde Versorgungsklemme
  const versorgung = verteiler.komponenten.find(k => k.type === 'versorgungsklemme');

  for (const fi of alleFIs) {
    // Finde vorgelagerte Schutzeinrichtungen (in Serie!)
    const alleVorsicherungenAufPfad = findeAlleVorsicherungenAufPfad(verteiler, fi.id);

    if (alleVorsicherungenAufPfad.length > 0) {
      // Prüfe ob vorgelagerte Absicherung korrekt dimensioniert ist
      // Regel: Vorsicherung sollte = FI-Bemessungsstrom sein
      for (const schutz of alleVorsicherungenAufPfad) {
        if (schutz.bemessungsStrom > fi.bemessungsStrom) {
          // Vorsicherung größer als FI-Bemessungsstrom -> Warnung
          warnings.push({
            id: uuidv4(),
            typ: 'falsche-dimensionierung',
            komponenteId: fi.id,
            komponenteName: fi.name,
            beschreibung: `Vorsicherung zu groß: ${schutz.name} (${schutz.bemessungsStrom}A) > ${fi.name} (${fi.bemessungsStrom}A)`,
            hinweis: `Die Vorsicherung (${schutz.bemessungsStrom}A) ist größer als der FI-Bemessungsstrom (${fi.bemessungsStrom}A). Bei Überlast könnte der FI beschädigt werden. Reduzieren Sie die Vorsicherung auf maximal ${fi.bemessungsStrom}A.`,
            schweregrad: 'warnung',
          });
        }
        // Bei Vorsicherung <= FI -> OK, keine Meldung
      }
    } else if (versorgung) {
      // Keine Vorsicherung vorhanden - prüfe Versorgungsstrom
      const hatVerbindungZurVersorgung = pruefeVerbindungZurVersorgung(verteiler, fi.id, versorgung.id);

      if (hatVerbindungZurVersorgung) {
        // FI hängt an der Versorgung ohne Vorsicherung
        const versorgungsstrom = verteiler.nennstrom || 0;

        if (versorgungsstrom > 0 && versorgungsstrom > fi.bemessungsStrom) {
          // Versorgungsstrom > FI-Bemessungsstrom ohne Vorsicherung → Warnung
          warnings.push({
            id: uuidv4(),
            typ: 'falsche-dimensionierung',
            komponenteId: fi.id,
            komponenteName: fi.name,
            beschreibung: `Keine Vorsicherung: Versorgungsstrom (${versorgungsstrom}A) > FI-Bemessungsstrom (${fi.bemessungsStrom}A)`,
            hinweis: `Der FI-Schalter hat keine vorgelagerte Absicherung. Bei Überlast könnte der FI beschädigt werden. Es wird empfohlen, eine Vorsicherung mit maximal ${fi.bemessungsStrom}A einzubauen.`,
            schweregrad: 'warnung',
          });
        }
      }
    }
  }

  return { errors, warnings };
}

/**
 * Findet alle Vorsicherungen auf dem DIREKTEN Strompfad von einer Komponente zur Versorgung.
 * Berücksichtigt: LS-Schalter, FI/LS-Kombis, NH-Sicherungen, Neozed-Sicherungen, Schraub-Sicherungen
 *
 * WICHTIG: Nutzt die Baumstruktur-Analyse - nur Komponenten die in SERIE geschaltet sind
 * (auf ALLEN Pfaden zur Versorgung vorkommen) werden als Vorsicherung gezählt.
 */
function findeAlleVorsicherungenAufPfad(
  verteiler: Verteiler,
  startKomponenteId: string
): { id: string; name: string; bemessungsStrom: number; type: string }[] {
  // Schutzeinrichtungs-Typen die als Vorsicherung gelten
  const schutzTypen = ['ls-schalter', 'fi-ls-kombi', 'nh-sicherung', 'neozed-sicherung', 'schraub-sicherung'];

  // Nutze die optimierte Funktion aus circuitGraph.ts
  const seriesProtection = findSeriesProtection(verteiler, startKomponenteId);

  // Konvertiere zu Ergebnis-Array und filtere auf die gewünschten Typen
  const vorsicherungen: { id: string; name: string; bemessungsStrom: number; type: string }[] = [];
  for (const komponente of seriesProtection) {
    if (schutzTypen.includes(komponente.type)) {
      const bemessungsStrom = (komponente as any).bemessungsStrom || 0;
      if (bemessungsStrom > 0) {
        vorsicherungen.push({
          id: komponente.id,
          name: komponente.name,
          bemessungsStrom,
          type: komponente.type
        });
      }
    }
  }

  return vorsicherungen;
}

/**
 * Prüft ob eine Komponente mit der Versorgung verbunden ist (direkt oder indirekt).
 *
 * WICHTIG: Arbeitet bidirektional - Komponenten können von oben oder unten angespeist werden.
 */
function pruefeVerbindungZurVersorgung(
  verteiler: Verteiler,
  komponenteId: string,
  versorgungId: string
): boolean {
  // Nutze die bidirektionale Pfadsuche
  const pathResult = findPathToVersorgung(verteiler, komponenteId, versorgungId);
  return pathResult !== null;
}

/**
 * Prüft ob die erste Sicherung nach der Versorgungsklemme größer als der Versorgungsnennstrom ist
 * Gibt eine Info-Meldung aus wenn dies der Fall ist
 */
function checkErsteSicherungGroesserVersorgung(verteiler: Verteiler): ValidationError[] {
  const infos: ValidationError[] = [];

  // Finde Versorgungsklemme
  const versorgung = verteiler.komponenten.find(k => k.type === 'versorgungsklemme');
  if (!versorgung) return infos;

  const versorgungsstrom = verteiler.nennstrom || 0;
  if (versorgungsstrom <= 0) return infos;

  // Finde alle Sicherungen die direkt mit der Versorgungsklemme verbunden sind
  const direkteVerbindungen = verteiler.verbindungen.filter(
    w => w.von.componentId === versorgung.id
  );

  // Sammle alle direkt verbundenen Komponenten
  const direktVerbundeneIds = new Set(direkteVerbindungen.map(w => w.nach.componentId));

  // Schutzeinrichtungs-Typen die als erste Sicherung gelten (nur Überstromschutz!)
  // WICHTIG: FI-Schalter sind KEINE Überstromsicherungen, sondern nur Fehlerstromschutz
  const sicherungsTypen = ['ls-schalter', 'fi-ls-kombi', 'nh-sicherung', 'neozed-sicherung', 'schraub-sicherung'];

  for (const kompId of direktVerbundeneIds) {
    const komponente = verteiler.komponenten.find(k => k.id === kompId);
    if (!komponente) continue;

    if (sicherungsTypen.includes(komponente.type)) {
      const bemessungsStrom = (komponente as any).bemessungsStrom || 0;

      if (bemessungsStrom > versorgungsstrom) {
        infos.push({
          id: uuidv4(),
          typ: 'falsche-dimensionierung',
          komponenteId: komponente.id,
          komponenteName: komponente.name,
          beschreibung: `Erste Sicherung (${bemessungsStrom}A) ist größer als Versorgungsnennstrom (${versorgungsstrom}A)`,
          hinweis: `Die erste Sicherung nach der Versorgungsklemme hat einen höheren Bemessungsstrom als die Versorgung liefern kann. Dies kann zu Problemen führen. Prüfen Sie die Dimensionierung.`,
          schweregrad: 'info',
        });
      }
    }
  }

  return infos;
}

/**
 * Prüft Schmelzsicherungen auf korrekte Dimensionierung:
 * Betriebstrom < Nennstrom der Sicherung < zulässiger Leitungsstrom
 */
function checkSchmelzsicherungen(verteiler: Verteiler): { errors: ValidationError[]; warnings: ValidationError[] } {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Finde alle Schmelzsicherungen
  const sicherungen = verteiler.komponenten.filter(
    (k) => k.type === 'nh-sicherung' || k.type === 'schraub-sicherung' || k.type === 'neozed-sicherung'
  );

  for (const sicherung of sicherungen) {
    // Hole Nennstrom der Sicherung
    const nennstrom = (sicherung as any).bemessungsStrom;
    if (!nennstrom) continue;

    // Finde zugewiesene Verbraucher
    const zugewieseneVerbraucher = verteiler.verbraucher.filter(
      (v) => v.zugewieseneKomponente === sicherung.id
    );

    if (zugewieseneVerbraucher.length === 0) continue;

    // Berechne Betriebsstrom (Summe aller Verbraucher mit Gleichzeitigkeitsfaktor und √3 für Drehstrom)
    const betriebsstrom = zugewieseneVerbraucher.reduce((sum, v) => {
      const leistung = v.leistung * v.gleichzeitigkeitsfaktor;
      const verbraucherStrom = berechneVerbraucherStrom(leistung, v.spannung, v.phasen);
      return sum + verbraucherStrom;
    }, 0);

    // Prüfe: Betriebstrom < Nennstrom
    if (betriebsstrom >= nennstrom) {
      errors.push({
        id: uuidv4(),
        typ: 'falsche-dimensionierung',
        komponenteId: sicherung.id,
        komponenteName: sicherung.name,
        beschreibung: `Betriebsstrom (${betriebsstrom.toFixed(1)}A) ≥ Nennstrom der Sicherung (${nennstrom}A)`,
        hinweis: `Wählen Sie eine Sicherung mit höherem Nennstrom oder reduzieren Sie die angeschlossene Last. Für Schmelzsicherungen muss gelten: Betriebsstrom < Nennstrom < zulässiger Leitungsstrom.`,
        schweregrad: 'fehler',
      });
    }

    // Prüfe für jeden Verbraucher mit Leitungsdaten: Nennstrom < zulässiger Leitungsstrom
    for (const verbraucher of zugewieseneVerbraucher) {
      if (!verbraucher.leitungsquerschnitt) continue;

      const zulaessigerLeitungsstrom = LEITER_BELASTBARKEIT[verbraucher.leitungsquerschnitt];
      if (!zulaessigerLeitungsstrom) continue;

      // Prüfe: Nennstrom < zulässiger Leitungsstrom
      if (nennstrom >= zulaessigerLeitungsstrom) {
        errors.push({
          id: uuidv4(),
          typ: 'falsche-dimensionierung',
          komponenteId: verbraucher.id,
          komponenteName: verbraucher.name,
          beschreibung: `Nennstrom der Sicherung (${nennstrom}A) ≥ zulässiger Leitungsstrom (${zulaessigerLeitungsstrom}A bei ${verbraucher.leitungsquerschnitt}mm²)`,
          hinweis: `Verwenden Sie einen größeren Leitungsquerschnitt (aktuell ${verbraucher.leitungsquerschnitt}mm²) oder eine kleinere Sicherung. Für Schmelzsicherungen muss gelten: Betriebsstrom < Nennstrom < zulässiger Leitungsstrom.`,
          schweregrad: 'fehler',
        });
      } else if (nennstrom > zulaessigerLeitungsstrom * 0.9) {
        // Warnung wenn sehr knapp
        warnings.push({
          id: uuidv4(),
          typ: 'falsche-dimensionierung',
          komponenteId: verbraucher.id,
          komponenteName: verbraucher.name,
          beschreibung: `Nennstrom der Sicherung (${nennstrom}A) liegt nahe am zulässigen Leitungsstrom (${zulaessigerLeitungsstrom}A bei ${verbraucher.leitungsquerschnitt}mm²)`,
          hinweis: `Erwägen Sie einen größeren Leitungsquerschnitt für mehr Sicherheitsreserve.`,
          schweregrad: 'warnung',
        });
      }
    }
  }

  return { errors, warnings };
}

// ==========================================
// HILFS-BERECHNUNGEN
// ==========================================

/**
 * Findet alle Schutzeinrichtungen auf dem Pfad von einer Komponente zur Versorgung
 *
 * WICHTIG: Verwendet die neue Terminal-basierte Logik aus circuitGraph.ts
 * um verbügelte parallele Komponenten korrekt zu erkennen.
 *
 * Nur Komponenten die WIRKLICH in Serie sind (durchquert werden) werden zurückgegeben.
 */
function findeSchutzeinrichtungenAufPfad(
  verteiler: Verteiler,
  startKomponenteId: string
): (LSSchalterParams | FILSKombiParams)[] {
  const schutzeinrichtungen: (LSSchalterParams | FILSKombiParams)[] = [];

  // Prüfe ob die Start-Komponente selbst eine Schutzeinrichtung ist
  const startKomponente = verteiler.komponenten.find(k => k.id === startKomponenteId);
  if (startKomponente && (startKomponente.type === 'ls-schalter' || startKomponente.type === 'fi-ls-kombi')) {
    schutzeinrichtungen.push(startKomponente as LSSchalterParams | FILSKombiParams);
  }

  // Verwende die neue Terminal-basierte Logik um Komponenten in Serie zu finden
  const seriesComponents = findSeriesComponents(verteiler, startKomponenteId);

  // Filtere nur LS-Schalter und FI/LS-Kombis
  for (const component of seriesComponents) {
    if (component.type === 'ls-schalter' || component.type === 'fi-ls-kombi') {
      schutzeinrichtungen.push(component as LSSchalterParams | FILSKombiParams);
    }
  }

  return schutzeinrichtungen;
}

/**
 * Prüft die Schleifenimpedanz für jeden Verbraucher
 * Prüft den gesamten Pfad vom Verbraucher bis zur Versorgung
 */
function checkVerbraucherSchleifenimpedanz(verteiler: Verteiler): { errors: ValidationError[]; warnings: ValidationError[] } {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  for (const verbraucher of verteiler.verbraucher) {
    // Überspringe Verbraucher ohne Zuweisung
    if (!verbraucher.zugewieseneKomponente) {
      warnings.push({
        id: uuidv4(),
        typ: 'schleifenimpedanz',
        komponenteId: verbraucher.id,
        komponenteName: verbraucher.name,
        beschreibung: 'Verbraucher ist keiner Schutzeinrichtung zugewiesen',
        hinweis: 'Weisen Sie den Verbraucher einem LS-Schalter oder FI/LS zu.',
        schweregrad: 'warnung',
      });
      continue;
    }

    const startKomponente = verteiler.komponenten.find(k => k.id === verbraucher.zugewieseneKomponente);
    if (!startKomponente) continue;

    // Finde alle Schutzeinrichtungen auf dem Pfad
    const schutzeinrichtungenAufPfad = findeSchutzeinrichtungenAufPfad(verteiler, startKomponente.id);

    // Berechne Schleifenimpedanz
    const zsGesamt = berechneSchleifenimpedanzFuerVerbraucher(verteiler, verbraucher);
    if (zsGesamt === undefined) continue;

    const zsGesamtOhm = zsGesamt / 1000; // in Ω

    // Prüfe ob IRGENDEINE Schutzeinrichtung auf dem Pfad auslösen kann
    let kannAusloesen = false;
    let nahesteFehlerInfo: { schutz: any; zsMax: number } | null = null;
    let minZsMax = Infinity;

    for (const schutz of schutzeinrichtungenAufPfad) {
      // Berechne Auslösefaktor (magnetisches Auslösen)
      let ausloeseFaktor = 5;
      switch (schutz.charakteristik) {
        case 'B': ausloeseFaktor = 5; break;
        case 'C': ausloeseFaktor = 10; break;
        case 'D':
        case 'K': ausloeseFaktor = 20; break;
      }

      const ausloesestrom = schutz.bemessungsStrom * ausloeseFaktor;
      // 2/3-Regel für TN-Systeme (Abschaltzeit 0,4s bei 230V)
      const zsMax = (2 / 3) * (230 / ausloesestrom); // in Ω

      // Kann diese Schutzeinrichtung auslösen?
      if (zsGesamtOhm <= zsMax) {
        kannAusloesen = true;
      }

      // Speichere die kritischste (niedrigste Zs_max)
      if (zsMax < minZsMax) {
        minZsMax = zsMax;
        nahesteFehlerInfo = { schutz, zsMax };
      }
    }

    // Wenn KEINE Schutzeinrichtung auslösen kann → Fehler!
    if (!kannAusloesen && nahesteFehlerInfo) {
      const { schutz, zsMax } = nahesteFehlerInfo;
      errors.push({
        id: uuidv4(),
        typ: 'schleifenimpedanz',
        komponenteId: verbraucher.id,
        komponenteName: verbraucher.name,
        beschreibung: `💡 Schleifenimpedanz zu hoch: Zs=${zsGesamt.toFixed(1)}mΩ`,
        hinweis: `Nächste Schutzeinrichtung ${schutz.name} (${schutz.charakteristik}${schutz.bemessungsStrom}) benötigt Zs ≤ ${(zsMax * 1000).toFixed(1)}mΩ (2/3-Regel für 0,4s Abschaltzeit). Größeren Querschnitt verwenden oder Schutzeinrichtung anpassen!`,
        schweregrad: 'kritisch',
      });
    }

    // Prüfe Selektivität zwischen hintereinander geschalteten Sicherungen
    if (schutzeinrichtungenAufPfad.length > 1) {
      // Sortiere nach Position im Pfad (vom Verbraucher zur Versorgung)
      // Die Schutzeinrichtung direkt beim Verbraucher sollte VOR der vorgelagerten auslösen

      for (let i = 0; i < schutzeinrichtungenAufPfad.length - 1; i++) {
        const endstromkreis = schutzeinrichtungenAufPfad[i];
        const vorgelagert = schutzeinrichtungenAufPfad[i + 1];

        // Selektivitätsbedingung: Nennstrom vorgelagert >= 1,6 × Nennstrom Endstromkreis
        const faktor = vorgelagert.bemessungsStrom / endstromkreis.bemessungsStrom;

        if (faktor < 1.6) {
          warnings.push({
            id: uuidv4(),
            typ: 'selektivitaet',
            komponenteId: verbraucher.id,
            komponenteName: verbraucher.name,
            beschreibung: `Selektivität nicht gewährleistet: ${endstromkreis.name} (${endstromkreis.bemessungsStrom}A) → ${vorgelagert.name} (${vorgelagert.bemessungsStrom}A)`,
            hinweis: `Faktor ${faktor.toFixed(2)} < 1,6. Vorgelagerte Sicherung sollte mindestens ${(endstromkreis.bemessungsStrom * 1.6).toFixed(0)}A haben.`,
            schweregrad: 'warnung',
          });
        }
      }
    }
  }

  return { errors, warnings };
}

function berechneGesamtwerte(verteiler: Verteiler): ValidationResult['berechnungen'] {
  // Gesamtleistung mit Gleichzeitigkeitsfaktor
  const gesamtLeistung = verteiler.verbraucher.reduce(
    (sum, v) => sum + v.leistung * v.gleichzeitigkeitsfaktor,
    0
  );

  // Phasenlasten
  const phasenLasten: Record<Phase, number> = {
    L1: 0,
    L2: 0,
    L3: 0,
    N: 0,
    PE: 0,
  };

  for (const verbraucher of verteiler.verbraucher) {
    const effectivePhasen = getEffectivePhasen(verteiler, verbraucher);
    const lastProPhase = (verbraucher.leistung * verbraucher.gleichzeitigkeitsfaktor) / effectivePhasen.length;
    for (const phase of effectivePhasen) {
      if (phase in phasenLasten) {
        phasenLasten[phase] += lastProPhase;
      }
    }
  }

  // Maximaler Spannungsfall (vereinfacht)
  let maxSpannungsfall = 0;
  for (const wire of verteiler.verbindungen) {
    const rho = wire.material === 'Cu' ? RHO_KUPFER : RHO_ALUMINIUM;
    const widerstand = (2 * rho * wire.laenge) / wire.querschnitt;

    const zugehoerigerVerbraucher = verteiler.verbraucher.find(
      (v) => v.zugewieseneKomponente === wire.nach.componentId
    );

    if (zugehoerigerVerbraucher) {
      const strom = zugehoerigerVerbraucher.leistung / 230;
      const spannungsfall = (widerstand * strom / 230) * 100;
      maxSpannungsfall = Math.max(maxSpannungsfall, spannungsfall);
    }
  }

  // Schleifenimpedanz am Einspeisepunkt
  // Priorität: 1. Schleifenimpedanz der Versorgungsklemme, 2. Aus Kurzschlussstrom berechnet
  const versorgungsklemme = verteiler.komponenten.find(k => k.type === 'versorgungsklemme');
  let schleifenimpedanz: number;
  if (versorgungsklemme && (versorgungsklemme as any).schleifenimpedanz > 0) {
    schleifenimpedanz = (versorgungsklemme as any).schleifenimpedanz * 1000; // Ω zu mΩ
  } else {
    schleifenimpedanz = 0.5 * 1000; // Standardwert in mΩ (0.5 Ω)
  }

  return {
    gesamtLeistung,
    spannungsfall: maxSpannungsfall,
    schleifenimpedanz, // in mΩ
    phasenLasten,
  };
}

/**
 * Berechnet die Schleifenimpedanz für einen Verbraucher
 * Berücksichtigt den kompletten Pfad von der Versorgung bis zum Verbraucher
 */
function berechneSchleifenimpedanzFuerVerbraucher(
  verteiler: Verteiler,
  verbraucher: any
): number | undefined {
  // Finde Versorgungsklemme um deren Schleifenimpedanz zu nutzen
  const versorgungsklemme = verteiler.komponenten.find(
    (k) => k.type === 'versorgungsklemme'
  );

  // Schleifenimpedanz am Einspeisepunkt:
  // Schleifenimpedanz aus Versorgungsklemme verwenden
  let zsVorgelagert: number;
  if (versorgungsklemme && (versorgungsklemme as any).schleifenimpedanz > 0) {
    zsVorgelagert = (versorgungsklemme as any).schleifenimpedanz; // Direkt in Ω
  } else {
    zsVorgelagert = 0.5; // Standardwert falls keine Versorgungsklemme vorhanden
  }

  // Wenn keine Leitungsdaten vorhanden, nur vorgelagerte Impedanz zurückgeben
  if (!verbraucher.leitungslaenge || !verbraucher.leitungsquerschnitt) {
    return zsVorgelagert * 1000; // in mΩ
  }

  // Leitungsimpedanz vom Verbraucher zur Schutzeinrichtung
  const rho = RHO_KUPFER;
  const leitungsImpedanz = (2 * rho * verbraucher.leitungslaenge) / verbraucher.leitungsquerschnitt;

  // Finde zugewiesene Schutzeinrichtung
  const schutzeinrichtung = verteiler.komponenten.find(
    (k) => k.id === verbraucher.zugewieseneKomponente
  );

  if (!schutzeinrichtung) {
    // Nur vorgelagerte Impedanz + Leitungsimpedanz
    return (zsVorgelagert + leitungsImpedanz) * 1000; // in mΩ
  }

  if (!versorgungsklemme) {
    return (zsVorgelagert + leitungsImpedanz) * 1000; // in mΩ
  }

  // Finde alle Leitungen von Versorgung zur Schutzeinrichtung
  const zuleitungen = findLeitungspfad(verteiler, versorgungsklemme.id, schutzeinrichtung.id);

  let zuleitungsImpedanz = 0;
  for (const wire of zuleitungen) {
    const rhoWire = wire.material === 'Cu' ? RHO_KUPFER : RHO_ALUMINIUM;
    zuleitungsImpedanz += (2 * rhoWire * wire.laenge) / wire.querschnitt;
  }

  // Gesamtimpedanz: Vorgelagert + Zuleitungen + Verbraucherleitung
  const zsGesamt = zsVorgelagert + zuleitungsImpedanz + leitungsImpedanz;

  return zsGesamt * 1000; // in mΩ
}

/**
 * Erstellt Stromkreis-Ergebnisse für jeden Verbraucher
 */
function erstelleStromkreisErgebnisse(
  verteiler: Verteiler,
  alleErrors: ValidationError[],
  alleWarnings: ValidationError[]
): StromkreisResult[] {
  const stromkreise: StromkreisResult[] = [];

  for (const verbraucher of verteiler.verbraucher) {
    // Berechne Strom und Leistung (mit √3 für Drehstrom)
    const leistung = verbraucher.leistung * verbraucher.gleichzeitigkeitsfaktor;
    const effectivePhasen = getEffectivePhasen(verteiler, verbraucher);
    const strom = berechneVerbraucherStrom(leistung, verbraucher.spannung, effectivePhasen);

    // Spannungsfall berechnen (wenn Leitungsdaten vorhanden)
    let spannungsfall: number | undefined;
    if (verbraucher.leitungslaenge && verbraucher.leitungsquerschnitt) {
      const rho = RHO_KUPFER;
      const widerstand = (2 * rho * verbraucher.leitungslaenge) / verbraucher.leitungsquerschnitt;
      const spannungsfallVolt = widerstand * strom;
      spannungsfall = (spannungsfallVolt / verbraucher.spannung) * 100;
    }

    // Schleifenimpedanz berechnen
    const schleifenimpedanz = berechneSchleifenimpedanzFuerVerbraucher(verteiler, verbraucher);

    // Finde Fehler und Warnungen für diesen Verbraucher
    const fehler = alleErrors.filter(e => e.komponenteId === verbraucher.id);
    const warnungen = alleWarnings.filter(w => w.komponenteId === verbraucher.id);

    // Bestimme Status
    let status: 'ok' | 'warnung' | 'fehler' = 'ok';
    if (fehler.length > 0) status = 'fehler';
    else if (warnungen.length > 0) status = 'warnung';

    stromkreise.push({
      verbraucherId: verbraucher.id,
      verbraucherName: verbraucher.name,
      status,
      berechnungen: {
        leistung,
        strom,
        spannungsfall,
        leitungslaenge: verbraucher.leitungslaenge,
        querschnitt: verbraucher.leitungsquerschnitt,
        schleifenimpedanz,
      },
      fehler,
      warnungen,
    });
  }

  return stromkreise;
}

/**
 * Berechnet den maximalen Belastungsstrom für einen Querschnitt
 */
export function getMaxStrom(querschnitt: number): number {
  return LEITER_BELASTBARKEIT[querschnitt] || 0;
}

/**
 * Empfiehlt einen Leitungsquerschnitt für einen gegebenen Strom
 */
export function empfehleQuerschnitt(strom: number): number {
  const querschnitte = Object.entries(LEITER_BELASTBARKEIT)
    .map(([q, i]) => ({ querschnitt: parseFloat(q), maxStrom: i }))
    .sort((a, b) => a.querschnitt - b.querschnitt);

  for (const { querschnitt, maxStrom } of querschnitte) {
    if (maxStrom >= strom * 1.25) {
      // 25% Sicherheitsmarge
      return querschnitt;
    }
  }

  return 120; // Maximum
}

/**
 * Hilfsfunktion: Holt den Bemessungsstrom einer Schutzeinrichtung
 */
function getBemessungsStrom(komponente: ElektroComponent): number {
  switch (komponente.type) {
    case 'ls-schalter':
      return (komponente as LSSchalterParams).bemessungsStrom;
    case 'fi-ls-kombi':
      return (komponente as FILSKombiParams).bemessungsStrom;
    case 'nh-sicherung':
      return (komponente as NHSicherungParams).bemessungsStrom;
    case 'neozed-sicherung':
      return (komponente as NeozedSicherungParams).bemessungsStrom;
    case 'schraub-sicherung':
      return (komponente as SchraubSicherungParams).bemessungsStrom;
    default:
      return 0;
  }
}

/**
 * Prüft ob einzelne Verbraucher einen höheren Strom haben als die vorgelagerten Sicherungen
 *
 * Geprüft werden:
 * - Die direkt zugewiesene Schutzeinrichtung (LS-Schalter, FI/LS-Kombi)
 * - ALLE vorgeschalteten Sicherungen im Stromkreis (NH-Sicherungen, Neozed, Schraubsicherungen)
 *
 * Dies ist ein Fehler, da der Verbraucher entweder nicht die volle Leistung nutzen kann
 * oder die Sicherung bei Betrieb auslösen wird.
 */
function checkVerbraucherUeberstrom(verteiler: Verteiler): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const verbraucher of verteiler.verbraucher) {
    // Überspringe Verbraucher ohne Zuweisung - wird bereits in anderen Checks geprüft
    if (!verbraucher.zugewieseneKomponente) {
      continue;
    }

    // Berechne den Strom des Verbrauchers (mit √3 für Drehstrom)
    const leistung = verbraucher.leistung * verbraucher.gleichzeitigkeitsfaktor;
    const spannung = verbraucher.spannung;
    const effectivePhasen = getEffectivePhasen(verteiler, verbraucher);
    const verbraucherStrom = berechneVerbraucherStrom(leistung, spannung, effectivePhasen);

    // Finde die zugewiesene Schutzeinrichtung
    const zugewieseneKomponente = verteiler.komponenten.find(
      k => k.id === verbraucher.zugewieseneKomponente
    );

    if (!zugewieseneKomponente) {
      continue;
    }

    // Prüfe die direkt zugewiesene Schutzeinrichtung (nur LS-Schalter und FI/LS-Kombi)
    let hatDirekteSchutzeinrichtung = false;
    if (zugewieseneKomponente.type === 'ls-schalter' || zugewieseneKomponente.type === 'fi-ls-kombi') {
      hatDirekteSchutzeinrichtung = true;
      const bemessungsStrom = getBemessungsStrom(zugewieseneKomponente);

      if (bemessungsStrom > 0 && verbraucherStrom > bemessungsStrom) {
        errors.push({
          id: uuidv4(),
          typ: 'ueberstrom',
          komponenteId: verbraucher.id,
          komponenteName: verbraucher.name,
          beschreibung: `Verbraucher hat höheren Strom (${verbraucherStrom.toFixed(1)}A) als zugewiesene Sicherung "${zugewieseneKomponente.name}" (${bemessungsStrom}A)`,
          hinweis: `Der Verbraucher mit ${leistung.toFixed(0)}W Leistung benötigt ${verbraucherStrom.toFixed(1)}A, aber die Sicherung ist nur für ${bemessungsStrom}A ausgelegt. Erhöhen Sie den Bemessungsstrom der Sicherung oder reduzieren Sie die Verbraucherleistung.`,
          schweregrad: 'fehler',
        });
      }
    }

    // Finde ALLE vorgeschalteten Schutzeinrichtungen im Stromkreis
    const vorgeschalteteSchutzeinrichtungen = findSeriesProtection(verteiler, zugewieseneKomponente.id);

    // Prüfe jede vorgeschaltete Sicherung
    let hatVorgeschalteteSicherung = false;
    for (const schutzeinrichtung of vorgeschalteteSchutzeinrichtungen) {
      // Überspringe die zugewiesene Komponente selbst (wurde bereits oben geprüft)
      if (schutzeinrichtung.id === zugewieseneKomponente.id) {
        continue;
      }

      hatVorgeschalteteSicherung = true;
      const bemessungsStrom = getBemessungsStrom(schutzeinrichtung);

      // Prüfe ob der Verbraucherstrom höher als die vorgeschaltete Sicherung ist
      if (bemessungsStrom > 0 && verbraucherStrom > bemessungsStrom) {
        errors.push({
          id: uuidv4(),
          typ: 'ueberstrom',
          komponenteId: verbraucher.id,
          komponenteName: verbraucher.name,
          beschreibung: `Verbraucher hat höheren Strom (${verbraucherStrom.toFixed(1)}A) als vorgeschaltete Sicherung "${schutzeinrichtung.name}" (${bemessungsStrom}A)`,
          hinweis: `Der Verbraucher mit ${leistung.toFixed(0)}W Leistung benötigt ${verbraucherStrom.toFixed(1)}A, aber die vorgeschaltete ${schutzeinrichtung.type === 'nh-sicherung' ? 'NH-Sicherung' : schutzeinrichtung.type === 'neozed-sicherung' ? 'Neozed-Sicherung' : schutzeinrichtung.type === 'schraub-sicherung' ? 'Schraubsicherung' : 'Sicherung'} "${schutzeinrichtung.name}" ist nur für ${bemessungsStrom}A ausgelegt. Erhöhen Sie den Bemessungsstrom der vorgeschalteten Sicherung.`,
          schweregrad: 'fehler',
        });
      }
    }

    // Prüfe ob ÜBERHAUPT KEINE Sicherung vorhanden ist (weder direkt noch vorgeschaltet)
    if (!hatDirekteSchutzeinrichtung && !hatVorgeschalteteSicherung) {
      errors.push({
        id: uuidv4(),
        typ: 'fehlende-schutzeinrichtung',
        komponenteId: verbraucher.id,
        komponenteName: verbraucher.name,
        beschreibung: `Verbraucher hat keine Schutzeinrichtung`,
        hinweis: `Der Verbraucher mit ${leistung.toFixed(0)}W Leistung (${verbraucherStrom.toFixed(1)}A) hat weder eine direkt zugewiesene noch eine vorgeschaltete Überstromschutzeinrichtung. Jeder Verbraucher muss durch mindestens eine Sicherung (LS-Schalter, FI/LS-Kombi, NH-Sicherung, etc.) geschützt sein.`,
        schweregrad: 'kritisch',
      });
    }

    // Prüfe ob nur vorgeschaltete Sicherung vorhanden ist, aber keine direkte Schutzeinrichtung
    // Dies ist problematisch bei FI-Schaltern: Verbraucher → FI → NH-Sicherung
    if (!hatDirekteSchutzeinrichtung && hatVorgeschalteteSicherung) {
      // Prüfe ob die zugewiesene Komponente ein FI-Schalter ist
      if (zugewieseneKomponente.type === 'fi-schalter') {
        errors.push({
          id: uuidv4(),
          typ: 'fehlende-schutzeinrichtung',
          komponenteId: verbraucher.id,
          komponenteName: verbraucher.name,
          beschreibung: `Zwischen FI-Schalter und Verbraucher fehlt Überstromschutz`,
          hinweis: `Der Verbraucher ist direkt an einem FI-Schalter angeschlossen, aber zwischen FI und Verbraucher fehlt eine Überstromschutzeinrichtung (LS-Schalter). Auch wenn vorgeschaltete Sicherungen vorhanden sind, muss jeder Abgang am FI-Schalter durch einen LS-Schalter oder FI/LS-Kombi geschützt werden.`,
          schweregrad: 'kritisch',
        });
      }
    }
  }

  return errors;
}

// ==========================================
// 19. KABELBELASTBARKEIT PRÜFEN
// ==========================================

function checkKabelbelastbarkeit(verteiler: Verteiler): { errors: ValidationError[]; warnings: ValidationError[] } {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Prüfe jeden Verbraucher
  for (const verbraucher of verteiler.verbraucher) {
    // Überspringe Verbraucher ohne Zuweisung oder ohne Leitungsdaten
    if (!verbraucher.zugewieseneKomponente) continue;
    if (!verbraucher.leitungsquerschnitt || !verbraucher.verlegeart || !verbraucher.leitermaterial) continue;

    // Finde die zugewiesene Komponente
    const zugewieseneKomponente = verteiler.komponenten.find(
      (k) => k.id === verbraucher.zugewieseneKomponente
    );

    if (!zugewieseneKomponente) continue;

    // Bestimme die Anzahl der belasteten Adern
    const anzahlAdern = verbraucher.spannung === 400 ? 3 : 2;

    // Hole die Strombelastbarkeit aus der Tabelle
    const strombelastbarkeit = getStrombelastbarkeit(
      verbraucher.leitungsquerschnitt,
      verbraucher.leitermaterial,
      verbraucher.verlegeart,
      anzahlAdern
    );

    // Wenn keine Daten vorhanden, überspringe
    if (strombelastbarkeit === null) {
      warnings.push({
        id: uuidv4(),
        typ: 'kabelueberlastung',
        komponenteId: verbraucher.id,
        komponenteName: verbraucher.name,
        beschreibung: `Keine Strombelastbarkeitsdaten für ${verbraucher.leitungsquerschnitt}mm² ${verbraucher.leitermaterial} ${verbraucher.verlegeart}`,
        hinweis: `Für die gewählte Kombination aus Querschnitt, Material und Verlegeart konnten keine Belastbarkeitsdaten aus ÖVE E 8101 gefunden werden. Bitte prüfen Sie die Eingaben.`,
        schweregrad: 'warnung',
      });
      continue;
    }

    // Bestimme den Bemessungsstrom der Schutzeinrichtung
    let bemessungsStrom = 0;
    let schutzeinrichtungsTyp = '';
    let istSchmelzsicherung = false;

    // Prüfe verschiedene Schutzeinrichtungstypen
    if (zugewieseneKomponente.type === 'ls-schalter') {
      bemessungsStrom = (zugewieseneKomponente as LSSchalterParams).bemessungsStrom;
      schutzeinrichtungsTyp = 'LS-Schalter';
    } else if (zugewieseneKomponente.type === 'fi-ls-kombi') {
      bemessungsStrom = (zugewieseneKomponente as FILSKombiParams).bemessungsStrom;
      schutzeinrichtungsTyp = 'FI/LS-Kombination';
    } else if (zugewieseneKomponente.type === 'nh-sicherung') {
      bemessungsStrom = (zugewieseneKomponente as NHSicherungParams).bemessungsStrom;
      schutzeinrichtungsTyp = 'NH-Sicherung';
      istSchmelzsicherung = true;
    } else if (zugewieseneKomponente.type === 'neozed-sicherung') {
      bemessungsStrom = (zugewieseneKomponente as NeozedSicherungParams).bemessungsStrom;
      schutzeinrichtungsTyp = 'Neozed-Sicherung';
      istSchmelzsicherung = true;
    } else if (zugewieseneKomponente.type === 'schraub-sicherung') {
      bemessungsStrom = (zugewieseneKomponente as SchraubSicherungParams).bemessungsStrom;
      schutzeinrichtungsTyp = 'Schraub-Sicherung';
      istSchmelzsicherung = true;
    } else if (zugewieseneKomponente.type === 'abgangsklemme') {
      // Bei Abgangsklemmen: Suche vorgeschaltete Schutzeinrichtung
      const vorgeschalteteSchutzeinrichtungen = findSeriesProtection(verteiler, zugewieseneKomponente.id);

      for (const schutz of vorgeschalteteSchutzeinrichtungen) {
        if (schutz.type === 'ls-schalter') {
          bemessungsStrom = (schutz as LSSchalterParams).bemessungsStrom;
          schutzeinrichtungsTyp = 'vorgeschalteter LS-Schalter';
          break;
        } else if (schutz.type === 'fi-ls-kombi') {
          bemessungsStrom = (schutz as FILSKombiParams).bemessungsStrom;
          schutzeinrichtungsTyp = 'vorgeschaltete FI/LS-Kombination';
          break;
        } else if (schutz.type === 'nh-sicherung') {
          bemessungsStrom = (schutz as NHSicherungParams).bemessungsStrom;
          schutzeinrichtungsTyp = 'vorgeschaltete NH-Sicherung';
          istSchmelzsicherung = true;
          break;
        } else if (schutz.type === 'neozed-sicherung') {
          bemessungsStrom = (schutz as NeozedSicherungParams).bemessungsStrom;
          schutzeinrichtungsTyp = 'vorgeschaltete Neozed-Sicherung';
          istSchmelzsicherung = true;
          break;
        } else if (schutz.type === 'schraub-sicherung') {
          bemessungsStrom = (schutz as SchraubSicherungParams).bemessungsStrom;
          schutzeinrichtungsTyp = 'vorgeschaltete Schraub-Sicherung';
          istSchmelzsicherung = true;
          break;
        }
      }
    }

    // Wenn kein Bemessungsstrom gefunden, überspringe
    if (bemessungsStrom === 0) continue;

    // Wende die Schaltstromregel an
    // Für LS: Strombelastbarkeit × 1,45 > Nennstrom × 1,45  =>  Strombelastbarkeit > Nennstrom
    // Für Schmelzsicherungen: Strombelastbarkeit × 1,45 > Nennstrom × 1,6  =>  Strombelastbarkeit > Nennstrom × 1,103

    const erforderlicheStrombelastbarkeit = istSchmelzsicherung
      ? bemessungsStrom * (1.6 / 1.45) // ≈ 1.103
      : bemessungsStrom;

    if (strombelastbarkeit < erforderlicheStrombelastbarkeit) {
      const fehlerText = istSchmelzsicherung
        ? `Kabelquerschnitt zu gering: ${verbraucher.leitungsquerschnitt}mm² trägt nur ${strombelastbarkeit}A (${verbraucher.verlegeart}), benötigt aber ${erforderlicheStrombelastbarkeit.toFixed(1)}A für ${bemessungsStrom}A ${schutzeinrichtungsTyp} (Schaltstromregel: Iz × 1,45 > In × 1,6)`
        : `Kabelquerschnitt zu gering: ${verbraucher.leitungsquerschnitt}mm² trägt nur ${strombelastbarkeit}A (${verbraucher.verlegeart}), benötigt aber mindestens ${erforderlicheStrombelastbarkeit}A für ${bemessungsStrom}A ${schutzeinrichtungsTyp} (Schaltstromregel: Iz × 1,45 > In × 1,45)`;

      errors.push({
        id: uuidv4(),
        typ: 'kabelueberlastung',
        komponenteId: verbraucher.id,
        komponenteName: verbraucher.name,
        beschreibung: fehlerText,
        hinweis: `Gemäß ÖVE E 8101 muss die Strombelastbarkeit des Leiters (Iz) die Bedingung erfüllen: ${istSchmelzsicherung ? 'Iz × 1,45 > In × 1,6 (bei Schmelzsicherungen)' : 'Iz ≥ In (bei Leitungsschutzschaltern)'}. Wählen Sie einen größeren Kabelquerschnitt oder ändern Sie die Verlegeart (z.B. von ${verbraucher.verlegeart} zu einer besser belüfteten Verlegeart).`,
        schweregrad: 'fehler',
      });
    }
  }

  return { errors, warnings };
}
