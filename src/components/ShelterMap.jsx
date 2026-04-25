import { useEffect, useState, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Leaflet 기본 마커 이미지 깨짐 수정
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// 내 위치 마커 (파란색)
const myIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
})

// 보호소 마커 (주황색)
const shelterIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
})

// 선택된 보호소 마커 (빨간색)
const selectedIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [30, 49], iconAnchor: [15, 49], popupAnchor: [1, -40], shadowSize: [41, 41],
})

function FlyTo({ target }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], 14, { duration: 0.8 })
  }, [target])
  return null
}

function distKm(a, b) {
  const R = 6371
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLng = (b.lng - a.lng) * Math.PI / 180
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

// 상세 바텀시트
function DetailSheet({ place, onClose, userPos }) {
  const dist = userPos && place ? distKm(userPos, { lat: parseFloat(place.lat), lng: parseFloat(place.lng) }) : null
  if (!place) return null

  const naverUrl = `https://map.naver.com/v5/search/${encodeURIComponent(place.careNm)}`

  return (
    <div className="fixed inset-0 z-[9999] flex items-end" style={{ paddingBottom: 80 }} onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
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
              <span className="text-base">🏠</span>
              <h3 className="text-sm font-bold text-gray-800 leading-tight">{place.careNm}</h3>
            </div>
            {dist !== null && (
              <span className="text-[11px] text-orange-500 font-semibold">
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

        {/* 스크롤 영역 */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
          <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-2xl">
            <span className="text-sm mt-0.5 flex-shrink-0">📍</span>
            <div className="min-w-0">
              <p className="text-[11px] text-gray-400 mb-0.5">주소</p>
              <p className="text-xs text-gray-700 leading-relaxed">
                {place.careAddr || place.orgNm || '주소 정보 없음'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl">
            <span className="text-sm flex-shrink-0">📞</span>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-gray-400 mb-0.5">전화번호</p>
              <p className="text-xs text-gray-700">{place.careTel || '정보 없음'}</p>
            </div>
            {place.careTel && (
              <a
                href={`tel:${place.careTel}`}
                className="flex-shrink-0 text-xs font-bold text-white bg-orange-400 px-3 py-1.5 rounded-xl"
              >
                전화
              </a>
            )}
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className="flex-shrink-0 px-5 pt-2 pb-5 border-t border-gray-100">
          <a
            href={naverUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1.5 py-3 bg-orange-400 text-white rounded-2xl text-sm font-bold w-full"
          >
            🗺️ 네이버 지도로 보기
          </a>
          <p className="text-[10px] text-gray-400 text-center mt-2">
            방문 전 보호소에 직접 문의해봐!
          </p>
        </div>
      </div>
    </div>
  )
}

const SHELTER_API_KEY = import.meta.env.VITE_SHELTER_API_KEY
const DEFAULT_POS = { lat: 37.5665, lng: 126.9780 }

export default function ShelterMap() {
  const [shelters, setShelters]     = useState([])
  const [userPos, setUserPos]       = useState(null)
  const [locLoading, setLocLoading] = useState(true)
  const [apiLoading, setApiLoading] = useState(true)
  const [error, setError]           = useState('')
  const [query, setQuery]           = useState('')
  const [viewMode, setViewMode]     = useState('map') // 'map' | 'list'
  const [selected, setSelected]     = useState(null)
  const [flyTarget, setFlyTarget]   = useState(null)
  const fetchedRef = useRef(false)

  // 사용자 위치
  useEffect(() => {
    if (!navigator.geolocation) { setUserPos(DEFAULT_POS); setLocLoading(false); return }
    navigator.geolocation.getCurrentPosition(
      pos => { setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocLoading(false) },
      ()  => { setUserPos(DEFAULT_POS); setLocLoading(false) },
      { timeout: 8000 }
    )
  }, [])

  // API 호출
  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true

    async function fetchShelters() {
      setApiLoading(true)
      try {
        const encodedKey = encodeURIComponent(SHELTER_API_KEY)
        const url = `https://apis.data.go.kr/1543061/animalShelterSrvc_v2/shelterInfo_v2?serviceKey=${encodedKey}&numOfRows=1000&pageNo=1&_type=json`
        const res = await fetch(url)
        if (res.status === 401 || res.status === 403) { setError('api_auth'); return }
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        const raw = data?.response?.body?.items?.item
        if (!raw) { setError('empty'); return }
        const list = Array.isArray(raw) ? raw : [raw]
        setShelters(list.filter(s =>
          s.lat && s.lng &&
          !s.careNm?.includes('병원') &&
          s.divisionNm !== '동물병원'
        ))
      } catch (e) {
        console.error('shelter API error:', e)
        setError('network')
      } finally {
        setApiLoading(false)
      }
    }
    fetchShelters()
  }, [])

  // 검색 필터
  const filtered = query.trim().length === 0
    ? shelters
    : shelters.filter(s => {
        const q = query.trim().toLowerCase()
        return s.careNm?.toLowerCase().includes(q) ||
               s.careAddr?.toLowerCase().includes(q) ||
               s.orgNm?.toLowerCase().includes(q)
      })

  // 거리순 정렬
  const sorted = userPos
    ? [...filtered].sort((a, b) =>
        distKm(userPos, { lat: parseFloat(a.lat), lng: parseFloat(a.lng) }) -
        distKm(userPos, { lat: parseFloat(b.lat), lng: parseFloat(b.lng) })
      )
    : filtered

  const handleSelectPlace = (s) => {
    setSelected(s)
    setFlyTarget({ lat: parseFloat(s.lat), lng: parseFloat(s.lng) })
    if (viewMode === 'list') setViewMode('map')
  }

  const center = userPos ?? DEFAULT_POS
  const isLoading = locLoading || apiLoading

  return (
    <div className="mt-4">
      {/* 검색창 */}
      {!isLoading && !error && (
        <div className="flex items-center gap-2 bg-gray-100 rounded-2xl px-3 py-2 mb-3">
          <span className="text-sm text-gray-400">🔍</span>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="이름 또는 지역으로 검색 (예: 서울, 광진구)"
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

      {/* 안내 문구 */}
      {!isLoading && !error && (
        <div className="mb-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
          <p className="text-xs text-amber-700 leading-relaxed">
            🐾 방문 전 보호소에 직접 문의해봐. 입양 가능한 동물이 있는지 확인하는 게 좋아!
          </p>
        </div>
      )}

      {/* 로딩 */}
      {isLoading && (
        <div className="h-64 flex flex-col items-center justify-center gap-2 bg-gray-50 rounded-2xl">
          <span className="text-2xl animate-bounce">🗺️</span>
          <p className="text-xs text-gray-400 animate-pulse">
            {locLoading ? '내 위치를 확인하고 있어...' : '보호소 정보를 불러오고 있어...'}
          </p>
        </div>
      )}

      {/* 에러 */}
      {!isLoading && error && (
        <div className="rounded-2xl overflow-hidden border border-orange-100">
          <div className="bg-orange-50 px-4 py-4 text-center">
            <p className="text-2xl mb-2">🗺️</p>
            {error === 'api_auth' ? (
              <>
                <p className="text-xs font-semibold text-orange-600 mb-1">지도를 불러오지 못했어</p>
                <p className="text-[11px] text-gray-500 leading-relaxed mb-3">
                  API 인증 오류가 발생했어. 아래 링크에서 직접 찾아봐!
                </p>
              </>
            ) : (
              <>
                <p className="text-xs font-semibold text-orange-600 mb-1">잠시 연결이 안 됐어</p>
                <p className="text-[11px] text-gray-500 leading-relaxed mb-3">
                  아래 링크에서 내 주변 보호센터를 검색할 수 있어!
                </p>
              </>
            )}
            <a
              href="https://www.animal.go.kr/front/awtis/public/publicList.do"
              target="_blank"
              rel="noreferrer"
              className="inline-block text-xs font-bold text-white bg-orange-400 px-4 py-2 rounded-xl"
            >
              🐾 동물보호센터 찾기
            </a>
          </div>
          <div className="bg-amber-50 px-4 py-3">
            <p className="text-[11px] text-amber-700 leading-relaxed">
              방문 전 보호소에 직접 문의해봐. 입양 가능한 동물이 있는지 확인하는 게 좋아! 🐾
            </p>
          </div>
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

              {sorted.map((s, i) => (
                <Marker
                  key={i}
                  position={[parseFloat(s.lat), parseFloat(s.lng)]}
                  icon={selected?.careNm === s.careNm && selected?.lat === s.lat ? selectedIcon : shelterIcon}
                  eventHandlers={{ click: () => setSelected(s) }}
                >
                  <Popup minWidth={200}>
                    <div style={{ fontSize: 12, lineHeight: 1.7 }}>
                      <b style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>🏠 {s.careNm}</b>
                      {(s.careAddr || s.orgNm) && (
                        <div style={{ marginBottom: 2 }}>
                          <span style={{ color: '#9ca3af', fontSize: 11 }}>📍 주소 </span>
                          <span style={{ color: '#374151' }}>{s.careAddr || s.orgNm}</span>
                        </div>
                      )}
                      {s.careTel && (
                        <div style={{ marginBottom: 4 }}>
                          <span style={{ color: '#9ca3af', fontSize: 11 }}>📞 전화 </span>
                          <a href={`tel:${s.careTel}`} style={{ color: '#4B7BE8' }}>{s.careTel}</a>
                        </div>
                      )}
                      <button
                        onClick={() => setSelected(s)}
                        style={{ fontSize: 11, color: '#ea580c', fontWeight: 'bold', cursor: 'pointer', background: '#fff7ed', border: 'none', borderRadius: 6, padding: '3px 8px' }}
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
              <span className="text-orange-400 text-sm">●</span>
              <span className="text-[10px] text-gray-500">동물보호센터</span>
            </div>
            <span className="text-[10px] text-gray-400 ml-auto">
              {query ? `${sorted.length}개 검색됨` : `총 ${sorted.length}개소`}
            </span>
          </div>

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
              {sorted.map((s, i) => {
                const lat = parseFloat(s.lat), lng = parseFloat(s.lng)
                const dist = userPos ? distKm(userPos, { lat, lng }) : null
                return (
                  <button
                    key={i}
                    onClick={() => handleSelectPlace(s)}
                    className="w-full text-left flex items-center gap-3 p-3 bg-gray-50 hover:bg-orange-50 rounded-2xl transition-colors"
                  >
                    <span className="text-xl flex-shrink-0">🏠</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{s.careNm}</p>
                      {(s.careAddr || s.orgNm) && (
                        <p className="text-[11px] text-gray-500 truncate mt-0.5">
                          {s.careAddr || s.orgNm}
                        </p>
                      )}
                    </div>
                    {dist !== null && (
                      <span className="flex-shrink-0 text-[11px] text-orange-500 font-semibold">
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
