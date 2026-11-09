import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { C, CAST, Fighter, shipX, YOU, yOfBid } from "./arena";
import { usePy } from "./py";
import { Chart, Computing, HarborStage, Panel, SeedField, Segmented, Slider, Stat, TaskBar, Transport } from "./ui";

type Live = {
  bids: number[]; checkpoints: number[]; curves: number[][]; rival_bids: number[][];
  best_bids: [number, number]; utility_at_truthful_bid: number; max_utility: number;
};
type Fixed = { bids: number[]; runs: { v: number; rival_bid: number; utility: number[] }[] };

// each rival strategy is a character; Ren and Kuro also stand in as rival 1 and 2
const RIVALS = { truthful: "Ren", half: "Kuro", random: "Mika" } as const;
type Strategy = keyof typeof RIVALS;
const STRATEGY_LOOK: Record<Strategy, (typeof CAST)[number]> = { truthful: CAST[0], half: CAST[1], random: CAST[2] };
const SHORT: Record<Strategy, string> = { truthful: "truthful", half: "half", random: "random" };
const STRATEGY_HINT: Record<Strategy, string> = {
  truthful: "Bids exactly their value",
  half: "Bids half their value",
  random: "Ignores their value and bids at random",
};

export default function ActOne() {
  const [v, setV] = useState(0.5);
  const [rivals, setRivals] = useState(1);
  const [strategy, setStrategy] = useState<Strategy>("truthful");
  const [mode, setMode] = useState<"random" | "chained">("random");
  const [chain, setChain] = useState(0.4);
  const [seed, setSeed] = useState(3);
  const [bid, setBid] = useState(0.5);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const live = usePy<Live>("part1_live", [v, strategy, rivals, seed]);
  const fixed = usePy<Fixed>("part1_fixed", [rivals]);

  const chained = mode === "chained";
  const total = chained ? 1_000_000 : 100_000;
  const ready = chained ? !!fixed : !!live;

  useEffect(() => { setIdx(0); setPlaying(false); }, [v, strategy, rivals, seed, mode, chain]);
  useEffect(() => setBid(v), [v]);
  useEffect(() => { if (idx >= total) setPlaying(false); }, [idx, total]);

  const rivalBidsAt = useCallback(
    (i: number): number[] => (chained ? Array(rivals).fill(chain) : live?.rival_bids[i] ?? Array(rivals).fill(0)),
    [chained, chain, rivals, live],
  );

  const outcome = useCallback((i: number) => {
    const rb = rivalBidsAt(i);
    const top = Math.max(...rb);
    const won = bid > top; // ties go to the rival
    return { rb, top, won, profit: won ? v - top : 0 };
  }, [rivalBidsAt, bid, v]);

  const tableau = useCallback((i: number) => {
    const { rb, won, top, profit } = outcome(i);
    const look = chained ? CAST[0] : STRATEGY_LOOK[strategy];
    const rivalName = (j: number) => (chained ? "Rival" : RIVALS[strategy]) + (rivals > 1 ? ` ${j + 1}` : "");
    const ships: Fighter[] = [
      { ...YOU, name: "You", bid, isYou: true },
      ...rb.map((b, j) => ({ ...look, name: rivalName(j), bid: b, chained })), // both rivals share one strategy, so one look
    ];
    // order by bid; ties rank rivals above you
    const order = ships.map((_, j) => j).sort((a, b) => ships[b].bid - ships[a].bid || (a === 0 ? 1 : b === 0 ? -1 : a - b));
    const winner = won ? 0 : order[0] === 0 ? order[1] : order[0];
    const priceFrom = order.find((j) => j !== winner) ?? null;
    const caption = won
      ? `You win! You pay the next-highest bid, ${top.toFixed(2)}. Profit ${v.toFixed(2)} − ${top.toFixed(2)} = ${profit >= 0 ? "+" : ""}${profit.toFixed(2)}${profit < 0 ? " (you bid above your value!)" : ""}`
      : `${ships[winner].name} bids ${top.toFixed(2)}, beating your ${bid.toFixed(2)}. You lose and pay nothing: profit 0.`;
    return { ships, winner, priceFrom, ropeV: v, gap: null, caption };
  }, [outcome, bid, strategy, rivals, chained, v]);

  const onReveal = useCallback((i: number, harbor: import("./arena").Harbor) => {
    const { won, profit } = outcome(i);
    if (!won) return;
    const x = shipX(0, rivals + 1) + 5;
    harbor.burst(x, yOfBid(bid), profit >= 0 ? "gain" : "loss", Math.max(1, Math.ceil(Math.abs(profit) * 16)));
  }, [outcome, rivals, bid]);

  // running average profit at your chosen bid, over the auctions played so far
  const running = useRef({ n: 0, sum: 0, wins: 0, key: "" });
  const stats = useMemo(() => {
    const key = `${bid}|${chained}|${chain}|${live ? live.rival_bids.length : 0}|${v}`;
    const r = running.current;
    if (r.key !== key || idx < r.n) Object.assign(r, { n: 0, sum: 0, wins: 0, key });
    for (; r.n < Math.min(idx, total); r.n++) {
      const o = outcome(r.n);
      r.sum += o.profit;
      r.wins += +o.won;
    }
    return { avg: r.n ? r.sum / r.n : 0, winRate: r.n ? r.wins / r.n : 0 };
  }, [idx, outcome, bid, chained, chain, live, v, total]);

  // the curve over every bid, as it stood after the auctions played so far
  const chart = useMemo(() => {
    if (chained) {
      const run = fixed?.runs.find((r) => r.v === v && r.rival_bid === chain);
      return run && fixed ? { xs: fixed.bids, ys: run.utility, note: "Exact: the rival bid never changes" } : null;
    }
    if (!live) return null;
    let c = -1;
    live.checkpoints.forEach((n, j) => { if (n <= idx) c = j; });
    if (c < 0) return { xs: live.bids, ys: null, note: "The chart starts drawing after 50 auctions" };
    return { xs: live.bids, ys: live.curves[c], note: `Average over the first ${live.checkpoints[c].toLocaleString()} auctions, the same auctions for every bid` };
  }, [chained, fixed, live, idx, v, chain]);

  const ys = chart?.ys;
  const bi = chart ? chart.xs.findIndex((x) => Math.abs(x - bid) < 1e-9) : -1;
  const best = ys ? Math.max(...ys) : 0;
  const bestRange = ys && chart ? chart.xs.filter((_, j) => ys[j] === best) : [];
  const ledger = Array.from({ length: Math.min(idx, 14) }, (_, j) => idx - 1 - j).map((i) => ({ i, ...outcome(i) }));

  // which part of the assignment the current settings are
  const task = rivals === 1
    ? chained
      ? { tag: "Part 1B", text: <>The rival's bid is fixed at 0.1, 0.4 or 0.9. Check that bidding your value (<b>b = v</b>) gives the highest profit.</> }
      : { tag: "Part 1A", text: <>Try every bid from 0.00 to 1.00. For each bid, play 100,000 auctions against a rival with a random value, and average your profit. Does the chart tell you which bid to choose?</> }
    : chained
      ? { tag: "Part 1C", text: <>Part B again, with <b>two rivals</b> who both bid the fixed amount.</> }
      : { tag: "Part 1C", text: <>Part A again, with <b>two rivals</b>. Both use the same strategy, and you pay the higher of their two bids.</> };
  const check = !chart
    ? { ok: null, text: "Computing in Python." }
    : !ys
    ? { ok: null, text: "Press play. The answer appears when the chart starts drawing." }
    : bestRange.includes(v)
      ? { ok: true, text: bestRange.length > 1
          ? `b = v ties for best: every bid from ${bestRange[0].toFixed(2)} to ${bestRange[bestRange.length - 1].toFixed(2)} earns the same top profit.`
          : `b = v is the best bid. No other bid on the chart earns more.` }
      : { ok: null, text: "Not yet: the chart is still noisy. Keep playing." };

  const sign = chained
    ? <>Rule: highest bid wins, and pays the second-highest bid.<br />The rival's bid is locked at <b>{chain.toFixed(1)}</b>.</>
    : <>Rule: the highest bid wins,<br />but pays the <b>second-highest</b> bid.</>;

  return (
    <div className="act">
      <TaskBar tag={task.tag} check={check}>{task.text}</TaskBar>
      <aside className="left">
        <Panel title="You">
          <Segmented label="Your value for the crate (v)" value={v} onChange={setV}
            options={[0.2, 0.5, 0.8].map((x) => ({ value: x, label: x.toFixed(1) }))} />
          <Slider label="Your bid" value={bid} min={0} max={1} step={0.01} onChange={setBid} />
          <button className="link" onClick={() => setBid(v)} disabled={bid === v}>Bid your true value</button>
        </Panel>
        <Panel title="The rivals">
          <Segmented label="Number of rivals" value={rivals} onChange={setRivals}
            options={[{ value: 1, label: "One" }, { value: 2, label: "Two (part C)" }]} />
          <Segmented label="How the rivals bid" value={mode} onChange={setMode}
            options={[{ value: "random", label: "From their value" }, { value: "chained", label: "Fixed (part B)" }]} />
          {chained ? (
            <Segmented label="Rival bid locked at" value={chain} onChange={setChain}
              options={[0.1, 0.4, 0.9].map((x) => ({ value: x, label: x.toFixed(1) }))} />
          ) : (
            <>
              <Segmented label="Which rival (their strategy)" value={strategy} onChange={setStrategy}
                options={(Object.keys(RIVALS) as Strategy[]).map((s) => ({ value: s, label: `${RIVALS[s]} (${SHORT[s]})`, hint: STRATEGY_HINT[s] }))} />
              <p className="hint">{RIVALS[strategy]}: {STRATEGY_HINT[strategy].toLowerCase()}. Rival values are drawn from uniform [0, 1].</p>
              <SeedField seed={seed} setSeed={setSeed} />
            </>
          )}
        </Panel>
      </aside>

      <main className="center">
        <Transport playing={playing} setPlaying={setPlaying} speed={speed} setSpeed={setSpeed}
          onRestart={() => { setIdx(0); setPlaying(false); }} onStep={() => setIdx((i) => Math.min(total, i + 1))}
          onEnd={() => { setIdx(chained ? 1 : total); setPlaying(false); }} done={!ready || idx >= total}
          count={chained ? "" : `Auction ${Math.min(idx, total).toLocaleString()} of ${total.toLocaleString()}`} />
        {ready ? (
          <HarborStage idx={idx} total={total} playing={playing} speed={speed} tableau={tableau}
            onReveal={onReveal} onAdvance={setIdx} sign={sign} />
        ) : <div className="stage"><Computing what="Python is drawing 100,000 rival bids" /></div>}
        <div className="tide">
          <div className="tide-head">
            <h3>Your average profit for every possible bid</h3>
            <p>{chart?.note ?? ""}. Drag on the chart to change your bid.</p>
          </div>
          {chart ? (
            <Chart xs={chart.xs} xLabel="your bid" yLabel="average profit" onPick={(x) => setBid(Math.round(x * 100) / 100)}
              series={chart.ys ? [{ ys: chart.ys, color: C.amber, width: 3, fill: true }] : []} best={[0]}
              yDomain={chart.ys ? undefined : [0, 0.5]}
              empty={chart.ys ? undefined : "Press play. The curve appears after 50 auctions."}
              vlines={[
                { x: v, color: C.rope, label: `your value ${v}` },
                ...(chained ? [{ x: chain, color: C.mist, label: `rival bid ${chain}`, dash: "2 4", row: 1 }] : []),
              ]}
              point={bi >= 0 && chart.ys ? { x: bid, y: chart.ys[bi] } : undefined} />
          ) : <div className="chart-empty">Computing</div>}
        </div>
      </main>

      <aside className="right">
        <Panel title="Match log">
          <div className="stats">
            {/* with a chained rival every auction is identical, so the exact values apply from the start */}
            <Stat label="Your average profit" value={(chained ? (ys?.[bi] ?? 0) : stats.avg).toFixed(4)} tone="amber" />
            <Stat label="Auctions won" value={`${((chained ? +(bid > chain) : stats.winRate) * 100).toFixed(1)}%`} />
            <Stat label="Best bid on the chart" value={bestRange.length ? (bestRange.length > 1 ? `${bestRange[0]} to ${bestRange[bestRange.length - 1]}` : bestRange[0].toFixed(2)) : "—"} tone="sea" />
            <Stat label="Profit if you bid v" value={ys ? ys[chart!.xs.findIndex((x) => x === v)].toFixed(4) : "—"} tone="rope" />
          </div>
          {!chained && (
            <ol className="ledger" aria-label="Recent auctions">
              {ledger.length === 0 && <li className="empty">Press play to start the matches.</li>}
              {ledger.map((l) => (
                <li key={l.i} className={l.won ? (l.profit >= 0 ? "won" : "loss") : ""}>
                  <span>#{(l.i + 1).toLocaleString()}</span>
                  <span>rival {l.top.toFixed(2)}</span>
                  <span>{l.won ? `won, paid ${l.top.toFixed(2)}` : "lost"}</span>
                  <b>{l.won ? (l.profit >= 0 ? "+" : "") + l.profit.toFixed(2) : "0"}</b>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </aside>
    </div>
  );
}
