import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle, ArrowRight, BookOpen, Calendar } from '@phosphor-icons/react/dist/ssr';

export const metadata: Metadata = {
    title: 'Merci !',
    description: 'Votre message a bien été envoyé. Notre équipe vous contactera sous 24h.',
    robots: { index: false, follow: false },
}

export default function MerciPage() {
    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
            <div className="max-w-lg w-full text-center">
                <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 md:p-12 relative overflow-hidden">
                    {/* Flag accent */}
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#008751] via-[#FCD116] to-[#E8112D]" />

                    <div className="w-20 h-20 rounded-full bg-[#008751]/10 flex items-center justify-center mx-auto mb-6">
                        <CheckCircle className="text-[#008751]" size={42} />
                    </div>

                    <h1 className="text-2xl md:text-3xl font-bold text-[#1a2332] mb-3">
                        Merci pour votre message !
                    </h1>
                    <p className="text-gray-500 mb-8 leading-relaxed">
                        Nous avons bien reçu votre demande. Un membre de notre équipe vous contactera sous <strong className="text-[#1a2332]">24 heures</strong>.
                    </p>

                    <div className="flex justify-center gap-0 mb-8">
                        <div className="w-12 h-1 bg-[#008751] rounded-l-full" />
                        <div className="w-12 h-1 bg-[#FCD116]" />
                        <div className="w-12 h-1 bg-[#E8112D] rounded-r-full" />
                    </div>

                    <h3 className="text-sm font-bold text-gray-800 mb-4 uppercase tracking-wider">
                        En attendant, découvrez :
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Link
                            href="/services"
                            className="flex items-center gap-3 p-4 rounded-xl bg-[#008751]/5 hover:bg-[#008751]/10 transition-colors group text-left"
                        >
                            <ArrowRight className="text-[#008751] shrink-0 group-hover:translate-x-1 transition-transform" size={18} />
                            <div>
                                <p className="text-sm font-semibold text-[#1a2332]">Nos services</p>
                                <p className="text-xs text-gray-500">9 solutions clés en main</p>
                            </div>
                        </Link>
                        <Link
                            href="/blog"
                            className="flex items-center gap-3 p-4 rounded-xl bg-[#FCD116]/10 hover:bg-[#FCD116]/20 transition-colors group text-left"
                        >
                            <BookOpen className="text-[#c9a800] shrink-0" size={18} />
                            <div>
                                <p className="text-sm font-semibold text-[#1a2332]">Notre blog</p>
                                <p className="text-xs text-gray-500">Guides et conseils</p>
                            </div>
                        </Link>
                        <Link
                            href="/rendez-vous"
                            className="flex items-center gap-3 p-4 rounded-xl bg-[#E8112D]/5 hover:bg-[#E8112D]/10 transition-colors group text-left sm:col-span-2"
                        >
                            <Calendar className="text-[#E8112D] shrink-0" size={18} />
                            <div>
                                <p className="text-sm font-semibold text-[#1a2332]">Prendre rendez-vous</p>
                                <p className="text-xs text-gray-500">Premier appel de 15 min gratuit</p>
                            </div>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}
