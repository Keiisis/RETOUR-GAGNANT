import { Icon } from "@iconify/react";

export function Accueil() {
  return (
    <div className="min-h-screen bg-background pb-32 font-sans text-foreground">
      <div className="flex h-1.5 w-full">
        <div className="flex-1 bg-primary" />
        <div className="flex-1 bg-secondary" />
        <div className="flex-1 bg-destructive" />
      </div>
      <header className="px-6 py-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold tracking-widest text-muted-foreground uppercase mb-1">
            Bonjour,
          </p>
          <h1 className="text-2xl font-extrabold font-heading tracking-tight text-foreground">
            Jean-Baptiste
          </h1>
        </div>
        <button className="relative w-12 h-12 bg-white border border-border/50 rounded-full flex items-center justify-center shadow-[0_12px_32px_-8px_rgba(60,60,60,0.08)] active:scale-95 transition-transform">
          <span className="absolute top-3 right-3 w-2.5 h-2.5 bg-destructive rounded-full border-2 border-white" />
          <Icon icon="lucide:bell" className="size-5 text-foreground" />
        </button>
      </header>
      <main className="px-6 space-y-8">
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-extrabold font-heading tracking-tight">Dossier en cours</h2>
            <a
              href="#"
              className="text-sm font-bold text-primary flex items-center gap-1 active:opacity-70 transition-opacity"
            >
              Voir <Icon icon="lucide:arrow-right" />
            </a>
          </div>
          <div className="bg-white border border-border/60 rounded-[2rem] p-5 shadow-[0_12px_32px_-8px_rgba(60,60,60,0.06)] relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full flex h-1">
              <div className="flex-1 bg-primary" />
              <div className="flex-1 bg-secondary" />
              <div className="flex-1 bg-destructive" />
            </div>
            <div className="flex items-start justify-between mb-6 mt-2">
              <div>
                <span className="inline-flex items-center gap-1.5 bg-secondary/20 px-3 py-1.5 rounded-lg text-[#00643C] text-xs font-bold mb-3">
                  <Icon icon="lucide:file-check-2" className="size-3.5" />
                  Étape 3 sur 5
                </span>
                <h3 className="text-lg font-extrabold text-foreground tracking-tight">
                  Reconnaissance de nationalité
                </h3>
              </div>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Icon icon="lucide:folder-open" className="size-6 text-primary" />
              </div>
            </div>
            <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden mb-3">
              <div className="w-3/5 h-full bg-primary rounded-full" />
            </div>
            <p className="text-sm font-medium text-muted-foreground leading-relaxed">
              Vérification des actes de naissance en cours par l'administration locale.
            </p>
          </div>
        </section>
        <section>
          <h2 className="text-lg font-extrabold font-heading tracking-tight mb-4">Raccourcis</h2>
          <div className="flex gap-4 overflow-x-auto pb-4 -mx-6 px-6 hide-scrollbar">
            <a
              href="#"
              className="snap-start shrink-0 flex flex-col items-center w-[110px] bg-white p-4 rounded-3xl border border-border/60 shadow-[0_12px_32px_-8px_rgba(60,60,60,0.06)] active:scale-95 transition-transform"
            >
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-3">
                <Icon icon="material-symbols:passport-rounded" className="size-6 text-primary" />
              </div>
              <span className="text-sm font-bold text-center text-foreground leading-tight">
                Nationalité
              </span>
            </a>
            <a
              href="#"
              className="snap-start shrink-0 flex flex-col items-center w-[110px] bg-white p-4 rounded-3xl border border-border/60 shadow-[0_12px_32px_-8px_rgba(60,60,60,0.06)] active:scale-95 transition-transform"
            >
              <div className="w-12 h-12 bg-secondary/20 rounded-2xl flex items-center justify-center mb-3">
                <Icon icon="lucide:home" className="size-6 text-foreground" />
              </div>
              <span className="text-sm font-bold text-center text-foreground leading-tight">
                Immobilier
              </span>
            </a>
            <a
              href="#"
              className="snap-start shrink-0 flex flex-col items-center w-[110px] bg-white p-4 rounded-3xl border border-border/60 shadow-[0_12px_32px_-8px_rgba(60,60,60,0.06)] active:scale-95 transition-transform"
            >
              <div className="w-12 h-12 bg-muted rounded-2xl flex items-center justify-center mb-3">
                <Icon icon="lucide:briefcase" className="size-6 text-foreground" />
              </div>
              <span className="text-sm font-bold text-center text-foreground leading-tight">
                Entreprise
              </span>
            </a>
            <a
              href="#"
              className="snap-start shrink-0 flex flex-col items-center w-[110px] bg-white p-4 rounded-3xl border border-border/60 shadow-[0_12px_32px_-8px_rgba(60,60,60,0.06)] active:scale-95 transition-transform"
            >
              <div className="w-12 h-12 bg-muted rounded-2xl flex items-center justify-center mb-3">
                <Icon icon="lucide:sparkles" className="size-6 text-foreground" />
              </div>
              <span className="text-sm font-bold text-center text-foreground leading-tight">
                Fa & Racines
              </span>
            </a>
          </div>
        </section>
        <section>
          <h2 className="text-lg font-extrabold font-heading tracking-tight mb-4">
            Prochain rendez-vous
          </h2>
          <div className="bg-white border border-border/60 rounded-3xl p-4 shadow-[0_12px_32px_-8px_rgba(60,60,60,0.06)] flex items-center gap-4">
            <div className="w-14 h-14 bg-muted rounded-2xl flex flex-col items-center justify-center shrink-0">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Jeu
              </span>
              <span className="text-lg font-extrabold text-foreground leading-none mt-0.5">14</span>
            </div>
            <div className="flex-1">
              <h3 className="text-base font-bold text-foreground">Point d'étape dossier</h3>
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5 mt-1">
                <Icon icon="lucide:video" className="size-3.5" /> Visioconférence
              </p>
            </div>
            <button className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary active:scale-95 transition-transform shrink-0">
              <Icon icon="lucide:arrow-right" className="size-5" />
            </button>
          </div>
        </section>
        <section className="pb-6">
          <h2 className="text-lg font-extrabold font-heading tracking-tight mb-4">Actualités</h2>
          <div className="bg-white border border-border/60 rounded-[2rem] p-4 shadow-[0_12px_32px_-8px_rgba(60,60,60,0.06)]">
            <div className="relative w-full h-44 rounded-[1.25rem] overflow-hidden mb-5">
              <img
                alt="Nouveau lotissement"
                src="https://ggrhecslgdflloszjkwl.supabase.co/storage/v1/object/public/user-assets/YoYrfLsdtLI/components/Ji2y3kggzR7.jpeg"
                className="w-full h-full object-cover"
              />
              <div className="absolute top-3 left-3 bg-secondary text-secondary-foreground px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg">
                <Icon icon="lucide:star" className="size-3.5" />
                <span className="text-[11px] font-extrabold tracking-wide uppercase">Nouveau</span>
              </div>
            </div>
            <div className="px-1">
              <h3 className="text-lg font-extrabold tracking-tight mb-2 text-foreground">
                Nouveaux terrains viabilisés à Ouidah
              </h3>
              <p className="text-sm text-muted-foreground font-medium mb-5 leading-relaxed">
                Découvrez nos nouvelles opportunités d'investissement sécurisées en bord de mer,
                certifiées par nos notaires.
              </p>
              <button className="w-full bg-muted text-foreground py-3.5 rounded-full font-bold text-sm hover:bg-border/60 active:scale-95 transition-all">
                Découvrir l'offre
              </button>
            </div>
          </div>
        </section>
      </main>
      <div className="fixed bottom-[104px] left-1/2 -translate-x-1/2 w-[calc(100%-3rem)] bg-foreground text-background px-4 py-3.5 rounded-full flex items-center justify-between shadow-[0_12px_32px_-8px_rgba(60,60,60,0.3)] border border-white/10 z-40 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10">
            <img
              alt="Conseillère"
              src="https://randomuser.me/api/portraits/women/44.jpg"
              className="w-full h-full rounded-full object-cover border-2 border-foreground"
            />
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-primary rounded-full border border-foreground" />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-background/60 uppercase tracking-widest mb-0.5">
              Votre Conseillère
            </p>
            <p className="text-sm font-bold text-background leading-none">Amina M.</p>
          </div>
        </div>
        <div className="flex gap-2.5">
          <button className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-background active:scale-95 transition-transform">
            <Icon icon="lucide:message-square" className="size-4.5" />
          </button>
          <button className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-primary-foreground shadow-[0_8px_20px_-6px_rgba(0,135,81,0.5)] active:scale-95 transition-transform">
            <Icon icon="lucide:phone" className="size-4.5" />
          </button>
        </div>
      </div>
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[350px] bg-foreground rounded-full px-7 py-4 shadow-[0_20px_40px_-10px_rgba(60,60,60,0.4)] z-50 border border-white/5">
        <ul className="flex justify-between items-center w-full">
          <li>
            <a href="#" className="flex flex-col items-center gap-1 group relative w-10">
              <Icon
                icon="lucide:home"
                className="size-[22px] text-primary group-active:scale-90 transition-transform"
              />
              <span className="absolute -bottom-2.5 w-1 h-1 bg-primary rounded-full" />
            </a>
          </li>
          <li>
            <a href="#" className="flex flex-col items-center gap-1 group w-10">
              <Icon
                icon="lucide:folder"
                className="size-[22px] text-background/40 group-hover:text-background/80 group-active:scale-90 transition-all"
              />
            </a>
          </li>
          <li>
            <a href="#" className="flex flex-col items-center gap-1 group w-10">
              <Icon
                icon="lucide:grid"
                className="size-[22px] text-background/40 group-hover:text-background/80 group-active:scale-90 transition-all"
              />
            </a>
          </li>
          <li>
            <a href="#" className="flex flex-col items-center gap-1 group w-10">
              <Icon
                icon="lucide:calendar-days"
                className="size-[22px] text-background/40 group-hover:text-background/80 group-active:scale-90 transition-all"
              />
            </a>
          </li>
          <li>
            <a href="#" className="flex flex-col items-center gap-1 group relative w-10">
              <Icon
                icon="lucide:message-circle"
                className="size-[22px] text-background/40 group-hover:text-background/80 group-active:scale-90 transition-all"
              />
              <span className="absolute -top-0.5 right-1 w-2.5 h-2.5 bg-destructive rounded-full border-2 border-foreground" />
            </a>
          </li>
          <li>
            <a href="#" className="flex flex-col items-center gap-1 group w-10">
              <Icon
                icon="lucide:user"
                className="size-[22px] text-background/40 group-hover:text-background/80 group-active:scale-90 transition-all"
              />
            </a>
          </li>
        </ul>
      </nav>
    </div>
  );
}
