'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { conditionsPaiement } = require('../../src/paiement/conditions');

test('un client standard ne verse aucun acompte sous le seuil', () => {
  assert.deepStrictEqual(conditionsPaiement({ grand_compte: false }, 500), {
    acompte: 0,
    solde: 500,
    delaiSoldeJours: 30,
  });
});

test('le seuil de 1 000 euros ne déclenche pas un acompte', () => {
  assert.deepStrictEqual(conditionsPaiement({ grand_compte: false }, 1000), {
    acompte: 0,
    solde: 1000,
    delaiSoldeJours: 30,
  });
});

test('un centime au-dessus du seuil déclenche un acompte de 30 %', () => {
  assert.deepStrictEqual(conditionsPaiement({ grand_compte: false }, 1000.01), {
    acompte: 300,
    solde: 700.01,
    delaiSoldeJours: 30,
  });
});

test('un client standard verse 30 % pour un total supérieur au seuil', () => {
  assert.deepStrictEqual(conditionsPaiement({ grand_compte: false }, 2000), {
    acompte: 600,
    solde: 1400,
    delaiSoldeJours: 30,
  });
});

test('un grand compte ne verse aucun acompte, même au-dessus du seuil', () => {
  for (const total of [500, 1000, 2000]) {
    assert.deepStrictEqual(conditionsPaiement({ grand_compte: true }, total), {
      acompte: 0,
      solde: total,
      delaiSoldeJours: 30,
    });
  }
});

test('un client sans indicateur grand_compte est traité comme un client standard', () => {
  assert.deepStrictEqual(conditionsPaiement({}, 2000), {
    acompte: 600,
    solde: 1400,
    delaiSoldeJours: 30,
  });
});

test('l’acompte et le solde sont arrondis au centime', () => {
  assert.deepStrictEqual(conditionsPaiement({ grand_compte: false }, 1234.56), {
    acompte: 370.37,
    solde: 864.19,
    delaiSoldeJours: 30,
  });
});

test('le solde sans acompte est également arrondi au centime', () => {
  assert.deepStrictEqual(conditionsPaiement({ grand_compte: false }, 12.346), {
    acompte: 0,
    solde: 12.35,
    delaiSoldeJours: 30,
  });
});

test('un petit total positif est accepté', () => {
  assert.deepStrictEqual(conditionsPaiement({ grand_compte: false }, 0.01), {
    acompte: 0,
    solde: 0.01,
    delaiSoldeJours: 30,
  });
});

for (const total of [0, -1, NaN, -Infinity, '1000', '', null, undefined, true, {}, []]) {
  test(`rejette un total TTC invalide : ${String(total)} (${typeof total})`, () => {
    assert.throws(() => conditionsPaiement({ grand_compte: false }, total), {
      name: 'Error',
      message: 'Total TTC invalide',
    });
  });
}
