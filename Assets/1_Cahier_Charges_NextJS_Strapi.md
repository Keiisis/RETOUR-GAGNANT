# 📘 GUIDE TECHNIQUE COMPLET - NEXT.JS 14 + STRAPI + TYPESCRIPT

## 🎯 STACK TECHNIQUE MODERNE

```
FRONTEND
├── Next.js 14.2 (App Router)
├── React 18.3 + TypeScript 5.4
├── Tailwind CSS 3.4
├── Framer Motion 11 (animations)
├── GSAP 3.12 (animations avancées)
├── Lucide React (icônes)
└── Zustand 4.5 (state management)

BACKEND/CMS
├── Strapi 4.25 (Headless CMS)
├── Node.js 20 LTS
├── PostgreSQL 16
├── GraphQL + REST API
└── Cloudinary (médias)

DÉPLOIEMENT
├── Frontend: Vercel
├── Backend: Railway.app
├── Base de données: Railway PostgreSQL
├── CDN Médias: Cloudinary
└── Monitoring: Vercel Analytics + Sentry
```

---

## 🏗️ ARCHITECTURE DU PROJET

### Structure Frontend (Next.js)

```
retour-gagnant-benin/
├── app/
│   ├── (routes)/
│   │   ├── page.tsx                    # 🏠 Accueil
│   │   ├── services/
│   │   │   ├── page.tsx               # Liste services
│   │   │   └── [slug]/page.tsx        # Détail service
│   │   ├── culture/page.tsx           # Patrimoine
│   │   ├── rendez-vous/page.tsx       # Calendrier
│   │   ├── contact/page.tsx           # Contact
│   │   └── a-propos/page.tsx          # À propos
│   ├── api/
│   │   ├── appointments/route.ts      # API RDV
│   │   ├── contact/route.ts           # API Contact
│   │   └── webhook/strapi/route.ts    # Webhooks
│   ├── layout.tsx                      # Layout global
│   ├── globals.css                     # Tailwind
│   ├── providers.tsx                   # Context providers
│   └── not-found.tsx                   # 404
├── components/
│   ├── layout/
│   │   ├── Header.tsx                 # Navigation
│   │   ├── Footer.tsx                 # Pied de page
│   │   └── AudioPlayer.tsx            # 🎵 Audio autoplay
│   ├── home/
│   │   ├── HeroSection.tsx            # Hero animé
│   │   ├── StatsSection.tsx           # Compteurs
│   │   ├── ServicesGrid.tsx           # Grille services
│   │   └── TestimonialsCarousel.tsx   # Témoignages
│   ├── shared/
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Modal.tsx
│   │   └── LoadingSpinner.tsx
│   └── ui/                             # shadcn/ui
│       ├── button.tsx
│       ├── input.tsx
│       ├── calendar.tsx
│       └── ...
├── lib/
│   ├── strapi.ts                       # Client Strapi
│   ├── utils.ts                        # Helpers
│   ├── constants.ts                    # Constantes
│   └── hooks/
│       ├── useAudio.ts                 # Hook audio
│       ├── useScrollAnimation.ts       # Animations scroll
│       └── useAppointments.ts          # Gestion RDV
├── types/
│   ├── strapi.ts                       # Types Strapi
│   ├── models.ts                       # Models app
│   └── index.ts                        # Exports
├── public/
│   ├── audio/
│   │   └── benin-ambiance.mp3
│   ├── images/
│   └── fonts/
├── .env.local                          # Variables env
├── next.config.mjs                     # Config Next.js
├── tailwind.config.ts                  # Config Tailwind
├── tsconfig.json                       # Config TypeScript
└── package.json                        # Dépendances
```

### Structure Backend (Strapi)

```
strapi-backend/
├── src/
│   ├── api/
│   │   ├── service/
│   │   │   ├── content-types/
│   │   │   │   └── service/
│   │   │   │       └── schema.json
│   │   │   ├── controllers/
│   │   │   ├── routes/
│   │   │   └── services/
│   │   ├── appointment/
│   │   ├── contact-message/
│   │   ├── audio-setting/
│   │   └── site-setting/
│   ├── extensions/
│   └── plugins/
├── config/
│   ├── database.ts                     # PostgreSQL
│   ├── server.ts
│   ├── admin.ts
│   └── plugins.ts
├── public/
│   └── uploads/                        # Médias locaux
├── .env
└── package.json
```

---

## 🎵 AUDIO BACKGROUND - IMPLÉMENTATION COMPLÈTE

### 1. Composant AudioPlayer (Next.js)

