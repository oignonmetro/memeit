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
import MemeRender from '../components/MemeRender';
import { CLASSIQUES_TEMPLATES } from '../lib/packs/classiques';
import { PEPITES_TEMPLATES } from '../lib/packs/pepites';
import { TEMPLATE_PACKS } from '../lib/packs';
import type { Template, TemplateBox, TextLayer } from '../types';

type PackId = 'classiques' | 'pepites';
type Entry = { template: Template; pack: PackId };
type Filter = 'tous' | 'generiques' | 'personnalises' | 'nonrevus';
type SampleMode = 'court' | 'long' | 'numeros';

const ENTRIES: Entry[] = [
  ...CLASSIQUES_TEMPLATES.map((template) => ({ template, pack: 'classiques' as const })),
  ...PEPITES_TEMPLATES.map((template) => ({ template, pack: 'pepites' as const })),
];

const PACK_NAME: Record<PackId, string> = Object.fromEntries(
  TEMPLATE_PACKS.map((p) => [p.id, p.name])
) as Record<PackId, string>;

// Un template compte comme "personnalisé" s'il a une entrée CURATED dans
// templateBoxes.ts (Classiques) — les Pépites ont toujours leurs zones
// écrites à la main, donc toujours personnalisées.
function isCuratedEntry(pack: PackId, template: Template, curatedIds: Set<string>): boolean {
  return pack === 'pepites' || curatedIds.has(template.id.replace(/^imgflip-/, ''));
}

