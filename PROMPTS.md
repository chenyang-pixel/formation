# Journal des prompts

Une entrée par demande significative faite à Copilot pendant les exercices : ce que vous avez demandé, ce que l’assistant a produit, ce que vous en avez fait.

| Exercice | Prompt envoyé (ou résumé fidèle) | Ce que Copilot a produit | Ce que j’ai gardé, corrigé ou refusé, et pourquoi |
|---|---|---|---|
| exemple | « Écris formaterDate(date) qui renvoie une date au format JJ/MM/AAAA, avec node:test pour une date valide et une date absente » | La fonction et deux tests | Gardé la fonction. Refusé le test de la date absente, qui attendait une chaîne vide : notre convention est de lever une erreur |
| Agent testeur (07-02, Codex) | « Écris les tests node:test de conditionsPaiement (src/paiement/conditions.js) dans exercices/agents/par-defaut.js. » Puis la même demande avec testeur.js. | Par défaut : 20 tests, 20 réussis, 0 échec. Testeur : 21 tests, 18 réussis, 3 échecs ; les noms citent les § 1 à § 5. | Gardé les deux fichiers sans corriger src/ ni la spécification. Les trois tests rouges révèlent deux défauts : seuil de 1 000 € exclu (acompte 0 au lieu de 300 €, solde 1 000 au lieu de 700 €) et délai grand compte de 30 au lieu de 45 jours. La méthode du testeur impose la spécification comme source. Deux sessions CLI indépendantes : session par défaut, puis instructions et sandbox chargés depuis testeur.toml ; la sélection native du rôle par son nom reste non vérifiée dans cette interface. |
