import ServicesGrid from "@/components/home/ServicesGrid";

export default function ServicesPage() {
    return (
        <div className="container mx-auto px-4 py-12">
            <div className="text-center mb-16 space-y-4">
                <h1 className="text-4xl md:text-5xl font-bold font-heading text-primary">Nos Services</h1>
                <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                    Découvrez comment nous pouvons faciliter votre retour et votre installation au Bénin grâce à nos solutions sur mesure.
                </p>
                <div className="w-24 h-1.5 bg-secondary mx-auto rounded-full mt-4" />
            </div>
            <ServicesGrid />
        </div>
    );
}
