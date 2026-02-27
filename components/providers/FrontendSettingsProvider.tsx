'use client';

import { createContext, useContext, ReactNode } from 'react';

type FrontendSettings = {
    heroVideo: string;
    heroAudio: string;
    heroTitle: string;
    heroSubtitle: string;
    colorPrimary: string;
    navbarLinks: { label: string, href: string }[];
};

const defaultSettings: FrontendSettings = {
    heroVideo: "/videos/hero.mp4",
    heroAudio: "/audio/ambient.mp3",
    heroTitle: "RETOUR GAGNANT",
    heroSubtitle: "L'alliance parfaite entre modernisation et héritage culturel pour votre installation au Bénin.",
    colorPrimary: "#008751",
    navbarLinks: [
        { label: 'Accueil', href: '/' },
        { label: 'Services', href: '/services' },
        { label: 'A Propos', href: '/a-propos' },
        { label: 'Contact', href: '/contact' },
        { label: 'Boutique', href: '/boutique' }
    ]
};

const SettingsContext = createContext<FrontendSettings>(defaultSettings);

export function FrontendSettingsProvider({ children, initialSettings }: { children: ReactNode, initialSettings?: Partial<FrontendSettings> }) {
    const settings = { ...defaultSettings, ...initialSettings };

    // Si des couleurs personnalisées ont été définies, on pourrait les injecter ici sous forme de variable CSS
    // Mais pour l'instant, on se passe juste les variables.

    return (
        <SettingsContext.Provider value={settings}>
            {children}
        </SettingsContext.Provider>
    );
}

export function useFrontendSettings() {
    return useContext(SettingsContext);
}
