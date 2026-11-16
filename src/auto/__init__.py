"""Assignment 4: auctions and VCG. `main` runs every part, saving plots and results.json."""

import json
from pathlib import Path

from auto import first_price, plots, second_price, vcg

OUTPUT = Path("output")


def run_all():
    """Every result as one JSON-ready dict; this is what a frontend would request."""
    return {
        "part1": {
            n_rivals: {
                "simulation": second_price.simulate(n_rivals),
                "fixed_rival": second_price.fixed_rival(n_rivals),
            }
            for n_rivals in (1, 2)
        },
        "part2": [first_price.simulate(n) for n in first_price.NS],
        "part3": {
            "truthful": vcg.run(vcg.TRUE_COSTS),
            "misreports": [vcg.misreport(("A", "B")), vcg.misreport(("A", "C"))],
        },
    }


def print_summary(results):
    for n_rivals, part in results["part1"].items():
        print(f"\nPart 1, {n_rivals} rival(s): utility at b=v vs best utility over all bids")
        for run in part["simulation"]["runs"]:
            print(f"  v={run['v']}  rivals {run['strategy']:<8}  b=v: {run['utility_at_truthful_bid']:.4f}"
                  f"  best: {run['max_utility']:.4f} at b in {run['best_bids']}")
        for run in part["fixed_rival"]["runs"]:
            ok = run["utility_at_truthful_bid"] == run["max_utility"]
            print(f"  v={run['v']}  rival bid {run['rival_bid']}  b=v: {run['utility_at_truthful_bid']:+.2f}"
                  f"  best: {run['max_utility']:+.2f}  {'b=v is optimal' if ok else 'b=v NOT optimal'}")

    print("\nPart 2: first-price auction")
    for data in results["part2"]:
        at_eq = min(data["rows"], key=lambda row: abs(row["k"] - data["equilibrium_k"]))
        print(f"  n={data['n']}  equilibrium k={data['equilibrium_k']:.3f}  best k on grid={data['best_k']}"
              f"  could have paid less: {at_eq['fraction_could_pay_less']:.4f}"
              f"  mean overpayment: {at_eq['mean_overpayment']:.4f}  (at k={at_eq['k']})")

    truthful = results["part3"]["truthful"]
    print(f"\nPart 3: VCG path {truthful['path']} (cost {truthful['path_cost']:g})")
    print("  payments: " + ", ".join(f"{e}={p:g}" for e, p in truthful["payments"].items()))
    for data in results["part3"]["misreports"]:
        best = max(row["utility"] for row in data["rows"])
        print(f"  edge {data['edge']} (true cost {data['true_cost']}): truthful utility "
              f"{data['truthful_utility']:g}, best utility from any report {best:g}")


def main() -> None:
    OUTPUT.mkdir(exist_ok=True)
    results = run_all()
    (OUTPUT / "results.json").write_text(json.dumps(results, indent=2))

    # PNG for quick viewing, PDF (vector) for the LaTeX report
    for ext in ("png", "pdf"):
        for n_rivals, part in results["part1"].items():
            plots.part1_simulation(part["simulation"], OUTPUT / f"part1A_{n_rivals}_rival.{ext}")
            plots.part1_fixed(part["fixed_rival"], OUTPUT / f"part1B_{n_rivals}_rival.{ext}")
        plots.part2(results["part2"], OUTPUT / f"part2_first_price.{ext}")
        plots.part2_win_overpay(results["part2"], OUTPUT / f"part2_win_overpay.{ext}")
        plots.part3(results["part3"]["misreports"], OUTPUT / f"part3_vcg_misreport.{ext}")

    print_summary(results)
    print(f"\nSaved plots and results.json to {OUTPUT.resolve()}")
