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
