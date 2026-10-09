# CI : qualité et secrets

Atelier 06-01 préparé et vérifié localement le 9 octobre 2026, puis migré vers `chenyang-pixel/formation`, branche `ci-pipeline`. Le dépôt personnel a été créé depuis le modèle avec un nouveau commit initial `68f2d4e876e08ebdd1c08a8ee83844175cd89b5f`. Les validations GitHub Actions et les liens de preuve seront ajoutés après exécution.

## Fonctionnement

`.github/workflows/ci.yml` se déclenche sur les pull requests et les push sur `main`, avec `contents: read`. Les jobs `qualite` et `secrets` sont indépendants, sur `ubuntu-latest`, avec une limite de 10 minutes chacun.

- `qualite` : checkout, Node 24 avec cache npm, `npm ci`, lint sans avertissement, tests, puis couverture de `src/devis/**` avec au moins 80 % des lignes et des branches.
- `secrets` : checkout avec tout l'historique, installation de Gitleaks 8.30.1 depuis son archive officielle Linux x64 après vérification SHA-256, puis analyse de l'historique accessible depuis `HEAD`. Les valeurs détectées sont masquées avec `--redact`.

Un échec de commande fait échouer son job. Aucune étape ne masque le code de sortie avec `continue-on-error` ou `|| true`. Les identifiants de checkout ne sont pas conservés dans la configuration Git.

La couverture précharge `src/devis/calcul.js` avec `--require` : sans cela, des tests qui n'importent jamais le calcul peuvent donner un rapport vide affichant 100 %. Le seuil doit réellement mesurer le module de calcul.

Le scan utilise `--log-opts="--full-history -m HEAD"`. C'est une correction ciblée de la commande `--log-opts="HEAD"` donnée dans la fiche : celle-ci ne montre pas les diff des commits de fusion et a laissé passer un secret ajouté uniquement pendant une fusion dans notre essai isolé. `-m` inclut les diff par parent, toujours sans analyser les branches non accessibles depuis `HEAD`.

## Préparation nécessaire dans ce dépôt

1. `package-lock.json` était déjà suivi et compatible avec `package.json` ; il est conservé sans modification.
2. Le lint initial échouait sur 33 avertissements de `src/legacy/export-commandes.js`. La version déjà réalisée dans la branche locale `refacto-export` a été reprise, sans modifier ESLint. Les 5 tests de caractérisation et 31 comparaisons octet par octet avec l'ancien export passent : 10 jeux SQLite variés, filtres de dates et base vide.
3. `test/devis/calcul.test.js` était vide. Il contient désormais 30 tests effectifs, sans modifier les formules métier.
4. Le premier scan de `HEAD` dans le dépôt personnel ne trouve aucune fuite : son modèle contient déjà la configuration corrigée. `.gitleaksignore` ne contient donc aucune empreinte. L’exception de l’ancien dépôt local n’a pas été copiée : un nouvel historique exige une nouvelle vérification.

Le dossier de livraison contient les fichiers du projet et les exercices locaux terminés nécessaires au pipeline. Les anciennes branches et le dépôt Python indépendant `audit-sync-tarifs/` sont conservés dans l’ancien dossier, sans être poussés dans ce dépôt.

## Vérifications locales

Environnement : macOS arm64, Node **24.21.0** téléchargé depuis nodejs.org et vérifié avec sa somme SHA-256, Gitleaks **8.30.1**. Le Node système reste inchangé.

| Contrôle exécuté | Résultat |
| --- | --- |
| `npm ci` sous Node 24, cache temporaire | Installation réussie depuis le lockfile ; le script `prepare` active le hook existant. |
| `npm run lint -- --max-warnings=0` | 0 erreur, 0 avertissement. |
| `npm test` | 38 résultats réussis : 35 scénarios effectifs et 3 fichiers encore vides ; 0 échec. |
| Commande de couverture du workflow | `src/devis/calcul.js` : lignes **100 %**, branches **100 %**, fonctions **100 %**. |
| Gitleaks sur l'historique de `HEAD`, sans exception | 0 fuite non déclarée. |
| `gitleaks dir src --redact --no-banner` | 0 fuite dans les sources actuelles. |
| actionlint 1.7.12 | Workflow accepté ; intégration ShellCheck désactivée car outil absent. |
| `bash -n` sur chaque bloc `run` | Syntaxe shell valide. |
| Archive Linux de Gitleaks du workflow | URL accessible, SHA-256 conforme et exécutable présent dans l'archive ; pas d'exécution Linux sur ce poste macOS. |
| `git diff --check` | Aucun défaut d'espacement. |

