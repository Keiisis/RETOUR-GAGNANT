# RETOUR GAGNANT — Mémoire Application Mobile

> Sous-mémoire dédiée à l'application mobile Expo (React Native).
> Lire `CLAUDE.md` à la racine pour le contexte projet complet.

---

## 📱 STACK TECHNIQUE MOBILE

| Technologie | Version | Usage |
|---|---|---|
| Expo | SDK 54 | Framework React Native |
| React Native | 0.81.5 | UI natif |
| React | 19.1.0 | UI |
| TypeScript | 5.9.x | Typage strict |
| @supabase/supabase-js | 2.x | Backend/Auth/Storage |
| @react-navigation/native | 7.x | Navigation (Stack + Tabs) |
| **lucide-react-native** | 1.x | Icônes principales (migration depuis Ionicons) |
| @expo/vector-icons (Ionicons) | 15.x | Fallback / icônes Services |
| expo-document-picker | 14.x | Upload fichiers |
| expo-image-picker | 17.x | Galerie + Caméra |
| expo-linking | (intégré) | Deep Links (legacy v1, conservé pour fallback) |
| expo-notifications | 0.32.x | Notifications push |
| expo-secure-store | 15.x | Stockage sécurisé credentials |
| **@kkiapay-org/react-native-sdk** | 0.1.x | Paiement Mobile Money / Carte (widget natif in-app, Android + iOS) |
| react-native-webview | 13.x | Dépendance interne du SDK Kkiapay |
| @react-native-async-storage | 2.x | Stockage local (onboarding flag, lang, cache traductions) |

> ⚠️ **Build : dev build obligatoire** (`expo-dev-client` actif).
> Plus de support Expo Go — le SDK Kkiapay nécessite des modules natifs (Android Java + iOS Swift).
> Commande : `eas build --profile development --platform android` (et `--platform ios`).

---

## 🎨 DESIGN SYSTEM = NEXUS EMERALD (Mode CLAIR)

**Charte mobile = identique au site web après migration thème sombre→clair.**
- Fond : `#FFFFFF` (blanc), surfaces `#F8FAF9` (légèrement teintée)
- Primary : `#10B981` (émeraude) — accent principal
- Accent : `#C9A84C` (or premium)
- Texte : `#1a2332` (jamais `#000`)
- Header : `#10B981` (primary, pour ressortir sur fond blanc)

Fichier de référence : `mobile/src/config/theme.ts`.
Polices : Outfit (body) + Playfair Display (titres) — chargées dans `App.tsx`.

---

## 🧭 NAVIGATION

```text
AppNavigator (Stack)
├── OnboardingScreen (première ouverture uniquement)
├── LoginScreen / RegisterScreen / ForgotPasswordScreen (si pas connecté)
└── MainTabNavigator (si connecté)
    ├── Tab "Accueil"     → HomeScreen
    ├── Tab "Services"    → ServicesScreen
    ├── Tab "Dossier"     → DossierScreen
    ├── Tab "Événements"  → EventsScreen
    └── Tab "Profil"      → ProfilScreen

    + Stack screens (poussés par-dessus les tabs) :
    ├── ServiceDetails ← Depuis ServicesScreen
    ├── EventDetail    ← Depuis EventsScreen
    ├── EditProfil     ← Depuis ProfilScreen
    ├── Security       ← Depuis ProfilScreen
    ├── Notifications  ← Depuis HomeScreen
    ├── Payments       ← Depuis HomeScreen
    ├── Appointments   ← Depuis HomeScreen
    ├── FAQ            ← Depuis ProfilScreen
    └── About          ← Depuis ProfilScreen
```

---

## 🔄 SYNCHRONISATION WEB ↔ MOBILE

### Règle fondamentale
**Le site web est la SOURCE DE VÉRITÉ.** Le mobile doit TOUJOURS refléter les mêmes données.

### Fichiers jumeaux (à modifier EN PAIRE)

