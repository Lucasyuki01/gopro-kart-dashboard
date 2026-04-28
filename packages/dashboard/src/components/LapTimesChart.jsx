import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Dot
} from 'recharts'

function formatMs(ms) {
  const totalSeconds = ms / 1000
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = (totalSeconds % 60).toFixed(3).padStart(6, '0')
  return `${minutes}:${seconds}`
}

function CustomDot({ cx, cy, payload, selectedLapNumber, bestLapNumber }) {
  const isBest = payload.lapNumber === bestLapNumber
  const isSelected = payload.lapNumber === selectedLapNumber
  const r = isSelected ? 6 : 4
  const fill = isBest ? '#00e87a' : isSelected ? '#4488ff' : '#8888aa'
  const stroke = isSelected ? '#ffffff44' : 'none'
  return <circle cx={cx} cy={cy} r={r} fill={fill} stroke={stroke} strokeWidth={isSelected ? 6 : 0} />
}

export default function LapTimesChart({ laps, bestLapNumber, selectedLap, onSelectLap }) {
  if (!laps?.length) return null

  const data = laps.map(l => ({
    lapNumber: l.lapNumber,
    label: `L${l.lapNumber}`,
    durationMs: l.durationMs,
    lapTime: l.lapTime,
  }))

  const bestMs = Math.min(...laps.map(l => l.durationMs))
  const worstMs = Math.max(...laps.map(l => l.durationMs))
  const padding = (worstMs - bestMs) * 0.15 || 1000
  const domainMin = Math.max(0, bestMs - padding)
  const domainMax = worstMs + padding

  const tickFormatter = ms => {
    const totalSeconds = ms / 1000
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = (totalSeconds % 60).toFixed(1).padStart(4, '0')
    return `${minutes}:${seconds}`
  }

  return (
    <div className="panel">
      <div className="panel-title">Lap Times</div>
      <div className="chart-wrapper">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
            onClick={e => {
              const lap = laps.find(l => l.lapNumber === e?.activePayload?.[0]?.payload?.lapNumber)
              if (lap) onSelectLap(lap)
            }}
            style={{ cursor: 'pointer' }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
            <XAxis
              dataKey="label"
              tick={{ fill: '#8888aa', fontSize: 11, fontFamily: 'Share Tech Mono' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[domainMin, domainMax]}
              tickFormatter={tickFormatter}
              tick={{ fill: '#8888aa', fontSize: 11, fontFamily: 'Share Tech Mono' }}
              tickLine={false}
              axisLine={false}
              width={52}
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
              formatter={(value, _, props) => [props.payload.lapTime, props.payload.label]}
              labelFormatter={() => ''}
            />
            <ReferenceLine
              y={bestMs}
              stroke="#00e87a44"
              strokeDasharray="4 3"
              label={{ value: 'BEST', fill: '#00e87a88', fontSize: 9, fontFamily: 'Share Tech Mono', position: 'insideTopRight' }}
            />
            <Line
              type="monotone"
              dataKey="durationMs"
              stroke="#4488ff"
              strokeWidth={2}
              dot={props => (
                <CustomDot
                  key={props.index}
                  {...props}
                  selectedLapNumber={selectedLap?.lapNumber}
                  bestLapNumber={bestLapNumber}
                />
              )}
              activeDot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
