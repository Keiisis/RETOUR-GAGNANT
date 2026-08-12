// ══════════════════════════════════════════════════════════════
// RGPD : Contenu structuré des documents officiels (source unique).
// Rendu en PDF (lib/rgpd/pdf.ts) et DOCX (lib/rgpd/docx.ts) avec l'en-tête RGB.
// ══════════════════════════════════════════════════════════════

export type Block =
    | { type: 'h2'; text: string }
    | { type: 'p'; text: string }
    | { type: 'list'; items: string[] }
    | { type: 'table'; head: string[]; rows: string[][] }
    | { type: 'note'; text: string }

export interface RgpdDoc {
    id: 'registre' | 'procedure' | 'politique'
    title: string
    subtitle: string
    confidential: boolean
    blocks: Block[]
}

// ── 1. Registre des activités de traitement (Art. 30) ─────────────
const REGISTRE: RgpdDoc = {
    id: 'registre',
    title: 'Registre des activités de traitement',
    subtitle: 'Article 30 du Règlement (UE) 2016/679 (RGPD) : Document interne et confidentiel',
    confidential: true,
    blocks: [
        { type: 'note', text: 'Document INTERNE et CONFIDENTIEL. À tenir à jour à chaque nouveau traitement, daté, et tenu à disposition de l\'autorité de contrôle. Les champs entre crochets sont à compléter/valider par le responsable.' },
        { type: 'h2', text: '1. Responsable du traitement' },
        { type: 'table', head: ['Élément', 'Valeur'], rows: [
            ['Responsable du traitement', 'Retour Gagnant Bénin'],
            ['Représentant légal', '[Nom + qualité : à compléter]'],
            ['Adresse du siège', 'Haie-Vive Cocotiers, Carré n°1158, Cotonou, République du Bénin'],
            ['Identifiant (IFU / RCCM)', '[à compléter]'],
            ['Point de contact RGPD', 'contact@retourgagnantbenin.bj'],
            ['Délégué à la protection des données', '[Désigné : oui/non : coordonnées si oui]'],
            ['Date de dernière mise à jour', '[date]'],
        ] },
        { type: 'h2', text: '2. Sous-traitants (annexe confidentielle)' },
        { type: 'p', text: 'Liste nominative tenue en interne uniquement. La politique publique ne mentionne que des catégories de destinataires. Chaque sous-traitant doit être lié par un contrat conforme à l\'article 28 du RGPD (clauses de protection des données / DPA).' },
        { type: 'table', head: ['Catégorie', 'Rôle', 'Données confiées', 'Garanties transfert', 'Contrat (DPA)'], rows: [
            ['Hébergement & infrastructure', 'Hébergement du site', 'Toutes (transit/hébergement)', 'CCT / équivalent', '[oui/non]'],
            ['Traitement & stockage des données', 'Base de données, authentification, fichiers', 'Comptes, dossiers, documents', 'CCT / équivalent', '[oui/non]'],
            ['Traduction automatique', 'Traduction du contenu', 'Textes soumis', 'CCT / équivalent', '[oui/non]'],
            ['Prestataires de paiement agréés', 'Encaissement', 'Données de transaction', 'CCT / équivalent', '[oui/non]'],
            ['Envoi d\'e-mails (SMTP)', 'Notifications, newsletter', 'E-mail, contenu du message', '[à préciser]', '[oui/non]'],
        ] },
        { type: 'h2', text: '3. Mesures de sécurité communes (Art. 32)' },
        { type: 'list', items: [
            'Chiffrement TLS des données en transit',
            'Mots de passe hachés (jamais stockés en clair)',
            'Pare-feu applicatif (WAF) : rate-limiting, anti-brute-force, anti-injection',
            'Double authentification disponible pour les accès sensibles',
            'Cloisonnement des accès par rôle (contrôle au niveau objet)',
            'Journalisation de sécurité et sauvegardes',
            'Purge automatisée selon les durées de conservation (tâche planifiée quotidienne)',
        ] },
        { type: 'h2', text: '4. Fiches de traitement' },
        { type: 'table', head: ['#', 'Traitement', 'Base légale', 'Conservation'], rows: [
            ['T1', 'Demandes de contact', 'Consentement / mesures précontractuelles', '3 ans après dernier contact'],
            ['T2', 'Prospection & simulateur', 'Consentement', '3 ans après dernier contact (purge auto)'],
            ['T3', 'Clients & dossiers (services)', 'Exécution du contrat', 'Relation + 5 ans ; pièces sensibles 90 j'],
            ['T4', 'Prise de rendez-vous', 'Consentement / précontractuel', '1 an (ou rattachement dossier)'],
            ['T5', 'Candidatures de partenariat', 'Consentement', '2 ans si non retenue'],
            ['T6', 'Newsletter', 'Consentement (opt-in, révocable)', 'Jusqu\'au retrait du consentement'],
            ['T7', 'Avis clients', 'Consentement', '3 ans ou jusqu\'au retrait'],
            ['T8', 'Commandes e-commerce', 'Contrat + obligation légale', 'Pièces comptables 10 ans'],
            ['T9', 'Comptabilité & facturation', 'Obligation légale', '10 ans (anonymisation à l\'effacement)'],
            ['T10', 'Comptes utilisateurs', 'Contrat / intérêt légitime', 'Durée du compte + suppression sur demande'],
            ['T11', 'Sécurité du SI (WAF, journaux)', 'Intérêt légitime', 'Journaux 90 j ; blocages IP 30 j'],
        ] },
        { type: 'note', text: 'Le traitement T3 peut porter sur des données sensibles (filiation, documents d\'état civil) : vigilance renforcée et analyse d\'impact (DPIA) recommandée.' },
        { type: 'h2', text: '5. Automatisation des durées de conservation' },
        { type: 'table', head: ['Donnée', 'Durée', 'Mécanisme'], rows: [
            ['Documents sensibles traités', '90 jours', 'Tâche planifiée « data-lifecycle »'],
            ['Prospects / leads non convertis', '3 ans', 'Tâche planifiée « data-lifecycle »'],
            ['Journaux de sécurité', '90 jours', 'Tâche planifiée « data-lifecycle »'],
            ['Blocages IP expirés', '30 jours', 'Tâche planifiée « data-lifecycle »'],
            ['Dossiers clients clôturés', '5 ans', 'Process métier'],
            ['Pièces comptables', '10 ans', 'Conservation légale (anonymisation à l\'effacement)'],
        ] },
        { type: 'h2', text: '6. Exercice des droits' },
        { type: 'list', items: [
            'Droits : accès, rectification, effacement, limitation, portabilité, opposition, retrait du consentement.',
            'Canal : contact@retourgagnantbenin.bj.',
            'Outil self-service vérifié par email : page « Mes données » du site.',
            'Outil interne : export et effacement/anonymisation réservés à l\'administration.',
            'Délai de réponse : 1 mois (prolongeable de 2 mois si complexité, avec information de la personne).',
            'Vérification d\'identité exigée avant exécution (anti-fraude).',
        ] },
    ],
}