```typescript
// components/layout/AudioPlayer.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AudioPlayerProps {
  src: string;
  volume?: number;
  autoplay?: boolean;
  loop?: boolean;
}

export default function AudioPlayer({ 
  src, 
  volume = 0.3, 
  autoplay = true,
  loop = true 
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Volume intelligent (25-30% pour ne pas agacer)
    audio.volume = volume;

    if (autoplay) {
      const playPromise = audio.play();
      
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
            console.log('🎵 Audio démarré automatiquement');
          })
          .catch((error) => {
            console.log('⚠️ Autoplay bloqué par le navigateur');
            
            // Fallback: lancer au premier clic/touch
            const handleFirstInteraction = () => {
              audio.play()
                .then(() => setIsPlaying(true))
                .catch(console.error);
              
              document.removeEventListener('click', handleFirstInteraction);
              document.removeEventListener('touchstart', handleFirstInteraction);
              document.removeEventListener('keydown', handleFirstInteraction);
            };
            
            document.addEventListener('click', handleFirstInteraction);
            document.addEventListener('touchstart', handleFirstInteraction);
            document.addEventListener('keydown', handleFirstInteraction);
          });
      }
    }

    // Pause quand l'utilisateur quitte l'onglet
    const handleVisibilityChange = () => {
      if (document.hidden) {
        audio.pause();
      } else if (isPlaying && !isMuted) {
        audio.play().catch(console.error);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [autoplay, volume, isPlaying, isMuted]);

  const toggleAudio = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      audio.play()
        .then(() => {
          setIsPlaying(true);
          setIsMuted(false);
        })
        .catch(console.error);
    } else {
      audio.pause();
      setIsPlaying(false);
      setIsMuted(true);
    }
  };

  return (
    <>
      {/* Hidden Audio Element */}
      <audio 
        ref={audioRef} 
        loop={loop} 
        preload="auto"
        className="hidden"
      >
        <source src={src} type="audio/mpeg" />
        <source src={src.replace('.mp3', '.ogg')} type="audio/ogg" />
      </audio>

      {/* Indicateur Visuel Subtil */}
      <motion.button
        onClick={toggleAudio}
        className="fixed top-5 right-5 z-50 w-12 h-12 rounded-full bg-blue-dark/80 backdrop-blur-lg flex items-center justify-center shadow-lg transition-transform"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        aria-label={isMuted ? "Activer le son" : "Désactiver le son"}
      >
        <AnimatePresence mode="wait">
          {!isMuted && isPlaying ? (
            <motion.div
              key="playing"
              initial={{ opacity: 0, rotate: -90 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: 90 }}
              className="flex gap-1 items-end h-5"
            >
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="w-1 bg-green-primary rounded-full"
                  animate={{
                    height: ['40%', '100%', '40%'],
                  }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    delay: i * 0.2,
                    ease: 'easeInOut',
                  }}
                />
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="muted"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
            >
              <VolumeX className="w-5 h-5 text-white" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </>
  );
}
```

### 2. Configuration Strapi pour Audio

```json
// strapi-backend/src/api/audio-setting/content-types/audio-setting/schema.json
{
  "kind": "singleType",
  "collectionName": "audio_settings",
  "info": {
    "singularName": "audio-setting",
    "pluralName": "audio-settings",
    "displayName": "Audio Settings",
    "description": "Configuration audio du site"
  },
  "options": {
    "draftAndPublish": false
  },
  "attributes": {
    "enabled": {
      "type": "boolean",
      "default": true,
      "required": true
    },
    "audioFile": {
      "type": "media",
      "multiple": false,
      "required": true,
      "allowedTypes": ["audios"]
    },
    "volume": {
      "type": "decimal",
      "min": 0,
      "max": 1,
      "default": 0.3,
      "required": true
    },
    "autoplay": {
      "type": "boolean",
      "default": true
    },
    "loop": {
      "type": "boolean",
      "default": true
    }
  }
}
```

### 3. Intégration dans Layout

```typescript
// app/layout.tsx
import { strapiApi } from '@/lib/strapi';
import AudioPlayer from '@/components/layout/AudioPlayer';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Récupérer config audio depuis Strapi
  const audioSettings = await strapiApi.getAudioSettings();
  const audioData = audioSettings.data.attributes;
  
  const audioSrc = audioData.enabled && audioData.audioFile?.data
    ? `${process.env.NEXT_PUBLIC_STRAPI_URL}${audioData.audioFile.data.attributes.url}`
    : null;

  return (
    <html lang="fr">
      <body>
        <Header />
        
        {/* Audio Background si activé depuis Strapi */}
        {audioSrc && (
          <AudioPlayer 
            src={audioSrc}
            volume={audioData.volume}
            autoplay={audioData.autoplay}
            loop={audioData.loop}
          />
        )}
        
        <main>{children}</main>
        
        <Footer />
      </body>
    </html>
  );
}
```

---

## 📊 SCHÉMA STRAPI COMPLET

### Collection Types

