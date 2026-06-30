# Manifeste de Sécurité et d'Architecture Anti-Piratage : Retour Gagnant Bénin

Ce document officiel détaille exhaustivement l'arsenal de cybersécurité, les protocoles d'isolement et les routines automatisées de défense mis en place pour la plateforme **Retour Gagnant Bénin**. 

Notre architecture ne se contente pas de "protéger" les données : elle applique une approche **Zero Trust (Confiance Zéro)** et de **Défense en Profondeur (Defense in Depth)**. Nous partons du principe que le système est constamment sous la menace, c'est pourquoi il a été conçu pour s'auto-nettoyer et s'auto-défendre sans aucune intervention humaine.

---

## 1. Éphémérité des Données Sensibles : Le Protocole de Purge des 24 Heures

C'est l'un des piliers les plus critiques de notre sécurité, notamment pour les dossiers de demande de **Nationalité** qui contiennent des informations hautement confidentielles et des documents d'identité.

* **Le Risque** : Stocker éternellement des pièces d'identité sur un serveur exposé au Web est une bombe à retardement en cas de fuite de données (Data Breach).
* **La Solution "Zéro Stockage Long Terme"** : 
   - Le système intègre une tâche planifiée automatisée (Cron Job / Routine SQL) qui s'exécute de manière implacable chaque jour.
   - **Passé un délai strict de 24 heures**, les dossiers complets de nationalité sont **définitivement supprimés (Hard Delete)** de la base de données de production.
   - **Sauvegarde à Froid (Cold Storage)** : Juste avant leur destruction sur le serveur, le système compile les dossiers et les expédie de manière chiffrée par email (vers des adresses administrateurs hautement sécurisées hors réseau). 
   - **Conséquence pour un hacker** : Si un pirate s'infiltrait dans le système un mardi, il ne trouverait aucune trace des dossiers soumis le dimanche. Le butin potentiel est réduit à néant de façon quotidienne.

---

## 2. Le Garde du Corps : WAF Autonome (Web Application Firewall) et Mémoire d'Apprentissage

Contrairement aux pares-feux statiques (firewalls traditionnels), Retour Gagnant Bénin est protégé par un système implanté au cœur même du serveur et de la base de données. Il s'agit d'un WAF intelligent basé sur l'OWASP CRS.

* **Analyse et Détection en Temps Réel** : Chaque requête provenant de l'application mobile ou du web est scannée. Le WAF identifie les signatures d'attaques complexes (Injections SQL, Cross-Site Scripting XSS, attaques par force brute).
* **Intelligence Mémorielle (Memory Learning)** : 
   - Le serveur se souvient de ses agresseurs via la table `waf_ip_memory`. Si une adresse IP a un comportement atypique, le système la place sous surveillance et "mémorise" son empreinte avec un système de `trust_score` dynamique.
   - Le système détecte les payloads récurrents, génère des signatures d'attaque (`waf_learned_rules`), et les promeut en règles actives si le volume dépasse un seuil.
* **Coordination et Bannissement (Subnet)** : Détection d'attaques distribuées via des réseaux entiers (`/24`) entraînant un bannissement global.
* **Protection Anti-BruteForce** : Les pages de connexion (`/admin/login`, `/client/login`, etc.) sont exemptées des vérifications de syntaxe (payload) pour éviter les faux positifs, mais subissent *obligatoirement* le Rate Limiting et le contrôle d'IP bannies.
* **Escalade Automatique des Sanctions (Autonomous WAF)** :
   - **Niveau 1 (Throttling / Ralentissement)** : Si un script automatisé est détecté, le WAF ralentit drastiquement le temps de réponse pour briser la rentabilité de l'attaque.
   - **Niveau 2 (Quarantaine)** : Rejet total et instantané des requêtes (Erreur 403) pendant plusieurs heures, visible dans la table `waf_alerts`.
   - **Niveau 3 (Blacklist Définitive)** : L'adresse IP est inscrite sur une liste noire. L'attaquant frappe "dans le vide", il ne peut même plus afficher la page d'accueil.

---

## 3. L'Étanchéité Structurelle : Row Level Security (RLS)

