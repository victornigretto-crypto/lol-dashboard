# Archive du journal — GG Dashboard

> Ce fichier est l'**archive** du journal de [MEMOIRE.md](MEMOIRE.md). On archive,
> on n'efface jamais : tout ce qui sort de MEMOIRE.md atterrit ici **tel quel**,
> sans résumé ni réécriture.
>
> MEMOIRE.md ne garde que les 3 entrées les plus récentes, pour rester lisible en
> début de session. Dès qu'il en compte une quatrième, la plus ancienne descend ici
> en fin de session.
>
> Les entrées ci-dessous sont classées de la plus récente à la plus ancienne, comme
> dans MEMOIRE.md.

---

### 2026-08-13 (1) — « Lance l'app » figeait le PC : cache Turbopack corrompu

Trois crashs machine sur l'instruction « lance l'app » les 12 et 13/08, dont **un pendant
l'enquête elle-même**. Deux `Kernel-Power 41` confirmés dans le journal Windows (15h32 et
16h19). Aucune ligne de code n'était en cause : l'arbre de travail est resté propre.

**Le symptôme, mesuré.** Le démarrage du serveur est sain (2 process, 543 Mo, port ouvert
en ~9 s). C'est la **compilation de la première page** qui déclenche tout : le serveur
lance en boucle des process enfants « pont PostCSS » de Turbopack
(`.next/dev/build/<hash>.js <port>`), **un par port éphémère**, parcourant toute la plage
dynamique Windows (65474→65533 puis reprise à 49152), sans jamais en tuer aucun.
**2 → 31 → 75 → 131 process / 1709 threads / 7,3 Go en 12 secondes.** Le process principal
de `next dev`, lui, reste à ~600 Mo : toute la mémoire est dans les enfants.

**La cause : le cache persistant de Turbopack dans `.next/dev/cache`.** Le fichier
`.next/dev/trace` l'annonçait déjà — `turbopack-compaction` à **85 secondes**,
`turbopack-persistence` avec `reason: "initial snapshot timeout"` sur 4096 tâches.

**Le remède : supprimer `.next`.** Vérifié à froid *et* à chaud une fois le cache
reconstruit : 3 process, `GET / → 200` en 7 s, stable. **Si ça revient un jour, supprimer
`.next` est le premier réflexe** — c'est la seule chose qui a marché.