#### 1. Services

```json
{
  "kind": "collectionType",
  "collectionName": "services",
  "info": {
    "singularName": "service",
    "pluralName": "services",
    "displayName": "Service"
  },
  "options": {
    "draftAndPublish": true
  },
  "attributes": {
    "name": {
      "type": "string",
      "required": true,
      "unique": true
    },
    "slug": {
      "type": "uid",
      "targetField": "name",
      "required": true
    },
    "description": {
      "type": "richtext",
      "required": true
    },
    "icon": {
      "type": "string",
      "default": "📄",
      "required": true
    },
    "category": {
      "type": "enumeration",
      "enum": ["admin", "immobilier", "business"],
      "required": true
    },
    "price_from": {
      "type": "string",
      "required": true
    },
    "duration_minutes": {
      "type": "integer",
      "default": 60,
      "min": 15,
      "max": 480
    },
    "is_active": {
      "type": "boolean",
      "default": true
    },
    "order_position": {
      "type": "integer",
      "default": 0
    },
    "featured": {
      "type": "boolean",
      "default": false
    },
    "image": {
      "type": "media",
      "multiple": false,
      "allowedTypes": ["images"]
    },
    "benefits": {
      "type": "component",
      "repeatable": true,
      "component": "service.benefit"
    },
    "appointments": {
      "type": "relation",
      "relation": "oneToMany",
      "target": "api::appointment.appointment"
    }
  }
}
```

#### 2. Appointments

```json
{
  "kind": "collectionType",
  "collectionName": "appointments",
  "info": {
    "singularName": "appointment",
    "pluralName": "appointments",
    "displayName": "Rendez-vous"
  },
  "options": {
    "draftAndPublish": false
  },
  "attributes": {
    "user_name": {
      "type": "string",
      "required": true
    },
    "user_email": {
      "type": "email",
      "required": true
    },
    "user_phone": {
      "type": "string",
      "required": true
    },
    "scheduled_date": {
      "type": "datetime",
      "required": true
    },
    "duration_minutes": {
      "type": "integer",
      "default": 60
    },
    "status": {
      "type": "enumeration",
      "enum": ["pending", "confirmed", "completed", "cancelled"],
      "default": "pending"
    },
    "notes": {
      "type": "text"
    },
    "mode": {
      "type": "enumeration",
      "enum": ["visio", "presentiel"],
      "default": "visio"
    },
    "confirmation_sent": {
      "type": "boolean",
      "default": false
    },
    "reminder_sent": {
      "type": "boolean",
      "default": false
    },
    "service": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::service.service",
      "inversedBy": "appointments"
    },
    "documents": {
      "type": "media",
      "multiple": true,
      "allowedTypes": ["images", "files"]
    }
  }
}
```

#### 3. Contact Messages

```json
{
  "kind": "collectionType",
  "collectionName": "contact_messages",
  "info": {
    "singularName": "contact-message",
    "pluralName": "contact-messages",
    "displayName": "Message de Contact"
  },
  "attributes": {
    "name": {
      "type": "string",
      "required": true
    },
    "email": {
      "type": "email",
      "required": true
    },
    "phone": {
      "type": "string"
    },
    "service_interest": {
      "type": "enumeration",
      "enum": ["passeport", "nationalite", "logement", "construction", "investissement", "import-export", "autre"]
    },
    "message": {
      "type": "text",
      "required": true
    },
    "is_read": {
      "type": "boolean",
      "default": false
    },
    "replied": {
      "type": "boolean",
      "default": false
    },
    "ip_address": {
      "type": "string"
    }
  }
}
```

### Single Types

#### 1. Site Settings

```json
{
  "kind": "singleType",
  "collectionName": "site_settings",
  "info": {
    "singularName": "site-setting",
    "pluralName": "site-settings",
    "displayName": "Paramètres du Site"
  },
  "attributes": {
    "site_name": {
      "type": "string",
      "default": "RETOUR GAGNANT BENIN"
    },
    "tagline": {
      "type": "string"
    },
    "primary_color": {
      "type": "string",
      "default": "#28a745"
    },
    "secondary_color": {
      "type": "string",
      "default": "#ffc107"
    },
    "logo": {
      "type": "media",
      "multiple": false,
      "allowedTypes": ["images"]
    },
    "favicon": {
      "type": "media",
      "multiple": false,
      "allowedTypes": ["images"]
    },
    "seo": {
      "type": "component",
      "repeatable": false,
      "component": "shared.seo"
    },
    "social_links": {
      "type": "component",
      "repeatable": false,
      "component": "shared.social-links"
    }
  }
}
```

---

## 💰 BUDGET DÉTAILLÉ

### Développement (One-time)

