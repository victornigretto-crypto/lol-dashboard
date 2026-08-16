-- A executer une seule fois dans Supabase : Dashboard > SQL Editor > New query.

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lane text not null default '',
  champion text not null default '',
  matchup text not null default '',
  result text not null default 'Victoire',
  cs20 numeric not null default 0,
  deaths10 numeric not null default 0,
  error_lane text[] not null default '{}',
  error_macro text[] not null default '{}',
  error_fight text[] not null default '{}',
  summary text not null default '',
  created_at timestamptz not null default now()
);

alter table public.games enable row level security;

-- Chaque utilisateur ne voit et ne modifie que ses propres games.
create policy "games_select_own" on public.games
  for select using (auth.uid() = user_id);

create policy "games_insert_own" on public.games
  for insert with check (auth.uid() = user_id);

create policy "games_update_own" on public.games
  for update using (auth.uid() = user_id);

create policy "games_delete_own" on public.games
  for delete using (auth.uid() = user_id);

-- Import automatique depuis l'API Riot : identifie la game d'origine pour
-- éviter de la réimporter deux fois (colonne nulle pour les games saisies à
-- la main ; une contrainte UNIQUE standard autorise plusieurs NULL, donc pas
-- besoin d'index partiel — et ON CONFLICT de Supabase exige une contrainte
-- "pleine", pas un index partiel).
alter table public.games add column if not exists riot_match_id text;

drop index if exists public.games_user_riot_match_id_key;

alter table public.games
  drop constraint if exists games_user_riot_match_id_key;

alter table public.games
  add constraint games_user_riot_match_id_key unique (user_id, riot_match_id);

-- File de la game (Normal / SoloQ / Flex), pour l'affichage et pour servir
-- de cache : une game déjà en base n'a pas besoin d'être re-demandée à l'API
-- Riot.
alter table public.games add column if not exists queue text;

-- Date réelle de la partie (renvoyée par Riot), utilisée pour l'affichage et
-- pour restreindre les moyennes d'analyse aux games récentes.
alter table public.games add column if not exists played_at timestamptz;

-- Lien persistant entre un user et SON compte Riot (un seul compte par
-- user). Sert d'invariant : le contenu de `games` pour un user ne doit
-- jamais provenir d'un autre puuid que celui lié ici.
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  puuid text,
  riot_id text,
  primary_role text,
  secondary_role text,
  former_rank text,
  onboarded_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = user_id);

create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = user_id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = user_id);

-- CS de fin de partie + durée de la game : permettent de calculer le CS/min
-- avant et après 20 minutes (au lieu du seul CS@20 dans l'absolu), et de
-- recalibrer les seuils de couleur par palier plutôt que sur une échelle
-- unique. Nullable : les games déjà en base (ou saisies à la main dans
-- /suivi) n'ont simplement pas cette donnée tant qu'elles ne sont pas
-- réimportées.
alter table public.games add column if not exists cs_final numeric;
alter table public.games add column if not exists game_duration_seconds numeric;

-- De QUEL compte Riot vient cette game. `user_id` seul ne suffit pas : un user
-- peut relier son compte GG Dashboard a un autre Riot ID (profiles.puuid est
-- ecrase a chaque liaison), et les games des deux comptes s'empilaient alors
-- sous le meme user_id sans rien pour les distinguer -- le cockpit affichait un
-- melange. Nullable : les games importees avant cette colonne restent en base
-- mais ne s'affichent plus, jusqu'a ce qu'un reimport les reetiquette.
alter table public.games add column if not exists puuid text;

-- Morts : le total de la partie, et combien sont survenues dans les 5
-- dernieres minutes. `deaths10` (le rythme affiche) ne suffisait pas : pour
-- ne compter qu'a moitie les morts de fin de partie -- celles qui pesent le
-- prix d'un objectif plutot qu'une faute de lane -- il faut savoir QUAND on
-- est mort, et le Match-V5 ne donne qu'un total. L'horaire vient des events
-- CHAMPION_KILL de la timeline, deja telechargee pour le CS a 20 min : zero
-- appel Riot en plus.
-- On stocke les faits bruts, jamais la ponderation elle-meme : la regle peut
-- changer, l'historique des morts, non.
-- Nullable : les games importees avant ces colonnes gardent leur couleur
-- calculee sur le rythme brut, jusqu'a ce qu'un reimport les complete.
alter table public.games add column if not exists deaths integer;
alter table public.games add column if not exists deaths_last5 integer;

-- Cache PARTAGE des faits extraits d'une partie Riot.
--
-- Pourquoi une table separee de `games` : une partie terminee est une donnee
-- PUBLIQUE et IMMUABLE. Les memes faits valent pour tout le monde, alors que
-- `games` est la vue personnelle d'un user (ses notes, son user_id). Tant que
-- le cache vivait uniquement dans `games`, l'analyse gratuite -- le parcours
-- principal, celui de chaque visiteur non connecte -- etait le SEUL chemin
-- sans aucun cache : chaque recherche retelechargait tout, et une recherche
-- coutait ~86 appels Riot pour un quota de 100 par 2 minutes.
--
-- La cle est (riot_match_id, puuid) et non riot_match_id seul : une partie
-- contient 10 joueurs, et les faits (CS, morts, champion) sont propres a
-- chacun. Deux joueurs de la MEME partie se partagent donc bien le cache,
-- chacun sur sa ligne.
--
-- On stocke les FAITS BRUTS extraits (cs20, cs_final, deaths, deaths_last5),
-- jamais un calcul derive : meme regle que `games`. Les CS/min, la
-- ponderation des morts et les couleurs restent calcules a la lecture. Cout :
-- ~200 octets par ligne, contre ~900 Ko si on cachait la reponse brute de
-- Riot (77 Ko le match + 827 Ko la timeline, mesures le 2026-08-16).
create table if not exists public.match_facts (
  riot_match_id text not null,
  puuid text not null,
  lane text not null default '',
  champion text not null default '',
  matchup text not null default '',
  result text not null default 'Victoire',
  cs20 numeric not null default 0,
  deaths10 numeric not null default 0,
  queue text not null default '',
  played_at timestamptz not null,
  cs_final numeric,
  game_duration_seconds numeric,
  deaths integer,
  deaths_last5 integer,
  cached_at timestamptz not null default now(),
  primary key (riot_match_id, puuid)
);

alter table public.match_facts enable row level security;

-- Aucune policy : RLS active sans policy = tout est refuse aux cles anon et
-- authenticated. Le cache n'est lisible et inscriptible QUE par le serveur,
-- via la cle service_role qui contourne RLS (cf. lib/supabase/admin.ts).
--
-- C'est deliberé, et c'est le point de securite de cette table. Ouvrir
-- l'ecriture a `anon` permettrait a n'importe qui d'inserer de faux faits par
-- l'API REST de Supabase : ils seraient ensuite servis a TOUS les autres
-- utilisateurs comme s'ils venaient de Riot. Un empoisonnement de cache
-- indetectable. Garder l'ecriture cote serveur est la seule protection, parce
-- que rien dans une policy SQL ne peut verifier qu'une ligne vient bien de
-- l'API Riot.
--
-- La lecture reste fermee elle aussi : `puuid` est un identifiant stable de
-- joueur, inutile de le rendre enumerable publiquement.
