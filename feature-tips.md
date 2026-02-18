# Feature Activity Type Guide (Foundry dnd5e)

This guide explains how to choose the correct dnd5e `system.activities[*].type` for generated features so mechanics execute correctly in Foundry, not just in prose.

Compatibility target for this repository:
- Foundry VTT core `13.348`
- dnd5e system `5.1.8`
- Data conventions aligned to 2024 model where applicable

---

## Why this matters (Venomous Harrier example)

Generated file:
- `Example JSON's/Generated/fvtt-Actor-venomous-harrier-Xaw146vLtlyDcnWs.json`

Observed issue:
- `Blinding Arrow`, `Poison Arrow`, and `Trip Arrow` are modeled as `attack` activities with linked effects.
- Their descriptions include save-gated outcomes ("must succeed on a DC 14 save or ..."), but the activities do not encode save data.
- Result: the activity can hit and apply effect links without a machine-readable save gate for conditional application.

Related issue in same actor:
- `Poisoner's Guile` is `save`, but combines multiple mutually-exclusive outcomes in one activity, which produces ambiguity and warnings.

Core rule:
- If the save/effect/damage branch is only in description text, automation is incomplete.

---

## Activity types and when to use them

### `attack`
Use when the primary gate is an attack roll.

Good for:
- Weapon/spell attacks resolved by hit or miss.
- Features where "on hit" is the main branching logic.

Do not use alone when:
- The main mechanic is "target makes a save or suffers X."
- A condition or extra damage should apply only on failed save unless that save is explicitly encoded.

### `save`
Use when the primary gate is a saving throw.

Good for:
- "Each creature must make a Dex/Con/etc. save..."
- Save-for-half, save-for-none, or save-for-condition mechanics.

Required fields for save-driven damage/effects:
- `save.ability`
- `save.dc`
- `damage.onSave` when damage exists
- `effects` links with `onSave` behavior when conditions are save-gated

### `damage`
Use for deterministic damage with no attack roll and no save gate.

Good for:
- Automatic damage ticks
- Guaranteed damage riders that do not branch on save

Do not use for save text:
- If prose says "must save," this should be `save` (or a separate save rider activity).

### `utility`
Use for helpers, selectors, triggers, and non-resolution actions.

Good for:
- Parent option selectors ("choose one ray")
- Manual trigger helpers ("when hit, trigger rider")
- Setup/support actions that do not directly resolve attack/save/damage

### `heal`, `enchant`, `summon`
Use when the feature's primary resolution is healing, enchanting, or summoning.

Notes:
- These are valid schema activity types.
- For custom combat feature generation in this module, most mechanics are still modeled with `attack` / `save` / `damage` / `utility`.

---

## Decision workflow for choosing type

For each feature, parse prose into atomic mechanics, then choose the activity model.

1. Primary gate check
   - Attack roll gate -> start with `attack`
   - Saving throw gate -> start with `save`
   - No gate, direct output -> `damage`/`heal`/`summon`/`enchant`
   - No direct resolution -> `utility`

2. Save branch check
   - If damage/effect depends on save success/failure, encode `save` and `damage.onSave`.
   - Do not leave save branch in text only.

3. Area check
   - Area features require `target.template.type` plus `target.template.size`.
   - Shape without size is incomplete.

4. Effect check
   - Condition prose requires item-level `effects[]` and `activity.effects[]` references.
   - If condition is fail-only, represent that in effect `onSave` logic.

5. Resource check
   - Limited uses/recharge must be encoded in `activity.uses` and `activity.consumption.targets`.

6. Choice check
   - "Choose one" mechanics should not attach multiple option effects to one resolution activity.
   - Use a parent `utility` selector and one child resolution activity per option.

---

## Attack + save riders: recommended patterns

Special arrows and similar riders often have two gates:
1) Attack must hit, and
2) Target then makes a save for rider outcome.

Two robust patterns:

### Pattern A: split resolution (recommended for clarity)
- Activity 1: `attack` for the weapon hit/damage.
- Activity 2: `save` rider for the conditional effect/damage branch.
- Optional parent `utility` text/helper to guide sequencing.

Benefits:
- Clear gate separation.
- Save branch is explicit and auditable.
- Works better with warning/repair logic in this repo.

