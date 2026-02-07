# Updating Actor Generation to Align with Official FoundryVTT JSONs

This document outlines the structural differences observed between generated actor JSONs and official FoundryVTT actor JSONs, and provides a guide on how to update the generation code to align with the official standard.

## Structural Differences

### 1. Top-Level Property Ordering
While JSON is technically unordered, official files tend to follow a specific sequence of keys. Aligning this makes diffing and debugging easier.

**Official Order:**
1. `name`
2. `type`
3. `img`
4. `system`
5. `prototypeToken`
6. `items`
7. `effects`
8. `folder`
9. `flags`
10. `_stats`
11. `ownership`
12. `_id`
13. `sort`

**Generated Order:**
Often places `items` before `prototypeToken` and `_id` at the end.

### 2. `system` Object Discrepancies

#### Type Formatting
- **Official:** `system.details.type.value` is **lowercase** (e.g., "dragon").
- **Generated:** `system.details.type.value` is **Capitalized** (e.g., "Aberration").
- **Action:** Ensure the generator lowercases the creature type.

#### Biography
- **Official:** Uses `@Embed` links to compendiums for generic lore.
- **Generated:** Uses raw HTML (`<p>`).
- **Action:** While unique lore requires HTML, ensure standard formatting tags match. If referencing standard monsters, consider using `@Embed`.

#### Attributes
- **AC:** Official uses `calc: "natural"` for monsters. Generated uses `calc: "flat"`.
- **Initiative:** Official often includes a formula like `@prof * 2` in `system.attributes.init.bonus`. Generated leaves this empty.
- **Movement:** Official explicitly sets values (e.g., `fly: 80`). Generated leaves unused modes as `null`.

### 3. `items` (Features & Actions)

#### Dynamic Name Replacement
- **Official:** Uses `[[lookup @name lowercase]]` in descriptions instead of hardcoding the creature's name. This allows the description to remain accurate if the actor is renamed.
- **Generated:** Hardcodes the creature's name (e.g., "Valerius").
- **Action:** Replace the actor's name in descriptions with `[[lookup @name lowercase]]` during generation.

#### IDs and Stats
- **Official:** Uses semantic IDs for compendium items (e.g., `mmAmphibious0000`).
- **Generated:** Uses random alphanumeric IDs.
- **Action:** This is acceptable for unique items, but if pulling from a compendium, preserve the original `_id` and `_stats.compendiumSource`.

### 4. `prototypeToken`
- **Size Matching:** Official tokens scale `width`, `height`, and `texture.scaleX/Y` to match the creature's size (e.g., 4x4 for Gargantuan).
- **Generated:** Defaults to 1x1.
- **Action:** Ensure `prototypeToken` dimensions match the `system.traits.size` of the generated actor.
- **Settings:** Official sets `appendNumber: true`. Generated sets `false`.

## Implementation Checklist

To align the generation code:

1.  [x] **Normalize Type:** `.toLowerCase()` the `system.details.type.value`.
2.  [ ] **Dynamic Descriptions:** Regex replace the actor's name in all item descriptions with `[[lookup @name lowercase]]`.
3.  [x] **Token Sizing:** (Partially addressed in prompt, need to verify Builder logic)
    - `tiny`: 0.5
    - `sm`: 0.8
    - `med`: 1
    - `lg`: 2
    - `huge`: 3
    - `grg`: 4
4.  [x] **AC Calculation:** Default to `calc: "natural"` for monsters unless they wear armor.
5.  [ ] **Key Ordering:** (Optional) Reorder the final JSON object keys to match the official sequence for consistency, including within the `system` object and `items` array.
6.  [x] **Expanded Stats:** Added languages, senses, skills, saves, resistances, immunities, habitat, treasure, and rich biography to the generation prompt and builder.

## Detailed Key Ordering Reference

To fully align, consider matching these key sequences:

**Top Level:**
`name`, `type`, `img`, `system`, `prototypeToken`, `items`, `effects`, `folder`, `flags`, `_stats`, `ownership`, `_id`, `sort`

**System Object:**
`currency`, `abilities`, `bonuses`, `skills`, `tools`, `spells`, `attributes`, `details`, `resources`, `source`, `traits`

**Item Object:**
`_id`, `name`, `type`, `system`, `img`, `effects`, `folder`, `sort`, `flags`, `_stats`, `ownership`
