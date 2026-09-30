import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { LayoutShell } from "@/components/layout/LayoutShell";
import { TranslationProvider } from "@/lib/translation";
import AnalyticsProvider from "@/components/analytics/AnalyticsProvider";
import "./globals.css";

/* Polices AUTO-HÉBERGÉES (app/fonts/, sous-ensemble latin, fichiers woff2
   téléchargés depuis Google Fonts le 30/09/2026). Avant : next/font/google
   les récupérait à CHAQUE build ; le 30/09, une réponse anormale de Google a
   fait échouer le déploiement (« Cannot read properties of null »). Le build
   ne dépend plus d'aucun service externe. Mêmes variables CSS qu'avant. */
const poppins = localFont({
  src: [
    { path: "./fonts/poppins-normal-300.woff2", weight: "300", style: "normal" },
    { path: "./fonts/poppins-normal-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/poppins-normal-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/poppins-normal-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/poppins-normal-700.woff2", weight: "700", style: "normal" },
    { path: "./fonts/poppins-normal-800.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-poppins",
  display: "swap",
});

const inter = localFont({
  src: "./fonts/inter-normal-300-600.woff2",
  weight: "300 600",
  variable: "--font-inter",
  display: "swap",
});

const montserrat = localFont({
  src: "./fonts/montserrat-normal-400-900.woff2",
  weight: "400 900",
  variable: "--font-montserrat",
  display: "swap",
});

// Serif éditorial premium : grands titres (pages vitrines : nationalité…).
const playfair = localFont({
  src: "./fonts/playfair-normal-400-800.woff2",
  weight: "400 800",
  variable: "--font-playfair",
  display: "swap",
});

// Refonte accueil (Phase 1) : titres cinétiques Fraunces (serif variable
// haute-contraste), corps Geist, chiffres Geist Mono.
const fraunces = localFont({
  src: [
    { path: "./fonts/fraunces-normal-400-900.woff2", weight: "400 900", style: "normal" },
    { path: "./fonts/fraunces-italic-400-900.woff2", weight: "400 900", style: "italic" },
  ],
  variable: "--font-fraunces",
  display: "swap",
});
const geist = localFont({
  src: "./fonts/geist-normal-300-700.woff2",
  weight: "300 700",
  variable: "--font-geist",
  display: "swap",
});
const geistMono = localFont({
  src: "./fonts/geist-mono-normal-400-600.woff2",
  weight: "400 600",
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Retour Gagnant Bénin : Accompagnement Premium pour la Diaspora",
    template: "%s | Retour Gagnant Bénin",
  },
  description: "Votre partenaire de confiance pour un retour réussi au Bénin. Passeport, immobilier, création d'entreprise, investissement et accompagnement culturel pour la diaspora béninoise et afro-descendante.",
  keywords: ["retour Bénin", "diaspora béninoise", "passeport Bénin", "immobilier Cotonou", "création entreprise Bénin", "investissement Bénin", "nationalité béninoise", "afro-descendants", "accompagnement diaspora"],
  authors: [{ name: "Retour Gagnant Bénin", url: "https://www.retourgagnantbenin.bj" }],
  creator: "Retour Gagnant Bénin",
  publisher: "Retour Gagnant Bénin",
  metadataBase: new URL("https://www.retourgagnantbenin.bj"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: "https://www.retourgagnantbenin.bj",
    siteName: "Retour Gagnant Bénin",
    title: "Retour Gagnant Bénin : Accompagnement Premium pour la Diaspora",
    description: "Passeport, immobilier, entreprise, investissement : tous les services pour réussir votre retour au Bénin.",
    images: [
      {
        url: "/images/hero-bg.jpg",
        width: 1200,
        height: 630,
        alt: "Retour Gagnant Bénin",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Retour Gagnant Bénin : Accompagnement Premium",
    description: "Passeport, immobilier, entreprise, investissement pour la diaspora béninoise.",
    images: ["/images/hero-bg.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    "max-snippet": -1,
    "max-image-preview": "large" as const,
    "max-video-preview": -1,
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Retour Gagnant",
  },
  icons: {
    icon: [
      { url: "/icon.png", sizes: "48x48", type: "image/png" },
      { url: "/images/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/images/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/icon.png",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#008751",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://www.retourgagnantbenin.bj/#organization",
        "name": "Retour Gagnant Bénin",
        "url": "https://www.retourgagnantbenin.bj",
        "logo": {
          "@type": "ImageObject",
          "url": "https://www.retourgagnantbenin.bj/images/logo.jpg"
        },
        "contactPoint": [
          {
            "@type": "ContactPoint",
            "telephone": "+229-01-60-32-21-21",
            "contactType": "customer service",
            "availableLanguage": ["French", "English"]
          }
        ],
        "sameAs": []
      },
      {
        "@type": "LocalBusiness",
        "@id": "https://www.retourgagnantbenin.bj/#localbusiness",
        "name": "Retour Gagnant Bénin",
        "image": "https://www.retourgagnantbenin.bj/images/logo.jpg",
        "url": "https://www.retourgagnantbenin.bj",
        "telephone": "+229-01-60-32-21-21",
        "email": "contact@retourgagnantbenin.bj",
        "address": {
          "@type": "PostalAddress",
          "streetAddress": "Haie-Vive Cocotiers, Carré n°1158",
          "addressLocality": "Cotonou",
          "addressCountry": "BJ"
        },
        "openingHoursSpecification": [
          {
            "@type": "OpeningHoursSpecification",
            "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
            "opens": "08:00",
            "closes": "18:00"
          },
          {
            "@type": "OpeningHoursSpecification",
            "dayOfWeek": "Saturday",
            "opens": "08:00",
            "closes": "13:00"
          }
        ],
        "priceRange": "$$",
        "description": "Accompagnement premium pour la diaspora béninoise et afro-descendante : passeport, immobilier, création d'entreprise, investissement, tourisme culturel."
      }
    ]
  };

  return (
    <html lang="fr" className="scroll-smooth">
      <body
        className={`${poppins.variable} ${inter.variable} ${montserrat.variable} ${playfair.variable} ${fraunces.variable} ${geist.variable} ${geistMono.variable} font-sans bg-background text-foreground antialiased`}
        suppressHydrationWarning={true}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <TranslationProvider>
          <LayoutShell>{children}</LayoutShell>
        </TranslationProvider>
        <AnalyticsProvider />
      </body>
    </html>
  );
}
