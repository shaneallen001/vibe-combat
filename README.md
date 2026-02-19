# Vibe Combat

## Overview
**Vibe Combat** is a Foundry VTT module focused on enhancing the combat experience with AI-assisted encounter building and management. It works in tandem with `vibe-common` and optionally `vibe-actor`.

## Features

### 1. AI Encounter Suggestions
-   **Context-Aware Suggestions**: Analyze the current party composition and generate balanced encounter ideas based on CR and party size.
-   **Catalog Constraints**: Optionally constrain suggestions to monsters available in your Compendiums or World Actors.

### 2. Party XP Budgeting
-   **Real-time Calculations**: Automatically calculates the party's daily XP budget and encounter difficulty thresholds (Easy, Medium, Hard, Deadly).
-   **Drag-and-Drop Workflow**: Build parties and encounters by dragging actors directly into the Combat Tracker.

### 3. Encounter Management
-   **Save & Load**: Save generated parties and encounters for later use.
-   **Quick Setup**: Rapidly clear and rebuild the tracker for new battles.

## Installation
1.  Ensure **`vibe-common`** is installed and enabled.
2.  Install **`vibe-combat`** into your `Data/modules/` directory.
3.  Enable the module.

> **Recommended**: Install `vibe-actor` for AI NPC generation capabilities.

## Configuration
Go to **Settings -> Configure Settings -> Vibe Combat**:

-   **Gemini API Key**: Required for AI Encounter Suggestions.
-   **Encounter Settings**: Configure saved parties and suggestion sources.

## Usage

1.  Open the **Combat Tracker**.
2.  Click the **"Vibe Combat"** button.
3.  **Party Tab**: Drag player actors here to calculate thresholds.
4.  **Encounters Tab**: Drag monsters here to build an encounter. See difficulty ratings update in real-time.
5.  **Suggestions**: Click "Suggest Encounter" to get AI-generated ideas.

---

## Developer Guide

### Module Entry Point & Hooks (`scripts/main.js`)

This is the first file executed by Foundry. It registers two hooks to inject the Vibe Combat button into the Combat Tracker sidebar:

```
Hooks.once("ready")            → Validates dnd5e system requirement, calls registerModuleSettings()
Hooks.on("renderCombatTracker")→ Calls addVibeCombatButton() via requestAnimationFrame
Hooks.on("renderSidebarTab")   → Same as above, but guards on app.tabName === "combat" for v13
```

> **Why two hooks?** In Foundry v13, `renderCombatTracker` and `renderSidebarTab` can both fire depending on how the user opens the tab. Both are registered defensively so the button always appears. `requestAnimationFrame` is used to ensure the DOM is fully rendered before DOM manipulation.

### Directory Structure

```
scripts/
├── main.js                         # Entry point, hook registration
├── settings.js                     # All game.settings.register() calls
├── constants.js                    # SUGGESTION_TYPES array (re-exported from vibe-common)
├── agents/                         # AI agent wrappers (for NPC generation, mirrored from vibe-actor)
│   ├── generative-agent.js         # Base class: calls GeminiService, handles JSON schema
│   ├── architect-agent.js          # Designs the NPC blueprint
│   ├── blacksmith-agent.js         # Generates custom Foundry Item data
│   ├── quartermaster-agent.js      # Selects compendium items for a blueprint
│   └── adjustment-agent.js        # Modifies an existing blueprint via diff
├── factories/
│   ├── actor-factory.js            # Assembles final Actor document data
│   ├── blueprint-factory.js        # Converts blueprints to/from actor documents
│   └── actor-blueprint.js          # Blueprint data type definition
├── handlers/
│   ├── drag-drop-handler.js        # Resolves drag data into Actor objects, calls EncounterManager
│   └── placement-handler.js        # Handles placing generated NPCs into the scene/combat tracker
├── managers/
│   ├── encounter-manager.js        # In-memory encounter state + save/load to game.settings
│   └── party-manager.js            # In-memory party state (list of player actors)
├── schemas/
│   ├── analysis-schema.js          # Gemini response schema for actor analysis
│   ├── blueprint-schema.js         # Gemini response schema for actor blueprints
│   └── foundry-item-schema.js      # Gemini response schema for Item data
├── services/
│   ├── gemini-service.js           # Re-exports callGemini/extractJson from vibe-common
│   ├── encounter-suggestion-service.js # Builds prompts, calls Gemini, resolves catalog
│   ├── gemini-pipeline.js          # Orchestrates multi-step NPC generation (Architect→QM→Blacksmith→Builder)
│   ├── compendium-service.js       # Fuzzy-searches compendium packs for items/spells
│   ├── image-generation-service.js # Calls OpenAI DALL-E for actor portraits
│   └── spellcasting-builder.js     # Converts blueprint spells into dnd5e spellcasting feat
├── ui/
│   ├── vibe-combat-app.js          # Main ApplicationV2 window (Combat Tracker overlay)
│   ├── combat-button-injector.js   # DOM manipulation to add the button to Combat Tracker header
│   ├── button-injector.js          # Generic button injector (shared pattern)
│   ├── image-generator.js          # Actor portrait dialog
│   ├── suggestion-sources-config.js# Dialog for selecting which compendium packs to use
│   └── dialogs/                    # Sub-dialogs (save, load, adjustment, etc.)
└── utils/
    ├── xp-calculator.js            # calculateEncounterXp(), calculateXpBudgets() functions
    ├── actor-helpers.js            # getActorCr(), getActorLevel(), getActorPortrait(), etc.
    └── ...                         # Other utility helpers
```

