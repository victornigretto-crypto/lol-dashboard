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

### 2026-08-17 (3) — Bouton « Rapporter un problème » sur tous les écrans

**Contexte** — Victor veut recevoir les retours des joueurs par email.

**Changé**
- `FeedbackButton` (client) posé **dans le layout racine**, donc présent partout sans
  qu'aucune page ait à s'en occuper : bouton fixe en haut à droite + fenêtre modale
  (bug / suggestion, texte libre, confirmation après envoi).
- `app/api/feedback/route.ts` : **Resend appelé en `fetch` HTTPS, sans SDK** — décision de
  Victor, `package.json` est resté **strictement inchangé**. Message vide refusé,
  5000 caractères max, **honeypot** (champ hors écran ; s'il est rempli on répond un
  succès ordinaire, pour ne rien apprendre au robot) et **3 envois par IP / 10 min**.
- `/api/feedback` ajoutée aux routes publiques du proxy, comme `/api/riot/import` : sans
  ça, le `fetch` d'un visiteur non connecté recevait une redirection HTML vers `/login`.
- `RESEND_API_KEY` documentée dans [.env.local.example](.env.local.example).

**Vérifié** — `tsc --noEmit`, `npm run test` (109), `npm run build` (14 routes) passent.
Route éprouvée en direct : message vide → 400, honeypot → 200 sans envoi, 4ᵉ envoi → 429,
clé absente → 500 **générique côté client** avec la vraie cause dans les logs serveur.
**Deux vrais emails partis en 200** (un `bug`, un `suggestion`) vers `grosgalio@gmail.com`.
Bouton présent dans le HTML de `/`, `/login`, `/decouvrir`, `/rejoindre`, vu en capture.
**Non vérifié en conditions réelles** : la fenêtre modale n'a jamais été **cliquée** dans un
navigateur, et Resend accepter un envoi ne prouve pas la **réception** en boîte.

> ### Le piège Resend, vécu deux fois
> Tant qu'aucun domaine n'est vérifié, Resend n'accepte d'écrire **qu'à l'adresse
> propriétaire du compte**, et refuse tout le reste en **403** — que le code voit passer et
> traduit en échec générique. Le premier compte appartenait à `victor.nigretto@gmail.com`
> alors que le destinataire visé était `grosgalio@gmail.com` : refus systématique.
> Réglé le 2026-08-17 en **recréant le compte Resend avec `grosgalio@gmail.com`**.
> Conséquence à retenir : **le destinataire ne peut pas changer sans changer de compte
> Resend**, tant qu'aucun domaine n'est posé. Le jour où un domaine sera vérifié, il faudra
> aussi remplacer l'expéditeur `onboarding@resend.dev` dans
> [route.ts](app/api/feedback/route.ts).

> ### Deux variantes, et pourquoi
> Le coin haut droit de `/suivi` est **déjà occupé** (email + déconnexion + carte de
> profil). Deux tentatives de pastille flottante y ont échoué : la première recouvrait
> l'email, la seconde reposait sur la carte. Il n'y a que **12 px** entre le bas de la
> déconnexion et le haut de la carte — aucun bouton lisible n'y tient.
>
> `FeedbackButton` a donc une prop **`variant`** :
> - **`"fixed"`** (défaut, posé par le layout racine) — pastille en haut à droite de
>   l'**écran**, sur tous les écrans ;
> - **`"inline"`** — bouton ordinaire dans le flux, **exactement les classes du bouton
>   « Se déconnecter »**, que `/suivi` pose à sa gauche.
>
> `PAGES_INLINE` liste les chemins qui posent leur propre exemplaire ; la variante
> flottante s'y efface toute seule, donc il n'y en a jamais deux. **Toute page qui ajoutera
> un `variant="inline"` devra y être ajoutée.**
>
> Mesuré à 1680 et 1440 px : les deux boutons ont la **même hauteur (30 px)**, les mêmes
> bords haut et bas (44-74), 8 px d'écart, et ne chevauchent ni l'email, ni la carte, ni
> l'emblème.

### 2026-08-17 (4) — La clé **Riot** se change depuis l'app, par le seul compte admin

**Contexte** — la dev key Riot expire toutes les 24 h ; la remplacer imposait d'éditer
`.env.local` sur la machine qui sert l'app. *(Premier jet visait la clé Resend : malentendu,
corrigé le jour même. La clé Resend reste dans l'environnement, elle n'expire pas.)*

