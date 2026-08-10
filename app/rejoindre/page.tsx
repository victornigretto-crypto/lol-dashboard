import { MotivationScreen } from "@/app/_components/MotivationScreen";

// Écran de motivation 2/2 : la réponse au problème posé par /decouvrir, y
// compris la contrepartie. "C'est parti" est le premier moment où on demande
// un compte — la valeur a déjà été livrée.
export default function RejoindrePage() {
  return (
    <MotivationScreen
      title="Comment GG Dashboard va t'aider à progresser"
      points={[
        "GG Dashboard te dit sur quoi progresser en fonction de ta ligue et de ton classement",
        "GG Dashboard repère tes faiblesses et tes erreurs récurrentes",
        "Par contre : tu vas devoir t'investir. Remplis GG Dashboard après chacune de tes soloQ.",
      ]}
      cta="C'est parti"
      href="/login?mode=signup"
      back={{ label: "Retour", href: "/decouvrir" }}
    />
  );
}
