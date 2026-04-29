// Trajectory — shared components
// All primitives for the prototype. Dark theme only.
// T is a runtime-mutable theme object — App swaps its properties based on Tweaks.

const T = {
  bg: '#0d0f12',
  surface: '#15181d',
  surface2: '#1c2026',
  surface3: '#242932',
  line: 'rgba(255,255,255,0.06)',
  line2: 'rgba(255,255,255,0.09)',
  text: '#f4ede2',
  textDim: 'rgba(244,237,226,0.62)',
  textDim2: 'rgba(244,237,226,0.38)',
  amber: '#ff8c42',
  amberDim: 'rgba(255,140,66,0.14)',
  amberLine: 'rgba(255,140,66,0.28)',
  amberGlow: 'rgba(255,140,66,0.30)',
  teal: '#66c7c2', // muted data-viz secondary
  tealDim: 'rgba(102,199,194,0.18)',
  _mood: { buttonPunch: 1.0, shadowAlpha: 0.25, tileOverlay: 'balanced' },
};

// Density context (grid, spacing, type)
const DensityCtx = React.createContext({
  gridCols: 2, tileAspect: '4 / 3', tilePad: 12, gap: 12,
  radius: 16, titleSize: 14, showMeta: 'full',
});
const useDensity = () => React.useContext(DensityCtx);

// ── Icons (lucide-style, 1.5 stroke) ─────────────────────────
const Icon = {
  plus: (s=24,c='currentColor') => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>,
  minus:(s=24,c='currentColor') => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/></svg>,
  chevR:(s=18,c='currentColor') => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6"/></svg>,
  chevL:(s=18,c='currentColor') => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6"/></svg>,
  chevD:(s=16,c='currentColor') => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>,
  check:(s=18,c='currentColor') => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7"/></svg>,
  home: (s=22,c='currentColor') => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-7h-6v7H4a1 1 0 01-1-1v-9z"/></svg>,
  hist: (s=22,c='currentColor') => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/></svg>,
  chart:(s=22,c='currentColor') => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 5-7"/></svg>,
  gear: (s=22,c='currentColor') => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.8l-.1-.1A2 2 0 117 4.3l.1.1a1.7 1.7 0 001.8.3h.1a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1A2 2 0 1119.7 7l-.1.1a1.7 1.7 0 00-.3 1.8v.1a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/></svg>,
  filt: (s=18,c='currentColor') => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 4h18l-7 9v6l-4-2v-4L3 4z"/></svg>,
  ellipsis:(s=20,c='currentColor') => <svg width={s} height={s} viewBox="0 0 24 24" fill={c}><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>,
  download:(s=18,c='currentColor') => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v13M6 11l6 6 6-6M4 21h16"/></svg>,
  timer:(s=18,c='currentColor') => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/></svg>,
  camera:(s=20,c='currentColor') => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h3l2-2h6l2 2h3a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V8a1 1 0 011-1z"/><circle cx="12" cy="13" r="3.5"/></svg>,
  trash:(s=18,c='currentColor') => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13M9 7V4h6v3"/></svg>,
  copy:(s=18,c='currentColor') => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/></svg>,
  close:(s=20,c='currentColor') => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.75" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>,
  zap:(s=16,c='currentColor') => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/></svg>,
  search:(s=18,c='currentColor') => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.5-4.5"/></svg>,
};

