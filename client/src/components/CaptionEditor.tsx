import { useState } from 'react';
import MemeRender from './MemeRender';
import type { Template, TextLayer } from '../types';

interface CaptionEditorProps {
  template: Template;
  onSubmit: (layers: TextLayer[]) => void;
  submitting: boolean;
  changesLeft: number;
  isFirstTemplate: boolean;
  isSharedTemplate: boolean;
  onChangeTemplate: () => Promise<void>;
}

function boxLabel(i: number): string {
  return `Texte ${i + 1}`;
}

export default function CaptionEditor({ template, onSubmit, submitting, changesLeft, isFirstTemplate, isSharedTemplate, onChangeTemplate }: CaptionEditorProps) {
  const boxes = template.boxes && template.boxes.length ? template.boxes : [{ xPct: 50, yPct: 15, widthPct: 90, heightPct: 26 }];
  const [texts, setTexts] = useState<string[]>(() => boxes.map(() => ''));
  const [changing, setChanging] = useState(false);

  async function handleChange() {
    if (changing || changesLeft <= 0) return;
    setChanging(true);
    try {
      await onChangeTemplate();
    } finally {
      setChanging(false);
    }
  }

  // Une zone vide ne rend aucun texte (fini le "Texte 1" en dur dans l'aperçu) :
  // même tableau que ce qui part réellement à la soumission, donc l'aperçu ne
  // montre jamais un texte que le meme final n'aurait pas.
  const submitLayers: TextLayer[] = boxes
    .map((b, i) => ({ ...b, text: (texts[i] || '').trim() }))
    .filter((l) => l.text.length > 0);

  const hasText = submitLayers.length > 0;

  function update(i: number, value: string) {
    setTexts((prev) => prev.map((t, idx) => (idx === i ? value.slice(0, 120) : t)));
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {!isSharedTemplate && isFirstTemplate && (
        <div className="first-template-badge">1er template !</div>
      )}

      <div className="caption-preview">
        <MemeRender templateUrl={template.url} layers={submitLayers} />
        {boxes.map(
          (b, i) =>
            !texts[i]?.trim() && (
              <div
                key={i}
                className="caption-empty-zone"
                style={{
                  left: `${b.xPct}%`,
                  top: `${b.yPct}%`,
                  width: `${b.widthPct}%`,
                  height: `${b.heightPct}%`,
                  transform: `translate(-50%, -50%) rotate(${b.rotationDeg || 0}deg)`,
                }}
              />
            )
        )}
      </div>

      {!isSharedTemplate && (
        <button
          className="btn btn-secondary btn-sm"
          onClick={handleChange}
          disabled={changing || changesLeft <= 0}
        >
          {changesLeft > 0 ? `🎲 Changer de template (${changesLeft} restant${changesLeft > 1 ? 's' : ''})` : 'Plus de changement possible'}
        </button>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {boxes.map((_, i) => (
          <div key={i} className="text-input-wrap">
            <input
              type="text"
              placeholder={boxLabel(i)}
              value={texts[i]}
              onChange={(e) => update(i, e.target.value)}
              maxLength={120}
              autoFocus={i === 0}
            />
            {texts[i]?.trim() && (
              <button
                type="button"
                className="text-input-clear"
                aria-label={`Vider ${boxLabel(i).toLowerCase()}`}
                onClick={() => update(i, '')}
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>

      <button className="btn btn-primary" disabled={!hasText || submitting} onClick={() => onSubmit(submitLayers)}>
        {submitting ? 'Envoi...' : 'Valider mon meme'}
      </button>
    </div>
  );
}
