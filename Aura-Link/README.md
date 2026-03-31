# ⚡ Aura Link — Ultimate AI Bridge

**Aura Link** est un outil puissant conçu pour transformer votre flux de travail avec les IA de codage (Claude, ChatGPT, Arena.ai). Il crée un pont direct entre votre système de fichiers local et l'interface de chat de l'IA, permettant une injection de contexte ultra-rapide et une sauvegarde directe du code généré.

## ✨ Fonctionnalités

### 1. Explorateur de Fichiers Intelligent (V2)
- Visualisez toute l'arborescence de votre projet directement dans Claude.
- Recherche instantanée par nom de fichier.
- Expansion/Réduction des dossiers.

### 2. Injection Multi-Fichiers
- Sélectionnez plusieurs fichiers via des cases à cocher.
- Injectez tout le code sélectionné dans le chat en un seul clic.
- Le code est automatiquement formaté avec des balises Markdown de bloc de code.

### 3. Sauvegarde Directe au Projet
- Un bouton "💾 SAVE" est ajouté à chaque bloc de code généré par l'IA.
- Sauvegardez instantanément le code dans le fichier de votre choix sans copier-coller manuel.

### 4. Interface Glassmorphism Premium
- Design moderne, sombre et épuré avec effets de flou de fond.
- Bouton flottant (FAB) pour un accès rapide.
- Raccourci clavier : `Ctrl + Shift + I` pour ouvrir l'injecteur.

## 🚀 Installation

### 1. Le Serveur Local (Backend)
Le serveur fait le lien entre votre navigateur et vos fichiers.

1. Allez dans le dossier `server/`.
2. Installez les dépendances :
   ```bash
   npm install
   ```
3. Lancez le serveur :
   ```bash
   node index.js
   ```
   *Le serveur écoute sur le port 3666.*

### 2. L'Extension Chrome (Frontend)
1. Ouvrez Chrome et allez sur `chrome://extensions/`.
2. Activez le **"Mode développeur"** (en haut à droite).
3. Cliquez sur **"Charger l'extension non empaquetée"**.
4. Sélectionnez le dossier `extension/` de ce projet.

## 🛠️ Utilisation

1. Assurez-vous que le serveur est lancé.
2. Allez sur une interface IA (ex: [claude.ai](https://claude.ai)).
3. Utilisez le bouton flottant **⚡ INJECT** en bas à droite ou faites `Ctrl + Shift + I`.
4. Sélectionnez vos fichiers et cliquez sur **Inject Selected**.
5. Pour sauvegarder une réponse de l'IA, utilisez le bouton **💾 SAVE** qui apparaît sur les blocs de code.

## 🔒 Sécurité
- Le serveur est restreint à l'exécution locale (`localhost`).
- Une liste d'exclusion (Ignore List) empêche l'IA d'accéder aux dossiers sensibles comme `.git`, `node_modules`, `.env`, etc.
- Whitelist de commandes sécurisées pour l'exécution terminal.

---
Créé avec ❤️ par la team Aura.
