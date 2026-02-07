// Test: Drehfeldcheck nur bei 3-phasigen Verbrauchern

console.log('=== Drehfeldcheck-Logik ===\n');

// Simuliere die Prüfung ob Drehfeldcheck durchgeführt werden soll
function sollDrehfeldGeprueftWerden(phasen) {
  const phasenAnzahl = phasen.filter(p => p !== 'N' && p !== 'PE').length;
  return phasenAnzahl === 3;
}

// Test 1: Einphasiger Verbraucher (z.B. Steckdose)
console.log('--- Test 1: Einphasiger Verbraucher (Steckdose) ---');
const phasen1 = ['L1', 'N', 'PE'];
const pruefe1 = sollDrehfeldGeprueftWerden(phasen1);
console.log(`Phasen: ${phasen1.join(', ')}`);
console.log(`Phasenanzahl (ohne N, PE): 1`);
console.log(`Drehfeldcheck durchführen: ${pruefe1 ? 'JA ✓' : 'NEIN ✗'}`);
console.log(pruefe1 ? '❌ FEHLER: Sollte nicht geprüft werden!' : '✅ Korrekt: Kein Drehfeldcheck');
console.log();

// Test 2: Zweiphasiger Verbraucher (z.B. 400V zwischen L1 und L2)
console.log('--- Test 2: Zweiphasiger Verbraucher ---');
const phasen2 = ['L1', 'L2', 'N', 'PE'];
const pruefe2 = sollDrehfeldGeprueftWerden(phasen2);
console.log(`Phasen: ${phasen2.join(', ')}`);
console.log(`Phasenanzahl (ohne N, PE): 2`);
console.log(`Drehfeldcheck durchführen: ${pruefe2 ? 'JA ✓' : 'NEIN ✗'}`);
console.log(pruefe2 ? '❌ FEHLER: Sollte nicht geprüft werden!' : '✅ Korrekt: Kein Drehfeldcheck');
console.log();

// Test 3: Dreiphasiger Verbraucher (z.B. Herd, Wallbox, Motor)
console.log('--- Test 3: Drehstromverbraucher (Herd/Wallbox/Motor) ---');
const phasen3 = ['L1', 'L2', 'L3', 'N', 'PE'];
const pruefe3 = sollDrehfeldGeprueftWerden(phasen3);
console.log(`Phasen: ${phasen3.join(', ')}`);
console.log(`Phasenanzahl (ohne N, PE): 3`);
console.log(`Drehfeldcheck durchführen: ${pruefe3 ? 'JA ✓' : 'NEIN ✗'}`);
console.log(pruefe3 ? '✅ Korrekt: Drehfeldcheck wird durchgeführt' : '❌ FEHLER: Sollte geprüft werden!');
console.log();

// Test 4: Drehstromverbraucher ohne N (z.B. Motor)
console.log('--- Test 4: Drehstrommotor (ohne N) ---');
const phasen4 = ['L1', 'L2', 'L3', 'PE'];
const pruefe4 = sollDrehfeldGeprueftWerden(phasen4);
console.log(`Phasen: ${phasen4.join(', ')}`);
console.log(`Phasenanzahl (ohne N, PE): 3`);
console.log(`Drehfeldcheck durchführen: ${pruefe4 ? 'JA ✓' : 'NEIN ✗'}`);
console.log(pruefe4 ? '✅ Korrekt: Drehfeldcheck wird durchgeführt' : '❌ FEHLER: Sollte geprüft werden!');
console.log();

// Test 5: Nur N und PE (sollte niemals vorkommen, aber sicherheitshalber)
console.log('--- Test 5: Nur N und PE (ungültig) ---');
const phasen5 = ['N', 'PE'];
const pruefe5 = sollDrehfeldGeprueftWerden(phasen5);
console.log(`Phasen: ${phasen5.join(', ')}`);
console.log(`Phasenanzahl (ohne N, PE): 0`);
console.log(`Drehfeldcheck durchführen: ${pruefe5 ? 'JA ✓' : 'NEIN ✗'}`);
console.log(pruefe5 ? '❌ FEHLER: Sollte nicht geprüft werden!' : '✅ Korrekt: Kein Drehfeldcheck');
console.log();

console.log('=== Zusammenfassung ===');
console.log('✅ Einphasig (1 Phase): KEIN Drehfeldcheck');
console.log('✅ Zweiphasig (2 Phasen): KEIN Drehfeldcheck');
console.log('✅ Drehstrom (3 Phasen): Drehfeldcheck AKTIV');
console.log('\nDer Drehfeldcheck prüft nur bei 3-phasigen Verbrauchern,');
console.log('ob L1→L1, L2→L2, L3→L3 korrekt durchverbunden sind.');
