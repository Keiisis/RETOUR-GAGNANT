'use client'

import {
    FolderOpen, Upload, FileText, Image, Download
} from 'lucide-react'

const docCategories = [
    { name: 'Passeports & Identités', count: 0, icon: FileText, color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    { name: 'Actes Notariés', count: 0, icon: FileText, color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
    { name: 'Certificats de Nationalité', count: 0, icon: FileText, color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    { name: 'Photos & Justificatifs', count: 0, icon: Image, color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
]

export default function AgentDocumentsPage() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-white">Documents</h1>
                    <p className="text-gray-500 text-sm mt-1">Gérez les pièces justificatives de vos dossiers</p>
                </div>
                <button className="flex items-center gap-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-500/30 transition-all">
                    <Upload size={16} /> Importer un Document
                </button>
            </div>

            {/* Doc Categories */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {docCategories.map((cat) => (
                    <div key={cat.name} className={`p-5 rounded-2xl border ${cat.color} hover:scale-[1.02] transition-all cursor-pointer`}>
                        <cat.icon size={24} className="mb-3" />
                        <p className="text-sm font-bold text-white">{cat.name}</p>
                        <p className="text-xs text-gray-500 mt-1">{cat.count} fichier(s)</p>
                    </div>
                ))}
            </div>

            {/* Empty State */}
            <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-16 text-center">
                <FolderOpen size={48} className="text-gray-700 mx-auto mb-4" />
                <p className="text-gray-500 text-sm font-semibold">
                    L&apos;espace documents sera alimenté au fur et à mesure de la gestion des dossiers.
                </p>
                <p className="text-gray-600 text-xs mt-2">
                    Glissez et déposez des fichiers ici ou utilisez le bouton &quot;Importer&quot;
                </p>
            </div>
        </div>
    )
}
