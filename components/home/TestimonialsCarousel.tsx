'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Quote, Star, Send, CheckCircle, MapPin, User, Briefcase, MessageSquare, Upload, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Image from 'next/image';

interface Testimonial {
    id: number;
    name: string;
    role: string;
    text: string;
    location: string;
    rating: number;
    service: string;
    photoUrl?: string; // URL from Strapi or null
}

const fallbackTestimonials: Testimonial[] = [
    {
        id: 1,
        name: "Jean-Marc K.",
        role: "Investisseur Immobilier",
        text: "Grâce à RETOUR GAGNANT, j'ai pu sécuriser un terrain à Calavi en moins de 2 semaines. Leur professionnalisme est rassurant.",
        location: "Paris, France",
        rating: 5,
        service: "Immobilier",
    },
    {
        id: 2,
        name: "Sarah D.",
        role: "Entrepreneur",
        text: "L'accompagnement pour la création de ma société a été exemplaire. Je recommande vivement pour tout projet de retour.",
        location: "Montréal, Canada",
        rating: 5,
        service: "Business",
    },
    {
        id: 3,
        name: "Famille Togbé",
        role: "Installation Définitive",
        text: "Une transition en douceur pour toute la famille. De l'école des enfants au logement, tout a été géré parfaitement.",
        location: "Bruxelles, Belgique",
        rating: 5,
        service: "Logement",
    },
];

const BENIN_COLORS = {
    green: "#008751",
    yellow: "#FCD116",
    red: "#E8112D"
};

function TestimonialCard({ item }: { item: Testimonial }) {
    return (
        <div className="flex-shrink-0 w-[380px] p-6 mx-3">
            <div className="relative bg-white/90 backdrop-blur-md rounded-3xl p-8 shadow-xl border border-white/20 hover:border-[#FCD116]/50 transition-all duration-300 h-full group overflow-hidden">

                {/* Benin Color Gradient Border Effect */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#008751] via-[#FCD116] to-[#E8112D]" />

                {/* Quote icon */}
                <div className="absolute top-6 right-6 opacity-10">
                    <Quote size={60} className="text-[#008751]" />
                </div>

                {/* Header: Photo & Name */}
                <div className="flex items-center gap-4 mb-6 relative z-10">
                    <div className="w-14 h-14 rounded-full border-2 border-[#FCD116] p-0.5 shadow-sm overflow-hidden bg-gray-50 flex-shrink-0">
                        {item.photoUrl ? (
                            <Image
                                src={item.photoUrl}
                                alt={item.name}
                                width={56}
                                height={56}
                                className="w-full h-full object-cover rounded-full"
                            />
                        ) : (
                            <div className="w-full h-full rounded-full bg-gradient-to-br from-[#008751] to-[#006039] flex items-center justify-center text-white font-bold text-lg">
                                {item.name.charAt(0)}
                            </div>
                        )}
                    </div>
                    <div>
                        <h4 className="font-bold text-[#1a2332] text-lg leading-tight">{item.name}</h4>
                        <p className="text-xs text-[#E8112D] font-medium flex items-center gap-1 uppercase tracking-wider mt-0.5">
                            {item.role}
                        </p>
                    </div>
                </div>

                {/* Rating Stars */}
                <div className="flex gap-1 mb-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                            key={i}
                            size={14}
                            className={`${i < item.rating ? "text-[#FCD116] fill-[#FCD116]" : "text-gray-200"} transition-colors`}
                        />
                    ))}
                </div>

                {/* Text */}
                <p className="text-gray-700 leading-relaxed mb-6 text-[15px] relative z-10">
                    &ldquo;{item.text}&rdquo;
                </p>

                {/* Footer: Location & Service */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-100/50">
                    <div className="flex items-center gap-1.5 text-gray-500 text-xs">
                        <MapPin size={12} />
                        <span>{item.location}</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-1 rounded bg-[#008751]/10 text-[#008751] uppercase tracking-wide">
                        {item.service}
                    </span>
                </div>
            </div>
        </div>
    );
}

