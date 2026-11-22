import importlib
import sys
import unittest
from pathlib import Path

import torch
from torch.utils.data import DataLoader

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
rl = importlib.import_module("train-self-play")
bc = rl.bc


class ContactMemoryTest(unittest.TestCase):
    def test_history_expires_and_resets(self):
        examples = []
        for i in range(8):
            x, y = [0.] * bc.FEATURES, [0.] * 12
            x[0] = float(i in (1, 5))
            examples.append((x, y, i not in (0, 6), None))
        data = bc.ArenaDataset([examples], context=3)
        # Two sightings, two losses, four unrelated search windows.
        weights = rl.replay_weights(data)
        torch.testing.assert_close(weights[[0, 4, 6, 7]], torch.full((4,), .5 + .5 * 8/12))
        torch.testing.assert_close(weights[[1, 2, 3, 5]], torch.full((4,), .5 + .5 * 8/6))

    def test_paired_yaw_audit_uses_only_observed_contact(self):
        class ReadBearing(torch.nn.Module):
            def forward(self, x):
                out = x.new_zeros(len(x), bc.OUTPUTS)
                out[:, 0] = x[:, -1, 16] + x[:, -1, -2] + x[:, 0, 1]
                return out

        frames = torch.zeros(3, 2, bc.FEATURES)
        frames[:2, 0, 0] = torch.tensor([1., .5])
        frames[:2, 0, 1] = torch.tensor([.3, -.3])
        frames[:2, -1, -2] = torch.tensor([.4, -.4])
        frames[:, -1, 16] = .2
        actor = ReadBearing()
        actions = torch.zeros(3, 12)
        actions[:, 0] = actor(frames)[:, 0].tanh()
        def audit(x, y):
            return bc.evaluate(actor, DataLoader(list(zip(x, y)), batch_size=1),
                               "cpu", torch.ones(bc.BUTTONS))["contactMemory"]
        paired = audit(frames, actions)
        self.assertEqual((paired["windows"], paired["yawMaeRad"]), (2, 0.))
        expected = (actions[:2, 0] - torch.tensor(.2).tanh()).abs().mean() * bc.YAW_SCALE
        self.assertAlmostEqual(paired["maskedYawMaeRad"], expected.item())
        self.assertIsNone(audit(frames[2:], actions[2:])["maskedYawMaeRad"])


if __name__ == "__main__":
    unittest.main()
