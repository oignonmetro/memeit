import type { TemplateBox } from '../types';

// imgflip's public API only exposes box_count (how many text zones a template
// has), not the exact zone coordinates. So we reproduce imgflip's *default*
// generator behaviour — stacked bands, top/bottom for the common 2-box case —
// and hand-tune the templates whose zones aren't stacked vertically (side-by-
// side panels, labels on specific regions, etc.).
//
// The CURATED coordinates below were each verified by rendering the real
// template image with sample captions and checking the placement visually.
// (x,y) is the CENTER of the box; width/height are % of the image.

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

// Hand-tuned zones for templates whose layout isn't a simple vertical stack,
// keyed by imgflip numeric id. Box order matches imgflip's text0, text1, ...
const CURATED: Record<string, TemplateBox[]> = {
  '438680': [{ xPct: 28, yPct: 20, widthPct: 40, heightPct: 26 }, { xPct: 73, yPct: 20, widthPct: 40, heightPct: 26 }], // Batman Slapping Robin
  '1035805': [{ xPct: 50, yPct: 10, widthPct: 80, heightPct: 12 }, { xPct: 25, yPct: 60, widthPct: 26, heightPct: 16 }, { xPct: 49, yPct: 60, widthPct: 26, heightPct: 16 }, { xPct: 73, yPct: 60, widthPct: 26, heightPct: 16 }], // Boardroom Meeting Suggestion
  '72525473': [{ xPct: 50, yPct: 16, widthPct: 84, heightPct: 14 }, { xPct: 50, yPct: 50, widthPct: 84, heightPct: 14 }, { xPct: 50, yPct: 84, widthPct: 84, heightPct: 14 }], // say the line bart! simpsons
  '79132341': [{ xPct: 50, yPct: 15, widthPct: 84, heightPct: 14 }, { xPct: 50, yPct: 50, widthPct: 84, heightPct: 14 }, { xPct: 50, yPct: 85, widthPct: 84, heightPct: 14 }], // Bike Fall
  '80707627': [{ xPct: 50, yPct: 20, widthPct: 80, heightPct: 14 }, { xPct: 27, yPct: 80, widthPct: 40, heightPct: 14 }, { xPct: 73, yPct: 80, widthPct: 40, heightPct: 14 }], // Sad Pablo Escobar
  '84341851': [{ xPct: 28, yPct: 20, widthPct: 40, heightPct: 20 }, { xPct: 72, yPct: 20, widthPct: 40, heightPct: 22 }], // Evil Kermit
  '87743020': [{ xPct: 33, yPct: 14, widthPct: 40, heightPct: 12 }, { xPct: 63, yPct: 22, widthPct: 40, heightPct: 12 }, { xPct: 50, yPct: 88, widthPct: 86, heightPct: 16 }], // Two Buttons
  '91998305': [{ xPct: 74, yPct: 25, widthPct: 48, heightPct: 40 }, { xPct: 74, yPct: 75, widthPct: 48, heightPct: 40 }], // Drake Blank
  '93895088': [{ xPct: 27, yPct: 12, widthPct: 46, heightPct: 18 }, { xPct: 27, yPct: 37, widthPct: 46, heightPct: 18 }, { xPct: 27, yPct: 62, widthPct: 46, heightPct: 18 }, { xPct: 27, yPct: 87, widthPct: 46, heightPct: 18 }], // Expanding Brain
  '100777631': [{ xPct: 24, yPct: 42, widthPct: 34, heightPct: 20 }, { xPct: 72, yPct: 20, widthPct: 30, heightPct: 16 }, { xPct: 50, yPct: 90, widthPct: 80, heightPct: 12 }], // Is This A Pigeon
  '104893621': [{ xPct: 20, yPct: 20, widthPct: 26, heightPct: 18 }, { xPct: 45, yPct: 20, widthPct: 24, heightPct: 18 }, { xPct: 70, yPct: 20, widthPct: 24, heightPct: 18 }], // Grim Reaper Knocking Door
  '110133729': [{ xPct: 26, yPct: 22, widthPct: 40, heightPct: 24 }, { xPct: 74, yPct: 22, widthPct: 40, heightPct: 24 }], // spiderman pointing at spiderman
  '112126428': [{ xPct: 30, yPct: 72, widthPct: 26, heightPct: 20 }, { xPct: 58, yPct: 50, widthPct: 26, heightPct: 20 }, { xPct: 86, yPct: 58, widthPct: 24, heightPct: 20 }], // Distracted Boyfriend
  '114585149': [{ xPct: 50, yPct: 10, widthPct: 84, heightPct: 10 }, { xPct: 50, yPct: 36, widthPct: 84, heightPct: 10 }, { xPct: 50, yPct: 60, widthPct: 84, heightPct: 10 }, { xPct: 50, yPct: 86, widthPct: 84, heightPct: 12 }], // Inhaling Seagull
  '119215120': [{ xPct: 28, yPct: 82, widthPct: 30, heightPct: 12 }, { xPct: 72, yPct: 82, widthPct: 32, heightPct: 14 }], // Types of Headaches meme
  '124822590': [{ xPct: 34, yPct: 20, widthPct: 30, heightPct: 20 }, { xPct: 62, yPct: 20, widthPct: 34, heightPct: 20 }, { xPct: 40, yPct: 82, widthPct: 34, heightPct: 16 }], // Left Exit 12 Off Ramp
  '129242436': [{ xPct: 50, yPct: 14, widthPct: 80, heightPct: 14 }, { xPct: 50, yPct: 72, widthPct: 42, heightPct: 12 }], // Change My Mind
  '129315248': [{ xPct: 74, yPct: 25, widthPct: 48, heightPct: 40 }, { xPct: 74, yPct: 75, widthPct: 48, heightPct: 40 }], // No - Yes
  '131087935': [{ xPct: 28, yPct: 22, widthPct: 34, heightPct: 14 }, { xPct: 66, yPct: 16, widthPct: 30, heightPct: 12 }, { xPct: 28, yPct: 80, widthPct: 34, heightPct: 14 }, { xPct: 66, yPct: 74, widthPct: 30, heightPct: 12 }, { xPct: 50, yPct: 48, widthPct: 30, heightPct: 10 }], // Running Away Balloon
  '131940431': [{ xPct: 30, yPct: 20, widthPct: 40, heightPct: 20 }, { xPct: 80, yPct: 20, widthPct: 40, heightPct: 20 }, { xPct: 30, yPct: 66, widthPct: 40, heightPct: 20 }, { xPct: 80, yPct: 66, widthPct: 40, heightPct: 20 }], // Gru's Plan
  '135256802': [{ xPct: 22, yPct: 42, widthPct: 34, heightPct: 22 }, { xPct: 78, yPct: 42, widthPct: 34, heightPct: 22 }, { xPct: 50, yPct: 82, widthPct: 50, heightPct: 18 }], // Epic Handshake
  '135678846': [{ xPct: 50, yPct: 10, widthPct: 84, heightPct: 10 }, { xPct: 50, yPct: 86, widthPct: 84, heightPct: 10 }, { xPct: 50, yPct: 95, widthPct: 84, heightPct: 8 }], // Who Killed Hannibal
  '142009471': [{ xPct: 24, yPct: 42, widthPct: 34, heightPct: 20 }, { xPct: 72, yPct: 20, widthPct: 30, heightPct: 16 }, { xPct: 50, yPct: 90, widthPct: 80, heightPct: 12 }], // is this butterfly
  '145139900': [{ xPct: 28, yPct: 22, widthPct: 42, heightPct: 18 }, { xPct: 72, yPct: 22, widthPct: 42, heightPct: 18 }, { xPct: 28, yPct: 72, widthPct: 42, heightPct: 18 }, { xPct: 72, yPct: 72, widthPct: 42, heightPct: 18 }], // Scooby doo mask reveal
  '161865971': [{ xPct: 50, yPct: 13, widthPct: 84, heightPct: 12 }, { xPct: 50, yPct: 68, widthPct: 66, heightPct: 9 }], // Marked Safe From
  '162372564': [{ xPct: 22, yPct: 42, widthPct: 34, heightPct: 26 }, { xPct: 72, yPct: 40, widthPct: 44, heightPct: 30 }], // Domino Effect
  '166969924': [{ xPct: 50, yPct: 12, widthPct: 84, heightPct: 12 }, { xPct: 50, yPct: 45, widthPct: 60, heightPct: 12 }, { xPct: 50, yPct: 88, widthPct: 84, heightPct: 12 }], // Flex Tape
  '171305372': [{ xPct: 18, yPct: 30, widthPct: 30, heightPct: 22 }, { xPct: 46, yPct: 74, widthPct: 30, heightPct: 18 }, { xPct: 78, yPct: 40, widthPct: 30, heightPct: 24 }], // Soldier protecting sleeping child
  '178591752': [{ xPct: 70, yPct: 26, widthPct: 52, heightPct: 34 }, { xPct: 70, yPct: 76, widthPct: 52, heightPct: 34 }], // Tuxedo Winnie The Pooh
  '180190441': [{ xPct: 30, yPct: 26, widthPct: 34, heightPct: 18 }, { xPct: 70, yPct: 26, widthPct: 34, heightPct: 18 }, { xPct: 50, yPct: 90, widthPct: 80, heightPct: 12 }], // They're The Same Picture
  '181913649': [{ xPct: 74, yPct: 25, widthPct: 48, heightPct: 40 }, { xPct: 74, yPct: 75, widthPct: 48, heightPct: 40 }], // Drake Hotline Bling
  '187102311': [{ xPct: 24, yPct: 26, widthPct: 28, heightPct: 18 }, { xPct: 50, yPct: 16, widthPct: 28, heightPct: 16 }, { xPct: 76, yPct: 26, widthPct: 28, heightPct: 18 }, { xPct: 50, yPct: 82, widthPct: 50, heightPct: 14 }], // Three-headed Dragon
  '188390779': [{ xPct: 26, yPct: 22, widthPct: 44, heightPct: 30 }, { xPct: 75, yPct: 28, widthPct: 44, heightPct: 34 }], // Woman Yelling At Cat
  '195515965': [{ xPct: 68, yPct: 13, widthPct: 58, heightPct: 16 }, { xPct: 68, yPct: 38, widthPct: 58, heightPct: 16 }, { xPct: 68, yPct: 63, widthPct: 58, heightPct: 16 }, { xPct: 68, yPct: 88, widthPct: 58, heightPct: 16 }], // Clown Applying Makeup
  '206151308': [{ xPct: 24, yPct: 44, widthPct: 30, heightPct: 20 }, { xPct: 50, yPct: 18, widthPct: 34, heightPct: 16 }, { xPct: 76, yPct: 44, widthPct: 30, heightPct: 20 }], // Spider Man Triple
  '217743513': [{ xPct: 27, yPct: 30, widthPct: 42, heightPct: 34 }, { xPct: 74, yPct: 58, widthPct: 46, heightPct: 30 }], // UNO Draw 25 Cards
  '224514655': [{ xPct: 70, yPct: 20, widthPct: 44, heightPct: 14 }, { xPct: 35, yPct: 75, widthPct: 44, heightPct: 16 }], // Anime Girl Hiding from Terminator
  '226297822': [{ xPct: 50, yPct: 15, widthPct: 84, heightPct: 14 }, { xPct: 50, yPct: 49, widthPct: 84, heightPct: 14 }, { xPct: 50, yPct: 84, widthPct: 84, heightPct: 14 }], // Panik Kalm Panik
  '234202281': [{ xPct: 28, yPct: 30, widthPct: 40, heightPct: 22 }, { xPct: 74, yPct: 35, widthPct: 40, heightPct: 22 }], // AJ Styles & Undertaker
  '247113703': [{ xPct: 62, yPct: 18, widthPct: 44, heightPct: 14 }, { xPct: 40, yPct: 68, widthPct: 44, heightPct: 14 }], // A train hitting a school bus
  '247375501': [{ xPct: 25, yPct: 26, widthPct: 44, heightPct: 20 }, { xPct: 75, yPct: 26, widthPct: 44, heightPct: 20 }, { xPct: 25, yPct: 74, widthPct: 44, heightPct: 20 }, { xPct: 75, yPct: 74, widthPct: 44, heightPct: 20 }], // Buff Doge vs. Cheems
  '252600902': [{ xPct: 45, yPct: 22, widthPct: 50, heightPct: 18 }, { xPct: 78, yPct: 52, widthPct: 40, heightPct: 18 }], // Always Has Been
  '252758727': [{ xPct: 68, yPct: 20, widthPct: 40, heightPct: 14 }, { xPct: 55, yPct: 33, widthPct: 34, heightPct: 12 }, { xPct: 35, yPct: 66, widthPct: 40, heightPct: 14 }, { xPct: 50, yPct: 90, widthPct: 80, heightPct: 12 }], // Mother Ignoring Kid Drowning In A Pool
  '309668311': [{ xPct: 28, yPct: 30, widthPct: 36, heightPct: 20 }, { xPct: 72, yPct: 30, widthPct: 36, heightPct: 20 }, { xPct: 50, yPct: 86, widthPct: 60, heightPct: 12 }], // Two Paths
  '309868304': [{ xPct: 28, yPct: 44, widthPct: 40, heightPct: 28 }, { xPct: 72, yPct: 44, widthPct: 40, heightPct: 28 }, { xPct: 50, yPct: 90, widthPct: 80, heightPct: 10 }], // Trade Offer
  '322841258': [{ xPct: 26, yPct: 26, widthPct: 46, heightPct: 40 }, { xPct: 74, yPct: 26, widthPct: 46, heightPct: 40 }, { xPct: 74, yPct: 76, widthPct: 46, heightPct: 40 }], // Anakin Padme 4 Panel
  '342785297': [{ xPct: 50, yPct: 16, widthPct: 84, heightPct: 14 }, { xPct: 50, yPct: 50, widthPct: 84, heightPct: 14 }, { xPct: 50, yPct: 84, widthPct: 84, heightPct: 14 }], // Gus Fring we are not the same
  '354700819': [{ xPct: 30, yPct: 28, widthPct: 40, heightPct: 24 }, { xPct: 70, yPct: 72, widthPct: 40, heightPct: 24 }], // Two guys on a bus
  '360597639': [{ xPct: 50, yPct: 54, widthPct: 84, heightPct: 14 }, { xPct: 50, yPct: 88, widthPct: 84, heightPct: 12 }], // whe i'm in a competition and my opponent is
  '533936279': [{ xPct: 16, yPct: 46, widthPct: 26, heightPct: 26 }, { xPct: 50, yPct: 28, widthPct: 30, heightPct: 20 }, { xPct: 84, yPct: 46, widthPct: 26, heightPct: 26 }], // Bell Curve
};

export function boxesForImgflip(imgflipId: string, boxCount: number): TemplateBox[] {
  return CURATED[imgflipId] ?? genericBoxes(boxCount);
}

// Uploaded custom templates: no box_count info, default to classic top/bottom.
export const DEFAULT_UPLOAD_BOXES: TemplateBox[] = genericBoxes(2);
