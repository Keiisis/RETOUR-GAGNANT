'use client'

/* ══════════════════════════════════════════════════════════════
   BLOG — espace AGENT.

   Le même écran que /admin/blog, RÉ-EXPORTÉ et non recopié. La page fait près
   de mille lignes : en garder deux copies aurait garanti qu'elles divergent —
   une barre d'outils enrichie d'un côté, un champ SEO ajouté de l'autre, et
   deux blogs qui ne se ressemblent plus.

   LES DROITS NE VIENNENT PAS DE CETTE PAGE. L'écran parle directement à
   Supabase ; c'est la sécurité au niveau des lignes (RLS) de `blog_posts` qui
   décide. Vérifié en conditions réelles avec un compte porteur du rôle
   « agent » : insertion, modification et suppression sont autorisées. Il ne
   manquait donc que le chemin pour y arriver — exactement comme pour les
   récaps MyAfroOrigins.
   ══════════════════════════════════════════════════════════════ */
export { default } from '@/app/admin/blog/page'
