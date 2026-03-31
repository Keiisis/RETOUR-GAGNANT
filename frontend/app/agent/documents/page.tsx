'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useTranslation } from '@/lib/translation'
import {
    FolderOpen, Upload, Search, Trash2, Download, X, Loader2,
    FileText, Image, File, Plus, Eye, Filter
} from 'lucide-react'

interface Document {
    id: string
    agent_id: string
    filename: string
    original_name: string
    file_url: string
    category: string
    subcategory: string
    client_name: string
    notes: string
    file_size: number
    file_type: string
    created_at: string
}

const categories = [
    { id: 'passeports', label: 'Passeports & Identités', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    { id: 'actes', label: 'Actes Notariés', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
    { id: 'certificats', label: 'Certificats', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    { id: 'dossiers_clients', label: 'Dossiers Clients', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    { id: 'photos', label: 'Photos', color: 'bg-pink-500/10 text-pink-400 border-pink-500/20' },
    { id: 'contrats', label: 'Contrats', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
    { id: 'factures', label: 'Factures & Reçus', color: 'bg-teal-500/10 text-teal-400 border-teal-500/20' },
    { id: 'autres', label: 'Autres', color: 'bg-gray-500/10 text-gray-400 border-gray-500/20' },
]

const getFileIcon = (type: string) => {
    if (type?.includes('image')) return Image
    if (type?.includes('pdf')) return FileText
    return File
}

const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function AgentDocumentsPage() {
    const { t } = useTranslation()
    const [docs, setDocs] = useState<Document[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [filterCategory, setFilterCategory] = useState<string | null>(null)
    const [showUpload, setShowUpload] = useState(false)
    const [uploading, setUploading] = useState(false)

    // Upload form
    const [uploadFile, setUploadFile] = useState<globalThis.File | null>(null)
    const [uploadCategory, setUploadCategory] = useState('dossiers_clients')
    const [uploadSubcategory, setUploadSubcategory] = useState('')
    const [uploadClientName, setUploadClientName] = useState('')
    const [uploadNotes, setUploadNotes] = useState('')

    const fetchDocs = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data } = await supabase
            .from('agent_documents')
            .select('*')
            .eq('agent_id', user.id)
            .order('created_at', { ascending: false })
        setDocs((data || []) as Document[])
        setLoading(false)
    }, [])

    useEffect(() => { fetchDocs() }, [fetchDocs])

    const handleUpload = async () => {
        if (!uploadFile) return
        setUploading(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const ext = uploadFile.name.split('.').pop()
        const filename = `${user.id}/${Date.now()}_${uploadFile.name}`

        // Try Supabase Storage upload
        let fileUrl = ''
        const { data: storageData, error: storageError } = await supabase.storage
            .from('agent-documents')
            .upload(filename, uploadFile)

        if (!storageError && storageData) {
            const { data: publicUrl } = supabase.storage
                .from('agent-documents')
                .getPublicUrl(filename)
            fileUrl = publicUrl.publicUrl
        } else {
            fileUrl = `https://storage.placeholder/${filename}`
        }

        await supabase.from('agent_documents').insert({
            agent_id: user.id,
            filename,
            original_name: uploadFile.name,
            file_url: fileUrl,
            category: uploadCategory,
            subcategory: uploadSubcategory,
            client_name: uploadClientName,
            notes: uploadNotes,
            file_size: uploadFile.size,
            file_type: uploadFile.type,
        })

        await fetchDocs()
        setShowUpload(false)
        setUploadFile(null)
        setUploadCategory('dossiers_clients')
        setUploadSubcategory('')
        setUploadClientName('')
        setUploadNotes('')
        setUploading(false)
    }

    const handleDelete = async (doc: Document) => {
        try {
            await supabase.storage.from('agent-documents').remove([doc.filename])
        } catch { /* ignore storage errors */ }
        await supabase.from('agent_documents').delete().eq('id', doc.id)
        setDocs(prev => prev.filter(d => d.id !== doc.id))
    }

    const filtered = docs.filter(d => {
        const matchSearch = d.original_name?.toLowerCase().includes(search.toLowerCase()) ||
            d.client_name?.toLowerCase().includes(search.toLowerCase()) ||
            d.notes?.toLowerCase().includes(search.toLowerCase())
        const matchCategory = !filterCategory || d.category === filterCategory
        return matchSearch && matchCategory
    })

    if (loading) {
        return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" /></div>
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <FolderOpen size={16} className="text-emerald-400" />
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.3em]">GED</span>
                    </div>
                    <h1 className="text-2xl font-black text-white">Documents</h1>
                    <p className="text-gray-500 text-sm mt-1">{docs.length} fichier(s)</p>
                </div>
                <button onClick={() => setShowUpload(true)} className="flex items-center gap-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-500/30 transition-all">
                    <Upload size={16} /> Nouveau Document
                </button>
            </div>

            {/* Category stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {categories.map(cat => (
                    <button key={cat.id} onClick={() => setFilterCategory(filterCategory === cat.id ? null : cat.id)} className={`border rounded-xl p-3 text-left transition-all ${filterCategory === cat.id ? cat.color : 'bg-white/[0.03] border-white/5 hover:border-white/10'}`}>
                        <p className="text-xl font-black text-white">{docs.filter(d => d.category === cat.id).length}</p>
                        <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">{t(cat.label)}</p>
                    </button>
                ))}
            </div>

            {/* Search + Filter */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un fichier, un client..." title="Rechercher" className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 text-sm" />
                </div>
                {filterCategory && (
                    <button onClick={() => setFilterCategory(null)} className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 px-3 py-2 rounded-xl font-bold hover:bg-emerald-500/20">
                        <Filter size={12} /> {t(categories.find(c => c.id === filterCategory)?.label || '')} <X size={10} />
                    </button>
                )}
            </div>

            {/* Files */}
            <div className="space-y-2">
                {filtered.length === 0 ? (
                    <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-12 text-center text-gray-500">
                        <FolderOpen size={40} className="mx-auto mb-3 text-gray-700" />
                        <p className="text-sm font-semibold">Aucun document</p>
                        <p className="text-xs mt-1">Uploadez votre premier fichier</p>
                    </div>
                ) : filtered.map((doc, i) => {
                    const FileIcon = getFileIcon(doc.file_type)
                    const catConfig = categories.find(c => c.id === doc.category) || categories[categories.length - 1]
                    return (
                        <motion.div key={doc.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} className="bg-white/[0.03] border border-white/5 rounded-xl p-4 hover:border-emerald-500/20 transition-all group">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${catConfig.color}`}>
                                        <FileIcon size={18} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-white">{doc.original_name}</p>
                                        <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                                            <span>{catConfig.label}</span>
                                            {doc.client_name && <span>• {doc.client_name}</span>}
                                            <span>• {formatSize(doc.file_size)}</span>
                                            <span>• {new Date(doc.created_at).toLocaleDateString('fr-FR')}</span>
                                        </div>
                                        {doc.notes && <p className="text-[10px] text-gray-600 mt-0.5 line-clamp-1">{doc.notes}</p>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {doc.file_url && (
                                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-blue-400" title="Télécharger"><Download size={14} /></a>
                                    )}
                                    <button onClick={() => handleDelete(doc)} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-red-400" title="Supprimer"><Trash2 size={14} /></button>
                                </div>
                            </div>
                        </motion.div>
                    )
                })}
            </div>

            {/* Upload Modal */}
            <AnimatePresence>
                {showUpload && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowUpload(false)}>
                        <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} onClick={e => e.stopPropagation()} className="bg-[#0a0f14] border border-white/10 rounded-2xl p-6 w-full max-w-md">
                            <h3 className="text-lg font-bold text-white mb-4">Nouveau Document</h3>
                            <div className="space-y-3">
                                {/* File drop zone */}
                                <label className="block border-2 border-dashed border-white/10 rounded-xl p-8 text-center cursor-pointer hover:border-emerald-500/30 transition-all">
                                    <input type="file" className="hidden" onChange={e => setUploadFile(e.target.files?.[0] || null)} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.zip,.rar" />
                                    {uploadFile ? (
                                        <div>
                                            <FileText size={28} className="text-emerald-400 mx-auto mb-2" />
                                            <p className="text-sm text-white font-bold">{uploadFile.name}</p>
                                            <p className="text-xs text-gray-500">{formatSize(uploadFile.size)}</p>
                                        </div>
                                    ) : (
                                        <div>
                                            <Upload size={28} className="text-gray-600 mx-auto mb-2" />
                                            <p className="text-sm text-gray-400">Glissez ou cliquez pour sélectionner</p>
                                            <p className="text-xs text-gray-600 mt-1">PDF, Images, Word, Excel, ZIP, RAR</p>
                                        </div>
                                    )}
                                </label>

                                {/* Category */}
                                <div>
                                    <label className="text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-1.5 block">Catégorie</label>
                                    <select value={uploadCategory} onChange={e => setUploadCategory(e.target.value)} title="Catégorie" className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm focus:outline-none focus:border-emerald-500/50">
                                        {categories.map(c => <option key={c.id} value={c.id}>{t(c.label)}</option>)}
                                    </select>
                                </div>

                                {/* Subcategory */}
                                <input type="text" value={uploadSubcategory} onChange={e => setUploadSubcategory(e.target.value)} placeholder="Sous-catégorie (optionnel)" title="Sous-catégorie" className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50" />

                                {/* Client Name */}
                                <input type="text" value={uploadClientName} onChange={e => setUploadClientName(e.target.value)} placeholder="Nom du client associé (optionnel)" title="Client" className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50" />

                                {/* Notes */}
                                <textarea value={uploadNotes} onChange={e => setUploadNotes(e.target.value)} placeholder="Notes / Description du document" title="Notes" rows={3} className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 resize-none" />

                                <div className="flex gap-3 pt-2">
                                    <button onClick={() => setShowUpload(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 text-sm font-bold">Annuler</button>
                                    <button onClick={handleUpload} disabled={uploading || !uploadFile} className="flex-1 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                                        {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Uploader
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
