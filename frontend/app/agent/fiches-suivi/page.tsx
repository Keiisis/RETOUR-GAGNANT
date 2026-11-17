'use client'

// Même composant que app/admin/fiches-suivi ; la suppression y est réservée à l'admin.
import FichesSuiviClient from '@/components/admin/FichesSuiviClient'

export default function AgentFichesSuiviPage() {
    return (
        <div className="space-y-6">
            <FichesSuiviClient />
        </div>
    )
}
