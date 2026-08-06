"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle as CheckCircle2, ChatCircle as MessageCircle, Calculator, CaretDown as ChevronDown, Check } from '@phosphor-icons/react';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslation, T } from "@/lib/translation";
import { Price } from "@/components/ui/Price";

interface PricingOption {
    label: string;
    price: string;
    features?: string[];
}

/** Parse un prix string FCFA en montant numérique + suffixe éventuel */
function parseFCFAPrice(priceStr: string): { amount: number; suffix: string } | null {
    const match = priceStr.match(/^([\d\s.]+)\s*FCFA(.*)$/i)
    if (match) {
        const amount = Number(match[1].replace(/[\s.]/g, ''))
        if (!isNaN(amount) && amount > 0) {
            return { amount, suffix: match[2]?.trim() || '' }
        }
    }
    return null
}

interface PricingCalculator3DProps {
    options: PricingOption[];
    baseColor: string;
    serviceName: string;
}

export default function PricingCalculator3D({ options, baseColor, serviceName }: PricingCalculator3DProps) {
    const { t } = useTranslation();
    const [selectedOption, setSelectedOption] = useState<PricingOption>(options[0]);
    const [isOpen, setIsOpen] = useState(false);

    // Format message for WhatsApp negotiation
    const handleNegotiate = () => {
        const message = encodeURIComponent(
            t("whatsapp_negotiate_message", {
                defaultValue: `Bonjour Retour Gagnant 🇧🇯,\n\nJe suis intéressé par le service *{{serviceName}}*.\nOption sélectionnée : *{{selectedOption}}* ({{price}}).\n\nJ'aimerais discuter des détails et négocier cette offre.`,
                serviceName: serviceName,
                selectedOption: selectedOption.label,
                price: selectedOption.price
            })
        );
        window.open(`https://wa.me/2290160322121?text=${message}`, '_blank');
    };

    return (
        <div className="w-full max-w-md mx-auto perspective-1000">
            <motion.div
                initial={{ rotateX: 10, opacity: 0 }}
                animate={{ rotateX: 0, opacity: 1 }}
                transition={{ duration: 0.6, type: "spring" }}
                className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 relative"
                style={{ transformStyle: "preserve-3d" }}
            >
                {/* 3D Header Shine */}
                <div
                    className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-white/20 to-transparent z-10 pointer-events-none"
                    style={{ background: `linear-gradient(180deg, ${baseColor}20 0%, transparent 100%)` }}
                />

                <div className="p-8 relative z-20">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 rounded-2xl bg-gray-50 text-gray-900 shadow-inner">
                            <Calculator size={24} style={{ color: baseColor }} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900"><T>Calculateur Intelligent</T></h3>
                            <p className="text-xs text-gray-500"><T>Estimation immédiate</T></p>
                        </div>
                    </div>

                    {/* Selector */}
                    <div className="relative mb-8">
                        <button
                            onClick={() => setIsOpen(!isOpen)}
                            className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-xl border-2 border-transparent hover:border-gray-200 transition-all active:scale-[0.98]"
                        >
                            <span className="font-semibold text-gray-700">{selectedOption.label}</span>
                            <ChevronDown
                                className={cn("transition-transform duration-300 text-gray-400", isOpen && "rotate-180")}
                            />
                        </button>

                        <AnimatePresence>
                            {isOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10, scaleY: 0.9 }}
                                    animate={{ opacity: 1, y: 0, scaleY: 1 }}
                                    exit={{ opacity: 0, y: -10, scaleY: 0.9 }}
                                    className="absolute top-[110%] left-0 right-0 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50 py-2"
                                >
                                    {options.map((opt, i) => (
                                        <button
                                            key={i}
                                            onClick={() => {
                                                setSelectedOption(opt);
                                                setIsOpen(false);
                                            }}
                                            className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                                        >
                                            <span className="text-sm font-medium text-gray-700">{opt.label}</span>
                                            {selectedOption.label === opt.label && (
                                                <Check size={16} style={{ color: baseColor }} />
                                            )}
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Price Display with 3D Pop */}
                    <div className="text-center mb-8">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={selectedOption.price}
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 1.2, opacity: 0 }}
                                className="text-4xl font-extrabold font-heading tracking-tight"
                                style={{ color: baseColor }}
                            >
                                {(() => {
                                    const parsed = parseFCFAPrice(selectedOption.price)
                                    if (parsed) {
                                        return <><Price amount={parsed.amount} currency="XOF" />{parsed.suffix ? ` ${parsed.suffix}` : ''}</>
                                    }
                                    return <T>{selectedOption.price}</T>
                                })()}
                            </motion.div>
                        </AnimatePresence>
                        <p className="text-sm text-gray-400 mt-2 font-medium"><T>Prix estimatif (hors options)</T></p>
                    </div>

                    {/* Action Button */}
                    <Button
                        onClick={handleNegotiate}
                        className="w-full h-14 text-lg font-bold rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] group"
                        style={{ backgroundColor: baseColor }}
                    >
                        <MessageCircle className="mr-2 group-hover:rotate-12 transition-transform" />
                        <T>Négocier cette offre</T>
                    </Button>

                    <p className="text-xs text-center text-gray-400 mt-4 opacity-70">
                        <T>Discussion directe avec un expert via WhatsApp</T>
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
