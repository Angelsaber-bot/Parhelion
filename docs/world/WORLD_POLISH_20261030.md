# World gameplay and craft polish — 2026-10-30

Incremental improvement over `b3a230c62d8271f4c04baebb6e2a8f55c1e050de`. The five-region layout, existing map boundaries and Arena runtime are unchanged. This is not a claim that the entire game has reached final commercial quality.

## What changes for the player

- Residents acknowledge repaired facilities and chapter progress. The Black Sail runner can restore an earned treasure clue; the Kyoto innkeeper can restore the optional quiet route. Neither grants remote repairs, warmth or duplicate rewards. Obsolete optional guidance disappears after its purpose is complete.
- The closing record can be read again and reflects optional work completed later. Long bilingual dialogue advances in paired pages; long single paragraphs can be read in bounded sections without truncation. Menu/focus interruptions dismiss the whole conversation safely.
- Melee HUD shows the actual chain-input window and confirms a queued follow-up. Repeated taps no longer replay the queue sound. Equipment, loading failures, cooldowns, airborne restrictions and ultimate energy have distinct readiness states. Action input refreshes the HUD on the next frame rather than waiting for its normal presentation interval.
- A natural melee counter window is shown with a cyan health bar and explicit ×2 feedback. Forced interruption is distinguished from a counter window. Boss instructions match the actual attack shape instead of telling the player to shoot a nonexistent special weak point.
- Winter and Kyoto bosses use their existing long thrust in the previously underused 6–7.5 m band, with their established rhythm, locked direction and warning. No HP or damage inflation. Skill preview/contact geometry uses the same validated normalized corridor as actual targeting.
- Consecutive hits share one bounded hit-marker timer; an older timeout cannot erase a more recent hit. Pausing, resetting and disposing clear the marker.
- Normal swimming and gliding advance paid skill cooldowns while attacks remain disabled. Menus still pause those clocks. Exiting the servant viewer through Esc no longer leaves movement secretly disabled after re-entry.
- Travel panels preserve keyboard focus during refresh/rejection and return it safely when closed, without stealing focus from another dialog.

## Art and performance

Four existing optional facilities receive distinct craft details, restrained deterministic surface maps and clearer saved-state appearance. Each retains seven material draws, no lights and no shadow casters. All four collision geometry hashes are unchanged. Total new texture storage including complete mip chains is 426.64 KiB.

See [matched offline comparisons](../../world/validation/era-scenes-polish/README.md). These are Blender CPU inspections of actual source geometry/materials, not screenshots of the game or evidence of browser frame rate.

The guarded static-art traversal optimization preserves dynamic actors, explicit world-matrix queries and changed topology. Two same-scene CPU checks measured approximately 0.16–0.21 ms less work per matrix pass (0.634 → 0.425 ms and final 0.567 → 0.405 ms), with approximately 3.76 MiB additional bookkeeping heap. See the [bounded performance report and raw measurements](validation/POLISH_STATIC_TRAVERSAL_20261030.md). No whole-frame percentage or FPS improvement is claimed; CPU proxy timings are not GPU frame-rate measurements.

A separate [whole-iteration CPU regression screen](validation/polish-integration-cpu/README.md) compared the previous release with this final tree in alternating fresh processes. It found no consistent large CPU regression; Kyoto p95 was slightly worse and cloud variance was retained rather than hidden. This is not FPS evidence.

## Verification boundaries

Production DOM tests execute the real main module, event handlers, GLBs, collisions and gameplay state with an explicitly stubbed renderer. Four-chapter flow checks use test positioning and decisive damage to shorten travel and combat; separate capsule/real-terrain tests cover movement and attack avoidance. They are not a human playthrough.

Repeated-flow checks cover 60 combinations of settings, dialogue, maps, travel, language, cancelled resets and paid skill state. A separate [five-loop cross-region resource soak](validation/polish-cross-region-soak-20261030.json) found stable scene identities after warmup, no accumulating NPC/character roots and no late rejected promises. This does not measure GPU memory. Real GPU rendering, browser permission behavior and the user's Mac FPS remain unverified. No promise of 60 or 120 FPS is made.

Final aggregate validation passed: **World 856/856 on Node 22.22.2 and Node 24.22.1; Arena 322/322 on Node 22; site 13/13; whole-site build and both client typechecks**. Build ID: `6a86a5948b45`. Runtime/test hashes remained unchanged throughout the final run. See [validation metadata](validation/polish-final-validation-20261030.json) and the [976-file source manifest](validation/polish-source-manifest-20261030.sha256).

## 中文试玩路线

不必重置存档。已有进度会继续生效。

1. 回到四个地区的居民点，修好设施后再次交谈。居民现在会回应你的实际成果，已完成的藏宝和断旗目标不会反复催促。
2. 在京都或永冬 Boss 战保持中距离，观察直刺预警后侧移，再靠近抓住青色血条标出的近战 ×2 窗口。琥珀色“打断”不是同一种奖励窗口。
3. 近战第一、二斩的技能栏出现“再按一次衔接”时按自己的近战键；“已衔接下一斩”表示输入已记住，不需连续乱按。
4. 长归档按当前互动键逐页阅读；Esc 返回菜单后可重新完整阅读。查看从者后 Esc 重进也不会残留移动锁。
5. 游泳、滑翔期间技能冷却正常流逝；打开地图、设置或对话仍暂停。旅行不恢复技能冷却或生命。

这份说明描述的是增量打磨。离线材质图和自动化测试不替代真实浏览器画质、角色动作观感与设备 FPS 验收。
