# Registre des activités de traitement

**Document INTERNE et CONFIDENTIEL — ne pas publier.**
Établi en application de l'article 30 du Règlement (UE) 2016/679 (RGPD).

| | |
|---|---|
| **Responsable du traitement** | Retour Gagnant Bénin |
| **Représentant légal** | _[Nom + qualité — à compléter]_ |
| **Adresse du siège** | Haie-Vive Cocotiers, Carré n°1158, Cotonou, République du Bénin |
| **Identifiant (IFU / RCCM)** | _[à compléter]_ |
| **Contact RGPD / point de contact** | contact@retourgagnantbenin.bj |
| **Délégué à la protection des données (DPO)** | _[Désigné : oui/non — coordonnées si oui]_ |
| **Date de création du registre** | _[date]_ |
| **Dernière mise à jour** | _[date]_ |

> Ce registre doit être **mis à jour à chaque nouveau traitement** ou modification, daté, et tenu à disposition de l'autorité de contrôle. Les champs _[entre crochets]_ sont à compléter/valider par le responsable.

---

## Sous-traitants (annexe confidentielle)

Liste nominative tenue ici (non publiée ; la politique publique ne mentionne que des *catégories*). Chaque sous-traitant doit être lié par un **contrat conforme à l'art. 28 RGPD** (DPA).

| Sous-traitant | Rôle / catégorie | Données confiées | Localisation | Garanties transfert | DPA signé |
|---|---|---|---|---|---|
| _Hébergeur applicatif_ | Hébergement du site | Toutes (transit/hébergement) | Hors UE possible | CCT / équivalent | _[oui/non]_ |
| _Plateforme base de données & stockage_ | BDD, authentification, fichiers | Comptes, dossiers, documents | Hors UE possible | CCT / équivalent | _[oui/non]_ |
| _Service de traduction automatique_ | Traduction du contenu | Textes soumis à traduction | Hors UE | CCT / équivalent | _[oui/non]_ |
| _Prestataires de paiement_ | Encaissement | Données de transaction | Variable | CCT / équivalent | _[oui/non]_ |
| _Service d'envoi d'e-mails (SMTP)_ | Notifications, newsletter | E-mail, contenu du message | _[à préciser]_ | _[à préciser]_ | _[oui/non]_ |

---

## Mesures de sécurité communes (art. 32)

