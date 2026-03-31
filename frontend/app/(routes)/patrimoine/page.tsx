import { T } from '@/lib/translation';
import PatrimoineList from '@/components/PatrimoineList';

export default function PatrimoinePage() {
    return (
        <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8 bg-black text-white">
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-16">
                    <h1 className="text-4xl md:text-5xl font-bold font-heading mb-6 tracking-tight">
                        <span className="text-neon-orange"><T>Découverte</T></span> & <span className="text-neon-green"><T>Racines</T></span>
                    </h1>
                    <h2 className="text-2xl md:text-3xl font-semibold mb-6 text-gray-200">
                        <T>Patrimoine & Culture</T>
                    </h2>
                    <p className="text-lg md:text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
                        <T>Plongez au cœur de l&apos;histoire et des traditions qui font la fierté du Bénin. Un héritage vivant à préserver et à transmettre.</T>
                    </p>
                </div>

                <PatrimoineList />
            </div>
        </div>
    );
}
