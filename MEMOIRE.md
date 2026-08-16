# Mémoire de projet — GG Dashboard

> **À lire au début de chaque session. À mettre à jour à la fin de chaque session.**
>
> Le code dit *quoi*. Ce fichier dit *pourquoi*, *où on en était*, et *ce qui coince*.
> Il est le fil entre deux sessions : sans lui, tout le contexte se reperd.
>
> **Historique complet : [MEMOIRE_ARCHIVE.md](MEMOIRE_ARCHIVE.md).** Les entrées plus
> anciennes y sont conservées telles quelles.

## Comment tenir ce fichier

**On archive, on n'efface jamais l'information — mais ce fichier-ci reste court.** Il est
lu en entier au début de chaque session : ce qui n'y est plus utile coûte à chaque fois.

En fin de session : ajouter une entrée datée en haut du journal, puis rafraîchir
« État actuel » et « Reste à faire ».

**Format d'une entrée — fixe, ~15 lignes maximum :**

```
### AAAA-MM-JJ — Titre court

**Contexte** — une phrase : d'où vient la demande.
**Changé** — liste à puces de ce qui a bougé.
**Vérifié** — quoi, comment, résultat. Dire « non vérifié en conditions réelles »
              quand ça dépend d'une vraie session (auth, Supabase, import Riot).
**Reste ouvert** — s'il y a lieu.
```

Pas de narration du débogage, pas de récit des fausses pistes : **ça va dans les messages
de commit**, qui sont faits pour ça et que `git log` retrouve. Ici on écrit l'état, pas le
chemin parcouru.

**Règle de taille :** dès que le journal dépasse **3 entrées actives**, la plus ancienne
part dans [MEMOIRE_ARCHIVE.md](MEMOIRE_ARCHIVE.md) en fin de session — déplacée telle
quelle, jamais résumée ni réécrite.

---

## Le projet en deux lignes

Dashboard League of Legends qui dit à un joueur **sur quoi progresser en fonction de son
palier**, et lui fait noter ses erreurs après chaque partie. L'analyse d'un profil est
gratuite et sans compte ; le suivi dans la durée demande un compte.

---

## État actuel — 2026-08-17

**Stack :** Next.js 16.2.12 (App Router) · React 19.2.4 · Tailwind 4 · Supabase
(auth + Postgres) · API Riot Games (dev key, EUW en dur) · **Vitest** pour les tests.

> ### Le cockpit est un tableau depuis le 2026-08-17
> `/suivi` n'affiche plus des cartes mais un **tableau type tableur** : 9 colonnes
> (matchup · V/D · CS/20min · CS après 20min · morts/10min · les 3 questions du palier ·
> résumé), hauteur de ligne suivant le contenu, saisie directe dans la cellule. Le
> conteneur est passé à **1600 px** — en dessous d'environ **1510 px de viewport**, le
> tableau défile horizontalement à l'intérieur de son cadre (la page, elle, ne déborde
> jamais). **Le mobile est hors périmètre, décision assumée.**
>
> **Signalement, deux niveaux à ne pas confondre :** l'**en-tête** porte un contour bleu
> **fixe** = ce que ton palier doit travailler ; la **cellule** **clignote** uniquement si
> le palier surveille cette stat **ET** qu'elle est rouge.

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
reset / confirmation), les couleurs relatives au palier. `tsc --noEmit`, `npm run test`
(97 assertions) et `npm run build` passent.

**Le contenu pédagogique a été entièrement réécrit par Victor le 2026-08-17** pour les
6 paliers écrits (iron → emerald) : intro, points de progression, et les 3 questions.
Deux incohérences internes assumées par lui et laissées telles quelles : les cibles de
farm des textes ne s'alignent pas toujours sur les seuils de couleur, et émeraude (donc
diamant → challenger) n'a plus aucune stat mise en avant.

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

### 2026-08-17 — Cockpit en tableau, contenu des 6 paliers, outillage de test

**Contexte** — suite de la même session que l'entrée du 2026-08-16 : parcours public,
puis refonte du cockpit et rédaction du contenu pédagogique.

**Changé**
- Outillage : **Vitest** installé (`npm run test` / `test:watch`), **97 assertions** sur
  `lib/`. Definition of done dans [CLAUDE.md](CLAUDE.md) + garde-fous (rien à l'échelle
  système sur cette machine, rien de destructif sans demande).
- MEMOIRE.md borné à 3 entrées, le reste dans [MEMOIRE_ARCHIVE.md](MEMOIRE_ARCHIVE.md).
  `supabase/migrations/` créé avec sa convention.
- Parcours public : bandeau bleu **« Me connecter pour analyser ma progression »** sur `/`
  et sur l'écran de résultat ; déconnexion vers `/` ; « Continuer sans se connecter » sur
  `/login` ; le mot « gratuite » retiré de l'UI.
- `/suivi` : les cartes deviennent un **tableau type tableur** (9 colonnes, hauteur de
  ligne variable, saisie dans la cellule, réponses multiples conservées). Conteneur élargi
  à **1600 px** — choix de Victor contre l'alternative du panneau d'analyse repliable.
- **Contenu réécrit pour les 6 paliers** (intro, points, 3 questions) + nouveau
  `highlightFields` pour mettre une question en avant, pas seulement une stat.
- Signalement : **contour bleu fixe sur l'en-tête** (ce que le palier travaille),
  **clignotement sur la cellule** seulement si le palier surveille la stat ET qu'elle est
  rouge.