// ── Equipment glyph placeholder ─────────────────────────────
// Abstract, schematic icons — not photos, not brand marks.
function EquipmentGlyph({ kind, size = 1, tint = T.amber }) {
  const style = { width: '100%', height: '100%', display: 'block' };
  const stroke = 'rgba(244,237,226,0.85)';
  const accent = tint;
  const s = { stroke: stroke, strokeWidth: 1.5, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };
  const a = { stroke: accent, strokeWidth: 1.75, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };
  const svgs = {
    legpress:   <svg viewBox="0 0 80 60" style={style}><path d="M8 48h44" {...s}/><path d="M12 48v-8h36v8" {...s}/><path d="M50 20l18-6v20l-18-6z" {...a}/><path d="M52 26l-6 4v8" {...s}/><circle cx="52" cy="14" r="3" {...s}/></svg>,
    cable:      <svg viewBox="0 0 80 60" style={style}><path d="M12 6v46" {...s}/><path d="M12 6h28" {...s}/><path d="M40 6v10c0 4-4 6-8 8l-10 6" {...a}/><rect x="18" y="32" width="16" height="6" rx="2" {...s}/><path d="M46 48h26" {...s}/></svg>,
    pulldown:   <svg viewBox="0 0 80 60" style={style}><path d="M10 10h60" {...s}/><path d="M40 10v12" {...a}/><path d="M26 22h28" {...a}/><path d="M40 22v10" {...a}/><rect x="30" y="40" width="20" height="8" rx="2" {...s}/><path d="M14 54h52" {...s}/></svg>,
    smith:      <svg viewBox="0 0 80 60" style={style}><path d="M14 6v48" {...s}/><path d="M66 6v48" {...s}/><path d="M14 28h52" {...a}/><circle cx="20" cy="28" r="4" {...s}/><circle cx="60" cy="28" r="4" {...s}/><path d="M18 54h44" {...s}/></svg>,
    bench:      <svg viewBox="0 0 80 60" style={style}><path d="M8 28h64" {...a}/><circle cx="14" cy="28" r="6" {...s}/><circle cx="66" cy="28" r="6" {...s}/><rect x="26" y="34" width="28" height="6" rx="2" {...s}/><path d="M30 40v12M50 40v12" {...s}/></svg>,
    squat:      <svg viewBox="0 0 80 60" style={style}><path d="M16 6v48M64 6v48" {...s}/><path d="M16 20h48" {...s}/><path d="M8 34h64" {...a}/><circle cx="14" cy="34" r="5" {...s}/><circle cx="66" cy="34" r="5" {...s}/></svg>,
    preacher:   <svg viewBox="0 0 80 60" style={style}><path d="M14 50v-20l12-8h14" {...s}/><path d="M40 22h10l6 6" {...s}/><path d="M20 50h36" {...s}/><circle cx="62" cy="14" r="4" {...a}/><circle cx="62" cy="36" r="4" {...a}/><path d="M62 18v14" {...a}/></svg>,
    chestpress: <svg viewBox="0 0 80 60" style={style}><rect x="18" y="14" width="16" height="32" rx="3" {...s}/><path d="M34 22l14-4v20l-14-4" {...a}/><circle cx="52" cy="28" r="3" {...s}/><path d="M12 52h46" {...s}/></svg>,
    treadmill:  <svg viewBox="0 0 80 60" style={style}><path d="M10 42l50-14" {...a}/><path d="M10 42h50" {...s}/><path d="M60 28v18" {...s}/><path d="M60 28l8-12v30" {...s}/><circle cx="16" cy="46" r="3" {...s}/><circle cx="54" cy="46" r="3" {...s}/></svg>,
    bike:       <svg viewBox="0 0 80 60" style={style}><circle cx="22" cy="40" r="10" {...s}/><circle cx="58" cy="40" r="10" {...a}/><path d="M22 40l14-16h10l12 16" {...s}/><path d="M36 24v-8h8" {...s}/></svg>,
    rower:      <svg viewBox="0 0 80 60" style={style}><path d="M8 36h64" {...a}/><circle cx="14" cy="36" r="3" {...s}/><circle cx="66" cy="36" r="3" {...s}/><path d="M22 36l18-10h6l10 10" {...s}/><path d="M46 26l14-14" {...s}/></svg>,
  };
  return svgs[kind] || svgs.bench;
}

