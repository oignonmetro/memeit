import { useEffect, useRef, useState } from 'react';
import type { TextLayer } from '../types';

interface MemeRenderProps {
  templateUrl: string;
  layers: TextLayer[];
  frameClassName?: string;
}

// The outline scales with the font size instead of a flat pixel value — a
// fixed stroke looks hair-thin once a long caption shrinks the font, and
// looks overly thin on big short captions. 6% of the font size matches
// imgflip's classic bold-outline look at every size; the 1px floor keeps
// very small text from turning into an illegible blob.
const STROKE_RATIO = 0.06;
const MIN_STROKE = 1;
function strokeWidthFor(fontSize: number): number {
  return Math.max(MIN_STROKE, fontSize * STROKE_RATIO);
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
    // Measure the frame live rather than trusting frameW/frameH: those come
    // from React state and can lag one layout behind (e.g. an image load and
    // a frame resize landing in the same commit). Fitting against stale
    // dimensions while measuring the text in the current layout left
    // captions stuck far too small or too big.
    const frame = el.parentElement;
    const w = frame?.clientWidth || frameW;
    const h = frame?.clientHeight || frameH;
    const maxW = (w * layer.widthPct) / 100;
    const maxH = (h * layer.heightPct) / 100;
    const fits = (size: number) => {
      el.style.fontSize = `${size}px`;
      return el.scrollWidth <= maxW + 0.5 && el.scrollHeight <= maxH + 0.5;
    };
    // "Fits" is NOT monotonic in the font size: a smaller size can wrap to an
    // extra line and overflow while a larger one fits on fewer lines. A plain
    // binary search got trapped in that smaller regime at some frame widths
    // (tiny text). So scan down coarsely from the max for the first size that
    // fits, then bisect only inside that bracket, where it is monotonic.
    const MIN = 8;
    let hi = Math.max(10, w * 0.12);
    let best = MIN;
    let lo = MIN;
    if (fits(hi)) {
      best = hi;
    } else {
      let found = false;
      while (hi > MIN) {
        const next = Math.max(MIN, hi * 0.9);
        if (fits(next)) {
          lo = next;
          found = true;
          break;
        }
        hi = next;
      }
      if (found) {
        best = lo;
        for (let i = 0; i < 4; i += 1) {
          const mid = (lo + hi) / 2;
          if (fits(mid)) {
            best = mid;
            lo = mid;
          } else {
            hi = mid;
          }
        }
      }
    }
    el.style.fontSize = `${best}px`;
    el.style.webkitTextStrokeWidth = `${strokeWidthFor(best)}px`;
  }, [layer.text, layer.widthPct, layer.heightPct, frameW, frameH]);

  return (
    <div
      ref={ref}
      className="meme-text-layer"
      style={{
        left: `${layer.xPct}%`,
        top: `${layer.yPct}%`,
        width: `${layer.widthPct}%`,
        fontSize: `${startSize}px`,
        WebkitTextStrokeWidth: `${strokeWidthFor(startSize)}px`,
        // The base translate(-50%,-50%) (in .meme-text-layer) centers the box
        // on (xPct,yPct); rotate is appended so it turns around that same
        // center rather than the frame's origin.
        transform: layer.rotationDeg ? `translate(-50%, -50%) rotate(${layer.rotationDeg}deg)` : undefined,
      }}
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
