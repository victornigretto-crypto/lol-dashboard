// Les trois cases chiffrées d'une ligne de game : CS/min avant 20 min,
// CS/min après 20 min, morts/10 min. Partagées par / et /suivi pour que le
// code couleur, la surbrillance clignotante et l'infobulle des morts ne
// puissent pas diverger entre les deux pages.
import {
  csClass,
  csMetrics,
  deathsClass,
  explainsDeaths,
  highlightClass,
  weightedDeaths10,
  DEATHS_EXPLANATION,
  type CsSource,
  type DeathsSource,
} from "@/lib/stats";
import type { TierContent, TierThresholds } from "@/lib/content";

const CELL = "w-20 rounded px-1 py-0.5 text-center text-sm";

export function StatCells({
  game,
  thresholds,
  content,
  hideOnMobile = false,
}: {
  game: CsSource & DeathsSource;
  thresholds: TierThresholds | null;
  content: TierContent;
  // Sur / les cases disparaissent en dessous de `sm` faute de place ; sur
  // /suivi la ligne se replie en plusieurs rangs, donc elles restent.
  hideOnMobile?: boolean;
}) {
  const { perMinPre20, perMinPost20 } = csMetrics(game);
  const base = (hideOnMobile ? "hidden sm:block " : "") + CELL + " ";

  // Le compteur affiché reste le rythme brut ; seule la COULEUR suit le
  // rythme pondéré (morts de fin de partie comptées à moitié).
  const deathsForColour = weightedDeaths10(game);
  const explained = explainsDeaths(game);

  return (
    <>
      <div className={base + csClass(perMinPre20, thresholds?.csPre20 ?? null) + highlightClass(content, "csPre20")}>
        <p className="text-[10px] leading-tight opacity-80">CS/min à 20min</p>
        <p>{perMinPre20 ?? "—"}</p>
      </div>
      <div
        className={base + csClass(perMinPost20, thresholds?.csPost20 ?? null) + highlightClass(content, "csPost20")}
      >
        <p className="text-[10px] leading-tight opacity-80">CS/min après 20min</p>
        <p>{perMinPost20 ?? "—"}</p>
      </div>
      <div
        className={
          base + deathsClass(deathsForColour, thresholds?.deaths10 ?? null) + highlightClass(content, "deaths10")
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