// ── Thumb-friendly pressable ────────────────────────────────
function Press({ children, style, onClick, onPointerDown, onPointerUp, disabled, as='button', ...rest }) {
  const [pressed, setPressed] = React.useState(false);
  const Tag = as;
  return (
    <Tag
      onPointerDown={(e) => { setPressed(true); onPointerDown && onPointerDown(e); }}
      onPointerUp={(e) => { setPressed(false); onPointerUp && onPointerUp(e); }}
      onPointerLeave={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        border: 'none', background: 'none', color: 'inherit',
        font: 'inherit', cursor: disabled ? 'not-allowed' : 'pointer',
        padding: 0, margin: 0, textAlign: 'left',
        transform: pressed ? 'scale(0.96)' : 'scale(1)',
        transition: 'transform 120ms cubic-bezier(0.2, 0.8, 0.2, 1), background-color 120ms, border-color 120ms, opacity 120ms',
        opacity: disabled ? 0.5 : 1,
        WebkitTapHighlightColor: 'transparent',
        ...style,
      }}
      {...rest}
    >{children}</Tag>
  );
}

// ── Quick-pick chip ─────────────────────────────────────────
function Chip({ active, children, onClick, tone='neutral' }) {
  const bg = active
    ? (tone === 'amber' ? T.amberDim : 'rgba(244,237,226,0.10)')
    : 'transparent';
  const border = active
    ? (tone === 'amber' ? T.amberLine : 'rgba(244,237,226,0.18)')
    : 'rgba(244,237,226,0.12)';
  const color = active && tone === 'amber' ? T.amber : T.text;
  return (
    <Press onClick={onClick} style={{
      minHeight: 44, padding: '10px 14px', borderRadius: 999,
      background: bg, border: `1px solid ${border}`, color,
      fontSize: 15, fontWeight: 500, letterSpacing: -0.1,
      display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
      fontVariantNumeric: 'tabular-nums',
    }}>{children}</Press>
  );
}

