import Link from "next/link";
import { Button } from "@/components/ui/button";
import ServicesGrid from "@/components/home/ServicesGrid";
import StatsSection from "@/components/home/StatsSection";
import TestimonialsCarousel from "@/components/home/TestimonialsCarousel";

import HeroSection from "@/components/home/HeroSection";
import ProcessSteps from "@/components/home/ProcessSteps";
import HeritageCarousel from "@/components/home/HeritageCarousel";
import ImmersiveGallery from "@/components/home/ImmersiveGallery";
import NationalitySection from "@/components/home/NationalitySection";
import PartnersSection from "@/components/home/PartnersSection";

export default function Home() {
  return (
    <div className="bg-white">
      {/* Hero Section (Immersive Video/Particles) */}
      <HeroSection />

      {/* Stats Section (Disabled for now) */}
      {/* <StatsSection /> */}

      {/* Services Preview */}
      <section className="py-12 md:py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10 md:mb-16 space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold font-heading text-primary text-balance">Nos Solutions Clés en Main</h2>
            <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto">
              Nous avons conçu une gamme de services pour simplifier chaque étape de votre retour, de l'administratif à l'investissement.
            </p>
            <div className="w-24 h-1.5 bg-secondary mx-auto rounded-full mt-4" />
          </div>
          <ServicesGrid />
          <div className="text-center mt-12">
            <Link href="/services">
              <Button variant="outline" size="lg" className="rounded-full px-8 border-primary text-primary hover:bg-primary hover:text-white transition-all">
                Voir tous les services
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Nationality Section (New) */}
      <NationalitySection />

      {/* Heritage Section (Infinite Scroll) */}
      <HeritageCarousel />

      {/* Immersive Art Gallery */}
      <ImmersiveGallery />

      {/* Process Steps (Notre Démarche) */}
      <ProcessSteps />

      {/* Testimonials */}
      <TestimonialsCarousel />

      {/* Partners Section (New) */}
      <PartnersSection />

      {/* Call to Action */}
      <section className="py-16 md:py-24 bg-[#1a2332] text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/3 h-full bg-primary/10 -skew-x-12 transform origin-bottom-right" />
        <div className="container mx-auto px-4 text-center relative z-10">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 md:mb-6">Prêt à Sauter le Pas ?</h2>
          <p className="text-xl opacity-80 mb-8 max-w-2xl mx-auto">
            Ne laissez pas les démarches administratives freiner vos rêves. Prenons 15 minutes pour discuter de votre projet.
          </p>
          <Link href="/rendez-vous">
            <Button size="lg" className="bg-secondary text-foreground hover:bg-secondary/90 rounded-full px-10 h-16 text-xl shadow-lg hover:scale-105 transition-transform">
              Réserver un Appel Gratuit
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
