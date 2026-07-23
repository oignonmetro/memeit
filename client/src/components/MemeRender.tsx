import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { TextLayer } from '../types';

interface MemeRenderProps {
  templateUrl: string;
  layers: TextLayer[];
  frameClassName?: string;
}

// A single text zone whose font size auto-shrinks to fit its box — mimicking
// imgflip, where captions fill the box and get smaller as they get longer.
function MemeTextLayer({ layer, frameW, frameH }: { layer: TextLayer; frameW: number; frameH: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !frameW || !frameH) return;
    const maxW = (frameW * layer.widthPct) / 100;
    const maxH = (frameH * layer.heightPct) / 100;
    let size = Math.max(10, frameW * 0.11);
    el.style.fontSize = `${size}px`;
    let guard = 0;
    while ((el.scrollWidth > maxW + 0.5 || el.scrollHeight > maxH + 0.5) && size > 7 && guard < 90) {
      size -= 1;
      el.style.fontSize = `${size}px`;
      guard += 1;
    }
  }, [layer.text, layer.widthPct, layer.heightPct, frameW, frameH]);

  return (
    <div
      ref={ref}
      className="meme-text-layer"
      style={{ left: `${layer.xPct}%`, top: `${layer.yPct}%`, width: `${layer.widthPct}%` }}
    >
      {layer.text}
    </div>
  );
}

export default function MemeRender({ templateUrl, layers, frameClassName }: MemeRenderProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [dim, setDim] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const measure = () => setDim({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={frameRef} className={`meme-frame ${frameClassName || ''}`}>
      <img src={templateUrl} alt="Template de meme" draggable={false} />
      {layers.map((layer, i) => (
        <MemeTextLayer key={i} layer={layer} frameW={dim.w} frameH={dim.h} />
      ))}
    </div>
  );
}