**Changé**
- **Une variable d'environnement ne se réécrit pas à l'exécution** (et en serverless le
  disque est en lecture seule) : la clé déménage donc **en base**. Nouvelle table
  `app_settings` (clé/valeur), migration
  [20260817_app_settings.sql](supabase/migrations/20260817_app_settings.sql) —
  **à lancer par Victor**, rien ne marche avant.
- `lib/settings.ts` : **la base a la priorité, `RIOT_API_KEY` reste le filet de secours.**
  `lib/riot/client.ts` appelle `cleRiot()` au lieu de lire `process.env`.
  **Cache mémoire de 30 s obligatoire** : un seul import déclenche ~43 `riotFetch`, donc
  autant de lectures de la même ligne sans lui. L'écriture vide le cache du process.
- `app/api/admin/riot-key` : `GET` rend l'état **masqué**, `POST` remplace la clé (format
  `RGAPI-` + UUID exigé). Contrôle d'accès **côté serveur**, sur l'email de la session.
- `AdminKeyButton` dans la rangée haut-droite de `/suivi`, aux mêmes classes que ses deux
  voisins. Il ne rend rien pour les autres comptes.
- L'admin est **en dur** dans [lib/admin.ts](lib/admin.ts) : le changer exige un commit,
  donc laisse une trace. Une liste en base ou en env se modifie sans bruit.

**Vérifié** — `tsc --noEmit`, `npm run test` (109), `npm run build` (15 routes) passent.
Appel direct non authentifié de `/api/admin/riot-key` : **307 vers `/login`**, en `GET`
comme en `POST`, rien écrit. **Le repli est prouvé en vrai** : la table n'existant pas
encore, `[settings]` a crié dans les logs et l'app a bien utilisé `RIOT_API_KEY`.
**Non vérifié en conditions réelles** : le refus 403 d'un compte connecté **non**
administrateur (il faudrait un second compte), et l'écran jamais ouvert dans un navigateur.

> **Clé Riot expirée pour la 4ᵉ fois**, constatée ce jour (`401 Unknown apikey`). C'est
> exactement ce que cet écran sert à réparer sans toucher au serveur.

**Reste ouvert** — le bouton n'apparaît que pour l'email **exactement**
`grosgalio@gmail.com` ; les captures de la session montraient `galiogros@gmail.com` puis
`paul.gentil2240@gmail.com`. **Si le compte de l'app n'a pas cette adresse, le bouton
reste invisible** — c'est la première chose à vérifier.

> ### Le secret est en base, et ça a un prix
> `app_settings` n'a **aucune policy RLS**, comme `match_facts` : seule la clé
> `service_role` y accède. Ici ce n'est pas du confort — la table contient un secret en
> clair. Une policy de lecture, même restreinte à un compte, l'exposerait à l'API REST
> donc au navigateur. **La clé ne ressort jamais de l'API**, seulement masquée
> (`re_Dfz••••••••oRBB`) : on la remplace, on ne la relit pas.
> Contrepartie assumée : elle se retrouve **en clair dans toute sauvegarde de la base**.
> Une clé Resend compromise se révoque sur resend.com, elle ne se répare pas.

### 2026-08-17 (2) — Quatre bandes de couleur au lieu de trois

**Contexte** — Victor a recalibré toute la grille et ajouté un **vert pâle** entre le jaune
et le vert, en durcissant le vert existant.

**Changé**
- `StatThreshold` passe de `{green, yellow}` à **`{great, good, warn}`** : trois points de
  coupure, quatre bandes. `Band` gagne `"great"`. Toute la table de
  [thresholds.ts](lib/content/thresholds.ts) est réécrite aux valeurs de Victor.
- Couleurs : vert foncé **`bg-green-700`**, vert pâle **`bg-green-400`** (texte noir).
- `Severity` des bandeaux **n'existe plus séparément** : `= Exclude<Band, "unknown">`, et
  `SEVERITY_CLASS` dérive de `bandClass`. Les deux tables de couleurs jumelles signalées
  en début de session ne peuvent plus diverger.
- Textes des bandeaux réécrits sur 4 niveaux ; **le jaune des morts s'affiche désormais**
  (il était masqué). Détail = mesure + verdict, l'objectif cité étant toujours le
  **vert pâle**, jamais le vert foncé.
