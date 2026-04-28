export default function SessionHeader({ session }) {
  const { meta, summary } = session
  const date = meta.extractedAt
    ? new Date(meta.extractedAt).toLocaleDateString('pt-BR', {
        day: '2-digit', month: 'long', year: 'numeric'
      })
    : '—'

  return (
    <div className="session-header">
      <h1>Kart <span>Telemetria</span></h1>
      <div className="session-meta">
        <span>{meta.camera}</span>
        <span>•</span>
        <span>{date}</span>
        <span>•</span>
        <span>{meta.sourceFiles?.length ?? 1} arquivo(s)</span>
        <span>•</span>
        <span>{summary.totalLaps} voltas</span>
      </div>
    </div>
  )
}