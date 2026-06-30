# Procédure de gestion des violations de données personnelles

**Document INTERNE — application des articles 33 et 34 du RGPD.**

Une « violation de données » = toute atteinte à la **confidentialité** (fuite, accès non autorisé), à l'**intégrité** (altération) ou à la **disponibilité** (perte, destruction, rançongiciel) de données personnelles.

> Règle d'or : **notifier l'autorité de contrôle dans les 72 heures** après en avoir pris connaissance, sauf si la violation est **peu susceptible d'engendrer un risque** pour les personnes. Le délai court dès la **prise de connaissance** — agir vite.

---

## Rôles

| Rôle | Responsable | Mission |
|---|---|---|
| **Référent incident** | _[Nom — ex. CEO/DSI]_ | Pilote la réponse, décide de la notification |
| **Point de contact RGPD** | contact@retourgagnantbenin.bj | Interface autorité & personnes concernées |
| **Support technique** | _[Nom]_ | Confinement, investigation, correctifs |

---

## Étape 1 — Détecter & qualifier (immédiat)

Sources d'alerte : journaux du WAF (`/admin/securite`), alertes intégrité (modification de `siteurl`, création d'admin inattendue), signalement client/prestataire, comportement anormal.

Qualifier : Quelles données ? Combien de personnes ? Confidentialité / intégrité / disponibilité ? Données sensibles (filiation, pièces d'identité — traitement T3) ?

## Étape 2 — Confiner (dans l'heure)

- Révoquer les accès/sessions compromis ; forcer la rotation des mots de passe et des clés.
- Activer le bouton d'urgence WAF si nécessaire ; bloquer les IP/origines en cause.
- Isoler le composant touché ; **ne pas détruire les preuves** (conserver les journaux).

## Étape 3 — Évaluer le risque

| Risque pour les personnes | Notifier l'autorité (72h) | Informer les personnes |
|---|---|---|
| Aucun / négligeable | Non (mais **consigner** au registre des violations) | Non |
| Risque | **Oui (≤ 72h)** | Si risque élevé |
| Risque **élevé** (données sensibles, fraude, usurpation) | **Oui (≤ 72h)** | **Oui, sans délai** |

## Étape 4 — Notifier l'autorité de contrôle (≤ 72h)

Autorité compétente : _[à confirmer — ex. APDP Bénin (Autorité de Protection des Données Personnelles) ; CNIL si établissement/personnes concernées en France/UE]_.

Contenu de la notification : nature de la violation ; catégories et nombre approximatif de personnes et d'enregistrements ; coordonnées du point de contact ; conséquences probables ; mesures prises ou proposées. Si tout n'est pas connu sous 72h, notifier de façon **échelonnée** (notification initiale puis compléments).

## Étape 5 — Informer les personnes concernées (si risque élevé)

Message **clair et simple** : ce qui s'est passé, quelles données, conséquences possibles, mesures prises, recommandations (changer son mot de passe, vigilance phishing), point de contact.

## Étape 6 — Documenter & corriger

- Inscrire la violation au **registre des violations** (ci-dessous) — **obligatoire, même sans notification**.
- Corriger la cause racine ; mettre à jour les mesures de sécurité et, si besoin, le registre des traitements.
- Retour d'expérience.

---

## Registre des violations (à tenir)

| Date détection | Description | Données / personnes touchées | Niveau de risque | Autorité notifiée (date) | Personnes informées | Mesures correctives |
|---|---|---|---|---|---|---|
| | | | | | | |

---

## Réflexes immédiats (mémo)

1. Ne pas paniquer, **noter l'heure de prise de connaissance** (départ des 72h).
2. Confiner avant d'investiguer en profondeur.
3. Conserver les preuves (journaux).
4. Décider de la notification avec le référent incident.
5. Tout consigner au registre des violations.
