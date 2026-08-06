"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { Quotes, Star, PaperPlaneTilt, CheckCircle, X, Camera } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { useTranslation, T } from "@/lib/translation";

interface Testimonial {
    id: string | number;
    name: string;
    role: string;
    text: string;
    location: string;
    rating: number;
    service: string;
    photoUrl?: string;
}

const fallbackTestimonials: Testimonial[] = [
    { id: 1, name: "Jean-Marc K.", role: "Investisseur immobilier", text: "J'ai pu sécuriser un terrain à Calavi en moins de deux semaines. Leur professionnalisme est rassurant.", location: "Paris, France", rating: 5, service: "Immobilier" },
    { id: 2, name: "Sarah D.", role: "Entrepreneure", text: "L'accompagnement pour la création de ma société a été exemplaire. Je recommande pour tout projet de retour.", location: "Montréal, Canada", rating: 5, service: "Business" },
    { id: 3, name: "Famille Togbé", role: "Installation définitive", text: "Une transition en douceur pour toute la famille : école des enfants, logement, tout a été géré.", location: "Bruxelles, Belgique", rating: 5, service: "Logement" },
];

function Stars({ n }: { n: number }) {
    return (
        <div className="flex gap-0.5" aria-label={`${n} / 5`}>
            {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} size={15} weight="fill" className={i < n ? "text-[#FCD116]" : "text-[#e2ded3]"} />
            ))}
        </div>
    );
}

function Card({ item }: { item: Testimonial }) {
    const { t } = useTranslation();
    return (
        <figure className="flex h-full flex-col rounded-[1.4rem] border border-[#e7e4db] bg-white p-7">
            <Quotes size={28} weight="fill" className="text-[#008751]/25" />
            <blockquote className="mt-4 flex-1 font-geist text-[15px] leading-relaxed text-[#3a453f] line-clamp-3">
                {t(item.text)}
            </blockquote>
            <div className="mt-5"><Stars n={item.rating} /></div>
            <figcaption className="mt-4 flex items-center gap-3 border-t border-[#f0ede4] pt-4">
                {item.photoUrl ? (
                    <Image src={item.photoUrl} alt={item.name} width={40} height={40} className="h-10 w-10 rounded-full object-cover" unoptimized />
                ) : (
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#008751] to-[#0a7d52] font-geist text-sm font-bold text-white">
                        {item.name.charAt(0)}
                    </span>
                )}
                <div className="min-w-0">
                    <p className="truncate font-geist text-sm font-semibold text-[#0d1a12]">{item.name}</p>
                    <p className="truncate font-geist text-xs text-[#8a938c]">{t(item.role)}{item.location ? ` · ${item.location}` : ""}</p>
                </div>
            </figcaption>
        </figure>
    );
}