### Key Classes & Data Flow

#### Encounter Suggestion Flow
```
User clicks "Suggest Encounter"
  → VibeCombatApp._onSuggestEncounter()
  → EncounterSuggestionService.buildCreatureCatalog({ includeWorldActors, packIds })
       → Queries game.actors (world NPCs) + game.packs (compendium indexes, cached)
  → EncounterSuggestionService.requestSuggestions({ partyMembers, catalog, typeId, apiKey })
       → Builds a JSON payload with party summary, XP budgets, catalog list
       → Calls callGemini() (from vibe-common GeminiService)
       → Parses and validates response: only UUIDs present in the catalog are kept
       → Throws if no valid entries returned
  → VibeCombatApp re-renders with suggestion results
```

#### Encounter State (EncounterManager)
`EncounterManager` is an **in-memory, instance-scoped** state class. One instance lives inside `VibeCombatApp`. It is **not a singleton**.

| Method                            | Behavior                                                                         |
| --------------------------------- | -------------------------------------------------------------------------------- |
| `addActorEntry(actor, qty)`       | Merges if actor UUID already present; otherwise appends                          |
| `addEntry(cr, qty)`               | Adds a "stand-in" (no live actor attached)                                       |
| `saveEncounter(name, setDefault)` | Serializes to `game.settings` keyed object                                       |
| `loadEncounterById(id)`           | Resolves actor UUIDs via `fromUuid()`; falls back to stand-in if actor not found |

**Persistence**: Encounters are stored in `game.settings` under `"vibe-combat"` → `"savedEncounters"` as a flat object keyed by `randomID()`. The active default is stored in `"defaultEncounterId"`.

#### NPC Generation Pipeline (mirrors vibe-actor)
vibe-combat includes its own copy of the full NPC generation pipeline (Architect → Quartermaster → Blacksmith → Builder). This allows placing generated NPCs directly into an encounter without requiring vibe-actor to be installed.

```
GeminiPipeline.generateActor(request)
  1. ArchitectAgent    → Generates a structured "blueprint" JSON (stats, features, spells, etc.)
  2. QuartermasterAgent → Searches compendiums for existing items matching blueprint features
  3. BlacksmithAgent   → Fabricates custom Foundry Item JSON for features not found in compendiums
  4. runBuilder()      → Assembles final actor document: system data + all items
```

**Agent Pattern** (`agents/generative-agent.js`): Each agent calls `callGemini()` with a system prompt plus context, optionally using a JSON response schema for structured output. Results are parsed via `extractJson()`.

### Settings (`scripts/settings.js`)
All settings registered via `game.settings.register("vibe-combat", ...)`:

| Key                          | Type   | Notes                                    |
| ---------------------------- | ------ | ---------------------------------------- |
| `geminiApiKey`               | String | Stored per-world, GM-only                |
| `openAiApiKey`               | String | For image generation                     |
| `savedEncounters`            | Object | `{ [id]: { name, entries[], savedAt } }` |
| `defaultEncounterId`         | String | ID of default encounter                  |
| `encounterSuggestionSources` | Object | `{ includeWorldActors, packIds[] }`      |
| `suggestionPromptTemplate`   | String | Custom prompt prefix                     |

### XP Calculation (`utils/xp-calculator.js`)
Uses `CR_XP_TABLE` and `XP_THRESHOLDS_BY_LEVEL` from `vibe-common/scripts/constants.js`.
- `calculateXpBudgets(partyMembers)` → Sums per-character thresholds from DMG p.82
- `calculateEncounterXp(entries)` → Sums CR→XP for each entry × quantity

### CSS Architecture
- **`styles/vibe-combat.css`**: Combat Tracker overlay, tabs, encounter rows, suggestion cards.
- **Base tokens**: Uses `--vibe-*` CSS custom properties provided by `vibe-common/styles/vibe-theme.css`.
- **Conventions**: Use `.vibe-dialog-form` on dialog `<form>` roots, `.vibe-btn-primary` / `.vibe-btn-cancel` on action buttons.

### Dependencies
-   **`vibe-common`**: Provides `callGemini`, `extractJson`, constants (`CR_XP_TABLE`, `XP_THRESHOLDS_BY_LEVEL`, `SUGGESTION_TYPES`), and CSS theme tokens.
-   **`vibe-actor`**: (Optional) Not a code dependency. These two modules are designed to coexist but can operate independently.

### Common Gotchas
- **Catalog UUID mismatch**: The most common AI error is Gemini returning a UUID not in the catalog. The service filters these out and throws if no valid entries remain. The catalog is built fresh on each suggestion call — no stale state.
- **Pack index caching**: `PACK_INDEX_CACHE` is a module-level `Map` that caches compendium index results per session. Clear it (or reload) if you add new actors to a compendium during a session.
- **requestAnimationFrame**: Button injection is deferred one frame to ensure Foundry's sidebar DOM is fully rendered. Never inject synchronously on render hooks.