| Web | Mobile | Données |
|-----|--------|---------|
| `frontend/app/(routes)/services/[slug]/page.tsx` → `FALLBACK_SERVICES` | `mobile/src/screens/main/ServicesScreen.tsx` → `SERVICES_DATA` | 9 services complets |
| `frontend/components/home/HeroSection.tsx` | `mobile/src/screens/main/HomeScreen.tsx` | Contenu accueil |
| `frontend/lib/translation/constants.ts` | `mobile/src/contexts/LangContext.tsx` → `SUPPORTED_LANGUAGES` | Codes/labels langues uniquement |

### Données synchronisées par service

Chaque service dans `SERVICES_DATA` doit avoir :
- `id` (slug) — identique au web
- `title` — identique
- `subtitle` — identique
- `desc` — court, pour les cartes
- `fullDescription` — long, identique au web
- `features[]` — liste identique au web
- `documents[]` — liste des pièces à fournir
- `pricing_options[]` — `{ label, price }` identique au web
- `price` — prix affiché (identique au web)
- `color` — couleur du service
- `icon` — nom Lucide React (avec fallback Ionicons pour certaines icônes spécifiques)

---

## 🌍 TRADUCTION — LangContext (mobile)

### Architecture
- `<LangProvider>` dans `App.tsx` (wrappé autour de `AppNavigator`)
- Hook `useLang()` retourne `{ lang, langConfig, setLang, t, isTranslating, preloadTexts, retryFailed, clearCache }`
- Pattern dans les screens : `const { t } = useLang()` puis `t('texte FR')` dans les `<Text>`
- **Pas de composant `<T>`** sur mobile (supprimé — `t()` direct est plus efficace)
- API : `POST /api/translate` (route web, plus de route mobile dédiée)

### Cache versionné
```ts
const CACHE_VERSION = 2  // Bumper pour forcer purge sur tous les phones
```
- Stocké dans `AsyncStorage` sous clé `@rg_trans_cache_<lang>`
- Version sous `@rg_trans_cache_version_<lang>`
- Purge automatique si mismatch de version

### Anti-loop
- `failedForever` Set : textes qui ont échoué après `MAX_RETRIES = 1` retry
- `t()` ne re-queue jamais ces textes
- `AppState` listener : sur `'active'`, `retryFailed()` déclenche un re-essai (utile après reconnexion réseau)

### Performance
- `CHUNK_SIZE = 10` (anti rate-limit Groq)
- 300ms entre chunks
- `FETCH_TIMEOUT = 15s` par chunk (`AbortController`)
- Debounce `t()` : 200ms (laisse le temps à un mount complet de queuer ses textes)
- `preloadTexts(texts[])` : flush immédiat (sans debounce) — pour textes critiques

### 6 langues
FR (défaut, source) / EN / ES / PT / CR (Antillais) / HT (Haïtien)
> Les Créoles bénéficient de `promptHint` côté serveur (exemples Kréyòl/Kreyòl) + détection `looksEnglish()` anti-fallback.

---

## 💳 PAIEMENT KKIAPAY — Architecture v2 (SDK natif)

**Évolution v1 → v2** :
- v1 : `Linking.openURL()` ouvrait `/mobile-payment` dans le navigateur, retour via deep link
- v2 (actuel) : **Widget natif in-app** via `@kkiapay-org/react-native-sdk` — Android + iOS
- Plus user-friendly, retour instantané, callbacks JS directs

### Pourquoi React Native SDK (pas natif Android/iOS séparé)
Kkiapay propose 3 SDK : Android (`co.opensi.kkiapay:kkiapay`), iOS Swift, et React Native.
**Le SDK React Native est un wrapper officiel** qui bridge automatiquement vers les SDK natifs Android + iOS.
→ **Un seul code, deux plateformes**, pas besoin d'écrire de Java/Swift, pas besoin d'éjecter Expo.
Le dev build (`expo-dev-client`) embarque les modules natifs automatiquement à chaque `eas build`.

