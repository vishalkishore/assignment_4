"""Matplotlib figures for every part. Each function takes the dict a module returned."""

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

# report style: matches the blue/orange of the course report template
plt.rcParams.update({
    "font.family": "serif", "font.serif": ["DejaVu Serif"], "font.size": 10,
    "axes.spines.top": False, "axes.spines.right": False,
    "axes.prop_cycle": matplotlib.cycler(color=["#2B7BD9", "#F06A35", "#2E9E6A"]),
    "axes.titlesize": 10, "axes.titleweight": "bold", "savefig.bbox": "tight",
})


def _grid(title):
    fig, axes = plt.subplots(3, 3, figsize=(13, 11), sharex=True, constrained_layout=True)
    fig.suptitle(title, fontsize=14)
    return fig, axes


def _mark_truth(ax, v):
    ax.axvline(v, color="#E8344E", linestyle="--", linewidth=1, label=f"b = v = {v}")
    ax.axhline(0, color="grey", linewidth=0.6)
    ax.grid(alpha=0.3)
    ax.legend(fontsize=8)


def part1_simulation(data, path):
    fig, axes = _grid(f"Second-price auction, {data['n_rivals']} rival(s): "
                      f"average utility of bidder 1 ({data['n_sims']:,} auctions per bid)")
    for ax, run in zip(axes.flat, data["runs"]):
        ax.plot(data["bids"], run["utility"], color="#2B7BD9")
        ax.set_title(f"v = {run['v']}, rivals bid {run['strategy']}", fontsize=10)
        _mark_truth(ax, run["v"])
    for ax in axes[-1]:
        ax.set_xlabel("bid of bidder 1")
    for ax in axes[:, 0]:
        ax.set_ylabel("average utility")
    fig.savefig(path, dpi=120)
    plt.close(fig)


def part1_fixed(data, path):
    fig, axes = _grid(f"Second-price auction, {data['n_rivals']} rival(s) with a fixed bid: utility of bidder 1")
    for ax, run in zip(axes.flat, data["runs"]):
        ax.plot(data["bids"], run["utility"], color="#2B7BD9")
        ax.axvline(run["rival_bid"], color="grey", linestyle=":", linewidth=1)
        ax.set_title(f"v = {run['v']}, rival bid = {run['rival_bid']}", fontsize=10)
        _mark_truth(ax, run["v"])
    for ax in axes[-1]:
        ax.set_xlabel("bid of bidder 1")
    for ax in axes[:, 0]:
        ax.set_ylabel("utility")
    fig.savefig(path, dpi=120)
    plt.close(fig)


def part2(results, path):
    # the "could pay less" fraction is 100% for every k, so it is reported in the table, not plotted
    fig, left = plt.subplots(figsize=(8, 4.5), constrained_layout=True)
    fig.suptitle("First-price auction: bidder 1 bids k·v, others bid (n−1)/n·v", fontsize=12)
    for data, color in zip(results, ("#2B7BD9", "#F06A35", "#2E9E6A")):
        ks = [row["k"] for row in data["rows"]]
        left.plot(ks, [row["expected_utility"] for row in data["rows"]], "o-", ms=3,
                  color=color, label=f"n = {data['n']}")
        left.axvline(data["equilibrium_k"], color=color, linestyle="--", linewidth=1)
    left.axhline(0, color="grey", linewidth=0.6)
    left.set(xlabel="k (bid = k × value)", ylabel="expected utility of bidder 1",
             title="Expected utility (dashed: equilibrium k)")
    left.grid(alpha=0.3)
    left.legend()
    fig.savefig(path, dpi=120)
    plt.close(fig)


def part3(results, path):
    fig, axes = plt.subplots(1, len(results), figsize=(13, 5), constrained_layout=True)
    fig.suptitle("VCG cheapest path: utility of one edge as it misreports its cost", fontsize=14)
    for ax, data in zip(axes, results):
        reported = [row["reported_cost"] for row in data["rows"]]
        ax.step(reported, [row["utility"] for row in data["rows"]], where="mid", color="#2B7BD9",
                label="utility")
        ax.axvline(data["true_cost"], color="#E8344E", linestyle="--", linewidth=1,
                   label=f"true cost = {data['true_cost']}")
        ax.axhline(data["truthful_utility"], color="#2E9E6A", linestyle=":",
                   label=f"truthful utility = {data['truthful_utility']:g}")
        ax.set(xlabel="reported cost", ylabel="utility", title=f"Edge {data['edge']}")
        ax.grid(alpha=0.3)
        ax.legend(fontsize=9)
    fig.savefig(path, dpi=120)
    plt.close(fig)


def part2_win_overpay(results, path):
    fig, (win, over) = plt.subplots(1, 2, figsize=(11, 4), constrained_layout=True)
    fig.suptitle("First-price auction: what a higher bid buys", fontsize=12)
    for data, color in zip(results, ("#2B7BD9", "#F06A35", "#2E9E6A")):
        ks = [row["k"] for row in data["rows"]]
        win.plot(ks, [row["bidder1_win_rate"] for row in data["rows"]], "o-", ms=3,
                 color=color, label=f"n = {data['n']}")
        over.plot(ks, [row["mean_overpayment"] for row in data["rows"]], "o-", ms=3,
                  color=color, label=f"n = {data['n']}")
        for ax in (win, over):
            ax.axvline(data["equilibrium_k"], color=color, linestyle="--", linewidth=1)
    win.set(xlabel="k (bid = k × value)", ylabel="win rate of bidder 1", title="Win rate")
    over.set(xlabel="k (bid = k × value)", ylabel="winning bid − second bid",
             title="Average overpayment by the winner")
    for ax in (win, over):
        ax.grid(alpha=0.3)
        ax.legend()
    fig.savefig(path, dpi=120)
    plt.close(fig)
