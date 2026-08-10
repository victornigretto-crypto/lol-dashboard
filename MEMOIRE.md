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

## État actuel — 2026-08-10

**Stack :** Next.js 16.2.12 (App Router) · React 19.2.4 · Tailwind 4 · Supabase
(auth + Postgres) · API Riot Games (dev key, EUW en dur).

**Le parcours complet, dans l'ordre :**

```
/            analyse gratuite, sans compte (redirige vers /suivi si déjà connecté)
/decouvrir   écran de motivation 1/2 — on nomme le problème
/rejoindre   écran de motivation 2/2 — la réponse + la contrepartie
/login       création de compte (?mode=signup)
/onboarding  liaison du compte Riot + rang + rôles + pyramide + focus du palier
/suivi       le cockpit : les games + les 3 champs d'erreurs à remplir
```

**Ce qui marche, vérifié en session :** import Riot de bout en bout (compte → 20 games →
rang), cache en base, garde-fou anti-pollution, auth Supabase complète (login / signup /
reset / confirmation), les couleurs relatives au palier. `tsc --noEmit` et `npm run build`
passent.

**Le trou principal :** le contenu pédagogique n'existe **que pour le rôle mid**, et
seulement de **iron à emerald**. Tout le reste tombe sur `FALLBACK_CONTENT`
(« En cours de développement ») : pas de cibles, donc pas de couleurs, donc un cockpit gris.

---

## Journal des sessions

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

### Décisions qui n'appartiennent qu'à Victor

- [ ] **Calibrer les cibles `deaths10Target` et `csPerMinTarget`** ([lib/content/mid.ts](lib/content/mid.ts)).
      10 marqueurs `PLACEHOLDER — à valider par Victor`. Les valeurs actuelles sont
      inatteignables : le compte challenger mesuré fait **1,74 morts/10 min**, alors que
      la cible Iron est à 1.5 et la cible Émeraude à 1.0. Un joueur Iron sera rouge sur
      quasiment toutes ses games.
- [ ] **Le mapping niveau de pyramide ↔ rang** ([lib/content/pyramid.ts:22](lib/content/pyramid.ts#L22)).
      `TIER_PYRAMID_LEVELS` est un premier jet déduit des `focusPoints`, marqué
      `TODO Victor`. C'est ce qui pilote la pyramide de l'onboarding.

### Contenu (le gros morceau)

- [ ] **4 rôles sur 5 n'ont aucun contenu** : top, jungle, adc, support tombent sur le
      fallback ([lib/content/mid.ts:167](lib/content/mid.ts#L167)). Le squelette est prêt —
      il suffit d'un `Partial<Record<Tier, TierContent>>` par rôle. C'est de la rédaction,
      pas du code.
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
  en Iron et faible en Émeraude. Corollaire : **cible inconnue → on ne dit rien**
  (`unknown`, gris) plutôt que de dire faux. Vaut aussi pour les bannières d'analyse.
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
