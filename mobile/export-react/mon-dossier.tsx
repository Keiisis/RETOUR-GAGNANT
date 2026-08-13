import { Icon } from "@iconify/react";

export function MonDossier() {
  return (
    <div className="min-h-screen bg-background pb-32 font-sans text-foreground">
      <div className="flex h-1.5 w-full">
        <div className="flex-1 bg-primary" />
        <div className="flex-1 bg-secondary" />
        <div className="flex-1 bg-destructive" />
      </div>
      <header className="px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-foreground active:scale-90 transition-transform">
            <Icon icon="lucide:chevron-left" className="size-6" />
          </button>
          <h1 className="text-xl font-extrabold font-heading tracking-tight">Mon dossier</h1>
        </div>
        <button className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-foreground active:scale-90 transition-transform">
          <Icon icon="lucide:share-2" className="size-5" />
        </button>
      </header>
      <main className="px-6 space-y-8">
        <div className="bg-white border border-border/60 rounded-[2rem] overflow-hidden shadow-[0_12px_32px_-8px_rgba(60,60,60,0.06)]">
          <div className="h-32 w-full relative">
            <img
              alt="Dossier header"
              src="https://ggrhecslgdflloszjkwl.supabase.co/storage/v1/object/public/user-assets/YoYrfLsdtLI/components/SACQHn2Bzm4.jpeg"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent" />
            <div className="absolute bottom-4 left-5">
              <span className="bg-primary text-white text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-widest shadow-lg">
                En cours
              </span>
            </div>
          </div>
          <div className="p-6">
            <h2 className="text-xl font-extrabold font-heading tracking-tight mb-2 text-foreground leading-tight">
              Reconnaissance de nationalité béninoise
            </h2>
            <p className="text-sm font-medium text-muted-foreground mb-6">
              Numéro de dossier: #RG-2024-8892
            </p>
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-white">
                    <Icon icon="lucide:check" className="size-4" />
                  </div>
                  <div className="w-0.5 h-full bg-primary mt-1" />
                </div>
                <div className="pb-2">
                  <h4 className="text-sm font-bold text-foreground">Dépôt du dossier</h4>
                  <p className="text-xs font-medium text-muted-foreground">Validé le 12/03/2024</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-white">
                    <Icon icon="lucide:check" className="size-4" />
                  </div>
                  <div className="w-0.5 h-full bg-primary mt-1" />
                </div>
                <div className="pb-2">
                  <h4 className="text-sm font-bold text-foreground">Authentification des actes</h4>
                  <p className="text-xs font-medium text-muted-foreground">Terminé le 18/03/2024</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-6 h-6 rounded-full border-2 border-primary flex items-center justify-center bg-white">
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  </div>
                  <div className="w-0.5 h-full bg-border mt-1" />
                </div>
                <div className="pb-2">
                  <h4 className="text-sm font-bold text-primary">Transmission aux autorités</h4>
                  <p className="text-xs font-medium text-muted-foreground">
                    En cours - Estimation: 7 jours
                  </p>
                </div>
              </div>
              <div className="flex gap-4 opacity-50">
                <div className="flex flex-col items-center">
                  <div className="w-6 h-6 rounded-full border-2 border-border flex items-center justify-center bg-white" />
                </div>
                <div className="pb-2">
                  <h4 className="text-sm font-bold text-foreground">Signature du certificat</h4>
                  <p className="text-xs font-medium text-muted-foreground">Étape finale</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-extrabold font-heading tracking-tight">Pièces déposées</h2>
            <button className="text-sm font-bold text-primary flex items-center gap-1 active:opacity-70">
              <Icon icon="lucide:plus-circle" className="size-4" /> Ajouter
            </button>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-white border border-border/60 rounded-2xl shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-foreground">
                  <Icon icon="lucide:file-text" className="size-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">Acte de naissance</h4>
                  <p className="text-[10px] font-medium text-muted-foreground">PDF • 1.2 Mo</p>
                </div>
              </div>
              <span className="flex items-center gap-1 bg-primary/10 text-primary px-2 py-1 rounded-lg text-[10px] font-bold">
                <Icon icon="lucide:check-circle-2" className="size-3" /> VALIDÉ
              </span>
            </div>
            <div className="flex items-center justify-between p-4 bg-white border border-border/60 rounded-2xl shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-foreground">
                  <Icon icon="lucide:file-text" className="size-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">Certificat aïeul</h4>
                  <p className="text-[10px] font-medium text-muted-foreground">JPG • 2.5 Mo</p>
                </div>
              </div>
              <span className="flex items-center gap-1 bg-secondary/20 text-[#00643C] px-2 py-1 rounded-lg text-[10px] font-bold">
                <Icon icon="lucide:search" className="size-3" /> VÉRIFIÉ
              </span>
            </div>
            <div className="flex items-center justify-between p-4 bg-white border border-border/60 rounded-2xl shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-foreground">
                  <Icon icon="lucide:file-text" className="size-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">Justificatif domicile</h4>
                  <p className="text-[10px] font-medium text-muted-foreground">Manquant</p>
                </div>
              </div>
              <button className="bg-primary text-white text-[10px] font-bold px-3 py-1.5 rounded-full shadow-md active:scale-95 transition-transform">
                TÉLÉVERSER
              </button>
            </div>
          </div>
        </section>
        <section className="bg-[#FBFBFC] rounded-3xl p-6 border border-border/40">
          <h3 className="text-sm font-bold text-foreground mb-4">Votre conseiller dédié</h3>
          <div className="flex items-center gap-4 mb-4">
            <img
              alt="Amina"
              src="https://randomuser.me/api/portraits/women/44.jpg"
              className="w-14 h-14 rounded-full border-2 border-white shadow-md object-cover"
            />
            <div>
              <h4 className="text-base font-bold text-foreground">Amina Moussa</h4>
              <p className="text-sm font-medium text-muted-foreground">
                Expert Nationalité & État Civil
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button className="flex items-center justify-center gap-2 bg-white border border-border rounded-xl py-3 text-sm font-bold text-foreground active:scale-95 transition-transform">
              <Icon icon="lucide:message-circle" className="size-4" /> Message
            </button>
            <button className="flex items-center justify-center gap-2 bg-white border border-border rounded-xl py-3 text-sm font-bold text-foreground active:scale-95 transition-transform">
              <Icon icon="lucide:phone" className="size-4" /> Appeler
            </button>
          </div>
        </section>
      </main>
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[350px] bg-foreground rounded-full px-7 py-4 shadow-[0_20px_40px_-10px_rgba(60,60,60,0.4)] z-50 border border-white/5">
        <ul className="flex justify-between items-center w-full">
          <li>
            <a href="#" className="flex flex-col items-center group w-10">
              <Icon icon="lucide:home" className="size-[22px] text-background/40" />
            </a>
          </li>
          <li>
            <a href="#" className="flex flex-col items-center group relative w-10">
              <Icon icon="lucide:folder" className="size-[22px] text-primary" />
              <span className="absolute -bottom-2.5 w-1 h-1 bg-primary rounded-full" />
            </a>
          </li>
          <li>
            <a href="#" className="flex flex-col items-center group w-10">
              <Icon icon="lucide:grid" className="size-[22px] text-background/40" />
            </a>
          </li>
          <li>
            <a href="#" className="flex flex-col items-center group w-10">
              <Icon icon="lucide:calendar-days" className="size-[22px] text-background/40" />
            </a>
          </li>
          <li>
            <a href="#" className="flex flex-col items-center group relative w-10">
              <Icon icon="lucide:message-circle" className="size-[22px] text-background/40" />
            </a>
          </li>
          <li>
            <a href="#" className="flex flex-col items-center group w-10">
              <Icon icon="lucide:user" className="size-[22px] text-background/40" />
            </a>
          </li>
        </ul>
      </nav>
    </div>
  );
}
