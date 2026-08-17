-- Reglages modifiables depuis l'application, sans redeploiement.
--
-- Pourquoi une table plutot qu'une variable d'environnement : une variable
-- d'env est lue au demarrage du process et ne peut pas etre reecrite par une
-- requete web. En production serverless le systeme de fichiers est en lecture
-- seule et ephemere, donc reecrire .env.local ne marcherait ni la, ni de facon
-- durable. Le seul stockage serveur mutable dont dispose ce projet est
-- Postgres.
--
-- Aujourd'hui une seule cle y vit : 'riot_api_key'. C'est LE reglage qui le
-- justifie : la dev key Riot expire toutes les 24 h, et jusqu'ici la remplacer
-- imposait d'editer .env.local sur la machine qui sert l'application.
-- La table est volontairement generique (cle/valeur) pour que le prochain
-- reglage n'exige pas de migration.
--
-- La cle Resend, elle, RESTE dans l'environnement : elle n'expire pas.

create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now(),
  -- Qui a pose la valeur. Pas de contrainte de cle etrangere vers auth.users :
  -- on veut garder la trace meme si le compte disparait un jour.
  updated_by uuid
);

alter table public.app_settings enable row level security;

-- Aucune policy, exactement comme match_facts : RLS active sans policy = tout
-- est refuse aux cles anon et authenticated. Seule la cle service_role, qui
-- contourne RLS (cf. lib/supabase/admin.ts), lit et ecrit cette table.
--
-- Ici ce n'est pas une precaution de confort, c'est LE point de securite : la
-- table contient un secret d'API en clair. Une policy de lecture, meme
-- restreinte a un utilisateur precis, exposerait ce secret a l'API REST de
-- Supabase, donc au navigateur de cet utilisateur — et il suffirait alors
-- d'une session volee pour l'exfiltrer. Le secret ne doit jamais quitter le
-- serveur : l'interface d'administration n'en affiche qu'un apercu masque.
--
-- Corollaire a ne pas oublier : cette valeur se retrouve en clair dans toute
-- sauvegarde de la base. Une cle Riot compromise se regenere sur
-- developer.riotgames.com, elle ne se "repare" pas.
