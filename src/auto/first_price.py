"""Part 2: first-price auction with n bidders; bidder 1 bids k*v, the rest bid (n-1)/n * v."""

import numpy as np

KS = np.round(np.arange(0.1, 2.0001, 0.1), 1)
NS = (2, 3, 4)


def sample_auctions(n, k, count=5000, seed=0):
    """Individual auctions for the animated frontend: values of all n bidders
    (bidder 1 first); bids follow from k and the equilibrium (n-1)/n."""
    values = np.random.default_rng(seed).uniform(0, 1, (count, n))
    return {"n": n, "k": k, "equilibrium_k": (n - 1) / n, "values": np.round(values, 4).tolist()}


def simulate(n, n_sims=100_000, seed=0):
    rng = np.random.default_rng(seed)
    equilibrium = (n - 1) / n
    values = rng.uniform(0, 1, (n_sims, n))  # column 0 is bidder 1; same draws for every k
    rows = []
    for k in KS:
        bids = values * equilibrium
        bids[:, 0] = k * values[:, 0]

        others_top = bids[:, 1:].max(axis=1)
        bidder1_wins = bids[:, 0] > others_top  # ties go to the others
        u1 = np.where(bidder1_wins, values[:, 0] - bids[:, 0], 0.0)

        # The winner pays their own bid; they could have paid less and still won
        # whenever their bid was strictly above the second-highest bid.
        top_two = np.sort(bids, axis=1)[:, -2:]
        overpaid = top_two[:, 1] > top_two[:, 0]

        rows.append({
            "k": float(k),
            "expected_utility": float(u1.mean()),
            "bidder1_win_rate": float(bidder1_wins.mean()),
            "fraction_could_pay_less": float(overpaid.mean()),
            "mean_overpayment": float((top_two[:, 1] - top_two[:, 0]).mean()),
        })
    best = max(rows, key=lambda row: row["expected_utility"])
    return {
        "n": n,
        "n_sims": n_sims,
        "equilibrium_k": equilibrium,
        "best_k": best["k"],
        "rows": rows,
    }
