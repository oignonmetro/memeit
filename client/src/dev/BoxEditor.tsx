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
import type { Template, TemplateBox, TextLayer } from '../types';

type PackId = 'classiques' | 'pepites';
type Entry = { template: Template; pack: PackId };
type Filter = 'tous' | 'generiques' | 'cures' | 'nonrevus';
type SampleMode = 'court' | 'long' | 'numeros';

const ENTRIES: Entry[] = [
  ...CLASSIQUES_TEMPLATES.map((template) => ({ template, pack: 'classiques' as const })),
  ...PEPITES_TEMPLATES.map((template) => ({ template, pack: 'pepites' as const })),
];

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

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round = (v: number) => Math.round(v);

function sameBoxes(a: TemplateBox[], b: TemplateBox[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (box, i) =>
        box.xPct === b[i].xPct &&
        box.yPct === b[i].yPct &&
        box.widthPct === b[i].widthPct &&
        box.heightPct === b[i].heightPct
    )
  );
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
      const raw = template.id.replace(/^imgflip-/, '');
      const isCurated = pack === 'pepites' || curatedIds.has(raw);
      if (filter === 'cures') return isCurated;
      if (filter === 'generiques') return !isCurated;
      if (filter === 'nonrevus') return !reviewedIds.has(template.id);
      return true;
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
    } catch (err) {
      setStatus(`Échec : ${err instanceof Error ? err.message : 'inconnu'}`);
    }
  }, [entry, draft]);

  const toggleReviewed = useCallback(async () => {
    if (!template) return;
    const next = !reviewedIds.has(template.id);
    setReviewedIds((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(template.id);
      else copy.delete(template.id);
      return copy;
    });
    await fetch('/__boxes/reviewed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: template.id, reviewed: next }),
    }).catch(() => setStatus('Statut « revu » non enregistré'));
  }, [template, reviewedIds]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return;
      const step = e.shiftKey ? 5 : 1;
      switch (e.key) {
        case 'ArrowLeft': e.preventDefault(); nudge(-step, 0); break;
        case 'ArrowRight': e.preventDefault(); nudge(step, 0); break;
        case 'ArrowUp': e.preventDefault(); nudge(0, -step); break;
        case 'ArrowDown': e.preventDefault(); nudge(0, step); break;
        case '[': move(-1); break;
        case ']': move(1); break;
        case 's': save(); break;
        case 'r': toggleReviewed(); break;
        case 'o': setShowOverlay((v) => !v); break;
        default:
          if (/^[1-9]$/.test(e.key)) setSelected(Number(e.key) - 1);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nudge, move, save, toggleReviewed]);

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
      const dx = ((ev.clientX - startX) / rect.width) * 100;
      const dy = ((ev.clientY - startY) / rect.height) * 100;
      setDraft((prev) =>
        prev.map((b, i) => {
          if (i !== boxIndex) return b;
          if (!handle) {
            return {
              ...b,
              xPct: round(clamp(start.xPct + dx, 0, 100)),
              yPct: round(clamp(start.yPct + dy, 0, 100)),
            };
          }
          const next = { ...b };
          if (handle.sx !== 0) {
            next.widthPct = round(clamp(start.widthPct + handle.sx * dx, MIN_W, 100));
            next.xPct = round(clamp(start.xPct + dx / 2, 0, 100));
          }
          if (handle.sy !== 0) {
            next.heightPct = round(clamp(start.heightPct + handle.sy * dy, MIN_H, 100));
            next.yPct = round(clamp(start.yPct + dy / 2, 0, 100));
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

  if (!template) {
    return (
      <div className="be-root">
        <Styles />
        <p className="be-empty">Aucun template ne correspond à ce filtre.</p>
      </div>
    );
  }

  const layers: TextLayer[] = draft.map((b, i) => ({ ...b, text: sampleText(sample, i) }));
  const raw = template.id.replace(/^imgflip-/, '');
  const isCurated = entry.pack === 'pepites' || curatedIds.has(raw);
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
          {isCurated ? 'curé' : 'générique'}
        </span>
        <span className={`be-chip ${isReviewed ? 'ok' : ''}`}>
          {isReviewed ? 'revu' : 'non revu'}
        </span>
        <span className="be-chip">{entry.pack}</span>
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
          <option value="cures">Curés à la main</option>
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
                    }}
                    onPointerDown={(e) => startDrag(e, i, null)}
                  >
                    <span className="be-box-tag">{i + 1}</span>
                    {i === selected &&
                      HANDLES.map((h) => (
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
              {(['xPct', 'yPct', 'widthPct', 'heightPct'] as const).map((k) => (
                <label key={k}>
                  {k.replace('Pct', '')}
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
            </div>
          ))}

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
          </div>

          {status && <p className="be-status">{status}</p>}

          <p className="be-help">
            Glisser le cadre pour déplacer, les poignées pour redimensionner. Flèches : nudge 1 %
            (Maj : 5 %). 1-9 : sélectionner une zone. [ / ] : template précédent / suivant.
          </p>
          <code className="be-code">
            [{draft.map((b) => `{ xPct: ${b.xPct}, yPct: ${b.yPct}, widthPct: ${b.widthPct}, heightPct: ${b.heightPct} }`).join(', ')}]
          </code>
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
      .be-bar button, .be-controls button, .be-actions button {
        background: #2c1c40; color: #f5f0ff; border: 1px solid rgba(255,255,255,.18);
        border-radius: 8px; padding: 6px 10px; cursor: pointer; font-weight: 700; }
      .be-primary { background: #ffd166 !important; color: #23150a !important; border-color: #ffd166 !important; }
      .be-bar button:disabled, .be-actions button:disabled { opacity: .4; cursor: not-allowed; }
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
      .be-side { flex: 0 1 340px; min-width: 280px; display: flex; flex-direction: column; gap: 8px; }
      .be-row { display: flex; align-items: center; gap: 6px; padding: 6px; border-radius: 8px;
        background: rgba(255,255,255,.05); cursor: pointer; }
      .be-row.sel { outline: 2px solid #06d6a0; }
      .be-row-tag { width: 18px; height: 18px; border-radius: 50%; background: rgba(255,255,255,.15);
        font-size: .7rem; font-weight: 900; display: flex; align-items: center; justify-content: center; }
      .be-row label { display: flex; flex-direction: column; font-size: .62rem; color: #b8a9d4; gap: 2px; }
      .be-row input { width: 52px; background: rgba(0,0,0,.35); color: #f5f0ff;
        border: 1px solid rgba(255,255,255,.15); border-radius: 6px; padding: 4px; font-size: .8rem; }
      .be-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px; }
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
