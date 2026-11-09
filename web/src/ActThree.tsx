import { useEffect, useMemo, useState } from "react";
import { C } from "./arena";
import { usePy } from "./py";
import { Chart, Computing, Panel, Slider, Stat, TaskBar } from "./ui";

type State = {
  path: string; path_edges: string[]; path_cost: number; payments: Record<string, number>;
  detours: Record<string, { path_edges: string[]; cost: number }>;
};
type Misreport = { edge: string; true_cost: number; truthful_utility: number; rows: { reported_cost: number; utility: number; on_path: boolean }[] };

const NODES: Record<string, [number, number]> = { A: [40, 120], B: [130, 62], C: [130, 186], D: [250, 62], E: [250, 186], F: [340, 120] };
const VW = 380, VH = 214;

// the payments given in the book's text; every other road is paid 0
const BOOK: Record<string, number> = { AB: 4, BE: 2, EF: 3 };

// where along its channel each ferry sits (0 = start, 1 = end); CF is moved away from the CE card
const FERRY_AT: Record<string, number> = { CF: 0.55, BE: 0.45 };

function edgePoints(e: string) {
  const [x1, y1] = NODES[e[0]], [x2, y2] = NODES[e[1]];
  const d = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / d, uy = (y2 - y1) / d;
  const t = FERRY_AT[e] ?? 0.5;
  return { x1: x1 + ux * 16, y1: y1 + uy * 16, x2: x2 - ux * 18, y2: y2 - uy * 18, mx: x1 + (x2 - x1) * t, my: y1 + (y2 - y1) * t };
}
const routeD = (edges: string[]) => edges.length ? "M" + [edges[0][0], ...edges.map((e) => e[1])].map((n) => NODES[n].join(",")).join(" L") : "";

function Island({ name, x, y }: { name: string; x: number; y: number }) {
  return (
    <g>
      <circle cx={x + 2} cy={y + 2} r={15} fill="#16161D" />
      <circle cx={x} cy={y} r={15} fill={name === "A" || name === "F" ? "#FFD23F" : "#fff"} stroke="#16161D" strokeWidth={2.5} />
      <text x={x} y={y + 5.5} textAnchor="middle" className="island">{name}</text>
    </g>
  );
}