// ── Weight stepper (the hero) ───────────────────────────────
function Stepper({ value, onChange, step=2.5, min=0, label='WEIGHT', unit='kg', size='lg', hint }) {
  const big = size === 'lg';
  const displaySize = big ? 80 : 40;
  const btn = big ? 76 : 56;
  const iconSize = big ? 30 : 22;

  const holdRef = React.useRef(null);
  const pressHold = (delta) => {
    // Tap-and-hold auto-increment
    onChange(Math.max(min, +(value + delta).toFixed(2)));
    let elapsed = 0;
    holdRef.current = setInterval(() => {
      elapsed += 1;
      // Accelerate after 6 ticks
      const factor = elapsed > 10 ? 4 : elapsed > 5 ? 2 : 1;
      onChange(v => {
        const next = Math.max(min, +(v + delta * factor).toFixed(2));
        return next;
      });
    }, 110);
  };
  const release = () => { if (holdRef.current) { clearInterval(holdRef.current); holdRef.current = null; } };

  const roundDisplay = (v) => {
    if (Number.isInteger(v)) return v.toString();
    return v.toFixed(1);
  };

  return (
    <div>
      <div style={{
        fontSize: 11, fontWeight: 600, letterSpacing: 1.6,
        color: T.textDim2, textTransform: 'uppercase', marginBottom: 10,
      }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: big ? 10 : 8 }}>
        <Press
          onPointerDown={() => pressHold(-step)}
          onPointerUp={release}
          onPointerLeave={release}
          style={{
            width: btn, height: btn, borderRadius: btn/2,
            background: T.surface2, border: `1px solid ${T.line2}`,
            color: T.text, display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>{Icon.minus(iconSize)}</Press>

        <div style={{
          flex: 1, textAlign: 'center',
          fontSize: displaySize, fontWeight: 700, letterSpacing: -2,
          color: T.text, lineHeight: 1, fontVariantNumeric: 'tabular-nums',
          display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 8,
        }}>
          <span>{roundDisplay(value)}</span>
          <span style={{ fontSize: big ? 18 : 14, fontWeight: 500, color: T.textDim, letterSpacing: 0 }}>{unit}</span>
        </div>

        <Press
          onPointerDown={() => pressHold(step)}
          onPointerUp={release}
          onPointerLeave={release}
          style={{
            width: btn, height: btn, borderRadius: btn/2,
            background: T.amber, color: '#1b0a00',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, boxShadow: `0 ${4 * T._mood.buttonPunch}px ${16 * T._mood.buttonPunch}px ${T.amberGlow}`,
          }}>{Icon.plus(iconSize)}</Press>
      </div>
      {hint && (
        <div style={{ textAlign: 'center', color: T.textDim2, fontSize: 12, marginTop: 8, fontVariantNumeric: 'tabular-nums' }}>
          {hint}
        </div>
      )}
    </div>
  );
}

// ── Small stepper (reps, sets) ──────────────────────────────
function SmallStepper({ label, value, onChange, step=1, min=0, max=99 }) {
  return (
    <div style={{
      background: T.surface, borderRadius: 16, padding: '14px 12px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      border: `1px solid ${T.line}`,
    }}>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.4, color: T.textDim2, textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
        <Press onClick={() => onChange(Math.max(min, value - step))} style={{
          width: 44, height: 44, borderRadius: 22,
          background: T.surface2, border: `1px solid ${T.line2}`,
          color: T.text, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{Icon.minus(18)}</Press>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 32, fontWeight: 700, color: T.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
          {value}
        </div>
        <Press onClick={() => onChange(Math.min(max, value + step))} style={{
          width: 44, height: 44, borderRadius: 22,
          background: T.surface2, border: `1px solid ${T.line2}`,
          color: T.text, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{Icon.plus(18)}</Press>
      </div>
    </div>
  );
}

// ── Set row (swipe to delete/clone) ─────────────────────────
function SetRow({ index, set, isLatest, onClone, onDelete }) {
  const [dx, setDx] = React.useState(0);
  const startRef = React.useRef(null);
  const onPointerDown = (e) => { startRef.current = { x: e.clientX, dx: 0 }; };
  const onPointerMove = (e) => {
    if (!startRef.current || e.buttons === 0) return;
    const d = e.clientX - startRef.current.x;
    setDx(Math.max(-110, Math.min(110, d)));
  };
  const onPointerUp = () => {
    if (dx > 60) onClone && onClone();
    else if (dx < -60) onDelete && onDelete();
    setDx(0);
    startRef.current = null;
  };
  const bg = isLatest ? T.amberDim : T.surface;
  const border = isLatest ? T.amberLine : T.line;
  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 12 }}>
      {/* revealed actions behind */}
      <div style={{
        position: 'absolute', inset: 0, display: 'flex',
        alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px', pointerEvents: 'none',
      }}>
        <div style={{ color: T.teal, display: 'flex', alignItems: 'center', gap: 6, opacity: dx > 10 ? 1 : 0.4 }}>
          {Icon.copy(16)}<span style={{ fontSize: 12, fontWeight: 600 }}>CLONE</span>
        </div>
        <div style={{ color: '#f08a6f', display: 'flex', alignItems: 'center', gap: 6, opacity: dx < -10 ? 1 : 0.4 }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>DELETE</span>{Icon.trash(16)}
        </div>
      </div>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          transform: `translateX(${dx}px)`,
          transition: startRef.current ? 'none' : 'transform 180ms cubic-bezier(0.2,0.8,0.2,1)',
          background: bg, border: `1px solid ${border}`,
          borderRadius: 12, padding: '12px 14px',
          display: 'flex', alignItems: 'center', gap: 12,
          fontVariantNumeric: 'tabular-nums',
          touchAction: 'pan-y',
        }}>
        <div style={{
          width: 24, height: 24, borderRadius: 12,
          background: isLatest ? T.amber : T.surface3,
          color: isLatest ? '#1b0a00' : T.textDim,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700,
        }}>{index + 1}</div>
        <div style={{ flex: 1, fontSize: 17, color: T.text, fontWeight: 500 }}>
          {set.weight}<span style={{ color: T.textDim, fontWeight: 400, fontSize: 14 }}> kg</span>
          <span style={{ color: T.textDim2, margin: '0 8px' }}>×</span>
          {set.reps}<span style={{ color: T.textDim, fontWeight: 400, fontSize: 14 }}> reps</span>
        </div>
        <div style={{ color: T.textDim2, fontSize: 12 }}>
          {(set.weight * set.reps).toFixed(0)} kg·vol
        </div>
      </div>
    </div>
  );
}

// ── Sparkline ────────────────────────────────────────────────
function Sparkline({ data, width=120, height=36, color=T.amber, fill=true }) {
  if (!data || !data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * (width - 2) + 1;
    const y = height - 2 - ((v - min) / range) * (height - 4);
    return [x, y];
  });
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');
  const area = path + ` L${width-1},${height-1} L1,${height-1} Z`;
  return (
    <svg width={width} height={height}>
      {fill && <path d={area} fill={color} opacity="0.12"/>}
      <path d={path} fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx={pts[pts.length-1][0]} cy={pts[pts.length-1][1]} r="2.5" fill={color}/>
    </svg>
  );
}

