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

## 🎨 DESIGN SYSTEM v2 — DRAPEAU DU BÉNIN SUR BLANC

**Direction artistique validée le 2026-07-28** (3 maquettes de référence dans `design/mobile-v2/`).
Le blanc porte la mise en page ; les 3 couleurs du drapeau servent d'accents, jamais de fond plein.
Aucun fond sombre nulle part — règle absolue.

| Rôle | Valeur | Usage |
|---|---|---|
| Vert Bénin | `#008751` | Accent principal, CTA, onglet actif |
| Vert foncé | `#00643C` | Titres sur vert, états pressés secondaires |
| Vert doux | `#E6F3ED` | Fonds de badge / tuiles d'icône |
| Jaune Bénin | `#FCD116` | Accent secondaire, barre drapeau |
| Jaune doux / encre | `#FEF7DC` / `#8A6D08` | Fond de badge / texte lisible dessus |
| Rouge Bénin | `#E8112D` | Alertes, barre drapeau |
| Rouge doux | `#FDECEA` | Fond d'alerte |
| Blanc / neutre | `#FFFFFF` / `#F5F5F5` | Fond d'écran / surface alternée |
| Encre | `#3C3C3C` / `#505050` / `#8A8A8A` | Texte principal / secondaire / discret |
| Lignes | `#F0F0F0` / `#E4E4E4` | Séparateurs / bordures marquées |
| Flottant | `#3C3C3C` | Pilule de tab bar uniquement |

- Fichier de référence unique : `mobile/src/config/theme.ts` — les tokens `v2` sont la vérité,
  `screenColors` expose les 52 clés historiques mappées dessus (rétrocompatibilité).
- **Aucune palette locale dans les écrans.** Interdit de réintroduire un `const C = { ... }` :
  importer `screenColors` depuis le thème.
- Polices : **Plus Jakarta Sans** (400/500/600/700/800, body + UI) + Playfair Display Bold (titres éditoriaux).
- Rayons : 8 / 12 / 14 / 16 / 20 / 24 / pill. Ombres teintées (`shadows.card`, `cardRaised`, `floating`).
- Primitives partagées : `mobile/src/components/ui.tsx` — `FlagBar`, `ScreenHeader`, `Card`,
  `Button`, `Badge`, `IconTile`, `EmptyState`, `SectionTitle`.
- Tab bar : pilule flottante anthracite, icônes seules + point vert d'état actif.

> Exceptions tolérées (couleurs de marque tierces, pas de la charte) : `#EB001B` (logo Mastercard),
> `#2C3E50` (couleur d'avatar). Ne pas les étendre.

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

| Status | Label | Couleur (token thème) |
|--------|-------|---------|
| `soumis` | Dossier soumis | `info` (#00643C) |
| `verifie` | En cours de vérification | Violet (#7C5CCA) |
| `traitement` | En traitement | `gold` / jaune Bénin (#FCD116) |
| `validation` | En validation | Orange (#E07B54) |
| `termine` | Terminé | `success` / vert Bénin (#008751) |
| `annule` | Annulé | `danger` / rouge Bénin (#E8112D) |

> Toujours lire ces couleurs via `screenColors` / `colors` du thème, jamais en dur dans l'écran.

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
| **Micro impossible à autoriser (appel vocal)** — Android n'affichait aucune entrée « Microphone » dans les autorisations | `expo-image-picker` configuré avec `"microphonePermission": false` : son plugin appelle alors `withBlockedPermissions(['android.permission.RECORD_AUDIO'])`, ce qui écrit `tools:node="remove"` dans le manifeste. Le fusionneur Gradle **supprime** la permission de l'APK, **même quand un autre plugin l'ajoute** (ici `@config-plugins/react-native-webrtc`). Un blocage gagne toujours. | Donner une **description en clair** à `microphonePermission`, jamais `false`, dès lors qu'une fonctionnalité de l'app a besoin du micro. Vérifier avec `grep 'tools:node="remove"' android/app/src/main/AndroidManifest.xml` → doit renvoyer 0. ⚠️ Chercher le seul nom de la permission ne prouve RIEN : il apparaît aussi dans la directive de suppression. |

---

## 🎙️ APPEL VOCAL — pourquoi expo-doctor est mis en sourdine sur 2 paquets

`react-native-webrtc` et `react-native-incall-manager` sont exclus du contrôle
`reactNativeDirectoryCheck` dans `package.json`. **Ce n'est pas une suppression
d'alerte de confort — voici l'enquête qui l'a justifiée.**

L'annuaire React Native les marque « untested on New Architecture ». Ce libellé
signifie *« personne n'a soumis de résultat de test »*, pas *« incompatible »* :
c'est une métadonnée communautaire, pas une propriété du code.

Vérifié dans les sources installées :

```
WebRTCModule        extends ReactContextBaseJavaModule   ← API bridge classique
WebRTCModulePackage implements ReactPackage
InCallManagerModule extends ReactContextBaseJavaModule
```

Aucune des deux ne déclare de `codegenConfig`. Elles fonctionnent donc par la
**couche d'interopérabilité** que React Native fournit délibérément pour
l'écosystème legacy sous nouvelle architecture.

Alternatives examinées au registre npm — **aucune ne fait mieux** :

| Paquet | Version | Nouvelle archi |
|---|---|---|
| `react-native-webrtc` | 124.0.8 | non déclarée |
| `@livekit/react-native-webrtc` | 144.1.2 | non déclarée |
| `@stream-io/react-native-webrtc` | 145.1.1 | non déclarée |

LiveKit et Stream vendent de la vidéo temps réel et maintiennent leurs propres
forks : si une implémentation WebRTC nativement TurboModule existait pour React
Native, ce serait la leur. **Il n'y en a aucune.** Changer de fork ne
supprimerait pas l'avertissement et remplacerait le moteur d'appel sans gain.

⚠️ L'exclusion est **nominative** : tout AUTRE paquet incompatible sera toujours
signalé. Ne jamais élargir cette liste sans refaire l'enquête ci-dessus.

À réexaminer si `react-native-webrtc` publie un jour un `codegenConfig` :
retirer alors l'exclusion.

---

## 🔧 CHECKLIST PRÉ-COMMIT

- [ ] `npx tsc --noEmit` → 0 erreur
- [ ] Les 9 services sont identiques web et mobile
- [ ] Les `pricing_options` sont présentes sur chaque service
- [ ] `KkiapayModal` utilise `useKkiapay()` (SDK natif), pas `Linking` ni WebView
- [ ] `<KkiapayProvider>` wrap App dans `App.tsx`
- [ ] Les types dans `RootStackParamList` matchent les params passés
- [ ] Pas d'import du composant `<T>` (supprimé) — utiliser `useLang().t()` direct
- [ ] Aucune palette locale (`const C = {`) dans un écran — importer `screenColors` du thème
- [ ] Aucun fond sombre ni couleur hors charte v2 (hors exceptions marque documentées)

---

*Dernière mise à jour : 2026-07-28 — refonte design system v2 (drapeau du Bénin sur blanc)*