export default function ActThree() {
  const truth = usePy<Record<string, number>>("part3_graph", []);
  const [claims, setClaims] = useState<Record<string, number> | null>(null);
  const [sel, setSel] = useState("AB");
  const [strike, setStrike] = useState(false);
  useEffect(() => { if (truth && !claims) setClaims(truth); }, [truth, claims]);

  const state = usePy<State>(claims ? "part3_state" : null, [JSON.stringify(claims)]);
  const mis = usePy<Misreport>("part3_misreport", [sel]);
  const ready = truth && claims && state && Object.keys(claims).length;

  // when another courier is selected, everyone else goes back to telling the truth
  const choose = (e: string) => { setSel(e); setStrike(false); if (truth) setClaims(truth); };

  const view = useMemo(() => {
    if (!ready || !truth || !claims || !state) return null;
    const on = state.path_edges.includes(sel);
    const pay = state.payments[sel];
    const detour = on ? state.detours[sel] : null;
    const othersCost = state.path_cost - (on ? claims[sel] : 0);
    return { on, pay, utility: pay - (on ? truth[sel] : 0), detour, othersCost };
  }, [ready, truth, claims, state, sel]);

  if (!ready || !truth || !claims || !state || !view) {
    return <div className="act single"><div className="stage"><Computing what="Drawing the map" /></div></div>;
  }
  const lying = claims[sel] !== truth[sel];
  const edges = Object.keys(truth);
  const truthful = mis?.edge === sel ? mis.truthful_utility : null;
  const check = !lying
    ? {
        ok: state.path === "ABEF" && edges.every((e) => state.payments[e] === (BOOK[e] ?? 0)),
        text: "Everyone tells the truth: path ABEF, with AB paid 4, BE paid 2, EF paid 3 and every other road 0. The same as the book.",
      }
    : truthful === null
      ? { ok: null, text: "Computing" }
      : view.utility < truthful
        ? { ok: true, text: `Lying cost Courier ${sel} money: profit ${view.utility} instead of ${truthful} for the truth.` }
        : view.utility === truthful
          ? { ok: true, text: `Lying changed nothing for Courier ${sel}: profit ${view.utility}, the same as telling the truth.` }
          : { ok: false, text: `Lying helped Courier ${sel}: profit ${view.utility} instead of ${truthful}.` };

  return (
    <div className="act">
      <TaskBar tag="Part 3" check={check}>
        VCG buys the cheapest path from A to F. First reproduce the book: path ABEF, AB paid 4, BE paid 2, EF paid 3.
        Then let one road on the path (AB) and one off it (AC) claim every cost from 0 to 10, and watch its profit.
      </TaskBar>
      <aside className="left">
        <Panel title="The delivery">
          <p className="hint">A package must go from town A to town F. Each road is run by a courier who alone knows their true cost. The card on each road shows the cost they claim.</p>
          <p className="hint">The guild picks the cheapest route from the claimed costs, then pays each courier on it by the VCG rule: what the trip would cost without them, minus what the other couriers on the route cost.</p>
          <div className="pickers">
            <button className={`btn ${sel === "AB" ? "primary" : ""}`} onClick={() => choose("AB")}>Courier AB (on the route)</button>
            <button className={`btn ${sel === "AC" ? "primary" : ""}`} onClick={() => choose("AC")}>Courier AC (off the route)</button>
          </div>
          <p className="hint">Or click any price card on the map. Yellow coins show what each courier is paid.</p>
        </Panel>
      </aside>

      <main className="center">
        <div className="stage map">
          <svg viewBox={`0 0 ${VW} ${VH}`} className="sea" role="group" aria-label="Route map from A to F">
            <defs>
              <pattern id="waves" width="8" height="8" patternUnits="userSpaceOnUse">
                <rect width="8" height="8" fill="#FFFDF8" />
                <circle cx="2" cy="2" r="0.8" fill="#E7E1D4" />
                <circle cx="6" cy="6" r="0.8" fill="#E7E1D4" />
              </pattern>
              {(["ink", "amber", "rope"] as const).map((k) => (
                <marker key={k} id={`arrow-${k}`} viewBox="0 0 6 6" refX="5" refY="3" markerWidth="9" markerHeight="9"
                  markerUnits="userSpaceOnUse" orient="auto">
                  <path d="M0,0 L6,3 L0,6 z" fill={k === "ink" ? "#16161D" : C[k]} />
                </marker>
              ))}
            </defs>
            <rect width={VW} height={VH} fill="url(#waves)" />
            {edges.map((e) => {
              const p = edgePoints(e);
              const onRoute = state.path_edges.includes(e);
              const onDetour = strike && view.detour?.path_edges.includes(e);
              return (
                <line key={e} x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} markerEnd={`url(#arrow-${onDetour ? "rope" : onRoute ? "amber" : "ink"})`}
                  stroke={onDetour ? C.rope : onRoute ? C.amber : "#16161D"} strokeWidth={onRoute ? 5 : 2}
                  strokeDasharray={onDetour ? "7 4" : onRoute ? undefined : "4 4"} opacity={strike && e === sel ? 0.2 : onRoute || onDetour ? 1 : 0.55} />
              );
            })}
            {Object.entries(NODES).map(([n, [x, y]]) => <Island key={n} name={n} x={x} y={y} />)}
            {!strike && (
              <g className="parcel" key={state.path}>
                <rect x={-6} y={-6} width={12} height={12} fill="#C98A4B" stroke="#16161D" strokeWidth={2} />
                <rect x={-6} y={-1} width={12} height={2} fill="#16161D" />
                <animateMotion dur={`${state.path_edges.length * 1.4}s`} repeatCount="indefinite" path={routeD(state.path_edges)} />
              </g>
            )}
            {edges.map((e) => {
              const p = edgePoints(e);
              const active = e === sel;
              const onRoute = state.path_edges.includes(e);
              const sunk = strike && active;
              const [coinX, coinY] = e === "EF" || e === "CE" ? [20, 14] : [-22, -8]; // below right, clear of the CF line
              return (
                <g key={e} className={`ferry ${active ? "active" : ""}`} transform={`translate(${p.mx},${p.my})`}
                  tabIndex={0} role="button" aria-label={`Courier ${e}, true cost ${truth[e]}, claims ${claims[e]}`}
                  aria-pressed={active} onClick={() => choose(e)}
                  onKeyDown={(ev) => (ev.key === "Enter" || ev.key === " ") && (ev.preventDefault(), choose(e))}>
                  {/* the courier's price card: their claimed cost */}
                  <g opacity={sunk ? 0.3 : 1} transform={`rotate(${active ? -4 : 0})`}>
                    <rect x={-11} y={-10} width={22} height={18} fill="#16161D" transform="translate(2,2)" />
                    <rect x={-11} y={-10} width={22} height={18} fill={active ? C.amber : "#fff"} stroke="#16161D" strokeWidth={2} />
                    <text x={0} y={4} textAnchor="middle" className="sail">{claims[e]}</text>
                  </g>
                  <text x={0} y={e === "CF" ? -15 : 20} textAnchor="middle" className="ferry-name">{e}</text>
                  {onRoute && state.payments[e] > 0 && (
                    <g>
                      <circle cx={coinX} cy={coinY} r={8} fill={C.coin} stroke="#16161D" strokeWidth={2} />
                      <text x={coinX} y={coinY + 3.5} textAnchor="middle" className="coin">{state.payments[e]}</text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
          <div className="chalk">
            Route <b>{state.path.split("").join(" → ")}</b>, claimed cost {state.path_cost}
          </div>
        </div>

        <div className="tide">
          <div className="tide-head">
            <h3>Courier {sel}: profit for every cost they could claim</h3>
            <p>Everyone else tells the truth. Computed in Python for claims from 0 to 10 in steps of 0.5. Click to set the claim.</p>
          </div>
          {mis && mis.edge === sel ? (
            <Chart xs={mis.rows.map((r) => r.reported_cost)} xLabel="claimed cost" yLabel="courier's profit"
              onPick={(x) => setClaims({ ...truth, [sel]: Math.round(x * 2) / 2 })}
              series={[
                { ys: mis.rows.map((r) => r.utility), color: C.amber, width: 3, step: true, label: "profit for each claim" },
                { ys: mis.rows.map(() => mis.truthful_utility), color: C.green, width: 2, dash: "6 5", label: "profit when telling the truth" },
              ]}
              vlines={[{ x: mis.true_cost, color: C.rope, label: `true cost ${mis.true_cost}` }]}
              point={{ x: claims[sel], y: mis.rows.find((r) => r.reported_cost === claims[sel])?.utility ?? view.utility }} />
          ) : <div className="chart-empty">Computing</div>}
        </div>
      </main>

      <aside className="right">
        <Panel title={`Courier ${sel}`}>
          <Slider label="Claimed cost" value={claims[sel]} min={0} max={10} step={0.5}
            onChange={(x) => setClaims({ ...truth, [sel]: x })} format={(x) => x.toFixed(1)} />
          <button className="link" onClick={() => setClaims(truth)} disabled={!lying}>Tell the truth ({truth[sel]})</button>
          <div className="stats">
            <Stat label="True cost" value={truth[sel]} tone="rope" />
            <Stat label="On the route" value={view.on ? "Yes" : "No"} tone="sea" />
            <Stat label="Paid by the guild" value={view.pay} tone="amber" />
            <Stat label="Profit" value={view.utility} />
          </div>
          {view.on && (
            <>
              <button className="btn" onClick={() => setStrike(!strike)} aria-pressed={strike}>
                {strike ? "Bring the courier back" : `What if ${sel} went on strike?`}
              </button>
              {strike && view.detour && (
                <p className="hint explain">
                  Without {sel}, the package goes {view.detour.path_edges[0][0]}→{view.detour.path_edges.map((e) => e[1]).join("→")} for {view.detour.cost}.
                  The rest of the current route costs {view.othersCost}. So {sel} is paid {view.detour.cost} − {view.othersCost} = <b>{view.pay}</b>.
                </p>
              )}
            </>
          )}
        </Panel>
        <Panel title="All payments">
          <table className="pay">
            <thead><tr><th>Road</th><th>Claim</th><th>Paid</th></tr></thead>
            <tbody>
              {edges.map((e) => (
                <tr key={e} className={state.path_edges.includes(e) ? "route" : ""}>
                  <td>{e}</td><td>{claims[e]}</td><td>{state.payments[e]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </aside>
    </div>
  );
}
