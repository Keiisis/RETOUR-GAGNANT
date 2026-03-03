'use client'

import { useCreate, useNavigation } from '@refinedev/core'
import { useState } from 'react'
import { ArrowLeft, Save, ShoppingBag, Plus, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const categories = ['Mode', 'Artisanat', 'Alimentaire', 'Culturel', 'Accessoires', 'Autre']

export default function CreateProductPage() {
    const { list } = useNavigation()
    const createResult = useCreate()
    const createProduct = createResult.mutate
    const isLoading = (createResult as unknown as { isLoading?: boolean }).isLoading
        ?? (createResult as unknown as { isPending?: boolean }).isPending
        ?? false

    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [longDescription, setLongDescription] = useState('')
    const [price, setPrice] = useState('')
    const [salePrice, setSalePrice] = useState('')
    const [category, setCategory] = useState('Artisanat')
    const [stock, setStock] = useState('0')
    const [images, setImages] = useState<string[]>([])
    const [newImageUrl, setNewImageUrl] = useState('')

    const addImage = () => {
        if (newImageUrl.trim()) {
            setImages(prev => [...prev, newImageUrl.trim()])
            setNewImageUrl('')
        }
    }

    const removeImage = (index: number) => {
        setImages(prev => prev.filter((_, i) => i !== index))
    }

    const handleSubmit = () => {
        if (!title.trim() || !price) return

        createProduct(
            {
                resource: 'products',
                values: {
                    title: title.trim(),
                    description: description.trim(),
                    long_description: longDescription.trim(),
                    price: parseFloat(price),
                    sale_price: salePrice ? parseFloat(salePrice) : null,
                    currency: 'XOF',
                    category,
                    stock: parseInt(stock) || 0,
                    images,
                    is_active: true,
                    is_featured: false,
                },
            },
            {
                onSuccess: () => list('products'),
            }
        )
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => list('products')}
                        title="Retour"
                        className="p-3 rounded-xl bg-white/5 border border-white/5 text-gray-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <div className="flex items-center gap-2 text-[#FCD116]">
                            <ShoppingBag size={16} />
                            <span className="text-[10px] font-black uppercase tracking-[0.4em]">Nouveau Produit</span>
                        </div>
                        <h1 className="text-3xl font-black text-white font-heading tracking-tighter">
                            Creer un Article
                        </h1>
                    </div>
                </div>

                <Button
                    onClick={handleSubmit}
                    disabled={isLoading || !title.trim() || !price}
                    className="h-14 px-8 rounded-2xl bg-[#008751] text-white font-black tracking-widest gap-2 shadow-xl disabled:opacity-40"
                >
                    {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    PUBLIER
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main form */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="bg-[#0a0f18] border-white/5 rounded-[2rem] overflow-hidden">
                        <CardHeader className="p-8 border-b border-white/5">
                            <CardTitle className="text-lg font-black text-white">Informations Produit</CardTitle>
                        </CardHeader>
                        <CardContent className="p-8 space-y-6">
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                                    Titre du produit *
                                </label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    placeholder="Ex: Tissu Wax authentique du Benin"
                                    className="w-full bg-white/5 border border-white/5 rounded-xl py-3.5 px-4 text-white text-sm focus:outline-none focus:border-[#FCD116]/30"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                                    Description courte
                                </label>
                                <textarea
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    placeholder="Breve description visible dans le catalogue"
                                    rows={3}
                                    className="w-full bg-white/5 border border-white/5 rounded-xl py-3.5 px-4 text-white text-sm focus:outline-none focus:border-[#FCD116]/30 resize-none"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                                    Description longue
                                </label>
                                <textarea
                                    value={longDescription}
                                    onChange={e => setLongDescription(e.target.value)}
                                    placeholder="Description detaillee sur la page du produit"
                                    rows={6}
                                    className="w-full bg-white/5 border border-white/5 rounded-xl py-3.5 px-4 text-white text-sm focus:outline-none focus:border-[#FCD116]/30 resize-none"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Images */}
                    <Card className="bg-[#0a0f18] border-white/5 rounded-[2rem] overflow-hidden">
                        <CardHeader className="p-8 border-b border-white/5">
                            <CardTitle className="text-lg font-black text-white">Images</CardTitle>
                        </CardHeader>
                        <CardContent className="p-8 space-y-4">
                            <div className="flex gap-3">
                                <input
                                    type="text"
                                    value={newImageUrl}
                                    onChange={e => setNewImageUrl(e.target.value)}
                                    placeholder="URL de l'image"
                                    className="flex-1 bg-white/5 border border-white/5 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-[#FCD116]/30"
                                    onKeyDown={e => e.key === 'Enter' && addImage()}
                                />
                                <Button onClick={addImage} className="h-12 px-5 rounded-xl bg-white/10 text-white hover:bg-white/20">
                                    <Plus size={18} />
                                </Button>
                            </div>

                            {images.length > 0 && (
                                <div className="flex flex-wrap gap-3">
                                    {images.map((img, i) => (
                                        <div key={i} className="relative w-24 h-24 rounded-xl overflow-hidden border border-white/10">
                                            <img src={img} alt="" className="w-full h-full object-cover" />
                                            <button
                                                title="Supprimer l'image"
                                                onClick={() => removeImage(i)}
                                                className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white hover:bg-red-500 transition-colors"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    <Card className="bg-[#0a0f18] border-white/5 rounded-[2rem] overflow-hidden">
                        <CardHeader className="p-8 border-b border-white/5">
                            <CardTitle className="text-lg font-black text-white">Tarification</CardTitle>
                        </CardHeader>
                        <CardContent className="p-8 space-y-6">
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                                    Prix (XOF) *
                                </label>
                                <input
                                    type="number"
                                    value={price}
                                    onChange={e => setPrice(e.target.value)}
                                    placeholder="0"
                                    className="w-full bg-white/5 border border-white/5 rounded-xl py-3.5 px-4 text-white text-sm focus:outline-none focus:border-[#FCD116]/30"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                                    Prix Promo (XOF)
                                </label>
                                <input
                                    type="number"
                                    value={salePrice}
                                    onChange={e => setSalePrice(e.target.value)}
                                    placeholder="Optionnel"
                                    className="w-full bg-white/5 border border-white/5 rounded-xl py-3.5 px-4 text-white text-sm focus:outline-none focus:border-[#FCD116]/30"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-[#0a0f18] border-white/5 rounded-[2rem] overflow-hidden">
                        <CardHeader className="p-8 border-b border-white/5">
                            <CardTitle className="text-lg font-black text-white">Organisation</CardTitle>
                        </CardHeader>
                        <CardContent className="p-8 space-y-6">
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                                    Categorie
                                </label>
                                <select
                                    value={category}
                                    title="Catégorie"
                                    aria-label="Catégorie"
                                    onChange={e => setCategory(e.target.value)}
                                    className="w-full bg-white/5 border border-white/5 rounded-xl py-3.5 px-4 text-white text-sm focus:outline-none focus:border-[#FCD116]/30"
                                >
                                    {categories.map(cat => (
                                        <option key={cat} value={cat} className="bg-[#0a0f18]">{cat}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                                    Stock disponible
                                </label>
                                <input
                                    type="number"
                                    value={stock}
                                    onChange={e => setStock(e.target.value)}
                                    placeholder="0"
                                    className="w-full bg-white/5 border border-white/5 rounded-xl py-3.5 px-4 text-white text-sm focus:outline-none focus:border-[#FCD116]/30"
                                />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