**Fausses pistes écartées par l'expérience, à ne pas refaire :** le code du projet (aucun
`spawn`), `next.config.ts` (vide), les hooks Claude (aucun), `NODE_OPTIONS`/`.npmrc`
(inexistants), le pare-feu (node.exe explicitement autorisé), le loopback TCP (testé entre
deux process, fonctionne), Tailwind et son scan de sources (`source(none)` + `@source`
n'a rien changé), et la config PostCSS en ESM vs CommonJS (idem). Décisif : **une config
PostCSS vide de tout plugin explosait aussi** — ce n'était donc pas Tailwind.

**Comment tester ce genre de chose sans faire tomber la machine.** Un watchdog par sondage
**ne protège pas** : la bombe passe de 36 à 150 process en 4 secondes, un sondage à 900 ms
arrive trop tard. Il faut une limite imposée par le noyau — un **Job Object Windows** avec
`ActiveProcessLimit` et `JobMemoryLimit` : Windows refuse alors la création du process
n+1, sans course possible.

> **Piège qui a coûté un quasi-crash :** en PowerShell,
> `$info.BasicLimitInformation.LimitFlags = ...` **n'écrit rien** — on modifie une *copie*
> de la sous-structure valeur, aussitôt jetée. `SetInformationJobObject` renvoie alors
> `True` en n'ayant posé **aucune** limite (relu du noyau : `LimitFlags = 0x0`). Il faut
> réaffecter la sous-structure entière (`$info.BasicLimitInformation = $b`) **et relire
> les limites via `QueryInformationJobObject` avant de démarrer quoi que ce soit**. La
> valeur de retour ne prouve rien.

À noter : Turbopack veut **plus de 1,5 Go**. Le plafonner en dessous provoque des
`memory allocation of N bytes failed` côté Rust qui ne sont pas des bugs de l'application.

### 2026-08-11 — Seuils par palier, morts pondérées, bandeaux sur les deux pages

Lot de demandes de Victor, livré d'un bloc. **Point de méthode qui a payé :** il a demandé
de *vérifier s'il n'existait pas déjà un code prévu pour ça* avant de coder. Il en existait
un, et trois des nouveautés demandées étaient des réécritures, pas des ajouts — les
implémenter naïvement aurait créé deux systèmes de couleurs concurrents et des bandeaux en
double.

**1. Les seuils déménagent** → [lib/content/thresholds.ts](lib/content/thresholds.ts).
Avant : une cible unique par palier dans `mid.ts`, le jaune déduit par un ratio (85 % pour
le farm, 115 % pour les morts), et 10 valeurs marquées `PLACEHOLDER`. Maintenant : une
table `Tier → { csPre20, csPost20, deaths10 }`, chaque seuil posé à la main. Trois
changements de fond :

- le CS/min a des seuils **différents avant et après 20 min** (impossible avant, il n'y
  avait qu'une cible pour les deux) ;
- les seuils dépendent du **palier seul, plus du rôle**. C'est ce qui débloque les couleurs
  pour top / jungle / adc / support ;
- **diamond → challenger reprennent les valeurs d'émeraude** (décision de Victor).
  `unranked` reste sans seuils : gris, on ne dit rien.

Les paliers dont Victor n'a pas donné de nouveau CS/min avant 20 min (bronze, silver, gold,
platinum) gardent **exactement** leur comportement d'avant : l'ancienne cible devient le
seuil vert et le jaune reprend la valeur que le ratio produisait (7.5 → 6.375, 8.0 → 6.8).
Vérifié test à l'appui — aucune game ne change de couleur sur ces paliers.

**2. Les morts pondérées — la seule chose qui a demandé une migration.** Règle demandée :
les morts des 5 dernières minutes d'une partie de **plus de 30 min** ne comptent qu'à
moitié *pour la couleur*, le compteur affiché restant le rythme brut. Or `deaths10` est un
total déjà moyenné : savoir **quand** on est mort n'existait nulle part.

L'info vient des events `CHAMPION_KILL` de la **timeline, déjà téléchargée** pour le CS à
20 min → **zéro appel Riot en plus**. Mais il a fallu deux colonnes,
`games.deaths` et `games.deaths_last5`, ce qui **contredisait la règle « aucune migration
pour ce lot »** : signalé à Victor avant de coder, il a tranché pour. On stocke les faits
bruts et jamais la pondération elle-même — la règle peut changer, l'historique des morts
non. Ajoutées à `isComplete`, donc les 20 dernières games se réparent toutes seules au
premier chargement (même mécanique que la Slice 3).

Au-delà de **34 min**, la valeur passe en pointillé avec une infobulle qui explique le
calcul. Le pointillé exige que les colonnes soient réellement remplies : sinon il
annoncerait un calcul qui n'a pas eu lieu.

**3. Les bandeaux de gauche** → [lib/banners.ts](lib/banners.ts) +
[AnalysisPanel](app/_components/AnalysisPanel.tsx), partagés par `/` et `/suivi` (qui passe
en deux colonnes, `max-w-6xl`). Trois pièges :

- `farmBanner` et `deathsBanner` **existaient déjà** dans `app/page.tsx` avec d'autres
  textes et sans version verte : réécrits, pas dupliqués ;
- l'ordre était **rouge → jaune → vert**, l'inverse de ce que Victor voulait. Inversé pour
  tout le panneau, winrate et nombre de champions compris (confirmé par lui) ;
- le **jaune sur les morts n'affiche rien** : demande explicite, ce n'est pas un oubli.

**4. La surbrillance clignote.** L'ancien `ring-2 ring-blue-400` fixe devient une keyframe
`stat-blink` déclarée dans un bloc `@theme` de [globals.css](app/globals.css) (syntaxe
Tailwind 4). **Piège :** `ring-*` et l'animation utilisent tous les deux `box-shadow` — les
garder ensemble aurait fait que l'un écrase l'autre. C'est donc l'animation qui dessine le
liseré, d'où l'absence de `ring-*` dans `highlightClass`. Et `animate-pulse` ne convenait
pas : il fait varier l'opacité de tout l'élément, donc la valeur chiffrée clignoterait
aussi. Une règle `prefers-reduced-motion` fige le liseré pour qui a désactivé les
animations.

**5. Le reste :** durée de partie sur chaque ligne (`mm:ss`), et le CS/min après 20 min
n'apparaît plus **sous 25 min de partie** (avant : dès 20 min dépassées).

**Refactos au passage, pour ne pas dupliquer le neuf :** les trois cases chiffrées
deviennent [StatCells](app/_components/StatCells.tsx) (sinon le pointillé et l'infobulle
existaient en deux exemplaires), et `LoadingDots` sort de `app/page.tsx`.

**Vérifications faites :** `tsc --noEmit` et `npm run build` passent. **60 assertions** sur
le vrai code exécuté via Node 24 (chaque limite de chaque seuil de chaque palier, la
fenêtre des 25 min, la pondération, la lecture des `CHAMPION_KILL`, l'ordre et les textes
des bandeaux) — toutes vertes. La classe `.animate-stat-blink`, sa keyframe et la règle
`prefers-reduced-motion` sont bien présentes dans le CSS **compilé de production**
(vérifié dans le fichier, pas seulement dans la source). Layout du cockpit en deux colonnes
mesuré à 390 / 768 / 1280 px : `scrollWidth == clientWidth` partout, aucun débordement.

**Pas vérifié en vrai :** rien de tout ça n'a été vu dans l'app avec de vraies données —
la mesure et la capture portent sur une maquette servie avec le CSS compilé.

**Clôture.** Un seul commit, `0ac3828`, poussé sur `origin/master`. Victor avait lancé la
migration `deaths` / `deaths_last5` avant qu'on code. **Troisième session d'affilée sans
test réel dans l'app** : la liste « À vérifier en tout premier » s'allonge au lieu de se
vider. Au prochain démarrage, insister pour qu'il ouvre le cockpit **avant** d'ajouter
quoi que ce soit.

**Attention au premier chargement de `/suivi` :** il sera plus lent (~5 s). `isComplete`
exige désormais `deaths` et `deaths_last5`, donc les 20 games sont retéléchargées une fois
pour aller chercher les horaires de morts, puis réparées en base. C'est le comportement
attendu, pas un bug.

### 2026-08-10 (3) — Bandeau du cockpit + changement de profil

Refonte du `<header>` de [app/suivi/page.tsx](app/suivi/page.tsx), à la demande de Victor :

```
[ Changer de profil ]                        paul.gentil224@gmail.com
                                                 [ Se déconnecter ]
┌────────────────────────────────────────────────────────────────────┐
│  GG DASHBOARD                                        ⬥ (emblème)   │
│  GrosGalio#EUW                                        Diamond IV    │
│  Rôle principal : Mid                                    52 LP      │
└────────────────────────────────────────────────────────────────────┘
```

Le principe de rangement : **hors du cadre = le compte GG Dashboard** (email, déconnexion,
choix du compte Riot) ; **dans le cadre = le profil LoL affiché** (pseudo, rôle, rang).
« Mon suivi » est remplacé par le Riot ID, et le rang passe en pile emblème → palier → LP,
comme dans le client LoL.

**Changement de profil = suppression définitive.** Décision explicite de Victor, contre la
recommandation « masquer sans supprimer ». `handleSwitchProfile` lie le nouveau compte via
`/api/profile/link` (la route de l'onboarding, `onboarded_at` reste posé donc pas de
re-onboarding), **puis** supprime tout ce qui n'appartient pas au nouveau puuid — l'ancien
compte lié *et* les lignes à `puuid = null` héritées d'avant la migration, qui sont la cause
historique du mélange. Les notes écrites à la main partent avec : c'est le sens de
l'avertissement rouge affiché avant de valider.

Deux garde-fous à ne pas retirer :
- on **lie avant de supprimer** : Riot ID faux ou API injoignable → rien n'est effacé ;
- suppression seulement si le puuid renvoyé est une chaîne non vide, sinon le filtre
  « tout sauf lui » viserait la totalité des games.

**Vérifications faites :** mise en page rendue hors session en servant le CSS compilé de
l'app à une maquette du bandeau (`/suivi` exige une session, donc pas de capture directe).
Aucun débordement à 390 px de large — mesuré, `scrollWidth == clientWidth`. Et la grammaire
du filtre de suppression (`or=(puuid.is.null,puuid.neq.X)`) validée par un DELETE anonyme
que RLS bloque : 204 sur la vraie syntaxe, 400 sur une syntaxe volontairement cassée, donc
le test n'est pas un faux positif.

**Piège de mesure à retenir :** Chrome headless sous Windows n'honore pas
`--window-size` en dessous d'environ 500 px — il rend à ~504 px et *recadre* l'image, ce qui
ressemble exactement à un débordement responsive. Pour un vrai test étroit, charger la page
dans une `<iframe>` de la largeur voulue et lire `documentElement.scrollWidth` dedans.

**Clôture de la session.** Tout est poussé sur `origin/master`, et Victor a lancé la
migration `games.puuid` avant de fermer. Il n'a en revanche **pas eu le temps de tester
l'application** : trois choses restent donc à confirmer au premier retour (reprises dans
« Reste à faire »), et il ne faut pas les considérer comme acquises.

