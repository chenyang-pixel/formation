# CI : qualité et secrets

Atelier 06-01 préparé et vérifié localement le 9 octobre 2026, puis migré vers `chenyang-pixel/formation`, branche `ci-pipeline`. Le dépôt personnel a été créé depuis le modèle avec un nouveau commit initial `68f2d4e876e08ebdd1c08a8ee83844175cd89b5f`. Le rendu est la [PR en brouillon n° 1](https://github.com/chenyang-pixel/formation/pull/1). Les deux échecs volontaires ont été observés sur GitHub Actions et leurs liens sont conservés ci-dessous et dans la description de la PR.

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

## Rendu GitHub et preuves distantes

PR **en brouillon** : [CI : pipeline qualité et secrets](https://github.com/chenyang-pixel/formation/pull/1), branche `ci-pipeline` vers `main` de `chenyang-pixel/formation`. Le premier commit de `main` est conservé ; la PR n'a pas été fusionnée.

| Étape réelle | Exécution ou job | Résultat observé |
| --- | --- | --- |
| Installation du pipeline | [Run 37927271370](https://github.com/chenyang-pixel/formation/actions/runs/37927271370) | `qualite` et `secrets` verts. Node 24.21.0, 38 résultats de tests réussis, couverture du calcul 100 % lignes/branches. |
| Piège 1 : assertion 881 au lieu de 880 | [Job qualite rouge](https://github.com/chenyang-pixel/formation/actions/runs/37927405576/job/113809542384) | Échec à `npm test` avec `880 !== 881` ; `secrets` reste vert. |
| Revert du piège 1 | [Run 37927508887](https://github.com/chenyang-pixel/formation/actions/runs/37927508887) | Deux jobs de nouveau verts. |
| Piège 2 : jeton fictif commité avec `--no-verify` | [Job secrets rouge](https://github.com/chenyang-pixel/formation/actions/runs/37927596163/job/113810171516) | `piege.js:1`, `generic-api-key`, valeur masquée ; code de sortie 1. |
| Qualité pendant le piège 2 | [Job qualite vert](https://github.com/chenyang-pixel/formation/actions/runs/37927596163/job/113810171727) | 38 résultats réussis, couverture du calcul 100 % lignes/branches/fonctions. |

Le second piège produit **2 positions détectées pour un seul jeton fictif** : son commit `baddddfac3ff79ab65ed49bcf18b8edb07e2906d` et le merge de test créé par GitHub. C'est l'effet du scan explicite des commits de fusion ; ce ne sont pas deux secrets distincts.

Après sauvegarde du lien rouge, le commit du secret a été retiré de la branche de PR, puis le rapport ajouté à partir du commit propre `0709c565a52ccba0aa7a7ddd52db6f0725e029e9`. La mise à jour distante utilise un `--force-with-lease` limité à `ci-pipeline`, avec l'identifiant exact attendu du commit du piège. Le fichier `piege.js` est absent de l'état final. Le dernier passage et son lien sont renseignés dans la description de la PR après vérification des deux jobs sur le commit final.

Le dépôt est **public**. Lecture de l'API GitHub lors du rendu : `main` a `protected: false` et aucun ruleset n'est actif. Les jobs signalent les échecs ; aucune règle de branche n'impose leur réussite avant fusion. Aucun réglage de visibilité, de collaboration ou de protection n'a été modifié.

Le dossier de travail pour ce rendu est `formation-github`, à côté de l'ancien `df-commandes`. Ce dernier reste utile : il conserve les branches des exercices précédents et le dépôt Python indépendant. Il n'a donc pas été supprimé.

## Références vérifiées

- [actions/checkout v5](https://github.com/actions/checkout/tree/v5) et [actions/setup-node v5](https://github.com/actions/setup-node/tree/v5) : versions existantes, récupération du code et configuration de Node/cache.
- [Gitleaks 8.30.1](https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1) et [sommes SHA-256 officielles](https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_checksums.txt).
- [Documentation du test runner Node 24](https://nodejs.org/docs/latest-v24.x/api/test.html).
- [Commande Git exécutée par Gitleaks 8.30.1](https://github.com/gitleaks/gitleaks/blob/v8.30.1/sources/git.go) et [documentation de git log](https://git-scm.com/docs/git-log) : affichage explicite des diff de fusion.

Confiance haute : commandes locales, jobs distants et journaux des deux pièges vérifiés. Le résultat ne constitue pas une validation de toutes les règles métier signalées plus haut.
