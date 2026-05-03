function RotaGuidancePanel({ guidance }) {
  if (!guidance) return null;

  return (
    <section className="card rota-guidance-panel" aria-label="Rota guidance">
      <div className="rota-guidance-header">
        <div>
          <h2 className="card-title">Rota Guidance</h2>
          <p className="card-subtitle">
            Practical actions generated from the staffing forecast. This is not
            rota publishing yet.
          </p>
        </div>
        <span className="rota-guidance-badge">Manager actions</span>
      </div>

      <p className="rota-guidance-summary">{guidance.summary}</p>

      <div className="rota-guidance-grid">
        <div className="rota-guidance-callout">
          <span>Strongest cover</span>
          <strong>{guidance.strongestCoverLabel}</strong>
          <p>Schedule your most reliable cover around this window.</p>
        </div>
        <div className="rota-guidance-callout">
          <span>Quieter cover</span>
          <strong>{guidance.quietCoverLabel}</strong>
          <p>Use this as the first place to keep staffing closer to minimum.</p>
        </div>
      </div>

      {guidance.roleAdvice.length > 0 && (
        <ul className="rota-guidance-list">
          {guidance.roleAdvice.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}

      {guidance.warnings.length > 0 && (
        <div className="rota-guidance-warning">
          <strong>Peak warnings</strong>
          <ul>
            {guidance.warnings.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export default RotaGuidancePanel;
