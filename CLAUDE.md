# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Does

A go-kart telemetry pipeline that extracts sensor data (GPS, accelerometer, gyroscope) from GoPro Hero 10 MP4 videos, analyzes it to detect laps and sector times, and visualizes results in a React dashboard with maps and speed charts.

## Repository Structure

npm workspaces monorepo with three packages:

- `packages/extractor` — Node.js CLI: GoPro MP4 → `.telemetry.json`
- `packages/analyzer` — Node.js CLI: `.telemetry.json` → `.session.json`
- `packages/dashboard` — React/Vite web app that loads `public/session.json` and renders the UI

Data flows in one direction: `input/*.mp4` → extractor → `output/*.telemetry.json` → analyzer → `output/*.session.json` → (copy to `public/session.json`) → dashboard.

## Commands

Run from repo root:

```bash
# Full pipeline
npm run extract -- --file input/GX010249.MP4
npm run extract -- --multi input/GX010249.MP4 input/GX020249.MP4 --name session_name
npm run analyze -- --file output/session_name.telemetry.json --start-lat -30.123 --start-lng -50.456
npm run dashboard   # starts Vite dev server
```

Dashboard-specific (from `packages/dashboard/`):

```bash
npm run build     # production build → dist/
npm run lint      # ESLint
npm run preview   # preview production build
```

### Extractor CLI flags

| Flag | Default | Description |
|------|---------|-------------|
| `-f, --file <path>` | — | Single MP4 |
| `-m, --multi <paths...>` | — | Multiple MP4s to merge |
| `-o, --output <path>` | `./output` | Output directory |
| `--name <name>` | — | Output filename stem |
| `--streams <list>` | `GPS5,ACCL,GYRO` | Comma-separated GPMF streams |
| `--smooth <n>` | `1` | GPS smoothing passes (0 = off) |

### Analyzer CLI flags

| Flag | Default | Description |
|------|---------|-------------|
| `-f, --file <path>` | — | Input `.telemetry.json` (required) |
| `--start-lat/--start-lng` | auto | Start line coordinates |
| `--start-radius <m>` | `15` | Lap crossing detection radius |
| `--min-lap <s>` | `30` | Minimum valid lap time |
| `--sectors <n>` | `3` | Sectors per lap |

## Architecture Details

### Extractor (`packages/extractor/src/index.js`)

- Uses `gpmf-extract` + `gopro-telemetry` to read GPMF metadata from MP4
- Adaptive chunk sizing by file size (5 MB for small files → 30 MB for >3 GB) to work around the mp4box 2 GB limit
- Multi-file mode merges telemetry arrays in chronological order and emits a single output
- Converts raw GPS speed from m/s to km/h before writing

### Analyzer (`packages/analyzer/src/index.js`)

- **Lap detection**: Haversine distance against a configurable start-line coordinate + radius; requires re-entry after leaving the zone to count a crossing
- **Sector breakdown**: divides each lap evenly into N sectors by time; tracks per-sector time, avg/max speed, and best-sector reference across all laps
- **Data smoothing**: moving average (window 5–15) applied to accelerometer channels to reduce vibration noise
- **Output**: streams JSON to file using manual serialization to avoid stack overflow on large datasets

### Dashboard (`packages/dashboard/src/`)

- Loads `/session.json` at startup (must be manually copied from `output/`)
- State managed with plain `useState`/`useEffect`; no external state library
- `LapTable` drives selection: clicking a lap sets `selectedLap`; toggling a lap sets `referenceLap`
- `TrackMap` (Leaflet) colors track points by speed (green → red gradient) and re-renders on lap selection
- `SpeedChart` (Recharts) overlays selected lap vs reference lap speed curves
- `SectorPanel` shows per-sector deltas against best sector across all laps
- Dark-theme CSS variables defined in `src/index.css`; layout in `src/styles/dashboard.css`

## Key Design Constraints

- **No TypeScript** — plain JavaScript throughout all three packages
- **Static dashboard** — `session.json` must be copied manually; there is no server or auto-reload from `output/`
- **Large file handling** — extractor streams MP4 files; avoid loading entire files into memory
