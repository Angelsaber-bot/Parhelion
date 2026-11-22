import importlib
import json
from pathlib import Path
import sys
from tempfile import TemporaryDirectory
import unittest

import torch
from torch import nn

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
trainer = importlib.import_module("train-self-play")


class SelfPlayLearningTest(unittest.TestCase):
    def test_multistep_targets_end_at_death_and_match_end(self):
        def step(reset):
            return dict(obs=[0.] * trainer.bc.FEATURES, axes=[0.] * 4, buttons=[0] * 7,
                        weapon=0, logp=0., reward=0., reset=reset)

        episodes = [dict(ticks=48, steps=[step(value) for value in resets]) for resets in
                    ([True, False, True, False], [True, False, False, False])]
        with TemporaryDirectory() as directory:
            path = Path(directory) / "episodes.json"
            path.write_text(json.dumps(dict(version=1, axisStd=trainer.AXIS_STD, actorHash="actor",
                                            rulesVersion=43, episodes=episodes)))
            _, actions, _, _, ends, _, successors = trainer.read_trajectories(path, "actor", 43, 4)
        self.assertEqual(ends, [4, 8])
        self.assertEqual(successors.tolist(), [True, False, True, False, True, True, True, False])

        torch.manual_seed(73)
        dynamics = trainer.LatentDynamics(6)
        indices = torch.tensor([7, 5, 3, 0, 6, 1, 2, 4])
        initial = torch.randn(len(indices), 6)
        actions[:, 0] = torch.linspace(-2., 2., len(indices))
        # Change targets only at initial states: they must never be predicted by any preceding action.
        targets = torch.randn_like(initial)
        loss, pairs = trainer.prediction_loss(dynamics, initial, indices, actions, targets, successors)
        self.assertEqual(pairs, 8)
        targets[[0, 2, 4]] *= -1
        other, _ = trainer.prediction_loss(dynamics, initial, indices, actions, targets, successors)
        torch.testing.assert_close(loss, other)
        loss.backward()
        self.assertGreater(dynamics.next_state.weight_ih.grad.abs().sum().item(), 0)

    def test_joint_behavior_kl(self):
        actor = nn.Identity()
        old = torch.zeros(257, trainer.bc.OUTPUTS)
        self.assertAlmostEqual(trainer.rollout_kl(actor, old, old), 0., places=6)
        changed = old.clone()
        changed[:, 0] += trainer.AXIS_STD
        self.assertAlmostEqual(trainer.rollout_kl(actor, changed, old), .5, places=6)


if __name__ == "__main__":
    unittest.main()