// ── Line chart (Recharts-free) ──────────────────────────────
function LineChart({ data, width=370, height=180, color=T.amber, unit='kg', ySteps=4, yLabels=true }) {
  const pad = { t: 16, r: 12, b: 24, l: yLabels ? 32 : 8 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const yMin = Math.floor(min - range * 0.08);
  const yMax = Math.ceil(max + range * 0.08);
  const yRange = yMax - yMin || 1;
  const pts = data.map((v, i) => {
    const x = pad.l + (i / (data.length - 1)) * w;
    const y = pad.t + h - ((v - yMin) / yRange) * h;
    return [x, y];
  });
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');
  const area = path + ` L${pad.l + w},${pad.t + h} L${pad.l},${pad.t + h} Z`;

  const yTicks = [];
  for (let i = 0; i <= ySteps; i++) {
    const v = yMin + (yRange * i) / ySteps;
    const y = pad.t + h - (i / ySteps) * h;
    yTicks.push({ v, y });
  }

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      {/* grid */}
      {yTicks.map((t, i) => (
        <line key={i} x1={pad.l} y1={t.y} x2={pad.l + w} y2={t.y}
          stroke="rgba(244,237,226,0.05)" strokeWidth="1"/>
      ))}
      {yLabels && yTicks.map((t, i) => (
        <text key={i} x={pad.l - 6} y={t.y + 4}
          fill="rgba(244,237,226,0.3)" fontSize="10" textAnchor="end"
          fontFamily="Inter, system-ui" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {Math.round(t.v)}
        </text>
      ))}
      {/* area */}
      <path d={area} fill={color} opacity="0.10"/>
      {/* line */}
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      {/* last point */}
      <circle cx={pts[pts.length-1][0]} cy={pts[pts.length-1][1]} r="3.5" fill={color}/>
      <circle cx={pts[pts.length-1][0]} cy={pts[pts.length-1][1]} r="6" fill={color} opacity="0.2"/>
    </svg>
  );
}

// ── Bar chart ───────────────────────────────────────────────
function BarChart({ data, labels, width=370, height=140, color=T.teal }) {
  const pad = { t: 12, r: 8, b: 22, l: 28 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const max = Math.max(...data) || 1;
  const bw = w / data.length - 4;
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <line x1={pad.l} y1={pad.t + h} x2={pad.l + w} y2={pad.t + h} stroke="rgba(244,237,226,0.06)"/>
      {data.map((v, i) => {
        const x = pad.l + (i / data.length) * w + 2;
        const bh = (v / max) * h;
        const y = pad.t + h - bh;
        return (
          <g key={i}>
            <rect x={x} y={y} width={bw} height={bh} rx={3} fill={color} opacity="0.75"/>
            {labels && <text x={x + bw/2} y={pad.t + h + 14} fill={T.textDim2} fontSize="10" textAnchor="middle" fontFamily="Inter, system-ui">{labels[i]}</text>}
          </g>
        );
      })}
    </svg>
  );
}

// ── Avatar ───────────────────────────────────────────────────
function Avatar({ user, size=32, active=false }) {
  const bg = `oklch(0.62 0.14 ${user.hue})`;
  const ring = active ? `0 0 0 2px ${T.bg}, 0 0 0 4px ${bg}` : 'none';
  return (
    <div style={{
      width: size, height: size, borderRadius: size/2,
      background: bg, color: '#1b0a00',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.42, fontWeight: 700,
      boxShadow: ring,
      fontVariantNumeric: 'tabular-nums',
      flexShrink: 0,
    }}>{user.initials}</div>
  );
}