---

### 2026-08-10 (2) — Profil mélangé + CS après 20 min jamais affiché

**Symptômes rapportés :** en se connectant sur `grosgalio`, le cockpit montrait un mix des
profils `cartem#euwww` et `chopin opus 52#1849`. Et le CS/min après 20 min ne s'affichait
jamais.

**Ce que ce n'était PAS.** Premier réflexe : une fuite RLS entre utilisateurs. Vérifié par
une requête anonyme sur `games` et `profiles` avec la clé anon → `[]` dans les deux cas.
RLS est bien actif et la politique `auth.uid() = user_id` fonctionne. **À refaire en premier
si un doute de fuite revient**, c'est un test décisif et non destructif :

```bash
curl -sS "$URL/rest/v1/games?select=riot_match_id&limit=5" \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON"   # doit renvoyer []
```

**Cause 1 — le mélange.** `games` ne retenait pas de quel compte Riot venait chaque ligne :
seulement `user_id`. Or `profiles` ne garde **qu'un** `puuid`, écrasé à chaque liaison. Un
user qui relie un autre Riot ID empile donc les games des deux comptes sous le même
`user_id`, indiscernables — et `/suivi` faisait `select("*")` sans filtre de compte, pendant
que l'en-tête (rang + rôle) venait du compte courant. D'où le « mix ».
Le garde-fou anti-pollution ne couvrait que l'import d'un compte *non lié* ; pas le
changement de compte lié.