### Pattern B: single save-first feature
- Use one `save` activity when the intended mechanic is fundamentally save-driven and attack flavor is secondary.
- Encode all branching mechanically in `save`, `damage.onSave`, and `effects`.

Avoid:
- Single `attack` activity with save-only prose and no save object.

---

## Worked mapping: Venomous Harrier arrows

### Existing problematic shape
- `Blinding Arrow` / `Poison Arrow` / `Trip Arrow`:
  - `type: "attack"`
  - linked status effects present
  - save prose present
  - missing explicit save gate for conditional rider logic

### Better model

Option 1 (split):
- Keep arrow to-hit as `attack`.
- Add rider as `save` activity:
  - `save.ability` and flat `save.dc`
  - `damage.onSave` if rider damage exists
  - linked effect with `onSave: false` when fail-only

Option 2 (save-centric arrow ability):
- Convert each special arrow to `save` if the intent is save-resolved feature behavior.
- Keep to-hit language out of automation path unless separately encoded.

---

## Anti-patterns to avoid

- Save language in description, but activity type is only `attack`, `damage`, or `utility`.
- Area template has a type but no size.
- Save + damage exists, but `damage.onSave` is missing.
- Condition language exists, but no linked activity effect references.
- One-of choices encoded as one activity with multiple outcome effects.
- Uses/recharge mentioned in prose only.

---

## Quick QA checklist before accepting generated features

For each combat activity:

1. Does every mechanical sentence appear in structured fields?
2. If prose includes a save, does activity include `save` data?
3. If save and damage coexist, is `damage.onSave` set correctly?
4. If area is described, are `template.type` and `template.size` both present?
5. If condition is described, are item `effects` and `activity.effects` properly linked?
6. If uses/recharge is described, are `uses` and `consumption.targets` wired?
7. If feature has mutually-exclusive outcomes, is each outcome in its own resolution activity?

If any answer is no, treat the feature as partially automated.

---

## Repository-specific guidance

- The schema and repair pipeline already enforce or warn on key issues:
  - save activity missing `save`
  - save+damage missing `damage.onSave`
  - area template without `size`
  - one-of effects bundled in a single activity
- Use those warnings as blockers for generated custom features, especially monster feats/weapons with custom activities.
# Feature Automation Tips (dnd5e Activities)

This guide explains how to build actor features that actually execute correctly in Foundry dnd5e, not just look right in description text.

Compatibility target for this repo:
- Foundry VTT core `13.348`
- dnd5e system `5.1.8`
- 2024 data model where appropriate (`system.source.rules: "2024"`)

---

## Case study: Condiment Drake vs. official Beholder

This generated actor has partially wired automation:
- `Example JSON's/Generated/fvtt-Actor-the-condiment-drake-DlqJhpOlXl9ZD5bh.json`

Official reference with strong activity wiring:
- `Example JSON's/Official/fvtt-Actor-beholder-8FwUiRcmJD6eQ2aR.json`

### What is wrong in the drake

1. `Condiment Breath (Recharge 5-6)` description says "must make a saving throw", but its activity is `utility` with no `save`.
2. `Mustard Spray` is `type: "damage"` even though the text is save-based.
3. `Mustard Spray` has a cone template without `target.template.size` (no cone length encoded).
4. `Mustard Spray` has no `save` object and no `damage.onSave` behavior for half damage.

### What the beholder does correctly (Eye Rays / Slowing Ray pattern)

Official `Eye Rays` activities consistently include:
- `type: "save"` when the text says saving throw.
- `save.ability` and `save.dc`.
- `damage.onSave` (`"half"` when the text says half on success).
- linked effect references in `activity.effects` that point to item-level `effects`.
- explicit range and target data.

The result is that the chat card and targeting flow enforce mechanics instead of relying on manual adjudication.

---

## Rule: prose is not automation

If a mechanic appears only in description text, it is not automated.

Every mechanical clause must be represented in a structured field:
- Save clause -> `activity.save`
- Half/none/full on success -> `activity.damage.onSave`
- Condition application -> `activity.effects[]` + item `effects[]`
- Area size -> `activity.target.template.size`
- Uses/recharge -> `activity.uses` + `activity.consumption.targets`

---

## How to build functional features

Follow this sequence for each feature.

