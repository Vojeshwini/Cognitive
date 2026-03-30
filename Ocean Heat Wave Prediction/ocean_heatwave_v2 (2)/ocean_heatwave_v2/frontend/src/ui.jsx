/**
 * Shared UI primitives — Gold + Orange + Purple theme
 */

export const C = {
  bg:        '#F3F4F6',
  panel:     'rgba(255,255,255,0.93)',
  border:    'rgba(0,0,0,0.08)',
  gold:      '#D97706',
  goldDim:   'rgba(217,119,6,0.2)',
  orange:    '#EA580C',
  orangeDim: 'rgba(234,88,12,0.2)',
  purple:    '#2563EB',
  purpleDim: 'rgba(37,99,235,0.2)',
  lavender:  '#64748B',
  teal:      '#0D9488',
  green:     '#16A34A',
  red:       '#DC2626',
  amber:     '#D97706',
  text:      '#1E293B',
  muted:     '#64748B',
}

export function Card({ children, style = {} }) {
  return (
    <div style={{
      background:    C.panel,
      border:        `1px solid ${C.border}`,
      borderRadius:  12,
      padding:       '14px 16px',
      backdropFilter:'blur(12px)',
      transition:    'box-shadow 0.25s, border-color 0.25s',
      ...style,
    }}
    onMouseEnter={e => {
      e.currentTarget.style.boxShadow = `0 0 24px rgba(100,150,255,0.15)`
      e.currentTarget.style.borderColor = 'rgba(120,170,255,0.3)'
    }}
    onMouseLeave={e => {
      e.currentTarget.style.boxShadow = 'none'
      e.currentTarget.style.borderColor = C.border
    }}
    >
      {children}
    </div>
  )
}

export function Label({ children, color = C.muted }) {
  return (
    <div style={{
      fontSize:      10,
      fontFamily:    "'Space Mono', monospace",
      color,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      marginBottom:  6,
    }}>
      {children}
    </div>
  )
}

export function SevBadge({ sev }) {
  const col = sev === 'HIGH' ? C.orange : sev === 'MODERATE' ? C.gold : C.purple
  return (
    <span style={{
      background:    col + '22',
      color:         col,
      border:        `1px solid ${col}66`,
      borderRadius:  4,
      padding:       '2px 8px',
      fontSize:      10,
      fontFamily:    "'Space Mono', monospace",
      fontWeight:    'bold',
      letterSpacing: '0.06em',
      textShadow:    `0 0 8px ${col}88`,
    }}>
      {sev}
    </span>
  )
}

export function StatTile({ label, value, color = C.text, accent = C.border, size = 16 }) {
  return (
    <div style={{
      background:   'rgba(241,245,249,0.9)',
      borderRadius: 8,
      padding:      '8px 10px',
      border:       `1px solid ${accent}`,
      transition:   'transform 0.18s, box-shadow 0.18s',
      cursor:       'default',
    }}
    onMouseEnter={e => {
      e.currentTarget.style.transform = 'translateY(-2px)'
      e.currentTarget.style.boxShadow = `0 4px 18px ${color}28`
    }}
    onMouseLeave={e => {
      e.currentTarget.style.transform = 'none'
      e.currentTarget.style.boxShadow = 'none'
    }}
    >
      <div style={{ fontSize: 9, color: C.muted, marginBottom: 3, letterSpacing: '.07em' }}>{label}</div>
      <div style={{ fontSize: size, fontWeight: 'bold', color, textShadow: `0 0 10px ${color}55` }}>{value}</div>
    </div>
  )
}

export function SSTTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background:   'rgba(255,255,255,0.97)',
      border:       `1px solid ${C.border}`,
      borderRadius: 8,
      padding:      '8px 12px',
      fontSize:     11,
      fontFamily:   "'Space Mono', monospace",
      boxShadow:    `0 4px 24px rgba(100,150,255,0.22)`,
    }}>
      <div style={{ color: C.muted, marginBottom: 4 }}>{label}</div>
      {payload.map(p => p.value != null && (
        <div key={p.name} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}:{' '}
          <span style={{ color: '#1E293B', fontWeight: 'bold' }}>{p.value}°C</span>
        </div>
      ))}
    </div>
  )
}

export function BarTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const v = payload[0]
  return (
    <div style={{
      background:   'rgba(255,255,255,0.97)',
      border:       `1px solid ${C.border}`,
      borderRadius: 8,
      padding:      '8px 12px',
      fontSize:     11,
      fontFamily:   "'Space Mono', monospace",
      boxShadow:    `0 4px 24px rgba(100,150,255,0.22)`,
    }}>
      <div style={{ color: '#1E293B' }}>{v.payload.name}</div>
      <div style={{ color: C.gold }}>Importance: {(v.value * 100).toFixed(1)}%</div>
    </div>
  )
}

export function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{
      borderBottom: `1px solid ${C.border}`,
      padding:      '0 16px',
      display:      'flex',
      gap:          2,
    }}>
      {tabs.map(t => (
        <button key={t.key}
          onClick={() => onChange(t.key)}
          style={{
            background:   t.key === active ? 'rgba(245,200,66,0.08)' : 'transparent',
            color:        t.key === active ? C.gold : C.muted,
            border:       'none',
            borderBottom: t.key === active ? `2px solid ${C.gold}` : '2px solid transparent',
            padding:      '10px 14px',
            cursor:       'pointer',
            fontSize:     10,
            fontFamily:   "'Space Mono', monospace",
            letterSpacing:'.08em',
            textTransform:'uppercase',
            fontWeight:   t.key === active ? 'bold' : 'normal',
            transition:   'all .18s',
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
