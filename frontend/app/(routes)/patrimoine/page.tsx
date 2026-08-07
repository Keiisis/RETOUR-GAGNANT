import Link from 'next/link';
import { T } from '@/lib/translation';
import PatrimoineList from '@/components/PatrimoineList';

export default function PatrimoinePage() {
    return (
        <div className="min-h-screen bg-white text-slate-900">
            {/* Hero — clair, charte Bénin, Playfair */}
            <section className="relative overflow-hidden">
                <div className="absolute -inset-x-8 -top-24 h-[130%] bg-[radial-gradient(55%_55%_at_12%_0%,rgba(0,135,81,0.16),transparent),radial-gradient(42%_45%_at_92%_2%,rgba(252,209,22,0.16),transparent),linear-gradient(180deg,#FBFDFC,#FFFFFF)]" />
                <div className="relative max-w-6xl mx-auto px-5 md:px-8 pt-24 md:pt-28 pb-10 text-center">
                    <nav className="flex items-center justify-center gap-1.5 text-[13px] text-slate-400 mb-6">
                        <Link href="/" className="hover:text-[#008751]"><T>Accueil</T></Link>
                        <span aria-hidden>›</span>
                        <span className="text-slate-600 font-medium"><T>Patrimoine</T></span>
                    </nav>
                    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#E6F3ED] text-[#00643C] text-[11px] font-black uppercase tracking-[0.15em] mb-5">
                        <T>Patrimoine & Culture</T>
                    </span>
                    <h1 className="font-display text-4xl md:text-[3.6rem] font-bold leading-[1.04] tracking-[-0.02em]">
                        <span className="bg-gradient-to-br from-[#008751] via-[#0a7d52] to-[#00643C] bg-clip-text text-transparent"><T>Découverte</T></span>
                        {' '}&{' '}
                        <span className="italic text-[#E8112D]"><T>Racines</T></span>
                    </h1>
                    <p className="mt-5 text-[17px] md:text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed">
                        <T>Plongez au cœur de l&apos;histoire et des traditions qui font la fierté du Bénin. Un héritage vivant à préserver et à transmettre.</T>
                    </p>
                </div>
            </section>

            {/* Liste du patrimoine */}
            <section className="max-w-7xl mx-auto px-5 md:px-8 pb-16">
                <PatrimoineList />
            </section>
        </div>
    );
}