function SubmissionForm() {
    const [formData, setFormData] = useState({ name: '', role: '', location: '', text: '', service: '', rating: 5 });
    const [photo, setPhoto] = useState<File | null>(null);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setPhoto(e.target.files[0]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const STRAPI_URL = process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1337';

            // 1. Upload Photo if exists
            let photoId = null;
            if (photo) {
                const uploadData = new FormData();
                uploadData.append('files', photo);

                const uploadRes = await fetch(`${STRAPI_URL}/api/upload`, {
                    method: 'POST',
                    body: uploadData,
                });

                if (uploadRes.ok) {
                    const uploadJson = await uploadRes.json();
                    photoId = uploadJson[0].id;
                }
            }

            // 2. Submit Testimonial Data
            const payload = {
                data: {
                    ...formData,
                    photo: photoId,
                    approved: false // Requires admin approval
                }
            };

            await fetch(`${STRAPI_URL}/api/testimonials`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            setIsSubmitted(true);
        } catch (error) {
            console.error("Submission failed", error);
            // Show success anyway for UX (optimistic)
            setIsSubmitted(true);
        } finally {
            setIsLoading(false);
        }
    };

    if (isSubmitted) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-16 px-8 bg-white/80 backdrop-blur-xl rounded-3xl border border-white/40 shadow-2xl"
            >
                <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-tr from-[#008751] to-[#FCD116] p-1 shadow-lg animate-pulse">
                    <div className="w-full h-full bg-white rounded-full flex items-center justify-center">
                        <CheckCircle size={48} className="text-[#008751]" />
                    </div>
                </div>
                <h3 className="text-3xl font-bold text-[#1a2332] mb-3 font-heading">Merci ! 🇧🇯</h3>
                <p className="text-gray-600 max-w-xs mx-auto">Votre témoignage a été reçu. Il sera publié après validation par notre équipe.</p>
                <Button
                    variant="ghost"
                    className="mt-8 text-[#008751] hover:bg-[#008751]/10"
                    onClick={() => { setIsSubmitted(false); setFormData({ name: '', role: '', location: '', text: '', service: '', rating: 5 }); setPhoto(null); }}
                >
                    Envoyer un autre avis
                </Button>
            </motion.div>
        );
    }

    return (
        <div className="relative">
            {/* Immersive Glass Background */}
            <div className="absolute inset-0 bg-white/60 backdrop-blur-xl rounded-[2rem] border border-white/40 shadow-2xl z-0" />

            <motion.form
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                onSubmit={handleSubmit}
                className="relative z-10 p-8 md:p-10 space-y-6"
            >
                <div className="text-center mb-8">
                    <h3 className="text-2xl font-bold font-heading bg-clip-text text-transparent bg-gradient-to-r from-[#008751] to-[#1a2332]">
                        Partagez votre expérience
                    </h3>
                    <p className="text-gray-500 text-sm mt-2">Rejoignez la communauté du Retour Gagnant</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Identity Inputs */}
                    <div className="space-y-5">
                        <div className="relative group">
                            <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#008751] transition-colors" />
                            <input
                                type="text"
                                placeholder="Votre nom"
                                required
                                value={formData.name}
                                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                className="w-full pl-12 pr-4 py-4 rounded-xl border border-gray-200/50 bg-white/50 text-sm focus:outline-none focus:border-[#008751] focus:ring-4 focus:ring-[#008751]/10 transition-all font-medium text-gray-700 placeholder:text-gray-400"
                            />
                        </div>
                        <div className="relative group">
                            <Briefcase size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#FCD116] transition-colors" />
                            <input
                                type="text"
                                placeholder="Votre rôle (ex: Entrepreneur)"
                                required
                                value={formData.role}
                                onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                                className="w-full pl-12 pr-4 py-4 rounded-xl border border-gray-200/50 bg-white/50 text-sm focus:outline-none focus:border-[#FCD116] focus:ring-4 focus:ring-[#FCD116]/10 transition-all font-medium text-gray-700 placeholder:text-gray-400"
                            />
                        </div>
                    </div>

                    {/* Location & Service */}
                    <div className="space-y-5">
                        <div className="relative group">
                            <MapPin size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#E8112D] transition-colors" />
                            <input
                                type="text"
                                placeholder="Ville, Pays"
                                required
                                value={formData.location}
                                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                                className="w-full pl-12 pr-4 py-4 rounded-xl border border-gray-200/50 bg-white/50 text-sm focus:outline-none focus:border-[#E8112D] focus:ring-4 focus:ring-[#E8112D]/10 transition-all font-medium text-gray-700 placeholder:text-gray-400"
                            />
                        </div>
                        <select
                            required
                            value={formData.service}
                            onChange={(e) => setFormData(prev => ({ ...prev, service: e.target.value }))}
                            className="w-full px-4 py-4 rounded-xl border border-gray-200/50 bg-white/50 text-sm focus:outline-none focus:border-[#008751] focus:ring-4 focus:ring-[#008751]/10 transition-all text-gray-600 font-medium cursor-pointer"
                        >
                            <option value="">Service utilisé</option>
                            <option value="Administratif">Passeport & Administratif</option>
                            <option value="Immobilier">Logement Premium</option>
                            <option value="Business">Création d'Entreprise</option>
                            <option value="Culture">Guide Culturel</option>
                            <option value="Construction">Construction</option>
                            <option value="Investissement">Investissement</option>
                        </select>
                    </div>
                </div>

                {/* Rating & Photo Upload Row */}
                <div className="flex flex-col md:flex-row gap-5 items-center justify-between p-4 bg-white/40 rounded-2xl border border-white/60">
                    {/* Star Rating */}
                    <div className="flex flex-col items-center md:items-start gap-2">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Votre Note</span>
                        <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, rating: star }))}
                                    className="focus:outline-none transition-transform hover:scale-110 active:scale-95"
                                >
                                    <Star
                                        size={28}
                                        className={star <= formData.rating ? "text-[#FCD116] fill-[#FCD116] drop-shadow-sm" : "text-gray-300"}
                                    />
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Photo Upload */}
                    <div className="flex flex-col items-center md:items-end gap-2 w-full md:w-auto">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Votre Photo (Optionnel)</span>
                        <input
                            type="file"
                            accept="image/*"
                            ref={fileInputRef}
                            className="hidden"
                            onChange={handlePhotoChange}
                        />
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-3 px-5 py-2.5 rounded-xl border border-dashed border-gray-400 hover:border-[#008751] hover:bg-[#008751]/5 transition-all w-full md:w-auto justify-center"
                        >
                            {photo ? (
                                <>
                                    <div className="w-6 h-6 rounded-full overflow-hidden border border-gray-200">
                                        <img src={URL.createObjectURL(photo)} alt="Preview" className="w-full h-full object-cover" />
                                    </div>
                                    <span className="text-sm font-medium text-[#008751] truncate max-w-[120px]">{photo.name}</span>
                                </>
                            ) : (
                                <>
                                    <Camera size={18} className="text-gray-400" />
                                    <span className="text-sm font-medium text-gray-500">Ajouter une photo</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Message */}
                <div className="relative group">
                    <MessageSquare size={18} className="absolute left-4 top-5 text-gray-400 group-focus-within:text-[#008751] transition-colors" />
                    <textarea
                        placeholder="Racontez-nous votre histoire..."
                        required
                        rows={4}
                        value={formData.text}
                        onChange={(e) => setFormData(prev => ({ ...prev, text: e.target.value }))}
                        className="w-full pl-12 pr-4 py-4 rounded-xl border border-gray-200/50 bg-white/50 text-sm focus:outline-none focus:border-[#008751] focus:ring-4 focus:ring-[#008751]/10 transition-all resize-none font-medium text-gray-700 placeholder:text-gray-400"
                    />
                </div>

                <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-gradient-to-r from-[#008751] to-[#006039] text-white hover:shadow-lg hover:from-[#009b5e] hover:to-[#00754a] rounded-xl h-14 text-lg font-bold shadow-md transition-all disabled:opacity-70 disabled:cursor-not-allowed transform hover:-translate-y-0.5"
                >
                    {isLoading ? (
                        <span className="flex items-center gap-2">
                            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Publication en cours...
                        </span>
                    ) : (
                        <span className="flex items-center gap-2">
                            <Send size={20} />
                            Envoyer mon avis
                        </span>
                    )}
                </Button>

                <p className="text-center text-xs text-gray-400 mt-4">
                    En soumettant ce formulaire, vous acceptez que votre témoignage soit publié sur notre site.
                </p>
            </motion.form>
        </div>
    );
}

export default function TestimonialsCarousel() {
    const [testimonials, setTestimonials] = useState<Testimonial[]>(fallbackTestimonials);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        const fetchTestimonials = async () => {
            try {
                // Short timeout fallback logic
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout

                const STRAPI_URL = process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1337';
                const response = await fetch(`${STRAPI_URL}/api/testimonials?populate=*&filters[approved][$eq]=true`, {
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (!response.ok) return;

                const json = await response.json();

                if (json.data && Array.isArray(json.data) && json.data.length > 0) {
                    const mapped = json.data.map((item: any) => ({
                        id: item.id,
                        name: item.name,
                        role: item.role || 'Client',
                        text: item.text,
                        location: item.location || 'Bénin',
                        rating: item.rating || 5,
                        service: item.service || 'Général',
                        photoUrl: item.photo?.url ? `${STRAPI_URL}${item.photo.url}` : undefined
                    }));
                    setTestimonials(mapped);
                }
            } catch (err) {
                // Silently fails to fallback
            } finally {
                setIsLoaded(true);
            }
        };

        fetchTestimonials();
    }, []);

    // Ensure infinite scroll works even with few items
    const displayItems = testimonials.length < 5 ? [...testimonials, ...testimonials, ...testimonials] : [...testimonials, ...testimonials];

    return (
        <section className="py-24 bg-[#fafbfc] overflow-hidden relative">
            {/* Background Decor */}
            <div className="absolute top-0 left-0 w-full h-full opacity-30 pointer-events-none">
                <div className="absolute top-20 right-[-10%] w-[500px] h-[500px] bg-[#FCD116]/10 rounded-full blur-3xl" />
                <div className="absolute bottom-20 left-[-10%] w-[500px] h-[500px] bg-[#008751]/5 rounded-full blur-3xl" />
            </div>

            {/* Header */}
            <div className="container mx-auto px-4 mb-20">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.7 }}
                    className="text-center relative z-10"
                >
                    <span className="inline-block px-4 py-1.5 rounded-full bg-[#E8112D]/5 text-[#E8112D] text-sm font-bold tracking-widest uppercase mb-4 border border-[#E8112D]/10">
                        La Voix de la Diaspora
                    </span>
                    <h2 className="text-4xl md:text-6xl font-bold font-heading text-[#1a2332] mb-6">
                        Ils ont osé le <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#008751] via-[#FCD116] to-[#E8112D]">Retour Gagnant</span>
                    </h2>
                    <p className="text-gray-500 text-lg max-w-2xl mx-auto leading-relaxed">
                        Découvrez les histoires inspirantes de ceux qui ont franchi le pas. Des expériences authentiques, des projets concrets, une nouvelle vie au Bénin.
                    </p>
                </motion.div>
            </div>

            {/* Infinite Scroll Marquee - Row 1 (Left Direction) */}
            <div className="relative mb-8 group">
                <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-[#fafbfc] to-transparent z-10 pointer-events-none" />
                <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-[#fafbfc] to-transparent z-10 pointer-events-none" />

                <motion.div
                    className="flex gap-4"
                    animate={{ x: [0, -1500] }}
                    transition={{
                        x: {
                            repeat: Infinity,
                            repeatType: "loop",
                            duration: 50,
                            ease: "linear",
                        },
                    }}
                    style={{ width: 'max-content' }}
                >
                    {/* Tripled to ensure smoothness */}
                    {[...displayItems, ...displayItems].map((item, i) => (
                        <TestimonialCard key={`row1-${i}`} item={item} />
                    ))}
                </motion.div>
            </div>

            {/* Infinite Scroll Marquee - Row 2 (Right Direction) */}
            <div className="relative mb-20 group">
                <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-[#fafbfc] to-transparent z-10 pointer-events-none" />
                <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-[#fafbfc] to-transparent z-10 pointer-events-none" />

                <motion.div
                    className="flex gap-4"
                    animate={{ x: [-1500, 0] }}
                    transition={{
                        x: {
                            repeat: Infinity,
                            repeatType: "loop",
                            duration: 55,
                            ease: "linear",
                        },
                    }}
                    style={{ width: 'max-content' }}
                >
                    {/* Reverse order for visual variety */}
                    {[...displayItems, ...displayItems].reverse().map((item, i) => (
                        <TestimonialCard key={`row2-${i}`} item={item} />
                    ))}
                </motion.div>
            </div>

            {/* Submission Form Section */}
            <div className="container mx-auto px-4 max-w-3xl relative z-20">
                <SubmissionForm />
            </div>
        </section>
    );
}