**Vérifié** — `tsc --noEmit`, `npm run test` (97), `npm run build` (13 pages) : les trois
passent. Rendu et mesures (largeurs, hauteurs de ligne, contours) faits sur maquette servie
avec le **CSS compilé de l'app**. **Non vérifié en conditions réelles** : `/suivi` exige une
session, et l'accueil reste incapturable en headless.

**Reste ouvert** — mobile hors périmètre (sous ~1510 px de viewport le tableau défile
horizontalement) ; `bucketThemes` décrit encore l'ancien contenu et reste code mort.

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

- [ ] **Le tableau de `/suivi` avec de vraies données.** Refonte complète du 2026-08-17,
      **jamais vue en conditions réelles** : `/suivi` exige une session. À regarder en
      priorité — la saisie dans les cellules, l'ajout d'une réponse (« Autre chose ? »), la
      hauteur de ligne qui suit le contenu, et surtout que **les notes existantes soient
      toujours là**.
- [ ] **L'accueil `/` et l'écran de résultat** après la refonte des bandeaux bleus.
      **Non vérifiés visuellement** : Chrome headless reste bloqué sur `LoadingDots` sur
      `/` (`supabase.auth.getUser()` ne résout jamais, aucune requête émise ; piste :
      `navigator.locks`), alors que la page marche dans un vrai navigateur. **20 secondes
      d'œil suffisent à lever le doute.**
- [ ] **Le signalement en vrai.** Contour fixe des en-têtes et clignotement des cellules
      n'ont été validés que sur maquette avec le CSS compilé. En platine seul « CS après
      20 min » est concerné : un compte iron → gold montre davantage (Lemyy#1376 est
      **iron III**, les 3 en-têtes doivent y être contourés).
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
        Depuis la réécriture du 2026-08-17 il décrit en plus du contenu qui n'existe plus.
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

- [ ] **Le mobile du tableau de `/suivi`.** Hors périmètre, décision assumée du
      2026-08-17. Constat mesuré : la page ne déborde jamais, mais sous ~1510 px de
      viewport le tableau défile horizontalement dans son cadre (356 px visibles à 390 px
      d'écran, 922 px à 1280 px). Sur un portable 1280/1440 c'est déjà sensible — le
      panneau d'analyse repliable (option B écartée ce jour) redeviendrait pertinent, **en
      complément** de l'élargissement, pas à sa place.

### Infra / sécurité

- [ ] **Clé Riot de production.** Tant qu'on est en dev key, tout casse toutes les 24 h et
      la perf plafonne à ~4,5 s par recherche.
- [ ] **`/api/riot/import` est publique et non rate-limitée**
      ([lib/supabase/proxy.ts:55](lib/supabase/proxy.ts#L55)). Nécessaire pour l'analyse
      gratuite, mais n'importe qui peut cramer le quota Riot.
- [ ] **README** = encore le boilerplate `create-next-app`. Rien sur `supabase/schema.sql`,
      la `RIOT_API_KEY`, ni le setup.
- [ ] **3 vulnérabilités `high` remontées par `npm audit`** (relevé le 2026-08-16, non
      traité). Elles sont dans l'arbre de **`next`**, via `postcss` et `sharp` — **pas**
      dans Vitest, qui tire `vite`/`esbuild`/`rollup` et n'apparaît nulle part dans la
      chaîne. Le correctif serait donc une montée de version de Next, pas un retrait de
      Vitest. `npm audit fix --force` **n'a pas été lancé** : il change des versions
      majeures, ce qui mérite sa propre session avec les trois vérifications derrière.

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
- **Les liserés bleus se dessinent en `inset`, jamais à l'extérieur.** Un `box-shadow`
  extérieur sur une cellule de tableau **n'apparaît pas du tout** : les cellules voisines,
  opaques et collées, le recouvrent. `getComputedStyle` renvoie pourtant l'ombre, donc le
  bug est invisible en relecture. Mesuré le 2026-08-16 : ni `border-collapse: separate`, ni
  `position: relative` + `z-index` n'y changent quoi que ce soit — seul l'`inset` rend.
- **Deux signaux, deux rendus.** L'**en-tête** porte un contour **fixe** (« ton palier
  travaille ça », constant) ; la **cellule clignote** (« ça cloche ici, sur cette game »),
  et seulement au croisement **palier surveillé × valeur rouge**. Les confondre casse les
  deux : sur le seul rouge l'alerte désigne la mauvaise stat, sur le seul palier une case
  verte clignote, et en iron cinq en-têtes clignotants noieraient l'unique case à corriger.
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
npm run test           # Vitest, une passe (lib/**/*.test.ts)
npm run test:watch     # Vitest en continu pendant qu'on code
```

Les trois dernières forment la **definition of done** ([CLAUDE.md](CLAUDE.md)) : une tâche
n'est pas finie tant qu'elles ne passent pas toutes les trois.

**Ne pas lancer `npm run build` pendant que `npm run dev` tourne** : les deux se disputent
`.next`, et ce dossier a déjà fait tomber la machine (archive, 2026-08-13).

Les tests vivent à côté du code qu'ils couvrent (`lib/stats.test.ts` près de
`lib/stats.ts`). Config dans [vitest.config.mts](vitest.config.mts) — extension `.mts`
parce que le projet n'est pas en `"type": "module"`.

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
