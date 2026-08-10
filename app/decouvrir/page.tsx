import { MotivationScreen } from "@/app/_components/MotivationScreen";

// Écran de motivation 1/2 : on nomme le problème avant de proposer quoi que
// ce soit. Toujours aucun compte demandé à ce stade.
export default function DecouvrirPage() {
  return (
    <MotivationScreen
      title="Pourquoi 95% des joueurs ne progressent pas"
      points={[
        "Ils ne savent pas ce qui les empêche de monter",
        "Ils essaient de progresser sur tous les fondamentaux à la fois",
        "Ils jouent en autopilote et ne s'investissent pas réellement dans leur progression",
      ]}
      cta="Je veux progresser"
      href="/rejoindre"
      back={{ label: "Retour à l'analyse", href: "/" }}
    />
  );
}
