import { Icon } from "@iconify/react";

export function ConsultationFaRacines() {
  return (
    <div className="min-h-screen bg-background pb-32 font-sans text-foreground">
      <div className="flex h-1.5 w-full">
        <div className="flex-1 bg-primary" />
        <div className="flex-1 bg-secondary" />
        <div className="flex-1 bg-destructive" />
      </div>
      <header className="px-6 py-6 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <button className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-foreground active:scale-90 transition-transform">
            <Icon icon="lucide:chevron-left" width={24} height={24} />
          </button>
          <h1 className="text-xl font-extrabold font-heading tracking-tight">Fa & Racines</h1>
          <button className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-foreground active:scale-90 transition-transform">
            <Icon icon="lucide:search" width={20} height={20} />
          </button>
        </div>
        <div className="mt-4 flex bg-muted/50 p-1.5 rounded-2xl">
          <button className="flex-1 bg-white text-foreground py-2.5 rounded-xl text-sm font-bold shadow-sm">
            Présentiel
          </button>
          <button className="flex-1 text-muted-foreground py-2.5 rounded-xl text-sm font-bold active:opacity-60">
            Visioconférence
          </button>
        </div>
      </header>
      <main className="px-6 space-y-6">
        <div className="bg-secondary/10 border border-secondary/20 rounded-3xl p-5 flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center shrink-0 shadow-sm">
            <Icon
              icon="lucide:sparkles"
              className="text-secondary-foreground"
              width={24}
              height={24}
            />
          </div>
          <div>
            <h3 className="text-base font-extrabold mb-1 leading-tight">
              La sagesse ancestrale à votre service
            </h3>
            <p className="text-xs text-muted-foreground font-medium leading-relaxed">
              Consultez les prêtres Fa les plus respectés du Bénin pour éclairer votre chemin de
              retour.
            </p>
          </div>
        </div>
        <section>
          <h2 className="text-sm font-bold text-primary tracking-widest uppercase mb-4">
            Nos Prêtres certifiés
          </h2>
          <div className="space-y-4">
            <div className="bg-white border border-border/60 rounded-[2rem] p-5 shadow-[0_12px_32px_-8px_rgba(60,60,60,0.06)]">
              <div className="flex gap-4 mb-5">
                <div className="relative">
                  <img
                    src="https://ggrhecslgdflloszjkwl.supabase.co/storage/v1/object/public/user-assets/YoYrfLsdtLI/components/kJPNgQdPXsZ.jpeg"
                    className="w-20 h-20 rounded-2xl object-cover"
                    alt="Baba Fawaze"
                  />
                  <div className="absolute -bottom-2 -right-2 bg-white p-1 rounded-full shadow-md">
                    <Icon icon="lucide:check-circle-2" className="text-primary" width={16} />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-extrabold text-foreground tracking-tight leading-snug">
                    Baba Fawaze G.
                  </h3>
                  <p className="text-xs font-bold text-[#00643C] mb-1">Haut Dignitaire • Ouidah</p>
                  <div className="flex items-center gap-1">
                    <Icon icon="lucide:star" className="text-secondary" width={12} />
                    <Icon icon="lucide:star" className="text-secondary" width={12} />
                    <Icon icon="lucide:star" className="text-secondary" width={12} />
                    <Icon icon="lucide:star" className="text-secondary" width={12} />
                    <Icon icon="lucide:star" className="text-secondary" width={12} />
                    <span className="text-[10px] font-bold text-muted-foreground ml-1">
                      (48 avis)
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-border/40">
                <div className="flex flex-col">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                    Consultation
                  </span>
                  <span className="text-sm font-bold text-foreground">35 000 FCFA</span>
                </div>
                <button className="bg-primary text-white px-6 py-2.5 rounded-full font-bold text-xs shadow-md active:scale-95 transition-all">
                  Réserver
                </button>
              </div>
            </div>
            <div className="bg-white border border-border/60 rounded-[2rem] p-5 shadow-[0_12px_32px_-8px_rgba(60,60,60,0.06)]">
              <div className="flex gap-4 mb-5">
                <div className="relative">
                  <img
                    src="https://ggrhecslgdflloszjkwl.supabase.co/storage/v1/object/public/user-assets/YoYrfLsdtLI/components/XkZrgfAoepy.jpeg"
                    className="w-20 h-20 rounded-2xl object-cover"
                    alt="Dah Sognon"
                  />
                  <div className="absolute -bottom-2 -right-2 bg-white p-1 rounded-full shadow-md">
                    <Icon icon="lucide:check-circle-2" className="text-primary" width={16} />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-extrabold text-foreground tracking-tight leading-snug">
                    Dah Sognon K.
                  </h3>
                  <p className="text-xs font-bold text-[#00643C] mb-1">
                    Expert Traditions • Abomey
                  </p>
                  <div className="flex items-center gap-1">
                    <Icon icon="lucide:star" className="text-secondary" width={12} />
                    <Icon icon="lucide:star" className="text-secondary" width={12} />
                    <Icon icon="lucide:star" className="text-secondary" width={12} />
                    <Icon icon="lucide:star" className="text-secondary" width={12} />
                    <Icon icon="lucide:star-half" className="text-secondary" width={12} />
                    <span className="text-[10px] font-bold text-muted-foreground ml-1">
                      (32 avis)
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-border/40">
                <div className="flex flex-col">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                    Consultation
                  </span>
                  <span className="text-sm font-bold text-foreground">30 000 FCFA</span>
                </div>
                <button className="bg-primary text-white px-6 py-2.5 rounded-full font-bold text-xs shadow-md active:scale-95 transition-all">
                  Réserver
                </button>
              </div>
            </div>
          </div>
        </section>
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
            <a href="#" className="flex flex-col items-center group relative w-10">
              <Icon icon="lucide:grid" className="text-primary" width={22} height={22} />
              <span className="absolute -bottom-2.5 w-1 h-1 bg-primary rounded-full" />
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
            <a href="#" className="flex flex-col items-center group w-10">
              <Icon icon="lucide:user" className="text-white/40" width={22} height={22} />
            </a>
          </li>
        </ul>
      </nav>
    </div>
  );
}
