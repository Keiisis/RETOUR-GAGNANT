import { Icon } from "@iconify/react";

export function ConfirmationCommande() {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground flex flex-col items-center justify-center px-8 py-12">
      <div className="fixed top-0 left-0 w-full flex h-1.5 z-50">
        <div className="flex-1 bg-primary" />
        <div className="flex-1 bg-secondary" />
        <div className="flex-1 bg-destructive" />
      </div>
      <div className="w-24 h-24 rounded-[2.5rem] bg-primary/10 flex items-center justify-center mb-8 animate-in zoom-in duration-500">
        <div className="w-16 h-16 rounded-[1.5rem] bg-primary flex items-center justify-center shadow-lg shadow-green-900/20">
          <Icon icon="lucide:check" className="text-white text-4xl font-bold" />
        </div>
      </div>
      <h1 className="text-3xl font-extrabold font-heading tracking-tight text-center mb-3">
        Paiement Réussi
      </h1>
      <p className="text-center text-muted-foreground font-medium mb-12">
        Votre commande #RG-ORD-2024-551 a bien été enregistrée. Un email de confirmation vous a été
        envoyé.
      </p>
      <div className="w-full bg-muted/30 border border-border/40 rounded-[2rem] p-6 mb-12">
        <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center mb-4">
          Prochaines étapes
        </h3>
        <div className="space-y-4">
          <div className="flex gap-4 items-start">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 font-bold text-primary text-xs">
              1
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Téléchargement immédiat de vos e-books dans la section "Mes Dossiers".
            </p>
          </div>
          <div className="flex gap-4 items-start">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 font-bold text-primary text-xs">
              2
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Expédition des produits physiques sous 72h via notre partenaire logistique.
            </p>
          </div>
        </div>
      </div>
      <button className="w-full bg-primary text-white py-5 rounded-2xl font-bold text-base shadow-[0_8px_20px_-6px_rgba(0,135,81,0.4)] active:scale-[0.97] transition-all">
        Retourner à la boutique
      </button>
    </div>
  );
}
