## ADDED Requirements

### Requirement: Direct forging and immediate value
The new mode SHALL start with a usable blade and accept one strike intent without node, hammer, timing or quench selection. Each accepted strike SHALL expose its actual price delta, result and next risk from the formal state.

#### Scenario: First contact
- **WHEN** a fresh run starts and the player clicks the primary hammer or releases Space once
- **THEN** one ordinary strike is accepted, one formal draw is consumed, the current blade value changes immediately and the same result drives visual/audio feedback
- **AND** mixed input, repeats and rejected stale identities cannot produce extra outcomes

#### Scenario: Ordinary growth
- **WHEN** base40 receives three ordinary successes
- **THEN** its visible values are58,84,121 without a separate processing gate

### Requirement: Public damage and atomic burst
The system SHALL use the integer1000-ticket pools, damage schedule, two-stage crack and six-charge safe burst in the v0.4 proposal. Ordinary hit count SHALL persist through storage and burst; any cap SHALL stop ineffective draws.

#### Scenario: Crack then break
- **WHEN** an intact175-value blade receives its first crack result
- **THEN** it remains usable at140 with a visible crack, and a later crack breaks it and pays only the defined base recovery once

#### Scenario: Burst and return to risk
- **WHEN** six surviving ordinary hits fill charge and the next primary action is accepted
- **THEN** two safe draws are atomically resolved, or three with Furnace Ember, charge resets and prior ordinary hit count and crack remain
- **AND** the primary UI identifies the safe action separately from the subsequent ordinary risk

#### Scenario: Background during effects
- **WHEN** the page hides or reloads after an accepted burst
- **THEN** all accepted outcomes survive, no result is redrawn, and late effects are canceled

### Requirement: Finite blades and exclusive destinations
The system SHALL provide exactly three fresh blades per round, at most one carried blade, and exclusive delivered/recycled/broken/traded destinations. Reserving SHALL only change a reference to an existing usable piece.

#### Scenario: Insurance without duplication
- **WHEN** the player stores or swaps the one reserve and later retrieves it
- **THEN** pieceId, value, crack, hit count and charge remain unchanged with no draw or payment

#### Scenario: One blade cannot pay twice
- **WHEN** a blade is delivered or traded
- **THEN** it permanently leaves usable inventory and cannot also provide recovery or another purchase
- **AND** delivery adds its full value once to current quota and wallet, while recovery never adds quota

### Requirement: Contract settlement and playable boundary
The system SHALL retain twelve rounds, three initial seals and one settlement per round; shortfall SHALL lose one seal except for the defined unused equipped protection. Missing tribute SHALL not reduce future supply. The first playable slice SHALL explicitly end after round3.

#### Scenario: Early close
- **WHEN** the player requests early settlement
- **THEN** confirmation lists delivered quota, each unreserved recovery, retained reserve and seal consequence before one atomic settlement

#### Scenario: Third failure
- **WHEN** a third unprotected shortfall consumes the final seal
- **THEN** failure is shown and no further supply or merchant reward is created

#### Scenario: Three-round experience
- **WHEN** round3 finishes with a seal remaining in slice mode
- **THEN** the page shows experience completion and actual results, with restart/return/export rather than a false twelve-round victory or access to unfinished rounds

### Requirement: Legible build investment
The system SHALL offer the defined optional one-time gift after first quota completion and two distinct saved unowned merchant offers during rounds3/6/9. Traits SHALL have the defined single effects, at most three slots, and visible actual trigger attribution.

#### Scenario: Shop while swords remain
- **WHEN** fresh supply arrives in round3
- **THEN** the merchant is available during forging and accepts the explicitly selected usable blade for one trait
- **AND** closing/reopening never rerolls the offer or spends the reserve automatically

#### Scenario: Full slots and cancel
- **WHEN** an acquisition requires replacement
- **THEN** old/new effects and consumed blade are compared before atomic confirmation, and cancel changes neither inventory nor equipment

#### Scenario: Upgrade is future growth
- **WHEN** the round3 upgrade is bought for180 coins
- **THEN** current blades keep their original base while subsequent fresh supply base doubles, with one purchase per visit

#### Scenario: Protection and inheritance are finite
- **WHEN** protection has been used or a break creates inherited value
- **THEN** unequip/rebuy cannot reset the run-level used flag, and inheritance applies once to the next supply's first blade within the defined cap

### Requirement: New identity and legacy continuity
The system SHALL isolate forge-v3/schema3 in its own primary/backup keys, reuse the current writer lease and error recovery contract, and preserve v1/v2 interpreters and entry points.

#### Scenario: Reload identical run
- **WHEN** a valid v3 save is reloaded and the same next command is applied
- **THEN** formal replay validates the whole state and produces the same random result without changing v1/v2 save bytes

#### Scenario: Unreadable or concurrent save
- **WHEN** a v3 save cannot be read, written or exclusively owned
- **THEN** existing recovery/export/read-only or explicit unsaved-play exits remain available and no other mode's save is overwritten

### Requirement: Effects serve the decision
The interface SHALL reuse the approved D style and place current value, delta, next action risk, crack and quota deficit near the blade. Effects SHALL consume accepted identity, respect mute/reduced motion and never settle resources themselves.

#### Scenario: Distinct actual results
- **WHEN** success, Great, crack, break or burst is accepted
- **THEN** the blade, result text and value visibly agree with the formal outcome, with distinct restrained effects and a clear next action
- **AND** loading an old accepted event does not replay a reward

#### Scenario: Desktop and keyboard
- **WHEN** the player uses mouse or keyboard at1280×720 or1920×1080
- **THEN** primary action, risk, quota, stop and destination controls remain readable and reachable without instructions covering them
