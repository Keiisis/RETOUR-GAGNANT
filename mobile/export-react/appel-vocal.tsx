import { Icon } from "@iconify/react";

export function AppelVocal() {
  return (
    <div className="min-h-screen bg-foreground font-sans text-white flex flex-col items-center justify-between py-24 px-8">
      <div className="flex flex-col items-center">
        <div className="w-32 h-32 rounded-[2.5rem] bg-white/10 p-1 mb-8 ring-4 ring-primary/20">
          <img
            src="https://randomuser.me/api/portraits/women/44.jpg"
            className="w-full h-full rounded-[2.2rem] object-cover"
            alt="Amina"
          />
        </div>
        <h2 className="text-2xl font-extrabold font-heading tracking-tight mb-2">Amina Moussa</h2>
        <p className="text-sm font-bold text-primary uppercase tracking-widest mb-1">
          Appel en cours
        </p>
        <p className="text-sm font-medium text-white/60">02:45</p>
      </div>
      <div className="grid grid-cols-3 gap-8 w-full max-w-xs">
        <div className="flex flex-col items-center gap-3">
          <button className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-white active:bg-white/20 transition-colors">
            <Icon icon="lucide:mic-off" width={24} />
          </button>
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">
            Muet
          </span>
        </div>
        <div className="flex flex-col items-center gap-3">
          <button className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-white active:bg-white/20 transition-colors">
            <Icon icon="lucide:volume-2" width={24} />
          </button>
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">
            Haut-parleur
          </span>
        </div>
        <div className="flex flex-col items-center gap-3">
          <button className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-white active:bg-white/20 transition-colors">
            <Icon icon="lucide:message-square" width={24} />
          </button>
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">
            Message
          </span>
        </div>
      </div>
      <div className="w-full">
        <button className="w-full h-20 rounded-full bg-destructive flex items-center justify-center text-white shadow-2xl active:scale-95 transition-all">
          <Icon icon="lucide:phone-off" width={32} />
        </button>
      </div>
    </div>
  );
}
