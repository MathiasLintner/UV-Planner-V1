// Schneller Test für die Überstrom-Validierung
// WICHTIG: Gilt NUR für LS-Schalter und FI/LS-Kombinationen!

// Test-Szenario:
// Verbraucher: 3680W bei 230V = 16A
// LS-Schalter: 10A
// Erwartung: Warnung!

const leistung = 3680; // Watt
const spannung = 230;  // Volt
const gleichzeitigkeitsfaktor = 1.0;

const effektiveLeistung = leistung * gleichzeitigkeitsfaktor;
const verbraucherStrom = effektiveLeistung / spannung;

const bemessungsStrom = 10; // A

console.log('=== Test: Überstrom-Warnung ===');
console.log(`Verbraucher: ${leistung}W @ ${spannung}V`);
console.log(`Gleichzeitigkeitsfaktor: ${gleichzeitigkeitsfaktor}`);
console.log(`Effektive Leistung: ${effektiveLeistung}W`);
console.log(`Berechneter Strom: ${verbraucherStrom.toFixed(2)}A`);
console.log(`Bemessungsstrom Sicherung: ${bemessungsStrom}A`);
console.log('');

if (verbraucherStrom > bemessungsStrom) {
  console.log('✅ WARNUNG würde ausgelöst!');
  console.log(`   Verbraucher: ${verbraucherStrom.toFixed(1)}A > Sicherung: ${bemessungsStrom}A`);
} else {
  console.log('❌ Keine Warnung (${verbraucherStrom.toFixed(1)}A <= ${bemessungsStrom}A)');
}

console.log('');
console.log('=== Test 2: Drehstrom ===');
const leistung3ph = 11000; // Herd 11kW
const spannung3ph = 400;
const phasenAnzahl = 3;

const strom3ph = leistung3ph / (Math.sqrt(3) * spannung3ph);
const bemessungsstrom3ph = 10;

console.log(`Verbraucher: ${leistung3ph}W @ ${spannung3ph}V (3-phasig)`);
console.log(`Berechneter Strom: ${strom3ph.toFixed(2)}A`);
console.log(`Bemessungsstrom Sicherung: ${bemessungsstrom3ph}A`);

if (strom3ph > bemessungsstrom3ph) {
  console.log('✅ WARNUNG würde ausgelöst!');
  console.log(`   Verbraucher: ${strom3ph.toFixed(1)}A > Sicherung: ${bemessungsstrom3ph}A`);
} else {
  console.log(`❌ Keine Warnung (${strom3ph.toFixed(1)}A <= ${bemessungsstrom3ph}A)`);
}
