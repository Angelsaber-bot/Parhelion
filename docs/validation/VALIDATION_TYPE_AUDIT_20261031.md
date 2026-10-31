# Bounded validation typing audit (09:42 UTC)

The configured World typecheck includes `src` and `tools`, **not** `validation`.
Arena's configured check includes its tests, and also checks the Worker project.
These configured checks passed before frozen `e7b660e` was created. This note does
not claim a new test-inclusive World build contract.

An additional strict diagnostic configuration sampled 414 tracked World validation
files, including their imports, with existing dependencies and no declaration
stubs. The same diagnostic settings on original `9c6cd86` sampled its 228 tracked
validation files. Original source produced **82** diagnostics; the initial current
sample produced **124**. Normalizing only absolute workspace paths gives 42 added
diagnostics, not 42 established gameplay defects.

## Classification and targeted corrections

- Eleven added diagnostics were new test imports encountering the same absent
  `jsdom` declarations already present in the baseline. No blanket declaration,
  `any` suppression, dependency installation or tsconfig migration was introduced.
- Other added diagnostics concerned precise Storage callback types, nullable
  skeleton matrices, BufferAttribute/interleaved union narrowing, audit result
  union shapes, mesh/material callback parameter types, and Node assert narrowing
  a mutable callback array to `never[]`. Owners supplied explicit known types or
  positive assertions without removing behavioral checks.
- Two animation tooling/test calls used inaccurate arity: `updateWorldMatrix`
  omitted the child-update argument, and a BVH triangle call supplied an optional
  third logging argument absent from the installed declaration. These were
  corrected against the actual APIs, not guessed from the compiler message.
- One inherited fixture's unannotated `this` receiver was also corrected.

Rechecking the **same 414-file sample** after those targeted changes produced
**92** diagnostics: 81 remaining baseline diagnostics and the eleven additional
missing-jsdom-declaration diagnostics. This sample is not an assertion that later
new test files have all been strictly typed. The extra diagnostic run remains red;
the original 82-diagnostic baseline is retained, not hidden or redefined.

Six scene audit/test files plus the travel-result annotation have identical emitted
JavaScript before and after typing changes (esbuild syntax-normalized, without
identifier minification). The associated scene suites passed 33 tests; storage,
panel, animation exporter and native-animation suites were separately rerun by
owners. Runtime aggregate acceptance still requires the frozen full-suite result.
