export default function SectorPanel({ lap, bestSectors }) {
  if (!lap) return null

  const bestTimes = bestSectors.map(s => s?.durationMs ?? Infinity)

  return (
    <div className="panel">
      <div className="panel-title">Sectors — L{lap.lapNumber}</div>
      <div className="sectors-grid">
        {lap.sectors.map((sector, i) => {
          const best = bestTimes[i]
          const delta = sector.durationMs - best
          const isBest = delta === 0
          const pct = best > 0 ? Math.max(10, 100 - ((delta / best) * 100 * 8)) : 100
          const deltaStr = isBest
            ? '— BEST SECTOR'
            : `+${(delta / 1000).toFixed(3)}s`

          return (
            <div className="sector-card" key={sector.sector}>
              <div className="sector-label">Sector {sector.sector}</div>
              <div className="sector-time">{sector.sectorTime}</div>
              <div className={`sector-delta ${isBest ? 'best' : 'slow'}`}>
                {deltaStr}
              </div>
              <div className="sector-bar-bg">
                <div
                  className={`sector-bar-fill ${isBest ? 'bar-best' : delta < 500 ? 'bar-mid' : 'bar-slow'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text2)', fontFamily: 'var(--mono)' }}>
                max {sector.maxSpeedKmh} km/h
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