function matchesFilter(filter: Filter, isCurated: boolean, isReviewed: boolean): boolean {
  if (filter === 'personnalises') return isCurated;
  if (filter === 'generiques') return !isCurated;
  if (filter === 'nonrevus') return !isReviewed;
  return true;
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

const MIN_W = 4;
const MIN_H = 3;

function sampleText(mode: SampleMode, i: number): string {
  const pool = SAMPLES[mode];
  return pool[i % pool.length];
}

// Miroir de formatBox() dans scripts/boxWriter.mts (import direct impossible :
// TS refuse une extension .mts explicite sans changer la config du projet
// entier pour ce seul aperçu). Garder les deux en phase si le format change.
function formatBoxPreview(b: TemplateBox): string {
  const base = `xPct: ${b.xPct}, yPct: ${b.yPct}, widthPct: ${b.widthPct}, heightPct: ${b.heightPct}`;
  return b.rotationDeg ? `{ ${base}, rotationDeg: ${b.rotationDeg} }` : `{ ${base} }`;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round = (v: number) => Math.round(v);

// e.preventDefault() sur un pointerdown supprime aussi le blur automatique du
// champ actuellement focus (comportement standard du navigateur) — sans ça,
// cliquer une zone du canvas juste après une recherche laisse le focus dans
// le champ "Filtrer par nom…", et tous les raccourcis clavier (s, r, +,
// Suppr, 1-9...) atterrissent comme du texte tapé dans la recherche au lieu
// de déclencher l'action voulue.
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
const HANDLES: { sx: -1 | 0 | 1; sy: -1 | 0 | 1; cursor: string }[] = [
  { sx: -1, sy: -1, cursor: 'nwse-resize' },
  { sx: 0, sy: -1, cursor: 'ns-resize' },
  { sx: 1, sy: -1, cursor: 'nesw-resize' },
  { sx: 1, sy: 0, cursor: 'ew-resize' },
  { sx: 1, sy: 1, cursor: 'nwse-resize' },
  { sx: 0, sy: 1, cursor: 'ns-resize' },
  { sx: -1, sy: 1, cursor: 'nesw-resize' },
  { sx: -1, sy: 0, cursor: 'ew-resize' },
];

export default function BoxEditor() {
  const [index, setIndex] = useState(0);
  const [filter, setFilter] = useState<Filter>('tous');
  const [search, setSearch] = useState('');
  const [sample, setSample] = useState<SampleMode>('long');
  const [showOverlay, setShowOverlay] = useState(true);
  const [draft, setDraft] = useState<TemplateBox[]>([]);
  const [selected, setSelected] = useState(0);
  const [curatedIds, setCuratedIds] = useState<Set<string>>(new Set());
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<string | null>(null);
  const [frameReady, setFrameReady] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ENTRIES.filter(({ template, pack }) => {
      if (q && !template.name.toLowerCase().includes(q)) return false;
      const isCurated = isCuratedEntry(pack, template, curatedIds);
      const isReviewed = reviewedIds.has(template.id);
      return matchesFilter(filter, isCurated, isReviewed);
    });
  }, [search, filter, curatedIds, reviewedIds]);

  const entry = visible[Math.min(index, visible.length - 1)];
  const template = entry?.template;

  useEffect(() => {
    fetch('/__boxes/meta')
      .then((r) => r.json())
      .then((d) => {
        setCuratedIds(new Set(d.curatedIds));
        setReviewedIds(new Set(d.reviewedIds));
      })
      .catch(() => setStatus('Métadonnées indisponibles (serveur de dev ?)'));
  }, []);

  // Le brouillon se réinitialise sur le template courant. Après un
  // enregistrement, le HMR recharge le module du pack : les valeurs
  // rechargées sont alors identiques au brouillon, donc rien ne saute.
  useEffect(() => {
    if (!template) return;
    setDraft(template.boxes.map((b) => ({ ...b })));
    setSelected(0);
    setStatus(null);
  }, [template]);

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
    const check = () => setFrameReady(img.complete && img.naturalWidth > 0);
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
      setIndex((i) => {
        const next = i + delta;
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
      const raw = entry.template.id.replace(/^imgflip-/, '');
      setCuratedIds((prev) => new Set(prev).add(raw));
      setStatus('Enregistré dans le fichier source ✓');
      // Enregistrer peut faire sortir ce template du filtre actif (ex.
      // "Disposition générique" : il vient de devenir personnalisé). Dans ce
      // cas la liste filtrée rétrécit toute seule et le template suivant
      // glisse déjà à cette place — avancer l'index en plus le sauterait.
      // Sinon (filtre "Tous", ou filtre inchangé par ce save), on avance.
      if (matchesFilter(filter, true, reviewedIds.has(entry.template.id))) move(1);
    } catch (err) {
      setStatus(`Échec : ${err instanceof Error ? err.message : 'inconnu'}`);
    }
  }, [entry, draft, filter, reviewedIds, move]);

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
    if (!template || !entry) return;
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
    // en être éjecté. Même logique de rétrécissement de liste que save().
    if (next) {
      const isCurated = isCuratedEntry(entry.pack, template, curatedIds);
      if (matchesFilter(filter, isCurated, true)) move(1);
    }
  }, [template, entry, reviewedIds, curatedIds, filter, move]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return;
      const step = e.shiftKey ? 5 : 1;
      switch (e.key) {
        case 'ArrowLeft': e.preventDefault(); nudge(-step, 0); break;
        case 'ArrowRight': e.preventDefault(); nudge(step, 0); break;
        case 'ArrowUp':
          e.preventDefault();
          if (e.altKey) moveZone(selected, -1);
          else nudge(0, -step);
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (e.altKey) moveZone(selected, 1);
          else nudge(0, step);
          break;
        case ',': nudgeRotation(-step); break;
        case '.': nudgeRotation(step); break;
        case '[': move(-1); break;
        case ']': move(1); break;
        case 's': save(); break;
        case 'r': toggleReviewed(); break;
        case 'o': setShowOverlay((v) => !v); break;
        case 'Backspace':
        case 'Delete':
          e.preventDefault();
          deleteZone(selected);
          break;
        case '+':
          addZone();
          break;
        default:
          if (/^[1-9]$/.test(e.key)) setSelected(Number(e.key) - 1);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nudge, nudgeRotation, move, save, toggleReviewed, selected, moveZone, deleteZone, addZone]);

  // Un seul gestionnaire pour le déplacement et le redimensionnement : on
  // capture le pointeur (souris comme doigt) et on convertit les deltas en
  // pourcentages de la taille du cadre.
  function startDrag(
    e: React.PointerEvent,
    boxIndex: number,
    handle: { sx: -1 | 0 | 1; sy: -1 | 0 | 1 } | null
  ) {
    e.preventDefault();
    e.stopPropagation();
    blurActiveField();
    setSelected(boxIndex);
    const frame = frameRef.current;
    if (!frame) return;
    const rect = frame.getBoundingClientRect();
    if (!frameReady || !rect.width || !rect.height) {
      setStatus('Image non chargée : édition désactivée (les coordonnées seraient fausses).');
      return;
    }
    const start = draft[boxIndex];
    const startX = e.clientX;
    const startY = e.clientY;
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      const dxScreen = ((ev.clientX - startX) / rect.width) * 100;
      const dyScreen = ((ev.clientY - startY) / rect.height) * 100;
      setDraft((prev) =>
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
    setSelected(boxIndex);
    const frame = frameRef.current;
    if (!frame) return;
    const rect = frame.getBoundingClientRect();
    if (!frameReady || !rect.width || !rect.height) {
      setStatus('Image non chargée : édition désactivée (les coordonnées seraient fausses).');
      return;
    }
    const start = draft[boxIndex];
    const cx = rect.left + (start.xPct / 100) * rect.width;
    const cy = rect.top + (start.yPct / 100) * rect.height;
    const angleOf = (x: number, y: number) => Math.atan2(y - cy, x - cx) * (180 / Math.PI);
    const startAngle = angleOf(e.clientX, e.clientY);
    const startRotation = start.rotationDeg || 0;
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      const deg = normDeg(round(startRotation + (angleOf(ev.clientX, ev.clientY) - startAngle)));
      setDraft((prev) => prev.map((b, i) => (i === boxIndex ? { ...b, rotationDeg: deg } : b)));
    };
    const onUp = () => {
      target.releasePointerCapture(e.pointerId);
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
    };
    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
  }

  if (!template) {
    return (
      <div className="be-root">
        <Styles />
        <p className="be-empty">Aucun template ne correspond à ce filtre.</p>
      </div>
    );
  }

  const layers: TextLayer[] = draft.map((b, i) => ({ ...b, text: sampleText(sample, i) }));
  const isCurated = isCuratedEntry(entry.pack, template, curatedIds);
  const isReviewed = reviewedIds.has(template.id);

  return (
    <div className="be-root">
      <Styles />

      <header className="be-bar">
        <button onClick={() => move(-1)}>◀</button>
        <span className="be-pos">
          {Math.min(index, visible.length - 1) + 1} / {visible.length}
        </span>
        <button onClick={() => move(1)}>▶</button>
        <strong className="be-name">{template.name}</strong>
        <span className={`be-chip ${isCurated ? 'ok' : 'warn'}`}>
          {isCurated ? 'personnalisé' : 'générique'}
        </span>
        <span className={`be-chip ${isReviewed ? 'ok' : ''}`}>
          {isReviewed ? 'revu' : 'non revu'}
        </span>
        <span className="be-chip">{PACK_NAME[entry.pack]}</span>
        {dirty && <span className="be-chip dirty">modifié</span>}
      </header>

      <div className="be-controls">
        <input
          type="search"
          placeholder="Filtrer par nom…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIndex(0);
          }}
        />
        <select
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value as Filter);
            setIndex(0);
          }}
        >
          <option value="tous">Tous</option>
          <option value="generiques">Disposition générique</option>
          <option value="personnalises">Disposition personnalisée</option>
          <option value="nonrevus">Jamais revus</option>
        </select>
        <select value={sample} onChange={(e) => setSample(e.target.value as SampleMode)}>
          <option value="long">Légendes longues</option>
          <option value="court">Légendes courtes</option>
          <option value="numeros">Numéros</option>
        </select>
        <label className="be-check">
          <input
            type="checkbox"
            checked={showOverlay}
            onChange={(e) => setShowOverlay(e.target.checked)}
          />
          Cadres (o)
        </label>
      </div>

      <div className="be-main">
        <div className="be-stage">
          {!frameReady && (
            <p className="be-warn">
              Image du template non chargée — édition désactivée le temps qu'elle arrive.
            </p>
          )}
          <div className="be-frame" ref={frameRef}>
            <MemeRender templateUrl={template.url} layers={layers} />
            {showOverlay && (
              <div className="be-overlay">
                {draft.map((b, i) => (
                  <div
                    key={i}
                    className={`be-box ${i === selected ? 'sel' : ''}`}
                    style={{
                      left: `${b.xPct}%`,
                      top: `${b.yPct}%`,
                      width: `${b.widthPct}%`,
                      height: `${b.heightPct}%`,
                      // Les poignées et le pivot sont des enfants : ils héritent
                      // de cette transformation et suivent donc visuellement la
                      // zone quand elle tourne, sans calcul de position séparé.
                      transform: `translate(-50%, -50%) rotate(${b.rotationDeg || 0}deg)`,
                    }}
                    onPointerDown={(e) => startDrag(e, i, null)}
                  >
                    <span className="be-box-tag">{i + 1}</span>
                    {i === selected && (
                      <>
                        {HANDLES.map((h) => (
                          <span
                            key={`${h.sx}${h.sy}`}
                            className="be-handle"
                            style={{
                              left: `${50 + h.sx * 50}%`,
                              top: `${50 + h.sy * 50}%`,
                              cursor: h.cursor,
                            }}
                            onPointerDown={(e) => startDrag(e, i, h)}
                          />
                        ))}
                        <span className="be-rotate-stalk" />
                        <span
                          className="be-rotate-handle"
                          title="Glisser pour pivoter"
                          onPointerDown={(e) => startRotate(e, i)}
                        />
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <aside className="be-side">
          {draft.map((b, i) => (
            <div key={i} className={`be-row ${i === selected ? 'sel' : ''}`} onClick={() => setSelected(i)}>
              <span className="be-row-tag">{i + 1}</span>
              {(
                [
                  ['xPct', 'x'],
                  ['yPct', 'y'],
                  ['widthPct', 'largeur'],
                  ['heightPct', 'hauteur'],
                ] as const
              ).map(([k, label]) => (
                <label key={k}>
                  {label}
                  <input
                    type="number"
                    value={b[k]}
                    onChange={(e) =>
                      setDraft((prev) =>
                        prev.map((box, j) =>
                          j === i ? { ...box, [k]: clamp(Number(e.target.value) || 0, 0, 100) } : box
                        )
                      )
                    }
                  />
                </label>
              ))}
              <label>
                rot°
                <input
                  type="number"
                  value={b.rotationDeg || 0}
                  onChange={(e) =>
                    setDraft((prev) =>
                      prev.map((box, j) =>
                        j === i ? { ...box, rotationDeg: normDeg(clamp(Number(e.target.value) || 0, -180, 180)) } : box
                      )
                    )
                  }
                />
              </label>
              <div className="be-row-actions">
                <button
                  type="button"
                  className="be-row-btn"
                  disabled={i === 0}
                  title="Monter d'un cran (Alt+↑) — change l'ordre Texte 1/2/3..."
                  onClick={(e) => {
                    e.stopPropagation();
                    moveZone(i, -1);
                  }}
                >
                  ▲
                </button>
                <button
                  type="button"
                  className="be-row-btn"
                  disabled={i === draft.length - 1}
                  title="Descendre d'un cran (Alt+↓)"
                  onClick={(e) => {
                    e.stopPropagation();
                    moveZone(i, 1);
                  }}
                >
                  ▼
                </button>
                <button
                  type="button"
                  className="be-row-btn be-row-btn--danger"
                  disabled={draft.length <= 1}
                  title="Supprimer cette zone (Suppr)"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteZone(i);
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}

          <button
            type="button"
            className="be-add-zone"
            onClick={addZone}
            disabled={draft.length >= 9}
            title="Ajouter une zone de texte (+)"
          >
            + Ajouter une zone
          </button>

          <div className="be-actions">
            <button className="be-primary" onClick={save} disabled={!dirty || !frameReady}>
              Enregistrer (s)
            </button>
            <button onClick={() => setDraft(template.boxes.map((b) => ({ ...b })))} disabled={!dirty}>
              Annuler
            </button>
            <button onClick={toggleReviewed}>
              {isReviewed ? 'Marquer non revu (r)' : 'Marquer revu (r)'}
            </button>
            <button className="be-danger" onClick={deleteTemplate} title="Supprime le template entier, pas juste une zone">
              Supprimer ce template
            </button>
          </div>

          {status && <p className="be-status">{status}</p>}

          <p className="be-help">
            Glisser le cadre pour déplacer, les poignées pour redimensionner, le petit rond en
            haut pour pivoter. Flèches : déplacement de 1 % (Maj : 5 %). , / . : pivoter de 1°
            (Maj : 5°). 1-9 : sélectionner une zone. [ / ] : template précédent / suivant.
            s : enregistrer, r : marquer revu — les deux passent au template suivant.
            + : ajouter une zone, Suppr : supprimer la zone sélectionnée, Alt+↑/Alt+↓ (ou ▲▼ sur
            une ligne) : réordonner — l'ordre du tableau, c'est Texte 1, Texte 2... en jeu.
            « Supprimer ce template » (pas de raccourci clavier, confirmation demandée) retire le
            template entier des fichiers source, pas juste une zone.
          </p>
          <code className="be-code">[{draft.map(formatBoxPreview).join(', ')}]</code>
        </aside>
      </div>
    </div>
  );
}

function Styles() {
  // Styles portés par la page elle-même : rien de tout ceci n'a de raison
  // d'exister dans styles.css, qui part en production.
  return (
    <style>{`
      .be-root { min-height: 100dvh; background: #16121f; color: #f5f0ff; padding: 12px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
      .be-bar, .be-controls { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
      .be-bar button, .be-controls button, .be-actions button, .be-row-actions button, .be-add-zone {
        background: #2c1c40; color: #f5f0ff; border: 1px solid rgba(255,255,255,.18);
        border-radius: 8px; padding: 6px 10px; cursor: pointer; font-weight: 700; }
      .be-primary { background: #ffd166 !important; color: #23150a !important; border-color: #ffd166 !important; }
      .be-bar button:disabled, .be-actions button:disabled, .be-row-actions button:disabled,
      .be-add-zone:disabled { opacity: .4; cursor: not-allowed; }
      .be-pos { font-variant-numeric: tabular-nums; color: #b8a9d4; font-size: .85rem; }
      .be-name { font-size: 1rem; margin-right: 4px; }
      .be-chip { font-size: .7rem; font-weight: 800; padding: 2px 8px; border-radius: 999px;
        background: rgba(255,255,255,.1); color: #b8a9d4; }
      .be-chip.ok { background: rgba(6,214,160,.2); color: #06d6a0; }
      .be-chip.warn { background: rgba(255,209,102,.18); color: #ffd166; }
      .be-chip.dirty { background: #ef476f; color: #fff; }
      .be-controls input[type="search"], .be-controls select {
        background: rgba(0,0,0,.3); color: #f5f0ff; border: 1px solid rgba(255,255,255,.18);
        border-radius: 8px; padding: 6px 10px; }
      .be-check { display: flex; align-items: center; gap: 6px; font-size: .8rem; color: #b8a9d4; }
      .be-main { display: flex; gap: 16px; align-items: flex-start; flex-wrap: wrap; }
      .be-stage { flex: 1 1 420px; min-width: 300px; }
      .be-frame { position: relative; max-width: 620px; touch-action: none; }
      .be-overlay { position: absolute; inset: 0; }
      .be-box { position: absolute; transform: translate(-50%, -50%);
        border: 2px dashed rgba(255,209,102,.75); background: rgba(255,209,102,.07);
        cursor: move; touch-action: none; }
      /* La zone sélectionnée passe au-dessus des autres : sur un template à
         plusieurs zones qui se chevauchent, ses poignées se retrouvaient
         sinon sous une zone voisine, donc impossibles à attraper. */
      .be-box.sel { border-color: #06d6a0; border-style: solid; background: rgba(6,214,160,.1); z-index: 2; }
      .be-box-tag { position: absolute; top: -9px; left: -9px; width: 18px; height: 18px;
        border-radius: 50%; background: #ffd166; color: #23150a; font-size: .7rem; font-weight: 900;
        display: flex; align-items: center; justify-content: center; }
      .be-box.sel .be-box-tag { background: #06d6a0; }
      .be-handle { position: absolute; width: 12px; height: 12px; transform: translate(-50%, -50%);
        background: #06d6a0; border: 2px solid #16121f; border-radius: 3px; touch-action: none; z-index: 3; }
      /* Repère local (non tourné) de la zone parente : positionnées en enfants
         d'une .be-box qui porte elle-même la rotation, poignées et pivot en
         héritent automatiquement, sans calcul de position séparé. */
      .be-rotate-stalk { position: absolute; left: 50%; top: -14px; width: 2px; height: 14px;
        background: rgba(6,214,160,.75); transform: translateX(-50%); pointer-events: none; }
      .be-rotate-handle { position: absolute; left: 50%; top: -22px; width: 14px; height: 14px;
        transform: translate(-50%, -50%); background: #06d6a0; border: 2px solid #16121f;
        border-radius: 50%; cursor: grab; touch-action: none; z-index: 3; }
      .be-rotate-handle:active { cursor: grabbing; }
      .be-side { flex: 0 1 340px; min-width: 280px; display: flex; flex-direction: column; gap: 8px; }
      .be-row { display: flex; align-items: center; gap: 6px; padding: 6px; border-radius: 8px;
        background: rgba(255,255,255,.05); cursor: pointer; }
      .be-row.sel { outline: 2px solid #06d6a0; }
      .be-row-tag { width: 18px; height: 18px; border-radius: 50%; background: rgba(255,255,255,.15);
        font-size: .7rem; font-weight: 900; display: flex; align-items: center; justify-content: center; }
      .be-row label { display: flex; flex-direction: column; font-size: .62rem; color: #b8a9d4; gap: 2px; }
      .be-row input { width: 52px; background: rgba(0,0,0,.35); color: #f5f0ff;
        border: 1px solid rgba(255,255,255,.15); border-radius: 6px; padding: 4px; font-size: .8rem; }
      .be-row-actions { display: flex; flex-direction: column; gap: 2px; margin-left: auto; }
      .be-row-btn { width: 22px; height: 18px; padding: 0 !important; font-size: .65rem !important;
        line-height: 1; background: rgba(255,255,255,.08) !important; border-radius: 4px !important; }
      .be-row-btn--danger:not(:disabled) { color: #ef476f !important; }
      .be-add-zone { width: 100%; border: 1px dashed rgba(255,255,255,.3) !important;
        background: transparent !important; color: #b8a9d4 !important; }
      .be-add-zone:not(:disabled):hover { border-color: #ffd166 !important; color: #ffd166 !important; }
      .be-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px; }
      .be-danger { background: transparent !important; color: #ef476f !important;
        border-color: #ef476f !important; margin-left: auto; }
      .be-danger:hover { background: rgba(239,71,111,.12) !important; }
      .be-status { font-size: .8rem; color: #06d6a0; margin: 0; }
      .be-help { font-size: .72rem; color: #b8a9d4; line-height: 1.5; margin: 4px 0 0; }
      .be-code { display: block; font-size: .66rem; color: #b8a9d4; background: rgba(0,0,0,.35);
        padding: 8px; border-radius: 8px; word-break: break-all; line-height: 1.4; }
      .be-empty { color: #b8a9d4; }
      .be-warn { font-size: .78rem; font-weight: 700; color: #23150a; background: #ffd166;
        padding: 6px 10px; border-radius: 8px; margin: 0 0 8px; }
    `}</style>
  );
}
