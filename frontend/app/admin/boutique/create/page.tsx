'use client'

import { useTranslation, T } from '@/lib/translation';
import { useCreate, useNavigation } from '@refinedev/core'
import { useState } from 'react'
import { ArrowLeft, FloppyDisk as Save, ShoppingBag, Plus, CircleNotch as Loader2 } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ImageUpload } from '@/components/admin/ImageUpload'

const categories = ['Mode', 'Artisanat', 'Alimentaire', 'Culturel', 'Accessoires', 'Autre']

export default function CreateProductPage() {
    const { t } = useTranslation();
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
                        title={t("Retour")}
                        className="p-3 rounded-xl bg-white/5 border border-white/5 text-gray-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <div className="flex items-center gap-2 text-[#FCD116]">
                            <ShoppingBag size={16} />
                            <span className="text-[10px] font-black uppercase tracking-[0.4em]"><T>Nouveau Produit</T></span>
                        </div>
                        <h1 className="text-3xl font-black text-white font-heading tracking-tighter">
                            Créer un Article
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
                        <CardHeader className="p-4 md:p-8 border-b border-white/5">
                            <CardTitle className="text-lg font-black text-white"><T>Informations Produit</T></CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 md:p-8 space-y-6">
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                                    Titre du produit *
                                </label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    placeholder={t("Ex: Tissu Wax authentique du Benin")}
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
                                    placeholder={t("Breve description visible dans le catalogue")}
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
                                    placeholder={t("Description detaillee sur la page du produit")}
                                    rows={6}
                                    className="w-full bg-white/5 border border-white/5 rounded-xl py-3.5 px-4 text-white text-sm focus:outline-none focus:border-[#FCD116]/30 resize-none"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Images */}
                    <Card className="bg-[#0a0f18] border-white/5 rounded-[2rem] overflow-hidden">
                        <CardHeader className="p-4 md:p-8 border-b border-white/5">
                            <CardTitle className="text-lg font-black text-white"><T>Images du produit</T></CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 md:p-8 space-y-4">
                            {images.map((img, i) => (
                                <div key={i} className="relative">
                                    <ImageUpload
                                        value={img}
                                        onChange={url => {
                                            const next = [...images]
                                            if (url) { next[i] = url } else { next.splice(i, 1) }
                                            setImages(next)
                                        }}
                                        bucket="products"
                                        folder="images"
                                    />
                                </div>
                            ))}
                            <Button
                                type="button"
                                onClick={() => setImages(prev => [...prev, ''])}
                                className="w-full h-12 rounded-xl bg-white/5 border border-dashed border-white/10 text-gray-400 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all gap-2"
                            >
                                <Plus size={16} /> Ajouter une image
                            </Button>
                            <p className="text-[10px] text-gray-600">
                                Glissez une image ou collez une URL directe. Formats : JPG, PNG, WebP : max 5 Mo.
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    <Card className="bg-[#0a0f18] border-white/5 rounded-[2rem] overflow-hidden">
                        <CardHeader className="p-4 md:p-8 border-b border-white/5">
                            <CardTitle className="text-lg font-black text-white"><T>Tarification</T></CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 md:p-8 space-y-6">
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
                                    placeholder={t("Optionnel")}
                                    className="w-full bg-white/5 border border-white/5 rounded-xl py-3.5 px-4 text-white text-sm focus:outline-none focus:border-[#FCD116]/30"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-[#0a0f18] border-white/5 rounded-[2rem] overflow-hidden">
                        <CardHeader className="p-4 md:p-8 border-b border-white/5">
                            <CardTitle className="text-lg font-black text-white"><T>Organisation</T></CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 md:p-8 space-y-6">
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                                    Categorie
                                </label>
                                <select
                                    value={category}
                                    title={t("Catégorie")}
                                    aria-label={t("Catégorie")}
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
