import type { Metadata, Viewport } from "next";
import { Poppins, Inter } from "next/font/google";
import { LayoutShell } from "@/components/layout/LayoutShell";
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

export const metadata: Metadata = {
  title: "RETOUR GAGNANT BENIN - Accompagnement Premium",
  description: "Votre partenaire de confiance pour un retour réussi au Bénin. Services administratifs, immobiliers et business.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Retour Gagnant",
  },
  icons: {
    icon: [
      { url: "/images/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/images/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/images/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: "/images/icon-192x192.png",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#008751",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="scroll-smooth">
      <body
        className={`${poppins.variable} ${inter.variable} font-sans bg-background text-foreground antialiased`}
        suppressHydrationWarning={true}
      >
        <LayoutShell>{children}</LayoutShell>
      </body>
    </html>
  );
}
