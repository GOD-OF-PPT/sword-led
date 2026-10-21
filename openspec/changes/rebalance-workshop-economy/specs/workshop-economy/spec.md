## ADDED Requirements

### Requirement: Explicit v5 approval and isolated rules
The implementation SHALL remain pending until the user approves the v0.8 workshop economy proposal. The new rules SHALL use forge-v5/schema5 and independent main/backup keys, while all v1–v4 interpreters, saves, backups and explicit legacy continuation remain available without journal conversion. Previously authorized v4 presentation work SHALL NOT require renewed style approval.

#### Scenario: Proposal validated but not approved
- **WHEN** strict OpenSpec validation succeeds but the user has not approved the new rules
- **THEN** no v5 core, SDK or storage implementation is started and the current v4 game remains playable

#### Scenario: Resume an old run
- **WHEN** the player continues a valid v4 save
- **THEN** its original full-value payment, supply, random progression and journal are interpreted by v4, not re-priced by v5

### Requirement: Bounded commission fees with maximum route progress
The v5 core SHALL pay chapter commission base fees of 100, 250 and 600. Earned base fees SHALL equal floor(P multiplied by the greatest capped delivered-count/required-count fraction among that commission's routes). Each accepted matched delivery SHALL pay only the before/after earned-fee difference, using deterministic integer fraction comparison and actual delivered pieces. Partial wages SHALL remain paid on subsequent failure without faking completion.

#### Scenario: Day eight partial payment
- **WHEN** one qualifying blade of the day-eight two-blade commission is delivered
- **THEN** its base wage is125, the commission remains one of two, and the second qualifying blade pays the remaining125

#### Scenario: Day eleven changes routes
- **WHEN** one qualifying new blade pays300 and the player then completes the old-blade alternative
- **THEN** only another300 base wage is paid, for600 total, with each blade having one real disposition

### Requirement: One shared daily purse for all non-base payments
The v5 core SHALL reset the daily chapter purse to60,150 or300. Matched-delivery quality bonuses SHALL quote floor(max(0,value minus the lowest matching route value threshold)/5). Ordinary sales SHALL quote floor(value/4); voluntary scrap, automatic broken-blade refunds and end-of-day recovery SHALL quote floor(original blade base/4). Every such payment SHALL be limited by and immediately deducted from the same remaining daily purse. Base commission wages SHALL NOT consume it.

#### Scenario: Raw blades cannot fill the first purse at full face value
- **WHEN** two value40/base40 raw blades are sold with sufficient first-chapter purse funds
- **THEN** they pay10 each, consuming20 of60, not40 each

#### Scenario: End-of-day and broken refunds share the limit
- **WHEN** a broken refund has already consumed part of the daily purse and several remaining blades are recovered at settlement
- **THEN** recovery is allocated in stable inventory order from the remaining purse and the total non-base payments never exceed that day's B

#### Scenario: Reset and reload
- **WHEN** a player reloads the current day or formally advances to the next day
- **THEN** reload preserves the spent purse without paying again, and only accepted advance creates the next day's fresh budget

### Requirement: Honest zero quotes and accepted commission handoffs
The game SHALL distinguish unmatched ordinary sales from real matched commission receipts. A matched unfinished commission receipt SHALL remain acceptable even with zero remaining purse or zero total computed payment. An ordinary zero-price sale SHALL be rejected without consuming the blade or journal action. Explicit scrap and confirmed settlement MAY dispose of blades for zero and automatic damage SHALL remain effective even with zero recovery.

#### Scenario: Empty purse does not block partial commission
- **WHEN** the day-eight first qualifying blade is delivered after the purse is exhausted
- **THEN** the blade is accepted, one-of-two progress and125 base wage are recorded, and quality bonus is0

#### Scenario: Zero sale and explicit scrap
- **WHEN** an unmatched blade has zero sale quote
- **THEN** ordinary sale keeps it with an explanation, while a separately explicit zero-value scrap or confirmed settlement can dispose of it exactly once

#### Scenario: Generic zero-increment receipt
- **WHEN** a legitimately matched unfinished-commission receipt computes zero maximum-progress increment and zero quality bonus
- **THEN** the receipt is accepted according to qualification rather than misclassified as a rejected ordinary sale, without claiming that this hypothetical branch is reachable in the current twelve commissions

### Requirement: Preserve existing exceptional income and all costs
The v5 rules SHALL preserve the40-coin no-option first-gift compensation and the single160-coin salvage event outside the day purse. Merchant upgrades SHALL remain180/700/1600 and repairs150/350/800 with original per-visit limits; loan60, shelter80 and credit90/180/360 SHALL remain costs. All other sale, scrap and damage income SHALL use the shared purse. Total possible twelve-day gross income SHALL be at most6040, without treating that bound as proof of enjoyment or balance.

#### Scenario: Salvage exchanges the reserved blade
- **WHEN** the player accepts the unique salvage event with an available reserved blade
- **THEN**160 coins are paid independently, that blade leaves the rack with its unique disposition, and no duplicate blade or simultaneous retained reserve is created

#### Scenario: Money is not borrowed from tomorrow
- **WHEN** an upgrade or paid event exceeds the current wallet even though later wages could cover it
- **THEN** it is unavailable until real accepted income arrives; no future commission is credited early

### Requirement: Three total supplied slots with an optional old blade
Each v5 day's opening inventory SHALL consist of three new blanks without a reserve, or one actual reserved blade plus two new blanks. Removing an old blade later SHALL NOT issue a fourth. The old blade SHALL retain its recipe, levels, crack and charge; warm rack, inheritance, donation, loan and shelter SHALL preserve their original effects on the appropriate old blade or actual first/new blanks. Next-day quantities and qualification SHALL be disclosed before settlement confirmation.

#### Scenario: Warm rack and old route
- **WHEN** a value400 reserved blade crosses a day with warm rack
- **THEN** it becomes460 once, retains its other state and occupies one of the three slots, permitting the day-five old420 route where qualified

#### Scenario: Wrong reserve before a two-blade day
- **WHEN** the player considers taking an unsuitable old blade into day eight or eleven
- **THEN** the game previews two new blanks plus that old blade and allows return before settlement; both published two-blade routes retain sufficient new-piece quantity and are not removed

### Requirement: Workmanship gate for barter without added tool management
V5 merchant barter SHALL require an active, unreserved, undisposed blade with level at least3, while preserving unique blade disposition, the six traits, three equip slots, replacement confirmation and original merchant pools. The first gift SHALL remain free and SHALL NOT require a barter blade. The UI SHALL describe levels accurately rather than equating them with hammer count.

#### Scenario: Raw blank cannot buy a trait
- **WHEN** a player offers a level0 raw blank for merchant barter
- **THEN** the transaction is rejected without loss, and the UI explains the level3 workmanship requirement

#### Scenario: Two hits can be sufficient workmanship
- **WHEN** accepted success/great results have raised a blade to level3 in fewer than three ordinary strikes
- **THEN** the blade can meet the workmanship gate; the game does not invent a three-strike requirement

### Requirement: Preserve all twelve commissions and three endings
V5 SHALL retain: day1 intact100; day2 intact light160 with ordinary hits at most4; day3 one burst260; day4 intact guard360; day5 old420 or new630; day6 cracked520; day7 heavy760; day8 two intact light blades each420; day9 two bursts1000; day10 cracked guard1150 or intact guard1800; day11 old1300 or two new blades each850; and day12 intact heavy2500 at level9. Old SHALL mean suppliedDay less than current day. Loaned recipes, three chapters, six events, three modifications, six traits, twelve work pages and existing challenge reorder ranges SHALL remain.

#### Scenario: Surviving incomplete return
- **WHEN** day twelve ends with seals above0 but fewer than10 completed commissions or any of days4,8,12 incomplete
- **THEN** the return ending states the actual missing commissions and does not claim twelve lights restored

#### Scenario: Victory and defeat remain distinct
- **WHEN** settlement leaves0 seals, or day twelve leaves positive seals with at least10 commissions and all three critical days complete
- **THEN** the former is defeat immediately and the latter is victory, independently of wallet size or purse usage

### Requirement: Explicit collection import without wallet migration
The new collection SHALL use schema2 and independent collection/backup keys, record each retained work's rules origin, and preserve the existing best-work-per-commission semantics. Importing a validated old schema1 collection SHALL require a preview and explicit confirmation bound to the displayed source snapshot. Only unlock/achievement/work sets SHALL merge idempotently; wallet, seals, upgrades and run inventory SHALL NOT migrate. V4/schema1 data SHALL remain unchanged, and each new run SHALL freeze its eligibility snapshot.

#### Scenario: Import source changes during confirmation
- **WHEN** an old collection changes after its preview but before confirmation
- **THEN** import refuses the stale source and requests a fresh preview rather than importing unseen content

#### Scenario: Repeated import or denied write
- **WHEN** the same collection is imported again or its schema2 write fails
- **THEN** no currency or duplicate unlock is awarded; original data remain, and retry/export is available without claiming an atomic run/collection transaction

### Requirement: Product-focused quotes and targeted validation
The interface SHALL expose actual before-disposal quotes and next-day consequences through contextual paper, customer, rack and merchant interactions while preserving direct left-click play and the clear D-style anvil. The core SHALL own all monetary decisions. Necessary integer/replay/build checks and one-PC-browser actual play SHALL support the change; a model budget bound, mockup or test count SHALL NOT substitute for human gameplay evaluation.

#### Scenario: Valuable blade and exhausted purse
- **WHEN** a high-value blade has no remaining sale payout
- **THEN** the UI separates its workmanship value from actual coin quote and presents legal trade/reserve/scrap choices without automatically disposing of it or obscuring the anvil

#### Scenario: Proposal-only budget example
- **WHEN** a document gives a legal-results budget window without an actual v5 seed journal
- **THEN** it is labeled arithmetic rather than SDK replay or browser playtest evidence
