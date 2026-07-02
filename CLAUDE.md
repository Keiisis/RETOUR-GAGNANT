# 🧠 RETOUR GAGNANT — MÉMOIRE PERSISTANTE CLAUDE CODE v3.1

> **⚡ CE FICHIER EST TON CERVEAU.** Tu le lis EN PREMIER, AUTOMATIQUEMENT, à chaque nouvelle session.
> **DERNIÈRE MISE À JOUR** : 2026-04-27
> **PROTOCOLE** : Diary + Planning-with-Files + Context-Save/Restore

---

## 🚨 PROTOCOLE AUTONOME — 5 RÈGLES D'OR

### RÈGLE 1 — AUTO-RESTORE (Début de session)
Quand l'utilisateur dit **"continue"**, **"reprends"**, **"on continue"** ou n'importe quelle variante :
1. **LIS** `CLAUDE.md` (ce fichier)
2. **LIS** la section `ÉTAT ACTUEL` pour trouver la tâche `⏳ EN COURS` ou la première `⬜`
3. **DIS EN 1 PHRASE** ce que tu vas faire : "Je reprends à [tâche X]. C'est parti."
4. **CODE** immédiatement, sans demander confirmation
5. **NE REFAIS JAMAIS** ce qui est marqué ✅

### RÈGLE 2 — AUTO-SAVE (Fin de session / Limite atteinte)
**AVANT de terminer** (tu sens que ta réponse sera longue ou que tu approches de la limite) :
1. **METS À JOUR** la section `ÉTAT ACTUEL` de ce fichier
2. Coche ✅ ce que tu as terminé
3. Marque ⏳ ce qui est en cours avec **contexte exact** (fichier, ligne, erreur)
4. Ajoute de nouvelles ⬜ si des tâches ont été découvertes
5. Met à jour le `JOURNAL DE BORD` avec un résumé de ta session
6. **DIS** : "✅ Mémoire sauvegardée. Dis 'continue' pour reprendre."

### RÈGLE 3 — RÈGLE DES 2 ACTIONS
> Après chaque 2 actions majeures (éditions de fichier, commandes), **sauvegarde mentalement** ton progrès.
> Si tu sens que tu approches de la limite, **STOPPE et SAUVE immédiatement** ce fichier.

### RÈGLE 4 — LECTURE AVANT DÉCISION
Avant toute décision architecturale majeure, **relis ce fichier** pour t'assurer d'être aligné avec :
- Le design system (Nexus Emerald + Or, mode clair)
- Les conventions (FR, TypeScript strict, pas de noir pur)
- Les pièges connus

### RÈGLE 5 — AUTONOMIE TOTALE
Tu es un **agent autonome**. Tu ne demandes PAS "Voulez-vous que je...?" ou "Dois-je...?"
Tu FAIS. Tu codes. Tu testes. Tu corriges. Tu avances.
La seule exception : si tu dois prendre une décision business (supprimer un service, changer de provider paiement, etc.)

---

## 📍 ÉTAT ACTUEL

### 🎯 OBJECTIF PRINCIPAL
**Parité totale Mobile ↔ Web + Application production-ready**
L'app mobile Expo doit être une copie fidèle et fonctionnelle du site web Next.js, connectée en temps réel à Supabase.

### ✅ TERMINÉ (ne pas refaire)

#### Synchronisation mobile ↔ web (P0)
- ✅ 9 services synchronisés (`ServicesScreen.tsx` + `ServiceDetailsScreen.tsx`)
- ✅ `AboutScreen.tsx`, `FAQScreen.tsx` alignés avec le web
- ✅ `HomeScreen.tsx` reconstruit (dashboard ultra premium, t() câblé)
- ✅ Toutes les screens mobile retravaillées (15 écrans + auth + onboarding)

#### Traduction mobile (P1) — ✅ DONE
- ✅ `LangContext.tsx` avec batch chunks de 15 + cache AsyncStorage par langue
- ✅ Hook `useLang()` câblé dans **23 fichiers** (tous les écrans + nav + components)
- ✅ Composant `<T>` créé (`mobile/src/components/T.tsx`) — *non utilisé, screens préfèrent `useLang().t()` direct*
- ✅ `LanguagePicker.tsx` (composant sélecteur)
- ✅ API consolidée : `/api/translate` (route mobile dédiée supprimée)
- ✅ Format API : `POST { texts: string[], lang: LangCode }` → `{ translations: { [src]: tgt } }`
- ✅ 6 langues : FR / EN / ES / PT / CR / HT
- ✅ `LangProvider` wrappé dans `App.tsx`

