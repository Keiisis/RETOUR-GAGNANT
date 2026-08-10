import type { Metadata, Viewport } from "next";
import { Poppins, Inter, Montserrat, Playfair_Display, Fraunces, Geist, Geist_Mono } from "next/font/google";
import { LayoutShell } from "@/components/layout/LayoutShell";
import { TranslationProvider } from "@/lib/translation";
import AnalyticsProvider from "@/components/analytics/AnalyticsProvider";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-poppins",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-inter",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-montserrat",
});

// Serif éditorial premium — grands titres (pages vitrines : nationalité…).
const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-playfair",
});

// Refonte accueil (Phase 1) — titres cinétiques Fraunces (serif variable
// haute-contraste), corps Geist, chiffres Geist Mono.
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
});
const geist = Geist({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-geist",
});
const geistMono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: {
    default: "Retour Gagnant Bénin — Accompagnement Premium pour la Diaspora",
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
    title: "Retour Gagnant Bénin — Accompagnement Premium pour la Diaspora",
    description: "Passeport, immobilier, entreprise, investissement — tous les services pour réussir votre retour au Bénin.",
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
    title: "Retour Gagnant Bénin — Accompagnement Premium",
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
