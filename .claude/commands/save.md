C'est la fin de ta session ou tu approches de ta limite de contexte.
Tu DOIS exécuter ce protocole COMPLET avant de t'arrêter. C'est NON NÉGOCIABLE.

## ÉTAPE 1 — Mettre à jour CLAUDE.md
Ouvre `CLAUDE.md` à la racine et modifie la section `📍 ÉTAT ACTUEL` :

1. **Date** : Met à jour "DERNIÈRE MISE À JOUR" avec la date/heure actuelle
2. **Tâches terminées** : Déplace les tâches finies dans `✅ TERMINÉ` avec détail
3. **Tâche en cours** : Si tu n'as pas fini, marque-la `⏳ EN COURS` avec le contexte EXACT :
   - Quel fichier tu étais en train d'éditer
   - Quelle ligne / quelle fonction
   - Ce qui reste à faire sur cette tâche spécifique
   - Les erreurs rencontrées
4. **Nouvelles tâches** : Ajoute toute nouvelle `⬜ TODO` découverte pendant la session
5. **Pièges** : Ajoute tout nouveau piège dans la section `PIÈGES CONNUS`

## ÉTAPE 2 — Journal de bord
Ajoute une entrée dans `📔 JOURNAL DE BORD` :
```
### YYYY-MM-DD HH:MM — Session N (Titre court)
- Point 1 réalisé
- Point 2 réalisé
- ⏳ Point 3 en cours (détail)
```

## ÉTAPE 3 — Vérification
Lance `npx tsc --noEmit` dans `mobile/` pour vérifier que tu n'as pas cassé la compilation.

## ÉTAPE 4 — Confirmation
Dis à l'utilisateur :
```
✅ Mémoire sauvegardée.
📍 Prochaine tâche : [nom de la tâche suivante]
💡 Dis "continue" dans une nouvelle session pour reprendre exactement ici.
```
