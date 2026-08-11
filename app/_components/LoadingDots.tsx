// Trois points qui rebondissent, utilisés partout où un chargement est en
// cours sans qu'on sache combien de temps il durera.
export function LoadingDots() {
  return (
    <span className="inline-flex items-center gap-1 align-middle">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500 [animation-delay:-0.3s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500 [animation-delay:-0.15s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500" />
    </span>
  );
}
