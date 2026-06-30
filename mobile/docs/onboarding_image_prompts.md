# 🎨 Prompts Images — Onboarding Retour Gagnant Bénin

Prompts exacts pour générer les 3 images de l'onboarding avec un outil IA (Midjourney, DALL-E, Gemini, etc.)

---

## Slide 1 — "Vos Racines" (Accent: Vert Bénin `#009639`)

> **Prompt:**
> Cinematic portrait of a confident African diaspora woman in her 30s, standing at an airport departure gate, looking through floor-to-ceiling windows at a sunset sky. She holds a passport close to her chest with both hands, eyes full of emotion and determination. Warm golden hour lighting, bokeh lights in background. Deep warm tones — amber, gold, sienna. Shot on 85mm lens, shallow depth of field. Editorial photography style, premium luxury feel. No text.

**Image temporaire Unsplash:** `photo-1523824921871-d6f1a15151f1`

**Texte affiché :**
- Kicker : VOS RACINES
- Titre : Retrouvez votre terre d'origine
- Description : Vous êtes Afro-descendant et le Bénin vous appelle. Retour Gagnant vous accompagne pour reconnecter avec vos racines.

---

## Slide 2 — "Votre Dossier" (Accent: Jaune Bénin `#FCD116`)

> **Prompt:**
> Cinematic overhead shot of official documents, a Beninese passport, and a gold pen on a beautiful dark mahogany desk. A pair of hands are carefully organizing stamped papers. Warm ambient lighting from a desk lamp casting soft shadows. Elements include: an official stamp, a small Beninese flag pin, and a gold-accented leather folder. Colors: warm mahogany, cream paper, gold accents. Premium editorial photography style, luxury law office atmosphere. No text, no faces.

**Image temporaire Unsplash:** `photo-1450101499163-c8848c66ca85`

**Texte affiché :**
- Kicker : VOTRE DOSSIER
- Titre : Nationalité, passeport, simplifié
- Description : Démarches administratives, obtention de la nationalité béninoise, passeport — notre expertise VIP transforme le complexe en simple.

---

## Slide 3 — "Votre Retour" (Accent: Rouge Bénin `#EF2B2D`)

> **Prompt:**
> Cinematic wide shot of a joyful African family reunion at a beautiful Beninese coastal landscape at golden hour. A person arriving with open arms being welcomed by family members. Lush green tropical vegetation, traditional colorful fabrics (wax print Ankara), warm embracing atmosphere. The Atlantic ocean and palm trees visible in the background with a stunning orange and gold sunset. Rich warm colors — emerald green, gold, terracotta. Shot in editorial documentary style, emotionally powerful, premium feel. No text.

**Image temporaire Unsplash:** `photo-1516026672322-bc52d61a55d5`

**Texte affiché :**
- Kicker : VOTRE RETOUR
- Titre : Bienvenue chez vous, au Bénin
- Description : Au-delà des papiers, c'est une nouvelle vie qui commence. Installation, communauté, héritage — votre retour gagnant.

---

## Couleurs d'accent — Drapeau du Bénin

- 🟢 Slide 1 : `#009639` (Vert)
- 🟡 Slide 2 : `#FCD116` (Jaune)
- 🔴 Slide 3 : `#EF2B2D` (Rouge)

## Comment utiliser les prompts

1. Copier le prompt dans Midjourney, DALL-E ou Gemini Image
2. Générer l'image en **1024x1792** (format portrait mobile)
3. Sauvegarder dans `mobile/assets/onboarding/` sous les noms :
   - `slide_1_roots.jpg`
   - `slide_2_process.jpg`  
   - `slide_3_home.jpg`
4. Remplacer les URLs Unsplash par `require('../../assets/onboarding/slide_X.jpg')` dans `OnboardingScreen.tsx`
