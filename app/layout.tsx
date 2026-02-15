import type { Metadata } from "next";
import { Poppins, Inter } from "next/font/google";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import AudioPlayer from "@/components/layout/AudioPlayer";
import ChatAssistant from "@/components/chat/ChatAssistant";
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
};

export default function RootLayout({
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
        <Header />
        <AudioPlayer />
        <main className="min-h-screen pt-20">
          {children}
        </main>
        <ChatAssistant />
        <Footer />
      </body>
    </html>
  );
}