1. Parse the text into atomic mechanics
   - Activation (`action`, `bonus`, `reaction`, passive/trigger)
   - Resolution (attack roll, save, pure damage, utility helper)
   - Targeting (single target vs. area)
   - Outcomes (damage, condition, duration, repeat save, uses/recharge)

2. Choose the correct activity type
   - `attack`: to-hit gate is primary
   - `save`: saving throw gate is primary
   - `damage`: no attack and no save gate
   - `utility`: selector, trigger helper, roll table, non-resolution helper

3. Encode area/range explicitly
   - Cone/line/sphere/cylinder/cube need `target.template.type` plus `target.template.size`.
   - Single-target features should use `target.affects.type` and `target.affects.count`.

4. Encode save + damage interaction
   - If text has a save, include `save.ability` and `save.dc`.
   - If text says half/none/full on success, set `damage.onSave` accordingly.

5. Encode conditions with linked effects
   - Create item-level effect with correct `statuses` and duration.
   - Reference that effect in `activity.effects` and set `onSave` behavior.

6. Encode uses/recharge where relevant
   - Set `activity.uses.max` and `activity.uses.recovery`.
   - Add `activity.consumption.targets` so a use is actually spent.

7. Model triggered mechanics honestly
   - For "when hit", "start of turn", "end of turn", prefer manual-trigger `utility` or helper flow.
   - Do not disguise triggers as ordinary action attacks.

---

## Worked example: Mustard Spray (correct wiring)

Mechanics from prose:
- 60-ft cone
- Dex save DC 16
- Fail: `4d6 acid` + blinded until end of next turn
- Success: half damage, no blinded

Minimal activity structure:

```json
{
  "type": "save",
  "activation": { "type": "action", "value": 1, "override": false },
  "range": { "units": "self", "override": false },
  "target": {
    "affects": { "type": "creature", "choice": false },
    "template": {
      "type": "cone",
      "size": "60",
      "units": "ft",
      "contiguous": true
    },
    "override": false,
    "prompt": true
  },
  "save": {
    "ability": ["dex"],
    "dc": { "calculation": "flat", "formula": "16" }
  },
  "damage": {
    "parts": [
      { "number": 4, "denomination": 6, "types": ["acid"] }
    ],
    "onSave": "half"
  },
  "effects": [
    { "_id": "blindEffectId", "onSave": false }
  ],
  "duration": { "units": "inst", "concentration": false, "override": false }
}
```

Linked item effect:

```json
{
  "_id": "blindEffectId",
  "name": "Blinded",
  "transfer": false,
  "statuses": ["blinded"],
  "duration": { "rounds": 1 },
  "changes": []
}
```

Key point: if this is modeled as `damage` without `save`, Foundry cannot automate the fail/success branch correctly.

---

## Multi-option features (like Eye Rays or breath variants)

Use a parent helper plus child resolution activities:
- Parent `utility` activity for selecting or rolling the variant.
- Each variant should be its own fully wired `save`/`attack`/`damage` activity.
- Put limited-use/recharge on the activity that is actually clicked to execute (or ensure child activities consume shared uses correctly).

Do not put all mechanics in one parent prose block and leave variants under-specified.

---

## Common anti-patterns

- Save language in prose but activity is `damage` or `utility`.
- Area template has shape but no size (for example, cone with no length).
- Damage + save present but `damage.onSave` missing.
- Condition in prose but no linked `activity.effects` and item `effects`.
- Recharge/day language only in description with no uses/consumption data.

---

## QA checklist before shipping generated actors

For each combat-relevant `feat`/`weapon`:

1. Does each mechanical sentence map to structured fields?
2. Save in prose -> `activity.save` present?
3. Save + damage -> `damage.onSave` present and correct?
4. Area text -> `target.template.type` and `target.template.size` present?
5. Condition text -> item `effects` + `activity.effects` linked?
6. Limited-use/recharge text -> `uses` + `consumption.targets` wired?
7. Trigger text -> represented as trigger/manual helper pattern, not fake action?

If any answer is no, automation is incomplete.

---

## Notes for this repository

- `SpellcastingBuilder` already produces strong cast activity wiring and spell linking.
- Custom non-spell features from the Blacksmith path are the highest-risk area and should be validated against this checklist every generation run.

