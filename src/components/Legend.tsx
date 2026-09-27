export function Legend() {
  return (
    <div className="legend" aria-label="Legend">
      <span className="legend-item">
        <svg width="26" height="14" aria-hidden="true"><polygon points="1,1 25,1 25,13 12,13" fill="#43E5C0" /><line x1="1" y1="1" x2="12" y2="13" stroke="#fff" strokeWidth="1.5" /></svg>
        Wedge: filter sweep in or out
      </span>
      <span className="legend-item">
        <svg width="26" height="14" aria-hidden="true"><rect x="1" y="1" width="24" height="12" rx="3" fill="#4FACFE" fillOpacity="0.4" stroke="#fff" strokeDasharray="3 2" /></svg>
        Dashed: low confidence
      </span>
      <span className="legend-item">
        <svg width="26" height="14" aria-hidden="true"><rect x="1" y="1" width="24" height="12" rx="3" fill="#6A5AF9" /><path d="M3,11 C10,11 14,3 23,3" stroke="#fff" strokeWidth="1.6" fill="none" /></svg>
        Curve: movement inside a block
      </span>
      <span className="legend-item">
        <svg width="26" height="14" aria-hidden="true"><rect x="1" y="1" width="24" height="12" rx="3" fill="#6A5AF9" /><path d="M3,7 L23,7" stroke="#fff" strokeWidth="1.6" strokeDasharray="3 3" /></svg>
        Dashed curve: reverb / delay
      </span>
      <span className="legend-item">
        <svg width="26" height="14" aria-hidden="true"><polygon points="1,13 25,1 25,13" fill="#F7B733" /></svg>
        Riser / downlifter
      </span>
    </div>
  );
}
