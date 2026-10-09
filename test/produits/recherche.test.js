'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { creerApp } = require('../../src/app');
const { ouvrirBase } = require('../../src/db');

const PRODUITS = [
  { id: 1, reference: 'Z-CABLE', libelle: 'Câble électrique 25 m', categorie: 'électricité', prix_ht: 89 },
  { id: 2, reference: 'A-PLATRE', libelle: 'Plaque de plâtre BA13', categorie: 'plâtrerie', prix_ht: 9.8 },
  { id: 3, reference: 'C-CABLE', libelle: 'Câble acier 5 m', categorie: 'quincaillerie', prix_ht: 18.9 },
  { id: 4, reference: 'B-BOIS', libelle: 'Panneau bois', categorie: 'quincaillerie', prix_ht: 21.4 },
  { id: 5, reference: 'CABLE-REF', libelle: 'Tube PER 16 mm', categorie: 'plomberie', prix_ht: 56.9 },
];
const CATALOGUE_TRIE = [PRODUITS[1], PRODUITS[3], PRODUITS[2], PRODUITS[4], PRODUITS[0]];
const CABLES = [PRODUITS[2], PRODUITS[0]];

async function ouvrirCatalogue(t) {
  const db = ouvrirBase();
  const insertion = db.prepare(
    'INSERT INTO produits (id, reference, libelle, categorie, prix_ht) VALUES (?, ?, ?, ?, ?)');
  for (const produit of PRODUITS) {
    insertion.run(produit.id, produit.reference, produit.libelle, produit.categorie, produit.prix_ht);
  }

  const serveur = creerApp(db).listen(0, '127.0.0.1');
  t.after(async () => {
    try {
      await new Promise((resolve, reject) => {
        serveur.close((erreur) => (erreur ? reject(erreur) : resolve()));
      });
    } finally {
      db.close();
    }
  });
  await once(serveur, 'listening');
  return `http://127.0.0.1:${serveur.address().port}`;
}

async function lireProduits(adresse, parametres = {}) {
  const recherche = new URLSearchParams(parametres);
  const reponse = await fetch(`${adresse}/produits?${recherche}`);
  assert.equal(reponse.status, 200);
  return reponse.json();
}

test('sans q, la liste complète reste triée par référence', async (t) => {
  const adresse = await ouvrirCatalogue(t);
  assert.deepEqual(await lireProduits(adresse), CATALOGUE_TRIE);
});

test('q recherche une partie du libellé, sans rechercher dans la référence', async (t) => {
  const adresse = await ouvrirCatalogue(t);
  assert.deepEqual(await lireProduits(adresse, { q: 'abl' }), CABLES);
});

test('la recherche ignore la casse et normalise aussi le texte saisi', async (t) => {
  const adresse = await ouvrirCatalogue(t);
  assert.deepEqual(await lireProduits(adresse, { q: 'CÂBLE' }), CABLES);
});

test('cable trouve Câble et platre trouve plâtre', async (t) => {
  const adresse = await ouvrirCatalogue(t);
  assert.deepEqual(await lireProduits(adresse, { q: 'cable' }), CABLES);
  assert.deepEqual(await lireProduits(adresse, { q: 'platre' }), [PRODUITS[1]]);
});

test('aucun résultat renvoie HTTP 200 et un tableau vide', async (t) => {
  const adresse = await ouvrirCatalogue(t);
  assert.deepEqual(await lireProduits(adresse, { q: 'introuvable' }), []);
});

test('q se combine avec le filtre de catégorie', async (t) => {
  const adresse = await ouvrirCatalogue(t);
  assert.deepEqual(await lireProduits(adresse, { q: 'cable', categorie: 'quincaillerie' }), [PRODUITS[2]]);
});

test('le filtre de catégorie conserve sa correspondance exacte', async (t) => {
  const adresse = await ouvrirCatalogue(t);
  assert.deepEqual(await lireProduits(adresse, { categorie: 'électricité' }), [PRODUITS[0]]);
  assert.deepEqual(await lireProduits(adresse, { categorie: 'electricite' }), []);
  assert.deepEqual(await lireProduits(adresse, { q: 'cable', categorie: 'ÉLECTRICITÉ' }), []);
});

test('un q vide conserve la liste et le filtre de catégorie', async (t) => {
  const adresse = await ouvrirCatalogue(t);
  assert.deepEqual(await lireProduits(adresse, { q: '' }), CATALOGUE_TRIE);
  assert.deepEqual(await lireProduits(adresse, { q: '', categorie: 'quincaillerie' }), [PRODUITS[3], PRODUITS[2]]);
});

test('les caractères spéciaux restent du texte, sans joker ni injection SQL', async (t) => {
  const adresse = await ouvrirCatalogue(t);
  for (const q of ['%', '_', "' OR 1=1 --"]) {
    assert.deepEqual(await lireProduits(adresse, { q }), []);
  }
});

test('la consultation par référence reste exacte et conserve son erreur 404', async (t) => {
  const adresse = await ouvrirCatalogue(t);
  const reponse = await fetch(`${adresse}/produits/Z-CABLE`);
  assert.equal(reponse.status, 200);
  assert.deepEqual(await reponse.json(), PRODUITS[0]);

  const absente = await fetch(`${adresse}/produits/z-cable`);
  assert.equal(absente.status, 404);
  assert.deepEqual(await absente.json(), { erreur: 'Produit introuvable' });
});
