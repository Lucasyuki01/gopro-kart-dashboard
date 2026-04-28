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

function drawSpeedTrack(map, track, layers, weight = 4, opacity = 0.9) {
  const speeds = track.map(p => p.speedKmh ?? 0)
  const minSpeed = Math.min(...speeds)
  const maxSpeed = Math.max(...speeds)

  for (let i = 1; i < track.length; i++) {
    const a = track[i - 1]
    const b = track[i]
    if (a.lat == null || b.lat == null) continue

    const color = speedToColor(a.speedKmh ?? 0, minSpeed, maxSpeed)
    const line = L.polyline(
      [[a.lat, a.lng], [b.lat, b.lng]],
      { color, weight, opacity }
    ).addTo(map)
    layers.push(line)
  }
}

function drawSolidTrack(map, track, layers, color, weight = 3, opacity = 0.7) {
  const coords = track
    .filter(p => p.lat != null)
    .map(p => [p.lat, p.lng])
  if (coords.length < 2) return
  const line = L.polyline(coords, { color, weight, opacity, dashArray: '6 4' }).addTo(map)
  layers.push(line)
}

export default function TrackMap({ fullTrack, selectedLap, referenceLap }) {
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

    const comparing = !!(selectedLap && referenceLap)
    const primaryTrack = selectedLap?.trackPoints ?? fullTrack

    if (comparing) {
      // Reference lap: dashed blue, drawn first (below)
      drawSolidTrack(mapInstanceRef.current, referenceLap.trackPoints, layersRef.current, '#4488ff', 3, 0.75)

      // Selected lap: speed-colored on top, slightly thinner so both are visible
      drawSpeedTrack(mapInstanceRef.current, primaryTrack, layersRef.current, 3, 0.95)
    } else {
      drawSpeedTrack(mapInstanceRef.current, primaryTrack, layersRef.current, 4, 0.9)
    }

    // Mark start point
    if (primaryTrack.length > 0) {
      const start = primaryTrack[0]
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
    const allPoints = [
      ...primaryTrack,
      ...(comparing ? referenceLap.trackPoints : []),
    ].filter(p => p.lat != null)

    const bounds = L.latLngBounds(allPoints.map(p => [p.lat, p.lng]))
    mapInstanceRef.current.fitBounds(bounds, { padding: [24, 24] })
  }, [fullTrack, selectedLap, referenceLap])

  const comparing = !!(selectedLap && referenceLap)

  let title = selectedLap ? `L${selectedLap.lapNumber}` : 'Full track'
  if (comparing) title = `L${selectedLap.lapNumber} vs L${referenceLap.lapNumber}`

  return (
    <div className="panel">
      <div className="panel-title">
        Map — {title}
        <span style={{ marginLeft: 12, fontSize: 10, color: 'var(--text2)' }}>
          {comparing
            ? <><span style={{ color: '#00e87a' }}>━</span> L{selectedLap.lapNumber} &nbsp;<span style={{ color: '#4488ff' }}>╌</span> L{referenceLap.lapNumber}</>
            : '🟢 slow → 🔴 fast'
          }
        </span>
      </div>
      <div className="map-wrapper" ref={mapRef} />
    </div>
  )
}
