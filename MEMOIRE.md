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

**En production : <https://gg-dashboard-lol.vercel.app>** — projet Vercel `gg-dashboard`
(scope `nigretto`), un seul alias. `gg-dashboard.vercel.app` **tout court est pris par un
tiers**, ne pas repartir le chercher. Un domaine `.vercel.app` n'est public que s'il est
**enregistré sur le projet** (`vercel domains add`) : la protection du projet est réglée sur
`all_except_custom_domains`, tout le reste part en 302 vers le SSO Vercel.

**Les push sur `master` déploient tout seuls** depuis le 2026-08-17 : le dépôt GitHub est
connecté au projet et **`master` est la Production Branch**. Prouvé par un push réel, pas par
une inspection — un déploiement `production` est apparu ~1 min après, avec l'alias
`gg-dashboard-git-master-nigretto.vercel.app` (le motif `-git-<branche>-` n'existe que pour un
déploiement déclenché par Git). **`vercel project inspect` n'affiche aucune section Git même
une fois le dépôt connecté** : son silence ne prouve rien, ne pas s'y fier.

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

> ### Quatre bandes de couleur depuis le 2026-08-17
> Rouge `#e7000b` · jaune `#f0b100` · **vert pâle `#05df72`** · **vert foncé `#008236`**,
> plus le gris `#1d293d` pour « seuils inconnus ». Un seuil s'écrit `{great, good, warn}`
> et l'ordre numérique **s'inverse** entre le farm (on monte) et les morts (on descend) —
> c'est le sens de la comparaison qui change, pas la table.
> **Une seule table de couleurs** (`BAND_CLASS` dans [lib/stats.ts](lib/stats.ts)) : les
> bandeaux en dérivent, ils n'en ont plus de copie.
> L'objectif cité dans un détail de bandeau est **toujours le vert pâle**, jamais le vert
> foncé : on donne le niveau attendu au palier, pas l'excellence.

> ### Le cache partagé de parties (2026-08-16)
> `match_facts` cache les faits d'une partie par `(riot_match_id, puuid)`, **hors de tout
> user**. Une recherche répétée passe de ~86 à ~6 appels Riot, de 6 s à **0,2 s**.
> Deux prérequis d'environnement, tous deux en place chez Victor :
> la table (migration lancée le 2026-08-16) et **`SUPABASE_SERVICE_ROLE_KEY` dans
> `.env.local`** — sans elle le cache se désactive proprement et l'app retombe sur son
> comportement d'avant, avec un avertissement dans les logs.
> **Ne jamais préfixer cette clé `NEXT_PUBLIC_`** : elle contourne RLS.

> ### Ce qui entre dans l'analyse, depuis le 2026-08-18
> Une seule porte : `sampleForAnalysis` dans [lib/sample.ts](lib/sample.ts). **Les 20
> dernières parties**, jamais avant le **18/01/2026**, et **rien de moins de 5 minutes** (les
> remakes sont retirés avant le découpage, ils ne prennent aucune place). La règle « moins de
> 2 mois » n'existe plus.
> Les bandeaux de **stats** (farm avant/après 20, morts) ne jugent que le **rôle principal**.
> « Trop de rôles » et le pool de champions voient **tout l'échantillon**, et seulement la
> SoloQ.
> **Le tableau de `/suivi` n'est PAS filtré** : il porte les notes du joueur, en masquer une
> ferait disparaître son travail.

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
(105 assertions) et `npm run build` passent.

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

### 2026-08-18 — L'échantillon d'analyse change de règle : date, rôle, remakes

**Contexte** — trois demandes de Victor sur ce qui entre dans les stats, plus le message
d'erreur de la clé Riot.

**Changé**
- **[lib/sample.ts](lib/sample.ts), nouveau** : le point de passage UNIQUE de tout ce qui est
  analysé. La règle « moins de 2 mois » est **supprimée** — elle jugeait un joueur peu actif
  sur deux parties. Désormais : **les 20 dernières, plancher dur au 18/01/2026**, et les
  parties de **moins de 5 minutes écartées** (remakes). Les remakes sont retirés AVANT le
  découpage à 20 : ils ne consomment aucune place.
