'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  arrondir,
  tauxRemiseQuantite,
  calculerLigne,
  calculerDevis,
} = require('../../src/devis/calcul');

const CLIENT_STANDARD = { grand_compte: false };
const GRAND_COMPTE = { grand_compte: true };
const PRODUIT = { reference: 'VIS-INOX', prix_ht: 10 };

// La couverture ne prouve pas la conformité de toutes les règles métier.
// Les écarts connus à 10 unités et au plafond de 15 % restent à corriger.

for (const [quantite, taux] of [
  [1, 0], [9, 0], [11, 0.05], [49, 0.05],
  [50, 0.08], [99, 0.08], [100, 0.12], [101, 0.12],
]) {
  test(`la remise sur quantité vaut ${taux * 100} % pour ${quantite} unités`, () => {
    assert.equal(tauxRemiseQuantite(quantite), taux);
  });
}

test('100 unités à 10 € donnent 880 € HT pour un client standard', () => {
  assert.deepEqual(calculerDevis(CLIENT_STANDARD, [{ produit: PRODUIT, quantite: 100 }]), {
    lignes: [{
      reference: 'VIS-INOX', quantite: 100, prixUnitaire: 10,
      brut: 1000, remise: 120, net: 880,
    }],
    totalBrut: 1000,
    remiseClient: 0,
    port: 0,
    totalHT: 880,
    tva: 176,
    totalTTC: 1056,
  });
});

test('une ligne conserve sa référence et arrondit séparément ses montants', () => {
  assert.deepEqual(calculerLigne({ reference: 'BOITE', prix_ht: 18.99 }, 11), {
    reference: 'BOITE', quantite: 11, prixUnitaire: 18.99,
    brut: 208.89, remise: 10.44, net: 198.45,
  });
});

for (const quantite of [0, -1, 1.5, '2', null, undefined, NaN, Infinity]) {
  test(`la quantité invalide ${String(quantite)} est refusée`, () => {
    assert.throws(() => calculerLigne(PRODUIT, quantite), /Quantité invalide/);
    assert.throws(
      () => calculerDevis(CLIENT_STANDARD, [{ produit: PRODUIT, quantite }]),
      /Quantité invalide/,
    );
  });
}

for (const lignes of [[], null, undefined, {}, 'aucune ligne']) {
  test(`les lignes invalides ${JSON.stringify(lignes)} sont refusées`, () => {
    assert.throws(
      () => calculerDevis(CLIENT_STANDARD, lignes),
      /Un devis contient au moins une ligne/,
    );
  });
}

test('la remise grand compte de 5 % se calcule après la remise sur quantité', () => {
  const devis = calculerDevis(GRAND_COMPTE, [{ produit: PRODUIT, quantite: 50 }]);
  assert.equal(devis.totalBrut, 500);
  assert.equal(devis.lignes[0].remise, 40);
  assert.equal(devis.lignes[0].net, 460);
  assert.equal(devis.remiseClient, 23);
  assert.equal(devis.port, 25);
  assert.equal(devis.totalHT, 462);
  assert.equal(devis.tva, 92.4);
  assert.equal(devis.totalTTC, 554.4);
});

test('le port est gratuit dès 500 € remisés, seuil inclus', () => {
  const devis = calculerDevis(CLIENT_STANDARD, [{
    produit: { reference: 'LOT', prix_ht: 500 }, quantite: 1,
  }]);
  assert.equal(devis.port, 0);
  assert.equal(devis.totalHT, 500);
  assert.equal(devis.tva, 100);
  assert.equal(devis.totalTTC, 600);
});

test('le port reste payant à 499,99 € remisés et entre dans la base de TVA', () => {
  const devis = calculerDevis(CLIENT_STANDARD, [{
    produit: { reference: 'LOT', prix_ht: 499.99 }, quantite: 1,
  }]);
  assert.equal(devis.port, 25);
  assert.equal(devis.totalHT, 524.99);
  assert.equal(devis.tva, 105);
  assert.equal(devis.totalTTC, 629.99);
});

test('le seuil de port gratuit est évalué après la remise grand compte', () => {
  const devis = calculerDevis(GRAND_COMPTE, [{
    produit: { reference: 'LOT', prix_ht: 500 }, quantite: 1,
  }]);
  assert.equal(devis.totalBrut, 500);
  assert.equal(devis.remiseClient, 25);
  assert.equal(devis.port, 25);
  assert.equal(devis.totalHT, 500);
});

test('un devis additionne les lignes en conservant leurs remises propres', () => {
  const devis = calculerDevis(CLIENT_STANDARD, [
    { produit: PRODUIT, quantite: 2 },
    { produit: { reference: 'ECROU', prix_ht: 20 }, quantite: 50 },
  ]);
  assert.equal(devis.lignes.length, 2);
  assert.equal(devis.lignes[0].remise, 0);
  assert.equal(devis.lignes[1].remise, 80);
  assert.equal(devis.totalBrut, 1020);
  assert.equal(devis.totalHT, 940);
  assert.equal(devis.tva, 188);
  assert.equal(devis.totalTTC, 1128);
});

test('la TVA part du HT arrondi et le TTC additionne les montants arrondis', () => {
  const devis = calculerDevis(GRAND_COMPTE, [{
    produit: { reference: 'UNITE', prix_ht: 12.35 }, quantite: 1,
  }]);
  assert.equal(devis.remiseClient, 0.62);
  assert.equal(devis.totalHT, 36.73);
  assert.equal(devis.tva, 7.35);
  assert.equal(devis.totalTTC, 44.08);
});

test('arrondir conserve les centimes et choisit le centime le plus proche', () => {
  assert.equal(arrondir(0), 0);
  assert.equal(arrondir(12.34), 12.34);
  assert.equal(arrondir(1.234), 1.23);
  assert.equal(arrondir(1.236), 1.24);
});

// Piège 1 : test volontairement faux, retiré après la preuve CI.
{
  const { test } = require('node:test');
  const assert = require('node:assert/strict');
  const { calculerDevis } = require('../../src/devis/calcul');
  test('piège 1 : 100 vis à 10 € pour un client ordinaire', () => {
    const vis = { reference: 'VIS', prix_ht: 10 };
    const devis = calculerDevis({ grand_compte: 0 }, [{ produit: vis, quantite: 100 }]);
    assert.equal(devis.totalHT, 881);
  });
}
