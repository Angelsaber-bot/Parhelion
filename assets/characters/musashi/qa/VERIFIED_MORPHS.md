# Actual facial deformation checks

Semantic labels were verified by actual one-hot Cycles inspection (not illustrations). Diagnostic images are retained locally, not included as final presentation renders. The final GLBs are additionally tested directly by `validate_morphs_sockets.mjs`:
- target_1: Angry
- target_5: Surprised (jaw and brows)
- target_13: Blink (both eyes fully close)
- target_14: BlinkRight (character's right)
- target_15: BlinkLeft (character's left)
- target_17: HappyEyes (upturned closed eyes)
- target_23: HideIrises (technical, not a natural expression)
- target_32: MouthOpenA

Build assigns these semantic names without changing their vertex deltas. Remaining
48 source morphs retain original generic names; semantic intent is not certified.
All 56 morphs have finite, nonzero geometric deltas. Do not blend arbitrary source
expressions at full strength without previewing the result.
