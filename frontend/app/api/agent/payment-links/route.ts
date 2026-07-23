// ══════════════════════════════════════════════════════════════
//  LIENS DE PAIEMENT — accès AGENT (et ADMIN)
//
//  Le middleware n'autorise /api/admin/* qu'aux rôles administrateurs :
//  sans ce chemin parallèle, l'onglet « Liens de paiement » de l'espace
//  agent renverrait 403 et aucun lien agent n'existerait.
//
//  Ce fichier NE DUPLIQUE PLUS la logique : il réexporte les handlers de
//  /api/admin/payment-links, qui portent eux-mêmes la garde (requireStaff
//  'agent') et le cloisonnement (admin = tout, agent = ses liens via le
//  marqueur [BY:<userId>] pris sur la session).
//
//  Conséquence : une règle de cloisonnement corrigée d'un côté l'est des
//  deux. L'ancienne délégation par appel HTTP interne pouvait diverger.
// ══════════════════════════════════════════════════════════════

export { GET, POST, DELETE } from '@/app/api/admin/payment-links/route'
