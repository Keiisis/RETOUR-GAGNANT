import { Icon } from "@iconify/react";

export function MessagerieFil() {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground flex flex-col">
      <div className="flex h-1.5 w-full sticky top-0 z-50">
        <div className="flex-1 bg-primary" />
        <div className="flex-1 bg-secondary" />
        <div className="flex-1 bg-destructive" />
      </div>
      <header className="px-6 py-4 border-b border-border/40 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-1.5 z-40">
        <div className="flex items-center gap-3">
          <button className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-foreground active:scale-90 transition-transform">
            <Icon icon="lucide:chevron-left" width={20} />
          </button>
          <div className="relative">
            <img
              src="https://randomuser.me/api/portraits/women/44.jpg"
              className="w-10 h-10 rounded-xl object-cover"
              alt="Amina"
            />
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-primary rounded-full border-2 border-white" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-foreground leading-none mb-1">
              Amina Moussa
            </h2>
            <p className="text-[10px] font-bold text-primary uppercase">En ligne</p>
          </div>
        </div>
        <button className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-foreground active:scale-90 transition-transform">
          <Icon icon="lucide:phone" width={18} />
        </button>
      </header>
      <main className="flex-1 px-6 py-8 space-y-6 overflow-y-auto">
        <div className="flex justify-center">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest bg-muted/60 px-3 py-1 rounded-full">
            Aujourd'hui
          </span>
        </div>
        <div className="flex flex-col items-start max-w-[80%]">
          <div className="bg-muted/40 p-4 rounded-2xl rounded-tl-none border border-border/40">
            <p className="text-sm font-medium leading-relaxed">
              Bonjour Jean-Baptiste ! J'ai bien reçu votre acte de naissance. Nos équipes le
              vérifient actuellement.
            </p>
          </div>
          <span className="text-[9px] font-bold text-muted-foreground mt-1.5 ml-1">10:45</span>
        </div>
        <div className="flex flex-col items-end self-end max-w-[80%]">
          <div className="bg-primary p-4 rounded-2xl rounded-tr-none shadow-lg shadow-green-900/10">
            <p className="text-sm font-medium text-white leading-relaxed">
              Super news ! Quel est le délai estimé pour cette étape ?
            </p>
          </div>
          <div className="flex items-center gap-1 mt-1.5 mr-1">
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
              10:52
            </span>
            <Icon icon="lucide:check-check" className="text-primary" width={12} />
          </div>
        </div>
        <div className="flex flex-col items-start max-w-[80%]">
          <div className="bg-muted/40 p-4 rounded-2xl rounded-tl-none border border-border/40">
            <p className="text-sm font-medium leading-relaxed">
              Comptez environ 48h. Je reviens vers vous dès que c'est validé pour passer à l'étape
              suivante (Transmission aux autorités).
            </p>
          </div>
          <span className="text-[9px] font-bold text-muted-foreground mt-1.5 ml-1">10:55</span>
        </div>
      </main>
      <div className="px-6 py-4 border-t border-border/40 bg-white pb-safe">
        <div className="flex items-center gap-3 bg-muted/30 p-2 rounded-2xl">
          <button className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-white active:scale-95 transition-all">
            <Icon icon="lucide:paperclip" width={20} />
          </button>
          <input
            type="text"
            placeholder="Votre message..."
            className="bg-transparent border-none outline-none flex-1 text-sm font-medium py-2 px-1"
          />
          <button className="w-10 h-10 bg-primary text-white rounded-xl flex items-center justify-center shadow-md active:scale-95 transition-transform">
            <Icon icon="lucide:send" width={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