- **Filtre par rôle principal** dans `performanceBanners` : farm avant/après 20 et morts ne
  jugent que les parties du rôle principal. **« Trop de rôles » et le pool de champions
  restent sur tout l'échantillon** — le premier compte justement les rôles, le second a besoin
  des autres rôles pour désigner le plus chargé.
- **`/`** : le repli « plus de 2 mois » disparaît, la liste affiche exactement ce qui est
  analysé. **`/suivi`** : bandeaux sur l'échantillon, **mais le tableau garde toutes les
  games** — il porte les notes écrites à la main.
- **[lib/riot/client.ts](lib/riot/client.ts)** : un 401/403 de Riot rend désormais
  « Expiration de la clef API : Contacter Gros Galio pour lui demander de la refresh » au lieu
  du JSON brut. Le détail technique part dans les logs serveur.

**Vérifié** — `tsc --noEmit`, **128 tests** (15 nouveaux), `npm run build`. Le chemin d'erreur
401/403 est couvert par des tests qui simulent les réponses de Riot ; aucune vraie expiration
n'a été déclenchée. **Non vérifié en conditions réelles** : `/suivi`, qui exige une session.

> ### Deux diagnostics faits sur données réelles, pas au raisonnement
> **Dickapryo#EUW** — Victor pensait que le filtre par rôle avait tué « trop de rôles » et
> « trop de champions ». Preuve du contraire : `performanceBanners(role=null)`, donc SANS
> filtre, rend exactement la même liste. Ils sont muets par leurs propres seuils — 3 rôles
> (il en faut 4) et pool de 3 en bronze (il en faut plus de 3).
> **Chopin Opus 47#Op47** — le « Peux mieux side lane » à 6,2 CS/min est juste : son farm
> avant 20 est bon partout, mais il prend 59 CS en 17 minutes sur une game de 37 min. Les
> games de moins de 20 minutes rendent `null` et ne pèsent pas sur cette moyenne.

**Reste ouvert** — sur un compte comme Dickapryo, faut-il compter les champions tous rôles
confondus, descendre le seuil de rôles à 3, ou inclure Flex et normales dans ces deux
bandeaux ? Question posée, non tranchée.


### 2026-08-17 (6) — Le signalement se scinde : les bugs sur un tableur, les idées par email

**Contexte** — Victor veut que « Rapporter un bug » mène à un Google Sheet plutôt qu'à un
champ de texte. Les suggestions, elles, ne changent pas.

**Changé**
- [FeedbackButton.tsx](app/_components/FeedbackButton.tsx) : la fenêtre s'ouvre désormais sur
  un **menu à deux entrées** au lieu du formulaire coiffé de deux onglets. « Rapporter un
  bug » est une **ancre** vers le tableur (`target="_blank"`, `rel="noopener noreferrer"`) ;
  « Suggérer une amélioration » mène au champ de texte inchangé.
- Une **ancre et non un `window.open`** : le clic du milieu, le « ouvrir dans un nouvel
  onglet » et l'aperçu de l'URL en bas du navigateur n'existent que sur un `<a href>`.
- **Nouvel onglet plutôt que navigation** : signaler un bug depuis `/suivi` ne doit pas faire
  perdre le cockpit et la saisie en cours.
- Le formulaire envoie maintenant toujours `type: "suggestion"` — le chemin « bug » ne passe
  plus par l'API. **[app/api/feedback/route.ts](app/api/feedback/route.ts) n'a pas été
  touchée** : destinataire, 5000 caractères, honeypot, limite de débit, tout est identique.
  Elle accepte encore les deux types, ce qui ne coûte rien.
- Un « ← Retour » discret du formulaire vers le menu : sans lui, un clic à côté obligeait à
  refermer et rouvrir.

**Vérifié** — `tsc --noEmit`, `npm run test` (109), `npm run build` passent. Serveur de dev
lancé : le bouton est bien dans le HTML de `/`, et l'URL du tableur dans le chunk
`app__components_FeedbackButton_tsx`. **Victor a testé dans son navigateur et validé.**
Non testé : l'envoi réel d'un email (il aurait expédié un vrai message).

