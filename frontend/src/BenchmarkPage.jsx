import React, { useState, useEffect, useRef } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

// ── Constants ─────────────────────────────────────────────────────────────
const ALGORITHMS = [
  'Bubble Sort', 'Selection Sort', 'Insertion Sort',
  'Merge Sort', 'Quick Sort', 'Heap Sort', '3-way Merge Sort', 'Cycle Sort',
];
const COLOR_A = '#4f46e5'; // indigo  — Algorithm A
const COLOR_B = '#4f46e5'; // emerald — Algorithm B
const PLAY_INTERVAL_MS = 500;

// ── Mini array visualizer (stateless, purely from props) ──────────────────
function MiniVisualizer({ array, compareIndices = [], swapIndices = [], pivotIndices = [] }) {
  return (
    <div className="bench-array">
      {array.map((num, i) => {
        const isCmp  = compareIndices.includes(i);
        const isSwap = swapIndices.includes(i);
        const isPvt  = pivotIndices.includes(i);
        return (
          <div key={i} className="bench-array-item">
            <div className={[
              'bench-card',
              isCmp  ? 'bench-card--compare' : '',
              isSwap ? 'bench-card--swap'    : '',
              isPvt  ? 'bench-card--pivot'   : '',
            ].filter(Boolean).join(' ')}>
              {num}
            </div>
            {isCmp  && <span className="bench-label bench-label--cmp">cmp</span>}
            {isSwap && <span className="bench-label bench-label--swap">swap</span>}
            {isPvt  && <span className="bench-label bench-label--pivot">pivot</span>}
          </div>
        );
      })}
    </div>
  );
}

