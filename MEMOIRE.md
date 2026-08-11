# Mémoire de projet — GG Dashboard

> **À lire au début de chaque session. À mettre à jour à la fin de chaque session.**
>
> Le code dit *quoi*. Ce fichier dit *pourquoi*, *où on en était*, et *ce qui coince*.
> Il est le fil entre deux sessions : sans lui, tout le contexte se reperd.

**Comment le tenir à jour :** en fin de session, ajouter une entrée datée en haut du
journal, puis rafraîchir « État actuel » et « Reste à faire ». On n'efface jamais une
entrée du journal — on ajoute par-dessus.

---

## Le projet en deux lignes

Dashboard League of Legends qui dit à un joueur **sur quoi progresser en fonction de son
palier**, et lui fait noter ses erreurs après chaque partie. L'analyse d'un profil est
gratuite et sans compte ; le suivi dans la durée demande un compte.

---

## État actuel — 2026-08-11

**Stack :** Next.js 16.2.12 (App Router) · React 19.2.4 · Tailwind 4 · Supabase
(auth + Postgres) · API Riot Games (dev key, EUW en dur).

**Le parcours complet, dans l'ordre :**

```
/            analyse gratuite, sans compte (redirige vers /suivi si déjà connecté)
/decouvrir   écran de motivation 1/2 — on nomme le problème
/rejoindre   écran de motivation 2/2 — la réponse + la contrepartie
/login       création de compte (?mode=signup)
/onboarding  liaison du compte Riot + rang + rôles + pyramide + focus du palier
/suivi       le cockpit : bandeau (Riot ID + rang + changement de profil),
             les games et les 3 champs d'erreurs à remplir
```

> ### Migrations à jour au 2026-08-11
> Deux vagues, **toutes deux lancées et confirmées par Victor** :
> `games.puuid` (2026-08-10), puis `games.deaths` + `games.deaths_last5` (2026-08-11).
> Le schéma en base correspond donc à [supabase/schema.sql](supabase/schema.sql), et le
> code sur `master` a ce qu'il lui faut.
>
> Rappel de fonctionnement : Victor lance le SQL lui-même dans Supabase → SQL Editor. Si
> une session démarre sur une erreur de `/suivi` parlant d'une colonne manquante, c'est
> qu'une migration plus récente n'est pas passée — le vérifier avant toute autre piste.

**Ce qui marche, vérifié en session :** import Riot de bout en bout (compte → 20 games →
rang), cache en base, garde-fou anti-pollution, auth Supabase complète (login / signup /
reset / confirmation), les couleurs relatives au palier. `tsc --noEmit` et `npm run build`
passent.

**Vérifié seulement par le code, pas en vrai** (demande une session connectée, donc à
confirmer avec Victor) : la suppression des données à l'ancien profil lors d'un changement
de compte, et le fait que les notes écrites à la main survivent au réimport (l'upsert ne
liste pas ces colonnes, elles devraient donc être préservées).

**Le trou principal :** le contenu pédagogique n'existe **que pour le rôle mid**, et
seulement de **iron à emerald**. Tout le reste tombe sur `FALLBACK_CONTENT`
(« En cours de développement ») : pas de focus, pas de questions d'erreurs sur mesure, pas
de surbrillance. **Les couleurs, elles, ne dépendent plus du rôle** depuis le 2026-08-11 :
un joueur top ou support a un tableau coloré même sans contenu écrit.

---

## Journal des sessions

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

---

## Reste à faire

Classé par ce que ça rapporte, pas par difficulté.

### À vérifier en tout premier (rien n'a encore été testé en vrai)

Ni la session du 2026-08-10 ni celle du 2026-08-11 n'ont été ouvertes dans l'app par
Victor. **Commencer par lui demander où ça en est, avant d'entamer autre chose.**

Du 2026-08-11 :

