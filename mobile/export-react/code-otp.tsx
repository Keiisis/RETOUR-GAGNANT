export function CodeOTP() {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <div className="flex h-1.5 w-full">
        <div className="flex-1 bg-primary" />
        <div className="flex-1 bg-secondary" />
        <div className="flex-1 bg-destructive" />
      </div>
      <header className="px-6 py-12 text-center">
        <h1 className="text-3xl font-extrabold font-heading tracking-tight mb-2">Vérification</h1>
        <p className="text-muted-foreground font-medium px-4">
          Nous avons envoyé un code à 6 chiffres à votre adresse email.
        </p>
      </header>
      <main className="px-6 space-y-12">
        <div className="flex justify-between gap-2">
          <div className="w-12 h-16 bg-muted/50 border border-border/60 rounded-xl flex items-center justify-center text-xl font-extrabold text-foreground focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
            <input
              type="text"
              maxLength={1}
              className="bg-transparent border-none outline-none w-full text-center"
              defaultValue={4}
            />
          </div>
          <div className="w-12 h-16 bg-muted/50 border border-border/60 rounded-xl flex items-center justify-center text-xl font-extrabold text-foreground focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
            <input
              type="text"
              maxLength={1}
              className="bg-transparent border-none outline-none w-full text-center"
              defaultValue={8}
            />
          </div>
          <div className="w-12 h-16 bg-muted/50 border border-border/60 rounded-xl flex items-center justify-center text-xl font-extrabold text-foreground focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
            <input
              type="text"
              maxLength={1}
              className="bg-transparent border-none outline-none w-full text-center"
              defaultValue={2}
            />
          </div>
          <div className="w-12 h-16 bg-muted/50 border border-border/60 rounded-xl flex items-center justify-center text-xl font-extrabold text-foreground focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
            <input
              type="text"
              maxLength={1}
              className="bg-transparent border-none outline-none w-full text-center"
              placeholder="-"
            />
          </div>
          <div className="w-12 h-16 bg-muted/50 border border-border/60 rounded-xl flex items-center justify-center text-xl font-extrabold text-foreground focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
            <input
              type="text"
              maxLength={1}
              className="bg-transparent border-none outline-none w-full text-center"
              placeholder="-"
            />
          </div>
          <div className="w-12 h-16 bg-muted/50 border border-border/60 rounded-xl flex items-center justify-center text-xl font-extrabold text-foreground focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
            <input
              type="text"
              maxLength={1}
              className="bg-transparent border-none outline-none w-full text-center"
              placeholder="-"
            />
          </div>
        </div>
        <div className="text-center">
          <button className="text-sm font-bold text-primary active:opacity-60 transition-opacity">
            Renvoyer le code (45s)
          </button>
        </div>
        <button className="w-full bg-primary text-white py-5 rounded-2xl font-bold text-base shadow-[0_8px_20px_-6px_rgba(0,135,81,0.4)] active:scale-[0.97] transition-all">
          Vérifier
        </button>
      </main>
    </div>
  );
}
