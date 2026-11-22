import copy
from pathlib import Path
import sys
import unittest

import torch
from torch import nn

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
from arena_camera_intent import calibrate_yaw, folds


class CameraIntentTest(unittest.TestCase):
    def test_capture_and_single_recording_folds_do_not_overlap(self):
        indices = torch.arange(84)
        captures = indices // 28
        for train, test in folds(captures, indices, 8):
            self.assertFalse(set(captures[train].tolist()) & set(captures[test].tolist()))
        for train, test in folds(torch.zeros_like(captures), indices, 8):
            distance = (indices[train, None] - indices[test][None, :]).abs().min()
            self.assertGreaterEqual(int(distance), 8)

    def test_updates_only_existing_yaw_row_within_rollout_budget(self):
        class Policy(nn.Module):
            def __init__(self):
                super().__init__()
                self.out = nn.Linear(2, 14)

            def encode(self, states):
                return states[:, -1]

            def forward(self, states):
                return self.out(self.encode(states))

        class Samples:
            context = 1

            def __init__(self):
                t = torch.arange(160)
                cue = torch.where(t % 4 == 0, torch.ones_like(t), torch.where(t % 4 == 1, -1, 0)).float()
                self.features = torch.stack(((t % 7 == 0).float(), cue), dim=1)
                self.targets = (cue * .4)[:, None]

            def __len__(self):
                return len(self.targets)

            def __getitem__(self, i):
                return self.features[i, None], self.targets[i]

        model = Policy()
        with torch.no_grad():
            model.out.weight[0].copy_(torch.tensor([0., .6]))
            model.out.bias[0] = .25
        old = copy.deepcopy(model)
        data = Samples()
        states = data.features[:, None]
        logits = model(states).detach()
        result = calibrate_yaw(model, old, data, [40, 80, 120, 160], states, logits, 0., .03, .35, .9, .045)
        self.assertEqual(result["split"], "capture")
        self.assertEqual(result["status"], "applied")
        self.assertLess(result["appliedQuietMae"], result["beforeQuietMae"])
        self.assertLess(result["appliedTurnMae"], result["stillTurnMae"])
        out = model(states).detach()
        torch.testing.assert_close(out[:, 1:], logits[:, 1:], rtol=0., atol=0.)
        kl = (out[:, 0] - logits[:, 0]).square().mean() / (2 * .35**2)
        self.assertLessEqual(float(kl), .3 * .03 + 1e-7)
        self.assertAlmostEqual(float(kl), result["yawUpdateKL"], places=6)


if __name__ == "__main__":
    unittest.main()
