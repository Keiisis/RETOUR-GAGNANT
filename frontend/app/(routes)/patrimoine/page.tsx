import { T } from '@/lib/translation';
import PatrimoineList from '@/components/PatrimoineList';

export default function PatrimoinePage() {
    return (
        <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8 bg-[#fafbfc] text-[#1a2332]">
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-16">
                    <h1 className="text-4xl md:text-5xl font-bold font-heading mb-6 tracking-tight">
                        <span className="text-[#008751]"><T>Découverte</T></span> & <span className="text-[#E8112D]"><T>Racines</T></span>
                    </h1>
                    <h2 className="text-2xl md:text-3xl font-semibold mb-6 text-slate-800">
                        <T>Patrimoine & Culture</T>
                    </h2>
                    <p className="text-lg md:text-xl text-slate-500 max-w-3xl mx-auto leading-relaxed">
                        <T>Plongez au cœur de l&apos;histoire et des traditions qui font la fierté du Bénin. Un héritage vivant à préserver et à transmettre.</T>
                    </p>
                </div>

                <PatrimoineList />
            </div>
        </div>
    );
}