- Farm avant 20 min : le détail passe en **CS totaux** (« 146 CS à 20 mins »), seuil
  converti ×20. Le calcul reste en CS/min — seul l'affichage change.
- Winrate : les deux zones vertes se distinguent enfin (vert pâle 50-62 %, vert foncé
  au-dessus). Bornes numériques **inchangées**, seuls les textes ont bougé.

**Puis adouci le jour même**, Victor jugeant la première grille trop sévère : les morts
passent de `warn` 3.0 à **2.5** partout à partir d'argent, avec un vert pâle beaucoup plus
large (≤ 2 jusqu'à platine, ≤ 1.75 en émeraude) ; le vert pâle du farm à 20 min descend en
iron (6.0) et en platine (7.0), et émeraude perd son jaune à 7.0 pour 6.5.

Puis la **zone 0.5 – 1 mort/10 min**, que la grille laissait sans bande sur les paliers
hauts, a été tranchée dans les deux sens : **platine** passe en vert foncé dès **1.0**
(au lieu de 0.5), **émeraude → challenger** étendent leur vert pâle jusqu'à **0.5**.
Émeraude n'a demandé aucun changement de valeur — c'était déjà ce que le code calculait ;
ce qui change est que **c'est désormais une décision et non un effet de bord**, tenue par
un test qui exige que les deux verts se touchent à tous les paliers.

**Le tableau de `/suivi` passe en `table-fixed`** (il était en `auto`) : c'est la seule
façon d'avoir **trois colonnes de questions strictement égales**, l'`auto` calant chaque
colonne sur son contenu — donc inégales, et mouvantes à chaque frappe. Largeurs posées :
Matchup **230** (était 160), V/D 70, CS/20 **74**, CS>20 **80**, Morts **78**, les trois
questions **175** chacune, Résumé **155**. La colonne Matchup s'organise désormais en
**quatre lignes** : visages · noms · lane & file · date & durée.

**Deux changements d'affichage** pour finir : `Banner` gagne un champ **`pinned`** qui
passe **avant** le tri par sévérité, et **« Tu joues trop de rôle !!! » est épinglé** —
il est en tête même quand tout le reste est vert, parce qu'un joueur éparpillé sur 4 rôles
fait moyenner des lanes qui n'ont pas les mêmes attentes. Et sur `/suivi`, « Changer de
profil » devient **« Synchroniser avec un autre compte »**, en rouge plein.

**Vérifié** — `tsc --noEmit`, `npm run test` (**109**), `npm run build` (13 pages) : les
trois passent. Les vrais bandeaux exécutés sur les 20 vraies games de Victor rendent, en
platine, **trois verts pâles** : « Bon farm en lane » (146 CS), « Bon side laner » (7.2),
« Joueur safe » (1.4). Le même échantillon vu en émeraude bascule le farm en jaune, ce qui
confirme que les seuils mordent bien par palier. **Non vérifié en conditions réelles** :
aucune de ces couleurs n'a été vue dans un navigateur — ni les cases du tableau, ni le
rendu du vert pâle à côté du jaune.

**Reste ouvert**
- **Le profil de Victor ne déclenche plus rien** après l'adoucissement : trois bandeaux
  verts, aucune alerte. À regarder si le cockpit paraît devenu trop complaisant.
- *(réglé)* La zone 0.5 – 1 des morts est comblée partout : vert foncé jusqu'à 1.0 en
  platine, vert pâle jusqu'à 0.5 en émeraude → challenger.
- Le détail du pool de champions **ne nomme plus le rôle** qui a déclenché, alors que le
  comptage reste par rôle : « 6 champions sur tes 7 dernières parties » se lit comme un
  total.
- **Le seuil de défilement horizontal du tableau est monté de ~1510 à ~1590 px de
  fenêtre** : c'est le prix de la colonne Matchup élargie. Sur un portable 1440 px, le
  tableau défile désormais dans son cadre alors qu'il tenait avant. Mesuré, pas déduit.
- Sur `/suivi`, le bouton rouge « Synchroniser avec un autre compte » et le bouton de
  confirmation « Changer et supprimer » sont **tous deux en rouge plein et visibles en même
  temps** quand le panneau est ouvert. Le second est irréversible. À départager à l'œil.
- Le texte d'avertissement du panneau dit encore **« Changer de profil supprime
  définitivement tes données »**, formule que le bouton n'emploie plus.

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
