# RETOUR GAGNANT — Mémoire Frontend (Next.js)

> Sous-mémoire dédiée au site web Next.js.
> Lire `CLAUDE.md` à la racine pour le contexte projet complet.

---

## 🌐 STACK

| Technologie | Détail |
|---|---|
| **Framework** | Next.js 15 (App Router) |
| **UI** | Tailwind CSS + shadcn/ui + Framer Motion + GSAP + Three.js |
| **Fonts** | Outfit (corps) + Playfair Display (titres) |
| **BDD** | Supabase (supabase-js v2, service role pour API routes) |
| **Auth** | Supabase Auth (email/password, OTP, magic link) |
| **Paiements** | 5 providers : Kkiapay, FedaPay, Zeyow, Stripe, PayPal Business |
| **Traduction** | Groq LLaMA 3.3 70B (live, 6 langues, cache Supabase + localStorage) |
| **Hébergement** | Vercel |
| **Domaine** | https://www.retourgagnantbenin.bj |

---

## 📁 STRUCTURE ROUTES PUBLIQUES

```
app/(routes)/
├── a-propos/          ← Page À Propos
├── blog/              ← Articles/blog
├── contact/           ← Formulaire contact
├── devenir-partenaire/← Partenariat
├── evenements/        ← Événements communautaires
├── mon-compte/        ← Espace client
├── nationalite/       ← Dossier nationalité béninoise (capture prospect avant formulaire)
├── partenaires/       ← Liste + profils détaillés partenaires
├── patrimoine/        ← Patrimoine culturel
├── rendez-vous/       ← Prise de RDV
├── services/          ← Catalogue services (9 services)
│   ├── [slug]/        ← Détail dynamique (FALLBACK_SERVICES = source de vérité)
│   ├── autres/
│   ├── nationalite-vip/
│   └── recherche-ancestrale/
├── simulateur/        ← Simulateur de coûts
└── suivi-dossier/     ← Suivi de dossier client
```

Sous-applications privées (panels avec toggle thème clair/sombre par panel) :
- `app/admin/` — Dashboard admin (compta LOT 1/2/3, ERP, settings, services)
- `app/agent/` — Espace agent terrain (messagerie pro, registre comptable RGB officiel)
- `app/client/` — Espace client web
- `app/ceo/` — Dashboard CEO
- `app/boutique/` — E-commerce + payment return

---

## 🔑 ROUTES API CRITIQUES (50+)

### Services
- `GET /api/services/[slug]` — Détail service (fallback `FALLBACK_SERVICES` si pas en DB)
- `GET/POST/PATCH /api/admin/services` — CRUD admin

### Mobile
- `GET /api/mobile/dossiers?client_id=X` — Liste dossiers du client
- `POST /api/mobile/dossiers` — Créer un dossier (après paiement mobile)

> ⚠️ **`/api/mobile/translate` a été supprimé** — l'app mobile utilise désormais `/api/translate` directement (même format que le web).

### Paiement (5 providers)
- `POST /api/checkout` — Créer commande pending en DB
- `POST /api/checkout/verify` — Vérification serveur tous providers
- `POST /api/checkout/stripe` — Créer Stripe PaymentIntent (XOF zero-decimal)
- `POST /api/checkout/paypal/create` — Créer commande PayPal API v2
- `POST /api/checkout/paypal/capture` — Capturer paiement PayPal
- `POST /api/webhooks/{kkiapay,fedapay,stripe,paypal,zeyow}` — Webhooks signature-vérifiés
- `GET /api/settings/payment` — Clés publiques + flags (secrètes masquées)
- `POST /api/settings/payment/test` — Test connectivité provider

### Auth
- `POST /api/client/register` — Inscription client
- `POST /api/client/resend-confirmation` — Renvoyer email de confirmation

### Comptabilité
- `POST /api/admin/compta/export` (LOT 1) — Export CSV mensuel
- `POST /api/admin/compta/export-excel` (LOT 2) — Excel pro avec logo, dashboard, data bars
- `POST /api/admin/compta/cloture` (LOT 3) — Clôture mensuelle + verrou période

### Paramètres
- `GET /api/settings/frontend` — Paramètres dynamiques (feature flags, hero content)

### Traduction
- `POST /api/translate` — Traduction Groq batch
  - **Body** : `{ texts: string[], lang: LangCode }`
  - **Response** : `{ translations: { [src]: tgt }, fromCache, newlyTranslated }`
  - Cache 2 niveaux : `localStorage`/`AsyncStorage` (client) + table `translations` Supabase (serveur)
  - Hash SHA des textes sources via `lib/translation/hash.ts`
  - Promptings spécifiques pour Créoles (`promptHint` dans `constants.ts`) + détection anti-fallback anglais

---

## 🌍 TRADUCTION (6 langues)

| Code | Langue | Drapeau | Notes |
|------|--------|---------|-------|
| `fr` | Français (défaut) | 🇫🇷 | Source — pas de traduction |
| `en` | Anglais | 🇬🇧 | Direct |
| `es` | Espagnol | 🇪🇸 | Direct |
| `pt` | Portugais (BR) | 🇧🇷 | Brazilian Portuguese |
| `cr` | Créole Antillais | 🇬🇵 | `promptHint` avec exemples Kréyòl + validation `looksEnglish()` |
| `ht` | Créole Haïtien | 🇭🇹 | `promptHint` avec exemples Kreyòl Ayisyen + validation |

