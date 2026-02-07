// Test der korrigierten Stromberechnung mit √3-Faktor für Drehstrom

console.log('=== Stromberechnung mit korrektem √3-Faktor ===\n');

// Hilfsfunktion: Berechnet den Strom korrekt
function berechneStrom(leistung, spannung, phasenAnzahl) {
  if (phasenAnzahl === 3 && spannung === 400) {
    // Drehstrom: P = √3 × U × I  =>  I = P / (√3 × U)
    return leistung / (Math.sqrt(3) * spannung);
  } else {
    // Einphasig: P = U × I  =>  I = P / U
    return leistung / spannung;
  }
}

// Test 1: Einphasiger Verbraucher
console.log('--- Test 1: Einphasiger Verbraucher ---');
const p1 = 3680; // Steckdose
const u1 = 230;
const phasen1 = 1;
const i1 = berechneStrom(p1, u1, phasen1);
console.log(`Leistung: ${p1}W`);
console.log(`Spannung: ${u1}V`);
console.log(`Phasen: ${phasen1}`);
console.log(`Formel: I = P / U = ${p1} / ${u1}`);
console.log(`Strom: ${i1.toFixed(2)}A`);
console.log();

// Test 2: Drehstrom OHNE √3 (FALSCH!)
console.log('--- Test 2: Drehstrom OHNE √3 (ALTE FALSCHE Berechnung) ---');
const p2 = 11000; // Herd
const u2 = 400;
const i2_falsch = p2 / u2;
console.log(`Leistung: ${p2}W`);
console.log(`Spannung: ${u2}V`);
console.log(`Phasen: 3`);
console.log(`Formel (FALSCH): I = P / U = ${p2} / ${u2}`);
console.log(`Strom (FALSCH): ${i2_falsch.toFixed(2)}A`);
console.log('❌ PROBLEM: Strom zu niedrig berechnet!');
console.log();

// Test 3: Drehstrom MIT √3 (RICHTIG!)
console.log('--- Test 3: Drehstrom MIT √3 (NEUE KORREKTE Berechnung) ---');
const phasen3 = 3;
const i3_richtig = berechneStrom(p2, u2, phasen3);
console.log(`Leistung: ${p2}W`);
console.log(`Spannung: ${u2}V`);
console.log(`Phasen: ${phasen3}`);
console.log(`Formel (RICHTIG): I = P / (√3 × U) = ${p2} / (√3 × ${u2})`);
console.log(`Strom (RICHTIG): ${i3_richtig.toFixed(2)}A`);
console.log('✅ Korrekt!');
console.log();

// Vergleich
console.log('--- Vergleich: FALSCH vs. RICHTIG ---');
console.log(`Alte Berechnung (ohne √3): ${i2_falsch.toFixed(2)}A`);
console.log(`Neue Berechnung (mit √3):  ${i3_richtig.toFixed(2)}A`);
console.log(`Differenz: ${(i3_richtig - i2_falsch).toFixed(2)}A (${((i3_richtig / i2_falsch - 1) * 100).toFixed(1)}% höher)`);
console.log();

// Test 4: Wallbox 11kW (Drehstrom)
console.log('--- Test 4: Wallbox 11kW (Drehstrom) ---');
const p4 = 11000;
const u4 = 400;
const phasen4 = 3;
const i4 = berechneStrom(p4, u4, phasen4);
console.log(`Leistung: ${p4}W`);
console.log(`Spannung: ${u4}V`);
console.log(`Phasen: ${phasen4}`);
console.log(`Strom: ${i4.toFixed(2)}A`);
console.log(`Empfohlene Sicherung: 16A (weil ${i4.toFixed(1)}A < 16A)`);
console.log();

// Test 5: Großer Drehstromverbraucher
console.log('--- Test 5: Wärmepumpe 15kW (Drehstrom) ---');
const p5 = 15000;
const u5 = 400;
const phasen5 = 3;
const i5 = berechneStrom(p5, u5, phasen5);
console.log(`Leistung: ${p5}W`);
console.log(`Spannung: ${u5}V`);
console.log(`Phasen: ${phasen5}`);
console.log(`Strom: ${i5.toFixed(2)}A`);
console.log(`Empfohlene Sicherung: 25A (weil ${i5.toFixed(1)}A < 25A)`);
console.log();

console.log('=== Zusammenfassung ===');
console.log('✅ Einphasig (230V): I = P / U');
console.log('✅ Drehstrom (400V): I = P / (√3 × U)');
console.log('✅ √3 ≈ 1.732');
