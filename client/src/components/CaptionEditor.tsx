import { useMemo, useState } from 'react';
import MemeRender from './MemeRender';
import type { Template, TextLayer } from '../types';

interface CaptionEditorProps {
  template: Template;
  onSubmit: (layers: TextLayer[]) => void;
  submitting: boolean;
}

function boxLabel(count: number, i: number): string {
  if (count === 1) return 'Texte';
  if (count === 2) return i === 0 ? 'Texte du haut' : 'Texte du bas';
  return `Texte ${i + 1}`;
}

export default function CaptionEditor({ template, onSubmit, submitting }: CaptionEditorProps) {
  const boxes = template.boxes && template.boxes.length ? template.boxes : [{ xPct: 50, yPct: 15, widthPct: 90, heightPct: 26 }];
  const [texts, setTexts] = useState<string[]>(() => boxes.map(() => ''));

  // Preview shows the real position of each zone, with a faint placeholder when empty.
  const previewLayers: TextLayer[] = useMemo(
    () => boxes.map((b, i) => ({ ...b, text: texts[i]?.trim() ? texts[i] : boxLabel(boxes.length, i) })),
    [boxes, texts]
  );

  const submitLayers: TextLayer[] = boxes
    .map((b, i) => ({ ...b, text: (texts[i] || '').trim() }))
    .filter((l) => l.text.length > 0);

  const hasText = submitLayers.length > 0;

  function update(i: number, value: string) {
    setTexts((prev) => prev.map((t, idx) => (idx === i ? value.slice(0, 120) : t)));
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <MemeRender templateUrl={template.url} layers={previewLayers} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {boxes.map((_, i) => (
          <input
            key={i}
            type="text"
            placeholder={boxLabel(boxes.length, i)}
            value={texts[i]}
            onChange={(e) => update(i, e.target.value)}
            maxLength={120}
            autoFocus={i === 0}
          />
        ))}
      </div>

      <button className="btn btn-primary" disabled={!hasText || submitting} onClick={() => onSubmit(submitLayers)}>
        {submitting ? 'Envoi...' : 'Valider mon meme'}
      </button>
    </div>
  );
}
