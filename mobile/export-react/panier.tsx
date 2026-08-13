import { Icon } from "@iconify/react";

export function Panier() {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground flex flex-col">
      <div className="flex h-1.5 w-full sticky top-0 z-50">
        <div className="flex-1 bg-primary" />
        <div className="flex-1 bg-secondary" />
        <div className="flex-1 bg-destructive" />
      </div>
      <header className="px-6 py-6 flex items-center gap-4 border-b border-border/40 bg-white sticky top-1.5 z-40">
        <button className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-foreground active:scale-90 transition-transform">
          <Icon icon="lucide:chevron-left" width={24} height={24} />
        </button>
        <h1 className="text-xl font-extrabold font-heading tracking-tight">Votre Panier</h1>
      </header>
      <main className="flex-1 px-6 py-6 space-y-6 overflow-y-auto">
        <div className="space-y-4">
          <div className="flex gap-4 bg-white border border-border/60 rounded-[1.5rem] p-4 shadow-sm">
            <img
              src="https://ggrhecslgdflloszjkwl.supabase.co/storage/v1/object/public/user-assets/YoYrfLsdtLI/components/qgtS9F9faHM.jpeg"
              className="w-20 h-20 rounded-2xl object-cover shrink-0"
              alt="Livre"
            />
            <div className="flex-1 py-1 flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-bold text-foreground leading-snug line-clamp-1">
                    L'Empire du Dahomey
                  </h3>
                  <p className="text-[10px] text-muted-foreground font-medium">Livre Physique</p>
                </div>
                <button className="text-destructive">
                  <Icon icon="lucide:trash-2" width={16} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 bg-muted/50 rounded-lg px-2 py-1">
                  <button className="text-muted-foreground">
                    <Icon icon="lucide:minus" width={14} />
                  </button>
                  <span className="text-xs font-extrabold">1</span>
                  <button className="text-primary">
                    <Icon icon="lucide:plus" width={14} />
                  </button>
                </div>
                <span className="text-sm font-extrabold text-[#00643C]">15 000 FCFA</span>
              </div>
            </div>
          </div>
          <div className="flex gap-4 bg-white border border-border/60 rounded-[1.5rem] p-4 shadow-sm">
            <div className="w-20 h-20 rounded-2xl bg-primary/5 flex items-center justify-center shrink-0">
              <Icon icon="lucide:file-text" className="text-primary" width={32} />
            </div>
            <div className="flex-1 py-1 flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-bold text-foreground leading-snug line-clamp-1">
                    Guide Immobilier
                  </h3>
                  <p className="text-[10px] text-muted-foreground font-medium">E-book (PDF)</p>
                </div>
                <button className="text-destructive">
                  <Icon icon="lucide:trash-2" width={16} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 bg-muted/50 rounded-lg px-2 py-1 opacity-50">
                  <button className="text-muted-foreground">
                    <Icon icon="lucide:minus" width={14} />
                  </button>
                  <span className="text-xs font-extrabold">1</span>
                  <button className="text-primary">
                    <Icon icon="lucide:plus" width={14} />
                  </button>
                </div>
                <span className="text-sm font-extrabold text-[#00643C]">8 500 FCFA</span>
              </div>
            </div>
          </div>
        </div>
        <section className="bg-muted/30 rounded-3xl p-6 mt-4">
          <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4">
            Récapitulatif
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm font-medium text-muted-foreground">
              <span>Sous-total</span>
              <span className="text-foreground">23 500 FCFA</span>
            </div>
            <div className="flex justify-between text-sm font-medium text-muted-foreground">
              <span>Livraison</span>
              <span className="text-foreground">2 000 FCFA</span>
            </div>
            <div className="h-px bg-border/60 my-2" />
            <div className="flex justify-between text-base font-extrabold text-foreground">
              <span>Total</span>
              <span className="text-[#00643C]">25 500 FCFA</span>
            </div>
          </div>
        </section>
      </main>
      <div className="px-6 py-6 border-t border-border/40 bg-white pb-safe shadow-[0_-8px_32px_rgba(60,60,60,0.04)]">
        <button className="w-full bg-primary text-white py-5 rounded-2xl font-bold text-base shadow-[0_8px_20px_-6px_rgba(0,135,81,0.4)] active:scale-[0.97] transition-all flex items-center justify-center gap-3">
          Passer au paiement <Icon icon="lucide:arrow-right" width={20} />
        </button>
      </div>
    </div>
  );
}
