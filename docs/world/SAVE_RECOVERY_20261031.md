# World save recovery — 2026-10-31

The existing `parhelion.world.progress.v2` key and `{done, found}` schema remain unchanged. Controls, language, effects quality, cosmetics and Arena state are not part of a progress backup.

## Unreadable current data

A malformed current-slot record is retained byte-for-byte. Ordinary gameplay/autosave attempts stay in memory and do not overwrite it or revive older region flags. The persistent warning explicitly says the session is not saved. If the initial storage read fails, blind autosave is also blocked.

Settings offers separate downloads of current session progress and the exact unreadable original. Original data is an explicitly labeled `.utf16le` diagnostic Blob download (two little-endian bytes per localStorage UTF-16 code unit, no BOM), never inserted as HTML. This preserves even lone surrogate code units that a normal Blob string-to-UTF-8 conversion would replace. It is not directly importable by the JSON backup picker; ordinary valid progress backup/restore remains JSON. Replacement requires explicit confirmation, either with a validated backup or this session's progress. Storage is written before live progress changes or a reload is requested. A quota/read failure preserves original data and current session sets.

Repair compares the stored raw value with the expected value before the prompt and again immediately before writing. A newer tab's already changed value is rejected, rather than overwritten by a stale corrupt-save prompt. This is synchronous stale-value detection, **not atomic cross-process CAS**: browser localStorage exposes no transaction covering multiple tabs. No broad cross-tab merge or synchronization was added.

Explicit New Game retains its existing immediate gameplay-reset semantics. It authorizes replacement and retry after a storage failure; it is not an ordinary autosave or backup import. Malformed legacy records remain untouched by ordinary migration/saves unless the user explicitly resets.

## Evidence

27 focused persistence/panel/reset tests pass, including repeated blocked autosaves, exact original download, canceled replacement, quota failure, successful repair, changed-tab prompt rejection before and during confirmation, disposed controls, existing reset/armory/gate behavior. World typecheck passes. Browser reload itself is not established by JSDOM; actual-main import tests explicitly observe the accepted write/cancellation and expected navigation boundary.