#### Paiement (P0)
- ✅ Architecture Kkiapay v2 : SDK natif React Native (`@kkiapay-org/react-native-sdk`)
- ✅ Listeners enregistrés une seule fois (refs pour callbacks → pas de stale closure)
- ✅ Sandbox toggle lu depuis Supabase `settings.kkiapay_sandbox`
- ✅ API_BASE standardisé `https://www.retourgagnantbenin.bj` partout
- ✅ Numéro WhatsApp réel : `2290160322121`
- ✅ Paiement web : 5 providers configurés en admin (Kkiapay, FedaPay, Zeyow, **Stripe**, **PayPal Business**)
- ✅ Stripe XOF zero-decimal (pas de ×100), webhook signature, PaymentIntents
- ✅ PayPal API v2 Orders (sandbox + production), client_id depuis settings, capture côté serveur

#### Backoffice (Admin / Agent / CEO / Client)
- ✅ Comptabilité LOT 1 (export mensuel), LOT 2 (Excel pro avec logo/dashboard/data bars), LOT 3 (clôture, justificatifs, verrou période)
- ✅ Registre comptable agent format officiel RGB (TVA, ventilation, bilan)
- ✅ Messagerie agent design institutionnel clair, export intelligent + email pro
- ✅ ERP boutique : fiche client exhaustive, alarmes factures, gestion stock
- ✅ Live chat type support (loading spinner fix)
- ✅ Bouton Paiement accepte factures externes (libellé libre)
- ✅ Toggle thème clair/sombre par panel (admin / agent / client / ceo)
- ✅ Migration thème sombre → clair sur 7 pages publiques
- ✅ Email institutionnel : header tricolore, logo XXL, portfolio 9 services cliquables
- ✅ Capture prospect avant formulaire nationalité + invitation compte
- ✅ Roll-up admin complet + attachments mail IA

#### Design & UX
- ✅ Refonte design system mobile → **Nexus Emerald** (mode clair, primary `#10B981`, accent or `#C9A84C`)
- ✅ Migration icônes mobile : Ionicons → **lucide-react-native** (Ionicons en fallback Services)
- ✅ Carte de visite (`frontend/components/business-card/BusinessCard.tsx`) — recto/verso minimaliste premium

#### Infra & Build
- ✅ TypeScript : 0 erreur (`npx tsc --noEmit`)
- ✅ Mobile : passage **dev build obligatoire** (Expo Go non supporté à cause SDK Kkiapay natif)
- ✅ CSP : `media-src` autorisé pour vidéos Supabase (portfolio)
- ✅ Suspense + force-dynamic sur `/mobile-payment` (build Vercel)

#### Mémoire & Continuité
- ✅ `CLAUDE.md` racine, `mobile/CLAUDE.md`, `frontend/CLAUDE.md`
- ✅ `.claude/commands/` — `/continue`, `/save`, `/status`, `/scan`, `/sync-check`, `/diary`

### ⚠️ EN COURS / DETTE TECHNIQUE

#### 🔴 [P0] SDK Kkiapay natif — actuellement **MOCKÉ**
Dans `mobile/src/components/KkiapayModal.tsx` lignes 33-36 :
```ts
// const { openKkiapayWidget, addSuccessListener, addFailedListener } = useKkiapay()
const openKkiapayWidget = (args: any) => { ... Alert.alert("Kkiapay Désactivé", ...) }
const addSuccessListener = (cb: any) => {}
const addFailedListener = (cb: any) => {}
```
**Action** : décommenter le hook réel et builder un dev build (`eas build --profile development`). Avant ça, le paiement mobile est un mock qui retourne `MOCK-TX` directement.

#### 🟡 Fichiers supprimés non commités
`Aura-Link/` entièrement supprimé (extension Chrome + serveur dev tool AI) — à confirmer/commiter.
`frontend/app/api/mobile/translate/route.ts` supprimée (fusion dans `/api/translate`).

### ⬜ TODO — Dans l'ordre de priorité

1. ⬜ **[P0] Réactiver SDK Kkiapay natif**
   - Décommenter `useKkiapay()` dans `KkiapayModal.tsx`
   - Builder dev build avec `expo-dev-client` + `eas build --profile development --platform android`
   - Tester paiement sandbox end-to-end

2. ⬜ **[P1] Audit RLS Supabase** — Row Level Security sur tables critiques
   - `dossiers` : un client ne voit que SES dossiers
   - `client_profiles` : un client ne voit que SON profil
   - `messages` : isolation par conversation (`sender_id`/`recipient_id`)
   - `notifications` : `user_id = auth.uid()`

3. ⬜ **[P2] Notifications push mobile** — Connecter `expo-notifications` aux events Supabase Realtime
   - Subscribe sur `dossiers.status` change → notification locale
   - Subscribe sur `messages` insert → notification

