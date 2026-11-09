"""Functions the web frontend calls through Pyodide. Every function returns a JSON string."""

import json

from auto import first_price, second_price, vcg


def part1_live(v, strategy, n_rivals, seed):
    return json.dumps(second_price.progressive(float(v), strategy, int(n_rivals), int(seed)))


def part1_fixed(n_rivals):
    return json.dumps(second_price.fixed_rival(int(n_rivals)))


def part1_wall(n_rivals, seed):
    return json.dumps(second_price.simulate(int(n_rivals), seed=int(seed)))


def part2_curves(seed):
    return json.dumps([first_price.simulate(n, seed=int(seed)) for n in first_price.NS])


def part2_samples(n, k, seed):
    return json.dumps(first_price.sample_auctions(int(n), float(k), seed=int(seed)))


def part3_state(declared_json):
    """VCG outcome for the declared costs, plus the detour the parcel would take
    if each edge on the chosen path were removed (that detour sets its payment)."""
    declared = {(e[0], e[1]): float(c) for e, c in json.loads(declared_json).items()}
    result = vcg.run(declared)
    result["detours"] = {}
    for edge in result["path_edges"]:
        cost, path = vcg.cheapest_path({k: c for k, c in declared.items() if vcg.name(k) != edge})
        result["detours"][edge] = {"path_edges": [vcg.name(p) for p in path], "cost": float(cost)}
    return json.dumps(result)


def part3_truthful():
    return json.dumps(vcg.run(vcg.TRUE_COSTS))


def part3_misreport(edge):
    return json.dumps(vcg.misreport((edge[0], edge[1])))


def part3_graph():
    return json.dumps({vcg.name(e): c for e, c in vcg.TRUE_COSTS.items()})