- [ ] **Les couleurs correspondent aux seuils voulus** sur de vraies games, et le clignotement
      des stats prioritaires est agréable et pas épileptique (1,4 s par cycle — à ajuster
      dans [globals.css](app/globals.css) si c'est trop rapide ou trop lent).
- [ ] **Les bandeaux de gauche apparaissent sur `/suivi`**, dans l'ordre vert → jaune → rouge.
- [ ] **Les morts en pointillé** sur les games de plus de 34 min, avec l'infobulle au survol.
      L'infobulle est le `title` natif du navigateur : elle met ~1 s à apparaître. Si Victor
      la trouve trop discrète, la remplacer par une vraie bulle en CSS.

Du 2026-08-10 :

- [ ] **Le cockpit charge**, n'affiche plus qu'un seul compte Riot (fin du mélange
      cartem/chopin), et le **CS/min après 20 min affiche enfin des valeurs**.
- [ ] **Les notes écrites à la main survivent au réimport.** C'est le point le plus
      sensible : l'upsert ne liste pas `error_lane` / `error_macro` / `error_fight` /
      `summary`, elles devraient donc être préservées — vérifié par le raisonnement, jamais
      en vrai. Si ça a effacé des notes, c'est à corriger toutes affaires cessantes.
- [ ] **Le changement de profil** lie bien le nouveau compte et supprime l'ancien.
      Opération irréversible : à tester avec un compte dont les notes n'ont pas de valeur.

### Décisions qui n'appartiennent qu'à Victor

- [x] ~~Calibrer les cibles de couleur~~ — **fait le 2026-08-11**, les 10 `PLACEHOLDER` ont
      disparu au profit de [lib/content/thresholds.ts](lib/content/thresholds.ts).
      *Réserve à surveiller :* le seuil vert des morts est à **1.0/10 min pour tous les
      paliers**, alors que le compte challenger mesuré était à **1,74**. Un joueur Iron
      sera donc rarement vert sur les morts. C'est un choix assumé de Victor (un objectif,
      pas une moyenne), mais si le cockpit paraît décourageant, c'est la première valeur à
      revoir.