// ── 2. Procédure de violation de données (Art. 33/34) ─────────────
const PROCEDURE: RgpdDoc = {
    id: 'procedure',
    title: 'Procédure de gestion des violations de données',
    subtitle: 'Articles 33 et 34 du RGPD : Notification dans les 72 heures',
    confidential: true,
    blocks: [
        { type: 'p', text: 'Une « violation de données » désigne toute atteinte à la confidentialité (fuite, accès non autorisé), à l\'intégrité (altération) ou à la disponibilité (perte, destruction, rançongiciel) de données personnelles.' },
        { type: 'note', text: 'Règle d\'or : notifier l\'autorité de contrôle dans les 72 heures suivant la prise de connaissance, sauf si la violation est peu susceptible d\'engendrer un risque pour les personnes. Le délai court dès la prise de connaissance.' },
        { type: 'h2', text: 'Rôles' },
        { type: 'table', head: ['Rôle', 'Responsable', 'Mission'], rows: [
            ['Référent incident', '[Nom : ex. CEO/DSI]', 'Pilote la réponse, décide de la notification'],
            ['Point de contact RGPD', 'contact@retourgagnantbenin.bj', 'Interface autorité & personnes concernées'],
            ['Support technique', '[Nom]', 'Confinement, investigation, correctifs'],
        ] },
        { type: 'h2', text: 'Étape 1 : Détecter & qualifier (immédiat)' },
        { type: 'list', items: [
            'Sources : journaux du WAF, alertes d\'intégrité, signalement client/prestataire, comportement anormal.',
            'Qualifier : quelles données, combien de personnes, type d\'atteinte, données sensibles concernées ?',
        ] },
        { type: 'h2', text: 'Étape 2 : Confiner (dans l\'heure)' },
        { type: 'list', items: [
            'Révoquer les accès/sessions compromis ; forcer la rotation des mots de passe et des clés.',
            'Bloquer les IP/origines en cause ; activer le mode d\'urgence si nécessaire.',
            'Isoler le composant touché sans détruire les preuves (conserver les journaux).',
        ] },
        { type: 'h2', text: 'Étape 3 : Évaluer le risque' },
        { type: 'table', head: ['Risque pour les personnes', 'Notifier l\'autorité (72h)', 'Informer les personnes'], rows: [
            ['Aucun / négligeable', 'Non (mais consigner au registre)', 'Non'],
            ['Risque', 'Oui (≤ 72h)', 'Si risque élevé'],
            ['Risque élevé', 'Oui (≤ 72h)', 'Oui, sans délai'],
        ] },
        { type: 'h2', text: 'Étape 4 : Notifier l\'autorité (≤ 72h)' },
        { type: 'p', text: 'Autorité compétente : [à confirmer : ex. APDP Bénin ; CNIL si personnes concernées en France/UE]. Contenu : nature de la violation, catégories et nombre approximatif de personnes et d\'enregistrements, coordonnées du point de contact, conséquences probables, mesures prises. En cas d\'information incomplète, notifier de façon échelonnée.' },
        { type: 'h2', text: 'Étape 5 : Informer les personnes (si risque élevé)' },
        { type: 'p', text: 'Message clair et simple : ce qui s\'est passé, quelles données, conséquences possibles, mesures prises, recommandations (changer le mot de passe, vigilance phishing), point de contact.' },
        { type: 'h2', text: 'Étape 6 : Documenter & corriger' },
        { type: 'list', items: [
            'Inscrire la violation au registre des violations (obligatoire, même sans notification).',
            'Corriger la cause racine ; mettre à jour les mesures de sécurité.',
            'Retour d\'expérience.',
        ] },
        { type: 'h2', text: 'Registre des violations (à tenir)' },
        { type: 'table', head: ['Date', 'Description', 'Personnes touchées', 'Risque', 'Autorité notifiée', 'Mesures'], rows: [
            ['', '', '', '', '', ''],
        ] },
        { type: 'h2', text: 'Réflexes immédiats' },
        { type: 'list', items: [
            'Noter l\'heure de prise de connaissance (départ des 72h).',
            'Confiner avant d\'investiguer en profondeur.',
            'Conserver les preuves (journaux).',
            'Décider de la notification avec le référent incident.',
            'Tout consigner au registre des violations.',
        ] },
    ],
}

