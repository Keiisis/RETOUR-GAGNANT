import { Icon } from "@iconify/react";

export function Événements() {
  return (
    <div className="min-h-screen bg-background pb-32 font-sans text-foreground">
      <div className="flex h-1.5 w-full sticky top-0 z-50">
        <div className="flex-1 bg-primary" />
        <div className="flex-1 bg-secondary" />
        <div className="flex-1 bg-destructive" />
      </div>
      <header className="px-6 py-6 flex flex-col gap-4">
        <h1 className="text-2xl font-extrabold font-heading tracking-tight">La Communauté</h1>
        <div className="flex gap-2 bg-muted/50 p-1 rounded-2xl">
          <button className="flex-1 bg-white text-foreground py-2 rounded-xl text-xs font-bold shadow-sm">
            À venir
          </button>
          <button className="flex-1 text-muted-foreground py-2 rounded-xl text-xs font-bold active:opacity-60">
            Mes tickets
          </button>
          <button className="flex-1 text-muted-foreground py-2 rounded-xl text-xs font-bold active:opacity-60">
            Archives
          </button>
        </div>
      </header>
      <main className="px-6 space-y-6">
        <div className="bg-white border border-border/60 rounded-[2rem] overflow-hidden shadow-[0_12px_32px_-8px_rgba(60,60,60,0.06)] active:scale-[0.98] transition-all">
          <div className="h-48 w-full relative">
            <img
              src="https://ggrhecslgdflloszjkwl.supabase.co/storage/v1/object/public/user-assets/YoYrfLsdtLI/components/pdBBQnBnI3y.jpeg"
              className="w-full h-full object-cover"
              alt="Event"
            />
            <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-2xl flex flex-col items-center shadow-lg">
              <span className="text-[10px] font-bold text-primary uppercase">Juin</span>
              <span className="text-lg font-extrabold text-foreground leading-none">24</span>
            </div>
            <div className="absolute bottom-4 right-4 bg-primary text-white text-[10px] font-extrabold px-3 py-1.5 rounded-full uppercase tracking-widest shadow-lg">
              Premium
            </div>
          </div>
          <div className="p-6">
            <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
              <Icon icon="lucide:map-pin" className="text-primary" /> Cotonou • Palais des Congrès
            </div>
            <h3 className="text-xl font-extrabold text-foreground tracking-tight mb-3">
              Soirée de Gala : La Nuit du Retour
            </h3>
            <p className="text-sm text-muted-foreground font-medium mb-6 leading-relaxed">
              Une rencontre exclusive entre entrepreneurs de la diaspora et investisseurs locaux
              pour bâtir le Bénin de demain.
            </p>
            <div className="flex items-center justify-between">
              <div className="flex -space-x-2">
                <img
                  src="https://randomuser.me/api/portraits/men/32.jpg"
                  className="w-8 h-8 rounded-full border-2 border-white object-cover"
                />
                <img
                  src="https://randomuser.me/api/portraits/women/45.jpg"
                  className="w-8 h-8 rounded-full border-2 border-white object-cover"
                />
                <img
                  src="https://randomuser.me/api/portraits/men/12.jpg"
                  className="w-8 h-8 rounded-full border-2 border-white object-cover"
                />
                <div className="w-8 h-8 rounded-full bg-muted border-2 border-white flex items-center justify-center text-[10px] font-bold">
                  +12
                </div>
              </div>
              <button className="bg-primary text-white px-6 py-2.5 rounded-full font-bold text-xs shadow-md active:scale-95 transition-all">
                Réserver ma place
              </button>
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
            <a href="#" className="flex flex-col items-center group relative w-10">
              <Icon icon="lucide:calendar-days" className="text-primary" width={22} height={22} />
              <span className="absolute -bottom-2.5 w-1 h-1 bg-primary rounded-full" />
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
