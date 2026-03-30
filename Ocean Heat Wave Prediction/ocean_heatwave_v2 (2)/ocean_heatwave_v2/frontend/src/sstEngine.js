/**
 * Synthetic SST Engine
 * Mirrors ocean_heatwave_prediction/data_generator.py + preprocessor.py
 *
 * Physics components:
 *   • Latitude-dependent base temperature
 *   • Annual + semi-annual seasonal signal
 *   • ENSO quasi-periodic oscillation (3–7 year cycle)
 *   • Linear anthropogenic warming trend (0.022°C/year)
 *   • Hobday et al. (2016) MHW detection (90th percentile, ≥5 days)
 *   • 14-day GB Forecaster simulation
 */

// ── Seeded PRNG (xorshift32) ───────────────────────────────────────────────
export function seededRng(seed) {
  let s = (seed >>> 0) || 1
  return () => {
    s ^= s << 13; s ^= s >> 17; s ^= s << 5
    return (s >>> 0) / 0xffffffff
  }
}

// ── Seasonal signal ────────────────────────────────────────────────────────
function seasonalSignal(doy, lat) {
  const amp         = 4.5 * Math.abs(lat) / 60
  const phaseShift  = lat < 0 ? Math.PI : 0
  const annual      = amp * Math.sin(2 * Math.PI * doy / 365.25 - Math.PI / 2 + phaseShift)
  const semiAnnual  = amp * 0.2 * Math.sin(4 * Math.PI * doy / 365.25)
  return annual + semiAnnual
}

// ── ENSO signal ────────────────────────────────────────────────────────────
function ensoSignal(t, seed) {
  const rng  = seededRng(seed)
  const p1   = 365.25 * (3.5 + (rng() - 0.5))
  const p2   = 365.25 * (5.5 + (rng() - 0.5))
  const phi1 = rng() * 2 * Math.PI
  const phi2 = rng() * 2 * Math.PI
  return 1.8 * (
    0.6 * Math.sin(2 * Math.PI * t / p1 + phi1) +
    0.4 * Math.sin(2 * Math.PI * t / p2 + phi2)
  )
}

// ── Warming trend ──────────────────────────────────────────────────────────
const WARM_RATE = 0.022 / 365   // °C per day

// ── MHW pulse injection (mirrors data_generator._heatwave_events) ──────────
function buildMHWSignal(n, seed) {
  const rng    = seededRng(seed + 99)
  const signal = new Float64Array(n)
  const nEvts  = Math.floor((n / 365) * 3)
  for (let k = 0; k < nEvts; k++) {
    const start    = Math.floor(rng() * (n - 90))
    const duration = Math.floor(rng() * 55) + 5
    const peak     = rng() * 2.0 + 1.5
    const window   = Math.min(duration, n - start)
    for (let j = 0; j < window; j++) {
      const t = j / window
      const hann = 0.5 * (1 - Math.cos(2 * Math.PI * t))
      signal[start + j] += hann * peak
    }
  }
  return signal
}

// ── Climatology (rolling 30-day DOY mean) ─────────────────────────────────
function computeClimatology(sstArr, doyArr) {
  const clim = new Float64Array(sstArr.length)
  for (let i = 0; i < sstArr.length; i++) {
    const doy = doyArr[i]
    let sum = 0, cnt = 0
    for (let j = 0; j < sstArr.length; j++) {
      const diff = Math.abs(doyArr[j] - doy)
      const wrap = Math.min(diff, 365 - diff)
      if (wrap <= 15) { sum += sstArr[j]; cnt++ }
    }
    clim[i] = cnt ? sum / cnt : sstArr[i]
  }
  return clim
}

// ── 90th-percentile MHW labelling (Hobday 2016) ──────────────────────────
function labelMHW(anomArr, minDuration = 5, pctile = 90) {
  const sorted  = [...anomArr].sort((a, b) => a - b)
  const thresh  = sorted[Math.floor(sorted.length * pctile / 100)]
  const isMHW   = new Uint8Array(anomArr.length)
  let   inEvent = false, start = 0

  for (let i = 0; i <= anomArr.length; i++) {
    const above = i < anomArr.length && anomArr[i] >= thresh
    if (above && !inEvent) { inEvent = true; start = i }
    if (!above && inEvent) {
      inEvent = false
      if (i - start >= minDuration) {
        for (let k = start; k < i; k++) isMHW[k] = 1
      }
    }
  }
  return { isMHW, threshold: thresh }
}

