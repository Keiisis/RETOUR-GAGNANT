import PatrimoineList from '@/components/PatrimoineList';

export default function CulturePage() {
    return (
        <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8 bg-black text-white">
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-16">
                    <h1 className="text-4xl md:text-5xl font-bold font-heading mb-6 tracking-tight">
                        <span className="text-neon-orange">Découverte</span> & <span className="text-neon-green">Racines</span>
                    </h1>
                    <h2 className="text-2xl md:text-3xl font-semibold mb-6 text-gray-200">
                        Patrimoine & Culture
                    </h2>
                    <p className="text-lg md:text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
                        Plongez au cœur de l'histoire et des traditions qui font la fierté du Bénin. Un héritage vivant à préserver et à transmettre.
                    </p>
                </div>

                <PatrimoineList />
            </div>
        </div>
    );
}
