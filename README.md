# Vibe Combat

Vibe Combat is a Foundry VTT module for the dnd5e system that helps Game Masters manage party XP budgets, encounter difficulties, and generate NPC actors using Google's Gemini AI.

## Features

-   **Party XP Budget Management**: Calculate and track party XP thresholds (Easy, Medium, Hard, Deadly) based on party size and level.
-   **Encounter Difficulty Calculation**: Real-time feedback on encounter difficulty as you add monsters.
-   **AI Actor Generation**: Generate complete dnd5e NPC stat blocks from text descriptions using Google Gemini.
-   **AI Image Generation**: Generate token images for actors using OpenAI (DALL-E 3).

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

## Usage

### Vibe Combat (Encounter Builder)
Access the Vibe Combat interface via the "Vibe Combat" button in the Combat Tracker (Encounter tab).
-   **Party**: Add actors to the party to calculate the XP budget.
-   **Encounter**: Add monsters to the encounter to see the difficulty rating.

### Vibe Actor (AI Generator)
Access the Vibe Actor interface via the "Vibe Actor" button in the Actor Directory.
-   **Generate Creature**: Select CR, Type, Size, and provide a description. Click "Generate" to create a new NPC.
-   **Auto-Image**: Check "Generate Image after creation?" to automatically prompt for an image after the actor is created.

### AI Image Generation
-   **From Actor Sheet**: Open any actor sheet, click the "Configure" (or "Sheet Configuration") menu in the header, and select "Generate Image" to create or update the actor's token image using AI.

---

## Developer Guide

This section is intended for developers (human or AI) working on this module.

### Standalone Testing

> [!IMPORTANT]
> **Model Usage Rule**: This module is strictly configured to use `gemini-2.5-flash-lite` for all text generation tasks to ensure speed and cost-efficiency. Do not change this to other models without explicit approval.


You can run the actor generation logic without launching Foundry VTT using the standalone test script. This is useful for testing the AI prompts and pipeline logic quickly.

1.  **Prerequisites**:
    *   Node.js installed.
    *   `GEMINI_API_KEY` set in a `.env` file in the module root (see `.env.example`).

2.  **Running the Test**:
    ```bash
    node scripts/utils/test-generation.js
    ```

3.  **Output**:
    *   **Success**: Generated Blueprint JSONs are saved to `Example JSON's/Test Generated/`.
    *   **Failure**: Errors are logged to `Error Logs/Test Errors.md`.

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
├── scripts/                 # Core logic
│   ├── main.js              # Entry point: Hooks, settings, and UI injection
│   ├── constants.js         # Shared constants (e.g., XP tables)
│   ├── settings.js          # Foundry VTT settings registration
│   ├── factories/           # Object creation logic
│   │   ├── actor-blueprint.js        # Actor Blueprint schema and validation
│   │   └── actor-factory.js          # Actor data normalization and creation
│   ├── handlers/            # UI interaction handlers
│   │   ├── drag-drop-handler.js      # Drag-and-drop logic
│   │   └── placement-handler.js      # Token placement logic
│   ├── managers/            # State management
│   │   ├── encounter-manager.js      # Encounter state and persistence
│   │   └── party-manager.js          # Party state and persistence
│   ├── services/            # External or shared services
│   │   ├── compendium-service.js     # Compendium lookup logic
│   │   ├── gemini-pipeline.js        # Orchestrates the AI actor generation pipeline
│   │   ├── gemini-service.js         # Google Gemini API interaction
│   │   └── image-generation-service.js # Image generation logic
│   ├── ui/                  # UI Components
│   │   ├── dialogs/                  # Dialog classes
│   │   │   ├── encounter-dialogs.js
│   │   │   ├── image-generation-dialog.js
│   │   │   ├── party-dialogs.js
│   │   │   └── vibe-actor-dialog.js
│   │   ├── button-injector.js        # Logic for injecting buttons into Foundry UI
│   │   ├── encounter-suggestion-service.js # Logic for AI encounter suggestions
│   │   ├── image-generator.js        # Image generation UI coordinator
│   │   └── vibe-combat-app.js        # Main Encounter Builder Application
│   └── utils/               # Helper functions
│       ├── actor-helpers.js          # Actor data extraction helpers
│       ├── drag-drop.js              # Drag-and-drop utilities
│       ├── text-utils.js             # Text processing helpers
│       └── xp-calculator.js          # XP and difficulty math
├── styles/                  # CSS
│   ├── main.css             # Base styles
│   └── components/          # Component-specific styles
│       ├── encounter.css
│       ├── party.css
│       ├── suggestion.css
│       └── xp-meter.css
└── templates/               # HTML (Handlebars)
    └── vibe-combat.html     # Template for VibeCombatApp
