-- ══════════════════════════════════════════════════════════════
--  INDEX DE MONTÉE EN CHARGE
--
--  Avec quelques dizaines de comptes, tout va vite : PostgreSQL lit la table
--  entière et personne ne s'en aperçoit. À mille, puis dix mille, chaque
--  ouverture d'écran devient un balayage complet — et comme tout le monde
--  ouvre l'application aux mêmes heures, la base passe son temps à relire les
--  mêmes tables.
--
--  Ces index couvrent EXACTEMENT les requêtes que l'application mobile et les
--  panels exécutent à chaque ouverture d'écran. Rien de spéculatif : chaque
--  ligne ci-dessous correspond à un `.eq()` ou un `.in()` présent dans le code.
--
--  `IF NOT EXISTS` partout : la migration se rejoue sans dommage.
--  `CONCURRENTLY` est volontairement ABSENT — il interdit la transaction dans
--  laquelle l'éditeur SQL de Supabase exécute le script. Sur des tables de
--  cette taille, la prise de verrou est de l'ordre de la milliseconde.
-- ══════════════════════════════════════════════════════════════

-- ── Dossiers : l'onglet « Dossier » de l'app, à chaque ouverture ──
--    La route lit par identifiant de compte OU par email (23 dossiers sur 25
--    n'ont que l'email — voir le commentaire dans /api/mobile/dossiers).
CREATE INDEX IF NOT EXISTS idx_dossier_tracking_client_id
    ON dossier_tracking (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dossier_tracking_client_email
    ON dossier_tracking (lower(client_email), created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dossier_tracking_transaction
    ON dossier_tracking (transaction_id);
CREATE INDEX IF NOT EXISTS idx_dossier_tracking_statut
    ON dossier_tracking (statut, updated_at DESC);

-- ── Pièces jointes : chargées en lot pour tous les dossiers d'un client ──
CREATE INDEX IF NOT EXISTS idx_dossier_documents_dossier
    ON dossier_documents (dossier_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_dossier
    ON documents (dossier_id, created_at DESC);

-- ── Facturation : idempotence des paiements + accès client ──
--    `payment_transaction_id` est interrogé à CHAQUE encaissement (garde
--    anti-double-facture) : sans index, chaque paiement balaye la table.
CREATE INDEX IF NOT EXISTS idx_documents_financiers_transaction
    ON documents_financiers (payment_transaction_id);
CREATE INDEX IF NOT EXISTS idx_documents_financiers_client
    ON documents_financiers (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_financiers_email
    ON documents_financiers (lower(client_email), created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_financiers_type_statut
    ON documents_financiers (type, status, created_at DESC);

-- ── Notifications : la cloche, relue à chaque passage sur l'accueil ──
CREATE INDEX IF NOT EXISTS idx_notifications_user
    ON notifications (user_id, created_at DESC);

-- ── Comptes : la recherche par adresse (inscription, renvoi de confirmation,
--    invitation de collaborateur). Requête écrite en `=` sur l'email en
--    minuscules, donc index sur lower(email).
CREATE INDEX IF NOT EXISTS idx_client_profiles_email
    ON client_profiles (lower(email));

-- ── Commandes : vérification de paiement et suivi ──
CREATE INDEX IF NOT EXISTS idx_orders_transaction
    ON orders (transaction_id);
-- `orders` ne porte PAS de client_id (verifie en base) : le rattachement au
-- compte se fait par l'adresse du payeur.
CREATE INDEX IF NOT EXISTS idx_orders_client_email
    ON orders (lower(customer_email), created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_statut
    ON orders (payment_status, created_at DESC);

-- ── Événements : liste publique + contrôle de capacité à chaque inscription ──
CREATE INDEX IF NOT EXISTS idx_event_registrations_event
    ON event_registrations (event_id, ticket_type, payment_status);
CREATE INDEX IF NOT EXISTS idx_event_registrations_email
    ON event_registrations (lower(email));

-- ── Traductions : lues en rafale au chargement de chaque écran ──
--    (table alimentée par /api/translate ; la clé de lecture est le hash.)
CREATE INDEX IF NOT EXISTS idx_translations_hash_lang
    ON translations (source_hash, lang);

-- ══════════════════════════════════════════════════════════════
--  APRÈS EXÉCUTION : vérifier que les index sont bien utilisés.
--
--    EXPLAIN ANALYZE
--    SELECT * FROM dossier_tracking
--    WHERE client_id = '00000000-0000-0000-0000-000000000000'
--    ORDER BY created_at DESC;
--
--  Le plan doit annoncer « Index Scan », pas « Seq Scan ».
-- ══════════════════════════════════════════════════════════════
