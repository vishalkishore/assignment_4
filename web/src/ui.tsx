import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Harbor, Tableau } from "./arena";

// ---------- playback ----------

export const SPEEDS = [
  { label: "1×", rate: 0.55, anim: true },
  { label: "2×", rate: 1.1, anim: true },
  { label: "4×", rate: 2.2, anim: true },
  { label: "100×", rate: 60, anim: false },
  { label: "2k×", rate: 1500, anim: false },
  { label: "40k×", rate: 25000, anim: false },
];

const reducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

type StageProps = {
  idx: number;
  total: number;
  playing: boolean;
  speed: number;
  tableau: (i: number) => Omit<Tableau, "progress" | "fast">;
  onReveal?: (i: number, harbor: Harbor) => void;
  onAdvance: (next: number) => void;
  sign: ReactNode;
};

/** The animated harbor. Owns the clock; the parent owns which auction is showing. */
export function HarborStage(props: StageProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const live = useRef(props);
  live.current = props;

  useEffect(() => {
    const harbor = new Harbor(canvas.current!);
    harbor.resize();
    const ro = new ResizeObserver(() => harbor.resize());
    ro.observe(canvas.current!);
    let progress = 0, acc = 0, revealed = -1, shown = 0, last = performance.now(), raf = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const p = live.current;
      const sp = SPEEDS[p.speed];
      if (p.idx !== shown) {
        // stepped by hand: play the coin effect of the auction that just finished
        if (!p.playing && p.idx === shown + 1) p.onReveal?.(shown, harbor);
        shown = p.idx;
        progress = 0;
      }
      if (p.playing && p.idx < p.total) {
        if (sp.anim) {
          progress += dt * sp.rate;
          if (progress >= 0.6 && revealed !== p.idx) {
            revealed = p.idx;
            p.onReveal?.(p.idx, harbor);
          }
          if (progress >= 1) {
            progress = 0;
            p.onAdvance(p.idx + 1);
          }
        } else {
          acc += dt * sp.rate;
          const n = Math.floor(acc);
          acc -= n;
          if (n > 0) p.onAdvance(Math.min(p.total, p.idx + n));
        }
      }
      // playing an animated speed: the auction in progress; otherwise the last finished one
      const animating = p.playing && sp.anim && p.idx < p.total;
      const show = animating ? p.idx : Math.max(0, Math.min(p.idx, p.total) - 1);
      const prog = animating ? progress : p.idx === 0 ? 0 : 1;
      harbor.draw(reducedMotion ? 0 : now / 1000, dt, {
        ...p.tableau(show),
        progress: reducedMotion && p.idx > 0 ? 1 : prog,
        fast: !animating && p.idx > 0,
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <div className="stage">
      <canvas ref={canvas} className="harbor" aria-label="Animated harbor auction scene" />
      <div className="chalk">{props.sign}</div>
    </div>
  );
}

export function Transport(p: {
  playing: boolean; setPlaying: (b: boolean) => void; speed: number; setSpeed: (n: number) => void;
  onRestart: () => void; onStep: () => void; onEnd: () => void; done: boolean; count: string;
}) {
  return (
    <div className="transport">
      <button className="btn icon" onClick={p.onRestart} aria-label="Restart">⏮</button>
      <button className="btn primary icon" onClick={() => p.setPlaying(!p.playing)} disabled={p.done}
        aria-label={p.playing ? "Pause" : "Play"}>{p.playing ? "❚❚" : "▶"}</button>
      <button className="btn icon" onClick={p.onStep} disabled={p.done} aria-label="Next auction">⏵</button>
      <button className="btn" onClick={p.onEnd} disabled={p.done}>Skip to the end</button>
      <span className="count">{p.count}</span>
      <label className="speed">
        Speed
        <select value={p.speed} onChange={(e) => p.setSpeed(+e.target.value)}>
          {SPEEDS.map((s, i) => <option key={s.label} value={i}>{s.label}</option>)}
        </select>
      </label>
    </div>
  );
}

// ---------- chart ----------

export type Series = {
  ys: number[]; color: string; width?: number; dash?: string; label?: string; opacity?: number;
  fill?: boolean; // shade the area between the line and zero
  step?: boolean; // draw as steps centred on each x (for values only known on a grid)
};
type VLine = { x: number; color: string; label?: string; dash?: string; row?: number }; // row: stacks labels that would overlap

/** Round tick values: steps of 1, 2, 2.5 or 5 times a power of ten, with labels that never read "-0.00". */
function niceTicks(a: number, b: number, target: number) {
  const raw = (b - a) / Math.max(1, target);
  if (!(raw > 0)) return [];
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((s) => s >= raw * 0.999)!;
  const decimals = (String(+step.toPrecision(6)).split(".")[1] ?? "").length;
  const out: { v: number; label: string }[] = [];
  for (let i = Math.ceil(a / step - 1e-9); i * step <= b + 1e-9; i++) {
    out.push({ v: i * step, label: i === 0 ? "0" : (i * step).toFixed(decimals) });
  }
  return out;
}

export const num = (v: number) => String(+v.toFixed(4));

export function Chart(p: {
  xs: number[]; series: Series[]; height?: number; xLabel: string; yLabel: string;
  vlines?: VLine[];
  point?: { x: number; y: number; color?: string };
  best?: number[]; // indices of series whose highest point gets a "best" marker
  onPick?: (x: number) => void; small?: boolean; title?: ReactNode; yDomain?: [number, number];
  empty?: string; // message shown on empty axes
}) {
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(520);
  const [hover, setHover] = useState<number | null>(null);
  const dragging = useRef(false);

  // draw at the real pixel width, so text stays the same size on a phone and a desktop
  useLayoutEffect(() => {
    const el = box.current!;
    const measure = () => setW(Math.max(200, Math.round(el.getBoundingClientRect().width)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const H = p.height ?? 250;
  const all = p.series.flatMap((s) => s.ys).filter(Number.isFinite);
  let [y0, y1] = p.yDomain ?? [Math.min(0, ...all), Math.max(0, ...all)];
  if (y1 - y0 < 1e-9) y1 = y0 + 1;
  const pad = (y1 - y0) * 0.1;
  y0 -= pad; y1 += pad;
  const yt = niceTicks(y0, y1, p.small ? 3 : 5);
  const m = {
    l: Math.max(1, ...yt.map((t) => t.label.length)) * 6.6 + (p.small ? 12 : 30),
    r: 14, t: p.small ? 10 : 16, b: p.small ? 24 : 44,
  };
  const x0 = p.xs[0], x1 = p.xs[p.xs.length - 1];
  const X = (x: number) => m.l + ((x - x0) / (x1 - x0)) * (W - m.l - m.r);
  const Y = (y: number) => m.t + (1 - (y - y0) / (y1 - y0)) * (H - m.t - m.b);
  const xt = niceTicks(x0, x1, Math.max(2, Math.min(p.small ? 4 : 8, Math.floor((W - m.l - m.r) / 70))));
  const base = Y(Math.max(y0, Math.min(y1, 0)));

  const pts = (s: Series) => {
    const n = p.xs.length;
    if (!s.step) return s.ys.map((y, j) => `${X(p.xs[j]).toFixed(1)},${Y(y).toFixed(1)}`).join(" ");
    return s.ys.flatMap((y, j) => {
      const l = j === 0 ? p.xs[0] : (p.xs[j - 1] + p.xs[j]) / 2;
      const r = j === n - 1 ? p.xs[n - 1] : (p.xs[j] + p.xs[j + 1]) / 2;
      return [`${X(l).toFixed(1)},${Y(y).toFixed(1)}`, `${X(r).toFixed(1)},${Y(y).toFixed(1)}`];
    }).join(" ");
  };

  // where each marked series is highest; a flat top is marked as a run
  const bests = (p.best ?? []).filter((i) => p.series[i]).map((i) => {
    const s = p.series[i];
    const top = Math.max(...s.ys);
    const at = s.ys.flatMap((y, j) => (y >= top - 1e-12 ? [j] : []));
    return { s, top, a: at[0], b: at[at.length - 1] };
  });

  const xAt = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * W;
    return Math.max(x0, Math.min(x1, x0 + ((sx - m.l) / (W - m.l - m.r)) * (x1 - x0)));
  };
  const nearest = (x: number) => p.xs.reduce((bi, v, i) => (Math.abs(v - x) < Math.abs(p.xs[bi] - x) ? i : bi), 0);
  const hx = hover === null ? 0 : X(p.xs[hover]);

  return (
    <figure className={`chart ${p.small ? "small" : ""}`}>
      {p.title && <figcaption>{p.title}</figcaption>}
      <div className="plot" ref={box}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${p.yLabel} against ${p.xLabel}`}
          className={p.onPick ? "pickable" : ""}
          onPointerDown={(e) => {
            if (!p.onPick) return;
            dragging.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            p.onPick(xAt(e));
          }}
          onPointerMove={(e) => {
            if (!p.series.length) return;
            const x = xAt(e);
            setHover(nearest(x));
            if (dragging.current) p.onPick?.(x);
          }}
          onPointerUp={() => (dragging.current = false)}
          onPointerLeave={() => { setHover(null); dragging.current = false; }}>
          {yt.map((t) => (
            <g key={`y${t.label}`}>
              <line x1={m.l} x2={W - m.r} y1={Y(t.v)} y2={Y(t.v)} className="grid" />
              <text x={m.l - 7} y={Y(t.v) + 4} className="tick" textAnchor="end">{t.label}</text>
            </g>
          ))}
          {xt.map((t, i) => (
            <text key={`x${t.label}`} x={X(t.v)} y={H - m.b + 17} className="tick"
              textAnchor={i === xt.length - 1 && X(t.v) > W - m.r - 12 ? "end" : "middle"}>{t.label}</text>
          ))}
          <line x1={m.l} x2={m.l} y1={m.t} y2={H - m.b} className="axisline" />
          {y0 < 0 && y1 > 0 && <line x1={m.l} x2={W - m.r} y1={Y(0)} y2={Y(0)} className="zero" />}
          {p.vlines?.map((v, i) => (
            <line key={i} x1={X(v.x)} x2={X(v.x)} y1={m.t} y2={H - m.b} stroke={v.color} strokeWidth={2} strokeDasharray={v.dash ?? "5 4"} />
          ))}
          {p.series.map((s, i) => s.fill && (
            <polygon key={`f${i}`} fill={s.color} opacity={0.13}
              points={`${X(p.xs[0])},${base} ${pts(s)} ${X(p.xs[p.xs.length - 1])},${base}`} />
          ))}
          {bests.map((b, i) => (b.a === b.b
            ? <circle key={`b${i}`} cx={X(p.xs[b.a])} cy={Y(b.top)} r={p.small ? 6 : 8} className="best-ring" />
            : <line key={`b${i}`} x1={X(p.xs[b.a])} x2={X(p.xs[b.b])} y1={Y(b.top)} y2={Y(b.top)} className="best-run"
                strokeWidth={p.small ? 8 : 11} />
          ))}
          {p.series.map((s, i) => (
            <polyline key={i} fill="none" stroke={s.color} strokeWidth={s.width ?? 2.5} strokeDasharray={s.dash}
              opacity={s.opacity ?? 1} strokeLinejoin="round" strokeLinecap="round" points={pts(s)} />
          ))}
          {hover !== null && (
            <g className="cross">
              <line x1={hx} x2={hx} y1={m.t} y2={H - m.b} />
              {p.series.map((s, i) => Number.isFinite(s.ys[hover]) && (
                <circle key={i} cx={hx} cy={Y(s.ys[hover])} r={4} fill={s.color} />
              ))}
            </g>
          )}
          {p.point && (
            <g>
              <circle cx={X(p.point.x)} cy={Y(p.point.y)} r={10} fill={p.point.color ?? "#FF6B1A"} opacity={0.22} />
              <rect x={X(p.point.x) - 4.5} y={Y(p.point.y) - 5.5} width={9} height={11} rx={1.5}
                fill={p.point.color ?? "#FF6B1A"} stroke="#16161D" strokeWidth={2} />
            </g>
          )}
          {!p.small && (
            <>
              <text x={(m.l + W - m.r) / 2} y={H - 6} className="axis" textAnchor="middle">{p.xLabel}</text>
              <text x={13} y={(m.t + H - m.b) / 2} className="axis" textAnchor="middle"
                transform={`rotate(-90 13 ${(m.t + H - m.b) / 2})`}>{p.yLabel}</text>
            </>
          )}
        </svg>
        {!p.small && p.vlines?.filter((v) => v.label).map((v, i) => (
          <span key={i} className={`vtag ${X(v.x) > W - 150 ? "flip" : ""}`} style={{ left: X(v.x), top: H - m.b - 26 - (v.row ?? 0) * 24, color: v.color }}>
            {v.label}
          </span>
        ))}
        {!p.small && bests.length === 1 && bests.map((b, i) => (
          <span key={i} className="best-tag" style={{ left: X((p.xs[b.a] + p.xs[b.b]) / 2), top: Y(b.top) }}>best</span>
        ))}
        {p.empty && <div className="plot-empty">{p.empty}</div>}
        {hover !== null && (
          <div className={`tip ${hx > W * 0.6 ? "flip" : ""}`} style={{ left: hx, top: m.t }}>
            <b>{p.xLabel}: {num(p.xs[hover])}</b>
            {p.series.map((s, i) => Number.isFinite(s.ys[hover]) && (
              <span key={i}><i style={{ background: s.color }} />{s.label ?? p.yLabel}: {num(s.ys[hover])}</span>
            ))}
          </div>
        )}
      </div>
      {p.series.some((s) => s.label) && (
        <div className="legend">
          {p.series.filter((s) => s.label).map((s) => (
            <span key={s.label}><i style={{ background: s.color, opacity: s.opacity ?? 1 }} />{s.label}</span>
          ))}
        </div>
      )}
    </figure>
  );
}

// ---------- controls ----------

export function Segmented<T extends string | number>(p: {
  label: string; value: T; options: { value: T; label: ReactNode; hint?: string }[]; onChange: (v: T) => void;
}) {
  return (
    <fieldset className="field">
      <legend>{p.label}</legend>
      <div className="seg">
        {p.options.map((o) => (
          <button key={String(o.value)} className={o.value === p.value ? "on" : ""} aria-pressed={o.value === p.value}
            onClick={() => p.onChange(o.value)} title={o.hint}>{o.label}</button>
        ))}
      </div>
    </fieldset>
  );
}

export function Slider(p: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format?: (v: number) => string;
}) {
  return (
    <label className="field slider">
      <span className="row"><span>{p.label}</span><b>{(p.format ?? ((v) => v.toFixed(2)))(p.value)}</b></span>
      <input type="range" min={p.min} max={p.max} step={p.step} value={p.value}
        onChange={(e) => p.onChange(+e.target.value)} />
    </label>
  );
}

export function SeedField(p: { seed: number; setSeed: (n: number) => void }) {
  return (
    <label className="field">
      <span className="row"><span>Seed</span></span>
      <span className="seed">
        <input type="number" min={0} value={p.seed} onChange={(e) => p.setSeed(Math.max(0, Math.floor(+e.target.value)))} />
        <button className="btn icon" onClick={() => p.setSeed(Math.floor(Math.random() * 10000))} aria-label="Random seed">⚄</button>
      </span>
    </label>
  );
}

export function Panel(p: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={`panel ${p.className ?? ""}`}>
      <h2>{p.title}</h2>
      {p.children}
    </section>
  );
}

export function Stat(p: { label: string; value: ReactNode; tone?: "amber" | "rope" | "sea" }) {
  return (
    <div className={`stat ${p.tone ?? ""}`}>
      <span>{p.label}</span>
      <b>{p.value}</b>
    </div>
  );
}

export function Computing({ what }: { what: string }) {
  return <div className="computing"><span className="lamp" />{what}</div>;
}

/** What the assignment asks on this screen, and whether the result on screen answers it. */
export function TaskBar(p: { tag: string; children: ReactNode; check?: { ok: boolean | null; text: ReactNode } }) {
  return (
    <section className="task" aria-label="Assignment task">
      <span className="task-tag">{p.tag}</span>
      <p className="task-text">{p.children}</p>
      {p.check && (
        <p className={`task-check ${p.check.ok === true ? "ok" : p.check.ok === false ? "bad" : ""}`} role="status">
          <i aria-hidden>{p.check.ok === true ? "✓" : p.check.ok === false ? "✗" : "…"}</i>
          <span>{p.check.text}</span>
        </p>
      )}
    </section>
  );
}

export function Check({ ok }: { ok: boolean }) {
  return <b className={`check ${ok ? "yes" : "no"}`} aria-label={ok ? "passed" : "failed"}>{ok ? "✓" : "✗"}</b>;
}