// ── Gym switcher — tappable chip that opens a bottom sheet ─
function GymChip({ gym, onClick }) {
  return (
    <Press onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: '8px 10px 8px 12px', borderRadius: 12,
      background: T.surface, border: `1px solid ${T.line2}`,
      minWidth: 0,
    }}>
      <div style={{
        width: 8, height: 8, borderRadius: 2, background: T.amber, flexShrink: 0,
      }}/>
      <div style={{ minWidth: 0, textAlign: 'left' }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.4, color: T.textDim2, textTransform: 'uppercase', lineHeight: 1 }}>Gym</div>
        <div style={{
          fontSize: 14, fontWeight: 600, color: T.text, marginTop: 3,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          letterSpacing: -0.1, maxWidth: 140,
        }}>{gym.name}</div>
      </div>
      <div style={{ color: T.textDim2, marginLeft: 2 }}>{Icon.chevD(14)}</div>
    </Press>
  );
}

function GymSheet({ gyms, activeId, onPick, onAdd, onClose }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 40,
      background: 'rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: T.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
        padding: '10px 16px 28px', borderTop: `1px solid ${T.line2}`,
      }}>
        <div style={{
          width: 36, height: 4, borderRadius: 2, background: T.line2,
          margin: '4px auto 14px',
        }}/>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.4, color: T.textDim2, textTransform: 'uppercase', marginBottom: 10 }}>
          Switch gym
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {gyms.map(g => {
            const a = g.id === activeId;
            return (
              <Press key={g.id} onClick={() => { onPick(g.id); onClose(); }} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 12px', borderRadius: 12,
                background: a ? T.amberDim : T.surface2,
                border: `1px solid ${a ? T.amberLine : T.line}`,
                textAlign: 'left',
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                  background: `linear-gradient(135deg, ${g.tint} 0%, ${T.bg} 100%)`,
                  border: `1px solid ${T.line2}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: a ? T.amber : T.textDim, fontSize: 14, fontWeight: 700,
                }}>{g.name.split(' ').map(w => w[0]).slice(0,2).join('')}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: T.text, letterSpacing: -0.1 }}>{g.name}</div>
                  <div style={{ fontSize: 12, color: T.textDim, marginTop: 2 }}>{g.city}</div>
                </div>
                {a && <div style={{ color: T.amber }}>{Icon.check(18)}</div>}
              </Press>
            );
          })}
          <Press onClick={() => { onAdd(); onClose(); }} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 12px', borderRadius: 12,
            background: 'transparent', border: `1px dashed ${T.line2}`,
            color: T.textDim, textAlign: 'left',
          }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0,
              border: `1px dashed ${T.line2}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textDim }}>
              {Icon.plus(18)}
            </div>
            <div style={{ fontSize: 15, fontWeight: 500, color: T.text }}>Add another gym</div>
          </Press>
        </div>
      </div>
    </div>
  );
}

