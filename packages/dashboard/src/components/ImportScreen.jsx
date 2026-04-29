import { useState, useEffect, useRef } from 'react'
import { Upload, Film, CheckCircle2, Circle } from 'lucide-react'
import '../styles/dashboard.css'
import '../styles/import.css'

const SERVER = import.meta.env.VITE_SERVER_URL || ''

function formatBytes(bytes) {
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

export default function ImportScreen({ onSessionReady }) {
  const [gallery, setGallery] = useState([])
  const [galleryError, setGalleryError] = useState(false)
  const [selected, setSelected] = useState([])
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [logs, setLogs] = useState([])
  const [status, setStatus] = useState('idle') // idle | running | done | failed
  const fileInputRef = useRef(null)
  const logsEndRef = useRef(null)

  useEffect(() => { fetchGallery() }, [])

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  async function fetchGallery() {
    try {
      const res = await fetch(`${SERVER}/api/gallery`)
      if (!res.ok) throw new Error()
      setGallery(await res.json())
      setGalleryError(false)
    } catch {
      setGalleryError(true)
    }
  }

  async function uploadFiles(files) {
    setUploading(true)
    try {
      const form = new FormData()
      for (const file of files) form.append('videos', file)
      const res = await fetch(`${SERVER}/api/upload`, { method: 'POST', body: form })
      const data = await res.json()
      await fetchGallery()
      setSelected(prev => [...new Set([...prev, ...data.uploaded])])
    } finally {
      setUploading(false)
    }
  }

  function toggleSelect(name) {
    setSelected(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    )
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const files = [...e.dataTransfer.files].filter(f =>
      f.name.toLowerCase().endsWith('.mp4')
    )
    if (files.length) uploadFiles(files)
  }

  async function runPipeline() {
    setProcessing(true)
    setLogs([])
    setStatus('running')

    const res = await fetch(`${SERVER}/api/pipeline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: selected }),
    })

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split('\n\n')
      buffer = parts.pop()
      for (const part of parts) {
        const line = part.trim()
        if (!line.startsWith('data: ')) continue
        try {
          const event = JSON.parse(line.slice(6))
          if (event.type === 'log') {
            setLogs(prev => [...prev, { msg: event.msg, kind: 'log' }])
          } else if (event.type === 'done') {
            setLogs(prev => [...prev, { msg: '✓ Pipeline concluída com sucesso.', kind: 'done' }])
            setStatus('done')
          } else if (event.type === 'failed') {
            setLogs(prev => [...prev, { msg: '✗ Pipeline encerrada com erro.', kind: 'error' }])
            setStatus('failed')
          }
        } catch {}
      }
    }
  }

  // ── Pipeline progress view ───────────────────────────────────────────────
  if (processing) {
    return (
      <div className="import-screen">
        <h1 className="import-logo">Kart <span>Telemetry</span></h1>
        <div className="pipeline-panel">
          <div className="pipeline-header">
            {status === 'running' && <div className="pipeline-spinner" />}
            <span className="pipeline-title">
              {status === 'running' && 'Processando…'}
              {status === 'done'    && '✓ Concluído'}
              {status === 'failed'  && '✗ Erro na pipeline'}
            </span>
          </div>
          <div className="pipeline-logs">
            {logs.map((l, i) => (
              <div key={i} className={`log-line log-${l.kind}`}>{l.msg}</div>
            ))}
            <div ref={logsEndRef} />
          </div>
          {(status === 'done' || status === 'failed') && (
            <div className="pipeline-footer">
              {status === 'done' && (
                <button className="open-btn" onClick={onSessionReady}>
                  Abrir Dashboard →
                </button>
              )}
              <button className="retry-btn" onClick={() => setProcessing(false)}>
                ← Voltar
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Import screen ────────────────────────────────────────────────────────
  return (
    <div className="import-screen">
      <h1 className="import-logo">Kart <span>Telemetry</span></h1>

      <div className="import-cards">
        {/* Upload card */}
        <div className="import-card">
          <div className="import-card-title">
            <span><Upload size={12} style={{ marginRight: 6, verticalAlign: 'middle' }} />Upload de vídeo</span>
          </div>
          <div
            className={`drop-zone${dragOver ? ' drop-zone-over' : ''}${uploading ? ' drop-zone-uploading' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".mp4"
              multiple
              style={{ display: 'none' }}
              onChange={e => { uploadFiles([...e.target.files]); e.target.value = '' }}
            />
            <div className="drop-zone-icon">
              <Upload size={32} strokeWidth={1.5} />
            </div>
            <span className="drop-zone-hint">
              {uploading ? 'Enviando…' : 'Solte os arquivos aqui'}
            </span>
            {!uploading && <span className="drop-zone-sub">ou clique para selecionar • .mp4</span>}
          </div>
        </div>

        {/* Gallery card */}
        <div className="import-card">
          <div className="import-card-title">
            <span><Film size={12} style={{ marginRight: 6, verticalAlign: 'middle' }} />Galeria</span>
            <span className="gallery-count">{gallery.length} arquivo(s)</span>
          </div>

          {galleryError ? (
            <div className="gallery-empty">
              Servidor offline.<br />
              <span style={{ fontSize: 11, opacity: 0.6 }}>Execute npm run server</span>
            </div>
          ) : gallery.length === 0 ? (
            <div className="gallery-empty">
              Nenhum vídeo em input/<br />
              <span style={{ fontSize: 11, opacity: 0.6 }}>Faça upload ou copie arquivos .mp4 para a pasta</span>
            </div>
          ) : (
            <ul className="gallery-list">
              {gallery.map(f => (
                <li
                  key={f.name}
                  className={`gallery-item${selected.includes(f.name) ? ' gallery-item-selected' : ''}`}
                  onClick={() => toggleSelect(f.name)}
                >
                  <span className="gallery-check">
                    {selected.includes(f.name)
                      ? <CheckCircle2 size={15} />
                      : <Circle size={15} />}
                  </span>
                  <div className="gallery-info">
                    <span className="gallery-name">{f.name}</span>
                    <span className="gallery-size">{f.sizeLabel}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="import-actions">
        <button
          className="process-btn"
          disabled={selected.length === 0}
          onClick={runPipeline}
        >
          {selected.length === 0
            ? 'Selecione ao menos um vídeo'
            : `Processar ${selected.length} vídeo(s) →`}
        </button>
        <button className="view-last-btn" onClick={onSessionReady}>
          Ver última sessão →
        </button>
      </div>
    </div>
  )
}