// ── Stat counter block ────────────────────────────────────────────────────
function StatBlock({ label, value, color }) {
  return (
    <div className="bench-stat" style={{ borderColor: color }}>
      <span className="bench-stat-value" style={{ color }}>{value}</span>
      <span className="bench-stat-label">{label}</span>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function BenchmarkPage({ onBack }) {
  const [algoA, setAlgoA] = useState('Bubble Sort');
  const [algoB, setAlgoB] = useState('Merge Sort');
  const [arrayInput, setArrayInput] = useState('12, 45, 23, 7, 50, 3, 38');

  const [stepsA, setStepsA] = useState([]);
  const [stepsB, setStepsB] = useState([]);
  const [cursor, setCursor] = useState(0);       // shared step index
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const cursorRef = useRef(0);
  const stepsARef = useRef([]);
  const stepsBRef = useRef([]);

  // ── Fetch both plans ────────────────────────────────────────────────────
  const handleRun = async () => {
    const parsed = arrayInput
      .split(',')
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !Number.isNaN(n));

    if (parsed.length < 2) {
      setError('Please enter at least 2 numbers separated by commas.');
      return;
    }
    if (algoA === algoB) {
      setError('Please select two different algorithms to compare.');
      return;
    }

    setError('');
    setIsLoading(true);
    setIsPlaying(false);
    setCursor(0);
    cursorRef.current = 0;

    try {
      const res = await fetch('http://localhost:8000/api/v1/benchmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          algorithm_a: algoA,
          algorithm_b: algoB,
          data_structure: parsed,
        }),
      });
      if (!res.ok) throw new Error('Backend error');
      const data = await res.json();
      stepsARef.current = data.a.steps;
      stepsBRef.current = data.b.steps;
      setStepsA(data.a.steps);
      setStepsB(data.b.steps);
      // Show step 0 immediately
      setCursor(0);
    } catch {
      setError('Could not reach the backend. Make sure the FastAPI server is running.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Playback interval ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isPlaying) return;
    const maxLen = Math.max(stepsARef.current.length, stepsBRef.current.length);
    const id = setInterval(() => {
      const next = cursorRef.current + 1;
      if (next >= maxLen) {
        setIsPlaying(false);
        clearInterval(id);
        return;
      }
      cursorRef.current = next;
      setCursor(next);
    }, PLAY_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isPlaying]);

  // ── Seek ────────────────────────────────────────────────────────────────
  const seek = (idx) => {
    const maxLen = Math.max(stepsA.length, stepsB.length);
    const clamped = Math.max(0, Math.min(idx, maxLen - 1));
    cursorRef.current = clamped;
    setCursor(clamped);
  };

  const handlePlayPause = () => {
    const maxLen = Math.max(stepsA.length, stepsB.length);
    if (cursor >= maxLen - 1) { seek(0); }
    setIsPlaying(p => !p);
  };

  // ── Derived state for current step ──────────────────────────────────────
  const stepA = stepsA[Math.min(cursor, stepsA.length - 1)] ?? null;
  const stepB = stepsB[Math.min(cursor, stepsB.length - 1)] ?? null;
  const hasData = stepsA.length > 0 && stepsB.length > 0;
  const maxLen  = hasData ? Math.max(stepsA.length, stepsB.length) : 1;
  const isComplete = hasData && cursor >= maxLen - 1;

  // ── Chart data: one point per step up to the cursor ─────────────────────
  // Sample at most 120 points so the chart stays crisp on large arrays
  const chartData = (() => {
    if (!hasData) return [];
    const limit = cursor + 1;
    const step  = Math.max(1, Math.floor(limit / 120));
    const pts   = [];
    for (let i = 0; i < limit; i += step) {
      const sa = stepsA[Math.min(i, stepsA.length - 1)];
      const sb = stepsB[Math.min(i, stepsB.length - 1)];
      pts.push({
        step: i + 1,
        [`${algoA} cmps`]:  sa?.comparisons ?? 0,
        [`${algoA} swaps`]: sa?.swaps ?? 0,
        [`${algoB} cmps`]:  sb?.comparisons ?? 0,
        [`${algoB} swaps`]: sb?.swaps ?? 0,
      });
    }
    return pts;
  })();

  // ── Final totals (last enriched step) ───────────────────────────────────
  const lastA = stepsA[stepsA.length - 1];
  const lastB = stepsB[stepsB.length - 1];

  return (
    <div className="bench-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Benchmark</h1>
          <p className="page-subtitle">
            Run two algorithms on the same array and watch their comparison and swap counts race in real time.
          </p>
        </div>
        <button className="chat-toggle" onClick={onBack}>← Back</button>
      </div>

      {/* Setup controls */}
      <div className="bench-setup">
        <div className="bench-setup-row">
          <div className="bench-algo-pick">
            <label>Algorithm A</label>
            <select
              className="drop-down bench-select bench-select--a"
              value={algoA}
              onChange={e => setAlgoA(e.target.value)}
            >
              {ALGORITHMS.map(a => <option key={a}>{a}</option>)}
            </select>
          </div>

          <span className="bench-vs">vs</span>

          <div className="bench-algo-pick">
            <label>Algorithm B</label>
            <select
              className="drop-down bench-select bench-select--b"
              value={algoB}
              onChange={e => setAlgoB(e.target.value)}
            >
              {ALGORITHMS.map(a => <option key={a}>{a}</option>)}
            </select>
          </div>
        </div>

        <div className="bench-setup-row bench-setup-row--array">
          <label htmlFor="bench-array-input">Array (comma separated):</label>
          <input
            id="bench-array-input"
            type="text"
            className="array-text-input"
            value={arrayInput}
            onChange={e => setArrayInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleRun()}
            placeholder="e.g. 12, 45, 23, 7, 50"
          />
          <button onClick={handleRun} disabled={isLoading}>
            {isLoading ? '⏳ Loading…' : '▶ Run Benchmark'}
          </button>
        </div>

        {error && <p className="bench-error">{error}</p>}
      </div>

      {/* Main content — only shown after data is loaded */}
      {hasData && (
        <>
          {/* Side-by-side visualizers */}
          <div className="bench-viz-row">
            {/* Algorithm A */}
            <div className="bench-viz-panel bench-viz-panel--a">
              <div className="bench-viz-title" style={{ color: COLOR_A }}>{algoA}</div>
              <MiniVisualizer
                array={stepA?.result ?? []}
                compareIndices={stepA?.compare_indices ?? []}
                swapIndices={stepA?.swap_indices ?? []}
                pivotIndices={stepA?.pivot_indices ?? []}
              />
              <p className="bench-narration">{stepA?.logic ?? ''}</p>
              <div className="bench-stats">
                <StatBlock label="Comparisons" value={stepA?.comparisons ?? 0} color={COLOR_A} />
                <StatBlock label="Swaps"       value={stepA?.swaps ?? 0}       color={COLOR_A} />
                <StatBlock label="Steps"       value={Math.min(cursor + 1, stepsA.length)} color={COLOR_A} />
              </div>
            </div>

            {/* Algorithm B */}
            <div className="bench-viz-panel bench-viz-panel--b">
              <div className="bench-viz-title" style={{ color: COLOR_B }}>{algoB}</div>
              <MiniVisualizer
                array={stepB?.result ?? []}
                compareIndices={stepB?.compare_indices ?? []}
                swapIndices={stepB?.swap_indices ?? []}
                pivotIndices={stepB?.pivot_indices ?? []}
              />
              <p className="bench-narration">{stepB?.logic ?? ''}</p>
              <div className="bench-stats">
                <StatBlock label="Comparisons" value={stepB?.comparisons ?? 0} color={COLOR_B} />
                <StatBlock label="Swaps"       value={stepB?.swaps ?? 0}       color={COLOR_B} />
                <StatBlock label="Steps"       value={Math.min(cursor + 1, stepsB.length)} color={COLOR_B} />
              </div>
            </div>
          </div>

          {/* Transport controls */}
          <div className="transport bench-transport">
            <div className="transport-buttons">
              <button className="transport-btn" onClick={() => { setIsPlaying(false); seek(0); }}
                disabled={cursor === 0} title="Jump to start">⏮</button>
              <button className="transport-btn" onClick={() => seek(cursor - 1)}
                disabled={cursor === 0} title="Step back">◀</button>
              <button className="transport-btn transport-btn--play" onClick={handlePlayPause}
                disabled={isComplete && cursor >= maxLen - 1}
                title={isPlaying ? 'Pause' : 'Play'}>
                {isPlaying ? '⏸' : isComplete ? '↺ Replay' : '▶ Play'}
              </button>
              <button className="transport-btn" onClick={() => seek(cursor + 1)}
                disabled={cursor >= maxLen - 1} title="Step forward">▶</button>
              <button className="transport-btn" onClick={() => { setIsPlaying(false); seek(maxLen - 1); }}
                disabled={cursor >= maxLen - 1} title="Jump to end">⏭</button>
            </div>

            <div className="transport-slider-row">
              <span className="transport-step-label">
                Step {cursor + 1} / {maxLen}
              </span>
              <input
                type="range"
                className="transport-slider"
                min={0}
                max={maxLen - 1}
                value={cursor}
                style={{ '--pct': `${(cursor / Math.max(maxLen - 1, 1)) * 100}%` }}
                onChange={e => seek(Number(e.target.value))}
              />
            </div>
          </div>

          {/* Live chart */}
          <div className="bench-chart-section">
            <div className="bench-chart-title">
              Comparisons &amp; Swaps over time
              {lastA && lastB && (
                <span className="bench-chart-subtitle">
                  &nbsp;— Final totals:&nbsp;
                  <span style={{ color: COLOR_A }}>{algoA}: {lastA.comparisons} cmps / {lastA.swaps} swaps</span>
                  &nbsp;&middot;&nbsp;
                  <span style={{ color: COLOR_B }}>{algoB}: {lastB.comparisons} cmps / {lastB.swaps} swaps</span>
                </span>
              )}
            </div>

            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData} margin={{ top: 8, right: 24, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="step" tick={{ fontSize: 11 }} label={{ value: 'Step', position: 'insideBottomRight', offset: -4, fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={36} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid rgba(0,0,0,0.08)' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey={`${algoA} cmps`}  stroke={COLOR_A} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey={`${algoA} swaps`} stroke={COLOR_A} strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
                <Line type="monotone" dataKey={`${algoB} cmps`}  stroke={COLOR_B} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey={`${algoB} swaps`} stroke={COLOR_B} strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* Empty state before first run */}
      {!hasData && !isLoading && (
        <div className="bench-empty">
          <p>Select two algorithms and an array, then press <strong>▶ Run Benchmark</strong> to start.</p>
        </div>
      )}
    </div>
  );
}
