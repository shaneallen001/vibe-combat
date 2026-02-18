# Vibe Combat

Vibe Combat is a Foundry VTT module for the dnd5e system that helps Game Masters manage party XP budgets, encounter difficulties, generate NPC actors with Gemini AI, and adjust existing NPCs while preserving dnd5e activity automation fidelity.

## Features

-   **Party XP Budget Management**: Calculate and track party XP thresholds (Easy, Medium, Hard, Deadly) based on party size and level.
-   **Encounter Difficulty Calculation**: Real-time feedback on encounter difficulty as you add monsters.
-   **AI Actor Generation**: Generate complete D&D 5e NPC stat blocks from text descriptions using Google Gemini.
-   **AI Actor Adjustment**: Modify an existing NPC from natural-language requests while preserving identity and image.
-   **Automation-Aware Feature Generation**: Custom generated features are validated and repaired for save/effect/uses/template wiring so activity data better matches mechanical prose.
-   **Choice-Aware Activity Structuring**: Mutually exclusive feature options are normalized conditionally (only when output is redundant), while single-item multi-activity official-style patterns remain valid.
-   **AI Image Generation**: Generate token images for actors using OpenAI (DALL-E 3).
-   **Player Access**: Optionally allow players to access the Vibe Actor generator using the GM's API keys.

## Installation

1.  Download the module.
2.  Extract to your Foundry VTT `Data/modules/vibe-combat` directory.
3.  Enable the module in Foundry VTT.

## Configuration

To use the AI features, you must configure your API keys:

1.  Go to **Game Settings** -> **Configure Settings** -> **Module Settings**.
2.  Find **Vibe Combat**.
3.  Enter your **Gemini API Key** (for actor generation).
4.  Enter your **OpenAI API Key** (for image generation).
5.  (Optional) Check **Allow Players to Generate Actors** to let players use the Vibe Actor tools.

## Usage

### Vibe Combat (Encounter Builder)
Access the Vibe Combat interface via the "Vibe Combat" button in the Combat Tracker (Encounter tab).
-   **Party**: Add actors to the party to calculate the XP budget.
-   **Encounter**: Add monsters to the encounter to see the difficulty rating.

### Vibe Actor (AI Generator)
Access the Vibe Actor interface via the "Vibe Actor" button in the Actor Directory. (Note: Only available to GM unless "Allow Players to Generate Actors" is enabled).
-   **Generate Creature**: Select CR, Type, Size, and provide a description. Click "Generate" to create a new NPC.
-   **Auto-Image**: Check "Generate Image after creation?" to automatically prompt for an image after the actor is created.

### AI Image Generation
-   **From Actor Sheet**: Open any actor sheet, click the "Configure" (or "Sheet Configuration") menu in the header, and select "Vibe Image" to create or update the actor's token image using AI.

### Vibe Adjust
-   **From Actor Sheet**: Open any actor sheet (NPC).
-   **Header Button**: Click the "Vibe Adjust" button (wrench icon) in the window header.
-   **Dialog**: Enter your adjustment request (e.g., "Make him a CR 5 undead", "Add a flaming sword").
-   **Result**: The AI will modify the actor's stats, items, and features to match your request while preserving their identity and image.

### Foundry V13 Compatibility
The module supports Foundry VTT Version 13 and `ActorSheetV2`. The "Vibe Adjust" and "Vibe Image" buttons are injected into the window header using the `getHeaderControlsApplicationV2` hook. Header controls use the `onClick` property (not `handler`) per the V13 `ApplicationHeaderControlsEntry` API. Legacy support for V12 sheets is also maintained.

---

## Developer Guide

This section is intended for developers (human or AI) working on this module.

### Standalone Testing

> [!IMPORTANT]
> **Model Usage Rule**: This module is strictly configured to use `gemini-2.5-flash-lite` for all text generation tasks to ensure speed and cost-efficiency. Do not change this to other models without explicit approval.


