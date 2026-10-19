# Dépôt d'images pour le pack "Memes français"

Pack pour des templates **déjà en français** (texte imprimé dans l'image, légende
Imgflip d'origine française, capture d'un format qui circule en franco-
phonie...) — à distinguer de "Snap français" (captures Snapchat/réseaux
sociaux) et de "Classiques" (sourcé Imgflip, en anglais). Dépose ici les
images à ajouter, puis lance depuis la racine du dépôt :

```bash
npm run templates:memesfr --workspace client
```

## Ce que fait la commande

1. Elle refuse les formats que l'outil d'empreintes ne sait pas décoder
   (`.webp`, `.avif`, `.gif`…) — **seuls `.jpg` et `.png` sont acceptés**.
2. Elle écarte les images déjà présentes dans un pack, même sous un autre nom
   de fichier (comparaison de l'image elle-même, pas des métadonnées).
3. Elle copie les images retenues dans `client/public/templates/`.
4. Elle ajoute les entrées correspondantes dans `client/src/lib/packs/memesfr.ts`.

Elle est **additive** : relancer la commande n'écrase jamais les entrées déjà
là, donc les zones de texte réglées dans l'éditeur visuel survivent à un
nouvel import. Pour retirer un template, passe par « Supprimer ce template »
dans l'éditeur visuel.

## Le nom du fichier devient le nom du template

`tu-es-triste.jpg` → template nommé « Tu es triste », d'id `memesfr-tu-es-triste`.
Donne donc des noms de fichiers lisibles : ils s'affichent tels quels dans
l'éditeur de zones, et deux templates ne peuvent pas porter le même nom.

## Ensuite

Les nouvelles entrées arrivent avec une disposition de zones générique
(haut/bas). Il faut les recaler une par une :

```bash
npm run templates:fingerprint --workspace client   # empreintes des nouvelles images
npm run boxes:edit --workspace client              # puis ouvrir /dev-boxes.html
```

Le contenu de ce dossier n'est pas versionné (voir `.gitignore`) : les images
retenues vivent dans `client/public/templates/`, inutile de les stocker deux
fois. Ce fichier-ci, si.
