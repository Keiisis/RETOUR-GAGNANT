import { Icon } from "@iconify/react";

export function DétailProduit() {
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
          <Icon icon="lucide:heart" width={20} />
        </button>
      </header>
      <main>
        <div className="h-[50vh] w-full bg-muted/20 relative flex items-center justify-center p-12">
          <img
            src="https://ggrhecslgdflloszjkwl.supabase.co/storage/v1/object/public/user-assets/YoYrfLsdtLI/components/qgtS9F9faHM.jpeg"
            className="w-full h-full object-contain mix-blend-multiply"
            alt="Product Image"
          />
        </div>
        <div className="px-6 py-8 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">
                Littérature & Histoire
              </span>
              <div className="flex items-center gap-1">
                <Icon icon="lucide:star" className="text-secondary" width={14} />
                <span className="text-xs font-bold">4.9 (24 avis)</span>
              </div>
            </div>
            <h1 className="text-3xl font-extrabold font-heading tracking-tight text-foreground leading-tight">
              L'Empire du Dahomey : Histoire & Héritage
            </h1>
            <p className="text-xl font-extrabold text-[#00643C]">15 000 FCFA</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Quantité
              </span>
              <div className="flex items-center gap-4 bg-muted/40 rounded-2xl px-4 py-2">
                <button className="text-muted-foreground">
                  <Icon icon="lucide:minus" width={16} />
                </button>
                <span className="text-sm font-extrabold">1</span>
                <button className="text-primary">
                  <Icon icon="lucide:plus" width={16} />
                </button>
              </div>
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Format
              </span>
              <div className="flex gap-2">
                <button className="flex-1 bg-primary/10 border border-primary text-primary py-2 rounded-xl text-xs font-bold">
                  Broché
                </button>
                <button className="flex-1 bg-white border border-border text-muted-foreground py-2 rounded-xl text-xs font-bold">
                  PDF
                </button>
              </div>
            </div>
          </div>
          <div className="space-y-4 pt-4">
            <h3 className="text-sm font-bold text-foreground">Description</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Plongez dans l'histoire fascinante de l'un des plus puissants royaumes d'Afrique de
              l'Ouest. Ce livre retrace l'ascension politique, les traditions spirituelles et le
              patrimoine architectural du Dahomey, indispensable pour tout afro-descendant en quête
              de ses racines.
            </p>
          </div>
          <div className="bg-muted/30 rounded-3xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shrink-0 shadow-sm">
              <Icon icon="lucide:truck" className="text-primary" width={24} />
            </div>
            <div>
              <p className="text-xs font-bold">Livraison offerte</p>
              <p className="text-[10px] text-muted-foreground">À partir de 50 000 FCFA d'achat.</p>
            </div>
          </div>
        </div>
      </main>
      <div className="fixed bottom-0 left-0 w-full bg-white border-t border-border/50 px-6 py-4 z-40 pb-safe shadow-[0_-8px_32px_rgba(60,60,60,0.04)]">
        <button className="w-full bg-primary text-white py-5 rounded-2xl font-bold text-base shadow-[0_8px_20px_-6px_rgba(0,135,81,0.4)] active:scale-[0.97] transition-all flex items-center justify-center gap-3">
          <Icon icon="lucide:shopping-bag" width={20} /> Ajouter au panier
        </button>
      </div>
    </div>
  );
}