```text
┌──────────────────────────┐                    ┌─────────────────┐
│  Mobile App (dev build)  │                    │  Kkiapay        │
│                          │                    │                 │
│  KkiapayProvider (App)   │                    │                 │
│   └─ KkiapayModal        │                    │                 │
│       ├─ useKkiapay() hook                    │                 │
│       │   ├─ openKkiapayWidget()  ──────────▶│  Widget natif   │
│       │   │   { amount, key, sandbox, ... }  │  (in-app, MoMo  │
│       │   ├─ addSuccessListener  ◀───────────│   /Carte/Visa)  │
│       │   └─ addFailedListener   ◀───────────│                 │
│       │                                       │                 │
│  onSuccess(transactionId)│                    │                 │
│   └─ POST /api/mobile/dossiers (créer dossier en DB)            │
└──────────────────────────┘                    └─────────────────┘
```

### Configuration Supabase `settings`
| Clé | Valeur | Effet |
|-----|--------|-------|
| `kkiapay_public_key` | string | Clé API publique Kkiapay |
| `kkiapay_sandbox` | `'true'` / `'false'` | Mode test (`true`) ou prod (`false`) |

### Contraintes techniques (v2)
- ✅ **Dev build obligatoire** (Expo Go incompatible — module natif)
- ✅ Listeners `addSuccessListener` / `addFailedListener` enregistrés **une seule fois** au mount, callbacks via `useRef` (pas de stale closure, pas de listener orphelin — le SDK n'expose pas de `removeListener`)
- ✅ Mode sandbox/prod **lu depuis Supabase**, jamais hardcodé
- ✅ `<KkiapayProvider>` doit wrapper `App.tsx` au-dessus du Navigator pour que `useKkiapay()` fonctionne

### Permissions
- **Android** : `INTERNET` (déjà par défaut), `ACCESS_NETWORK_STATE`
- **iOS** : aucune permission spécifique (le SDK utilise WKWebView interne)

---

## 📊 STATUTS DE DOSSIER

```text
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

## 🐛 BUGS RÉSOLUS (ne pas réintroduire)

| Bug | Cause | Solution |
|-----|-------|----------|
| Listeners Kkiapay doublés au remount | `addSuccessListener` dans useEffect avec deps `[]` capturait `onSuccess` en stale closure | Ref `onSuccessRef` mise à jour à chaque render, listener enregistré une seule fois |
| Numéro WhatsApp placeholder `22990000000` | Valeur de dev oubliée | Remplacé par numéro agence `2290160322121` |
| API_BASE divergent (avec/sans `www.`) | 5 fichiers, 2 conventions | Standardisé `https://www.retourgagnantbenin.bj` |
| Sandbox Kkiapay hardcodé `false` | Pas de toggle pour les tests | Lu depuis `settings.kkiapay_sandbox` Supabase |
| Cache Créole corrompu (anglais stocké comme créole) | Groq fallback sur l'anglais avant `promptHint` | `CACHE_VERSION = 2` purge auto + `looksEnglish()` côté serveur |
| Boucle infinie de re-tentatives traduction réseau coupé | Pas de circuit-breaker | `failedForever` Set + `MAX_RETRIES = 1` + retry sur `AppState` foreground |
| Stale closure dans `flushBatch` | Closure capturait `cache`/`lang` initiaux | `cacheRef` + `langRef` |
| Services différents web/mobile | Données hardcodées différentes | Synchro manuelle `SERVICES_DATA` ↔ `FALLBACK_SERVICES` |

---

## 🔧 CHECKLIST PRÉ-COMMIT

- [ ] `npx tsc --noEmit` → 0 erreur
- [ ] Les 9 services sont identiques web et mobile
- [ ] Les `pricing_options` sont présentes sur chaque service
- [ ] `KkiapayModal` utilise `useKkiapay()` (SDK natif), pas `Linking` ni WebView
- [ ] `<KkiapayProvider>` wrap App dans `App.tsx`
- [ ] Les types dans `RootStackParamList` matchent les params passés
- [ ] Pas d'import du composant `<T>` (supprimé) — utiliser `useLang().t()` direct

---

*Dernière mise à jour : 2026-04-27*
