# Journal des prompts

Une entrée par demande significative faite à Copilot pendant les exercices : ce que vous avez demandé, ce que l’assistant a produit, ce que vous en avez fait.

| Exercice | Prompt envoyé (ou résumé fidèle) | Ce que Copilot a produit | Ce que j’ai gardé, corrigé ou refusé, et pourquoi |
|---|---|---|---|
| exemple | « Écris formaterDate(date) qui renvoie une date au format JJ/MM/AAAA, avec node:test pour une date valide et une date absente » | La fonction et deux tests | Gardé la fonction. Refusé le test de la date absente, qui attendait une chaîne vide : notre convention est de lever une erreur |
| Plan relu (08-01, Codex) | « Propose un plan pour ajouter une recherche de produits au catalogue. » Sans ticket ; correction du plan après relecture, puis « Exécute le plan ». | Plan initial : recherche sur reference et libelle, casse et accents à décider. Grille forme/règle/combinaison/fichiers/dépendances : oui/non/oui/oui/oui. Plan révisé conforme aux cinq points avant écriture. Départ : 7 cas faux sur 9 ; arrivée : 9/9 justes. npm test : 19 entrées réussies, dont 10 nouveaux tests HTTP et 4 fichiers encore vides ; fail 0. ESLint ciblé conforme. | Corrigé le périmètre vers libelle uniquement et imposé la recherche insensible à la casse et aux accents ainsi que HTTP 200 et [] sans résultat. Gardé le filtre exact de catégorie, le tri et les objets complets. Aucun fichier protégé ni dépendance modifié. Processus adapté avec un agent en lecture seule pour le plan, puis autorisation d’exécution ; gestes de l’application et compteur /usage non mesurés. |
