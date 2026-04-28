export default function StatsBar({ summary }) {
  const trackLengthM = summary.trackLengthM
  const trackDisplay = trackLengthM >= 1000
    ? `${(trackLengthM / 1000).toFixed(2)} km`
    : `${trackLengthM} m`

  return (
    <div className="stats-bar">
      <div className="stat-card">
        <span className="stat-label">Best Lap</span>
        <span className="stat-value green">{summary.bestLapTime}</span>
        <span className="stat-sub">L{summary.bestLapNumber}</span>
      </div>

      <div className="stat-card">
        <span className="stat-label">Total Laps</span>
        <span className="stat-value blue">{summary.totalLaps}</span>
        <span className="stat-sub">laps completed</span>
      </div>

      <div className="stat-card">
        <span className="stat-label">Max Speed</span>
        <span className="stat-value red">
          {summary.sessionMaxSpeedKmh}<span className="stat-unit">km/h</span>
        </span>
        <span className="stat-sub">session peak</span>
      </div>

      <div className="stat-card">
        <span className="stat-label">Avg Speed</span>
        <span className="stat-value">
          {summary.sessionAvgSpeedKmh}<span className="stat-unit">km/h</span>
        </span>
        <span className="stat-sub">during the race</span>
      </div>

      <div className="stat-card">
        <span className="stat-label">Max G-Force</span>
        <span className="stat-value amber">
          {summary.sessionMaxGLateral}<span className="stat-unit">G</span>
        </span>
        <span className="stat-sub">lateral</span>
      </div>

      <div className="stat-card">
        <span className="stat-label">Track Length</span>
        <span className="stat-value">{trackDisplay}</span>
        <span className="stat-sub">GPS estimate</span>
      </div>
    </div>
  )
}