> **Rappel Resend**, inchangé mais toujours vrai : tant qu'aucun domaine n'est vérifié,
> l'envoi n'aboutit **qu'à** l'adresse propriétaire du compte Resend. Un échec d'envoi n'est
> donc pas forcément un bug du formulaire.


### 2026-08-17 (5) — URL de production en `gg-dashboard`, colonne conclusion élargie

**Contexte** — l'URL Vercel portait encore `lol-dashboard`, et « Résumé / Conclusion » ne
tenait pas dans sa colonne du cockpit.

**Changé**
- **Projet Vercel renommé `lol-dashboard` → `gg-dashboard`.** URL publique :
  **https://gg-dashboard-lol.vercel.app**. `gg-dashboard.vercel.app` tout court est **pris
  par un tiers** (HTTP 200, contenu étranger) — d'où le suffixe. Le renommage **ne suffit
  pas** : Vercel ne réattribue les URLs auto-générées qu'au prochain déploiement, il a fallu
  `vercel alias set` **puis** `vercel domains add`. Sans ce dernier, la protection du projet
  (`ssoProtection: all_except_custom_domains`) renvoyait **302 vers le SSO Vercel** : seul un
  domaine *enregistré sur le projet* est public.
- Les deux anciennes URLs (`lol-dashboard-three`, `lol-dashboard-nigretto`) **supprimées** sur
  demande explicite de Victor. Il ne reste qu'un alias.
- `/suivi` : Matchup **230 → 210 px**, Résumé / Conclusion **155 → 175 px** (désormais la même
  largeur que les 3 questions, le commentaire qui justifiait 155 était devenu faux). **Somme
  des colonnes inchangée à 1212 px** — y toucher fait déborder le cockpit.

**Vérifié** — `tsc --noEmit`, `npm run test` (109), `npm run build` (15 routes) passent.
URL de prod : **HTTP 200**, `<title>GG Dashboard</title>`. Clé Riot en base testée en direct
contre l'API : `league-v4` renvoie **Platinum I, 54 LP, 23V/23D** → le rang a de quoi se
synchroniser. **Non vérifié en conditions réelles** : la largeur de la colonne dans un
navigateur, et le rang réellement affiché dans le cockpit.

> ### Pourquoi « la clé est à jour » et le rang ne revenait pas
> Deux causes qui se cumulent, et aucune ne se voyait :
> `cleRiot()` lit **la base d'abord**, `RIOT_API_KEY` seulement en secours — éditer
> `.env.local` ne change donc **rien** tant qu'une clé traîne dans `app_settings`.
> Et [app/api/riot/import/route.ts:217](app/api/riot/import/route.ts#L217) fait
> `.catch(() => [])` sur le rang : un **401 devient « pas de rang »**, sans erreur nulle part.
> Les games, elles, s'affichent depuis Supabase — d'où l'impression que tout marche sauf le
> rank. **La clé restée dans `.env.local` est toujours l'ancienne, expirée** : inoffensive
> aujourd'hui, piège le jour où la base sera vidée.

**Reste ouvert** — les *Redirect URLs* de Supabase Auth **n'ont pas été touchées**, et
`lol-dashboard-three.vercel.app` sert **encore** le site (voir « Reste à faire »).

> ### Un alias supprimé revient au déploiement suivant
> Supprimer un **alias** (`vercel alias remove`) ne supprime pas l'**enregistrement du
> domaine sur le projet** : au déploiement de production suivant, Vercel ré-aliase tous les
> domaines du projet et les URLs « supprimées » réapparaissent. C'est arrivé aux deux, une
> heure après leur suppression. La vraie suppression se fait dans **Settings → Domains** du
> projet ; le CLI n'expose rien pour ça (`vercel domains remove` ne gère que les domaines
> d'équipe, et un sous-domaine `.vercel.app` n'en est pas un).
> **Cas à part : `<projet>-<scope>.vercel.app`.** Vercel le réattribue à chaque déploiement
> de production, quoi qu'on fasse. Une fois retiré des domaines du projet il retombe
> simplement en **302 vers le SSO** — présent mais non public, et c'est le mieux qu'on
> puisse obtenir. Inutile d'essayer de le supprimer, il reviendra.


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
- [ ] **Les quatre bandes de couleur en vrai.** Recalibrage complet du 2026-08-17,
      **jamais vu dans un navigateur**. À regarder : que le **vert pâle `#05df72` se
      distingue bien du jaune** et du vert foncé sur fond sombre, et que le texte noir du
      vert pâle reste lisible. Les bandeaux de Victor (platine) doivent dire « Bon farm en
      lane » (146 CS), « Bon side laner » (7.2) et « Joueur safe » (1.4) — **trois verts
      pâles, aucune alerte** : valeurs sorties des vraies games, jamais affichées.
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

