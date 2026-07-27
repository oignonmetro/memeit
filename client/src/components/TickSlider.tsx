interface TickSliderProps {
  options: number[];
  value: number;
  onChange: (value: number) => void;
  formatLabel: (value: number) => string;
  disabled?: boolean;
}

// A single-axis slider snapped to a fixed set of values, with a tick + label
// under each stop (the value itself drives the step, not a linear index).
export default function TickSlider({ options, value, onChange, formatLabel, disabled }: TickSliderProps) {
  const idx = Math.max(0, options.indexOf(value));
  return (
    <div className="tick-slider">
      <input
        type="range"
        className="tick-slider__input"
        min={0}
        max={options.length - 1}
        step={1}
        value={idx}
        disabled={disabled}
        onChange={(e) => onChange(options[Number(e.target.value)])}
      />
      <div className="tick-slider__ticks">
        {options.map((opt, i) => (
          <div key={opt} className={`tick-slider__tick ${i === idx ? 'active' : ''}`}>
            <span className="tick-slider__dot" />
            <span className="tick-slider__label">{formatLabel(opt)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
