import type { TemplateBox } from '../types';

// Rendu (dev uniquement) d'un template avec des sous-titres incrustés à
// demeure dans l'image — à ne pas confondre avec les zones de texte
// (TextLayer), éditables par les joueurs à chaque partie et jamais écrites
// dans le fichier image. Repris de lib/memeImage.ts (même pipeline canvas
// pleine résolution) mais avec un style sous-titre : police sans-serif
// standard (pas Impact, réservée aux légendes de meme), pas de mise en
// majuscules forcée, contour plus fin.
export interface SubtitleEntry {
  box: TemplateBox;
  text: string;
}

export const SUBTITLE_FONT_STACK = "'Segoe UI', Roboto, Arial, Helvetica, sans-serif";
const STROKE_RATIO = 0.045;
const MIN_STROKE = 1;
const LINE_HEIGHT = 1.25;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image du template impossible à charger.'));
    img.src = url;
  });
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (!current || ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function fitSubtitle(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxH: number, frameW: number) {
  let lo = 6;
  let hi = Math.max(8, frameW * 0.09);
  let best = lo;
  let bestLines = [text];
  for (let i = 0; i < 12; i += 1) {
    const mid = (lo + hi) / 2;
    ctx.font = `700 ${mid}px ${SUBTITLE_FONT_STACK}`;
    const lines = wrapLines(ctx, text, maxW);
    const widest = lines.reduce((max, line) => Math.max(max, ctx.measureText(line).width), 0);
    const height = lines.length * mid * LINE_HEIGHT;
    if (widest <= maxW + 0.5 && height <= maxH + 0.5) {
      best = mid;
      bestLines = lines;
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return { fontSize: best, lines: bestLines };
}

// L'export doit rester dans le même format que le fichier d'origine : changer
// un .jpg en PNG (ou l'inverse) laisserait une extension trompeuse sur disque.
export function mimeForTemplateUrl(url: string): string {
  return /\.png(\?.*)?$/i.test(url) ? 'image/png' : 'image/jpeg';
}

export async function renderTemplateWithSubtitles(
  templateUrl: string,
  subtitles: SubtitleEntry[]
): Promise<{ blob: Blob; mime: string }> {
  const img = await loadImage(templateUrl);
  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponible.');

  ctx.drawImage(img, 0, 0, width, height);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#000';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;

  for (const { box, text: raw } of subtitles) {
    const text = raw.trim();
    if (!text) continue;

    const maxW = (width * box.widthPct) / 100;
    const maxH = (height * box.heightPct) / 100;
    const { fontSize, lines } = fitSubtitle(ctx, text, maxW, maxH, width);

    ctx.font = `700 ${fontSize}px ${SUBTITLE_FONT_STACK}`;
    ctx.lineWidth = Math.max(MIN_STROKE, fontSize * STROKE_RATIO);

    const cx = (width * box.xPct) / 100;
    const cy = (height * box.yPct) / 100;
    const lineStep = fontSize * LINE_HEIGHT;
    const firstY = cy - ((lines.length - 1) * lineStep) / 2;

    const rotate = box.rotationDeg ? (box.rotationDeg * Math.PI) / 180 : 0;
    if (rotate) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rotate);
    }
    lines.forEach((line, i) => {
      const y = firstY + i * lineStep;
      const [x, ty] = rotate ? [0, y - cy] : [cx, y];
      ctx.strokeText(line, x, ty);
      ctx.fillText(line, x, ty);
    });
    if (rotate) ctx.restore();
  }

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
  return { blob, mime };
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Lecture du blob impossible.'));
    reader.readAsDataURL(blob);
  });
}
