"""Part 3: VCG for buying the cheapest A->F path; every edge is an agent (Figure 7.3)."""

import heapq

import numpy as np

# Directed edges and their true costs, from Figure 7.3.
TRUE_COSTS = {
    ("A", "B"): 3, ("A", "C"): 2, ("B", "D"): 2, ("B", "E"): 1,
    ("C", "E"): 3, ("C", "F"): 5, ("D", "F"): 2, ("E", "F"): 1,
}
SOURCE, TARGET = "A", "F"
MISREPORTS = np.arange(0, 10.0001, 0.5)


def name(edge):
    return edge[0] + edge[1]


def cheapest_path(costs):
    """Dijkstra. Equal-cost paths are broken by alphabetical node order."""
    queue = [(0, (SOURCE,))]
    done = set()
    while queue:
        cost, path = heapq.heappop(queue)
        node = path[-1]
        if node == TARGET:
            return cost, [(path[i], path[i + 1]) for i in range(len(path) - 1)]
        if node in done:
            continue
        done.add(node)
        for (u, w), c in costs.items():
            if u == node and w not in done:
                heapq.heappush(queue, (cost + c, path + (w,)))
    return float("inf"), []


def run(declared):
    """Choose the cheapest path for the declared costs and pay every edge
    (cheapest cost without the edge) - (cost of the other edges on the chosen path)."""
    total, path = cheapest_path(declared)
    payments = {}
    for edge in declared:
        without = {e: c for e, c in declared.items() if e != edge}
        cost_without, _ = cheapest_path(without)
        others_on_path = total - (declared[edge] if edge in path else 0)
        payments[name(edge)] = float(cost_without - others_on_path)
    return {
        "path": SOURCE + "".join(e[1] for e in path),
        "path_edges": [name(e) for e in path],
        "path_cost": float(total),
        "payments": payments,
    }


def edge_outcome(edge, reported, true_costs=TRUE_COSTS):
    """One edge reports `reported`, all others are truthful.
    Utility = payment - true cost if the edge is on the chosen path, else the payment (0)."""
    result = run({**true_costs, edge: float(reported)})
    on_path = name(edge) in result["path_edges"]
    payment = result["payments"][name(edge)]
    return {
        "reported_cost": float(reported),
        "path": result["path"],
        "on_path": on_path,
        "payment": payment,
        "utility": payment - (true_costs[edge] if on_path else 0),
    }


def misreport(edge, true_costs=TRUE_COSTS):
    """Utility of one edge for every misreported cost from 0 to 10 in steps of 0.5."""
    return {
        "edge": name(edge),
        "true_cost": true_costs[edge],
        "truthful_utility": edge_outcome(edge, true_costs[edge], true_costs)["utility"],
        "rows": [edge_outcome(edge, r, true_costs) for r in MISREPORTS],
    }