// ── 3. Politique de confidentialité (version publique, sans stack) ─
const POLITIQUE: RgpdDoc = {
    id: 'politique',
    title: 'Politique de confidentialité',
    subtitle: 'Protection et traitement de vos données personnelles',
    confidential: false,
    blocks: [
        { type: 'h2', text: '1. Responsable du traitement' },
        { type: 'p', text: 'Le responsable du traitement des données collectées sur retourgagnantbenin.bj est Retour Gagnant Bénin, dont le siège est à Haie-Vive Cocotiers, Carré n°1158, Cotonou, République du Bénin.' },
        { type: 'h2', text: '2. Données collectées' },
        { type: 'list', items: [
            'Données d\'identification : nom, prénom, e-mail, téléphone/WhatsApp.',
            'Données de navigation : pages visitées, durée des sessions, appareil.',
            'Données de formulaire : contact, éligibilité, rendez-vous.',
            'Données de dossier : documents et informations nécessaires au traitement.',
        ] },
        { type: 'h2', text: '3. Finalités' },
        { type: 'list', items: [
            'Traiter vos demandes et vous accompagner dans vos démarches.',
            'Gérer les rendez-vous et le suivi des dossiers.',
            'Vous envoyer des communications (avec votre consentement).',
            'Améliorer le site et assurer sa sécurité.',
        ] },
        { type: 'h2', text: '4. Conservation' },
        { type: 'p', text: 'Les données sont conservées le temps strictement nécessaire. Les dossiers clients sont conservés 5 ans après clôture ; les données de navigation 13 mois maximum.' },
        { type: 'h2', text: '5. Partage des données' },
        { type: 'p', text: 'Vos données ne sont jamais vendues. Elles peuvent être communiquées, dans la stricte mesure nécessaire et sous obligation de confidentialité, aux catégories de destinataires suivantes : sous-traitants d\'hébergement et d\'infrastructure ; prestataires de traitement et de stockage ; prestataires de paiement agréés ; autorités compétentes sur réquisition légale. Les transferts hors UE sont encadrés par des garanties appropriées.' },
        { type: 'h2', text: '6. Cookies' },
        { type: 'p', text: 'Le site n\'utilise que des cookies strictement nécessaires (session, langue) ne requérant pas de consentement. Aucun traceur publicitaire ni outil de mesure d\'audience tiers n\'est chargé.' },
        { type: 'h2', text: '7. Vos droits' },
        { type: 'list', items: [
            'Accès, rectification, suppression, opposition, portabilité, limitation, retrait du consentement.',
            'Self-service : page « Mes données » du site (vérification par e-mail).',
            'Contact : contact@retourgagnantbenin.bj.',
        ] },
        { type: 'h2', text: '8. Sécurité' },
        { type: 'p', text: 'Mesures techniques et organisationnelles appropriées : pare-feu applicatif (WAF), chiffrement SSL/TLS, authentification renforcée des accès administratifs.' },
    ],
}

export const RGPD_DOCS: Record<string, RgpdDoc> = {
    registre: REGISTRE,
    procedure: PROCEDURE,
    politique: POLITIQUE,
}
