import importlib
import sys
import unittest
from pathlib import Path

import torch
from torch.utils.data import DataLoader, TensorDataset

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / "scripts"), str(ROOT / "tools")]
cycle = importlib.import_module("self-play-cycle")
bc = importlib.import_module("train-arena-policy")


class FixedActions(torch.nn.Module):
    def forward(self, states):
        out = states.new_zeros((len(states), bc.OUTPUTS))
        out[:, 0] = states[:, -1, 1]
        return out


class HumanGateTest(unittest.TestCase):
    def metrics(self, candidate_turn, candidate_quiet, turns=10):
        actual = torch.zeros(60, 12)
        actual[:turns, 0] = .3
        states = torch.zeros(60, 1, bc.FEATURES)

        def evaluate(turn, quiet):
            states[:turns, -1, 1] = torch.atanh(torch.tensor(turn))
            states[turns:, -1, 1] = torch.atanh(torch.tensor(quiet))
            loader = DataLoader(TensorDataset(states, actual), batch_size=16)
            return bc.evaluate(FixedActions(), loader, "cpu", torch.ones(bc.BUTTONS))

        return dict(holdoutWindows=60, referenceHoldout=evaluate(.2, .02),
                    holdout=evaluate(candidate_turn, candidate_quiet))

    def test_idle_dominance_cannot_approve_a_stationary_or_spinning_policy(self):
        good = self.metrics(.25, .01)
        self.assertEqual(good["holdout"]["cameraAndMovement"]["unseenTurn"]["windows"], 10)
        self.assertTrue(all(cycle.human_gates(good).values()))
        self.assertFalse(cycle.human_gates(self.metrics(0., 0.))["human_search"])
        self.assertFalse(cycle.human_gates(self.metrics(.25, .3))["human_quiet"])
        self.assertFalse(cycle.human_gates(self.metrics(.25, .01, turns=2))["human_holdout"])


if __name__ == "__main__":
    unittest.main()