Les pièges ont été exécutés dans des copies temporaires, avec des commits de simulation uniquement dans un dépôt Git jetable ; aucun dans le projet. Résultats observés :

| Piège isolé | Résultat |
| --- | --- |
| 100 vis à 10 €, assertion volontaire `totalHT === 881` | `npm test` échoue avec `880 !== 881`, code 1 ; suppression du piège : code 0. |
| Une seule déclaration `var` dans du JavaScript valide | Lint échoue sur un avertissement, code 1 ; suppression : code 0. |
| Suppression des tests de devis | Les autres tests passent, mais couverture des lignes à **18,75 %**, code 1 ; restauration : 100 % et code 0. |
| Un seul scénario de devis, couverture de branches insuffisante | Les 8 résultats de tests passent, lignes **93,75 %**, branches **77,78 %** ; code 1 à cause du seuil des branches. Restauration : 100 % et code 0. |
| Faux secret commité avec `--no-verify` | Détection `generic-api-key` dans `piege.js`, code 1 ; rapport et sortie masqués. Le même fichier laisse lint, tests et couverture verts dans la copie du projet. |
| Suppression du fichier du secret dans un commit suivant | Le scan de l'historique échoue encore, code 1. |
| Retour de la branche temporaire à son historique propre | Scan réussi, code 0. |
| Faux secret présent seulement dans un commit de fusion | Commande de la fiche : code 0, fuite manquée. Commande corrigée : code 1, fuite détectée. |

Les scénarios secrets ont été revérifiés avec la commande finale incluant `-m`. Le dépôt Git jetable et les fichiers pièges ont été supprimés après vérification. Ces preuves locales vérifient les commandes et leurs refus ; elles ne sont pas des exécutions GitHub Actions et ne fournissent pas les liens rouges du rendu demandé.

## Limites métier identifiées

La couverture mesure l'exécution du code, pas la conformité de toutes les règles. Deux écarts préexistants avec `docs/regles-remises.md` ont été constatés dans le code courant et reproduits :

- 10 unités à 10 € pour un client ordinaire : aucune remise, total HT avec port de 125 €, alors que la règle prévoit 5 % et 120 € HT.
- 100 unités à 10 € pour un grand compte : remise totale de 164 € (16,4 %), total HT de 836 €, alors que le plafond de 15 % implique 850 € HT.

Ils ne sont pas corrigés dans cet atelier CI. Les nouveaux tests n'affirment pas que ces résultats erronés sont corrects. Une CI verte ne valide donc pas à elle seule toutes les règles métier.

## Rendu GitHub restant

Le rendu prévu est une PR **en brouillon**, branche `ci-pipeline` vers `main`, titre **CI : pipeline qualité et secrets**. Il reste à publier les modifications utiles, exécuter les deux pièges sur cette PR, conserver leurs vrais liens rouges, puis vérifier les deux jobs verts après retrait des pièges. Aucun lien d'exécution distante n'a été fabriqué.

Pour le piège du secret, supprimer seulement le fichier ou faire un revert laisse le secret dans l'historique analysé. La fiche demande de retirer le commit du piège de la branche dédiée. Cette manipulation n'a pas été effectuée sur le projet. Avant toute publication, relire les fichiers à inclure : le dépôt indépendant `audit-sync-tarifs/` et les autres travaux locaux ne font pas partie de cette CI.

La configuration réelle des protections de branche et les droits du compte GitHub sont **UNKNOWN** pour le dépôt personnel de rendu. Sans règle imposant les contrôles réussis, un job rouge n'est pas à lui seul une interdiction technique de fusionner.

## Références vérifiées

- [actions/checkout v5](https://github.com/actions/checkout/tree/v5) et [actions/setup-node v5](https://github.com/actions/setup-node/tree/v5) : versions existantes, récupération du code et configuration de Node/cache.
- [Gitleaks 8.30.1](https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1) et [sommes SHA-256 officielles](https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_checksums.txt).
- [Documentation du test runner Node 24](https://nodejs.org/docs/latest-v24.x/api/test.html).
- [Commande Git exécutée par Gitleaks 8.30.1](https://github.com/gitleaks/gitleaks/blob/v8.30.1/sources/git.go) et [documentation de git log](https://git-scm.com/docs/git-log) : affichage explicite des diff de fusion.

Confiance haute sur les vérifications locales effectuées ; exécution sur un runner GitHub et preuve des deux jobs rouges puis verts non réalisées.
