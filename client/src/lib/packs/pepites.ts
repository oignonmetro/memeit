import type { Template } from '../../types';

// A second, hand-picked pack of well-known templates that weren't part of the
// "Classiques" snapshot (Imgflip's top ~100 at the time it was captured).
// Sourced directly from Imgflip's blank-template pages and curated the same
// way as every entry in templateBoxes.ts: each layout was reviewed by
// rendering the real image with sample captions and checking placement.
export const PEPITES_TEMPLATES: Template[] = [
  {
    id: 'pepites-stonks',
    url: '/templates/pepites-stonks.png',
    name: 'Stonks',
    source: 'library',
    boxes: [{ xPct: 50, yPct: 86, widthPct: 98, heightPct: 26 }],
  },
  {
    id: 'pepites-chopper',
    url: '/templates/pepites-chopper.jpg',
    name: 'American Chopper Argument',
    source: 'library',
    boxes: [
      { xPct: 49, yPct: 16, widthPct: 71, heightPct: 4 },
      { xPct: 53, yPct: 37, widthPct: 44, heightPct: 4 },
      { xPct: 50, yPct: 57, widthPct: 68, heightPct: 5 },
      { xPct: 22, yPct: 76, widthPct: 33, heightPct: 7 },
      { xPct: 81, yPct: 96, widthPct: 36, heightPct: 7 },
    ],
  },
  {
    id: 'pepites-bugs-bunny-no',
    url: '/templates/pepites-bugs-bunny-no.png',
    name: 'Bugs Bunny No',
    source: 'library',
    boxes: [{ xPct: 50, yPct: 9, widthPct: 92, heightPct: 15 }],
  },
  {
    id: 'pepites-kombucha-girl',
    url: '/templates/pepites-kombucha-girl.png',
    name: 'Kombucha Girl',
    source: 'library',
    boxes: [
      { xPct: 24, yPct: 25, widthPct: 44, heightPct: 40 },
      { xPct: 24, yPct: 75, widthPct: 44, heightPct: 40 },
    ],
  },
  {
    id: 'pepites-spongebob-head-out',
    url: '/templates/pepites-spongebob-head-out.jpg',
    name: 'Spongebob Ight Imma Head Out',
    source: 'library',
    boxes: [{ xPct: 50, yPct: 8, widthPct: 88, heightPct: 14 }],
  },
  {
    id: 'pepites-success-kid',
    url: '/templates/pepites-success-kid.jpg',
    name: 'Success Kid',
    source: 'library',
    boxes: [
      { xPct: 50, yPct: 10, widthPct: 90, heightPct: 16 },
      { xPct: 50, yPct: 90, widthPct: 90, heightPct: 16 },
    ],
  },
  {
    id: 'pepites-free-real-estate',
    url: '/templates/pepites-free-real-estate.jpg',
    name: "It's Free Real Estate",
    source: 'library',
    boxes: [{ xPct: 50, yPct: 12, widthPct: 80, heightPct: 19 }],
  },
  {
    id: 'pepites-confused-nick-young',
    url: '/templates/pepites-confused-nick-young.jpg',
    name: 'Confused Nick Young',
    source: 'library',
    boxes: [{ xPct: 49, yPct: 78, widthPct: 92, heightPct: 33 }],
  },
  {
    id: 'pepites-doge',
    url: '/templates/pepites-doge.jpg',
    name: 'Doge',
    source: 'library',
    boxes: [
      { xPct: 50, yPct: 13, widthPct: 88, heightPct: 22 },
      { xPct: 50, yPct: 88, widthPct: 88, heightPct: 20 },
    ],
  },
  {
    id: 'pepites-sad-keanu',
    url: '/templates/pepites-sad-keanu.jpg',
    name: 'Sad Keanu',
    source: 'library',
    boxes: [{ xPct: 49, yPct: 87, widthPct: 88, heightPct: 20 }],
  },
  {
    id: 'pepites-gigachad',
    url: '/templates/pepites-gigachad.jpg',
    name: 'Gigachad',
    source: 'library',
    boxes: [
      { xPct: 50, yPct: 10, widthPct: 86, heightPct: 16 },
      { xPct: 50, yPct: 92, widthPct: 86, heightPct: 14 },
    ],
  },
  {
    id: 'pepites-condescending-wonka',
    url: '/templates/pepites-condescending-wonka.jpg',
    name: 'Condescending Wonka',
    source: 'library',
    boxes: [
      { xPct: 50, yPct: 14, widthPct: 86, heightPct: 22 },
      { xPct: 50, yPct: 86, widthPct: 86, heightPct: 20 },
    ],
  },
  {
    id: 'pepites-matrix-morpheus',
    url: '/templates/pepites-matrix-morpheus.jpg',
    name: 'Matrix Morpheus',
    source: 'library',
    boxes: [
      { xPct: 50, yPct: 9, widthPct: 92, heightPct: 14 },
      { xPct: 50, yPct: 90, widthPct: 92, heightPct: 16 },
    ],
  },
  {
    id: 'pepites-gandalf',
    url: '/templates/pepites-gandalf.jpg',
    name: 'Gandalf You Shall Not Pass',
    source: 'library',
    boxes: [
      { xPct: 50, yPct: 9, widthPct: 92, heightPct: 14 },
      { xPct: 50, yPct: 92, widthPct: 92, heightPct: 12 },
    ],
  },
  {
    id: 'pepites-sparta',
    url: '/templates/pepites-sparta.jpg',
    name: 'This Is Sparta',
    source: 'library',
    boxes: [
      { xPct: 50, yPct: 27, widthPct: 92, heightPct: 10 },
      { xPct: 50, yPct: 60, widthPct: 92, heightPct: 10 },
      { xPct: 50, yPct: 95, widthPct: 92, heightPct: 9 },
    ],
  },
  {
    id: 'pepites-uno-reverse',
    url: '/templates/pepites-uno-reverse.jpg',
    name: 'Uno Reverse Card',
    source: 'library',
    boxes: [{ xPct: 50, yPct: 50, widthPct: 88, heightPct: 80 }],
  },
  {
    id: 'pepites-bad-luck-brian',
    url: '/templates/pepites-bad-luck-brian.jpg',
    name: 'Bad Luck Brian',
    source: 'library',
    boxes: [
      { xPct: 50, yPct: 11, widthPct: 88, heightPct: 18 },
      { xPct: 50, yPct: 90, widthPct: 88, heightPct: 16 },
    ],
  },
  {
    id: 'pepites-overly-attached-girlfriend',
    url: '/templates/pepites-overly-attached-girlfriend.jpg',
    name: 'Overly Attached Girlfriend',
    source: 'library',
    boxes: [
      { xPct: 50, yPct: 11, widthPct: 88, heightPct: 18 },
      { xPct: 50, yPct: 90, widthPct: 88, heightPct: 16 },
    ],
  },
  {
    id: 'pepites-first-world-problems',
    url: '/templates/pepites-first-world-problems.jpg',
    name: 'First World Problems',
    source: 'library',
    boxes: [
      { xPct: 50, yPct: 10, widthPct: 88, heightPct: 16 },
      { xPct: 50, yPct: 90, widthPct: 88, heightPct: 16 },
    ],
  },
  {
    id: 'pepites-confession-bear',
    url: '/templates/pepites-confession-bear.jpg',
    name: 'Confession Bear',
    source: 'library',
    boxes: [
      { xPct: 50, yPct: 11, widthPct: 88, heightPct: 18 },
      { xPct: 50, yPct: 90, widthPct: 88, heightPct: 16 },
    ],
  },
  {
    id: 'pepites-y-u-no',
    url: '/templates/pepites-y-u-no.jpg',
    name: 'Y U No',
    source: 'library',
    boxes: [
      { xPct: 50, yPct: 12, widthPct: 88, heightPct: 18 },
      { xPct: 50, yPct: 88, widthPct: 88, heightPct: 18 },
    ],
  },
  {
    id: 'pepites-unpopular-opinion-puffin',
    url: '/templates/pepites-unpopular-opinion-puffin.jpg',
    name: 'Unpopular Opinion Puffin',
    source: 'library',
    boxes: [
      { xPct: 28, yPct: 15, widthPct: 46, heightPct: 24 },
      { xPct: 50, yPct: 90, widthPct: 88, heightPct: 16 },
    ],
  },
  {
    id: 'pepites-hard-to-swallow-pills',
    url: '/templates/pepites-hard-to-swallow-pills.jpg',
    name: 'Hard To Swallow Pills',
    source: 'library',
    boxes: [
      { xPct: 56, yPct: 66, widthPct: 33, heightPct: 15 },
      { xPct: 20, yPct: 94, widthPct: 37, heightPct: 11 },
    ],
  },
  {
    id: 'pepites-third-world-skeptical-kid',
    url: '/templates/pepites-third-world-skeptical-kid.jpg',
    name: 'Third World Skeptical Kid',
    source: 'library',
    boxes: [
      { xPct: 50, yPct: 8, widthPct: 88, heightPct: 12 },
      { xPct: 50, yPct: 92, widthPct: 88, heightPct: 12 },
    ],
  },
  {
    id: 'pepites-skeptical-baby',
    url: '/templates/pepites-skeptical-baby.jpg',
    name: 'Skeptical Baby',
    source: 'library',
    boxes: [
      { xPct: 50, yPct: 12, widthPct: 88, heightPct: 20 },
      { xPct: 50, yPct: 90, widthPct: 88, heightPct: 16 },
    ],
  },
  {
    id: 'pepites-grumpy-cat',
    url: '/templates/pepites-grumpy-cat.jpg',
    name: 'Grumpy Cat',
    source: 'library',
    boxes: [
      { xPct: 50, yPct: 10, widthPct: 88, heightPct: 16 },
      { xPct: 50, yPct: 90, widthPct: 88, heightPct: 16 },
    ],
  },
  {
    id: 'pepites-vote-for-pedro',
    url: '/templates/pepites-vote-for-pedro.jpg',
    name: 'Vote For Pedro',
    source: 'library',
    boxes: [{ xPct: 50, yPct: 8, widthPct: 80, heightPct: 12 }],
  },
  {
    id: 'pepites-homer-bush',
    url: '/templates/pepites-homer-bush.jpg',
    name: 'Homer Simpson Backing Into Bushes',
    source: 'library',
    boxes: [{ xPct: 50, yPct: 7, widthPct: 90, heightPct: 11 }],
  },
  {
    id: 'pepites-press-x-to-doubt',
    url: '/templates/pepites-press-x-to-doubt.jpg',
    name: 'Press X To Doubt',
    source: 'library',
    boxes: [
      { xPct: 24, yPct: 10, widthPct: 44, heightPct: 14 },
      { xPct: 24, yPct: 90, widthPct: 44, heightPct: 14 },
    ],
  },
  {
    id: 'pepites-ryan-gosling',
    url: '/templates/pepites-ryan-gosling.jpg',
    name: 'Ryan Gosling Hey Girl',
    source: 'library',
    boxes: [
      { xPct: 50, yPct: 10, widthPct: 86, heightPct: 16 },
      { xPct: 50, yPct: 90, widthPct: 86, heightPct: 16 },
    ],
  },
  {
    id: 'pepites-confused-math-lady',
    url: '/templates/pepites-confused-math-lady.jpg',
    name: 'Confused Math Lady',
    source: 'library',
    boxes: [{ xPct: 50, yPct: 6, widthPct: 90, heightPct: 10 }],
  },
  {
    id: 'pepites-big-brain-time',
    url: '/templates/pepites-big-brain-time.png',
    name: 'Big Brain Time',
    source: 'library',
    boxes: [{ xPct: 50, yPct: 11, widthPct: 84, heightPct: 21 }],
  },
  {
    id: 'pepites-coffin-dance',
    url: '/templates/pepites-coffin-dance.jpg',
    name: 'Coffin Dance',
    source: 'library',
    boxes: [{ xPct: 50, yPct: 8, widthPct: 84, heightPct: 12 }],
  },
  {
    id: 'pepites-blinking-white-guy',
    url: '/templates/pepites-blinking-white-guy.jpg',
    name: 'Blinking White Guy',
    source: 'library',
    boxes: [{ xPct: 50, yPct: 10, widthPct: 90, heightPct: 16 }],
  },
  {
    id: 'pepites-trollface',
    url: '/templates/pepites-trollface.png',
    name: 'Trollface',
    source: 'library',
    boxes: [
      { xPct: 50, yPct: 12, widthPct: 80, heightPct: 16 },
      { xPct: 50, yPct: 88, widthPct: 80, heightPct: 16 },
    ],
  },
  {
    id: 'pepites-mj-popcorn',
    url: '/templates/pepites-mj-popcorn.jpg',
    name: 'Michael Jackson Popcorn',
    source: 'library',
    boxes: [
      { xPct: 50, yPct: 10, widthPct: 88, heightPct: 16 },
      { xPct: 50, yPct: 90, widthPct: 88, heightPct: 16 },
    ],
  },
  {
    id: 'pepites-baby-yoda-tea',
    url: '/templates/pepites-baby-yoda-tea.jpg',
    name: 'Baby Yoda Drinking Tea',
    source: 'library',
    boxes: [
      { xPct: 50, yPct: 8, widthPct: 86, heightPct: 14 },
      { xPct: 50, yPct: 92, widthPct: 86, heightPct: 12 },
    ],
  },
  {
    id: 'pepites-internal-screaming',
    url: '/templates/pepites-internal-screaming.jpg',
    name: 'Internal Screaming',
    source: 'library',
    boxes: [{ xPct: 50, yPct: 9, widthPct: 86, heightPct: 14 }],
  },
  {
    id: 'pepites-kevins-chili',
    url: '/templates/pepites-kevins-chili.jpg',
    name: "Kevin's Chili",
    source: 'library',
    boxes: [
      { xPct: 50, yPct: 43, widthPct: 90, heightPct: 8 },
      { xPct: 50, yPct: 95, widthPct: 90, heightPct: 8 },
    ],
  },
  {
    id: 'pepites-michael-scott-no-god',
    url: '/templates/pepites-michael-scott-no-god.png',
    name: 'Michael Scott No God',
    source: 'library',
    boxes: [{ xPct: 50, yPct: 10, widthPct: 84, heightPct: 16 }],
  },
  {
    id: 'pepites-buscemi-fellow-kids',
    url: '/templates/pepites-buscemi-fellow-kids.jpg',
    name: 'Steve Buscemi Fellow Kids',
    source: 'library',
    boxes: [
      { xPct: 50, yPct: 8, widthPct: 86, heightPct: 14 },
      { xPct: 50, yPct: 92, widthPct: 86, heightPct: 14 },
    ],
  },
  {
    id: 'pepites-dr-evil-air-quotes',
    url: '/templates/pepites-dr-evil-air-quotes.jpg',
    name: 'Dr Evil Air Quotes',
    source: 'library',
    boxes: [
      { xPct: 50, yPct: 8, widthPct: 84, heightPct: 14 },
      { xPct: 50, yPct: 92, widthPct: 70, heightPct: 12 },
    ],
  },
  {
    id: 'pepites-american-psycho',
    url: '/templates/pepites-american-psycho.jpg',
    name: 'American Psycho Business Card',
    source: 'library',
    boxes: [
      { xPct: 23, yPct: 18, widthPct: 32, heightPct: 33 },
      { xPct: 38, yPct: 67, widthPct: 13, heightPct: 19, rotationDeg: 21 },
    ],
  },
  {
    id: 'pepites-marge-neat',
    url: '/templates/pepites-marge-neat.png',
    name: "Marge - I Just Think They're Neat",
    source: 'library',
    boxes: [{ xPct: 50, yPct: 10, widthPct: 70, heightPct: 16 }],
  },
  {
    id: 'pepites-weird-flex',
    url: '/templates/pepites-weird-flex.jpg',
    name: 'Weird Flex But Okay',
    source: 'library',
    boxes: [
      { xPct: 50, yPct: 8, widthPct: 84, heightPct: 14 },
      { xPct: 50, yPct: 92, widthPct: 84, heightPct: 12 },
    ],
  },
  {
    id: 'pepites-forever-alone',
    url: '/templates/pepites-forever-alone.jpg',
    name: 'Forever Alone',
    source: 'library',
    boxes: [
      { xPct: 50, yPct: 10, widthPct: 84, heightPct: 16 },
      { xPct: 50, yPct: 90, widthPct: 84, heightPct: 16 },
    ],
  },
  {
    id: 'pepites-skinner-out-of-touch',
    url: '/templates/pepites-skinner-out-of-touch.jpg',
    name: 'Skinner Out Of Touch',
    source: 'library',
    boxes: [
      { xPct: 50, yPct: 44, widthPct: 80, heightPct: 10 },
      { xPct: 50, yPct: 94, widthPct: 80, heightPct: 10 },
    ],
  },
  {
    id: 'pepites-rock-eyebrow',
    url: '/templates/pepites-rock-eyebrow.jpg',
    name: 'The Rock Eyebrow',
    source: 'library',
    boxes: [
      { xPct: 50, yPct: 10, widthPct: 84, heightPct: 16 },
      { xPct: 50, yPct: 90, widthPct: 84, heightPct: 14 },
    ],
  },
  {
    id: 'pepites-over-9000',
    url: '/templates/pepites-over-9000.jpg',
    name: "It's Over 9000",
    source: 'library',
    boxes: [
      { xPct: 50, yPct: 8, widthPct: 84, heightPct: 14 },
      { xPct: 50, yPct: 92, widthPct: 84, heightPct: 12 },
    ],
  },
  {
    id: 'pepites-chill-guy',
    url: '/templates/pepites-chill-guy.jpg',
    name: 'Chill Guy',
    source: 'library',
    boxes: [
      { xPct: 50, yPct: 10, widthPct: 84, heightPct: 18 },
      { xPct: 50, yPct: 90, widthPct: 84, heightPct: 16 },
    ],
  },
];
