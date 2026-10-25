// Éditeur visuel des zones de texte des templates (dev uniquement).
//
// Pourquoi cette page existe : positionner une zone de texte est une tâche de
// manipulation directe. La décrire en prose ("un peu plus à gauche, au-dessus
// de la tête") puis la traduire en xPct/yPct est une boucle lente et
// approximative. Ici on déplace le rectangle, et le fichier source est réécrit.
//
// Point important : l'aperçu utilise le vrai composant MemeRender, pas une
// approximation. Un éditeur qui rendrait "à peu près" pareil ferait corriger
// contre une cible fausse.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, Dispatch, SetStateAction } from 'react';
import MemeRender from '../components/MemeRender';
import { CLASSIQUES_TEMPLATES } from '../lib/packs/classiques';
import { PEPITES_TEMPLATES } from '../lib/packs/pepites';
import { SNAP_TEMPLATES } from '../lib/packs/snap';
import { FRANCAIS_TEMPLATES } from '../lib/packs/francais';
import { SUBTITLE_FONT_STACK, blobToDataUrl, renderTemplateWithSubtitles } from './subtitleRender';
import type { SubtitleEntry } from './subtitleRender';
import { cropTemplate, remapBoxToCrop } from './cropRender';
import type { Template, TemplateBox, TextLayer } from '../types';

type PackId = 'classiques' | 'pepites' | 'snap' | 'francais';
type Entry = { template: Template; pack: PackId };
// Sélection par pack "joueur" : côté lobby, classiques.ts et pepites.ts sont
// fusionnés en un seul pack "Classiques" (voir packs/index.ts) — le
// sélecteur reproduit ce découpage-là plutôt que les 3 PackId internes, pour
// que "choisir un pack" corresponde à ce que les joueurs voient réellement.
type PackFilter = 'tous' | 'classiques' | 'snap' | 'francais';
type SampleMode = 'court' | 'long' | 'numeros';
// Un seul outil actif à la fois : chacun a ses propres cadres sur l'image, et
// n'activer que ceux de l'outil courant évite d'attraper un sous-titre en
// voulant déplacer une zone (ou l'inverse) quand ils se chevauchent.
type Tool = 'zones' | 'subtitles' | 'crop';

const ENTRIES: Entry[] = [
  ...CLASSIQUES_TEMPLATES.map((template) => ({ template, pack: 'classiques' as const })),
  ...PEPITES_TEMPLATES.map((template) => ({ template, pack: 'pepites' as const })),
  ...SNAP_TEMPLATES.map((template) => ({ template, pack: 'snap' as const })),
  ...FRANCAIS_TEMPLATES.map((template) => ({ template, pack: 'francais' as const })),
];

// Étiquette purement interne à l'éditeur (fichier source d'origine) — depuis
// la fusion des packs "Classiques" et "Pépites" côté joueur, TEMPLATE_PACKS
// n'en expose plus qu'un seul et ne peut donc plus servir à nommer les
// différentes origines de fichier que l'éditeur doit encore distinguer pour
// savoir où écrire (classiques.ts vs pepites.ts vs snap.ts...).
const PACK_NAME: Record<PackId, string> = {
  classiques: 'Classiques',
  pepites: 'Pépites',
  snap: 'Snap français',
  francais: 'Memes français',
};

const PACK_FILTERS: { id: PackFilter; label: string }[] = [
  { id: 'tous', label: 'Tous' },
  { id: 'classiques', label: 'Classiques' },
  { id: 'snap', label: 'Snap' },
  { id: 'francais', label: 'Français' },
];

function matchesPackFilter(pack: PackId, packFilter: PackFilter): boolean {
  if (packFilter === 'tous') return true;
  if (packFilter === 'classiques') return pack === 'classiques' || pack === 'pepites';
  return pack === packFilter;
}

// Les légendes longues sont le vrai test : c'est le texte long qui révèle les
// chevauchements (cf. les deux libellés du haut de "Left Exit 12 Off Ramp").
const SAMPLES: Record<SampleMode, string[]> = {
  court: ['MOI', 'TOI', 'EUX', 'ÇA', 'LUI', 'NOUS'],
  long: [
    'QUAND TU DIS QUE TU ARRIVES DANS CINQ MINUTES',
    'MOI QUI ATTENDS DEPUIS QUARANTE MINUTES DEHORS',
    'LES GENS NORMAUX QUI ONT UNE VIE ÉQUILIBRÉE',
    'CE TRUC DONT PERSONNE NE VOULAIT ENTENDRE PARLER',
    'LA PERSONNE QUI A EU CETTE IDÉE DE GÉNIE',
    'TOUT LE MONDE DANS LA SALLE À CE MOMENT PRÉCIS',
  ],
  numeros: ['1', '2', '3', '4', '5', '6'],
};

const SAMPLE_MODES: { id: SampleMode; label: string; title: string }[] = [
  { id: 'long', label: 'Long', title: 'Légendes longues (révèlent les chevauchements)' },
  { id: 'court', label: 'Court', title: 'Légendes courtes' },
  { id: 'numeros', label: '1·2·3', title: 'Numéros des zones' },
];

// Une couleur par zone, reprise à l'identique sur l'image et dans la liste de
// droite : on retrouve d'un coup d'œil quelle carte pilote quel cadre. Le
// cyan et l'orange sont exclus, réservés aux sous-titres et au rognage.
const ZONE_COLORS = ['#ffd166', '#06d6a0', '#ff6b9a', '#b794ff', '#c6f432', '#ff9e7a', '#f9a8d4', '#fde68a', '#86efac'];
const SUBTITLE_COLOR = '#4cc9f0';
const CROP_COLOR = '#f77f00';

const MIN_W = 4;
const MIN_H = 3;

function sampleText(mode: SampleMode, i: number): string {
  const pool = SAMPLES[mode];
  return pool[i % pool.length];
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round = (v: number) => Math.round(v);

// e.preventDefault() sur un pointerdown supprime aussi le blur automatique du
// champ actuellement focus (comportement standard du navigateur) — sans ça,
// cliquer une zone du canvas juste après une recherche laisse le focus dans
// le champ de recherche, et tous les raccourcis clavier (s, r, +, Suppr,
// 1-9...) atterrissent comme du texte tapé dans la recherche au lieu de
// déclencher l'action voulue.
function blurActiveField() {
  const el = document.activeElement;
  if (el instanceof HTMLElement && el !== document.body) el.blur();
}

// Normalise dans [-180, 180) : deux valeurs qui désignent le même angle
// (ex. 270 et -90) doivent compter comme identiques, pas comme "modifié".
function normDeg(deg: number): number {
  return (((deg + 180) % 360) + 360) % 360 - 180;
}

function sameBoxes(a: TemplateBox[], b: TemplateBox[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (box, i) =>
        box.xPct === b[i].xPct &&
        box.yPct === b[i].yPct &&
        box.widthPct === b[i].widthPct &&
        box.heightPct === b[i].heightPct &&
        normDeg(box.rotationDeg || 0) === normDeg(b[i].rotationDeg || 0)
    )
  );
}

// Fait pivoter un vecteur (delta en % du cadre) de `deg` degrés. Sert à
// convertir un déplacement écran en déplacement local à une zone tournée,
// et inversement — cf. startDrag ci-dessous pour le pourquoi.
function rotateVec(dx: number, dy: number, deg: number): { dx: number; dy: number } {
  if (!deg) return { dx, dy };
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { dx: dx * cos - dy * sin, dy: dx * sin + dy * cos };
}

// Poignées de redimensionnement : (sx, sy) indique quel bord suit le pointeur.
// La boîte étant ancrée par son centre, déplacer un bord de d change la taille
// de d et recentre de d/2 — le bord opposé reste ainsi immobile.
type Handle = { sx: -1 | 0 | 1; sy: -1 | 0 | 1 };
const HANDLES: (Handle & { cursor: string })[] = [
  { sx: -1, sy: -1, cursor: 'nwse-resize' },
  { sx: 0, sy: -1, cursor: 'ns-resize' },
  { sx: 1, sy: -1, cursor: 'nesw-resize' },
  { sx: 1, sy: 0, cursor: 'ew-resize' },
  { sx: 1, sy: 1, cursor: 'nwse-resize' },
  { sx: 0, sy: 1, cursor: 'ns-resize' },
  { sx: -1, sy: 1, cursor: 'nesw-resize' },
  { sx: -1, sy: 0, cursor: 'ew-resize' },
];

const SHORTCUTS: [string[], string][] = [
  [['←', '→'], 'Template précédent / suivant (aussi [ et ])'],
  [['1', '…', '9'], 'Sélectionner une zone'],
  [['Ctrl', '↑↓←→'], 'Déplacer la zone de 1 % (Maj : 5 %)'],
  [[',', '.'], 'Pivoter de 1° (Maj : 5°)'],
  [['Alt', '↑↓'], 'Changer l’ordre (Texte 1, Texte 2…)'],
  [['+'], 'Ajouter une zone'],
  [['Suppr'], 'Supprimer la zone sélectionnée'],
  [['s'], 'Enregistrer et passer au suivant'],
  [['r'], 'Marquer revu et passer au suivant'],
  [['o'], 'Afficher / masquer les cadres'],
  [['/'], 'Rechercher un template'],
  [['Échap'], 'Quitter l’aperçu, le rognage ou cette aide'],
  [['?'], 'Afficher cette aide'],
];

