# 👑 MANIFESTE : Espace Client "Royaume Digital"

Ce document détaille la vision conceptuelle, fonctionnelle et technique pour l'Espace Client "Retour Gagnant".
**Objectif :** Créer une expérience utilisateur qui ne ressemble pas à une administration, mais à une **immersion culturelle de luxe**.

---

## 1. 🔍 Audit & Fonctionnalités Clés

Basé sur la mission de "Retour Gagnant" (Accompagnement, Investissement, Tourisme, Héritage), voici les modules fonctionnels transformés en concepts culturels.

### A. Le "Fil d'Ariane Royal" (Suivi de Projet) 🛤️
*   **Fonctionnalité :** Timeline interactive pour suivre l'avancement des dossiers (Visa, Achat Terrain, Construction, Création Entreprise).
*   **Concept 3D :** Une **Route de terre rouge** qui serpente à travers un paysage 3D. Chaque étape (Validation, Paiement, Livraison) est une "Escescale" (ex: Une case Tata Somba qui se construit petit à petit).
*   **Data :** État du dossier, Prochaines étapes, Bloquants.

### B. Le "Grenier Sécurisé" (Documents & Finances) 🏺
*   **Fonctionnalité :** Gestion des factures, contrats, scans de passeport.
*   **Concept 3D :** Une **Jarre de Sécurité (Canari)** ou un **Coffre sculpté**. L'utilisateur "ouvre" le coffre en 3D pour voir ses documents flotter comme des parchemins précieux.
*   **Data :** PDFs, Images, Reçus de paiement ($CFA/€).

### C. Le "Griot Connecté" (Messagerie & Conciergerie) 🗣️
*   **Fonctionnalité :** Chat direct avec l'équipe, demande d'assistance VIP, Notifications.
*   **Concept 3D :** Un **Tam-tam parlant (Gangan)** ou un **Masque Gueledè**. Quand une notif arrive, l'objet s'anime (vibre ou s'illumine). Clic pour ouvrir la conversation (style WhatsApp mais intégré).

### D. La "Boussole des Origines" (Tourisme & Découverte) 🧭
*   **Fonctionnalité :** Agenda des visites, Carte interactive, Favoris "Patrimoine".
*   **Concept 3D :** Une **Récade (Sceptre Royal)** qui pointe vers les lieux à visiter sur une carte du Bénin stylisée en relief.
*   **Data :** Dates de RDV, Liens vers les pages Culture, Billetterie QR Code.

---

## 2. 🎨 Direction Artistique & UX "Ultra Immersive"

L'interface fuit le "Flat Design" occidental pour embrasser le **Neo-Africanism**.

*   **Palette de Couleurs :**
    *   Fond : Bleu Nuit Profond (`#05080a`) ou Ébène.
    *   Accents : Or Akan (`#FCD116`), Vert Forêt Sacrée (`#008751`), Terre Rouge (Latérite).
*   **Typographie :** Titres majestueux (`Poppins` ou `Cinzel`), Textes de lecture clairs (`Inter`).
*   **Ambiance Sonore (UX Audio) :**
    *   *Hover* sur un bouton : Son de bois sec ou de calebasse.
    *   *Succès* : Léger tintement de Kora.
    *   *Notification* : Roulement de tambour lointain.

---

## 3. 🛠️ Stack Technique & Assets 3D

Pour garantir la fluidité (60 FPS) tout en étant "Ultra 3D", nous utiliserons **React Three Fiber (R3F)** pour des îlots 3D interactifs (pas un monde ouvert lourd).

### Les "Artefacts Vivants" (Icons 3D Dynamiques)
Au lieu d'icônes plates, chaque menu est un objet 3D lenticulaire (qui bouge légèrement avec la souris/gyroscope).

1.  **Dashboard (Accueil) :** Un **Trône Royal (Zinkpo)**.
2.  **Dossiers :** Un **Rouleau de Parchemin** avec sceau de cire.
3.  **Investissement :** Un tas de **Cauris d'Or** (Ancienne monnaie).
4.  **Profile :** Un **Masque Pendentif** (Ivoire/Bronze).

### Architecture Technique
*   **Framework :** Next.js (App Router).
*   **3D Engine :** `@react-three/fiber` + `@react-three/drei`.
*   **Animations :** `framer-motion` (pour les UIs 2D qui entrent/sortent).
*   **Backend :** Supabase (Auth + DB temps réel pour le chat).

---

## 4. Proposition de Structure "Dashboard Client"

```
/app/dashboard
├── /layout.tsx       --> Le "Sanctuaire" (Navigation 3D + Fond animé)
├── /page.tsx         --> "La Vue du Roi" (Résumé global + Notifications)
├── /projects         --> "Le Chantier" (Suivi 3D des projets)
├── /documents        --> "Le Grenier" (Gestion des fichiers)
├── /concierge        --> "L'Arbre à Palabre" (Chat & Support)
└── /profile          --> "L'Identité" (Infos personnelles)
```

**Validation :**
Ce concept transforme l'administratif ennuyeux en une quête personnelle et culturelle.
Êtes-vous prêt à ce que je commence la structure de cet "Espace Client 3D" ?
