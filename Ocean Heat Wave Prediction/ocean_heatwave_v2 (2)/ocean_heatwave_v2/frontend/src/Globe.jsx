/**
 * Globe.jsx  —  D3 geoOrthographic canvas globe
 * Theme: Gold (HIGH) · Orange (MODERATE) · Purple (NORMAL)
 * Features: auto-rotate, drag-to-orbit, pulsing severity rings, hover labels
 */

import { useEffect, useRef, useCallback } from 'react'
import * as d3 from 'd3'

const C = {
  gold:   '#F5C842',
  orange: '#FF6B35',
  purple: '#BE6DFF',
}

export default function Globe({ locations, metrics, selectedId, onSelect }) {
  const cvs    = useRef(null)
  const world  = useRef(null)
  const rot    = useRef([12, -22, 0])
  const drag   = useRef(false)
  const last   = useRef(null)
  const frame  = useRef(null)
  const pulse  = useRef(0)
  const hoverI = useRef(null)

  useEffect(() => {
    Promise.all([
      fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json').then(r => r.json()),
      import('topojson-client'),
    ]).then(([topo, tj]) => {
      world.current = {
        land:      tj.feature(topo, topo.objects.land),
        countries: tj.feature(topo, topo.objects.countries),
      }
    }).catch(() => {})
  }, [])

  const draw = useCallback(() => {
    const el = cvs.current
    if (!el) return
    const ctx = el.getContext('2d')
    const W = el.width, H = el.height
    const cx = W / 2, cy = H / 2
    const R  = Math.min(W, H) * 0.43
    const p  = (pulse.current++ % 120) / 120

    const proj = d3.geoOrthographic()
      .scale(R).translate([cx, cy])
      .rotate(rot.current).clipAngle(90)
    const path = d3.geoPath().projection(proj).context(ctx)

    ctx.clearRect(0, 0, W, H)

    // Outer warm halo — gold/amber glow
    const halo = ctx.createRadialGradient(cx, cy, R * 0.85, cx, cy, R * 1.4)
    halo.addColorStop(0, 'rgba(245,180,50,0.09)')
    halo.addColorStop(0.5, 'rgba(100,150,255,0.06)')
    halo.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.beginPath(); ctx.arc(cx, cy, R * 1.4, 0, 2 * Math.PI)
    ctx.fillStyle = halo; ctx.fill()

    // Ocean sphere — very light blue-grey
    const ocean = ctx.createRadialGradient(cx - R * 0.25, cy - R * 0.22, 0, cx, cy, R)
    ocean.addColorStop(0,   '#e2e8f0')
    ocean.addColorStop(0.45,'#cbd5e1')
    ocean.addColorStop(1,   '#94a3b8')
    ctx.beginPath(); path({ type: 'Sphere' })
    ctx.fillStyle = ocean; ctx.fill()

    // Graticule — subtle grey
    ctx.beginPath(); path(d3.geoGraticule().step([30, 30])())
    ctx.strokeStyle = 'rgba(0,0,0,0.1)'; ctx.lineWidth = 0.5; ctx.stroke()

    // Tropic / polar circles
    ;[23.5, -23.5, 66.5, -66.5].forEach(lat => {
      const pts = Array.from({ length: 361 }, (_, i) => [i - 180, lat])
      ctx.beginPath(); path({ type: 'LineString', coordinates: pts })
      ctx.strokeStyle = 'rgba(245,180,50,0.07)'; ctx.lineWidth = 0.45; ctx.stroke()
    })

    // Land — light grey-white
    if (world.current) {
      ctx.beginPath(); path(world.current.land)
      const lg = ctx.createLinearGradient(0, 0, W, H)
      lg.addColorStop(0, '#ffffff'); lg.addColorStop(1, '#f1f5f9')
      ctx.fillStyle = lg; ctx.fill()

      ctx.beginPath(); path(world.current.countries)
      ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 0.35; ctx.stroke()
    }

    // Globe rim — gold to purple gradient
    ctx.beginPath(); path({ type: 'Sphere' })
    const rim = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R)
    rim.addColorStop(0,   'rgba(245,200,66,0.75)')
    rim.addColorStop(0.4, 'rgba(255,107,53,0.4)')
    rim.addColorStop(1,   'rgba(100,150,255,0.6)')
    ctx.strokeStyle = rim; ctx.lineWidth = 2; ctx.stroke()

    // Station markers
    locations.forEach(loc => {
      const m    = metrics[loc.id] || {}
      const sev  = m.severity || 'NORMAL'
      const sel  = loc.id === selectedId
      const hov  = loc.id === hoverI.current
      const dist = d3.geoDistance([loc.lon, loc.lat], [-rot.current[0], -rot.current[1]])
      if (dist > Math.PI / 2 + 0.08) return

      const [px, py] = proj([loc.lon, loc.lat]) || []
      if (!px || !py) return

      const fade  = Math.max(0, 1 - (dist / (Math.PI / 2)) ** 2.2)
      const color = sev === 'HIGH' ? C.gold : sev === 'MODERATE' ? C.orange : C.purple
      const br    = (sev === 'HIGH' ? 9 : sev === 'MODERATE' ? 7.5 : 5.5) * (sel || hov ? 1.25 : 1)

      // Animated pulse rings
      if (sev !== 'NORMAL') {
        for (let k = 0; k < 3; k++) {
          const t     = ((p + k / 3) % 1)
          const alpha = Math.floor((1 - t) * fade * 180).toString(16).padStart(2, '0')
          ctx.beginPath()
          ctx.arc(px, py, br * (1 + t * 3.2), 0, 2 * Math.PI)
          ctx.strokeStyle = `${color}${alpha}`
          ctx.lineWidth   = 1.6 - t
          ctx.stroke()
        }
      } else if (hov || sel) {
        // gentle pulse for NORMAL when hovered/selected
        const t = (p % 1)
        ctx.beginPath()
        ctx.arc(px, py, br * (1 + t * 2.5), 0, 2 * Math.PI)
        ctx.strokeStyle = `${color}${Math.floor((1-t)*fade*100).toString(16).padStart(2,'0')}`
        ctx.lineWidth = 1; ctx.stroke()
      }

      // Selection / hover rings
      if (sel) {
        ctx.beginPath(); ctx.arc(px, py, br + 9, 0, 2 * Math.PI)
        ctx.strokeStyle = `rgba(15,23,42,${fade * 0.4})`; ctx.lineWidth = 2; ctx.stroke()
        ctx.beginPath(); ctx.arc(px, py, br + 15, 0, 2 * Math.PI)
        ctx.strokeStyle = `${color}${Math.floor(fade * 0.28 * 255).toString(16).padStart(2,'0')}`
        ctx.lineWidth = 1; ctx.stroke()
      } else if (hov) {
        ctx.beginPath(); ctx.arc(px, py, br + 6, 0, 2 * Math.PI)
        ctx.strokeStyle = `rgba(15,23,42,${fade * 0.3})`; ctx.lineWidth = 1.5; ctx.stroke()
      }

      // Core dot with radial gradient
      const dg = ctx.createRadialGradient(px - br * 0.3, py - br * 0.35, 0.5, px, py, br)
      dg.addColorStop(0, color + 'ff')
      dg.addColorStop(0.65, color + 'cc')
      dg.addColorStop(1, color + '18')
      ctx.beginPath(); ctx.arc(px, py, br, 0, 2 * Math.PI)
      ctx.fillStyle = dg; ctx.fill()

      // Label
      ctx.save()
      ctx.globalAlpha = fade * (sel || hov ? 1 : 0.82)
      ctx.fillStyle   = color
      ctx.font        = `${sel || hov ? 'bold 10.5px' : '9px'} 'Space Mono', 'Courier New', monospace`
      ctx.shadowColor = color; ctx.shadowBlur = sel || hov ? 12 : 7
      ctx.fillText(loc.name, px + br + 5, py + 3.5)
      ctx.restore()
    })

    if (!drag.current) {
      rot.current = [rot.current[0] + 0.08, rot.current[1], rot.current[2]]
    }
    frame.current = requestAnimationFrame(draw)
  }, [locations, metrics, selectedId])

  useEffect(() => {
    frame.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame.current)
  }, [draw])

  const getXY = (e) => {
    if (e.touches) return [e.touches[0].clientX, e.touches[0].clientY]
    return [e.clientX, e.clientY]
  }
  const onDown = (e) => { drag.current = true; last.current = getXY(e); e.preventDefault() }
  const onMove = (e) => {
    if (!drag.current) return
    const [x, y] = getXY(e), [lx, ly] = last.current
    rot.current = [
      rot.current[0] + (x - lx) * 0.38,
      Math.max(-82, Math.min(82, rot.current[1] - (y - ly) * 0.38)),
      rot.current[2],
    ]
    last.current = [x, y]
  }
  const onUp = () => { drag.current = false }

  const onMouseMove = (e) => {
    const el = cvs.current; if (!el) return
    const rect = el.getBoundingClientRect()
    const mx = (e.clientX - rect.left) * (el.width / rect.width)
    const my = (e.clientY - rect.top)  * (el.height / rect.height)
    const R  = Math.min(el.width, el.height) * 0.43
    const proj = d3.geoOrthographic()
      .scale(R).translate([el.width / 2, el.height / 2])
      .rotate(rot.current).clipAngle(90)
    let best = null, bDist = 26
    locations.forEach(l => {
      const [px, py] = proj([l.lon, l.lat]) || []
      if (!px) return
      const d = Math.hypot(mx - px, my - py)
      if (d < bDist) { bDist = d; best = l.id }
    })
    if (best !== hoverI.current) { hoverI.current = best }
    el.style.cursor = best !== null ? 'pointer' : 'grab'
  }

  const onClick = (e) => {
    const el = cvs.current; if (!el) return
    const rect = el.getBoundingClientRect()
    const mx = (e.clientX - rect.left) * (el.width / rect.width)
    const my = (e.clientY - rect.top)  * (el.height / rect.height)
    const R  = Math.min(el.width, el.height) * 0.43
    const proj = d3.geoOrthographic()
      .scale(R).translate([el.width / 2, el.height / 2])
      .rotate(rot.current).clipAngle(90)
    let best = null, bDist = 26
    locations.forEach(l => {
      const [px, py] = proj([l.lon, l.lat]) || []
      if (!px) return
      const d = Math.hypot(mx - px, my - py)
      if (d < bDist) { bDist = d; best = l.id }
    })
    if (best !== null) onSelect(best)
  }

  return (
    <canvas
      ref={cvs}
      width={520} height={520}
      style={{ width: '100%', height: '100%', display: 'block', cursor: 'grab', borderRadius: '50%',
               filter: 'drop-shadow(0 0 28px rgba(0,0,0,0.12))' }}
      onMouseDown={onDown} onMouseMove={(e) => { onMove(e); onMouseMove(e) }}
      onMouseUp={onUp} onMouseLeave={() => { onUp(); hoverI.current = null }}
      onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}
      onClick={onClick}
      title="Drag to rotate · Click marker to select station"
    />
  )
}
