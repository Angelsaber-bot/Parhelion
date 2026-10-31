# World resume clock boundary

## Reproduced defect
A real courier had 49.999 ms remaining in its windup when the document became hidden. With no animation frames while hidden, returning after 60 seconds charged the first visible frame the normal 100 ms clamp: the player immediately lost 12 HP before any new visible time elapsed. The regression uses a declared encounter-entry fixture, not edited enemy clocks/HP or fake damage.

## Narrow correction
Visibility, focus/blur, pointer-lock changes and graphics-recovery transitions invalidate the next World frame's clock. That first frame uses zero elapsed simulation time and clears only the main fixed-step remainder. Subsequent visible elapsed time is preserved, including the existing 100 ms clamp for an ordinary active long frame. Enemy AI's separate 20 Hz accumulator retains already-earned visible fractional time; it is not reset or conflated with the 120 Hz player/action clock.

Existing input clearing, pause/menu rendering/physical-settling choices, accepted action cancellation and cooldown rules are unchanged. No Arena network or authoritative match timing code changes.

## Tests
Actual-main tests cover hidden→visible without RAF, blur/focus, pointer-lock loss/reacquisition, settings pause/resume, explicit graphics recovery, repeated same-task transitions, action cooldown remaining, subsequent visible fixed steps and the active long-frame clamp. A second test proves a native paid Saber cinematic neither skips ahead nor contacts during a hidden interval, then still reaches original contact when visible time resumes. Entry position/full charge are explicit compatibility fixtures; rendering is mocked, not GPU recovery or FPS evidence.
