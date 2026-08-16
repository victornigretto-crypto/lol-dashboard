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

## État actuel — 2026-08-16

**Stack :** Next.js 16.2.12 (App Router) · React 19.2.4 · Tailwind 4 · Supabase
(auth + Postgres) · API Riot Games (dev key, EUW en dur).

> ### Le cache partagé de parties (2026-08-16)
> `match_facts` cache les faits d'une partie par `(riot_match_id, puuid)`, **hors de tout
> user**. Une recherche répétée passe de ~86 à ~6 appels Riot, de 6 s à **0,2 s**.
> Deux prérequis d'environnement, tous deux en place chez Victor :
> la table (migration lancée le 2026-08-16) et **`SUPABASE_SERVICE_ROLE_KEY` dans
> `.env.local`** — sans elle le cache se désactive proprement et l'app retombe sur son
> comportement d'avant, avec un avertissement dans les logs.
> **Ne jamais préfixer cette clé `NEXT_PUBLIC_`** : elle contourne RLS.

> **`npm run dev` refonctionne** depuis le 2026-08-13. Il figeait la machine à cause d'un
> cache Turbopack corrompu (voir le journal) ; `.next` a été supprimé et le serveur sert
> `/` en ~7 s, à froid comme à chaud. Aucun code n'a été modifié pour ça.

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

> ### Migrations à jour au 2026-08-16
> Trois vagues, **toutes lancées et confirmées par Victor** :
> `games.puuid` (2026-08-10), `games.deaths` + `games.deaths_last5` (2026-08-11), puis la
> table `match_facts` (2026-08-16).
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

**Le trou principal :** le contenu pédagogique n'est écrit **que pour le rôle mid**, et
seulement de **iron à emerald**. Depuis le 2026-08-13 il est toutefois **emprunté** partout
ailleurs — émeraude pour diamant → challenger, le mid du même palier pour les quatre autres
rôles — donc questions d'erreurs et surbrillance sont servies à tout le monde. Seules les
**recommandations** restent réservées au contenu réellement écrit : partout ailleurs, le
bloc « Sur quoi progresser » affiche « Pas encore développé pour ton palier et ton rôle ».
Il n'y a plus que `unranked` pour retomber sur le générique complet. **Les couleurs** ne
dépendent plus du rôle depuis le 2026-08-11 : un joueur top ou support a un tableau coloré
même sans contenu écrit.

---

## Journal des sessions

### 2026-08-16 — Le cache partagé : une recherche coûtait 86 appels Riot pour un quota de 100

