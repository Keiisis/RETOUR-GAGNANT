import { T } from "@/lib/translation";
import ServicesGrid from "@/components/home/ServicesGrid";

export default function ServicesPage() {
    return (
        <div className="bg-[#FBFAF7] pt-28 pb-24 md:pt-32">
            <div className="mx-auto max-w-[1400px] px-5 md:px-8">
                <div className="mb-14 max-w-2xl">
                    <h1 className="font-fraunces text-4xl font-semibold leading-[1.05] tracking-[-0.02em] text-[#0d1a12] md:text-6xl">
                        <T>Nos services</T>
                    </h1>
                    <p className="mt-4 font-geist text-lg leading-relaxed text-[#4a5751]">
                        <T>Chaque étape de votre retour et de votre installation au Bénin, prise en charge par une équipe qui connaît le terrain.</T>
                    </p>
                </div>
                <ServicesGrid featuredSlug="nationalite-vip" />
            </div>
        </div>
    );
}
