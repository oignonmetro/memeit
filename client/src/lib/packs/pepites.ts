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
  {
    id: 'pepites-doge',
    url: 'https://imgflip.com/s/meme/Doge.jpg',
    name: 'Doge',
    source: 'library',
    boxes: [
      { xPct: 50, yPct: 13, widthPct: 88, heightPct: 22 },
      { xPct: 50, yPct: 88, widthPct: 88, heightPct: 20 },
    ],
  },
  {
    id: 'pepites-sad-keanu',
    url: 'https://imgflip.com/s/meme/Sad-Keanu.jpg',
    name: 'Sad Keanu',
    source: 'library',
    boxes: [{ xPct: 50, yPct: 12, widthPct: 88, heightPct: 20 }],
  },
  {
    id: 'pepites-gigachad',
    url: 'https://i.imgflip.com/3bdd27.jpg',
    name: 'Gigachad',
    source: 'library',
    boxes: [
      { xPct: 50, yPct: 10, widthPct: 86, heightPct: 16 },
      { xPct: 50, yPct: 92, widthPct: 86, heightPct: 14 },
    ],
  },
  {
    id: 'pepites-condescending-wonka',
    url: 'https://i.imgflip.com/1cxbum.jpg',
    name: 'Condescending Wonka',
    source: 'library',
    boxes: [
      { xPct: 50, yPct: 14, widthPct: 86, heightPct: 22 },
      { xPct: 50, yPct: 86, widthPct: 86, heightPct: 20 },
    ],
  },
  {
    id: 'pepites-matrix-morpheus',
    url: 'https://imgflip.com/s/meme/Matrix-Morpheus.jpg',
    name: 'Matrix Morpheus',
    source: 'library',
    boxes: [
      { xPct: 50, yPct: 9, widthPct: 92, heightPct: 14 },
      { xPct: 50, yPct: 90, widthPct: 92, heightPct: 16 },
    ],
  },
  {
    id: 'pepites-gandalf',
    url: 'https://i.imgflip.com/mzhyr.jpg',
    name: 'Gandalf You Shall Not Pass',
    source: 'library',
    boxes: [
      { xPct: 50, yPct: 9, widthPct: 92, heightPct: 14 },
      { xPct: 50, yPct: 92, widthPct: 92, heightPct: 12 },
    ],
  },
  {
    id: 'pepites-sparta',
    url: 'https://i.imgflip.com/65vgw.jpg',
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
    url: 'https://i.imgflip.com/2m6idj.jpg',
    name: 'Uno Reverse Card',
    source: 'library',
    boxes: [{ xPct: 50, yPct: 50, widthPct: 88, heightPct: 80 }],
  },
  {
    id: 'pepites-bad-luck-brian',
    url: 'https://imgflip.com/s/meme/Bad-Luck-Brian.jpg',
    name: 'Bad Luck Brian',
    source: 'library',
    boxes: [
      { xPct: 50, yPct: 11, widthPct: 88, heightPct: 18 },
      { xPct: 50, yPct: 90, widthPct: 88, heightPct: 16 },
    ],
  },
  {
    id: 'pepites-overly-attached-girlfriend',
    url: 'https://imgflip.com/s/meme/Overly-Attached-Girlfriend.jpg',
    name: 'Overly Attached Girlfriend',
    source: 'library',
    boxes: [
      { xPct: 50, yPct: 11, widthPct: 88, heightPct: 18 },
      { xPct: 50, yPct: 90, widthPct: 88, heightPct: 16 },
    ],
  },
  {
    id: 'pepites-first-world-problems',
    url: 'https://imgflip.com/s/meme/First-World-Problems.jpg',
    name: 'First World Problems',
    source: 'library',
    boxes: [
      { xPct: 50, yPct: 10, widthPct: 88, heightPct: 16 },
      { xPct: 50, yPct: 90, widthPct: 88, heightPct: 16 },
    ],
  },
  {
    id: 'pepites-confession-bear',
    url: 'https://imgflip.com/s/meme/Confession-Bear.jpg',
    name: 'Confession Bear',
    source: 'library',
    boxes: [
      { xPct: 50, yPct: 11, widthPct: 88, heightPct: 18 },
      { xPct: 50, yPct: 90, widthPct: 88, heightPct: 16 },
    ],
  },
  {
    id: 'pepites-y-u-no',
    url: 'https://imgflip.com/s/meme/Y-U-No.jpg',
    name: 'Y U No',
    source: 'library',
    boxes: [
      { xPct: 50, yPct: 12, widthPct: 88, heightPct: 18 },
      { xPct: 50, yPct: 88, widthPct: 88, heightPct: 18 },
    ],
  },
  {
    id: 'pepites-unpopular-opinion-puffin',
    url: 'https://imgflip.com/s/meme/Unpopular-Opinion-Puffin.jpg',
    name: 'Unpopular Opinion Puffin',
    source: 'library',
    boxes: [
      { xPct: 28, yPct: 15, widthPct: 46, heightPct: 24 },
      { xPct: 50, yPct: 90, widthPct: 88, heightPct: 16 },
    ],
  },
  {
    id: 'pepites-hard-to-swallow-pills',
    url: 'https://imgflip.com/s/meme/Hard-To-Swallow-Pills.jpg',
    name: 'Hard To Swallow Pills',
    source: 'library',
    boxes: [{ xPct: 50, yPct: 9, widthPct: 84, heightPct: 14 }],
  },
  {
    id: 'pepites-third-world-skeptical-kid',
    url: 'https://imgflip.com/s/meme/Third-World-Skeptical-Kid.jpg',
    name: 'Third World Skeptical Kid',
    source: 'library',
    boxes: [
      { xPct: 50, yPct: 8, widthPct: 88, heightPct: 12 },
      { xPct: 50, yPct: 92, widthPct: 88, heightPct: 12 },
    ],
  },
  {
    id: 'pepites-skeptical-baby',
    url: 'https://i.imgflip.com/de1qu.jpg',
    name: 'Skeptical Baby',
    source: 'library',
    boxes: [
      { xPct: 50, yPct: 12, widthPct: 88, heightPct: 20 },
      { xPct: 50, yPct: 90, widthPct: 88, heightPct: 16 },
    ],
  },
  {
    id: 'pepites-grumpy-cat',
    url: 'https://imgflip.com/s/meme/Grumpy-Cat.jpg',
    name: 'Grumpy Cat',
    source: 'library',
    boxes: [
      { xPct: 50, yPct: 10, widthPct: 88, heightPct: 16 },
      { xPct: 50, yPct: 90, widthPct: 88, heightPct: 16 },
    ],
  },
  {
    id: 'pepites-vote-for-pedro',
    url: 'https://i.imgflip.com/17tswa.jpg',
    name: 'Vote For Pedro',
    source: 'library',
    boxes: [{ xPct: 50, yPct: 8, widthPct: 80, heightPct: 12 }],
  },
  {
    id: 'pepites-homer-bush',
    url: 'https://i.imgflip.com/9yed5.jpg',
    name: 'Homer Simpson Backing Into Bushes',
    source: 'library',
    boxes: [{ xPct: 50, yPct: 10, widthPct: 90, heightPct: 11 }],
  },
  {
    id: 'pepites-press-x-to-doubt',
    url: 'https://i.imgflip.com/1txerc.jpg',
    name: 'Press X To Doubt',
    source: 'library',
    boxes: [
      { xPct: 24, yPct: 10, widthPct: 44, heightPct: 14 },
      { xPct: 24, yPct: 90, widthPct: 44, heightPct: 14 },
    ],
  },
  {
    id: 'pepites-ryan-gosling',
    url: 'https://i.imgflip.com/vx8ys.jpg',
    name: 'Ryan Gosling Hey Girl',
    source: 'library',
    boxes: [
      { xPct: 50, yPct: 10, widthPct: 86, heightPct: 16 },
      { xPct: 50, yPct: 90, widthPct: 86, heightPct: 16 },
    ],
  },
  {
    id: 'pepites-confused-math-lady',
    url: 'https://i.imgflip.com/1j9mu4.jpg',
    name: 'Confused Math Lady',
    source: 'library',
    boxes: [{ xPct: 50, yPct: 6, widthPct: 90, heightPct: 10 }],
  },
  {
    id: 'pepites-big-brain-time',
    url: 'https://i.imgflip.com/3518id.png',
    name: 'Big Brain Time',
    source: 'library',
    boxes: [{ xPct: 50, yPct: 8, widthPct: 84, heightPct: 14 }],
  },
  {
    id: 'pepites-coffin-dance',
    url: 'https://i.imgflip.com/3ul12m.jpg',
    name: 'Coffin Dance',
    source: 'library',
    boxes: [{ xPct: 50, yPct: 8, widthPct: 84, heightPct: 12 }],
  },
  {
    id: 'pepites-blinking-white-guy',
    url: 'https://i.imgflip.com/3jdj4d.jpg',
    name: 'Blinking White Guy',
    source: 'library',
    boxes: [{ xPct: 50, yPct: 10, widthPct: 90, heightPct: 16 }],
  },
  {
    id: 'pepites-trollface',
    url: 'https://i.imgflip.com/65r9wp.png',
    name: 'Trollface',
    source: 'library',
    boxes: [
      { xPct: 50, yPct: 12, widthPct: 80, heightPct: 16 },
      { xPct: 50, yPct: 88, widthPct: 80, heightPct: 16 },
    ],
  },
  {
    id: 'pepites-mj-popcorn',
    url: 'https://imgflip.com/s/meme/Michael-Jackson-Popcorn.jpg',
    name: 'Michael Jackson Popcorn',
    source: 'library',
    boxes: [
      { xPct: 50, yPct: 10, widthPct: 88, heightPct: 16 },
      { xPct: 50, yPct: 90, widthPct: 88, heightPct: 16 },
    ],
  },
  {
    id: 'pepites-baby-yoda-tea',
    url: 'https://i.imgflip.com/3i0iiq.jpg',
    name: 'Baby Yoda Drinking Tea',
    source: 'library',
    boxes: [
      { xPct: 50, yPct: 8, widthPct: 86, heightPct: 14 },
      { xPct: 50, yPct: 92, widthPct: 86, heightPct: 12 },
    ],
  },
  {
    id: 'pepites-internal-screaming',
    url: 'https://i.imgflip.com/6f7ppl.jpg',
    name: 'Internal Screaming',
    source: 'library',
    boxes: [{ xPct: 50, yPct: 10, widthPct: 86, heightPct: 16 }],
  },
  {
    id: 'pepites-kevins-chili',
    url: 'https://i.imgflip.com/2ovv1u.jpg',
    name: "Kevin's Chili",
    source: 'library',
    boxes: [
      { xPct: 50, yPct: 5, widthPct: 90, heightPct: 8 },
      { xPct: 50, yPct: 95, widthPct: 90, heightPct: 8 },
    ],
  },
  {
    id: 'pepites-michael-scott-no-god',
    url: 'https://i.imgflip.com/78llpq.png',
    name: 'Michael Scott No God',
    source: 'library',
    boxes: [{ xPct: 50, yPct: 10, widthPct: 84, heightPct: 16 }],
  },
  {
    id: 'pepites-buscemi-fellow-kids',
    url: 'https://i.imgflip.com/z2nqj.jpg',
    name: 'Steve Buscemi Fellow Kids',
    source: 'library',
    boxes: [
      { xPct: 50, yPct: 8, widthPct: 86, heightPct: 14 },
      { xPct: 50, yPct: 92, widthPct: 86, heightPct: 14 },
    ],
  },
  {
    id: 'pepites-dr-evil-air-quotes',
    url: 'https://i.imgflip.com/136hly.jpg',
    name: 'Dr Evil Air Quotes',
    source: 'library',
    boxes: [
      { xPct: 50, yPct: 8, widthPct: 84, heightPct: 14 },
      { xPct: 50, yPct: 92, widthPct: 70, heightPct: 12 },
    ],
  },
  {
    id: 'pepites-american-psycho',
    url: 'https://i.imgflip.com/2luwn3.jpg',
    name: 'American Psycho Business Card',
    source: 'library',
    boxes: [
      { xPct: 50, yPct: 10, widthPct: 80, heightPct: 16 },
      { xPct: 50, yPct: 90, widthPct: 80, heightPct: 14 },
    ],
  },
  {
    id: 'pepites-marge-neat',
    url: 'https://i.imgflip.com/3tjygl.png',
    name: "Marge - I Just Think They're Neat",
    source: 'library',
    boxes: [{ xPct: 50, yPct: 10, widthPct: 70, heightPct: 16 }],
  },
  {
    id: 'pepites-weird-flex',
    url: 'https://i.imgflip.com/2m9ulw.jpg',
    name: 'Weird Flex But Okay',
    source: 'library',
    boxes: [
      { xPct: 50, yPct: 8, widthPct: 84, heightPct: 14 },
      { xPct: 50, yPct: 92, widthPct: 84, heightPct: 12 },
    ],
  },
  {
    id: 'pepites-forever-alone',
    url: 'https://imgflip.com/s/meme/Forever-Alone.jpg',
    name: 'Forever Alone',
    source: 'library',
    boxes: [
      { xPct: 50, yPct: 10, widthPct: 84, heightPct: 16 },
      { xPct: 50, yPct: 90, widthPct: 84, heightPct: 16 },
    ],
  },
  {
    id: 'pepites-skinner-out-of-touch',
    url: 'https://i.imgflip.com/1jgrgn.jpg',
    name: 'Skinner Out Of Touch',
    source: 'library',
    boxes: [
      { xPct: 50, yPct: 7, widthPct: 80, heightPct: 10 },
      { xPct: 50, yPct: 57, widthPct: 80, heightPct: 10 },
    ],
  },
  {
    id: 'pepites-rock-eyebrow',
    url: 'https://i.imgflip.com/luys2.jpg',
    name: 'The Rock Eyebrow',
    source: 'library',
    boxes: [
      { xPct: 50, yPct: 10, widthPct: 84, heightPct: 16 },
      { xPct: 50, yPct: 90, widthPct: 84, heightPct: 14 },
    ],
  },
  {
    id: 'pepites-over-9000',
    url: 'https://i.imgflip.com/a58so.jpg',
    name: "It's Over 9000",
    source: 'library',
    boxes: [
      { xPct: 50, yPct: 8, widthPct: 84, heightPct: 14 },
      { xPct: 50, yPct: 92, widthPct: 84, heightPct: 12 },
    ],
  },
  {
    id: 'pepites-chill-guy',
    url: 'https://i.imgflip.com/9au02y.jpg',
    name: 'Chill Guy',
    source: 'library',
    boxes: [
      { xPct: 50, yPct: 10, widthPct: 84, heightPct: 18 },
      { xPct: 50, yPct: 90, widthPct: 84, heightPct: 16 },
    ],
  },
];
