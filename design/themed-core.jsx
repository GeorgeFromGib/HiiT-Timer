// ThemedTimer — parameterized HIIT timer for the design canvas.
// Takes { theme, layout } props, runs its own clock (autoplay + staggered start),
// and renders one of three layouts. No tweaks dependency.

const { useState: useTState, useEffect: useTEffect, useRef: useTRef } = React;

// ── phase semantics (label + icon are constant; colors come from theme) ──
const PHASE_META = {
  warmup:   { label: 'WARM UP',   icon: 'sun' },
  work:     { label: 'WORK',      icon: 'flame' },
  blast:    { label: 'ALL OUT',   icon: 'bolt' },
  rest:     { label: 'RECOVER',   icon: 'pause' },
  cooldown: { label: 'COOL DOWN', icon: 'snow' },
};

const TWORKOUT = [
  { type: 'warmup', dur: 45 }, { type: 'work', dur: 30 }, { type: 'rest', dur: 15 },
  { type: 'blast', dur: 30 },  { type: 'rest', dur: 15 }, { type: 'work', dur: 30 },
  { type: 'rest', dur: 15 },   { type: 'blast', dur: 30 },{ type: 'rest', dur: 15 },
  { type: 'cooldown', dur: 60 },
];
const TTOTAL = TWORKOUT.reduce((a, b) => a + b.dur, 0);

const tfmt = (s) => {
  s = Math.max(0, Math.ceil(s));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

function TIcon({ name, color, size = 26, w = 2.2 }) {
  const p = { fill: 'none', stroke: color, strokeWidth: w, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const ic = {
    sun:   <g {...p}><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8"/></g>,
    flame: <path {...p} d="M12 2.5c3 4 6 5.5 6 10a6 6 0 0 1-12 0c0-2 1-3.4 2.4-4.6.2 1.6 1 2.4 2 2.6-1.2-3 .3-6.4 1.6-8z"/>,
    bolt:  <path {...p} d="M13 2 4 13h6l-1 9 9-12h-6l1-8z"/>,
    pause: <g {...p}><rect x="6" y="5" width="4" height="14" rx="1.5"/><rect x="14" y="5" width="4" height="14" rx="1.5"/></g>,
    snow:  <g {...p}><path d="M12 2v20M3.5 7l17 10M20.5 7l-17 10"/><path d="M12 6l-2.5-2.5M12 6l2.5-2.5M12 18l-2.5 2.5M12 18l2.5 2.5"/></g>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24">{ic[name]}</svg>;
}

// shared clock hook
function useClock(startElapsed, autoplay) {
  const [elapsed, setElapsed] = useTState(startElapsed || 0);
  const [running, setRunning] = useTState(!!autoplay);
  const last = useTRef(null);
  useTEffect(() => {
    if (!running) { last.current = null; return; }
    last.current = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const dt = (now - last.current) / 1000;
      last.current = now;
      setElapsed((e) => {
        let ne = e + dt;
        if (ne >= TTOTAL) ne = ne % TTOTAL; // loop for showcase
        return ne;
      });
    }, 90);
    return () => clearInterval(id);
  }, [running]);
  return [elapsed, running, setRunning, setElapsed];
}

function deriveState(elapsed) {
  let acc = 0, idx = 0, into = 0;
  for (let i = 0; i < TWORKOUT.length; i++) {
    if (elapsed < acc + TWORKOUT[i].dur || i === TWORKOUT.length - 1) { idx = i; into = elapsed - acc; break; }
    acc += TWORKOUT[i].dur;
  }
  return { idx, into, acc, cur: TWORKOUT[idx] };
}

// resolve a phase's color from theme (semantic palette, or mono override)
function phaseColor(theme, type) {
  if (theme.monoSignal) return theme.accent;
  return theme.phases[type];
}

function PlayBtnT({ running, theme, onClick }) {
  return (
    <button onClick={onClick} aria-label={running ? 'Pause' : 'Start'} style={{
      appearance: 'none', border: 'none', cursor: 'pointer',
      width: 74, height: 74, borderRadius: '50%',
      background: `radial-gradient(120% 120% at 30% 25%, ${theme.accent}, ${theme.accent}cc 60%, ${theme.accent}99)`,
      boxShadow: `0 12px 30px ${theme.accent}55, inset 0 1px 1px rgba(255,255,255,0.45)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: theme.btnGlyph, flexShrink: 0,
    }}>
      {running
        ? <svg width="26" height="28" viewBox="0 0 28 30"><rect x="3" y="2" width="8" height="26" rx="2.6" fill="currentColor"/><rect x="17" y="2" width="8" height="26" rx="2.6" fill="currentColor"/></svg>
        : <svg width="26" height="28" viewBox="0 0 28 30"><path d="M5 3 L25 15 L5 27 Z" fill="currentColor" stroke="currentColor" strokeWidth="3.5" strokeLinejoin="round"/></svg>}
    </button>
  );
}

function GhostBtnT({ children, onClick, theme }) {
  return (
    <button onClick={onClick} style={{
      appearance: 'none', cursor: 'pointer', width: 54, height: 54, borderRadius: '50%',
      background: theme.ghostBg, border: `1px solid ${theme.hairline}`,
      color: theme.subText, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>{children}</button>
  );
}

function ResetIcon() { return <svg width="19" height="19" viewBox="0 0 20 20" fill="none"><path d="M3 10a7 7 0 1 1 2.3 5.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M3 5v4h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
function SkipIcon() { return <svg width="19" height="19" viewBox="0 0 20 20" fill="none"><path d="M4 4l9 6-9 6V4z" fill="currentColor"/><rect x="15" y="4" width="2.5" height="12" rx="1.2" fill="currentColor"/></svg>; }

function Header({ theme }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 10.5, letterSpacing: '0.18em', textTransform: 'uppercase', color: theme.faintText, fontWeight: 700 }}>Interval Session</span>
        <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em', color: theme.text }}>Tabata Burnout</span>
      </div>
      <div style={{ width: 36, height: 36, borderRadius: '50%', background: theme.ghostBg, border: `1px solid ${theme.hairline}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.subText }}>
        <svg width="14" height="14" viewBox="0 0 15 15"><path d="M2 2l11 11M13 2L2 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
      </div>
    </div>
  );
}

function Controls({ theme, running, setRunning, setElapsed }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 22, marginTop: 6 }}>
      <GhostBtnT theme={theme} onClick={() => { setRunning(false); setElapsed(0); }}><ResetIcon /></GhostBtnT>
      <PlayBtnT theme={theme} running={running} onClick={() => setRunning((r) => !r)} />
      <GhostBtnT theme={theme} onClick={() => setElapsed((e) => { const { acc, cur } = deriveState(e); return (acc + cur.dur) % TTOTAL; })}><SkipIcon /></GhostBtnT>
    </div>
  );
}

window.HIIT = { PHASE_META, TWORKOUT, TTOTAL, tfmt, TIcon, useClock, deriveState, phaseColor, PlayBtnT, GhostBtnT, ResetIcon, SkipIcon, Header, Controls };
