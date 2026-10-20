# forge-v4 model evidence

This archive contains the original complete 30,000-case production and the separate independent 30,000-case audit. The 60-case preflight is retained separately. Selected feature witnesses were replayed an additional 13 times by the SDK and 13 times by auditRecord; this is not a third complete 30,000-case replay. Missing coverage and the rest-event consumption exemption are retained without inventing witnesses.

## Reproduction paths

The source execution identity is commit 13538b01dd3053f5befb09fd22a4ed446f5a6dc0. Restore that complete commit into a separate checkout. The frozen source map is in validation/model-source-commit.json, and the full original source/build fingerprints are in formal/baseline.json. The ten original frozen files are in frozen-tools/ with their logical paths in its original index; reproduction/source/ repeats those bytes at their original repository paths and includes the fingerprint helper, qualification and approved inputs. The four actual v4 SDK dependency modules are in reproduction/runtime/. These four modules are not the complete 75-file web build. Restore or deterministically rebuild and verify the complete original dist and every frozen input before invoking the original audit, because its physical fingerprint check deliberately covers the complete source/build.

Archive tools are evidence snapshots, not directly runnable from their renamed archive locations. Place source files at their original logical paths in the restored checkout, restore SDK modules under dist/, and run the original scripts from that checkout. For the collector snapshot, restore it to tmp/T11-4-2-3i6/collect-model.mjs or pass an explicit --root <restored checkout> --out <fresh directory>. Its relative defaults are valid only at the original tmp location. The process wrapper also originally ran at tmp/T11-4-2-3i6/run-process.mjs.

Original commands and actual terminal receipts are in process/. For a new audit use node scripts/audit-v4-model.mjs --input <copied complete formal dataset> --out <fresh audit.json> --seeds 1000 --workers 6 from the restored checkout; audit output must not already exist. A new production experiment needs a new output path; do not overwrite this archive.

The original 18-test TAP is validation/node-unit-final.log. The separate auditor 8-test observation in validation/audit-node-unit-final-observed-receipt.json is explicitly not raw TAP. Publication of this artifact does not prove human enjoyment, final browser acceptance or whole-goal completion.

## Machine completion gate

Require collector exit 0, no COLLECTION-FAILED.json, a complete COMPLETED.json with validationComplete=true, matching manifest/index hashes, and every indexed file hash. Manifest or index alone never means success. Both manifest.json and artifact-index.json deliberately retain validationComplete=false: only the final atomically published COMPLETED.json seals them. A .partial receipt, an absent receipt, any failed process exit, or COLLECTION-FAILED.json invalidates collection. The final receipt is written only after all copies, manifests, hashes and index are complete; its temporary file is synced and closed before atomic publication.