| Poste | Heures | Tarif/h | Total |
|-------|--------|---------|-------|
| Setup & Architecture | 40h | 40€ | 1,600€ |
| Design UI/UX | 60h | 35€ | 2,100€ |
| Dev Frontend Next.js | 160h | 50€ | 8,000€ |
| Dev Backend Strapi | 120h | 45€ | 5,400€ |
| Intégrations (Email, SMS, Paiement) | 40h | 50€ | 2,000€ |
| Animations & Audio | 30h | 40€ | 1,200€ |
| Tests & QA | 40h | 35€ | 1,400€ |
| Déploiement & CI/CD | 20h | 50€ | 1,000€ |
| **TOTAL DÉVELOPPEMENT** | **510h** | - | **22,700€** |

**Soit environ 15,000,000 FCFA**

### Hébergement & Services (Mensuel)

| Service | Plan | Coût/mois |
|---------|------|-----------|
| **Vercel** (Frontend) | Pro | 20€ |
| **Railway** (Backend + DB) | Developer | 20€ |
| **Cloudinary** (Médias) | Free → Paid | 0-25€ |
| **SendGrid** (Email) | Essentials | 20€ |
| **Twilio** (SMS) | Pay as you go | ~30€ |
| **Sentry** (Monitoring) | Developer | 26€ |
| **Nom de domaine** .bj | - | 1.5€ |
| **TOTAL MENSUEL** | - | **~140€** |

**Soit environ 92,000 FCFA/mois**  
**Soit environ 1,100,000 FCFA/an**

### Budget Total Première Année

```
Développement :   15,000,000 FCFA
Hébergement :      1,100,000 FCFA
-------------------------
TOTAL :           16,100,000 FCFA (~24,500€)
```

---

## 📈 COMPARAISON DES STACKS

| Critère | Next.js + Strapi | Laravel | PHP Vanilla | WordPress |
|---------|------------------|---------|-------------|-----------|
| **Performance** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| **SEO** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Évolutivité** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |
| **Type Safety** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐ | ⭐⭐ |
| **DX** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |
| **Panel Admin** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐ | ⭐⭐⭐⭐⭐ |
| **Coût Hébergement** | 140€/mois | 20€/mois | 6€/mois | 15€/mois |
| **Temps Dev** | 10 semaines | 12 semaines | 20 semaines | 8 semaines |
| **Moderne** | ⭐⭐⭐⭐⭐ (2024) | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |

---

## 🚀 TIMELINE DE DÉVELOPPEMENT

### Semaine 1-2 : Setup & Architecture
- Configuration Next.js + TypeScript
- Configuration Strapi + PostgreSQL
- Setup CI/CD (Vercel + Railway)
- Configuration Cloudinary
- Design system initial

### Semaine 3-4 : Design & UI Components
- Maquettes Figma complètes
- Système de design (couleurs, typographie)
- Composants de base (Button, Card, Input, etc.)
- Layout (Header, Footer)
- Audio Player component

### Semaine 5-6 : Frontend Pages
- Page d'accueil avec Hero animé
- Page Services avec filtres
- Page Culture avec galerie
- Page À propos
- Page Contact avec formulaire

### Semaine 7-8 : Système de Rendez-vous
- Calendrier interactif
- Logique disponibilités
- Formulaire multi-étapes
- Intégration email/SMS confirmations
- Dashboard client basique

### Semaine 9 : Strapi Configuration
- Tous les content types
- Permissions et rôles
- Webhooks
- Media library
- Custom endpoints si nécessaire

### Semaine 10 : Tests & Optimisations
- Tests E2E
- Performance optimization
- SEO optimization
- Accessibilité (A11y)
- Cross-browser testing

### Semaine 11 : Déploiement
- Configuration production
- Migration données
- Tests finaux
- Formation client
- Go Live

**TOTAL : 11 semaines (~2.5 mois)**

---

## ✅ AVANTAGES CLÉS DE CETTE STACK

### 1. Performance Exceptionnelle
- **SSR/SSG natif** → Temps de chargement <1s
- **Image Optimization** → Automatic WebP/AVIF
- **Code Splitting** → Charge uniquement le nécessaire

### 2. SEO Parfait
- **Server-Side Rendering** → Google indexe tout
- **Métadonnées dynamiques** → Optimisation par page
- **Sitemap auto** → SEO technique parfait

### 3. Panel Admin Moderne
- **Strapi** = WordPress moderne
- Interface intuitive
- Gestion médias puissante
- API auto-générée

### 4. Developer Experience
- **TypeScript** → Moins de bugs
- **Hot Reload** → Développement rapide
- **Documentation** → Excellente communauté

### 5. Évolutivité
- Ajout de features facile
- Architecture modulaire
- Scalabilité horizontale

---

*Guide technique v1.0 - Next.js 14 + Strapi 4 - Février 2026*
