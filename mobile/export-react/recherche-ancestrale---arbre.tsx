import { Icon } from "@iconify/react";

export function RechercheAncestraleArbre() {
  return (
    <div className="min-h-screen bg-background pb-32 font-sans text-foreground">
      <div className="flex h-1.5 w-full sticky top-0 z-50">
        <div className="flex-1 bg-primary" />
        <div className="flex-1 bg-secondary" />
        <div className="flex-1 bg-destructive" />
      </div>
      <header className="px-6 py-6 flex items-center justify-between">
        <button className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-foreground active:scale-90 transition-transform">
          <Icon icon="lucide:chevron-left" width={24} height={24} />
        </button>
        <h1 className="text-xl font-extrabold font-heading tracking-tight">Généalogie</h1>
        <button className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-foreground active:scale-90 transition-transform">
          <Icon icon="lucide:download" width={20} />
        </button>
      </header>
      <main className="px-6 space-y-8">
        <div className="bg-primary/5 border border-primary/10 rounded-3xl p-5 flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center shrink-0 shadow-lg shadow-green-900/10">
            <Icon icon="lucide:git-branch" className="text-white" width={24} height={24} />
          </div>
          <div>
            <h3 className="text-base font-extrabold mb-1">Plan de composition familiale</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Structure de votre lignée ascendante pour le dossier de nationalité.
            </p>
          </div>
        </div>
        <div className="relative py-4">
          <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-0.5 bg-border/40" />
          <div className="space-y-12 relative">
            <div className="flex flex-col items-center gap-2">
              <div className="bg-white border-2 border-primary rounded-full px-6 py-2.5 shadow-md relative z-10">
                <span className="text-xs font-extrabold">Demandeur (Vous)</span>
              </div>
              <div className="w-px h-6 bg-primary" />
              <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-lg">
                <img
                  src="https://lh3.googleusercontent.com/a/ACg8ocJ7n8MyFRrJoAd3ZrzA_ygK1xie19cram_sZq0M4lFNmUrQqA=s96-c"
                  className="w-full h-full object-cover"
                />
              </div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase">
                Jean-Baptiste Dupont
              </p>
            </div>
            <div className="flex justify-between items-start px-4 w-full relative">
              <div className="absolute top-0 left-1/4 right-1/4 h-0.5 bg-border/40" />
              <div className="flex flex-col items-center gap-2 relative z-10 w-1/2">
                <div className="bg-white border border-border rounded-2xl p-3 shadow-sm text-center w-full max-w-[140px]">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                    Père
                  </span>
                  <span className="text-xs font-extrabold truncate w-full block">
                    Michel Dupont
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-center gap-2 relative z-10 w-1/2">
                <div className="bg-white border border-border rounded-2xl p-3 shadow-sm text-center w-full max-w-[140px]">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                    Mère
                  </span>
                  <span className="text-xs font-extrabold truncate w-full block">
                    Marie-Claire A.
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-px h-8 bg-border/40" />
              <div className="bg-secondary/20 border-2 border-secondary rounded-full px-6 py-2.5 shadow-md relative z-10">
                <span className="text-xs font-extrabold text-[#00643C]">Aïeul Béninois</span>
              </div>
              <div className="w-px h-6 bg-secondary" />
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center border-2 border-white shadow-lg">
                <Icon icon="lucide:user" className="text-muted-foreground" width={20} />
              </div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase text-center">
                Koffi ADJOVI
                <br />
                <span className="text-[8px]">(Grand-père paternel)</span>
              </p>
            </div>
          </div>
        </div>
        <button className="w-full bg-white border border-primary text-primary py-4 rounded-2xl font-bold text-sm active:bg-primary/5 transition-all flex items-center justify-center gap-2">
          <Icon icon="lucide:plus" width={18} /> Ajouter un membre
        </button>
      </main>
    </div>
  );
}
