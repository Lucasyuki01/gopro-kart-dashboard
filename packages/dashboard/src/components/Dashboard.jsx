import { useState, useEffect } from 'react'
import SessionHeader from './SessionHeader'
import LapTable from './LapTable'
import SectorPanel from './SectorPanel'
import SpeedChart from './SpeedChart'
import TrackMap from './TrackMap'
import StatsBar from './StatsBar'
import LapTimesChart from './LapTimesChart'
import HelpModal from './HelpModal'
import '../styles/dashboard.css'

export default function Dashboard({ onBack }) {
  const [session, setSession] = useState(null)
  const [selectedLap, setSelectedLap] = useState(null)
  const [referenceLap, setReferenceLap] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/session.json')
      .then(r => {
        if (!r.ok) throw new Error('session.json file not found in public/')
        return r.json()
      })
      .then(data => {
        setSession(data)
        setSelectedLap(data.laps[0])
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  if (loading) return (
    <div className="loading-screen">
      <div className="loading-spinner" />
      <p>Loading telemetry...</p>
    </div>
  )

  if (error) return (
    <div className="error-screen">
      <h2>Error loading session</h2>
      <p>{error}</p>
      <code>Copy session.json to packages/dashboard/public/session.json</code>
    </div>
  )

  return (
    <div className="dashboard">
      <HelpModal />
      <SessionHeader session={session} onBack={onBack} />
      <StatsBar summary={session.summary} />
      <div className="dashboard-grid">
        <div className="col-left">
          <LapTable
            laps={session.laps}
            bestLapNumber={session.summary.bestLapNumber}
            selectedLap={selectedLap}
            referenceLap={referenceLap}
            onSelectLap={setSelectedLap}
            onSetReference={lap => setReferenceLap(prev =>
              prev?.lapNumber === lap.lapNumber ? null : lap
            )}
          />
        </div>
        <div className="col-right">
          <TrackMap
            fullTrack={session.fullTrack}
            selectedLap={selectedLap}
            referenceLap={referenceLap}
          />
          <LapTimesChart
            laps={session.laps}
            bestLapNumber={session.summary.bestLapNumber}
            selectedLap={selectedLap}
            onSelectLap={setSelectedLap}
          />
          <SpeedChart lap={selectedLap} referenceLap={referenceLap} />
          <SectorPanel
            lap={selectedLap}
            bestSectors={session.summary.bestSectors}
          />
        </div>
      </div>
    </div>
  )
}
