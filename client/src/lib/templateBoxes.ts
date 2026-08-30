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
  '438680': [{ xPct: 26, yPct: 10, widthPct: 44, heightPct: 19 }, { xPct: 77, yPct: 11, widthPct: 40, heightPct: 22 }], // Batman Slapping Robin
  '1035805': [{ xPct: 61, yPct: 5, widthPct: 59, heightPct: 8 }, { xPct: 15, yPct: 41, widthPct: 21, heightPct: 5 }, { xPct: 41, yPct: 42, widthPct: 17, heightPct: 5 }, { xPct: 74, yPct: 43, widthPct: 27, heightPct: 8 }], // Boardroom Meeting Suggestion
  '55311130': [{ xPct: 25, yPct: 13, widthPct: 46, heightPct: 18 }, { xPct: 68, yPct: 90, widthPct: 32, heightPct: 16 }], // This Is Fine (top text over left panel only, clear of the baked "THIS IS FINE." bubble)
  '67452763': [{ xPct: 20, yPct: 12, widthPct: 38, heightPct: 20 }, { xPct: 70, yPct: 66, widthPct: 48, heightPct: 20 }], // Squidward window (text 1 over Squidward on the left, text 2 lower-right below SpongeBob & Patrick)
  '72525473': [{ xPct: 50, yPct: 30, widthPct: 98, heightPct: 8 }, { xPct: 47, yPct: 44, widthPct: 36, heightPct: 14 }, { xPct: 50, yPct: 66, widthPct: 97, heightPct: 6 }], // say the line bart! simpsons
  '79132341': [{ xPct: 72, yPct: 21, widthPct: 41, heightPct: 14 }, { xPct: 25, yPct: 58, widthPct: 35, heightPct: 18 }, { xPct: 72, yPct: 75, widthPct: 41, heightPct: 11 }], // Bike Fall
  '80707627': [{ xPct: 42, yPct: 32, widthPct: 48, heightPct: 14 }, { xPct: 27, yPct: 80, widthPct: 40, heightPct: 14 }, { xPct: 85, yPct: 82, widthPct: 20, heightPct: 12 }], // Sad Pablo Escobar
  '84341851': [{ xPct: 23, yPct: 11, widthPct: 40, heightPct: 20 }, { xPct: 70, yPct: 12, widthPct: 40, heightPct: 22 }], // Evil Kermit
  '87743020': [{ xPct: 26, yPct: 15, widthPct: 28, heightPct: 10, rotationDeg: -16 }, { xPct: 58, yPct: 11, widthPct: 24, heightPct: 9, rotationDeg: -10 }, { xPct: 50, yPct: 88, widthPct: 86, heightPct: 16 }], // Two Buttons
  '91998305': [{ xPct: 74, yPct: 25, widthPct: 48, heightPct: 40 }, { xPct: 74, yPct: 75, widthPct: 48, heightPct: 40 }], // Drake Blank
  '93895088': [{ xPct: 24, yPct: 13, widthPct: 46, heightPct: 21 }, { xPct: 25, yPct: 38, widthPct: 46, heightPct: 21 }, { xPct: 25, yPct: 62, widthPct: 46, heightPct: 19 }, { xPct: 25, yPct: 87, widthPct: 46, heightPct: 20 }], // Expanding Brain
  '99683372': [{ xPct: 25, yPct: 25, widthPct: 46, heightPct: 40 }, { xPct: 25, yPct: 75, widthPct: 46, heightPct: 40 }], // Sleeping Shaq / I sleep real shit (blank left column, one caption per face)
  '100777631': [{ xPct: 29, yPct: 27, widthPct: 34, heightPct: 20 }, { xPct: 84, yPct: 18, widthPct: 30, heightPct: 16 }], // Is This A Pigeon (2 zones seulement, la 3e était redondante)
  '104893621': [{ xPct: 20, yPct: 20, widthPct: 26, heightPct: 18 }, { xPct: 45, yPct: 20, widthPct: 24, heightPct: 18 }, { xPct: 70, yPct: 20, widthPct: 24, heightPct: 18 }], // Grim Reaper Knocking Door
  '110133729': [{ xPct: 27, yPct: 55, widthPct: 25, heightPct: 24 }, { xPct: 76, yPct: 52, widthPct: 30, heightPct: 24 }], // spiderman pointing at spiderman
  '112126428': [{ xPct: 30, yPct: 72, widthPct: 26, heightPct: 20 }, { xPct: 58, yPct: 50, widthPct: 26, heightPct: 20 }, { xPct: 86, yPct: 58, widthPct: 24, heightPct: 20 }], // Distracted Boyfriend
  '114585149': [{ xPct: 52, yPct: 5, widthPct: 84, heightPct: 10 }, { xPct: 51, yPct: 43, widthPct: 84, heightPct: 10 }, { xPct: 50, yPct: 56, widthPct: 84, heightPct: 10 }, { xPct: 49, yPct: 90, widthPct: 84, heightPct: 12 }], // Inhaling Seagull
  '119215120': [{ xPct: 72, yPct: 69, widthPct: 32, heightPct: 14 }], // Types of Headaches meme (la tête "Stress" a déjà son label incrusté, une seule zone reste pour la tête rouge sans nom)
  '124822590': [{ xPct: 31, yPct: 23, widthPct: 19, heightPct: 20 }, { xPct: 62, yPct: 23, widthPct: 22, heightPct: 23 }, { xPct: 45, yPct: 80, widthPct: 34, heightPct: 16 }], // Left Exit 12 Off Ramp (narrower boxes so the two top labels don't overlap)
  '129242436': [{ xPct: 40, yPct: 9, widthPct: 33, heightPct: 14 }, { xPct: 66, yPct: 71, widthPct: 43, heightPct: 25, rotationDeg: -6 }], // Change My Mind
  '129315248': [{ xPct: 68, yPct: 26, widthPct: 48, heightPct: 40 }, { xPct: 74, yPct: 75, widthPct: 48, heightPct: 40 }], // No - Yes
  '131087935': [{ xPct: 27, yPct: 7, widthPct: 50, heightPct: 12 }, { xPct: 80, yPct: 18, widthPct: 36, heightPct: 20 }, { xPct: 14, yPct: 84, widthPct: 27, heightPct: 16 }, { xPct: 87, yPct: 68, widthPct: 24, heightPct: 22 }, { xPct: 53, yPct: 56, widthPct: 42, heightPct: 9 }], // Running Away Balloon (labels dans le ciel au-dessus des personnages et au centre des ballons, aucune zone sur la séparation des deux cases)
  '131940431': [{ xPct: 38, yPct: 30, widthPct: 19, heightPct: 40 }, { xPct: 88, yPct: 30, widthPct: 19, heightPct: 39 }, { xPct: 38, yPct: 80, widthPct: 19, heightPct: 41 }, { xPct: 88, yPct: 80, widthPct: 20, heightPct: 39 }], // Gru's Plan
  '135256802': [{ xPct: 18, yPct: 61, widthPct: 37, heightPct: 29 }, { xPct: 82, yPct: 52, widthPct: 36, heightPct: 32 }, { xPct: 38, yPct: 17, widthPct: 29, heightPct: 24 }], // Epic Handshake
  '135678846': [{ xPct: 67, yPct: 32, widthPct: 25, heightPct: 17 }, { xPct: 27, yPct: 38, widthPct: 27, heightPct: 10 }, { xPct: 51, yPct: 95, widthPct: 95, heightPct: 8 }], // Who Killed Hannibal
  '137501417': [{ xPct: 83, yPct: 8, widthPct: 32, heightPct: 16 }, { xPct: 49, yPct: 33, widthPct: 22, heightPct: 16 }], // Friendship ended (text over the baked "MUDASIR" / "SALMAN" names)
  '145139900': [{ xPct: 22, yPct: 23, widthPct: 29, heightPct: 21 }, { xPct: 77, yPct: 31, widthPct: 42, heightPct: 18 }, { xPct: 23, yPct: 70, widthPct: 28, heightPct: 18 }], // Scooby doo mask reveal
  '161865971': [{ xPct: 53, yPct: 19, widthPct: 16, heightPct: 12, rotationDeg: -16 }, { xPct: 48, yPct: 61, widthPct: 71, heightPct: 22 }], // Marked Safe From
  '162372564': [{ xPct: 21, yPct: 16, widthPct: 34, heightPct: 26 }, { xPct: 49, yPct: 92, widthPct: 16, heightPct: 13 }], // Domino Effect
  '166969924': [{ xPct: 29, yPct: 23, widthPct: 27, heightPct: 16 }, { xPct: 80, yPct: 16, widthPct: 35, heightPct: 8 }, { xPct: 66, yPct: 88, widthPct: 48, heightPct: 18 }], // Flex Tape
  '171305372': [{ xPct: 25, yPct: 12, widthPct: 30, heightPct: 22 }, { xPct: 39, yPct: 56, widthPct: 30, heightPct: 18 }, { xPct: 80, yPct: 66, widthPct: 30, heightPct: 24 }], // Soldier protecting sleeping child
  '178591752': [{ xPct: 72, yPct: 25, widthPct: 53, heightPct: 44 }, { xPct: 72, yPct: 76, widthPct: 53, heightPct: 43 }], // Tuxedo Winnie The Pooh
  '180190441': [{ xPct: 27, yPct: 19, widthPct: 34, heightPct: 25, rotationDeg: 11 }, { xPct: 78, yPct: 26, widthPct: 39, heightPct: 27, rotationDeg: 9 }, { xPct: 66, yPct: 58, widthPct: 32, heightPct: 10 }], // They're The Same Picture
  '181913649': [{ xPct: 75, yPct: 25, widthPct: 46, heightPct: 40 }, { xPct: 75, yPct: 75, widthPct: 46, heightPct: 40 }], // Drake Hotline Bling
  '187102311': [{ xPct: 16, yPct: 12, widthPct: 30, heightPct: 16 }, { xPct: 48, yPct: 8, widthPct: 30, heightPct: 16 }, { xPct: 82, yPct: 22, widthPct: 30, heightPct: 16 }], // Three-headed Dragon (one label per head, no bottom box)
  '188390779': [{ xPct: 24, yPct: 11, widthPct: 47, heightPct: 20 }, { xPct: 76, yPct: 11, widthPct: 47, heightPct: 21 }], // Woman Yelling At Cat
  '195515965': [{ xPct: 28, yPct: 12, widthPct: 54, heightPct: 18 }, { xPct: 28, yPct: 37, widthPct: 54, heightPct: 18 }, { xPct: 27, yPct: 62, widthPct: 54, heightPct: 18 }, { xPct: 28, yPct: 87, widthPct: 54, heightPct: 18 }], // Clown Applying Makeup (text in the blank space left of each face, not on top of it)
  '206151308': [{ xPct: 24, yPct: 44, widthPct: 30, heightPct: 20 }, { xPct: 55, yPct: 8, widthPct: 34, heightPct: 15 }, { xPct: 79, yPct: 46, widthPct: 30, heightPct: 20 }], // Spider Man Triple
  '217743513': [{ xPct: 32, yPct: 40, widthPct: 28, heightPct: 20 }, { xPct: 75, yPct: 59, widthPct: 46, heightPct: 30 }], // UNO Draw 25 Cards
  '224514655': [{ xPct: 64, yPct: 16, widthPct: 44, heightPct: 14 }, { xPct: 22, yPct: 34, widthPct: 44, heightPct: 16 }], // Anime Girl Hiding from Terminator
  '226297822': [{ xPct: 25, yPct: 17, widthPct: 43, heightPct: 30 }, { xPct: 24, yPct: 51, widthPct: 41, heightPct: 30 }, { xPct: 24, yPct: 84, widthPct: 41, heightPct: 28 }], // Panik Kalm Panik
  '234202281': [{ xPct: 48, yPct: 82, widthPct: 42, heightPct: 26 }, { xPct: 61, yPct: 13, widthPct: 29, heightPct: 22 }], // AJ Styles & Undertaker
  '247113703': [{ xPct: 61, yPct: 9, widthPct: 44, heightPct: 14 }, { xPct: 40, yPct: 68, widthPct: 44, heightPct: 14 }], // A train hitting a school bus
  '247375501': [{ xPct: 10, yPct: 14, widthPct: 18, heightPct: 20 }, { xPct: 85, yPct: 16, widthPct: 24, heightPct: 16 }, { xPct: 25, yPct: 84, widthPct: 44, heightPct: 20 }, { xPct: 78, yPct: 84, widthPct: 44, heightPct: 20 }], // Buff Doge vs. Cheems
  '252600902': [{ xPct: 45, yPct: 22, widthPct: 50, heightPct: 18 }, { xPct: 78, yPct: 52, widthPct: 40, heightPct: 18 }], // Always Has Been
  '252758727': [{ xPct: 87, yPct: 17, widthPct: 25, heightPct: 12 }, { xPct: 50, yPct: 33, widthPct: 22, heightPct: 14 }, { xPct: 28, yPct: 55, widthPct: 38, heightPct: 13 }, { xPct: 55, yPct: 90, widthPct: 41, heightPct: 15 }], // Mother Ignoring Kid Drowning In A Pool (text 1 above the mom on the right, text 3 just below the drowning boy's head)
  '309668311': [{ xPct: 28, yPct: 30, widthPct: 36, heightPct: 20 }, { xPct: 72, yPct: 30, widthPct: 36, heightPct: 20 }, { xPct: 50, yPct: 86, widthPct: 60, heightPct: 12 }], // Two Paths
  '309868304': [{ xPct: 23, yPct: 34, widthPct: 40, heightPct: 24 }, { xPct: 72, yPct: 34, widthPct: 39, heightPct: 24 }, { xPct: 48, yPct: 90, widthPct: 80, heightPct: 10 }], // Trade Offer
  '322841258': [{ xPct: 25, yPct: 43, widthPct: 47, heightPct: 11 }, { xPct: 75, yPct: 45, widthPct: 48, heightPct: 7 }, { xPct: 25, yPct: 96, widthPct: 49, heightPct: 9 }], // Anakin Padme 4 Panel (texte 3 sur la case bas-gauche)
  '342785297': [{ xPct: 51, yPct: 8, widthPct: 84, heightPct: 14 }, { xPct: 50, yPct: 86, widthPct: 97, heightPct: 27 }], // Gus Fring we are not the same
  '354700819': [{ xPct: 17, yPct: 40, widthPct: 33, heightPct: 27 }, { xPct: 73, yPct: 76, widthPct: 40, heightPct: 24 }], // Two guys on a bus
  '360597639': [{ xPct: 50, yPct: 18, widthPct: 88, heightPct: 14 }, { xPct: 77, yPct: 44, widthPct: 40, heightPct: 12 }], // whe i'm in a competition and my opponent is (le texte incrusté est coupé en deux : zone 1 dans le trou entre les deux lignes, zone 2 juste après "opponent is" → "when i'm in a [1] competition and my opponent is [2]")
  '533936279': [{ xPct: 19, yPct: 43, widthPct: 32, heightPct: 32 }, { xPct: 49, yPct: 10, widthPct: 30, heightPct: 20 }, { xPct: 84, yPct: 34, widthPct: 29, heightPct: 34 }], // Bell Curve
  '657846647': [{ xPct: 50, yPct: 81, widthPct: 98, heightPct: 26 }], // Empire State Building climbers (single caption above the climbers)
  '21735': [{ xPct: 77, yPct: 13, widthPct: 40, heightPct: 14 }, { xPct: 78, yPct: 45, widthPct: 38, heightPct: 13 }], // The Rock Driving (une zone par bulle : la 2e bulle est dans la case du milieu, pas juste sous la 1re)
  '50421420': [{ xPct: 31, yPct: 25, widthPct: 57, heightPct: 44 }, { xPct: 31, yPct: 76, widthPct: 57, heightPct: 44 }], // Disappointed Black Guy (left column)
  '91545132': [{ xPct: 23, yPct: 11, widthPct: 25, heightPct: 14 }, { xPct: 52, yPct: 57, widthPct: 23, heightPct: 39 }], // Trump Bill Signing (texte 1 sur la tête de Trump, texte 2 sur le document)
  '123999232': [{ xPct: 27, yPct: 70, widthPct: 42, heightPct: 18 }, { xPct: 27, yPct: 87, widthPct: 42, heightPct: 12 }], // The Scroll Of Truth (scroll)
  '155067746': [{ xPct: 50, yPct: 21, widthPct: 88, heightPct: 33 }], // Surprised Pikachu (top lines)
  '221578498': [{ xPct: 24, yPct: 17, widthPct: 32, heightPct: 16, rotationDeg: -2 }, { xPct: 69, yPct: 69, widthPct: 34, heightPct: 20 }], // Grant Gustin over grave (texte 1 recentré sur la pierre tombale)
  '222403160': [{ xPct: 50, yPct: 92, widthPct: 84, heightPct: 12 }], // Bernie I Am Once Again Asking (below the baked "I am once again asking" line, so the caption completes the sentence)
  '284929871': [{ xPct: 43, yPct: 9, widthPct: 31, heightPct: 13 }, { xPct: 75, yPct: 59, widthPct: 44, heightPct: 14 }], // They don't know (lonely guy, left)
  '427308417': [{ xPct: 76, yPct: 40, widthPct: 46, heightPct: 25, rotationDeg: -1 }, { xPct: 46, yPct: 83, widthPct: 27, heightPct: 28 }], // 0 days without (bottom, avoid baked sign)
  '4087833': [{ xPct: 50, yPct: 85, widthPct: 90, heightPct: 26 }], // Waiting Skeleton
  '91538330': [{ xPct: 50, yPct: 85, widthPct: 95, heightPct: 26 }], // X, X Everywhere
  '97984': [{ xPct: 50, yPct: 12, widthPct: 90, heightPct: 21 }], // Disaster Girl
  '101470': [{ xPct: 50, yPct: 15, widthPct: 90, heightPct: 26 }, { xPct: 50, yPct: 85, widthPct: 90, heightPct: 26 }], // Ancient Aliens
  '124055727': [{ xPct: 50, yPct: 15, widthPct: 90, heightPct: 26 }, { xPct: 50, yPct: 85, widthPct: 90, heightPct: 26 }], // Y'all Got Any More Of That
  '224015000': [{ xPct: 52, yPct: 15, widthPct: 39, heightPct: 23 }, { xPct: 50, yPct: 90, widthPct: 90, heightPct: 15 }], // Bernie Sanders Once Again Asking
  '102156234': [{ xPct: 50, yPct: 15, widthPct: 90, heightPct: 26 }, { xPct: 50, yPct: 85, widthPct: 90, heightPct: 26 }], // Mocking Spongebob
  '61579': [{ xPct: 50, yPct: 15, widthPct: 90, heightPct: 26 }, { xPct: 50, yPct: 85, widthPct: 90, heightPct: 26 }], // One Does Not Simply
  '177682295': [{ xPct: 50, yPct: 15, widthPct: 90, heightPct: 26 }, { xPct: 50, yPct: 85, widthPct: 90, heightPct: 26 }], // You Guys are Getting Paid
  '505705955': [{ xPct: 50, yPct: 15, widthPct: 90, heightPct: 26 }, { xPct: 50, yPct: 85, widthPct: 90, heightPct: 26 }], // Absolute Cinema
  '3218037': [{ xPct: 50, yPct: 44, widthPct: 91, heightPct: 12 }, { xPct: 50, yPct: 94, widthPct: 93, heightPct: 11 }], // This Is Where I'd Put My Trophy If I Had One
  '370867422': [{ xPct: 50, yPct: 15, widthPct: 90, heightPct: 26 }, { xPct: 50, yPct: 90, widthPct: 90, heightPct: 16 }], // Megamind peeking
  '28251713': [{ xPct: 50, yPct: 15, widthPct: 90, heightPct: 26 }, { xPct: 50, yPct: 85, widthPct: 90, heightPct: 26 }], // Oprah You Get A
  '77045868': [{ xPct: 50, yPct: 15, widthPct: 90, heightPct: 26 }, { xPct: 50, yPct: 85, widthPct: 90, heightPct: 26 }], // Pawn Stars Best I Can Do
  '148909805': [{ xPct: 50, yPct: 18, widthPct: 95, heightPct: 33 }], // Monkey Puppet
  '316466202': [{ xPct: 50, yPct: 85, widthPct: 90, heightPct: 26 }], // where monkey
  '110163934': [{ xPct: 20, yPct: 53, widthPct: 40, heightPct: 26 }, { xPct: 71, yPct: 80, widthPct: 55, heightPct: 36 }], // I Bet He's Thinking About Other Women
  '89370399': [{ xPct: 50, yPct: 15, widthPct: 90, heightPct: 26 }, { xPct: 50, yPct: 85, widthPct: 90, heightPct: 26 }], // Roll Safe Think About It
  '216523697': [{ xPct: 50, yPct: 84, widthPct: 90, heightPct: 29 }], // All My Homies Hate
  '208915813': [{ xPct: 50, yPct: 15, widthPct: 90, heightPct: 26 }], // George Bush 9/11
  '371619279': [{ xPct: 50, yPct: 15, widthPct: 90, heightPct: 26 }, { xPct: 50, yPct: 85, widthPct: 90, heightPct: 26 }], // Megamind no bitches
  '101956210': [{ xPct: 49, yPct: 49, widthPct: 90, heightPct: 11 }, { xPct: 50, yPct: 85, widthPct: 90, heightPct: 26 }], // Whisper and Goosebumps
  '61520': [{ xPct: 50, yPct: 15, widthPct: 90, heightPct: 26 }, { xPct: 50, yPct: 85, widthPct: 90, heightPct: 26 }], // Futurama Fry
  '119139145': [{ xPct: 50, yPct: 15, widthPct: 90, heightPct: 26 }, { xPct: 28, yPct: 64, widthPct: 37, heightPct: 26 }], // Blank Nut Button
  '61556': [{ xPct: 50, yPct: 15, widthPct: 90, heightPct: 26 }, { xPct: 50, yPct: 85, widthPct: 90, heightPct: 26 }], // Grandma Finds The Internet
  '259237855': [{ xPct: 50, yPct: 12, widthPct: 90, heightPct: 19 }, { xPct: 50, yPct: 85, widthPct: 90, heightPct: 26 }], // Laughing Leo
  '133946291': [{ xPct: 50, yPct: 15, widthPct: 90, heightPct: 26 }, { xPct: 50, yPct: 85, widthPct: 90, heightPct: 26 }], // You know, I'm something of a scientist myself
  '27813981': [{ xPct: 50, yPct: 43, widthPct: 90, heightPct: 12 }, { xPct: 50, yPct: 92, widthPct: 90, heightPct: 13 }], // Hide the Pain Harold
  '163573': [{ xPct: 50, yPct: 12, widthPct: 90, heightPct: 20 }, { xPct: 50, yPct: 88, widthPct: 90, heightPct: 20 }], // Imagination Spongebob
  '92084495': [{ xPct: 50, yPct: 12, widthPct: 90, heightPct: 21 }, { xPct: 50, yPct: 85, widthPct: 90, heightPct: 26 }], // Charlie Conspiracy (Always Sunny in Philidelphia)
  '20007896': [{ xPct: 50, yPct: 15, widthPct: 50, heightPct: 15 }, { xPct: 59, yPct: 87, widthPct: 73, heightPct: 22 }], // c'mon do something
  '16464531': [{ xPct: 50, yPct: 15, widthPct: 90, heightPct: 26 }, { xPct: 50, yPct: 85, widthPct: 90, heightPct: 26 }], // But That's None Of My Business
  '29617627': [{ xPct: 50, yPct: 13, widthPct: 90, heightPct: 23 }, { xPct: 50, yPct: 85, widthPct: 90, heightPct: 26 }], // Look At Me
  '14371066': [{ xPct: 50, yPct: 12, widthPct: 90, heightPct: 20 }, { xPct: 50, yPct: 85, widthPct: 90, heightPct: 26 }], // Star Wars Yoda
  '101716': [{ xPct: 50, yPct: 12, widthPct: 90, heightPct: 20 }, { xPct: 50, yPct: 85, widthPct: 90, heightPct: 26 }], // Yo Dawg Heard You
};

export function boxesForImgflip(imgflipId: string, boxCount: number): TemplateBox[] {
  return CURATED[imgflipId] ?? genericBoxes(boxCount);
}

// Uploaded custom templates: no box_count info, default to classic top/bottom.
export const DEFAULT_UPLOAD_BOXES: TemplateBox[] = genericBoxes(2);
