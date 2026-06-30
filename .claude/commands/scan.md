Lance un scan complet du projet avant de commencer à travailler.

## Action
Exécute ce script PowerShell :
```powershell
powershell -ExecutionPolicy Bypass -File "c:\Users\HP\Desktop\RETOUR GAGNANT TEMPLATE\.claude\scripts\prepare_session.ps1"
```

## Ce que ça vérifie
1. **Git** — Fichiers modifiés non commités
2. **TypeScript** — Erreurs de compilation mobile
3. **Mémoire** — Progression des tâches dans CLAUDE.md
4. **Expo** — Config deep links
5. **URLs** — Vérification des domaines

## Après le scan
Lis le résultat et si tout est OK, enchaîne directement sur la première tâche ⬜ du CLAUDE.md.
Si des erreurs sont détectées, corrige-les AVANT de passer aux nouvelles tâches.
