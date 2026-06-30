# WAF Core — Cœur portable (extractible & commercialisable)

> Ce dossier (`lib/waf/core/`) est conçu pour être **extrait** vers un repo
> indépendant et publié comme SDK de sécurité (`@yourorg/waf-core`), puis
> réutilisé pour bâtir des plugins WordPress, PHP, Next.js, Express, etc.

## Principe : Core pur + Adapters jetables

```
lib/waf/
├── core/                      ← LE PRODUIT. Zéro dépendance framework/DB.
│   ├── body-scanner.ts        Analyse structurelle (proto pollution, RCE, SSRF, DoS)
│   └── ownership.ts           Autorisation objet (anti-IDOR/BOLA) — datastore injecté
└── adapters/                  ← Couche de COLLE, réécrite par plateforme.
    ├── supabase-ownership.ts  Resolver de propriété sur Supabase/Postgres
    └── nextjs.ts              Lecture de body + NextResponse
```

**Règle d'or** : le `core/` n'importe JAMAIS d'un framework ou d'une base
de données. Toute I/O passe par une fonction injectée (`OwnershipResolver`).
C'est ce qui rend le produit portable.

## Les deux protections

### 1. `scanBody` — analyse structurelle (anti-IDOR du contenu)

Détecte ce qui ne passe pas par l'URL :
- **Prototype Pollution** : clés `__proto__`, `constructor`, `prototype`
- **RCE / désérialisation** : `child_process`, `require(`, `eval(`, gadgets `node-serialize`, SSTI
- **SSRF dans les valeurs** : IP internes (parsing octet correct, pas de match substring), cloud metadata, schémas `gopher://`/`file://`
- **DoS structurel** : profondeur récursive, explosion de clés/tableaux, strings géantes

```ts
import { scanBody } from './core/body-scanner'
const verdict = scanBody(JSON.parse(rawBody))
if (!verdict.safe) block(verdict.threat) // 'prototype_pollution' | 'rce_gadget' | ...
```

### 2. `verifyOwnership` — autorisation au niveau objet (anti-IDOR/BOLA réel)

Répond à : *« cet utilisateur a-t-il le droit de toucher CETTE ressource ? »*
Contrairement à la détection d'énumération (`idor.ts`), ceci bloque l'accès
**ciblé unique** (user 42 lit la facture de user 1, même une seule fois).

```ts
import { verifyOwnership } from './core/ownership'
const verdict = await verifyOwnership(resolver, {
  userId, resourceType: 'invoice', resourceId: '42',
})
if (!verdict.allowed) block() // decision: 'foreign' | 'not_found_denied'
```

Le `resolver` est injecté → c'est lui qu'on réécrit par plateforme.

## Porter le WAF sur une autre plateforme

| Plateforme | Ce qu'on garde | Ce qu'on réécrit |
|------------|----------------|------------------|
| **Next.js + Supabase** | `core/` | `adapters/nextjs.ts`, `adapters/supabase-ownership.ts` |
| **WordPress** | `core/` (port PHP du ruleset) | resolver `wpdb` (`$wpdb->get_var`) + hook `rest_pre_dispatch` |
| **PHP / Laravel** | `core/` (port PHP) | resolver PDO + middleware |
| **Express + Prisma** | `core/` (tel quel) | resolver Prisma + middleware Express |

Pour WordPress/PHP, le `body-scanner` se porte en réimplémentant le **ruleset**
(les constantes `POLLUTION_KEYS`, `RCE_SIGNATURES`, `isInternalHost`) — la logique
est language-agnostic. Pour `ownership`, on réimplémente l'interface
`OwnershipResolver` avec la couche d'accès aux données native.

## Garanties du core

- **Ne lève jamais** : toute fonction renvoie un verdict, jamais d'exception.
- **Fail-closed** sur l'ownership : erreur resolver → accès refusé (pas de fuite).
- **Pas d'état global** : `scanBody`/`verifyOwnership` sont des fonctions pures
  (l'état comportemental — rate, énumération — vit dans les autres modules WAF).
- **Zéro dépendance runtime** dans `core/` (seul `adapters/` importe le framework).
