'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import {
    FolderOpen, Upload, FileText, Image, Download, Trash2,
    Search, Loader2, X
} from 'lucide-react'

interface AgentDocument {
    id: string
    filename: string
    file_url: string
    category: string
    file_size: number
    created_at: string
    dossier_id: string | null
}

const docCategories = [
    { name: 'Passeports & Identités', icon: FileText, color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    { name: 'Actes Notariés', icon: FileText, color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
    { name: 'Certificats de Nationalité', icon: FileText, color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    { name: 'Photos & Justificatifs', icon: Image, color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    { name: 'Autres', icon: FolderOpen, color: 'bg-gray-500/10 text-gray-400 border-gray-500/20' },
]

export default function AgentDocumentsPage() {
    const [documents, setDocuments] = useState<AgentDocument[]>([])
    const [loading, setLoading] = useState(true)
    const [uploading, setUploading] = useState(false)
    const [search, setSearch] = useState('')
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
    const [uploadCategory, setUploadCategory] = useState('Autres')
    const [showUploadModal, setShowUploadModal] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const fetchDocuments = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data } = await supabase
            .from('agent_documents')
            .select('*')
            .eq('agent_id', user.id)
            .order('created_at', { ascending: false })

        setDocuments((data || []) as AgentDocument[])
        setLoading(false)
    }

    useEffect(() => {
        fetchDocuments()
    }, [])

    const handleUpload = async (file: File) => {
        if (!file) return
        setUploading(true)

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const fileExt = file.name.split('.').pop()
        const fileName = `${user.id}/${Date.now()}.${fileExt}`

        // Upload to Supabase Storage
        const { data: storageData, error: storageError } = await supabase.storage
            .from('documents')
            .upload(fileName, file)

        if (storageError) {
            // If storage bucket doesn't exist yet, save metadata with a placeholder URL
            console.warn('Storage upload failed, saving metadata only:', storageError.message)

            const { error: dbError } = await supabase.from('agent_documents').insert({
                agent_id: user.id,
                filename: file.name,
                file_url: `pending://${fileName}`,
                category: uploadCategory,
                file_size: file.size,
            })

            if (!dbError) {
                await fetchDocuments()
                setShowUploadModal(false)
            }
        } else {
            const { data: urlData } = supabase.storage.from('documents').getPublicUrl(storageData.path)

            const { error: dbError } = await supabase.from('agent_documents').insert({
                agent_id: user.id,
                filename: file.name,
                file_url: urlData?.publicUrl || '',
                category: uploadCategory,
                file_size: file.size,
            })

            if (!dbError) {
                await fetchDocuments()
                setShowUploadModal(false)
            }
        }

        setUploading(false)
    }

    const handleDelete = async (doc: AgentDocument) => {
        // Try to delete from storage
        if (doc.file_url && !doc.file_url.startsWith('pending://')) {
            const path = doc.file_url.split('/documents/')[1]
            if (path) {
                await supabase.storage.from('documents').remove([path])
            }
        }

        await supabase.from('agent_documents').delete().eq('id', doc.id)
        setDocuments(prev => prev.filter(d => d.id !== doc.id))
    }

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }

    const filtered = documents.filter(d => {
        const matchSearch = d.filename.toLowerCase().includes(search.toLowerCase())
        const matchCategory = !selectedCategory || d.category === selectedCategory
        return matchSearch && matchCategory
    })

    // Count per category
    const getCategoryCount = (name: string) => documents.filter(d => d.category === name).length

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-white">Documents</h1>
                    <p className="text-gray-500 text-sm mt-1">{documents.length} fichier(s) enregistré(s)</p>
                </div>
                <button
                    onClick={() => setShowUploadModal(true)}
                    className="flex items-center gap-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-500/30 transition-all"
                >
                    <Upload size={16} /> Importer un Document
                </button>
            </div>

            {/* Category Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
                {docCategories.map((cat) => (
                    <div
                        key={cat.name}
                        onClick={() => setSelectedCategory(selectedCategory === cat.name ? null : cat.name)}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all ${selectedCategory === cat.name
                                ? `${cat.color} ring-1 ring-current scale-[1.02]`
                                : `${cat.color} hover:scale-[1.02]`
                            }`}
                    >
                        <cat.icon size={20} className="mb-2" />
                        <p className="text-xs font-bold text-white">{cat.name}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">{getCategoryCount(cat.name)} fichier(s)</p>
                    </div>
                ))}
            </div>

            {/* Search */}
            <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                    type="text" value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Rechercher un document..." title="Rechercher"
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 text-sm"
                />
            </div>

            {/* Documents List */}
            {filtered.length === 0 ? (
                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-12 text-center">
                    <FolderOpen size={48} className="text-gray-700 mx-auto mb-4" />
                    <p className="text-gray-500 text-sm font-semibold">
                        {documents.length === 0 ? 'Aucun document importé' : 'Aucun document trouvé'}
                    </p>
                    <p className="text-gray-600 text-xs mt-2">
                        Utilisez le bouton &quot;Importer&quot; pour ajouter des documents
                    </p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map((doc, i) => (
                        <motion.div
                            key={doc.id}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.03 }}
                            className="bg-white/[0.03] border border-white/5 rounded-xl px-4 py-3 flex items-center gap-4 group hover:border-emerald-500/20 transition-all"
                        >
                            <FileText size={18} className="text-emerald-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-white truncate">{doc.filename}</p>
                                <p className="text-[10px] text-gray-500">
                                    {doc.category} • {formatSize(doc.file_size)} • {new Date(doc.created_at).toLocaleDateString('fr-FR')}
                                </p>
                            </div>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                {doc.file_url && !doc.file_url.startsWith('pending://') && (
                                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-emerald-400" title="Télécharger">
                                        <Download size={14} />
                                    </a>
                                )}
                                <button onClick={() => handleDelete(doc)} className="text-gray-500 hover:text-red-400" title="Supprimer">
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Upload Modal */}
            {showUploadModal && (
                <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
                    onClick={() => setShowUploadModal(false)}
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                        onClick={e => e.stopPropagation()}
                        className="bg-[#0a0f14] border border-white/10 rounded-2xl p-6 w-full max-w-md"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-white">Importer un Document</h3>
                            <button onClick={() => setShowUploadModal(false)} className="text-gray-500 hover:text-white" title="Fermer"><X size={18} /></button>
                        </div>
                        <div className="space-y-4">
                            <select
                                value={uploadCategory} onChange={e => setUploadCategory(e.target.value)} title="Catégorie"
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm focus:outline-none focus:border-emerald-500/50"
                            >
                                {docCategories.map(c => (
                                    <option key={c.name} value={c.name}>{c.name}</option>
                                ))}
                            </select>

                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center cursor-pointer hover:border-emerald-500/30 transition-all"
                            >
                                {uploading ? (
                                    <Loader2 size={24} className="mx-auto text-emerald-400 animate-spin" />
                                ) : (
                                    <>
                                        <Upload size={24} className="mx-auto text-gray-600 mb-2" />
                                        <p className="text-xs text-gray-500">Cliquez pour sélectionner un fichier</p>
                                        <p className="text-[10px] text-gray-600 mt-1">PDF, Image, Word (max 10 Mo)</p>
                                    </>
                                )}
                            </div>

                            <input
                                ref={fileInputRef}
                                type="file"
                                onChange={e => {
                                    const file = e.target.files?.[0]
                                    if (file) handleUpload(file)
                                }}
                                className="hidden"
                                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                title="Sélectionner un fichier"
                            />
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </div>
    )
}
