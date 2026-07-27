interface TickSliderProps {
  options: number[];
  value: number;
  onChange: (value: number) => void;
  formatLabel: (value: number) => string;
  disabled?: boolean;
}

// A discrete, numeric axis: each stop is a tap target on a line, no dragging
// and no in-between positions — picking a value jumps straight to it.
export default function TickSlider({ options, value, onChange, formatLabel, disabled }: TickSliderProps) {
  const idx = Math.max(0, options.indexOf(value));
  return (
    <div className="tick-slider">
      <div className="tick-slider__track">
        {options.map((opt, i) => (
          <button
            key={opt}
            type="button"
            className={`tick-slider__tick ${i === idx ? 'active' : ''}`}
            disabled={disabled}
            aria-pressed={i === idx}
            onClick={() => onChange(opt)}
          >
            <span className="tick-slider__dot" />
            <span className="tick-slider__label">{formatLabel(opt)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