Chiffrement TLS en transit ; mots de passe hachés (bcrypt/phpass) ; pare-feu applicatif (WAF) avec rate-limiting, anti-brute-force, anti-injection ; double authentification disponible ; cloisonnement des accès par rôle (RLS / contrôle d'accès au niveau objet) ; journalisation de sécurité ; sauvegardes ; purge automatisée selon les durées ci-dessous (cron quotidien).

---

## Fiches de traitement

### T1 — Gestion des demandes de contact
- **Finalité** : répondre aux demandes envoyées via le formulaire de contact.
- **Base légale** : consentement (case explicite) / mesures précontractuelles.
- **Personnes concernées** : visiteurs, prospects.
- **Catégories de données** : nom, prénom, e-mail, sujet, message.
- **Destinataires** : personnel habilité de RGB ; sous-traitant e-mail.
- **Durée de conservation** : 3 ans après le dernier contact (reco CNIL prospects).
- **Transfert hors UE** : possible via sous-traitants (CCT).

### T2 — Prospection & simulateur d'éligibilité
- **Finalité** : analyser le profil, recommander un service, recontacter le prospect.
- **Base légale** : consentement (case explicite avant envoi).
- **Personnes concernées** : prospects.
- **Catégories de données** : nom, prénom, e-mail, WhatsApp, réponses au questionnaire.
- **Destinataires** : équipe commerciale RGB.
- **Durée de conservation** : 3 ans après le dernier contact, sauf conversion en client.
- **Automatisation** : purge via `/api/cron/data-lifecycle` (tables prospects > 3 ans).

### T3 — Gestion des clients et des dossiers (services d'accompagnement)
- **Finalité** : fournir les services souscrits (passeport, nationalité, immobilier, business, recherche ancestrale, etc.), suivre l'avancement, communiquer.
- **Base légale** : exécution du contrat.
- **Personnes concernées** : clients (et personnes citées dans un dossier, ex. composition familiale).
- **Catégories de données** : identité, coordonnées, pièces justificatives (parfois **données sensibles** : filiation, documents d'état civil) → vigilance renforcée.
- **Destinataires** : personnel habilité ; partenaires/administrations strictement nécessaires à la prestation.
- **Durée de conservation** : durée de la relation + **5 ans** après clôture du dossier (prescription) ; documents sensibles traités purgés à 90 jours (`data-lifecycle`).
- **Transfert hors UE** : possible (CCT). **DPIA recommandée** vu la sensibilité (T3 + T?).

### T4 — Prise de rendez-vous
- **Finalité** : planifier et honorer les rendez-vous (présentiel, téléphone, visio).
- **Base légale** : consentement / mesures précontractuelles.
- **Données** : nom, prénom, e-mail, téléphone, service, message, créneau.
- **Conservation** : 1 an après le rendez-vous (ou rattachement au dossier client si conversion).

### T5 — Candidatures de partenariat
- **Finalité** : étudier les candidatures de partenaires, gérer le réseau.
- **Base légale** : consentement.
- **Données** : structure, contact, e-mail, catégorie, localisation, description, visuels.
- **Conservation** : 2 ans après le dernier échange si non retenue ; durée de la relation si retenue.

### T6 — Newsletter & communication
- **Finalité** : envoyer des actualités et informations.
- **Base légale** : consentement (opt-in), révocable à tout moment.
- **Données** : e-mail, statut d'abonnement, jeton de désinscription.
- **Destinataires** : sous-traitant e-mail.
- **Conservation** : jusqu'au retrait du consentement (désinscription) ; jeton supprimé ensuite.
- **Mesure** : lien de désinscription dans chaque envoi (`/api/newsletter/unsubscribe`).

### T7 — Avis clients (boutique)
- **Finalité** : publier les avis sur les produits.
- **Base légale** : consentement.
- **Données** : nom/pseudo, note, commentaire.
- **Conservation** : 3 ans, ou jusqu'au retrait de l'avis.

### T8 — Commandes e-commerce (boutique)
- **Finalité** : traiter et livrer les commandes, gérer le paiement.
- **Base légale** : exécution du contrat ; obligation légale (facturation).
- **Données** : identité, coordonnées, détail commande, données de transaction (via prestataire de paiement — RGB ne stocke pas les données de carte).
- **Destinataires** : prestataires de paiement.
- **Conservation** : pièces comptables **10 ans** (obligation OHADA/légale) ; données client anonymisées au-delà du besoin commercial.

### T9 — Comptabilité & facturation
- **Finalité** : obligations comptables et fiscales.
- **Base légale** : obligation légale.
- **Données** : identité client, montants, références.
- **Conservation** : **10 ans** (obligation légale). Effacement RGPD = **anonymisation** (la pièce reste, les données personnelles sont neutralisées).

### T10 — Comptes utilisateurs (authentification)
- **Finalité** : créer et sécuriser l'accès à l'espace client/agent/admin.
- **Base légale** : exécution du contrat / intérêt légitime (sécurité).
- **Données** : e-mail, mot de passe **haché**, rôle, journaux de connexion.
- **Conservation** : durée du compte + suppression sur demande ou inactivité prolongée.

### T11 — Sécurité du système d'information (WAF, journaux)
- **Finalité** : prévenir et détecter les attaques (intrusion, fraude, abus).
- **Base légale** : intérêt légitime (sécurité du SI).
- **Données** : adresse IP, user-agent, chemins, empreinte technique, événements de sécurité.
- **Conservation** : journaux **90 jours** ; blocages IP expirés purgés à 30 jours (`data-lifecycle`).

---

## Suivi des durées de conservation (automatisation)

| Donnée | Durée | Mécanisme |
|---|---|---|
| Documents sensibles traités | 90 jours | cron `data-lifecycle` |
| Prospects / leads non convertis | 3 ans | cron `data-lifecycle` |
| Journaux WAF | 90 jours | cron `data-lifecycle` |
| Blocages IP expirés | 30 jours | cron `data-lifecycle` |
| Dossiers clients clôturés | 5 ans | _[à vérifier/automatiser selon process métier]_ |
| Pièces comptables | 10 ans | conservation légale (anonymisation à l'effacement) |

---

## Exercice des droits

Accès, rectification, effacement, limitation, portabilité, opposition, retrait du consentement.
- **Canal** : contact@retourgagnantbenin.bj.
- **Outil opérationnel** : export et effacement/anonymisation via `/api/admin/rgpd` (réservé admin).
- **Délai de réponse** : 1 mois (prolongeable de 2 mois si complexité, avec information de la personne).
- **Vérification d'identité** : demandée avant exécution pour éviter les demandes frauduleuses.
