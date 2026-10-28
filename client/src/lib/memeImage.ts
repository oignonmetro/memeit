import type { TextLayer } from '../types';

// Renders a finished meme (template + text layers) to a PNG blob, reproducing
// what MemeRender paints in the DOM — same Impact font, same white-on-black
// outline, same auto-shrinking font size per zone — but at the image's natural
// resolution so the downloaded file isn't limited to the on-screen size.

// The outline scales with each layer's fitted font size (6%, floored at 1px) —
// same ratio as MemeRender's DOM version — so the downloaded PNG matches what
// was shown on screen instead of a flat pixel width that reads hair-thin on
// short captions and blobby on long ones.
const STROKE_RATIO = 0.06;
const MIN_STROKE = 1;
const FONT_STACK = "Impact, 'Arial Narrow', Haettenschweiler, sans-serif";
const LINE_HEIGHT = 1.05;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Needed so the canvas stays untainted for imgflip URLs (they send
    // Access-Control-Allow-Origin: *). Harmless for data: URLs (uploads).
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image du template impossible à charger.'));
    img.src = url;
  });
}

// Word wrapping matching the CSS (`overflow-wrap: normal`): break on spaces
// only. A single word wider than the box overflows, which makes the fit search
// below pick a smaller font — same as the browser's scrollWidth check.
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

// Binary search on font size, mirroring MemeRender's fit loop.
function fitLayer(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxH: number, frameW: number) {
  let lo = 8;
  let hi = Math.max(10, frameW * 0.12);
  let best = lo;
  let bestLines = [text];
  for (let i = 0; i < 10; i += 1) {
    const mid = (lo + hi) / 2;
    ctx.font = `900 ${mid}px ${FONT_STACK}`;
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

export async function renderMemeToBlob(templateUrl: string, layers: TextLayer[]): Promise<Blob> {
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

  for (const layer of layers) {
    const text = (layer.text || '').trim().toUpperCase();
    if (!text) continue;

    const maxW = (width * layer.widthPct) / 100;
    const maxH = (height * layer.heightPct) / 100;
    const { fontSize, lines } = fitLayer(ctx, text, maxW, maxH, width);

    ctx.font = `900 ${fontSize}px ${FONT_STACK}`;
    ctx.lineWidth = Math.max(MIN_STROKE, fontSize * STROKE_RATIO);

    const cx = (width * layer.xPct) / 100;
    const cy = (height * layer.yPct) / 100;
    const lineStep = fontSize * LINE_HEIGHT;
    // (xPct,yPct) is the CENTER of the box, so the block is centred on it.
    const firstY = cy - ((lines.length - 1) * lineStep) / 2;

    // Rotate around the box's own center (cx,cy) — same anchor as the DOM
    // preview's translate(-50%,-50%) rotate(...) — by moving the origin
    // there first and drawing the lines at their offset from it.
    const rotate = layer.rotationDeg ? (layer.rotationDeg * Math.PI) / 180 : 0;
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

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Export de l\'image impossible.'));
    }, 'image/png');
  });
}

export async function downloadMeme(templateUrl: string, layers: TextLayer[], filename: string): Promise<void> {
  const blob = await renderMemeToBlob(templateUrl, layers);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  // Revoke a tick later so the click has actually started the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
