// Trajectory — app shell: nav stack, state, session/rest-timer, CSV export.

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "mood": "focus",
  "accentHue": 32,
  "density": "standard"
}/*EDITMODE-END*/;

// Mood preset → multiplies / re-biases a bunch of visual properties
const MOOD_PRESETS = {
  calm: {
    accentChroma: 0.10,
    accentLightness: 0.72,
    secondaryHue: 200,
    surfaceLift: 0,      // flatter
    surfaceTint: 0.00,    // cool neutral
    cardBorder: 0.05,
    shadowAlpha: 0.0,
    buttonPunch: 0.85,    // softer primary button
    tileOverlay: 'soft',  // subtle tile wash
  },
  focus: {
    accentChroma: 0.18,
    accentLightness: 0.70,
    secondaryHue: 200,
    surfaceLift: 1,
    surfaceTint: 0.004,
    cardBorder: 0.09,
    shadowAlpha: 0.25,
    buttonPunch: 1.0,
    tileOverlay: 'balanced',
  },
  gym: {
    accentChroma: 0.22,
    accentLightness: 0.68,
    secondaryHue: 200,
    surfaceLift: 2,
    surfaceTint: 0.008,   // warm-tinted surfaces
    cardBorder: 0.14,
    shadowAlpha: 0.45,
    buttonPunch: 1.25,    // chunky, glowing
    tileOverlay: 'punch',
  },
};

// Density preset → grid + spacing + type
const DENSITY_PRESETS = {
  roomy:    { gridCols: 1, tileAspect: '16 / 9',  tilePad: 14, gap: 14, radius: 20, titleSize: 16, showMeta: 'full' },
  standard: { gridCols: 2, tileAspect: '4 / 3',   tilePad: 12, gap: 12, radius: 16, titleSize: 14, showMeta: 'full' },
  dense:    { gridCols: 3, tileAspect: '1 / 1',   tilePad: 8,  gap: 8,  radius: 12, titleSize: 12, showMeta: 'brief' },
};

// Build a theme object from mood + accentHue
function buildTheme(mood, accentHue) {
  const m = MOOD_PRESETS[mood] || MOOD_PRESETS.focus;
  const L = m.accentLightness;
  const C = m.accentChroma;
  const amber = `oklch(${L} ${C} ${accentHue})`;
  const amberDim = `oklch(${L} ${C} ${accentHue} / 0.14)`;
  const amberLine = `oklch(${L} ${C} ${accentHue} / 0.30)`;
  const amberGlow = `oklch(${L} ${C} ${accentHue} / ${0.25 + m.shadowAlpha * 0.3})`;
  const teal = `oklch(0.74 0.08 ${m.secondaryHue})`;
  const tealDim = `oklch(0.74 0.08 ${m.secondaryHue} / 0.18)`;
  // Warm-tint surfaces in Gym mode
  const tint = m.surfaceTint;
  const bg = tint > 0 ? `oklch(0.17 ${tint} ${accentHue})` : '#0d0f12';
  const surface = tint > 0 ? `oklch(0.21 ${tint} ${accentHue})` : '#15181d';
  const surface2 = tint > 0 ? `oklch(0.24 ${tint} ${accentHue})` : '#1c2026';
  const surface3 = tint > 0 ? `oklch(0.28 ${tint} ${accentHue})` : '#242932';
  return {
    bg, surface, surface2, surface3,
    line: `rgba(255,255,255,${m.cardBorder * 0.7})`,
    line2: `rgba(255,255,255,${m.cardBorder})`,
    text: '#f4ede2',
    textDim: 'rgba(244,237,226,0.62)',
    textDim2: 'rgba(244,237,226,0.38)',
    amber, amberDim, amberLine, amberGlow,
    teal, tealDim,
    _mood: m,
  };
}

