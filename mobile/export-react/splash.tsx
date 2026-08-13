import { Icon } from "@iconify/react";

export function Splash() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center font-sans text-foreground">
      <div className="fixed top-0 left-0 w-full flex h-1.5">
        <div className="flex-1 bg-primary" />
        <div className="flex-1 bg-secondary" />
        <div className="flex-1 bg-destructive" />
      </div>
      <div className="flex flex-col items-center animate-in fade-in zoom-in duration-700">
        <div className="w-32 h-32 bg-primary/5 rounded-[2.5rem] flex items-center justify-center mb-8">
          <Icon icon="lucide:landmark" className="text-primary text-6xl" />
        </div>
        <h1 className="text-2xl font-extrabold font-heading tracking-tight text-center px-12 leading-tight">
          Retour Gagnant
          <br />
          <span className="text-primary">Bénin</span>
        </h1>
        <p className="mt-4 text-sm font-medium text-muted-foreground tracking-widest uppercase">
          L'accompagnement premium
        </p>
      </div>
      <div className="fixed bottom-12 flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    </div>
  );
}
