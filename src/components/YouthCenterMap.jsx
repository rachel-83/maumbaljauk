import { useEffect, useState, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

const myIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
})
const centerIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-violet.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
})
const selectedIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [30, 49], iconAnchor: [15, 49], popupAnchor: [1, -40], shadowSize: [41, 41],
})

const DEFAULT_POS = { lat: 37.5665, lng: 126.9780 }

function parseCSVLine(line) {
  const result = []
  let cur = '', inQuote = false
  for (const ch of line) {
    if (ch === '"') { inQuote = !inQuote }
    else if (ch === ',' && !inQuote) { result.push(cur.trim()); cur = '' }
    else cur += ch
  }
  result.push(cur.trim())
  return result
}

function distKm(a, b) {
  const R = 6371
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLng = (b.lng - a.lng) * Math.PI / 180
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

function FlyTo({ target }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], 14, { duration: 0.8 })
  }, [target])
  return null
}

// 상세 바텀시트
function DetailSheet({ place, onClose, userPos }) {
  const dist = userPos && place ? distKm(userPos, place) : null
  if (!place) return null
  const naverUrl = `https://map.naver.com/v5/search/${encodeURIComponent(place.name)}`

  return (
    <div className="fixed inset-0 z-[9999] flex items-end" style={{ paddingBottom: 80 }} onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative w-full bg-white rounded-t-3xl shadow-2xl flex flex-col"
        style={{ maxHeight: 'calc(60vh - 80px)', maxWidth: 420, margin: '0 auto', width: '100%' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex-shrink-0 pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto" />
        </div>
        <div className="flex-shrink-0 flex items-start justify-between px-5 py-3 border-b border-gray-100">
          <div className="flex-1 pr-3">
            <div className="flex items-center gap-2">
              <span className="text-base">💬</span>
              <h3 className="text-sm font-bold text-gray-800 leading-tight">{place.name}</h3>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[11px] text-purple-600 font-semibold bg-purple-50 px-2 py-0.5 rounded-full">{place.sido} {place.sigungu}</span>
              {dist !== null && (
                <span className="text-[11px] text-gray-500">
                  약 {dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)}km`}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 text-xs">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
          {place.addr && (
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-2xl">
              <span className="text-sm mt-0.5 flex-shrink-0">📍</span>
              <div className="min-w-0">
                <p className="text-[11px] text-gray-400 mb-0.5">주소</p>
                <p className="text-xs text-gray-700 leading-relaxed">{place.addr}</p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl">
            <span className="text-sm flex-shrink-0">📞</span>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-gray-400 mb-0.5">전화번호</p>
              <p className="text-xs text-gray-700">{place.tel || '정보 없음'}</p>
            </div>
            {place.tel && (
              <a href={`tel:${place.tel}`} className="flex-shrink-0 text-xs font-bold text-white bg-purple-500 px-3 py-1.5 rounded-xl">전화</a>
            )}
          </div>
          {place.homepage && (
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl">
              <span className="text-sm flex-shrink-0">🌐</span>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-gray-400 mb-0.5">홈페이지</p>
                <a href={place.homepage} target="_blank" rel="noreferrer" className="text-xs text-blue-500 truncate block">{place.homepage}</a>
              </div>
            </div>
          )}
        </div>

        <div className="flex-shrink-0 px-5 pt-2 pb-5 border-t border-gray-100">
          <a href={naverUrl} target="_blank" rel="noreferrer"
            className="flex items-center justify-center gap-1.5 py-3 bg-purple-500 text-white rounded-2xl text-sm font-bold w-full">
            🗺️ 네이버 지도로 보기
          </a>
        </div>
      </div>
    </div>
  )
}

export default function YouthCenterMap() {
  const [centers, setCenters] = useState([])
  const [userPos, setUserPos] = useState(null)
  const [locLoading, setLocLoading] = useState(true)
  const [dataLoading, setDataLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [viewMode, setViewMode] = useState('map')
  const [selected, setSelected] = useState(null)
  const [flyTarget, setFlyTarget] = useState(null)

  useEffect(() => {
    if (!navigator.geolocation) { setUserPos(DEFAULT_POS); setLocLoading(false); return }
    navigator.geolocation.getCurrentPosition(
      pos => { setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocLoading(false) },
      () => { setUserPos(DEFAULT_POS); setLocLoading(false) },
      { timeout: 8000 }
    )
  }, [])

  useEffect(() => {
    async function loadCSV() {
      try {
        const res = await fetch('/youth_centers.csv')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const buf = await res.arrayBuffer()
        const text = new TextDecoder('euc-kr').decode(buf)
        const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
        const result = []
        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue
          const cols = parseCSVLine(lines[i])
          const name     = cols[0]
          const sido     = cols[1]
          const sigungu  = cols[2]
          const addr     = [cols[4], cols[5]].filter(Boolean).join(' ').replace(/"/g, '').trim()
          const lat      = parseFloat(cols[6])
          const lng      = parseFloat(cols[7])
          const tel      = cols[8]
          const homepage = cols[10]
          if (!name || isNaN(lat) || isNaN(lng)) continue
          if (lat < 33 || lat > 39 || lng < 124 || lng > 132) continue
          result.push({ name, sido, sigungu, addr, lat, lng, tel, homepage })
        }
        setCenters(result)
      } catch (e) {
        console.error('youth centers CSV error:', e)
        setError('load')
      } finally {
        setDataLoading(false)
      }
    }
    loadCSV()
  }, [])

  const filtered = query.trim().length === 0
    ? centers
    : centers.filter(c => {
        const q = query.trim().toLowerCase()
        return c.name.toLowerCase().includes(q) ||
               c.sido.toLowerCase().includes(q) ||
               c.sigungu.toLowerCase().includes(q) ||
               c.addr.toLowerCase().includes(q)
      })

  const sorted = userPos
    ? [...filtered].sort((a, b) => distKm(userPos, a) - distKm(userPos, b))
    : filtered

  const handleSelect = useCallback((c) => {
    setSelected(c)
    setFlyTarget(c)
    if (viewMode === 'list') setViewMode('map')
  }, [viewMode])

  const center = userPos ?? DEFAULT_POS
  const isLoading = locLoading || dataLoading

  return (
    <div className="mt-5 bg-white rounded-3xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl">💬</span>
        <p className="text-sm font-bold text-gray-800">청소년상담복지센터</p>
        {!isLoading && <span className="text-[10px] text-gray-400 ml-auto">전국 {centers.length}개소</span>}
      </div>
      <p className="text-xs text-gray-500 mb-3">내 주변 청소년상담복지센터를 찾아볼 수 있어</p>

      {!isLoading && !error && (
        <div className="flex items-center gap-2 bg-gray-100 rounded-2xl px-3 py-2 mb-3">
          <span className="text-sm text-gray-400">🔍</span>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="지역·센터명 검색 (예: 서울, 강남구)"
            className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none"
          />
          {query && <button onClick={() => setQuery('')} className="text-gray-400 text-xs px-1">✕</button>}
        </div>
      )}

      {!isLoading && !error && (
        <div className="flex bg-gray-100 rounded-xl p-0.5 mb-3">
          {[{ key: 'map', label: '🗺️ 지도' }, { key: 'list', label: '📋 목록' }].map(t => (
            <button key={t.key} onClick={() => setViewMode(t.key)}
              className={`flex-1 py-1.5 rounded-xl text-xs font-semibold transition-all ${viewMode === t.key ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400'}`}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {isLoading && (
        <div className="h-64 flex flex-col items-center justify-center gap-2 bg-gray-50 rounded-2xl">
          <span className="text-2xl animate-bounce">💬</span>
          <p className="text-xs text-gray-400 animate-pulse">
            {locLoading ? '내 위치를 확인하고 있어...' : '센터 정보를 불러오고 있어...'}
          </p>
        </div>
      )}

      {!isLoading && error && (
        <div className="bg-gray-50 rounded-2xl px-4 py-6 text-center">
          <p className="text-2xl mb-2">😢</p>
          <p className="text-xs text-gray-500">센터 정보를 불러오지 못했어. 잠시 후 다시 시도해봐!</p>
        </div>
      )}

      {!isLoading && !error && viewMode === 'map' && (
        <>
          <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm" style={{ height: 320 }}>
            <MapContainer center={[center.lat, center.lng]} zoom={12} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FlyTo target={flyTarget} />
              {userPos && (
                <Marker position={[userPos.lat, userPos.lng]} icon={myIcon} />
              )}
              {sorted.map((c, i) => (
                <Marker
                  key={i}
                  position={[c.lat, c.lng]}
                  icon={selected?.name === c.name && selected?.lat === c.lat ? selectedIcon : centerIcon}
                  eventHandlers={{ click: () => setSelected(c) }}
                />
              ))}
            </MapContainer>
          </div>
          <div className="flex items-center gap-4 mt-2 px-1">
            <div className="flex items-center gap-1">
              <span className="text-blue-500 text-sm">●</span>
              <span className="text-[10px] text-gray-500">내 위치</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-purple-500 text-sm">●</span>
              <span className="text-[10px] text-gray-500">상담복지센터</span>
            </div>
            <span className="text-[10px] text-gray-400 ml-auto">
              {query ? `${sorted.length}개 검색됨` : `총 ${sorted.length}개소`}
            </span>
          </div>
          {selected && (
            <div
              className="mt-3 bg-purple-50 rounded-2xl p-3 flex items-center gap-3 cursor-pointer"
              onClick={() => setSelected(selected)}
            >
              <span className="text-lg">💬</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-800 truncate">{selected.name}</p>
                <p className="text-[11px] text-gray-500">{selected.sido} {selected.sigungu} · {selected.tel}</p>
              </div>
              <button
                onClick={e => { e.stopPropagation(); setSelected(selected) }}
                className="text-xs text-purple-600 font-bold bg-purple-100 px-2 py-1 rounded-xl"
              >
                상세
              </button>
            </div>
          )}
        </>
      )}

      {!isLoading && !error && viewMode === 'list' && (
        <div>
          <p className="text-[11px] text-gray-400 mb-2 px-1">
            {userPos ? '가까운 순' : '전체'} · {sorted.length}개소
          </p>
          {sorted.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8">'{query}' 검색 결과가 없어요.</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {sorted.map((c, i) => {
                const dist = userPos ? distKm(userPos, c) : null
                return (
                  <button key={i} onClick={() => handleSelect(c)}
                    className="w-full text-left flex items-center gap-3 p-3 bg-gray-50 hover:bg-purple-50 rounded-2xl transition-colors">
                    <span className="text-xl flex-shrink-0">💬</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{c.name}</p>
                      <p className="text-[11px] text-gray-500 truncate mt-0.5">{c.sido} {c.sigungu}</p>
                    </div>
                    {dist !== null && (
                      <span className="flex-shrink-0 text-[11px] text-purple-600 font-semibold">
                        {dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)}km`}
                      </span>
                    )}
                    <span className="flex-shrink-0 text-gray-300 text-sm">›</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {selected && viewMode === 'map' && (
        <DetailSheet
          place={selected}
          onClose={() => setSelected(null)}
          userPos={userPos}
        />
      )}
    </div>
  )
}
