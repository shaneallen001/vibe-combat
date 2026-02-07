# Actor Generation Approach: "Vibe Architect"

## Goal
The goal of this initiative is to evolve the "Vibe Actor" feature from a simple "text-to-statblock" converter into a **"Vibe Architect"**—a sophisticated AI-powered system that generates truly unique, balanced, and deeply integrated actors for Foundry VTT. 

We aim to move beyond generic monster generation to create actors that feel "hand-crafted," with:
- **Coherent Themes**: Stats, abilities, and gear that tell a story.
- **Unique Features**: Custom actions and traits that aren't just rehashed SRD content.
- **System Integration**: Seamless usage of existing Compendium UUIDs to reduce database bloat and leverage existing automation/effects, while intelligently "mixing in" custom content.
- **Balance**: mathematically sound CR calculations that respect D&D 5e math (or the target system's math).

## AI Scaffolding & File Navigation
To generate high-quality content, the AI needs context. We will implement a "Scaffolding" layer that navigates Foundry's data structure *before* and *during* generation.

### 1. Context Gathering (Pre-Generation)
Instead of just sending a prompt, we will gather relevant "seeds":
- **Compendium Indexing**: We need a robust, cached index of available items (Spells, Features, Items) with their UUIDs, Names, and Types.

### 2. The "Scaffold" Object
We will define a `Scaffold` object that acts as the skeleton for the actor.
```javascript
const scaffold = {
  context: {
    targetCR: 5,
    creatureType: "undead",
    theme: "swamp_ambush",
    partyLevel: 4
  },
  constraints: {
    maxAC: 16,
    maxDamagePerRound: 30,
    requiredAbilities: ["stealth", "poison"]
  },
  availableResources: {
    // A list of "known" UUIDs the AI can reference
    spells: ["uuid1", "uuid2", ...], 
    weapons: ["uuid3", ...]
  }
};
```

## Mature Gemini Integration Structure
We will move away from a single massive "System Instruction" to a **Pipeline Approach** using distinct "Agents" or "Steps".

### Step 1: Concept & Blueprint (The "Architect")
*Prompt*: "Design a concept for a CR 5 Swamp Undead. Describe its behavior, appearance, and combat style. Output a 'Blueprint' JSON with target stats (AC, HP, Save DCs) and a list of desired features (e.g., 'Ambush Hunter', 'Poison Breath')."

### Step 2: Component Selection (The "Quartermaster")
*Prompt*: "Review this Blueprint. Select existing items from this list [provided list of Compendium UUIDs] that fit the concept. If no existing item fits a specific feature, mark it for 'Custom Generation'."

### Step 3: Custom Fabrication (The "Blacksmith")
*Prompt*: "Generate the data for these specific 'Custom Features' defined in Step 2. Ensure they follow the D&D 5e data model for 'activities' and 'damage' exactly."

### Step 4: Assembly & Polish (The "Builder")
*Code Logic*: Combine the selected UUIDs and the generated Custom Items into the final Actor document. Calculate final CR/XP to verify balance.

## Compendium UUID Strategy
To reduce world size and leverage existing effects (e.g., Midi-QOL automations on SRD items), we prioritize existing UUIDs.

1.  **Smart Indexing**: We will maintain a lightweight index of `dnd5e` system compendiums (and potentially user-selected modules like Item Piles or DAE).
2.  **Fuzzy Matching**: If the AI suggests "Longsword", we match it to `dnd5e.items.Longsword` UUID.
3.  **"Variant" Generation**: If the AI wants a "Rusted Longsword", we can grab the base "Longsword" data but override the name and description, while keeping the underlying system data (damage, range) mostly intact or slightly modifying it.

## Unique Features & Gear
To ensure uniqueness, we will explicitly prompt for "Signature Abilities".

-   **The "Twist"**: Every generated actor should have at least one "Twist"—a reaction, a legendary action, or a unique passive trait that players won't expect.
-   **Loot Generation**: Instead of just "10gp", generate "A locket with a faded portrait" or "A rusted key to a nearby tower."
-   **Dynamic Descriptions**: Use the AI to write the `biography` HTML, including a "DM Notes" section with tactics.

## Implementation Roadmap

1.  **Refactor `CompendiumService`**: Make it a robust "Asset Manager" that can feed lists of options to the AI.
2.  **Create `GeminiPipeline`**: A class to manage multi-turn or multi-step generation flows.
3.  **Define `ActorBlueprint` Schema**: A simplified JSON schema for the intermediate "concept" stage.
4.  **Update `VibeActorDialog`**: Add "Advanced Options" to control the "Twist" level or specific themes.

## Data Strategy: Learning from Examples

We have access to "Gold Standard" JSON exports (e.g., Mage, Lich, Ancient Black Dragon) which serve as the ground truth for our data models.

### 1. Template Extraction
We will analyze these JSONs to extract reusable "Item Templates".
-   **Spellcasting Feature**: The "Mage" example shows that modern dnd5e NPCs often use a single "Spellcasting" feature with multiple `activities`, each linking to a Spell UUID. We will replicate this structure rather than dumping individual spell items into the actor, keeping the sheet clean.
-   **Multiattack**: We can extract the `Multiattack` feature structure to ensure our generated multiattacks function correctly with Foundry's automation.

### 2. Schema Validation
We will use these files to build a lightweight "Validator".
-   Before creating an actor, our system can check if the generated JSON matches the structure of these official examples (e.g., ensuring `system.abilities.str.value` exists and is a number).

### 3. Few-Shot Prompting
We will create a "minified" version of these JSONs to use in our AI prompts.
-   *Example*: "Here is the valid JSON structure for an NPC's 'Arcane Burst' weapon. Note how the `activities` object is structured. Generate a similar weapon called 'Void Blade'..."