**Cause 2 — l'après-20.** Deux verrous cumulés : la condition d'acceptation du cache ne
vérifiait pas `cs_final` / `game_duration_seconds`, donc les games importées avant la
Slice 3 étaient resservies avec leurs `null` ; et `ignoreDuplicates: true` empêchait tout
upsert de les réparer. Sans ces deux colonnes `csMetrics` ne peut pas calculer l'après-20 →
« — » définitif. Le commentaire du code disait « tant qu'elles ne sont pas réimportées »…
mais **rien ne déclenchait jamais ce réimport**. D'où « jamais » et pas « parfois ».

**Ce qui a été changé :**

- `supabase/schema.sql` : `alter table public.games add column if not exists puuid text;`
- `app/api/riot/import/route.ts` : le cache se lit par `(user_id, puuid)` ; nouvelle
  fonction `isComplete` — une ligne incomplète est traitée comme absente du cache donc
  retéléchargée ; `ignoreDuplicates: false` pour que l'upsert répare les lignes existantes ;
  le `puuid` est écrit sur chaque ligne. Le `puuid` **n'est pas** dans le type `Row`, donc
  il ne part jamais vers le navigateur (vérifié).
- `app/suivi/page.tsx` : le cockpit filtre sur `profile.puuid`.

**Décision de Victor :** les games antérieures aux 20 dernières garderont `puuid = null` et
resteront **masquées, pas supprimées**. Un backfill exact aurait demandé un appel Riot par
game pour savoir à quel compte elle appartient ; les tagger en masse avec le puuid courant
aurait attribué les games de cartem à chopin — remplacer un mélange par un mensonge.

**Mécanique d'auto-réparation à comprendre :** le filtre `.eq("puuid", puuid)` fait que les
anciennes lignes (puuid null) ratent le cache → elles sont retéléchargées → l'upsert les met
à jour avec `cs_final`, la durée **et** le `puuid`. Les deux bugs se réparent donc d'eux-mêmes
au premier chargement du cockpit, sur les 20 dernières SoloQ.

**Limite connue, laissée volontairement :** la contrainte d'unicité reste
`(user_id, riot_match_id)`. Si deux comptes Riot reliés au même login ont joué **la même
partie**, leurs deux lignes se marcheraient dessus. Rare, et déjà cassé avant — pas élargi
le périmètre pour ça.

---

### 2026-08-10 (1) — Audit complet + fix du CS/min et de la perf du filtre « all »

