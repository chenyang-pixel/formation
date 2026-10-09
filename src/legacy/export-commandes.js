// Export comptable des commandes, lancé chaque nuit par le cabinet comptable.
// Ne pas toucher : ça marche. (JM, 2021)
'use strict';

const TVA = 0.2;
const ENTETE = 'numero;date;client;ville;nb_lignes;total_ht;total_ttc\n';

function formaterMontant(montant) {
  const texte = String(montant);
  if (texte.indexOf('.') === -1) {
    return texte + ',00';
  }
  const parties = texte.split('.');
  if (parties[1].length === 1) {
    parties[1] = parties[1] + '0';
  }
  return parties[0] + ',' + parties[1];
}

function requete(db, sql, params, cb) {
  setImmediate(function () {
    let resultat;
    try {
      const stmt = db.prepare(sql);
      resultat = stmt.all.apply(stmt, params);
    } catch (e) {
      cb(e);
      return;
    }
    cb(null, resultat);
  });
}

function chargerDonnees(db, depuis, callback) {
  requete(db, 'SELECT * FROM commandes WHERE date >= ? ORDER BY date, id', [depuis], function (err, commandes) {
    if (err) {
      callback(err);
      return;
    }
    requete(db, 'SELECT * FROM lignes_commande', [], function (err2, lignes) {
      if (err2) {
        callback(err2);
        return;
      }
      requete(db, 'SELECT * FROM clients', [], function (err3, clients) {
        if (err3) {
          callback(err3);
          return;
        }
        callback(null, { commandes, lignes, clients });
      });
    });
  });
}

function totaliserLignes(lignes) {
  const totauxParCommande = new Map();
  // Garder l'ordre de lecture : une autre addition peut modifier l'arrondi flottant.
  for (const ligne of lignes) {
    let total = totauxParCommande.get(ligne.commande_id);
    if (!total) {
      total = { nombre: 0, montant: 0 };
      totauxParCommande.set(ligne.commande_id, total);
    }
    total.nombre += 1;
    total.montant += ligne.quantite * ligne.prix_unitaire;
  }
  return totauxParCommande;
}

function construireLigneCsv(commande, client, total) {
  const ht = Math.round(total.montant * 100) / 100;
  // Le TTC historique se calcule sur le total non arrondi, pas sur le HT affiché.
  const ttc = Math.round(total.montant * (1 + TVA) * 100) / 100;
  const nom = (client ? client.nom : 'INCONNU').replace(/;/g, ',');
  const ville = (client ? client.ville : '').replace(/;/g, ',');
  return `${commande.id};${commande.date};${nom};${ville};${total.nombre};${formaterMontant(ht)};${formaterMontant(ttc)}\n`;
}

function construireCsv({ commandes, lignes, clients }) {
  const clientsParId = new Map(clients.map((client) => [client.id, client]));
  const totauxParCommande = totaliserLignes(lignes);
  const actifs = new Set();
  const morceaux = [ENTETE];
  for (const commande of commandes) {
    if (commande.statut === 'annulee') continue;
    const total = totauxParCommande.get(commande.id) || { nombre: 0, montant: 0 };
    morceaux.push(construireLigneCsv(commande, clientsParId.get(commande.client_id), total));
    actifs.add(commande.client_id);
  }
  morceaux.push(`# clients actifs;${actifs.size}\n`);
  return morceaux.join('');
}

function exporterCommandes(db, depuis, callback) {
  chargerDonnees(db, depuis, (err, donnees) => {
    if (err) return callback(err);
    callback(null, construireCsv(donnees));
  });
}

module.exports = { exporterCommandes };