4. ⬜ **[P2] Test paiement Kkiapay sandbox end-to-end** (après P0 résolu)
   - Service → KkiapayModal → widget natif → POST `/api/mobile/dossiers`

5. ⬜ **[P2] Upload documents Supabase** — Tester bucket `dossier-documents`
   - Permissions du bucket
   - Test upload réel depuis `DossierScreen`

6. ⬜ **[P3] MessagesScreen Realtime** — Subscribe `messages` Supabase Realtime + envoi temps réel

7. ⬜ **[P3] Composant `<T>`** — actuellement non utilisé. Soit le supprimer, soit migrer les screens qui font `t('texte')` vers `<T>texte</T>` (cohérence avec le web).

8. ⬜ **[P4] Git** — beaucoup de fichiers en attente (toutes les screens mobile + App.tsx + LangContext + KkiapayModal + frontend/api/translate). Commit cohérent à préparer.

9. ⬜ **[P4] Audit visuel mobile sur device réel** (15 écrans)

---

## 📌 IDENTITÉ DU PROJET

| Clé | Valeur |
|-----|--------|
| **Nom** | Retour Gagnant Bénin |
| **URL** | https://www.retourgagnantbenin.bj |
| **Mission** | Accompagnement diaspora béninoise/afro-descendante (passeport, nationalité, immobilier, business) |
| **Workspace** | `c:\Users\HP\Desktop\RETOUR GAGNANT TEMPLATE` |
| **Frontend** | Next.js 15 App Router — `frontend/` |
| **Mobile** | Expo SDK 54 React Native 0.81.5 — `mobile/` |
| **Backend CMS** | Strapi 5.36 (SQLite dev / PostgreSQL prod) — `backend/` |
| **BDD/Auth** | Supabase (PostgreSQL + Auth + Storage + Realtime) |
| **Paiement web** | Kkiapay, FedaPay, Zeyow, Stripe, PayPal Business (5 providers) |
| **Paiement mobile** | Kkiapay SDK natif (dev build requis) |
| **Traduction** | Groq LLaMA 3.3 70B (batch, cache localStorage/AsyncStorage) |
| **Hébergement** | Vercel |
| **OS Dev** | Windows 11 — PowerShell + bash (Git Bash) |
| **Domaine email** | contact@retourgagnantbenin.bj |
| **WhatsApp agence** | 229 01 60 32 21 21 |

---

## 🏗️ ARCHITECTURE COMPLÈTE

```
RETOUR GAGNANT TEMPLATE/
│
├── CLAUDE.md                    ← 🧠 CE FICHIER — Mémoire maître
│
├── frontend/                    ← Next.js 15 App Router
│   ├── CLAUDE.md                ← Sous-mémoire frontend
│   ├── app/
│   │   ├── (routes)/            ← Pages publiques (services, a-propos, contact, blog, partenaires...)
│   │   ├── admin/               ← Dashboard administrateur (compta, ERP, settings)
│   │   ├── agent/               ← Espace agent terrain (messagerie, registre comptable)
│   │   ├── client/              ← Espace client web (dashboard, messages, dossier)
│   │   ├── ceo/                 ← Dashboard CEO
│   │   ├── boutique/            ← Boutique e-commerce + payment return
│   │   ├── api/                 ← 50+ API Routes
│   │   │   ├── admin/           ← CRUD admin (services, users, waf, compta)
│   │   │   ├── checkout/        ← Paiement Kkiapay/FedaPay/Stripe/PayPal/Zeyow
│   │   │   │   ├── stripe/      ← PaymentIntent
│   │   │   │   ├── paypal/      ← create + capture
│   │   │   │   └── verify/      ← Vérif serveur tous providers
│   │   │   ├── client/          ← Register, login, profil
│   │   │   ├── mobile/          ← API dédiée mobile (dossiers)
│   │   │   ├── translate/       ← Traduction Groq batch
│   │   │   ├── settings/payment ← GET clés publiques + test connectivité
│   │   │   └── webhooks/        ← Callbacks Kkiapay/FedaPay/Stripe/PayPal/Zeyow
│   │   └── mobile-payment/      ← Gateway paiement web (legacy v1, fallback)
│   ├── components/
│   │   ├── boutique/            ← PaymentModal, CartCheckoutModal
│   │   ├── business-card/       ← Carte de visite (recto/verso)
│   │   └── ...
│   ├── lib/                     ← Supabase client, email, traduction, store Zustand, currency
│   └── public/                  ← Assets statiques (logo, qr, Excel templates)
│
├── mobile/                      ← Expo React Native (SDK 54)
│   ├── CLAUDE.md                ← Sous-mémoire mobile
│   ├── App.tsx                  ← Entry point + deep links + fonts + providers
│   ├── app.json                 ← Config Expo + scheme + plugins + permissions + dev-client
│   ├── src/
│   │   ├── screens/
│   │   │   ├── auth/            ← Login, Register, ForgotPassword, SplashScreen
│   │   │   ├── OnboardingScreen.tsx
│   │   │   └── main/            ← 15 écrans principaux
│   │   ├── components/          ← KkiapayModal, LanguagePicker, T
│   │   ├── config/              ← theme.ts (Nexus Emerald), supabase.ts
│   │   ├── contexts/            ← AuthContext, LangContext
│   │   └── navigation/          ← AppNavigator, MainTabNavigator
│   ├── stitch/                  ← (?) à investiguer
│   └── .env                     ← Variables Supabase + API URL
│
├── backend/                     ← Strapi CMS
│
├── .claude/
│   ├── settings.json            ← Permissions Claude Code
│   ├── settings.local.json      ← Permissions locales (auto-générées)
│   ├── scripts/                 ← Scripts internes
│   └── commands/                ← Commandes slash personnalisées
│       ├── continue.md, save.md, status.md, scan.md, sync-check.md, diary.md
│
└── diary/                       ← Journal de développement (auto-créé)
```

