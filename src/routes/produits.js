'use strict';

const express = require('express');

function normaliserTexte(texte) {
  return texte.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

module.exports = function routesProduits(db) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const { categorie, q } = req.query;
    const produits = categorie
      ? db.prepare('SELECT * FROM produits WHERE categorie = ? ORDER BY reference').all(categorie)
      : db.prepare('SELECT * FROM produits ORDER BY reference').all();
    const recherche = typeof q === 'string' ? normaliserTexte(q) : '';
    res.json(recherche
      ? produits.filter((produit) => normaliserTexte(produit.libelle).includes(recherche))
      : produits);
  });

  router.get('/:reference', (req, res) => {
    const produit = db.prepare('SELECT * FROM produits WHERE reference = ?').get(req.params.reference);
    if (!produit) return res.status(404).json({ erreur: 'Produit introuvable' });
    res.json(produit);
  });

  return router;
};
