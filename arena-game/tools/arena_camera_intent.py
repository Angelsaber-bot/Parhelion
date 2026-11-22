"""Cross-fit the actor's yaw readout on human training captures.

The screen and release sets do not enter this module. Its only deployed parameters
are the existing linear yaw row and bias; the actor and action schema stay unchanged.
"""
import math
import torch

MIXTURES = (.25, .5, 1.)
HEADS = ("contact_anchored", "reference", "reference_compass", "median")


def folds(captures, indices, context):
    # Keep whole captures apart. For a single recording use contiguous blocks and
    # purge context-width overlap on both sides of the validation block.
    n = int(captures.max()) + 1
    if n > 1:
        for fold in range(min(n, 3)):
            valid = captures.remainder(min(n, 3)) == fold
            yield ~valid, valid
    else:
        for block in indices.tensor_split(3):
            valid = (indices >= block[0]) & (indices <= block[-1])
            train = (indices <= block[0] - context) | (indices >= block[-1] + context)
            yield train, valid


def design(encoder, states):
    h = encoder.encode(states).double()
    return torch.cat((h, torch.ones_like(h[:, :1])), dim=1)


def fit_heads(x, y, seen, turn, base, sim, sim_seen, ref_logits, sim_ref):
    ridge = torch.eye(x.shape[1], dtype=x.dtype) * .15
    def weights(mask):
        return mask.double() / mask.sum().clamp_min(1)
    def solve(a, target, weight, prior):
        return torch.linalg.solve(a.T @ (weight[:, None] * a) + ridge,
                                  a.T @ (weight * target) + ridge @ prior)
    # A conservative candidate reduces unnecessary yaw outside contact while
    # keeping the current response on contact states encountered in actual games.
    joined = torch.cat((x, sim))
    contact = torch.cat((seen, sim_seen))
    parent = joined @ base
    conservative = solve(joined, torch.where(contact, parent, .45 * parent),
                         weights(contact) + weights(~contact), base * .55)
    # The PPO encoder can drift away from the frozen imitation encoder. Distill the
    # reference yaw in the *current* embedding on non-contact states while retaining
    # the learner's combat response. The reference is available during training only.
    reference = solve(joined, torch.where(contact, parent, torch.cat((ref_logits, sim_ref))),
                      weights(contact) + weights(~contact), base)
    # Iteratively reweighted regression approximates a conditional median in
    # actuator space. Separate masses prevent quiet windows from burying real turns.
    human_weight = .5 * weights(~seen & ~turn) + .5 * weights(~seen & turn)
    anchor_weight = .35 * weights(sim_seen)
    anchor_yaw = sim @ base
    w = conservative
    for _ in range(6):
        z = x @ w
        error = y - z.tanh()
        deriv = (1 - z.tanh().square()).clamp_min(.1)
        weight = human_weight * deriv.square() / error.abs().clamp_min(.035)
        target = z + error / deriv
        w = solve(joined, torch.cat((target, anchor_yaw)),
                  torch.cat((weight, anchor_weight)), conservative)
    heads = (conservative, reference, reference.lerp(conservative, .35), w)
    return torch.stack([base] + [base.lerp(head, strength) for head in heads for strength in MIXTURES])


def errors(pred, target, mask, scale):
    return ((pred[:, mask] - target[mask]).abs().mean(dim=1) * scale).tolist()