You can run generation and adjustment logic without launching Foundry VTT using standalone scripts. This is useful for quickly validating prompts, schemas, and automation wiring.

1.  **Prerequisites**:
    *   Node.js installed.
    *   `GEMINI_API_KEY` set in a `.env` file in the module root (see `.env.example`).

2.  **Running the Tests**:
    ```bash
    node scripts/utils/test-generation.js
    node scripts/utils/test-adjustment.js
    node scripts/tests/test_zod_schema.mjs
    node scripts/tests/activity-automation-regression.mjs
    ```

3.  **Output**:
    *   **Success**: Generated test JSONs are saved to `Example JSON's/Test Generated/`.
    *   **Automation Regression**: Fixture checks should pass for good save/condition/cone wiring and fail for intentionally bad fixtures.
    *   **Failure**: Errors are logged to `Error Logs/Test Errors.md` (or printed by the regression script).

### Architecture & Vision: "The Vibe Architect"

The core philosophy of this module is to move beyond simple "text-to-statblock" generation. We aim to build a **"Vibe Architect"**—a system that engineers unique, system-integrated actors.

Key Principles:
1.  **Pipeline Approach**: Generation is broken into distinct steps (Concept -> Selection -> Fabrication -> Assembly).
2.  **System Integration**: We prioritize using *existing* Compendium items (UUIDs) over generating custom data to keep world size low and leverage existing automation (Midi-QOL, etc.).
3.  **Smart Indexing**: We maintain a lightweight index of available content to feed into the AI.

### Codebase Structure

The module follows a standard Foundry VTT module structure with a focus on modular JavaScript (ES modules).

