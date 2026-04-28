export default function SessionHeader({ session }) {
  const { meta, summary } = session
  const date = meta.extractedAt
    ? new Date(meta.extractedAt).toLocaleDateString('en-US', {
        day: '2-digit', month: 'long', year: 'numeric'
      })
    : '—'

  return (
    <div className="session-header">
      <h1>Kart <span>Telemetry</span></h1>
      <div className="session-meta">
        <span>{meta.camera}</span>
        <span>•</span>
        <span>{date}</span>
        <span>•</span>
        <span>{meta.sourceFiles?.length ?? 1} file(s)</span>
        <span>•</span>
        <span>{summary.totalLaps} laps</span>
      </div>
    </div>
  )
}
