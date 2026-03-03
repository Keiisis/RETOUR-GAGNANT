'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Star, Send, User, MessageSquare, Loader2, CheckCircle2 } from 'lucide-react'

interface Review {
    id: string
    product_id: string
    reviewer_name: string
    rating: number
    comment: string
    is_verified: boolean
    created_at: string
}

interface ProductReviewsProps {
    productId: string
}

export function ProductReviews({ productId }: ProductReviewsProps) {
    const [reviews, setReviews] = useState<Review[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [submitted, setSubmitted] = useState(false)

    // Form state
    const [name, setName] = useState('')
    const [rating, setRating] = useState(0)
    const [hoverRating, setHoverRating] = useState(0)
    const [comment, setComment] = useState('')
    const [formError, setFormError] = useState('')

    useEffect(() => {
        fetchReviews()
    }, [productId])

    const fetchReviews = async () => {
        try {
            const res = await fetch(`/api/products/${productId}/reviews`)
            const data = await res.json()
            if (data.reviews) setReviews(data.reviews)
        } catch {
            /* ignore */
        } finally {
            setLoading(false)
        }
    }

    const averageRating = reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : 0

    const ratingDistribution = [5, 4, 3, 2, 1].map(star => ({
        star,
        count: reviews.filter(r => r.rating === star).length,
        pct: reviews.length > 0
            ? Math.round((reviews.filter(r => r.rating === star).length / reviews.length) * 100)
            : 0,
    }))

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setFormError('')

        if (!name.trim()) { setFormError('Veuillez saisir votre nom'); return }
        if (rating === 0) { setFormError('Veuillez sélectionner une note'); return }

        setSubmitting(true)
        try {
            const res = await fetch(`/api/products/${productId}/reviews`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reviewer_name: name, rating, comment }),
            })
            const data = await res.json()
            if (data.success) {
                setSubmitted(true)
                setName('')
                setRating(0)
                setComment('')
                await fetchReviews()
                setTimeout(() => {
                    setSubmitted(false)
                    setShowForm(false)
                }, 3000)
            } else {
                setFormError(data.error || 'Une erreur est survenue')
            }
        } catch {
            setFormError('Erreur de connexion')
        } finally {
            setSubmitting(false)
        }
    }

    const StarDisplay = ({ value, size = 16 }: { value: number, size?: number }) => (
        <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map(i => (
                <Star
                    key={i}
                    size={size}
                    className={i <= Math.round(value) ? 'text-[#FCD116] fill-[#FCD116]' : 'text-gray-700'}
                />
            ))}
        </div>
    )

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr)
        return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    }

    return (
        <section className="container mx-auto px-6 pb-20">
            <div className="border-t border-white/5 pt-16">
                {/* Header */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-10">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="h-[2px] w-8 bg-[#FCD116]" />
                            <h2 className="text-xs font-black uppercase tracking-[0.3em] text-gray-400">
                                Avis Clients
                            </h2>
                        </div>
                        {reviews.length > 0 && (
                            <div className="flex items-center gap-3 mt-3">
                                <span className="text-4xl font-black text-white font-heading">
                                    {averageRating.toFixed(1)}
                                </span>
                                <div>
                                    <StarDisplay value={averageRating} size={18} />
                                    <p className="text-xs text-gray-500 mt-1">
                                        {reviews.length} avis vérifié{reviews.length > 1 ? 's' : ''}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#FCD116]/10 border border-[#FCD116]/20 text-[#FCD116] text-xs font-black uppercase tracking-widest hover:bg-[#FCD116]/20 transition-all"
                    >
                        <MessageSquare size={16} />
                        {showForm ? 'Fermer' : 'Laisser un avis'}
                    </button>
                </div>

                {/* Rating Distribution */}
                {reviews.length > 0 && (
                    <div className="grid grid-cols-5 gap-2 mb-10">
                        {ratingDistribution.map(rd => (
                            <div key={rd.star} className="space-y-1">
                                <div className="flex items-center justify-center gap-1 text-xs text-gray-400">
                                    <span className="font-bold">{rd.star}</span>
                                    <Star size={10} className="text-[#FCD116] fill-[#FCD116]" />
                                </div>
                                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${rd.pct}%` }}
                                        transition={{ duration: 0.8, delay: 0.1 * rd.star }}
                                        className="h-full bg-[#FCD116] rounded-full"
                                    />
                                </div>
                                <p className="text-center text-[9px] text-gray-600">{rd.count}</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* Review Form */}
                <AnimatePresence>
                    {showForm && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden mb-10"
                        >
                            {submitted ? (
                                <div className="flex flex-col items-center justify-center py-10 space-y-3">
                                    <CheckCircle2 size={48} className="text-[#008751]" />
                                    <p className="text-lg font-black text-white">Merci pour votre avis !</p>
                                    <p className="text-xs text-gray-500">Votre retour nous aide à nous améliorer.</p>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmit} className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 md:p-8 space-y-6">
                                    <h3 className="text-sm font-black text-white uppercase tracking-widest">Partagez votre expérience</h3>

                                    {/* Star selector */}
                                    <div>
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Votre note *</label>
                                        <div className="flex items-center gap-1">
                                            {[1, 2, 3, 4, 5].map(i => (
                                                <button
                                                    key={i}
                                                    type="button"
                                                    onMouseEnter={() => setHoverRating(i)}
                                                    onMouseLeave={() => setHoverRating(0)}
                                                    onClick={() => setRating(i)}
                                                    className="p-1 transition-transform hover:scale-125"
                                                >
                                                    <Star
                                                        size={28}
                                                        className={`transition-colors ${i <= (hoverRating || rating)
                                                                ? 'text-[#FCD116] fill-[#FCD116]'
                                                                : 'text-gray-700'
                                                            }`}
                                                    />
                                                </button>
                                            ))}
                                            {rating > 0 && (
                                                <span className="ml-3 text-xs text-gray-400 font-bold">
                                                    {rating === 1 ? 'Mauvais' : rating === 2 ? 'Passable' : rating === 3 ? 'Bien' : rating === 4 ? 'Très bien' : 'Excellent'}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Name */}
                                    <div>
                                        <label htmlFor="review-name" className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Votre nom *</label>
                                        <div className="relative">
                                            <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" />
                                            <input
                                                id="review-name"
                                                type="text"
                                                value={name}
                                                onChange={e => setName(e.target.value)}
                                                placeholder="Votre nom"
                                                className="w-full bg-white/5 border border-white/5 rounded-xl py-3 pl-11 pr-4 text-white text-sm focus:outline-none focus:border-[#FCD116]/30 transition-colors"
                                            />
                                        </div>
                                    </div>

                                    {/* Comment */}
                                    <div>
                                        <label htmlFor="review-comment" className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Votre commentaire</label>
                                        <textarea
                                            id="review-comment"
                                            value={comment}
                                            onChange={e => setComment(e.target.value)}
                                            placeholder="Racontez-nous votre expérience..."
                                            rows={4}
                                            className="w-full bg-white/5 border border-white/5 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-[#FCD116]/30 transition-colors resize-none"
                                        />
                                    </div>

                                    {formError && (
                                        <p className="text-xs text-[#E8112D] font-bold">{formError}</p>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-[#FCD116] text-black font-black text-xs uppercase tracking-widest hover:bg-white transition-all disabled:opacity-50"
                                    >
                                        {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                        {submitting ? 'Envoi...' : 'Publier mon avis'}
                                    </button>
                                </form>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Reviews List */}
                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 size={32} className="animate-spin text-[#FCD116]" />
                    </div>
                ) : reviews.length === 0 ? (
                    <div className="text-center py-16 space-y-4">
                        <Star size={48} className="text-gray-700 mx-auto" />
                        <p className="text-gray-500 text-sm">Aucun avis pour le moment.</p>
                        <p className="text-gray-600 text-xs">Soyez le premier à partager votre expérience !</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {reviews.map((review, i) => (
                            <motion.div
                                key={review.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5, delay: i * 0.05 }}
                                className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-colors"
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-[#FCD116]/10 border border-[#FCD116]/20 flex items-center justify-center text-[#FCD116] font-black text-sm">
                                            {review.reviewer_name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-bold text-white">{review.reviewer_name}</p>
                                                {review.is_verified && (
                                                    <span className="text-[8px] font-black uppercase tracking-widest text-[#008751] bg-[#008751]/10 px-2 py-0.5 rounded-full">
                                                        Vérifié
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[10px] text-gray-600">{formatDate(review.created_at)}</p>
                                        </div>
                                    </div>
                                    <StarDisplay value={review.rating} size={14} />
                                </div>
                                {review.comment && (
                                    <p className="text-sm text-gray-400 leading-relaxed pl-[52px]">
                                        {review.comment}
                                    </p>
                                )}
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </section>
    )
}
