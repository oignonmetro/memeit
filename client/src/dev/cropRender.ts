import type { TemplateBox } from '../types';

// Rognage (dev uniquement) : découpe l'image du template à un rectangle
// choisi dans l'éditeur — un vrai recadrage (les pixels gardés ne sont ni
// redimensionnés ni réencodés au-delà de l'export final), pas un simple
// zoom/CSS. Les zones de texte existantes doivent être recalculées dans le
// nouveau repère pour rester visuellement à la même place, comme un
// rognage dans un éditeur d'image classique déplacerait les calques avec le
// cadre — voir remapBoxToCrop plus bas.

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image du template impossible à charger.'));
    img.src = url;
  });
}

export function mimeForTemplateUrl(url: string): string {
  return /\.png(\?.*)?$/i.test(url) ? 'image/png' : 'image/jpeg';
}

// Rectangle réellement découpé, en pixels entiers de l'image d'origine —
// c'est ce rectangle-là (pas les xPct/widthPct flottants du sélecteur) que
// remapBoxToCrop doit utiliser pour rester en phase avec l'image exportée :
// les coordonnées de l'export sont arrondies au pixel (canvas.drawImage), un
// remap qui repartirait des pourcentages non arrondis dériverait d'une
// fraction de pixel par rapport à l'image réellement écrite.
export interface CropPixels {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CropResult {
  blob: Blob;
  mime: string;
  // Dimensions de l'image AVANT rognage, et rectangle réellement découpé
  // (en pixels) : les deux sont nécessaires à remapBoxToCrop pour convertir
  // les zones existantes dans le nouveau repère.
  naturalWidth: number;
  naturalHeight: number;
  cropPx: CropPixels;
}

export async function cropTemplate(templateUrl: string, crop: TemplateBox): Promise<CropResult> {
  const img = await loadImage(templateUrl);
  const naturalWidth = img.naturalWidth || img.width;
  const naturalHeight = img.naturalHeight || img.height;

  const cropPx: CropPixels = {
    x: Math.round((naturalWidth * (crop.xPct - crop.widthPct / 2)) / 100),
    y: Math.round((naturalHeight * (crop.yPct - crop.heightPct / 2)) / 100),
    w: Math.max(1, Math.round((naturalWidth * crop.widthPct) / 100)),
    h: Math.max(1, Math.round((naturalHeight * crop.heightPct) / 100)),
  };

  const canvas = document.createElement('canvas');
  canvas.width = cropPx.w;
  canvas.height = cropPx.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponible.');
  ctx.drawImage(img, cropPx.x, cropPx.y, cropPx.w, cropPx.h, 0, 0, cropPx.w, cropPx.h);

  const mime = mimeForTemplateUrl(templateUrl);
  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("Export de l'image impossible."));
      },
      mime,
      0.95
    );
  });
  return { blob, mime, naturalWidth, naturalHeight, cropPx };
}

// Convertit une zone (xPct/yPct/widthPct/heightPct exprimés en % de l'image
// D'ORIGINE) dans le repère de l'image une fois rognée. La position et la
// taille PHYSIQUES (en pixels) de la zone ne changent pas — seule la
// référence à 100% rétrécit — d'où le passage par les pixels plutôt qu'une
// simple règle de trois sur les pourcentages : un rognage n'a pas forcément
// le même ratio largeur/hauteur que l'image d'origine, une règle de trois
// directe sur les pourcentages donnerait alors un résultat visuellement faux.
export function remapBoxToCrop(box: TemplateBox, cropPx: CropPixels, naturalWidth: number, naturalHeight: number): TemplateBox {
  const pxX = (naturalWidth * box.xPct) / 100;
  const pxY = (naturalHeight * box.yPct) / 100;
  const pxW = (naturalWidth * box.widthPct) / 100;
  const pxH = (naturalHeight * box.heightPct) / 100;

  return {
    xPct: ((pxX - cropPx.x) / cropPx.w) * 100,
    yPct: ((pxY - cropPx.y) / cropPx.h) * 100,
    widthPct: (pxW / cropPx.w) * 100,
    heightPct: (pxH / cropPx.h) * 100,
    ...(box.rotationDeg ? { rotationDeg: box.rotationDeg } : {}),
  };
}
