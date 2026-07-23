import type { TemplateBox } from '../types';

// imgflip's public API only exposes box_count (how many text zones a template
// has), not the exact zone coordinates. So we reproduce imgflip's *default*
// generator behaviour — stacked bands, top/bottom for the common 2-box case —
// and hand-tune a small set of iconic templates whose zones aren't stacked
// vertically (Drake's right column, side-by-side panels, etc.).

// Generic stacked bands, matching imgflip's default layout for a given count.
export function genericBoxes(count: number): TemplateBox[] {
  const n = Math.max(1, Math.min(count || 2, 6));
  if (n === 1) return [{ xPct: 50, yPct: 18, widthPct: 90, heightPct: 26 }];
  const top = 15;
  const bottom = 85;
  const heightPct = Math.min(26, Math.floor(72 / n));
  return Array.from({ length: n }, (_, i) => ({
    xPct: 50,
    yPct: top + ((bottom - top) * i) / (n - 1),
    widthPct: 90,
    heightPct,
  }));
}

// Hand-tuned zones for iconic templates (keyed by imgflip numeric id). Best
// effort — easy to fine-tune. Order matches imgflip's text0, text1, ... order.
const CURATED: Record<string, TemplateBox[]> = {
  // Drake Hotline Bling — two stacked zones in the right column.
  '181913649': [
    { xPct: 74, yPct: 25, widthPct: 48, heightPct: 40 },
    { xPct: 74, yPct: 75, widthPct: 48, heightPct: 40 },
  ],
  // Distracted Boyfriend — labels on the three people.
  '112126428': [
    { xPct: 30, yPct: 72, widthPct: 26, heightPct: 20 },
    { xPct: 58, yPct: 50, widthPct: 26, heightPct: 20 },
    { xPct: 86, yPct: 58, widthPct: 24, heightPct: 20 },
  ],
  // Two Buttons — two sweat-button labels then the caption on the guy.
  '87743020': [
    { xPct: 33, yPct: 14, widthPct: 40, heightPct: 12 },
    { xPct: 63, yPct: 22, widthPct: 40, heightPct: 12 },
    { xPct: 50, yPct: 88, widthPct: 86, heightPct: 16 },
  ],
  // UNO Draw 25 Cards — the card text (left) and the player (right).
  '217743513': [
    { xPct: 27, yPct: 30, widthPct: 42, heightPct: 34 },
    { xPct: 74, yPct: 58, widthPct: 46, heightPct: 30 },
  ],
  // Left Exit 12 Off Ramp — the two signs then the car.
  '124822590': [
    { xPct: 34, yPct: 20, widthPct: 30, heightPct: 20 },
    { xPct: 62, yPct: 20, widthPct: 34, heightPct: 20 },
    { xPct: 40, yPct: 82, widthPct: 34, heightPct: 16 },
  ],
};

export function boxesForImgflip(imgflipId: string, boxCount: number): TemplateBox[] {
  return CURATED[imgflipId] ?? genericBoxes(boxCount);
}

// Uploaded custom templates: no box_count info, default to classic top/bottom.
export const DEFAULT_UPLOAD_BOXES: TemplateBox[] = genericBoxes(2);
