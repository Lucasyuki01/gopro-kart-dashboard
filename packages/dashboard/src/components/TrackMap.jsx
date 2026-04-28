import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

function speedToColor(speed, minSpeed, maxSpeed) {
  const t = Math.max(0, Math.min(1, (speed - minSpeed) / (maxSpeed - minSpeed)))
  if (t < 0.5) {
    const r = Math.round(255 * (t * 2))
    return `rgb(${r}, 255, 0)`
  } else {
    const g = Math.round(255 * (1 - (t - 0.5) * 2))
    return `rgb(255, ${g}, 0)`
  }
}

export default function TrackMap({ fullTrack, selectedLap }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const layersRef = useRef([])

  useEffect(() => {
    if (mapInstanceRef.current) return
    if (!mapRef.current) return

    mapInstanceRef.current = L.map(mapRef.current, {
      zoomControl: true,
      attributionControl: false,
    })

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(mapInstanceRef.current)
  }, [])

  useEffect(() => {
    if (!mapInstanceRef.current || !fullTrack?.length) return

    // Remove previous layers
    layersRef.current.forEach(l => l.remove())
    layersRef.current = []

    const track = selectedLap?.trackPoints ?? fullTrack
    const speeds = track.map(p => p.speedKmh ?? 0)
    const minSpeed = Math.min(...speeds)
    const maxSpeed = Math.max(...speeds)

    // Draw speed-colored segments
    for (let i = 1; i < track.length; i++) {
      const a = track[i - 1]
      const b = track[i]
      if (a.lat == null || b.lat == null) continue

      const color = speedToColor(a.speedKmh ?? 0, minSpeed, maxSpeed)
      const line = L.polyline(
        [[a.lat, a.lng], [b.lat, b.lng]],
        { color, weight: 4, opacity: 0.9 }
      ).addTo(mapInstanceRef.current)

      layersRef.current.push(line)
    }

    // Mark start point
    if (track.length > 0) {
      const start = track[0]
      const marker = L.circleMarker([start.lat, start.lng], {
        radius: 8,
        color: '#00e87a',
        fillColor: '#00e87a',
        fillOpacity: 1,
        weight: 2,
      }).bindTooltip('Start', { permanent: false }).addTo(mapInstanceRef.current)
      layersRef.current.push(marker)
    }

    // Fit map to track bounds
    const bounds = L.latLngBounds(
      track.filter(p => p.lat != null).map(p => [p.lat, p.lng])
    )
    mapInstanceRef.current.fitBounds(bounds, { padding: [24, 24] })
  }, [fullTrack, selectedLap])

  return (
    <div className="panel">
      <div className="panel-title">
        Map — {selectedLap ? `L${selectedLap.lapNumber}` : 'Full track'}
        <span style={{ marginLeft: 12, fontSize: 10, color: 'var(--text2)' }}>
          🟢 slow → 🔴 fast
        </span>
      </div>
      <div className="map-wrapper" ref={mapRef} />
    </div>
  )
}
