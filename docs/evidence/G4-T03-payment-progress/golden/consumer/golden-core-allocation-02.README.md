# Version02 consumer correction — UNEXECUTED

Actual version01 stopped after4,898 compared steps,25 paths,31 checkpoints and96 ownership rows, at the consumer assertion that the first accepted buy must have three equipped traits. That assumption was false: the first accepted buy had zero traits. The original candidate/README are preserved byte for byte as `golden-core-allocation-01.original.mjs` and `.original.README.md`; original01 run evidence and original candidate paths are unchanged.

Version02 changes only representative selection: pairedStep additionally records the first actually accepted buy whose before-state has exactly three traits as `buy-full-slot`; the invalid-replacement test uses that specific representative and still asserts its real three-slot boundary. The ordinary accepted-buy ownership test still uses the first buy. No quote, state, error, threshold, corpus, SDK or domain result is changed. No version02 SDK import, syntax check, replay, browser or build has been executed by this author.

The original executable instructions follow, with version02 filenames/output identity.

# Golden core allocation candidate — UNEXECUTED

This is an isolated executable draft, written without importing either SDK, running a producer/replay/browser/build, decoding PNGs or changing source/tests/config/dist/harness. Root owns activation and execution after the active freeze ends. The draft uses Node built-ins and the two built SDK modules directly; it imports no Playwright helpers and no TypeScript.

From the repository root, only after authorization and a real new core build:

```sh
rtk proxy node tmp/goal4-T03/drafts/golden-core-allocation-02.mjs --old tmp/goal4-T03/runtime-build-11 --new dist --out tmp/goal4-T03/runs/golden-core-allocation-02
```

The output directory must be new and beneath repository `tmp/`; existing output is never overwritten. Old and new directories must differ. The old v5 golden is bound to build11 SHA256 `77f420f6c1e897f6c6167b636f882f7340a92df81f565b7c7e17d3780cd042cc` (93,848 bytes). The candidate deliberately rejects an unchanged `sword-led-v5.js`, requires the other eight SDK/shared JS files to remain byte-identical, records all nine module identities, and rechecks every read input's hash (including this script) at the end. All referenced source files are read-only. A future intentional additional SDK change needs a reviewed, versioned exception; do not silently weaken this guard.

## Fixed finite sources

- Published `docs/evidence/T11-4-2-3l1/journeys/victory.json`: full142-command story guide.
- Actual G4-T02 Chromium DPR1 mixed-return and pure-keyboard-defeat `v5-states.json[.gz]`: real completed story alternatives.
- Actual G4-T02 Chromium DPR1 `v5-keyboard-current-v5-fre-*` states: preceding story victory, its persisted collection, exact earned-challenge opening qualification and the full reordered challenge conclusion. It asserts that challenge `initialEligibility` comes from the preceding actual story book; it does not inject eligibility or call challenge opening a full run.
- Four bounded actual G4-T02 interaction cases (borrowed recipe, full-slot barter, delayed gift, cash purchase) plus exactly twelve actual six-event accept/decline cases. Each case's unique maximal journal leaves are replayed; shorter duplicate prefixes are omitted, while forks are retained. At most eight leaves per selected case are allowed. It does not run all384 browser consumers or a seed/model sweep.
- Actual `forge-perf-preflight-02/...pressure-long...firefox-dpr2/native-pressure-long-1280-pointer.json` source at1890.
- Actual `pressure-response-02/...legitimate...chromium-dpr1/legal-soft-limit.json`: qualified1898, soft1900, actual main delivery, ordinary sale, recovery and final bounded exit. The replay's selected prefix states must equal the archived intermediate states, not merely have equal journal lengths.
- One exact finite legal recipe already present in `tests/core/v5-economy.test.ts` (`v5-purse-0`, continue/three first-piece strikes/main delivery/four spare strikes/ordinary sale) supplies the real zero-purse rejection and explicit zero recovery. This is a fixed existing test route; no outcomes, wallet, RNG or phase are assigned.
- Explicitly negative2049-journal envelope is compared through original `validateRun` and `decodeV5Save`, including their actual error/detail text. It is never called a legal boundary.

The script resolves actual short artifact names deterministically and requires one matching source for each named interaction/full-run category and exactly twelve event sources. Missing files/coverage fail with partial evidence; there is no substitute fixture, silent omission or fallback policy.

## Assertions and outputs

Every replayed edge runs old/new `applyCommand` against separately owned state, compares the complete `CommandResult` including full state/journal/RNG/events, compares the complete public view, checks unchanged caller and command bytes, checks accepted deep immutability and new state/journal ownership, and checks failure original-state identity. All fourteen Action variants and all six event accept/decline branches are required. `command-results.jsonl` records actual actions and full-result/state/RNG/event hashes.

Declared checkpoints call both actual complete validators, both official run repositories and decoders, `collectionFromRun`, both collection repositories/decoders and actual qualification APIs. Serialization uses an identical fixed clock so raw JSON and error/export strings are directly comparable. Existing archived raw saves/books are also decoded by both SDKs and compared with their recorded full states. Actual book state and calculated current-run awards are kept distinct: inherited book growth is not silently treated as the current run's exact awards.

For one representative of every accepted Action plus near-limit and zero-price cases, both SDKs receive independently constructed deep-frozen, fully mutable and mixed frozen/mutable-prefix callers. Caller bytes and recursive freeze flags must stay unchanged, accepted output must be recursively frozen, and no output node may alias a mutable caller/command node. Deliberately mutating the caller body, mutable history Action and command after acceptance must not change the output. Frozen-prefix counts and actual shared identities are recorded for both implementations; the new candidate must actually reuse all already frozen Action entries, while mutable prefix nodes must be detached. This sharing assertion checks the explicitly proposed allocation change and does not claim the public API generally guarantees reference sharing. Failure checks retain `result.state === caller`, empty events and unchanged input bytes/freeze flags. The failure set includes wrong rules/run/revision/phase, malformed nested command, missing/reserved piece, locked/unchanged recipe, no shop, invalid replacement, zero-price sale and soft-limit strike. Getter input must be rejected without invoking it; illegal nested historical Action must still fail full validation equally.

`result.json` contains actual counts, per-path/checkpoint/ownership results, source/module SHA256s and final input-byte integrity. `failure.json`, partial `checkpoints.json` and the append-only command log survive a failed run. Exit0 only means this finite semantic/allocation comparison passed; the original page pressure-load/response/frame budgets, browser lifecycle, pixels, old shared legacy smoke and H still need their own actual evidence.

The proposed optimization still copies/traverses an O(n) prefix per accepted command, so whole replay remains O(n²). This script neither certifies a linear algorithm nor proves any isolated speedup or3000ms page-load result. It must not remove or replace the existing upper/MO load gates or any original red.