// Un cadre manipulable sur l'image (zone, sous-titre ou rognage). Les
// poignées et le pivot sont des enfants : ils héritent de la transformation
// du cadre et suivent donc visuellement sa rotation, sans calcul de position
// séparé.
function OverlayBox({
  box,
  color,
  tag,
  variant,
  selected,
  passive,
  hovered,
  rotatable,
  onDrag,
  onRotate,
}: {
  box: TemplateBox;
  color: string;
  tag?: string;
  variant: 'zone' | 'subtitle' | 'crop';
  selected: boolean;
  passive: boolean;
  hovered?: boolean;
  rotatable: boolean;
  onDrag: (e: React.PointerEvent, handle: Handle | null) => void;
  onRotate?: (e: React.PointerEvent) => void;
}) {
  const cls = ['be-box', `be-box--${variant}`, selected && 'sel', passive && 'passive', hovered && 'hover']
    .filter(Boolean)
    .join(' ');
  return (
    <div
      className={cls}
      style={
        {
          '--c': color,
          left: `${box.xPct}%`,
          top: `${box.yPct}%`,
          width: `${box.widthPct}%`,
          height: `${box.heightPct}%`,
          transform: `translate(-50%, -50%) rotate(${box.rotationDeg || 0}deg)`,
        } as CSSProperties
      }
      onPointerDown={passive ? undefined : (e) => onDrag(e, null)}
    >
      {tag && <span className="be-box-tag">{tag}</span>}
      {selected && !passive && (
        <>
          {HANDLES.map((h) => (
            <span
              key={`${h.sx}${h.sy}`}
              className="be-handle"
              style={{ left: `${50 + h.sx * 50}%`, top: `${50 + h.sy * 50}%`, cursor: h.cursor }}
              onPointerDown={(e) => onDrag(e, h)}
            />
          ))}
          {rotatable && onRotate && (
            <>
              <span className="be-rotate-stalk" />
              <span className="be-rotate-handle" title="Glisser pour pivoter" onPointerDown={onRotate} />
            </>
          )}
        </>
      )}
    </div>
  );
}

