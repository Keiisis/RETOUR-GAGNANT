import { Icon } from "@iconify/react";

export function MesServices() {
  return (
    <div className="min-h-screen bg-background pb-32 font-sans text-foreground">
      <div className="flex h-1.5 w-full">
        <div className="flex-1 bg-primary" />
        <div className="flex-1 bg-secondary" />
        <div className="flex-1 bg-destructive" />
      </div>
      <header className="px-6 py-6 flex flex-col gap-4">
        <h1 className="text-2xl font-extrabold font-heading tracking-tight">Nos prestations</h1>
        <div className="flex gap-2 overflow-x-auto -mx-6 px-6 hide-scrollbar">
          <button className="shrink-0 bg-foreground text-background px-5 py-2 rounded-full text-sm font-bold">
            Tous
          </button>
          <button className="shrink-0 bg-white border border-border px-5 py-2 rounded-full text-sm font-bold text-muted-foreground">
            Nationalité
          </button>
          <button className="shrink-0 bg-white border border-border px-5 py-2 rounded-full text-sm font-bold text-muted-foreground">
            Immobilier
          </button>
          <button className="shrink-0 bg-white border border-border px-5 py-2 rounded-full text-sm font-bold text-muted-foreground">
            Entreprise
          </button>
        </div>
      </header>
      <main className="px-6 space-y-6">
        <div className="relative flex items-center bg-white border border-border/60 rounded-full p-1.5 pl-5 shadow-[0_12px_32px_-8px_rgba(60,60,60,0.06)]">
          <Icon icon="lucide:search" className="size-5 text-muted-foreground" />
          <input
            type="text"
            className="bg-transparent border-none outline-none flex-1 px-3 text-sm font-medium placeholder:text-muted-foreground"
            placeholder="Quel accompagnement cherchez-vous ?"
          />
          <button className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white shadow-lg active:scale-95 transition-transform">
            <Icon icon="lucide:sliders-horizontal" className="size-[18px]" />
          </button>
        </div>
        <section>
          <div className="flex items-center justify-between mb-4 mt-2">
            <h2 className="text-sm font-bold text-primary tracking-widest uppercase">
              État Civil & Nationalité
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <div className="bg-white border border-border/60 rounded-[2rem] p-5 shadow-[0_12px_32px_-8px_rgba(60,60,60,0.06)]">
              <div className="flex gap-4 mb-4">
                <div className="w-16 h-16 rounded-2xl bg-primary/5 flex items-center justify-center shrink-0">
                  <Icon icon="lucide:landmark" className="size-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-foreground tracking-tight leading-snug">
                    Reconnaissance de nationalité
                  </h3>
                  <p className="text-xs font-medium text-muted-foreground mt-1">
                    Accompagnement administratif complet pour obtenir votre certificat de
                    nationalité.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-border/40">
                <div className="flex flex-col">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                    Type
                  </span>
                  <span className="text-sm font-bold text-foreground">Notarial</span>
                </div>
                <button className="bg-primary text-white px-6 py-2.5 rounded-full font-bold text-xs shadow-md active:scale-95 transition-all">
                  Prendre RDV
                </button>
              </div>
            </div>
            <div className="bg-white border border-border/60 rounded-[2rem] p-5 shadow-[0_12px_32px_-8px_rgba(60,60,60,0.06)]">
              <div className="flex gap-4 mb-4">
                <div className="w-16 h-16 rounded-2xl bg-secondary/10 flex items-center justify-center shrink-0">
                  <Icon
                    icon="material-symbols:passport-rounded"
                    className="size-8 text-secondary-foreground"
                  />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-foreground tracking-tight leading-snug">
                    Passeport Béninois
                  </h3>
                  <p className="text-xs font-medium text-muted-foreground mt-1">
                    Établissement ou renouvellement de votre passeport biométrique par nos experts.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-border/40">
                <div className="flex flex-col">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                    Type
                  </span>
                  <span className="text-sm font-bold text-foreground">Administratif</span>
                </div>
                <button className="bg-primary text-white px-6 py-2.5 rounded-full font-bold text-xs shadow-md active:scale-95 transition-all">
                  Prendre RDV
                </button>
              </div>
            </div>
          </div>
        </section>
        <section>
          <div className="flex items-center justify-between mb-4 mt-4">
            <h2 className="text-sm font-bold text-primary tracking-widest uppercase">
              Investissement Immobilier
            </h2>
          </div>
          <div className="bg-white border border-border/60 rounded-[2rem] overflow-hidden shadow-[0_12px_32px_-8px_rgba(60,60,60,0.06)]">
            <div className="h-44 w-full relative">
              <img
                alt="Real Estate"
                src="https://ggrhecslgdflloszjkwl.supabase.co/storage/v1/object/public/user-assets/YoYrfLsdtLI/components/bcdScM5iYoP.jpeg"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-5 left-6">
                <h3 className="text-xl font-extrabold text-white tracking-tight">
                  Sécurisation Foncière
                </h3>
                <p className="text-sm text-white/80 font-medium">Achat, Titre foncier et Bornage</p>
              </div>
            </div>
            <div className="p-6">
              <p className="text-sm text-muted-foreground font-medium mb-5 leading-relaxed">
                Ne prenez aucun risque. Nos avocats et géomètres vérifient la conformité de vos
                terrains avant tout achat au Bénin.
              </p>
              <button className="w-full bg-primary text-white py-3.5 rounded-full font-bold text-sm shadow-[0_8px_20px_-6px_rgba(0,135,81,0.4)] active:scale-95 transition-all">
                Consulter un expert foncier
              </button>
            </div>
          </div>
        </section>
        <section className="pb-6">
          <div className="bg-secondary/10 border border-secondary/20 rounded-[2rem] p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground shadow-sm">
                <Icon icon="lucide:sparkles" className="size-5" />
              </div>
              <h3 className="text-base font-extrabold text-foreground">
                Consultation Fa & Racines
              </h3>
            </div>
            <p className="text-sm text-muted-foreground font-medium mb-5">
              Connectez-vous à vos ancêtres grâce à une consultation authentique avec nos prêtres Fa
              certifiés.
            </p>
            <button className="flex items-center justify-center gap-2 w-full bg-foreground text-background py-3 rounded-full font-bold text-sm active:scale-95 transition-transform">
              Voir l'annuaire <Icon icon="lucide:arrow-right" className="size-4" />
            </button>
          </div>
        </section>
      </main>
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[350px] bg-foreground rounded-full px-7 py-4 shadow-[0_20px_40px_-10px_rgba(60,60,60,0.4)] z-50 border border-white/5">
        <ul className="flex justify-between items-center w-full">
          <li>
            <a href="#" className="flex flex-col items-center group w-10">
              <Icon icon="lucide:home" className="size-[22px] text-background/40" />
            </a>
          </li>
          <li>
            <a href="#" className="flex flex-col items-center group w-10">
              <Icon icon="lucide:folder" className="size-[22px] text-background/40" />
            </a>
          </li>
          <li>
            <a href="#" className="flex flex-col items-center group relative w-10">
              <Icon icon="lucide:grid" className="size-[22px] text-primary" />
              <span className="absolute -bottom-2.5 w-1 h-1 bg-primary rounded-full" />
            </a>
          </li>
          <li>
            <a href="#" className="flex flex-col items-center group w-10">
              <Icon icon="lucide:calendar-days" className="size-[22px] text-background/40" />
            </a>
          </li>
          <li>
            <a href="#" className="flex flex-col items-center group w-10">
              <Icon icon="lucide:message-circle" className="size-[22px] text-background/40" />
            </a>
          </li>
          <li>
            <a href="#" className="flex flex-col items-center group w-10">
              <Icon icon="lucide:user" className="size-[22px] text-background/40" />
            </a>
          </li>
        </ul>
      </nav>
    </div>
  );
}
