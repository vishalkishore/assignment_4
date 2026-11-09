import { ReactNode, useState } from "react";
import { C } from "./arena";
import { usePy } from "./py";
import { Chart, Check, Computing, num, Segmented } from "./ui";

type Run = { utility: number[]; utility_at_truthful_bid: number; max_utility: number; best_bids: [number, number] };
type Wall = { n_sims: number; bids: number[]; runs: (Run & { v: number; strategy: string })[] };
type Fixed = { bids: number[]; runs: (Run & { v: number; rival_bid: number })[] };
type Row = { k: number; expected_utility: number; bidder1_win_rate: number; fraction_could_pay_less: number; mean_overpayment: number };
type Curve = { n: number; equilibrium_k: number; best_k: number; rows: Row[] };
type Vcg = { path: string; path_edges: string[]; path_cost: number; payments: Record<string, number> };
type Mis = { edge: string; true_cost: number; truthful_utility: number; rows: { reported_cost: number; path: string; on_path: boolean; utility: number }[] };

const SEED = 0; // the runs behind `uv run auto` and the report, so every number here matches it
const BOOK: Record<string, number> = { AB: 4, BE: 2, EF: 3 }; // payments in the book's text; every other road 0
const N_COLORS: Record<number, string> = { 2: "#FF6B1A", 3: "#2D6BFF", 4: "#8A5CF6" };
const RIVAL: Record<string, string> = { truthful: "bid truthfully", half: "bid half", random: "bid at random" };
const VALUES = [0.2, 0.5, 0.8];
const FIXED_BIDS = [0.1, 0.4, 0.9];

const truthIsBest = (r: Run) => r.utility_at_truthful_bid === r.max_utility;
const passes = (runs?: Run[]) => (runs ? runs.filter(truthIsBest).length : null);
const nearEq = (c: Curve) => c.rows.reduce((a, b) => (Math.abs(b.k - c.equilibrium_k) < Math.abs(a.k - c.equilibrium_k) ? b : a));
const signed = (x: number) => (x > 0 ? "+" : "") + num(x);
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const path = (p: string) => p.split("").join("→");

function scrollTo(id: string) {
  const smooth = !matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById(id)?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
}

function Sheet(p: { id: string; tag: string; title: string; lead: ReactNode; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="sheet" id={p.id}>
      <header className="sheet-head">
        <span className="sheet-tag">{p.tag}</span>
        <div className="sheet-title">
          <h2>{p.title}</h2>
          <p>{p.lead}</p>
        </div>
        {p.aside}
      </header>
      {p.children}
    </section>
  );
}

