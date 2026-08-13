import { Icon } from "@iconify/react";

export function MentionsLégales() {
  return (
    <div className="min-h-screen bg-background pb-32 font-sans text-foreground">
      <div className="flex h-1.5 w-full sticky top-0 z-50">
        <div className="flex-1 bg-primary" />
        <div className="flex-1 bg-secondary" />
        <div className="flex-1 bg-destructive" />
      </div>
      <header className="px-6 py-6 flex items-center gap-4 border-b border-border/40 bg-white sticky top-1.5 z-40">
        <button className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-foreground active:scale-90 transition-transform">
          <Icon icon="lucide:chevron-left" width={24} height={24} />
        </button>
        <h1 className="text-xl font-extrabold font-heading tracking-tight">Juridique</h1>
      </header>
      <main className="px-6 py-8 space-y-8 overflow-y-auto">
        <section>
          <h2 className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mb-4">
            Confidentialité
          </h2>
          <div className="bg-white border border-border/60 rounded-[2rem] p-6 shadow-sm">
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Le cabinet Retour Gagnant Bénin s'engage à protéger les données personnelles de ses
              clients conformément au Règlement Général sur la Protection des Données (RGPD) et à la
              législation béninoise sur le numérique.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Vos documents d'état civil sont stockés sur des serveurs sécurisés et ne sont transmis
              qu'aux autorités compétentes dans le cadre strict de vos démarches.
            </p>
          </div>
        </section>
        <section>
          <h2 className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mb-4">
            CGU
          </h2>
          <div className="bg-white border border-border/60 rounded-[2rem] p-6 shadow-sm">
            <h3 className="text-base font-bold text-foreground mb-3">1. Prestations de service</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Le cabinet agit en tant que mandataire et conseil. L'issue finale des démarches
              administratives dépend exclusivement des autorités souveraines de la République du
              Bénin.
            </p>
            <h3 className="text-base font-bold text-foreground mb-3">2. Paiements & Honoraires</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Les tarifs indiqués sont fermes. La consultation Fa est payable d'avance et non
              remboursable une fois effectuée.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
