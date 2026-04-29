import { exportPdf } from '../exportPdf'

export default function SessionHeader({ session, onBack }) {
  const { meta, summary } = session
  const date = meta.extractedAt
    ? new Date(meta.extractedAt).toLocaleDateString('en-US', {
        day: '2-digit', month: 'long', year: 'numeric'
      })
    : '—'

  return (
    <div className="session-header">
      <div className="header-left">
        {onBack && (
          <button className="back-btn" onClick={onBack}>← Back</button>
        )}
        <h1>Kart <span>Telemetry</span></h1>
      </div>
      <div className="session-meta">
        <span>{meta.camera}</span>
        <span>•</span>
        <span>{date}</span>
        <span>•</span>
        <span>{meta.sourceFiles?.length ?? 1} file(s)</span>
        <span>•</span>
        <span>{summary.totalLaps} laps</span>
      </div>
      <button className="export-btn" onClick={() => exportPdf(session)}>
        Export PDF
      </button>
    </div>
  )
}
