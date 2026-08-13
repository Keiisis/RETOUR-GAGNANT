import { Icon } from "@iconify/react";

export function DossierChronologie() {
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
        <h1 className="text-xl font-extrabold font-heading tracking-tight">Suivi détaillé</h1>
        <button className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-foreground active:scale-90 transition-transform">
          <Icon icon="lucide:info" width={20} />
        </button>
      </header>
      <main className="px-6 space-y-8">
        <div className="bg-white border border-border/60 rounded-[2rem] p-6 shadow-sm">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <Icon icon="lucide:landmark" className="text-primary" width={32} />
            </div>
            <div>
              <h2 className="text-lg font-extrabold leading-tight">
                Reconnaissance de nationalité
              </h2>
              <p className="text-xs font-medium text-muted-foreground mt-1">
                Dossier #RG-2024-8892
              </p>
            </div>
          </div>
          <div className="space-y-0 relative">
            <div className="absolute left-4 top-2 bottom-12 w-0.5 bg-primary/20" />
            <div className="relative pl-12 pb-10">
              <div className="absolute left-0 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold shadow-md shadow-green-900/10">
                <Icon icon="lucide:check" width={16} />
              </div>
              <h4 className="text-sm font-bold text-foreground">Dossier Soumis</h4>
              <p className="text-[10px] font-bold text-primary uppercase mb-1">
                12 Mars 2024 • 09:15
              </p>
              <p className="text-xs text-muted-foreground">
                Votre demande a été enregistrée avec succès par nos services.
              </p>
            </div>
            <div className="relative pl-12 pb-10">
              <div className="absolute left-0 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold shadow-md shadow-green-900/10">
                <Icon icon="lucide:check" width={16} />
              </div>
              <h4 className="text-sm font-bold text-foreground">Dossier Vérifié</h4>
              <p className="text-[10px] font-bold text-primary uppercase mb-1">
                14 Mars 2024 • 14:30
              </p>
              <p className="text-xs text-muted-foreground">
                Toutes les pièces justificatives ont été validées par nos experts juridiques.
              </p>
            </div>
            <div className="relative pl-12 pb-10">
              <div className="absolute left-0 w-8 h-8 rounded-full border-2 border-primary bg-white flex items-center justify-center text-xs font-bold">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              </div>
              <h4 className="text-sm font-bold text-primary">Traitement Administratif</h4>
              <p className="text-[10px] font-bold text-primary uppercase mb-1">En cours</p>
              <p className="text-xs text-muted-foreground">
                Le dossier a été transmis à la Direction de l'Émigration et de l'Immigration à
                Cotonou.
              </p>
            </div>
            <div className="relative pl-12 pb-10 opacity-30">
              <div className="absolute left-0 w-8 h-8 rounded-full border-2 border-border bg-white flex items-center justify-center text-xs font-bold">
                4
              </div>
              <h4 className="text-sm font-bold text-foreground">Validation Finale</h4>
              <p className="text-xs text-muted-foreground">
                Signature du certificat de nationalité par les autorités compétentes.
              </p>
            </div>
            <div className="relative pl-12 opacity-30">
              <div className="absolute left-0 w-8 h-8 rounded-full border-2 border-border bg-white flex items-center justify-center text-xs font-bold">
                5
              </div>
              <h4 className="text-sm font-bold text-foreground">Dossier Terminé</h4>
              <p className="text-xs text-muted-foreground">
                Remise en main propre ou envoi sécurisé de votre titre.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
