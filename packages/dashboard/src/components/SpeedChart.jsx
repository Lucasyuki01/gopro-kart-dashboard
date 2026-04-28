import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts'

export default function SpeedChart({ lap, referenceLap }) {
  if (!lap) return null

  const lapData = lap.trackPoints
    .filter(p => p.speedKmh != null)
    .map((p, i) => ({ i, speed: parseFloat(p.speedKmh.toFixed(1)) }))

  const refData = referenceLap?.trackPoints
    ?.filter(p => p.speedKmh != null)
    .map((p, i) => ({ i, ref: parseFloat(p.speedKmh.toFixed(1)) }))

  // Merge das duas séries pelo índice
  const maxLen = Math.max(lapData.length, refData?.length ?? 0)
  const data = Array.from({ length: maxLen }, (_, i) => ({
    i,
    speed: lapData[i]?.speed ?? null,
    ref: refData?.[i]?.ref ?? null,
  }))

  const title = referenceLap
    ? `Velocidade — V${lap.lapNumber} vs V${referenceLap.lapNumber}`
    : `Velocidade — V${lap.lapNumber}`

  return (
    <div className="panel">
      <div className="panel-title">{title}</div>
      <div className="chart-wrapper">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
            <XAxis dataKey="i" hide />
            <YAxis
              domain={['auto', 'auto']}
              tick={{ fill: '#8888aa', fontSize: 11, fontFamily: 'Share Tech Mono' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                background: '#1a1a24',
                border: '1px solid #2a2a3a',
                borderRadius: 6,
                fontFamily: 'Share Tech Mono',
                fontSize: 12,
                color: '#e8e8f0',
              }}
              formatter={(v, name) => [
                `${v} km/h`,
                name === 'speed' ? `V${lap.lapNumber}` : `V${referenceLap?.lapNumber} (ref)`
              ]}
              labelFormatter={() => ''}
            />
            {referenceLap && (
              <Line
                type="monotone"
                dataKey="ref"
                stroke="#4488ff"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#4488ff' }}
                strokeDasharray="5 3"
              />
            )}
            <Line
              type="monotone"
              dataKey="speed"
              stroke="#00e87a"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#00e87a' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}