import importlib
import hashlib
import json
import sys
import unittest
from pathlib import Path

import torch
from torch.utils.data import DataLoader

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
rl = importlib.import_module("train-self-play")
bc = rl.bc


class ContactMemoryTest(unittest.TestCase):
    def test_learned_search_teacher_yields_to_contacts_and_recent_sightings(self):
        root = Path(__file__).resolve().parents[1]
        wire = (root / "shared/directPolicy.json").read_bytes()
        base = json.loads(wire)
        states = torch.zeros(4, base["context"], bc.FEATURES)
        states[1, -1, 0] = .5
        states[2, 0, 0] = 1
        states[3, -1, -3] = .1
        result = rl.search_demonstrations(states, base["rulesVersion"])
        expected = json.loads((root / "tools/challengers/spawn-search-head.json").read_bytes())["baseSha256"]
        if expected == hashlib.sha256(wire).hexdigest():
            self.assertIsNotNone(result)
            mask, labels = result
            self.assertEqual(mask.tolist(), [True, False, False, False])
            self.assertTrue(torch.isfinite(labels).all())
            self.assertEqual(labels.shape, (4, 3))
            self.assertTrue((labels[~mask] == 0).all())
        else:
            self.assertIsNone(result)
        self.assertIsNone(rl.search_demonstrations(states, base["rulesVersion"] + 1))

    def test_replay_balances_clear_close_contacts_with_other_sightings(self):
        examples = []
        for distance in [6, 18, 20, 25]:
            x, y = [0.] * bc.FEATURES, [0.] * 12
            x[0], x[3] = 1., distance / 45
            examples.append((x, y, False, None))
        data = bc.ArenaDataset([examples], context=2)
        weights = rl.replay_weights(data)
        self.assertGreater(weights[0].item(), weights[1].item())
        torch.testing.assert_close(weights[1:], weights[1].expand(3))

    def test_search_teacher_weights_stalls_only_with_real_history(self):
        states = torch.zeros(3, 4, bc.FEATURES)
        states[:, :, 5] = 1
        states[1, 1, bc.OBSERVATIONS] = .1  # moved out and back
        states[2, 0, 5] = 0  # reset padding
        logits = torch.zeros(3, bc.OUTPUTS)
        controls = torch.ones(3, 3)
        losses = [rl.search_imitation_loss(logits[i:i+1], controls[i:i+1], states[i:i+1]) for i in range(3)]
        torch.testing.assert_close(losses[0], 2 * losses[1])
        torch.testing.assert_close(losses[1], losses[2])

    def test_clear_path_retreat_loss_targets_only_the_forward_axis(self):
        states = torch.zeros(5, 4, bc.FEATURES)
        states[:, :, 5] = 1
        states[:, :, bc.OBSERVATIONS + 7] = .5
        states[1, -2, bc.OBSERVATIONS + 7] = 0  # just cleared a wall
        states[2, -1, bc.OBSERVATIONS + 7] = -1  # smoke
        states[3, -2, 5] = 0  # padded history
        controls = torch.ones(5, 3)
        controls[4, 2] = -.5  # teacher chose to retreat
        logits = torch.zeros(5, bc.OUTPUTS, requires_grad=True)
        with torch.no_grad():
            logits[:, 3] = -.5
        def gradient(inputs):
            return torch.autograd.grad(rl.search_imitation_loss(logits, controls, inputs), logits)[0]
        blocked = states.clone()
        blocked[:, -1, bc.OBSERVATIONS + 7] = 0
        difference = gradient(states) - gradient(blocked)
        self.assertLess(difference[0, 3].item(), 0)
        difference[0, 3] = 0
        self.assertEqual(torch.count_nonzero(difference).item(), 0)

    def test_rollout_anchors_use_distinct_observable_states(self):
        source = Path(__file__).resolve().parents[1] / "shared/directPolicy.json"
        policy = json.loads(source.read_bytes())
        states = torch.zeros(4, policy["context"], bc.FEATURES)
        states[1, -1, :4] = torch.tensor([1., 0., 0., 6 / 45])
        states[2, -1, :4] = torch.tensor([1., 0., 0., 23 / 45])
        states[3, -2, 0] = 1  # recently lost sight
        prior = torch.full((4, bc.OUTPUTS), 9.)
        search = rl.search_demonstrations(states, policy["rulesVersion"])
        self.assertEqual(rl.anchor_rollout_controls(prior, states, search, source), 1)
        incumbent = importlib.import_module("fit-match-movement").actor_from_json(policy)
        torch.testing.assert_close(prior[1], incumbent(states[1:2])[0])
        if search:
            torch.testing.assert_close(prior[0, 2:4], search[1][0, 1:3])
        self.assertTrue((prior[0, :2] == 9).all())
        self.assertTrue((prior[0, 4:] == 9).all())
        self.assertTrue((prior[2:] == 9).all())

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
