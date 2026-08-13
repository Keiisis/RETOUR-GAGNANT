import { Icon } from "@iconify/react";

export function DétailServicePermis() {
  return (
    <div className="min-h-screen bg-background pb-32 font-sans text-foreground">
      <div className="flex h-1.5 w-full sticky top-0 z-50">
        <div className="flex-1 bg-primary" />
        <div className="flex-1 bg-secondary" />
        <div className="flex-1 bg-destructive" />
      </div>
      <header className="px-6 py-6 flex items-center justify-between">
        <button className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-foreground active:scale-90 transition-transform">
          <Icon icon="lucide:chevron-left" width={24} height={24} />
        </button>
        <div className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-foreground active:scale-90 transition-transform">
          <Icon icon="lucide:share-2" width={20} height={20} />
        </div>
      </header>
      <main>
        <div className="px-6 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary/5 flex items-center justify-center mb-4">
            <Icon icon="lucide:car" className="text-primary" width={32} height={32} />
          </div>
          <span className="inline-block bg-primary/10 text-primary text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-widest mb-3">
            Transport & Mobilité
          </span>
          <h1 className="text-3xl font-extrabold font-heading tracking-tight text-foreground leading-tight mb-2">
            Permis de conduire béninois
          </h1>
          <p className="text-muted-foreground font-medium mb-6">
            Échange ou obtention du permis national pour une mobilité totale au Bénin.
          </p>
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1.5 bg-muted/60 px-3 py-1.5 rounded-full">
              <Icon icon="lucide:check-circle" className="text-primary" width={14} />
              <span className="text-[11px] font-bold">Officiel</span>
            </div>
            <div className="flex items-center gap-1.5 bg-muted/60 px-3 py-1.5 rounded-full">
              <Icon icon="lucide:layers" className="text-primary" width={14} />
              <span className="text-[11px] font-bold">Toutes catégories</span>
            </div>
            <div className="flex items-center gap-1.5 bg-muted/60 px-3 py-1.5 rounded-full">
              <Icon icon="lucide:shield-check" className="text-primary" width={14} />
              <span className="text-[11px] font-bold">Agréé</span>
            </div>
          </div>
        </div>
        <div className="bg-primary py-8 px-6 grid grid-cols-2 gap-y-8 gap-x-4 mb-10">
          <div className="space-y-2">
            <Icon icon="lucide:clock" className="text-secondary" width={20} />
            <h4 className="text-white text-xs font-bold uppercase tracking-widest">Délai Rapide</h4>
            <p className="text-white/60 text-[10px] leading-relaxed">
              Traitement prioritaire en 15 jours ouvrés.
            </p>
          </div>
          <div className="space-y-2">
            <Icon icon="lucide:shield" className="text-secondary" width={20} />
            <h4 className="text-white text-xs font-bold uppercase tracking-widest">Sécurisé</h4>
            <p className="text-white/60 text-[10px] leading-relaxed">
              Vérification ANATT intégrée à 100%.
            </p>
          </div>
          <div className="space-y-2">
            <Icon icon="lucide:globe" className="text-secondary" width={20} />
            <h4 className="text-white text-xs font-bold uppercase tracking-widest">À Distance</h4>
            <p className="text-white/60 text-[10px] leading-relaxed">
              Gestion complète sans déplacement.
            </p>
          </div>
          <div className="space-y-2">
            <Icon icon="lucide:phone-call" className="text-secondary" width={20} />
            <h4 className="text-white text-xs font-bold uppercase tracking-widest">Support H24</h4>
            <p className="text-white/60 text-[10px] leading-relaxed">
              Conseiller dédié via WhatsApp.
            </p>
          </div>
        </div>
        <div className="px-6 space-y-10">
          <section>
            <p className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mb-3">
              Notre métier
            </p>
            <h2 className="text-2xl font-extrabold font-heading mb-4">
              La liberté de circuler sans entraves.
            </h2>
            <p className="text-muted-foreground font-medium leading-relaxed">
              Le cabinet Retour Gagnant facilite l'obtention de votre titre de conduite béninois,
              qu'il s'agisse d'un échange de permis étranger ou d'une nouvelle demande. Nous gérons
              l'interface avec l'ANATT pour vous.
            </p>
          </section>
          <section>
            <p className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mb-6">
              Les étapes
            </p>
            <div className="space-y-8 relative">
              <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-border/40" />
              <div className="relative pl-12">
                <div className="absolute left-0 w-8 h-8 rounded-full bg-secondary text-foreground flex items-center justify-center text-sm font-extrabold shadow-md">
                  1
                </div>
                <h4 className="text-base font-bold mb-1">Audit de votre dossier</h4>
                <p className="text-sm text-muted-foreground">
                  Vérification de la validité de vos pièces actuelles et éligibilité.
                </p>
              </div>
              <div className="relative pl-12">
                <div className="absolute left-0 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-extrabold shadow-md shadow-green-900/10">
                  2
                </div>
                <h4 className="text-base font-bold mb-1">Dépôt administratif</h4>
                <p className="text-sm text-muted-foreground">
                  Transmission sécurisée à l'agence nationale des transports terrestres.
                </p>
              </div>
              <div className="relative pl-12">
                <div className="absolute left-0 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-extrabold shadow-md shadow-green-900/10">
                  3
                </div>
                <h4 className="text-base font-bold mb-1">Suivi & Retrait</h4>
                <p className="text-sm text-muted-foreground">
                  Récupération de votre permis et envoi par courrier sécurisé (DHL).
                </p>
              </div>
            </div>
          </section>
          <section className="grid grid-cols-1 gap-4">
            <div className="bg-muted/40 p-6 rounded-3xl border border-border/40">
              <h4 className="text-sm font-bold text-destructive flex items-center gap-2 mb-4">
                <Icon icon="lucide:x-circle" width={18} /> En solo
              </h4>
              <ul className="space-y-3">
                <li className="text-xs text-muted-foreground flex items-start gap-2">
                  <Icon icon="lucide:x" className="text-destructive mt-0.5" width={12} /> Files
                  d'attente interminables
                </li>
                <li className="text-xs text-muted-foreground flex items-start gap-2">
                  <Icon icon="lucide:x" className="text-destructive mt-0.5" width={12} /> Risques de
                  faux documents
                </li>
                <li className="text-xs text-muted-foreground flex items-start gap-2">
                  <Icon icon="lucide:x" className="text-destructive mt-0.5" width={12} /> Délais non
                  maîtrisés
                </li>
              </ul>
            </div>
            <div className="bg-primary/5 p-6 rounded-3xl border border-primary/10 shadow-[0_12px_32px_-8px_rgba(0,135,81,0.06)]">
              <h4 className="text-sm font-bold text-primary flex items-center gap-2 mb-4">
                <Icon icon="lucide:check-circle" width={18} /> Avec Retour Gagnant
              </h4>
              <ul className="space-y-3">
                <li className="text-xs text-foreground font-bold flex items-start gap-2">
                  <Icon icon="lucide:check" className="text-primary mt-0.5" width={12} /> Zéro
                  déplacement requis
                </li>
                <li className="text-xs text-foreground font-bold flex items-start gap-2">
                  <Icon icon="lucide:check" className="text-primary mt-0.5" width={12} /> Garantie
                  d'authenticité
                </li>
                <li className="text-xs text-foreground font-bold flex items-start gap-2">
                  <Icon icon="lucide:check" className="text-primary mt-0.5" width={12} /> Suivi en
                  temps réel par SMS
                </li>
              </ul>
            </div>
          </section>
          <section>
            <p className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mb-6">
              Tarifs par catégorie
            </p>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 bg-white border border-primary rounded-2xl shadow-[0_8px_20px_-6px_rgba(0,135,81,0.1)] ring-1 ring-primary">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center font-extrabold text-primary">
                    B
                  </div>
                  <div>
                    <h4 className="text-sm font-bold">Véhicule Léger</h4>
                    <p className="text-[10px] text-muted-foreground">Délai 15 jours</p>
                  </div>
                </div>
                <div className="text-right font-extrabold text-[#00643C]">75 000 FCFA</div>
              </div>
              <div className="flex items-center justify-between p-4 bg-white border border-border rounded-2xl">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center font-extrabold text-muted-foreground">
                    A1
                  </div>
                  <div>
                    <h4 className="text-sm font-bold">Motocyclette</h4>
                    <p className="text-[10px] text-muted-foreground">Délai 10 jours</p>
                  </div>
                </div>
                <div className="text-right font-extrabold text-[#00643C]">45 000 FCFA</div>
              </div>
              <div className="flex items-center justify-between p-4 bg-white border border-border rounded-2xl">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center font-extrabold text-muted-foreground">
                    C
                  </div>
                  <div>
                    <h4 className="text-sm font-bold">Poids Lourd</h4>
                    <p className="text-[10px] text-muted-foreground">Délai 20 jours</p>
                  </div>
                </div>
                <div className="text-right font-extrabold text-[#00643C]">120 000 FCFA</div>
              </div>
            </div>
          </section>
          <section className="pb-12">
            <div className="bg-[#FBFBFC] rounded-3xl p-6 border border-border/40 text-center">
              <h3 className="text-lg font-extrabold mb-2">Prêt à démarrer ?</h3>
              <p className="text-sm text-muted-foreground font-medium mb-6">
                Un expert vous recontacte sous 24h pour valider votre dossier.
              </p>
              <button className="w-full bg-primary text-white py-4 rounded-2xl font-bold shadow-lg shadow-green-900/10 active:scale-[0.97] transition-all">
                Prendre rendez-vous
              </button>
            </div>
          </section>
        </div>
      </main>
      <div className="fixed bottom-0 left-0 w-full bg-white border-t border-border/50 px-6 py-4 flex items-center justify-between z-40 pb-safe shadow-[0_-8px_32px_rgba(60,60,60,0.04)]">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            À partir de
          </span>
          <span className="text-xl font-extrabold text-[#00643C]">45 000 FCFA</span>
        </div>
        <button className="bg-primary text-white px-8 py-3.5 rounded-full font-bold text-sm shadow-[0_8px_20px_-6px_rgba(0,135,81,0.4)] active:scale-95 transition-all">
          Choisir
        </button>
      </div>
    </div>
  );
}