function SubmissionModal({ onClose }: { onClose: () => void }) {
    const [form, setForm] = useState({ name: "", role: "", location: "", text: "", service: "", rating: 5 });
    const [photo, setPhoto] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim() || !form.text.trim()) { alert("Nom et témoignage requis."); return; }
        setLoading(true);
        try {
            let photo_url: string | null = null;
            if (photo) {
                const ext = photo.name.split(".").pop();
                const fileName = `${Math.random()}.${ext}`;
                const { error } = await supabase.storage.from("testimonials").upload(fileName, photo);
                if (!error) photo_url = supabase.storage.from("testimonials").getPublicUrl(fileName).data.publicUrl;
            }
            const res = await fetch("/api/testimonials", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...form, photo_url }),
            });
            if (!res.ok) throw new Error();
            setDone(true);
        } catch {
            alert("Erreur lors de l'envoi. Réessayez.");
        } finally {
            setLoading(false);
        }
    };

    const inp = "w-full rounded-xl border border-[#e2ded3] bg-[#faf9f5] px-3.5 py-2.5 font-geist text-sm text-[#0d1a12] focus:border-[#008751] focus:outline-none focus:ring-2 focus:ring-[#008751]/15";

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-[70] flex items-center justify-center bg-[#0d1a12]/50 p-4 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
                <div className="flex h-1"><span className="flex-[46] bg-[#008751]" /><span className="flex-[27] bg-[#FCD116]" /><span className="flex-[27] bg-[#E8112D]" /></div>
                {done ? (
                    <div className="px-10 py-12 text-center">
                        <CheckCircle size={52} weight="fill" className="mx-auto text-[#008751]" />
                        <h3 className="mt-4 font-fraunces text-2xl font-semibold text-[#0d1a12]">Merci !</h3>
                        <p className="mt-1 font-geist text-sm text-[#6b756e]">Votre témoignage sera publié après vérification.</p>
                        <button onClick={onClose} className="mt-6 rounded-full bg-[#008751] px-6 py-2.5 font-geist text-sm font-semibold text-white">Fermer</button>
                    </div>
                ) : (
                    <form onSubmit={submit}>
                        <div className="flex items-center justify-between border-b border-[#f0ede4] px-6 py-4">
                            <h3 className="font-fraunces text-xl font-semibold text-[#0d1a12]">Partager votre expérience</h3>
                            <button type="button" onClick={onClose} className="rounded-lg p-2 text-[#8a938c] hover:bg-[#f3f1ea]"><X size={18} /></button>
                        </div>
                        <div className="space-y-3 p-6">
                            <div className="grid grid-cols-2 gap-3">
                                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nom *" className={inp} />
                                <input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Rôle (ex. Entrepreneur)" className={inp} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Ville, pays" className={inp} />
                                <input value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })} placeholder="Service concerné" className={inp} />
                            </div>
                            <textarea rows={3} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} placeholder="Votre témoignage *" className={`${inp} resize-none`} />
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1">
                                    {[1, 2, 3, 4, 5].map((n) => (
                                        <button type="button" key={n} onClick={() => setForm({ ...form, rating: n })}>
                                            <Star size={22} weight="fill" className={n <= form.rating ? "text-[#FCD116]" : "text-[#e2ded3]"} />
                                        </button>
                                    ))}
                                </div>
                                <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 rounded-full border border-[#e2ded3] px-4 py-2 font-geist text-xs font-semibold text-[#6b756e] hover:border-[#008751]/40">
                                    <Camera size={15} /> {photo ? "Photo ajoutée" : "Photo (option)"}
                                </button>
                                <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files && setPhoto(e.target.files[0])} />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 border-t border-[#f0ede4] px-6 py-4">
                            <button type="button" onClick={onClose} className="rounded-xl border border-[#e2ded3] px-4 py-2.5 font-geist text-sm font-semibold text-[#6b756e] hover:bg-[#f7f5f0]">Annuler</button>
                            <button type="submit" disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-[#008751] px-5 py-2.5 font-geist text-sm font-semibold text-white hover:bg-[#00693f] disabled:opacity-60">
                                <PaperPlaneTilt size={15} weight="bold" /> {loading ? "Envoi..." : "Envoyer"}
                            </button>
                        </div>
                    </form>
                )}
            </motion.div>
        </motion.div>
    );
}

export default function TestimonialsCarousel() {
    const reduce = useReducedMotion();
    const [items, setItems] = useState<Testimonial[]>(fallbackTestimonials);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        fetch("/api/testimonials")
            .then((r) => r.json())
            .then((j) => {
                const arr = (j.testimonials || j || []) as Record<string, unknown>[];
                if (Array.isArray(arr) && arr.length > 0) {
                    setItems(arr.map((x) => ({
                        id: (x.id as string) ?? Math.random(),
                        name: (x.name as string) || "",
                        role: (x.role as string) || "",
                        text: (x.text as string) || "",
                        location: (x.location as string) || "",
                        rating: Number(x.rating) || 5,
                        service: (x.service as string) || "",
                        photoUrl: (x.photoUrl as string) || (x.photo_url as string) || undefined,
                    })));
                }
            })
            .catch(() => { });
    }, []);

    return (
        <section className="bg-white py-20 md:py-28">
            <div className="mx-auto max-w-[1400px] px-5 md:px-8">
                <div className="mb-12 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                    <h2 className="max-w-2xl font-fraunces text-4xl font-semibold leading-[1.05] tracking-[-0.02em] text-[#0d1a12] md:text-5xl">
                        <T>Ils sont rentrés avec nous.</T>
                    </h2>
                    <button onClick={() => setOpen(true)} className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#0d1a12] px-6 py-3 font-geist text-[14px] font-semibold text-white transition-colors hover:bg-[#008751]">
                        <PaperPlaneTilt size={16} weight="bold" /> <T>Partager votre expérience</T>
                    </button>
                </div>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                    {items.slice(0, 6).map((item, i) => (
                        <motion.div
                            key={item.id}
                            initial={reduce ? false : { opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, amount: 0.3 }}
                            transition={{ duration: 0.6, delay: (i % 3) * 0.07, ease: [0.16, 1, 0.3, 1] }}
                        >
                            <Card item={item} />
                        </motion.div>
                    ))}
                </div>
            </div>
            <AnimatePresence>{open && <SubmissionModal onClose={() => setOpen(false)} />}</AnimatePresence>
        </section>
    );
}
