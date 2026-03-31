"use client";

import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface GoldenIconProps {
    icon?: LucideIcon;
    type?: "cowrie" | "recade" | "tata" | "assin" | "drum" | "passport" | "tree" | "standard";
    className?: string;
    size?: number;
}

export function GoldenIcon({ icon: Icon, type = "standard", className, size = 48 }: GoldenIconProps) {

    // --- REALISTIC CULTURAL ICONS (Optimized SVG Paths) ---

    // 0. Arbre Ancestral (Baobab/Iroko style) - Symbole de racines et connexion
    const TreePath = () => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Trunk */}
            <path d="M12 21V16M12 16C10 16 8 15 8 13C8 11 12 8 12 8M12 16C14 16 16 15 16 13C16 11 12 8 12 8" stroke="#8B4513" strokeWidth="2" strokeLinecap="round" />
            <path d="M10 21L12 18L14 21" stroke="#8B4513" strokeWidth="1.5" strokeLinecap="round" />
            {/* Foliage (Stylized clouds/puffs) */}
            <circle cx="12" cy="7" r="4" fill="#008751" stroke="#005C36" strokeWidth="1" />
            <circle cx="8" cy="10" r="3.5" fill="#008751" stroke="#005C36" strokeWidth="1" />
            <circle cx="16" cy="10" r="3.5" fill="#008751" stroke="#005C36" strokeWidth="1" />
            {/* Roots/Ground */}
            <path d="M5 21H19" stroke="#C08218" strokeWidth="1" strokeLinecap="round" />
        </svg>
    );

    // 1. Cauris (Coquillage) - Symbole de richesse et culture
    const CowriePath = () => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Shell Shape */}
            <ellipse cx="12" cy="12" rx="7" ry="10" fill="#FCD116" stroke="#C08218" strokeWidth="1.5" />
            {/* Inner Slit (Mouth) */}
            <path d="M12 5V19" stroke="#8B5E34" strokeWidth="2" strokeLinecap="round" />
            {/* Teeth/Ridges */}
            <path d="M8 8L11 8" stroke="#8B5E34" strokeWidth="1" strokeLinecap="round" />
            <path d="M8 12L11 12" stroke="#8B5E34" strokeWidth="1" strokeLinecap="round" />
            <path d="M8 16L11 16" stroke="#8B5E34" strokeWidth="1" strokeLinecap="round" />
            <path d="M13 8L16 8" stroke="#8B5E34" strokeWidth="1" strokeLinecap="round" />
            <path d="M13 12L16 12" stroke="#8B5E34" strokeWidth="1" strokeLinecap="round" />
            <path d="M13 16L16 16" stroke="#8B5E34" strokeWidth="1" strokeLinecap="round" />
        </svg>
    );

    // 2. Récade (Sceptre Royal) - Pouvoir, Administration, Autorité
    const RecadePath = () => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Manche en bois */}
            <path d="M18 20L6 4" stroke="#8B4513" strokeWidth="2.5" strokeLinecap="round" />
            {/* Tête Lion/Royal (Stylisée ronde) */}
            <circle cx="6" cy="4" r="3" fill="#E8112D" stroke="#8B4513" strokeWidth="1" />
            {/* Lame crochue typique */}
            <path d="M7 6C9 7 10 9 10 12" stroke="#FCD116" strokeWidth="2" strokeLinecap="round" />
            <path d="M10 12L12 14" stroke="#FCD116" strokeWidth="2" strokeLinecap="round" />
        </svg>
    );

    // 3. Tata Somba (Château fort traditionnel) - Logement, Sécurité
    const TataPath = () => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Base de la maison */}
            <rect x="4" y="10" width="16" height="10" rx="1" fill="#D2691E" stroke="#8B4513" strokeWidth="1.5" />
            {/* Tourelles (Coniques) */}
            <path d="M4 10L6 4L8 10H4Z" fill="#8B4513" stroke="#5D4037" strokeWidth="1" />
            <path d="M16 10L18 4L20 10H16Z" fill="#8B4513" stroke="#5D4037" strokeWidth="1" />
            <path d="M10 10L12 5L14 10H10Z" fill="#8B4513" stroke="#5D4037" strokeWidth="1" />
            {/* Porte d'entrée */}
            <path d="M10 20V15C10 14.5 10.5 14 11 14H13C13.5 14 14 14.5 14 15V20" fill="#2F1B10" />
        </svg>
    );

    // 4. Assin (Autel Portatif) - Ancrage, Héritage, Stabilité
    const AssinPath = () => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Socle Tige */}
            <path d="M12 22V12" stroke="#C08218" strokeWidth="2" />
            {/* Base au sol */}
            <path d="M8 22H16" stroke="#C08218" strokeWidth="2" strokeLinecap="round" />
            {/* Parapluie métallique (Typical Top) */}
            <path d="M5 12C5 8 8 6 12 6C16 6 19 8 19 12H5Z" fill="#FCD116" stroke="#C08218" strokeWidth="1.5" />
            {/* Pique sommital */}
            <path d="M12 6V4" stroke="#C08218" strokeWidth="2" />
            {/* Ornements pendants */}
            <circle cx="6" cy="12" r="1" fill="#E8112D" />
            <circle cx="18" cy="12" r="1" fill="#008751" />
        </svg>
    );

    // 5. Tam-Tam (Djembé/Gongon) - Rythme, Appel, Business
    const DrumPath = () => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Wooden Body */}
            <path d="M7 6C7 4.5 9 3 12 3C15 3 17 4.5 17 6V10C17 12 16 14 14 15L15 21H9L10 15C8 14 7 12 7 10V6Z"
                fill="#8B4513" stroke="#5D4037" strokeWidth="1.5" />
            {/* Skin Top */}
            <ellipse cx="12" cy="6" rx="5" ry="1.5" fill="#F5DEB3" stroke="#5D4037" strokeWidth="1" />
            {/* Ropes (Green/Yellow/Red for style) */}
            <path d="M8 7L9 12" stroke="#008751" strokeWidth="1" />
            <path d="M16 7L15 12" stroke="#E8112D" strokeWidth="1" />
            <path d="M12 7L12 12" stroke="#FCD116" strokeWidth="1" />
        </svg>
    );

    // 6. Passeport / Document Administratif - Stylisé avec motifs traditionnels
    const PassportPath = () => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Document Body */}
            <rect x="4" y="2" width="16" height="20" rx="2" fill="#008751" stroke="#005C36" strokeWidth="1.2" />
            {/* Flag Stripe at Top */}
            <rect x="4" y="2" width="16" height="3" rx="2" fill="#FCD116" />
            <rect x="4" y="2" width="5.3" height="3" rx="2" fill="#008751" />
            <rect x="14.7" y="2" width="5.3" height="3" rx="2" fill="#E8112D" />
            {/* Official Seal Circle */}
            <circle cx="12" cy="11" r="4" fill="none" stroke="#FCD116" strokeWidth="1.5" />
            {/* Star inside seal */}
            <path d="M12 8L12.9 10.2H15.2L13.4 11.5L14.1 13.8L12 12.4L9.9 13.8L10.6 11.5L8.8 10.2H11.1L12 8Z" fill="#FCD116" />
            {/* Text Lines */}
            <rect x="7" y="17" width="10" height="1" rx="0.5" fill="#FCD116" opacity="0.6" />
            <rect x="8" y="19" width="8" height="1" rx="0.5" fill="#FCD116" opacity="0.4" />
        </svg>
    );

    const getIcon = () => {
        switch (type) {
            case "cowrie": return <CowriePath />;
            case "recade": return <RecadePath />;
            case "tata": return <TataPath />;
            case "assin": return <AssinPath />;
            case "drum": return <DrumPath />;
            case "passport": return <PassportPath />;
            case "tree": return <TreePath />;
            default: return Icon ? <Icon size={size} className="text-[#008751]" /> : null;
        }
    }

    return (
        <div className={cn("relative flex items-center justify-center p-3 rounded-xl transition-all duration-500 group/icon", className)}>
            {/* Subtle Flag Gradient Backing */}
            <div className="absolute inset-0 bg-gradient-to-tr from-[#008751]/10 via-[#FCD116]/10 to-[#E8112D]/10 rounded-full opacity-50 group-hover/icon:opacity-100 transition-opacity" />

            {/* Icon Container */}
            <div className="relative bg-white p-2 rounded-2xl border border-gray-100 shadow-sm group-hover/icon:shadow-md transition-shadow duration-300">
                {getIcon()}
            </div>
        </div>
    );
}