Même en imaginant le pire scénario (un pirate contourne le WAF ou obtient les clés API publiques de l'application), il fera face à notre bouclier ultime : **le cloisonnement des données (RLS)**.

* Chaque requête envoyée à la base de données doit présenter une signature cryptographique valide prouvant l'identité de l'utilisateur.
* La base de données elle-même évalue cette signature avant de renvoyer une ligne.
* **Résultat** : Un utilisateur "A" n'a physiquement aucun moyen de requêter les informations de l'utilisateur "B" (transactions, profils, dossiers). La base de données renvoie un résultat vide, rendant impossible "l'aspiration massive" de données clients.

---

## 4. Sécurité des Fichiers et Pièces Jointes (Storage & URL Signées)

Pour les documents téléversés par nos utilisateurs (photos de profil, documents PDF, pièces d'identité) :
* Les fichiers ne sont pas stockés dans un répertoire public. Ils sont placés dans des **Buckets Cloud Privés (Storage)**.
* Pour qu'un fichier soit lu, le système génère une **URL Signée (Signed URL)**. 
* Ce lien cryptographique possède une durée de vie très courte (ex: 60 secondes). Passé ce délai, le lien s'autodétruit. Un attaquant interceptant ce lien plus tard ne pourra rien télécharger.

---

## 5. Cryptographie, Sessions et Transactions

* **Mots de Passe Hachés** : Aucun mot de passe n'est stocké en texte clair. Ils sont hachés et salés via des algorithmes militaires (Bcrypt/Argon2). Même en cas de fuite de la base, ils sont indéchiffrables.
* **Jetons JWT (JSON Web Tokens)** : Les sessions mobiles reposent sur des jetons à expiration rapide.
* **Transactions Financières Sécurisées** : Les données bancaires ne touchent **jamais** nos serveurs SQL. Nous utilisons des tunnels de paiement directs et chiffrés avec les fournisseurs certifiés **PCI-DSS**.
* **Transport TLS 1.3** : 100% du trafic entre le téléphone de l'utilisateur et le serveur est chiffré. Personne sur le réseau (ni les fournisseurs d'accès internet, ni les hackers sur un Wi-Fi public) ne peut lire les échanges (protection contre le Man-in-the-Middle).

---

## 6. Surveillance Continue et Pistes d'Audit (Audit Logs)

* Le système génère automatiquement des **Audit Logs inaltérables**. Toute action critique (tentative de connexion échouée, modification d'un rôle administrateur) est tracée.
* Si le serveur subit un incident, nous avons une vision chronologique et transparente de la tentative de fraude, permettant d'adapter les règles du WAF pour le futur.

---

## Conclusion : L'Épuisement Technologique de l'Attaquant

L'architecture de *Retour Gagnant Bénin* n'est pas seulement sécurisée, elle est **hostile aux hackers**. 

L'attaquant moyen abandonne très vite car :
1. Dès les premières tentatives de scan, le WAF ralentit puis bannit son IP.
2. S'il tente d'exploiter une faille dans l'API, le RLS (Row Level Security) lui cache toutes les données.
3. S'il vise les dossiers de nationalité, il réalise qu'ils s'autodétruisent et disparaissent physiquement du serveur toutes les 24 heures (Purge & Cold Storage).
4. S'il écoute le réseau, il ne capture que du trafic indéchiffrable (TLS 1.3).

L'automatisation de tous ces processus assure à Retour Gagnant une sécurité de grade entreprise, autonome et auto-réparatrice.

---

## 7. Coffre-Fort Mobile : Chiffrement Matériel des Tokens (SecureStore)

Les jetons d'authentification sur l'application mobile ne sont **jamais** stockés en clair sur le téléphone.

* **iOS** : Stockage dans le **Keychain** Apple, chiffré par le Secure Enclave (puce hardware dédiée).
* **Android** : Stockage dans le **Android Keystore**, protégé par chiffrement AES-256 au niveau du hardware.
* **Conséquence pour un attaquant** : Même sur un téléphone rooté/jailbreaké, les tokens d'authentification ne peuvent pas être lus sans déchiffrement matériel. Un vol de téléphone ne compromet pas le compte utilisateur.
* **Fallback Web** : En mode développement (Expo Web), le système utilise localStorage avec détection automatique de la plateforme.

---

## 8. Architecture Détaillée du RLS — Matrice de Permissions

Le Row Level Security (Section 3) n'est pas un simple interrupteur ON/OFF. Chaque table a des **politiques granulaires** par rôle :

| Zone | Table | Client | Agent | Admin/CEO | service_role |
|---|---|---|---|---|---|
| **Dossiers** | `dossiers` | Ses dossiers | Tous | Tous | Bypass |
| | `dossier_documents` | Ses docs | Lecture+MAJ | Lecture+MAJ | Bypass |
| | `dossier_tracking` | Lecture | Tous | Tous | Bypass |
| **Commerce** | `orders` | ❌ | Tous | Tous | Bypass |
| **Profils** | `client_profiles` | Son profil | ❌ | ❌ | Bypass |
| | `notifications` | Les siennes | Les siennes | Les siennes | Bypass |
| **Secrets** | `settings` | ❌ | ❌ | ✅ | Bypass |
| | `email_logs` | ❌ | ❌ | ✅ | Bypass |
| | `security_logs` | ❌ | ❌ | Lecture | Bypass |
| **WAF** | `ip_blocks` | ❌ | ❌ | ✅ | Bypass |
| | `waf_logs` | ❌ | ❌ | ✅ | Bypass |
| | `waf_ip_memory` | ❌ | ❌ | ✅ | Bypass |
| | `waf_campaigns` | ❌ | ❌ | ✅ | Bypass |
| **Crypto** | `totp_secrets` | Son 2FA | Son 2FA | Son 2FA | Bypass |
| | `encrypted_files` | ❌ | ❌ | ✅ | Bypass |

> **Règle absolue** : La table `settings` (qui contient les clés SMTP, Kkiapay, Stripe, PayPal) est accessible **uniquement** aux rôles `admin`, `super_admin` et `ceo`. Même un agent authentifié n'a **aucun accès** à ces secrets.

---

## 9. Chaîne Complète de la Purge Automatique

Le cycle de vie d'un dossier de nationalité suit un pipeline strict et irréversible :

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ 1. SOUMISSION    │ →  │ 2. TRAITEMENT    │ →  │ 3. ARCHIVAGE    │
│ Client upload    │    │ Agent vérifie    │    │ Email chiffré   │
│ via mobile/web   │    │ statut → terminé │    │ → admin inbox   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                       │
                                               ┌───────▼───────┐
                                               │ 4. DESTRUCTION │
                                               │ Storage delete │
                                               │ DB hard delete │
                                               │ (irréversible) │
                                               └───────────────┘
```

* **Déclencheur** : CRON Vercel à 03h00 UTC chaque jour (`/api/cron/cleanup`)
* **Sélection** : Tous les dossiers avec `status = 'termine'` ET `updated_at < 24h`
* **Sécurité du CRON** : Protégé par un `CRON_SECRET` — impossible à déclencher de l'extérieur
* **Autorisation DB** : Utilise `SUPABASE_SERVICE_ROLE_KEY` pour contourner le RLS (les tables client sont verrouillées, seul le service_role peut purger)
* **Garde-fou anti-perte** : Si l'envoi email échoue → le dossier n'est **PAS** purgé. Aucune donnée n'est détruite sans confirmation d'archivage réussi.

---

## 10. Protection Anti-Abus des APIs Financières

Les endpoints de paiement (checkout, webhooks) sont protégés par un système de **Rate Limiting** qui empêche :

* **Flood de commandes** : Maximum de requêtes par IP par minute sur `/api/checkout`
* **Exploitation de coupons** : Incrémentation atomique via SQL RPC + vérification post-incrément (protection contre les race conditions)
* **Injection de montant** : Le montant est **toujours recalculé côté serveur** à partir des prix en base de données. Le montant envoyé par le client est ignoré.
* **Épuisement de stock fantôme** : Le stock n'est décrémenté qu'après confirmation de paiement (webhook), jamais au checkout.

---

*Document mis à jour le 19 mai 2026 — Post-hardening RLS + SecureStore + Purge CRON*