// ── Main SST builder ───────────────────────────────────────────────────────
/**
 * Build a full SST time series for one ocean station.
 *
 * @param {number} locId   Station index (0-9)
 * @param {number} lat     Latitude
 * @param {number} lon     Longitude (unused — reserved for spatial features)
 * @param {number} daysBack Days of history to generate
 * @returns {Array<Object>} Per-day records
 */
export function buildSST(locId, lat, _lon, daysBack = 400) {
  const seed = 42 + locId * 31
  const rng  = seededRng(seed)
  const base = Math.max(-2, Math.min(32, 22 - 0.28 * Math.abs(lat)))

  const total    = daysBack + 14   // +14 forecast days
  const nowMs    = Date.now()
  const startMs  = nowMs - daysBack * 86_400_000
  const mhwSig   = buildMHWSignal(total, seed)

  // First pass: raw SST
  const rawSST = new Float64Array(total)
  const doyArr = new Int32Array(total)
  for (let i = 0; i < total; i++) {
    const d    = new Date(startMs + i * 86_400_000)
    const doy  = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86_400_000)
    doyArr[i]  = doy
    const seas = seasonalSignal(doy, lat)
    const enso = ensoSignal(i, seed)
    const trend= WARM_RATE * i
    const noise= (rng() - 0.5) * 0.9
    rawSST[i]  = Math.max(-2, Math.min(35, base + seas + enso + trend + mhwSig[i] + noise))
  }

  // Climatology + anomaly (only over historical portion)
  const histSST  = rawSST.subarray(0, daysBack)
  const histDOY  = doyArr.subarray(0, daysBack)
  const climHist = computeClimatology(histSST, histDOY)
  const anomHist = histSST.map((v, i) => v - climHist[i])
  const { isMHW, threshold } = labelMHW(anomHist)

  // Build result array
  const result = []
  for (let i = 0; i < total; i++) {
    const date      = new Date(startMs + i * 86_400_000).toISOString().slice(0, 10)
    const isForecast= i >= daysBack
    const sst       = rawSST[i]
    const clim      = isForecast
      ? seasonalSignal(doyArr[i], lat) + base
      : climHist[i]
    const anom      = sst - clim
    const mhwActive = !isForecast && isMHW[i] === 1
    const mhwProb   = isForecast
      ? Math.max(0, Math.min(1, (anom - threshold * 0.6) * 0.55 + 0.45))
      : null

    result.push({
      date,
      sst:       isForecast ? null  : +sst.toFixed(2),
      forecast:  isForecast ? +sst.toFixed(2) : null,
      clim:      +clim.toFixed(2),
      anomaly:   isForecast ? null  : +anom.toFixed(2),
      isMHW:     mhwActive,
      mhwMark:   mhwActive ? +sst.toFixed(2) : null,
      mhwProb,
      threshold: +threshold.toFixed(2),
    })
  }
  return result
}

// ── Per-location summary metrics ───────────────────────────────────────────
export function locMetrics(id) {
  const rng   = seededRng(id * 97 + 13)
  const anom  = (rng() - 0.28) * 4.5
  const sst   = +(15 + rng() * 18).toFixed(1)
  const trend = +((rng() - 0.45) * 1.4).toFixed(2)
  const prob  = +Math.max(0, Math.min(1, anom * 0.32 + 0.38)).toFixed(2)
  return {
    sst,
    anomaly:  +anom.toFixed(2),
    trend7d:  trend,
    mhwProb:  prob,
    severity: anom > 2.2 ? 'HIGH' : anom > 1.0 ? 'MODERATE' : 'NORMAL',
    events30: Math.floor(rng() * 4),
  }
}

// ── Seasonality aggregation ────────────────────────────────────────────────
export function computeSeasonality(sstData) {
  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const buckets = Array.from({ length: 12 }, () => ({ vals: [], mhw: 0, total: 0 }))
  sstData.filter(d => d.sst != null).forEach(d => {
    const m = parseInt(d.date.slice(5, 7), 10) - 1
    buckets[m].vals.push(d.sst)
    buckets[m].total++
    if (d.isMHW) buckets[m].mhw++
  })
  return buckets.map((b, i) => {
    const avg = b.vals.length
      ? b.vals.reduce((a, v) => a + v, 0) / b.vals.length
      : 0
    return {
      month:   MONTH_NAMES[i],
      sst:     +avg.toFixed(2),
      mhwFreq: b.total ? +(b.mhw / b.total * 100).toFixed(1) : 0,
    }
  })
}
