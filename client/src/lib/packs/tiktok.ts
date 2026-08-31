import type { Template } from '../../types';

// FICHIER GÉNÉRÉ — régénéré par : npm run templates:tiktok --workspace client
//
// Pack "TikTok France" : des memes qui ne viennent d'aucun catalogue en
// ligne, donc rien à télécharger automatiquement. Les images sont déposées à
// la main dans client/templates-tiktok/, et la commande ci-dessus les
// range dans public/templates/ puis met ce fichier à jour.
//
// La commande est ADDITIVE : elle ajoute les nouvelles images sans jamais
// toucher aux entrées déjà là (leurs zones, réglées dans l'éditeur visuel,
// survivent donc à un ré-import). Pour retirer un template, passer par
// « Supprimer ce template » dans l'éditeur.
//
// Le format reproduit exactement celui de pepites.ts (zones écrites en clair
// dans l'entrée, une par ligne dès qu'il y en a deux) : c'est ce que sait
// relire et réécrire boxWriter.mts, donc l'éditeur visuel de zones édite ce
// pack comme les autres.
//
// Tant que ce tableau est vide, le pack n'est pas enregistré du tout dans
// packs/index.ts : il n'apparaît ni dans le lobby, ni dans les tests.
export const TIKTOK_TEMPLATES: Template[] = [];
