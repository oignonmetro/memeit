import type { Template } from '../types';

// Original placeholder templates bundled with the app (client/public/templates/library).
// Used only as an offline fallback if the Imgflip API is unreachable — the real "library"
// pool is fetched live from Imgflip (see imgflip.ts) so it reflects current popular templates.
// Boxes are tuned to each SVG's layout (see client/public/templates/library/*.svg).
export const FALLBACK_TEMPLATES: Template[] = [
  {
    id: 'lib-1',
    url: '/templates/library/podium.svg',
    name: 'Le podium',
    source: 'library',
    boxes: [
      { xPct: 23, yPct: 88, widthPct: 26, heightPct: 14 },
      { xPct: 50, yPct: 96, widthPct: 26, heightPct: 12 },
      { xPct: 77, yPct: 92, widthPct: 26, heightPct: 14 },
    ],
  },
  {
    id: 'lib-2',
    url: '/templates/library/two-buttons.svg',
    name: 'Les deux boutons',
    source: 'library',
    boxes: [
      { xPct: 28, yPct: 21, widthPct: 30, heightPct: 14 },
      { xPct: 71, yPct: 21, widthPct: 30, heightPct: 14 },
      { xPct: 50, yPct: 90, widthPct: 40, heightPct: 12 },
    ],
  },
  {
    id: 'lib-3',
    url: '/templates/library/expanding-brain.svg',
    name: 'Le cerveau qui grandit',
    source: 'library',
    boxes: [
      { xPct: 25, yPct: 12, widthPct: 44, heightPct: 20 },
      { xPct: 25, yPct: 37, widthPct: 44, heightPct: 20 },
      { xPct: 25, yPct: 62, widthPct: 44, heightPct: 20 },
      { xPct: 25, yPct: 87, widthPct: 44, heightPct: 20 },
    ],
  },
  {
    id: 'lib-4',
    url: '/templates/library/drakeish.svg',
    name: 'Approuve / désapprouve',
    source: 'library',
    boxes: [
      { xPct: 74, yPct: 25, widthPct: 46, heightPct: 40 },
      { xPct: 74, yPct: 75, widthPct: 46, heightPct: 40 },
    ],
  },
  {
    id: 'lib-5',
    url: '/templates/library/change-my-mind.svg',
    name: 'Change mon avis',
    source: 'library',
    boxes: [{ xPct: 50, yPct: 70, widthPct: 34, heightPct: 12 }],
  },
  {
    id: 'lib-6',
    url: '/templates/library/distracted.svg',
    name: 'Le regard qui dévie',
    source: 'library',
    boxes: [
      { xPct: 20, yPct: 66, widthPct: 22, heightPct: 18 },
      { xPct: 50, yPct: 60, widthPct: 22, heightPct: 18 },
      { xPct: 82, yPct: 52, widthPct: 22, heightPct: 18 },
    ],
  },
];
