import { Icon } from "@iconify/react";

export function MesFactures() {
  return (
    <div className="min-h-screen bg-background pb-32 font-sans text-foreground">
      <div className="flex h-1.5 w-full sticky top-0 z-50">
        <div className="flex-1 bg-primary" />
        <div className="flex-1 bg-secondary" />
        <div className="flex-1 bg-destructive" />
      </div>
      <header className="px-6 py-6 flex items-center gap-4">
        <button className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-foreground active:scale-90 transition-transform">
          <Icon icon="lucide:chevron-left" width={24} height={24} />
        </button>
        <h1 className="text-xl font-extrabold font-heading tracking-tight">Mes factures</h1>
      </header>
      <main className="px-6 space-y-4">
        <div className="bg-primary/5 border border-primary/20 rounded-3xl p-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-green-900/10">
              <Icon icon="lucide:receipt" className="text-white" width={24} />
            </div>
            <div>
              <h3 className="text-sm font-bold">Facture #FAC-2024-042</h3>
              <p className="text-[10px] font-medium text-muted-foreground">
                Reconnaissance Nationalité • 12/03/24
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-sm font-extrabold text-[#00643C] block mb-1">75 000 FCFA</span>
            <span className="bg-primary/10 text-primary text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter">
              PAYÉ
            </span>
          </div>
        </div>
        <div className="bg-white border border-border/60 rounded-3xl p-5 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
              <Icon icon="lucide:receipt" className="text-muted-foreground" width={24} />
            </div>
            <div>
              <h3 className="text-sm font-bold">Facture #FAC-2024-039</h3>
              <p className="text-[10px] font-medium text-muted-foreground">
                Frais de dossier • 05/03/24
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-sm font-extrabold text-[#00643C] block mb-1">15 000 FCFA</span>
            <span className="bg-primary/10 text-primary text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter">
              PAYÉ
            </span>
          </div>
        </div>
        <div className="bg-white border border-border/60 rounded-3xl p-5 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
              <Icon icon="lucide:receipt" className="text-muted-foreground" width={24} />
            </div>
            <div>
              <h3 className="text-sm font-bold">Facture #FAC-2024-028</h3>
              <p className="text-[10px] font-medium text-muted-foreground">
                Consultation Fa • 28/02/24
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-sm font-extrabold text-[#00643C] block mb-1">35 000 FCFA</span>
            <span className="bg-primary/10 text-primary text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter">
              PAYÉ
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
