export function Onboarding() {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground flex flex-col">
      <div className="fixed top-0 left-0 w-full flex h-1.5 z-50">
        <div className="flex-1 bg-primary" />
        <div className="flex-1 bg-secondary" />
        <div className="flex-1 bg-destructive" />
      </div>
      <div className="relative h-[60vh] w-full overflow-hidden">
        <img
          src="https://ggrhecslgdflloszjkwl.supabase.co/storage/v1/object/public/user-assets/YoYrfLsdtLI/components/e84bYa2zwWc.jpeg"
          className="w-full h-full object-cover"
          alt="Bénin Background"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-white via-white/40 to-transparent" />
      </div>
      <div className="flex-1 px-8 flex flex-col justify-end pb-12">
        <div className="space-y-6">
          <div className="flex gap-2">
            <div className="w-8 h-1.5 rounded-full bg-primary" />
            <div className="w-2 h-1.5 rounded-full bg-primary/20" />
            <div className="w-2 h-1.5 rounded-full bg-primary/20" />
          </div>
          <h2 className="text-3xl font-extrabold font-heading tracking-tight leading-tight">
            Votre retour au pays, serein et structuré.
          </h2>
          <p className="text-lg text-muted-foreground font-medium leading-relaxed">
            Nous accompagnons la diaspora dans toutes les démarches administratives, foncières et
            culturelles au Bénin.
          </p>
          <button className="w-full bg-primary text-white py-5 rounded-2xl font-bold text-lg shadow-[0_8px_20px_-6px_rgba(0,135,81,0.4)] active:scale-[0.97] transition-all">
            Commencer l'aventure
          </button>
          <button className="w-full text-muted-foreground py-2 font-bold text-sm active:opacity-60 transition-opacity">
            Se connecter
          </button>
        </div>
      </div>
    </div>
  );
}
