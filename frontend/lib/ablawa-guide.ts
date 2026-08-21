// ══════════════════════════════════════════════════════════════
//  LE GUIDE D'ABLAWA — les parcours réels de l'application mobile.
//
//  Ce fichier est sa MÉMOIRE des chemins : où se trouve chaque chose, dans
//  quel ordre les étapes s'enchaînent, quel service se règle dans l'app et
//  lequel se fait sur devis. Il a été établi en lisant les écrans un par un et
//  en croisant le graphe du dépôt (graphify) — pas de mémoire, pas d'intuition.
//
//  DEUX RÈGLES DE CONCEPTION, pour qu'il ne mente jamais :
//
//    1. AUCUN PRIX ICI. Les tarifs vivent dans la table `services`, lus à
//       chaque question. Les figer dans ce texte, c'est garantir qu'ils se
//       périment. Le guide dit OÙ et COMMENT, jamais COMBIEN.
//
//    2. ON DÉCRIT L'ÉCRAN, PAS LE BOUTON. Les libellés changent ; « depuis
//       l'onglet Services, ouvrez la fiche X » reste vrai même après un
//       redesign. C'est la même règle que le prompt impose déjà à Ablawa.
//
//  Quand un parcours change dans l'app, ce fichier se met à jour ici, à un
//  seul endroit, et Ablawa suit.
// ══════════════════════════════════════════════════════════════

export const GUIDE_ABLAWA = `
CARTE DE L'APPLICATION — six onglets en bas de l'écran.

· ACCUEIL — le point de départ. On y trouve un résumé du dernier dossier, les
  raccourcis (Rendez-vous, Paiements, Support IA — c'est-à-dire toi —, Aide &
  FAQ), la Boutique, et tout en bas la barre « Support — Équipe RGB » qui appelle
  ou écrit à un conseiller humain.
· DOSSIER — l'avancement de chaque dossier ouvert, avec son statut et ses pièces.
· SERVICES — le catalogue. Chaque service a sa propre fiche : on l'ouvre pour
  lire le détail et lancer la démarche.
· ÉVÉNEMENTS — les événements de l'agence ; on s'y inscrit et on y prend sa place.
· MESSAGES — la conversation avec l'équipe humaine.
· PROFIL — l'espace personnel : Mes factures, Mes commandes, Mes rendez-vous,
  Mes propositions, Récap MyAfroOrigins, Mes billets, Ma signature, Plan de
  composition familiale, Prêtres Fa & Racines, Sécurité, Aide & FAQ, et le choix
  de la langue.

COMMENT SE DÉROULE UNE DÉMARCHE DE SERVICE (le schéma commun).
La personne ouvre la fiche du service depuis l'onglet Services, lit le détail,
remplit ses informations, règle en ligne (Mobile Money ou carte, via la fenêtre
de paiement sécurisée), puis un écran de confirmation s'affiche : il porte la
référence, propose de télécharger la facture, et le dossier apparaît ensuite
dans l'onglet Dossier. Le montant est TOUJOURS recalculé par le serveur au
moment de payer — personne ne peut modifier un prix depuis son téléphone.

CE QUI SE RÈGLE DIRECTEMENT DANS L'APP (paiement en ligne immédiat) :
· Consultation Fa & Racines — on choisit présentiel ou visio, éventuellement un
  prêtre dans l'annuaire, puis on règle. L'équipe fixe ensuite le rendez-vous.
· Recherche ancestrale — on décrit sa lignée, on règle, un dossier s'ouvre.
· Récap de dossier MyAfroOrigins — pour qui a un dossier bloqué chez
  MyAfroOrigins : on raconte sa situation (le consentement au traitement des
  données est OBLIGATOIRE, loi béninoise), on règle, un analyste reprend le cas.
· Permis de conduire béninois — on choisit la catégorie puis, si on veut, une
  auto-école, on laisse ses coordonnées et on règle.
· Logement — on parcourt le catalogue du partenaire, on remplit une demande, et
  on règle les FRAIS DE CONSTITUTION DE DOSSIER (le prix du bien lui-même se
  traite avec le partenaire, jamais dans l'app).
· Nationalité béninoise — formulaire dédié, pièces à joindre, puis règlement.
· Séjour sur mesure — quand un conseiller a envoyé une proposition, on la
  retrouve dans « Mes propositions » (onglet Profil) ; on garde ou retire des
  prestations, puis on règle l'ensemble en une fois.
· Places d'événement — depuis la fiche d'un événement.
· Boutique — artisanat et objets du patrimoine ; panier puis paiement.

CE QUI SE FAIT SUR DEVIS OU PAR L'ÉQUIPE (pas de prix fixe, pas de paiement
immédiat dans l'app) : la création d'entreprise, l'investissement, la
construction, le guide culturel, les langues, le passeport selon la formule, et
la nationalité dont l'accompagnement complet s'établit sur devis. Pour ceux-là,
la personne ouvre la fiche du service, découvre le détail, et est mise en
relation avec l'équipe.

COMMENT FAIRE, POUR LES QUESTIONS QUI REVIENNENT.
· Télécharger une facture : onglet Profil, puis Mes factures. Après un paiement,
  l'écran de confirmation la propose aussi directement, et une copie part par
  e-mail.
· Enregistrer sa signature : onglet Profil, puis Ma signature — on la dessine
  une fois, elle s'appose ensuite sur le « Bon pour accord » de ses documents.
· Suivre un dossier : onglet Dossier — le statut et les pièces s'y trouvent, et
  le dossier se met à jour tout seul quand l'équipe avance.
· Déposer une pièce demandée : depuis le dossier concerné, dans l'onglet Dossier.
· Voir ses rendez-vous : onglet Profil, puis Mes rendez-vous ; pour en demander
  un, le raccourci Rendez-vous sur l'accueil.
· Reprendre une proposition de séjour reçue : onglet Profil, puis Mes propositions.
· Changer la langue : onglet Profil.
· Parler à un humain : la barre « Support — Équipe RGB » en bas de l'accueil, ou
  l'onglet Messages. Tu y renvoies toi-même dès qu'un litige, un remboursement,
  un dossier bloqué ou un engagement ferme est en jeu.
· Un paiement s'est interrompu : rien n'a été débité tant que l'écran de
  confirmation n'est pas apparu ; il suffit de reprendre la démarche.
`.trim()
