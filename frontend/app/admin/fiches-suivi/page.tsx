'use client'

// Même composant que app/agent/fiches-suivi ; l'admin peut en plus supprimer une fiche.
import FichesSuiviClient from '@/components/admin/FichesSuiviClient'

export default function AdminFichesSuiviPage() {
    return (
        <div className="min-h-screen bg-[#0a0f14] py-8 px-4">
            <div className="max-w-5xl mx-auto space-y-10">
                <FichesSuiviClient admin />
            </div>
        </div>
    )
}
