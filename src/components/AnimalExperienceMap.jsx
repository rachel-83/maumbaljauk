import { useEffect, useState, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import proj4 from 'proj4'
import 'leaflet/dist/leaflet.css'

// Leaflet 기본 마커 이미지 깨짐 수정
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// EPSG:5174 정의 (Korea 1985 Central Belt)
proj4.defs(
  'EPSG:5174',
  '+proj=tmerc +lat_0=38 +lon_0=127.0028902777778 +k=1 +x_0=200000 +y_0=500000 +ellps=bessel +towgs84=-146.43,507.89,681.46 +units=m +no_defs'
)

// 마커 아이콘
const myIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
})
const placeIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
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

// 지도 이동 컴포넌트
function FlyTo({ target }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], 15, { duration: 0.8 })
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
      {/* 딤 배경 */}
      <div className="absolute inset-0 bg-black/30" />

      {/* 시트 본체 */}
      <div
        className="relative w-full bg-white rounded-t-3xl shadow-2xl flex flex-col"
        style={{ maxHeight: 'calc(55vh - 80px)', maxWidth: 420, margin: '0 auto', width: '100%' }}
        onClick={e => e.stopPropagation()}
      >
        {/* 핸들 */}
        <div className="flex-shrink-0 pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto" />
        </div>

        {/* 헤더 */}
        <div className="flex-shrink-0 flex items-start justify-between px-5 py-3 border-b border-gray-100">
          <div className="flex-1 pr-3">
            <div className="flex items-center gap-2">
              <span className="text-base">🐾</span>
              <h3 className="text-sm font-bold text-gray-800 leading-tight">{place.name}</h3>
            </div>
            {dist !== null && (
              <span className="text-[11px] text-green-600 font-semibold">
                내 위치에서 약 {dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)}km`}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 text-xs"
          >
            ✕
          </button>
        </div>

        {/* 스크롤 가능한 상세 정보 */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
          <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-2xl">
            <span className="text-sm mt-0.5 flex-shrink-0">📍</span>
            <div className="min-w-0">
              <p className="text-[11px] text-gray-400 mb-0.5">주소</p>
              <p className="text-xs text-gray-700 leading-relaxed">
                {place.addr || '주소 정보 없음'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl">
            <span className="text-sm flex-shrink-0">📞</span>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-gray-400 mb-0.5">전화번호</p>
              <p className="text-xs text-gray-700">
                {place.tel || '정보 없음'}
              </p>
            </div>
            {place.tel && (
              <a
                href={`tel:${place.tel}`}
                className="flex-shrink-0 text-xs font-bold text-white bg-green-500 px-3 py-1.5 rounded-xl"
              >
                전화
              </a>
            )}
          </div>
        </div>

        {/* 고정 하단 버튼 */}
        <div className="flex-shrink-0 px-5 pt-2 pb-5 border-t border-gray-100">
          <a
            href={naverUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1.5 py-3 bg-green-500 text-white rounded-2xl text-sm font-bold w-full"
          >
            🗺️ 네이버 지도로 보기
          </a>
          <p className="text-[10px] text-gray-400 text-center mt-2">
            방문 전 운영시간·예약 여부를 꼭 확인해봐!
          </p>
        </div>
      </div>
    </div>
  )
}

export default function AnimalExperienceMap() {
  const [places, setPlaces]         = useState([])
  const [userPos, setUserPos]       = useState(null)
  const [locLoading, setLocLoading] = useState(true)
  const [dataLoading, setDataLoading] = useState(true)
  const [error, setError]           = useState('')
  const [query, setQuery]           = useState('')
  const [viewMode, setViewMode]     = useState('map') // 'map' | 'list'
  const [selected, setSelected]     = useState(null)  // 상세 보기 대상
  const [flyTarget, setFlyTarget]   = useState(null)  // 지도 이동 대상
  const inputRef = useRef(null)

  // 사용자 위치
  useEffect(() => {
    if (!navigator.geolocation) { setUserPos(DEFAULT_POS); setLocLoading(false); return }
    navigator.geolocation.getCurrentPosition(
      pos => { setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocLoading(false) },
      ()  => { setUserPos(DEFAULT_POS); setLocLoading(false) },
      { timeout: 8000 }
    )
  }, [])

  // CSV 로드
  useEffect(() => {
    async function loadCSV() {
      try {
        const res = await fetch('/animal_experience.csv')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const buf = await res.arrayBuffer()
        const text = new TextDecoder('euc-kr').decode(buf)
        const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
        const result = []
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i]
          if (!line.trim()) continue
          const cols = parseCSVLine(line)
          if (cols[4] !== '영업/정상') continue
          const name = cols[12]
          const addr = cols[16]
          const tel  = cols[21]
          const rawX = parseFloat(cols[22])
          const rawY = parseFloat(cols[23])
          if (!rawX || !rawY || isNaN(rawX) || isNaN(rawY) || !name) continue
          try {
            const [lng, lat] = proj4('EPSG:5174', 'WGS84', [rawX, rawY])
            if (lat < 33 || lat > 39 || lng < 124 || lng > 132) continue
            result.push({ name, addr, tel, lat, lng })
          } catch { continue }
        }
        setPlaces(result)
      } catch (e) {
        console.error('CSV load error:', e)
        setError('load')
      } finally {
        setDataLoading(false)
      }
    }
    loadCSV()
  }, [])

  // 검색 필터
  const filtered = query.trim().length === 0
    ? places
    : places.filter(p => {
        const q = query.trim().toLowerCase()
        return p.name.toLowerCase().includes(q) || (p.addr && p.addr.toLowerCase().includes(q))
      })

  // 거리순 정렬 (위치 있을 때)
  const sorted = userPos
    ? [...filtered].sort((a, b) => distKm(userPos, a) - distKm(userPos, b))
    : filtered

  const handleSelectPlace = useCallback((place) => {
    setSelected(place)
    setFlyTarget(place)
    if (viewMode === 'list') setViewMode('map')
  }, [viewMode])

  const center = userPos ?? DEFAULT_POS
  const isLoading = locLoading || dataLoading

  return (
    <div className="mt-5 bg-white rounded-3xl p-4 shadow-sm">
      {/* 헤더 */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl">🐾</span>
        <p className="text-sm font-bold text-gray-800">반려동물 체험장소</p>
      </div>
      <p className="text-xs text-gray-500 mb-3">내 주변 동물카페 · 체험시설을 찾아볼 수 있어</p>

      {/* 검색창 */}
      {!isLoading && !error && (
        <div className="flex items-center gap-2 bg-gray-100 rounded-2xl px-3 py-2 mb-3">
          <span className="text-sm text-gray-400">🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="이름 또는 지역으로 검색 (예: 고양이카페, 서울)"
            className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-gray-400 text-xs px-1">✕</button>
          )}
        </div>
      )}

      {/* 지도/목록 탭 */}
      {!isLoading && !error && (
        <div className="flex bg-gray-100 rounded-xl p-0.5 mb-3">
          {[
            { key: 'map',  label: '🗺️ 지도' },
            { key: 'list', label: '📋 목록' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setViewMode(t.key)}
              className={`flex-1 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                viewMode === t.key ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* 로딩 */}
      {isLoading && (
        <div className="h-64 flex flex-col items-center justify-center gap-2 bg-gray-50 rounded-2xl">
          <span className="text-2xl animate-bounce">🐾</span>
          <p className="text-xs text-gray-400 animate-pulse">
            {locLoading ? '내 위치를 확인하고 있어...' : '체험장소 정보를 불러오고 있어...'}
          </p>
        </div>
      )}

      {/* 에러 */}
      {!isLoading && error && (
        <div className="bg-gray-50 rounded-2xl px-4 py-6 text-center">
          <p className="text-2xl mb-2">😿</p>
          <p className="text-xs font-semibold text-gray-600 mb-1">체험장소 정보를 불러오지 못했어</p>
          <p className="text-[11px] text-gray-400">잠시 후 다시 시도해봐!</p>
        </div>
      )}

      {/* 지도 뷰 */}
      {!isLoading && !error && viewMode === 'map' && (
        <>
          <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm" style={{ height: 320 }}>
            <MapContainer
              center={[center.lat, center.lng]}
              zoom={12}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom={false}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FlyTo target={flyTarget} />

              {userPos && (
                <Marker position={[userPos.lat, userPos.lng]} icon={myIcon}>
                  <Popup><b>📍 내 위치</b></Popup>
                </Marker>
              )}

              {sorted.map((p, i) => (
                <Marker
                  key={i}
                  position={[p.lat, p.lng]}
                  icon={selected?.name === p.name && selected?.lat === p.lat ? selectedIcon : placeIcon}
                  eventHandlers={{ click: () => setSelected(p) }}
                >
                  <Popup minWidth={200}>
                    <div style={{ fontSize: 12, lineHeight: 1.7 }}>
                      <b style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>🐾 {p.name}</b>
                      {p.addr && (
                        <div style={{ marginBottom: 2 }}>
                          <span style={{ color: '#9ca3af', fontSize: 11 }}>📍 주소 </span>
                          <span style={{ color: '#374151' }}>{p.addr}</span>
                        </div>
                      )}
                      {p.tel && (
                        <div style={{ marginBottom: 4 }}>
                          <span style={{ color: '#9ca3af', fontSize: 11 }}>📞 전화 </span>
                          <a href={`tel:${p.tel}`} style={{ color: '#4B7BE8' }}>{p.tel}</a>
                        </div>
                      )}
                      <button
                        onClick={() => setSelected(p)}
                        style={{ fontSize: 11, color: '#16a34a', fontWeight: 'bold', cursor: 'pointer', background: '#f0fdf4', border: 'none', borderRadius: 6, padding: '3px 8px' }}
                      >
                        상세 보기 →
                      </button>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>

          {/* 범례 */}
          <div className="flex items-center gap-4 mt-2 px-1">
            <div className="flex items-center gap-1">
              <span className="text-blue-500 text-sm">●</span>
              <span className="text-[10px] text-gray-500">내 위치</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-green-500 text-sm">●</span>
              <span className="text-[10px] text-gray-500">체험장소</span>
            </div>
            <span className="text-[10px] text-gray-400 ml-auto">
              {query ? `${sorted.length}개 검색됨` : `총 ${sorted.length}개소`}
            </span>
          </div>

          {/* 검색 결과 없음 */}
          {sorted.length === 0 && (
            <p className="text-xs text-gray-400 text-center mt-3">
              '{query}' 검색 결과가 없어요.
            </p>
          )}
        </>
      )}

      {/* 목록 뷰 */}
      {!isLoading && !error && viewMode === 'list' && (
        <div>
          <p className="text-[11px] text-gray-400 mb-2 px-1">
            {userPos ? '가까운 순' : '전체'} · {sorted.length}개소
          </p>
          {sorted.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8">
              '{query}' 검색 결과가 없어요.
            </p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {sorted.map((p, i) => {
                const dist = userPos ? distKm(userPos, p) : null
                return (
                  <button
                    key={i}
                    onClick={() => handleSelectPlace(p)}
                    className="w-full text-left flex items-center gap-3 p-3 bg-gray-50 hover:bg-green-50 rounded-2xl transition-colors"
                  >
                    <span className="text-xl flex-shrink-0">🐾</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{p.name}</p>
                      {p.addr && (
                        <p className="text-[11px] text-gray-500 truncate mt-0.5">{p.addr}</p>
                      )}
                    </div>
                    {dist !== null && (
                      <span className="flex-shrink-0 text-[11px] text-green-600 font-semibold">
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

      {/* 안내 */}
      {!isLoading && !error && (
        <div className="mt-3 bg-green-50 border border-green-200 rounded-2xl px-4 py-3">
          <p className="text-xs text-green-700 leading-relaxed">
            🐱 방문 전 운영 시간과 예약 여부를 꼭 확인해봐!
          </p>
        </div>
      )}

      {/* 상세 바텀시트 */}
      {selected && (
        <DetailSheet
          place={selected}
          onClose={() => setSelected(null)}
          userPos={userPos}
        />
      )}
    </div>
  )
}
