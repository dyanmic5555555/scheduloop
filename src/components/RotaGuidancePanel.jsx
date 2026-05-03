function RotaGuidancePanel({ guidance }) {
  if (!guidance) return null;

  return (
    <section className="card rota-guidance-panel" aria-label="Rota guidance">
      <div className="rota-guidance-header">
        <div>
          <h2 className="card-title">Rota guidance</h2>
          <p className="card-subtitle">
            Planning prompts based on the forecast. This is guidance only, not
            rota publishing.
          </p>
        </div>
        <span className="rota-guidance-badge">Forecast-based</span>
      </div>

      <p className="rota-guidance-summary">{guidance.summary}</p>

      <div className="rota-guidance-grid">
        <div className="rota-guidance-callout">
          <span>Strongest cover</span>
          <strong>{guidance.strongestCoverLabel}</strong>
          <p>Plan your most reliable cover around this window.</p>
        </div>
        <div className="rota-guidance-callout">
          <span>Quieter cover</span>
          <strong>{guidance.quietCoverLabel}</strong>
          <p>This is the first place to keep staffing closer to minimum.</p>
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
          <strong>Demand spikes to review</strong>
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
