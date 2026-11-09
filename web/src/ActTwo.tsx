import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CAST, Harbor, Fighter, shipX, YOU, yOfBid } from "./arena";
import { usePy } from "./py";
import { Chart, Computing, HarborStage, Panel, SeedField, Segmented, Slider, Stat, TaskBar, Transport } from "./ui";

type Row = { k: number; expected_utility: number; bidder1_win_rate: number; fraction_could_pay_less: number; mean_overpayment: number };
type Curves = { n: number; equilibrium_k: number; best_k: number; rows: Row[] }[];
type Samples = { values: number[][] };

const N_COLORS: Record<number, string> = { 2: "#FF6B1A", 3: "#2D6BFF", 4: "#8A5CF6" };
// every other player bids the equilibrium, so they get neutral names, not the Part 1 characters
const NAMES = ["Player 2", "Player 3", "Player 4"];

export default function ActTwo() {
  const [n, setN] = useState(3);
  const [k, setK] = useState(0.7);
  const [seed, setSeed] = useState(0); // seed 0 gives the same numbers as the report
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const curves = usePy<Curves>("part2_curves", [seed]);
  const samples = usePy<Samples>("part2_samples", [n, 1, seed]);
  const total = samples?.values.length ?? 1;
  const eq = (n - 1) / n;

  useEffect(() => { setIdx(0); setPlaying(false); }, [n, seed]);
  useEffect(() => { if (idx >= total) setPlaying(false); }, [idx, total]);

  const outcome = useCallback((i: number) => {
    const vals = samples?.values[i] ?? Array(n).fill(0);
    const bids = vals.map((x, j) => (j === 0 ? k * x : eq * x));
    const others = Math.max(...bids.slice(1));
    const youWin = bids[0] > others; // ties go to the others
    const winner = youWin ? 0 : bids.indexOf(others);
    const sorted = [...bids].sort((a, b) => b - a);
    return { vals, bids, winner, youWin, profit: youWin ? vals[0] - bids[0] : 0, gap: sorted[0] - sorted[1], second: sorted[1] };
  }, [samples, n, k, eq]);

  const tableau = useCallback((i: number) => {
    const o = outcome(i);
    const ships: Fighter[] = o.bids.map((b, j) => ({
      ...(j === 0 ? YOU : CAST[j - 1]), name: j === 0 ? "You" : NAMES[j - 1], bid: b, isYou: j === 0,
    }));
    const pay = o.bids[o.winner];
    const caption = o.youWin
      ? `You win and pay your own bid, ${pay.toFixed(2)}. Profit ${o.vals[0].toFixed(2)} − ${pay.toFixed(2)} = ${o.profit >= 0 ? "+" : ""}${o.profit.toFixed(2)}. A bid of ${o.second.toFixed(2)} would have won too.`
      : `${NAMES[o.winner - 1]} wins and pays ${pay.toFixed(2)}, which is ${o.gap.toFixed(2)} more than needed to win. You pay nothing.`;
    return { ships, winner: o.winner, priceFrom: o.winner, ropeV: o.vals[0], gap: [pay, o.second] as [number, number], caption };
  }, [outcome]);

  const onReveal = useCallback((i: number, harbor: Harbor) => {
    const o = outcome(i);
    const wx = shipX(o.winner, n) + 14;
    harbor.burst(wx, (yOfBid(o.bids[o.winner]) + yOfBid(o.second)) / 2, "gull", Math.max(1, Math.round(o.gap * 18)));
    if (o.youWin) harbor.burst(shipX(0, n) + 5, yOfBid(o.bids[0]), o.profit >= 0 ? "gain" : "loss", Math.max(1, Math.ceil(Math.abs(o.profit) * 16)));
  }, [outcome, n]);

  const running = useRef({ n: 0, sum: 0, gap: 0, key: "" });
  const live = useMemo(() => {
    const key = `${n}|${k}|${seed}|${total}`;
    const r = running.current;
    if (r.key !== key || idx < r.n) Object.assign(r, { n: 0, sum: 0, gap: 0, key });
    for (; r.n < Math.min(idx, total); r.n++) {
      const o = outcome(r.n);
      r.sum += o.profit;
      r.gap += o.gap;
    }
    return { avg: r.n ? r.sum / r.n : 0, gap: r.n ? r.gap / r.n : 0 };
  }, [idx, outcome, n, k, seed, total]);

  const cur = curves?.find((c) => c.n === n);
  const row = cur?.rows.find((r) => Math.abs(r.k - k) < 1e-9);
  const ks = cur?.rows.map((r) => r.k) ?? [];
  const check = cur && row
    ? {
        ok: Math.abs(cur.best_k - eq) <= 0.05 + 1e-9,
        text: `Best k on the grid is ${cur.best_k.toFixed(1)}, next to the equilibrium ${eq.toFixed(2)}. At your k, the winner could have paid less in ${(row.fraction_could_pay_less * 100).toFixed(1)}% of auctions.`,
      }
    : { ok: null, text: "Computing 100,000 auctions for each k." };
  const ledger = Array.from({ length: Math.min(idx, 14) }, (_, j) => idx - 1 - j).map((i) => ({ i, ...outcome(i) }));

  return (
    <div className="act">
      <TaskBar tag="Part 2" check={check}>
        First-price auction with n players. You bid <b>k × your value</b>; the others bid the equilibrium (n − 1)/n × value.
        Find your expected profit for every k from 0.1 to 2.0, and how often the winner could have paid less and still won. Try n = 2, 3 and 4.
      </TaskBar>
      <aside className="left">
        <Panel title="The match">
          <Segmented label="Players in the auction (n)" value={n} onChange={setN}
            options={[2, 3, 4].map((x) => ({ value: x, label: String(x) }))} />
          <Slider label="Your bid multiplier (k): you bid k × your value" value={k} min={0.1} max={2} step={0.1}
            onChange={(x) => setK(Math.round(x * 10) / 10)} format={(x) => x.toFixed(1)} />
          <button className="link" onClick={() => setK(Math.round(eq * 10) / 10)}>
            Set to equilibrium ({eq.toFixed(2)}, nearest on the grid)
          </button>
          <p className="hint">The other {n - 1} player{n > 2 ? "s" : ""} always bid the equilibrium, {(n - 1)}/{n} of their value. Every value is drawn from uniform [0, 1].</p>
          <SeedField seed={seed} setSeed={setSeed} />
        </Panel>
      </aside>

      <main className="center">
        <Transport playing={playing} setPlaying={setPlaying} speed={speed} setSpeed={setSpeed}
          onRestart={() => { setIdx(0); setPlaying(false); }} onStep={() => setIdx((i) => Math.min(total, i + 1))}
          onEnd={() => { setIdx(total); setPlaying(false); }} done={!samples || idx >= total}
          count={`Auction ${Math.min(idx, total).toLocaleString()} of ${total.toLocaleString()}`} />
        {samples ? (
          <HarborStage idx={idx} total={total} playing={playing} speed={speed} tableau={tableau}
            onReveal={onReveal} onAdvance={setIdx}
            sign={<>New rule: the highest bid wins,<br />and pays <b>its own</b> bid.</>} />
        ) : <div className="stage"><Computing what="Python is drawing the players' values" /></div>}
        <div className="tide">
          <div className="tide-head">
            <h3>Your expected profit for every k</h3>
            <p>Each line is 100,000 auctions computed in Python. Dashed line: the equilibrium for n = {n}. Click to set k.</p>
          </div>
          {curves ? (
            <Chart xs={ks} xLabel="k (you bid k × your value)" yLabel="expected profit"
              onPick={(x) => setK(Math.max(0.1, Math.round(x * 10) / 10))}
              series={curves.map((c) => ({
                ys: c.rows.map((r) => r.expected_utility), color: N_COLORS[c.n], width: c.n === n ? 3 : 1.5,
                opacity: c.n === n ? 1 : 0.4, label: `n = ${c.n}`,
              }))}
              best={[curves.findIndex((c) => c.n === n)]}
              vlines={[{ x: eq, color: N_COLORS[n], label: `equilibrium ${eq.toFixed(2)}` }]}
              point={row ? { x: k, y: row.expected_utility, color: N_COLORS[n] } : undefined} />
          ) : <div className="chart-empty">Computing 100,000 auctions for each n and k</div>}
        </div>
      </main>

      <aside className="right">
        <Panel title="Match log">
          <div className="stats">
            <Stat label="Expected profit at this k" value={row ? row.expected_utility.toFixed(4) : "—"} tone="amber" />
            <Stat label="Best k on the grid" value={cur ? cur.best_k.toFixed(1) : "—"} tone="sea" />
            <Stat label="Winner could have paid less" value={row ? `${(row.fraction_could_pay_less * 100).toFixed(1)}%` : "—"} tone="rope" />
            <Stat label="Average overpayment" value={row ? row.mean_overpayment.toFixed(3) : "—"} />
          </div>
          <p className="hint">
            The red hatched box is the gap between the winning bid and the next one down: money the winner could have kept and still won.
            {idx > 0 && ` Tonight so far: ${live.gap.toFixed(3)} per auction, your average profit ${live.avg.toFixed(4)}.`}
          </p>
          <ol className="ledger" aria-label="Recent auctions">
            {ledger.length === 0 && <li className="empty">Press play to start the matches.</li>}
            {ledger.map((l) => (
              <li key={l.i} className={l.youWin ? (l.profit >= 0 ? "won" : "loss") : ""}>
                <span>#{(l.i + 1).toLocaleString()}</span>
                <span>{l.youWin ? "you won" : `${NAMES[l.winner - 1]} won`}</span>
                <span>overpaid {l.gap.toFixed(2)}</span>
                <b>{l.youWin ? (l.profit >= 0 ? "+" : "") + l.profit.toFixed(2) : "0"}</b>
              </li>
            ))}
          </ol>
        </Panel>
      </aside>
    </div>
  );
}