export default function Answers() {
  const [rivals, setRivals] = useState(1);
  // fast calls first: the Python worker answers in order
  const vcg = usePy<Vcg>("part3_truthful", []);
  const ab = usePy<Mis>("part3_misreport", ["AB"]);
  const ac = usePy<Mis>("part3_misreport", ["AC"]);
  const fixed1 = usePy<Fixed>("part1_fixed", [1]);
  const fixed2 = usePy<Fixed>("part1_fixed", [2]);
  const curves = usePy<Curve[]>("part2_curves", [SEED]);
  const wall1 = usePy<Wall>("part1_wall", [1, SEED]);
  const wall2 = usePy<Wall>("part1_wall", [2, SEED]);
  const wall = rivals === 1 ? wall1 : wall2;
  const fixed = rivals === 1 ? fixed1 : fixed2;
  const they = rivals === 1 ? "rival" : "rivals";

  // the checks behind the scoreboard
  const s1a = passes(wall1?.runs), s1b = passes(fixed1?.runs), s1ca = passes(wall2?.runs), s1cb = passes(fixed2?.runs);
  const s2 = curves ? curves.filter((c) => Math.abs(c.best_k - c.equilibrium_k) <= 0.05 + 1e-9).length : null;
  const payLess = curves ? Math.min(...curves.map((c) => nearEq(c).fraction_could_pay_less)) : null;
  const bookOk = vcg ? vcg.path === "ABEF" && Object.keys(vcg.payments).every((e) => vcg.payments[e] === (BOOK[e] ?? 0)) : null;
  const gain = (m: Mis | null) => (m ? Math.max(...m.rows.map((r) => r.utility - m.truthful_utility)) : null);
  const gAB = gain(ab), gAC = gain(ac);

  const score = [
    { tag: "1A", go: () => { setRivals(1); scrollTo("p1"); }, ask: "Every bid from 0 to 1, 100,000 auctions each: 9 plots",
      ok: s1a === null ? null : s1a === 9, result: s1a === null ? "Computing" : `b = v is a best bid in ${s1a} of 9 plots` },
    { tag: "1B", go: () => { setRivals(1); scrollTo("p1b"); }, ask: "Rival bid fixed at 0.1, 0.4 and 0.9",
      ok: s1b === null ? null : s1b === 9, result: s1b === null ? "Computing" : `b = v is best in ${s1b} of 9 cases` },
    { tag: "1C", go: () => { setRivals(2); scrollTo("p1"); }, ask: "A and B again, with two rivals",
      ok: s1ca === null || s1cb === null ? null : s1ca === 9 && s1cb === 9,
      result: s1ca === null || s1cb === null ? "Computing" : `b = v is best: A in ${s1ca} of 9, B in ${s1cb} of 9` },
    { tag: "2", go: () => scrollTo("p2"), ask: "First price, k from 0.1 to 2.0, n = 2, 3, 4",
      ok: s2 === null || payLess === null ? null : s2 === 3 && payLess > 0.99,
      result: s2 === null || payLess === null ? "Computing" : `Best k sits next to (n − 1)/n for ${s2} of 3; the winner could pay less in ${pct(payLess)}` },
    { tag: "3", go: () => scrollTo("p3"), ask: "VCG path, payments, and misreports from 0 to 10",
      ok: bookOk === null || gAB === null || gAC === null ? null : bookOk && gAB <= 1e-9 && gAC <= 1e-9,
      result: bookOk === null || gAB === null || gAC === null ? "Computing"
        : `${bookOk ? "ABEF and payments 4, 2, 3, 0 match the book" : "Payments differ from the book"}; ${gAB <= 1e-9 && gAC <= 1e-9 ? "no lie helps AB or AC" : "a lie helped"}` },
  ];

  return (
    <div className="answers">
      <header className="answers-head">
        <h2>Assignment answers</h2>
        <p>Every question in Assignment 4, answered with live results from the Python code. Seed 0 throughout, so the numbers match the report.</p>
        <ol className="score">
          {score.map((c) => (
            <li key={c.tag}>
              <button onClick={c.go} className={c.ok === true ? "ok" : c.ok === false ? "bad" : ""}>
                <span className="score-tag">{c.tag}</span>
                <span className="score-ask">{c.ask}</span>
                <span className="score-result">{c.result}</span>
                <span className="stamp" aria-hidden>{c.ok === true ? "✓" : c.ok === false ? "✗" : "…"}</span>
              </button>
            </li>
          ))}
        </ol>
      </header>

      <Sheet id="p1" tag="Part 1" title="Second-price auction"
        lead={<>The highest bid wins and pays the second-highest bid. Bidder 1's value is v = 0.2, 0.5 or 0.8; rival values are uniform on [0, 1].</>}
        aside={<Segmented label="Rivals" value={rivals} onChange={setRivals}
          options={[{ value: 1, label: "One (A, B)" }, { value: 2, label: "Two (C)" }]} />}>
        <h3>{rivals === 1 ? "A" : "C, repeating A"}: average profit for every bid, 100,000 auctions per bid</h3>
        <p className="key">
          <span><i className="k-line" />dashed line: b = v</span>
          <span><i className="k-best" />yellow mark: the best bid</span>
          <span><Check ok /> b = v is a best bid</span>
        </p>
        {wall ? (
          <div className="grid9">
            {wall.runs.map((r) => (
              <Chart key={`${r.v}${r.strategy}`} small height={150}
                title={<><span>v = {r.v}, {they} {RIVAL[r.strategy]}</span><Check ok={truthIsBest(r)} /></>}
                xs={wall.bids} xLabel="bid" yLabel="average profit" best={[0]}
                series={[{ ys: r.utility, color: C.amber, fill: true }]}
                vlines={[{ x: r.v, color: C.rope }]} />
            ))}
          </div>
        ) : <Computing what="Running 9 plots × 101 bids × 100,000 auctions in Python" />}
        <p className="answer">
          <b>Do these plots help bidder 1 choose?</b> Yes. In all nine plots the highest point sits on the dashed line, b = v.
          So bidder 1 should bid its value, and it does not need to know how the {they} bid.
          When {they} bid half, the curve goes flat above 0.5 (a half-bidder never bids more than 0.5), so b = v ties for best there.
        </p>

        <h3 id="p1b">{rivals === 1 ? "B: the rival's bid is fixed" : "C, repeating B: both rivals' bids are fixed"}</h3>
        {fixed ? (
          <div className="table-wrap">
            <table className="data verify">
              <thead>
                <tr><th>Your value</th>{FIXED_BIDS.map((b) => <th key={b}>{rivals === 1 ? "Rival bids" : "Both rivals bid"} {b}</th>)}</tr>
              </thead>
              <tbody>
                {VALUES.map((v) => (
                  <tr key={v}>
                    <th>v = {v}</th>
                    {FIXED_BIDS.map((b) => {
                      const r = fixed.runs.find((x) => x.v === v && x.rival_bid === b)!;
                      return (
                        <td key={b}>
                          <Check ok={truthIsBest(r)} /> b = v {v > b ? "wins" : "loses"}, profit {signed(r.utility_at_truthful_bid)}
                          <small>best of all 101 bids: {signed(r.max_utility)}</small>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Computing what="Computing" />}
        <p className="answer">
          <b>Confirmed:</b> against every fixed bid, b = v earns the highest profit. If v is above the bid, bidding v wins and keeps v minus the bid.
          If v is below it, bidding v loses, which is right: winning would cost more than the item is worth.
        </p>
      </Sheet>

      <Sheet id="p2" tag="Part 2" title="First-price auction"
        lead={<>The highest bid wins and pays its own bid. Bidder 1 bids k × v; the other n − 1 bidders bid the equilibrium (n − 1)/n × v. 100,000 auctions for each k.</>}>
        {curves ? (
          <>
            <div className="stack">
              <Chart xs={curves[0].rows.map((r) => r.k)} height={290} xLabel="k (bidder 1 bids k × v)" yLabel="expected profit of bidder 1"
                best={curves.map((_, i) => i)}
                series={curves.map((c) => ({ ys: c.rows.map((r) => r.expected_utility), color: N_COLORS[c.n], label: `n = ${c.n}` }))}
                vlines={curves.map((c, i) => ({ x: c.equilibrium_k, color: N_COLORS[c.n], label: `(n − 1)/n = ${c.equilibrium_k.toFixed(2)}`, row: i }))} />
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr><th>n</th><th>(n − 1)/n</th><th>Best k</th><th>Profit at best k</th><th>Profit at k = 1</th><th>Winner could pay less</th><th>Average overpay</th></tr>
                  </thead>
                  <tbody>
                    {curves.map((c) => {
                      const best = c.rows.find((r) => r.k === c.best_k)!;
                      const truth = c.rows.find((r) => r.k === 1)!;
                      const eq = nearEq(c);
                      return (
                        <tr key={c.n}>
                          <th style={{ color: N_COLORS[c.n] }}>{c.n}</th>
                          <td>{c.equilibrium_k.toFixed(2)}</td>
                          <td className="nowrap"><Check ok={Math.abs(c.best_k - c.equilibrium_k) <= 0.05 + 1e-9} /> {c.best_k.toFixed(1)}</td>
                          <td>{best.expected_utility.toFixed(3)}</td>
                          <td>{num(truth.expected_utility)}</td>
                          <td>{pct(eq.fraction_could_pay_less)}</td>
                          <td>{eq.mean_overpayment.toFixed(3)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="note">"Could pay less" and "overpay" are measured at the k closest to the equilibrium. Overpay is the winning bid minus the second-highest bid.</p>
              </div>
            </div>
            <details className="more">
              <summary>Every k from 0.1 to 2.0, for n = 2, 3 and 4</summary>
              <div className="table-wrap">
                <table className="data dense">
                  <thead>
                    <tr><th rowSpan={2}>k</th><th colSpan={3}>Expected profit of bidder 1</th><th colSpan={3}>Winner could have paid less</th></tr>
                    <tr>{[...curves, ...curves].map((c, i) => <th key={i} style={{ color: N_COLORS[c.n] }}>n = {c.n}</th>)}</tr>
                  </thead>
                  <tbody>
                    {curves[0].rows.map((_, j) => (
                      <tr key={j}>
                        <th>{curves[0].rows[j].k.toFixed(1)}</th>
                        {curves.map((c) => (
                          <td key={c.n} className={c.rows[j].k === c.best_k ? "peak" : ""}>{c.rows[j].expected_utility.toFixed(4)}</td>
                        ))}
                        {curves.map((c) => <td key={c.n}>{pct(c.rows[j].fraction_could_pay_less)}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        ) : <Computing what="Running 20 values of k × 100,000 auctions for each n" />}
        <p className="answer">
          <b>Bidding the truth is bad here.</b> At k = 1 the profit is exactly 0: you win, but pay all of your value.
          The best k sits next to the equilibrium (n − 1)/n, so shading your bid pays, and more bidders means shading less.
          In every auction the winner could have paid less and still won, because they pay their own bid, which is above the second-highest bid.
        </p>
      </Sheet>

      <Sheet id="p3" tag="Part 3" title="VCG for the cheapest path"
        lead={<>Each road is an agent with a private cost (Figure 7.3). VCG picks the cheapest path from the claimed costs and pays each road: (cheapest cost without it) − (cost of the other roads on the path).</>}>
        {vcg ? (
          <div className="duo">
            <div>
              <p className="path-line">
                <Check ok={vcg.path === "ABEF"} /> Chosen path <b>{path(vcg.path)}</b>, total cost {vcg.path_cost}
              </p>
              <div className="table-wrap">
                <table className="data">
                  <thead><tr><th>Road</th><th>On the path</th><th>Paid by our code</th><th>Paid in the book</th><th>Match</th></tr></thead>
                  <tbody>
                    {Object.keys(vcg.payments).map((e) => (
                      <tr key={e} className={vcg.path_edges.includes(e) ? "route" : ""}>
                        <th>{e}</th>
                        <td>{vcg.path_edges.includes(e) ? "yes" : "no"}</td>
                        <td>{vcg.payments[e]}</td>
                        <td>{BOOK[e] ?? 0}</td>
                        <td><Check ok={vcg.payments[e] === (BOOK[e] ?? 0)} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {ab && ac ? (
              <div className="grid2">
                {[ab, ac].map((m) => (
                  <Chart key={m.edge} small height={170}
                    title={<><span>Road {m.edge} ({m.edge === "AB" ? "on" : "off"} the path), true cost {m.true_cost}</span><Check ok={(gain(m) ?? 1) <= 1e-9} /></>}
                    xs={m.rows.map((r) => r.reported_cost)} xLabel="claimed cost" yLabel="profit"
                    series={[
                      { ys: m.rows.map((r) => r.utility), color: C.amber, step: true, width: 2.5 },
                      { ys: m.rows.map(() => m.truthful_utility), color: C.green, dash: "5 4", width: 2, label: "profit when truthful" },
                    ]}
                    vlines={[{ x: m.true_cost, color: C.rope }]} />
                ))}
              </div>
            ) : <Computing what="Computing" />}
          </div>
        ) : <Computing what="Computing" />}
        {ab && ac && (
          <details className="more">
            <summary>Every claimed cost from 0 to 10, for AB and AC</summary>
            <div className="table-wrap">
              <table className="data dense">
                <thead>
                  <tr><th rowSpan={2}>Claim</th><th colSpan={3}>Road AB (true cost {ab.true_cost})</th><th colSpan={3}>Road AC (true cost {ac.true_cost})</th></tr>
                  <tr><th>Path chosen</th><th>Profit</th><th>Change</th><th>Path chosen</th><th>Profit</th><th>Change</th></tr>
                </thead>
                <tbody>
                  {ab.rows.map((r, j) => {
                    const q = ac.rows[j];
                    const cells = (m: Mis, x: typeof r) => {
                      const d = x.utility - m.truthful_utility;
                      const truth = x.reported_cost === m.true_cost;
                      return (
                        <>
                          <td className={truth ? "truth" : ""}>{path(x.path)}</td>
                          <td className={truth ? "truth" : ""}>{num(x.utility)}</td>
                          <td className={`${truth ? "truth" : ""} ${d < 0 ? "neg" : ""}`}>{truth ? "truth" : signed(d)}</td>
                        </>
                      );
                    };
                    return <tr key={j}><th>{r.reported_cost.toFixed(1)}</th>{cells(ab, r)}{cells(ac, q)}</tr>;
                  })}
                </tbody>
              </table>
            </div>
          </details>
        )}
        <p className="answer">
          <b>Lying never helps.</b> Road AB keeps profit 1 for any claim up to 4, because its payment does not depend on its own claim;
          above 4 it loses the job and gets 0. Road AC gets 0 for any claim of 1 or more; below 1 it wins the job, is paid 1, but its road costs 2, so its profit is −1.
        </p>
      </Sheet>
    </div>
  );
}
