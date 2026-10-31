# Preserved red checkpoint 82e89d3

Exact frozen source: `82e89d334b73bb88b90cca07465855692e2cc5a4`.
World: **1370 passed / 1399 total; 29 failed**. Fail-fast stopped before Arena/site/build; those stages were not run for this attempt. Source and failure logs remain unchanged. This is not an accepted green milestone.

## Individual failure groups and corrections
- **17 input tests (`input.test.ts`)**: the source-section delimiter extended beyond event registration into newly relocated reduced-effects preference initialization, causing `matchMedia` ReferenceError. The fixture now stops at that explicit preference boundary and supplies named boot/exit/graphics/servant-panel/frame-clock dependencies. Original input assertions remain; added negative cases prove blocked states really reject input.
- **5 travel tests (`safe-travel-runtime.test.ts`)**: the extracted functions reference new boot/exit/graphics guards absent from their VM scope. Explicit ready-state dependencies restore the intended normal fixture, with additional rejection-before-mutation checks for each blocked state.
- **2 shooting tests (`shooting-free-look.test.ts`)** and **1 story-input test (`valley-story-input.test.ts`)**: same absent guard dependencies. Actual barrel/grip/raycast/interaction assertions remain intact; story-input adds blocked guard cases.
- **1 boot rejection test (`load.test.ts`)**: absent final-exit/recovery dependencies, plus its error-text assertion still expected the old generic network-era title. It now executes the same production failure callback with explicit state and requires the current truthful loading-failure text, disposal, one retry, locale switching and functional reload.
- **1 resolution test (`render-settings-safety.test.ts`)**: a regex assumed renderer mutation was the first statement, rejecting the new safety guard. The test now executes the extracted production function: both renderer/composer update in ready state; each unsafe state suppresses mutation; no-composer mode still updates renderer. Existing monitor/resize integration assertions remain.
- **1 combat pool test**: accepted fixed Warden contact pool adds exactly three persistent hidden slots. Owner correction preserves the original 74-transient-child ceiling separately, asserts exact three identities/55,296 bytes across reset and empty scene on disposal; no transient bound widening.
- **1 localization template test**: a real missing exact translation for the new Arena cancel fallback produced partial English. One dictionary entry fixes it; no template exclusion or assertion weakening.

Corrected integration harness tranche passes 35 tests including new guard cases. Combat owner reports 12/12; full localization suite 8/8. These are focused results, not a substitute for a new exact-source full aggregate.
