# Bilingual story-copy review — 2026-10-30

Scope: string fields only in `eraStories.ts`, `campaignClosure.ts`, and `valleyStory.ts`. No quest flags, ordering, conditions, state writes, interfaces, or reward effects changed. Original translation/conditional-state tests remain intact; none was weakened to accept the rewrites.

## Editorial changes

- **Britain:** the smith keeps unclaimed swords and asks after the names; the stable keeper describes waiting out a sweep in practical terms; the keeper ties the first hearth to the lake oath. Completion offers a quiet return to the memorial rather than listing optional flags.
- **Black Sail:** the clerk notices supply boats with no sailor rations; the inspector tells the player to save rifle ammunition for targets it can affect; the runner offers chart knowledge in exchange for the harbor light. Mainline instructions now name the cannon, three boats and bridge without explaining shard-gating code. Normal title translation now says “Extinguish,” not “Cut,” the lamp.
- **Winter:** the surgeon warns against numb fingers and preserves the exact thirty-second warmth advice in both languages; the quartermaster gives a three-beacon route for a stretcher party. The title becomes “Beacons in the Snow.” The completion line does not falsely claim every optional stove or legacy-save beacon was lit.
- **Kyoto:** the smith explains how banner signals move the army and why breaking them avoids more drawn blades. The innkeeper retains the verified south-gate/west-slope route. Completion offers tea and recalls the bridge promise rather than describing completion requirements.
- **Valley:** report guidance goes straight back through the side entrance to the archivist. The archivist acknowledges a manually opened door, offers equipment advice only when it is still needed, and describes sound wiring instead of explaining missing-part requirements.
- **Closing record:** the terminal archives four restored cores; residents speak about returning people, unfinished promises and rest. Removed explanations that filing a record does not dismiss companions or cancel flags. Earned memorial/signal/stove/lantern echoes remain strictly conditional; absent repairs are not claimed.

## Readability and truthfulness checklist

- [x] Resident dialogue has both Chinese and English, with no untranslated CJK in English.
- [x] Resident/optional response budget: <=95 Chinese characters and <=310 English characters per interaction (including appended next objective).
- [x] NPC speech avoids “main story,” “optional,” “completion condition,” “won’t reset,” and equivalent Chinese implementation language.
- [x] Optional status remains in UI labels and optional progress notices, not character exposition.
- [x] Main objectives retain concrete destinations and exact first-hearth / three-boat / three-beacon / three-banner instructions.
- [x] Partial completion notices retain `1/3` in both languages.
- [x] Warmth remains thirty seconds; Kyoto directions remain south gate, then west.
- [x] Repeated dialogue does not grant progress or re-credit a repair to the wrong person.
- [x] No borrowed franchise quotations or newly asserted historical facts were introduced.
- [x] Existing conditional translation assertions were preserved; five new focused copy tests were added.

Validation: 48 story/copy/state tests passed, plus TypeScript typecheck. This is a source-level editorial review. On-screen line wrapping, font size and dialogue timing still require browser visual review.
