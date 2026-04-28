import { jsPDF } from 'jspdf'

const COLORS = {
  bg: [10, 10, 15],
  bg2: [17, 17, 24],
  bg3: [26, 26, 36],
  border: [42, 42, 58],
  text: [232, 232, 240],
  text2: [136, 136, 170],
  green: [0, 232, 122],
  red: [255, 68, 85],
  amber: [255, 170, 0],
  blue: [68, 136, 255],
}

function hex(rgb) {
  return `#${rgb.map(v => v.toString(16).padStart(2, '0')).join('')}`
}

function setFill(doc, rgb) { doc.setFillColor(...rgb) }
function setTextColor(doc, rgb) { doc.setTextColor(...rgb) }
function setDrawColor(doc, rgb) { doc.setDrawColor(...rgb) }

export function exportPdf(session) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210
  const margin = 14
  const contentW = W - margin * 2
  let y = 0

  // ── helpers ────────────────────────────────────────────────────────────────

  function rect(x, ry, w, h, color) {
    setFill(doc, color)
    doc.rect(x, ry, w, h, 'F')
  }

  function text(str, x, ty, { size = 10, color = COLORS.text, bold = false, align = 'left' } = {}) {
    doc.setFontSize(size)
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    setTextColor(doc, color)
    doc.text(String(str), x, ty, { align })
  }

  function divider(dy) {
    setDrawColor(doc, COLORS.border)
    doc.setLineWidth(0.2)
    doc.line(margin, dy, W - margin, dy)
  }

  function newPage() {
    doc.addPage()
    rect(0, 0, W, 297, COLORS.bg)
    y = margin
  }

  function checkPageBreak(needed = 8) {
    if (y + needed > 285) newPage()
  }

  // ── page 1 background ──────────────────────────────────────────────────────
  rect(0, 0, W, 297, COLORS.bg)

  // ── header bar ────────────────────────────────────────────────────────────
  rect(0, 0, W, 22, COLORS.bg3)
  rect(0, 0, 4, 22, COLORS.green)
  text('KART TELEMETRY', margin + 4, 9, { size: 14, bold: true, color: COLORS.text })
  text('REPORT', margin + 4, 16, { size: 8, color: COLORS.green })

  // session meta (top right)
  const { meta, summary } = session
  const date = meta.extractedAt
    ? new Date(meta.extractedAt).toLocaleDateString('en-US', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—'
  text(meta.camera, W - margin, 9, { size: 9, color: COLORS.text2, align: 'right' })
  text(date, W - margin, 16, { size: 9, color: COLORS.text2, align: 'right' })

  y = 30

  // ── summary cards ─────────────────────────────────────────────────────────
  const cards = [
    { label: 'BEST LAP', value: summary.bestLapTime, sub: `L${summary.bestLapNumber}`, color: COLORS.green },
    { label: 'TOTAL LAPS', value: summary.totalLaps, sub: 'laps', color: COLORS.blue },
    { label: 'MAX SPEED', value: `${summary.sessionMaxSpeedKmh} km/h`, sub: 'session peak', color: COLORS.red },
    { label: 'AVG SPEED', value: `${summary.sessionAvgSpeedKmh} km/h`, sub: 'during race', color: COLORS.text },
    { label: 'MAX G-FORCE', value: `${summary.sessionMaxGLateral} G`, sub: 'lateral', color: COLORS.amber },
  ]
  const cardW = contentW / cards.length
  cards.forEach((card, i) => {
    const cx = margin + i * cardW
    rect(cx, y, cardW - 2, 20, COLORS.bg2)
    text(card.label, cx + 4, y + 5, { size: 7, color: COLORS.text2 })
    text(card.value, cx + 4, y + 12, { size: 10, bold: true, color: card.color })
    text(card.sub, cx + 4, y + 17, { size: 7, color: COLORS.text2 })
  })

  y += 26
  divider(y)
  y += 6

  // ── lap times table ────────────────────────────────────────────────────────
  text('LAP TIMES', margin, y, { size: 9, bold: true, color: COLORS.text2 })
  y += 5

  const cols = [
    { label: '#', w: 12, align: 'left' },
    { label: 'Time', w: 26, align: 'left' },
    { label: 'Delta', w: 22, align: 'left' },
    { label: 'Max km/h', w: 24, align: 'right' },
    { label: 'Avg km/h', w: 24, align: 'right' },
    { label: 'Max G', w: 20, align: 'right' },
    { label: 'Dist (m)', w: 24, align: 'right' },
  ]

  // header row
  rect(margin, y, contentW, 6, COLORS.bg3)
  let cx = margin + 2
  cols.forEach(col => {
    const tx = col.align === 'right' ? cx + col.w - 2 : cx
    text(col.label, tx, y + 4, { size: 7, color: COLORS.text2, align: col.align })
    cx += col.w
  })
  y += 6

  const bestMs = summary.bestLapDurationMs
  session.laps.forEach(lap => {
    checkPageBreak(7)
    const isBest = lap.lapNumber === summary.bestLapNumber
    const rowColor = isBest ? [0, 232, 122, 0.08] : null
    if (isBest) rect(margin, y, contentW, 6, [20, 50, 35])

    const delta = lap.durationMs - bestMs
    const deltaStr = delta === 0 ? '—' : `+${(delta / 1000).toFixed(3)}s`

    const cells = [
      { v: `L${lap.lapNumber}`, color: isBest ? COLORS.green : COLORS.text },
      { v: lap.lapTime, color: isBest ? COLORS.green : COLORS.text },
      { v: deltaStr, color: delta === 0 ? COLORS.green : COLORS.text2 },
      { v: lap.maxSpeedKmh, color: COLORS.text },
      { v: lap.avgSpeedKmh, color: COLORS.text },
      { v: lap.maxGLateral, color: COLORS.text },
      { v: lap.distanceM, color: COLORS.text },
    ]

    cx = margin + 2
    cells.forEach((cell, i) => {
      const col = cols[i]
      const tx = col.align === 'right' ? cx + col.w - 2 : cx
      text(cell.v, tx, y + 4, { size: 8, color: cell.color, align: col.align })
      cx += col.w
    })

    setDrawColor(doc, COLORS.border)
    doc.setLineWidth(0.1)
    doc.line(margin, y + 6, W - margin, y + 6)
    y += 6
  })

  y += 8
  checkPageBreak(14)
  divider(y)
  y += 6

  // ── best sectors ──────────────────────────────────────────────────────────
  text('BEST SECTORS', margin, y, { size: 9, bold: true, color: COLORS.text2 })
  y += 5

  const sectorCols = [
    { label: 'Sector', w: 20 },
    { label: 'Best Time', w: 28 },
    { label: 'From Lap', w: 24 },
  ]

  rect(margin, y, 74, 6, COLORS.bg3)
  cx = margin + 2
  sectorCols.forEach(col => {
    text(col.label, cx, y + 4, { size: 7, color: COLORS.text2 })
    cx += col.w
  })
  y += 6

  summary.bestSectors.forEach(s => {
    checkPageBreak(7)
    const cells = [`S${s.sector}`, s.sectorTime ?? '—', s.fromLap ? `L${s.fromLap}` : '—']
    cx = margin + 2
    sectorCols.forEach((col, i) => {
      text(cells[i], cx, y + 4, { size: 8, color: i === 0 ? COLORS.text : COLORS.text })
      cx += col.w
    })
    setDrawColor(doc, COLORS.border)
    doc.setLineWidth(0.1)
    doc.line(margin, y + 6, margin + 72, y + 6)
    y += 6
  })

  // ── footer ────────────────────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    rect(0, 287, W, 10, COLORS.bg3)
    text('Kart Telemetry Dashboard', margin, 293, { size: 7, color: COLORS.text2 })
    text(`Page ${p} / ${totalPages}`, W - margin, 293, { size: 7, color: COLORS.text2, align: 'right' })
  }

  const filename = `kart-session-${new Date(meta.extractedAt ?? Date.now()).toISOString().slice(0, 10)}.pdf`
  doc.save(filename)
}
