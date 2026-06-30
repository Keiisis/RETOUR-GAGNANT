Génère un rapport de statut ultra-complet du projet. Exécute ces 5 vérifications :

## 1. 📊 Progression (depuis CLAUDE.md)
Lis `CLAUDE.md` et compte :
- Nombre de tâches ✅ terminées
- Nombre de tâches ⬜ restantes
- Tâche en cours ⏳ s'il y en a
- Affiche une barre de progression : `[████████░░░░] 65%`

## 2. 🔧 Santé TypeScript
Exécute dans le terminal :
```powershell
cd "c:\Users\HP\Desktop\RETOUR GAGNANT TEMPLATE\mobile"
npx tsc --noEmit
```
Rapporte : ✅ 0 erreur OU ❌ N erreurs (avec les fichiers concernés)

## 3. 📁 Fichiers modifiés (Git)
Exécute :
```powershell
cd "c:\Users\HP\Desktop\RETOUR GAGNANT TEMPLATE"
git diff --stat HEAD
```
Rapporte le nombre de fichiers modifiés et non commités.

## 4. 📱 Vérification Expo
Vérifie que `mobile/app.json` a le bon scheme deep link et que `App.tsx` a le linking config.

## 5. 🎯 Prochaine action recommandée
Basé sur la liste ⬜ TODO, recommande la prochaine tâche avec son numéro de priorité.

## FORMAT DE SORTIE
Présente tout dans un tableau markdown clair et professionnel.
