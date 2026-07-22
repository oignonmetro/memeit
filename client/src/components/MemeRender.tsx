import { useRef } from 'react';
import type { TextLayer } from '../types';
import { FONT_SIZES } from '../types';

interface MemeRenderProps {
  templateUrl: string;
  layers: TextLayer[];
  editable?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onMove?: (id: string, xPct: number, yPct: number) => void;
  frameClassName?: string;
}

export default function MemeRender({
  templateUrl,
  layers,
  editable,
  selectedId,
  onSelect,
  onMove,
  frameClassName,
}: MemeRenderProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const draggingId = useRef<string | null>(null);

  function handlePointerDown(e: React.PointerEvent, id: string) {
    if (!editable) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    draggingId.current = id;
    onSelect?.(id);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!editable || !draggingId.current || !frameRef.current) return;
    const rect = frameRef.current.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;
    onMove?.(draggingId.current, clamp(xPct), clamp(yPct));
  }

  function handlePointerUp() {
    draggingId.current = null;
  }

  return (
    <div
      ref={frameRef}
      className={`meme-frame ${frameClassName || ''}`}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <img src={templateUrl} alt="Template de meme" draggable={false} />
      {layers.map((layer) => (
        <div
          key={layer.id}
          className={`meme-text-layer ${editable ? 'editable' : ''} ${selectedId === layer.id ? 'selected' : ''}`}
          style={{
            left: `${layer.xPct}%`,
            top: `${layer.yPct}%`,
            fontSize: `${FONT_SIZES[layer.fontSize]}cqw`,
            color: layer.color,
          }}
          onPointerDown={(e) => handlePointerDown(e, layer.id)}
        >
          {layer.text || (editable ? 'Ton texte' : '')}
        </div>
      ))}
    </div>
  );
}

function clamp(n: number) {
  return Math.min(100, Math.max(0, n));
}
