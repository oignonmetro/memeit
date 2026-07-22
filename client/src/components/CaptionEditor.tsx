import { useState } from 'react';
import MemeRender from './MemeRender';
import type { TextLayer } from '../types';
import { TEXT_COLORS, MAX_TEXT_LAYERS } from '../types';
import { generateLayerId } from '../lib/id';

interface CaptionEditorProps {
  templateUrl: string;
  onSubmit: (layers: TextLayer[]) => void;
  submitting: boolean;
}

export default function CaptionEditor({ templateUrl, onSubmit, submitting }: CaptionEditorProps) {
  const [layers, setLayers] = useState<TextLayer[]>([
    { id: generateLayerId(), text: '', xPct: 50, yPct: 12, fontSize: 'md', color: '#ffffff' },
  ]);
  const [selectedId, setSelectedId] = useState<string | null>(layers[0]?.id ?? null);

  const selected = layers.find((l) => l.id === selectedId) || null;

  function updateSelected(patch: Partial<TextLayer>) {
    if (!selectedId) return;
    setLayers((prev) => prev.map((l) => (l.id === selectedId ? { ...l, ...patch } : l)));
  }

  function addLayer() {
    if (layers.length >= MAX_TEXT_LAYERS) return;
    const id = generateLayerId();
    setLayers((prev) => [...prev, { id, text: '', xPct: 50, yPct: 50, fontSize: 'md', color: '#ffffff' }]);
    setSelectedId(id);
  }

  function removeSelected() {
    if (!selectedId) return;
    setLayers((prev) => prev.filter((l) => l.id !== selectedId));
    setSelectedId(null);
  }

  function move(id: string, xPct: number, yPct: number) {
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, xPct, yPct } : l)));
  }

  const hasText = layers.some((l) => l.text.trim().length > 0);

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <MemeRender
        templateUrl={templateUrl}
        layers={layers}
        editable
        selectedId={selectedId}
        onSelect={setSelectedId}
        onMove={move}
      />

      {selected && (
        <input
          type="text"
          placeholder="Écris ton texte ici..."
          value={selected.text}
          onChange={(e) => updateSelected({ text: e.target.value })}
          maxLength={120}
          autoFocus
        />
      )}

      <div className="toolbar">
        <button className="btn btn-secondary" style={{ width: 'auto', padding: '10px 14px' }} onClick={addLayer} disabled={layers.length >= MAX_TEXT_LAYERS}>
          + Texte
        </button>
        {(['sm', 'md', 'lg'] as const).map((size) => (
          <button
            key={size}
            className="btn btn-secondary"
            style={{ width: 'auto', padding: '10px 14px', opacity: selected?.fontSize === size ? 1 : 0.55 }}
            onClick={() => updateSelected({ fontSize: size })}
            disabled={!selected}
          >
            {size === 'sm' ? 'Petit' : size === 'md' ? 'Moyen' : 'Grand'}
          </button>
        ))}
        <button className="btn btn-danger" style={{ width: 'auto', padding: '10px 14px' }} onClick={removeSelected} disabled={!selected}>
          Suppr.
        </button>
      </div>

      <div className="toolbar">
        {TEXT_COLORS.map((c) => (
          <button
            key={c}
            className={`color-dot ${selected?.color === c ? 'selected' : ''}`}
            style={{ background: c }}
            onClick={() => updateSelected({ color: c })}
            disabled={!selected}
            aria-label={`Couleur ${c}`}
          />
        ))}
      </div>

      <button className="btn btn-primary" disabled={!hasText || submitting} onClick={() => onSubmit(layers.filter((l) => l.text.trim()))}>
        {submitting ? 'Envoi...' : 'Valider mon meme'}
      </button>
    </div>
  );
}
