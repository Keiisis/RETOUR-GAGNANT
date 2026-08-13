import { Icon } from "@iconify/react";

export function ÀPropos() {
  return (
    <div className="min-h-screen bg-background pb-32 font-sans text-foreground">
      <div className="flex h-1.5 w-full sticky top-0 z-50">
        <div className="flex-1 bg-primary" />
        <div className="flex-1 bg-secondary" />
        <div className="flex-1 bg-destructive" />
      </div>
      <header className="px-6 py-10 flex flex-col items-center">
        <div className="w-20 h-20 bg-primary/5 rounded-3xl flex items-center justify-center mb-6">
          <Icon icon="lucide:landmark" className="text-primary text-4xl" />
        </div>
        <h1 className="text-2xl font-extrabold font-heading tracking-tight text-center">
          Retour Gagnant Bénin
        </h1>
        <p className="text-sm font-bold text-primary uppercase tracking-[0.2em] mt-2">
          Expertise & Racines
        </p>
      </header>
      <main className="px-6 space-y-10">
        <section>
          <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-4 text-center">
            Notre Mission
          </h2>
          <p className="text-lg font-bold text-foreground text-center leading-relaxed">
            Faciliter le retour de la diaspora afro-descendante vers sa terre d'origine en alliant
            sécurité juridique et reconnexion spirituelle.
          </p>
        </section>
        <section className="grid grid-cols-1 gap-4">
          <div className="bg-white border border-border/60 p-6 rounded-[2rem] shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center mb-4">
              <Icon icon="lucide:shield-check" className="text-primary" width={24} />
            </div>
            <h3 className="text-base font-bold mb-2">Sécurité Juridique</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Accompagnement par des avocats, notaires et experts fonciers assermentés.
            </p>
          </div>
          <div className="bg-white border border-border/60 p-6 rounded-[2rem] shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-secondary/20 flex items-center justify-center mb-4">
              <Icon icon="lucide:sparkles" className="text-secondary-foreground" width={24} />
            </div>
            <h3 className="text-base font-bold mb-2">Héritage Culturel</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Valorisation des traditions ancestrales et de la sagesse du Fa.
            </p>
          </div>
        </section>
        <section className="text-center pb-12">
          <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-4">
            Contact
          </h2>
          <p className="text-sm font-bold text-foreground">Avenue Jean-Paul II, Cotonou, Bénin</p>
          <p className="text-sm font-medium text-muted-foreground mt-1">
            contact@retourgagnant-benin.bj
          </p>
          <div className="flex justify-center gap-6 mt-6">
            <a href="#" className="text-primary">
              <Icon icon="mdi:linkedin" width={24} />
            </a>
            <a href="#" className="text-primary">
              <Icon icon="mdi:instagram" width={24} />
            </a>
            <a href="#" className="text-primary">
              <Icon icon="mdi:whatsapp" width={24} />
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
