# GoPro Kart Dashboard

A telemetry pipeline for go-kart sessions recorded with a GoPro Hero 10. Extracts GPS, accelerometer, and gyroscope data from onboard video files, analyzes it to detect laps and sector performance, and visualizes everything in an interactive React dashboard.

## Pipeline Overview

```
GoPro MP4 files
      │
      ▼
  [extractor]  →  output/*.telemetry.json
      │
      ▼
  [analyzer]   →  output/*.session.json
      │
      ▼  (copy to packages/dashboard/public/session.json)
  [dashboard]  →  browser UI
```

## Requirements

- Node.js 18+
- GoPro Hero 10 footage (GPMF telemetry stream required)

## Usage

### 1. Install dependencies

```bash
npm install
```

### 2. Extract telemetry from video

Place your MP4 files in the `input/` folder, then run:

```bash
# Single file
npm run extract -- --file input/GX010249.MP4

# Multiple files (merged into one session)
npm run extract -- --multi input/GX010249.MP4 input/GX020249.MP4 input/GX030249.MP4 --name my_session
```

Output: `output/my_session.telemetry.json`

### 3. Analyze the session

```bash
npm run analyze -- --file output/my_session.telemetry.json --start-lat -30.1234 --start-lng -50.5678
```

If `--start-lat`/`--start-lng` are omitted, the first GPS point is used as the start line.

Output: `output/my_session.session.json`

### 4. Load into the dashboard

```bash
cp output/my_session.session.json packages/dashboard/public/session.json
npm run dashboard
```

Open `http://localhost:5173` in your browser.

## CLI Reference

### Extractor

| Flag | Default | Description |
|------|---------|-------------|
| `-f, --file <path>` | — | Single MP4 file |
| `-m, --multi <paths...>` | — | Multiple MP4 files to merge |
| `-o, --output <path>` | `./output` | Output directory |
| `--name <name>` | — | Output filename (no extension) |
| `--streams <list>` | `GPS5,ACCL,GYRO` | GPMF streams to extract |
| `--smooth <n>` | `1` | GPS smoothing passes (0 = disabled) |

### Analyzer

| Flag | Default | Description |
|------|---------|-------------|
| `-f, --file <path>` | — | Input `.telemetry.json` (required) |
| `-o, --output <path>` | `./output` | Output directory |
| `--start-lat <lat>` | auto | Start/finish line latitude |
| `--start-lng <lng>` | auto | Start/finish line longitude |
| `--start-radius <m>` | `15` | Detection radius around start line (meters) |
| `--min-lap <s>` | `30` | Minimum valid lap time (seconds) |
| `--sectors <n>` | `3` | Number of sectors per lap |

## Dashboard Features

- **Lap table** — all detected laps with time, max/avg speed, and G-force; click to select, toggle to set reference
- **Track map** — Leaflet map with speed-colored track overlay (green → red); shows full session or selected lap
- **Speed chart** — lap speed curve compared against the reference lap
- **Sector panel** — per-sector breakdown with time deltas against the session's best sectors

## Project Structure

```
├── packages/
│   ├── extractor/     # MP4 → telemetry.json (Node.js CLI)
│   ├── analyzer/      # telemetry.json → session.json (Node.js CLI)
│   └── dashboard/     # React/Vite visualization app
├── input/             # Source MP4 files (gitignored)
└── output/            # Generated JSON files (gitignored)
```
