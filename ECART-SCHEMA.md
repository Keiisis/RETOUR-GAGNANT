# Écart entre le CODE et la BASE réelle

> Régénérer : `node scripts/audit-schema.mjs` depuis `frontend/`.
> Le schéma réel est relu via l'API OpenAPI de PostgREST (`scripts/schema-reel.json`).

## État au 2026-08-18

- **120 → 107 occurrences** après alignement du code (13 corrigées).
- La migration `supabase/migrations/20260818_alignement_schema.sql` traite les
  manques RÉELS restants. **Ce fichier ne reflétera la correction qu'une fois la
  migration exécutée** dans Supabase.

## Comment lire

- **[select] / [filtre] / [order]** : PostgREST rejette la requête ENTIÈRE dès
  qu'un seul nom est inconnu. L'écran ne reçoit alors RIEN, sans erreur visible.
  C'est ce qui rendait les événements invisibles et bloquait les compteurs à 00.
- **[insert] / [update]** : l'écriture échoue, souvent en silence.

## Limites connues de l'outil — À VÉRIFIER AVANT DE CORRIGER

1. **Clés d'objets JSON comptées comme des colonnes.** Les lignes `items` d'une
   facture (`documents_financiers`), les étapes (`dossier_tracking.etapes`) ou
   les pièces manquantes (`nationality_applications.missing_docs`) sont des
   objets DANS une colonne `jsonb`, pas des colonnes. La majorité des 107
   occurrences restantes est de cette nature.
2. **Buckets de stockage.** `supabase.storage.from('bucket')` n'est pas une
   table. `nationality_documents` et `dossier-documents` sont des BUCKETS :
   ils apparaissent à tort comme des tables absentes.
3. **Tables réellement absentes mais non fatales** : `ai_proposals`, `leads`,
   `nationalite_requests`. supabase-js renvoie une erreur sans lever
   d'exception — la page fonctionne, elle perd seulement cette source.

══ COLONNES DEMANDÉES PAR LE CODE, ABSENTES DE LA BASE ══

▸ client_documents  (2)
    storage_path  [insert]  app/client/dossier/page.tsx
    storage_path  [select]  app/client/dossier/page.tsx
▸ client_profiles  (3)
    push_token  [select]  app/api/notifications/push/route.ts
    push_token  [update]  ../mobile/src/utils/pushToken.ts
    push_token_updated_at  [update]  ../mobile/src/utils/pushToken.ts
▸ clotures_audit  (1)
    reopen_count  [insert]  app/api/admin/comptabilite/cloture/route.ts
▸ document_templates  (4)
    footer  [update]  app/admin/settings/erp/page.tsx
    header  [update]  app/admin/settings/erp/page.tsx
    signature_name  [update]  app/admin/settings/erp/page.tsx
    signature_title  [update]  app/admin/settings/erp/page.tsx
▸ documents_financiers  (10)
    description  [insert]  app/admin/facturation/create/page.tsx
    description  [insert]  app/api/admin/avoirs/route.ts
    facture  [insert]  app/api/admin/avoirs/route.ts
    quantity  [insert]  app/admin/facturation/create/page.tsx
    quantity  [insert]  app/api/admin/avoirs/route.ts
    tva  [insert]  app/admin/facturation/create/page.tsx
    tva  [insert]  app/api/admin/avoirs/route.ts
    unit_cost  [insert]  app/admin/facturation/create/page.tsx
    unit_price  [insert]  app/admin/facturation/create/page.tsx
    unit_price  [insert]  app/api/admin/avoirs/route.ts
▸ dossier_tracking  (12)
    date  [insert]  app/api/contact/route.ts
    date  [insert]  app/api/nationality/recherche-ancestrale/route.ts
    date  [insert]  app/api/webhooks/kkiapay/route.ts
    label  [insert]  app/api/contact/route.ts
    label  [insert]  app/api/nationality/recherche-ancestrale/route.ts
    label  [insert]  app/api/webhooks/kkiapay/route.ts
    note  [insert]  app/api/contact/route.ts
    note  [insert]  app/api/nationality/recherche-ancestrale/route.ts
    note  [insert]  app/api/webhooks/kkiapay/route.ts
    status  [insert]  app/api/contact/route.ts
    status  [insert]  app/api/nationality/recherche-ancestrale/route.ts
    status  [insert]  app/api/webhooks/kkiapay/route.ts
▸ dossiers  (2)
    client_name  [select]  lib/gemma-context.ts
    type  [select]  lib/gemma-context.ts
▸ eligibility_results  (4)
    origin  [insert]  app/api/nationality/lead/route.ts
    pays_residence  [insert]  app/api/nationality/lead/route.ts
    source  [insert]  app/api/nationality/lead/route.ts
    timeline  [insert]  app/api/nationality/lead/route.ts
▸ inventory_movements  (6)
    quantity_change  [insert]  app/api/checkout/verify/route.ts
    quantity_change  [insert]  lib/stock-restore.ts
    stock  [insert]  lib/stock-restore.ts
    type  [filtre]  lib/stock-restore.ts
    type  [insert]  app/api/checkout/verify/route.ts
    type  [insert]  lib/stock-restore.ts
