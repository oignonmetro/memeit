# Dépôt d'images pour le pack "Snap français"

Dépose ici les images à ajouter au pack, puis lance depuis la racine du dépôt :

```bash
npm run templates:snap --workspace client
```

## Ce que fait la commande

1. Elle refuse les formats que l'outil d'empreintes ne sait pas décoder
   (`.webp`, `.avif`, `.gif`…) — **seuls `.jpg` et `.png` sont acceptés**.
2. Elle écarte les images déjà présentes dans un pack, même sous un autre nom
   de fichier (comparaison de l'image elle-même, pas des métadonnées).
3. Elle copie les images retenues dans `client/public/templates/`.
4. Elle ajoute les entrées correspondantes dans `client/src/lib/packs/snap.ts`.

Elle est **additive** : relancer la commande n'écrase jamais les entrées déjà
là, donc les zones de texte réglées dans l'éditeur visuel survivent à un
nouvel import. Pour retirer un template, passe par « Supprimer ce template »
dans l'éditeur visuel.

## Le nom du fichier devient le nom du template

`chat_qui_dort.jpg` → template nommé « Chat qui dort », d'id `snap-chat-qui-dort`.
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
