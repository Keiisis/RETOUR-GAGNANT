'use client'

/* Rapport hebdomadaire — espace ADMINISTRATION.
   La page ne fait qu'habiller l'éditeur : il est partagé avec l'admin, et
   c'est le SERVEUR qui décide de ce que chacun voit (un agent ne lit que ses
   propres rapports). Dupliquer l'écran aurait dupliqué les règles. */
import { FileText } from '@phosphor-icons/react'
import RapportHebdoEditeur from '@/components/rapports/RapportHebdoEditeur'

export default function AdminRapportHebdoPage() {
    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, #008751, #006b40)' }}>
                    <FileText size={18} className="text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-black" style={{ color: 'var(--panel-text-heading)' }}>Rapport Hebdo</h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--panel-text-muted)' }}>
                        Votre bilan et ceux de l’équipe. La direction voit tous les rapports transmis.
                    </p>
                </div>
            </div>
            <RapportHebdoEditeur />
        </div>
    )
}
