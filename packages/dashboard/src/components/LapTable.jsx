export default function LapTable({ laps, bestLapNumber, selectedLap, referenceLap, onSelectLap, onSetReference }) {
  const bestTime = Math.min(...laps.map(l => l.durationMs))
  const worstTime = Math.max(...laps.map(l => l.durationMs))

  return (
    <div className="panel">
      <div className="panel-title">
        Laps
        {referenceLap && (
          <span style={{ marginLeft: 12, color: 'var(--blue)', fontSize: 10 }}>
            REF: L{referenceLap.lapNumber}
          </span>
        )}
      </div>
      <table className="lap-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Time</th>
            <th>Max km/h</th>
            <th></th>
            <th>Ref</th>
          </tr>
        </thead>
        <tbody>
          {laps.map(lap => {
            const isBest = lap.lapNumber === bestLapNumber
            const isWorst = lap.durationMs === worstTime && laps.length > 1
            const isSelected = selectedLap?.lapNumber === lap.lapNumber
            const isReference = referenceLap?.lapNumber === lap.lapNumber
            const delta = lap.durationMs - bestTime
            const deltaStr = delta === 0 ? '' : `+${(delta / 1000).toFixed(3)}s`

            return (
              <tr
                key={lap.lapNumber}
                className={[
                  isBest ? 'best-lap' : '',
                  isSelected ? 'selected' : '',
                  isReference ? 'reference' : '',
                ].join(' ')}
                onClick={() => onSelectLap(lap)}
              >
                <td>L{lap.lapNumber}</td>
                <td>
                  {lap.lapTime}
                  {deltaStr && (
                    <span style={{ fontSize: 11, color: 'var(--text2)', marginLeft: 6 }}>
                      {deltaStr}
                    </span>
                  )}
                </td>
                <td>{lap.maxSpeedKmh}</td>
                <td>
                  {isBest && <span className="badge badge-best">BEST</span>}
                  {isWorst && !isBest && <span className="badge badge-slow">SLOW</span>}
                </td>
                <td>
                  <button
                    className={`ref-btn ${isReference ? 'ref-btn-active' : ''}`}
                    onClick={e => { e.stopPropagation(); onSetReference(lap) }}
                    title={isReference ? 'Remove reference' : 'Set as reference'}
                  >
                    {isReference ? '★' : '☆'}
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
