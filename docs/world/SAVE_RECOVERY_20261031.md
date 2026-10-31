# World save recovery — 2026-10-31

The existing `parhelion.world.progress.v2` key and `{done, found}` schema remain unchanged. Controls, language, effects quality, cosmetics and Arena state are not part of a progress backup.

## Unreadable current data

A malformed or partially malformed current-slot record is retained byte-for-byte. Recoverable valid current flags are still loaded; malformed known `done`/`found` entries or fields require explicit repair before normalization. Unknown flag strings, duplicates, missing optional arrays and newer extra fields are not classified as corruption. Permissive legacy migration is unchanged. Ordinary gameplay/autosave attempts stay in memory and do not overwrite it or revive older region flags. The persistent warning explicitly says the session is not saved. If the initial storage read fails, blind autosave is also blocked.

Settings offers separate downloads of current session progress and the exact unreadable original. Original data is an explicitly labeled `.utf16le` diagnostic Blob download (two little-endian bytes per localStorage UTF-16 code unit, no BOM), never inserted as HTML. This preserves even lone surrogate code units that a normal Blob string-to-UTF-8 conversion would replace. It is not directly importable by the JSON backup picker; ordinary valid progress backup/restore remains JSON. Replacement requires explicit confirmation, either with a validated backup or this session's progress. Storage is written before live progress changes or a reload is requested. A quota/read failure preserves original data and current session sets.

Repair compares the stored raw value with the expected value before the prompt and again immediately before writing. A newer tab's already changed value is rejected, rather than overwritten by a stale corrupt-save prompt. This is synchronous stale-value detection, **not atomic cross-process CAS**: browser localStorage exposes no transaction covering multiple tabs. No broad cross-tab merge or synchronization was added.

Explicit New Game retains its existing immediate gameplay-reset semantics. It authorizes replacement and retry after a storage failure; it is not an ordinary autosave or backup import. Malformed legacy records remain untouched by ordinary migration/saves unless the user explicitly resets.

## Evidence

29 focused persistence/panel/reset tests pass, including repeated blocked autosaves, exact original download, canceled replacement, quota failure, successful repair, changed-tab prompt rejection before and during confirmation, disposed controls, existing reset/armory/gate behavior. World typecheck passes. Browser reload itself is not established by JSDOM; actual-main import tests explicitly observe the accepted write/cancellation and expected navigation boundary.

## Incomplete legacy reads and accepted-import navigation (09:03 follow-up)

When v2 is absent, an exception reading either legacy region now prevents an
automatic partial migration. Readable sibling flags remain available in memory,
but neither legacy record is deleted and no new authoritative v2 is written.
Reloading can retry all reads; export current session progress before leaving if
you have played since the failed read. A successful later read migrates both
regions; quota failure still preserves both originals. Explicit confirmed reset
or replacement retains its existing authority. The UI distinguishes unavailable
original bytes from malformed bytes that can actually be downloaded, and warns
that replacing with a partial session may omit unread quests.

A successful backup import commits storage before changing live flag sets. The
old World session is now terminal while waiting for reload: input, rendering,
simulation and quest confirmations cannot resume against its old scene. A
truthful saved/waiting message and explicit Reload button remain if navigation
does not occur. Navigation exceptions do not change successful storage into an
"invalid backup" result. Context-restored events cannot revive this retired
session; normal final-page-exit resource cleanup is still idempotent.

Evidence includes both legacy-read orderings, exact original bytes, successful
reread, quota and rejected-replacement tests; actual-main no-op/throwing reload,
failed-write non-retirement, delayed old file reads, repeated controls, context
events and final disposal. Independent reproduction changed post-import movement
from 2.75 m to zero under an intentionally unavailable-navigation boundary.
This does not assert that ordinary supported browsers routinely fail to reload.
All stored data used for these checks was synthetic cloud-test data.

### Known-absent current-slot repair guard

If the initial v2 read succeeded with no record but legacy migration was incomplete,
that absence is retained as the session-repair baseline. A later value written by
another tab is rejected before the partial-session replacement prompt; the UI asks
for a session backup, reload and review. A change during confirmation is still
rejected by the existing compare-before-write guard. This is not atomic cross-tab
CAS. An initial v2 read exception remains unknown, not falsely treated as absent.
Deliberate backup import and explicit reset retain their separate authority.

Regression cases cover pre-prompt/during-confirm changes, unchanged-null repair,
read failure, quota failure, byte-identical legacy preservation and intentional
import/reset. The original pre-fix prompt failure is retained in cloud evidence.