**Architecture web** :
- `<TranslationProvider>` wrap toute l'app (`frontend/lib/translation/TranslationProvider.tsx`)
- `<T>texte en français</T>` — composant inline (utilisé partout sur le web)
- `const { t, lang } = useTranslation()` — hook
- Cache : `localStorage` avec hash SHA du texte source (côté client) + Supabase `translations` (côté serveur)

**Architecture mobile** :
- `<LangProvider>` dans `App.tsx`
- `useLang().t('texte')` — pas de composant `<T>` en mobile (supprimé)
- Cache : `AsyncStorage` versionné (`CACHE_VERSION` à bumper en cas de corruption)
- Fonctions exposées : `t`, `preloadTexts`, `retryFailed`, `clearCache`
- Anti-loop : `failedForever` Set (max 1 retry, puis abandon — re-tente sur foreground via `AppState`)

---

## 🏛️ COMPOSANTS HOME IMPORTANTS

| Composant | Fichier | Rôle |
|-----------|---------|------|
| `HeroSection` | `components/home/HeroSection.tsx` | Vidéo hero + slogan tricolore Bénin |
| `ServicesGrid` | `components/home/ServicesGrid.tsx` | Grille des 9 services |
| `PricingCalculator3D` | `components/services/PricingCalculator3D.tsx` | Calculateur tarifs interactif |
| `GoldenIcon` | `components/ui/GoldenIcon.tsx` | Icônes SVG dorées |
| `BusinessCard` | `components/business-card/BusinessCard.tsx` | Carte de visite recto/verso minimaliste premium |

---

## 💳 PAIEMENT WEB — 5 PROVIDERS

### SDK chargement (tous dans `app/boutique/layout.tsx`)
- **Kkiapay** : CDN `cdn.kkiapay.me/k.js`
- **FedaPay** : CDN `cdn.fedapay.com/checkout.js`
- **Stripe** : CDN `js.stripe.com/v3/`
- **PayPal** : Chargé dynamiquement dans le modal avec `client_id` depuis settings
- **Zeyow** : Redirection serveur (pas de SDK)

### Stripe — XOF = zero-decimal currency
- **Pas de multiplication par 100** pour XOF, XAF, JPY, KRW, etc.
- Liste : BIF, CLP, DJF, GNF, JPY, KMF, KRW, MGA, PYG, RWF, UGX, VND, VUV, **XAF, XOF**, XPF

### PayPal — API v2 Orders
- Sandbox : `https://api-m.sandbox.paypal.com`
- Production : `https://api-m.paypal.com`
- Auth : Basic (`client_id:client_secret` base64)
- Flow : `GET token` → `POST /v2/checkout/orders` → `POST /v2/checkout/orders/{id}/capture`

### Settings Supabase (table `settings`, category `payment`)
```
kkiapay_enabled, kkiapay_sandbox, kkiapay_public_key, kkiapay_private_key, kkiapay_secret_key
fedapay_enabled, fedapay_sandbox, fedapay_public_key, fedapay_secret_key
zeyow_enabled, zeyow_redirect_url
stripe_enabled, stripe_sandbox, stripe_public_key, stripe_secret_key, stripe_webhook_secret
paypal_enabled, paypal_sandbox, paypal_client_id, paypal_client_secret, paypal_currency, paypal_webhook_id
```

> 🔒 **Clés secrètes** ne sont JAMAIS exposées au client : seules `*_public_key` + flags sortent via `/api/settings/payment` GET. Tout le reste reste serveur-side.

---

## ⚠️ RÈGLE DE SYNCHRONISATION

**Quand tu modifies les services sur le web, tu DOIS aussi mettre à jour :**
1. `mobile/src/screens/main/ServicesScreen.tsx` → `SERVICES_DATA`
2. `mobile/src/screens/main/ServiceDetailsScreen.tsx` (si structure change)

**Quand tu modifies la traduction :**
1. Langues supportées : `lib/translation/constants.ts` (web) — source de vérité
2. Mobile copie les codes/labels dans `mobile/src/contexts/LangContext.tsx`
3. **Ne pas dupliquer `groqName` ni `promptHint`** — restent côté serveur uniquement (mobile envoie juste `lang`)

---

## 🐛 PIÈGES SPÉCIFIQUES FRONTEND

| Piège | Solution |
|-------|----------|
| Build Vercel `useSearchParams` sans Suspense | Wrapper `<Suspense>` autour + `force-dynamic` si besoin |
| Stripe XOF avec ×100 | XOF est zero-decimal — pas de multiplication |
| `SUPABASE_SERVICE_ROLE_KEY` côté client | Uniquement dans API Routes serveur |
| CSP bloque `media-src` Supabase | Autorisé dans `next.config.js` pour vidéos portfolio |
| Groq retourne array au lieu d'object | Route `/api/translate` accepte les 2 formats (fallback array→index) |
| Créoles traduits en anglais | `looksEnglish()` filter + `promptHint` dans constants + `creoleEnforcement` dans le prompt |

---

*Dernière mise à jour : 2026-04-27*
