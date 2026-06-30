# WAF — Variables d'environnement

Variables à définir dans Vercel (Project Settings → Environment Variables).

## 🔴 Anti-spoofing IP (IMPORTANT en production)

```
WAF_TRUE_IP_HEADER=x-vercel-forwarded-for
```

**Pourquoi** : sans header autoritaire épinglé, un attaquant peut envoyer un faux
`X-Forwarded-For` / `X-Real-IP` pour usurper une IP (évasion de ban) ou faire
bannir un tiers (déni de service par empoisonnement).

Quand `WAF_TRUE_IP_HEADER` est défini, le WAF ne fait confiance **qu'à ce header**
(celui que la plateforme/CDN contrôle et que le client ne peut pas falsifier) :

| Hébergement / CDN | Valeur recommandée |
|-------------------|--------------------|
| **Vercel** (direct) | `x-vercel-forwarded-for` |
| **Cloudflare** devant | `cf-connecting-ip` |
| Autre reverse-proxy de confiance | le header que VOTRE proxy réécrit |

> Header absent/invalide → l'IP devient `unknown` (traitée prudemment), **jamais**
> de repli sur un header spoofable.

## 🟠 Bypass d'urgence

```
WAF_EMERGENCY_BYPASS=true     # désactive TOUT le WAF (l'auth Supabase reste active)
```
À n'utiliser qu'en cas d'incident (faux positifs massifs). Retirer ensuite.

## 🟢 Cron (notifications docs expirés, etc.)

```
CRON_SECRET=<chaîne aléatoire longue>
```
Protège les endpoints `/api/cron/*` (vérifiés via `Authorization: Bearer <CRON_SECRET>`).

## ⚡ Store partagé distribué (optionnel — recommandé en prod)

Pour un rate-limiting et des bans **cross-instance** (sinon l'état RAM est par
instance Vercel, cf. limite serverless documentée), branchez Upstash Redis. Le
SDK `keyso-waf` fournit l'adapter ; à câbler côté projet si souhaité :

```
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx
```

Sans ces variables, le WAF retombe sur la **mémoire locale RAM** (3ᵉ filet) :
les récidivistes sont bloqués par instance, et le court-circuit anti-DoS évite la
saturation de Supabase.
