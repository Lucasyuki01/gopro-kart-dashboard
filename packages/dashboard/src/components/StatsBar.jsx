export default function StatsBar({ summary }) {
  const trackLengthM = summary.trackLengthM
  const trackDisplay = trackLengthM >= 1000
    ? `${(trackLengthM / 1000).toFixed(2)} km`
    : `${trackLengthM} m`

  return (
    <div className="stats-bar">
      <div className="stat-card">
        <span className="stat-label">Melhor Volta</span>
        <span className="stat-value green">{summary.bestLapTime}</span>
        <span className="stat-sub">V{summary.bestLapNumber}</span>
      </div>

      <div className="stat-card">
        <span className="stat-label">Total de Voltas</span>
        <span className="stat-value blue">{summary.totalLaps}</span>
        <span className="stat-sub">voltas completadas</span>
      </div>

      <div className="stat-card">
        <span className="stat-label">Velocidade Máx</span>
        <span className="stat-value red">
          {summary.sessionMaxSpeedKmh}<span className="stat-unit">km/h</span>
        </span>
        <span className="stat-sub">pico da sessão</span>
      </div>

      <div className="stat-card">
        <span className="stat-label">Velocidade Média</span>
        <span className="stat-value">
          {summary.sessionAvgSpeedKmh}<span className="stat-unit">km/h</span>
        </span>
        <span className="stat-sub">durante a corrida</span>
      </div>

      <div className="stat-card">
        <span className="stat-label">Força G Máx</span>
        <span className="stat-value amber">
          {summary.sessionMaxGLateral}<span className="stat-unit">G</span>
        </span>
        <span className="stat-sub">lateral</span>
      </div>

      <div className="stat-card">
        <span className="stat-label">Tamanho da Pista</span>
        <span className="stat-value">{trackDisplay}</span>
        <span className="stat-sub">estimativa por GPS</span>
      </div>
    </div>
  )
}