@torch.no_grad()
def calibrate_yaw(actor, reference, dataset, capture_ends, rollout, behavior_logits, base_kl,
                  target_kl, axis_std, yaw_scale, turn_radians):
    if len(dataset) < 20:
        return {"status": "insufficient_train_windows"}
    # Sample evenly across the original time axis. The selected indices retain
    # capture identities and temporal distances for the purged single-capture case.
    indices = torch.linspace(0, len(dataset) - 1, min(len(dataset), 4096)).long()
    captures = torch.bucketize(indices, torch.tensor(capture_ends[:-1]), right=True)
    _, captures = torch.unique(captures, sorted=True, return_inverse=True)
    encoded, reference_yaw = [], []
    for rows in indices.split(256):
        batch = torch.stack([dataset[i][0] for i in rows.tolist()])
        encoded.append(design(actor, batch))
        reference_yaw.append(reference(batch)[:, 0].double())
    x, ref = torch.cat(encoded), torch.cat(reference_yaw)
    y = dataset.targets[indices, 0].double()
    seen = dataset.features[indices, 0] > 0
    turn = y.abs() * yaw_scale >= turn_radians
    if (turn & ~seen).sum() < 3 or (~turn & ~seen).sum() < 8:
        return {"status": "insufficient_train_turns"}
    base = torch.cat((actor.out.weight[0], actor.out.bias[:1])).double()
    sim_all = torch.cat([design(actor, batch) for batch in rollout.split(256)])
    sim_idx = torch.linspace(0, len(rollout) - 1, min(len(rollout), 512)).long()
    sim, sim_seen = sim_all[sim_idx], rollout[sim_idx, -1, 0] > 0
    sim_ref = torch.cat([reference(batch)[:, 0] for batch in rollout[sim_idx].split(256)]).double()
    oof = torch.zeros(1 + len(HEADS) * len(MIXTURES), len(indices), dtype=x.dtype)
    covered = torch.zeros(len(indices), dtype=torch.bool)
    for train, valid in folds(captures, indices, dataset.context):
        if not (train & ~seen & turn).any() or not (train & ~seen & ~turn).any():
            continue
        heads = fit_heads(x[train], y[train], seen[train], turn[train], base, sim, sim_seen, ref[train], sim_ref)
        oof[:, valid] = heads @ x[valid].T
        covered |= valid
    active, quiet = covered & ~seen & turn, covered & ~seen & ~turn
    if active.sum() < 3 or quiet.sum() < 8:
        return {"status": "insufficient_cross_fit_coverage"}
    predictions = oof.tanh()
    turning, resting = errors(predictions, y, active, yaw_scale), errors(predictions, y, quiet, yaw_scale)
    still = y[active].abs().mean().item() * yaw_scale
    audit = {"split": "capture" if len(capture_ends) > 1 else "purged_time_blocks", "turnWindows": int(active.sum()),
             "quietWindows": int(quiet.sum()), "stillTurnMae": still,
             "beforeTurnMae": turning[0], "beforeQuietMae": resting[0],
             "referenceTurnMae": errors(ref.tanh()[None], y, active, yaw_scale)[0],
             "referenceQuietMae": errors(ref.tanh()[None], y, quiet, yaw_scale)[0]}
    # Preserve the PPO step's turn accuracy when reducing idle camera motion.
    limit = min(still, turning[0])
    best, score = 0, 2.
    for i in range(1, len(turning)):
        cost = turning[i] / max(.04, turning[0]) + resting[i] / max(.01, resting[0])
        baseline = turning[0] / max(.04, turning[0]) + resting[0] / max(.01, resting[0])
        if turning[i] < limit and resting[i] <= resting[0] and cost < min(score, baseline - .01):
            best, score = i, cost
    if not best:
        return dict(audit, status="retained")
    fitted = fit_heads(x, y, seen, turn, base, sim, sim_seen, ref, sim_ref)[best]
    change = sim_all @ (fitted - base)
    current = sim_all @ base
    original = behavior_logits[:, 0].double()
    # Only the yaw Gaussian changes here. Its analytic KL shift gives an exact
    # bound on the rollout-wide joint KL already measured after the PPO step.
    denom = 2 * axis_std**2
    distance = change.square().mean().item() / denom
    blend = min(1., math.sqrt(.3 * target_kl / max(1e-12, distance)))
    before = (original - current).square().mean()
    while blend > 1e-4:
        after = (original - current - blend * change).square().mean()
        if base_kl + (after - before).item() / denom <= max(base_kl, target_kl) + .1 * target_kl:
            break
        blend *= .5
    if blend <= 1e-4:
        return dict(audit, status="trust_limit")
    blended = oof[0].lerp(oof[best], blend).tanh()[None]
    turn_mae = errors(blended, y, active, yaw_scale)[0]
    quiet_mae = errors(blended, y, quiet, yaw_scale)[0]
    if turn_mae > turning[0] or quiet_mae > resting[0]:
        return dict(audit, status="retained")
    w = base + blend * (fitted - base)
    actor.out.weight[0].copy_(w[:-1])
    actor.out.bias[0].copy_(w[-1])
    return dict(audit, status="applied", model=HEADS[(best - 1) // len(MIXTURES)],
                selectedFraction=MIXTURES[(best - 1) % len(MIXTURES)],
                selectedTurnMae=turning[best], selectedQuietMae=resting[best], appliedFraction=blend,
                appliedTurnMae=turn_mae,
                appliedQuietMae=quiet_mae,
                yawUpdateKL=distance * blend**2)
