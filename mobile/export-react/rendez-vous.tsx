import { Icon } from "@iconify/react";

export function RendezVous() {
  return (
    <div className="min-h-screen bg-background pb-32 font-sans text-foreground">
      <div className="flex h-1.5 w-full sticky top-0 z-50">
        <div className="flex-1 bg-primary" />
        <div className="flex-1 bg-secondary" />
        <div className="flex-1 bg-destructive" />
      </div>
      <header className="px-6 py-6 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <button className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-foreground active:scale-90 transition-transform">
            <Icon icon="lucide:chevron-left" width={24} height={24} />
          </button>
          <h1 className="text-xl font-extrabold font-heading tracking-tight">Rendez-vous</h1>
          <button className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform">
            <Icon icon="lucide:plus" width={20} />
          </button>
        </div>
        <div className="flex gap-2 bg-muted/50 p-1 rounded-2xl">
          <button className="flex-1 bg-white text-foreground py-2 rounded-xl text-xs font-bold shadow-sm">
            À venir
          </button>
          <button className="flex-1 text-muted-foreground py-2 rounded-xl text-xs font-bold active:opacity-60">
            Historique
          </button>
        </div>
      </header>
      <main className="px-6 space-y-6">
        <section>
          <div>
            <label className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] ml-1 mb-4 block">
              Cette semaine
            </label>
            <div className="bg-white border border-border/60 rounded-3xl p-5 shadow-sm space-y-5">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 bg-muted rounded-2xl flex flex-col items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">
                    Jeu
                  </span>
                  <span className="text-lg font-extrabold text-foreground mt-0.5">14</span>
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-foreground mb-1">Point d'étape dossier</h4>
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                      <Icon icon="lucide:clock" width={12} /> 14:00 — 14:30 (Paris)
                    </p>
                    <p className="text-[11px] font-medium text-primary flex items-center gap-1.5">
                      <Icon icon="lucide:video" width={12} /> Visioconférence Zoom
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 pt-4 border-t border-border/40">
                <button className="flex-1 bg-primary text-white py-3 rounded-xl text-xs font-bold active:scale-95 transition-all">
                  Rejoindre l'appel
                </button>
                <button className="w-12 bg-muted text-foreground py-3 rounded-xl flex items-center justify-center active:scale-95 transition-all">
                  <Icon icon="lucide:more-horizontal" width={18} />
                </button>
              </div>
            </div>
          </div>
        </section>
        <section>
          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] ml-1 mb-4 block">
              Semaine prochaine
            </label>
            <div className="bg-white border border-border/60 rounded-3xl p-5 shadow-sm opacity-60">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 bg-muted rounded-2xl flex flex-col items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">
                    Mar
                  </span>
                  <span className="text-lg font-extrabold text-foreground mt-0.5">19</span>
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-foreground mb-1">Consultation Foncier</h4>
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                      <Icon icon="lucide:clock" width={12} /> 09:30 — 10:30 (Cotonou)
                    </p>
                    <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                      <Icon icon="lucide:map-pin" width={12} /> Cabinet Retour Gagnant, Cotonou
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
