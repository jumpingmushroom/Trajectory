// Trajectory — screens
// Renders one of: home, log, detail, history, stats, setup, sessionDetail, onboarding

// ─── HOME / SESSION ─────────────────────────────────────────
function HomeScreen({ state, nav, actions }) {
  const [filter, setFilter] = React.useState('all');
  const [sortMode, setSortMode] = React.useState('recent'); // recent | walking
  const [gymSheetOpen, setGymSheetOpen] = React.useState(false);

  const filters = [
    { id: 'all', label: 'All' },
    { id: 'push', label: 'Push' },
    { id: 'pull', label: 'Pull' },
    { id: 'legs', label: 'Legs' },
    { id: 'cardio', label: 'Cardio' },
  ];

  const activeGym = GYMS.find(g => g.id === state.activeGymId) || GYMS[0];
  let equipment = EQUIPMENT.filter(e => e.gymId === activeGym.id)
    .filter(e => filter === 'all' ? true : e.group === filter);
  if (sortMode === 'recent') {
    equipment = [...equipment].sort((a, b) => (a.daysSince ?? 99) - (b.daysSince ?? 99));
  }

  const session = state.session;
  const sessionActive = session && session.sets.length > 0;

  return (
    <Screen>
      {/* header */}
      <div style={{
        padding: '58px 16px 12px', background: T.bg,
        borderBottom: `1px solid ${T.line}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.6, color: T.textDim2, textTransform: 'uppercase' }}>
              Trajectory
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: T.text, letterSpacing: -0.4, marginTop: 2 }}>
              Today
            </div>
          </div>
          <GymChip gym={activeGym} onClick={() => setGymSheetOpen(true)}/>
        </div>

        {/* filter chips */}
        <div style={{
          display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2,
          marginLeft: -2, marginRight: -2, paddingLeft: 2, paddingRight: 2,
          scrollbarWidth: 'none',
        }}>
          {filters.map(f => (
            <Chip key={f.id} active={filter === f.id} tone={filter === f.id ? 'amber' : 'neutral'} onClick={() => setFilter(f.id)}>
              {f.label}
            </Chip>
          ))}
          <div style={{ flex: 1 }}/>
          <Press onClick={() => setSortMode(sortMode === 'recent' ? 'walking' : 'recent')} style={{
            minHeight: 44, padding: '0 12px', borderRadius: 999,
            background: 'transparent', border: `1px solid ${T.line2}`,
            color: T.textDim, display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap',
          }}>
            {Icon.filt(14)}
            {sortMode === 'recent' ? 'Recent' : 'Walk order'}
          </Press>
        </div>
      </div>

      {/* grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 200px' }}>
        <HomeGrid equipment={equipment} onSelect={(id) => nav.push('log', { eqId: id })}/>
        {equipment.length === 0 && (
          <div style={{ padding: '40px 0', textAlign: 'center', color: T.textDim2, fontSize: 14 }}>
            Nothing here in this category.
          </div>
        )}
      </div>

      {/* session bar */}
      {sessionActive && (
        <SessionBar
          session={session}
          restSeconds={state.restSeconds}
          onTap={() => nav.push('log', { eqId: session.sets[session.sets.length-1].eqId })}
        />
      )}
      {gymSheetOpen && (
        <GymSheet
          gyms={GYMS}
          activeId={activeGym.id}
          onPick={(id) => actions.setActiveGym(id)}
          onAdd={() => nav.setTab('setup')}
          onClose={() => setGymSheetOpen(false)}
        />
      )}
    </Screen>
  );
}
function LogScreen({ state, nav, actions, eqId }) {
  const eq = EQUIPMENT.find(e => e.id === eqId);
  const isCardio = eq.type === 'cardio';

  const prog = PROGRESSION[eqId];
  const last = eq.lastWeight != null ? eq.lastWeight : 60;
  const lastReps = eq.lastReps != null ? eq.lastReps : 10;

  const [weight, setWeight] = React.useState(last);
  const [reps, setReps] = React.useState(lastReps);
  const [targetSets, setTargetSets] = React.useState(3);
  const [duration, setDuration] = React.useState(eq.lastDuration || 20);
  // Cardio optional fields — only appear when user taps "+ add"
  // Treadmill: distance + incline only; avg speed is derived below (duration / distance).
  const cardioFields = eq.id === 'tm-3'
    ? [
        { id: 'distance', label: 'DISTANCE', unit: 'km', step: 0.1, min: 0, init: eq.lastDistanceKm ?? 3.0 },
        { id: 'incline',  label: 'INCLINE',  unit: '%',  step: 0.5, min: 0, init: 1.5 },
      ]
    : eq.id === 'bike-2'
    ? [
        { id: 'distance', label: 'DISTANCE', unit: 'km', step: 0.1, min: 0, init: 12.0 },
        { id: 'level',    label: 'LEVEL',    unit: '',   step: 1,   min: 0, init: 8 },
        { id: 'rpm',      label: 'AVG RPM',  unit: '',   step: 1,   min: 0, init: 78 },
        { id: 'hr',       label: 'AVG HR',   unit: 'bpm', step: 1,  min: 0, init: 132 },
        { id: 'kcal',     label: 'CALORIES', unit: 'kcal', step: 5, min: 0, init: 340 },
      ]
    : eq.id === 'rower'
    ? [
        { id: 'distance', label: 'DISTANCE', unit: 'm',   step: 50, min: 0, init: 3000 },
        { id: 'splits',   label: '/500 m',   unit: 's',   step: 1,  min: 0, init: 125 },
        { id: 'spm',      label: 'AVG SPM',  unit: '',    step: 1,  min: 0, init: 24 },
        { id: 'hr',       label: 'AVG HR',   unit: 'bpm', step: 1,  min: 0, init: 148 },
        { id: 'kcal',     label: 'CALORIES', unit: 'kcal', step: 5, min: 0, init: 180 },
      ]
    : [];
  const [cardioExtras, setCardioExtras] = React.useState({}); // id -> value
  const [justSaved, setJustSaved] = React.useState(false);

  // Sets in current session for this machine
  const machineSetsInSession = (state.session?.sets || []).filter(s => s.eqId === eqId);
  const setsDone = machineSetsInSession.length;
  const setsRemaining = Math.max(0, targetSets - setsDone);
  const allDone = setsDone >= targetSets && targetSets > 0;

  const commons = COMMON_WEIGHTS[eqId] || [];

  const handleLog = () => {
    if (isCardio) {
      actions.logCardio(eqId, duration, cardioExtras);
    } else {
      actions.logSet(eqId, weight, reps);
      // Auto-bump target if user overshoots their plan
      if (setsDone + 1 > targetSets) setTargetSets(setsDone + 1);
    }
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 700);
  };

  return (
    <Screen>
      <ScreenHeader
        title={eq.name}
        eyebrow={isCardio ? 'CARDIO' : 'LOGGING'}
        onBack={() => nav.pop()}
        right={
          <Press onClick={() => nav.push('detail', { eqId })} style={{
            width: 36, height: 36, borderRadius: 18,
            background: T.surface, border: `1px solid ${T.line2}`, color: T.textDim,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{Icon.ellipsis(18)}</Press>
        }
      />

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 140 }}>
        {/* photo + sparkline */}
        <div style={{ padding: '12px 16px 8px' }}>
          <div style={{
            aspectRatio: '16 / 9', borderRadius: 16, overflow: 'hidden',
            background: `linear-gradient(135deg, ${eq.tint} 0%, #0d0f12 100%)`,
            border: `1px solid ${T.line}`, position: 'relative',
          }}>
            <div style={{ position: 'absolute', inset: 20 }}>
              <EquipmentGlyph kind={eq.glyph}/>
            </div>
            {prog && !isCardio && (
              <div style={{
                position: 'absolute', right: 10, bottom: 10,
                padding: '6px 10px', background: 'rgba(13,15,18,0.75)',
                backdropFilter: 'blur(6px)', borderRadius: 10,
                border: `1px solid ${T.line2}`,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <Sparkline data={prog.slice(-10)} width={80} height={24} color={T.amber}/>
                <div style={{ fontSize: 11, color: T.textDim, fontVariantNumeric: 'tabular-nums' }}>
                  +{(prog[prog.length-1] - prog[0]).toFixed(1)} kg
                </div>
              </div>
            )}
          </div>
        </div>

        {/* prev indicator */}
        <div style={{
          padding: '4px 20px 14px', display: 'flex', alignItems: 'center', gap: 8,
          color: T.textDim2, fontSize: 12, fontVariantNumeric: 'tabular-nums',
        }}>
          <div style={{ width: 6, height: 6, borderRadius: 3, background: T.textDim2 }}/>
          {isCardio
            ? <>Last time: <span style={{ color: T.textDim }}>{eq.lastDuration} min</span> · {eq.daysSince}d ago</>
            : <>Last time: <span style={{ color: T.textDim }}>{eq.lastWeight} kg × {eq.lastReps}</span> · {eq.daysSince}d ago</>
          }
        </div>

        {isCardio ? (
          <div style={{ padding: '0 16px' }}>
            <Stepper
              value={duration} onChange={setDuration} step={1} min={1}
              label="DURATION" unit="min"
              hint={`Previous: ${eq.lastDuration} min`}
            />

            {/* Optional cardio fields */}
            {cardioFields.length > 0 && (
              <div style={{ marginTop: 22 }}>
                <div style={{
                  display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                  marginBottom: 10,
                }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.6, color: T.textDim2, textTransform: 'uppercase' }}>
                    Details · optional
                  </div>
                  <div style={{ fontSize: 11, color: T.textDim2 }}>
                    {Object.keys(cardioExtras).length} / {cardioFields.length} added
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {cardioFields.map(f => {
                    const active = f.id in cardioExtras;
                    if (!active) {
                      return (
                        <Press key={f.id} onClick={() => setCardioExtras(x => ({ ...x, [f.id]: f.init }))} style={{
                          minHeight: 64, borderRadius: 14,
                          background: 'transparent',
                          border: `1.5px dashed ${T.line2}`,
                          color: T.textDim, padding: '10px 12px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                          fontSize: 13, fontWeight: 500,
                        }}>
                          {Icon.plus(14)} {f.label.toLowerCase()}
                        </Press>
                      );
                    }
                    const val = cardioExtras[f.id];
                    const setVal = (nv) => setCardioExtras(x => ({ ...x, [f.id]: Math.max(f.min, +(nv).toFixed(2)) }));
                    const display = Number.isInteger(val) ? val : val.toFixed(1);
                    return (
                      <div key={f.id} style={{
                        background: T.surface, borderRadius: 14, padding: '10px 10px 10px 12px',
                        border: `1px solid ${T.amberLine}`,
                        display: 'flex', flexDirection: 'column', gap: 4,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.4, color: T.amber, textTransform: 'uppercase' }}>
                            {f.label}
                          </div>
                          <Press onClick={() => setCardioExtras(x => { const n = {...x}; delete n[f.id]; return n; })} style={{
                            width: 20, height: 20, borderRadius: 10, color: T.textDim2,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: -4,
                          }}>{Icon.close(14)}</Press>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Press onClick={() => setVal(val - f.step)} style={{
                            width: 32, height: 32, borderRadius: 16,
                            background: T.surface2, border: `1px solid ${T.line2}`,
                            color: T.text, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>{Icon.minus(14)}</Press>
                          <div style={{ flex: 1, textAlign: 'center', fontSize: 18, fontWeight: 700, color: T.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                            {display}
                            {f.unit && <span style={{ fontSize: 11, color: T.textDim, fontWeight: 500, marginLeft: 3 }}>{f.unit}</span>}
                          </div>
                          <Press onClick={() => setVal(val + f.step)} style={{
                            width: 32, height: 32, borderRadius: 16,
                            background: T.surface2, border: `1px solid ${T.line2}`,
                            color: T.text, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>{Icon.plus(14)}</Press>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Derived stats for treadmill: avg speed + pace */}
            {eq.id === 'tm-3' && cardioExtras.distance > 0 && duration > 0 && (
              <div style={{
                marginTop: 16, padding: '10px 14px',
                background: T.surface, borderRadius: 12,
                border: `1px solid ${T.line}`,
                display: 'flex', alignItems: 'center', gap: 16,
              }}>
                <div style={{ color: T.textDim2 }}>{Icon.zap(14)}</div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.4, color: T.textDim2, textTransform: 'uppercase' }}>Avg speed</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: T.text, fontVariantNumeric: 'tabular-nums', marginTop: 1 }}>
                    {(cardioExtras.distance / (duration / 60)).toFixed(1)}
                    <span style={{ fontSize: 11, color: T.textDim, fontWeight: 500, marginLeft: 3 }}>km/h</span>
                  </div>
                </div>
                <div style={{ width: 1, alignSelf: 'stretch', background: T.line }}/>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.4, color: T.textDim2, textTransform: 'uppercase' }}>Pace</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: T.text, fontVariantNumeric: 'tabular-nums', marginTop: 1 }}>
                    {(() => {
                      const paceMin = duration / cardioExtras.distance;
                      const m = Math.floor(paceMin);
                      const s = Math.round((paceMin - m) * 60);
                      return `${m}:${String(s).padStart(2,'0')}`;
                    })()}
                    <span style={{ fontSize: 11, color: T.textDim, fontWeight: 500, marginLeft: 3 }}>/ km</span>
                  </div>
                </div>
                <div style={{ flex: 1 }}/>
                <div style={{ fontSize: 10, color: T.textDim2, letterSpacing: 0.2 }}>auto</div>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Weight stepper */}
            <div style={{ padding: '0 16px' }}>
              <Stepper
                value={weight}
                onChange={setWeight}
                step={state.increment}
                label="WEIGHT"
                unit="kg"
                hint={`Tap +/− for ${state.increment} kg · hold to scroll`}
              />
            </div>

            {/* Quick-pick chips */}
            {commons.length > 0 && (
              <div style={{ padding: '18px 16px 6px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.6, color: T.textDim2, textTransform: 'uppercase', marginBottom: 8 }}>
                  Your usual
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {commons.map(w => (
                    <Chip key={w} active={weight === w} tone="amber" onClick={() => setWeight(w)}>
                      {w} kg
                    </Chip>
                  ))}
                </div>
              </div>
            )}

            {/* Reps + Sets plan */}
            <div style={{ padding: '18px 16px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <SmallStepper label="REPS" value={reps} onChange={setReps} min={1} max={50}/>
              <SmallStepper label="TARGET SETS" value={targetSets} onChange={setTargetSets} min={1} max={12}/>
            </div>

            {/* Set progress dots */}
            <div style={{ padding: '12px 16px 0' }}>
              <div style={{
                background: T.surface, borderRadius: 14, padding: '12px 14px',
                border: `1px solid ${T.line}`,
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{ display: 'flex', gap: 6, flex: 1, flexWrap: 'wrap' }}>
                  {Array.from({ length: Math.max(targetSets, setsDone) }).map((_, i) => {
                    const done = i < setsDone;
                    const isNext = i === setsDone && !allDone;
                    return (
                      <div key={i} style={{
                        width: 22, height: 22, borderRadius: 11,
                        background: done ? T.amber : isNext ? T.amberDim : 'rgba(244,237,226,0.06)',
                        border: `1px solid ${done ? T.amber : isNext ? T.amberLine : T.line2}`,
                        color: done ? '#1b0a00' : isNext ? T.amber : T.textDim2,
                        fontSize: 11, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontVariantNumeric: 'tabular-nums',
                      }}>
                        {done ? '✓' : i + 1}
                      </div>
                    );
                  })}
                </div>
                <div style={{
                  fontSize: 13, color: T.textDim, fontVariantNumeric: 'tabular-nums',
                  fontWeight: 500, whiteSpace: 'nowrap',
                }}>
                  {setsDone}<span style={{ color: T.textDim2 }}> / {targetSets}</span>
                </div>
              </div>
              <div style={{ textAlign: 'center', fontSize: 11, color: T.textDim2, marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>
                Planned volume · {targetSets} × {reps} × {weight} kg = {Math.round(targetSets * reps * weight)} kg
              </div>
            </div>
          </>
        )}

        {/* Sets logged this session */}
        {machineSetsInSession.length > 0 && (
          <div style={{ padding: '20px 16px 0' }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 10,
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.6, color: T.textDim2, textTransform: 'uppercase' }}>
                This session · {machineSetsInSession.length} set{machineSetsInSession.length === 1 ? '' : 's'}
              </div>
              {state.restSeconds != null && state.restSeconds > 0 && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  color: T.amber, fontSize: 12, fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {Icon.timer(14)} rest {fmtRest(state.restSeconds)}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {machineSetsInSession.map((s, i) => (
                s.duration != null
                  ? <CardioRow key={s.id} index={i} set={s} isLatest={i === machineSetsInSession.length - 1} onDelete={() => actions.deleteSet(s.id)}/>
                  : <SetRow
                      key={s.id}
                      index={i}
                      set={s}
                      isLatest={i === machineSetsInSession.length - 1}
                      onClone={() => actions.logSet(eqId, s.weight, s.reps)}
                      onDelete={() => actions.deleteSet(s.id)}
                    />
              ))}
            </div>
            {!isCardio && machineSetsInSession.length >= 1 && (
              <div style={{
                marginTop: 10, fontSize: 12, color: T.textDim2, textAlign: 'center',
              }}>
                ← swipe to delete · swipe right to clone →
              </div>
            )}
          </div>
        )}
      </div>

      {/* primary action */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        padding: '12px 16px 28px',
        background: 'linear-gradient(to top, rgba(13,15,18,1) 60%, rgba(13,15,18,0))',
      }}>
        <Press onClick={handleLog} style={{
          width: '100%', minHeight: 60, borderRadius: 999,
          background: justSaved ? T.teal : T.amber, color: '#1b0a00',
          fontSize: 17, fontWeight: 700, letterSpacing: 0.2,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          boxShadow: justSaved
            ? `0 0 0 6px ${T.tealDim}, 0 8px 24px rgba(102,199,194,0.3)`
            : `0 ${8 * T._mood.buttonPunch}px ${24 * T._mood.buttonPunch}px ${T.amberGlow}`,
          transition: 'background 250ms, box-shadow 250ms',
        }}>
          {justSaved ? <>{Icon.check(20, '#1b0a00')} Logged</> : isCardio ? <>Log · {duration} min</> : allDone ? <>Extra set · {weight} kg × {reps}</> : <>Log set {setsDone + 1} of {targetSets} · {weight} kg × {reps}</>}
        </Press>
      </div>
    </Screen>
  );
}

// ─── MACHINE DETAIL ─────────────────────────────────────────
function DetailScreen({ state, nav, actions, eqId }) {
  const eq = EQUIPMENT.find(e => e.id === eqId);
  const prog = PROGRESSION[eqId];
  const isCardio = eq.type === 'cardio';

  // Count sessions this machine appears in
  const sessionsWith = SESSIONS.filter(s => s.machines.some(m => m.id === eqId));
  const totalSets = sessionsWith.reduce((sum, s) => sum + (s.machines.find(m => m.id === eqId)?.sets.length || 0), 0);
  const pr = prog ? Math.max(...prog) : null;

  return (
    <Screen>
      <ScreenHeader title={eq.name} eyebrow="EQUIPMENT" onBack={() => nav.pop()}
        right={
          <Press onClick={() => nav.push('log', { eqId })} style={{
            padding: '0 14px', height: 36, borderRadius: 18,
            background: T.amber, color: '#1b0a00', fontSize: 13, fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            {Icon.plus(16, '#1b0a00')} Log
          </Press>
        }
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 140px' }}>
        <div style={{
          aspectRatio: '16 / 9', borderRadius: 16, overflow: 'hidden',
          background: `linear-gradient(135deg, ${eq.tint} 0%, #0d0f12 100%)`,
          border: `1px solid ${T.line}`, position: 'relative', marginBottom: 14,
        }}>
          <div style={{ position: 'absolute', inset: 24 }}>
            <EquipmentGlyph kind={eq.glyph}/>
          </div>
        </div>

        {/* meta row */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16,
        }}>
          {[
            { label: isCardio ? 'Last' : 'PR', value: isCardio ? `${eq.lastDuration} min` : `${pr ?? '—'} kg` },
            { label: 'Sessions', value: sessionsWith.length },
            { label: isCardio ? 'Type' : 'Sets logged', value: isCardio ? 'Cardio' : totalSets },
          ].map((s, i) => (
            <div key={i} style={{
              background: T.surface, borderRadius: 12, padding: '10px 12px',
              border: `1px solid ${T.line}`,
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.3, color: T.textDim2, textTransform: 'uppercase' }}>
                {s.label}
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: T.text, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>

        {/* Progression chart */}
        {prog && (
          <div style={{ background: T.surface, borderRadius: 16, padding: '14px 12px 10px', border: `1px solid ${T.line}`, marginBottom: 14 }}>
            <div style={{ padding: '0 4px 6px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.4, color: T.textDim2, textTransform: 'uppercase' }}>
                Top-set progression
              </div>
              <div style={{ fontSize: 12, color: T.textDim, fontVariantNumeric: 'tabular-nums' }}>last 15 sessions</div>
            </div>
            <LineChart data={prog} width={338} height={170} color={T.amber}/>
          </div>
        )}

        {/* Common weights learned */}
        {COMMON_WEIGHTS[eqId] && (
          <div style={{ background: T.surface, borderRadius: 16, padding: 14, border: `1px solid ${T.line}`, marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.4, color: T.textDim2, textTransform: 'uppercase', marginBottom: 10 }}>
              Weights you actually use
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {COMMON_WEIGHTS[eqId].map(w => (
                <Chip key={w} active={w === eq.lastWeight} tone="amber">{w} kg</Chip>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        <div style={{ background: T.surface, borderRadius: 16, padding: 14, border: `1px solid ${T.line}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.4, color: T.textDim2, textTransform: 'uppercase', marginBottom: 8 }}>
            Notes
          </div>
          <div style={{ fontSize: 14, color: T.textDim, lineHeight: 1.5 }}>
            {isCardio
              ? 'Unit #' + eq.name.slice(-1) + '. Near the stretching area. The display is dim — bring headphones.'
              : 'Pin-loaded. Seat notch 4. Foot plate centered. Plates stored to the left.'}
          </div>
        </div>
      </div>
    </Screen>
  );
}

// ─── HISTORY ────────────────────────────────────────────────
function HistoryScreen({ state, nav, actions }) {
  const [gymFilter, setGymFilter] = React.useState('all'); // 'all' | gymId
  const filteredSessions = gymFilter === 'all'
    ? SESSIONS
    : SESSIONS.filter(s => s.gymId === gymFilter);
  const heat = heatmapFor(gymFilter === 'all' ? null : gymFilter);

  // Build heatmap grid: 12 weeks × 7 days. index 0 = today.
  // We render weeks as columns (GitHub style) from oldest to newest.
  const weeks = [];
  for (let w = 11; w >= 0; w--) {
    const col = [];
    for (let d = 0; d < 7; d++) {
      const idx = w * 7 + d;
      col.push(heat[idx] || 0);
    }
    weeks.push(col);
  }

  const colorFor = (v) => {
    if (v === 0) return 'rgba(244,237,226,0.05)';
    if (v === 1) return T.amberDim.replace('0.14', '0.35');
    if (v === 2) return T.amberLine.replace('0.30', '0.62');
    return T.amber;
  };

  const totalSessions = filteredSessions.length;
  const totalMinutes = filteredSessions.reduce((a, s) => a + s.durationMin, 0);
  const currentStreak = (() => {
    let s = 0;
    for (let i = 0; i < heat.length; i++) {
      if (heat[i] > 0) s++;
      else if (i > 0) break;
    }
    return s;
  })();

  return (
    <Screen>
      <div style={{
        padding: '58px 16px 12px', background: T.bg,
        borderBottom: `1px solid ${T.line}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.6, color: T.textDim2, textTransform: 'uppercase' }}>
              History
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: T.text, letterSpacing: -0.4, marginTop: 2 }}>
              Last 12 weeks
            </div>
          </div>
        </div>
        {/* gym scope chips */}
        <div style={{
          display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2,
          marginLeft: -2, marginRight: -2, paddingLeft: 2, paddingRight: 2,
          scrollbarWidth: 'none',
        }}>
          <Chip active={gymFilter === 'all'} tone={gymFilter === 'all' ? 'amber' : 'neutral'} onClick={() => setGymFilter('all')}>All gyms</Chip>
          {GYMS.map(g => (
            <Chip key={g.id} active={gymFilter === g.id} tone={gymFilter === g.id ? 'amber' : 'neutral'} onClick={() => setGymFilter(g.id)}>
              {g.name}
            </Chip>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 120px' }}>
        {/* heatmap */}
        <div style={{ background: T.surface, borderRadius: 16, padding: 14, border: `1px solid ${T.line}`, marginBottom: 14 }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            marginBottom: 12,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.4, color: T.textDim2, textTransform: 'uppercase' }}>
              Workout frequency
            </div>
            <div style={{ fontSize: 12, color: T.textDim, fontVariantNumeric: 'tabular-nums' }}>
              {totalSessions} sessions
            </div>
          </div>
          <div style={{
            display: 'flex', gap: 3, alignItems: 'flex-end',
            overflowX: 'auto', paddingBottom: 2,
          }}>
            {weeks.map((col, wi) => (
              <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {col.map((v, di) => (
                  <div key={di} style={{
                    width: 18, height: 18, borderRadius: 4,
                    background: colorFor(v),
                  }}/>
                ))}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 20, marginTop: 12, fontSize: 11, color: T.textDim2, fontVariantNumeric: 'tabular-nums' }}>
            <div><span style={{ color: T.amber, fontWeight: 700 }}>{currentStreak}</span> day streak</div>
            <div><span style={{ color: T.text, fontWeight: 700 }}>{Math.round(totalMinutes/60)}h {totalMinutes%60}m</span> total</div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
              less
              <div style={{ width: 10, height: 10, borderRadius: 2, background: colorFor(0) }}/>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: colorFor(1) }}/>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: colorFor(2) }}/>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: colorFor(3) }}/>
              more
            </div>
          </div>
        </div>

        {/* session list */}
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.4, color: T.textDim2, textTransform: 'uppercase', margin: '4px 4px 10px' }}>
          Recent sessions
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filteredSessions.map(s => {
            const totalVol = s.machines.reduce((a, m) =>
              a + m.sets.reduce((b, st) => b + st.weight * st.reps, 0), 0);
            const sessionGym = GYMS.find(g => g.id === s.gymId);
            return (
              <Press key={s.id} onClick={() => nav.push('sessionDetail', { sessionId: s.id })} style={{
                background: T.surface, borderRadius: 14, padding: '12px 14px',
                border: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', gap: 12,
                textAlign: 'left', width: '100%',
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: T.surface2, border: `1px solid ${T.line2}`,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, fontVariantNumeric: 'tabular-nums',
                }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: T.text, lineHeight: 1 }}>
                    {s.dayOffset === 0 ? 'Now' : `${s.dayOffset}d`}
                  </div>
                  <div style={{ fontSize: 9, color: T.textDim2, marginTop: 1 }}>
                    {s.dayOffset === 0 ? 'today' : 'ago'}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, color: T.text, fontWeight: 600, letterSpacing: -0.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.machines.map(m => EQUIPMENT.find(e => e.id === m.id)?.name.split(' ')[0]).join(' · ')}
                  </div>
                  <div style={{ fontSize: 12, color: T.textDim, marginTop: 2, fontVariantNumeric: 'tabular-nums', display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                    {gymFilter === 'all' && sessionGym && (
                      <>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          color: T.textDim, fontWeight: 500,
                        }}>
                          <span style={{ width: 5, height: 5, borderRadius: 1, background: T.amber }}/>
                          {sessionGym.name}
                        </span>
                        <span style={{ color: T.textDim2 }}>·</span>
                      </>
                    )}
                    <span>{s.machines.length} machines · {s.durationMin} min{totalVol > 0 ? ` · ${Math.round(totalVol)} kg vol` : ''}</span>
                  </div>
                </div>
                {Icon.chevR(16, T.textDim2)}
              </Press>
            );
          })}
        </div>
      </div>
    </Screen>
  );
}

// ─── SESSION DETAIL ─────────────────────────────────────────
function SessionDetailScreen({ state, nav, sessionId }) {
  const s = SESSIONS.find(x => x.id === sessionId);
  const sessionGym = GYMS.find(g => g.id === s.gymId);
  const totalVol = s.machines.reduce((a, m) => a + m.sets.reduce((b, st) => b + st.weight * st.reps, 0), 0);

  return (
    <Screen>
      <ScreenHeader
        title={s.dayOffset === 0 ? 'Today' : `${s.dayOffset} days ago`}
        eyebrow={sessionGym ? sessionGym.name.toUpperCase() : 'SESSION'}
        onBack={() => nav.pop()}
      />
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 120px' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16,
        }}>
          {[
            { label: 'Duration', value: `${s.durationMin} min` },
            { label: 'Machines', value: s.machines.length },
            { label: 'Volume', value: totalVol > 0 ? `${(totalVol/1000).toFixed(1)}t` : '—' },
          ].map((x, i) => (
            <div key={i} style={{ background: T.surface, borderRadius: 12, padding: '10px 12px', border: `1px solid ${T.line}` }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.3, color: T.textDim2, textTransform: 'uppercase' }}>{x.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: T.text, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{x.value}</div>
            </div>
          ))}
        </div>

        {s.machines.map((m, mi) => {
          const eq = EQUIPMENT.find(e => e.id === m.id);
          const isCardio = eq.type === 'cardio';
          return (
            <div key={mi} style={{ marginBottom: 14 }}>
              <Press onClick={() => nav.push('detail', { eqId: m.id })} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 4px', width: '100%',
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: `linear-gradient(135deg, ${eq.tint}, #0d0f12)`,
                  border: `1px solid ${T.line2}`, padding: 6,
                }}>
                  <EquipmentGlyph kind={eq.glyph}/>
                </div>
                <div style={{ flex: 1, fontSize: 15, color: T.text, fontWeight: 600 }}>{eq.name}</div>
                {Icon.chevR(14, T.textDim2)}
              </Press>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {isCardio ? (
                  <div style={{ background: T.surface, borderRadius: 10, padding: '10px 14px', border: `1px solid ${T.line}`, fontSize: 14, color: T.text, fontVariantNumeric: 'tabular-nums' }}>
                    {m.durationMin} min
                  </div>
                ) : m.sets.map((st, si) => (
                  <div key={si} style={{
                    background: T.surface, borderRadius: 10, padding: '9px 14px',
                    border: `1px solid ${T.line}`,
                    display: 'flex', alignItems: 'center', gap: 12,
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    <div style={{ width: 20, color: T.textDim2, fontSize: 12, fontWeight: 600 }}>#{si+1}</div>
                    <div style={{ flex: 1, fontSize: 14, color: T.text }}>
                      {st.weight} kg <span style={{ color: T.textDim2 }}>×</span> {st.reps}
                    </div>
                    <div style={{ fontSize: 12, color: T.textDim2 }}>{st.weight * st.reps} kg</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Screen>
  );
}

// ─── STATS ──────────────────────────────────────────────────
function StatsScreen({ state, nav, actions }) {
  const [metric, setMetric] = React.useState('top'); // top | 1rm | volume
  // Compute muscle-group distribution from sessions (all gyms combined)
  const groups = { push: 0, pull: 0, legs: 0, cardio: 0 };
  SESSIONS.forEach(s => {
    s.machines.forEach(m => {
      const eq = EQUIPMENT.find(e => e.id === m.id);
      if (eq) groups[eq.group] += m.sets.length || (m.durationMin ? 1 : 0);
    });
  });
  const groupMax = Math.max(...Object.values(groups), 1);

  const machineIds = Object.keys(PROGRESSION);

  return (
    <Screen>
      <div style={{
        padding: '58px 16px 12px', background: T.bg,
        borderBottom: `1px solid ${T.line}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.6, color: T.textDim2, textTransform: 'uppercase' }}>Progression</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: T.text, letterSpacing: -0.4, marginTop: 2 }}>Stats</div>
          </div>
          <Press onClick={actions.exportCsv} style={{
            minHeight: 40, padding: '0 12px', borderRadius: 10,
            background: T.surface, border: `1px solid ${T.line2}`, color: T.text,
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 12, fontWeight: 500,
          }}>
            {Icon.download(14)} CSV
          </Press>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { id: 'top', label: 'Top set' },
            { id: '1rm', label: 'Est. 1RM' },
            { id: 'volume', label: 'Volume' },
          ].map(m => (
            <Chip key={m.id} active={metric === m.id} tone="amber" onClick={() => setMetric(m.id)}>{m.label}</Chip>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 120px' }}>
        {/* Muscle group distribution */}
        <div style={{ background: T.surface, borderRadius: 16, padding: 14, border: `1px solid ${T.line}`, marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.4, color: T.textDim2, textTransform: 'uppercase', marginBottom: 12 }}>
            Distribution · last 30 days
          </div>
          {Object.entries(groups).map(([g, v]) => (
            <div key={g} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: T.textDim, marginBottom: 4, fontVariantNumeric: 'tabular-nums' }}>
                <span style={{ textTransform: 'capitalize', color: T.text, fontWeight: 500 }}>{g}</span>
                <span>{v} sets</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: 'rgba(244,237,226,0.06)', overflow: 'hidden' }}>
                <div style={{
                  width: `${(v / groupMax) * 100}%`, height: '100%',
                  background: g === 'cardio' ? T.teal : T.amber,
                  borderRadius: 3,
                }}/>
              </div>
            </div>
          ))}
        </div>

        {/* Per-machine cards */}
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.4, color: T.textDim2, textTransform: 'uppercase', margin: '4px 4px 10px' }}>
          By machine
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {machineIds.map(id => {
            const eq = EQUIPMENT.find(e => e.id === id);
            const prog = PROGRESSION[id];
            let series;
            if (metric === 'top') series = prog;
            else if (metric === '1rm') series = prog.map((w, i) => Math.round(w * (1 + 10/30))); // Epley-ish with reps=10
            else series = prog.map((w, i) => w * 10 * 3); // volume ≈ weight × reps × sets
            const delta = series[series.length-1] - series[0];
            return (
              <Press key={id} onClick={() => nav.push('detail', { eqId: id })} style={{
                background: T.surface, borderRadius: 14, padding: 12,
                border: `1px solid ${T.line}`, width: '100%', textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 10, flexShrink: 0,
                  background: `linear-gradient(135deg, ${eq.tint}, #0d0f12)`,
                  border: `1px solid ${T.line2}`, padding: 6,
                }}>
                  <EquipmentGlyph kind={eq.glyph}/>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{eq.name}</div>
                    <div style={{ fontSize: 13, color: delta > 0 ? T.amber : T.textDim, fontWeight: 600, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                      {delta > 0 ? '+' : ''}{Math.round(delta)} {metric === 'volume' ? 'kg' : 'kg'}
                    </div>
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <Sparkline data={series} width={260} height={28}/>
                  </div>
                </div>
              </Press>
            );
          })}
        </div>

        {/* CSV export */}
        <Press onClick={actions.exportCsv} style={{
          marginTop: 14, width: '100%', minHeight: 52, borderRadius: 14,
          background: T.surface, border: `1px solid ${T.line2}`, color: T.text,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          fontSize: 15, fontWeight: 600,
        }}>
          {Icon.download(18)} Export all data as CSV
        </Press>
        <div style={{ textAlign: 'center', color: T.textDim2, fontSize: 11, marginTop: 8 }}>
          Your data is portable. Always.
        </div>
      </div>
    </Screen>
  );
}

// ─── SETUP / ONBOARDING ─────────────────────────────────────
function SetupScreen({ state, nav, actions }) {
  const [addingEqFor, setAddingEqFor] = React.useState(null); // gymId or null
  const [addingGym, setAddingGym] = React.useState(false);
  const [newGymName, setNewGymName] = React.useState('');
  const [newGymCity, setNewGymCity] = React.useState('');
  const [expanded, setExpanded] = React.useState(() => new Set([state.activeGymId]));

  const toggle = (id) => setExpanded(s => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  return (
    <Screen>
      <div style={{
        padding: '58px 16px 12px', background: T.bg,
        borderBottom: `1px solid ${T.line}`,
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.6, color: T.textDim2, textTransform: 'uppercase' }}>Setup</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: T.text, letterSpacing: -0.4, marginTop: 2 }}>Your gyms</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 120px' }}>
        {/* Summary strip */}
        <div style={{
          background: T.surface, borderRadius: 14, padding: 14, border: `1px solid ${T.line}`, marginBottom: 14,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 20,
            background: T.amberDim, color: T.amber,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{Icon.check(20)}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>
              {GYMS.length} {GYMS.length === 1 ? 'gym' : 'gyms'} · {EQUIPMENT.length} machines
            </div>
            <div style={{ fontSize: 12, color: T.textDim, marginTop: 1 }}>Add more when you train somewhere new.</div>
          </div>
        </div>

        {/* Gym cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 10 }}>
          {GYMS.map(g => {
            const gymEq = EQUIPMENT.filter(e => e.gymId === g.id);
            const isActive = g.id === state.activeGymId;
            const isOpen = expanded.has(g.id);
            return (
              <div key={g.id} style={{
                background: T.surface, borderRadius: 14,
                border: `1px solid ${isActive ? T.amberLine : T.line}`,
                overflow: 'hidden',
              }}>
                <Press onClick={() => toggle(g.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', width: '100%', textAlign: 'left',
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                    background: `linear-gradient(135deg, ${g.tint} 0%, ${T.bg} 100%)`,
                    border: `1px solid ${T.line2}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: isActive ? T.amber : T.textDim, fontSize: 15, fontWeight: 700,
                  }}>{g.name.split(' ').map(w => w[0]).slice(0,2).join('')}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: T.text, letterSpacing: -0.1 }}>{g.name}</div>
                      {isActive && (
                        <div style={{
                          padding: '2px 6px', borderRadius: 4,
                          background: T.amberDim, color: T.amber,
                          fontSize: 9, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase',
                        }}>Active</div>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: T.textDim, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                      {g.city} · {gymEq.length} {gymEq.length === 1 ? 'machine' : 'machines'}
                    </div>
                  </div>
                  <div style={{
                    color: T.textDim2,
                    transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 180ms',
                  }}>{Icon.chevD(16)}</div>
                </Press>

                {isOpen && (
                  <div style={{ padding: '0 10px 10px', borderTop: `1px solid ${T.line}` }}>
                    {!isActive && (
                      <Press onClick={() => actions.setActiveGym(g.id)} style={{
                        width: '100%', minHeight: 40, margin: '10px 0',
                        borderRadius: 10, background: T.surface2, border: `1px solid ${T.line2}`,
                        color: T.text, fontSize: 13, fontWeight: 500,
                      }}>Make active</Press>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 0 0' }}>
                      {gymEq.map(eq => (
                        <div key={eq.id} style={{
                          background: T.surface2, borderRadius: 10, padding: '8px 10px',
                          border: `1px solid ${T.line}`,
                          display: 'flex', alignItems: 'center', gap: 10,
                        }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: 8,
                            background: `linear-gradient(135deg, ${eq.tint}, ${T.bg})`,
                            border: `1px solid ${T.line2}`, padding: 5,
                          }}>
                            <EquipmentGlyph kind={eq.glyph}/>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, color: T.text, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{eq.name}</div>
                            <div style={{ fontSize: 10, color: T.textDim2, marginTop: 1, textTransform: 'capitalize' }}>{eq.type} · {eq.group}</div>
                          </div>
                          {Icon.chevR(14, T.textDim2)}
                        </div>
                      ))}
                      <Press onClick={() => setAddingEqFor(g.id)} style={{
                        width: '100%', minHeight: 44, marginTop: 4,
                        borderRadius: 10, background: 'transparent',
                        border: `1.5px dashed ${T.line2}`,
                        color: T.amber, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        fontSize: 13, fontWeight: 600,
                      }}>
                        {Icon.plus(14)} Add equipment to {g.name.split(' ')[0]}
                      </Press>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Add another gym */}
        {!addingGym ? (
          <Press onClick={() => setAddingGym(true)} style={{
            width: '100%', minHeight: 56, borderRadius: 14,
            background: 'transparent', border: `1.5px dashed ${T.line2}`,
            color: T.amber, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            fontSize: 15, fontWeight: 600,
          }}>
            {Icon.plus(18)} Add another gym
          </Press>
        ) : (
          <div style={{
            background: T.surface, borderRadius: 14, border: `1px solid ${T.amberLine}`,
            padding: 14,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.4, color: T.amber, textTransform: 'uppercase', marginBottom: 10 }}>New gym</div>
            <input value={newGymName} onChange={e => setNewGymName(e.target.value)}
              placeholder="Gym name"
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 10,
                background: T.surface2, border: `1px solid ${T.line2}`,
                color: T.text, fontSize: 15, outline: 'none', boxSizing: 'border-box',
                marginBottom: 8,
              }}/>
            <input value={newGymCity} onChange={e => setNewGymCity(e.target.value)}
              placeholder="City or label (e.g. Home)"
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 10,
                background: T.surface2, border: `1px solid ${T.line2}`,
                color: T.text, fontSize: 15, outline: 'none', boxSizing: 'border-box',
                marginBottom: 12,
              }}/>
            <div style={{ display: 'flex', gap: 8 }}>
              <Press onClick={() => { setAddingGym(false); setNewGymName(''); setNewGymCity(''); }} style={{
                flex: 1, minHeight: 44, borderRadius: 999,
                background: T.surface2, border: `1px solid ${T.line2}`, color: T.text,
                fontSize: 14, fontWeight: 600,
              }}>Cancel</Press>
              <Press onClick={() => { setAddingGym(false); setNewGymName(''); setNewGymCity(''); }} style={{
                flex: 2, minHeight: 44, borderRadius: 999,
                background: T.amber, color: '#1b0a00',
                fontSize: 14, fontWeight: 700,
                boxShadow: `0 ${6 * T._mood.buttonPunch}px 18px ${T.amberGlow}`,
              }}>Create gym</Press>
            </div>
          </div>
        )}
      </div>

      {addingEqFor && <AddEquipmentSheet gymId={addingEqFor} onClose={() => setAddingEqFor(null)}/>}
    </Screen>
  );
}

// ─── ADD EQUIPMENT SHEET ────────────────────────────────────
function AddEquipmentSheet({ onClose }) {
  const [step, setStep] = React.useState(0);
  const [name, setName] = React.useState('');
  const [type, setType] = React.useState('machine');
  const [group, setGroup] = React.useState('push');

  const types = ['barbell','machine','cable','freeweight','cardio'];
  const groups = ['push','pull','legs','cardio'];

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 40,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'flex-end',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', background: T.surface,
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: '12px 16px 28px',
        borderTop: `1px solid ${T.line2}`,
        maxHeight: '80%', overflowY: 'auto',
      }}>
        <div style={{
          width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.18)',
          margin: '4px auto 12px',
        }}/>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.4, color: T.textDim2, textTransform: 'uppercase' }}>Step {step+1} of 3</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: T.text, marginTop: 2 }}>
              {step === 0 ? 'Photo' : step === 1 ? 'Name & type' : 'Muscle group'}
            </div>
          </div>
          <Press onClick={onClose} style={{ color: T.textDim, padding: 8 }}>{Icon.close(20)}</Press>
        </div>

        {step === 0 && (
          <div>
            <div style={{
              aspectRatio: '4 / 3', borderRadius: 16,
              background: `linear-gradient(135deg, #1c2026, #0d0f12)`,
              border: `1.5px dashed ${T.line2}`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 10, color: T.textDim, marginBottom: 12,
            }}>
              <div style={{ width: 52, height: 52, borderRadius: 26, background: T.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {Icon.camera(24, T.amber)}
              </div>
              <div style={{ fontSize: 14 }}>Take a photo of the machine</div>
              <div style={{ fontSize: 11, color: T.textDim2 }}>or upload from library</div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.4, color: T.textDim2, textTransform: 'uppercase', marginBottom: 8 }}>Name</div>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. Cable Row Machine"
                style={{
                  width: '100%', padding: '14px 14px', borderRadius: 10,
                  background: T.surface2, border: `1px solid ${T.line2}`,
                  color: T.text, fontSize: 16, outline: 'none', boxSizing: 'border-box',
                }}/>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.4, color: T.textDim2, textTransform: 'uppercase', marginBottom: 8 }}>Type</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {types.map(t => <Chip key={t} active={type === t} tone="amber" onClick={() => setType(t)}>{t}</Chip>)}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.4, color: T.textDim2, textTransform: 'uppercase', marginBottom: 8 }}>Primary muscle group</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {groups.map(g => <Chip key={g} active={group === g} tone="amber" onClick={() => setGroup(g)}>{g}</Chip>)}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          {step > 0 && (
            <Press onClick={() => setStep(step - 1)} style={{
              flex: 1, minHeight: 52, borderRadius: 999,
              background: T.surface2, border: `1px solid ${T.line2}`, color: T.text,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 15, fontWeight: 600,
            }}>Back</Press>
          )}
          <Press onClick={() => step === 2 ? onClose() : setStep(step + 1)} style={{
            flex: 2, minHeight: 52, borderRadius: 999,
            background: T.amber, color: '#1b0a00',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15, fontWeight: 700,
            boxShadow: `0 ${8 * T._mood.buttonPunch}px 24px ${T.amberGlow}`,
          }}>
            {step === 2 ? 'Add to gym' : 'Continue'}
          </Press>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  HomeScreen, LogScreen, DetailScreen, HistoryScreen, SessionDetailScreen,
  StatsScreen, SetupScreen, AddEquipmentSheet, HomeGrid,
});

function HomeGrid({ equipment, onSelect }) {
  const d = useDensity();
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${d.gridCols}, 1fr)`,
      gap: d.gap,
    }}>
      {equipment.map(eq => (
        <EquipmentTile key={eq.id} eq={eq} onClick={() => onSelect(eq.id)}/>
      ))}
    </div>
  );
}
