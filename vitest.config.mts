import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Extension .mts et non .ts : le projet n'a pas `"type": "module"`, donc un
// vitest.config.ts est charge comme du CommonJS et Vite avertit a chaque run.
//
// Config minimale volontairement : tout ce qui est teste ici est du TypeScript
// pur (lib/), sans composant React ni DOM. Pas besoin de jsdom, ni du plugin
// Next -- Vitest transpile le TS lui-meme. Si un jour on teste un composant,
// il faudra ajouter jsdom + @testing-library, pas avant.
export default defineConfig({
  test: {
    environment: "node",
    // Les tests vivent a cote du code qu'ils couvrent (lib/stats.test.ts a
    // cote de lib/stats.ts) : on voit d'un coup d'oeil ce qui est couvert.
    include: ["lib/**/*.test.ts"],
  },
  resolve: {
    alias: {
      // Meme alias que `paths` dans tsconfig.json ("@/*" -> "./*"), pour que
      // les tests importent exactement comme le code de l'app.
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
});
