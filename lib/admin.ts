// Qui a le droit d'administrer l'application.
//
// Un seul compte, en dur. C'est volontaire : une liste en base ou en variable
// d'environnement se modifie, et une erreur de configuration donnerait
// silencieusement les droits d'administration a quelqu'un d'autre. Ici, changer
// l'administrateur exige un commit, donc laisse une trace dans `git log`.
export const EMAIL_ADMIN = "grosgalio@gmail.com";

// Comparaison insensible a la casse et aux espaces : Supabase conserve l'email
// tel que saisi a l'inscription, et "Grosgalio@gmail.com" designe la meme boite.
//
// ATTENTION — cette fonction sert a DEUX choses qui n'ont pas la meme valeur :
//   - cote client, elle decide si le bouton s'affiche. Ce n'est QUE du confort
//     d'interface : n'importe qui peut appeler l'API directement.
//   - cote serveur (app/api/admin/**), elle est le veritable controle d'acces.
// Ne jamais supprimer le controle serveur en se disant que le bouton est cache.
export function estAdmin(email: string | null | undefined): boolean {
  if (typeof email !== "string") return false;
  return email.trim().toLowerCase() === EMAIL_ADMIN;
}