```
vibe-combat/
├── module.json              # Manifest: Entry point, dependencies, and metadata
├── README.md                # Project and developer documentation
├── package.json             # Node.js manifest (for standalone testing)
├── .env.example             # Example environment variables
├── feature-tips.md          # Activity automation guidance and QA checklist
├── scripts/                 # Core logic
│   ├── main.js              # Entry point: Hooks, settings, and UI injection
│   ├── constants.js         # Shared constants (e.g., XP tables)
│   ├── settings.js          # Foundry VTT settings registration
│   ├── agents/              # Generative AI agents (Zod-based structured output)
│   │   ├── generative-agent.js       # Base class for all agents
│   │   ├── architect-agent.js        # Step 1: Concept generation
│   │   ├── quartermaster-agent.js    # Step 2: Item selection/requests
│   │   ├── blacksmith-agent.js       # Step 3: Custom item fabrication
│   │   └── adjustment-agent.js       # Adjustment blueprint generation
│   ├── factories/           # Object creation logic
│   │   ├── actor-blueprint.js        # Blueprint helper model
│   │   ├── actor-factory.js          # Actor data normalization and creation
│   │   └── blueprint-factory.js      # Reverse engineer actor -> blueprint
│   ├── handlers/            # UI interaction handlers
│   │   ├── drag-drop-handler.js      # Drag-and-drop logic
│   │   └── placement-handler.js      # Token placement logic
│   ├── libs/                # Vendored dependencies
│   │   └── zod.js                    # Zod validation library
│   ├── managers/            # State management
│   │   ├── encounter-manager.js      # Encounter state and persistence
│   │   └── party-manager.js          # Party state and persistence
│   ├── schemas/             # Zod schemas for structured AI output
│   │   ├── analysis-schema.js        # Item analysis schema
│   │   ├── blueprint-schema.js       # Actor blueprint schema
│   │   └── foundry-item-schema.js    # Custom item schema
│   ├── services/            # External or shared services
│   │   ├── compendium-service.js     # Compendium lookup & fuzzy search
│   │   ├── gemini-pipeline.js        # Orchestrates the AI actor generation pipeline
│   │   ├── gemini-service.js         # Google Gemini API interaction (with retry)
│   │   ├── image-generation-service.js # OpenAI image generation
│   │   ├── spellcasting-builder.js   # Builds Spellcasting feats and embedded spells
│   │   └── encounter-suggestion-service.js # AI encounter suggestions
│   ├── tests/               # Deterministic regression and schema tests
│   │   ├── test_zod_schema.mjs       # Zod conversion smoke tests
│   │   ├── activity-automation-regression.mjs # Fixture-based automation checks
│   │   └── fixtures/
│   │       ├── good-automation-item.json
│   │       ├── bad-automation-item.json
│   │       ├── good-cone-save-item.json
│   │       └── bad-cone-save-item.json
│   ├── ui/                  # UI Components
│   │   ├── dialogs/                  # Dialog classes
│   │   │   ├── encounter-dialogs.js
│   │   │   ├── image-generation-dialog.js
│   │   │   ├── party-dialogs.js
│   │   │   ├── vibe-actor-dialog.js
│   │   │   └── vibe-adjustment-dialog.js
│   │   ├── button-injector.js        # Logic for injecting buttons into Foundry UI
│   │   ├── image-generator.js        # Image generation UI coordinator
│   │   ├── suggestion-sources-config.js    # Config for suggestion sources
│   │   └── vibe-combat-app.js        # Main Encounter Builder Application
│   └── utils/               # Helper functions
│       ├── actor-helpers.js          # Actor data extraction helpers
│       ├── drag-drop.js              # Drag-and-drop utilities
│       ├── file-utils.js             # File system utilities (for testing)
│       ├── item-utils.js             # Item validation, repair, and normalization utilities
│       ├── test-adjustment.js        # Standalone actor adjustment test runner
│       ├── test-generation.js        # Standalone actor generation test runner
│       ├── text-utils.js             # Text processing helpers
│       ├── xp-calculator.js          # XP and difficulty math
│       └── zod-to-json-schema.js     # Zod-to-JSON schema converter
├── styles/                  # CSS
│   ├── main.css             # Base styles and global CSS
│   ├── vibe-combat.css      # Main application styles
│   └── components/          # Component-specific styles
│       ├── encounter.css
│       ├── party.css
│       ├── suggestion.css
│       └── xp-meter.css
├── templates/               # HTML (Handlebars)
│   ├── suggestion-sources.html       # Suggestion sources config template
│   ├── vibe-actor-dialog.html        # Actor generation dialog template
│   ├── vibe-adjustment-dialog.html   # Actor adjustment dialog template
│   └── vibe-combat.html              # Main VibeCombatApp template
├── Example JSON's/          # Sample generated actor JSON files
└── Error Logs/              # Test error logs directory
```

### Key Components

#### 1. Entry Point (`scripts/main.js`)
-   **Hooks**: Listens for `ready`, `renderCombatTracker`, `renderSidebarTab`, and `renderActorDirectory`.
-   **Initialization**: Verifies the `dnd5e` system and registers settings.
-   **UI Injection**: Uses `button-injector.js` to place "Vibe Combat" and "Vibe Actor" buttons in the sidebar.

#### 2. Generative Agents (`scripts/agents/`)
The module uses a **structured output** approach with Zod schemas for type-safe AI generation.

*   **`GenerativeAgent`** (base class): Wraps `GeminiService`, auto-converts Zod schemas to JSON Schema for the API's `responseSchema` parameter.
*   **`ArchitectAgent`**: Step 1 - Generates the high-level "Blueprint" from user prompts, including optional automation intent hints.
*   **`QuartermasterAgent`**: Step 2 - Analyzes blueprint features and decides UUIDs vs. custom requests while preserving automation hints.
*   **`BlacksmithAgent`**: Step 3 - Fabricates Foundry/dnd5e item data for custom requests using structured activities.
*   **`AdjustmentAgent`**: Adjustment flow agent for modifying an existing blueprint from a natural-language request.

#### 3. The Gemini Pipeline (`scripts/services/gemini-pipeline.js`)
This is the orchestrator of the actor generation system. It coordinates the agents in a 4-step process:

