/**
 * NOAA ERDDAP API — erdBAssta5day (AVHRR SST 5-day composite)
 * Dataset: https://coastwatch.pfeg.noaa.gov/erddap/griddap/erdBAssta5day
 *
 * CORS: NOAA ERDDAP supports CORS for .json requests.
 * Vite proxies /erddap → coastwatch.pfeg.noaa.gov in dev.
 */

const ERDDAP_BASE = import.meta.env.DEV
  ? '/erddap'
  : 'https://coastwatch.pfeg.noaa.gov/erddap'

const DATASET = 'ncdcOisst21Agg_LonPM180'

/**
 * Fetch recent SST from NOAA ncdcOisst21Agg_LonPM180 for a lat/lon point.
 * Returns null on failure — callers fall back to synthetic data.
 *
 * @param {number} lat  Latitude  (-89.99 to 89.99)
 * @param {number} lon  Longitude (-179.99 to 180.0)
 * @param {number} days Number of historical days (default 30 — 5-day dataset ≈ 6 obs)
 */
export async function fetchNOAAPoint(lat, lon, days = 30) {
  const now      = new Date()
  const startMs  = Date.now() - days * 86_400_000

  const fmt = (ms) => {
    const d = new Date(ms)
    return d.toISOString().slice(0, 19) + 'Z'
  }

  // Clamp to dataset bounds
  const latQ = Math.max(-89.99, Math.min(89.99, lat)).toFixed(2)
  const lonQ = Math.max(-179.99, Math.min(180.0, lon)).toFixed(2)

  const url =
    `${ERDDAP_BASE}/griddap/${DATASET}.json` +
    `?sst[(last-${days}):1:(last)][0:1:0][(${latQ}):1:(${latQ})][(${lonQ}):1:(${lonQ})]`

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(16_000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const json = await res.json()
    const rows = json?.table?.rows ?? []

    // Column order: time, latitude, longitude, sst
    const valid = rows
      .map(r => ({ date: String(r[0]).slice(0, 10), sst: r[4] }))
      .filter(r => r.sst != null && !isNaN(r.sst) && r.sst > -2 && r.sst < 35)

    if (!valid.length) throw new Error('No valid SST values')

    const temps = valid.map(r => r.sst)
    return {
      source:    'NOAA OISST v2.1',
      live:      true,
      latest:    +temps.at(-1).toFixed(2),
      min:       +Math.min(...temps).toFixed(2),
      max:       +Math.max(...temps).toFixed(2),
      weekTrend: +(temps.at(-1) - temps[0]).toFixed(2),
      n:         valid.length,
      range:     `${valid[0].date} → ${valid.at(-1).date}`,
      series:    valid.map(r => ({ date: r.date, sst: +r.sst.toFixed(2) })),
    }
  } catch (err) {
    // Silently fail — caller uses synthetic fallback
    return null
  }
}

/**
 * Fetch global SST snapshot — uses the provided NOAA URL with (last) time.
 * Returns array of {lat, lon, sst} for heatmap rendering.
 * Subsampled to keep payload manageable.
 */
export async function fetchNOAAGlobalSnapshot(stride = 10) {
  // Use backend proxy to avoid CORS issues with CSV endpoint
  try {
    const res = await fetch('/api/real-data', { signal: AbortSignal.timeout(30_000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    // Subsample by stride
    return data.filter((_, i) => i % stride === 0)
  } catch {
    return null
  }
}

/**
 * Fetch 30-day regional anomaly stats.
 */
export async function fetchNOAARegionAnomalies(latMin, latMax, lonMin, lonMax) {
  const fmt  = (ms) => new Date(ms).toISOString().slice(0, 19) + 'Z'
  const start = fmt(Date.now() - 30 * 86_400_000)
  const end   = fmt(Date.now())

  const lat0 = Math.max(-89.99, latMin).toFixed(2)
  const lat1 = Math.min(89.99, latMax).toFixed(2)
  const lon0 = Math.max(-179.99, lonMin).toFixed(2)
  const lon1 = Math.min(180.0, lonMax).toFixed(2)

  const url =
    `${ERDDAP_BASE}/griddap/${DATASET}.json` +
    `?sst[(last-30):1:(last)][0:1:0][(${lat0}):1:(${lat1})][(${lon0}):1:(${lon1})]`

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const json  = await res.json()
    const temps = (json?.table?.rows ?? [])
      .map(r => r[4])
      .filter(v => v != null && !isNaN(v) && v > -2 && v < 35)

    if (!temps.length) throw new Error('empty')

    const mean = temps.reduce((a, b) => a + b, 0) / temps.length
    return {
      mean:  +mean.toFixed(2),
      min:   +Math.min(...temps).toFixed(2),
      max:   +Math.max(...temps).toFixed(2),
      count: temps.length,
      live:  true,
    }
  } catch {
    return null
  }
}
