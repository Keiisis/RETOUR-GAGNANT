import { redirect } from 'next/navigation'

// Ancienne maquette (« Villa Cotonou », « Roi ») à données INVENTÉES, publique et
// liée nulle part, bouton « Déconnexion » sans effet. L'espace client réel est
// /client/dashboard (audit du 29/09/2026).
export default function DashboardHome() {
    redirect('/client/dashboard')
}
