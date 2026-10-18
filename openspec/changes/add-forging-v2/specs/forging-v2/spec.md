## ADDED Requirements

### Requirement: Versioned forging campaign
The system SHALL create forge-v2/schema2 campaigns with twelve rounds, three incoming blanks per round, three initial seals, merchant visits after rounds 3/6/9 and the approved v0.3 rule tables. It SHALL retain explicit access to existing v1 saves without converting or overwriting them.

#### Scenario: New and legacy campaigns coexist
- **GIVEN** a valid forge-v1 save exists
- **WHEN** the player starts v2
- **THEN** v2 uses a separate save identity, v1 remains readable/continuable/exportable, and both modes share the writer-ownership boundary.

### Requirement: Spatial strike and visible damage
The system SHALL expose five blade sections with edge/spine targets, finite node capacity, three hammer costs, timing effects and deterministic stress thresholds as specified in the v0.3 proposal. Preview and settlement SHALL use the same rules.

#### Scenario: Precision and cold-work threshold
- **GIVEN** an active v2 blank and a selected legal target
- **WHEN** the player releases a strike
- **THEN** the timing grade determines exact yield/stress, low-heat cost is included, thresholds deduct integrity, and no additional random damage roll occurs.

#### Scenario: Invalid or cancelled strike
- **GIVEN** insufficient heat, capacity, a stale input ticket, pause or focus loss
- **WHEN** input is rejected or cancelled
- **THEN** it grants no yield, consumes no resource and does not advance random state.

### Requirement: Bounded forging patterns and reheating
The system SHALL reward three distinct adjacent successful targets according to edge/spine/bridge patterns, with non-overlapping groups and each pattern rewarded once per piece. Reheating SHALL consume finite coal without resetting node capacity or earned rewards.

#### Scenario: Repeat cannot farm a pattern
- **GIVEN** a pattern has already been awarded
- **WHEN** a player repeats a target, breaks the chain, reheats or forms that pattern again
- **THEN** no duplicate pattern reward is issued and the view explains remaining legal choices.

### Requirement: Quench and observable sword performance
The system SHALL support irreversible water/oil quenching with exact visible consequences, and a free read-only replay of three tests derived from the real sword's sharpness/toughness/balance. Piece snapshots SHALL retain appearance and terminal disposition in the campaign work collection.

#### Scenario: Trial is not a reward command
- **GIVEN** a quenched sword or its archived snapshot
- **WHEN** the player repeats a trial or reloads its view
- **THEN** displayed performance matches saved stats and no currency, request reward, random draw or journal entry is created.

### Requirement: Requests and delayed customer consequence
The system SHALL offer two optional requests per round, accept at most one before committing round production, grant a qualifying quenched sword's request reward once, and retain a once-only customer return keyed to that sword.

#### Scenario: A request completes once
- **GIVEN** a matching quenched sword and an accepted request
- **WHEN** delivery is confirmed
- **THEN** market and capped request rewards are settled atomically, the sword becomes unavailable for resale, and its saved customer return occurs two rounds later or at the twelve-round ending; an early defeat does not pay future visits.

### Requirement: Limited credit and complete economy
The system SHALL distinguish new delivered value, original quota and previous-round credit; award currency only for new deliveries; cap next-round credit at 25 percent of the next quota and derive it from half the new surplus only. Salvage, breakage, settlement, seal loss and victory/defeat SHALL be one-time transitions.

#### Scenario: Prior credit cannot compound
- **GIVEN** the previous round granted credit
- **WHEN** the player settles the current round
- **THEN** old credit contributes to meeting that round only, is not paid as gold and is excluded from computing the next credit.

### Requirement: Meaningful and finite technique builds
The system SHALL offer a free initial technique, six documented technique effects, at most three active slots, seeded merchant candidates and one-time repair limits. Purchases/replacements SHALL be atomic with exact costs and activation counters shown.

#### Scenario: Cancelled replacement keeps the old build
- **GIVEN** all three slots are occupied
- **WHEN** replacement is cancelled or cannot be afforded
- **THEN** the previous technique and currencies remain intact.

### Requirement: Published round conditions and replay
The system SHALL publish seeded round conditions before production, preserve orders/events/materials/technique candidates across reload, and validate accepted commands by deterministic replay. View-only selection and trials SHALL not resample conditions.

#### Scenario: Restore the same unfinished sword
- **GIVEN** an accepted strike, pattern, quench or purchase was saved
- **WHEN** a writer session restores it
- **THEN** all capacities, counters, rewards, conditions and future random positions match, and stale animation/input cannot modify the restored campaign.

### Requirement: D art direction and playable review
The system SHALL use the user's preferred D art direction with separate runtime assets and editable DOM controls. Real blade state SHALL drive its five-section silhouette, ten targets and forging trails. The delivered campaign SHALL retain keyboard, pause, slow timing, reduced motion, audio and failure-recovery paths.

#### Scenario: Three-round validation precedes completion claims
- **GIVEN** a v2 playable slice or final candidate
- **WHEN** it is reviewed
- **THEN** actual player choices and sword outcomes are inspected at both desktop sizes and DPR2, user feedback is recorded separately from technical checks, and neither concept art nor a partial slice is declared a completed twelve-round game.