// ── Equipment tile ──────────────────────────────────────────
function EquipmentTile({ eq, onClick, lastMeta, compact=false }) {
  const d = useDensity();
  const dense = d.gridCols === 3;
  const roomy = d.gridCols === 1;
  return (
    <Press onClick={onClick} style={{
      background: T.surface, borderRadius: d.radius,
      border: `1px solid ${T.line}`, overflow: 'hidden',
      display: 'flex', flexDirection: roomy ? 'row' : 'column', width: '100%',
      textAlign: 'left',
    }}>
      {/* photo-like tile: tinted block with an abstract glyph */}
      <div style={{
        aspectRatio: d.tileAspect, position: 'relative',
        width: roomy ? 120 : '100%',
        flexShrink: 0,
        background: T._mood.tileOverlay === 'punch'
          ? `linear-gradient(135deg, ${eq.tint} 0%, ${T.amberDim} 140%)`
          : T._mood.tileOverlay === 'soft'
            ? `linear-gradient(135deg, ${eq.tint}66 0%, ${T.bg} 100%)`
            : `linear-gradient(135deg, ${eq.tint} 0%, ${T.bg} 100%)`,
        borderBottom: roomy ? 'none' : `1px solid ${T.line}`,
        borderRight: roomy ? `1px solid ${T.line}` : 'none',
      }}>
        <div style={{ position: 'absolute', inset: dense ? 8 : 14 }}>
          <EquipmentGlyph kind={eq.glyph} tint={T.amber}/>
        </div>
        {/* days-since corner chip */}
        {eq.daysSince != null && !dense && (
          <div style={{
            position: 'absolute', top: 8, right: 8,
            padding: '3px 7px', borderRadius: 999,
            background: 'rgba(13,15,18,0.7)', backdropFilter: 'blur(6px)',
            color: eq.daysSince <= 1 ? T.amber : T.textDim,
            fontSize: 10, fontWeight: 600, letterSpacing: 0.2,
            border: `1px solid ${T.line2}`,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {eq.daysSince === 0 ? 'today' : `${eq.daysSince}d`}
          </div>
        )}
      </div>
      <div style={{ padding: dense ? '8px 10px 10px' : `10px ${d.tilePad}px 12px`, flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: d.titleSize, fontWeight: 600, color: T.text,
          letterSpacing: -0.1, lineHeight: 1.2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{eq.name}</div>
        {d.showMeta !== 'hidden' && (
          <div style={{ marginTop: 3, fontSize: dense ? 10 : 12, color: T.textDim, fontVariantNumeric: 'tabular-nums',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {eq.lastWeight != null
              ? `${eq.lastWeight} kg · ${eq.lastReps} reps`
              : eq.lastDuration != null ? `${eq.lastDuration} min` : '—'}
            {roomy && eq.daysSince != null && (
              <span style={{ color: eq.daysSince <= 1 ? T.amber : T.textDim2, marginLeft: 8 }}>
                · {eq.daysSince === 0 ? 'today' : `${eq.daysSince}d ago`}
              </span>
            )}
          </div>
        )}
      </div>
    </Press>
  );
}

// ── Bottom tab bar ──────────────────────────────────────────
function TabBar({ active, onChange }) {
  const tabs = [
    { id: 'home',    label: 'Gym',     icon: Icon.home },
    { id: 'history', label: 'History', icon: Icon.hist },
    { id: 'stats',   label: 'Stats',   icon: Icon.chart },
    { id: 'setup',   label: 'Setup',   icon: Icon.gear },
  ];
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0,
      background: 'rgba(13,15,18,0.86)',
      backdropFilter: 'blur(18px) saturate(160%)',
      WebkitBackdropFilter: 'blur(18px) saturate(160%)',
      borderTop: `1px solid ${T.line}`,
      paddingBottom: 28, paddingTop: 8,
      display: 'flex', justifyContent: 'space-around',
      zIndex: 30,
    }}>
      {tabs.map(t => {
        const a = active === t.id;
        return (
          <Press key={t.id} onClick={() => onChange(t.id)} style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 3, padding: '6px 0',
            color: a ? T.amber : T.textDim, minHeight: 44,
          }}>
            {t.icon(22, 'currentColor')}
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.3 }}>{t.label}</div>
          </Press>
        );
      })}
    </div>
  );
}

// ── Bottom sheet (session status / rest timer) ──────────────
function SessionBar({ session, onTap, restSeconds }) {
  const pulse = restSeconds != null && restSeconds > 0;
  const mins = Math.floor(session.elapsedSec / 60);
  const totalSets = session.sets.length;
  return (
    <Press onClick={onTap} style={{
      position: 'absolute', left: 8, right: 8, bottom: 92,
      background: T.surface2, border: `1px solid ${pulse ? T.amberLine : T.line2}`,
      borderRadius: 18, padding: '12px 14px',
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
      zIndex: 20,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 18,
        background: pulse ? T.amber : T.surface3,
        color: pulse ? '#1b0a00' : T.amber,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {pulse
          ? <span style={{ fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtRest(restSeconds)}</span>
          : Icon.zap(16)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.3, color: pulse ? T.amber : T.textDim2, textTransform: 'uppercase' }}>
          {pulse ? 'Resting' : 'Session in progress'}
        </div>
        <div style={{ fontSize: 14, color: T.text, marginTop: 1, fontVariantNumeric: 'tabular-nums' }}>
          {totalSets} set{totalSets === 1 ? '' : 's'} · {mins} min
          {pulse && <span style={{ color: T.textDim, fontSize: 12 }}> · next set soon</span>}
        </div>
      </div>
      {Icon.chevR(18, T.textDim)}
    </Press>
  );
}

function fmtRest(s) {
  if (s == null) return '';
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m > 0) return `${m}:${r.toString().padStart(2,'0')}`;
  return `${r}s`;
}

// ── Screen shell ────────────────────────────────────────────
function Screen({ children, style }) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden', background: T.bg,
      ...style,
    }}>{children}</div>
  );
}

