import { Icon } from "@iconify/react";

export function Boutique() {
  return (
    <div className="min-h-screen bg-background pb-32 font-sans text-foreground">
      <div className="flex h-1.5 w-full">
        <div className="flex-1 bg-primary" />
        <div className="flex-1 bg-secondary" />
        <div className="flex-1 bg-destructive" />
      </div>
      <header className="px-6 py-6 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold font-heading tracking-tight">Ressources</h1>
        <button className="relative w-12 h-12 bg-white border border-border/50 rounded-full flex items-center justify-center shadow-sm active:scale-95 transition-transform">
          <Icon icon="lucide:shopping-cart" className="text-foreground" width={20} height={20} />
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-white text-[10px] font-extrabold flex items-center justify-center rounded-full border-2 border-white">
            2
          </span>
        </button>
      </header>
      <main className="px-6 space-y-6">
        <div className="relative flex items-center bg-muted/50 border border-border/40 rounded-full p-1.5 pl-5">
          <Icon icon="lucide:search" className="text-muted-foreground" width={20} height={20} />
          <input
            type="text"
            className="bg-transparent border-none outline-none flex-1 px-3 text-sm font-medium placeholder:text-muted-foreground"
            placeholder="Rechercher un produit..."
          />
        </div>
        <div className="flex gap-2 overflow-x-auto -mx-6 px-6 hide-scrollbar">
          <button className="shrink-0 bg-primary text-white px-5 py-2 rounded-full text-xs font-bold shadow-md">
            Tous
          </button>
          <button className="shrink-0 bg-white border border-border px-5 py-2 rounded-full text-xs font-bold text-muted-foreground">
            Livres
          </button>
          <button className="shrink-0 bg-white border border-border px-5 py-2 rounded-full text-xs font-bold text-muted-foreground">
            Artisanat
          </button>
          <button className="shrink-0 bg-white border border-border px-5 py-2 rounded-full text-xs font-bold text-muted-foreground">
            Guides
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white border border-border/60 rounded-[1.5rem] overflow-hidden shadow-sm active:scale-[0.98] transition-all">
            <div className="aspect-square relative">
              <img
                src="https://ggrhecslgdflloszjkwl.supabase.co/storage/v1/object/public/user-assets/YoYrfLsdtLI/components/qgtS9F9faHM.jpeg"
                className="w-full h-full object-cover"
                alt="Livre Histoire"
              />
              <button className="absolute top-2 right-2 w-8 h-8 bg-white/90 backdrop-blur rounded-full flex items-center justify-center text-foreground shadow-sm">
                <Icon icon="lucide:heart" width={16} />
              </button>
            </div>
            <div className="p-4">
              <h3 className="text-sm font-bold text-foreground leading-snug mb-1 line-clamp-2">
                L'Empire du Dahomey : Histoire & Héritage
              </h3>
              <p className="text-[10px] text-muted-foreground font-medium mb-3">
                Édition Collector
              </p>
              <div className="flex items-center justify-between">
                <span className="text-sm font-extrabold text-[#00643C]">15 000 FCFA</span>
                <button className="w-8 h-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center">
                  <Icon icon="lucide:plus" width={18} />
                </button>
              </div>
            </div>
          </div>
          <div className="bg-white border border-border/60 rounded-[1.5rem] overflow-hidden shadow-sm active:scale-[0.98] transition-all">
            <div className="aspect-square relative">
              <img
                src="https://ggrhecslgdflloszjkwl.supabase.co/storage/v1/object/public/user-assets/YoYrfLsdtLI/components/Ji2y3kggzR7.jpeg"
                className="w-full h-full object-cover"
                alt="Guide Immobilier"
              />
              <button className="absolute top-2 right-2 w-8 h-8 bg-white/90 backdrop-blur rounded-full flex items-center justify-center text-foreground shadow-sm">
                <Icon icon="lucide:heart" width={16} />
              </button>
            </div>
            <div className="p-4">
              <h3 className="text-sm font-bold text-foreground leading-snug mb-1 line-clamp-2">
                Guide Pratique de l'Immobilier au Bénin
              </h3>
              <p className="text-[10px] text-muted-foreground font-medium mb-3">E-book (PDF)</p>
              <div className="flex items-center justify-between">
                <span className="text-sm font-extrabold text-[#00643C]">8 500 FCFA</span>
                <button className="w-8 h-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center">
                  <Icon icon="lucide:plus" width={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[350px] bg-[#3C3C3C] rounded-full px-7 py-4 shadow-[0_20px_40px_-10px_rgba(60,60,60,0.4)] z-50 border border-white/5">
        <ul className="flex justify-between items-center w-full">
          <li>
            <a href="#" className="flex flex-col items-center group w-10">
              <Icon icon="lucide:home" className="text-white/40" width={22} height={22} />
            </a>
          </li>
          <li>
            <a href="#" className="flex flex-col items-center group w-10">
              <Icon icon="lucide:folder" className="text-white/40" width={22} height={22} />
            </a>
          </li>
          <li>
            <a href="#" className="flex flex-col items-center group w-10">
              <Icon icon="lucide:grid" className="text-white/40" width={22} height={22} />
            </a>
          </li>
          <li>
            <a href="#" className="flex flex-col items-center group w-10">
              <Icon icon="lucide:calendar-days" className="text-white/40" width={22} height={22} />
            </a>
          </li>
          <li>
            <a href="#" className="flex flex-col items-center group relative w-10">
              <Icon icon="lucide:message-circle" className="text-white/40" width={22} height={22} />
            </a>
          </li>
          <li>
            <a href="#" className="flex flex-col items-center group w-10">
              <Icon icon="lucide:user" className="text-white/40" width={22} height={22} />
            </a>
          </li>
        </ul>
      </nav>
    </div>
  );
}
