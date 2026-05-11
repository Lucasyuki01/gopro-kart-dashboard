# 🏎 GoPro Kart Dashboard

A full telemetry pipeline for go-kart sessions recorded with a GoPro Hero 10. Extracts GPS, accelerometer, and gyroscope data from onboard video, analyzes lap performance, and visualizes everything in an interactive dashboard.

🔗 **[Live Demo → gopro-kart-dashboard-dashboard.vercel.app](https://gopro-kart-dashboard-dashboard.vercel.app)**

---

## 🎯 Why I built this

After kart sessions, I had no way to objectively analyze what I was doing right or wrong. Using GoPro telemetry data, I built this pipeline to overlay my fastest and slowest laps on the same track map — comparing speed curves, braking points, and sector times side by side.

The insight was immediate: I could see exactly where my fastest laps differed from the slow ones, understand what worked, and replicate it in the next session.

---

## 🧠 How it works

```
GoPro MP4 files (with GPMF telemetry stream)
          ↓
    [Extractor]   →  GPS, accelerometer, gyroscope → telemetry.json
          ↓
    [Analyzer]    →  Lap detection, sector splits → session.json
          ↓
    [Dashboard]   →  Interactive React UI
```

**Extractor** — Reads the GPMF telemetry stream embedded in GoPro MP4 files. Supports merging multiple clips from the same session into one unified dataset.

**Analyzer** — Detects lap boundaries using GPS coordinates around a configurable start/finish line. Splits each lap into sectors and computes time deltas, speed, and G-forces.

**Dashboard** — React app with an interactive Leaflet map, speed comparison chart, and sector breakdown. Select any lap as reference and compare all others against it.

---

## ✨ Dashboard Features

- **Lap table** — all detected laps with time, max/avg speed, and G-force; click to select, toggle as reference lap
- **Track map** — Leaflet map with speed-colored overlay (green → red); shows full session or selected lap
- **Speed chart** — lap speed curve vs. the reference lap
- **Sector panel** — per-sector time deltas against the session's best sectors

---

## 🛠 Tech Stack

![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=flat-square&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)
![Leaflet](https://img.shields.io/badge/Leaflet-199900?style=flat-square&logo=leaflet&logoColor=white)

---

## 🚀 How to Run

**Requirements:** Node.js 18+ and GoPro Hero 10 footage with GPMF telemetry enabled.

```bash
git clone https://github.com/Lucasyuki01/gopro-kart-dashboard.git
cd gopro-kart-dashboard
npm install
```

**Step 1 — Extract telemetry from video:**

```bash
# Single file
npm run extract -- --file input/GX010249.MP4

# Multiple clips merged into one session
npm run extract -- --multi input/GX010249.MP4 input/GX020249.MP4 --name my_session
```

**Step 2 — Analyze the session:**

```bash
npm run analyze -- --file output/my_session.telemetry.json --start-lat -30.1234 --start-lng -50.5678
```

**Step 3 — Load into the dashboard:**

```bash
cp output/my_session.session.json packages/dashboard/public/session.json
npm run dashboard
# Open http://localhost:5173
```

---

## ⚙️ CLI Reference

**Extractor**

| Flag | Description |
|---|---|
| `-f, --file` | Single MP4 file |
| `-m, --multi` | Multiple MP4 files to merge |
| `--name` | Output filename |
| `--smooth` | GPS smoothing passes (default: 1) |
| `--streams` | GPMF streams to extract (default: GPS5, ACCL, GYRO) |

**Analyzer**

| Flag | Description |
|---|---|
| `-f, --file` | Input `.telemetry.json` |
| `--start-lat / --start-lng` | Start/finish line coordinates |
| `--start-radius` | Detection radius in meters (default: 15m) |
| `--min-lap` | Minimum valid lap time in seconds (default: 30s) |
| `--sectors` | Number of sectors per lap (default: 3) |

---

## 🗂 Project Structure

```
gopro-kart-dashboard/
├── packages/
│   ├── extractor/     # MP4 → telemetry.json (Node.js CLI)
│   ├── analyzer/      # telemetry.json → session.json (Node.js CLI)
│   └── dashboard/     # React/Vite visualization app
├── input/             # Source MP4 files (gitignored)
└── output/            # Generated JSON files (gitignored)
```

---

## 👨‍💻 Author

**Lucas Yuki Nishimoto**
[github.com/Lucasyuki01](https://github.com/Lucasyuki01) · [lucasnishimoto.dev](https://lucasnishimoto.dev)
