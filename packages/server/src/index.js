import express from 'express'
import multer from 'multer'
import { readdirSync, existsSync, statSync, mkdirSync } from 'fs'
import { resolve, join, extname } from 'path'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT = resolve(__dirname, '../../..')
const INPUT_DIR = join(ROOT, 'input')
const PIPELINE = join(ROOT, 'pipeline.js')

mkdirSync(INPUT_DIR, { recursive: true })

const app = express()
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.sendStatus(200)
  next()
})
app.use(express.json())

const storage = multer.diskStorage({
  destination: INPUT_DIR,
  filename: (_, file, cb) => cb(null, file.originalname),
})
const upload = multer({
  storage,
  fileFilter: (_, file, cb) => {
    cb(null, extname(file.originalname).toLowerCase() === '.mp4')
  },
})

function formatBytes(bytes) {
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

// List MP4 files in input/, newest first
app.get('/api/gallery', (req, res) => {
  if (!existsSync(INPUT_DIR)) return res.json([])
  const files = readdirSync(INPUT_DIR)
    .filter(f => extname(f).toLowerCase() === '.mp4')
    .map(name => {
      const stat = statSync(join(INPUT_DIR, name))
      return { name, size: stat.size, sizeLabel: formatBytes(stat.size), mtime: stat.mtime }
    })
    .sort((a, b) => new Date(b.mtime) - new Date(a.mtime))
  res.json(files)
})

// Save uploaded MP4s to input/
app.post('/api/upload', upload.array('videos'), (req, res) => {
  if (!req.files?.length) {
    return res.status(400).json({ error: 'No MP4 files received' })
  }
  res.json({ uploaded: req.files.map(f => f.originalname) })
})

// Run the pipeline and stream logs back via Server-Sent Events
app.post('/api/pipeline', (req, res) => {
  const { files, startLat, startLng } = req.body ?? {}

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  const send = data => res.write(`data: ${JSON.stringify(data)}\n\n`)

  const args = [PIPELINE]
  if (files?.length === 1) {
    args.push('--file', join(INPUT_DIR, files[0]))
  } else if (files?.length > 1) {
    args.push('--multi', ...files.map(f => join(INPUT_DIR, f)))
  }
  if (startLat) args.push('--start-lat', String(startLat))
  if (startLng) args.push('--start-lng', String(startLng))

  const proc = spawn(process.execPath, args, { cwd: ROOT })

  const emit = chunk => {
    chunk.toString().split('\n').filter(Boolean).forEach(line => send({ type: 'log', msg: line }))
  }

  proc.stdout.on('data', emit)
  proc.stderr.on('data', emit)

  proc.on('error', err => {
    send({ type: 'log', msg: `[server] spawn error: ${err.message}` })
    send({ type: 'failed' })
    res.end()
  })

  proc.on('close', code => {
    send({ type: code === 0 ? 'done' : 'failed', code })
    res.end()
  })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`[server] http://localhost:${PORT}`))
