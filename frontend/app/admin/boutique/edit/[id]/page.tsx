'use client'

import { useTranslation, T } from '@/lib/translation';
import { useOne, useUpdate, useNavigation } from '@refinedev/core'
import { useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { ArrowLeft, FloppyDisk as Save, ShoppingBag, Plus, CircleNotch as Loader2 } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ImageUpload } from '@/components/admin/ImageUpload'

const categories = ['Mode', 'Artisanat', 'Alimentaire', 'Culturel', 'Accessoires', 'Autre']

export default function EditProductPage() {
    const { t } = useTranslation();
    const params = useParams()
    const productId = params.id as string
    const { list } = useNavigation()
    const productQuery = useOne({
        resource: 'products',
        id: productId,
    })
    const updateResult = useUpdate()
    const updateProduct = updateResult.mutate
    const queryInternal = productQuery as unknown as Record<string, unknown>
    const queryObj = (queryInternal.query ?? queryInternal) as Record<string, boolean | undefined>
    const isLoadingProduct = queryObj.isLoading ?? queryObj.isFetching ?? false
    const isSaving = (updateResult as unknown as { isLoading?: boolean }).isLoading
        ?? (updateResult as unknown as { isPending?: boolean }).isPending
        ?? false

    const product = (productQuery as unknown as { data?: { data?: Record<string, unknown> } }).data?.data
        ?? (queryInternal.result as Record<string, unknown> | undefined)

    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [longDescription, setLongDescription] = useState('')
    const [price, setPrice] = useState('')
    const [salePrice, setSalePrice] = useState('')
    const [category, setCategory] = useState('Artisanat')
    const [stock, setStock] = useState('0')
    const [images, setImages] = useState<string[]>([])
    const [isActive, setIsActive] = useState(true)

    useEffect(() => {
        if (product) {
            setTitle(String(product.title || ''))
            setDescription(String(product.description || ''))
            setLongDescription(String(product.long_description || ''))
            setPrice(String(product.price || ''))
            setSalePrice(product.sale_price ? String(product.sale_price) : '')
            setCategory(String(product.category || 'Artisanat'))
            setStock(String(product.stock || 0))
            setImages(Array.isArray(product.images) ? product.images as string[] : [])
            setIsActive(typeof product.is_active === 'boolean' ? product.is_active : true)
        }
    }, [product])

    const handleSubmit = () => {
        if (!title.trim() || !price) return

        updateProduct(
            {
                resource: 'products',
                id: productId,
                values: {
                    title: title.trim(),
                    description: description.trim(),
                    long_description: longDescription.trim(),
                    price: parseFloat(price),
                    sale_price: salePrice ? parseFloat(salePrice) : null,
                    category,
                    stock: parseInt(stock) || 0,
                    images,
                    is_active: isActive,
                    currency: 'XOF',
                },
            },
            {
                onSuccess: () => list('products'),
            }
        )
    }

    if (isLoadingProduct) {
        return (
            <div className="flex justify-center py-32">
                <Loader2 size={48} className="animate-spin text-[#FCD116]" />
            </div>
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
                            <span className="text-[10px] font-black uppercase tracking-[0.4em]"><T>Modifier le Produit</T></span>
                        </div>
                        <h1 className="text-3xl font-black text-white font-heading tracking-tighter">
                            {title || 'Edition'}
                        </h1>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={isActive}
                            onChange={e => setIsActive(e.target.checked)}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-white/10 peer-checked:bg-[#008751] rounded-full relative transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] peer-checked:after:left-[22px] after:bg-white after:rounded-full after:w-5 after:h-5 after:transition-all" />
                        <span className="text-xs font-bold text-gray-400">{isActive ? 'Actif' : 'Inactif'}</span>
                    </label>

                    <Button
                        onClick={handleSubmit}
                        disabled={isSaving || !title.trim() || !price}
                        className="h-14 px-8 rounded-2xl bg-[#FCD116] text-[#0f141e] font-black tracking-widest gap-2 shadow-xl disabled:opacity-40"
                    >
                        {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                        SAUVEGARDER
                    </Button>
                </div>
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
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block"><T>Titre *</T></label>
                                <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder={t("Titre du produit")} title={t("Titre du produit")} className="w-full bg-white/5 border border-white/5 rounded-xl py-3.5 px-4 text-white text-sm focus:outline-none focus:border-[#FCD116]/30" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block"><T>Description courte</T></label>
                                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder={t("Description courte")} title={t("Description courte")} className="w-full bg-white/5 border border-white/5 rounded-xl py-3.5 px-4 text-white text-sm focus:outline-none focus:border-[#FCD116]/30 resize-none" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block"><T>Description longue</T></label>
                                <textarea value={longDescription} onChange={e => setLongDescription(e.target.value)} rows={6} placeholder={t("Description longue")} title={t("Description longue")} className="w-full bg-white/5 border border-white/5 rounded-xl py-3.5 px-4 text-white text-sm focus:outline-none focus:border-[#FCD116]/30 resize-none" />
                            </div>
                        </CardContent>
                    </Card>

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
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block"><T>Prix (XOF) *</T></label>
                                <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder={t("Prix")} title={t("Prix")} className="w-full bg-white/5 border border-white/5 rounded-xl py-3.5 px-4 text-white text-sm focus:outline-none focus:border-[#FCD116]/30" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block"><T>Prix Promo (XOF)</T></label>
                                <input type="number" value={salePrice} onChange={e => setSalePrice(e.target.value)} placeholder={t("Prix promo")} title={t("Prix promo")} className="w-full bg-white/5 border border-white/5 rounded-xl py-3.5 px-4 text-white text-sm focus:outline-none focus:border-[#FCD116]/30" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-[#0a0f18] border-white/5 rounded-[2rem] overflow-hidden">
                        <CardHeader className="p-4 md:p-8 border-b border-white/5">
                            <CardTitle className="text-lg font-black text-white"><T>Organisation</T></CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 md:p-8 space-y-6">
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block"><T>Categorie</T></label>
                                <select value={category} aria-label={t("Catégorie")} title={t("Catégorie")} onChange={e => setCategory(e.target.value)} className="w-full bg-white/5 border border-white/5 rounded-xl py-3.5 px-4 text-white text-sm focus:outline-none focus:border-[#FCD116]/30">
                                    {categories.map(cat => (<option key={cat} value={cat} className="bg-[#0a0f18]">{cat}</option>))}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block"><T>Stock</T></label>
                                <input type="number" value={stock} onChange={e => setStock(e.target.value)} placeholder={t("Stock disponible")} title={t("Stock")} className="w-full bg-white/5 border border-white/5 rounded-xl py-3.5 px-4 text-white text-sm focus:outline-none focus:border-[#FCD116]/30" />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