function ScreenHeader({ title, eyebrow, left, right, onBack, sticky=true }) {
  return (
    <div style={{
      position: sticky ? 'sticky' : 'relative', top: 0, zIndex: 10,
      background: T.bg,
      padding: '58px 16px 10px',
      borderBottom: `1px solid ${T.line}`,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, minHeight: 32,
      }}>
        {onBack && (
          <Press onClick={onBack} style={{
            width: 36, height: 36, borderRadius: 18, marginLeft: -4,
            background: T.surface, border: `1px solid ${T.line2}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.text,
          }}>{Icon.chevL(18)}</Press>
        )}
        {left}
        <div style={{ flex: 1, minWidth: 0 }}>
          {eyebrow && <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.6, color: T.textDim2, textTransform: 'uppercase' }}>{eyebrow}</div>}
          <div style={{ fontSize: 22, fontWeight: 700, color: T.text, letterSpacing: -0.4, lineHeight: 1.15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
        </div>
        {right}
      </div>
    </div>
  );
}

// ── Cardio row (duration + optional extras) ─────────────────
function CardioRow({ index, set, isLatest, onDelete }) {
  const bg = isLatest ? T.amberDim : T.surface;
  const border = isLatest ? T.amberLine : T.line;
  const extras = set.extras || {};
  const unitMap = { distance: 'km', incline: '%', speed: 'km/h', hr: 'bpm', kcal: 'kcal', level: '', rpm: '', splits: 's', spm: '' };
  // Rower distance is in meters; tweak label
  const fmt = (k, v) => {
    if (k === 'distance' && v >= 100) return `${v} m`;
    if (k === 'splits') { const m = Math.floor(v/60); const s = (v%60).toString().padStart(2,'0'); return `${m}:${s}/500`; }
    const u = unitMap[k] || '';
    return `${v}${u ? ' ' + u : ''}`;
  };
  const labelMap = { distance: 'dist', incline: 'inc', speed: 'spd', hr: 'HR', kcal: 'kcal', level: 'lvl', rpm: 'rpm', splits: 'split', spm: 'spm' };
  return (
    <div style={{
      background: bg, border: `1px solid ${border}`, borderRadius: 12,
      padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12,
      fontVariantNumeric: 'tabular-nums',
    }}>
      <div style={{
        width: 24, height: 24, borderRadius: 12,
        background: isLatest ? T.amber : T.surface3,
        color: isLatest ? '#1b0a00' : T.textDim,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 700, flexShrink: 0,
      }}>{index + 1}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, color: T.text, fontWeight: 600 }}>
          {set.duration}<span style={{ color: T.textDim, fontWeight: 400, fontSize: 13 }}> min</span>
        </div>
        {Object.keys(extras).length > 0 && (
          <div style={{ fontSize: 11, color: T.textDim2, marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {Object.entries(extras).map(([k, v]) => (
              <span key={k}>{labelMap[k] || k} <span style={{ color: T.textDim }}>{fmt(k, v)}</span></span>
            ))}
          </div>
        )}
      </div>
      <Press onClick={onDelete} style={{
        width: 28, height: 28, borderRadius: 14, color: T.textDim2,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{Icon.trash(14)}</Press>
    </div>
  );
}

Object.assign(window, {
  T, Icon, EquipmentGlyph, Press, Chip, Stepper, SmallStepper, SetRow, CardioRow,
  Sparkline, LineChart, BarChart, Avatar, GymChip, GymSheet, EquipmentTile,
  TabBar, SessionBar, fmtRest, Screen, ScreenHeader,
});