*   **Step 1: The Architect (Concept)**: Uses `ArchitectAgent` to generate a high-level "Blueprint" (JSON) from the user's prompt. Decides on stats, flavor, "Twists", and desired features.
*   **Step 2: The Quartermaster (Selection)**: Uses `QuartermasterAgent` to search `CompendiumService` for matching items. Decides whether to use existing Item UUIDs or request custom items.
*   **Step 3: The Blacksmith (Fabrication)**: Uses `BlacksmithAgent` to generate custom items with activities/effects/uses wiring.
*   **Step 4: The Builder (Assembly)**: Combines UUIDs and custom items into the final Actor document. Calculates final data (CR, HP, AC), runs semantic automation validation/repair on custom items, conditionally normalizes redundant mutually-exclusive option structures, and creates the document.
    *   **Automation warnings**: Critical unresolved wiring issues (save/onSave/template/choice mismatches) are surfaced via item flags for easier review.
    *   **Spellcasting**: For spellcasters, builds a "Spellcasting" feat with `cast`-type activities referencing spell UUIDs. Spell items are fetched from compendium and embedded with `flags.dnd5e.cachedFor` linking them to their cast activities (matching official 2024 5e data model).

#### 4. Encounter Builder (`scripts/ui/vibe-combat-app.js`)
-   **Class**: `VibeCombatApp` (extends `Application`).
-   **Responsibility**: Orchestrates the UI for Party vs. Encounter management.
-   **Delegation**:
    -   **State**: Uses `PartyManager` and `EncounterManager` for state and persistence.
    -   **Interaction**: Uses `DragDropHandler` for drag-and-drop and `PlacementHandler` for token placement.
    -   **Dialogs**: Uses `PartyDialogs` and `EncounterDialogs` for user interactions.

#### 5. Compendium Service (`scripts/services/compendium-service.js`)
*   **Smart Indexing**: On load, it indexes standard `dnd5e` compendiums (Spells, Items, Features).
*   **Fuzzy Search**: Used by the Quartermaster to find items even if the AI doesn't know the exact name (e.g., matching "Fireball" when AI asks for "Fireball Spell").

#### 6. AI Actor Generator (`scripts/ui/dialogs/vibe-actor-dialog.js`)
-   **Class**: `VibeActorDialog`.
-   **Responsibility**: Collects user input and coordinates actor generation.
-   **Flow**: Uses `GeminiPipeline` to execute the generation workflow and create the actor document.

#### 7. AI Actor Adjustment (`scripts/ui/dialogs/vibe-adjustment-dialog.js`)
-   **Class**: `VibeAdjustmentDialog`.
-   **Responsibility**: Collects adjustment prompts for an existing NPC and runs `GeminiPipeline.adjustActor()`.
-   **Flow**: Reverse-engineers existing actor -> adjusted blueprint -> selection/fabrication/assembly pipeline.

#### 8. AI Image Generator (`scripts/ui/image-generator.js`)
-   **Responsibility**: Coordinates the image generation workflow.
-   **Integration**: Uses `ImageGenerationDialog` for prompts and `ImageGenerationService` for the backend work.

#### 9. Zod Schemas (`scripts/schemas/`)
Defines type-safe schemas for structured AI output:
*   **`blueprint-schema.js`**: Schema for actor blueprints (stats, abilities, features).
*   **`foundry-item-schema.js`**: Schema for custom Foundry item data.
*   **`analysis-schema.js`**: Schema for item analysis responses.

#### 10. Automation Validation (`scripts/utils/item-utils.js`, `scripts/tests/activity-automation-regression.mjs`)
-   **Runtime repair**: Pipeline calls utility helpers to detect common mismatches (save prose without save object, missing `damage.onSave`, missing area template size, condition prose without effects, missing uses wiring) and performs conservative repairs.
-   **Choice normalization**: When output includes redundant parent + option structures for one-of mechanics, helper/option activities are normalized; official single-item multi-activity structures are not forcibly rewritten.
-   **Regression harness**: Fixture-based deterministic checks ensure good wiring passes and intentionally bad wiring fails (including cone/save cases).

