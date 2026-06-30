Effectue un audit de synchronisation entre l'application mobile et le site web.

## Vérifications à effectuer

### 1. Services (CRITIQUE)
Compare les données dans :
- Web : `frontend/app/(routes)/services/[slug]/page.tsx` → `FALLBACK_SERVICES`
- Mobile : `mobile/src/screens/main/ServicesScreen.tsx` → `SERVICES_DATA`
Vérifie que les 9 services ont les MÊMES : titres, descriptions, prix, features, documents, pricing_options.

### 2. À Propos
Compare :
- Web : `frontend/app/(routes)/a-propos/page.tsx`
- Mobile : `mobile/src/screens/main/AboutScreen.tsx`
Vérifie : texte mission, valeurs, équipe.

### 3. FAQ
Vérifie que les questions/réponses du mobile correspondent au contenu du site.

### 4. URLs et emails
Cherche dans TOUS les fichiers mobile : `grep -r "retour-gagnant.com" mobile/src/`
Tout doit pointer vers `retourgagnantbenin.bj`.

### 5. Design System
Vérifie que le fichier `mobile/src/config/theme.ts` utilise les bonnes couleurs :
- gold: #C9A84C
- background: #FAF8F4
- headerBg: #1B2A4A

## FORMAT
Présente les résultats :
- ✅ Sync OK pour chaque élément vérifié
- ❌ Désynchronisé pour chaque écart trouvé (avec détail)
- 🔧 Commandes à exécuter pour corriger
