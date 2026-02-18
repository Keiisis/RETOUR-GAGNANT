"use client";

import { motion } from "framer-motion";
import { ArrowRight, ExternalLink, MapPin, Store } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface PartnerProduct {
    id: number;
    name: string;
    image: string;
    price?: string;
}

export interface Partner {
    id: number;
    name: string;
    description: string;
    logo: string;
    coverImage: string;
    category: string;
    location: string;
    website?: string;
    products: PartnerProduct[];
    isPremium?: boolean;
}

interface PartnerCardProps {
    partner: Partner;
}

export default function PartnerCard({ partner }: PartnerCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className={`group relative overflow-hidden rounded-3xl bg-white border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-500 flex flex-col h-full ${partner.isPremium ? 'ring-2 ring-[#FCD116]/50' : ''}`}
        >
            {/* Cover Image */}
            <div className="relative h-48 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10" />
                <Image
                    src={partner.coverImage}
                    alt={partner.name}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-110"
                />

                {/* Logo Overlay */}
                <div className="absolute -bottom-8 left-6 z-20">
                    <div className="w-16 h-16 rounded-xl bg-white p-1 shadow-lg border border-gray-100">
                        <div className="w-full h-full relative rounded-lg overflow-hidden bg-gray-50">
                            <Image
                                src={partner.logo}
                                alt={`${partner.name} Logo`}
                                fill
                                className="object-contain p-1"
                            />
                        </div>
                    </div>
                </div>

                {/* Badges */}
                <div className="absolute top-4 right-4 z-20 flex gap-2">
                    <Badge variant="secondary" className="bg-white/90 backdrop-blur-sm text-xs font-bold text-[#1a2332]">
                        {partner.category}
                    </Badge>
                    {partner.isPremium && (
                        <Badge className="bg-[#FCD116] text-[#1a2332] text-xs font-bold border-none">
                            ★ Premium
                        </Badge>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="pt-10 px-6 pb-6 flex-grow flex flex-col">
                <div className="mb-4">
                    <h3 className="text-xl font-bold font-heading text-[#1a2332] flex items-center gap-2">
                        {partner.name}
                        {partner.website && (
                            <a href={partner.website} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[#008751] transition-colors">
                                <ExternalLink size={14} />
                            </a>
                        )}
                    </h3>
                    <div className="flex items-center text-sm text-gray-500 mt-1 space-x-1">
                        <MapPin size={12} />
                        <span>{partner.location}</span>
                    </div>
                </div>

                <p className="text-gray-600 text-sm mb-6 line-clamp-2 flex-grow">
                    {partner.description}
                </p>

                {/* Product Showcase (Mini Gallery) */}
                {partner.products.length > 0 && (
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                                <Store size={10} /> Vitrine
                            </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            {partner.products.slice(0, 3).map((product) => (
                                <div key={product.id} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 group/product cursor-pointer border border-gray-100">
                                    <Image
                                        src={product.image}
                                        alt={product.name}
                                        fill
                                        className="object-cover"
                                    />
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/product:opacity-100 transition-opacity flex items-center justify-center p-1">
                                        <span className="text-[10px] text-white text-center font-medium leading-tight">
                                            {product.name}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="pt-4 border-t border-gray-100 mt-auto">
                    <Button className="w-full bg-white border border-[#008751] text-[#008751] hover:bg-[#008751] hover:text-white transition-all group-hover:shadow-md">
                        Voir les offres
                        <ArrowRight size={16} className="ml-2" />
                    </Button>
                </div>
            </div>
        </motion.div>
    );
}
