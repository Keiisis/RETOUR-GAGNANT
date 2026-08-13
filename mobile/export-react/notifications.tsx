import { Icon } from "@iconify/react";

export function Notifications() {
  return (
    <div className="min-h-screen bg-background pb-32 font-sans text-foreground">
      <div className="flex h-1.5 w-full sticky top-0 z-50">
        <div className="flex-1 bg-primary" />
        <div className="flex-1 bg-secondary" />
        <div className="flex-1 bg-destructive" />
      </div>
      <header className="px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-foreground active:scale-90 transition-transform">
            <Icon icon="lucide:chevron-left" width={24} height={24} />
          </button>
          <h1 className="text-xl font-extrabold font-heading tracking-tight">Notifications</h1>
        </div>
        <button className="text-xs font-bold text-primary active:opacity-60 uppercase tracking-widest">
          Tout lire
        </button>
      </header>
      <main className="px-6 space-y-8">
        <section>
          <div>
            <label className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] ml-1 mb-4 block">
              Aujourd'hui
            </label>
            <div className="space-y-3">
              <div className="flex gap-4 p-4 bg-primary/5 border border-primary/10 rounded-3xl">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon icon="lucide:message-square" className="text-primary" width={20} />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-foreground mb-1">
                    Nouveau message de votre conseillère
                  </h4>
                  <p className="text-xs text-muted-foreground font-medium mb-2 leading-relaxed">
                    Amina a répondu à votre question sur les frais notariaux.
                  </p>
                  <span className="text-[9px] font-bold text-muted-foreground uppercase">
                    Il y a 10 min
                  </span>
                </div>
                <div className="w-2 h-2 bg-primary rounded-full mt-2 shrink-0" />
              </div>
              <div className="flex gap-4 p-4 bg-white border border-border/60 rounded-3xl shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center shrink-0">
                  <Icon icon="lucide:file-check" className="text-secondary-foreground" width={20} />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-foreground mb-1">Dossier mis à jour</h4>
                  <p className="text-xs text-muted-foreground font-medium mb-2 leading-relaxed">
                    L'étape "Authentification des actes" est désormais terminée.
                  </p>
                  <span className="text-[9px] font-bold text-muted-foreground uppercase">
                    Il y a 2 heures
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section>
          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] ml-1 mb-4 block">
              Hier
            </label>
            <div className="space-y-3">
              <div className="flex gap-4 p-4 bg-white border border-border/60 rounded-3xl shadow-sm opacity-80">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                  <Icon icon="lucide:calendar" className="text-foreground" width={20} />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-foreground mb-1">Rappel de rendez-vous</h4>
                  <p className="text-xs text-muted-foreground font-medium mb-2 leading-relaxed">
                    Votre appel vidéo est prévu demain à 14:00.
                  </p>
                  <span className="text-[9px] font-bold text-muted-foreground uppercase">
                    Hier, 18:30
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
