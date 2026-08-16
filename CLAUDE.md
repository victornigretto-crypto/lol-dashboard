@AGENTS.md

# Definition of done

Une tâche n'est **pas terminée** tant que les trois commandes suivantes ne passent pas.
Elles se lancent **avant** de mettre à jour [MEMOIRE.md](MEMOIRE.md), et le résultat des
trois se rapporte à Victor :

```bash
npx tsc --noEmit       # doit sortir sans rien afficher
npm run build          # le garde-fou avant de pousser
npm run test           # la suite Vitest (lib/**/*.test.ts)
```

Le serveur de dev ne doit **pas** tourner pendant `npm run build` : les deux se disputent
`.next`, et ce dossier a déjà fait tomber la machine une fois (voir
[MEMOIRE_ARCHIVE.md](MEMOIRE_ARCHIVE.md), entrée du 2026-08-13).

## Ce qui dépend d'une vraie session ne se déclare jamais acquis

Dès qu'une tâche touche à quelque chose qui **ne peut pas être exécuté sans session
utilisateur réelle** — authentification, lecture ou écriture Supabase sous RLS, import
Riot d'un compte lié, cockpit `/suivi` — l'entrée de journal doit le dire explicitement,
avec ces mots : **« non vérifié en conditions réelles »**.

Tant que ça n'a pas été rechargé dans l'app avec un vrai compte, on ne l'écrit ni comme
fait, ni comme « devrait marcher », ni comme « vérifié par le code ». Le raisonnement sur
le code n'est pas une vérification : trois sessions d'affilée ont empilé du code déclaré
bon qui n'avait jamais été ouvert dans un navigateur.

# Garde-fous

## Pas d'expérimentation à l'échelle système sur cette machine

Aucun diagnostic de perf ou de crash ne justifie de toucher aux **limites de process du
système, aux réglages noyau, aux quotas mémoire globaux ou à quoi que ce soit qui déborde
du projet** sur cette machine. Pas de Job Object, pas de limite de process imposée, pas de
modification de réglage Windows.

Si un diagnostic de ce type devient nécessaire : **le signaler à Victor et proposer de le
faire dans un environnement jetable** (conteneur ou VM), jamais en direct ici. Un
précédent a coûté un quasi-crash de la machine, et l'outil de bornage censé protéger
l'expérience n'avait en réalité posé aucune limite tout en renvoyant un succès.

## Ne rien détruire sans demander

Pas de `rm -rf`, pas de suppression de `.next`, pas de `git push --force`, pas de
`DELETE`/`DROP` en base, sans une demande explicite de Victor à ce moment-là. Une
autorisation donnée une fois ne vaut pas pour la fois suivante.