▸ messages  (2)
    content  [select]  lib/gemma-context.ts
    name  [select]  lib/gemma-context.ts
▸ nationality_applications  (6)
    ancestral  [update]  app/api/nationality/analyze/route.ts
    key  [update]  app/api/nationality/analyze/route.ts
    label  [update]  app/api/nationality/analyze/route.ts
    phone  [update]  app/agent/clients/page.tsx
    reference  [select]  app/client/services/page.tsx
    required  [update]  app/api/nationality/analyze/route.ts
▸ orders  (31)
    client_email  [select]  lib/gemma-context.ts
    client_id  [filtre]  app/api/mobile/orders/route.ts
    client_id  [select]  app/api/mobile/orders/route.ts
    client_name  [select]  lib/gemma-context.ts
    delivered_at  [select]  app/api/admin/orders/[id]/tracking/route.ts
    delivered_at  [select]  app/api/mobile/orders/route.ts
    email  [select]  app/api/agent/classement/route.ts
    full_name  [select]  app/api/agent/classement/route.ts
    null  [insert]  app/api/checkout/route.ts
    paiement  [insert]  app/api/checkout/route.ts
    phone  [select]  app/api/agent/classement/route.ts
    shipped_at  [select]  app/api/admin/orders/[id]/tracking/route.ts
    shipped_at  [select]  app/api/mobile/orders/route.ts
    shipping_city  [select]  app/api/mobile/orders/route.ts
    shipping_notes  [select]  app/api/mobile/orders/route.ts
    shipping_postal  [select]  app/api/mobile/orders/route.ts
    shipping_status  [select]  app/api/admin/orders/[id]/tracking/route.ts
    shipping_status  [select]  app/api/mobile/orders/route.ts
    shipping_status  [select]  app/client/factures/page.tsx
    source  [select]  app/api/mobile/orders/route.ts
    status  [filtre]  lib/gemma-context.ts
    status  [select]  lib/gemma-context.ts
    total_amount  [select]  lib/gemma-context.ts
    tracking_carrier  [select]  app/api/admin/orders/[id]/tracking/route.ts
    tracking_carrier  [select]  app/api/mobile/orders/route.ts
    tracking_code  [filtre]  app/api/mobile/orders/route.ts
    tracking_code  [select]  app/api/admin/orders/[id]/tracking/route.ts
    tracking_code  [select]  app/api/mobile/orders/route.ts
    tracking_code  [select]  app/client/factures/page.tsx
    tracking_url  [select]  app/api/admin/orders/[id]/tracking/route.ts
    tracking_url  [select]  app/api/mobile/orders/route.ts
▸ paiements_manuels  (5)
    client_email  [filtre]  app/agent/clients/page.tsx
    client_email  [select]  app/agent/clients/page.tsx
    description  [select]  app/agent/clients/page.tsx
    methode  [select]  app/agent/clients/page.tsx
    null  [insert]  app/agent/comptabilite/page.tsx
▸ products  (1)
    features  [select]  app/api/invoices/[id]/route.ts
▸ security_logs  (12)
    at  [insert]  app/api/admin/rgpd/route.ts
    at  [insert]  app/api/rgpd/delete/route.ts
    by  [insert]  app/api/admin/rgpd/route.ts
    dossiers_archived_by_email  [insert]  app/api/cron/cleanup/route.ts
    dossiers_deleted  [insert]  app/api/cron/cleanup/route.ts
    dossiers_found  [insert]  app/api/cron/cleanup/route.ts
    email  [insert]  app/api/rgpd/delete/route.ts
    errors  [insert]  app/api/cron/cleanup/route.ts
    files_deleted  [insert]  app/api/cron/cleanup/route.ts
    retention_hours  [insert]  app/api/cron/cleanup/route.ts
    source  [insert]  app/api/rgpd/delete/route.ts
    timestamp  [insert]  app/api/cron/cleanup/route.ts
▸ services  (3)
    documents  [select]  app/api/services/route.ts
    duration  [select]  app/api/services/route.ts
    processus  [select]  app/api/services/route.ts
▸ settings  (1)
    payment_status  [filtre]  app/api/checkout/verify/route.ts
▸ system_settings  (2)
    commission_rate  [update]  app/admin/settings/erp/page.tsx
    default_currency  [update]  app/admin/settings/erp/page.tsx

TOTAL : 107 occurrences sur 18 tables

══ TABLES RÉFÉRENCÉES MAIS NON EXPOSÉES PAR L API ══
  ai_proposals  →  app/api/proposals/track-view/route.ts
  client_notifications  →  components/layout/ClientBell.tsx
  dossier-documents  →  app/api/cron/cleanup/route.ts
  invoices  →  app/api/mobile/invoices/route.ts, lib/send-invoice-email.ts
  leads  →  app/agent/rediger-mails/page.tsx
  nationalite_requests  →  lib/gemma-context.ts
  nationality_documents  →  ../mobile/src/screens/main/NationaliteFormScreen.tsx
  order_tracking_events  →  app/api/admin/orders/[id]/tracking/route.ts, app/api/mobile/orders/route.ts
