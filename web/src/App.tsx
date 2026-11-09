import { useState } from "react";
import ActOne from "./ActOne";
import Answers from "./Answers";
import ActThree from "./ActThree";
import ActTwo from "./ActTwo";
import { usePyStatus } from "./py";

const EPISODES = [
  { id: "one", ep: "EP 1", name: "Second-Price Showdown", part: "Part 1: winner pays the 2nd-highest bid" },
  { id: "two", ep: "EP 2", name: "Pay Your Own Bid", part: "Part 2: first-price auction" },
  { id: "three", ep: "EP 3", name: "The Courier Contract", part: "Part 3: VCG cheapest route" },
  { id: "answers", ep: "FINAL", name: "Assignment Answers", part: "Every question, answered and checked" },
] as const;
type EpId = (typeof EPISODES)[number]["id"];

export default function App() {
  const status = usePyStatus();
  const [ep, setEp] = useState<EpId>(() => {
    const h = location.hash.slice(1);
    return (EPISODES.some((e) => e.id === h) ? h : "one") as EpId;
  });
  const go = (id: EpId) => { setEp(id); history.replaceState(null, "", `#${id}`); };
  const failed = status.startsWith("failed");

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <h1><span>Bidding</span> <span>Arc</span></h1>
          <p>Three auction rules, explained one match at a time.</p>
        </div>
        <nav className="acts" aria-label="Episodes">
          {EPISODES.map((e) => (
            <button key={e.id} className={e.id === ep ? "on" : ""} aria-current={e.id === ep ? "page" : undefined} onClick={() => go(e.id)}>
              <span className="flag">{e.ep}</span>
              <span><b>{e.name}</b><small>{e.part}</small></span>
            </button>
          ))}
        </nav>
      </header>

      {status !== "ready" ? (
        <div className="boot" role="status">
          <div className="charge" aria-hidden><i /></div>
          <h2>{failed ? "Python could not start" : "Charging up…"}</h2>
          <p>{status}</p>
          {!failed && <p className="small">The first visit downloads Python (about 10 MB). Later visits load from your browser's cache.</p>}
        </div>
      ) : (
        <>
          {ep === "one" && <ActOne />}
          {ep === "two" && <ActTwo />}
          {ep === "three" && <ActThree />}
          {ep === "answers" && <Answers />}
        </>
      )}

      <footer className="foot">
        Every number on this page is computed by the assignment's Python code, running in your browser with Pyodide.
      </footer>
    </div>
  );
}
