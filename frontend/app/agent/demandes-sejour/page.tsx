'use client'

/**
 * Demandes de séjour dans l'espace AGENT.
 *
 * Réutilise l'écran admin : une seule interface à maintenir, et l'agent voit
 * exactement ce que voit l'administrateur. Les routes /api/tourisme/demandes
 * acceptent déjà les agents (requireStaff niveau 'agent').
 */
import DemandesSejour from '@/app/admin/demandes-sejour/page'

export default function AgentDemandesSejourPage() {
    return <DemandesSejour />
}
