import { Icon } from "@iconify/react";

export function Connexion() {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <div className="flex h-1.5 w-full">
        <div className="flex-1 bg-primary" />
        <div className="flex-1 bg-secondary" />
        <div className="flex-1 bg-destructive" />
      </div>
      <header className="px-6 py-12">
        <button className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-foreground mb-8 active:scale-90 transition-transform">
          <Icon icon="lucide:chevron-left" width={24} height={24} />
        </button>
        <h1 className="text-3xl font-extrabold font-heading tracking-tight mb-2">Bon retour.</h1>
        <p className="text-muted-foreground font-medium">
          Connectez-vous pour suivre votre dossier.
        </p>
      </header>
      <main className="px-6 space-y-6">
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1 mb-2 block">
              Adresse Email
            </label>
            <div className="relative flex items-center bg-muted/50 border border-border/60 rounded-2xl p-4 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
              <Icon icon="lucide:mail" className="text-muted-foreground mr-3" width={20} />
              <input
                type="email"
                placeholder="nom@exemple.com"
                className="bg-transparent border-none outline-none flex-1 text-sm font-medium"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1 mb-2 block">
              Mot de passe
            </label>
            <div className="relative flex items-center bg-muted/50 border border-border/60 rounded-2xl p-4 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
              <Icon icon="lucide:lock" className="text-muted-foreground mr-3" width={20} />
              <input
                type="password"
                placeholder="••••••••"
                className="bg-transparent border-none outline-none flex-1 text-sm font-medium"
              />
              <button className="text-muted-foreground">
                <Icon icon="lucide:eye" width={20} />
              </button>
            </div>
            <div className="text-right mt-3">
              <a href="#" className="text-xs font-bold text-primary">
                Mot de passe oublié ?
              </a>
            </div>
          </div>
        </div>
        <button className="w-full bg-primary text-white py-5 rounded-2xl font-bold text-base shadow-[0_8px_20px_-6px_rgba(0,135,81,0.4)] active:scale-[0.97] transition-all">
          Se connecter
        </button>
        <div className="flex items-center justify-center gap-2 pt-4">
          <p className="text-sm font-medium text-muted-foreground">Pas encore de compte ?</p>
          <a href="#" className="text-sm font-bold text-primary">
            S'inscrire
          </a>
        </div>
      </main>
    </div>
  );
}