function useNav(initial = { name: 'home', params: {} }) {
  const [stack, setStack] = React.useState([initial]);
  const top = stack[stack.length - 1];
  return {
    top,
    push: (name, params = {}) => setStack(s => [...s, { name, params }]),
    pop: () => setStack(s => s.length > 1 ? s.slice(0, -1) : s),
    reset: (name, params = {}) => setStack([{ name, params }]),
    setTab: (name) => setStack([{ name, params: {} }]), // switching tabs resets stack
  };
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const theme = React.useMemo(() => buildTheme(t.mood, t.accentHue), [t.mood, t.accentHue]);
  const density = DENSITY_PRESETS[t.density] || DENSITY_PRESETS.standard;

  // Mutate shared T object so every component (incl. ones that read T at render) pick up changes
  React.useLayoutEffect(() => { Object.assign(T, theme); }, [theme]);

  const [activeGymId, setActiveGymId] = React.useState(() => (GYMS.find(g => g.primary) || GYMS[0]).id);
  const nav = useNav({ name: 'home', params: {} });

  // Session state
  const [session, setSession] = React.useState({
    startedAt: Date.now() - 23 * 60 * 1000, // started 23 min ago
    elapsedSec: 23 * 60,
    sets: [
      { id: 'pre-1', eqId: 'flat-bench', weight: 60, reps: 8, ts: Date.now() - 20*60*1000 },
      { id: 'pre-2', eqId: 'flat-bench', weight: 70, reps: 6, ts: Date.now() - 17*60*1000 },
      { id: 'pre-3', eqId: 'cable-row', weight: 60, reps: 10, ts: Date.now() - 10*60*1000 },
      { id: 'pre-4', eqId: 'cable-row', weight: 65, reps: 10, ts: Date.now() - 6*60*1000 },
    ],
  });

  // Rest timer
  const [lastLogAt, setLastLogAt] = React.useState(null);
  const [now, setNow] = React.useState(Date.now());
  React.useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now());
      setSession(s => ({ ...s, elapsedSec: Math.floor((Date.now() - s.startedAt) / 1000) }));
    }, 1000);
    return () => clearInterval(id);
  }, []);
  const restSeconds = lastLogAt ? Math.max(0, 90 - Math.floor((now - lastLogAt) / 1000)) : null;

  const actions = {
    setActiveGym: setActiveGymId,
    logSet: (eqId, weight, reps) => {
      const id = 's-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5);
      setSession(s => ({ ...s, sets: [...s.sets, { id, eqId, weight, reps, ts: Date.now() }] }));
      setLastLogAt(Date.now());
    },
    logCardio: (eqId, duration, extras = {}) => {
      const id = 'c-' + Date.now();
      setSession(s => ({ ...s, sets: [...s.sets, { id, eqId, weight: 0, reps: 0, duration, extras, ts: Date.now() }] }));
      setLastLogAt(Date.now());
    },
    deleteSet: (setId) => setSession(s => ({ ...s, sets: s.sets.filter(x => x.id !== setId) })),
    exportCsv: () => {
      // UX only — show a toast via alert-like inline, but keep it non-modal
      // For the prototype, just log; in real app this would create a file.
      console.log('Export CSV');
    },
  };

  const state = { activeGymId, session, restSeconds, increment: 2.5 };

  // Determine tab for active screen
  const tabFor = (name) => {
    if (name === 'home' || name === 'log' || name === 'detail') return 'home';
    if (name === 'history' || name === 'sessionDetail') return 'history';
    if (name === 'stats') return 'stats';
    if (name === 'setup') return 'setup';
    return 'home';
  };
  const activeTab = tabFor(nav.top.name);

  // Render active screen
  let screen;
  const p = nav.top.params;
  switch (nav.top.name) {
    case 'home':    screen = <HomeScreen state={state} nav={nav} actions={actions}/>; break;
    case 'log':     screen = <LogScreen state={state} nav={nav} actions={actions} eqId={p.eqId}/>; break;
    case 'detail':  screen = <DetailScreen state={state} nav={nav} actions={actions} eqId={p.eqId}/>; break;
    case 'history': screen = <HistoryScreen state={state} nav={nav} actions={actions}/>; break;
    case 'sessionDetail': screen = <SessionDetailScreen state={state} nav={nav} sessionId={p.sessionId}/>; break;
    case 'stats':   screen = <StatsScreen state={state} nav={nav} actions={actions}/>; break;
    case 'setup':   screen = <SetupScreen state={state} nav={nav} actions={actions}/>; break;
    default:        screen = <HomeScreen state={state} nav={nav} actions={actions}/>;
  }

  // Screens where we hide the tab bar (focus mode for logging)
  const hideTabs = nav.top.name === 'log';

  return (
    <DensityCtx.Provider value={density}>
      <div style={{ position: 'absolute', inset: 0, background: T.bg, color: T.text, overflow: 'hidden' }}>
        {screen}
        {!hideTabs && <TabBar active={activeTab} onChange={(id) => nav.setTab(id)}/>}
      </div>
      <TweaksPanel title="Tweaks">
        <TweakSection label="Mood"/>
        <TweakRadio label="Feel" value={t.mood}
          options={['calm','focus','gym']}
          onChange={(v) => setTweak('mood', v)}/>
        <TweakSlider label="Accent hue" value={t.accentHue} min={18} max={58} step={1} unit="°"
          onChange={(v) => setTweak('accentHue', v)}/>
        <TweakSection label="Layout"/>
        <TweakRadio label="Density" value={t.density}
          options={['roomy','standard','dense']}
          onChange={(v) => setTweak('density', v)}/>
      </TweaksPanel>
    </DensityCtx.Provider>
  );
}

function Root() {
  return (
    <div style={{
      minHeight: '100vh', width: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, background: '#0a0b0d',
      backgroundImage: 'radial-gradient(1200px 600px at 50% 0%, rgba(255,140,66,0.06), transparent 70%)',
      boxSizing: 'border-box',
    }}>
      <IOSDevice width={402} height={874} dark={true}>
        <App/>
      </IOSDevice>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Root/>);
