import { Icon } from "@iconify/react";

export function SignatureÉlectronique() {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground flex flex-col">
      <div className="flex h-1.5 w-full sticky top-0 z-50">
        <div className="flex-1 bg-primary" />
        <div className="flex-1 bg-secondary" />
        <div className="flex-1 bg-destructive" />
      </div>
      <header className="px-6 py-6 flex items-center gap-4 bg-white/80 backdrop-blur-md sticky top-1.5 z-40">
        <button className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-foreground active:scale-90 transition-transform">
          <Icon icon="lucide:chevron-left" width={24} height={24} />
        </button>
        <h1 className="text-xl font-extrabold font-heading tracking-tight">Signature</h1>
      </header>
      <main className="flex-1 px-6 py-6 space-y-8 overflow-y-auto">
        <div className="bg-white border border-border/60 rounded-3xl p-2 shadow-sm relative overflow-hidden h-[400px]">
          <img
            src="https://ggrhecslgdflloszjkwl.supabase.co/storage/v1/object/public/user-assets/YoYrfLsdtLI/components/zRBphN16D1Y.jpeg"
            className="w-full h-full object-cover opacity-20"
            alt="Document Background"
          />
          <div className="absolute inset-0 p-8 overflow-y-auto">
            <h3 className="text-base font-bold text-foreground mb-4">Mandat de Représentation</h3>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4">
              Je soussigné Jean-Baptiste DUPONT, né le 12/04/1985 à Paris, donne par la présente
              plein pouvoir au cabinet Retour Gagnant Bénin pour effectuer en mon nom les démarches
              de reconnaissance de nationalité auprès des autorités compétentes de la République du
              Bénin...
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4">
              Ce mandat inclut la transmission des pièces justificatives, le suivi administratif et
              le retrait des certificats officiels.
            </p>
            <div className="h-24 w-full border-b border-dashed border-primary/40 flex items-center justify-center text-muted-foreground italic text-[10px]">
              Zone de signature ci-dessous
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] ml-1 mb-4 block">
              Votre Signature
            </label>
            <div className="w-full h-48 bg-muted/40 border-2 border-dashed border-border/60 rounded-3xl relative flex items-center justify-center group active:border-primary/40 transition-all">
              <Icon
                icon="lucide:pencil"
                className="text-muted-foreground group-active:text-primary"
                width={32}
              />
              <span className="text-[10px] font-bold text-muted-foreground uppercase absolute bottom-4">
                Signez avec votre doigt
              </span>
              <svg className="absolute inset-0 w-full h-full">
                <path
                  d="M 50 100 Q 80 80 120 120 T 200 100"
                  stroke="#008751"
                  stroke-width={3}
                  fill="none"
                  opacity={0.6}
                />
              </svg>
            </div>
            <div className="flex justify-end mt-2">
              <button className="text-xs font-bold text-destructive flex items-center gap-1.5">
                <Icon icon="lucide:rotate-ccw" width={14} /> Effacer
              </button>
            </div>
          </div>
        </div>
      </main>
      <div className="px-6 py-6 border-t border-border/40 bg-white pb-safe">
        <button className="w-full bg-primary text-white py-5 rounded-2xl font-bold text-base shadow-[0_8px_20px_-6px_rgba(0,135,81,0.4)] active:scale-[0.97] transition-all">
          Valider la signature
        </button>
      </div>
    </div>
  );
}
