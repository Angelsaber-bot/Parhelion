"""Compare demonstrated paths in the map's coordinate frame over short, continuous segments."""
import torch
from torch.nn import functional as F

ROUTE_STEPS = 8


def route_indices(starts, ends, eligible=None):
    routes = []
    for end in ends:
        first = end + 1 - ROUTE_STEPS
        if first >= starts[end] and (eligible is None or eligible[first:end + 1].all()):
            routes.append(range(first, end + 1))
    return torch.tensor(routes, dtype=torch.long).reshape(-1, ROUTE_STEPS)


def route_loss(predicted, target, heading):
    # Match the game's diagonal speed limit and camera-relative movement convention.
    def path(axes):
        axes = axes / axes.norm(dim=-1, keepdim=True).clamp_min(1.)
        right, forward = axes.unbind(-1)
        sine, cosine = heading.unbind(-1)
        world = torch.stack((right * cosine - forward * sine, -forward * cosine - right * sine), -1)
        return world.cumsum(dim=1) / ROUTE_STEPS

    return F.smooth_l1_loss(path(predicted), path(target), beta=.1)
