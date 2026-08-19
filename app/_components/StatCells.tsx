// Les trois cases chiffrées d'une ligne de game : CS/min avant 20 min,
// CS/min après 20 min, morts/10 min. Partagées par / et /suivi pour que le
// code couleur, la surbrillance clignotante et l'infobulle des morts ne
// puissent pas diverger entre les deux pages.
//
// Règle du clignotement, IDENTIQUE partout : une case n'alerte que si son
// palier demande de surveiller cette stat ET que la valeur est rouge. Une case
// grise (seuils inconnus) ne clignote donc jamais — on n'alerte pas sur ce
// qu'on ne sait pas juger.
import {
  alertClass,
  csBand,
  csClass,
  csMetrics,
  deathsBand,
  deathsClass,
  explainsDeaths,
  weightedDeaths10,
  DEATHS_EXPLANATION,
  type CsSource,
  type DeathsSource,
} from "@/lib/stats";
import type { TierContent, TierThresholds } from "@/lib/content";
import { estRemake } from "@/lib/sample";

const CELL = "w-20 rounded px-1 py-0.5 text-center text-sm";

// Gris ardoise, sans couleur de verdict ni clignotement : un remake n'a rien
// produit qu'on puisse juger.
const CELL_REMAKE = CELL + " bg-slate-800 text-slate-500";

export function StatCells({
  game,
  thresholds,
  content,
  hideOnMobile = false,
}: {
  game: CsSource & DeathsSource & { game_duration_seconds: number | null };
  thresholds: TierThresholds | null;
  content: TierContent;
  // Sur / les cases disparaissent en dessous de `sm` faute de place ; sur
  // /suivi la ligne se replie en plusieurs rangs, donc elles restent.
  hideOnMobile?: boolean;
}) {
  const { perMinPre20, perMinPost20 } = csMetrics(game);
  const base = (hideOnMobile ? "hidden sm:block " : "") + CELL + " ";

  // Un remake ne rend AUCUN chiffre. Afficher « 1.7 CS/min » sur une partie
  // d'une minute, colorée qui plus est, dirait exactement le contraire de
  // « cette partie ne compte pas » — et c'est ce que le cockpit faisait.
  if (estRemake(game)) {
    const vide = (hideOnMobile ? "hidden sm:block " : "") + CELL_REMAKE + " ";
    return (
      <>
        {["CS/min à 20min", "CS/min après 20min", "Morts/10m"].map((intitule) => (
          <div key={intitule} className={vide}>
            <p className="text-[10px] leading-tight opacity-80">{intitule}</p>
            <p>—</p>
          </div>
        ))}
      </>
    );
  }

  // Le compteur affiché reste le rythme brut ; seule la COULEUR suit le
  // rythme pondéré (morts de fin de partie comptées à moitié).
  const deathsForColour = weightedDeaths10(game);
  const explained = explainsDeaths(game);

  // La bande sert deux fois : la couleur de fond et le déclenchement du
  // clignotement.
  const bandPre20 = csBand(perMinPre20, thresholds?.csPre20 ?? null);
  const bandPost20 = csBand(perMinPost20, thresholds?.csPost20 ?? null);
  const bandDeaths = deathsBand(deathsForColour, thresholds?.deaths10 ?? null);

  return (
    <>
      <div
        className={
          base +
          csClass(perMinPre20, thresholds?.csPre20 ?? null) +
          alertClass(content, "csPre20", bandPre20)
        }
      >
        <p className="text-[10px] leading-tight opacity-80">CS/min à 20min</p>
        <p>{perMinPre20 ?? "—"}</p>
      </div>
      <div
        className={
          base +
          csClass(perMinPost20, thresholds?.csPost20 ?? null) +
          alertClass(content, "csPost20", bandPost20)
        }
      >
        <p className="text-[10px] leading-tight opacity-80">CS/min après 20min</p>
        <p>{perMinPost20 ?? "—"}</p>
      </div>
      <div
        className={
          base +
          deathsClass(deathsForColour, thresholds?.deaths10 ?? null) +
          alertClass(content, "deaths10", bandDeaths)
        }
      >
        <p className="text-[10px] leading-tight opacity-80">Morts/10m</p>
        <p
          className={explained ? "cursor-help underline decoration-dotted underline-offset-2" : undefined}
          title={explained ? DEATHS_EXPLANATION : undefined}
        >
          {game.deaths10}
        </p>
      </div>
    </>
  );
}
