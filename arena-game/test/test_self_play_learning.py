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
            _, actions, _, _, ends, counts, successors, coaching = trainer.read_trajectories(path, "actor", 43, 4)
        self.assertTrue((coaching == trainer.UNLABELED).all())
        self.assertEqual(ends, [4, 8])
        self.assertEqual(counts, dict(games=2, environmentSteps=96, policyTrajectories=2, partnerDecisions=0))
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

    def test_teammate_histories_returns_and_match_counts(self):
        def step(value, reset, reward=0.):
            return dict(obs=[value] * trainer.bc.FEATURES, axes=[0.] * 4, buttons=[0] * 7,
                        weapon=0, logp=0., reward=reward, reset=reset)

        duo = dict(layout="2v2", ticks=13, trajectories={
            "pilot": [step(1, True), step(2, False)],
            "partner": [step(3, True), step(4, False, 1.)],
        })
        solo = dict(layout="1v1", ticks=12, trajectories={"pilot": [step(5, True, -1.)]})
        doc = dict(version=2, axisStd=trainer.AXIS_STD, actorHash="actor", rulesVersion=43, episodes=[duo, solo])
        with TemporaryDirectory() as directory:
            path = Path(directory) / "episodes.json"
            path.write_text(json.dumps(doc))
            states, _, _, rewards, ends, counts, successors, _ = trainer.read_trajectories(path, "actor", 43, 2)
            self.assertEqual(states[:, :, 0].tolist(), [[0, 1], [1, 2], [0, 3], [3, 4], [0, 5]])
            self.assertEqual(ends, [2, 4, 5])
            self.assertEqual(successors.tolist(), [True, False, True, False, False])
            self.assertEqual(counts, dict(games=2, environmentSteps=25, policyTrajectories=3, partnerDecisions=2))
            _, returns = trainer.generalized_advantages(rewards, torch.zeros_like(rewards), ends)
            torch.testing.assert_close(returns, torch.tensor([0., 0., .99 * .95, 1., -1.]))

            duo["trajectories"]["partner"][0]["reset"] = False
            path.write_text(json.dumps(doc))
            with self.assertRaisesRegex(ValueError, "fresh policy context"):
                trainer.read_trajectories(path, "actor", 43, 2)
            del duo["trajectories"]["partner"]
            path.write_text(json.dumps(doc))
            with self.assertRaisesRegex(ValueError, "each friendly seat"):
                trainer.read_trajectories(path, "actor", 43, 2)

    def test_joint_behavior_kl(self):
        actor = nn.Identity()
        old = torch.zeros(257, trainer.bc.OUTPUTS)
        self.assertAlmostEqual(trainer.rollout_kl(actor, old, old), 0., places=6)
        changed = old.clone()
        changed[:, 0] += trainer.AXIS_STD
        self.assertAlmostEqual(trainer.rollout_kl(actor, changed, old), .5, places=6)

    def test_corrections_preserve_unknown_heads_and_balance_trigger_classes(self):
        logits = torch.zeros(2, 14, requires_grad=True)
        labels = torch.tensor([[.5, 2., 2., 2., 0.], [2., 2., 2., 2., 1.]])
        loss = trainer.correction_loss(logits, labels)
        loss.backward()
        self.assertLess(logits.grad[0, 0], 0)
        self.assertEqual(logits.grad[1, 0], 0)
        self.assertEqual(logits.grad[:, 1:4].count_nonzero(), 0)
        self.assertEqual(logits.grad[:, 5:].count_nonzero(), 0)
        self.assertGreater(logits.grad[0, 4], 0)
        self.assertLess(logits.grad[1, 4], 0)
        repeats = [0] * 99 + [1]
        torch.testing.assert_close(trainer.correction_loss(logits[repeats], labels[repeats]), loss)
        torch.testing.assert_close(trainer.correction_loss(logits, torch.full_like(labels, 2.)), torch.zeros(()))

    def test_correction_archive_keeps_rare_labels_through_unlabeled_and_common_generations(self):
        rng = torch.Generator().manual_seed(826)
        states = torch.zeros(600, 8, trainer.bc.FEATURES)
        labels = torch.full((600, 5), trainer.UNLABELED)
        labels[:-1, 4] = 0
        labels[-1, 4] = 1
        first = trainer.aggregate_corrections(None, states, labels, rng)
        self.assertEqual(len(first["labels"]), 41)
        labels[:] = trainer.UNLABELED
        labels[:500, 4] = 0
        second = trainer.aggregate_corrections(first, states, labels, rng)
        self.assertEqual((second["labels"][:, 4] == 1).sum(), 1)
        self.assertEqual((second["labels"][:, 4] == 0).sum(), 40)
        self.assertEqual(second["states"].dtype, torch.float16)


if __name__ == "__main__":
    unittest.main()
