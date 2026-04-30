import { useState } from 'react'

export default function HelpModal() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button className="help-btn" onClick={() => setOpen(true)}>Help</button>

      {open && (
        <div className="help-overlay" onClick={() => setOpen(false)}>
          <div className="help-modal" onClick={e => e.stopPropagation()}>
            <div className="help-header">
              <div>
                <h2 className="help-title">Kart <span>Telemetry</span></h2>
                <p className="help-subtitle">GoPro Hero 10 · telemetry pipeline & dashboard</p>
              </div>
              <button className="help-close" onClick={() => setOpen(false)}>✕</button>
            </div>

            <div className="help-body">
              <section className="help-section">
                <h3 className="help-section-title">What it does</h3>
                <p className="help-text">
                  Extracts GPS, accelerometer and gyroscope data from GoPro MP4 files,
                  detects laps via start-line proximity, breaks each lap into sectors,
                  and visualizes everything in this dashboard.
                </p>
              </section>

              <section className="help-section">
                <h3 className="help-section-title">Features</h3>
                <ul className="help-list">
                  <li>GPS track map colored by speed (green → red heatmap)</li>
                  <li>Automatic lap detection with configurable start-line radius</li>
                  <li>Sector analysis with delta vs. best sector across all laps</li>
                  <li>Speed chart with lap-over-lap comparison</li>
                  <li>PDF report export</li>
                </ul>
              </section>

              <section className="help-section">
                <h3 className="help-section-title">Using the dashboard</h3>
                <ul className="help-list">
                  <li>Click a lap row → select it for map &amp; speed chart</li>
                  <li>Click ⊞ on any lap → set as reference for comparison overlay</li>
                  <li>Sector deltas shown in green (faster) or red (slower) vs. best</li>
                </ul>
              </section>

              <section className="help-section">
                <h3 className="help-section-title">Pipeline (run locally)</h3>
                <div className="help-code-block">
                  <code>npm run extract -- --file input/video.MP4</code>
                  <code>npm run analyze -- --file output/session.telemetry.json \</code>
                  <code className="help-code-indent">--start-lat -30.123 --start-lng -50.456</code>
                </div>
              </section>
            </div>

            <div className="help-footer">
              <a
                className="help-github-btn"
                href="https://github.com/Lucasyuki01/gopro-kart-dashboard"
                target="_blank"
                rel="noreferrer"
              >
                View on GitHub →
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