- [x] ~~Calibrer les cibles de couleur~~ — **recalibré entièrement le 2026-08-17** sur
      quatre bandes ([lib/content/thresholds.ts](lib/content/thresholds.ts)).
      *Réserve levée en partie :* le vert **pâle** des morts est maintenant à 2.0 en iron
      et bronze, 1.5 en argent et or, 1.0 à partir de platine — un joueur bas elo peut
      donc enfin être vert. Le vert **foncé** reste à 1.0 (0.5 à partir de platine), ce qui
      est au-dessus du challenger mesuré à **1,74** : c'est un objectif assumé, pas une
      moyenne. Si le cockpit paraît décourageant, c'est toujours la première valeur à revoir.
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
- [ ] **Seuils de « trop de rôles » et « trop de champions » à retrancher ?** Sur un compte
      comme Dickapryo#EUW (bronze, 3 rôles, pool de 3), les deux se taisent alors que Victor
      s'attendait à les voir. Trois leviers possibles, aucun tranché : compter les champions
      tous rôles confondus (comme avant le 17/08), descendre le seuil de rôles de 4 à 3, ou
      inclure Flex et normales — ces deux bandeaux ne regardent que la SoloQ.
- [ ] **Le message de clé expirée ne s'affiche pas sur `/suivi`.** Le cockpit avale ses échecs
      d'import (`try { … } catch {}`), donc clé morte = rang absent sans un mot. C'est
      pourtant le seul écran où le message servirait vraiment.
- [ ] **L'échec du rang est avalé en silence**
      ([app/api/riot/import/route.ts:217](app/api/riot/import/route.ts#L217)) : `.catch(() => [])`
      transforme un `401 Unknown apikey` en « pas de rang », sans un mot dans la réponse ni
      dans les logs. Comme les games viennent de Supabase, le cockpit paraît sain et seul le
      rang manque — c'est ce qui a coûté un diagnostic complet le 2026-08-17. **Faire remonter
      la raison** au lieu de la masquer, et **prévenir quand la clé en base diffère de celle de
      l'environnement** : rien ne signale aujourd'hui qu'éditer `.env.local` est sans effet.
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
- [ ] **`lol-dashboard-three.vercel.app` sert encore le site** (HTTP 200). Elle est toujours
      enregistrée comme domaine du projet `gg-dashboard` : à retirer dans **Settings →
      Domains** du dashboard Vercel. Le retrait par l'API REST a été tenté puis abandonné —
      il demande le token Vercel, dont la lecture est bloquée côté Claude Code.
- [ ] **Redirect URLs de Supabase Auth jamais revues après le renommage Vercel** du
      2026-08-17 : `lol-dashboard-three` et `lol-dashboard-nigretto` sont **mortes**. Si l'une
      d'elles y est encore déclarée, la connexion en production casse. Se règle dans le
      dashboard Supabase, hors dépôt.
- [ ] **`RIOT_API_KEY` dans `.env.local` est une clé expirée.** Sans effet tant que la base
      en porte une (elle a la priorité), mais c'est un piège différé : le jour où
      `app_settings` est vidée, le repli tombe sur une clé morte.
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
