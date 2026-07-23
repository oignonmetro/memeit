import { useEffect, useRef, useState } from 'react';
import type { TextLayer } from '../types';

interface MemeRenderProps {
  templateUrl: string;
  layers: TextLayer[];
  frameClassName?: string;
}

// A single text zone whose font size auto-shrinks to fit its box — mimicking
// imgflip, where captions fill the box and get smaller as they get longer.
//
// The fit runs in a plain effect (after paint, not blocking it) and uses a
// binary search (~8 layout reads) instead of a linear 1px loop. Blocking paint
// with hundreds of synchronous reflows — e.g. the whole vote grid at once —
// froze the page on phones.
function MemeTextLayer({ layer, frameW, frameH }: { layer: TextLayer; frameW: number; frameH: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const startSize = frameW ? Math.max(12, frameW * 0.1) : 16;

  useEffect(() => {
    const el = ref.current;
    if (!el || !frameW || !frameH || !layer.text.trim()) return;
    const maxW = (frameW * layer.widthPct) / 100;
    const maxH = (frameH * layer.heightPct) / 100;
    let lo = 8;
    let hi = Math.max(10, frameW * 0.12);
    let best = lo;
    for (let i = 0; i < 8; i += 1) {
      const mid = (lo + hi) / 2;
      el.style.fontSize = `${mid}px`;
      if (el.scrollWidth <= maxW + 0.5 && el.scrollHeight <= maxH + 0.5) {
        best = mid;
        lo = mid;
      } else {
        hi = mid;
      }
    }
    el.style.fontSize = `${best}px`;
  }, [layer.text, layer.widthPct, layer.heightPct, frameW, frameH]);

  return (
    <div
      ref={ref}
      className="meme-text-layer"
      style={{ left: `${layer.xPct}%`, top: `${layer.yPct}%`, width: `${layer.widthPct}%`, fontSize: `${startSize}px` }}
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
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      setDim((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={frameRef} className={`meme-frame ${frameClassName || ''}`}>
      <img src={templateUrl} alt="Template de meme" draggable={false} onLoad={() => {
        const el = frameRef.current;
        if (el) setDim((prev) => (prev.h === el.clientHeight ? prev : { w: el.clientWidth, h: el.clientHeight }));
      }} />
      {layers.map((layer, i) => (
        <MemeTextLayer key={i} layer={layer} frameW={dim.w} frameH={dim.h} />
      ))}
    </div>
  );
}
