# Feature Automation Tips (dnd5e Activities)

This guide describes how to build NPC features that actually automate in Foundry VTT dnd5e.

Target stack for this project:
- Foundry VTT v13.x
- dnd5e v5.1.8
- 2024 rules data model (`system.source.rules: "2024"` where appropriate)

---

## Why this exists

The generated actor `Example JSON's/Generated/fvtt-Actor-the-gourmand-1N1StchQpLX0RcbY.json` has valid item records, but several features are only partially automated:

- `Gourmand's Gaze` says "target makes WIS save or is charmed for 1 minute", but the activity is `utility` and does not encode the save/effect.
- `Mustard Stream`, `Ketchup Spray`, and `Relish Mist` descriptions imply rider conditions, but activities only apply hit + damage.
- `Juicy Core` describes a trigger ("when hit" / "start of turn within 5 feet"), but is represented as a normal action activity.

Result: these features roll something, but do not enforce the mechanical text.

---

## What "good automation" looks like (from official-style data)

Official monster/spell data in `Example JSON's/Official/` consistently does these things:

1. Uses the correct activity type for resolution
   - `attack` for to-hit attacks.
   - `save` for "target must succeed on a save..." features.
   - `damage` for pure damage applications.
   - `utility` for toggles, roll tables/selectors, or non-resolution helpers.

2. Encodes save mechanics in the activity
   - `save.ability` and `save.dc` are present when text calls for a save.
   - `damage.onSave` is set (`none`, `half`, etc.) for save-based damage.

3. Wires conditions via `activity.effects` + item `effects`
   - Activity references effect IDs.
   - Item defines concrete Active Effects with statuses and duration.

4. Encodes targeting/range/duration explicitly
   - `target.affects.type/count`, template shape/size, and `range.value/units`.
   - Duration in the activity when the effect is time-bound.

5. Encodes resource usage at activity level
   - `uses.max/recovery` on activity when per-ability limits exist.
   - `consumption.targets` when spending activity uses.

6. For spellcasting, cast activities are linked to embedded spells
   - `Spellcasting` feat activities of type `cast`.
   - Embedded spells use `flags.dnd5e.cachedFor` to map spell item -> cast activity.

---

## Authoring rules for custom monster features

Use this checklist for each generated feature:

1. Parse the sentence mechanically
   - Activation: action, bonus, reaction, passive/triggered.
   - Resolution: attack roll, save, automatic damage, or utility.
   - Targeting: creature/object/area, range, count.
   - Outcome: damage types, condition, duration, repeat saves, recharge/uses.

2. Choose item + activity structure
   - Keep feature as `type: "feat"` unless it is truly a weapon or spell item.
   - Add one or more activities when one text block has multiple steps.

3. Put the mechanic in activity data, not only prose
   - Description text can summarize, but automation-critical fields must be structured.

4. Add effects when conditions exist
   - Create item-level effect entries (status + duration).
   - Reference them in `activity.effects`.

5. Encode save DC correctly
   - If fixed in the stat block, use flat formula/value pattern.
   - If derived, use ability/proficiency formula pattern.

6. Encode limited-use features
   - `activity.uses.max`, `activity.uses.recovery`.
   - `consumption.targets` to spend 1 use on execution.

7. Mark trigger-based features honestly
   - For "when hit" / "start turn" clauses, include a `utility` helper activity and clear text.
   - If fully automatic trigger execution is not supported, keep a manual trigger button rather than pretending it is a standard action.

---

## Practical patterns

### A) Save-or-condition feature (example: charm gaze)

Use a `save` activity with an attached condition effect:

```json
{
  "type": "save",
  "activation": { "type": "bonus", "value": 1, "override": false },
  "target": {
    "affects": { "type": "creature", "count": "1", "choice": false },
    "template": { "contiguous": false, "units": "ft", "type": "" },
    "override": false,
    "prompt": true
  },
  "range": { "units": "ft", "value": "60", "override": false },
  "save": {
    "ability": ["wis"],
    "dc": { "calculation": "flat", "formula": "13" }
  },
  "effects": [{ "_id": "charmedEffectId", "onSave": false }],
  "duration": { "units": "minute", "value": "1", "concentration": false, "override": false }
}
```

And on the item:

```json
{
  "_id": "charmedEffectId",
  "name": "Charmed",
  "transfer": false,
  "statuses": ["charmed"],
  "duration": { "seconds": 60 }
}
```

### B) Attack with rider condition (example: paralyzing touch style)

Use `attack` activity + linked `effects`. Do not rely on plain text alone.

### C) Triggered aura/start-turn damage

If feature text is "creatures that start turn within 5 ft take X damage":
- Represent with a `damage` activity pre-targeted to close range (manual trigger by GM each turn), or
- Split into helper `utility` activity + `damage` activity if your UX needs a separate reminder step.

---

## Common anti-patterns to avoid

- A `utility` activity used for a save-or-condition feature.
- Damage encoded but missing `onSave` behavior.
- Description says "blinded/paralyzed/charmed" but no `effects` are linked.
- Daily-use text in description, but no `activity.uses` or consumption target.
- Triggered/passive text modeled as plain action with no trigger cue.

---

## QA pass before shipping generated actors

For every `feat`/`weapon` item with combat text:

1. Does each mechanical sentence map to at least one structured field?
2. If there is a save in prose, is there a `save` object in activity?
3. If there is a condition in prose, is there linked `activity.effects` + item effect definition?
4. If there is duration/area/range in prose, is it encoded in activity fields?
5. If there is "X/day", are uses + recovery + consumption targets present?
6. If it is spellcasting, do cast activities link to embedded spells (`cachedFor`)?

If any answer is "no", automation is incomplete.

---

## Notes specific to this repo

- `SpellcastingBuilder` already follows strong automation patterns for cast activities and spell linking.
- The biggest gap is custom non-spell features from the Blacksmith stage: they need richer mechanic extraction and a schema that allows `effects`, save behavior, and resource wiring.