export default function BoxEditor() {
  const [index, setIndex] = useState(0);
  const [packFilter, setPackFilter] = useState<PackFilter>('tous');
  const [search, setSearch] = useState('');
  const [sample, setSample] = useState<SampleMode>('long');
  const [showOverlay, setShowOverlay] = useState(true);
  const [draft, setDraft] = useState<TemplateBox[]>([]);
  const [selected, setSelected] = useState(0);
  const [hoveredZone, setHoveredZone] = useState<number | null>(null);
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<string | null>(null);
  const [frameReady, setFrameReady] = useState(false);
  // Proportions de l'image chargée : servent à dimensionner le cadre pour
  // qu'il tienne en entier dans la hauteur de l'écran, quel que soit le format
  // (une capture Snap verticale déborderait sinon sous la ligne de flottaison).
  // Rattachées à l'id du template : sans ça, le temps que la nouvelle image
  // charge, le cadre garderait la largeur calculée pour la précédente.
  const [aspect, setAspect] = useState<{ id: string; ratio: number } | null>(null);
  const [tool, setTool] = useState<Tool>('zones');
  const [showHelp, setShowHelp] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Sous-titres : texte incrusté à demeure dans le fichier image au moment de
  // « Incruster », contrairement aux zones ci-dessus (draft) qui restent
  // éditables par les joueurs à chaque partie. Ils ne viennent d'aucune
  // source persistée — une fois incrustés ils disparaissent de cette liste,
  // il n'y a donc rien à recharger au changement de template.
  const [subtitles, setSubtitles] = useState<SubtitleEntry[]>([]);
  const [selectedSubtitle, setSelectedSubtitle] = useState(0);
  const [baking, setBaking] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  // Incrémenté après toute écriture qui change le fichier image sur le
  // disque sans changer son chemin (incrustation, rognage) : sans ça, le
  // navigateur continuerait d'afficher l'image mise en cache sous la même
  // url, alors que le fichier a changé.
  const [imgVersion, setImgVersion] = useState(0);

  // Rognage : un seul rectangle (pas de rotation — un rognage reste toujours
  // droit), actif seulement avec l'outil rognage pour ne pas encombrer
  // l'aperçu des cadres de zones/sous-titres pendant qu'on ajuste le cadrage.
  const cropMode = tool === 'crop';
  const [cropBox, setCropBox] = useState<TemplateBox>({ xPct: 50, yPct: 50, widthPct: 90, heightPct: 90 });
  const [cropping, setCropping] = useState(false);

  const searchMatches = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? ENTRIES.filter(({ template }) => template.name.toLowerCase().includes(q)) : ENTRIES;
  }, [search]);

  const visible = useMemo(
    () => searchMatches.filter(({ pack }) => matchesPackFilter(pack, packFilter)),
    [searchMatches, packFilter]
  );

  const packCounts = useMemo(() => {
    const counts = {} as Record<PackFilter, number>;
    for (const { id } of PACK_FILTERS) counts[id] = searchMatches.filter(({ pack }) => matchesPackFilter(pack, id)).length;
    return counts;
  }, [searchMatches]);

  // -1 quand aucun template ne correspond aux filtres : l'éditeur affiche
  // alors un état vide, mais garde la recherche et le choix du pack à l'écran
  // pour qu'on puisse en sortir.
  const current = visible.length ? Math.min(index, visible.length - 1) : -1;
  const entry = current >= 0 ? visible[current] : undefined;
  const template = entry?.template;

  const reviewedVisible = useMemo(
    () => visible.filter(({ template: t }) => reviewedIds.has(t.id)).length,
    [visible, reviewedIds]
  );

  const resetFilters = useCallback(() => {
    setSearch('');
    setPackFilter('tous');
    setIndex(0);
  }, []);

  useEffect(() => {
    fetch('/__boxes/meta')
      .then((r) => r.json())
      .then((d) => setReviewedIds(new Set(d.reviewedIds)))
      .catch(() => setStatus('Métadonnées indisponibles (serveur de dev ?)'));
  }, []);

  // Les messages de réussite disparaissent d'eux-mêmes ; ceux d'une opération
  // en cours (« … ») restent jusqu'à être remplacés par le résultat.
  useEffect(() => {
    if (!status || status.endsWith('…')) return;
    const t = window.setTimeout(() => setStatus(null), status.includes('✓') ? 3000 : 7000);
    return () => window.clearTimeout(t);
  }, [status]);

  // Garde le template courant visible dans la liste quand on navigue au
  // clavier, sans faire sauter la liste quand il y est déjà.
  useEffect(() => {
    listRef.current?.querySelector('.be-item.current')?.scrollIntoView({ block: 'nearest' });
  }, [current, visible]);

  // Révoque l'URL d'objet du dernier aperçu généré (renderTemplateWithSubtitles
  // produit un Blob local, jamais uploadé tant que "Incruster" n'a pas été
  // cliqué) — sans ça chaque aperçu fuirait de la mémoire jusqu'au rechargement
  // de la page.
  const clearPreview = useCallback(() => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setPreviewUrl(null);
  }, []);

  useEffect(() => () => clearPreview(), [clearPreview]);

  // Le brouillon se réinitialise sur le template courant. Après un
  // enregistrement, le HMR recharge le module du pack : les valeurs
  // rechargées sont alors identiques au brouillon, donc rien ne saute.
  useEffect(() => {
    if (!template) return;
    setDraft(template.boxes.map((b) => ({ ...b })));
    setSelected(0);
    setSubtitles([]);
    setSelectedSubtitle(0);
    clearPreview();
    setImgVersion(0);
    setTool((t) => (t === 'crop' ? 'zones' : t));
    setCropBox({ xPct: 50, yPct: 50, widthPct: 90, heightPct: 90 });
  }, [template, clearPreview]);

  // Tant que l'image du template n'est pas chargée, le cadre est plat : une
  // conversion pixels -> pourcentages y donnerait des coordonnées aberrantes,
  // qu'un enregistrement écrirait ensuite dans le fichier source.
  //
  // On teste naturalWidth plutôt que la taille du cadre : .meme-frame porte un
  // min-height de 80px, donc une image cassée laisse un cadre de hauteur non
  // nulle — mesurer le cadre ne distingue pas "chargée" de "morte".
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const img = el.querySelector('img');
    if (!img) return;
    const check = () => {
      const ok = img.complete && img.naturalWidth > 0;
      setFrameReady(ok);
      if (ok && template) setAspect({ id: template.id, ratio: img.naturalWidth / img.naturalHeight });
    };
    check();
    img.addEventListener('load', check);
    img.addEventListener('error', check);
    return () => {
      img.removeEventListener('load', check);
      img.removeEventListener('error', check);
    };
  }, [template]);

  const dirty = template ? !sameBoxes(draft, template.boxes) : false;

  const move = useCallback(
    (delta: number) => {
      if (!visible.length) return;
      setIndex((i) => {
        const next = Math.min(i, visible.length - 1) + delta;
        if (next < 0) return visible.length - 1;
        if (next >= visible.length) return 0;
        return next;
      });
    },
    [visible.length]
  );

  const nudge = useCallback(
    (dx: number, dy: number) => {
      setDraft((prev) =>
        prev.map((b, i) =>
          i === selected
            ? { ...b, xPct: clamp(b.xPct + dx, 0, 100), yPct: clamp(b.yPct + dy, 0, 100) }
            : b
        )
      );
    },
    [selected]
  );

  const nudgeRotation = useCallback(
    (delta: number) => {
      setDraft((prev) =>
        prev.map((b, i) => (i === selected ? { ...b, rotationDeg: normDeg((b.rotationDeg || 0) + delta) } : b))
      );
    },
    [selected]
  );

  const straighten = useCallback((idx: number) => {
    setDraft((prev) => prev.map((b, i) => (i === idx ? { ...b, rotationDeg: 0 } : b)));
  }, []);

  // Ajoute toujours en fin de liste (donc "dernière" étiquette Texte N) —
  // l'ordre se règle ensuite avec moveZone, plutôt que de deviner où insérer.
  // Plafonné à 9 : au-delà, la sélection rapide au clavier (1-9) ne suit plus.
  const addZone = useCallback(() => {
    if (draft.length >= 9) {
      setStatus('9 zones maximum (au-delà, la sélection clavier 1-9 ne suit plus).');
      return;
    }
    setDraft((prev) => [...prev, { xPct: 50, yPct: 50, widthPct: 40, heightPct: 15 }]);
    setSelected(draft.length);
    setTool('zones');
  }, [draft.length]);

  const deleteZone = useCallback(
    (idx: number) => {
      if (draft.length <= 1) {
        setStatus('Impossible de supprimer la dernière zone restante.');
        return;
      }
      setDraft((prev) => prev.filter((_, j) => j !== idx));
      setSelected((s) => {
        const shifted = idx < s ? s - 1 : s;
        return Math.min(shifted, draft.length - 2); // draft.length - 1 zones après suppression
      });
    },
    [draft.length]
  );

  // Échange avec la zone adjacente : la hiérarchie (Texte 1, Texte 2...) est
  // l'ordre du tableau, donc réordonner = permuter deux positions.
  const moveZone = useCallback(
    (idx: number, dir: -1 | 1) => {
      const target = idx + dir;
      if (target < 0 || target >= draft.length) return;
      setDraft((prev) => {
        const next = [...prev];
        [next[idx], next[target]] = [next[target], next[idx]];
        return next;
      });
      setSelected((s) => (s === idx ? target : s === target ? idx : s));
    },
    [draft.length]
  );

  const save = useCallback(async () => {
    if (!entry) return;
    setStatus('Enregistrement…');
    try {
      const res = await fetch('/__boxes/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pack: entry.pack,
          id: entry.template.id,
          name: entry.template.name,
          boxes: draft,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setStatus('Enregistré dans le fichier source ✓');
      move(1);
    } catch (err) {
      setStatus(`Échec : ${err instanceof Error ? err.message : 'inconnu'}`);
    }
  }, [entry, draft, move]);

  // Supprime le template entier (pas juste une zone) : son entrée dans le
  // pack, sa disposition personnalisée et son empreinte. Confirmation
  // native car ça réécrit directement des fichiers source versionnés — pas
  // de raccourci clavier pour éviter qu'une frappe malheureuse (à côté de
  // Suppr, qui supprime une zone) déclenche ça par erreur.
  const deleteTemplate = useCallback(async () => {
    if (!entry || !template) return;
    const ok = window.confirm(
      `Supprimer définitivement « ${template.name} » ?\n\n` +
        `Retire l'entrée de ${PACK_NAME[entry.pack]}, sa disposition personnalisée ` +
        `et son empreinte. L'image reste sur le disque (rien n'est cassé si tu ` +
        `changes d'avis, il suffira de rajouter l'entrée).`
    );
    if (!ok) return;
    setStatus('Suppression…');
    try {
      const res = await fetch('/__boxes/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pack: entry.pack, id: entry.template.id }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setStatus(`« ${template.name} » supprimé ✓`);
      // Comme pour save(), le HMR recharge le module du pack après
      // l'écriture : la liste rétrécit toute seule, pas besoin de toucher à
      // l'index ici.
    } catch (err) {
      setStatus(`Échec : ${err instanceof Error ? err.message : 'inconnu'}`);
    }
  }, [entry, template]);

  const toggleReviewed = useCallback(() => {
    if (!template) return;
    const next = !reviewedIds.has(template.id);
    setReviewedIds((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(template.id);
      else copy.delete(template.id);
      return copy;
    });
    fetch('/__boxes/reviewed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: template.id, reviewed: next }),
    }).catch(() => setStatus('Statut « revu » non enregistré'));
    // Seulement en passant à "revu" : après "non revu" on reste sur place,
    // pour pouvoir reconsidérer le template qu'on vient de dé-marquer sans
    // en être éjecté.
    if (next) move(1);
  }, [template, reviewedIds, move]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return;
      if (e.key === 'Escape') {
        if (showHelp) setShowHelp(false);
        else if (previewUrl) clearPreview();
        else if (cropMode) setTool('zones');
        return;
      }
      if (e.key === '?') {
        setShowHelp((v) => !v);
        return;
      }
      if (showHelp) return;
      const step = e.shiftKey ? 5 : 1;
      switch (e.key) {
        // ←/→ changent de template ; le nudge d'une zone passe par Ctrl/Cmd
        // (+ Maj pour 5 %), Alt+↑/↓ réordonne les zones.
        case 'ArrowLeft':
          e.preventDefault();
          if (e.ctrlKey || e.metaKey) nudge(-step, 0);
          else move(-1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (e.ctrlKey || e.metaKey) nudge(step, 0);
          else move(1);
          break;
        case 'ArrowUp':
          if (e.altKey) { e.preventDefault(); moveZone(selected, -1); }
          else if (e.ctrlKey || e.metaKey) { e.preventDefault(); nudge(0, -step); }
          break;
        case 'ArrowDown':
          if (e.altKey) { e.preventDefault(); moveZone(selected, 1); }
          else if (e.ctrlKey || e.metaKey) { e.preventDefault(); nudge(0, step); }
          break;
        case ',': nudgeRotation(-step); break;
        case '.': nudgeRotation(step); break;
        case '[': move(-1); break;
        case ']': move(1); break;
        case 's': save(); break;
        case 'r': toggleReviewed(); break;
        case 'o': setShowOverlay((v) => !v); break;
        case '/':
          e.preventDefault();
          searchRef.current?.focus();
          break;
        case 'Backspace':
        case 'Delete':
          e.preventDefault();
          deleteZone(selected);
          break;
        case '+':
          addZone();
          break;
        default:
          if (/^[1-9]$/.test(e.key) && Number(e.key) <= draft.length) {
            setSelected(Number(e.key) - 1);
            setTool('zones');
          }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    nudge, nudgeRotation, move, save, toggleReviewed, selected, moveZone, deleteZone, addZone,
    showHelp, previewUrl, clearPreview, cropMode, draft.length,
  ]);

  // Un seul gestionnaire pour le déplacement et le redimensionnement (et un
  // second pour le pivot) : on capture le pointeur (souris comme doigt) et on
  // convertit les deltas en pourcentages de la taille du cadre. Paramétré par
  // un couple (boxes, setBoxes) plutôt que câblé sur `draft`/`setDraft` : les
  // zones de texte (draft) et les sous-titres incrustables (subtitles, plus
  // bas) sont deux tableaux de TemplateBox indépendants, mais partagent
  // exactement la même manipulation directe — dupliquer ces ~90 lignes pour
  // les sous-titres serait la même logique recopiée, pas une logique différente.
  function makeBoxHandlers(
    boxes: TemplateBox[],
    setBoxes: Dispatch<SetStateAction<TemplateBox[]>>,
    setSelectedIndex: Dispatch<SetStateAction<number>>
  ) {
    function startDrag(e: React.PointerEvent, boxIndex: number, handle: Handle | null) {
      e.preventDefault();
      e.stopPropagation();
      blurActiveField();
      setSelectedIndex(boxIndex);
      const frame = frameRef.current;
      if (!frame) return;
      const rect = frame.getBoundingClientRect();
      if (!frameReady || !rect.width || !rect.height) {
        setStatus('Image non chargée : édition désactivée (les coordonnées seraient fausses).');
        return;
      }
      const start = boxes[boxIndex];
      const startX = e.clientX;
      const startY = e.clientY;
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);

      const onMove = (ev: PointerEvent) => {
        const dxScreen = ((ev.clientX - startX) / rect.width) * 100;
        const dyScreen = ((ev.clientY - startY) / rect.height) * 100;
        setBoxes((prev) =>
          prev.map((b, i) => {
            if (i !== boxIndex) return b;
            if (!handle) {
              // Déplacer ne dépend pas de l'orientation de la zone : xPct/yPct
              // vivent dans le repère de l'image, pas dans celui de la zone.
              return {
                ...b,
                xPct: round(clamp(start.xPct + dxScreen, 0, 100)),
                yPct: round(clamp(start.yPct + dyScreen, 0, 100)),
              };
            }
            // Redimensionner, en revanche, doit suivre les bords de la zone
            // elle-même : sur une zone pivotée, "tirer vers la droite" à
            // l'écran ne correspond plus à "élargir vers la droite" pour la
            // zone. On ramène donc le delta écran dans le repère local (non
            // tourné) de la zone avant d'appliquer la même formule qu'avant
            // (le bord opposé reste fixe), puis on repasse le déplacement du
            // centre dans le repère de l'image, seul espace où xPct/yPct ont
            // un sens.
            const rot = start.rotationDeg || 0;
            const { dx, dy } = rotateVec(dxScreen, dyScreen, -rot);
            const next = { ...b };
            let shiftX = 0;
            let shiftY = 0;
            if (handle.sx !== 0) {
              next.widthPct = round(clamp(start.widthPct + handle.sx * dx, MIN_W, 100));
              shiftX = dx / 2;
            }
            if (handle.sy !== 0) {
              next.heightPct = round(clamp(start.heightPct + handle.sy * dy, MIN_H, 100));
              shiftY = dy / 2;
            }
            if (shiftX || shiftY) {
              const shift = rotateVec(shiftX, shiftY, rot);
              next.xPct = round(clamp(start.xPct + shift.dx, 0, 100));
              next.yPct = round(clamp(start.yPct + shift.dy, 0, 100));
            }
            return next;
          })
        );
      };
      const onUp = () => {
        target.releasePointerCapture(e.pointerId);
        target.removeEventListener('pointermove', onMove);
        target.removeEventListener('pointerup', onUp);
      };
      target.addEventListener('pointermove', onMove);
      target.addEventListener('pointerup', onUp);
    }

    // Le pivot se manipule différemment d'un redimensionnement : on suit
    // l'angle entre le centre de la zone et le pointeur, pas un delta linéaire.
    function startRotate(e: React.PointerEvent, boxIndex: number) {
      e.preventDefault();
      e.stopPropagation();
      blurActiveField();
      setSelectedIndex(boxIndex);
      const frame = frameRef.current;
      if (!frame) return;
      const rect = frame.getBoundingClientRect();
      if (!frameReady || !rect.width || !rect.height) {
        setStatus('Image non chargée : édition désactivée (les coordonnées seraient fausses).');
        return;
      }
      const start = boxes[boxIndex];
      const cx = rect.left + (start.xPct / 100) * rect.width;
      const cy = rect.top + (start.yPct / 100) * rect.height;
      const angleOf = (x: number, y: number) => Math.atan2(y - cy, x - cx) * (180 / Math.PI);
      const startAngle = angleOf(e.clientX, e.clientY);
      const startRotation = start.rotationDeg || 0;
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);

      const onMove = (ev: PointerEvent) => {
        const deg = normDeg(round(startRotation + (angleOf(ev.clientX, ev.clientY) - startAngle)));
        setBoxes((prev) => prev.map((b, i) => (i === boxIndex ? { ...b, rotationDeg: deg } : b)));
      };
      const onUp = () => {
        target.releasePointerCapture(e.pointerId);
        target.removeEventListener('pointermove', onMove);
        target.removeEventListener('pointerup', onUp);
      };
      target.addEventListener('pointermove', onMove);
      target.addEventListener('pointerup', onUp);
    }

    return { startDrag, startRotate };
  }

  const zoneHandlers = makeBoxHandlers(draft, setDraft, setSelected);

  // Les sous-titres sont stockés avec leur texte ({box, text}), pas comme un
  // TemplateBox[] nu : ce setter fait le pont, en ne touchant qu'au champ box
  // de chaque entrée pour que makeBoxHandlers puisse les manipuler sans rien
  // savoir du texte qu'elles portent.
  const setSubtitleBoxes: Dispatch<SetStateAction<TemplateBox[]>> = useCallback((updater) => {
    setSubtitles((prev) => {
      const prevBoxes = prev.map((s) => s.box);
      const nextBoxes = typeof updater === 'function' ? (updater as (p: TemplateBox[]) => TemplateBox[])(prevBoxes) : updater;
      return prev.map((s, i) => ({ ...s, box: nextBoxes[i] }));
    });
  }, []);
  const subtitleHandlers = makeBoxHandlers(
    subtitles.map((s) => s.box),
    setSubtitleBoxes,
    setSelectedSubtitle
  );

  // Ajoute toujours en fin de liste, comme addZone. Pas de plafond à 9 : les
  // sous-titres n'ont pas de raccourci clavier 1-9 à préserver.
  const addSubtitle = useCallback(() => {
    setSubtitles((prev) => [...prev, { box: { xPct: 50, yPct: 88, widthPct: 80, heightPct: 14 }, text: 'Sous-titre' }]);
    setSelectedSubtitle(subtitles.length);
  }, [subtitles.length]);

  const deleteSubtitle = useCallback((idx: number) => {
    setSubtitles((prev) => prev.filter((_, j) => j !== idx));
    setSelectedSubtitle((s) => Math.max(0, s > idx ? s - 1 : s));
  }, []);

  const updateSubtitleText = useCallback((idx: number, text: string) => {
    setSubtitles((prev) => prev.map((s, j) => (j === idx ? { ...s, text } : s)));
  }, []);

  // Aperçu non destructif : compose template + sous-titres dans un canvas
  // local (comme au moment d'incruster), sans rien écrire sur le disque —
  // l'incrustation, elle, écrase le fichier image, donc mieux vaut pouvoir
  // vérifier avant.
  const previewSubtitles = useCallback(async () => {
    if (!template || !subtitles.length) return;
    setStatus('Aperçu…');
    try {
      const { blob } = await renderTemplateWithSubtitles(template.url, subtitles);
      const url = URL.createObjectURL(blob);
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = url;
      setPreviewUrl(url);
      setStatus(null);
    } catch (err) {
      setStatus(`Aperçu impossible : ${err instanceof Error ? err.message : 'erreur inconnue'}`);
    }
  }, [template, subtitles]);

  // Incruste : envoie l'image composée au serveur de dev, qui écrase le
  // fichier et recalcule son empreinte. Irréversible depuis l'éditeur (il n'y
  // a pas de "annuler" pour un pixel déjà écrasé) — d'où la confirmation.
  const bake = useCallback(async () => {
    if (!template || !entry || !subtitles.length) return;
    const ok = window.confirm(
      `Incruster définitivement ${subtitles.length} sous-titre(s) dans l'image de « ${template.name} » ?\n\n` +
        `Contrairement aux zones de texte, ceci réécrit le fichier image lui-même : ` +
        `impossible à annuler depuis l'éditeur (il faudrait remettre l'image d'origine à la main).`
    );
    if (!ok) return;
    setBaking(true);
    setStatus('Incrustation…');
    try {
      const { blob } = await renderTemplateWithSubtitles(template.url, subtitles);
      const dataUrl = await blobToDataUrl(blob);
      const res = await fetch('/__boxes/bake-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: template.id, url: template.url, dataUrl }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setSubtitles([]);
      setSelectedSubtitle(0);
      clearPreview();
      setImgVersion((v) => v + 1);
      setStatus('Sous-titre(s) incrusté(s) ✓ (le fichier image a changé sur le disque)');
    } catch (err) {
      setStatus(`Échec : ${err instanceof Error ? err.message : 'inconnu'}`);
    } finally {
      setBaking(false);
    }
  }, [template, entry, subtitles, clearPreview]);

  // Même pont que setSubtitleBoxes, en plus simple : un seul rectangle, pas
  // de champ à préserver à côté (contrairement à {box, text} des sous-titres).
  const setCropBoxArray: Dispatch<SetStateAction<TemplateBox[]>> = useCallback((updater) => {
    setCropBox((prev) => {
      const nextArr = typeof updater === 'function' ? (updater as (p: TemplateBox[]) => TemplateBox[])([prev]) : updater;
      return nextArr[0] ?? prev;
    });
  }, []);
  // setSelectedIndex n'a pas de sens ici (un seul rectangle) : no-op.
  const cropHandlers = makeBoxHandlers([cropBox], setCropBoxArray, () => {});

  const switchTool = useCallback(
    (next: Tool) => {
      if (next === 'crop' && !cropMode) setCropBox({ xPct: 50, yPct: 50, widthPct: 90, heightPct: 90 });
      setTool(next);
    },
    [cropMode]
  );

  // Rogne : recalcule d'abord les zones existantes dans le repère de l'image
  // une fois rognée (remapBoxToCrop), pour qu'elles restent au même endroit
  // visuellement, puis envoie image + zones au serveur en une seule requête —
  // les deux doivent changer ensemble, sinon les zones pointeraient dans le
  // vide sur la nouvelle image. Irréversible depuis l'éditeur, comme bake().
  const applyCrop = useCallback(async () => {
    if (!template || !entry) return;
    if (cropBox.widthPct >= 99 && cropBox.heightPct >= 99) {
      setStatus("Le rectangle couvre toute l'image : rien à rogner.");
      return;
    }
    const ok = window.confirm(
      `Rogner définitivement l'image de « ${template.name} » ?\n\n` +
        `Ceci réécrit le fichier image ET les zones de texte existantes (repositionnées pour ` +
        `rester au même endroit visuellement). Impossible à annuler depuis l'éditeur.`
    );
    if (!ok) return;
    setCropping(true);
    setStatus('Rognage…');
    try {
      const { blob, naturalWidth, naturalHeight, cropPx } = await cropTemplate(template.url, cropBox);
      const newBoxes = draft.map((b) => remapBoxToCrop(b, cropPx, naturalWidth, naturalHeight));
      const dataUrl = await blobToDataUrl(blob);
      const res = await fetch('/__boxes/crop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pack: entry.pack,
          id: template.id,
          name: template.name,
          url: template.url,
          dataUrl,
          boxes: newBoxes,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setTool('zones');
      setImgVersion((v) => v + 1);
      setStatus('Image rognée ✓ (fichier et zones mis à jour)');
    } catch (err) {
      setStatus(`Échec : ${err instanceof Error ? err.message : 'inconnu'}`);
    } finally {
      setCropping(false);
    }
  }, [template, entry, cropBox, draft]);

  const layers: TextLayer[] = draft.map((b, i) => ({ ...b, text: sampleText(sample, i) }));
  const isReviewed = template ? reviewedIds.has(template.id) : false;
  const statusTone = !status ? '' : status.endsWith('…') ? 'busy' : status.includes('✓') ? 'ok' : 'warn';

  return (
    <div className="be-root">
      <Styles />

      {/* ——— Navigateur de templates ——— */}
      <nav className="be-browser">
        <div className="be-brand">
          <span className="be-logo">M</span>
          <div>
            <strong>Éditeur de zones</strong>
            <span>MemeIt · outil de dev</span>
          </div>
        </div>

        <div className="be-search">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            ref={searchRef}
            type="search"
            placeholder="Rechercher un template"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') e.currentTarget.blur();
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
          />
          <kbd>/</kbd>
        </div>

        <div className="be-packs" role="tablist">
          {PACK_FILTERS.map(({ id, label }) => (
            <button
              key={id}
              role="tab"
              aria-selected={packFilter === id}
              className={packFilter === id ? 'on' : ''}
              onClick={() => {
                setPackFilter(id);
                setIndex(0);
              }}
            >
              {label}
              <span>{packCounts[id]}</span>
            </button>
          ))}
        </div>

        <div className="be-progress" title={`${reviewedVisible} template(s) revu(s) sur ${visible.length}`}>
          <div className="be-progress-label">
            <span>Revus</span>
            <span>
              {reviewedVisible} / {visible.length}
            </span>
          </div>
          <div className="be-progress-track">
            <div
              className="be-progress-fill"
              style={{ width: visible.length ? `${(reviewedVisible / visible.length) * 100}%` : 0 }}
            />
          </div>
        </div>

        <div className="be-list" ref={listRef}>
          {visible.map(({ template: t, pack }, i) => (
            <button
              key={t.id}
              className={`be-item ${i === current ? 'current' : ''}`}
              onClick={() => {
                blurActiveField();
                setIndex(i);
              }}
            >
              <img src={t.url} alt="" loading="lazy" draggable={false} />
              <span className="be-item-text">
                <span className="be-item-name">{t.name}</span>
                <span className="be-item-meta">
                  {PACK_NAME[pack]} · {t.boxes.length} zone{t.boxes.length > 1 ? 's' : ''}
                </span>
              </span>
              {reviewedIds.has(t.id) && (
                <span className="be-item-check" title="Revu">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m5 12.5 4.5 4.5L19 7.5" />
                  </svg>
                </span>
              )}
            </button>
          ))}
          {!visible.length && <p className="be-list-empty">Aucun résultat</p>}
        </div>
      </nav>

      {/* ——— Scène ——— */}
      <main className="be-stage">
        <header className="be-toolbar">
          <div className="be-nav">
            <button className="be-icon-btn" onClick={() => move(-1)} disabled={!template} title="Précédent (←)">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7" /></svg>
            </button>
            <button className="be-icon-btn" onClick={() => move(1)} disabled={!template} title="Suivant (→)">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
            </button>
          </div>
          <div className="be-title">
            {template && entry ? (
              <>
                <h1>
                  {template.name}
                  {dirty && <span className="be-dirty-dot" title="Modifications non enregistrées" />}
                </h1>
                <p>
                  <span>{PACK_NAME[entry.pack]}</span>
                  <span>
                    {current + 1} / {visible.length}
                  </span>
                  {isReviewed && <span className="be-tag-ok">Revu</span>}
                  {dirty && <span className="be-tag-dirty">Modifié</span>}
                </p>
              </>
            ) : (
              <h1 className="muted">Aucun template</h1>
            )}
          </div>
          <div className="be-toolbar-right">
            <div className="be-seg" title="Texte d'exemple affiché dans les zones">
              {SAMPLE_MODES.map((m) => (
                <button
                  key={m.id}
                  className={sample === m.id ? 'on' : ''}
                  title={m.title}
                  onClick={() => setSample(m.id)}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <button
              className={`be-icon-btn ${showOverlay ? 'on' : ''}`}
              onClick={() => setShowOverlay((v) => !v)}
              title={showOverlay ? 'Masquer les cadres (o)' : 'Afficher les cadres (o)'}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="4" y="5" width="16" height="14" rx="2" strokeDasharray={showOverlay ? undefined : '3 3'} />
                <path d="M8 10h8M8 14h5" />
              </svg>
            </button>
            <button className="be-icon-btn" onClick={() => setShowHelp(true)} title="Raccourcis clavier (?)">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="3" y="6" width="18" height="12" rx="2" />
                <path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10" />
              </svg>
            </button>
          </div>
        </header>

        <div className="be-canvas">
          {template ? (
            <>
              <div className="be-floats">
                {!frameReady && <p className="be-float be-float--warn">Chargement de l'image… édition désactivée</p>}
                {previewUrl && (
                  <p className="be-float be-float--sub">
                    Aperçu de l'incrustation — rien n'est encore écrit sur le disque
                    <button onClick={clearPreview}>Quitter</button>
                  </p>
                )}
                {cropMode && (
                  <p className="be-float be-float--crop">Ajuste le rectangle à garder, puis « Rogner »</p>
                )}
              </div>
              <div
                className="be-frame"
                ref={frameRef}
                style={{
                  width:
                    aspect?.id === template.id
                      ? `min(100%, calc((100dvh - 150px) * ${aspect.ratio}))`
                      : '100%',
                }}
              >
                {/* Remonté à chaque template : le cadre change de largeur avec
                    les proportions de l'image, et un MemeRender réutilisé
                    pouvait garder un ajustement du texte calculé sur les
                    dimensions de l'image précédente (texte minuscule). */}
                <MemeRender
                  key={template.id}
                  templateUrl={previewUrl || (imgVersion ? `${template.url}?v=${imgVersion}` : template.url)}
                  layers={layers}
                />
                {cropMode && (
                  <div className="be-overlay be-overlay--clip">
                    <div
                      className="be-crop-shade"
                      style={{
                        left: `${cropBox.xPct - cropBox.widthPct / 2}%`,
                        top: `${cropBox.yPct - cropBox.heightPct / 2}%`,
                        width: `${cropBox.widthPct}%`,
                        height: `${cropBox.heightPct}%`,
                      }}
                    />
                  </div>
                )}
                {cropMode && (
                  <div className="be-overlay">
                    <OverlayBox
                      box={cropBox}
                      color={CROP_COLOR}
                      variant="crop"
                      selected
                      passive={false}
                      rotatable={false}
                      onDrag={(e, h) => cropHandlers.startDrag(e, 0, h)}
                    />
                  </div>
                )}
                {showOverlay && !cropMode && !previewUrl && (
                  <div className="be-overlay">
                    {draft.map((b, i) => (
                      <OverlayBox
                        key={i}
                        box={b}
                        color={ZONE_COLORS[i % ZONE_COLORS.length]}
                        tag={String(i + 1)}
                        variant="zone"
                        selected={i === selected}
                        passive={tool !== 'zones'}
                        hovered={i === hoveredZone}
                        rotatable
                        onDrag={(e, h) => zoneHandlers.startDrag(e, i, h)}
                        onRotate={(e) => zoneHandlers.startRotate(e, i)}
                      />
                    ))}
                    {subtitles.map(({ box: b }, i) => (
                      <OverlayBox
                        key={`sub-${i}`}
                        box={b}
                        color={SUBTITLE_COLOR}
                        tag={`S${i + 1}`}
                        variant="subtitle"
                        selected={i === selectedSubtitle}
                        passive={tool !== 'subtitles'}
                        rotatable
                        onDrag={(e, h) => subtitleHandlers.startDrag(e, i, h)}
                        onRotate={(e) => subtitleHandlers.startRotate(e, i)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="be-empty">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5M8.5 11h5" />
              </svg>
              <h2>Aucun template ne correspond</h2>
              <p>
                {search.trim()
                  ? <>Rien ne contient « {search.trim()} »{packFilter !== 'tous' && ' dans ce pack'}.</>
                  : 'Ce pack est vide.'}
              </p>
              <button className="be-btn be-btn--primary" onClick={resetFilters}>
                Effacer les filtres
              </button>
            </div>
          )}
        </div>
      </main>

      {/* ——— Inspecteur ——— */}
      <aside className="be-inspector">
        <div className="be-tools" role="tablist">
          {(
            [
              ['zones', 'Zones', draft.length],
              ['subtitles', 'Sous-titres', subtitles.length],
              ['crop', 'Rogner', null],
            ] as const
          ).map(([id, label, count]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tool === id}
              className={`be-tool be-tool--${id} ${tool === id ? 'on' : ''}`}
              disabled={!template || (id === 'crop' && !frameReady)}
              onClick={() => switchTool(id)}
            >
              {label}
              {template && count !== null && count > 0 && <span>{count}</span>}
            </button>
          ))}
        </div>

        <div className="be-panel">
          {template && tool === 'zones' && (
            <>
              <p className="be-hint">
                Glisse les cadres sur l'image, tire les poignées pour redimensionner, le rond du haut pour
                pivoter. L'ordre de la liste est l'ordre Texte 1, Texte 2… en jeu.
              </p>
              <ol className="be-cards">
                {draft.map((b, i) => (
                  <li
                    key={i}
                    className={`be-card ${i === selected ? 'sel' : ''}`}
                    style={{ '--c': ZONE_COLORS[i % ZONE_COLORS.length] } as CSSProperties}
                    onClick={() => setSelected(i)}
                    onMouseEnter={() => setHoveredZone(i)}
                    onMouseLeave={() => setHoveredZone(null)}
                  >
                    <span className="be-card-num">{i + 1}</span>
                    <span className="be-card-body">
                      <strong>Texte {i + 1}</strong>
                      <span>{sampleText(sample, i).toLowerCase()}</span>
                    </span>
                    {b.rotationDeg ? (
                      <button
                        className="be-chip-btn"
                        title="Redresser la zone"
                        onClick={(e) => {
                          e.stopPropagation();
                          straighten(i);
                        }}
                      >
                        ↺ {b.rotationDeg}°
                      </button>
                    ) : null}
                    <span className="be-card-actions">
                      <button
                        disabled={i === 0}
                        title="Monter (Alt+↑)"
                        onClick={(e) => {
                          e.stopPropagation();
                          moveZone(i, -1);
                        }}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 15 6-6 6 6" /></svg>
                      </button>
                      <button
                        disabled={i === draft.length - 1}
                        title="Descendre (Alt+↓)"
                        onClick={(e) => {
                          e.stopPropagation();
                          moveZone(i, 1);
                        }}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
                      </button>
                      <button
                        className="danger"
                        disabled={draft.length <= 1}
                        title="Supprimer cette zone (Suppr)"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteZone(i);
                        }}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
                      </button>
                    </span>
                  </li>
                ))}
              </ol>
              <button className="be-add" onClick={addZone} disabled={draft.length >= 9} title="Ajouter une zone (+)">
                + Ajouter une zone
              </button>
            </>
          )}

          {template && tool === 'subtitles' && (
            <>
              <p className="be-hint">
                Texte peint directement dans l'image au moment d'« Incruster », en{' '}
                {SUBTITLE_FONT_STACK.split(',')[0].replace(/'/g, '')} : les joueurs ne pourront plus le modifier.
              </p>
              <ol className="be-cards">
                {subtitles.map((s, i) => (
                  <li
                    key={i}
                    className={`be-card be-card--sub ${i === selectedSubtitle ? 'sel' : ''}`}
                    style={{ '--c': SUBTITLE_COLOR } as CSSProperties}
                    onClick={() => setSelectedSubtitle(i)}
                  >
                    <span className="be-card-num">S{i + 1}</span>
                    <input
                      type="text"
                      value={s.text}
                      placeholder="Texte du sous-titre"
                      onChange={(e) => updateSubtitleText(i, e.target.value)}
                      onFocus={() => setSelectedSubtitle(i)}
                    />
                    <span className="be-card-actions">
                      <button
                        className="danger"
                        title="Supprimer ce sous-titre"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSubtitle(i);
                        }}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
                      </button>
                    </span>
                  </li>
                ))}
              </ol>
              <button className="be-add" onClick={addSubtitle}>
                + Ajouter un sous-titre
              </button>
              {subtitles.length > 0 && (
                <div className="be-row-btns">
                  <button className="be-btn" onClick={previewUrl ? clearPreview : previewSubtitles} disabled={!frameReady}>
                    {previewUrl ? 'Quitter l’aperçu' : 'Aperçu'}
                  </button>
                  <button
                    className="be-btn be-btn--sub"
                    onClick={bake}
                    disabled={baking || !frameReady}
                    title="Écrit ces sous-titres dans le fichier image — irréversible depuis l'éditeur"
                  >
                    {baking ? 'Incrustation…' : `Incruster (${subtitles.length})`}
                  </button>
                </div>
              )}
            </>
          )}

          {template && tool === 'crop' && (
            <>
              <p className="be-hint">
                Déplace le rectangle, tire ses poignées pour garder la partie voulue. Les zones de texte
                existantes sont recalculées pour rester au même endroit. Écrase le fichier image.
              </p>
              <div className="be-row-btns">
                <button className="be-btn" onClick={() => setTool('zones')} disabled={cropping}>
                  Annuler
                </button>
                <button
                  className="be-btn be-btn--crop"
                  onClick={applyCrop}
                  disabled={cropping}
                  title="Écrit l'image et les zones recalculées — irréversible depuis l'éditeur"
                >
                  {cropping ? 'Rognage…' : 'Rogner l’image'}
                </button>
              </div>
            </>
          )}

          {!template && <p className="be-hint">Choisis un template dans la liste pour l'éditer.</p>}
        </div>

        <footer className="be-footer">
          <div className="be-row-btns">
            <button
              className="be-btn"
              onClick={() => template && setDraft(template.boxes.map((b) => ({ ...b })))}
              disabled={!dirty}
              title="Revenir à la disposition enregistrée"
            >
              Annuler
            </button>
            <button className="be-btn be-btn--primary grow" onClick={save} disabled={!dirty || !frameReady}>
              Enregistrer <kbd>s</kbd>
            </button>
          </div>
          <button
            className={`be-btn be-btn--review ${isReviewed ? 'on' : ''}`}
            onClick={toggleReviewed}
            disabled={!template}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m5 12.5 4.5 4.5L19 7.5" />
            </svg>
            {isReviewed ? 'Revu — annuler' : 'Marquer comme revu'} <kbd>r</kbd>
          </button>
          <button
            className="be-link-danger"
            onClick={deleteTemplate}
            disabled={!template}
            title="Supprime le template entier des fichiers source, pas juste une zone"
          >
            Supprimer ce template…
          </button>
        </footer>
      </aside>

      {status && (
        <div className={`be-toast ${statusTone}`} role="status" onClick={() => setStatus(null)}>
          {status}
        </div>
      )}

      {showHelp && (
        <div className="be-modal-backdrop" onClick={() => setShowHelp(false)}>
          <div className="be-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Raccourcis clavier">
            <header>
              <h2>Raccourcis clavier</h2>
              <button className="be-icon-btn" onClick={() => setShowHelp(false)} title="Fermer (Échap)">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            </header>
            <dl>
              {SHORTCUTS.map(([keys, label]) => (
                <div key={label}>
                  <dt>
                    {keys.map((k) => (
                      <kbd key={k}>{k}</kbd>
                    ))}
                  </dt>
                  <dd>{label}</dd>
                </div>
              ))}
            </dl>
            <p>
              Les sous-titres et le rognage se manipulent à la souris uniquement. Incruster et rogner
              réécrivent le fichier image : c'est irréversible depuis l'éditeur.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Styles() {
  // Styles portés par la page elle-même : rien de tout ceci n'a de raison
  // d'exister dans styles.css, qui part en production.
  return (
    <style>{`
      .be-root {
        --be-bg: #0f0c15; --be-panel: #17131f; --be-raised: #201a2b; --be-hover: #2a2238;
        --be-line: rgba(255,255,255,.07); --be-line-strong: rgba(255,255,255,.13);
        --be-text: #f3eefc; --be-muted: #9d93b1; --be-faint: #6b627d;
        --be-accent: #ffd166; --be-ok: #06d6a0; --be-danger: #ef476f;
        --be-sub: ${SUBTITLE_COLOR}; --be-crop: ${CROP_COLOR};
        display: grid; grid-template-columns: 290px minmax(0, 1fr) 330px;
        height: 100dvh; overflow: hidden; background: var(--be-bg); color: var(--be-text);
        font: 14px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI Variable', 'Segoe UI', Roboto, sans-serif;
      }
      .be-root button { font: inherit; color: inherit; cursor: pointer; }
      .be-root button:disabled { cursor: not-allowed; opacity: .38; }
      .be-root svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2;
        stroke-linecap: round; stroke-linejoin: round; flex: none; }
      .be-root kbd { font: 600 11px/1 ui-monospace, 'Cascadia Code', Consolas, monospace; padding: 3px 5px;
        border-radius: 5px; background: rgba(255,255,255,.08); border: 1px solid var(--be-line-strong);
        border-bottom-width: 2px; color: var(--be-muted); }

      /* ——— Navigateur ——— */
      .be-browser { display: flex; flex-direction: column; gap: 12px; padding: 16px 12px 0;
        background: var(--be-panel); border-right: 1px solid var(--be-line); min-height: 0; }
      .be-brand { display: flex; align-items: center; gap: 10px; padding: 0 4px 4px; }
      .be-brand strong { display: block; font-size: 15px; letter-spacing: -.01em; }
      .be-brand div span { display: block; font-size: 12px; color: var(--be-faint); }
      .be-logo { width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center;
        font: 900 18px Impact, 'Arial Narrow', sans-serif; color: #1b1205;
        background: linear-gradient(135deg, #ffd166, #ff9e7a); box-shadow: 0 4px 14px rgba(255,209,102,.25); }
      .be-search { display: flex; align-items: center; gap: 8px; padding: 0 10px; height: 38px;
        border-radius: 10px; background: var(--be-bg); border: 1px solid var(--be-line-strong); color: var(--be-faint); }
      .be-search:focus-within { border-color: var(--be-accent); box-shadow: 0 0 0 3px rgba(255,209,102,.15); }
      .be-search svg { width: 16px; height: 16px; }
      .be-search input { flex: 1; min-width: 0; background: none; border: 0; outline: 0; color: var(--be-text); font: inherit; }
      .be-search input::-webkit-search-cancel-button { filter: invert(1) opacity(.5); }
      .be-packs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3px; padding: 3px;
        border-radius: 10px; background: var(--be-bg); border: 1px solid var(--be-line); }
      .be-packs button { display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 6px 2px;
        border: 0; border-radius: 7px; background: none; color: var(--be-muted); font-size: 12px; font-weight: 600; }
      .be-packs button span { font-size: 11px; font-weight: 500; color: var(--be-faint); font-variant-numeric: tabular-nums; }
      .be-packs button:hover { color: var(--be-text); }
      .be-packs button.on { background: var(--be-hover); color: var(--be-text); box-shadow: 0 1px 2px rgba(0,0,0,.4); }
      .be-packs button.on span { color: var(--be-accent); }
      .be-progress { padding: 0 4px; }
      .be-progress-label { display: flex; justify-content: space-between; font-size: 12px; color: var(--be-muted);
        margin-bottom: 6px; font-variant-numeric: tabular-nums; }
      .be-progress-track { height: 4px; border-radius: 4px; background: var(--be-raised); overflow: hidden; }
      .be-progress-fill { height: 100%; border-radius: 4px; background: linear-gradient(90deg, var(--be-ok), #7cf2c9);
        transition: width .3s ease; }
      .be-list { flex: 1; min-height: 0; overflow-y: auto; margin: 0 -12px; padding: 2px 8px 12px;
        display: flex; flex-direction: column; gap: 2px; scrollbar-width: thin; scrollbar-color: var(--be-hover) transparent; }
      .be-item { display: flex; align-items: center; gap: 10px; width: 100%; padding: 6px; text-align: left;
        border: 1px solid transparent; border-radius: 10px; background: none; }
      .be-item:hover { background: var(--be-raised); }
      .be-item.current { background: var(--be-hover); border-color: var(--be-line-strong); }
      .be-item img { width: 46px; height: 46px; object-fit: cover; border-radius: 7px; background: var(--be-raised); flex: none; }
      .be-item-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
      .be-item-name { font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .be-item.current .be-item-name { color: var(--be-accent); }
      .be-item-meta { font-size: 11.5px; color: var(--be-faint); }
      .be-item-check { width: 20px; height: 20px; border-radius: 50%; display: grid; place-items: center; flex: none;
        background: rgba(6,214,160,.15); color: var(--be-ok); }
      .be-item-check svg { width: 13px; height: 13px; stroke-width: 3; }
      .be-list-empty { text-align: center; color: var(--be-faint); font-size: 13px; margin: 24px 0; }

      /* ——— Scène ——— */
      .be-stage { display: flex; flex-direction: column; min-width: 0; min-height: 0; }
      .be-toolbar { display: flex; align-items: center; gap: 14px; height: 64px; padding: 0 18px; flex: none;
        border-bottom: 1px solid var(--be-line); background: rgba(15,12,21,.85); backdrop-filter: blur(8px); }
      .be-nav { display: flex; gap: 4px; }
      .be-icon-btn { width: 36px; height: 36px; display: grid; place-items: center; border-radius: 9px;
        border: 1px solid var(--be-line-strong); background: var(--be-raised); color: var(--be-muted); }
      .be-icon-btn:not(:disabled):hover { color: var(--be-text); background: var(--be-hover); }
      .be-icon-btn.on { color: var(--be-accent); border-color: rgba(255,209,102,.35); }
      .be-title { flex: 1; min-width: 0; }
      .be-title h1 { margin: 0; font-size: 17px; font-weight: 700; letter-spacing: -.015em; display: flex;
        align-items: center; gap: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .be-title h1.muted { color: var(--be-faint); }
      .be-title p { margin: 3px 0 0; display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--be-muted);
        font-variant-numeric: tabular-nums; }
      .be-title p > span + span::before { content: '·'; margin-right: 6px; color: var(--be-faint); }
      .be-title p > .be-tag-ok::before, .be-title p > .be-tag-dirty::before { content: none; }
      .be-tag-ok, .be-tag-dirty { padding: 1px 7px; border-radius: 99px; font-size: 11px; font-weight: 700; }
      .be-tag-ok { background: rgba(6,214,160,.14); color: var(--be-ok); }
      .be-tag-dirty { background: rgba(239,71,111,.16); color: #ff7c9b; }
      .be-dirty-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--be-danger); flex: none;
        box-shadow: 0 0 0 4px rgba(239,71,111,.18); }
      .be-toolbar-right { display: flex; align-items: center; gap: 6px; }
      .be-seg { display: flex; padding: 3px; gap: 2px; border-radius: 10px; background: var(--be-panel);
        border: 1px solid var(--be-line-strong); margin-right: 4px; }
      .be-seg button { border: 0; background: none; padding: 5px 10px; border-radius: 7px; font-size: 12.5px;
        font-weight: 600; color: var(--be-muted); }
      .be-seg button:hover { color: var(--be-text); }
      .be-seg button.on { background: var(--be-hover); color: var(--be-text); box-shadow: 0 1px 2px rgba(0,0,0,.4); }

      .be-canvas { position: relative; flex: 1; min-height: 0; overflow: auto; display: grid; place-items: center;
        padding: 40px 48px 48px;
        background-color: #0b0910;
        background-image: radial-gradient(rgba(255,255,255,.06) 1px, transparent 1px);
        background-size: 22px 22px; }
      .be-floats { position: absolute; top: 12px; left: 50%; transform: translateX(-50%); z-index: 10;
        display: flex; flex-direction: column; align-items: center; gap: 6px; pointer-events: none; }
      .be-float { margin: 0; display: flex; align-items: center; gap: 10px; padding: 7px 8px 7px 14px; border-radius: 99px;
        font-size: 12.5px; font-weight: 600; white-space: nowrap; pointer-events: auto;
        box-shadow: 0 8px 24px rgba(0,0,0,.4); }
      .be-float--warn { background: var(--be-accent); color: #23150a; padding-right: 14px; }
      .be-float--sub { background: var(--be-sub); color: #04202c; }
      .be-float--crop { background: var(--be-crop); color: #2b1500; padding-right: 14px; }
      .be-float button { border: 0; border-radius: 99px; padding: 3px 10px; background: rgba(0,0,0,.25);
        color: inherit; font-weight: 700; }
      .be-frame { position: relative; touch-action: none; max-width: 100%;
        box-shadow: 0 24px 60px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.06); border-radius: 6px; }
      .be-frame .meme-frame { border-radius: 6px; }
      .be-overlay { position: absolute; inset: 0; }

      .be-box { --c: var(--be-accent); position: absolute; cursor: move; touch-action: none;
        border: 1.5px dashed var(--c); background: color-mix(in srgb, var(--c) 7%, transparent);
        transition: background .12s, box-shadow .12s; }
      .be-box:hover, .be-box.hover { background: color-mix(in srgb, var(--c) 16%, transparent); }
      /* La zone sélectionnée passe au-dessus des autres : sur un template à
         plusieurs zones qui se chevauchent, ses poignées se retrouvaient
         sinon sous une zone voisine, donc impossibles à attraper. */
      .be-box.sel { border-style: solid; border-width: 2px; z-index: 2;
        background: color-mix(in srgb, var(--c) 12%, transparent);
        box-shadow: 0 0 0 1px rgba(0,0,0,.5), 0 0 0 4px color-mix(in srgb, var(--c) 22%, transparent); }
      /* Cadres de l'outil inactif : visibles pour qu'on sache qu'ils
         existent, mais inertes pour ne pas les attraper par erreur. */
      .be-box.passive { pointer-events: none; opacity: .35; box-shadow: none; }
      /* Pointillés serrés pour les sous-titres : un mécanisme différent
         (texte peint dans l'image, pas une zone éditable par les joueurs). */
      .be-box--subtitle { border-style: dotted; border-width: 2px; }
      .be-box--crop.sel { background: transparent; box-shadow: none; border-width: 2px; }
      .be-box-tag { position: absolute; top: -11px; left: 8px; min-width: 20px; height: 20px; padding: 0 5px;
        border-radius: 99px; background: var(--c); color: #160f05; font-size: 11px; font-weight: 800;
        display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(0,0,0,.45); }
      .be-handle { position: absolute; width: 11px; height: 11px; transform: translate(-50%, -50%);
        background: #fff; border: 2px solid var(--c); border-radius: 3px; touch-action: none; z-index: 3;
        box-shadow: 0 1px 4px rgba(0,0,0,.5); }
      .be-handle:hover { transform: translate(-50%, -50%) scale(1.3); }
      .be-rotate-stalk { position: absolute; left: 50%; top: -16px; width: 2px; height: 16px;
        background: var(--c); transform: translateX(-50%); pointer-events: none; }
      .be-rotate-handle { position: absolute; left: 50%; top: -22px; width: 14px; height: 14px;
        transform: translate(-50%, -50%); background: var(--c); border: 2px solid #fff;
        border-radius: 50%; cursor: grab; touch-action: none; z-index: 3; box-shadow: 0 1px 4px rgba(0,0,0,.5); }
      .be-rotate-handle:active { cursor: grabbing; }
      /* Assombrit tout ce qui sera retiré par le rognage : un trou dans une
         ombre géante plutôt que quatre bandes à recalculer. */
      .be-crop-shade { position: absolute; box-shadow: 0 0 0 9999px rgba(8,6,12,.62); pointer-events: none; }
      .be-overlay--clip { overflow: hidden; border-radius: 6px; pointer-events: none; }
      .be-box--crop::before, .be-box--crop::after { content: ''; position: absolute; inset: 0; pointer-events: none;
        border: 0 solid rgba(255,255,255,.22); }
      .be-box--crop::before { left: 33.33%; right: 33.33%; border-left-width: 1px; border-right-width: 1px; }
      .be-box--crop::after { top: 33.33%; bottom: 33.33%; border-top-width: 1px; border-bottom-width: 1px; }

      .be-empty { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 6px; max-width: 340px; }
      .be-empty svg { width: 44px; height: 44px; color: var(--be-faint); stroke-width: 1.5; margin-bottom: 6px; }
      .be-empty h2 { margin: 0; font-size: 18px; }
      .be-empty p { margin: 0 0 14px; color: var(--be-muted); }

      /* ——— Inspecteur ——— */
      .be-inspector { display: flex; flex-direction: column; min-height: 0; background: var(--be-panel);
        border-left: 1px solid var(--be-line); }
      .be-tools { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; padding: 12px; flex: none;
        border-bottom: 1px solid var(--be-line); }
      .be-tool { --c: var(--be-accent); display: flex; align-items: center; justify-content: center; gap: 6px;
        height: 40px; border-radius: 10px; border: 1px solid transparent; background: none; color: var(--be-muted);
        font-weight: 600; font-size: 13px; position: relative; white-space: nowrap; padding: 0 4px; }
      .be-tool--subtitles { --c: var(--be-sub); }
      .be-tool--crop { --c: var(--be-crop); }
      .be-tool:not(:disabled):hover { background: var(--be-raised); color: var(--be-text); }
      .be-tool.on { background: var(--be-raised); color: var(--be-text); border-color: var(--be-line-strong); }
      .be-tool.on::after { content: ''; position: absolute; left: 22%; right: 22%; bottom: -1px; height: 2px;
        border-radius: 2px; background: var(--c); }
      .be-tool span { min-width: 18px; height: 18px; padding: 0 5px; border-radius: 99px; font-size: 11px; display: grid;
        place-items: center; background: color-mix(in srgb, var(--c) 18%, transparent); color: var(--c); }
      .be-panel { flex: 1; min-height: 0; overflow-y: auto; padding: 16px 14px; display: flex; flex-direction: column;
        gap: 12px; scrollbar-width: thin; scrollbar-color: var(--be-hover) transparent; }
      .be-hint { margin: 0; font-size: 12.5px; line-height: 1.55; color: var(--be-muted); }
      .be-cards { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
      .be-card { --c: var(--be-accent); display: flex; align-items: center; gap: 10px; padding: 8px 8px 8px 10px;
        border-radius: 11px; background: var(--be-raised); border: 1px solid var(--be-line); cursor: pointer;
        position: relative; transition: border-color .12s, background .12s; }
      .be-card:hover { background: var(--be-hover); }
      .be-card.sel { border-color: color-mix(in srgb, var(--c) 55%, transparent);
        background: color-mix(in srgb, var(--c) 8%, var(--be-raised)); }
      .be-card-num { min-width: 26px; height: 26px; padding: 0 4px; border-radius: 8px; display: grid; place-items: center;
        background: var(--c); color: #160f05; font-weight: 800; font-size: 12.5px; flex: none; }
      .be-card-body { flex: 1; min-width: 0; display: flex; flex-direction: column; }
      .be-card-body strong { font-size: 13px; }
      .be-card-body span { font-size: 12px; color: var(--be-faint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .be-card input { flex: 1; min-width: 0; height: 32px; padding: 0 10px; border-radius: 8px; font: inherit; font-size: 13px;
        background: var(--be-bg); color: var(--be-text); border: 1px solid var(--be-line-strong); outline: 0; }
      .be-card input:focus { border-color: var(--be-sub); }
      .be-card-actions { display: flex; gap: 2px; opacity: .55; transition: opacity .12s; }
      .be-card:hover .be-card-actions, .be-card.sel .be-card-actions { opacity: 1; }
      .be-card-actions button { width: 26px; height: 26px; display: grid; place-items: center; border: 0; border-radius: 7px;
        background: none; color: var(--be-muted); }
      .be-card-actions button svg { width: 15px; height: 15px; }
      .be-card-actions button:not(:disabled):hover { background: rgba(255,255,255,.08); color: var(--be-text); }
      .be-card-actions button.danger:not(:disabled):hover { background: rgba(239,71,111,.15); color: var(--be-danger); }
      .be-chip-btn { border: 1px solid var(--be-line-strong); background: var(--be-bg); border-radius: 99px;
        padding: 2px 8px; font-size: 11.5px; color: var(--be-muted); white-space: nowrap; }
      .be-chip-btn:hover { color: var(--be-text); border-color: var(--be-muted); }
      .be-add { height: 40px; border-radius: 11px; border: 1.5px dashed var(--be-line-strong); background: none;
        color: var(--be-muted); font-weight: 600; font-size: 13px; }
      .be-add:not(:disabled):hover { border-color: var(--be-accent); color: var(--be-accent); background: rgba(255,209,102,.05); }

      .be-row-btns { display: flex; gap: 6px; }
      .be-row-btns > * { flex: 1; }
      .be-row-btns > .grow { flex: 2; }
      .be-btn { height: 40px; padding: 0 14px; border-radius: 10px; font-weight: 600; font-size: 13.5px;
        display: inline-flex; align-items: center; justify-content: center; gap: 8px;
        border: 1px solid var(--be-line-strong); background: var(--be-raised); }
      .be-btn:not(:disabled):hover { background: var(--be-hover); }
      .be-btn--primary { background: var(--be-accent); color: #1b1205 !important; border-color: transparent; }
      .be-btn--primary:not(:disabled):hover { background: #ffdc85; }
      .be-btn--primary kbd { background: rgba(0,0,0,.12); border-color: rgba(0,0,0,.15); color: #3b2a08; }
      .be-btn--sub { background: var(--be-sub); color: #04202c !important; border-color: transparent; }
      .be-btn--sub:not(:disabled):hover { background: #74d7f5; }
      .be-btn--crop { background: var(--be-crop); color: #2b1500 !important; border-color: transparent; }
      .be-btn--crop:not(:disabled):hover { background: #ff9933; }
      .be-btn--review svg { width: 16px; height: 16px; stroke-width: 2.6; color: var(--be-faint); }
      .be-btn--review.on { background: rgba(6,214,160,.12); border-color: rgba(6,214,160,.35); color: var(--be-ok) !important; }
      .be-btn--review.on svg { color: var(--be-ok); }
      .be-footer { flex: none; display: flex; flex-direction: column; gap: 8px; padding: 14px;
        border-top: 1px solid var(--be-line); background: rgba(0,0,0,.15); }
      .be-link-danger { border: 0; background: none; color: var(--be-faint); font-size: 12px; padding: 4px; align-self: center; }
      .be-link-danger:not(:disabled):hover { color: var(--be-danger); text-decoration: underline; }

      /* ——— Toast & aide ——— */
      .be-toast { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); z-index: 50;
        max-width: min(560px, calc(100vw - 32px)); padding: 10px 16px 10px 14px; border-radius: 12px;
        font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 10px;
        background: #2a2238; border: 1px solid var(--be-line-strong); box-shadow: 0 14px 40px rgba(0,0,0,.5);
        animation: be-pop .18s ease-out; }
      .be-toast::before { content: ''; width: 8px; height: 8px; border-radius: 50%; flex: none; background: var(--be-muted); }
      .be-toast.ok::before { background: var(--be-ok); }
      .be-toast.warn::before { background: var(--be-danger); }
      .be-toast.busy::before { background: var(--be-accent); animation: be-pulse 1s infinite; }
      @keyframes be-pop { from { opacity: 0; transform: translate(-50%, 8px); } }
      @keyframes be-pulse { 50% { opacity: .3; } }
      .be-modal-backdrop { position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; padding: 16px;
        background: rgba(5,3,8,.6); backdrop-filter: blur(3px); animation: be-fade .15s; }
      @keyframes be-fade { from { opacity: 0; } }
      .be-modal { width: min(500px, 100%); max-height: 90dvh; overflow-y: auto; padding: 20px 22px;
        border-radius: 16px; background: var(--be-panel); border: 1px solid var(--be-line-strong);
        box-shadow: 0 30px 80px rgba(0,0,0,.6); }
      .be-modal header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
      .be-modal h2 { margin: 0; font-size: 17px; }
      .be-modal dl { margin: 0; display: flex; flex-direction: column; }
      .be-modal dl > div { display: flex; align-items: center; gap: 16px; padding: 8px 0; border-bottom: 1px solid var(--be-line); }
      .be-modal dt { width: 130px; flex: none; display: flex; gap: 4px; flex-wrap: wrap; }
      .be-modal dd { margin: 0; color: var(--be-muted); font-size: 13px; }
      .be-modal p { margin: 14px 0 0; font-size: 12.5px; color: var(--be-faint); line-height: 1.5; }

      @media (max-width: 1100px) {
        .be-root { grid-template-columns: 240px minmax(0, 1fr) 290px; }
        .be-seg { display: none; }
      }
      @media (max-width: 820px) {
        .be-root { display: flex; flex-direction: column; height: auto; min-height: 100dvh; overflow: visible; }
        .be-browser { border-right: 0; border-bottom: 1px solid var(--be-line); padding-bottom: 12px; }
        .be-list { max-height: 30vh; margin: 0; padding: 0; }
        .be-toolbar { padding: 0 12px; }
        .be-canvas { padding: 32px 16px; min-height: 60vh; }
        .be-inspector { border-left: 0; border-top: 1px solid var(--be-line); }
      }
    `}</style>
  );
}