- [ ] **Le mapping niveau de pyramide ↔ rang** ([lib/content/pyramid.ts:22](lib/content/pyramid.ts#L22)).
      `TIER_PYRAMID_LEVELS` est un premier jet déduit des `focusPoints`, marqué
      `TODO Victor`. C'est ce qui pilote la pyramide de l'onboarding.

### Contenu (le gros morceau)

- [ ] **4 rôles sur 5 n'ont aucun contenu** : top, jungle, adc, support tombent sur le
      fallback ([lib/content/mid.ts](lib/content/mid.ts)). Le squelette est prêt —
      il suffit d'un `Partial<Record<Tier, TierContent>>` par rôle. C'est de la rédaction,
      pas du code. Moins urgent depuis le 2026-08-11 : ces rôles ont désormais des
      couleurs, il ne leur manque que le texte et la surbrillance.
- [ ] **4 paliers mid manquants** : diamond, master, grandmaster, challenger.

### Code

- [ ] **Code mort à supprimer** (~15 min, sans risque) :
      - `bucketThemes` — déclaré dans le type et rempli pour les 6 paliers, **lu nulle part**.
        Fait doublon avec `fieldQuestions`, qui est le seul branché (dans `/suivi`).
      - `secondary_role` — demandé au joueur à l'onboarding, écrit en base, jamais relu.
      - `wins` / `losses` — remontés par les deux routes API jusqu'au state React, jamais affichés.
- [ ] **`/suivi` ne vérifie pas `onboarded_at`** — un user connecté mais pas onboardé qui
      va directement sur `/suivi` passe. Seul `/` fait l'aiguillage.
- [ ] **Contrainte d'unicité de `games`** encore sur `(user_id, riot_match_id)` : deux
      comptes Riot reliés au même login et présents dans la même partie se marcheraient
      dessus. Le bon couple serait `(user_id, puuid, riot_match_id)`.
- [ ] **`/suivi` charge toutes les games** (`select("*")` sans limite). OK aujourd'hui,
      plus dans six mois.
- [ ] **Spinner de recherche manquant** sur le flux principal. `LoadingDots` existe déjà
      dans [app/page.tsx](app/page.tsx), il ne sert que au panneau « Analyse ».

### Infra / sécurité

- [ ] **Clé Riot de production.** Tant qu'on est en dev key, tout casse toutes les 24 h et
      la perf plafonne à ~4,5 s par recherche.
- [ ] **`/api/riot/import` est publique et non rate-limitée**
      ([lib/supabase/proxy.ts:55](lib/supabase/proxy.ts#L55)). Nécessaire pour l'analyse
      gratuite, mais n'importe qui peut cramer le quota Riot.
- [ ] **README** = encore le boilerplate `create-next-app`. Rien sur `supabase/schema.sql`,
      la `RIOT_API_KEY`, ni le setup.

---

## Choix techniques structurants

Les décisions qu'il ne faut pas défaire sans raison — elles ont chacune coûté une refacto.

- **Aucune colonne dérivée en base.** On stocke les faits bruts (`cs20`, `cs_final`,
  `game_duration_seconds`) ; tout ce qui se calcule se calcule **à la lecture**.
- **`csMetrics` dans [lib/stats.ts](lib/stats.ts) est le chemin unique du CS/min.**
  `/` et `/suivi` passent tous les deux par elle. Ne jamais recalculer un CS/min ailleurs —
  c'est ce qui fait qu'un fix profite aux deux pages d'un coup (vérifié ce 2026-08-10).
- **Les couleurs sont relatives au palier, jamais absolues.** 132 CS à 20 min, c'est bon
  en Iron et faible en Émeraude. Corollaire : **seuils inconnus → on ne dit rien**
  (`unknown`, gris) plutôt que de dire faux. Vaut aussi pour les bandeaux d'analyse.
  Les seuils vivent tous dans [lib/content/thresholds.ts](lib/content/thresholds.ts) et
  dépendent du **palier seul** ; `lib/stats.ts` ne décide que du sens de comparaison
  (plus grand = mieux pour le farm, plus petit = mieux pour les morts).
- **Le compteur affiché et le compteur qui donne la couleur peuvent différer.** Les morts
  en sont le cas : on montre le rythme brut, on colore sur le rythme pondéré. Quand les
  deux divergent, l'écart doit être **visible et explicable** à l'utilisateur (d'où le
  pointillé + l'infobulle), jamais silencieux.
- **Migrations non destructives uniquement.** On ajoute des colonnes, on n'en supprime
  jamais. Le SQL se colle à la main dans l'éditeur Supabase.
- **La clé Riot ne quitte jamais le serveur**, et la région est EUW en dur.
- **Invariant anti-pollution :** les games en base d'un user ne viennent QUE de son compte
  Riot lié. Si le puuid analysé ne correspond pas, `persist = false` — ni lecture du
  cache, ni écriture. L'analyse d'un inconnu reste éphémère.
- **Le Riot ID saisi avant inscription transite par `localStorage`**
  ([lib/pendingRiotId.ts](lib/pendingRiotId.ts)) — et pas `sessionStorage`, parce que le
  lien de confirmation d'email s'ouvre souvent dans un autre onglet.

---

## Lancer et vérifier

```bash
npm run dev            # http://localhost:3000
npx tsc --noEmit       # doit sortir sans rien afficher
npm run build          # le vrai garde-fou avant de pousser
```

Smoke test de l'API sans passer par l'UI :

```bash
curl -s -X POST http://localhost:3000/api/riot/import \
  -H "Content-Type: application/json" \
  -d '{"riotId":"Pseudo#TAG","filter":"soloq"}'
```

Pour trouver un compte de test réellement actif (les comptes de pros sont souvent morts) :
prendre le premier `puuid` de
`https://euw1.api.riotgames.com/lol/league/v4/challengerleagues/by-queue/RANKED_SOLO_5x5`,
puis le résoudre en Riot ID via `/riot/account/v1/accounts/by-puuid/{puuid}`.

Il faut un `.env.local` — voir [.env.local.example](.env.local.example).
