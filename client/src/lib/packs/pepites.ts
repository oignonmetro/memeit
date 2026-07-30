import type { Template } from '../../types';

// A second, hand-picked pack of well-known templates that weren't part of the
// "Classiques" snapshot (Imgflip's top ~100 at the time it was captured).
// Sourced directly from Imgflip's blank-template pages and curated the same
// way as every entry in templateBoxes.ts: each layout was reviewed by
// rendering the real image with sample captions and checking placement.
export const PEPITES_TEMPLATES: Template[] = [
  {
    id: 'pepites-stonks',
    url: 'https://i.imgflip.com/3388rw.png',
    name: 'Stonks',
    source: 'library',
    boxes: [{ xPct: 70, yPct: 12, widthPct: 54, heightPct: 18 }],
  },
  {
    id: 'pepites-chopper',
    url: 'https://i.imgflip.com/27r7xc.jpg',
    name: 'American Chopper Argument',
    source: 'library',
    boxes: [
      { xPct: 40, yPct: 16, widthPct: 60, heightPct: 8 },
      { xPct: 53, yPct: 36, widthPct: 44, heightPct: 6 },
      { xPct: 51, yPct: 55, widthPct: 70, heightPct: 7 },
      { xPct: 27, yPct: 76, widthPct: 40, heightPct: 7 },
      { xPct: 81, yPct: 96, widthPct: 36, heightPct: 7 },
    ],
  },
  {
    id: 'pepites-bugs-bunny-no',
    url: 'https://i.imgflip.com/34mv9a.png',
    name: 'Bugs Bunny No',
    source: 'library',
    boxes: [{ xPct: 50, yPct: 6, widthPct: 92, heightPct: 10 }],
  },
  {
    id: 'pepites-kombucha-girl',
    url: 'https://i.imgflip.com/3fldan.png',
    name: 'Kombucha Girl',
    source: 'library',
    boxes: [
      { xPct: 24, yPct: 25, widthPct: 44, heightPct: 40 },
      { xPct: 24, yPct: 75, widthPct: 44, heightPct: 40 },
    ],
  },
  {
    id: 'pepites-spongebob-head-out',
    url: 'https://i.imgflip.com/3aado5.jpg',
    name: 'Spongebob Ight Imma Head Out',
    source: 'library',
    boxes: [{ xPct: 50, yPct: 8, widthPct: 88, heightPct: 14 }],
  },
  {
    id: 'pepites-success-kid',
    url: 'https://i.imgflip.com/3rxib.jpg',
    name: 'Success Kid',
    source: 'library',
    boxes: [
      { xPct: 50, yPct: 10, widthPct: 90, heightPct: 16 },
      { xPct: 50, yPct: 90, widthPct: 90, heightPct: 16 },
    ],
  },
  {
    id: 'pepites-free-real-estate',
    url: 'https://i.imgflip.com/24r48o.jpg',
    name: "It's Free Real Estate",
    source: 'library',
    boxes: [{ xPct: 50, yPct: 7, widthPct: 80, heightPct: 10 }],
  },
  {
    id: 'pepites-confused-nick-young',
    url: 'https://i.imgflip.com/1n28ay.jpg',
    name: 'Confused Nick Young',
    source: 'library',
    boxes: [{ xPct: 50, yPct: 10, widthPct: 92, heightPct: 16 }],
  },
];
