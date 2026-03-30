/**
 * Ocean Marine Heatwave Prediction Dashboard
 * ==========================================
 * React + D3 + Recharts + NOAA ERDDAP OISST v2.1
 *
 * Architecture:
 *   App.jsx        — root layout, state management, data orchestration
 *   Globe.jsx      — D3 geoOrthographic canvas globe
 *   sstEngine.js   — synthetic SST physics (mirrors Python data_generator.py)
 *   noaaApi.js     — NOAA ERDDAP REST client
 *   ui.jsx         — shared components (Card, Label, StatTile, Tooltips)
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, RadarChart, PolarGrid, PolarAngleAxis, Radar,
} from 'recharts'

import Globe          from './Globe.jsx'
import { fetchNOAAPoint } from './noaaApi.js'
import { buildSST, locMetrics, computeSeasonality } from './sstEngine.js'
import { C, Card, Label, SevBadge, StatTile, SSTTooltip, BarTooltip, TabBar } from './ui.jsx'

// ═══════════════════════════════════════════════════════════
//  STATIC DATA
// ═══════════════════════════════════════════════════════════

const LOCATIONS = [
  { id: 0, name: 'N. Pacific Gyre',  lat:  35.2, lon: -145.8, region: 'Pacific'  },
  { id: 1, name: 'Gulf of Mexico',   lat:  24.5, lon:  -90.2, region: 'Atlantic' },
  { id: 2, name: 'Indian Ocean',     lat: -12.3, lon:   72.6, region: 'Indian'   },
  { id: 3, name: 'S. China Sea',     lat:  15.4, lon:  115.2, region: 'Pacific'  },
  { id: 4, name: 'Mediterranean',    lat:  38.1, lon:   18.7, region: 'Atlantic' },
  { id: 5, name: 'Coral Sea',        lat: -18.5, lon:  155.3, region: 'Pacific'  },
  { id: 6, name: 'Arabian Sea',      lat:  16.8, lon:   63.4, region: 'Indian'   },
  { id: 7, name: 'Caribbean Sea',    lat:  17.2, lon:  -72.5, region: 'Atlantic' },
  { id: 8, name: 'Bay of Bengal',    lat:  13.6, lon:   86.2, region: 'Indian'   },
  { id: 9, name: 'Tasman Sea',       lat: -38.4, lon:  160.7, region: 'Pacific'  },
]

const MODEL_METRICS = {
  roc_auc:       0.9942,
  avg_precision: 0.9385,
  f1:            0.89,
  mae:           0.0168,
  rmse:          0.0238,
  r2:            1.0,
  total_rows:    65_600,
  mhw_events:    308,
  mhw_pct:       6.25,
}

const FEATURE_DATA = [
  { name: 'anom_7d_mean',  imp: 0.234, type: 'anomaly'  },
  { name: 'anom_7d_max',   imp: 0.198, type: 'anomaly'  },
  { name: 'anom_14d_mean', imp: 0.156, type: 'anomaly'  },
  { name: 'SST_current',   imp: 0.128, type: 'sst'      },
  { name: 'anom_30d_max',  imp: 0.098, type: 'anomaly'  },
  { name: 'sst_14d_max',   imp: 0.076, type: 'sst'      },
  { name: 'seasonal_sin',  imp: 0.054, type: 'seasonal' },
  { name: 'ENSO_index',    imp: 0.032, type: 'climate'  },
]

const FEAT_COLORS = { anomaly: C.red, sst: C.teal, seasonal: C.amber, climate: C.purple }

const RADAR_DATA = [
  { cat: 'Anomaly', val: 68 },
  { cat: 'SST',     val: 20 },
  { cat: 'Seasonal',val:  7 },
  { cat: 'Climate', val:  5 },
]

const TABS = [
  { key: 'timeseries',  label: 'SST History'       },
  { key: 'forecast',    label: '14-Day Forecast'   },
  { key: 'features',    label: 'Feature Importance'},
  { key: 'seasonality', label: 'Seasonality'       },
]

// ═══════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════

function fmtCoord(lat, lon) {
  const la = lat > 0 ? `${lat}°N` : `${Math.abs(lat)}°S`
  const lo = lon > 0 ? `${lon}°E` : `${Math.abs(lon)}°W`
  return `${la}, ${lo}`
}

function signStr(v) { return v > 0 ? `+${v}` : `${v}` }

// ═══════════════════════════════════════════════════════════
//  ROOT APP
// ═══════════════════════════════════════════════════════════

export default function App() {
  const [selId,       setSelId]       = useState(0)
  const [tab,         setTab]         = useState('timeseries')
  const [sstCache,    setSSTCache]    = useState({})
  const [noaaCache,   setNoaaCache]   = useState({})
  const [noaaLoading, setNoaaLoading] = useState({})

  // Pre-compute all location summary metrics (stable — seeded RNG)
  const allMetrics = useMemo(() => {
    const m = {}
    LOCATIONS.forEach(l => { m[l.id] = locMetrics(l.id) })
    return m
  }, [])

  const selLoc = LOCATIONS[selId]
  const selMet = allMetrics[selId] || {}

  // ── Generate SST lazily per location ──────────────────────────────────
  useEffect(() => {
    if (sstCache[selId]) return
    setSSTCache(prev => ({
      ...prev,
      [selId]: buildSST(selId, selLoc.lat, selLoc.lon, 365),
    }))
  }, [selId, selLoc, sstCache])

  // ── Fetch NOAA lazily per location ────────────────────────────────────
  useEffect(() => {
    if (noaaCache[selId] !== undefined || noaaLoading[selId]) return
    setNoaaLoading(p => ({ ...p, [selId]: true }))
    fetchNOAAPoint(selLoc.lat, selLoc.lon, 8)
      .then(d  => setNoaaCache(p => ({ ...p, [selId]: d })))
      .catch(() => setNoaaCache(p => ({ ...p, [selId]: { live: false } })))
      .finally(() => setNoaaLoading(p => ({ ...p, [selId]: false })))
  }, [selId, selLoc, noaaCache, noaaLoading])

  const rawData   = sstCache[selId] || []
  const noaaDat   = noaaCache[selId]
  const isLoading = noaaLoading[selId]

  // Chart data: last 180 days + 14-day forecast window
  const cutoff    = new Date(Date.now() - 180 * 86_400_000).toISOString().slice(0, 10)
  const todayStr  = new Date().toISOString().slice(0, 10)
  const chartData = rawData.filter(d => d.date >= cutoff)
  const fcastData = rawData.filter(d => d.forecast != null)
  const maxProb   = fcastData.length ? Math.max(...fcastData.map(d => d.mhwProb ?? 0)) : 0

  const seasonData = useMemo(() => computeSeasonality(rawData), [rawData])

  // Active alerts list
  const alerts = useMemo(() =>
    LOCATIONS
      .map(l => ({ ...l, ...allMetrics[l.id] }))
      .filter(l => l.severity !== 'NORMAL')
      .sort((a, b) => (b.severity === 'HIGH' ? 1 : -1)),
    [allMetrics]
  )

  // ── Handle location select (from globe or list) ────────────────────────
  const handleSelect = useCallback((id) => {
    setSelId(id)
    setTab('timeseries')
  }, [])

  // ═══════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════
  return (
    <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease',
      minHeight:  '100vh',
      background: `radial-gradient(ellipse at 28% 18%, #ffffff 0%, ${C.bg} 85%)`,
      color:      C.text,
      fontFamily: "'Space Mono', 'Courier New', monospace",
      fontSize:   13,
    }}>

      {/* ── GLOBAL STYLES ── */}
      <style>{`
        * { box-sizing: border-box; }
        @keyframes blink   { 0%,100%{opacity:1} 50%{opacity:.3} }
        @keyframes fadeIn  { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
        @keyframes pulse   { 0%,100%{transform:scale(1)} 50%{transform:scale(1.15)} }
        .tab-btn:hover     { background: rgba(0,200,255,0.07) !important; }
        .loc-row:hover     { background: rgba(0,200,255,0.055) !important; }
        .alert-row:hover   { filter: brightness(1.12); cursor: pointer; }
        ::-webkit-scrollbar            { width: 4px; }
        ::-webkit-scrollbar-track      { background: transparent; }
        ::-webkit-scrollbar-thumb      { background: rgba(0,200,255,0.28); border-radius: 2px; }
      `}</style>

      {/* ═══════════════ HEADER ═══════════════ */}
      <header style={{ transform: 'scale(1)', transition: 'all 0.3s ease',
        background:    'rgba(255,255,255,0.96)',
        borderBottom:  `1px solid ${C.border}`,
        padding:       '10px 24px',
        display:       'flex',
        alignItems:    'center',
        justifyContent:'space-between',
        flexWrap:      'wrap',
        gap:           10,
        backdropFilter:'blur(14px)',
        position:      'sticky',
        top:           0,
        zIndex:        100,
      }}>
        <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease', display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ transform: 'scale(1)', transition: 'all 0.3s ease', fontSize: 32 }}>🌊</span>
          <div>
            <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease', fontSize: 15, fontWeight: 'bold', color: C.teal, letterSpacing: '0.11em' }}>
              OCEAN HEATWAVE PREDICTION SYSTEM
            </div>
            <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease', fontSize: 9, color: C.muted, marginTop: 1, letterSpacing: '.06em' }}>
              RF CLASSIFIER · GB FORECASTER · NOAA OISST v2.1 · 10 GLOBAL OCEAN STATIONS
            </div>
          </div>
        </div>

        <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease', display: 'flex', gap: 22, alignItems: 'center', flexWrap: 'wrap' }}>
          {[
            { label: 'ROC-AUC',  val: MODEL_METRICS.roc_auc.toFixed(4), col: C.green  },
            { label: 'F1 SCORE', val: MODEL_METRICS.f1.toFixed(4),       col: C.teal   },
            { label: 'MAE',      val: `${MODEL_METRICS.mae}°C`,          col: C.teal   },
            { label: 'R²',       val: MODEL_METRICS.r2.toFixed(4),       col: C.purple },
            { label: 'ALERTS',   val: alerts.length,                     col: alerts.some(a => a.severity === 'HIGH') ? C.red : C.amber },
          ].map(({ label, val, col }) => (
            <div key={label} style={{ transform: 'scale(1)', transition: 'all 0.3s ease', textAlign: 'center' }}>
              <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease', fontSize: 8,  color: C.muted, letterSpacing: '.1em' }}>{label}</div>
              <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease', fontSize: 14, fontWeight: 'bold', color: col }}>{val}</div>
            </div>
          ))}

          {/* NOAA live indicator */}
          <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease', display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease',
              width:     12, height: 12, borderRadius: '50%',
              background: noaaDat?.live ? C.green : isLoading ? C.amber : '#555',
              animation:  isLoading ? 'blink 1s infinite' : noaaDat?.live ? 'pulse 2s infinite' : 'none',
              boxShadow:  noaaDat?.live ? `0 0 6px ${C.green}` : 'none',
            }} />
            <span style={{ transform: 'scale(1)', transition: 'all 0.3s ease', fontSize: 9, color: C.muted }}>
              {isLoading ? 'FETCHING NOAA…' : noaaDat?.live ? 'NOAA LIVE' : 'SIM MODE'}
            </span>
          </div>
        </div>
      </header>

      {/* ═══════════════ MAIN GRID ═══════════════ */}
      <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease',
        display:             'grid',
        gridTemplateColumns: '1fr 340px',
        gap:                 16,
        padding:             '16px 20px',
        maxWidth:            1440,
        margin:              '0 auto',
      }}>

        {/* ─── LEFT COLUMN ─── */}
        <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Globe + Station List */}
          <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease', display: 'grid', gridTemplateColumns: '1fr 275px', gap: 14 }}>

            {/* Globe card */}
            <Card style={{ transform: 'scale(1)', transition: 'all 0.3s ease',
              padding:       0,
              overflow:      'hidden',
              aspectRatio:   '1',
              display:       'flex',
              alignItems:    'center',
              justifyContent:'center',
              background:    'rgba(248,250,252,0.98)',
              position:      'relative',
            }}>
              <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease', width: '100%', height: '100%', padding: 14 }}>
                <Globe
                  locations={LOCATIONS}
                  metrics={allMetrics}
                  selectedId={selId}
                  onSelect={handleSelect}
                />
              </div>
              {/* Legend */}
              <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease',
                position:   'absolute',
                bottom:     16,
                left:       18,
                fontSize:   9,
                color:      C.muted,
                lineHeight: 1.9,
              }}>
                {[['●', C.red, 'HIGH MHW'], ['●', C.amber, 'MODERATE'], ['●', C.teal, 'NORMAL']].map(([sym, col, lbl]) => (
                  <div key={lbl} style={{ transform: 'scale(1)', transition: 'all 0.3s ease', display: 'flex', gap: 5, alignItems: 'center' }}>
                    <span style={{ transform: 'scale(1)', transition: 'all 0.3s ease', color: col, fontSize: 11 }}>{sym}</span>{lbl}
                  </div>
                ))}
                <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease', color: '#3a4a5a', marginTop: 4, fontSize: 8 }}>drag · click · auto-rotate</div>
              </div>
            </Card>

            {/* Station list */}
            <Card style={{ transform: 'scale(1)', transition: 'all 0.3s ease', padding: '12px 10px', overflowY: 'auto', maxHeight: 530 }}>
              <Label>Ocean Stations</Label>
              {LOCATIONS.map(loc => {
                const m   = allMetrics[loc.id]
                const col = m.severity === 'HIGH' ? C.red : m.severity === 'MODERATE' ? C.amber : C.tealDim
                const sel = loc.id === selId
                return (
                  <div key={loc.id}
                    className="loc-row"
                    onClick={() => handleSelect(loc.id)}
                    style={{ transform: 'scale(1)', transition: 'all 0.3s ease',
                      padding:    '8px',
                      borderRadius: 7,
                      marginBottom: 3,
                      background:  sel ? 'rgba(0,200,255,0.1)' : 'transparent',
                      border:      sel ? `1px solid ${C.teal}40` : '1px solid transparent',
                      display:     'flex',
                      alignItems:  'center',
                      justifyContent: 'space-between',
                      cursor:      'pointer',
                      transition:  'background .15s',
                    }}>
                    <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease', width: 12, height: 12, borderRadius: '50%', background: col, flexShrink: 0 }} />
                      <div>
                        <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease', fontSize: 11, color: sel ? '#1E293B' : C.text, fontWeight: sel ? 'bold' : 'normal' }}>
                          {loc.name}
                        </div>
                        <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease', fontSize: 8, color: C.muted, marginTop: 1 }}>
                          {fmtCoord(loc.lat, loc.lon)}
                        </div>
                      </div>
                    </div>
                    <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease', textAlign: 'right' }}>
                      <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease', fontSize: 12, color: col, fontWeight: 'bold' }}>{m.sst}°C</div>
                      <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease', fontSize: 9, color: m.anomaly > 0 ? C.red : C.teal }}>
                        {signStr(m.anomaly)}°C
                      </div>
                    </div>
                  </div>
                )
              })}
            </Card>
          </div>

          {/* Chart section */}
          <Card style={{ transform: 'scale(1)', transition: 'all 0.3s ease', padding: 0 }}>
            <TabBar tabs={TABS} active={tab} onChange={setTab} />
            <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease', padding: '16px 20px 14px' }}>
              <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease', fontSize: 11, color: C.muted, marginBottom: 10 }}>
                {selLoc.name} · {fmtCoord(selLoc.lat, selLoc.lon)} · {selLoc.region} Ocean
              </div>

              {/* ── SST TIME SERIES ── */}
              {tab === 'timeseries' && (
                <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease', animation: 'fadeIn .3s' }}>
                  <ResponsiveContainer width="100%" height={270}>
                    <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -8, bottom: 0 }}>
                      <defs>
                        <linearGradient id="sstGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"   stopColor={C.gold} stopOpacity={0.38} />
                          <stop offset="95%"  stopColor={C.gold} stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="climGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#4488ff" stopOpacity={0.18} />
                          <stop offset="95%" stopColor="#4488ff" stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="mhwGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={C.red} stopOpacity={0.5} />
                          <stop offset="95%" stopColor={C.red} stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                      <XAxis dataKey="date" tick={{ fontSize: 9, fill: C.muted }} tickLine={false}
                        tickFormatter={d => d.slice(5, 10)} interval={29} />
                      <YAxis tick={{ fontSize: 9, fill: C.muted }} tickLine={false}
                        tickFormatter={v => `${v}°C`} domain={['auto', 'auto']} />
                      <Tooltip content={<SSTTooltip />} />
                      <ReferenceLine
                        y={selMet.sst + (chartData[0]?.threshold || 1.5)}
                        stroke={C.orange} strokeDasharray="4 3" strokeWidth={1} strokeOpacity={0.65}
                        label={{ value: 'MHW Threshold', fill: C.red, fontSize: 8, position: 'right' }}
                      />
                      <Area type="monotone" dataKey="clim"    name="Climatology"
                        stroke="#4488ff" fill="url(#climGrad)"
                        strokeDasharray="4 3" strokeWidth={1.2} dot={false} strokeOpacity={0.7} />
                      <Area type="monotone" dataKey="sst"     name="SST"
                        stroke={C.gold} fill="url(#sstGrad)" strokeWidth={1.8} dot={false} />
                      <Area type="monotone" dataKey="mhwMark" name="MHW Active"
                        stroke={C.red}  fill="url(#mhwGrad)" strokeWidth={2}   dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                  <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease', marginTop: 8, display: 'flex', gap: 16, fontSize: 9, color: C.muted }}>
                    {[
                      { col: C.teal,    lbl: 'Sea Surface Temp' },
                      { col: '#4488ff', lbl: 'Climatology'      },
                      { col: C.red,     lbl: 'MHW Active'       },
                    ].map(({ col, lbl }) => (
                      <div key={lbl} style={{ transform: 'scale(1)', transition: 'all 0.3s ease', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease', width: 20, height: 2, background: col }} />{lbl}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── 14-DAY FORECAST ── */}
              {tab === 'forecast' && (
                <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease', animation: 'fadeIn .3s' }}>
                  <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
                    <StatTile label="Peak MHW Prob"  value={`${(maxProb * 100).toFixed(0)}%`}
                      color={maxProb > 0.7 ? C.red : maxProb > 0.4 ? C.amber : C.teal} />
                    <StatTile label="Forecast D+14"  value={fcastData.at(-1) ? `${fcastData.at(-1).forecast}°C` : '—'} color={C.text} />
                    <StatTile label="Today SST"      value={`${selMet.sst}°C`} color={C.teal} />
                  </div>

                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart
                      data={[
                        ...chartData.slice(-30).map(d => ({ ...d, _hist: d.sst  })),
                        ...fcastData.map(d => ({ ...d, _fcast: d.forecast })),
                      ]}
                      margin={{ top: 5, right: 10, left: -8, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="fGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={C.amber} stopOpacity={0.4} />
                          <stop offset="95%" stopColor={C.amber} stopOpacity={0.03} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                      <XAxis dataKey="date" tick={{ fontSize: 9, fill: C.muted }} tickLine={false}
                        tickFormatter={d => d.slice(5, 10)} interval={7} />
                      <YAxis tick={{ fontSize: 9, fill: C.muted }} tickLine={false}
                        tickFormatter={v => `${v}°C`} domain={['auto', 'auto']} />
                      <Tooltip content={<SSTTooltip />} />
                      <ReferenceLine x={todayStr} stroke={C.teal} strokeDasharray="4 2" strokeOpacity={0.7}
                        label={{ value: 'TODAY', fill: C.teal, fontSize: 8, position: 'insideTopRight' }} />
                      <Area type="monotone" dataKey="sst"      name="Historical SST"
                        stroke={C.teal}  fill="none" strokeWidth={1.8} dot={false} />
                      <Area type="monotone" dataKey="forecast" name="Forecast SST"
                        stroke={C.amber} fill="url(#fGrad)" strokeWidth={2} strokeDasharray="5 2" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>

                  <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease', marginTop: 12 }}>
                    <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease', fontSize: 9, color: C.muted, marginBottom: 5 }}>
                      MHW PROBABILITY — 14-DAY HORIZON (GB Forecaster)
                    </div>
                    <ResponsiveContainer width="100%" height={72}>
                      <BarChart data={fcastData} margin={{ top: 0, right: 10, left: -22, bottom: 0 }}>
                        <XAxis dataKey="date" tick={{ fontSize: 8, fill: C.muted }}
                          tickFormatter={d => d.slice(5, 10)} />
                        <YAxis domain={[0, 1]} hide />
                        <Tooltip
                          contentStyle={{ background: 'rgba(255,255,255,.96)', border: `1px solid rgba(0,0,0,0.15)`, borderRadius: 8, fontFamily: 'monospace', fontSize: 11 }}
                          formatter={(v) => [`${(v * 100).toFixed(0)}%`, 'MHW Prob']}
                          labelFormatter={l => l.slice(5, 10)}
                        />
                        <Bar dataKey="mhwProb" radius={[3, 3, 0, 0]}>
                          {fcastData.map((d, i) => (
                            <Cell key={i}
                              fill={d.mhwProb > 0.7 ? C.orange : d.mhwProb > 0.45 ? C.gold : C.purple}
                              fillOpacity={0.82}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* ── FEATURE IMPORTANCE ── */}
              {tab === 'features' && (
                <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease', animation: 'fadeIn .3s' }}>
                  <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                    <div>
                      <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease', fontSize: 9, color: C.muted, marginBottom: 7 }}>
                        RF CLASSIFIER — FEATURE IMPORTANCE
                      </div>
                      <ResponsiveContainer width="100%" height={230}>
                        <BarChart data={FEATURE_DATA} layout="vertical"
                          margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
                          <XAxis type="number" domain={[0, 0.25]}
                            tick={{ fontSize: 8, fill: C.muted }}
                            tickFormatter={v => `${(v * 100).toFixed(0)}%`} />
                          <YAxis type="category" dataKey="name" width={106}
                            tick={{ fontSize: 9, fill: C.muted }} />
                          <Tooltip content={<BarTooltip />} />
                          <Bar dataKey="imp" radius={[0, 4, 4, 0]}>
                            {FEATURE_DATA.map((d, i) => (
                              <Cell key={i} fill={FEAT_COLORS[d.type]} fillOpacity={0.82} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div>
                      <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease', fontSize: 9, color: C.muted, marginBottom: 7 }}>
                        FEATURE CATEGORY BREAKDOWN
                      </div>
                      <ResponsiveContainer width="100%" height={200}>
                        <RadarChart data={RADAR_DATA}>
                          <PolarGrid stroke="rgba(0,0,0,0.1)" />
                          <PolarAngleAxis dataKey="cat" tick={{ fontSize: 10, fill: C.muted }} />
                          <Radar name="Importance %" dataKey="val"
                            stroke={C.gold} fill={C.gold} fillOpacity={0.22} strokeWidth={1.5} />
                        </RadarChart>
                      </ResponsiveContainer>
                      <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease', marginTop: 10, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        {Object.entries(FEAT_COLORS).map(([k, v]) => (
                          <div key={k} style={{ transform: 'scale(1)', transition: 'all 0.3s ease', display: 'flex', alignItems: 'center', gap: 5, fontSize: 9, color: C.muted }}>
                            <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease', width: 12, height: 12, borderRadius: 2, background: v }} />{k}
                          </div>
                        ))}
                      </div>
                      <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease',
                        marginTop: 14, padding: '10px 12px', borderRadius: 8,
                        background: 'rgba(241,245,249,0.9)', border: `1px solid ${C.border}`,
                        fontSize: 10, color: C.muted, lineHeight: 1.7,
                      }}>
                        <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease', color: C.gold, marginBottom: 4 }}>Top 3 (Classifier)</div>
                        anom_7d_mean · anom_7d_max · anom_14d_mean
                        <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease', color: C.amber, marginTop: 8, marginBottom: 4 }}>Top 3 (Forecaster)</div>
                        SST_current · anom_30d_max · sst_14d_max
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── SEASONALITY ── */}
              {tab === 'seasonality' && (
                <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease', animation: 'fadeIn .3s' }}>
                  <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease', fontSize: 9, color: C.muted, marginBottom: 8 }}>
                    MONTHLY AVERAGE SST + MHW FREQUENCY (%) · {selLoc.name}
                  </div>
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={seasonData} margin={{ top: 5, right: 10, left: -8, bottom: 0 }}>
                      <defs>
                        <linearGradient id="seaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={C.gold} stopOpacity={0.4} />
                          <stop offset="95%" stopColor={C.gold} stopOpacity={0.03} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: C.muted }} tickLine={false} />
                      <YAxis yAxisId="sst" tick={{ fontSize: 9, fill: C.muted }}
                        tickFormatter={v => `${v}°C`} domain={['auto', 'auto']} />
                      <YAxis yAxisId="mhw" orientation="right"
                        tick={{ fontSize: 9, fill: C.muted }} tickFormatter={v => `${v}%`} />
                      <Tooltip
                        contentStyle={{ background: 'rgba(3,14,30,.96)', border: `1px solid rgba(100,150,255,0.25)`, borderRadius: 8, fontFamily: 'monospace', fontSize: 11 }}
                      />
                      <Area yAxisId="sst" type="natural" dataKey="sst" name="Avg SST (°C)"
                        stroke={C.gold} fill="url(#seaGrad)" strokeWidth={2} dot={false} />
                      <Bar yAxisId="mhw" data={seasonData} dataKey="mhwFreq" name="MHW Freq (%)"
                        fill={C.orange} fillOpacity={0.52} radius={[3, 3, 0, 0]} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* ─── RIGHT COLUMN ─── */}
        <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Selected station summary */}
          <Card>
            <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease', fontSize: 14, fontWeight: 'bold', color: '#1E293B', marginBottom: 2 }}>
                  {selLoc.name}
                </div>
                <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease', fontSize: 9, color: C.muted }}>
                  {selLoc.region} Ocean · {fmtCoord(selLoc.lat, selLoc.lon)}
                </div>
              </div>
              <SevBadge sev={selMet.severity} />
            </div>
            <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <StatTile label="Current SST"   value={`${selMet.sst}°C`}               color={C.teal} />
              <StatTile label="SST Anomaly"   value={`${signStr(selMet.anomaly)}°C`}  color={selMet.anomaly > 0 ? C.red : C.green} />
              <StatTile label="7-Day Trend"   value={`${signStr(selMet.trend7d)}°C`}  color={selMet.trend7d > 0 ? C.red : C.teal} />
              <StatTile label="MHW Prob Now"  value={`${(selMet.mhwProb * 100).toFixed(0)}%`}
                color={selMet.mhwProb > 0.7 ? C.red : selMet.mhwProb > 0.4 ? C.amber : C.teal} />
              <StatTile label="Events (30d)"  value={selMet.events30}                 color={C.text} />
              <StatTile label="Peak Fcast"    value={`${(maxProb * 100).toFixed(0)}%`}
                color={maxProb > 0.7 ? C.red : C.amber} />
            </div>
          </Card>

          {/* NOAA Live Panel */}
          <Card>
            <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Label>NOAA Live Data</Label>
              <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease', display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease',
                  width: 12, height: 12, borderRadius: '50%',
                  background: noaaDat?.live ? C.green : isLoading ? C.amber : '#555',
                  animation:  isLoading ? 'blink 1s infinite' : noaaDat?.live ? 'pulse 2.5s infinite' : 'none',
                  boxShadow:  noaaDat?.live ? `0 0 5px ${C.green}` : 'none',
                }} />
                <span style={{ transform: 'scale(1)', transition: 'all 0.3s ease', fontSize: 9, color: C.muted }}>
                  {isLoading ? 'LOADING…' : noaaDat?.live ? noaaDat.source : 'UNAVAILABLE'}
                </span>
              </div>
            </div>

            {isLoading && (
              <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease', fontSize: 11, color: C.muted, textAlign: 'center', padding: '18px 0' }}>
                Fetching NOAA ERDDAP data…
              </div>
            )}

            {noaaDat?.live && !isLoading && (
              <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease', animation: 'fadeIn .4s' }}>
                <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                  <StatTile label="Latest SST"   value={`${noaaDat.latest}°C`} color={C.teal}
                    accent="rgba(100,150,255,0.14)" />
                  <StatTile label="Week Trend"   value={`${signStr(noaaDat.weekTrend)}°C`}
                    color={noaaDat.weekTrend > 0 ? C.red : C.green} accent="rgba(100,150,255,0.14)" />
                  <StatTile label="7-Day Min"    value={`${noaaDat.min}°C`}    color={C.text}
                    accent="rgba(100,150,255,0.14)" />
                  <StatTile label="7-Day Max"    value={`${noaaDat.max}°C`}    color={C.text}
                    accent="rgba(100,150,255,0.14)" />
                </div>
                <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease', fontSize: 9, color: C.muted, marginBottom: 5 }}>LAST 7 DAYS — NOAA OISST</div>
                <ResponsiveContainer width="100%" height={68}>
                  <AreaChart data={noaaDat.series} margin={{ top: 2, right: 0, left: -28, bottom: 0 }}>
                    <defs>
                      <linearGradient id="noaaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={C.gold} stopOpacity={0.4} />
                        <stop offset="95%" stopColor={C.gold} stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" hide />
                    <YAxis domain={['auto', 'auto']} hide />
                    <Area type="monotone" dataKey="sst" stroke={C.gold}
                      fill="url(#noaaGrad)" strokeWidth={1.6} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
                <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease', fontSize: 8, color: '#3a4a5a', marginTop: 5 }}>
                  {noaaDat.n} obs · {noaaDat.range}
                </div>
              </div>
            )}

            {!isLoading && !noaaDat?.live && (
              <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease',
                fontSize: 10, color: C.muted, lineHeight: 1.7,
                padding: '4px 0',
              }}>
                NOAA ERDDAP currently unreachable.<br />
                Showing synthetic model data from SST engine.
              </div>
            )}
          </Card>

          {/* Active alerts */}
          <Card>
            <Label>Active Alerts ({alerts.length})</Label>
            {alerts.length === 0
              ? <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease', fontSize: 11, color: C.muted, padding: '6px 0' }}>No active heatwave alerts</div>
              : alerts.map(a => (
                  <div key={a.id}
                    className="alert-row"
                    onClick={() => handleSelect(a.id)}
                    style={{ transform: 'scale(1)', transition: 'all 0.3s ease',
                      display:        'flex',
                      justifyContent: 'space-between',
                      alignItems:     'center',
                      padding:        '8px 10px',
                      borderRadius:   7,
                      marginBottom:   5,
                      background:     a.severity === 'HIGH' ? 'rgba(255,34,68,0.07)' : 'rgba(255,170,0,0.07)',
                      border:         `1px solid ${a.severity === 'HIGH' ? C.red : C.amber}35`,
                      transition:     'filter .15s',
                    }}>
                    <div>
                      <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease', fontSize: 11, color: '#1E293B', marginBottom: 2 }}>{a.name}</div>
                      <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease', fontSize: 9, color: C.muted }}>
                        {signStr(a.anomaly)}°C anom · {a.events30} events (30d)
                      </div>
                    </div>
                    <SevBadge sev={a.severity} />
                  </div>
                ))
            }
          </Card>

          {/* Model performance */}
          <Card>
            <Label>Model Performance</Label>
            <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease', marginBottom: 12 }}>
              <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease', fontSize: 9, color: C.muted, marginBottom: 6 }}>RF CLASSIFIER</div>
              <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <StatTile label="ROC-AUC"    value={MODEL_METRICS.roc_auc.toFixed(4)}       color={C.purple} size={13} />
                <StatTile label="Avg Prec"   value={MODEL_METRICS.avg_precision.toFixed(4)} color={C.gold}  size={13} />
                <StatTile label="F1 Score"   value={MODEL_METRICS.f1.toFixed(4)}            color={C.gold}  size={13} />
                <StatTile label="MHW Rate"   value={`${MODEL_METRICS.mhw_pct}%`}            color={C.amber} size={13} />
              </div>
            </div>
            <div>
              <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease', fontSize: 9, color: C.muted, marginBottom: 6 }}>GB FORECASTER (SST)</div>
              <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                <StatTile label="MAE"  value={`${MODEL_METRICS.mae}°C`}  color={C.gold}  size={12} />
                <StatTile label="RMSE" value={`${MODEL_METRICS.rmse}°C`} color={C.gold}  size={12} />
                <StatTile label="R²"   value={MODEL_METRICS.r2.toFixed(4)} color={C.purple} size={12} />
              </div>
            </div>
            <div style={{ transform: 'scale(1)', transition: 'all 0.3s ease',
              marginTop: 10, padding: '9px 10px', borderRadius: 7,
              background: 'rgba(241,245,249,0.9)', border: `1px solid ${C.border}`,
              fontSize: 9, color: C.muted, lineHeight: 1.8,
            }}>
              {MODEL_METRICS.total_rows.toLocaleString()} rows ·{' '}
              {MODEL_METRICS.mhw_events} MHW events ·{' '}
              10 ocean stations · 2005–2022
            </div>
          </Card>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer style={{ transform: 'scale(1)', transition: 'all 0.3s ease',
        textAlign:   'center',
        padding:     '12px 24px 20px',
        borderTop:   `1px solid ${C.border}`,
        fontSize:    9,
        color:       C.muted,
        lineHeight:  1.9,
        letterSpacing:'.04em',
      }}>
        NOAA OISST v2.1 (ERDDAP coastwatch.pfeg.noaa.gov) · D3.js geoOrthographic Globe ·
        Random Forest Classifier (ROC-AUC {MODEL_METRICS.roc_auc}) ·
        Gradient Boosting Forecaster (R² {MODEL_METRICS.r2})
        <br />
        Hobday et al. (2016) MHW Definition · 90th-percentile threshold · ≥ 5 consecutive days · Recharts
      </footer>
    </div>
  )
}