**Le symptôme rapporté :** « il ne se passe rien quand j'appuie sur Entrée ». Il se passait
quelque chose — le « ... » du bouton **est** l'indicateur de chargement
([page.tsx:369](app/page.tsx#L369)) — mais la réponse mettait jusqu'à **3 minutes**. Le log
du serveur montre l'emballement : `4.1s → 8.5s → 57s → 63s → 3.0min`.

**La cause immédiate**, et le chiffre à retenir : **une seule recherche depuis l'accueil
coûtait ~86 appels Riot, pour un quota de 100 par 2 minutes.** Le détail : `handleSubmit`
appelle `search(riotId, "soloq")` (43 appels), **puis** `handleAnalyze` refait un import
complet avec le filtre `ranked` (43 de plus) — et les deux listes se recouvrent largement,
donc on retéléchargeait les mêmes parties 4 secondes après. Le log le confirme : les `POST
/api/riot/import` arrivent **systématiquement par paires**. Victor ne pouvait donc pas
faire deux recherches d'affilée sans saturer le quota ; ce n'était pas son comportement,
c'était le premier clic.

**La cause profonde — personne ne possédait l'accès à Riot.** `lib/riot/client.ts` était un
wrapper de transport (URL + clé + retry naïf). Combien d'appels, à quelle fréquence, mis en
cache ou pas, annulable ou pas : chaque appelant décidait dans son coin, et **le budget
global n'appartenait à personne**. Corollaire structurel : le seul cache existant était
`games`, indexé par `(user_id, puuid)` — donc **l'analyse gratuite, le parcours de chaque
visiteur, était le seul chemin sans aucun cache**, et c'est aussi celui qui faisait le
travail en double.

**Ce qui a été livré : le cache partagé `match_facts`.** Une partie terminée est une donnée
**publique et immuable** ; elle n'a rien à faire dans une table qui appartient à un user.
Nouvelle table, clé `(riot_match_id, puuid)` — et pas `riot_match_id` seul, parce qu'une
partie contient 10 joueurs dont les faits diffèrent. Deux joueurs de la même partie se
partagent donc réellement le cache, chacun sur sa ligne : le bénéfice grandit avec le
nombre d'utilisateurs, ce qui est la direction voulue par Victor (« potentiellement plus
d'utilisateurs un jour »).

| | avant | après |
|---|---|---|
| recherche à froid | 6,0 s | 3,3 s |
| **recherche répétée** | **6,0 s** | **0,23 – 0,58 s** |
| appels Riot, recherche répétée | ~86 | ~6 |

**Trois décisions à ne pas défaire :**

1. **On cache les faits extraits, jamais le brut.** Mesuré ce jour : un match pèse 77 Ko et
   sa timeline **827 Ko** — 17,7 Mo pour 20 parties. Une ligne de `match_facts` fait
   ~200 octets. Et ce sont les mêmes faits bruts que `games` (`cs20`, `cs_final`, `deaths`,
   `deaths_last5`) : les CS/min, la pondération et les couleurs restent calculés à la
   lecture, donc **une règle qui change n'oblige jamais à purger le cache**.
2. **La table n'a AUCUNE policy RLS**, et c'est le point de sécurité. RLS active sans policy
   = tout refusé à `anon` et `authenticated` ; seule la clé `service_role` passe
   ([lib/supabase/admin.ts](lib/supabase/admin.ts)). Ouvrir l'écriture à `anon` permettrait
   d'insérer de faux faits par l'API REST, **resservis ensuite à tous les autres
   utilisateurs** comme s'ils venaient de Riot. Aucune policy SQL ne peut vérifier qu'une
   ligne vient de Riot : garder l'écriture côté serveur est la seule protection.
3. **`games` reçoit désormais TOUTES les lignes affichées, plus seulement les nouvelles.**
   C'est le piège que le cache crée : une partie servie par `match_facts` n'est jamais
   retéléchargée, donc en n'écrivant que les nouvelles elle n'atterrirait **jamais** dans les
   games du joueur — et `/suivi`, qui lit `games` en direct, afficherait un cockpit vide.
   L'upsert est idempotent et n'énumère toujours pas les colonnes de notes.

L'invariant anti-pollution est intact : `persist` ne gouverne plus que `games`. Le cache
partagé n'appartient à personne, l'alimenter depuis l'analyse d'un inconnu est sans risque.

**Le bug attrapé par le test, et la leçon de méthode.** Après avoir branché le cache, j'ai
comparé **octet pour octet** la réponse servie par le cache et celle d'un appel Riot
complet, cache vidé puis reconstruit. Divergence de **exactement 100 octets** : Postgres
rend un `timestamptz` en `...+00:00` là où `toISOString()` donne `...Z` — 5 caractères ×
20 lignes. `new Date()` parse les deux à l'identique, donc **rien n'aurait cassé et rien ne
serait jamais apparu dans un log** ; mais la même partie sortait avec deux `played_at`
différents selon l'état du cache. Un cache dont la sortie dépend de son propre état n'est
plus transparent. Normalisé à la lecture (`normalize` dans
[matchCache.ts](lib/riot/matchCache.ts)), re-vérifié identique. **La comparaison
octet-à-octet cache chaud / cache froid est LE test à refaire sur tout cache futur.**

**Sécurité vérifiée dans les deux sens**, avec le contrôle anti-faux-positif : `INSERT`
anonyme refusé (401), lecture anonyme à 0 ligne **alors que la table en contenait 20**, et
la même clé anon renvoie bien 200 sur `games` — donc le refus vient de RLS et pas d'une clé
invalide.

**Dégradation gracieuse :** sans `SUPABASE_SERVICE_ROLE_KEY`, `createAdminClient()` renvoie
`null`, un avertissement part dans les logs et l'app retombe exactement sur son
comportement d'avant. Testé avant que la clé soit posée. Le cache est une optimisation,
jamais une dépendance.

**Clé Riot expirée, encore** (troisième fois). Même symptôme qu'au 13/08. À faire en premier
réflexe le matin. La nouvelle clé a été relue par Next **sans redémarrage**, comme la
dernière fois.

**Parcours utilisateur — 4 changements demandés par Victor**, livrés :
1. Accueil : le lien « Déjà un compte ? Connecte-toi » devient un bandeau bleu clair
   **« Je veux analyser mes erreurs » → `/login`**. On ne propose plus une formalité de
   compte, on nomme ce que le compte apporte.
2. Écran de résultat de l'analyse gratuite : **reprend la disposition de `/suivi`** —
   bandeau d'identité (Riot ID + rôle + rang empilé), « Sur quoi progresser » en pleine
   largeur en bleu, puis analyse à gauche / historique à droite. Le rôle y est déduit des
   games (`dominantRole`), un compte public n'ayant pas de `primary_role`.
3. Un second bandeau **« Analyser mes erreurs »** s'intercale **entre les axes de
   progression et l'historique** — là où le visiteur vient de voir ses erreurs sans pouvoir
   les noter.
4. La déconnexion mène à `/` et non `/login` ; `/login` gagne un
   **« ← Continuer sans se connecter »** en haut à gauche. Arriver sur le formulaire n'est
   plus un cul-de-sac.

`AnalyzeErrorsBanner` est défini **une seule fois** dans `page.tsx` et utilisé aux deux
endroits — deux copies auraient divergé, comme l'avaient fait les bandeaux d'analyse avant
`lib/banners.ts`.

**Ce qui N'A PAS pu être vérifié, et pourquoi.** J'ai piloté Chrome en CDP pour capturer les
écrans. `/login` s'affiche et son lien de sortie est confirmé par requête DOM. Mais **`/`
reste bloqué sur `LoadingDots` en headless** : `supabase.auth.getUser()` ne résout jamais et
**aucune requête vers Supabase n'est émise** (toutes les requêtes réseau sont des chunks
Next). Aucune exception, aucun 4xx, `localStorage` fonctionne, et `/login` s'hydrate
normalement — donc React tourne. Reproduit en `--headless=new` **et** `--headless=old`.
C'est un artefact du headless : l'accueil anonyme s'affiche bien dans le navigateur de
Victor (capture au début de la session). **Piste pour la prochaine fois :** supabase-js
sérialise ses accès session via `navigator.locks` ; c'est le premier endroit à regarder.
Conséquence : **les points 1 et 2 du parcours n'ont été validés que par `tsc` et relecture.**

> **Le piège de mesure du 10/08 s'est confirmé autrement.** Le benchmark « 4,8 s » de cette
> date portait sur **une recherche isolée à froid**. Personne n'avait mesuré **deux
> recherches d'affilée**, qui est le comportement réel. Le chiffre était juste, le scénario
> faux — et c'est ce qui a laissé passer le facteur 2 de `handleAnalyze` pendant six jours.
> Toujours mesurer la répétition, pas seulement le premier coup.

**Le plan restant, décidé avec Victor** (priorités : fluidité + tenir la montée en charge) :
slice 2 = **annulation de bout en bout** (`AbortSignal`, avec un traitement à part pour le
chemin d'écriture de `/suivi`) ; slice 3 = **états de chargement honnêtes** ; slice 4 =
**régulateur de débit**, à faire au moment du déploiement car il lui faut un état partagé
(un seau à jetons en mémoire est faux dès qu'il y a plusieurs instances serverless).
**Le fix « supprimer le double import » a été abandonné volontairement** : le cache le rend
quasi gratuit, et les deux appels en parallèle font s'afficher le winrate SoloQ sans
attendre l'analyse ranked — on ne sacrifie pas ça pour des appels qu'on ne paie plus.

### 2026-08-13 (2) — Clé Riot expirée : le rang **et** les recommandations tombent ensemble

**Premier vrai test de Victor dans l'app** (enfin — après trois sessions de code non vérifié).
Symptôme rapporté sur `/suivi` : plus d'emblème, plus de palier, plus de LP, et plus de bloc
« Sur quoi progresser ». Le reste du cockpit s'affichait normalement, games et couleurs
comprises.

**Une seule cause pour les deux symptômes : la dev key avait expiré.** Confirmé en une
requête, sans toucher au code :

```
{"error":"Riot API 401 ... {\"message\":\"Unknown apikey\",\"status_code\":401}"}
```

**L'enchaînement, qui est le vrai truc à retenir.** Une clé morte ne fait pas que retirer
le badge de rang : `res.ok` est faux → `currentRank` reste `null` → le palier de référence
retombe sur le **`former_rank` saisi à l'onboarding**
([suivi/page.tsx:152](app/suivi/page.tsx#L152)). Si ce `former_rank` est un palier sans
contenu écrit, les recommandations disparaissent **aussi**, sans le moindre message.
Deux symptômes très différents, une seule panne. À se rappeler avant de chercher deux bugs.

Vraie valeur une fois la nouvelle clé posée dans `.env.local` : `PLATINUM I, 22 LP`. Victor
est donc **platine**, pas diamant — le contenu platine existe, tout est revenu. À noter :
**Next relit `.env.local` tout seul**, aucun redémarrage du serveur n'a été nécessaire.

**Décision de Victor sur les paliers/rôles sans contenu** (prise ce jour, « pour le
moment ») : plutôt que de retomber sur le générique, on **emprunte** le contenu écrit le
plus proche — émeraude pour diamant → challenger, et le mid du même palier pour les quatre
autres rôles. Mais **les recommandations ne s'empruntent pas** : le bloc affiche
« Pas encore développé pour ton palier et ton rôle ». Les questions d'erreurs et la
surbrillance, elles, sont bien servies.

Conséquence visible : le bloc « Sur quoi progresser » **ne disparaît plus jamais**. Avant,
`{!content.inDevelopment && ...}` le faisait s'évanouir sans explication sur `/` et
`/suivi` ; il est maintenant toujours rendu, avec l'avertissement à la place du contenu
(c'est déjà ce que faisait `/onboarding`). Mécanique : une table `CONTENT_TIER` dans
[mid.ts](lib/content/mid.ts), et `getContent` renvoie `{ ...written, inDevelopment: true }`
quand le contenu est emprunté — le contenu écrit n'est jamais muté au passage.

**Réserve à surveiller :** les questions empruntées sont rédigées pour le mid. Elles sont
globalement neutres (« Es-tu mort en lane ? Pourquoi ? »), mais les `focusPoints` d'où elles
viennent parlent de 2v2 mid-jungle et d'aram mid. Si un joueur support trouve ça à côté de
la plaque, c'est le premier endroit où regarder.

**Vérifications :** `tsc --noEmit` OK, et **41 assertions** sur le vrai `getContent` exécuté
via Node 24 (les 6 paliers mid intacts, l'emprunt d'émeraude pour les 4 paliers du haut,
les 4 rôles, `unranked` qui retombe bien sur le générique, et la non-mutation du contenu
écrit) — toutes vertes. `npm run build` **pas encore lancé** : le serveur de dev tournait,
on ne fait pas les deux en même temps vu l'historique de `.next`.

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

---

## Reste à faire

Classé par ce que ça rapporte, pas par difficulté.

### À vérifier en tout premier (rien n'a encore été testé en vrai)

**Le cockpit a enfin été ouvert en vrai le 2026-08-13** (capture d'écran à l'appui). Ce qui
suit est donc à jour ; ce qui reste coché « à faire » ne l'est vraiment pas.

Vu et validé sur la capture du 2026-08-13 :

- [x] ~~Le cockpit charge, un seul compte Riot~~ — plus de mélange, uniquement
      `Chopin Opus 52#1849`.
- [x] ~~Le CS/min après 20 min affiche des valeurs~~ — 7.6, 5.1, 7.1 sur les trois premières
      games. Le « — » définitif appartient au passé.
- [x] ~~Les couleurs s'appliquent~~ — vert / jaune / rouge présents sur les trois stats.
- [x] ~~Les bandeaux de gauche apparaissent sur `/suivi`~~ — « Peut mieux farm en lane » et
      « Peux mieux side lane ». *L'ordre vert → jaune → rouge n'est pas vérifié pour autant :
      la capture ne montrait que des bandeaux jaunes.*
- [x] ~~Les morts en pointillé~~ — visibles sur la game de 34:50 (2.3 souligné en pointillé).
      L'infobulle au survol reste à confirmer.

Reste vraiment à vérifier :

- [ ] **L'accueil `/` et l'écran de résultat de l'analyse gratuite** après la refonte du
      2026-08-16 (bandeaux bleus + disposition reprise de `/suivi`). **Non vérifiés
      visuellement** : Chrome headless reste bloqué sur `LoadingDots` sur `/`, alors que la
      page marche dans un vrai navigateur (voir le journal). `tsc` passe, le reste est de la
      relecture. **20 secondes d'œil suffisent à lever le doute.**
- [ ] **`/suivi` affiche bien les 20 games ET les notes** après le passage au cache partagé.
      L'écriture dans `games` a changé (toutes les lignes affichées, plus seulement les
      nouvelles) et ce chemin exige une session connectée : jamais exécuté en test. Le
      bandeau et les recommandations, eux, sont confirmés par capture du 2026-08-16.
- [ ] **Le clignotement des stats prioritaires** est agréable et pas épileptique (1,4 s par
      cycle — à ajuster dans [globals.css](app/globals.css)). Non vérifiable sur une capture,
      et invisible en platine dont `highlightStats` est vide : il faut un compte iron → gold.
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

Rendu **beaucoup moins urgent** par l'emprunt décidé le 2026-08-13 : plus personne ne tombe
sur du générique, et seules les recommandations manquent à l'appel. C'est de la rédaction,
pas du code.

- [ ] **4 rôles sur 5 n'ont aucun contenu propre** : top, jungle, adc, support empruntent le
      mid ([lib/content/mid.ts](lib/content/mid.ts)). Le squelette est prêt — il suffit d'un
      `Partial<Record<Tier, TierContent>>` par rôle, et de brancher `getContent` dessus
      **avant** de retomber sur le mid.
- [ ] **4 paliers mid manquants** : diamond, master, grandmaster, challenger — ils empruntent
      émeraude. Victor est platine en août 2026, donc ça ne le concerne pas encore.

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
      *Repris par la slice 3 ci-dessous.*

#### Les slices convenues le 2026-08-16 (suite du cache partagé)

Priorités posées par Victor : **fluidité** d'abord, et **tenir la montée en charge**.

- [ ] **Slice 2 — annulation de bout en bout.** Propager `request.signal` de la route
      jusqu'aux `fetch` de [lib/riot/client.ts](lib/riot/client.ts), + un `AbortController`
      côté client au démontage et à chaque nouvelle recherche. Aujourd'hui, fermer l'onglet
      n'arrête que l'attente du navigateur : le serveur continue de dérouler ses appels et
      de brûler le quota pour un résultat que personne ne lira — **la navigation est un
      amplificateur de charge**. *Piège identifié :* la politique doit différer selon le
      chemin — sur `/suivi` l'import **écrit** aussi la réparation en base, donc l'annuler
      ferait recommencer la réparation à chaque visite. Et StrictMode de React 19
      double-invoque les effets en dev : la première requête sera annulée aussitôt, ce qui
      ressemble à un bug sans en être un.
- [ ] **Slice 3 — états de chargement honnêtes.** Le « ... » ne distingue pas « 4 s, tout va
      bien » de « étranglé, ce sera 3 minutes ». Afficher un état explicite, et un message
      franc sur 429 au lieu du silence.
- [ ] **Slice 4 — régulateur de débit**, à faire **au moment du déploiement**. Un seau à
      jetons au niveau module est **faux dès qu'il y a plusieurs instances serverless**
      (N instances = N seaux = N × la limite) : il lui faut un état partagé. À noter aussi
      qu'il ne crée pas de budget — il rend l'attente ordonnée, pas plus courte. Il ne
      devient utile qu'après la baisse du volume d'appels, donc maintenant.
- [x] ~~Supprimer le double import de `handleAnalyze`~~ — **abandonné volontairement le
      2026-08-16**. Le cache rend le second appel quasi gratuit, et les deux appels en
      parallèle font s'afficher le winrate SoloQ sans attendre l'analyse ranked. Dériver la
      SoloQ depuis `ranked` aurait réduit l'échantillon de façon **variable selon le
      joueur** — une régression statistique invisible en test.

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
- **Un contenu manquant s'emprunte, une recommandation ne s'emprunte pas.** Questions
  d'erreurs et surbrillance sont reprises du contenu écrit le plus proche (émeraude pour
  les paliers au-dessus, le mid pour les autres rôles) ; les recommandations, elles,
  affichent franchement « pas encore développé ». Même esprit que les couleurs : on préfère
  **dire qu'on ne sait pas** plutôt que de dire quelque chose d'à peu près juste. Corollaire :
  le bloc « Sur quoi progresser » est **toujours rendu**, jamais escamoté.
- **Une donnée publique et immuable ne se cache pas dans une table qui appartient à un
  user.** Les faits d'une partie terminée sont les mêmes pour tout le monde : ils vivent
  dans `match_facts`, clé `(riot_match_id, puuid)`, sans `user_id`. `games` reste la vue
  personnelle (les notes, l'historique du joueur). Tant que le cache vivait dans `games`,
  l'analyse gratuite — le parcours de **chaque visiteur** — était le seul chemin sans cache.
  Corollaire de sécurité : cette table n'a **aucune policy RLS** et n'est écrite que par la
  clé `service_role`, parce qu'aucune policy SQL ne peut vérifier qu'une ligne vient bien
  de Riot.
- **Tout cache se valide par comparaison octet-à-octet chaud / froid.** Un cache dont la
  sortie diffère de la source, même sur un détail de format, n'est plus transparent — et
  l'écart ne se voit dans aucun log. C'est ce test qui a attrapé le `+00:00` / `Z` du
  2026-08-16.
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
