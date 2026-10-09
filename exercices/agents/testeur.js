'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { conditionsPaiement } = require('../../src/paiement/conditions');

const clientStandard = { grand_compte: false };
const grandCompte = { grand_compte: true };

for (const total of [-0.01, 0, NaN, '1000', null, undefined]) {
  test(`§ 1 — refuse le total invalide ${String(total)}`, () => {
    assert.throws(() => conditionsPaiement(clientStandard, total));
  });
}

test('§ 1 — accepte 0,01 €, juste au-dessus de zéro', () => {
  assert.deepStrictEqual(conditionsPaiement(clientStandard, 0.01), {
    acompte: 0,
    solde: 0.01,
    delaiSoldeJours: 30,
  });
});

for (const [total, attendu] of [[999.99, 0], [1000, 300], [1000.01, 300]]) {
  test(`§ 2 — acompte de ${attendu} € pour un total TTC de ${total} €`, () => {
    assert.strictEqual(conditionsPaiement(clientStandard, total).acompte, attendu);
  });
}

for (const total of [999.99, 1000, 1000.01, 10000]) {
  test(`§ 3 — aucun acompte pour un grand compte à ${total} € TTC`, () => {
    assert.strictEqual(conditionsPaiement(grandCompte, total).acompte, 0);
  });
}

for (const [total, solde] of [[999.99, 999.99], [1000, 700], [1000.01, 700.01]]) {
  test(`§ 4 — solde standard de ${solde} € à 30 jours pour ${total} € TTC`, () => {
    const resultat = conditionsPaiement(clientStandard, total);
    assert.strictEqual(resultat.solde, solde);
    assert.strictEqual(resultat.delaiSoldeJours, 30);
  });
}

test('§ 4 — le grand compte paie la totalité à 45 jours', () => {
  const resultat = conditionsPaiement(grandCompte, 2000);
  assert.strictEqual(resultat.solde, 2000);
  assert.strictEqual(resultat.delaiSoldeJours, 45);
});

// À 30 %, ces totaux donnent respectivement 300,012 €, 300,015 €
// et 300,018 € avant arrondi : avant, sur et après le demi-centime.
for (const [total, acompte, solde] of [
  [1000.04, 300.01, 700.03],
  [1000.05, 300.02, 700.03],
  [1000.06, 300.02, 700.04],
]) {
  test(`§ 5 — arrondit l’acompte à ${acompte} € et conserve le total de ${total} €`, () => {
    const resultat = conditionsPaiement(clientStandard, total);
    assert.strictEqual(resultat.acompte, acompte);
    assert.strictEqual(resultat.solde, solde);
    assert.strictEqual(resultat.acompte + resultat.solde, total);
  });
}
