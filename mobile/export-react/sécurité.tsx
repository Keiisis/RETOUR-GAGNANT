import { Icon } from "@iconify/react";

export function Sécurité() {
  return (
    <div className="min-h-screen bg-background pb-32 font-sans text-foreground">
      <div className="flex h-1.5 w-full sticky top-0 z-50">
        <div className="flex-1 bg-primary" />
        <div className="flex-1 bg-secondary" />
        <div className="flex-1 bg-destructive" />
      </div>
      <header className="px-6 py-6 flex items-center gap-4 border-b border-border/40 bg-white sticky top-1.5 z-40">
        <button className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-foreground active:scale-90 transition-transform">
          <Icon icon="lucide:chevron-left" width={24} height={24} />
        </button>
        <h1 className="text-xl font-extrabold font-heading tracking-tight">Sécurité</h1>
      </header>
      <main className="px-6 py-8 space-y-8 overflow-y-auto">
        <section>
          <div>
            <label className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] ml-1 mb-4 block">
              Accès
            </label>
            <div className="bg-white border border-border/60 rounded-[2rem] overflow-hidden shadow-sm">
              <a
                href="#"
                className="flex items-center gap-4 p-5 active:bg-muted/30 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                  <Icon icon="lucide:lock" className="text-foreground" width={20} />
                </div>
                <div className="flex-1 font-bold text-sm text-foreground">
                  Changer le mot de passe
                </div>
                <Icon icon="lucide:chevron-right" className="text-muted-foreground" width={20} />
              </a>
              <div className="h-px bg-border/40 mx-5" />
              <div className="flex items-center gap-4 p-5">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                  <Icon icon="lucide:fingerprint" className="text-foreground" width={20} />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-sm text-foreground">FaceID / TouchID</h4>
                  <p className="text-[10px] text-muted-foreground font-medium">
                    Connexion rapide activée
                  </p>
                </div>
                <div className="w-10 h-6 bg-primary rounded-full relative p-1">
                  <div className="w-4 h-4 bg-white rounded-full absolute right-1" />
                </div>
              </div>
            </div>
          </div>
        </section>
        <section>
          <div>
            <label className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] ml-1 mb-4 block">
              Confidentialité
            </label>
            <div className="bg-white border border-border/60 rounded-[2rem] overflow-hidden shadow-sm">
              <div className="flex items-center gap-4 p-5">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                  <Icon icon="lucide:shield-check" className="text-foreground" width={20} />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-sm text-foreground">
                    Double authentification (2FA)
                  </h4>
                  <p className="text-[10px] text-muted-foreground font-medium">
                    Recommandé pour votre dossier
                  </p>
                </div>
                <div className="w-10 h-6 bg-border rounded-full relative p-1 transition-colors">
                  <div className="w-4 h-4 bg-white rounded-full absolute left-1" />
                </div>
              </div>
            </div>
          </div>
        </section>
        <section>
          <div>
            <label className="text-[10px] font-bold text-destructive uppercase tracking-[0.2em] ml-1 mb-4 block">
              Zone de danger
            </label>
            <button className="w-full flex items-center justify-between p-5 bg-destructive/5 border border-destructive/10 rounded-[2rem] active:bg-destructive/10 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                  <Icon icon="lucide:trash-2" className="text-destructive" width={20} />
                </div>
                <div className="text-left">
                  <h4 className="font-bold text-sm text-destructive">Supprimer mon compte</h4>
                  <p className="text-[10px] text-destructive/60 font-medium">Action irréversible</p>
                </div>
              </div>
              <Icon icon="lucide:chevron-right" className="text-destructive" width={20} />
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