**Contexte :** demande d'audit — lancer l'app, relire le code, lister ce qui est
inachevé ou en suspens. Puis go sur deux bugs.

**Ce qui a été changé :**

1. **[lib/stats.ts](lib/stats.ts) — `csMetrics`.** Le CS/min avant 20 min divisait
   *toujours* par 20, même pour une game finie à 15 min. Une game de 15,4 min à 113 CS
   s'affichait à 5.7 CS/min au lieu de 7.3 — assez pour passer de vert à rouge sur la
   cible Iron. Corrigé : on divise par la durée réelle quand elle est connue **et**
   inférieure à 20 min.
   *Le garde-fou :* si `game_duration_seconds` est `null` (games importées avant que la
   colonne existe), on garde la fenêtre de 20 min — comportement d'avant, zéro régression.

2. **[app/api/riot/import/route.ts](app/api/riot/import/route.ts) — `collectRows`
   remplace `collectCandidateMatchIds`.** Le filtre « Normal & Classés » prenait
   **2 min 06 s**. Cause : on ramassait 60 identifiants, on téléchargeait les 60 matchs
   en entier (120 appels Riot : match + timeline), *puis* on en gardait 20. Les 40 jetés
   coûtaient 80 appels pour rien et faisaient sauter le quota de la dev key
   (100 req/2 min) → backoff 429 en cascade. Corrigé : on avance page par page (20) et on
   s'arrête dès qu'on a le compte. **4,8 s** désormais.

**Mesures avant / après** (compte challenger EUW, à froid — une recherche anonyme
n'écrit rien en base, donc chaque essai repart de zéro) :

| filtre | avant | après |
|---|---|---|
| Normal & Classés (`all`) | 2 min 06 s | **4,8 s** |
| SoloQ | 4,0 s | 4,7 s (inchangé) |
| Flex & Solo duo (`ranked`) | — | 4,5 s (inchangé) |

| game courte | avant | après |
|---|---|---|
| Sylas 15,4 min (113 CS) | 5.7 | **7.3** (rouge → vert) |
| Viktor 15,5 min (141 CS) | 7.0 | **9.1** |
| Sylas 18,9 min (163 CS) | 8.2 | **8.6** |

Les 17 games de plus de 20 min donnent des valeurs strictement identiques à avant.

**Laissé de côté volontairement :** la calibration des cibles (bug « c » ci-dessous),
décision de Victor, pas une décision de code.

**Ce qu'on a appris / les pièges rencontrés :**

- La **dev key Riot expire toutes les 24 h**. Si tout se met à renvoyer 401/403 un matin,
  c'est ça avant toute autre hypothèse — régénérer sur le portail Riot.
- Le vrai plafond de perf n'est pas le code, c'est le **quota de la dev key**
  (20 req/s, 100 req/2 min). Chaque match non caché coûte **2 appels** (match + timeline).
  20 matchs = 40 appels ≈ 4,5 s, et c'est le plancher tant qu'on n'a pas de clé de prod.
- Les diagnostics de l'IDE ont **un edit de retard** pendant une série de modifications.
  Ne pas y réagir : c'est `npx tsc --noEmit` qui fait foi.
- Pour tester une fonction pure sans installer de test runner, Node 24 lit le TypeScript
  directement. Un `registerHooks` de 5 lignes suffit à résoudre l'alias `@/` (et à
  rajouter le `.ts` que TypeScript omet). Ça permet d'exécuter le **vrai** `lib/stats.ts`
  plutôt qu'une copie. Script jetable, à garder hors du dépôt.

**Mise en place de ce fichier.** Le contexte se reperdait entre deux sessions. `MEMOIRE.md`
est né en fin de session, et [AGENTS.md](AGENTS.md) renvoie dessus — comme ce fichier-là est
chargé automatiquement au démarrage, la consigne « lis puis mets à jour » arrive seule, sans
que Victor ait à la redonner.

**Git.** 7 commits poussés sur `origin/master` : les 2 de cette session
(`0a95fea` les deux fixes, `845c6fa` ce fichier) **plus 5 commits d'avance qui n'avaient
jamais été poussés** (Slices 3, 4, 5, Refactos A et C). Local et GitHub sont désormais
synchronisés. Vérifié avant de pousser : aucune clé Riot dans l'historique, `.env.local`
bien ignoré.
*Convention de messages :* français **sans accents**, titre court + corps détaillé +
trailer `Co-Authored-By`. S'y tenir.
