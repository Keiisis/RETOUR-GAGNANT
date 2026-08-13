import { Icon } from "@iconify/react";

export function DétailÉvénement() {
  return (
    <div className="min-h-screen bg-background pb-32 font-sans text-foreground">
      <div className="flex h-1.5 w-full sticky top-0 z-50">
        <div className="flex-1 bg-primary" />
        <div className="flex-1 bg-secondary" />
        <div className="flex-1 bg-destructive" />
      </div>
      <header className="absolute top-1.5 left-0 w-full px-6 py-6 flex items-center justify-between z-10">
        <button className="w-10 h-10 rounded-full bg-white/90 backdrop-blur shadow-lg flex items-center justify-center text-foreground active:scale-90 transition-transform">
          <Icon icon="lucide:chevron-left" width={24} height={24} />
        </button>
        <button className="w-10 h-10 rounded-full bg-white/90 backdrop-blur shadow-lg flex items-center justify-center text-foreground active:scale-90 transition-transform">
          <Icon icon="lucide:share-2" width={20} height={20} />
        </button>
      </header>
      <main>
        <div className="h-[40vh] w-full relative">
          <img
            src="https://ggrhecslgdflloszjkwl.supabase.co/storage/v1/object/public/user-assets/YoYrfLsdtLI/components/pdBBQnBnI3y.jpeg"
            className="w-full h-full object-cover"
            alt="Event Hero"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
        </div>
        <div className="px-6 -mt-12 relative z-10">
          <div className="bg-white rounded-[2rem] p-8 shadow-[0_20px_40px_-10px_rgba(60,60,60,0.1)] border border-border/40 mb-8">
            <span className="inline-block bg-secondary text-secondary-foreground text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-widest mb-4">
              Gala Communautaire
            </span>
            <h1 className="text-3xl font-extrabold font-heading tracking-tight text-foreground leading-tight mb-6">
              La Nuit du Retour : Bâtir Ensemble
            </h1>
            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                  <Icon icon="lucide:calendar" className="text-primary" width={20} />
                </div>
                <div>
                  <p className="text-sm font-bold">Samedi 24 Juin 2024</p>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase">
                    19:30 — 02:00
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                  <Icon icon="lucide:map-pin" className="text-primary" width={20} />
                </div>
                <div>
                  <p className="text-sm font-bold">Palais des Congrès, Cotonou</p>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase">
                    Zone Résidentielle
                  </p>
                </div>
              </div>
            </div>
            <div className="h-px bg-border/40 mb-6" />
            <h3 className="text-sm font-bold text-foreground mb-3">À propos de l'événement</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Une soirée exceptionnelle dédiée à la diaspora afro-descendante. Au programme :
              networking de haut niveau, dîner gastronomique béninois, et présentation des projets
              structurants pour le pays. Les places sont limitées pour garantir la qualité des
              échanges.
            </p>
          </div>
          <div className="space-y-6">
            <h3 className="text-sm font-bold text-primary uppercase tracking-[0.2em] ml-2">
              Billetterie
            </h3>
            <div className="bg-white border-2 border-primary rounded-3xl p-5 shadow-md flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center shrink-0">
                  <Icon icon="lucide:ticket" className="text-primary" width={24} />
                </div>
                <div>
                  <h4 className="text-sm font-bold">Pass Standard</h4>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase">
                    Accès Buffet + Networking
                  </p>
                </div>
              </div>
              <div className="text-right font-extrabold text-[#00643C]">50 000 FCFA</div>
            </div>
            <div className="bg-white border border-border rounded-3xl p-5 shadow-sm flex items-center justify-between opacity-60">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-secondary/10 flex items-center justify-center shrink-0">
                  <Icon icon="lucide:crown" className="text-secondary-foreground" width={24} />
                </div>
                <div>
                  <h4 className="text-sm font-bold">Pass VIP</h4>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase">
                    Table réservée + After
                  </p>
                </div>
              </div>
              <div className="text-right font-extrabold text-[#00643C]">150 000 FCFA</div>
            </div>
          </div>
        </div>
      </main>
      <div className="fixed bottom-0 left-0 w-full bg-white border-t border-border/50 px-6 py-4 flex items-center justify-between z-40 pb-safe shadow-[0_-8px_32px_rgba(60,60,60,0.04)]">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            Total
          </span>
          <span className="text-xl font-extrabold text-[#00643C]">50 000 FCFA</span>
        </div>
        <button className="bg-primary text-white px-8 py-3.5 rounded-full font-bold text-sm shadow-[0_8px_20px_-6px_rgba(0,135,81,0.4)] active:scale-95 transition-all">
          Prendre mon ticket
        </button>
      </div>
    </div>
  );
}
