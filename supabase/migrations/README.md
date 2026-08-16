# Migrations

À partir de maintenant, **tout nouveau changement de schéma s'écrit d'abord ici**, dans un
fichier `.sql` daté et numéroté : `AAAAMMJJ_description.sql` (ex. `20260816_add_x.sql`).

Le fichier est **commité avec le code qui en dépend**, pour qu'un `git log` dise toujours
quel schéma va avec quelle version du code.

L'application reste **manuelle** : on colle le contenu du fichier dans Supabase →
SQL Editor → New query. Pas de CLI Supabase, pas de `supabase link` — la méthode ne change
pas, seul le suivi devient versionné.

Règle inchangée : **migrations non destructives uniquement.** On ajoute des colonnes et des
tables, on n'en supprime jamais.

Les changements de schéma antérieurs au 2026-08-16 sont dans
[../schema.sql](../schema.sql), qui reste la référence de l'état cumulé du schéma.
