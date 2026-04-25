import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

const COLORS = ['#6BB5A6', '#F4A27A', '#A0B8E8', '#E87B5A', '#C9B8E8']

export default function SchoolEmotionChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
        <span className="text-2xl mb-1">📊</span>
        <p className="text-gray-400 text-xs">아직 수집된 감정 데이터가 없습니다.</p>
      </div>
    )
  }

  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <div>
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={45}
            outerRadius={75}
            paddingAngle={3}
            dataKey="value"
            animationDuration={600}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name, props) => [`${value}건`, `${props.payload.emoji} ${name}`]}
            contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', fontSize: 12 }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap justify-center gap-3 mt-2">
        {data.map((d, i) => (
          <span key={i} className="flex items-center gap-1 text-[11px] text-gray-600">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: COLORS[i % COLORS.length] }} />
            {d.emoji} {d.name} ({total ? Math.round(d.value / total * 100) : 0}%)
          </span>
        ))}
      </div>
    </div>
  )
}