### Development Notes

-   **System Compatibility**: Strictly requires `dnd5e` v5.0+ (verified on v5.1.8).
-   **API Keys**: The module relies on `game.settings.get("vibe-combat", "geminiApiKey")`.
-   **Async/Await**: Heavy use of async functions for API calls and Foundry document creation.
-   **Modular Architecture**: The codebase is split into Agents, Managers, Services, Factories, Schemas, and UI components. Shared logic is kept in `utils/`.

### Extending the Module

#### Adding New AI Capabilities
The AI generation system uses a modular agent-based architecture:

1.  **To add a new pipeline step** (e.g., a \"Lore Writer\"):
    *   Create a new agent class in `scripts/agents/` extending `GenerativeAgent`.
    *   Define a Zod schema in `scripts/schemas/` for the agent's output.
    *   Add a method to `GeminiPipeline` to orchestrate the new agent.
    *   Call the new method from `generateActor()`.

2.  **To modify prompts or schemas**:
    *   Agent-specific prompts are in each agent file (`architect-agent.js`, etc.).
    *   Schemas are in `scripts/schemas/` and use Zod for type-safe validation.

#### Customizing the UI
*   `VibeActorDialog` handles the prompt input.
*   `VibeCombatApp` handles the encounter tracker.

## Lessons Learned

1. **Foundry V13 header controls use `onClick`, not `handler`**  
   For `getHeaderControlsApplicationV2`, use `onClick` in control entries or buttons may silently fail.
2. **Schema-valid JSON is not always automation-complete**  
   Even valid item JSON can miss mechanical wiring (save/effects/uses), so semantic checks are required in addition to Zod validation.
3. **Preserve mechanic intent across pipeline stages**  
   Blueprint/selection layers need automation hints so Blacksmith can map prose to activity data reliably.
4. **dnd5e 2024 spellcasting needs activity linkage**  
   Cast activities should map to embedded spells via `flags.dnd5e.cachedFor` to align with modern official data.
5. **Rate limits are pipeline-amplified**  
   Multi-step generation (Architect -> Quartermaster -> Blacksmith -> Builder) increases API call count and quickly hits free-tier limits.
6. **Mutually exclusive mechanics need conditional structure handling**  
   Some creatures are best represented as one feature with many activities (official Eye Rays style), while others are cleaner as helper + option activities/items; normalization must be conditional, not global.

## Known Issues & Error Handling

This section documents common errors and their solutions.

### API Errors

| Error Code | Status               | Cause                                             | Solution                                                             |
| ---------- | -------------------- | ------------------------------------------------- | -------------------------------------------------------------------- |
| **400**    | `INVALID_ARGUMENT`   | Invalid JSON structure or parameter               | The module uses `v1beta` to ensure structured output compatibility.  |
| **429**    | `RESOURCE_EXHAUSTED` | Rate limit exceeded (20 req/period for free tier) | The module implements exponential backoff. Wait for the retry delay. |
| **503**    | `UNAVAILABLE`        | Model overloaded                                  | Retry with backoff (transient error).                                |

### Rate Limiting Best Practices

> [!IMPORTANT]
> The 4-step pipeline (Architect → Quartermaster → Blacksmith → Builder) makes multiple API calls per generation. With the free tier limit of 20 requests, users can only generate ~5 actors per rate limit window.

**Recommendations:**
1. **Distinguish error types:**
   - `429` errors: Wait for the `retryDelay`.
   - `503` errors: Retry immediately.
   - `400` errors: Report as bug (should be handled by module).
2. **Consider paid tier** for heavy usage.



## Development Guidelines

All Foundry VTT code must be compatible with the following version information:

-   **Core Version**: 13.348
-   **System ID**: dnd5e
-   **System Version**: 5.1.8
