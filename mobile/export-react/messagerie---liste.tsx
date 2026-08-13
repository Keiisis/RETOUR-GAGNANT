import { Icon } from "@iconify/react";

export function MessagerieListe() {
  return (
    <div className="min-h-screen bg-background pb-32 font-sans text-foreground">
      <div className="flex h-1.5 w-full sticky top-0 z-50">
        <div className="flex-1 bg-primary" />
        <div className="flex-1 bg-secondary" />
        <div className="flex-1 bg-destructive" />
      </div>
      <header className="px-6 py-6 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold font-heading tracking-tight">Messages</h1>
        <button className="w-12 h-12 bg-primary text-white rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform">
          <Icon icon="lucide:plus" width={24} />
        </button>
      </header>
      <main className="px-6 space-y-4">
        <div className="relative flex items-center bg-muted/50 border border-border/40 rounded-full p-1.5 pl-5 mb-6">
          <Icon icon="lucide:search" className="text-muted-foreground" width={20} height={20} />
          <input
            type="text"
            className="bg-transparent border-none outline-none flex-1 px-3 text-sm font-medium placeholder:text-muted-foreground"
            placeholder="Rechercher une discussion..."
          />
        </div>
        <div className="space-y-2">
          <a
            href="#"
            className="flex items-center gap-4 p-4 bg-white border border-border/60 rounded-3xl shadow-sm active:bg-muted/20 transition-all"
          >
            <div className="relative">
              <img
                src="https://randomuser.me/api/portraits/women/44.jpg"
                className="w-16 h-16 rounded-[1.25rem] object-cover"
                alt="Amina"
              />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full border-2 border-white" />
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-bold text-foreground truncate">Amina Moussa</h3>
                <span className="text-[10px] font-medium text-muted-foreground">14:22</span>
              </div>
              <p className="text-xs text-foreground font-bold truncate">
                Bonjour Jean-Baptiste, j'ai bien reçu votre acte de naissance...
              </p>
            </div>
            <div className="w-2 h-2 bg-primary rounded-full shrink-0" />
          </a>
          <a
            href="#"
            className="flex items-center gap-4 p-4 bg-white border border-border/60 rounded-3xl shadow-sm active:bg-muted/20 transition-all"
          >
            <div className="relative">
              <div className="w-16 h-16 rounded-[1.25rem] bg-secondary/20 flex items-center justify-center text-secondary-foreground">
                <Icon icon="lucide:users" width={28} />
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-bold text-foreground truncate">
                  Groupe Accompagnement Foncier
                </h3>
                <span className="text-[10px] font-medium text-muted-foreground">Hier</span>
              </div>
              <p className="text-xs text-muted-foreground font-medium truncate">
                Marc: Le géomètre est sur place à Ouidah.
              </p>
            </div>
          </a>
          <a
            href="#"
            className="flex items-center gap-4 p-4 bg-white border border-border/60 rounded-3xl shadow-sm active:bg-muted/20 transition-all"
          >
            <div className="relative">
              <img
                src="https://randomuser.me/api/portraits/men/32.jpg"
                className="w-16 h-16 rounded-[1.25rem] object-cover opacity-60"
                alt="Luc"
              />
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-bold text-foreground truncate">Luc H. (Notaire)</h3>
                <span className="text-[10px] font-medium text-muted-foreground">Mar.</span>
              </div>
              <p className="text-xs text-muted-foreground font-medium truncate">
                Le contrat de vente a été signé électroniquement.
              </p>
            </div>
          </a>
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
              <Icon icon="lucide:message-circle" className="text-primary" width={22} height={22} />
              <span className="absolute -bottom-2.5 w-1 h-1 bg-primary rounded-full" />
              <span className="absolute -top-0.5 right-1 w-2.5 h-2.5 bg-destructive rounded-full border-2 border-[#3C3C3C]" />
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
