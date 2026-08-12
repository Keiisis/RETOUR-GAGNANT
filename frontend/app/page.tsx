import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import SmoothScroll from "@/components/home/SmoothScroll";
import HeroSection from "@/components/home/HeroSection";
import ServicesGrid from "@/components/home/ServicesGrid";
import AboutUsSection from "@/components/home/AboutUsSection";
import ProcessSteps from "@/components/home/ProcessSteps";
import BehanzinHeritage from "@/components/home/BehanzinHeritage";
import HeritageCarousel from "@/components/home/HeritageCarousel";
import ImmersiveGallery from "@/components/home/ImmersiveGallery";
import TestimonialsCarousel from "@/components/home/TestimonialsCarousel";
import PartnersSection from "@/components/home/PartnersSection";
import FinalCta from "@/components/home/FinalCta";
import { T } from "@/lib/translation";

// Grain papier léger (texture anti-flat) : fixe, non interactif.
const GRAIN =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E";

export default function Home() {
  return (
    <div className="relative bg-[#FBFAF7]">
      <SmoothScroll />

      {/* Hero : asymétrique éditorial */}
      <HeroSection />

      {/* Services : bento asymétrique */}
      <section className="bg-[#FBFAF7] py-20 md:py-28">
        <div className="mx-auto max-w-[1400px] px-5 md:px-8">
          <div className="mb-12 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <h2 className="font-fraunces text-4xl font-semibold leading-[1.05] tracking-[-0.02em] text-[#0d1a12] md:text-5xl">
                <T>Tout votre retour</T>, <span className="italic text-[#008751]"><T>un seul partenaire.</T></span>
              </h2>
              <p className="mt-4 max-w-xl font-geist text-lg leading-relaxed text-[#4a5751]">
                <T>De l&apos;administratif à l&apos;investissement, chaque étape est prise en charge par une équipe qui connaît le terrain.</T>
              </p>
            </div>
            <Link href="/services" className="group inline-flex shrink-0 items-center gap-2 font-geist text-[15px] font-semibold text-[#0d1a12] underline decoration-[#FCD116] decoration-2 underline-offset-[6px] transition-colors hover:text-[#008751]">
              <T>Voir tous les services</T>
              <ArrowRight size={15} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
          <ServicesGrid featuredSlug="nationalite-vip" limit={6} />
        </div>
      </section>

      {/* Qui sommes-nous : éditorial image + prose */}
      <AboutUsSection />

      {/* Notre démarche : timeline verticale */}
      <ProcessSteps />

      {/* L'Héritage : ouverture cinématique : Le Roi Béhanzin marche (3D) */}
      <BehanzinHeritage />

      {/* Patrimoine : galerie défilante */}
      <HeritageCarousel />

      {/* Immersion visuelle : bloc noir cinématique (galerie photos) */}
      <ImmersiveGallery />

      {/* Témoignages : défilement de citations */}
      <TestimonialsCarousel />

      {/* Partenaires : logo wall */}
      <PartnersSection />

      {/* CTA final : RDV + newsletter */}
      <FinalCta />

      {/* Grain papier */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[60] opacity-[0.035] mix-blend-multiply"
        style={{ backgroundImage: `url("${GRAIN}")`, backgroundSize: "180px 180px" }}
      />
    </div>
  );
}
