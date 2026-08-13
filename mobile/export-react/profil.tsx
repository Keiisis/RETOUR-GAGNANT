import { Icon } from "@iconify/react";

export function Profil() {
  return (
    <div className="min-h-screen bg-background pb-32 font-sans text-foreground">
      <div className="flex h-1.5 w-full sticky top-0 z-50">
        <div className="flex-1 bg-primary" />
        <div className="flex-1 bg-secondary" />
        <div className="flex-1 bg-destructive" />
      </div>
      <header className="px-6 pt-10 pb-6 flex flex-col items-center">
        <div className="relative mb-4">
          <div className="w-28 h-28 rounded-[2.5rem] bg-muted overflow-hidden border-4 border-white shadow-xl">
            <img
              src="https://lh3.googleusercontent.com/a/ACg8ocJ7n8MyFRrJoAd3ZrzA_ygK1xie19cram_sZq0M4lFNmUrQqA=s96-c"
              alt="User Avatar"
              className="w-full h-full object-cover"
            />
          </div>
          <button className="absolute bottom-1 -right-1 w-9 h-9 bg-primary text-white rounded-2xl flex items-center justify-center border-4 border-background shadow-md active:scale-90 transition-transform">
            <Icon icon="lucide:pencil" width={16} />
          </button>
        </div>
        <h2 className="text-2xl font-extrabold font-heading tracking-tight mb-1">agav oubj</h2>
        <p className="text-sm font-medium text-muted-foreground mb-4">
          Membre Premium • Diaspora France
        </p>
        <div className="flex gap-3">
          <div className="bg-white border border-border/60 px-4 py-2 rounded-2xl shadow-sm text-center">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">
              Dossiers
            </p>
            <p className="text-base font-extrabold text-foreground">03</p>
          </div>
          <div className="bg-white border border-border/60 px-4 py-2 rounded-2xl shadow-sm text-center">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">
              Tickets
            </p>
            <p className="text-base font-extrabold text-foreground">01</p>
          </div>
        </div>
      </header>
      <main className="px-6 space-y-8 mt-4">
        <section>
          <div>
            <label className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] ml-1 mb-4 block">
              Général
            </label>
            <div className="bg-white border border-border/60 rounded-[2rem] overflow-hidden shadow-sm">
              <a
                href="#"
                className="flex items-center gap-4 p-5 active:bg-muted/30 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center">
                  <Icon icon="lucide:user" className="text-primary" width={20} />
                </div>
                <div className="flex-1 font-bold text-sm text-foreground">
                  Informations personnelles
                </div>
                <Icon icon="lucide:chevron-right" className="text-muted-foreground" width={20} />
              </a>
              <div className="h-px bg-border/40 mx-5" />
              <a
                href="#"
                className="flex items-center gap-4 p-5 active:bg-muted/30 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center">
                  <Icon icon="lucide:shield-check" className="text-primary" width={20} />
                </div>
                <div className="flex-1 font-bold text-sm text-foreground">
                  Sécurité & Mot de passe
                </div>
                <Icon icon="lucide:chevron-right" className="text-muted-foreground" width={20} />
              </a>
              <div className="h-px bg-border/40 mx-5" />
              <a
                href="#"
                className="flex items-center gap-4 p-5 active:bg-muted/30 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center">
                  <Icon icon="lucide:credit-card" className="text-primary" width={20} />
                </div>
                <div className="flex-1 font-bold text-sm text-foreground">Moyens de paiement</div>
                <Icon icon="lucide:chevron-right" className="text-muted-foreground" width={20} />
              </a>
            </div>
          </div>
        </section>
        <section>
          <div>
            <label className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] ml-1 mb-4 block">
              Documents & Aide
            </label>
            <div className="bg-white border border-border/60 rounded-[2rem] overflow-hidden shadow-sm">
              <a
                href="#"
                className="flex items-center gap-4 p-5 active:bg-muted/30 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center">
                  <Icon icon="lucide:file-text" className="text-primary" width={20} />
                </div>
                <div className="flex-1 font-bold text-sm text-foreground">Mes factures</div>
                <Icon icon="lucide:chevron-right" className="text-muted-foreground" width={20} />
              </a>
              <div className="h-px bg-border/40 mx-5" />
              <a
                href="#"
                className="flex items-center gap-4 p-5 active:bg-muted/30 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center">
                  <Icon icon="lucide:help-circle" className="text-primary" width={20} />
                </div>
                <div className="flex-1 font-bold text-sm text-foreground">Centre d'aide / FAQ</div>
                <Icon icon="lucide:chevron-right" className="text-muted-foreground" width={20} />
              </a>
            </div>
          </div>
        </section>
        <button className="w-full flex items-center justify-center gap-3 py-5 rounded-2xl font-bold text-sm text-destructive bg-destructive/5 border border-destructive/10 active:scale-[0.98] transition-all">
          <Icon icon="lucide:log-out" width={18} /> Se déconnecter
        </button>
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
            <a href="#" className="flex flex-col items-center group relative w-10">
              <Icon icon="lucide:user" className="text-primary" width={22} height={22} />
              <span className="absolute -bottom-2.5 w-1 h-1 bg-primary rounded-full" />
            </a>
          </li>
        </ul>
      </nav>
    </div>
  );
}