---

## 🔑 VARIABLES D'ENVIRONNEMENT

### Mobile (`mobile/.env`)
```env
EXPO_PUBLIC_SUPABASE_URL=https://ywvsfhqdtkgzavxsumnk.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
EXPO_PUBLIC_API_URL=https://www.retourgagnantbenin.bj
```

### Frontend (`frontend/.env.local`) — Clés critiques
```
NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY         ← SERVEUR UNIQUEMENT, jamais côté client
GROQ_API_KEY                      ← Pour traduction IA (rotation via lib/groq)
```

### Settings Supabase (table `settings`, category `payment`) — pas dans .env
```
kkiapay_enabled, kkiapay_sandbox, kkiapay_public_key, kkiapay_private_key, kkiapay_secret_key
fedapay_enabled, fedapay_sandbox, fedapay_public_key, fedapay_secret_key
zeyow_enabled, zeyow_redirect_url
stripe_enabled, stripe_sandbox, stripe_public_key, stripe_secret_key, stripe_webhook_secret
paypal_enabled, paypal_sandbox, paypal_client_id, paypal_client_secret, paypal_currency, paypal_webhook_id
```

---

## 🎨 DESIGN SYSTEM — "Nexus Emerald" (Mode Clair)

### Palette de couleurs

| Token | Hex | Usage |
|-------|-----|-------|
| `primary` | `#10B981` | Vert émeraude — accent principal Nexus |
| `primaryDark` | `#047857` | Hover, gradients |
| `primaryLight` | `#34D399` | Soft accents |
| `teal` | `#14B8A6` | Info, secondaire émeraude |
| `gold` | `#C9A84C` | Accent secondaire / premium |
| `goldLight` | `#E2C97E` | Texte sur fond sombre |
| `goldDark` | `#A68B3C` | Texte gold |
| `background` | `#FFFFFF` | Fond principal mode clair |
| `surface` | `#FFFFFF` | Cartes, modales |
| `surfaceWarm` | `#F8FAF9` | Sections alternées |
| `headerBg` | `#10B981` | En-tête primaire |
| `textPrimary` | `#1a2332` | Texte principal (jamais #000) |
| `textSecondary` | `#4A5568` | Texte secondaire |
| `navy` | `#0C1B33` | Fallback dark sections |
| Bénin Vert | `#008751` | Drapeau (touches uniquement) |
| Bénin Jaune | `#FCD116` | Drapeau (touches uniquement) |
| Bénin Rouge | `#E8112D` | Drapeau (touches uniquement) |

### Typographie
- **Mobile** : Outfit (body) + Playfair Display (titres) — chargées dans `App.tsx` via `@expo-google-fonts`
- **Web** : Outfit + Playfair Display
- **Icônes mobile** : `lucide-react-native` (principal) + Ionicons (fallback Services)
- **Icônes web** : Lucide React

### Règles NON NÉGOCIABLES
- ❌ **JAMAIS** de noir pur `#000000`
- ❌ **JAMAIS** de couleurs natives génériques (red, blue, green sans token)
- ✅ TOUJOURS via tokens du theme (`colors.primary`, `colors.gold`, etc.)
- ✅ Mode clair pour l'app + pages publiques ; toggle clair/sombre par panel (admin/agent/client/ceo)

---

## 📦 LES 9 SERVICES — Source de vérité unique

| # | Slug | Titre | Prix base | Icône mobile (lucide) |
|---|------|-------|-----------|----------------------|
| 1 | `passeport` | Passeport & Documents Officiels | 50 000 FCFA | `FileText` |
| 2 | `logement` | Acheter ou Louer un Bien | 25 000 FCFA | `Home` |
| 3 | `business` | Création d'Entreprise | 150 000 FCFA | `Briefcase` |
| 4 | `culture` | Tourisme & Culture | 80 000 FCFA/pers | `Globe` |
| 5 | `construction` | Suivi de Chantier | 50 000 FCFA | `HardHat` |
| 6 | `investissement` | Investissement | 50 000 FCFA | `TrendingUp` |
| 7 | `nationalite-vip` | Nationalité VIP | 150 000 FCFA | `Award` |
| 8 | `recherche-ancestrale` | Recherche Ancestrale | 250 € | `Users` |
| 9 | `autres` | Autres Services | Nous contacter | `LayoutGrid` |

### ⚠️ FICHIERS JUMELÉS — Modifier les 2 en même temps !
| Source | Fichier |
|--------|---------|
| **Web** (maître) | `frontend/app/(routes)/services/[slug]/page.tsx` → `FALLBACK_SERVICES` |
| **Mobile** | `mobile/src/screens/main/ServicesScreen.tsx` → `SERVICES_DATA` |

---

## 💳 FLUX PAIEMENT — Architecture v2

### Mobile (Kkiapay SDK natif)
```
ServiceDetailsScreen
  └─ KkiapayModal (visible)
      ├─ fetch settings.kkiapay_public_key + .kkiapay_sandbox depuis Supabase
      ├─ openKkiapayWidget({ amount, key, sandbox, theme })   ← widget IN-APP
      ├─ addSuccessListener (registered ONCE au mount via useRef)
      │     └─ onSuccess(transactionId) → POST /api/mobile/dossiers
      └─ addFailedListener
            └─ Alert.alert("Échec")
```
**État actuel** : SDK MOCKÉ (lignes 33-36). À réactiver après dev build.

### Web (5 providers)
```
PaymentModal / CartCheckoutModal
  └─ POST /api/checkout (créer commande pending)
      └─ Provider widget (Kkiapay k.js / FedaPay / Stripe.js / PayPal SDK / Zeyow redirect)
          └─ POST /api/checkout/verify (server-side double-check)
              └─ POST /api/webhooks/{provider} (signature verification)
```

### Tarification Stripe XOF
- XOF est **zero-decimal currency** : pas de ×100
- Liste : BIF, CLP, DJF, GNF, JPY, KMF, KRW, MGA, PYG, RWF, UGX, VND, VUV, **XAF, XOF**, XPF

---

## 🗄️ TABLES SUPABASE

| Table | Colonnes clés | Usage |
|-------|---------------|-------|
| `services` | id, slug, title, description, price, features, pricing_options | Catalogue services |
| `dossiers` | id, client_id, service_type, status, progress, created_at | Dossiers client |
| `dossier_documents` | id, dossier_id, file_url, file_type, uploaded_at | Documents attachés |
| `client_profiles` | id, user_id, first_name, last_name, phone, address | Profil client |
| `messages` | id, sender_id, recipient_id, content, is_read, created_at | Messagerie interne |
| `notifications` | id, user_id, title, message, is_read, type | Notifications |
| `appointments` | id, client_id, date, time, type, status, notes | Rendez-vous |
| `events` | id, title, date, location, description, image_url | Événements communautaires |
| `settings` | key, value, category | Paramètres dynamiques (payment, frontend, ...) |
| `products` | id, name, price, stock, image_url, category | Boutique |
| `orders` | id, client_id, total, status, payment_method | Commandes boutique |
| `page_sections` | id, page, section_key, content (JSONB), is_active | Contenu dynamique pages |
| `partners` | id, name, profile, ... | Partenaires (profils détaillés) |
| `translations` | source_text, source_hash, lang, translated_text, context | Cache traductions Groq |

### Statuts de dossier (mobile/web)
```
soumis → verifie → traitement → validation → termine
                                            ↘ annule
```

| Status | Label | Couleur |
|--------|-------|---------|
| `soumis` | Dossier soumis | `info` (#3B82F6) |
| `verifie` | En cours de vérification | Violet (#7C5CCA) |
| `traitement` | En traitement | `gold` (#C9A84C) |
| `validation` | En validation | Orange (#E07B54) |
| `termine` | Terminé | `success` (#10B981) |
| `annule` | Annulé | `danger` (#EF4444) |

---

## 📱 15 ÉCRANS MOBILE — Registre complet

| # | Écran | Fichier | Tab | Sync | Lang |
|---|-------|---------|-----|------|------|
| 1 | Accueil | `HomeScreen.tsx` | Home | ✅ | ✅ |
| 2 | Services | `ServicesScreen.tsx` | Services | ✅ | ✅ |
| 3 | Détail service | `ServiceDetailsScreen.tsx` | — | ✅ | ✅ |
| 4 | Mon Dossier | `DossierScreen.tsx` | Dossier | ✅ | ✅ |
| 5 | Messages | `MessagesScreen.tsx` | (stack) | ✅ | ✅ |
| 6 | Événements | `EventsScreen.tsx` | Events | ✅ | ✅ |
| 7 | Détail event | `EventDetailScreen.tsx` | — | ✅ | ✅ |
| 8 | Profil | `ProfilScreen.tsx` | Profil | ✅ | ✅ |
| 9 | Modifier profil | `EditProfilScreen.tsx` | — | ✅ | ✅ |
| 10 | Paiements | `PaymentsScreen.tsx` | (stack) | ✅ | ✅ |
| 11 | Rendez-vous | `AppointmentsScreen.tsx` | (stack) | ✅ | ✅ |
| 12 | Notifications | `NotificationsScreen.tsx` | (stack) | ✅ | ✅ |
| 13 | Sécurité | `SecurityScreen.tsx` | — | ✅ | ✅ |
| 14 | FAQ | `FAQScreen.tsx` | — | ✅ | ✅ |
| 15 | À Propos | `AboutScreen.tsx` | — | ✅ | ✅ |

---

## 🔗 MAP DES FICHIERS CRITIQUES

| Rôle | Fichier | Notes |
|------|---------|-------|
| **Entry point mobile** | `mobile/App.tsx` | Deep links + fonts (Outfit/Playfair) + AuthProvider + LangProvider |
| **Config Expo** | `mobile/app.json` | Scheme + plugins + dev-client + permissions |
| **Navigation** | `mobile/src/navigation/AppNavigator.tsx` | Stack navigator + types route |
| **Tabs** | `mobile/src/navigation/MainTabNavigator.tsx` | 5 tabs bottom |
| **Auth** | `mobile/src/contexts/AuthContext.tsx` | Supabase Auth session |
| **Lang** | `mobile/src/contexts/LangContext.tsx` | Batch chunks 15 + AsyncStorage cache + 6 langues |
| **Theme** | `mobile/src/config/theme.ts` | Design tokens Nexus Emerald (mode clair) |
| **Supabase** | `mobile/src/config/supabase.ts` | Client Supabase init |
| **Paiement mobile** | `mobile/src/components/KkiapayModal.tsx` | ⚠️ SDK actuellement MOCKÉ (lignes 33-36) |
| **Composant T** | `mobile/src/components/T.tsx` | <T>texte</T> — créé mais inutilisé |
| **API translate** | `frontend/app/api/translate/route.ts` | POST {texts, lang} → {translations:{src:tgt}} |
| **API dossiers mobile** | `frontend/app/api/mobile/dossiers/route.ts` | GET/POST dossiers |
| **Services web** | `frontend/app/(routes)/services/[slug]/page.tsx` | Source de vérité services |
| **Carte visite** | `frontend/components/business-card/BusinessCard.tsx` | Recto/Verso minimaliste premium |
| **Translation web** | `frontend/lib/translation/TranslationProvider.tsx` | Provider + composant T web |

---

## ⚠️ PIÈGES CONNUS — Ne JAMAIS reproduire

| # | Piège | Impact | Solution |
|---|-------|--------|----------|
| 1 | Listeners Kkiapay doublés au remount | Multiples callbacks fired | `addSuccessListener` dans useEffect `[]`, callbacks via `useRef` (pas de stale closure) |
| 2 | `SUPABASE_SERVICE_ROLE_KEY` côté client | 🔒 Faille sécurité critique | Uniquement dans API Routes serveur |
| 3 | `Alert.prompt()` sur Android | 💥 N'existe pas | Modal custom avec TextInput |
| 4 | Polices non chargées au render | 💥 Crash silencieux | `useFonts()` + SplashScreen dans App.tsx |
| 5 | Params navigation non typés | ❌ Erreur TS | Déclarer dans `RootStackParamList` |
| 6 | URL `retour-gagnant.com` | ❌ Mauvais domaine | `retourgagnantbenin.bj` |
| 7 | Email `contact@retour-gagnant.com` | ❌ Mauvais email | `contact@retourgagnantbenin.bj` |
| 8 | Stripe XOF avec ×100 | 💸 Montants 100x trop élevés | XOF est zero-decimal — pas de multiplication |
| 9 | Modifier un service sans l'autre | 🐛 Désynchronisation | TOUJOURS modifier web ET mobile ensemble |
| 10 | API_BASE divergent (`www.` vs sans) | Redirections cassent fetch | Standardisé `https://www.retourgagnantbenin.bj` |
| 11 | Numéro WhatsApp placeholder `22990000000` | Erreur prod | Numéro réel `2290160322121` |
| 12 | Sandbox Kkiapay hardcodé | Test impossible | Lu depuis `settings.kkiapay_sandbox` |
| 13 | Build Vercel sans Suspense | Erreur force-dynamic | Wrapper `<Suspense>` autour useSearchParams |

---

## 📐 CONVENTIONS DE CODE

### Style
- **Langue UI** : Français
- **Langue code** : Anglais (variables, fonctions)
- **Commentaires** : Français
- **TypeScript** : Mode strict, tout typer (jamais `any` sauf exception documentée)

### Mobile
- **Styles** : `StyleSheet.create({})` — jamais de styles inline
- **Navigation** : React Navigation 7 (Stack + Tab)
- **State** : Hooks React (`useState`, `useEffect`, `useContext`)
- **API** : `supabase.from('table').select()` avec try/catch + données fallback
- **Icônes** : `lucide-react-native` en priorité, Ionicons en fallback (Services)
- **Traduction** : `const { t } = useLang()` + `t('texte FR')` dans les Text/string

### Web
- **CSS** : Tailwind CSS
- **Components** : shadcn/ui + Radix
- **Animations** : Framer Motion + GSAP + Three.js
- **API** : Next.js API Routes (`app/api/`)
- **Store** : Zustand (`lib/store/`)
- **Traduction** : `<T>texte</T>` ou `useTranslation()`

### Git
- **Messages** : `feat(scope): description` / `fix(scope): description`
- **Scopes** : `mobile`, `frontend`, `api`, `supabase`, `config`, `compta`, `erp`, `email`, `routes`, `panels`, `agent`, `admin`

---

## 🚀 COMMANDES RAPIDES

```powershell
# ── FRONTEND ──
cd "c:\Users\HP\Desktop\RETOUR GAGNANT TEMPLATE\frontend"
npm run dev                    # Serveur dev → localhost:3000
npm run build                  # Build production
npx tsc --noEmit               # Type check

# ── MOBILE (dev build requis pour Kkiapay natif) ──
cd "c:\Users\HP\Desktop\RETOUR GAGNANT TEMPLATE\mobile"
npx expo start --dev-client --clear     # Dev build (recommandé)
npx expo start --clear                  # Expo Go (sans paiement réel)
npx tsc --noEmit                        # Type check
eas build --profile development --platform android   # Build APK dev

# ── GIT ──
cd "c:\Users\HP\Desktop\RETOUR GAGNANT TEMPLATE"
git diff --stat HEAD            # Fichiers modifiés
git status --short              # Liste rapide
git log --oneline -20           # Historique
```

---

## 📔 JOURNAL DE BORD

> **Format** : `[Date] — Résumé de session`

### 2026-07-02 — Session 6 (Refonte native mobile complète, en 4 lots)
- Objectif : que les écrans respectent vraiment l'architecture d'une app mobile (et non des pages web encapsulées).
- **Lot 1** : NotificationsScreen, OrdersScreen, InvoicesScreen → `ScrollView` remplacé par `FlatList` (recyclage + momentum natif), en-têtes en `ListHeaderComponent`, états vide/chargement en `ListEmptyComponent`, footer en `ListFooterComponent`, `useSafeAreaInsets`, `expo-haptics` au tap.
- **Lot 2** : AppointmentsScreen → `FlatList`. MessagesScreen (déjà chat FlatList) + DossierScreen → barre de nav via `useSafeAreaInsets`. Sweep safe-area sur les nav bars du lot 1.
- **Lot 3** : ServicesScreen, EventsScreen, ProfilScreen → nav bar safe-area (catalogue/feed/settings restent en ScrollView, pattern natif correct).
- **Lot 4** : 17 écrans secondaires (auth, détails, flux paiement, formulaires) + `ScreenHeader` partagé → suppression de **tous** les `paddingTop: Platform.OS === 'ios' ? … : …` codés en dur, remplacés par `insets.top`. Headers flottant (ProductDetail) et sticky/hero (ServiceDetails) gérés nativement.
- Résultat : plus aucun offset de status bar en dur dans l'app ; tout s'adapte aux encoches, Dynamic Island et barres système Android. `npx tsc --noEmit` → 0 erreur. 4 commits, mergés sur `main` (merge --no-ff) et poussés.
- Note technique : les fichiers mobile sont en **CRLF** — les codemods regex doivent utiliser `\r?\n` (un premier passage en `\n` a échoué silencieusement sur l'insertion du hook).

### 2026-05-26 — Session 5 (Web & Mobile theme sync, compilation checks)
- Démarrage du serveur web dev Next.js sur le port 3000.
- Correction des erreurs de typecheck TypeScript (`npx tsc --noEmit`) sur l'application mobile Expo :
  - `sheetLargestUndimmedDetent` changé en `sheetLargestUndimmedDetentIndex: 0` dans `AppNavigator.tsx`.
  - `borderTopStyle` web remplacé par `borderStyle` standard dans `OrderDetailScreen.tsx`.
  - Casting `(item as any).accent` pour corriger les erreurs d'union dans `ProfilScreen.tsx`.
- Nettoyage des placeholders email et téléphone dans `FAQScreen.tsx` (remplacé par les vrais contacts avec redirection `Linking`).
- Validation réussie de la compilation sans erreur pour le frontend Next.js et l'application mobile Expo.

### 2026-04-27 — Session 4 (Mémoire v3.1, refonte CLAUDE.md)
- Audit complet du décalage entre CLAUDE.md (2026-04-13) et état réel du repo
- Mise à jour majeure : design system Nexus Emerald (mode clair), Expo SDK 54, paiement v2 SDK natif, 5 providers web (Stripe + PayPal ajoutés), traduction mobile P1 marquée DONE
- Identification dette critique : **Kkiapay SDK actuellement mocké** dans `KkiapayModal.tsx` (lignes 33-36) — à réactiver après dev build
- Constat : `useLang()` câblé dans 23 fichiers, route `/api/mobile/translate` consolidée dans `/api/translate`

### Commits notables 2026-04-13 → 2026-04-27 (chronologique)
- `7e1ece1` fix(mobile/dossiers): auto-créer client_profiles si absent + SQL migration FK
- `ee724f6` feat(mobile): events system + services enrichis + pièces à fournir
- `d724579` feat(erp): paiements manuels + alarmes + stock boutique + live chat fixes
- `7e8b3b2` fix(mobile-payment): Suspense boundary
- `6d6af2a` fix(build+chat+partners): Suspense force-dynamic + partner profiles + file upload
- `32071ff` feat(full): carte de visite + mobile redesign + ERP boutique + nouvelles API
- `ca91536` fix(chat+compta): live chat type support + loading spinner
- `41a6fbd` fix(portfolio): video intro fallback si autoplay échoue
- `a632662` fix(csp): autorise media-src Supabase pour vidéos portfolio
- `554bd5e` feat(erp): fiche client exhaustive, alarmes factures, gestion stock
- `ff9712b` feat(compta): bouton Paiement accepte factures externes
- `b683fe6` feat(compta): LOT 1 export comptable mensuel
- `05c8407` feat(compta): LOT 2 export Excel pro (logo, dashboard, data bars)
- `4fc0358` feat(compta): LOT 3 contrôle & conformité (clôture, justificatifs, verrou)
- `fe5b650` feat(compta): registre comptable agent format officiel RGB
- `483d926` feat(agent): logique export intelligente + messagerie email pro
- `732f196` fix(agent): refonte messagerie agent design institutionnel clair
- `257ec71` feat(nationalite): capture prospect avant formulaire + invitation compte
- `9e3fc35` → `96b29a1` (5 commits) feat(email+portfolio): refonte institutionnelle, logo XXL tricolore, portfolio 9 services
- `d5d4c77` feat(admin+agent+design): fix liens admin + roll-up + attachments mail IA
- `a70358e` feat(panels): toggle thème clair/sombre par panel (admin/agent/client/ceo)
- `33c5765` feat(routes): migration thème sombre → clair sur 7 pages publiques
- `125e682` fix(mobile): audit P1+P2 — paiement listeners, WhatsApp, API_BASE, sandbox toggle

### 2026-04-13 — Sessions 1-3 (synchronisation initiale + mémoire v3)
- Synchronisation 9 services web↔mobile, refonte ServiceDetailsScreen
- KkiapayModal v1 (Linking) + gateway `/mobile-payment` + deep links
- Création système mémoire persistante v3 (CLAUDE.md racine + sous-mémoires)

---

## 🧪 TEST — 5 questions de contrôle

| # | Question | Où trouver la réponse |
|---|----------|----------------------|
| 1 | Où en suis-je ? | Section `ÉTAT ACTUEL` → tâche `⏳` ou première `⬜` |
| 2 | Quel est l'objectif ? | `OBJECTIF PRINCIPAL` |
| 3 | Qu'est-ce que j'ai déjà fait ? | Section `✅ TERMINÉ` |
| 4 | Quels pièges éviter ? | Section `PIÈGES CONNUS` |
| 5 | Quel fichier modifier ? | Section `MAP DES FICHIERS CRITIQUES` |

---

*Ce fichier est lu automatiquement par Claude Code à chaque ouverture du projet.*
*Pattern : Diary + Planning-with-Files + Context-Save/Restore fusionnés.*
*Voir aussi `mobile/CLAUDE.md` et `frontend/CLAUDE.md` pour contexte spécifique par plateforme.*
