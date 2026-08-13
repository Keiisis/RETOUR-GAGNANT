import { Icon } from "@iconify/react";

export function Inscription() {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <div className="flex h-1.5 w-full">
        <div className="flex-1 bg-primary" />
        <div className="flex-1 bg-secondary" />
        <div className="flex-1 bg-destructive" />
      </div>
      <header className="px-6 py-10">
        <button className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-foreground mb-6 active:scale-90 transition-transform">
          <Icon icon="lucide:chevron-left" width={24} height={24} />
        </button>
        <h1 className="text-3xl font-extrabold font-heading tracking-tight mb-2">
          Rejoignez-nous.
        </h1>
        <p className="text-muted-foreground font-medium">
          Commencez votre projet de retour dès aujourd'hui.
        </p>
      </header>
      <main className="px-6 pb-12 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1 mb-2 block">
              Prénom
            </label>
            <div className="relative flex items-center bg-muted/50 border border-border/60 rounded-2xl p-4 focus-within:border-primary transition-all">
              <input
                type="text"
                placeholder="Jean"
                className="bg-transparent border-none outline-none w-full text-sm font-medium"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1 mb-2 block">
              Nom
            </label>
            <div className="relative flex items-center bg-muted/50 border border-border/60 rounded-2xl p-4 focus-within:border-primary transition-all">
              <input
                type="text"
                placeholder="Baptiste"
                className="bg-transparent border-none outline-none w-full text-sm font-medium"
              />
            </div>
          </div>
        </div>
        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1 mb-2 block">
            Adresse Email
          </label>
          <div className="relative flex items-center bg-muted/50 border border-border/60 rounded-2xl p-4 focus-within:border-primary transition-all">
            <input
              type="email"
              placeholder="jean.b@exemple.com"
              className="bg-transparent border-none outline-none w-full text-sm font-medium"
            />
          </div>
        </div>
        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1 mb-2 block">
            Téléphone (WhatsApp)
          </label>
          <div className="relative flex items-center bg-muted/50 border border-border/60 rounded-2xl p-4 focus-within:border-primary transition-all">
            <span className="text-sm font-bold text-muted-foreground mr-2">+33</span>
            <input
              type="tel"
              placeholder="6 12 34 56 78"
              className="bg-transparent border-none outline-none flex-1 text-sm font-medium"
            />
          </div>
        </div>
        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1 mb-2 block">
            Mot de passe
          </label>
          <div className="relative flex items-center bg-muted/50 border border-border/60 rounded-2xl p-4 focus-within:border-primary transition-all">
            <input
              type="password"
              placeholder="••••••••"
              className="bg-transparent border-none outline-none flex-1 text-sm font-medium"
            />
            <button className="text-muted-foreground">
              <Icon icon="lucide:eye" width={20} />
            </button>
          </div>
        </div>
        <div className="flex items-start gap-3 pt-2">
          <div className="w-5 h-5 border-2 border-primary rounded-md flex items-center justify-center shrink-0 mt-0.5">
            <Icon icon="lucide:check" className="text-primary" width={14} />
          </div>
          <p className="text-xs text-muted-foreground font-medium leading-relaxed">
            J'accepte les{" "}
            <a href="#" className="text-primary font-bold">
              Conditions Générales d'Utilisation
            </a>{" "}
            et la politique de confidentialité.
          </p>
        </div>
        <button className="w-full bg-primary text-white py-5 rounded-2xl font-bold text-base shadow-[0_8px_20px_-6px_rgba(0,135,81,0.4)] active:scale-[0.97] transition-all">
          Créer mon compte
        </button>
      </main>
    </div>
  );
}
