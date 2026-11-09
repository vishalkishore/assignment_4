"""Part 1: second-price sealed-bid auction, bidder 1 against 1 or 2 rivals."""

import numpy as np

VALUES = (0.2, 0.5, 0.8)
STRATEGIES = ("truthful", "half", "random")
FIXED_RIVAL_BIDS = (0.1, 0.4, 0.9)
BIDS = np.round(np.linspace(0.0, 1.0, 101), 2)


def rival_bids(strategy, n_rivals, n_sims, rng):
    """Highest bid among the rivals in each simulated auction."""
    values = rng.uniform(0, 1, (n_sims, n_rivals))
    if strategy == "truthful":
        bids = values
    elif strategy == "half":
        bids = values / 2
    elif strategy == "random":
        bids = rng.uniform(0, 1, (n_sims, n_rivals))  # ignores its value
    else:
        raise ValueError(f"unknown strategy: {strategy}")
    return bids.max(axis=1)


def utility(v, b, top_rival_bid):
    """Bidder 1 wins only with a strictly higher bid (ties go to the rival)
    and pays the highest rival bid."""
    return np.where(b > top_rival_bid, v - top_rival_bid, 0.0)


def _summary(v, curve):
    i_truth = int(np.flatnonzero(BIDS == v)[0])
    best = BIDS[curve == curve.max()]  # several bids can tie where the curve is flat
    return {
        "utility": curve.tolist(),
        "utility_at_truthful_bid": float(curve[i_truth]),
        "max_utility": float(curve.max()),
        "best_bids": [float(best.min()), float(best.max())],
    }


def simulate(n_rivals=1, n_sims=100_000, seed=0):
    """Part A: average utility of bidder 1 for every bid, per value and rival strategy.
    Every bid is scored on the same n_sims rival draws (common random numbers),
    so bids are compared on identical auctions and noise does not move the peak."""
    rng = np.random.default_rng(seed)
    runs = []
    for v in VALUES:
        for strategy in STRATEGIES:
            top = rival_bids(strategy, n_rivals, n_sims, rng)
            curve = np.array([utility(v, b, top).mean() for b in BIDS])
            runs.append({"v": v, "strategy": strategy, **_summary(v, curve)})
    return {"n_rivals": n_rivals, "n_sims": n_sims, "bids": BIDS.tolist(), "runs": runs}


CHECKPOINTS = (50, 100, 200, 500, 1000, 2000, 5000, 10_000, 20_000, 50_000, 100_000)


def progressive(v, strategy, n_rivals=1, seed=0):
    """One scenario of Part A for the animated frontend: every rival bid of every
    auction, plus the utility curve as it stands after the first N auctions for each
    checkpoint N, so the curve can be shown sharpening as auctions accumulate."""
    rng = np.random.default_rng(seed)
    n_sims = CHECKPOINTS[-1]
    values = rng.uniform(0, 1, (n_sims, n_rivals))
    if strategy == "truthful":
        bids = values
    elif strategy == "half":
        bids = values / 2
    else:
        bids = rng.uniform(0, 1, (n_sims, n_rivals))
    top = bids.max(axis=1)
    idx = np.array(CHECKPOINTS) - 1
    curves = np.array([np.cumsum(utility(v, b, top))[idx] for b in BIDS]).T / np.array(CHECKPOINTS)[:, None]
    return {
        "v": v, "strategy": strategy, "n_rivals": n_rivals,
        "bids": BIDS.tolist(),
        "checkpoints": list(CHECKPOINTS),
        "curves": np.round(curves, 6).tolist(),
        "rival_bids": np.round(bids, 4).tolist(),
        **{k: val for k, val in _summary(v, curves[-1]).items() if k != "utility"},
    }


def fixed_rival(n_rivals=1):
    """Part B: every rival bids the same fixed amount, so the outcome is deterministic."""
    runs = []
    for v in VALUES:
        for r in FIXED_RIVAL_BIDS:
            curve = utility(v, BIDS, r)
            runs.append({"v": v, "rival_bid": r, **_summary(v, curve)})
    return {"n_rivals": n_rivals, "bids": BIDS.tolist(), "runs": runs}
