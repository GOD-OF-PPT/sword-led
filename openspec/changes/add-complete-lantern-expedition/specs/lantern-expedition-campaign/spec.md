## ADDED Requirements

### Requirement: Complete authored campaign
The system SHALL deliver the complete three-chapter, nine-node lantern expedition described by the approved campaign contract, including an opening promise, distinct road objectives, midgame shelter conflict, final relay and a real ending. It SHALL NOT label the existing short v6 tutorial, nine identical guard fights or a design storyboard as that implementation.

#### Scenario: Continuous journey
- **WHEN** the player completes an intermediate node
- **THEN** the same journey SHALL continue with its weapons, wear, tool, currency and story consequences rather than restart a tutorial

#### Scenario: Closure
- **WHEN** the player finishes the mother-lamp objective, explicitly evacuates or accepts exhausted failure
- **THEN** the system SHALL produce the corresponding complete ending with actual character and world facts

### Requirement: Stateful crafting and ownership
The simulation SHALL own ordinary and active-technique forging, finite chapter supply, two owned weapon slots, persistent wear and irreversible donation or destruction. Ordinary forging SHALL be usable without a mandatory school-selection ceremony. Complete crafting and ownership values SHALL follow the campaign contract.

#### Scenario: Weapon leaves the rack
- **WHEN** a real owned blade is donated to shelter, companion or mother lamp
- **THEN** it SHALL leave player ownership and SHALL NOT remain selectable or claim another use

#### Scenario: Exhausted fissure blade
- **WHEN** actual fissure strike wear reduces strength to zero
- **THEN** the blade SHALL break and SHALL NOT provide unlimited zero-strength attacks

### Requirement: Visible actionable encounters
The simulation SHALL resolve two actions per round, disclosed threat or environment pressure, guard and opening, target constraints and the contract-specific encounter goals. Reading, pause and invalid input SHALL NOT advance rounds or consume resources.

#### Scenario: Target and round resolution
- **WHEN** a valid player action completes an objective
- **THEN** completion SHALL resolve before subsequent enemy or environment pressure, and repeated UI callbacks SHALL NOT repeat the result

#### Scenario: Different road problems
- **WHEN** bridge, escort, station, shelter, gap, relay or mother-lamp nodes are active
- **THEN** their stated physical objectives and alternatives SHALL be executable rather than only narrative labels on a guard fight

### Requirement: Persistent earned growth
Earned tools SHALL have the persistent and upgraded behavior in the contract, including actual manually targeted rebound, truthful capped recharge and optional field tempering. Camps SHALL spend real finite currency and trade real ownership; rewards SHALL NOT terminate the journey in a fixed tool demonstration.

#### Scenario: Tool continues after acquisition
- **WHEN** a tool is acquired at the bridge
- **THEN** it SHALL remain available in subsequent actual nodes with its defined trigger, cost, reset and upgrade rules

#### Scenario: Exchange or capped benefit
- **WHEN** a tool is exchanged or a recharge occurs at full capacity
- **THEN** the old item or capacity SHALL NOT duplicate, and the UI SHALL disclose the actual net outcome

### Requirement: Consequential story and unique core
The system SHALL persist the contract's escort, ferryman, crossing, stations, shelter, blade and carrier choices and apply their stated later opportunities or costs. The lantern core SHALL have one canonical owner and a truthful transfer history.

#### Scenario: Earlier help changes later actions
- **WHEN** a saved person and shelter facts meet a later assistance condition
- **THEN** that assistance SHALL alter the actual available route, obstacle or cost rather than only change dialogue

#### Scenario: Final dedication
- **WHEN** the mother lamp is ignited
- **THEN** the core SHALL already occupy its socket and an eligible player-forged blade SHALL actually be dedicated after the required mechanism and bracing steps

### Requirement: Bounded chapter retry
Each chapter SHALL allow one explicit retry from its canonical chapter start. Playable current-chapter fields SHALL roll back together while used retry count and failed-attempt history remain; rewards or random opportunities SHALL NOT be carried backward for farming.

#### Scenario: Retry after failure
- **WHEN** an available chapter retry is confirmed
- **THEN** resources, ownership, story and random state SHALL match the chapter start and no current-chapter reward SHALL remain outside that rollback

### Requirement: Independent identity and truthful UI
The campaign SHALL use independent forge-v7 rules, schema7 save keys and lock, formal SDK and presentation. The approved scope SHALL include its default entry, preserving explicit old v5 and v6 entrances without migrating their resources. Saves SHALL be bounded and validated by full canonical journal replay.

#### Scenario: Old progress remains old
- **WHEN** the new campaign starts or becomes the default entry
- **THEN** old v5 and v6 save bytes and interpretation SHALL remain separate and accessible through their preserved entrances

#### Scenario: Readable mainline
- **WHEN** normal play is visible
- **THEN** current place, character promise, objective and next landmark SHALL be directly discoverable, and renderer text or animation SHALL NOT invent campaign progress

### Requirement: Approval and complete delivery scope
New campaign rules SHALL remain unimplemented until the user approves the concrete complete contract. That approval SHALL cover all chapters and endings in the declared scope; the implementation SHALL NOT stop after an isolated introductory slice and describe that as full delivery. Necessary modern-PC checks SHALL remain bounded and SHALL NOT be treated as human enjoyment acceptance.

#### Scenario: Reviewable approval object
- **WHEN** implementation approval is requested
- **THEN** the complete story, numeric rules, ownership, progression, retry, ending and publication behavior SHALL be available for review together with a clearly labeled design storyboard
