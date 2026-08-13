import { Icon } from "@iconify/react";

export function FormulaireNationalitéÉtapes() {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground flex flex-col">
      <div className="flex h-1.5 w-full sticky top-0 z-50">
        <div className="flex-1 bg-primary" />
        <div className="flex-1 bg-secondary" />
        <div className="flex-1 bg-destructive" />
      </div>
      <header className="px-6 py-6 border-b border-border/40 bg-white sticky top-1.5 z-40">
        <div className="flex items-center justify-between mb-4">
          <button className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-foreground active:scale-90 transition-transform">
            <Icon icon="lucide:x" width={24} />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold text-primary">ÉTAPE 2</span>
            <span className="text-xs font-bold text-muted-foreground">SUR 4</span>
          </div>
          <div className="w-10" />
        </div>
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="w-1/2 h-full bg-primary rounded-full transition-all duration-500" />
        </div>
      </header>
      <main className="flex-1 px-6 py-8 space-y-8 overflow-y-auto">
        <div className="space-y-2">
          <h2 className="text-2xl font-extrabold font-heading tracking-tight leading-tight">
            État Civil de l'Aïeul
          </h2>
          <p className="text-muted-foreground font-medium">
            Informations sur l'ancêtre d'origine béninoise justifiant votre demande.
          </p>
        </div>
        <div className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1 mb-2 block">
                Nom de l'aïeul
              </label>
              <div className="relative flex items-center bg-muted/50 border border-border/60 rounded-2xl p-4 focus-within:border-primary transition-all">
                <input
                  type="text"
                  placeholder="Ex: ADJOVI"
                  className="bg-transparent border-none outline-none w-full text-sm font-medium"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1 mb-2 block">
                Prénom(s)
              </label>
              <div className="relative flex items-center bg-muted/50 border border-border/60 rounded-2xl p-4 focus-within:border-primary transition-all">
                <input
                  type="text"
                  placeholder="Ex: Koffi"
                  className="bg-transparent border-none outline-none w-full text-sm font-medium"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1 mb-2 block">
                Lieu de naissance au Bénin
              </label>
              <div className="relative flex items-center bg-muted/50 border border-border/60 rounded-2xl p-4 focus-within:border-primary transition-all">
                <Icon icon="lucide:map-pin" className="text-muted-foreground mr-3" width={20} />
                <select className="bg-transparent border-none outline-none flex-1 text-sm font-medium appearance-none">
                  <option>Choisir une commune</option>
                  <option>Cotonou</option>
                  <option>Porto-Novo</option>
                  <option>Abomey</option>
                  <option>Ouidah</option>
                </select>
                <Icon icon="lucide:chevron-down" className="text-muted-foreground" width={20} />
              </div>
            </div>
          </div>
          <div className="bg-primary/5 border border-primary/10 rounded-3xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-xs font-bold text-primary flex items-center gap-2">
                <Icon icon="lucide:upload-cloud" width={18} /> Acte de naissance de l'aïeul
              </h4>
              <span className="text-[10px] font-bold text-primary uppercase">Optionnel</span>
            </div>
            <div className="w-full h-32 border-2 border-dashed border-primary/20 rounded-2xl flex flex-col items-center justify-center gap-2 active:bg-primary/10 transition-colors">
              <Icon icon="lucide:plus" className="text-primary" width={32} />
              <p className="text-[10px] font-bold text-primary uppercase">Choisir un fichier</p>
            </div>
            <p className="text-[9px] text-muted-foreground mt-3 leading-relaxed">
              Formats acceptés: PDF, JPG, PNG (Max 5Mo). Si manquant, nous pourrons effectuer une
              recherche en archives.
            </p>
          </div>
        </div>
      </main>
      <div className="px-6 py-6 border-t border-border/40 bg-white pb-safe flex gap-4">
        <button className="flex-1 bg-muted text-foreground py-5 rounded-2xl font-bold text-sm active:scale-95 transition-all">
          Précédent
        </button>
        <button className="flex-[2] bg-primary text-white py-5 rounded-2xl font-bold text-sm shadow-[0_8px_20px_-6px_rgba(0,135,81,0.4)] active:scale-[0.97] transition-all">
          Continuer
        </button>
      </div>
    </div>
  );
}