```

### Key Components

#### 1. Entry Point (`scripts/main.js`)
-   **Hooks**: Listens for `ready`, `renderCombatTracker`, `renderSidebarTab`, and `renderActorDirectory`.
-   **Initialization**: Verifies the `dnd5e` system and registers settings.
-   **UI Injection**: Uses `button-injector.js` to place "Vibe Combat" and "Vibe Actor" buttons in the sidebar.

#### 2. The Gemini Pipeline (`scripts/services/gemini-pipeline.js`)
This is the heart of the actor generation system. It follows a 4-step process:

*   **Step 1: The Architect (Concept)**:
    *   Generates a high-level "Blueprint" (JSON) from the user's prompt.
    *   Decides on stats, flavor, "Twists", and desired features.
*   **Step 2: The Quartermaster (Selection)**:
    *   Takes the Blueprint features and searches the `CompendiumService` for matches.
    *   Decides whether to use an existing Item UUID or request a custom item.
*   **Step 3: The Blacksmith (Fabrication)**:
    *   For any requested *custom* items, this step generates valid Foundry V5+ Item Data.
    *   Ensures rigorous adherence to the `dnd5e` data model (activities, damage parts).
*   **Step 4: The Builder (Assembly)**:
    *   Combines the selected UUIDs and fabricated Items into the final Actor document.
    *   Calculates final data (CR, HP, AC) and creates the document.
    *   **Spellcasting**: For spellcasters, builds a "Spellcasting" feat with `cast`-type activities referencing spell UUIDs (matching official 2024 5e data model).

#### 3. Encounter Builder (`scripts/ui/vibe-combat-app.js`)
-   **Class**: `VibeCombatApp` (extends `Application`).
-   **Responsibility**: Orchestrates the UI for Party vs. Encounter management.
-   **Delegation**:
    -   **State**: Uses `PartyManager` and `EncounterManager` for state and persistence.
    -   **Interaction**: Uses `DragDropHandler` for drag-and-drop and `PlacementHandler` for token placement.
    -   **Dialogs**: Uses `PartyDialogs` and `EncounterDialogs` for user interactions.

#### 4. Compendium Service (`scripts/services/compendium-service.js`)
*   **Smart Indexing**: On load, it indexes standard `dnd5e` compendiums (Spells, Items, Features).
*   **Fuzzy Search**: Used by the Quartermaster to find items even if the AI doesn't know the exact name (e.g., matching "Fireball" when AI asks for "Fireball Spell").

#### 5. AI Actor Generator (`scripts/ui/dialogs/vibe-actor-dialog.js`)
-   **Class**: `VibeActorDialog`.
-   **Responsibility**: Collects user input and coordinates actor generation.
-   **Flow**: Uses `GeminiPipeline` to execute the generation workflow and create the actor document.

#### 6. AI Image Generator (`scripts/ui/image-generator.js`)
-   **Responsibility**: Coordinates the image generation workflow.
-   **Integration**: Uses `ImageGenerationDialog` for prompts and `ImageGenerationService` for the backend work.

### Development Notes

-   **System Compatibility**: Strictly requires `dnd5e` v4.0+.
-   **API Keys**: The module relies on `game.settings.get("vibe-combat", "geminiApiKey")`.
-   **Async/Await**: Heavy use of async functions for API calls and Foundry document creation.
-   **Modular Architecture**: The codebase is split into Managers, Services, Factories, and UI components. Shared logic is kept in `utils/`.

### Extending the Module

#### Adding New AI Capabilities
Logic for AI generation is encapsulated in `GeminiPipeline`.
*   To add a new "Step" (e.g., a "Lore Writer"), add a method to the `GeminiPipeline` class and call it in `generateActor`.
*   To change the prompts, check the specific step methods (`runArchitect`, `runQuartermaster`, etc.).

#### Customizing the UI
*   `VibeActorDialog` handles the prompt input.
*   `VibeCombatApp` handles the encounter tracker.

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

All FoundryVTT code must be compatible with the following version information:

-   **Core Version**: 13.351
-   **System ID**: dnd5e
-   **System Version**: 5.1.8
