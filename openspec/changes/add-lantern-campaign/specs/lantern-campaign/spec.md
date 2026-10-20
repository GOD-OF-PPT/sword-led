## ADDED Requirements

### Requirement: Twelve authored commissions and visible story outcomes
The game SHALL provide the twelve commissions, three chapters and three endings in the v0.7 implementation document. Completion SHALL be computed from actual delivered blades, never from a presentation flag or total sale income alone.

#### Scenario: Two-blade commission
- **WHEN** a player delivers one qualifying blade for day eight
- **THEN** the main commission records one of two, and selling a second unqualified blade does not complete it

#### Scenario: Finale and surviving seals
- **WHEN** day twelve ends with surviving seals but any of days four, eight or twelve incomplete, or fewer than ten completed commissions
- **THEN** the game shows the incomplete-return ending and never claims that the twelve lights have been restored

### Requirement: Simple input and meaningful recipe differences
The game SHALL retain direct left-click strikes and SHALL implement the three distinct recipe tables, visible crack risks, six-charge safe burst and unique blade dispositions. The recipe SHALL be chosen before the first strike and immutable thereafter.

#### Scenario: Wrong recipe can still sell
- **WHEN** a blade fails the main commission's recipe condition
- **THEN** selling it still pays its genuine value but contributes no main commission progress

#### Scenario: Recipe already struck
- **WHEN** a recipe change is requested after the blade's first accepted strike
- **THEN** the request is rejected with no state, random or resource changes

### Requirement: Real chapter growth and bounded events
The game SHALL implement the three workshop modifications, six authored event outcomes, three merchant visits, six crafts and explicit costs/limits in the implementation document. A skipped event SHALL always remain an available choice before acceptance.

#### Scenario: Warm rack crosses a day once
- **WHEN** a reserved blade crosses to the next day with the warm-rack modification
- **THEN** it receives the single specified increase while retaining its crack and charge, and refreshing cannot repeat it

#### Scenario: Unaffordable choice
- **WHEN** a player cannot afford an event or merchant choice
- **THEN** the choice is unavailable, skipping remains possible, and no cost or partial reward is applied

### Requirement: No campaign gate depends on an unavailable old blade or random stock
The game SHALL loan required recipes during the main story and SHALL expose the specified new-blade alternatives for old-blade commissions. Random merchant stock SHALL NOT be a prerequisite for progression.

#### Scenario: No reserved blade on day five
- **WHEN** the player reaches day five without an eligible old blade
- **THEN** the visible new-blade alternative remains completable under the published condition

### Requirement: Idempotent collection progression and version isolation
The game SHALL use forge-v4/schema4 and independent main/backup keys while retaining v1/v2/v3 interpreters and saves. The collection profile SHALL contain only idempotent unlock and work sets, and a run's initial eligibility snapshot SHALL remain stable for replay.

#### Scenario: Profile write denied after a chapter
- **WHEN** the chapter's run save succeeds and the collection profile write fails
- **THEN** the run remains accepted, the profile failure and retry/export are visible, and recovery can derive missing unlocks from the valid run without issuing currency

#### Scenario: Returning to a legacy run
- **WHEN** the player selects a saved v3 run from the title
- **THEN** its original interpreter, length and random progression continue without conversion

### Requirement: Production scenes and actionable feedback
The game SHALL implement title, opening, workshop, merchant, chapter outcomes, events, collection and endings with actual content and original D assets. Important notices SHALL remain readable and offer a current legal next action or review route, without obscuring the blade or core controls.

#### Scenario: Reload during a chapter result
- **WHEN** a chapter reward has already been accepted and the player reloads
- **THEN** the game displays the saved outcome, offers continue, and does not replay or duplicate the reward

#### Scenario: Reduced motion
- **WHEN** reduced motion is active
- **THEN** chapter and forge results remain readable and operable through static outcome displays

### Requirement: Complete game acceptance
The release SHALL validate all published content through real commands and browser consumers, preserve old evidence identities, and meet the original goal's cross-browser, save recovery, source/art and final review requirements. Model success SHALL NOT replace human evaluation of story, growth or enjoyment.

#### Scenario: First chapter delivered
- **WHEN** only the first four days are implemented
- **THEN** the build is explicitly a production first-chapter slice and is not marked as the completed twelve-day game
